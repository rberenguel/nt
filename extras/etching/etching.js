// Procedural Copperplate Etched Landscapes
// Inspired by Albrecht Dürer, 18th/19th century intaglio engravings,
// Japanese woodblock prints, and u/generativelight (p5js landscape etchings).
// Ultra-wide dual-monitor 32:9 synchronization via BroadcastChannel.

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

// ── Seeded Fast PRNG (Mulberry32) ─────────────────────────────────────────────
function createRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Antique Intaglio Palettes ─────────────────────────────────────────────────
const PALETTES = [
  {
    name: "Prussian Blue",
    paper: "#f4eedb",      // Warm antique cream laid paper
    ink: "#122438",        // Deep intaglio Prussian blue
    watermark: "rgba(40, 20, 10, 0.05)",
    hatchAlt: "#1a3552",
  },
  {
    name: "Carbon Lamp Black",
    paper: "#f2ede0",      // Antique ivory paper
    ink: "#151413",        // Deep carbon black
    watermark: "rgba(30, 25, 20, 0.05)",
    hatchAlt: "#252422",
  },
  {
    name: "Roasted Sepia",
    paper: "#ede0cc",      // Warm beige parchment
    ink: "#2c170d",        // Dark roasted sepia
    watermark: "rgba(60, 30, 10, 0.06)",
    hatchAlt: "#422517",
  },
  {
    name: "Alpine Pine",
    paper: "#eaf0e6",      // Pale sage laid paper
    ink: "#0e2417",        // Deep forest pine
    watermark: "rgba(20, 40, 20, 0.05)",
    hatchAlt: "#183b27",
  },
  {
    name: "Venetian Terracotta",
    paper: "#faede2",      // Warm peach laid paper
    ink: "#381710",        // Burnt sienna copper
    watermark: "rgba(50, 20, 10, 0.05)",
    hatchAlt: "#52251a",
  },
];

let paletteIdx = Math.floor(Math.random() * PALETTES.length);
let landscapeSeed = Math.floor(Math.random() * 10000000);
let simTime = 0.0;
let lastTimestamp = 0;
let paused = false;
let showBezel = 0.0;

// ── Procedural Laid-Paper Texture Pattern ──────────────────────────────────────
const paperCanvas = document.createElement("canvas");
paperCanvas.width = 256;
paperCanvas.height = 256;
const pCtx = paperCanvas.getContext("2d");

// Fine paper fiber noise
const imgData = pCtx.createImageData(256, 256);
const pData = imgData.data;
for (let i = 0; i < 256 * 256; i++) {
  const noise = (Math.random() - 0.5) * 45;
  const idx = i * 4;
  pData[idx] = 128 + noise;
  pData[idx + 1] = 128 + noise;
  pData[idx + 2] = 128 + noise;
  pData[idx + 3] = 20; // Subtle tooth
}
pCtx.putImageData(imgData, 0, 0);

let laidPattern = null;
function getLaidPattern() {
  if (!laidPattern && ctx) {
    laidPattern = ctx.createPattern(paperCanvas, "repeat");
  }
  return laidPattern;
}

// ── Offscreen Panoramic Etching Canvas (Aquatint Texture Filter) ──────────────
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");

function applyAquatintGrain(targetCtx, w, h, amount, seed) {
  const imgData = targetCtx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const rng = createRNG(seed ^ 0x9e3779b9);
  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    const n = (rng() - 0.5) * (amount * 2);
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  targetCtx.putImageData(imgData, 0, 0);
}

// ── Procedural Fractal 1D Noise ───────────────────────────────────────────────
function noise1D(x, rng) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3.0 - 2.0 * f);
  // Deterministic hash based on integer coordinate
  const h0 = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  const h1 = Math.sin((i + 1) * 127.1 + 311.7) * 43758.5453;
  const v0 = (h0 - Math.floor(h0)) * 2.0 - 1.0;
  const v1 = (h1 - Math.floor(h1)) * 2.0 - 1.0;
  return v0 + (v1 - v0) * u;
}

function fbm1D(x, seedOffset) {
  let v = 0.0;
  let amp = 0.55;
  let freq = 1.0;
  for (let o = 0; o < 5; o++) {
    v += noise1D(x * freq + seedOffset * 13.7 + o * 47.1) * amp;
    freq *= 2.08;
    amp *= 0.48;
  }
  return v;
}

// ── Procedural Fractal 2D Value Noise ─────────────────────────────────────────
// ── Procedural Fractal 2D Value Noise ─────────────────────────────────────────
function hash2D(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (n - Math.floor(n)) * 2.0 - 1.0;
}

function noise2D(x, y) {
  const iX = Math.floor(x);
  const iY = Math.floor(y);
  const fX = x - iX;
  const fY = y - iY;
  const u = fX * fX * (3.0 - 2.0 * fX);
  const v = fY * fY * (3.0 - 2.0 * fY);

  const a = hash2D(iX, iY);
  const b = hash2D(iX + 1, iY);
  const c = hash2D(iX, iY + 1);
  const d = hash2D(iX + 1, iY + 1);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm2D(x, y, octaves = 3) {
  let val = 0;
  let amp = 0.5;
  let freq = 1.0;
  let tot = 0;
  for (let i = 0; i < octaves; i++) {
    val += noise2D(x * freq, y * freq) * amp;
    tot += amp;
    freq *= 2.05;
    amp *= 0.5;
  }
  return val / tot;
}

// ── Landscape Layer Structure ─────────────────────────────────────────────────
let mountainLayers = [];
let sunPos = { x: 0, y: 0, rad: 0 };
let sunStyle = 0;
let cloudCircles = [];
let skyPaths = null;
let skySegments = null;

function generateCloudLobes(cx, cy, spanW, spanH, rng, style) {
  const lobes = [];
  const baseY = cy + spanH * 0.38;

  // Horizontal baseline lobes to ensure solid flat bottom
  const baseR = Math.max(8, spanH * 0.22);
  const numBase = Math.max(5, Math.floor(spanW / (baseR * 1.5)));
  for (let i = 0; i <= numBase; i++) {
    const t = i / numBase;
    const bx = cx - spanW * 0.48 + t * spanW * 0.96;
    const by = baseY - baseR * 0.3 + (rng() - 0.5) * (baseR * 0.25);
    lobes.push({ x: bx, y: by, r: baseR });
  }

  // Upper billowing lobes: adjacent billows overlap by at least 40-50% for smooth continuity
  let billows = [];
  if (style === "towering") {
    billows = [
      { t: 0.12, h: 0.28, r: 0.25 },
      { t: 0.24, h: 0.55, r: 0.36 },
      { t: 0.38, h: 0.92, r: 0.48 }, // towering peak
      { t: 0.52, h: 0.70, r: 0.42 }, // high shoulder
      { t: 0.66, h: 0.52, r: 0.36 }, // medium shoulder
      { t: 0.78, h: 0.36, r: 0.28 }, // lower terrace
      { t: 0.88, h: 0.22, r: 0.20 }, // tail
    ];
  } else if (style === "twin_peaks") {
    billows = [
      { t: 0.14, h: 0.30, r: 0.26 },
      { t: 0.28, h: 0.72, r: 0.40 }, // Peak 1
      { t: 0.42, h: 0.52, r: 0.34 }, // Saddle dip
      { t: 0.56, h: 0.78, r: 0.42 }, // Peak 2
      { t: 0.72, h: 0.55, r: 0.36 },
      { t: 0.86, h: 0.28, r: 0.24 },
    ];
  } else if (style === "rolling") {
    billows = [
      { t: 0.12, h: 0.32, r: 0.26 },
      { t: 0.26, h: 0.60, r: 0.36 },
      { t: 0.42, h: 0.72, r: 0.40 },
      { t: 0.58, h: 0.58, r: 0.36 },
      { t: 0.74, h: 0.65, r: 0.38 },
      { t: 0.88, h: 0.30, r: 0.24 },
    ];
  } else if (style === "wisp") {
    billows = [
      { t: 0.20, h: 0.25, r: 0.24 },
      { t: 0.50, h: 0.52, r: 0.38 },
      { t: 0.80, h: 0.28, r: 0.24 },
    ];
  } else {
    // Windswept
    billows = [
      { t: 0.12, h: 0.20, r: 0.20 },
      { t: 0.28, h: 0.35, r: 0.28 },
      { t: 0.46, h: 0.52, r: 0.36 },
      { t: 0.64, h: 0.75, r: 0.42 },
      { t: 0.82, h: 0.85, r: 0.46 }, // high crown
      { t: 0.92, h: 0.45, r: 0.30 },
    ];
  }

  for (let b = 0; b < billows.length; b++) {
    const bil = billows[b];
    const px = cx - spanW * 0.48 + bil.t * spanW * 0.96 + (rng() - 0.5) * 6;
    const py = baseY - bil.h * spanH;
    const prad = bil.r * spanH + Math.max(3, spanH * 0.08);

    // Main billow dome
    lobes.push({ x: px, y: py, r: prad });

    // Dense body filler connecting down to baseY
    const numFill = Math.max(2, Math.floor(bil.h * 3.5));
    for (let f = 1; f <= numFill; f++) {
      const fy = py + (baseY - py) * (f / (numFill + 0.5));
      lobes.push({ x: px + (rng() - 0.5) * 4, y: fy, r: prad * 0.95 });
    }

    // Sub-lobes flanking the dome for rich bumpy cumulus contours
    if (bil.h > 0.35) {
      lobes.push({ x: px - prad * 0.55, y: py + prad * 0.35, r: prad * 0.65 });
      lobes.push({ x: px + prad * 0.55, y: py + prad * 0.35, r: prad * 0.65 });
    }
  }

  return { lobes, baseY };
}

function generateLandscape(totalW, totalH, seed) {
  const rng = createRNG(seed);
  const layers = [];
  const numLayers = 6;

  // Sun Position & Celestial Style (0: Black Burst, 1: Sol Invictus, 2: Woodcut Halo)
  sunPos = {
    x: totalW * (0.22 + rng() * 0.56),
    y: totalH * (0.16 + rng() * 0.12),
    rad: Math.min(totalW, totalH) * (0.046 + rng() * 0.018),
  };
  sunStyle = Math.floor(rng() * 3);

  // Generate 6 mountain ridge layers occupying lower 42% of vertical space (leaving upper 58% for sky)
  for (let l = 0; l < numLayers; l++) {
    const depthFrac = l / (numLayers - 1); // 0 = furthest, 1 = nearest
    // Horizon ridge begins at 58% of canvas height, foreground reaches 92%
    const baseY = totalH * (0.58 + depthFrac * 0.34);
    const heightScale = totalH * (0.16 - depthFrac * 0.05);
    const freq = (0.0010 + (1.0 - depthFrac) * 0.0012);
    const seedOffset = seed + l * 100;

    // Generate elevation profile points
    const pts = [];
    const stepX = 14;
    const totalPts = Math.ceil(totalW / stepX) + 4;

    for (let i = -2; i <= totalPts; i++) {
      const px = i * stepX;
      // Fractal noise with sharp jagged peaks
      const n = fbm1D(px * freq, seedOffset);
      const ridge = 1.0 - Math.abs(n);
      const py = baseY - Math.pow(ridge, 1.4) * heightScale;
      pts.push({ x: px, y: py });
    }

    layers.push({
      depth: depthFrac,
      baseY,
      heightScale,
      pts,
      stepX,
      seedOffset,
    });
  }

  mountainLayers = layers;

  // ── Procedural Multiscale Arch-Carved Clouds (generativelight technique) ──────
  cloudCircles = [];

  const numClouds = 7;
  const sizeTiers = ["large", "small", "medium", "small", "large", "medium", "small"];

  for (let c = 0; c < numClouds; c++) {
    const tier = sizeTiers[c % sizeTiers.length];
    let peakStyle;
    let spanW;

    if (tier === "small") {
      // Small accent wisp / puff: ~120-190px on 3840 dual monitor
      spanW = totalW * (0.032 + rng() * 0.018);
      peakStyle = rng() < 0.5 ? "wisp" : "windswept";
    } else if (tier === "medium") {
      // Medium cumulus billow: ~210-310px on 3840 dual monitor
      spanW = totalW * (0.055 + rng() * 0.025);
      const medStyles = ["rolling", "twin_peaks", "towering"];
      peakStyle = medStyles[Math.floor(rng() * medStyles.length)];
    } else {
      // Large majestic towering / rolling formation: ~350-460px on 3840 dual monitor
      spanW = totalW * (0.090 + rng() * 0.030);
      const lgStyles = ["towering", "rolling", "twin_peaks"];
      peakStyle = lgStyles[Math.floor(rng() * lgStyles.length)];
    }

    const spanH = peakStyle === "rolling" ? spanW * (0.19 + rng() * 0.04) : spanW * (0.28 + rng() * 0.06);
    const cx = ((c + 0.5) / numClouds) * totalW + (rng() - 0.5) * (totalW * 0.06);
    let cy = totalH * (0.12 + (c % 3) * 0.10 + rng() * 0.04);
    if (tier === "small") {
      cy += (rng() - 0.5) * totalH * 0.06;
    }

    const { lobes, baseY } = generateCloudLobes(cx, cy, spanW, spanH, rng, peakStyle);

    function cloudDist(x, y) {
      let minD = Infinity;
      for (let i = 0; i < lobes.length; i++) {
        const d = Math.hypot(x - lobes[i].x, y - lobes[i].y) - lobes[i].r;
        if (d < minD) minD = d;
      }
      return Math.max(minD, y - baseY);
    }

    function inFrame(x, y) {
      return cloudDist(x, y) <= 2.0;
    }

    // Scale circle radii and grid steps proportionally to cloud height spanH
    const scaleRef = Math.max(0.40, Math.min(1.15, spanH / 75.0));
    const scales = [
      { step: 8.5 * scaleRef, minR: 7.0 * scaleRef, maxR: 9.2 * scaleRef, probMult: 0.85 },
      { step: 5.2 * scaleRef, minR: 4.2 * scaleRef, maxR: 5.8 * scaleRef, probMult: 1.0 },
      { step: 3.6 * scaleRef, minR: 2.4 * scaleRef, maxR: 3.5 * scaleRef, probMult: 1.25 },
    ];

    const minX = Math.floor(cx - spanW * 0.55);
    const maxX = Math.ceil(cx + spanW * 0.55);
    const minY = Math.floor(cy - spanH * 0.85);
    const maxY = Math.ceil(baseY + 6);
    const edgeBand = Math.max(8, spanH * 0.22);

    for (let s = 0; s < scales.length; s++) {
      const sc = scales[s];
      const step = sc.step;
      const wiggle = step * 0.45;
      const minR = sc.minR;
      const maxR = sc.maxR;
      const probMult = sc.probMult;

      for (let gx = minX; gx <= maxX; gx += step) {
        for (let gy = minY; gy <= maxY; gy += step) {
          const wx = gx + (rng() - 0.5) * wiggle;
          const wy = gy + (rng() - 0.5) * wiggle;
          if (inFrame(wx, wy)) {
            const cd = cloudDist(wx, wy);
            const edgeFactor = Math.max(0, Math.min(1.0, (cd + edgeBand) / edgeBand));
            const baseProb = 0.08 + 0.44 * edgeFactor;

            const nVal = fbm2D(wx * 0.03, wy * 0.03, 3);
            const prob = Math.max(0.03, Math.min(0.62, (baseProb + nVal * 0.28) * probMult));

            const rVal = minR + rng() * (maxR - minR);

            if (rng() < prob) {
              const opacity = Math.max(0.25, Math.min(0.95, 0.40 + 0.55 * edgeFactor + (rng() - 0.5) * 0.2));
              const sw = 0.70 + 0.3 * edgeFactor;
              cloudCircles.push({
                type: "border",
                x: wx,
                y: wy,
                r: rVal,
                opacity,
                sw,
                z: rng(),
              });
              // Offset carver: guarantees this bordered circle turns into an ARCH and never stays an unbroken ring
              const ang = rng() * Math.PI * 2;
              const dist = rVal * (0.35 + rng() * 0.40);
              cloudCircles.push({
                type: "carver",
                x: wx + Math.cos(ang) * dist,
                y: wy + Math.sin(ang) * dist,
                r: rVal * (0.85 + rng() * 0.30),
                z: cloudCircles[cloudCircles.length - 1].z + 0.01,
              });
            } else {
              cloudCircles.push({
                type: "ambient",
                x: wx,
                y: wy,
                r: rVal,
                z: rng(),
              });
            }
          }
        }
      }
    }
  }

  // Sort by z so paper fill circles carve borders into arches
  cloudCircles.sort((a, b) => a.z - b.z);

  // Precompute quantized continuous/stippled sky line paths
  generateSkyPaths(totalW, totalH, seed);

  // Pre-render full panoramic intaglio etching onto offscreen canvas with aquatint grain
  renderOffscreenScene(totalW, totalH, seed);
}

// ── Drawing Engine ────────────────────────────────────────────────────────────

// 1. Multiple Celestial Sun Designs & Radiating Engraved Rays/Beams
function drawSunAndRays(ctx, totalW, totalH, pal, style, rng) {
  const { x, y, rad } = sunPos;
  ctx.save();
  ctx.lineCap = "round";

  if (style === 0) {
    // ── Style 0: "Black Burst / Intaglio Eclipse" (Original reference) ──
    // Solid dark circle
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();

    // Uneven burst ray lines radiating directly from the rim without halo rings
    const numRays = 72;
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const rVal = rng();

      let rayLen;
      let strokeW;
      if (rVal < 0.35) {
        rayLen = rad * (0.15 + rng() * 0.35);
        strokeW = 1.0 + rng() * 0.8;
      } else if (rVal < 0.80) {
        rayLen = rad * (0.50 + rng() * 0.70);
        strokeW = 1.5 + rng() * 1.2;
      } else {
        rayLen = rad * (1.30 + rng() * 1.40);
        strokeW = 2.2 + rng() * 1.6;
      }

      ctx.lineWidth = strokeW;
      ctx.strokeStyle = pal.ink;
      ctx.beginPath();
      ctx.moveTo(x + cosA * (rad + 1.5), y + sinA * (rad + 1.5));
      ctx.lineTo(x + cosA * (rad + 1.5 + rayLen), y + sinA * (rad + 1.5 + rayLen));
      ctx.stroke();
    }
  } else if (style === 1) {
    // ── Style 1: "Sol Invictus / Flame Wedges" ──
    // Inner dark disc
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.arc(x, y, rad * 0.82, 0, Math.PI * 2);
    ctx.fill();

    // Clear paper halo ring with thin outer rim
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.stroke();

    const numSpikes = 44;
    for (let i = 0; i < numSpikes; i++) {
      const angle = (i / numSpikes) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const isMajor = i % 2 === 0;
      const rayLen = isMajor ? rad * (0.9 + rng() * 0.8) : rad * (0.35 + rng() * 0.35);
      const strokeW = isMajor ? 2.4 : 1.2;

      ctx.lineWidth = strokeW;
      ctx.strokeStyle = pal.ink;
      ctx.beginPath();
      ctx.moveTo(x + cosA * (rad + 3.0), y + sinA * (rad + 3.0));
      ctx.lineTo(x + cosA * (rad + 3.0 + rayLen), y + sinA * (rad + 3.0 + rayLen));
      ctx.stroke();
    }
  } else {
    // ── Style 2: "Woodcut Halo" (Concentric dashed rings and spoke rays) ──
    const numHaloRings = 7;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.4;
    for (let i = 1; i <= numHaloRings; i++) {
      const r = rad + i * 8.5;
      ctx.setLineDash(i % 2 === 0 ? [6, 8] : [12, 10]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Solid paper disc with inner etched horizontal hatching
    ctx.fillStyle = pal.paper;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, rad - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.lineWidth = 1.0;
    for (let py = y - rad; py <= y + rad; py += 3.5) {
      if (py > y - rad * 0.1) {
        ctx.beginPath();
        ctx.moveTo(x - rad, py);
        ctx.lineTo(x + rad, py);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Radiating engraved sunbeams spanning sky
    const numBeams = 48;
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = pal.ink;
    for (let i = 0; i < numBeams; i++) {
      const angle = (i / numBeams) * Math.PI * 2;
      const innerR = rad + numHaloRings * 8.5 + 10;
      const outerR = innerR + 60 + ((i * 37) % 180);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * innerR, y + Math.sin(angle) * innerR);
      ctx.lineTo(x + Math.cos(angle) * outerR, y + Math.sin(angle) * outerR);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// 2. Invisible Large-Scale Perlin Noise Field + Quantized Intaglio Sky Engine
// Evaluates lightness scalar field V(x, y) in [0.0, 1.0]:
//   0.0 = Deepest sky tone (long continuous solid intaglio lines)
//   1.0 = Brightest highlight (clear empty paper / sun disc clearing)
function getLightness(x, y, totalW, totalH, horizonY, seed) {
  // Distance from sun
  const dSun = Math.hypot(x - sunPos.x, y - sunPos.y);
  const sunClearR = sunPos.rad + 55;
  if (dSun < sunClearR) return 1.0; // Completely empty inside sun clearing

  // Sun radial glow: reaches out ~16% of total panoramic width
  const glowRadius = Math.max(300, totalW * 0.16);
  const sunGlow = Math.max(0.0, 1.0 - (dSun - sunClearR) / glowRadius);

  // Large-scale 2D Perlin noise: scale ~350px horizontally, ~250px vertically
  // Guides coherent, organic transitions across contiguous columns
  const pNoise = fbm2D(x * 0.0028, y * 0.0038 + seed * 0.05, 3);

  // Crepuscular angled shafts radiating from sun
  const angle = Math.atan2(y - sunPos.y, x - sunPos.x);
  const beam = Math.pow(0.5 + 0.5 * Math.sin(angle * 12.0), 3) * sunGlow;

  // Altitude: darker at zenith (top y=14), naturally brighter near mountain horizon
  const alt = (y / horizonY) * 0.28;

  const V = 0.22 + sunGlow * 0.50 + beam * 0.30 + pNoise * 0.38 + alt;
  return Math.max(0.0, Math.min(1.0, V));
}

function generateSkyPaths(totalW, totalH, seed) {
  if (mountainLayers.length === 0) return;
  const backLayer = mountainLayers[0];
  const stepX = backLayer.stepX;

  const usePath2D = typeof Path2D !== "undefined";
  const pathContinuous = usePath2D ? new Path2D() : null;
  const pathDiscontinuous = usePath2D ? new Path2D() : null;
  const pathDots = usePath2D ? new Path2D() : null;
  const segs = usePath2D ? null : { continuous: [], discontinuous: [], dots: [] };

  const colStep = 13.0;

  for (let x = 14; x < totalW - 14; x += colStep) {
    // Find horizon Y at column x along back ridge
    const ptIdx = Math.max(0, Math.min(backLayer.pts.length - 2, Math.floor(x / stepX)));
    const pA = backLayer.pts[ptIdx];
    const pB = backLayer.pts[ptIdx + 1];
    const t = (x - pA.x) / (pB.x - pA.x);
    const horizonY = pA.y + (pB.y - pA.y) * t;

    let y = 14;
    const colRng = createRNG(Math.floor(x * 1337 + seed * 91));

    while (y < horizonY) {
      const V = getLightness(x, y, totalW, totalH, horizonY, seed);

      if (V >= 0.76) {
        // ── TIER 4: EMPTY (Luminous windows / paper gaps across contiguous lines) ──
        y += 8 + colRng() * 6;
      } else if (V >= 0.54) {
        // ── TIER 3: STIPPLE DOTS (Delicate intaglio stippling) ──
        const dotLen = 2.5 + colRng() * 2.5;
        const dotGap = 11.0 + colRng() * 9.0;
        const dotEnd = Math.min(horizonY, y + dotLen);
        if (usePath2D) {
          pathDots.moveTo(x, y);
          pathDots.lineTo(x, dotEnd);
        } else {
          segs.dots.push({ x1: x, y1: y, x2: x, y2: dotEnd });
        }
        y += dotLen + dotGap;
      } else if (V >= 0.32) {
        // ── TIER 2: DISCONTINUOUS SEGMENTS (Varied random dashes) ──
        const segLen = 18.0 + (0.54 - V) * 80.0 + colRng() * 20.0;
        const segEnd = Math.min(horizonY, y + segLen);
        if (usePath2D) {
          pathDiscontinuous.moveTo(x, y);
          pathDiscontinuous.lineTo(x, segEnd);
        } else {
          segs.discontinuous.push({ x1: x, y1: y, x2: x, y2: segEnd });
        }
        const gap = 5.0 + (V - 0.32) * 14.0 + colRng() * 4.0;
        y = segEnd + gap;
      } else {
        // ── TIER 1: CONTINUOUS SOLID INTAGLIO LINES ──
        const segLen = 75.0 + (0.32 - V) * 250.0 + colRng() * 40.0;
        const segEnd = Math.min(horizonY, y + segLen);
        if (usePath2D) {
          pathContinuous.moveTo(x, y);
          pathContinuous.lineTo(x, segEnd);
        } else {
          segs.continuous.push({ x1: x, y1: y, x2: x, y2: segEnd });
        }
        const gap = 2.5 + colRng() * 2.5;
        y = segEnd + gap;
      }
    }
  }

  if (usePath2D) {
    skyPaths = {
      continuous: pathContinuous,
      discontinuous: pathDiscontinuous,
      dots: pathDots,
    };
    skySegments = null;
  } else {
    skyPaths = null;
    skySegments = segs;
  }
}

function drawVerticalBrokenSky(ctx, pal) {
  ctx.save();
  ctx.strokeStyle = pal.ink;
  ctx.lineCap = "round";

  if (skyPaths) {
    // ── Tier 1: Continuous Solid Lines ──
    ctx.globalAlpha = 0.90;
    ctx.lineWidth = 2.70;
    ctx.stroke(skyPaths.continuous);

    // ── Tier 2: Discontinuous Segments ──
    ctx.globalAlpha = 0.80;
    ctx.lineWidth = 2.55;
    ctx.stroke(skyPaths.discontinuous);

    // ── Tier 3: Delicate Stipple Dots ──
    ctx.globalAlpha = 0.70;
    ctx.lineWidth = 2.35;
    ctx.stroke(skyPaths.dots);
  } else if (skySegments) {
    ctx.globalAlpha = 0.90;
    ctx.lineWidth = 2.70;
    ctx.beginPath();
    for (const s of skySegments.continuous) {
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();

    ctx.globalAlpha = 0.80;
    ctx.lineWidth = 2.55;
    ctx.beginPath();
    for (const s of skySegments.discontinuous) {
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();

    ctx.globalAlpha = 0.70;
    ctx.lineWidth = 2.35;
    ctx.beginPath();
    for (const s of skySegments.dots) {
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();
  }

  ctx.restore();
}

// 3. GenerativeLight Multiscale Arch-Carved Engraved Clouds (generativelight technique)
function drawClouds(ctx, pal) {
  ctx.save();
  for (let i = 0; i < cloudCircles.length; i++) {
    const c = cloudCircles[i];
    if (c.type === "border") {
      ctx.fillStyle = pal.paper;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.globalAlpha = c.opacity;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = c.sw;
      ctx.stroke();
      ctx.restore();
    } else {
      // Borderless paper fill circle: carves arches out of bordered neighbors
      ctx.fillStyle = pal.paper;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function getRidgeY(layer, x) {
  const pts = layer.pts;
  const idx = Math.max(0, Math.min(pts.length - 2, Math.floor((x - pts[0].x) / layer.stepX)));
  const pA = pts[idx];
  const pB = pts[idx + 1];
  const t = (x - pA.x) / (pB.x - pA.x);
  return pA.y + (pB.y - pA.y) * t;
}

// 4. Mountain Ridge Intaglio Hatching Engine
function drawMountainLayer(ctx, layer, layerIdx, totalW, totalH, pal) {
  const { pts, baseY } = layer;
  if (pts.length < 2) return;

  ctx.save();

  // 1. Construct Ridge Polygon and Fill with Paper to Occlude Background
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.lineTo(pts[pts.length - 1].x, totalH + 50);
  ctx.lineTo(pts[0].x, totalH + 50);
  ctx.closePath();

  ctx.fillStyle = pal.paper;
  ctx.fill();

  // Crisp ink outline along mountain silhouette
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 2. Clip to Mountain Body for Intaglio Hatching
  ctx.clip();

  // 3. Downward Etched Lines from Ridge with Perlin-Guided Lengths
  // Fixed etching angle (~55 degrees down-right)
  const etchAngle = 0.96; // ~55 degrees
  const cosA = Math.cos(etchAngle);
  const sinA = Math.sin(etchAngle);

  // Spread-apart spacing: distinct, separated etched lines
  const spacing = 9.0 + layerIdx * 1.2; // ~9.0px to 15.0px
  const heightScale = layer.heightScale || (totalH * (0.16 - layer.depth * 0.05));
  const maxLen = heightScale * (0.75 + layerIdx * 0.05);

  ctx.lineWidth = Math.max(1.25, 1.70 - layerIdx * 0.08);
  ctx.strokeStyle = pal.ink;
  ctx.lineCap = "round";

  const minX = pts[0].x;
  const maxX = pts[pts.length - 1].x;

  ctx.beginPath();
  for (let x = minX; x <= maxX; x += spacing) {
    const ry = getRidgeY(layer, x);

    // Perlin noise curve along ridge for proximal uniformity
    const n = fbm1D(x * 0.0038, layer.seedOffset + 250);
    const rawN = 0.5 + 0.5 * n; // [0, 1]

    let len = 0;
    if (rawN > 0.15) {
      const factor = (rawN - 0.15) / 0.85;
      len = (0.10 + 0.90 * Math.pow(factor, 1.3)) * maxLen;
    }

    if (len > 3.0) {
      const x2 = x + cosA * len;
      const y2 = ry + sinA * len;
      ctx.moveTo(x, ry);
      ctx.lineTo(x2, y2);
    }
  }
  ctx.stroke();

  ctx.restore();
}

// ── Offscreen Scene Pre-rendering with Aquatint Granulation ───────────────────
function renderOffscreenScene(totalW, totalH, seed) {
  offscreenCanvas.width = totalW;
  offscreenCanvas.height = totalH;

  const pal = PALETTES[paletteIdx];
  const rng = createRNG(seed + 777);

  // 1. Base Antique Laid Paper Wash
  offscreenCtx.fillStyle = pal.paper;
  offscreenCtx.fillRect(0, 0, totalW, totalH);

  // 2. Atmospheric Broken Vertical Lines in the Sky
  drawVerticalBrokenSky(offscreenCtx, pal);

  // 3. Celestial Sun & Radiating Rays (3 distinct styles)
  drawSunAndRays(offscreenCtx, totalW, totalH, pal, sunStyle, rng);

  // 4. Multiscale Arch-Carved Engraved Clouds
  drawClouds(offscreenCtx, pal);

  // 5. Mountain Ridge Layers with Downward Ridge Etching
  for (let l = 0; l < mountainLayers.length; l++) {
    drawMountainLayer(offscreenCtx, mountainLayers[l], l, totalW, totalH, pal);
  }

  // 6. Overlay Laid-Paper Watermark Ribs & Fiber Tooth across the print
  const pat = getLaidPattern();
  if (pat) {
    offscreenCtx.save();
    offscreenCtx.fillStyle = pat;
    offscreenCtx.globalCompositeOperation = "multiply";
    offscreenCtx.globalAlpha = 0.65;
    offscreenCtx.fillRect(0, 0, totalW, totalH);
    offscreenCtx.restore();
  }

  // 7. Antique Print Framing Border
  offscreenCtx.strokeStyle = pal.ink;
  offscreenCtx.lineWidth = 2.5;
  const borderMargin = Math.max(12, Math.round(totalH * 0.015));
  offscreenCtx.strokeRect(borderMargin, borderMargin, totalW - borderMargin * 2, totalH - borderMargin * 2);

  // 8. Aquatint Granulation Filter (authentic intaglio paper tooth & ink grain)
  applyAquatintGrain(offscreenCtx, totalW, totalH, 20, seed);
}

// ── Main Page Draw Call ───────────────────────────────────────────────────────
function drawEtchingScene(time) {
  if (offscreenCanvas.width === 0 || offscreenCanvas.height === 0) return;

  const offsetX = screenIndex * canvas.width;
  ctx.drawImage(offscreenCanvas, -offsetX, 0);

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
  generateLandscape(canvas.width * totalScreens, canvas.height, landscapeSeed);
}
window.addEventListener("resize", resize);
resize();

// ── Broadcast Initial Sync on Startup ─────────────────────────────────────────
if (isPrimary) {
  bc.postMessage({
    cmd: "heartbeat",
    simTime,
    landscapeSeed,
    paletteIdx,
    paused,
    showBezel,
  });
} else {
  bc.postMessage({ cmd: "requestSync" });
}

// ── Animation Loop ────────────────────────────────────────────────────────────
function loop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const dt = Math.min((timestamp - lastTimestamp) * 0.001, 0.05);
  lastTimestamp = timestamp;

  if (!paused) {
    simTime += dt;
  }

  // Auto-advance to a new landscape every 90 seconds
  if (isPrimary && Math.floor(simTime / 90.0) !== Math.floor((simTime - dt) / 90.0)) {
    landscapeSeed = Math.floor(Math.random() * 10000000);
    paletteIdx = (paletteIdx + 1) % PALETTES.length;
    generateLandscape(canvas.width * totalScreens, canvas.height, landscapeSeed);
    bc.postMessage({
      cmd: "newLandscape",
      landscapeSeed,
      paletteIdx,
      simTime,
    });
  }

  // Periodic heartbeat sync
  if (isPrimary && Math.floor(simTime * 3) !== Math.floor((simTime - dt) * 3)) {
    bc.postMessage({
      cmd: "heartbeat",
      simTime,
      landscapeSeed,
      paletteIdx,
      paused,
      showBezel,
    });
  }

  drawEtchingScene(simTime);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// ── Multi-screen BroadcastChannel Communication ───────────────────────────────
bc.onmessage = (ev) => {
  const data = ev.data;
  if (!data) return;

  if (data.quit) {
    window.close();
    return;
  }
  if (data.cmd === "save") {
    saveCanvas();
    return;
  }
  if (data.cmd === "requestSync" && isPrimary) {
    bc.postMessage({
      cmd: "heartbeat",
      simTime,
      landscapeSeed,
      paletteIdx,
      paused,
      showBezel,
    });
    return;
  }
  if (data.cmd === "heartbeat" && !isPrimary) {
    if (landscapeSeed !== data.landscapeSeed) {
      landscapeSeed = data.landscapeSeed;
      generateLandscape(canvas.width * totalScreens, canvas.height, landscapeSeed);
    }
    simTime = data.simTime;
    paletteIdx = data.paletteIdx;
    paused = data.paused;
    showBezel = data.showBezel;
    return;
  }
  if (data.cmd === "newLandscape") {
    landscapeSeed = data.landscapeSeed;
    paletteIdx = data.paletteIdx;
    simTime = data.simTime;
    generateLandscape(canvas.width * totalScreens, canvas.height, landscapeSeed);
    return;
  }
  if (data.cmd === "palette") {
    paletteIdx = data.paletteIdx;
    renderOffscreenScene(canvas.width * totalScreens, canvas.height, landscapeSeed);
    return;
  }
  if (data.cmd === "pause") {
    paused = data.paused;
    return;
  }
  if (data.cmd === "bezel") {
    showBezel = data.showBezel;
    return;
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
    bc.postMessage({ cmd: "save" });
    saveCanvas();
    return;
  }
  if (e.code === "Space" || e.key === "n" || e.key === "N") {
    // Generate new etched landscape immediately with random palette
    landscapeSeed = Math.floor(Math.random() * 10000000);
    let next;
    do {
      next = Math.floor(Math.random() * PALETTES.length);
    } while (next === paletteIdx && PALETTES.length > 1);
    paletteIdx = next;

    generateLandscape(canvas.width * totalScreens, canvas.height, landscapeSeed);
    bc.postMessage({
      cmd: "newLandscape",
      landscapeSeed,
      paletteIdx,
      simTime,
    });
    return;
  }
  if (e.key === "c" || e.key === "C") {
    paletteIdx = (paletteIdx + 1) % PALETTES.length;
    renderOffscreenScene(canvas.width * totalScreens, canvas.height, landscapeSeed);
    bc.postMessage({ cmd: "palette", paletteIdx });
    return;
  }
  if (e.key === "p" || e.key === "P") {
    paused = !paused;
    bc.postMessage({ cmd: "pause", paused });
    return;
  }
  if (e.key === "b" || e.key === "B") {
    showBezel = showBezel > 0.5 ? 0.0 : 1.0;
    bc.postMessage({ cmd: "bezel", showBezel });
    return;
  }
});

// Click to generate new etching or enter fullscreen
canvas.addEventListener("click", () => {
  landscapeSeed = Math.floor(Math.random() * 10000000);
  let next;
  do {
    next = Math.floor(Math.random() * PALETTES.length);
  } while (next === paletteIdx && PALETTES.length > 1);
  paletteIdx = next;

  generateLandscape(canvas.width * totalScreens, canvas.height, landscapeSeed);
  bc.postMessage({
    cmd: "newLandscape",
    landscapeSeed,
    paletteIdx,
    simTime,
  });

  const el = document.documentElement;
  if (!document.fullscreenElement) {
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }
});
