// Astronomic Comics & Modular Storyboard Canvas
// Procedural code-generated space comics inspired by Frank Force (KilledByAPixel)

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = params.has("screens") ? parseInt(params.get("screens"), 10) : 1;
const isPrimary = screenIndex === 0;

document.title = `Comics ${screenIndex}`;

const canvas = document.getElementById("comicCanvas");
const ctx = canvas.getContext("2d");

// ── Multi-screen BroadcastChannel ─────────────────────────────────────────────
const bc = new BroadcastChannel("comics");

function saveCanvas() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comics-screen${screenIndex}-${Date.now()}.png`;
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

// ── Color Palettes (Authentic Screenprint & Pulp) ─────────────────────────────
const PALETTES = [
  {
    name: "Classic Astronomic", // Matches the original artwork
    paper: "#f3f0e8",
    ink: "#111215",
    colorA: "#eb4d2e", // Hot Vermilion / Coral
    colorB: "#3cbfe6", // Electric Cyan / Sky
    cloudInk: "#eb4d2e",
    shadowDot: "#111215",
  },
  {
    name: "Vintage Moebius",
    paper: "#f5edd8",
    ink: "#18161f",
    colorA: "#e89838", // Desert Amber
    colorB: "#45a298", // Aegean Sea Teal
    cloudInk: "#e89838",
    shadowDot: "#18161f",
  },
  {
    name: "Jack Kirby Cosmic",
    paper: "#f2f3f5",
    ink: "#121218",
    colorA: "#f0386b", // Cosmic Magenta
    colorB: "#fec629", // Solar Yellow
    cloudInk: "#f0386b",
    shadowDot: "#121218",
  },
  {
    name: "Heavy Metal Cyber",
    paper: "#090a0d",
    ink: "#f0f4f8",
    colorA: "#ff2a6d", // Neon Pink
    colorB: "#05d9e8", // Laser Aqua
    cloudInk: "#ff2a6d",
    shadowDot: "#05d9e8",
  },
  {
    name: "Sepia Pulp",
    paper: "#ebe0ca",
    ink: "#2c1c14",
    colorA: "#b85c38", // Terracotta
    colorB: "#657d69", // Sage Olive
    cloudInk: "#b85c38",
    shadowDot: "#2c1c14",
  },
  {
    name: "Aged Newsprint", // Warm textured orange-y newspaper with pure black ink
    paper: "#e8af68",       // Oxidized vintage newspaper orange-amber
    ink: "#000000",         // Pure deep black
    colorA: "#c23b22",      // Printing-press vermilion / rust
    colorB: "#d69a48",      // Warm halftone screen amber
    cloudInk: "#c23b22",
    shadowDot: "#000000",
  },
];

// ── Procedural Newsprint Paper Texture ────────────────────────────────────────
const paperGrainCanvas = document.createElement("canvas");
paperGrainCanvas.width = 256;
paperGrainCanvas.height = 256;
const grainCtx = paperGrainCanvas.getContext("2d");
const grainImgData = grainCtx.createImageData(256, 256);
const gData = grainImgData.data;
for (let i = 0; i < 256 * 256; i++) {
  const noise = (Math.random() - 0.5) * 55;
  const idx = i * 4;
  gData[idx] = 128 + noise;
  gData[idx + 1] = 128 + noise;
  gData[idx + 2] = 128 + noise;
  gData[idx + 3] = 24; // Subtle pulp grain
}
grainCtx.putImageData(grainImgData, 0, 0);

// Add authentic paper flecks and fiber strands
grainCtx.strokeStyle = "rgba(50, 25, 5, 0.15)";
grainCtx.lineWidth = 0.8;
for (let i = 0; i < 40; i++) {
  const fx = Math.random() * 256;
  const fy = Math.random() * 256;
  grainCtx.beginPath();
  grainCtx.moveTo(fx, fy);
  grainCtx.lineTo(fx + (Math.random() - 0.5) * 8, fy + (Math.random() - 0.5) * 8);
  grainCtx.stroke();
}
let paperPattern = null;
function getPaperPattern() {
  if (!paperPattern && ctx) {
    paperPattern = ctx.createPattern(paperGrainCanvas, "repeat");
  }
  return paperPattern;
}

let paletteIdx = Math.floor(Math.random() * PALETTES.length);
let storySeed = Math.floor(Math.random() * 10000000);
let chapterTime = 0.0;
let paused = false;
let showBezel = 0.0;
let lastTimestamp = 0;

// Broadcast or request initial synchronization immediately on launch
if (isPrimary) {
  bc.postMessage({
    cmd: "heartbeat",
    storySeed,
    chapterTime,
    paletteIdx,
    paused,
    showBezel,
  });
} else {
  bc.postMessage({ cmd: "requestSync" });
}

// ── Recursive Multi-Panel Layout Subdivision ──────────────────────────────────
let layoutPanels = [];

function generateComicLayout(totalW, totalH, seed) {
  const rng = createRNG(seed);
  const gutter = Math.max(8, Math.round(totalH * 0.012));
  const margin = Math.max(12, Math.round(totalH * 0.018));

  const nonTextTypes = [
    "landscape_dome",
    "planet_orbit",
    "metaball_artifact",
    "cosmic_cloud",
    "void_meteors",
    "solar_orrery",
    "tintin_rocket",
  ];
  const textTypes = ["speech_bubble", "starburst_explosion"];

  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const allPanels = [];
  const screenW = totalW / totalScreens;
  const shuffledText = shuffle(textTypes);

  for (let s = 0; s < totalScreens; s++) {
    const sx = Math.round(s * screenW + margin);
    const sy = margin;
    const sw = Math.round(screenW - margin * 2);
    const sh = Math.round(totalH - margin * 2);

    // Target 3 to 5 panels per screen (guarantees at least 3 vignettes per screen, never 2)
    const targetPanels = 3 + Math.floor(rng() * 3); // 3, 4, or 5
    const screenPanels = [
      {
        x: sx,
        y: sy,
        w: sw,
        h: sh,
        seed: Math.floor(rng() * 1000000),
        sceneType: "",
      },
    ];

    while (screenPanels.length < targetPanels) {
      // Find panel with largest area to split
      let maxIdx = 0;
      let maxArea = screenPanels[0].w * screenPanels[0].h;
      for (let i = 1; i < screenPanels.length; i++) {
        const area = screenPanels[i].w * screenPanels[i].h;
        if (area > maxArea) {
          maxArea = area;
          maxIdx = i;
        }
      }

      const p = screenPanels.splice(maxIdx, 1)[0];
      const ratios = [0.42, 0.5, 0.58, 0.36, 0.64];
      const ratio = ratios[Math.floor(rng() * ratios.length)];

      const splitVertical =
        p.w / p.h > 1.25 ? true : p.h / p.w > 1.25 ? false : rng() > 0.5;

      if (splitVertical) {
        const w1 = Math.round(p.w * ratio - gutter * 0.5);
        const w2 = p.w - w1 - gutter;
        screenPanels.push({
          x: p.x,
          y: p.y,
          w: w1,
          h: p.h,
          seed: Math.floor(rng() * 1000000),
          sceneType: "",
        });
        screenPanels.push({
          x: p.x + w1 + gutter,
          y: p.y,
          w: w2,
          h: p.h,
          seed: Math.floor(rng() * 1000000),
          sceneType: "",
        });
      } else {
        const h1 = Math.round(p.h * ratio - gutter * 0.5);
        const h2 = p.h - h1 - gutter;
        screenPanels.push({
          x: p.x,
          y: p.y,
          w: p.w,
          h: h1,
          seed: Math.floor(rng() * 1000000),
          sceneType: "",
        });
        screenPanels.push({
          x: p.x,
          y: p.y + h1 + gutter,
          w: p.w,
          h: h2,
          seed: Math.floor(rng() * 1000000),
          sceneType: "",
        });
      }
    }

    // Sort screenPanels in standard comic reading order (top to bottom, left to right)
    screenPanels.sort((a, b) => {
      const rowA = Math.floor(a.y / (sh * 0.35));
      const rowB = Math.floor(b.y / (sh * 0.35));
      if (rowA !== rowB) return rowA - rowB;
      return a.x - b.x;
    });

    // Anti-repetition & text isolation:
    // Each screen gets AT MOST ONE text vignette (speech_bubble or starburst_explosion), never both!
    // This mathematically prevents two text scenes from being consecutive or adjacent on the same screen.
    const screenNonTextPool = shuffle(nonTextTypes);
    const hasText = rng() < 0.65;
    const textType = shuffledText[s % shuffledText.length];

    // Position the text vignette so it doesn't touch the bezel between screens
    let textSlot = Math.floor(rng() * screenPanels.length);
    if (s === 0 && textSlot === screenPanels.length - 1 && screenPanels.length > 1) {
      textSlot = Math.max(0, screenPanels.length - 2);
    } else if (s === 1 && textSlot === 0 && screenPanels.length > 1) {
      textSlot = 1;
    }

    let nonTextIdx = 0;
    for (let i = 0; i < screenPanels.length; i++) {
      if (hasText && i === textSlot) {
        screenPanels[i].sceneType = textType;
      } else {
        screenPanels[i].sceneType = screenNonTextPool[nonTextIdx % screenNonTextPool.length];
        nonTextIdx++;
      }
    }

    allPanels.push(...screenPanels);
  }

  return allPanels;
}

// ── Ben-Day Dot Halftone Shader ───────────────────────────────────────────────
function drawHalftoneDots(ctx, x, y, w, h, dotSpacing, dotColor, sampleFn) {
  ctx.save();
  ctx.fillStyle = dotColor;

  const cols = Math.ceil(w / dotSpacing);
  const rows = Math.ceil(h / dotSpacing);
  const maxRadius = dotSpacing * 0.52;

  ctx.beginPath();
  for (let r = 0; r <= rows; r++) {
    // Hexagonal staggered row offset for authentic screenprint look
    const rowOffset = (r % 2) * (dotSpacing * 0.5);
    const py = y + r * dotSpacing;
    if (py < y || py > y + h) continue;

    for (let c = -1; c <= cols; c++) {
      const px = x + c * dotSpacing + rowOffset;
      if (px < x || px > x + w) continue;

      const normX = (px - x) / w;
      const normY = (py - y) / h;
      const density = sampleFn(normX, normY);

      if (density > 0.04) {
        const rad = Math.min(maxRadius, maxRadius * Math.sqrt(density));
        ctx.moveTo(px + rad, py);
        ctx.arc(px, py, rad, 0, Math.PI * 2);
      }
    }
  }
  ctx.fill();
  ctx.restore();
}

// ── Scene 1: Alien Landscape & Dome City ──────────────────────────────────────
function renderLandscapeDome(ctx, p, time, pal, rng) {
  const { x, y, w, h, seed } = p;
  const pRng = createRNG(seed);

  // Sky background
  const hasDarkSky = pRng() > 0.35;
  ctx.fillStyle = hasDarkSky ? pal.ink : pal.paper;
  ctx.fillRect(x, y, w, h);

  // Stars in dark sky
  if (hasDarkSky) {
    ctx.fillStyle = pal.paper;
    const numStars = Math.floor(w * h * 0.0004);
    for (let i = 0; i < numStars; i++) {
      const sx = x + pRng() * w;
      const sy = y + pRng() * (h * 0.65);
      const sRad = pRng() > 0.9 ? 1.8 : 0.9;
      ctx.fillRect(sx, sy, sRad, sRad);
    }
  }

  // Falling meteors / rain streaks
  const meteorAngle = -0.45;
  const numMeteors = 6 + Math.floor(pRng() * 12);
  ctx.strokeStyle = hasDarkSky ? pal.colorA : pal.ink;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < numMeteors; i++) {
    const mx = x + ((pRng() * w * 1.5 + time * 40 * (0.8 + (i % 3) * 0.4)) % (w * 1.6)) - w * 0.3;
    const my = y + (pRng() * h * 0.55);
    const mLen = 14 + pRng() * 32;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + Math.cos(meteorAngle) * mLen, my - Math.sin(meteorAngle) * mLen);
    ctx.stroke();
  }

  // Layered mountain ridges (receding into the distance)
  const numLayers = 3 + Math.floor(pRng() * 2);
  const layerColors = [pal.colorA, pal.colorB, pal.paper, pal.ink];

  for (let l = 0; l < numLayers; l++) {
    const layerFrac = l / (numLayers - 1);
    const baseElevation = y + h * (0.45 + layerFrac * 0.45);
    const col = layerColors[l % layerColors.length];

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, baseElevation);

    const steps = 48;
    const freq = 3.5 + l * 2.0;
    const amp = (h * 0.16) * (1.0 - layerFrac * 0.4);

    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const px = x + u * w;
      const py = baseElevation + Math.sin(u * freq + l * 1.5) * amp + Math.sin(u * freq * 2.3 + l) * (amp * 0.45);
      ctx.lineTo(px, py);
    }

    ctx.lineTo(x + w, y + h);
    ctx.closePath();

    ctx.fillStyle = col;
    ctx.fill();

    // Outline
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.clip();

    // Halftone shading on alternating mountain layers
    if (l % 2 === 1) {
      drawHalftoneDots(ctx, x, y, w, h, 10, pal.ink, (nx, ny) => {
        return Math.max(0.0, Math.min(1.0, (ny - (0.45 + layerFrac * 0.45)) * 4.0));
      });
    }

    // Dome City in one of the foreground/midground valleys
    if (l === numLayers - 2) {
      const domeX = x + w * (0.35 + pRng() * 0.35);
      const domeY = baseElevation + 8;
      const domeRad = Math.min(w * 0.14, h * 0.18);

      // Translucent dome shell
      ctx.save();
      ctx.beginPath();
      ctx.arc(domeX, domeY, domeRad, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = pal.paper;
      ctx.fill();
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.clip();

      // Futuristic skyscraper bars inside dome
      ctx.fillStyle = pal.colorA;
      const numBldgs = 7;
      for (let b = 0; b < numBldgs; b++) {
        const bx = domeX - domeRad * 0.75 + (b / (numBldgs - 1)) * (domeRad * 1.5);
        const bH = domeRad * (0.3 + Math.sin(b * 1.7) * 0.35);
        const bW = domeRad * 0.14;
        ctx.fillRect(bx - bW * 0.5, domeY - bH, bW, bH);
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx - bW * 0.5, domeY - bH, bW, bH);
      }

      ctx.restore();
    }

    ctx.restore();
  }
}

// ── Scene 2: Giant Celestial Sphere & Planetary Rings ─────────────────────────
function renderPlanetOrbit(ctx, p, time, pal, rng) {
  const { x, y, w, h, seed } = p;
  const pRng = createRNG(seed);

  // Pitch black deep space
  ctx.fillStyle = pal.ink;
  ctx.fillRect(x, y, w, h);

  // Starfield
  ctx.fillStyle = pal.paper;
  const numStars = Math.floor(w * h * 0.0006);
  for (let i = 0; i < numStars; i++) {
    const sx = x + pRng() * w;
    const sy = y + pRng() * h;
    const sRad = pRng() > 0.92 ? 2.0 : 1.0;
    ctx.fillRect(sx, sy, sRad, sRad);
  }

  const cx = x + w * (0.35 + pRng() * 0.30);
  const cy = y + h * (0.35 + pRng() * 0.30);
  const planetRad = Math.min(w, h) * (0.28 + pRng() * 0.22);
  const planetCol = pRng() > 0.5 ? pal.colorB : pal.colorA;

  // Planetary rings (back half)
  const ringTilt = 0.32;
  const ringA = planetRad * 1.85;
  const ringB = planetRad * 0.55;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ringTilt);

  ctx.strokeStyle = pal.colorA;
  ctx.lineWidth = 2.4;
  for (let r = -2; r <= 2; r++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, ringA + r * 6, ringB + r * 2, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Planet body
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, planetRad, 0, Math.PI * 2);
  ctx.fillStyle = planetCol;
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.0;
  ctx.stroke();
  ctx.clip();

  // Ben-Day dot shadow gradient across sphere
  drawHalftoneDots(ctx, cx - planetRad, cy - planetRad, planetRad * 2, planetRad * 2, 9, pal.ink, (nx, ny) => {
    const dx = nx - 0.5;
    const dy = ny - 0.5;
    const distToCenter = Math.hypot(dx, dy) * 2.0;
    if (distToCenter > 1.0) return 0.0;
    // Light from top-left, shadow on bottom-right
    const shadowFactor = (dx * 0.75 + dy * 0.65) + 0.35;
    return Math.max(0.0, Math.min(1.0, shadowFactor * 1.6));
  });

  ctx.restore();

  // Planetary rings (front half, occluding the planet)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ringTilt);

  ctx.strokeStyle = pal.colorA;
  ctx.lineWidth = 2.4;
  for (let r = -2; r <= 2; r++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, ringA + r * 6, ringB + r * 2, 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.restore();

  // Small satellite moon
  const moonX = cx + Math.cos(time * 0.4 + seed) * (planetRad * 1.55);
  const moonY = cy + Math.sin(time * 0.4 + seed) * (planetRad * 0.75);
  ctx.beginPath();
  ctx.arc(moonX, moonY, planetRad * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = pal.paper;
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2.0;
  ctx.stroke();
}

// ── Scene 3: Topographic Sliced Metaball Artifact (User Request!) ─────────────
function renderMetaballArtifact(ctx, p, time, pal, rng) {
  const { x, y, w, h, seed } = p;
  const pRng = createRNG(seed);

  // Background: vintage parchment / dark slate
  ctx.fillStyle = pal.paper;
  ctx.fillRect(x, y, w, h);

  // Subtle star dots in background
  ctx.fillStyle = pal.shadowDot;
  for (let i = 0; i < 35; i++) {
    ctx.fillRect(x + pRng() * w, y + pRng() * h, 1.2, 1.2);
  }

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  const scale = Math.min(w, h) * 0.42;

  // Sliced contour isoline rings
  const numSlices = 14;
  const tAnim = time * 0.35 + seed;

  for (let s = numSlices; s >= 1; s--) {
    const sliceFrac = s / numSlices;
    const sliceY = cy + (s - numSlices * 0.5) * (scale * 0.09);
    const rad = scale * Math.sin(sliceFrac * Math.PI) * (0.85 + Math.sin(tAnim + s * 0.4) * 0.12);

    ctx.save();
    ctx.beginPath();

    const pts = 36;
    for (let i = 0; i <= pts; i++) {
      const angle = (i / pts) * Math.PI * 2;
      const wobble = 1.0 + 0.18 * Math.sin(angle * 3.0 + tAnim * 1.2 + s * 0.3)
                         + 0.12 * Math.cos(angle * 2.0 - tAnim * 0.8);
      const px = cx + Math.cos(angle) * (rad * wobble * 1.35);
      const py = sliceY + Math.sin(angle) * (rad * wobble * 0.65);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Card fill with cast shadow
    ctx.fillStyle = s % 2 === 0 ? pal.colorA : pal.colorB;
    ctx.fill();

    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.clip();

    // Ben-Day dot shading inside sliced card
    drawHalftoneDots(ctx, cx - scale * 1.5, sliceY - scale, scale * 3.0, scale * 2.0, 9, pal.ink, (nx, ny) => {
      return Math.max(0.0, Math.min(1.0, (1.0 - ny) * 1.5 - 0.2));
    });

    ctx.restore();
  }
}

// ── Scene 4: Cosmic Watercolor Cloud & Nebula Wash ────────────────────────────
function renderCosmicCloud(ctx, p, time, pal, rng) {
  const { x, y, w, h, seed } = p;
  const pRng = createRNG(seed);

  ctx.fillStyle = pal.ink;
  ctx.fillRect(x, y, w, h);

  // Background stars
  ctx.fillStyle = pal.paper;
  for (let i = 0; i < 50; i++) {
    ctx.fillRect(x + pRng() * w, y + pRng() * h, 1.2, 1.2);
  }

  // Giant puffy Kirby / Lichtenstein cloud
  const cloudY = y + h * 0.35;
  const cloudCol = pRng() > 0.5 ? pal.colorA : pal.colorB;

  ctx.save();
  ctx.beginPath();
  const numPuffs = 8;
  const puffW = w / numPuffs;

  ctx.moveTo(x - 20, y + h);
  ctx.lineTo(x - 20, cloudY);

  for (let i = 0; i < numPuffs; i++) {
    const puffX = x + i * puffW + puffW * 0.5;
    const puffRad = puffW * (0.65 + pRng() * 0.45);
    ctx.arc(puffX, cloudY - puffRad * 0.25, puffRad * 0.65, Math.PI, 0);
  }

  ctx.lineTo(x + w + 20, cloudY);
  ctx.lineTo(x + w + 20, y + h);
  ctx.closePath();

  ctx.fillStyle = cloudCol;
  ctx.fill();

  ctx.strokeStyle = pal.paper;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.clip();

  // Halftone screen along cloud underbelly
  drawHalftoneDots(ctx, x, y, w, h, 10, pal.ink, (nx, ny) => {
    return Math.max(0.0, Math.min(1.0, (ny - 0.30) * 2.8));
  });

  ctx.restore();

  // Sun / binary star on horizon
  const sunX = x + w * (0.3 + pRng() * 0.4);
  const sunY = cloudY - h * 0.12;
  const sunRad = Math.min(w, h) * 0.12;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunRad, 0, Math.PI * 2);
  ctx.fillStyle = pal.paper;
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2.0;
  ctx.stroke();
}

// ── Scene 5: Deep Stellar Void & Meteor Shower ────────────────────────────────
function renderVoidMeteors(ctx, p, time, pal, rng) {
  const { x, y, w, h, seed } = p;
  const pRng = createRNG(seed);

  ctx.fillStyle = pal.ink;
  ctx.fillRect(x, y, w, h);

  // Dense multi-tier stars
  const numStars = Math.floor(w * h * 0.0009);
  for (let i = 0; i < numStars; i++) {
    const sx = x + pRng() * w;
    const sy = y + pRng() * h;
    const isBright = pRng() > 0.95;
    ctx.fillStyle = isBright ? pal.colorA : (pRng() > 0.8 ? pal.colorB : pal.paper);
    const sRad = isBright ? 2.2 : 1.0;
    ctx.fillRect(sx, sy, sRad, sRad);
  }

  // Dynamic sweeping shooting stars
  const meteorAngle = 0.52;
  const numStreaks = 8;
  ctx.lineWidth = 1.6;

  for (let i = 0; i < numStreaks; i++) {
    const speed = 70 + (i % 4) * 35;
    const offset = (time * speed + i * 180 + seed) % (w * 1.8);
    const mx = x + offset - w * 0.3;
    const my = y + (i / numStreaks) * h;
    const len = 25 + (i % 3) * 30;

    ctx.strokeStyle = i % 2 === 0 ? pal.colorA : pal.colorB;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx - Math.cos(meteorAngle) * len, my - Math.sin(meteorAngle) * len);
    ctx.stroke();
  }

  // Solitary distant crescent
  const moonX = x + w * 0.78;
  const moonY = y + h * 0.28;
  const moonRad = Math.min(w, h) * 0.14;

  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRad, 0, Math.PI * 2);
  ctx.fillStyle = pal.paper;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(moonX + moonRad * 0.38, moonY, moonRad * 0.92, 0, Math.PI * 2);
  ctx.fillStyle = pal.ink;
  ctx.fill();
}

// ── Scene 6: Lone Speech Bubble with Comic Gibberish ──────────────────────────
function renderSpeechBubble(ctx, p, time, pal) {
  const { x, y, w, h, seed } = p;
  const pRng = createRNG(seed);

  // Background style: 0 = dynamic radiating burst rays, 1 = halftone paper, 2 = deep ink
  const bgStyle = Math.floor(pRng() * 3);
  const cx = x + w * 0.5;
  const cy = y + h * 0.48;

  if (bgStyle === 0) {
    ctx.fillStyle = pal.paper;
    ctx.fillRect(x, y, w, h);
    // Kinetic radiating speed rays from bubble center
    const numRays = 28;
    const maxR = Math.hypot(w, h);
    ctx.fillStyle = pal.colorB;
    ctx.beginPath();
    for (let i = 0; i < numRays; i += 2) {
      const a1 = (i / numRays) * Math.PI * 2 + time * 0.15;
      const a2 = ((i + 0.8) / numRays) * Math.PI * 2 + time * 0.15;
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR, a1, a2);
      ctx.closePath();
    }
    ctx.fill();
  } else if (bgStyle === 1) {
    ctx.fillStyle = pal.paper;
    ctx.fillRect(x, y, w, h);
    drawHalftoneDots(ctx, x, y, w, h, Math.max(7, w * 0.04), pal.colorA, (nx, ny) => {
      const d = Math.hypot(nx - 0.5, ny - 0.5);
      return Math.sin(d * 12 - time * 0.8) * 0.5 + 0.5;
    });
  } else {
    ctx.fillStyle = pal.ink;
    ctx.fillRect(x, y, w, h);
    // Starry backdrop
    const numStars = Math.floor(w * h * 0.0006);
    ctx.fillStyle = pal.paper;
    for (let i = 0; i < numStars; i++) {
      ctx.fillRect(x + pRng() * w, y + pRng() * h, 1.2, 1.2);
    }
  }

  // Comic Gibberish Text Phrases
  const gibberishPhrases = [
    ["#$@%*!?", "KRRZZT!!"],
    ["§44-Ω...", "TRANSMIT?"],
    ["BLIP... BLIP...", "NO SIGNAL!"],
    ["WHAT IN THE", "GREAT VOID?!"],
    ["▲ ◈ ◬ ◇ ◮", "⊚ ⨂ ⨁ !!"],
    ["BEEP-BOOP...", "ERROR 404"],
    ["ZOUNDS!", "THE ANOMALY!"],
    ["...CRACKLE...", "OVER & OUT."],
  ];
  const phrase = gibberishPhrases[Math.floor(pRng() * gibberishPhrases.length)];

  // Bubble dimensions
  const bw = Math.min(w * 0.82, Math.max(w * 0.65, 140));
  const bh = Math.min(h * 0.58, Math.max(h * 0.42, 70));
  const bx = cx - bw * 0.5;
  const by = cy - bh * 0.5;

  // Bubble style: 0 = rounded rectangular dialogue, 1 = jagged shout bubble, 2 = puffy thought cloud
  const bubbleType = Math.floor(pRng() * 3);

  // Shadow offset
  ctx.save();
  ctx.translate(5, 5);
  ctx.fillStyle = pal.ink;
  drawBubblePath(ctx, bx, by, bw, bh, bubbleType, pRng);
  ctx.fill();
  ctx.restore();

  // White/Paper Bubble Body
  ctx.fillStyle = pal.paper;
  drawBubblePath(ctx, bx, by, bw, bh, bubbleType, pRng);
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  // Dialogue tail pointing down-left
  const tailX = bx + bw * 0.28;
  const tailY = by + bh;
  ctx.beginPath();
  ctx.moveTo(tailX - 12, tailY - 2);
  ctx.lineTo(tailX - 25, tailY + Math.min(26, h * 0.16));
  ctx.lineTo(tailX + 8, tailY - 2);
  ctx.closePath();
  ctx.fillStyle = pal.paper;
  ctx.fill();
  ctx.stroke();

  // Clean boundary join
  ctx.beginPath();
  ctx.moveTo(tailX - 10, tailY - 2);
  ctx.lineTo(tailX + 6, tailY - 2);
  ctx.strokeStyle = pal.paper;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Pure asemic alien symbols and grawlix glyphs (ZERO readable English words)
  const asemicGlyphs = [
    "◬", "◈", "◭", "◇", "◮", "⊚", "⨂", "⨁", "☍", "∾", "⍝", "⌬",
    "≋", "⍲", "⎎", "⌗", "⍟", "§", "≈", "∿", "҂", "☿", "♄", "⚝",
    "#", "$", "%", "@", "&", "!", "?", "¡", "‼",
  ];

  const asemicStyle = pRng() > 0.45 ? "script" : "glyphs";

  if (asemicStyle === "script") {
    // Procedural cursive asemic calligraphy: undulating loops, minims, ascenders & descenders
    ctx.save();
    ctx.strokeStyle = pal.ink;
    ctx.fillStyle = pal.ink;
    ctx.lineWidth = Math.max(1.8, Math.min(2.8, bh * 0.038));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const linesCount = bh > 110 ? 3 : 2;
    const startY = cy - (linesCount - 1) * bh * 0.17;
    const lineW = bw * 0.74;

    for (let l = 0; l < linesCount; l++) {
      const baseLineY = startY + l * bh * 0.34;
      const leftX = cx - lineW * 0.5;
      let currX = leftX;

      const numWords = 2 + Math.floor(pRng() * 3);
      const wordGap = lineW / (numWords * 4.5);

      for (let wIdx = 0; wIdx < numWords; wIdx++) {
        const wordLen = (lineW - (numWords - 1) * wordGap) / numWords;
        const numStrokes = 4 + Math.floor(pRng() * 5);
        const stepX = wordLen / numStrokes;

        ctx.beginPath();
        ctx.moveTo(currX, baseLineY);

        for (let s = 0; s < numStrokes; s++) {
          const sx = currX + s * stepX;
          const strokeType = pRng();

          if (strokeType < 0.25) {
            // Tall ascender loop
            ctx.quadraticCurveTo(sx + stepX * 0.3, baseLineY - bh * 0.15, sx + stepX * 0.6, baseLineY - bh * 0.11);
            ctx.quadraticCurveTo(sx + stepX * 0.9, baseLineY, sx + stepX, baseLineY);
          } else if (strokeType < 0.45) {
            // Descender hook
            ctx.quadraticCurveTo(sx + stepX * 0.4, baseLineY + bh * 0.14, sx + stepX * 0.7, baseLineY + bh * 0.10);
            ctx.quadraticCurveTo(sx + stepX * 0.9, baseLineY, sx + stepX, baseLineY);
          } else if (strokeType < 0.75) {
            // Sharp minim wave
            ctx.quadraticCurveTo(sx + stepX * 0.5, baseLineY - bh * 0.07, sx + stepX, baseLineY);
          } else {
            // Cursive loop-de-loop
            ctx.bezierCurveTo(
              sx + stepX * 0.8, baseLineY - bh * 0.10,
              sx + stepX * 0.2, baseLineY - bh * 0.10,
              sx + stepX, baseLineY
            );
          }
        }
        ctx.stroke();

        // Occasional floating diacritical dot or accent tick
        if (pRng() > 0.42) {
          ctx.beginPath();
          ctx.arc(currX + wordLen * 0.5, baseLineY - bh * 0.13, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }

        currX += wordLen + wordGap;
      }
    }
    ctx.restore();
  } else {
    // Glyphic Asemic alien text
    const linesCount = bh > 105 ? 3 : 2;
    const lines = [];
    for (let l = 0; l < linesCount; l++) {
      const numWords = 2 + Math.floor(pRng() * 2);
      let lineStr = "";
      for (let wIdx = 0; wIdx < numWords; wIdx++) {
        const wordChars = 3 + Math.floor(pRng() * 4);
        let word = "";
        for (let c = 0; c < wordChars; c++) {
          word += asemicGlyphs[Math.floor(pRng() * asemicGlyphs.length)];
        }
        lineStr += (wIdx > 0 ? " " : "") + word;
      }
      lines.push(lineStr);
    }

    ctx.fillStyle = pal.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const fontSize = Math.max(12, Math.min(22, Math.round(bh * 0.21)));
    ctx.font = `bold ${fontSize}px "Segoe UI Symbol", "Apple Symbols", "Arial Black", monospace, sans-serif`;

    const lineSpacing = fontSize * 1.38;
    const startY = cy - ((linesCount - 1) * lineSpacing) * 0.5;

    for (let l = 0; l < lines.length; l++) {
      ctx.fillText(lines[l], cx, startY + l * lineSpacing);
    }
  }
}

function drawBubblePath(ctx, bx, by, bw, bh, type, pRng) {
  ctx.beginPath();
  if (type === 1) {
    // Jagged shout bubble
    const spikes = 14;
    const cx = bx + bw * 0.5;
    const cy = by + bh * 0.5;
    const rx = bw * 0.5;
    const ry = bh * 0.5;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const nextA = ((i + 0.5) / spikes) * Math.PI * 2;
      const rOuter = 1.15;
      const rInner = 0.88;
      const x1 = cx + Math.cos(a) * rx * rOuter;
      const y1 = cy + Math.sin(a) * ry * rOuter;
      const x2 = cx + Math.cos(nextA) * rx * rInner;
      const y2 = cy + Math.sin(nextA) * ry * rInner;
      if (i === 0) ctx.moveTo(x1, y1);
      else ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
  } else {
    // Smooth rounded dialogue box
    const rad = Math.min(bw, bh) * 0.25;
    ctx.roundRect(bx, by, bw, bh, rad);
  }
}

// ── Scene 7: Batman KAPOW! / Starburst Explosion ──────────────────────────────
function renderStarburstExplosion(ctx, p, time, pal) {
  const { x, y, w, h, seed } = p;
  const pRng = createRNG(seed);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Background: Dark deep space or action lines
  ctx.fillStyle = pal.ink;
  ctx.fillRect(x, y, w, h);

  // Dynamic radiating shockwave streaks
  const numShock = 20;
  ctx.save();
  ctx.lineWidth = 1.8;
  for (let i = 0; i < numShock; i++) {
    const a = (i / numShock) * Math.PI * 2 + time * 0.08;
    const len1 = Math.min(w, h) * (0.35 + (i % 3) * 0.1);
    const len2 = len1 + 25 + (i % 4) * 15;
    ctx.strokeStyle = i % 2 === 0 ? pal.colorA : pal.colorB;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * len1, cy + Math.sin(a) * len1);
    ctx.lineTo(cx + Math.cos(a) * len2, cy + Math.sin(a) * len2);
    ctx.stroke();
  }
  ctx.restore();

  // Multi-tier jagged explosion burst
  const maxRadius = Math.min(w, h) * 0.42;

  function drawJaggedStar(radius, points, inset, rot) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? radius : radius * inset;
      const angle = (i / (points * 2)) * Math.PI * 2 + rot;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // 1. Outer burst in colorA
  ctx.fillStyle = pal.colorA;
  drawJaggedStar(maxRadius, 16, 0.65, time * 0.12);
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.0;
  ctx.stroke();

  // 2. Mid burst in colorB
  ctx.fillStyle = pal.colorB;
  drawJaggedStar(maxRadius * 0.76, 14, 0.6, -time * 0.18 + 0.3);
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 3. Inner burst in paper
  ctx.fillStyle = pal.paper;
  drawJaggedStar(maxRadius * 0.48, 12, 0.58, time * 0.25 + 0.7);
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Flying fiery particles
  const numSparks = 18;
  for (let i = 0; i < numSparks; i++) {
    const spAngle = (i / numSparks) * Math.PI * 2 + (seed % 100);
    const spDist = maxRadius * (0.85 + (i % 4) * 0.25 + Math.sin(time * 3 + i) * 0.08);
    const sx = cx + Math.cos(spAngle) * spDist;
    const sy = cy + Math.sin(spAngle) * spDist;
    ctx.fillStyle = i % 2 === 0 ? pal.colorA : pal.colorB;
    ctx.beginPath();
    ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Onomatopoeia comic words
  const words = ["KAPOW!", "KABOOM!", "ZAP!", "WHAM!", "CRASH!", "BLAM!"];
  const word = words[Math.floor(pRng() * words.length)];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.18 + Math.sin(time * 2.5) * 0.04);

  const textSize = Math.max(22, Math.min(54, Math.round(maxRadius * 0.58)));
  ctx.font = `900 ${textSize}px "Impact", "Arial Black", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Heavy 3D Drop Shadow
  ctx.fillStyle = pal.ink;
  ctx.fillText(word, 6, 6);

  // Bold Yellow/Paper Fill with Thick Ink Stroke
  ctx.fillStyle = pal.paper;
  ctx.fillText(word, 0, 0);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 4.0;
  ctx.strokeText(word, 0, 0);

  ctx.restore();
}

// ── Scene 8: Solar System Orrery from Above ───────────────────────────────────
function renderSolarOrrery(ctx, p, time, pal) {
  const { x, y, w, h, seed } = p;
  const pRng = createRNG(seed);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  const maxR = Math.min(w, h) * 0.44;

  // Background: Deep ink space with blueprint technical grid
  ctx.fillStyle = pal.ink;
  ctx.fillRect(x, y, w, h);

  // Technical coordinate crosshairs
  ctx.save();
  ctx.strokeStyle = pal.paper;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(x + w, cy);
  ctx.moveTo(cx, y);
  ctx.lineTo(cx, y + h);
  ctx.stroke();

  // Radial degree tick marks around outer perimeter
  const numTicks = 36;
  for (let i = 0; i < numTicks; i++) {
    const a = (i / numTicks) * Math.PI * 2;
    const r1 = maxR * 0.95;
    const r2 = i % 9 === 0 ? maxR * 1.05 : maxR * 0.98;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }
  ctx.restore();

  // Central Sun
  const sunR = Math.min(w, h) * 0.085;
  ctx.save();
  // Sun corona rays
  ctx.fillStyle = pal.colorB;
  const numRays = 12;
  for (let i = 0; i < numRays; i++) {
    const a = (i / numRays) * Math.PI * 2 + time * 0.2;
    const rayLen = sunR * (1.25 + Math.sin(time * 3 + i) * 0.15);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rayLen, cy + Math.sin(a) * rayLen, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glowing sun body
  ctx.fillStyle = pal.colorA;
  ctx.beginPath();
  ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.paper;
  ctx.lineWidth = 2.0;
  ctx.stroke();
  ctx.restore();

  // Orbiting Planets (Keplerian orbits)
  const orbits = [
    { r: maxR * 0.28, speed: 1.20, color: pal.paper, size: 5, moon: false },
    { r: maxR * 0.46, speed: 0.85, color: pal.colorB, size: 7.5, moon: true },
    { r: maxR * 0.68, speed: 0.55, color: pal.colorA, size: 9, ring: true },
    { r: maxR * 0.90, speed: 0.35, color: pal.paper, size: 6.5, moon: false },
  ];

  ctx.save();
  orbits.forEach((orb, idx) => {
    // Elliptical dashed orbit path
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = pal.paper;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, orb.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1.0;

    // Planet position along orbit
    const baseAngle = (seed * (idx + 1) * 1.3) % (Math.PI * 2);
    const angle = baseAngle + time * orb.speed * 0.45;
    const px = cx + Math.cos(angle) * orb.r;
    const py = cy + Math.sin(angle) * orb.r;

    // Saturn-style planetary ring
    if (orb.ring) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(0.4);
      ctx.strokeStyle = pal.colorB;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, orb.size * 2.2, orb.size * 0.75, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Planet disc
    ctx.fillStyle = orb.color;
    ctx.beginPath();
    ctx.arc(px, py, orb.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Satellite moon
    if (orb.moon) {
      const moonAngle = time * 2.8 + idx;
      const moonDist = orb.size * 2.1;
      const mx = px + Math.cos(moonAngle) * moonDist;
      const my = py + Math.sin(moonAngle) * moonDist;
      ctx.fillStyle = pal.paper;
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
}

// ── Scene 9: Tintin Moon Rocket with Checkers & Vent Flow ─────────────────────
function renderTintinRocket(ctx, p, time, pal) {
  const { x, y, w, h, seed } = p;
  const pRng = createRNG(seed);

  // Background: Space sky with stars
  ctx.fillStyle = pal.ink;
  ctx.fillRect(x, y, w, h);

  // Distant stars
  const numStars = Math.floor(w * h * 0.0006);
  ctx.fillStyle = pal.paper;
  for (let i = 0; i < numStars; i++) {
    ctx.fillRect(x + pRng() * w, y + pRng() * h, 1.2, 1.2);
  }

  // Distant celestial body (Red Moon or Alien Crater)
  const moonX = x + w * 0.82;
  const moonY = y + h * 0.22;
  const moonR = Math.min(w, h) * 0.16;
  ctx.fillStyle = pal.colorA;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.paper;
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // Rocket Center & Scaling
  const rcx = x + w * 0.45;
  const rcy = y + h * 0.52 + Math.sin(time * 1.5) * 6; // gentle levitation float
  const scale = Math.min(w / 380, h / 380) * 1.2;

  ctx.save();
  ctx.translate(rcx, rcy);
  // Slanted flight angle (ascending slightly rightward)
  ctx.rotate(-0.24);

  // 1. Billowing Engine Exhaust & Vent Flow Streamers (rendered behind rocket)
  const exhaustFlow = (time * 120) % 60;
  for (let i = 0; i < 7; i++) {
    const puffY = 110 + i * 28 + exhaustFlow;
    const puffW = 20 + i * 14;
    const puffOffset = Math.sin(time * 4 + i) * (8 + i * 4);
    ctx.fillStyle = i % 2 === 0 ? pal.paper : pal.colorB;
    ctx.beginPath();
    ctx.ellipse(puffOffset, puffY * scale, puffW * scale, 16 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.paper;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Fiery rocket thrust nozzle jet
  ctx.fillStyle = pal.colorA;
  ctx.beginPath();
  ctx.moveTo(-16 * scale, 95 * scale);
  ctx.lineTo(0, (140 + Math.sin(time * 18) * 15) * scale);
  ctx.lineTo(16 * scale, 95 * scale);
  ctx.closePath();
  ctx.fill();

  // 2. Tintin Checkered Fuselage Body
  const bodyW = 34 * scale;
  const bodyH = 140 * scale;
  const topY = -80 * scale;
  const bottomY = topY + bodyH;

  // Fuselage outline path (bullet/cigar aerodynamic shape)
  function rocketPath() {
    ctx.beginPath();
    ctx.moveTo(0, topY - 30 * scale); // Sharp nose needle tip
    ctx.quadraticCurveTo(bodyW * 1.35, topY + 40 * scale, bodyW, bottomY);
    ctx.lineTo(-bodyW, bottomY);
    ctx.quadraticCurveTo(-bodyW * 1.35, topY + 40 * scale, 0, topY - 30 * scale);
    ctx.closePath();
  }

  // Clip to fuselage for iconic red & white checkerboard pattern
  ctx.save();
  rocketPath();
  ctx.clip();

  // Base white coat
  ctx.fillStyle = pal.paper;
  ctx.fillRect(-bodyW * 2, topY - 40 * scale, bodyW * 4, bodyH + 80 * scale);

  // Checkered grid bands
  const numRows = 7;
  const numCols = 4;
  const rowH = bodyH / numRows;
  const colW = (bodyW * 2) / numCols;

  ctx.fillStyle = pal.colorA; // Hergé Red Checkers
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if ((r + c) % 2 === 0) {
        ctx.fillRect(-bodyW + c * colW, topY + r * rowH, colW, rowH);
      }
    }
  }

  // Subtle curved 3D shadow across right edge
  ctx.fillStyle = pal.ink;
  ctx.globalAlpha = 0.28;
  ctx.fillRect(bodyW * 0.3, topY - 40 * scale, bodyW * 1.5, bodyH + 80 * scale);
  ctx.restore();

  // Rocket Body Outline
  rocketPath();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  // Needle antenna on tip
  ctx.strokeStyle = pal.paper;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, topY - 30 * scale);
  ctx.lineTo(0, topY - 50 * scale);
  ctx.stroke();
  ctx.fillStyle = pal.colorA;
  ctx.beginPath();
  ctx.arc(0, topY - 50 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // 3. Three Swept-back Arched Landing Legs / Fins with Foot Pods
  // Center fin
  ctx.fillStyle = pal.colorA;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3.0;

  // Left swept fin
  ctx.beginPath();
  ctx.moveTo(-bodyW * 0.8, bottomY - 35 * scale);
  ctx.quadraticCurveTo(-bodyW * 2.6, bottomY + 15 * scale, -bodyW * 2.2, bottomY + 45 * scale);
  ctx.lineTo(-bodyW * 1.7, bottomY + 45 * scale);
  ctx.quadraticCurveTo(-bodyW * 1.7, bottomY + 15 * scale, -bodyW * 0.7, bottomY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Left foot pod
  ctx.fillStyle = pal.paper;
  ctx.beginPath();
  ctx.ellipse(-bodyW * 1.95, bottomY + 45 * scale, 9 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Right swept fin
  ctx.fillStyle = pal.colorA;
  ctx.beginPath();
  ctx.moveTo(bodyW * 0.8, bottomY - 35 * scale);
  ctx.quadraticCurveTo(bodyW * 2.6, bottomY + 15 * scale, bodyW * 2.2, bottomY + 45 * scale);
  ctx.lineTo(bodyW * 1.7, bottomY + 45 * scale);
  ctx.quadraticCurveTo(bodyW * 1.7, bottomY + 15 * scale, bodyW * 0.7, bottomY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Right foot pod
  ctx.fillStyle = pal.paper;
  ctx.beginPath();
  ctx.ellipse(bodyW * 1.95, bottomY + 45 * scale, 9 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Front center fin
  ctx.fillStyle = pal.colorA;
  ctx.beginPath();
  ctx.moveTo(-6 * scale, bottomY - 25 * scale);
  ctx.lineTo(6 * scale, bottomY - 25 * scale);
  ctx.lineTo(9 * scale, bottomY + 42 * scale);
  ctx.lineTo(-9 * scale, bottomY + 42 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Center foot pod
  ctx.fillStyle = pal.paper;
  ctx.beginPath();
  ctx.ellipse(0, bottomY + 43 * scale, 11 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 4. Circular Porthole Window with Glass Glint
  const portY = topY + 38 * scale;
  const portR = 12 * scale;
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.arc(0, portY, portR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.paper;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Glass reflection glint
  ctx.strokeStyle = pal.colorB;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(0, portY, portR * 0.65, -1.8, -0.4);
  ctx.stroke();

  ctx.restore();
}

// ── Main Page Draw Call ───────────────────────────────────────────────────────
function drawComicPage(simTime) {
  const pal = PALETTES[paletteIdx];

  // Background Paper Texture for gutters and page border
  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Total panoramic width across all displays
  const totalVirtualW = canvas.width * totalScreens;
  const offsetX = screenIndex * canvas.width;

  // Save context and translate for current screen
  ctx.save();
  ctx.translate(-offsetX, 0);

  // Draw each panel in the layout
  for (let i = 0; i < layoutPanels.length; i++) {
    const p = layoutPanels[i];

    // Frustum cull panels outside current screen
    if (p.x + p.w < offsetX - 10 || p.x > offsetX + canvas.width + 10) {
      continue;
    }

    ctx.save();

    // Clip to panel interior (excluding outer border)
    ctx.beginPath();
    ctx.rect(p.x, p.y, p.w, p.h);
    ctx.clip();

    // Render modular scene archetype
    switch (p.sceneType) {
      case "landscape_dome":
        renderLandscapeDome(ctx, p, simTime, pal);
        break;
      case "planet_orbit":
        renderPlanetOrbit(ctx, p, simTime, pal);
        break;
      case "metaball_artifact":
        renderMetaballArtifact(ctx, p, simTime, pal);
        break;
      case "cosmic_cloud":
        renderCosmicCloud(ctx, p, simTime, pal);
        break;
      case "void_meteors":
        renderVoidMeteors(ctx, p, simTime, pal);
        break;
      case "speech_bubble":
        renderSpeechBubble(ctx, p, simTime, pal);
        break;
      case "starburst_explosion":
        renderStarburstExplosion(ctx, p, simTime, pal);
        break;
      case "solar_orrery":
        renderSolarOrrery(ctx, p, simTime, pal);
        break;
      case "tintin_rocket":
        renderTintinRocket(ctx, p, simTime, pal);
        break;
      default:
        renderVoidMeteors(ctx, p, simTime, pal);
        break;
    }

    ctx.restore();

    // Crisp black ink border around panel box
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 3.0;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }

  // Dual-screen bezel line guide (if enabled)
  if (showBezel > 0.5) {
    ctx.strokeStyle = "#ff4411";
    ctx.lineWidth = 3.0;
    for (let s = 1; s < totalScreens; s++) {
      const bx = s * canvas.width;
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx, canvas.height);
      ctx.stroke();
    }
  }

  ctx.restore();

  // Tactile newsprint paper texture overlay across whole page & gutters
  const pat = getPaperPattern();
  if (pat) {
    ctx.save();
    ctx.fillStyle = pat;
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

// ── Resize ────────────────────────────────────────────────────────────────────
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Re-generate layout matching the current total display dimension
  layoutPanels = generateComicLayout(canvas.width * totalScreens, canvas.height, storySeed);
}
window.addEventListener("resize", resize);
resize();

// ── Animation Loop ──────────────────────────────────────────────────────────
function loop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const dt = Math.min((timestamp - lastTimestamp) * 0.001, 0.05);
  lastTimestamp = timestamp;

  if (!paused) {
    chapterTime += dt;
  }

  // Auto-advance to a new comic chapter every 45 seconds
  if (isPrimary && Math.floor(chapterTime / 45.0) !== Math.floor((chapterTime - dt) / 45.0)) {
    storySeed = (storySeed * 1664525 + 1013904223) >>> 0;
    paletteIdx = (paletteIdx + 1) % PALETTES.length;
    layoutPanels = generateComicLayout(canvas.width * totalScreens, canvas.height, storySeed);
    bc.postMessage({
      cmd: "chapter",
      storySeed,
      chapterTime,
      paletteIdx,
    });
  }

  // Periodic heartbeat sync
  if (isPrimary && Math.floor(chapterTime * 4) !== Math.floor((chapterTime - dt) * 4)) {
    bc.postMessage({
      cmd: "heartbeat",
      storySeed,
      chapterTime,
      paletteIdx,
      paused,
      showBezel,
    });
  }

  drawComicPage(chapterTime);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// ── BroadcastChannel Message Handler ──────────────────────────────────────────
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
      storySeed,
      chapterTime,
      paletteIdx,
      paused,
      showBezel,
    });
    return;
  }
  if (data.cmd === "heartbeat" && !isPrimary) {
    if (storySeed !== data.storySeed) {
      storySeed = data.storySeed;
      layoutPanels = generateComicLayout(canvas.width * totalScreens, canvas.height, storySeed);
    }
    chapterTime = data.chapterTime;
    paletteIdx = data.paletteIdx;
    paused = data.paused;
    showBezel = data.showBezel;
    return;
  }
  if (data.cmd === "chapter") {
    storySeed = data.storySeed;
    chapterTime = data.chapterTime;
    if (data.paletteIdx !== undefined) paletteIdx = data.paletteIdx;
    layoutPanels = generateComicLayout(canvas.width * totalScreens, canvas.height, storySeed);
    return;
  }
  if (data.cmd === "palette") {
    paletteIdx = data.paletteIdx;
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

// ── Keyboard Shortcuts ────────────────────────────────────────────────────────
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
    // Generate new chapter immediately with next palette
    storySeed = Math.floor(Math.random() * 10000000);
    paletteIdx = (paletteIdx + 1) % PALETTES.length;
    layoutPanels = generateComicLayout(canvas.width * totalScreens, canvas.height, storySeed);
    bc.postMessage({
      cmd: "chapter",
      storySeed,
      chapterTime,
      paletteIdx,
    });
    return;
  }
  if (e.key === "p" || e.key === "P") {
    paused = !paused;
    bc.postMessage({ cmd: "pause", paused });
    return;
  }
  if (e.key === "c" || e.key === "C") {
    paletteIdx = (paletteIdx + 1) % PALETTES.length;
    bc.postMessage({ cmd: "palette", paletteIdx });
    return;
  }
  if (e.key === "b" || e.key === "B") {
    showBezel = showBezel > 0.5 ? 0.0 : 1.0;
    bc.postMessage({ cmd: "bezel", showBezel });
    return;
  }
});

// Click to generate next chapter or enter fullscreen
canvas.addEventListener("click", (e) => {
  storySeed = Math.floor(Math.random() * 10000000);
  paletteIdx = (paletteIdx + 1) % PALETTES.length;
  layoutPanels = generateComicLayout(canvas.width * totalScreens, canvas.height, storySeed);
  bc.postMessage({
    cmd: "chapter",
    storySeed,
    chapterTime,
    paletteIdx,
  });

  const el = document.documentElement;
  if (!document.fullscreenElement) {
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }
});
