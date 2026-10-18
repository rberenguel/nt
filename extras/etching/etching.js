// Procedural Copperplate Etched Landscapes
// Inspired by Albrecht Dürer, 18th/19th century intaglio engravings,
// Japanese woodblock prints, and u/generativelight (p5js landscape etchings).
// Multi-screen BroadcastChannel coordination with primary driver.

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = params.has("screens") ? parseInt(params.get("screens"), 10) : 1;
const isPrimary = screenIndex === 0;

document.title = `Etching ${screenIndex}`;

const canvas = document.getElementById("etchingCanvas");
const ctx = canvas.getContext("2d");

// ── Multi-screen BroadcastChannel ─────────────────────────────────────────────
const bc = new BroadcastChannel("etching");

function saveCanvas() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `etching-screen${screenIndex}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

let paletteIdx = Math.floor(Math.random() * PALETTES.length);
let landscapeSeed = Math.floor(Math.random() * 10000000);
let paused = false;
let showBezel = 0.0;

// Animation timing configuration (ms)
const INITIAL_DELAY  = 500;    // Wait 500ms on first launch for Chrome multi-window sync
const DRAW_DURATION  = 24000;  // Deliberate line-by-line engraving duration (~24s)
const PAUSE_DURATION = 14000;  // Linger for 14s to admire completed print
const FADE_DURATION  = 900;    // Dissolve into next etching (~0.9s)

let initialDelayDone = false;
let initialStartTime = 0;
let phase = "drawing"; // "drawing" | "pausing" | "fading"
let phaseStart = 0;
let currentProgress = 0.0;
let currentAlpha = 1.0;

let landscapeName = "";
let renderedFinalSeed = null;

// ── Offscreen Panoramic Etching Canvas ────────────────────────────────────────
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");

function cleanBorders(ctx, w, h, paperColor, margin) {
  ctx.save();
  ctx.fillStyle = paperColor;
  // Clean top margin
  ctx.fillRect(0, 0, w, margin);
  // Clean bottom margin
  ctx.fillRect(0, h - margin, w, margin);
  // Clean left margin
  ctx.fillRect(0, 0, margin, h);
  // Clean right margin
  ctx.fillRect(w - margin, 0, margin, h);
  ctx.restore();
}

function generateLandscape(totalW, totalH, seed) {
  landscapeName = typeof generateLandscapeName === "function" ? generateLandscapeName(seed) : "";
  renderedFinalSeed = null;
  generateSun(totalW, totalH, seed);
  generateMountains(totalW, totalH, seed);
  generateSkyPaths(totalW, totalH, seed, mountainLayers[0]);
  generateClouds(totalW, totalH, seed);
}

function renderOffscreenScene(totalW, totalH, seed, progress, alpha) {
  offscreenCanvas.width = totalW;
  offscreenCanvas.height = totalH;

  const pal = PALETTES[paletteIdx];

  // 1. Base Antique Laid Paper Wash with subtle tooth
  offscreenCtx.fillStyle = pal.paper;
  offscreenCtx.fillRect(0, 0, totalW, totalH);

  const pat = getLaidPattern(offscreenCtx);
  if (pat) {
    offscreenCtx.save();
    offscreenCtx.fillStyle = pat;
    offscreenCtx.globalCompositeOperation = pal.isDark ? "screen" : "multiply";
    offscreenCtx.globalAlpha = pal.isDark ? 0.18 : 0.55;
    offscreenCtx.fillRect(0, 0, totalW, totalH);
    offscreenCtx.restore();
  }

  if (progress <= 0) return;

  // Time slice allocations for sequential line-by-line engraving:
  // Sun: 0.00 -> 0.16 (Disc outline + rays carved clockwise one-by-one)
  const sunProgress = Math.min(1.0, progress / 0.16);

  // Sky: 0.10 -> 0.35 (Atmospheric vertical broken lines carved column-by-column left-to-right)
  const skyProgress = Math.max(0.0, Math.min(1.0, (progress - 0.10) / 0.25));

  // Clouds: 0.32 -> 0.46 (Multiscale arch-carved clouds rising formation-by-formation)
  const cloudProgress = Math.max(0.0, Math.min(1.0, (progress - 0.32) / 0.14));

  // 2. Atmospheric Broken Vertical Lines in Sky
  if (skyProgress > 0) {
    drawVerticalBrokenSky(offscreenCtx, pal, skyProgress);
  }

  // 3. Celestial Sun & Radiating Rays
  if (sunProgress > 0) {
    drawSunAndRays(offscreenCtx, totalW, totalH, pal, sunProgress);
  }

  // 4. Multiscale Arch-Carved Engraved Clouds
  if (cloudProgress > 0) {
    drawClouds(offscreenCtx, pal, cloudProgress);
  }

  // 5. Mountain Ridge Layers (Back to Front, Layers 0 to 5): 0.44 -> 0.94
  // Each layer traces its silhouette left-to-right, then carves slope hatchings one-by-one from the left!
  const numLayers = mountainLayers.length;
  const mtStart = 0.44;
  const mtEnd = 0.94;
  const mtSpan = (mtEnd - mtStart) / Math.max(1, numLayers);

  for (let l = 0; l < numLayers; l++) {
    const layerStart = mtStart + l * mtSpan;
    if (progress <= layerStart) break;
    const layerProgress = Math.min(1.0, (progress - layerStart) / mtSpan);
    drawMountainLayer(offscreenCtx, mountainLayers[l], l, totalW, totalH, pal, layerProgress);
  }

  // 6. Framing Border & Margin Cleaning: 0.94 -> 1.00
  const borderMargin = Math.max(16, Math.round(totalH * 0.022));
  const bx = borderMargin;
  const by = borderMargin;
  const bw = totalW - borderMargin * 2;
  const bh = totalH - borderMargin * 2;

  const borderProgress = Math.max(0.0, Math.min(1.0, (progress - 0.94) / 0.06));
  if (borderProgress > 0) {
    // Clean any mountain hatchings or sky lines spilling past margins
    cleanBorders(offscreenCtx, totalW, totalH, pal.paper, borderMargin);

    offscreenCtx.save();
    offscreenCtx.strokeStyle = pal.ink;
    offscreenCtx.lineWidth = 2.5;

    if (borderProgress >= 1.0) {
      offscreenCtx.strokeRect(bx, by, bw, bh);
    } else {
      // Trace border perimeter
      const peri = (bw + bh) * 2;
      const curL = peri * borderProgress;
      offscreenCtx.beginPath();
      offscreenCtx.moveTo(bx, by);
      let rem = curL;
      if (rem <= bw) {
        offscreenCtx.lineTo(bx + rem, by);
      } else {
        offscreenCtx.lineTo(bx + bw, by);
        rem -= bw;
        if (rem <= bh) {
          offscreenCtx.lineTo(bx + bw, by + rem);
        } else {
          offscreenCtx.lineTo(bx + bw, by + bh);
          rem -= bh;
          if (rem <= bw) {
            offscreenCtx.lineTo(bx + bw - rem, by + bh);
          } else {
            offscreenCtx.lineTo(bx, by + bh);
            rem -= bw;
            offscreenCtx.lineTo(bx, by + bh - rem);
          }
        }
      }
      offscreenCtx.stroke();
    }
    offscreenCtx.restore();

    // Inscribe landscape title in bottom cartouche plaque
    if (landscapeName && borderProgress >= 0.4) {
      const titleP = (borderProgress - 0.4) / 0.6;
      drawLandscapeTitle(offscreenCtx, totalW, totalH, landscapeName, pal, borderMargin, titleP, totalScreens, seed);
    }
  }

  // 7. Overlay Final Aquatint Granulation Filter when etching finishes
  if (progress >= 1.0) {
    cleanBorders(offscreenCtx, totalW, totalH, pal.paper, borderMargin);
    offscreenCtx.strokeStyle = pal.ink;
    offscreenCtx.lineWidth = 2.5;
    offscreenCtx.strokeRect(bx, by, bw, bh);
    if (landscapeName) {
      drawLandscapeTitle(offscreenCtx, totalW, totalH, landscapeName, pal, borderMargin, 1.0, totalScreens, seed);
    }
    applyAquatintGrain(offscreenCtx, totalW, totalH, 22, seed);
    renderedFinalSeed = seed;
  }
}

// ── Main Page Draw Call ───────────────────────────────────────────────────────
function drawEtchingScene(progress, alpha = 1.0) {
  if (offscreenCanvas.width === 0 || offscreenCanvas.height === 0) return;

  const pal = PALETTES[paletteIdx];
  document.body.style.background = pal.paper;

  const totalW = canvas.width * totalScreens;
  const totalH = canvas.height;

  // Only re-render offscreen if drawing is in-flight or seed has changed
  if (progress < 1.0 || renderedFinalSeed !== landscapeSeed) {
    renderOffscreenScene(totalW, totalH, landscapeSeed, progress, alpha);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.globalAlpha = alpha;
  const offsetX = screenIndex * canvas.width;
  ctx.drawImage(offscreenCanvas, -offsetX, 0);
  ctx.restore();

  // Dual-screen bezel line guide (if enabled)
  if (showBezel > 0.5) {
    ctx.strokeStyle = "#ff4411";
    ctx.lineWidth = 3.0;
    for (let s = 1; s < totalScreens; s++) {
      const bx = s * canvas.width;
      ctx.beginPath();
      ctx.moveTo(bx - offsetX, 0);
      ctx.lineTo(bx - offsetX, canvas.height);
      ctx.stroke();
    }
  }
}

// ── Resize ────────────────────────────────────────────────────────────────────
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  renderedFinalSeed = null;
  generateLandscape(canvas.width * totalScreens, canvas.height, landscapeSeed);
  drawEtchingScene(currentProgress, currentAlpha);
}
window.addEventListener("resize", resize);

// ── Primary Driver Loop ───────────────────────────────────────────────────────
function nextLandscape() {
  landscapeSeed = Math.floor(Math.random() * 10000000);
  paletteIdx = Math.floor(Math.random() * PALETTES.length);
  generateLandscape(canvas.width * totalScreens, canvas.height, landscapeSeed);
  phase = "drawing";
  phaseStart = 0;
  currentProgress = 0.0;
  currentAlpha = 1.0;
}

function primaryLoop(timestamp) {
  if (!initialDelayDone) {
    if (initialStartTime === 0) initialStartTime = timestamp;
    currentProgress = 0.0;
    currentAlpha = 1.0;
    drawEtchingScene(0.0, 1.0);

    bc.postMessage({
      cmd: "sync",
      seed: landscapeSeed,
      paletteIdx,
      phase: "drawing",
      progress: 0.0,
      alpha: 1.0,
      paused,
      showBezel,
    });

    if (timestamp - initialStartTime >= INITIAL_DELAY) {
      initialDelayDone = true;
      phaseStart = timestamp;
    }
    requestAnimationFrame(primaryLoop);
    return;
  }

  if (!paused) {
    if (phase === "drawing") {
      if (phaseStart === 0) phaseStart = timestamp;
      const elapsed = Math.max(0, timestamp - phaseStart);
      currentProgress = Math.min(1.0, elapsed / DRAW_DURATION);
      currentAlpha = 1.0;

      drawEtchingScene(currentProgress, 1.0);

      if (currentProgress >= 1.0) {
        phase = "pausing";
        phaseStart = timestamp;
      }
    } else if (phase === "pausing") {
      currentProgress = 1.0;
      currentAlpha = 1.0;
      drawEtchingScene(1.0, 1.0);

      if (timestamp - phaseStart >= PAUSE_DURATION) {
        phase = "fading";
        phaseStart = timestamp;
      }
    } else if (phase === "fading") {
      currentProgress = 1.0;
      const t = (timestamp - phaseStart) / FADE_DURATION;
      currentAlpha = Math.max(0.0, 1.0 - t);
      drawEtchingScene(1.0, currentAlpha);

      if (t >= 1.0) {
        nextLandscape();
        requestAnimationFrame(primaryLoop);
        return;
      }
    }
  }

  bc.postMessage({
    cmd: "sync",
    seed: landscapeSeed,
    paletteIdx,
    phase,
    progress: currentProgress,
    alpha: currentAlpha,
    paused,
    showBezel,
  });

  requestAnimationFrame(primaryLoop);
}

// ── Multi-screen BroadcastChannel Communication ───────────────────────────────
bc.onmessage = (ev) => {
  const data = ev.data;
  if (!data) return;

  if (data.quit) {
    window.close();
    return;
  }

  if (isPrimary) {
    if (data.cmd === "requestSync") {
      bc.postMessage({
        cmd: "sync",
        seed: landscapeSeed,
        paletteIdx,
        phase,
        progress: currentProgress,
        alpha: currentAlpha,
        paused,
        showBezel,
      });
    } else if (data.cmd === "save") {
      saveCanvas();
    } else if (data.cmd === "next") {
      nextLandscape();
    } else if (data.cmd === "palette") {
      paletteIdx = (paletteIdx + 1) % PALETTES.length;
      renderedFinalSeed = null;
    } else if (data.cmd === "pause") {
      paused = !paused;
    } else if (data.cmd === "bezel") {
      showBezel = data.showBezel;
    }
    return;
  }

  // Secondary display client
  if (data.cmd === "sync") {
    if (data.seed !== landscapeSeed) {
      landscapeSeed = data.seed;
      paletteIdx = data.paletteIdx;
      renderedFinalSeed = null;
      generateLandscape(canvas.width * totalScreens, canvas.height, landscapeSeed);
    } else if (data.paletteIdx !== paletteIdx) {
      paletteIdx = data.paletteIdx;
      renderedFinalSeed = null;
    }
    phase = data.phase;
    currentProgress = data.progress;
    currentAlpha = data.alpha;
    paused = data.paused;
    showBezel = data.showBezel;
    drawEtchingScene(currentProgress, currentAlpha);
  }
};

// ── User Input & Keyboard Shortcuts ───────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key === "q" || e.key === "Q") {
    bc.postMessage({ quit: true });
    window.close();
    return;
  }
  if (e.key === "s" || e.key === "S") {
    if (isPrimary) saveCanvas();
    else bc.postMessage({ cmd: "save" });
    return;
  }
  if (e.code === "Space" || e.key === "n" || e.key === "N") {
    if (isPrimary) nextLandscape();
    else bc.postMessage({ cmd: "next" });
    return;
  }
  if (e.key === "c" || e.key === "C") {
    if (isPrimary) {
      paletteIdx = (paletteIdx + 1) % PALETTES.length;
      renderedFinalSeed = null;
    } else {
      bc.postMessage({ cmd: "palette" });
    }
    return;
  }
  if (e.key === "p" || e.key === "P") {
    paused = !paused;
    if (!isPrimary) bc.postMessage({ cmd: "pause" });
    return;
  }
  if (e.key === "b" || e.key === "B") {
    showBezel = showBezel > 0.5 ? 0.0 : 1.0;
    if (!isPrimary) bc.postMessage({ cmd: "bezel", showBezel });
    return;
  }
});

// Click to advance or toggle fullscreen
canvas.addEventListener("click", () => {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }
});

// ── Startup ───────────────────────────────────────────────────────────────────
resize();

if (isPrimary) {
  generateLandscape(canvas.width * totalScreens, canvas.height, landscapeSeed);
  requestAnimationFrame(primaryLoop);
} else {
  bc.postMessage({ cmd: "requestSync" });
}
