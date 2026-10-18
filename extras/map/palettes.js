// Fantasy Cartography Palettes, Parchment Texture & Watercolor Washes

const MAP_PALETTES = [
  {
    name: "Classic Cartography (Panel 2)",
    paper: "#e7d8be",       // Warm tea-stained antique parchment
    ink: "#2c1c0f",         // Deep walnut gall ink
    inkFaint: "rgba(44, 28, 15, 0.45)",
    shadowWash: "rgba(102, 68, 38, 0.38)", // Raw umber watercolor wash
    deepShadow: "rgba(68, 42, 22, 0.50)",  // Deep crevice glaze
    highlightWash: "rgba(255, 245, 220, 0.25)",
    ridgeFill: "#e2d2b6",
  },
  {
    name: "Golden Highlands (Panel 3)",
    paper: "#eadbc2",       // Aged vellum
    ink: "#28170c",         // Burnt umber ink
    inkFaint: "rgba(40, 23, 12, 0.40)",
    shadowWash: "rgba(125, 82, 38, 0.42)",  // Warm golden-brown wash
    deepShadow: "rgba(75, 45, 18, 0.56)",
    highlightWash: "rgba(248, 220, 130, 0.35)", // Golden sunlit crest highlight
    ridgeFill: "#e4d4b9",
  },
  {
    name: "Glacial Slate (Panel 4)",
    paper: "#e4ded2",       // Pale cool parchment
    ink: "#1c222b",         // Deep slate black ink
    inkFaint: "rgba(28, 34, 43, 0.40)",
    shadowWash: "rgba(65, 82, 115, 0.38)",  // Atmospheric indigo/slate-blue shadow
    deepShadow: "rgba(35, 48, 72, 0.52)",
    highlightWash: "rgba(245, 250, 255, 0.45)", // Frosty snowy crest highlight
    ridgeFill: "#ded8cc",
  },
  {
    name: "Archival Pen & Ink (Panel 1)",
    paper: "#f0e6d2",       // Natural laid paper
    ink: "#181412",         // Carbon drafting ink
    inkFaint: "rgba(24, 20, 18, 0.40)",
    shadowWash: "rgba(80, 70, 60, 0.22)",   // Subtle monochrome wash
    deepShadow: "rgba(40, 32, 26, 0.36)",
    highlightWash: "rgba(255, 255, 255, 0.20)",
    ridgeFill: "#ebe0ca",
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

function getMapPaperPattern(ctx) {
  return getLaidPattern(ctx);
}

function applyAquatintGrain(targetCtx, w, h, amount, seed) {
  const imgData = targetCtx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const getRNG = typeof createRNG !== "undefined" ? createRNG : ((s) => Math.random);
  const rng = getRNG(seed ^ 0x9e3779b9);
  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    const n = (rng() - 0.5) * (amount * 2);
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  targetCtx.putImageData(imgData, 0, 0);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MAP_PALETTES, getMapPaperPattern, getLaidPattern, applyAquatintGrain };
}
