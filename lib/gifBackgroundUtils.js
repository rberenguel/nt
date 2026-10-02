// Animated pixel-art GIF backgrounds.
// Picks one GIF daily (via getDailyRandom), renders it to a canvas inside
// #background at the largest integer scale that fits the screen, centered.
// The letterbox bars are filled with the dominant color along the GIF's edges,
// making the canvas fully opaque — no interaction with the static backgroundImage.
// A metaP command ("Toggle animated background") persists the on/off state.

const GIF_BG_KEY = "animatedBackground";

let _player = null;  // GifPlayer instance, created on first load
let _canvas = null;  // <canvas> inside #background
let _gifUrl = null;  // resolved URL of the selected GIF
let _speed = 0.25;   // playback speed multiplier (< 1 = slower)

function _isAnimated(defaultMode) {
  const stored = localStorage.getItem(GIF_BG_KEY);
  return stored === null ? defaultMode : stored === "true";
}

function _setAnimated(val) {
  localStorage.setItem(GIF_BG_KEY, val ? "true" : "false");
}

// Sample all border pixels of a frame and return the most common
// non-transparent color as an rgb() string.
function _edgeDominantColor(frameData, w, h) {
  const counts = new Map();

  function sample(x, y) {
    const i = (y * w + x) * 4;
    if (frameData[i + 3] === 0) return; // skip transparent
    const key = (frameData[i] << 16) | (frameData[i + 1] << 8) | frameData[i + 2];
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { sample(0, y); sample(w - 1, y); }

  if (counts.size === 0) return null;

  let maxCount = 0, dominant = 0;
  for (const [key, count] of counts) {
    if (count > maxCount) { maxCount = count; dominant = key; }
  }

  const r = (dominant >> 16) & 0xff;
  const g = (dominant >> 8) & 0xff;
  const b = dominant & 0xff;
  return `rgb(${r},${g},${b})`;
}

function _applyEdgeColor(player) {
  if (!player.frames.length) return;
  const frame = player.frames[0];
  const color = _edgeDominantColor(frame.data, frame.width, frame.height);
  // Set on the player — _drawFrame fills letterbox bars with this color,
  // making the canvas opaque so backgroundImage can't show through.
  player.bgColor = color ?? "#000";
}

function _ensureCanvas() {
  if (_canvas) return _canvas;
  const c = document.createElement("canvas");
  c.id = "gif-bg-canvas";
  c.width = window.innerWidth;
  c.height = window.innerHeight;
  c.style.cssText =
    "position:absolute;top:0;left:0;width:100%;height:100%;" +
    "image-rendering:pixelated;image-rendering:crisp-edges;";
  document.getElementById("background").appendChild(c);
  window.addEventListener("resize", () => {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    if (_player) _player.redraw();
  });
  _canvas = c;
  return c;
}

function _startGif() {
  if (!_gifUrl) return;
  const canvas = _ensureCanvas();
  canvas.style.display = "";
  if (!_player) {
    _player = new GifPlayer({ speed: _speed });
    _player
      .load(_gifUrl)
      .then((p) => {
        if (_canvas && _canvas.style.display !== "none") {
          _applyEdgeColor(p);
          p.start(_canvas);
        }
      })
      .catch((e) => console.error("GIF background load failed:", e));
  } else {
    _applyEdgeColor(_player);
    _player.start(canvas);
  }
}

function _stopGif() {
  if (_player) _player.stop();
  if (_canvas) _canvas.style.display = "none";
}

function _toggle() {
  const next = !(_isAnimated(true));
  _setAnimated(next);
  if (next) _startGif();
  else _stopGif();
}

function processPixelBackgrounds(items) {
  console.info(
    `HANDLER: processPixelBackgrounds called with ${items.length} item(s)`
  );
  const item = items?.[0];
  if (!item) return;

  _speed = parseFloat(item.speed ?? 0.25);
  const defaultAnimated = item.default !== "static";

  // Register metaP command synchronously — before async fetch so it lands
  // in _ntCommands before the 100ms metaP.bind call in mainParser.
  window._ntCommands = (window._ntCommands || []).concat([
    { title: "Toggle animated background", lambda: _toggle },
  ]);

  const listPaths = Object.keys(item).filter(
    (k) => !["kind", "title", "speed", "default", "path"].includes(k)
  );
  if (!listPaths.length) {
    console.warn("No GIF list file(s) in pixel backgrounds config.");
    return;
  }

  const basePath = item.path ?? "backgrounds/anas-abdin";

  Promise.all(
    listPaths.map((p) =>
      fetch(p)
        .then((r) => r.text())
        .then((text) =>
          text
            .split("\n")
            .filter((l) => l.startsWith("- "))
            .map((l) => l.replace(/^-\s+/, "").trim())
            .filter(Boolean)
        )
    )
  ).then((results) => {
    const gifs = results.flat();
    if (!gifs.length) {
      console.warn("No GIF filenames found in pixel backgrounds list(s).");
      return;
    }
    getDailyRandom(gifs.length, (idx) => {
      _gifUrl = `${basePath}/${gifs[idx]}`;
      console.info(`Pixel background selected: ${_gifUrl}`);
      if (_isAnimated(defaultAnimated)) _startGif();
    });
  });
}
