// Procedural Topographic Survey Naming Engine
// Generates plausible, authentic orographic toponyms using linguistic morphemes
// from Romance and Germanic geographic traditions without referencing specific real-world locations.

const GERMANIC_PEAK_PREFIXES = [
  "Gross", "Klein", "Schwarz", "Weiss", "Silber", "Hoch", "Firn", "Wetter",
  "Wild", "Stein", "Gams", "Falken", "Adler", "Kessel", "Roth", "Blau",
  "Gletscher", "Fels", "Schreck", "Dorn", "Moor", "Eisen", "Sonnen", "Korn"
];

const GERMANIC_PEAK_SUFFIXES = [
  "horn", "spitze", "stock", "grat", "kamm", "kogel", "fluh",
  "kopf", "eck", "nadel", "wand", "stein", "joch", "kulm"
];

const ROMANCE_PEAK_TYPES = [
  "Piz", "Cima", "Aiguille", "Dent", "Bec", "Dôme", "Corno", "Pic", "Pointe", "Mont", "Cresta"
];

const ROMANCE_PEAK_DESCRIPTORS = [
  "Valronda", "Rosatsch", "Vadret", "Nair", "Caldera", "Biancalba", "Sasseneire",
  "Salatschina", "Corviglia", "Mezdi", "Platta", "Fontanabona", "Ravine",
  "Grisch", "Morasco", "Serena", "Cristall", "Morter", "Barme", "Forcellina",
  "Costainas", "Vizan", "Tsan", "Zinal", "Chamois", "d'Arlas", "d'Avigna",
  "del Forno", "de Lona", "d'Otemma", "de Trient", "du Tour", "de Ferpècle",
  "d'Ardève", "di Bosco", "della Rossa", "di Cava", "d'Arpiglia", "de Boveire",
  "d'Ensal", "di Sasso", "da l'Acqua"
];

const PASS_NAMES = [
  // Romance cols & passes
  "Col de Fenêtre", "Pass da Costainas", "Passo del Vizan", "Col de Tsan",
  "Col de Lona", "Passo del Forno", "Col d'Arlas", "Col de Barme",
  "Passo Valetta", "Col de Ried", "Passo Cristallina", "Col des Cimes",
  // Germanic joche & passes
  "Furkjoch", "Gemmischarte", "Albristjoch", "Schafjoch", "Steinscharte",
  "Firnjoch", "Wetterjoch", "Gamsjoch", "Hochpass", "Kesseljoch", "Rothpass"
];

const LAKE_NAMES = [
  "Silbersee", "Bergsee", "Gamsee", "Schwarzsee", "Gletschersee", "Firnsee", "Karsee",
  "Lac de Valetta", "Lago Bianco", "Lai da Vadret", "Lac Noir", "Lai da Rosatsch",
  "Lago Cristallina", "Lac de Fenêtre", "Lai Grisch", "Lago del Forno"
];

const VALLEY_NAMES = [
  "Val d'Arlas", "Val de Lona", "Valronda", "Gamsental", "Val Costainas",
  "Firntal", "Val Serena", "Kesseltal", "Val d'Ensal", "Urserental"
];

const TOPOGRAPHY_FONT_THEMES = [
  {
    name: "Federal Survey (Engraved Standard)",
    titleFont: '700 17px "Cardo", "Times New Roman", serif',
    peakFont: 'italic 600 12px "Cardo", "Times New Roman", serif',
    passFont: 'italic 400 10.5px "Cardo", "Times New Roman", serif',
    contourFont: '600 9.5px "Barlow Semi Condensed", "Helvetica Neue", sans-serif',
    gridFont: '500 9.5px "Barlow Semi Condensed", "Helvetica Neue", sans-serif',
    cartoSubFont: '500 10px "Barlow Semi Condensed", sans-serif',
    noticeFont: '600 8.5px "Barlow Semi Condensed", sans-serif',
    scaleFont: '600 9px "Barlow Semi Condensed", sans-serif',
  },
  {
    name: "Ordnance Survey (Classic Geodetic)",
    titleFont: '700 16px "Libre Baskerville", "Georgia", serif',
    peakFont: 'italic 700 11.5px "Libre Baskerville", "Georgia", serif',
    passFont: 'italic 400 10px "Libre Baskerville", "Georgia", serif',
    contourFont: '700 9px "Libre Baskerville", serif',
    gridFont: '400 9px "Libre Baskerville", serif',
    cartoSubFont: '400 9.5px "Libre Baskerville", serif',
    noticeFont: '700 8.5px "Libre Baskerville", serif',
    scaleFont: '700 9px "Libre Baskerville", serif',
  },
  {
    name: "Geographic Survey of Ridges & Cirques",
    titleFont: '600 17px "Spectral", "Baskerville", serif',
    peakFont: 'italic 600 12px "Spectral", "Baskerville", serif',
    passFont: 'italic 400 10.5px "Spectral", "Baskerville", serif',
    contourFont: '600 9.5px "Barlow Semi Condensed", sans-serif',
    gridFont: '500 9.5px "Barlow Semi Condensed", sans-serif',
    cartoSubFont: '500 9.5px "Spectral", serif',
    noticeFont: '600 8.5px "Barlow Semi Condensed", sans-serif',
    scaleFont: '600 9px "Barlow Semi Condensed", sans-serif',
  },
  {
    name: "Modern Precision Cartography (Geodetic Sans)",
    titleFont: '700 16px "Space Grotesk", sans-serif',
    peakFont: '600 11.5px "Space Grotesk", sans-serif',
    passFont: '500 10px "Space Grotesk", sans-serif',
    contourFont: '600 9px "Space Grotesk", sans-serif',
    gridFont: '500 9px "Space Grotesk", sans-serif',
    cartoSubFont: '500 9.5px "Space Grotesk", sans-serif',
    noticeFont: '600 8.5px "Space Grotesk", sans-serif',
    scaleFont: '600 9px "Space Grotesk", sans-serif',
  },
];

function pick(array, rng) {
  return array[Math.floor(rng() * array.length)];
}

function generatePeakName(rng) {
  // 50% Romance/Rhaetian (Piz Valronda, Cima Caldera, Bec de Lona, Aiguille d'Arlas)
  // 50% Alemannic/Germanic (Silberhorn, Gamshorn, Wetterstock, Hochgrat, Wildspitze)
  if (rng() < 0.50) {
    const type = pick(ROMANCE_PEAK_TYPES, rng);
    const desc = pick(ROMANCE_PEAK_DESCRIPTORS, rng);
    return `${type} ${desc}`;
  } else {
    const p = pick(GERMANIC_PEAK_PREFIXES, rng);
    const s = pick(GERMANIC_PEAK_SUFFIXES, rng);
    return `${p}${s}`;
  }
}

function generatePassName(rng) {
  return pick(PASS_NAMES, rng);
}

function generateLakeName(rng) {
  return pick(LAKE_NAMES, rng);
}

function generateValleyName(rng) {
  return pick(VALLEY_NAMES, rng);
}

// Generate realistic map title directly referencing the highest mountain on the sheet
function generateMapTitle(rng, primaryPeak, secondaryPeak) {
  const pName = primaryPeak && primaryPeak.name ? primaryPeak.name.toUpperCase() : "PIZ VALRONDA";
  const sheetNum = 1100 + Math.floor(rng() * 320); // 4-digit survey sheet number

  // Titling format variations matching official topographic surveys
  let master = pName;
  const roll = rng();
  if (roll < 0.45) {
    master = pName; // e.g. "PIZ VALRONDA" or "GAMSHORN"
  } else if (roll < 0.75 && secondaryPeak && secondaryPeak.name) {
    master = `${pName}  —  ${secondaryPeak.name.toUpperCase()}`; // e.g. "PIZ VALRONDA — GAMSHORN"
  } else {
    master = pName.startsWith("PIZ ") || pName.startsWith("MONT ") || pName.startsWith("BEC ") ? `MASSIF DE ${pName}` : `${pName} QUADRANGLE`;
  }

  const subTemplates = [
    `TOPOGRAPHIC SURVEY 1:25 000  •  SHEET ${sheetNum}`,
    `NATIONAL RECONNAISSANCE 1:25 000  •  QUADRANGLE ${sheetNum}`,
    `FEDERAL TOPOGRAPHIC SURVEY  •  SHEET ${sheetNum}`,
    `GEODETIC SURVEY 1:25 000  •  SERIES ${sheetNum}`,
  ];

  return {
    master,
    subtitle: pick(subTemplates, rng),
    sheetNumber: sheetNum,
  };
}

if (typeof globalThis !== "undefined") {
  globalThis.generatePeakName = generatePeakName;
  globalThis.generatePassName = generatePassName;
  globalThis.generateLakeName = generateLakeName;
  globalThis.generateValleyName = generateValleyName;
  globalThis.generateMapTitle = generateMapTitle;
  globalThis.TOPOGRAPHY_FONTS = TOPOGRAPHY_FONT_THEMES;
}
