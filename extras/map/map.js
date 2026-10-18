// Procedural Antique Fantasy Cartography Screensaver
// Dual-screen BroadcastChannel coordination with primary driver.
// Inspired by J.R.R. Tolkien, Dyson Logos, and Renaissance copperplate atlases.

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = params.has("screens") ? parseInt(params.get("screens"), 10) : 1;
const isPrimary = screenIndex === 0;

document.title = `Map ${screenIndex}`;

const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");

// ── Multi-screen BroadcastChannel ─────────────────────────────────────────────
const bc = new BroadcastChannel("map");

function saveCanvas() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `map-screen${screenIndex}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

let paletteIdx = Math.floor(Math.random() * MAP_PALETTES.length);
let mapSeed = Math.floor(Math.random() * 10000000);
let paused = false;
let showBezel = 0.0;

// Animation timing configuration (ms)
const INITIAL_DELAY  = 100;    // Rapid multi-window startup sync
const DRAW_DURATION  = 2400;   // Fluid, brisk progressive drawing (~2.4s)
const PAUSE_DURATION = 14000;  // Linger for 14s to admire completed map
const FADE_DURATION  = 900;    // Dissolve into next map (~0.9s)

let initialDelayDone = false;
let initialStartTime = 0;
let phase = "drawing"; // "drawing" | "pausing" | "fading"
let phaseStart = 0;
let currentProgress = 0.0;
let currentAlpha = 1.0;
let renderedFinalSeed = null;

// ── Offscreen Panoramic Map Canvas ────────────────────────────────────────────
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");

// Map elements state
let mapState = {
  coastEngine: null,
  ridges: [],
  peaks: [],
  riverNetwork: null,
  forestEngine: null,
  cartoucheEngine: null,
  depthElements: [],
  totalW: 0,
  totalH: 0,
};

/**
 * Minimum distance between two line segments (p1-p2) and (q1-q2)
 */
function segmentDistance(p1, p2, q1, q2) {
  if (RiverNetwork.segmentsIntersect(p1, p2, q1, q2)) return 0;

  function distPtSeg(p, a, b) {
    const l2 = Math.hypot(b.x - a.x, b.y - a.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
  }

  return Math.min(
    distPtSeg(p1, q1, q2),
    distPtSeg(p2, q1, q2),
    distPtSeg(q1, p1, p2),
    distPtSeg(q2, p1, p2)
  );
}

function isLineTooClose(p1, p2, q1, q2, minClearance = 120) {
  return segmentDistance(p1, p2, q1, q2) < minClearance;
}

/**
 * Generates the procedural fantasy map across the entire panoramic canvas (totalW x totalH).
 */
function generateMap(totalW, totalH, seed) {
  const rng = createRNG(seed);
  mapState.totalW = totalW;
  mapState.totalH = totalH;

  const padX = totalW * 0.09;
  const padY = totalH * 0.12;
  const usableW = totalW - padX * 2;
  const usableH = totalH - padY * 2;

  // ── 0. Procedural Coastline & Ocean Basin ──────────────────────────────
  const coastEngine = new CoastlineEngine(totalW, totalH, seed + 12345);
  const coastStyles = ["west-ocean", "east-ocean", "south-ocean", "north-ocean"];
  const chosenCoast = coastStyles[Math.floor(rng() * coastStyles.length)];
  coastEngine.generateCoast(chosenCoast);
  mapState.coastEngine = coastEngine;

  // ── 1. Place Mountain Ranges with Length Variety & Hierarchy ────────────
  // Scaled for single or dual screens:
  const isMultiScreen = totalScreens > 1;
  const rangeConfigs = isMultiScreen ? [
    { minLen: 480, maxLen: 720, required: true },  // Great continental cordillera
    { minLen: 300, maxLen: 460, required: true },  // Secondary range
    { minLen: 240, maxLen: 380, required: true },  // Eastern/Western range
    { minLen: 160, maxLen: 260, required: false }, // Spur / flank range
    { minLen: 130, maxLen: 210, required: false }, // Foothill crags
  ] : [
    { minLen: 380, maxLen: 540, required: true },  // Continental cordillera
    { minLen: 220, maxLen: 340, required: true },  // Secondary range
    { minLen: 120, maxLen: 210, required: false }, // Spur / flank range
    { minLen: 100, maxLen: 180, required: false }, // Foothill crags
  ];

  const ridges = [];
  const ridgeSpines = [];

  for (let i = 0; i < rangeConfigs.length; i++) {
    const cfg = rangeConfigs[i];
    if (!cfg.required && rng() < 0.30 && ridges.length >= 2) continue;

    let attempts = 0;
    let placed = false;

    while (attempts < 40 && !placed) {
      attempts++;
      const rLen = cfg.minLen + rng() * (cfg.maxLen - cfg.minLen);

      // Random center anchor in usable map area
      const rcX = padX + rng() * usableW;
      const rcY = padY + rng() * usableH;

      // Angle orientation: Apennines (NW-SE), Alps (WSW-ENE arc), or NE-SW
      const angleType = Math.floor(rng() * 3);
      let baseAngle;
      if (angleType === 0) baseAngle = Math.PI * 0.35 + (rng() - 0.5) * 0.3; // NW to SE
      else if (angleType === 1) baseAngle = (rng() - 0.5) * 0.25;            // East-West arc
      else baseAngle = Math.PI * 0.65 + (rng() - 0.5) * 0.3;                 // NE to SW

      const startX = rcX - Math.cos(baseAngle) * (rLen * 0.5);
      const startY = rcY - Math.sin(baseAngle) * (rLen * 0.5);
      const endX   = rcX + Math.cos(baseAngle) * (rLen * 0.5);
      const endY   = rcY + Math.sin(baseAngle) * (rLen * 0.5);

      // Keep inside bounds
      if (startX < padX || endX < padX || startX > totalW - padX || endX > totalW - padX ||
          startY < padY || endY < padY || startY > totalH - padY || endY > totalH - padY) {
        continue;
      }

      // Must NOT spawn inside ocean (spine must be comfortably on land, 65px clear of coast)
      if (coastEngine.isOcean({ x: rcX, y: rcY }, 65) ||
          coastEngine.isOcean({ x: startX, y: startY }, 55) ||
          coastEngine.isOcean({ x: endX, y: endY }, 55)) {
        continue;
      }

      // Collision check with already placed ridges
      let collision = false;
      for (let existing of ridgeSpines) {
        if (isLineTooClose(
          { x: startX, y: startY }, { x: endX, y: endY },
          existing.start, existing.end, 110
        )) {
          collision = true;
          break;
        }
      }

      if (!collision) {
        const ridgeSeed = seed + ridges.length * 1013;
        const ridge = new MountainRidge(totalW, totalH, ridgeSeed, {
          startX,
          startY,
          endX,
          endY,
          fractalIter: 5,
          backboneRoughness: 0.36,
          flankRoughness: 0.28,
          flankIter: 3,
          flankLength: 82, // 1.5x scale
          hatchSpacing: 2.8,
          hatchAngle: Math.PI * 0.25,
        });

        ridges.push(ridge);
        ridgeSpines.push({ start: { x: startX, y: startY }, end: { x: endX, y: endY }, ridge });
        placed = true;
      }
    }
  }
  mapState.ridges = ridges;

  // ── 2. River Network & Lakes ───────────────────────────────────────────
  const riverNetwork = new RiverNetwork(totalW, totalH, seed + 999);
  riverNetwork.coastEngine = coastEngine;

  if (ridges.length > 0) {
    const primaryRidge = ridges.reduce((prev, cur) => (cur.length > prev.length ? cur : prev), ridges[0]);
    const river1 = riverNetwork.createRiverFromRidge(primaryRidge, ridges, { target: "ocean" });

    // Connect secondary ridge if close to river1's lake
    let secondaryConnected = false;
    if (river1 && river1.lake && ridges.length > 1) {
      for (let otherRidge of ridges) {
        if (otherRidge !== primaryRidge) {
          const distToLake = Math.hypot(otherRidge.endX - river1.lake.x, otherRidge.endY - river1.lake.y);
          if (distToLake < 420) {
            const connected = riverNetwork.connectRidgeToLake(otherRidge, river1.lake, ridges);
            if (connected) secondaryConnected = true;
          }
        }
      }
    }

    // Inland river to lake
    if (!secondaryConnected && ridges.length >= 2) {
      const secondRidge = ridges.find(r => r !== primaryRidge);
      if (secondRidge) {
        riverNetwork.createRiverFromRidge(secondRidge, ridges, { target: "lake" });
      }
    }

    // If multi-screen with 3+ ridges, spawn another river towards sea or lake
    if (isMultiScreen && ridges.length >= 3) {
      const thirdRidge = ridges[ridges.length - 1];
      if (thirdRidge && thirdRidge !== primaryRidge) {
        riverNetwork.createRiverFromRidge(thirdRidge, ridges, { target: rng() < 0.5 ? "ocean" : "lake" });
      }
    }
  }
  mapState.riverNetwork = riverNetwork;

  // ── 3. Standalone Mountain Peaks ───────────────────────────────────────
  const peaks = [];
  const basePeaks = isMultiScreen ? 32 : 18;
  const numPeaks = basePeaks + Math.floor(rng() * (isMultiScreen ? 18 : 10));
  let peakAttempts = 0;

  while (peaks.length < numPeaks && peakAttempts < 180) {
    peakAttempts++;
    const px = padX + rng() * usableW;
    const py = padY + rng() * usableH;
    const pt = { x: px, y: py };

    if (coastEngine.isOcean(pt, 35)) continue;

    let inRidge = false;
    for (let ridge of ridges) {
      if (RiverNetwork.pointInPoly(pt, ridge.boundingPoly)) { inRidge = true; break; }
      for (let f of ridge.facets) {
        if (Math.hypot(px - f.pA.x, py - f.pA.y) < 85) { inRidge = true; break; }
      }
      if (inRidge) break;
    }
    if (inRidge) continue;

    let inLake = false;
    for (let lake of riverNetwork.lakes) {
      if (Math.hypot(px - lake.x, py - lake.y) < lake.radius + 25) { inLake = true; break; }
      if (RiverNetwork.pointInPoly(pt, lake.poly)) { inLake = true; break; }
    }
    if (inLake) continue;

    let onRiver = false;
    for (let river of riverNetwork.rivers) {
      for (let rp of river.points) {
        if (Math.hypot(px - rp.x, py - rp.y) < 22) { onRiver = true; break; }
      }
      if (onRiver) break;
    }
    if (onRiver) continue;

    let onOtherPeak = false;
    for (let op of peaks) {
      if (Math.hypot(px - op.x, py - op.y) < 48) { onOtherPeak = true; break; }
    }
    if (onOtherPeak) continue;

    const pWidth = 52 + rng() * 20;
    const pSeed = seed + 4000 + peaks.length * 79;
    peaks.push(new MountainPeak(px, py, pWidth, pSeed, {
      fractalIter: 5,
      roughness: 0.32,
    }));
  }
  mapState.peaks = peaks;

  // ── 4. Forests & Woodland Groves ─────────────────────────────────────
  const forestEngine = new ForestEngine(totalW, totalH, seed + 888);
  forestEngine.populateForests(ridges, riverNetwork.rivers, riverNetwork.lakes, coastEngine);
  mapState.forestEngine = forestEngine;

  // ── 5. Unified Z-Sorted Depth Rendering Elements ───────────────────────
  const depthElements = [];

  for (let ridge of ridges) {
    for (let f of ridge.facets) {
      depthElements.push({
        avgY: f.avgY,
        t: f.t,
        type: "facet",
        item: f,
        draw: (ctx, pal, prog) => {
          if (f.t > prog) return;
          // 1. Opaque paper occlusion mask
          ctx.fillStyle = pal.paper;
          ctx.beginPath();
          ctx.moveTo(f.maskPoly[0].x, f.maskPoly[0].y);
          for (let k = 1; k < f.maskPoly.length; k++) {
            ctx.lineTo(f.maskPoly[k].x, f.maskPoly[k].y);
          }
          ctx.closePath();
          ctx.fill();

          // 2. Washes
          if (pal.shadowWash) {
            ctx.fillStyle = pal.shadowWash;
            ctx.beginPath();
            ctx.moveTo(f.shadowWashPoly[0].x, f.shadowWashPoly[0].y);
            for (let k = 1; k < f.shadowWashPoly.length; k++) {
              ctx.lineTo(f.shadowWashPoly[k].x, f.shadowWashPoly[k].y);
            }
            ctx.closePath();
            ctx.fill();
          }

          if (pal.highlightWash) {
            ctx.fillStyle = pal.highlightWash;
            ctx.beginPath();
            ctx.moveTo(f.highlightWashPoly[0].x, f.highlightWashPoly[0].y);
            for (let k = 1; k < f.highlightWashPoly.length; k++) {
              ctx.lineTo(f.highlightWashPoly[k].x, f.highlightWashPoly[k].y);
            }
            ctx.closePath();
            ctx.fill();
          }

          // 3. Shadow Hatches (batched path for 60 FPS performance)
          if (f.hatches && f.hatches.length > 0) {
            ctx.strokeStyle = pal.ink;
            ctx.lineWidth = f.hatches[0].width || 1.0;
            ctx.globalAlpha = f.hatches[0].alpha || 0.8;
            ctx.beginPath();
            for (let h of f.hatches) {
              ctx.moveTo(h.x1, h.y1);
              ctx.lineTo(h.x2, h.y2);
            }
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          }

          // 4. Sunlit Contours (batched path)
          if (f.sunContours && f.sunContours.length > 0) {
            ctx.strokeStyle = pal.inkFaint ?? pal.ink;
            ctx.lineWidth = f.sunContours[0].width || 0.7;
            ctx.globalAlpha = f.sunContours[0].alpha || 0.7;
            ctx.beginPath();
            for (let c of f.sunContours) {
              ctx.moveTo(c.x1, c.y1);
              ctx.lineTo(c.x2, c.y2);
            }
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          }

          // 5. Spurs & Ridge Spine
          ctx.strokeStyle = pal.ink;
          ctx.lineWidth = 1.25;

          ctx.beginPath();
          ctx.moveTo(f.leftSpurA[0].x, f.leftSpurA[0].y);
          for (let k = 1; k < f.leftSpurA.length; k++) ctx.lineTo(f.leftSpurA[k].x, f.leftSpurA[k].y);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(f.rightSpurA[0].x, f.rightSpurA[0].y);
          for (let k = 1; k < f.rightSpurA.length; k++) ctx.lineTo(f.rightSpurA[k].x, f.rightSpurA[k].y);
          ctx.stroke();

          ctx.lineWidth = 1.7;
          ctx.beginPath();
          ctx.moveTo(f.pA.x, f.pA.y);
          ctx.lineTo(f.pB.x, f.pB.y);
          ctx.stroke();
        }
      });
    }
  }

  for (let p of peaks) {
    const depthT = Math.min(0.92, Math.max(0.08, (p.avgY - padY) / Math.max(1, usableH)));
    depthElements.push({
      avgY: p.avgY,
      t: depthT,
      type: "peak",
      item: p,
      draw: (ctx, pal, prog) => {
        p.draw(ctx, pal, prog);
      }
    });
  }

  for (let tree of forestEngine.trees) {
    const depthT = Math.min(0.95, Math.max(0.05, (tree.avgY - padY) / Math.max(1, usableH)));
    depthElements.push({
      avgY: tree.avgY,
      t: depthT,
      type: "tree",
      item: tree,
      draw: (ctx, pal, prog) => {
        tree.draw(ctx, pal, prog);
      }
    });
  }

  depthElements.sort((a, b) => a.avgY - b.avgY);
  mapState.depthElements = depthElements;

  // ── 6. Cartouche Plaque & Realm Title (Floating in Open Sea) ─────────────
  const cartoucheEngine = new CartoucheEngine(totalW, totalH, seed + 8833);
  cartoucheEngine.layout(offscreenCtx, coastEngine, ridges, riverNetwork.rivers, riverNetwork.lakes, totalScreens);
  mapState.cartoucheEngine = cartoucheEngine;
}

/**
 * Renders the map onto the offscreen panoramic canvas.
 */
function renderOffscreenScene(totalW, totalH, seed, progress, alpha, pal) {
  if (offscreenCanvas.width !== totalW || offscreenCanvas.height !== totalH) {
    offscreenCanvas.width = totalW;
    offscreenCanvas.height = totalH;
  }

  const { coastEngine, riverNetwork, depthElements, cartoucheEngine } = mapState;

  // 1. Base Antique Laid Paper Wash with subtle tooth
  offscreenCtx.save();
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

  // 2. Coastline, Ocean Watercolor Wash & Concentric Waterlines
  if (coastEngine) {
    coastEngine.draw(offscreenCtx, pal, progress);
  }

  // 3. River Network & Lakes
  if (riverNetwork) {
    riverNetwork.draw(offscreenCtx, pal, progress);
  }

  // 4. Relief (Mountains, peaks, trees strictly sorted North-to-South)
  if (depthElements) {
    for (let elem of depthElements) {
      elem.draw(offscreenCtx, pal, progress);
    }
  }

  // 5. Antique Cartouche Title Plaque (Floating at sea)
  if (cartoucheEngine) {
    cartoucheEngine.draw(offscreenCtx, pal, progress);
  }

  // 6. Panoramic Outer Cartographic Frame / Neatline
  offscreenCtx.strokeStyle = pal.ink;
  offscreenCtx.lineWidth = 1.6;
  offscreenCtx.globalAlpha = 0.50;
  const borderPad = 28;
  offscreenCtx.strokeRect(borderPad, borderPad, totalW - borderPad * 2, totalH - borderPad * 2);

  offscreenCtx.lineWidth = 0.6;
  const innerPad = borderPad + 4;
  offscreenCtx.strokeRect(innerPad, innerPad, totalW - innerPad * 2, totalH - innerPad * 2);

  offscreenCtx.restore();

  // 7. Overlay Final Aquatint Granulation Filter when map finishes (disabled for now)
  if (progress >= 1.0) {
    // applyAquatintGrain(offscreenCtx, totalW, totalH, 22, seed);
    renderedFinalSeed = seed;
  }
}

/**
 * Main draw call: renders panoramic offscreen buffer and slices viewport for this screen.
 */
function drawMapScene(progress, alpha = 1.0) {
  if (offscreenCanvas.width === 0 || offscreenCanvas.height === 0) return;

  const pal = MAP_PALETTES[paletteIdx];
  document.body.style.background = pal.paper;

  const totalW = canvas.width * totalScreens;
  const totalH = canvas.height;

  // Re-render offscreen if drawing is in-flight or seed has changed
  if (progress < 1.0 || renderedFinalSeed !== mapSeed) {
    renderOffscreenScene(totalW, totalH, mapSeed, progress, alpha, pal);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.globalAlpha = alpha;
  const offsetX = screenIndex * canvas.width;
  ctx.drawImage(offscreenCanvas, -offsetX, 0);
  ctx.restore();

  // Dual-screen bezel line guide (if enabled with 'B' key)
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
  generateMap(canvas.width * totalScreens, canvas.height, mapSeed);
  drawMapScene(currentProgress, currentAlpha);
}
window.addEventListener("resize", resize);

// ── Primary Driver Loop ───────────────────────────────────────────────────────
function nextMap() {
  mapSeed = Math.floor(Math.random() * 10000000);
  paletteIdx = Math.floor(Math.random() * MAP_PALETTES.length);
  renderedFinalSeed = null;
  generateMap(canvas.width * totalScreens, canvas.height, mapSeed);
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
    drawMapScene(0.0, 1.0);

    bc.postMessage({
      cmd: "sync",
      seed: mapSeed,
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

      drawMapScene(currentProgress, 1.0);

      if (currentProgress >= 1.0) {
        phase = "pausing";
        phaseStart = timestamp;
      }
    } else if (phase === "pausing") {
      currentProgress = 1.0;
      currentAlpha = 1.0;
      drawMapScene(1.0, 1.0);

      if (timestamp - phaseStart >= PAUSE_DURATION) {
        phase = "fading";
        phaseStart = timestamp;
      }
    } else if (phase === "fading") {
      currentProgress = 1.0;
      const t = (timestamp - phaseStart) / FADE_DURATION;
      currentAlpha = Math.max(0.0, 1.0 - t);
      drawMapScene(1.0, currentAlpha);

      if (t >= 1.0) {
        nextMap();
        requestAnimationFrame(primaryLoop);
        return;
      }
    }
  }

  bc.postMessage({
    cmd: "sync",
    seed: mapSeed,
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
        seed: mapSeed,
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
      nextMap();
    } else if (data.cmd === "palette") {
      paletteIdx = (paletteIdx + 1) % MAP_PALETTES.length;
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
    if (data.seed !== mapSeed) {
      mapSeed = data.seed;
      paletteIdx = data.paletteIdx;
      renderedFinalSeed = null;
      generateMap(canvas.width * totalScreens, canvas.height, mapSeed);
    } else if (data.paletteIdx !== paletteIdx) {
      paletteIdx = data.paletteIdx;
      renderedFinalSeed = null;
    }
    phase = data.phase;
    currentProgress = data.progress;
    currentAlpha = data.alpha;
    paused = data.paused;
    showBezel = data.showBezel;
    drawMapScene(currentProgress, currentAlpha);
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
    if (isPrimary) nextMap();
    else bc.postMessage({ cmd: "next" });
    return;
  }
  if (e.key === "c" || e.key === "C") {
    if (isPrimary) {
      paletteIdx = (paletteIdx + 1) % MAP_PALETTES.length;
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
  generateMap(canvas.width * totalScreens, canvas.height, mapSeed);
  requestAnimationFrame(primaryLoop);
} else {
  bc.postMessage({ cmd: "requestSync" });
}
