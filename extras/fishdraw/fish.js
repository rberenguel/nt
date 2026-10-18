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
  if (!theme) return;
  renderFrame(phase, currentProgress, currentAlpha);
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

const INITIAL_DELAY = 500;
const DRAW_DURATION = 4200;
const PAUSE_AFTER   = 2000;
const FADE_DURATION = 600;
const STAGGER_MAX   = 0.08;

let polylines        = [];
let lineData         = [];
let maxLineLen       = 0;
let fishName         = "";
let phase            = "waiting";
let phaseStart       = 0;
let currentProgress  = 0;
let currentAlpha     = 1;
let currentSeed      = 0;
let initialDelayDone = false;
let initialStartTime = 0;

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

function renderFrame(pPhase, progress, alpha = 1) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  fillBg();

  if (pPhase === "drawing") {
    if (progress > 0) {
      const { scale, ox, oy } = fishTransform();
      ctx.strokeStyle = theme.stroke;
      ctx.lineWidth   = theme.lineWidth;
      ctx.lineCap     = "round";
      ctx.lineJoin    = "round";

      ctx.beginPath();
      for (const { line, totalLen, cumLens, startT } of lineData) {
        if (line.length < 2 || totalLen <= 0) continue;
        if (progress <= startT) continue; // Not started yet

        const lineProgress = progress >= 1 ? 1 : (progress - startT) / (1 - startT);
        const currentDist = lineProgress * totalLen;

        // Skip until the stroke has moved slightly to avoid drawing static round dots at the start point
        if (currentDist < 0.6) continue;

        ctx.moveTo(ox + line[0][0] * scale, oy + line[0][1] * scale);

        if (lineProgress >= 1) {
          for (let j = 1; j < line.length; j++) {
            ctx.lineTo(ox + line[j][0] * scale, oy + line[j][1] * scale);
          }
        } else {
          let k = 0;
          while (k < cumLens.length - 2 && cumLens[k + 1] <= currentDist) {
            k++;
          }
          for (let j = 1; j <= k; j++) {
            ctx.lineTo(ox + line[j][0] * scale, oy + line[j][1] * scale);
          }
          const segLen = cumLens[k + 1] - cumLens[k];
          const frac = segLen > 0 ? (currentDist - cumLens[k]) / segLen : 0;
          const hx = line[k][0] + (line[k + 1][0] - line[k][0]) * frac;
          const hy = line[k][1] + (line[k + 1][1] - line[k][1]) * frac;
          ctx.lineTo(ox + hx * scale, oy + hy * scale);
        }
      }
      ctx.stroke();
    }
    if (progress >= 1) drawLabel();
  } else if (pPhase === "pausing") {
    drawAll(1);
    drawLabel();
  } else if (pPhase === "fading") {
    drawAll(alpha);
  }
}

function spawnFish(seed) {
  jsr = seed;
  const p  = generate_params();
  fishName  = binomen(p.seed);
  polylines = cleanup(fish(p));
  fishBBox  = getBBox(polylines);
  maxLineLen = 0;
  const nLines = Math.max(1, polylines.length - 1);
  lineData  = polylines.map((line, i) => {
    const cumLens = [0];
    let total = 0;
    for (let j = 0; j < line.length - 1; j++) {
      total += Math.hypot(line[j + 1][0] - line[j][0], line[j + 1][1] - line[j][1]);
      cumLens.push(total);
    }
    if (total > maxLineLen) maxLineLen = total;
    // Slight deterministic stagger: structural lines start earliest, texture joins within STAGGER_MAX
    const baseT = i / nLines;
    const jitter = ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1;
    const startT = Math.min(STAGGER_MAX, (baseT * 0.75 + jitter * 0.25) * STAGGER_MAX);
    return { line, totalLen: total, cumLens, startT };
  });
}

function nextFish() {
  currentSeed = ~~(Math.random() * 0xffffffff);
  spawnFish(currentSeed);
  phase = "drawing";
  phaseStart = 0;
  currentProgress = 0;
  currentAlpha = 1;
}

function toggleTheme() {
  const themeIdx = (THEMES.indexOf(theme) + 1) % THEMES.length;
  applyTheme(themeIdx);
  nextFish();
}

function easeInToLinear(u) {
  const c = 0.4; // ramp up speed over the first 40% of duration
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const total = 1 - (2 * c) / 3;
  if (u < c) {
    return (Math.pow(u, 3) / (3 * c * c)) / total;
  }
  return (c / 3 + (u - c)) / total;
}

function primaryLoop(now) {
  if (!initialDelayDone) {
    if (initialStartTime === 0) initialStartTime = now;
    renderFrame("drawing", 0, 1);
    bc.postMessage({
      cmd: "sync",
      seed: currentSeed,
      themeIdx: THEMES.indexOf(theme),
      phase: "drawing",
      progress: 0,
      alpha: 1,
    });
    if (now - initialStartTime >= INITIAL_DELAY) {
      initialDelayDone = true;
      phaseStart = now;
    }
    requestAnimationFrame(primaryLoop);
    return;
  }

  if (phase === "drawing") {
    if (phaseStart === 0) phaseStart = now;
    const elapsed = Math.max(0, now - phaseStart);
    const u = Math.min(1, elapsed / DRAW_DURATION);
    currentProgress = easeInToLinear(u);
    currentAlpha = 1;

    renderFrame("drawing", currentProgress, 1);

    if (u >= 1) {
      phase = "pausing";
      phaseStart = now;
    }
  } else if (phase === "pausing") {
    currentProgress = 1;
    currentAlpha = 1;
    renderFrame("pausing", 1, 1);

    if (now - phaseStart >= PAUSE_AFTER) {
      phase = "fading";
      phaseStart = now;
    }
  } else if (phase === "fading") {
    currentProgress = 1;
    const t = (now - phaseStart) / FADE_DURATION;
    currentAlpha = Math.max(0, 1 - t);
    renderFrame("fading", 1, currentAlpha);

    if (t >= 1) {
      nextFish();
      requestAnimationFrame(primaryLoop);
      return;
    }
  }

  bc.postMessage({
    cmd: "sync",
    seed: currentSeed,
    themeIdx: THEMES.indexOf(theme),
    phase,
    progress: currentProgress,
    alpha: currentAlpha,
  });

  requestAnimationFrame(primaryLoop);
}

// ── Multi-screen sync via BroadcastChannel ────────────────────────────────────
const bc = new BroadcastChannel("fishdraw");

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

bc.onmessage = ({ data }) => {
  if (!data) return;
  if (data.quit) { window.close(); return; }

  if (isPrimary) {
    if (data.cmd === "requestSync") {
      bc.postMessage({
        cmd: "sync",
        seed: currentSeed,
        themeIdx: THEMES.indexOf(theme),
        phase,
        progress: currentProgress,
        alpha: currentAlpha,
      });
    } else if (data.cmd === "toggleTheme") {
      toggleTheme();
    } else if (data.cmd === "save") {
      saveCanvas();
    }
    return;
  }

  // Secondary display client:
  if (data.cmd === "sync") {
    if (data.themeIdx !== undefined && THEMES[data.themeIdx] !== theme) {
      applyTheme(data.themeIdx);
    }
    if (data.seed !== currentSeed) {
      currentSeed = data.seed;
      spawnFish(currentSeed);
    }
    phase = data.phase;
    currentProgress = data.progress;
    currentAlpha = data.alpha;
    renderFrame(phase, currentProgress, currentAlpha);
  }
};

if (isPrimary) {
  applyTheme(Math.floor(Math.random() * THEMES.length));
  nextFish();
  requestAnimationFrame(primaryLoop);
} else {
  bc.postMessage({ cmd: "requestSync" });
}

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
  if (e.key === "s" || e.key === "S") { if (isPrimary) saveCanvas(); else bc.postMessage({ cmd: "save" }); }
  if (e.key === " ") {
    if (isPrimary) {
      toggleTheme();
    } else {
      bc.postMessage({ cmd: "toggleTheme" });
    }
  }
});
