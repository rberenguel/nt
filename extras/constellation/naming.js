// Classical Latin Astronomical Naming Engine for Constellations
// Generates 100% unrecognizable yet authentically Latin/classical sounding names.

const CONSTELLATION_NOUNS = [
  "Aquila", "Vulpis", "Lupus", "Corvus", "Cygnus", "Draco", "Serpens", "Hydra",
  "Aries", "Taurus", "Leo", "Lepus", "Monoceros", "Pegasus", "Centaurus", "Orion",
  "Cetus", "Delphinus", "Phoenix", "Columba", "Noctua", "Apis", "Musca", "Telescopium",
  "Sextans", "Horologium", "Fornax", "Circinus", "Norma", "Pyxis", "Reticulum",
  "Scutum", "Corona", "Triangulum", "Crux", "Volans", "Lynx", "Camelopardalis",
  "Canis", "Ursa", "Pavo", "Grus", "Chamaeleon", "Ara", "Crater", "Cor Caroli",
  "Vulpecula", "Equuleus", "Lacerta", "Sagitta", "Antlia", "Octans", "Pictor"
];

const CONSTELLATION_GENERAL_EPITHETS = [
  "Major", "Minor", "Aureus", "Argenteus", "Obscurus", "Nocturnus", "Celestis", "Stellatus",
  "Ignitus", "Albus", "Niger", "Profundus", "Vagans", "Serenus", "Antiquus",
  "Novus", "Fulgurans", "Glacialis", "Lucidus", "Nebulosus", "Chalcus",
  "Ferratus", "Velox", "Tardus", "Silens", "Immanis", "Mirabilis", "Arcanus"
];

function getValidDirectionalEpithets(normX, normY) {
  const list = [];
  // North / South (Y axis in celestial chart: 0 is North/top, 1 is South/bottom)
  if (normY < 0.38) {
    list.push("Borealis", "Septentrionalis");
  } else if (normY > 0.62) {
    list.push("Australis", "Meridionalis");
  }

  // West / East (X axis: 0 is West/left, 1 is East/right)
  if (normX < 0.38) {
    list.push("Occidentalis");
  } else if (normX > 0.62) {
    list.push("Orientalis");
  }

  return list;
}

function pickEpithetForPosition(rng, normX = 0.5, normY = 0.5) {
  const dirList = getValidDirectionalEpithets(normX, normY);
  // ~35% chance to use a directional epithet that strictly matches the constellation's celestial quadrant
  if (dirList.length > 0 && rng() < 0.35) {
    return pick(dirList, rng);
  }
  return pick(CONSTELLATION_GENERAL_EPITHETS, rng);
}

const CONSTELLATION_GENITIVES = [
  "Noctis", "Caeli", "Aetheris", "Aurorae", "Stellarum", "Vesperis", "Nebulae",
  "Geometriae", "Archimedis", "Astrorum", "Orbis"
];

const GOOGLE_FONTS = [
  { name: "Cinzel", style: "600", css: '"Cinzel", "Times New Roman", serif', uppercase: true },
  { name: "EB Garamond", style: "italic 600", css: '"EB Garamond", Garamond, serif', uppercase: true },
  { name: "Cormorant Garamond", style: "italic 700", css: '"Cormorant Garamond", Georgia, serif', uppercase: true },
  { name: "IM Fell English", style: "italic 400", css: '"IM Fell English", "Times New Roman", serif', uppercase: true },
  { name: "Playfair Display", style: "italic 600", css: '"Playfair Display", Georgia, serif', uppercase: true },
];

/**
 * Procedurally generates a unique classical Latin constellation name with support for 1 or 2 lines.
 * Strictly respects celestial chart geography: directional qualifiers (Borealis, Australis, Occidentalis,
 * Orientalis) only appear in their physically accurate celestial quadrants.
 */
function generateConstellationName(rng, usedNames = new Set(), normX = 0.5, normY = 0.5) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const roll = rng();
    const noun = pick(CONSTELLATION_NOUNS, rng);
    let name;
    let lines;

    if (roll < 0.65) {
      // e.g. "Cygnus Borealis", "Vulpis Aureus", "Centaurus Australis"
      const ep = pickEpithetForPosition(rng, normX, normY);
      name = `${noun} ${ep}`;
      // In historical charts, multi-word names frequently appear on two lines
      lines = rng() < 0.68 ? [noun, ep] : [name];
    } else if (roll < 0.88) {
      // e.g. "Corona Noctis", "Monoceros Caeli"
      const gen = pick(CONSTELLATION_GENITIVES, rng);
      name = `${noun} ${gen}`;
      lines = rng() < 0.68 ? [noun, gen] : [name];
    } else {
      // e.g. "Leo Major Orientalis", "Ursa Minor Borealis"
      const dirList = getValidDirectionalEpithets(normX, normY);
      const ep1 = pick(["Major", "Minor", "Lucidus", "Novus", "Antiquus"], rng);
      const ep2 = dirList.length > 0 && rng() < 0.65
        ? pick(dirList, rng)
        : pick(["Aureus", "Obscurus", "Fulgurans", "Arcanus", "Serenus", "Glacialis"], rng);
      name = `${noun} ${ep1} ${ep2}`;
      lines = [`${noun} ${ep1}`, ep2];
    }

    if (!usedNames.has(name)) {
      usedNames.add(name);
      return { text: name, lines };
    }
  }
  return { text: `Siderea ${Math.floor(rng() * 1000)}`, lines: ["Siderea"] };
}

/**
 * Draws a constellation name inscribed directly onto the celestial chart without empty white box masks.
 * Supports single-line and authentic two-line classical celestial inscriptions.
 */
function drawConstellationLabel(ctx, labelObj, pal, progress = 1.0) {
  if (progress <= 0 || !labelObj) return;

  const fontObj = labelObj.font;
  const lines = labelObj.lines || [labelObj.text];
  if (!lines || lines.length === 0) return;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = pal.ink;
  ctx.globalAlpha = Math.min(1.0, progress * 1.25);

  const fontSize = labelObj.fontSize || 13.5;
  const lineSpacing = Math.round(fontSize * 1.15);

  if (lines.length === 1) {
    let t = lines[0];
    if (fontObj.uppercase) t = t.toUpperCase();
    ctx.font = `${fontObj.style} ${fontSize}px ${fontObj.css}`;
    ctx.fillText(t, labelObj.x, labelObj.y);
  } else {
    // Authentic two-line classical layout: Primary Noun on top, Epithet below
    let l1 = lines[0];
    let l2 = lines[1];
    if (fontObj.uppercase) {
      l1 = l1.toUpperCase();
      l2 = l2.toUpperCase();
    }

    // Line 1: Primary Noun
    ctx.font = `${fontObj.style} ${fontSize}px ${fontObj.css}`;
    ctx.fillText(l1, labelObj.x, labelObj.y - lineSpacing * 0.52);

    // Line 2: Epithet (subordinate, slightly smaller font)
    const subFontSize = Math.max(9.5, Math.round(fontSize * 0.85));
    ctx.font = `italic 500 ${subFontSize}px ${fontObj.css}`;
    ctx.fillText(l2, labelObj.x, labelObj.y + lineSpacing * 0.52);
  }

  ctx.restore();
}

if (typeof globalThis !== "undefined") {
  globalThis.GOOGLE_FONTS = GOOGLE_FONTS;
  globalThis.generateConstellationName = generateConstellationName;
  globalThis.drawConstellationLabel = drawConstellationLabel;
}
