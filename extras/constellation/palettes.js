// Antique Intaglio Palettes, Laid-Paper Texture, and Aquatint Granulation Filter
// Matching the 17th-century copperplate printmaking style of Etching

const PALETTES = [
  {
    name: "Prussian Blue",
    paper: "#f4eedb",      // Warm antique cream laid paper
    ink: "#122438",        // Deep intaglio Prussian blue
    gridColor: "rgba(18, 36, 56, 0.22)",
    accentInk: "#1d3a5a",
  },
  {
    name: "Carbon Lamp Black",
    paper: "#f2ede0",      // Antique ivory paper
    ink: "#151413",        // Deep carbon black
    gridColor: "rgba(21, 20, 19, 0.20)",
    accentInk: "#282624",
  },
  {
    name: "Roasted Sepia",
    paper: "#ede0cc",      // Warm beige parchment
    ink: "#2c170d",        // Dark roasted sepia
    gridColor: "rgba(44, 23, 13, 0.22)",
    accentInk: "#422517",
  },
  {
    name: "Alpine Pine",
    paper: "#eaf0e6",      // Pale sage laid paper
    ink: "#0e2417",        // Deep forest pine
    gridColor: "rgba(14, 36, 23, 0.22)",
    accentInk: "#1a402a",
  },
  {
    name: "Venetian Terracotta",
    paper: "#faede2",      // Warm peach laid paper
    ink: "#381710",        // Burnt sienna copper
    gridColor: "rgba(56, 23, 16, 0.22)",
    accentInk: "#52251a",
  },
  {
    name: "Cyanotype Blueprint",
    paper: "#020a1e",      // Deep architectural cyanotype midnight blue
    ink: "#ffffff",        // Crisp drafting white/silver
    gridColor: "rgba(255, 255, 255, 0.25)",
    accentInk: "#d4e6ff",
    isDark: true,
  },
];

// Procedural Laid-Paper Texture Pattern
const paperCanvas = document.createElement("canvas");
paperCanvas.width = 256;
paperCanvas.height = 256;
const pCtx = paperCanvas.getContext("2d");

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
function getLaidPattern(ctx) {
  if (!laidPattern && ctx) {
    laidPattern = ctx.createPattern(paperCanvas, "repeat");
  }
  return laidPattern;
}

// Deterministic Aquatint Rosin Granulation
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

if (typeof globalThis !== "undefined") {
  globalThis.PALETTES = PALETTES;
  globalThis.getLaidPattern = getLaidPattern;
  globalThis.applyAquatintGrain = applyAquatintGrain;
}
