// Muted & Subdued Intaglio, Dark Blueprint, and Antique Cartography Palettes
// Includes both light antique papers and dark blueprint/nautical night stocks

function hexToRgb(hex) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((ch) => ch + ch).join("");
  const num = parseInt(c, 16);
  return [
    (num >> 16) & 255,
    (num >> 8) & 255,
    num & 255,
  ];
}

function hexToRgb01(hex) {
  const [r, g, b] = hexToRgb(hex);
  return [r / 255, g / 255, b / 255];
}

function rgbToHex(rgb) {
  return "#" + rgb.map((v) => Math.min(255, Math.max(0, Math.floor(v))).toString(16).padStart(2, "0")).join("");
}

// Subtractive ink multiplying paper stock
function blendSubtractive(inkHex, paperHex) {
  const ink = hexToRgb(inkHex);
  const paper = hexToRgb(paperHex);
  return rgbToHex(ink.map((val, i) => (val * paper[i]) / 255));
}

const TERRAIN_PALETTES = [
  // ── Dark Background Palettes (Constellation & Map style) ───────────────────
  {
    name: "Cyanotype Blueprint",
    paper: "#020a1e",       // Deep celestial midnight cyanotype blue
    ink: "#d0dbe5",         // Cool drafting silver & slate grey stripes
    paperName: "Cyanotype Indigo Blueprint",
    isDark: true,
  },
  {
    name: "Nautical Sea Chart",
    paper: "#09182b",       // Deep ocean navy parchment
    ink: "#e5b869",         // Warm golden & yellow-ish ochre strikes
    paperName: "Deep Ocean Navy Vellum",
    isDark: true,
  },
  {
    name: "Blackboard Slate",
    paper: "#151a21",       // Deep antique chalkboard slate
    ink: "#e2e8f0",         // Mineral chalk white & pale grey stripes
    paperName: "Chalkboard Slate",
    isDark: true,
  },
  {
    name: "Obsidian & Gold",
    paper: "#121214",       // Deep graphite obsidian
    ink: "#dfad52",         // Burnished gold & ochre strikes
    paperName: "Obsidian Kraft",
    isDark: true,
  },
  {
    name: "Night Forest",
    paper: "#07140e",       // Midnight pine forest
    ink: "#9fc7aa",         // Moonlit mint & pale sage strikes
    paperName: "Midnight Pine",
    isDark: true,
  },

  // ── Light Antique Paper Palettes ──────────────────────────────────────────
  {
    name: "Indigo Night",
    ink: "#2c3b5d",         // Deep indigo ink
    paper: "#eae5d9",       // Newsprint pale paper
    paperName: "Newsprint Pale",
    isDark: false,
  },
  {
    name: "Prussian Blue",
    ink: "#122438",         // Deep intaglio Prussian blue
    paper: "#f4eedb",       // Warm antique cream laid paper
    paperName: "Antique Cream Laid Paper",
    isDark: false,
  },
  {
    name: "Walnut Gall",
    ink: "#2c1c0f",         // Deep walnut gall ink
    paper: "#e7d8be",       // Warm tea-stained antique parchment
    paperName: "Antique Tea-Stained Vellum",
    isDark: false,
  },
  {
    name: "Glacial Slate",
    ink: "#1c222b",         // Deep slate black ink
    paper: "#e4ded2",       // Cool slate parchment
    paperName: "Cool Slate Parchment",
    isDark: false,
  },
  {
    name: "Carbon Lamp Black",
    ink: "#151413",         // Deep carbon black
    paper: "#f2ede0",       // Antique ivory paper
    paperName: "Antique Ivory Paper",
    isDark: false,
  },
  {
    name: "Aged Highlands",
    ink: "#28170c",         // Burnt umber ink
    paper: "#eadbc2",       // Aged vellum
    paperName: "Aged Highlands Vellum",
    isDark: false,
  },
  {
    name: "Alpine Pine",
    ink: "#0e2417",         // Deep forest pine
    paper: "#eaf0e6",       // Pale sage laid paper
    paperName: "Pale Sage Laid Paper",
    isDark: false,
  },
  {
    name: "Roasted Sepia",
    ink: "#2c170d",         // Dark roasted sepia
    paper: "#ede0cc",       // Warm beige parchment
    paperName: "Warm Beige Parchment",
    isDark: false,
  },
  {
    name: "Terracotta Copper",
    ink: "#381710",         // Burnt sienna copper
    paper: "#faede2",       // Warm peach laid paper
    paperName: "Peach Laid Paper",
    isDark: false,
  },
];

const RISO_PALETTES = TERRAIN_PALETTES;
