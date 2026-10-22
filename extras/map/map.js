// Procedural Antique Fantasy Cartography Screensaver
// Dual-screen BroadcastChannel coordination with primary driver.
// Inspired by J.R.R. Tolkien, Dyson Logos, and Renaissance copperplate atlases.

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = params.has("screens") ? parseInt(params.get("screens"), 10) : 1;
const isPrimary = screenIndex === 0;

document.title = `Map ${screenIndex}`;

const canvas = document.getElementById("mapCanvas");

// ── WebGL Postprocessing Pipeline (Concurrent Aquatint Rosin Noise) ───────────
function hexToRgb01(hex) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((ch) => ch + ch).join("");
  const num = parseInt(c, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

const vsSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fsSource = `
  precision highp float;

  uniform sampler2D u_texture;
  uniform sampler2D u_noiseTex;
  uniform float u_screenIndex;
  uniform float u_totalScreens;
  uniform float u_grainAmount;
  uniform float u_alpha;
  uniform vec3 u_paperColor;

  varying vec2 v_uv;

  void main() {
    // Panoramic slice across displays (flip Y so 2D top-down aligns with WebGL)
    float u = (v_uv.x + u_screenIndex) / u_totalScreens;
    float v = 1.0 - v_uv.y;
    vec4 texColor = texture2D(u_texture, vec2(u, v));

    // Sample pure noise texture with 256.0 repeat tiling to eliminate all hash-banding
    vec2 coord1 = gl_FragCoord.xy / 256.0;
    vec2 coord2 = (gl_FragCoord.yx * 0.5 + vec2(0.37, 0.71)) / 256.0;

    vec4 nSample1 = texture2D(u_noiseTex, coord1);
    vec4 nSample2 = texture2D(u_noiseTex, coord2);

    float n1 = (nSample1.r - 0.5) * u_grainAmount;
    float n2 = (nSample2.g - 0.5) * (u_grainAmount * 0.45);

    vec3 color = clamp(texColor.rgb + n1 + n2, 0.0, 1.0);

    // Fade transition into antique paper tone
    color = mix(u_paperColor, color, u_alpha);

    gl_FragColor = vec4(color, 1.0);
  }
`;

let glState = null;
let fallbackCtx2D = null;

function createNoiseTexture(gl) {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4 + 0] = Math.floor(Math.random() * 256);
    data[i * 4 + 1] = Math.floor(Math.random() * 256);
    data[i * 4 + 2] = Math.floor(Math.random() * 256);
    data[i * 4 + 3] = 255;
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  return tex;
}

function initWebGLState() {
  let gl = null;
  try {
    gl =
      canvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: false, alpha: false }) ||
      canvas.getContext("experimental-webgl", { preserveDrawingBuffer: true, antialias: false, alpha: false });
  } catch (e) {
    gl = null;
  }
  if (!gl) {
    fallbackCtx2D = canvas.getContext("2d");
    return null;
  }

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("WebGL Shader error:", gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const vs = compileShader(gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) {
    fallbackCtx2D = canvas.getContext("2d");
    return null;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("WebGL Link error:", gl.getProgramInfoLog(prog));
    fallbackCtx2D = canvas.getContext("2d");
    return null;
  }

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]),
    gl.STATIC_DRAW
  );

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const noiseTex = createNoiseTexture(gl);

  return {
    gl,
    prog,
    posAttr: gl.getAttribLocation(prog, "a_position"),
    posBuf,
    tex,
    noiseTex,
    uniforms: {
      u_texture: gl.getUniformLocation(prog, "u_texture"),
      u_noiseTex: gl.getUniformLocation(prog, "u_noiseTex"),
      u_screenIndex: gl.getUniformLocation(prog, "u_screenIndex"),
      u_totalScreens: gl.getUniformLocation(prog, "u_totalScreens"),
      u_grainAmount: gl.getUniformLocation(prog, "u_grainAmount"),
      u_alpha: gl.getUniformLocation(prog, "u_alpha"),
      u_paperColor: gl.getUniformLocation(prog, "u_paperColor"),
    },
  };
}

glState = initWebGLState();

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
let showRose = null; // null = procedural (~58% chance), or boolean for toggle
let lastRenderedRose = null;
let showMonster = null; // null = procedural (~68% chance), or boolean for toggle
let lastRenderedMonster = null;

// Animation timing configuration (ms)
const INITIAL_DELAY  = 500;    // Multi-window startup sync
const DRAW_DURATION  = 22000;  // Deliberate line-by-line antique cartography engraving (~22s)
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
  hillsEngine: null,
  riverNetwork: null,
  forestEngine: null,
  settlementEngine: null,
  roadNetwork: null,
  wildernessEngine: null,
  cartoucheEngine: null,
  compassEngine: null,
  monsterEngine: null,
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
  const isMultiScreen = totalScreens > 1;
  const rangeConfigs = isMultiScreen ? [
    { minLen: 480, maxLen: 720, required: true },  // Great continental cordillera
    { minLen: 320, maxLen: 500, required: true },  // Secondary range
    { minLen: 260, maxLen: 420, required: true },  // Eastern/Western range
    { minLen: 200, maxLen: 340, required: true },  // Highland massif
    { minLen: 160, maxLen: 260, required: false }, // Spur / flank range
    { minLen: 130, maxLen: 210, required: false }, // Foothill crags
    { minLen: 110, maxLen: 180, required: false }, // Lowland ridgelet
  ] : [
    { minLen: 380, maxLen: 540, required: true },  // Continental cordillera
    { minLen: 250, maxLen: 380, required: true },  // Secondary range
    { minLen: 190, maxLen: 300, required: true },  // Highland massif
    { minLen: 140, maxLen: 230, required: false }, // Spur / flank range
    { minLen: 120, maxLen: 190, required: false }, // Foothill crags
    { minLen: 100, maxLen: 160, required: false }, // Lowland ridgelet
  ];

  const ridges = [];
  const ridgeSpines = [];

  for (let i = 0; i < rangeConfigs.length; i++) {
    const cfg = rangeConfigs[i];
    if (!cfg.required && rng() < 0.25 && ridges.length >= 3) continue;

    let attempts = 0;
    let placed = false;

    while (attempts < 55 && !placed) {
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
          existing.start, existing.end, 105
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
    const sortedRidges = [...ridges].sort((a, b) => b.length - a.length);

    // Primary river to ocean
    const river1 = riverNetwork.createRiverFromRidge(sortedRidges[0], ridges, { target: "ocean" });

    // Connect second ridge to lake or trace new river
    if (sortedRidges.length > 1) {
      let secondaryConnected = false;
      if (river1 && river1.lake) {
        const distToLake = Math.hypot(sortedRidges[1].endX - river1.lake.x, sortedRidges[1].endY - river1.lake.y);
        if (distToLake < 450) {
          secondaryConnected = riverNetwork.connectRidgeToLake(sortedRidges[1], river1.lake, ridges);
        }
      }
      if (!secondaryConnected) {
        riverNetwork.createRiverFromRidge(sortedRidges[1], ridges, { target: rng() < 0.50 ? "ocean" : "lake" });
      }
    }

    // Spawn rivers from subsequent ridges (ocean, inland lake, or tributary)
    for (let ri = 2; ri < sortedRidges.length; ri++) {
      const ridge = sortedRidges[ri];
      const targetMode = rng() < 0.60 ? "ocean" : "lake";
      riverNetwork.createRiverFromRidge(ridge, ridges, { target: targetMode });
    }
  }
  mapState.riverNetwork = riverNetwork;

  // ── 3. Standalone Mountain Peaks ───────────────────────────────────────
  const peaks = [];
  const basePeaks = isMultiScreen ? 55 : 36;
  const numPeaks = basePeaks + Math.floor(rng() * (isMultiScreen ? 25 : 18));
  let peakAttempts = 0;

  while (peaks.length < numPeaks && peakAttempts < 280) {
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
  peaks.sort((a, b) => a.avgY - b.avgY);
  mapState.peaks = peaks;

  // ── 3b. Rolling Hills & Lowland Hummocks ─────────────────────────────
  const hillsEngine = new HillsEngine(totalW, totalH, seed + 2233);
  hillsEngine.populateHills(ridges, peaks, riverNetwork, coastEngine);
  mapState.hillsEngine = hillsEngine;

  // ── 4. Forests & Woodland Groves ─────────────────────────────────────
  const forestEngine = new ForestEngine(totalW, totalH, seed + 888);
  forestEngine.populateForests(ridges, riverNetwork.rivers, riverNetwork.lakes, coastEngine, hillsEngine);
  mapState.forestEngine = forestEngine;

  // ── 4b. Consistent Cultural Name Family Bucket ───────────────────────
  const nameBucket = new NameBucket(seed);
  mapState.nameBucket = nameBucket;

  // ── 4c. Settlements & Fortifications ─────────────────────────────────
  const settlementEngine = new SettlementEngine(totalW, totalH, seed + 3344);
  settlementEngine.populateSettlements(coastEngine, ridges, riverNetwork, riverNetwork.lakes, hillsEngine, nameBucket);
  mapState.settlementEngine = settlementEngine;

  // ── 4d. Road Networks & Bridges ──────────────────────────────────────
  const roadNetwork = new RoadNetwork(totalW, totalH, seed + 4455);
  roadNetwork.generateRoads(settlementEngine.settlements, ridges, riverNetwork, coastEngine);
  mapState.roadNetwork = roadNetwork;

  // ── 4e. Wilderness Desolations, Landmarks & Lore ─────────────────────
  const wildernessEngine = new WildernessEngine(totalW, totalH, seed + 6677);
  wildernessEngine.populate(coastEngine, ridges, peaks, hillsEngine, riverNetwork, settlementEngine, forestEngine, nameBucket);
  mapState.wildernessEngine = wildernessEngine;

  mapState.depthElements = [];

  // ── 6. Cartouche Plaque & Realm Title (Floating in Open Sea) ─────────────
  const cartoucheEngine = new CartoucheEngine(totalW, totalH, seed + 8833);
  cartoucheEngine.layout(offscreenCtx, coastEngine, ridges, riverNetwork.rivers, riverNetwork.lakes, totalScreens, nameBucket);
  mapState.cartoucheEngine = cartoucheEngine;

  // ── 7. Renaissance Nautical Compass Rose (Rosa Ventorum) ─────────────────
  const compassEngine = new CompassRoseEngine(totalW, totalH, seed + 7711);
  compassEngine.layout(coastEngine, cartoucheEngine, totalScreens);
  mapState.compassEngine = compassEngine;

  // ── 8. Renaissance Sea Monsters (Serpens Marinus & Cetus/Physeter) ───────
  const monsterEngine = new SeaMonsterEngine(totalW, totalH, seed + 5544);
  monsterEngine.layout(coastEngine, cartoucheEngine, compassEngine, totalScreens);
  mapState.monsterEngine = monsterEngine;

  // ── 9. Renaissance Nautical Ocean Engine (Rhumb Lines, Waves & Tall Ships) ──
  const oceanEngine = new OceanEngine(totalW, totalH, seed + 9988);
  oceanEngine.layout(coastEngine, cartoucheEngine, compassEngine, monsterEngine, settlementEngine, totalScreens);
  mapState.oceanEngine = oceanEngine;
}

/**
 * Smooth step interpolation helper for progressive animation windows
 */
function subProgress(p, start, end) {
  if (p <= start) return 0.0;
  if (p >= end) return 1.0;
  return (p - start) / (end - start);
}

/**
 * Renders the map onto the offscreen panoramic canvas.
 * Elements are drawn sequentially stage by stage, matching the deliberate
 * intaglio copperplate engraving choreography of Constellations.
 */
function renderOffscreenScene(totalW, totalH, seed, progress, alpha, pal) {
  if (offscreenCanvas.width !== totalW || offscreenCanvas.height !== totalH) {
    offscreenCanvas.width = totalW;
    offscreenCanvas.height = totalH;
  }

  const {
    coastEngine,
    ridges,
    peaks,
    hillsEngine,
    riverNetwork,
    forestEngine,
    settlementEngine,
    roadNetwork,
    wildernessEngine,
    cartoucheEngine,
    compassEngine,
    monsterEngine,
    oceanEngine
  } = mapState;

  // 1. Base Antique Laid Paper Wash with subtle tooth (always present)
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

  if (progress <= 0) {
    offscreenCtx.restore();
    return;
  }

  // ── STAGE 1 (0.00 -> 0.14): Continental Coastlines & Ocean Waterlining ────────
  const coastProg = subProgress(progress, 0.00, 0.14);
  if (coastProg > 0 && coastEngine) {
    coastEngine.draw(offscreenCtx, pal, coastProg);
  }

  // ── STAGE 2 (0.12 -> 0.24): Hydrology (Rivers & Lakes) ───────────────────────
  const hydroProg = subProgress(progress, 0.12, 0.24);
  if (hydroProg > 0 && riverNetwork) {
    riverNetwork.draw(offscreenCtx, pal, hydroProg);
  }

  // ── STAGE 3 (0.22 -> 0.44): Relief & Orography (Mountain Ridges, Peaks, Hills) ──
  const reliefProg = subProgress(progress, 0.22, 0.44);
  if (reliefProg > 0) {
    // 3a. Mountain cordillera ridges grow along their spines (0.00 -> 0.75 of relief window)
    if (ridges && ridges.length > 0) {
      const ridgeProg = Math.min(1.0, reliefProg / 0.75);
      for (let r of ridges) {
        r.draw(offscreenCtx, pal, ridgeProg);
      }
    }

    // 3b. Mountain peaks sorted North-to-South hatching sequentially (0.10 -> 0.85 of relief window)
    if (peaks && peaks.length > 0) {
      const peakProg = subProgress(reliefProg, 0.10, 0.85);
      if (peakProg > 0) {
        const totalP = peaks.length;
        const win = Math.min(0.20, 3.5 / totalP);
        for (let i = 0; i < totalP; i++) {
          const sTime = (i / totalP) * (1.0 - win);
          if (peakProg < sTime) continue;
          const pP = Math.min(1.0, (peakProg - sTime) / win);
          peaks[i].draw(offscreenCtx, pal, pP);
        }
      }
    }

    // 3c. Rolling foothills & downlands (0.35 -> 1.00 of relief window)
    if (hillsEngine) {
      const hillProg = subProgress(reliefProg, 0.35, 1.00);
      if (hillProg > 0) {
        hillsEngine.draw(offscreenCtx, pal, hillProg);
      }
    }
  }

  // ── STAGE 4 (0.42 -> 0.54): Primeval Forests & Riverine Woodlands ─────────────
  // Trees bloom sequentially grove by grove across the valleys
  const forestProg = subProgress(progress, 0.42, 0.54);
  if (forestProg > 0 && forestEngine) {
    forestEngine.draw(offscreenCtx, pal, forestProg);
  }

  // ── STAGE 5 (0.52 -> 0.70): Human Civilization (Settlements Drawn One by One) ──
  // Each settlement draws its citadel silhouette, then its ornate banner & Latin name!
  const settleProg = subProgress(progress, 0.52, 0.70);
  if (settleProg > 0 && settlementEngine) {
    settlementEngine.draw(offscreenCtx, pal, settleProg);
  }

  // ── STAGE 6 (0.66 -> 0.78): Highways, Roads & Stone Arch Bridges ─────────────
  // Dashed thoroughfares snake from city to city, bridging across rivers
  const roadProg = subProgress(progress, 0.66, 0.78);
  if (roadProg > 0 && roadNetwork) {
    roadNetwork.draw(offscreenCtx, pal, roadProg);
  }

  // ── STAGE 7 (0.74 -> 0.84): Wilderness Desolations & Regional Lore ────────────
  // Ancient ruins, roaming beasts, ground textures, and sweeping Latin calligraphy titles
  const wildProg = subProgress(progress, 0.74, 0.84);
  if (wildProg > 0 && wildernessEngine) {
    wildernessEngine.draw(offscreenCtx, pal, wildProg);
  }

  // ── STAGE 8 (0.80 -> 0.90): The Open Ocean ───────────────────────────────────
  // Portolan rhumb lines, sinusoidal wavelets, tall ships & the Baroque sea serpent
  const oceanProg = subProgress(progress, 0.80, 0.90);
  if (oceanProg > 0) {
    if (oceanEngine) {
      const rhumbProg = Math.min(1.0, oceanProg / 0.65);
      oceanEngine.drawRhumbLines(offscreenCtx, pal, rhumbProg, coastEngine);

      const waveProg = subProgress(oceanProg, 0.20, 0.80);
      if (waveProg > 0) oceanEngine.drawWaves(offscreenCtx, pal, waveProg);

      const vesselProg = subProgress(oceanProg, 0.35, 0.90);
      if (vesselProg > 0) oceanEngine.drawVessels(offscreenCtx, pal, vesselProg);
    }

    const effectiveMonster = showMonster !== null ? showMonster : (monsterEngine ? monsterEngine.visible : false);
    if (effectiveMonster && monsterEngine) {
      const monProg = subProgress(oceanProg, 0.45, 1.00);
      if (monProg > 0) monsterEngine.draw(offscreenCtx, pal, monProg);
    }
  }

  // ── STAGE 9 (0.88 -> 1.00): Cartographic Paraphernalia & Neatline Framing ─────
  // Settlement cartouche banner labels top layer guarantee
  if (settlementEngine && progress >= 0.70) {
    settlementEngine.drawLabels(offscreenCtx, pal, 1.0);
  }

  const effectiveRose = showRose !== null ? showRose : (compassEngine ? compassEngine.visible : false);
  if (effectiveRose && compassEngine) {
    const roseProg = subProgress(progress, 0.88, 0.97);
    if (roseProg > 0) compassEngine.draw(offscreenCtx, pal, roseProg);
  }

  if (cartoucheEngine) {
    const cartProg = subProgress(progress, 0.90, 0.98);
    if (cartProg > 0) cartoucheEngine.draw(offscreenCtx, pal, cartProg);
  }

  // Margin Cleanup & Neatline Outer Frame
  const frameProg = subProgress(progress, 0.95, 1.00);
  if (frameProg > 0) {
    const borderPad = 28;
    offscreenCtx.save();
    offscreenCtx.fillStyle = pal.paper;
    offscreenCtx.fillRect(0, 0, totalW, borderPad);
    offscreenCtx.fillRect(0, totalH - borderPad, totalW, borderPad);
    offscreenCtx.fillRect(0, 0, borderPad, totalH);
    offscreenCtx.fillRect(totalW - borderPad, 0, borderPad, totalH);

    if (pat) {
      offscreenCtx.fillStyle = pat;
      offscreenCtx.globalCompositeOperation = pal.isDark ? "screen" : "multiply";
      offscreenCtx.globalAlpha = pal.isDark ? 0.18 : 0.55;
      offscreenCtx.fillRect(0, 0, totalW, borderPad);
      offscreenCtx.fillRect(0, totalH - borderPad, totalW, borderPad);
      offscreenCtx.fillRect(0, 0, borderPad, totalH);
      offscreenCtx.fillRect(totalW - borderPad, 0, borderPad, totalH);
    }
    offscreenCtx.restore();

    // Outer double border rule
    offscreenCtx.save();
    offscreenCtx.strokeStyle = pal.ink;
    offscreenCtx.lineWidth = 1.6;
    offscreenCtx.globalAlpha = 0.50 * frameProg;
    offscreenCtx.strokeRect(borderPad, borderPad, totalW - borderPad * 2, totalH - borderPad * 2);

    offscreenCtx.lineWidth = 0.6;
    const innerPad = borderPad + 4;
    offscreenCtx.strokeRect(innerPad, innerPad, totalW - innerPad * 2, totalH - innerPad * 2);
    offscreenCtx.restore();
  }

  // Dual-screen bezel line guide (if enabled with 'B' key)
  if (showBezel > 0.5) {
    offscreenCtx.save();
    offscreenCtx.strokeStyle = "#ff4411";
    offscreenCtx.lineWidth = 3.0;
    const screenW = totalW / totalScreens;
    for (let s = 1; s < totalScreens; s++) {
      const bx = s * screenW;
      offscreenCtx.beginPath();
      offscreenCtx.moveTo(bx, 0);
      offscreenCtx.lineTo(bx, totalH);
      offscreenCtx.stroke();
    }
    offscreenCtx.restore();
  }

  offscreenCtx.restore();
}

/**
 * Main draw call: renders panoramic offscreen buffer and executes real-time WebGL fragment shader.
 */
function drawMapScene(progress, alpha = 1.0) {
  if (offscreenCanvas.width === 0 || offscreenCanvas.height === 0) return;

  const pal = MAP_PALETTES[paletteIdx];
  document.body.style.background = pal.paper;

  const totalW = canvas.width * totalScreens;
  const totalH = canvas.height;

  const effectiveRose = showRose !== null ? showRose : (mapState.compassEngine ? mapState.compassEngine.visible : false);
  const effectiveMonster = showMonster !== null ? showMonster : (mapState.monsterEngine ? mapState.monsterEngine.visible : false);

  // Re-render offscreen if drawing is in-flight, seed changed, or toggle changed
  if (
    progress < 1.0 ||
    renderedFinalSeed !== mapSeed ||
    lastRenderedRose !== effectiveRose ||
    lastRenderedMonster !== effectiveMonster
  ) {
    lastRenderedRose = effectiveRose;
    lastRenderedMonster = effectiveMonster;
    renderOffscreenScene(totalW, totalH, mapSeed, progress, alpha, pal);
    if (progress >= 1.0) renderedFinalSeed = mapSeed;
  }

  // Real-time WebGL Aquatint Rosin Noise Shading Quad
  if (glState) {
    const { gl, prog, posAttr, posBuf, tex, noiseTex, uniforms } = glState;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);

    // Upload offscreen canvas to WebGL texture (unit 0)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreenCanvas);
    gl.uniform1i(uniforms.u_texture, 0);

    // Bind tiled random noise texture (unit 1)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.uniform1i(uniforms.u_noiseTex, 1);

    gl.uniform1f(uniforms.u_screenIndex, screenIndex);
    gl.uniform1f(uniforms.u_totalScreens, totalScreens);
    gl.uniform1f(uniforms.u_grainAmount, pal.isDark ? 0.055 : 0.075);
    gl.uniform1f(uniforms.u_alpha, alpha);

    const paperRgb = hexToRgb01(pal.paper);
    gl.uniform3f(uniforms.u_paperColor, paperRgb[0], paperRgb[1], paperRgb[2]);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  } else if (fallbackCtx2D) {
    // 2D Canvas Fallback
    fallbackCtx2D.clearRect(0, 0, canvas.width, canvas.height);
    fallbackCtx2D.save();
    fallbackCtx2D.globalAlpha = alpha;
    const offsetX = screenIndex * canvas.width;
    fallbackCtx2D.drawImage(offscreenCanvas, -offsetX, 0);
    fallbackCtx2D.restore();
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
      showRose,
      showMonster,
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
    showRose,
    showMonster,
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
        showRose,
        showMonster,
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
    } else if (data.cmd === "rose") {
      showRose = data.showRose;
      renderedFinalSeed = null;
    } else if (data.cmd === "monster") {
      showMonster = data.showMonster;
      renderedFinalSeed = null;
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
    showRose = data.showRose;
    showMonster = data.showMonster;
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
  if (e.key === "r" || e.key === "R") {
    const effectiveRose = showRose !== null ? showRose : (mapState.compassEngine ? mapState.compassEngine.visible : false);
    showRose = !effectiveRose;
    renderedFinalSeed = null;
    if (!isPrimary) bc.postMessage({ cmd: "rose", showRose });
    return;
  }
  if (e.key === "m" || e.key === "M") {
    const effectiveMonster = showMonster !== null ? showMonster : (mapState.monsterEngine ? mapState.monsterEngine.visible : false);
    showMonster = !effectiveMonster;
    renderedFinalSeed = null;
    if (!isPrimary) bc.postMessage({ cmd: "monster", showMonster });
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
