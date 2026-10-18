// Procedural Imaginary Panorama Naming Engine for Intaglio Etchings
// Featuring classical cartographic forms and Gene Wolfe's "The Book of the New Sun" haunting motifs.

const FEATURES = [
  "Plains",
  "Ridge",
  "Peaks",
  "Highlands",
  "Valleys",
  "Crags",
  "Reach",
  "Steppes",
  "Basin",
  "Escarpment",
  "Spires",
  "Badlands",
  "Expanse",
  "Chasm",
  "Promontory",
  "Cinder Fields",
  "Dunes",
  "Plateau",
  "Marches",
  "Pass",
  "Gorge",
  "Barrens",
  "Fens",
  "Hills",
  "Divide",
  // Gene Wolfe / Book of the New Sun motifs:
  "Saltus",
  "Pampa",
  "Cenotaph",
  "Necropolis",
  "Ziggurat",
  "Redoubt",
  "Labyrinth",
  "Sunder",
  "Vincula",
  "Glades",
  "Ossuary",
  "Catacombs",
  "Terraces",
  "Citadel",
  "Gates",
  "Spire",
];

const ADJECTIVES = [
  "Ashen",
  "Obsidian",
  "Whispering",
  "Sunken",
  "Forgotten",
  "Silent",
  "Crystalline",
  "Golden",
  "Windswept",
  "Twilight",
  "Ebon",
  "Iron",
  "Spectral",
  "Ancient",
  "Gilded",
  "Hollow",
  "Sovereign",
  "Emerald",
  "Distant",
  "Veiled",
  "Basalt",
  "Pale",
  "Sombre",
  "Frosted",
  "Endless",
  // Gene Wolfe / Urth haunting motifs:
  "Fuliginous",
  "Sanguinary",
  "Chthonic",
  "Sepulchral",
  "Penumbral",
  "Autarchic",
  "Vesperal",
  "Moribund",
  "Anabatic",
  "Hieratic",
  "Nocturnal",
  "Sublunar",
  "Desuetude",
  "Increate",
];

const REALMS = [
  "Elden",
  "Morvath",
  "Kerguelen",
  "Valdor",
  "Oakhaven",
  "Norendell",
  "Caelum",
  "Morrow",
  "Thule",
  "Vandor",
  "Aethelgard",
  "Zephyria",
  "Borealis",
  "Illyria",
  "Corvallis",
  "Arden",
  "Hesperia",
  "Ophir",
  "Hyperborea",
  "Sundergard",
  "Elysium",
  "Dunbarrow",
  "Aldur",
  "Silverspire",
  "Palehaven",
  "Vael",
  "Mythren",
  "Stormveil",
  "Sunspire",
  "Solitude",
  "Helvete",
  "Erebor",
  // Gene Wolfe / Urth realms:
  "Nessus",
  "Thrax",
  "Urth",
  "Typhon",
  "Ascia",
  "the Gyoll",
  "the Saltus",
  "the House Absolute",
  "Hierodule",
  "the Cacogens",
  "Apu-Punchau",
  "Matachin",
  "Piteas",
];

const EPITHETS = [
  "the Pale Sun",
  "the North Wind",
  "the First Dawn",
  "the Lost Kings",
  "the Solitary Hermit",
  "the Wandering Stars",
  "the Iron Crown",
  "Seven Winds",
  "the Sleeping Giant",
  "Eternal Mist",
  "the Silent Watcher",
  "the Broken Horizon",
  "Fading Light",
  "the Pilgrim's Trail",
  "the Singing Stones",
  // Gene Wolfe haunting epithets:
  "the Dying Sun",
  "the New Sun",
  "the Autarch",
  "the Increate",
  "the Torturers",
  "the Conciliator",
  "the Hierodules",
  "the Claw",
  "the Sanguinary Field",
  "Seven Bells",
  "the Fallen Colossus",
];

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function generateLandscapeName(seed) {
  const getRNG = typeof createRNG !== "undefined" ? createRNG : require("./noise.js").createRNG;
  const rng = getRNG(seed + 9009);
  const roll = rng();

  if (roll < 0.35) {
    // "The [Adjective] [Features] of [Realm]"
    // e.g. "The Fuliginous Reach of Nessus", "The Ashen Ridge of Valdor"
    const adj = pick(ADJECTIVES, rng);
    const feat = pick(FEATURES, rng);
    const realm = pick(REALMS, rng);
    const prefix = realm.startsWith("the ") ? "The " + adj + " " + feat + " of " + realm.slice(4) : `The ${adj} ${feat} of ${realm}`;
    return prefix;
  } else if (roll < 0.60) {
    // "The [Features] of [Realm]"
    // e.g. "The Saltus of Thrax", "The Plains of Nessus"
    const feat = pick(FEATURES, rng);
    const realm = pick(REALMS, rng);
    return `The ${feat} of ${realm}`;
  } else if (roll < 0.80) {
    // "The [Features] of [Epithet]"
    // e.g. "The Sunder of the Dying Sun", "The Necropolis of the Autarch"
    const feat = pick(FEATURES, rng);
    const epi = pick(EPITHETS, rng);
    return `The ${feat} of ${epi}`;
  } else if (roll < 0.92) {
    // "Prospect of [Realm]: The [Adjective] [Features]"
    // e.g. "Prospect of Nessus: The Penumbral Spires"
    const realm = pick(REALMS, rng);
    const adj = pick(ADJECTIVES, rng);
    const feat = pick(FEATURES, rng);
    return `Prospect of ${realm}: The ${adj} ${feat}`;
  } else {
    // "[Adjective] [Features] over [Realm]"
    // e.g. "Sepulchral Ridge over Urth"
    const adj = pick(ADJECTIVES, rng);
    const feat = pick(FEATURES, rng);
    const realm = pick(REALMS, rng);
    return `${adj} ${feat} over ${realm}`;
  }
}

const GOOGLE_FONTS = [
  { name: "Cormorant Garamond", style: "italic 500", css: '"Cormorant Garamond", Georgia, serif' },
  { name: "IM Fell English", style: "italic 400", css: '"IM Fell English", "Times New Roman", serif' },
  { name: "EB Garamond", style: "italic 500", css: '"EB Garamond", Garamond, serif' },
  { name: "Playfair Display", style: "italic 500", css: '"Playfair Display", Georgia, serif' },
  { name: "Cinzel", style: "600", css: '"Cinzel", "Times New Roman", serif', uppercase: true },
];

// Draw the title engraving inside an emptied rectangular cartouche inside the frame
function drawLandscapeTitle(ctx, totalW, totalH, name, pal, margin, progress = 1.0, totalScreens = 1, seed = 0) {
  if (progress <= 0 || !name) return;

  ctx.save();

  const getRNG = typeof createRNG !== "undefined" ? createRNG : require("./noise.js").createRNG;
  const rng = getRNG(seed + 8833);

  // Deterministically select font and placement
  const fontObj = pick(GOOGLE_FONTS, rng);
  const posRoll = rng();

  let displayText = name;
  if (fontObj.uppercase) {
    displayText = name.toUpperCase();
  }

  const fontSize = Math.max(12, Math.min(20, Math.round(totalH * 0.016)));
  ctx.font = `${fontObj.style} ${fontSize}px ${fontObj.css}`;

  // Measure text width to construct the emptied rectangle
  const textMetrics = ctx.measureText(displayText);
  const textW = textMetrics.width;

  const padX = Math.round(fontSize * 1.5);
  const padY = Math.round(fontSize * 0.55);
  const boxW = Math.round(textW + padX * 2);
  const boxH = Math.round(fontSize + padY * 2);

  // Random placement: left, center, or right inside the frame
  let boxX;
  if (totalScreens > 1) {
    const screenW = totalW / totalScreens;
    if (posRoll < 0.35) {
      // Left of Screen 0
      boxX = margin + Math.max(16, Math.round(screenW * 0.035));
    } else if (posRoll < 0.70) {
      // Centered on Screen 0 (safe from physical bezel)
      boxX = Math.round(screenW * 0.5 - boxW * 0.5);
    } else {
      // Right of Screen 1
      boxX = totalW - margin - boxW - Math.max(16, Math.round(screenW * 0.035));
    }
  } else {
    if (posRoll < 0.35) {
      // Left inside frame
      boxX = margin + Math.max(16, Math.round(totalW * 0.035));
    } else if (posRoll < 0.70) {
      // Centered inside frame
      boxX = Math.round((totalW - boxW) * 0.5);
    } else {
      // Right inside frame
      boxX = totalW - margin - boxW - Math.max(16, Math.round(totalW * 0.035));
    }
  }

  // Inside the frame above the bottom border
  const boxY = Math.round(totalH - margin - boxH - Math.max(10, totalH * 0.018));

  ctx.globalAlpha = Math.min(1.0, progress * 1.15);

  // 1. Emptied rectangle: paper wash clears all mountain hatchings / lines behind it
  ctx.fillStyle = pal.paper;
  ctx.fillRect(boxX, boxY, boxW, boxH);

  // 2. Outer intaglio plate cartouche rule
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // 3. Inner delicate hairline cartouche rule inset by 3px
  ctx.lineWidth = 0.75;
  ctx.strokeRect(boxX + 3, boxY + 3, boxW - 6, boxH - 6);

  // 4. Inscribed title
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = pal.ink;
  ctx.fillText(displayText, boxX + boxW * 0.5, boxY + boxH * 0.5);

  ctx.restore();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateLandscapeName, drawLandscapeTitle };
}
