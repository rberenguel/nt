const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = parseInt(params.get("screens") || "1", 10);
const isPrimary = screenIndex === 0;

const THEMES = [
  { bg: "#020a1e", stroke: "#ffffff",   label: "rgba(255,255,255,0.35)", lineWidth: 4, grain: false },
  { bg: "#c8b99a", stroke: "#140c05",   label: "rgba(20,12,5,0.40)",     lineWidth: 4, grain: true  },
];

let theme = null;
let grainCanvas = null;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

function makeGrain(w, h) {
  const oc = new OffscreenCanvas(w, h);
  const octx = oc.getContext("2d");
  const id = octx.createImageData(w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.random() * 60;
    d[i] = 10; d[i+1] = 6; d[i+2] = 2;
    d[i+3] = v;
  }
  octx.putImageData(id, 0, 0);
  const grad = octx.createRadialGradient(w/2, h/2, h*0.3, w/2, h/2, h*0.85);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.18)");
  octx.fillStyle = grad;
  octx.fillRect(0, 0, w, h);
  return oc;
}

function applyTheme(idx) {
  theme = THEMES[idx];
  document.body.style.background = theme.bg;
  grainCanvas = theme.grain ? makeGrain(canvas.width, canvas.height) : null;
}

function fillBg() {
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (theme.grain && grainCanvas) ctx.drawImage(grainCanvas, 0, 0);
}

function redrawAfterResize() {
  if (!theme || phase === "waiting") return;
  fillBg();
  const { scale, ox, oy } = fishTransform();
  ctx.strokeStyle = theme.stroke;
  ctx.lineWidth   = theme.lineWidth;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  const upTo = phase === "drawing" ? lineIdx : polylines.length;
  for (let i = 0; i < upTo; i++) {
    const line = polylines[i];
    if (line.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(ox + line[0][0] * scale, oy + line[0][1] * scale);
    for (let j = 1; j < line.length; j++) ctx.lineTo(ox + line[j][0] * scale, oy + line[j][1] * scale);
    ctx.stroke();
  }
  if (phase !== "drawing") drawLabel();
  ptIdx = 0;
}

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  if (theme && theme.grain) grainCanvas = makeGrain(canvas.width, canvas.height);
  redrawAfterResize();
}
window.addEventListener("resize", resize);
resize();

// ── Fish generation ───────────────────────────────────────────────────────────
function getBBox(polylines) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const line of polylines) {
    for (const [x, y] of line) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

let fishBBox = { x: 0, y: 0, w: 500, h: 300 };

const PAUSE_AFTER   = 2000;
const FADE_DURATION = 600;
const STROKE_DELAY  = 6;

let polylines   = [];
let fishName    = "";
let lineIdx     = 0;
let ptIdx       = 0;
let phase       = "waiting";
let phaseStart  = 0;
let lastSegTime = 0;

function fishTransform() {
  const pad    = Math.min(canvas.width, canvas.height) * 0.1;
  const availW = canvas.width  - pad * 2;
  const availH = canvas.height - pad * 2;
  const scale  = Math.min(availW / fishBBox.w, availH / fishBBox.h);
  const ox = (canvas.width  - fishBBox.w * scale) / 2 - fishBBox.x * scale;
  const oy = (canvas.height - fishBBox.h * scale) / 2 - fishBBox.y * scale;
  return { scale, ox, oy };
}

function drawLabel() {
  const { scale, ox, oy } = fishTransform();
  ctx.font = `italic ${Math.round(13 * scale)}px Georgia, serif`;
  ctx.fillStyle = theme.label;
  ctx.textAlign = "center";
  ctx.fillText(fishName, canvas.width / 2, oy + (fishBBox.y + fishBBox.h) * scale + 20);
}

function drawAll(alpha) {
  const { scale, ox, oy } = fishTransform();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = theme.stroke;
  ctx.lineWidth   = theme.lineWidth;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  for (const line of polylines) {
    if (line.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(ox + line[0][0] * scale, oy + line[0][1] * scale);
    for (let i = 1; i < line.length; i++) {
      ctx.lineTo(ox + line[i][0] * scale, oy + line[i][1] * scale);
    }
    ctx.stroke();
  }
  ctx.restore();
  if (alpha > 0.5) drawLabel();
}

function spawnFish(seed) {
  jsr = seed;
  const p  = generate_params();
  fishName  = binomen(p.seed);
  polylines = cleanup(fish(p));
  fishBBox  = getBBox(polylines);
  lineIdx   = 0;
  ptIdx     = 0;
  phase     = "drawing";
  lastSegTime = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  fillBg();
}

let currentSeed = 0;

function nextFish() {
  currentSeed    = ~~(Math.random() * 0xffffffff);
  const themeIdx = THEMES.indexOf(theme);
  bc.postMessage({ newFish: true, seed: currentSeed, themeIdx });
  spawnFish(currentSeed);
}

function drawStep(now) {
  if (phase === "waiting") return;

  if (phase === "drawing") {
    if (now - lastSegTime < STROKE_DELAY) return;
    lastSegTime = now;

    if (lineIdx >= polylines.length) {
      drawLabel();
      phase = "pausing";
      phaseStart = now;
      return;
    }

    const line = polylines[lineIdx];
    const { scale, ox, oy } = fishTransform();
    ctx.strokeStyle = theme.stroke;
    ctx.lineWidth   = theme.lineWidth;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";

    if (ptIdx === 0) {
      ctx.beginPath();
      ctx.moveTo(ox + line[0][0] * scale, oy + line[0][1] * scale);
      ptIdx = 1;
    }

    if (ptIdx < line.length) {
      ctx.lineTo(ox + line[ptIdx][0] * scale, oy + line[ptIdx][1] * scale);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ox + line[ptIdx][0] * scale, oy + line[ptIdx][1] * scale);
      ptIdx++;
    }

    if (ptIdx >= line.length) {
      lineIdx++;
      ptIdx = 0;
    }

  } else if (phase === "pausing") {
    if (now - phaseStart >= PAUSE_AFTER) {
      phase = "fading";
      phaseStart = now;
    }

  } else if (phase === "fading") {
    const t = (now - phaseStart) / FADE_DURATION;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fillBg();
    if (t < 1) {
      drawAll(1 - t);
    } else {
      nextFish();
    }
  }
}

// ── Multi-screen sync via BroadcastChannel ────────────────────────────────────
const bc = new BroadcastChannel("fishdraw");

function loop(now) {
  drawStep(now);
  requestAnimationFrame(loop);
}

function saveCanvas() {
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fishdraw-${fishName.replace(/ /g, "_")}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

bc.addEventListener("message", ({ data }) => {
  if (data.quit) { window.close(); return; }
  if (isPrimary && data.hello) {
    bc.postMessage({ newFish: true, seed: currentSeed, themeIdx: THEMES.indexOf(theme) });
    return;
  }
  if (data.themeChange) { applyTheme(data.themeIdx); spawnFish(data.seed); return; }
  if (data.save && isPrimary) { saveCanvas(); return; }
  if (!isPrimary && data.newFish) {
    if (!theme) applyTheme(data.themeIdx);
    spawnFish(data.seed);
  }
});

if (isPrimary) {
  applyTheme(Math.floor(Math.random() * THEMES.length));
  fillBg();
  nextFish();
} else {
  bc.postMessage({ hello: true });
}

requestAnimationFrame(loop);

// ── Fullscreen & Keys ─────────────────────────────────────────────────────────
function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}

document.addEventListener("click", () => {
  if (!document.fullscreenElement) enterFullscreen();
});

document.addEventListener("keydown", e => {
  if (e.key === "q" || e.key === "Q") { bc.postMessage({ quit: true }); window.close(); }
  if (e.key === "s" || e.key === "S") { if (isPrimary) saveCanvas(); else bc.postMessage({ save: true }); }
  if (e.key === " ") {
    const themeIdx = (THEMES.indexOf(theme) + 1) % THEMES.length;
    applyTheme(themeIdx);
    bc.postMessage({ themeChange: true, themeIdx, seed: currentSeed });
    spawnFish(currentSeed);
  }
});
