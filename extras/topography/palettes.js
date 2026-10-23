// Modern Orographic & Precision Topographic Survey Palettes

const TOPOGRAPHY_PALETTES = [
  {
    name: "Modern Precision Orographic",
    paper: "#fcfbf8",          // Clean neutral geodetic paper
    ink: "#202226",            // Charcoal drafting ink
    inkFaint: "rgba(32, 34, 38, 0.45)",
    indexContour: "#68482d",   // Warm bistre index contour
    contour: "rgba(130, 96, 65, 0.78)", // Warm bistre contour
    shadowWash: "rgba(55, 68, 85, 0.22)", // Subtle slate relief hillshade
    deepShadow: "rgba(28, 38, 52, 0.36)",
    highlightWash: "rgba(255, 255, 255, 0.45)", // Snow highlight
    waterWash: "rgba(142, 192, 214, 0.45)", // Glacial lake cyan (#8ec0d6)
    waterLine: "rgba(45, 115, 155, 0.65)",
    hachure: "rgba(105, 80, 55, 0.50)",
    isDark: false,
    isModern: true,
  },
  {
    name: "Highland Sienna (Survey Series)",
    paper: "#f8f7f2",          // Crisp survey bond
    ink: "#1a1a1c",            // Pure drafting carbon
    inkFaint: "rgba(26, 26, 28, 0.40)",
    indexContour: "#784421",   // Rich sienna index contour
    contour: "rgba(145, 90, 52, 0.75)", // Intermediate sienna contour
    shadowWash: "rgba(75, 80, 85, 0.22)",
    deepShadow: "rgba(38, 42, 48, 0.38)",
    highlightWash: "rgba(255, 255, 255, 0.45)",
    waterWash: "rgba(125, 180, 205, 0.45)", // Sapphire tarn wash
    waterLine: "rgba(30, 100, 140, 0.65)",
    hachure: "rgba(120, 70, 35, 0.50)",
    isDark: false,
    isModern: true,
  },
  {
    name: "Boreal Geodetic (Slate & Ice)",
    paper: "#f1f4f6",          // Cool Scandinavian survey white
    ink: "#18202a",            // Deep Arctic charcoal
    inkFaint: "rgba(24, 32, 42, 0.40)",
    indexContour: "#2a3848",   // Arctic slate index
    contour: "rgba(55, 75, 95, 0.75)", // Fine glacial contour
    shadowWash: "rgba(40, 60, 85, 0.25)",
    deepShadow: "rgba(20, 35, 55, 0.40)",
    highlightWash: "rgba(255, 255, 255, 0.55)",
    waterWash: "rgba(110, 165, 190, 0.50)", // Deep fjord blue
    waterLine: "rgba(35, 90, 125, 0.70)",
    hachure: "rgba(45, 65, 85, 0.50)",
    isDark: false,
    isModern: true,
  },
  {
    name: "Minimalist Architectural CAD",
    paper: "#ffffff",          // Pure technical drafting white
    ink: "#141416",            // Deep graphite black
    inkFaint: "rgba(20, 20, 22, 0.35)",
    indexContour: "#141416",
    contour: "rgba(40, 40, 45, 0.72)",
    shadowWash: "rgba(0, 0, 0, 0.16)",
    deepShadow: "rgba(0, 0, 0, 0.30)",
    highlightWash: "rgba(255, 255, 255, 0.65)",
    waterWash: "rgba(0, 0, 0, 0.08)",
    waterLine: "rgba(0, 0, 0, 0.45)",
    hachure: "rgba(30, 30, 35, 0.50)",
    isDark: false,
    isModern: true,
  },
  {
    name: "Modern Dark Orographic (Digital LiDAR)",
    paper: "#12151c",          // Deep graphite midnight
    ink: "#f0f3f8",            // Crisp white drafting ink
    inkFaint: "rgba(240, 243, 248, 0.35)",
    indexContour: "#e0a055",   // Luminous amber index
    contour: "rgba(190, 145, 95, 0.72)", // Luminous ochre contour
    shadowWash: "rgba(0, 0, 0, 0.65)",
    deepShadow: "rgba(0, 0, 0, 0.85)",
    highlightWash: "rgba(120, 200, 255, 0.30)",
    waterWash: "rgba(16, 46, 76, 0.60)",
    waterLine: "rgba(75, 175, 230, 0.75)",
    hachure: "rgba(160, 120, 80, 0.55)",
    isDark: true,
    isModern: true,
  },
  {
    name: "Heritage Topography (1938 Survey)",
    paper: "#f4eedd",          // Aged warm cream paper
    ink: "#23180e",            // Walnut drafting ink
    inkFaint: "rgba(35, 24, 14, 0.45)",
    indexContour: "#1c1209",
    contour: "rgba(42, 30, 18, 0.70)",
    shadowWash: "rgba(95, 68, 42, 0.28)",
    deepShadow: "rgba(55, 36, 20, 0.42)",
    highlightWash: "rgba(255, 250, 235, 0.40)",
    waterWash: "rgba(168, 192, 196, 0.35)",
    waterLine: "rgba(40, 75, 90, 0.55)",
    hachure: "rgba(38, 26, 16, 0.65)",
    isDark: false,
    isModern: false,
  },
];

// Procedural Laid-Paper Texture Pattern
let laidPattern = null;
function getLaidPattern(ctx) {
  if (typeof document === "undefined") return null;
  if (!laidPattern && ctx) {
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
    laidPattern = ctx.createPattern(paperCanvas, "repeat");
  }
  return laidPattern;
}

// Deterministic Aquatint Rosin Granulation (2D fallback when WebGL is unavailable)
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
  globalThis.TOPOGRAPHY_PALETTES = TOPOGRAPHY_PALETTES;
  globalThis.getLaidPattern = getLaidPattern;
  globalThis.applyAquatintGrain = applyAquatintGrain;
}
