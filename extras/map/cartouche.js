// Procedural Antique Cartouche & Realm Naming Engine
// Inspired by Gene Wolfe's "The Book of the New Sun" and Renaissance / Tolkien cartography.
// Features:
// 1. Evocative realm, feature, adjective, and archival Latin heading generators.
// 2. Classical ornamental strapwork cartouche plaque with indented corners and pediment scrollwork.
// 3. Intelligent sea-anchored placement: automatically finds open ocean water to float the cartouche plaque,
//    with fallback to open valley plains.
// 4. Opaque parchment mask to cleanly occlude underlying waterlines, with intaglio double plate borders.
// 5. Directional naming consistency: bounds directional qualifiers (Borealis, Australis, Occidentalis, Orientalis)
//    strictly to physical map coordinates to eliminate geographic contradictions.
// 6. Authentic Renaissance Latin map titles, subtitles, and historical publisher imprints.

const CARTOUCHE_FEATURES = [
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
  "Spire",
];

const CARTOUCHE_ADJECTIVES = [
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
  // Gene Wolfe / Urth motifs:
  "Fuliginous",
  "Sanguinary",
  "Chthonic",
  "Sepulchral",
  "Penumbral",
  "Autarchic",
  "Vesperal",
  "Moribund",
  "Hieratic",
  "Nocturnal",
  "Sublunar",
  "Increate",
];

const CARTOUCHE_REALMS = [
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

const CARTOUCHE_EPITHETS = [
  "the Pale Sun",
  "the North Wind",
  "the First Dawn",
  "the Lost Kings",
  "the Wandering Stars",
  "the Iron Crown",
  "Seven Winds",
  "the Sleeping Giant",
  "Eternal Mist",
  "the Silent Watcher",
  "the Broken Horizon",
  "the Pilgrim's Trail",
  "the Singing Stones",
  // Gene Wolfe haunting epithets:
  "the Dying Sun",
  "the New Sun",
  "the Autarch",
  "the Increate",
  "the Conciliator",
  "the Hierodules",
  "the Claw",
  "the Sanguinary Field",
  "Seven Bells",
];

const ARCHIVAL_HEADERS = [
  "TABULA GEOGRAPHICA",
  "TYPUS ORBIS TERRARUM",
  "TERRA INCOGNITA",
  "ACCURATA DESCRIPTIO",
  "PROVINCIA IMPERIALIS",
  "CHARTA REGIONIS",
  "TRACTUS NOBILISSIMUS",
  "NOVA ET ACCURATA",
];

// 14 Authentic Historical Renaissance Cartographic Titles & Subtitles
const AUTHENTIC_LATIN_MAP_TITLES = [
  { main: "TABULA GEOGRAPHICA NOBILISSIMA", sub: "Totius Regionis Flumina Montes ac Sylvas Accuratissime Exhibens" },
  { main: "TYPUS ET DESCRIPTIO TERRARUM", sub: "Ad Exactissimam Geographiae Regulam Summo Studio Delineata" },
  { main: "NOVA ET ACCURATA REGIONIS TABULA", sub: "Auctoribus Celeberrimis ac Delineatione Fideli Expressa" },
  { main: "TERRAE INCOGNITAE CHARTA PRIMA", sub: "Montium Spinas et Fluviorum Meatus Ordine Naturae Monstrans" },
  { main: "CHARTA TOPOGRAPHICA IMPERIALIS", sub: "Continens Situs Provinciarum ac Limitibus Antiquis Finitas" },
  { main: "ORBIS ANTIQUUS ET NOVA DESCRIPTIO", sub: "Oceani Sinus Insulas Littoraque Fideliter Repraesentans" },
  { main: "SYNOPSIS GEOGRAPHICA PROVINCIALIS", sub: "Cum Confinibus Fluminibus Lacubus ac Nemorum Saltibus" },
  { main: "THEATRUM REGIONIS ET LOCORUM", sub: "Noviter Emendata et Aeneis Formis Diligenter Incisa" },
  { main: "EXACTA TOTIUS TRACTUS DELINEATIO", sub: "Secundum Observationes et Veterum Monumenta Composita" },
  { main: "FASCICULUS GEOGRAPHICUS NOBILIS", sub: "Omnes Vias Montes ac Sylvarum Ambitus Repraesentans" },
  { main: "SPECULUM TERRARUM ATQUE AQUARUM", sub: "Singulari Studio ac Labore in Lucem Aedita" },
  { main: "PROVINCIA NOBILISSIMA ET VASTA", sub: "Ubi Singulorum Montium et Amnium Facies Exprimitur" },
  { main: "ACCURATA METROPOLITANA DESCRIPTIO", sub: "Ex Typographia Academica et Archetypis Verissimis Deducta" },
  { main: "ATLAS VETERIS ET NOVI ORBIS", sub: "Tabulis Aeneis Expressa et In Usus Eruditorum Explicata" },
];

// 8 Historical Cartographic Publisher Imprints
const HISTORICAL_PUBLISHER_IMPRINTS = [
  "Amstelodami • Ex Officina Guiljelmi Blaeuw",
  "Norimbergae • Curantibus Homannianis Heredibus",
  "Amstelodami • Apud Ioannem Ianssonium",
  "Augustae Vindelicorum • Opera Matthaei Seutteri",
  "Lugduni Batavorum • Ex Officina Elzeviriana",
  "Londini • Typis et Sumptibus Ioannis Speed",
  "Antverpiae • In Officina Plantiniana",
  "Parisiis • Apud Nicolaum Sanson Geographum",
];

const CARTOUCHE_FONTS = [
  { name: "Cinzel", style: "600", css: '"Cinzel", "Times New Roman", serif', uppercase: true },
  { name: "Cormorant Garamond", style: "italic 600", css: '"Cormorant Garamond", Georgia, serif' },
  { name: "IM Fell English", style: "italic 400", css: '"IM Fell English", "Times New Roman", serif' },
  { name: "EB Garamond", style: "italic 500", css: '"EB Garamond", Garamond, serif' },
];

class CartoucheEngine {
  constructor(totalW, totalH, seed = Math.floor(Math.random() * 1000000)) {
    this.totalW = totalW;
    this.totalH = totalH;
    this.seed = seed;
    this.rng = createRNG(seed);

    this.title = "";
    this.header = "";
    this.imprint = "";
    this.fontObj = null;
    this.box = null; // { x, y, w, h }
  }

  static pick(arr, rng) {
    return arr[Math.floor(rng() * arr.length)];
  }

  generateTitle(nameBucket = null) {
    const { rng } = this;
    const bucket = nameBucket || (typeof NameBucket !== "undefined" ? new NameBucket(this.seed) : null);

    let name;
    if (bucket) {
      name = bucket.getRealmTitle();
      this.header = bucket.getSubtitle();
    } else {
      const roll = rng();

      if (roll < 0.22) {
        // Authentic Classical Latin title pair
        const latinTitle = CartoucheEngine.pick(AUTHENTIC_LATIN_MAP_TITLES, rng);
        name = latinTitle.main;
        this.header = latinTitle.sub;
      } else if (roll < 0.48) {
      // "The [Adjective] [Features] of [Realm]"
      const adj = CartoucheEngine.pick(CARTOUCHE_ADJECTIVES, rng);
      const feat = CartoucheEngine.pick(CARTOUCHE_FEATURES, rng);
      const realm = CartoucheEngine.pick(CARTOUCHE_REALMS, rng);
      name = realm.startsWith("the ")
        ? `The ${adj} ${feat} of ${realm.slice(4)}`
        : `The ${adj} ${feat} of ${realm}`;
      this.header = CartoucheEngine.pick(ARCHIVAL_HEADERS, rng);
    } else if (roll < 0.68) {
      // "The [Features] of [Realm]"
      const feat = CartoucheEngine.pick(CARTOUCHE_FEATURES, rng);
      const realm = CartoucheEngine.pick(CARTOUCHE_REALMS, rng);
      name = `The ${feat} of ${realm}`;
      this.header = CartoucheEngine.pick(ARCHIVAL_HEADERS, rng);
    } else if (roll < 0.84) {
      // "The [Features] of [Epithet]"
      const feat = CartoucheEngine.pick(CARTOUCHE_FEATURES, rng);
      const epi = CartoucheEngine.pick(CARTOUCHE_EPITHETS, rng);
      name = `The ${feat} of ${epi}`;
      this.header = CartoucheEngine.pick(ARCHIVAL_HEADERS, rng);
    } else {
      // "[Adjective] [Features] of [Realm]"
      const adj = CartoucheEngine.pick(CARTOUCHE_ADJECTIVES, rng);
      const feat = CartoucheEngine.pick(CARTOUCHE_FEATURES, rng);
      const realm = CartoucheEngine.pick(CARTOUCHE_REALMS, rng);
      name = `${adj} ${feat} of ${realm}`;
      this.header = CartoucheEngine.pick(ARCHIVAL_HEADERS, rng);
    }
  }

    this.imprint = CartoucheEngine.pick(HISTORICAL_PUBLISHER_IMPRINTS, rng);
    this.fontObj = CartoucheEngine.pick(CARTOUCHE_FONTS, rng);

    if (this.fontObj.uppercase) {
      this.title = name.toUpperCase();
    } else {
      this.title = name;
    }

    return this.title;
  }

  /**
   * Enforces directional naming consistency against physical map coordinates.
   * If a directional qualifier contradicts the hemisphere or quadrant, replace it.
   */
  enforceDirectionalConsistency(box) {
    if (!box) return;
    const { totalW, totalH } = this;
    const isNorth = box.y < totalH * 0.5;
    const isWest = box.x < totalW * 0.5;

    // Northern qualifiers contradict South placement
    const northQualifiers = ["Borealis", "Septentrionalis", "Hyperborea", "Thule", "the North Wind", "North"];
    // Southern qualifiers contradict North placement
    const southQualifiers = ["Australis", "Meridionalis", "the Southern Sun", "South"];
    // Western qualifiers contradict East placement
    const westQualifiers = ["Occidentalis", "Hesperia", "Zephyria", "the Setting Sun", "West"];
    // Eastern qualifiers contradict West placement
    const eastQualifiers = ["Orientalis", "the First Dawn", "East"];

    let updatedTitle = this.title;

    if (!isNorth) {
      // Placed in South: replace any North qualifier
      for (let nq of northQualifiers) {
        const re = new RegExp(`\\b${nq}\\b`, "i");
        if (re.test(updatedTitle)) {
          updatedTitle = updatedTitle.replace(re, this.fontObj.uppercase ? "AUSTRALIS" : "Australis");
        }
      }
    } else {
      // Placed in North: replace any South qualifier
      for (let sq of southQualifiers) {
        const re = new RegExp(`\\b${sq}\\b`, "i");
        if (re.test(updatedTitle)) {
          updatedTitle = updatedTitle.replace(re, this.fontObj.uppercase ? "BOREALIS" : "Borealis");
        }
      }
    }

    if (!isWest) {
      // Placed in East: replace any West qualifier
      for (let wq of westQualifiers) {
        const re = new RegExp(`\\b${wq}\\b`, "i");
        if (re.test(updatedTitle)) {
          updatedTitle = updatedTitle.replace(re, this.fontObj.uppercase ? "ORIENTALIS" : "Orientalis");
        }
      }
    } else {
      // Placed in West: replace any East qualifier
      for (let eq of eastQualifiers) {
        const re = new RegExp(`\\b${eq}\\b`, "i");
        if (re.test(updatedTitle)) {
          updatedTitle = updatedTitle.replace(re, this.fontObj.uppercase ? "OCCIDENTALIS" : "Occidentalis");
        }
      }
    }

    this.title = updatedTitle;
  }

  /**
   * Layout and locate the cartouche plaque.
   * Prioritizes floating in the open sea (as requested: "likely, at sea?"),
   * with fallback to an open valley corner. Avoids monitor bezels in multi-screen setups.
   */
  layout(ctx, coastEngine, ridges, rivers, lakes, totalScreens = 1, nameBucket = null) {
    const { totalW, totalH, rng } = this;
    if (!this.title) this.generateTitle(nameBucket);

    const neatlinePad = 28;
    const margin = 18; // clearance from neatline

    // Measure text dimensions
    const titleFontSize = Math.max(13, Math.min(20, Math.round(totalH * 0.017)));
    const headerFontSize = Math.max(8, Math.min(10, Math.round(titleFontSize * 0.52)));
    const imprintFontSize = Math.max(7, Math.min(8.5, Math.round(headerFontSize * 0.88)));

    ctx.save();
    ctx.font = `${this.fontObj.style} ${titleFontSize}px ${this.fontObj.css}`;
    const titleMetrics = ctx.measureText(this.title);
    ctx.font = `italic 400 ${imprintFontSize}px "EB Garamond", Garamond, serif`;
    const imprintMetrics = ctx.measureText(this.imprint);
    ctx.restore();

    const textW = Math.max(190, Math.max(titleMetrics.width, imprintMetrics.width));
    const padX = Math.round(titleFontSize * 1.6);
    const padY = Math.round(titleFontSize * 1.1);

    const boxW = Math.round(textW + padX * 2);
    const boxH = Math.round(titleFontSize + headerFontSize + imprintFontSize + padY * 2 + 18);

    this.titleFontSize = titleFontSize;
    this.headerFontSize = headerFontSize;
    this.imprintFontSize = imprintFontSize;

    // ── Find Optimal Placement (at sea first) ──────────────────────────
    let chosenPos = null;
    const screenW = totalW / totalScreens;

    if (coastEngine && coastEngine.coasts && coastEngine.coasts.length > 0) {
      const candidates = [];
      const style = coastEngine.coastStyle || "west-ocean";

      if (style === "west-ocean") {
        // Ocean on the left: upper-left or lower-left of Screen 0
        candidates.push({ x: neatlinePad + margin, y: neatlinePad + margin + 10 });
        candidates.push({ x: neatlinePad + margin, y: totalH - neatlinePad - margin - boxH - 10 });
      } else if (style === "east-ocean") {
        // Ocean on the right: upper-right or lower-right of the rightmost screen
        candidates.push({ x: totalW - neatlinePad - margin - boxW, y: neatlinePad + margin + 10 });
        candidates.push({ x: totalW - neatlinePad - margin - boxW, y: totalH - neatlinePad - margin - boxH - 10 });
      } else if (style === "south-ocean") {
        // Ocean at the bottom: corners safe from monitor bezels
        candidates.push({ x: neatlinePad + margin + 20, y: totalH - neatlinePad - margin - boxH - 10 });
        if (totalScreens > 1) {
          candidates.push({ x: screenW - margin - boxW - 25, y: totalH - neatlinePad - margin - boxH - 10 });
          candidates.push({ x: screenW + margin + 25, y: totalH - neatlinePad - margin - boxH - 10 });
        }
        candidates.push({ x: totalW - neatlinePad - margin - boxW - 20, y: totalH - neatlinePad - margin - boxH - 10 });
      } else if (style === "north-ocean") {
        // Ocean at the top: corners safe from monitor bezels
        candidates.push({ x: neatlinePad + margin + 20, y: neatlinePad + margin + 10 });
        if (totalScreens > 1) {
          candidates.push({ x: screenW - margin - boxW - 25, y: neatlinePad + margin + 10 });
          candidates.push({ x: screenW + margin + 25, y: neatlinePad + margin + 10 });
        }
        candidates.push({ x: totalW - neatlinePad - margin - boxW - 20, y: neatlinePad + margin + 10 });
      }

      // Check each sea candidate: all 4 corners and center must be in ocean water
      const validSeaCandidates = [];
      for (let cand of candidates) {
        const cPts = [
          { x: cand.x, y: cand.y },
          { x: cand.x + boxW, y: cand.y },
          { x: cand.x, y: cand.y + boxH },
          { x: cand.x + boxW, y: cand.y + boxH },
          { x: cand.x + boxW * 0.5, y: cand.y + boxH * 0.5 },
        ];

        let allInSea = true;
        for (let p of cPts) {
          if (!coastEngine.isOcean(p, 10)) {
            allInSea = false;
            break;
          }
        }

        // Must not cover an active river estuary mouth
        if (allInSea && rivers) {
          for (let riv of rivers) {
            if (riv.points && riv.points.length > 0) {
              const lastP = riv.points[riv.points.length - 1];
              if (lastP.x >= cand.x - 20 && lastP.x <= cand.x + boxW + 20 &&
                  lastP.y >= cand.y - 20 && lastP.y <= cand.y + boxH + 20) {
                allInSea = false;
                break;
              }
            }
          }
        }

        if (allInSea) {
          // Score by distance to nearest coast point (more open water is better)
          const center = { x: cand.x + boxW * 0.5, y: cand.y + boxH * 0.5 };
          const nearestC = coastEngine.getNearestCoastPoint(center.x, center.y);
          const seaClearance = nearestC ? Math.hypot(nearestC.x - center.x, nearestC.y - center.y) : 100;
          validSeaCandidates.push({ pos: cand, clearance: seaClearance });
        }
      }

      if (validSeaCandidates.length > 0) {
        // Sort by clearance and select candidate with greatest clearance
        validSeaCandidates.sort((a, b) => b.clearance - a.clearance);
        chosenPos = validSeaCandidates[0].pos;
      }
    }

    // Fallback: If no sea candidate fits, find an open corner of the map with maximum terrain clearance
    if (!chosenPos) {
      const cornerCandidates = [
        { x: neatlinePad + margin, y: neatlinePad + margin + 10 },
        { x: totalW - neatlinePad - margin - boxW, y: neatlinePad + margin + 10 },
        { x: neatlinePad + margin, y: totalH - neatlinePad - margin - boxH - 10 },
        { x: totalW - neatlinePad - margin - boxW, y: totalH - neatlinePad - margin - boxH - 10 },
      ];

      let bestScore = -Infinity;
      for (let cand of cornerCandidates) {
        const cx = cand.x + boxW * 0.5;
        const cy = cand.y + boxH * 0.5;
        let score = 9999;

        if (ridges) {
          for (let r of ridges) {
            for (let bp of (r.backbone || [])) {
              score = Math.min(score, Math.hypot(cx - bp.x, cy - bp.y));
            }
          }
        }
        if (lakes) {
          for (let l of lakes) {
            score = Math.min(score, Math.hypot(cx - l.x, cy - l.y) - (l.radius || 40));
          }
        }

        if (score > bestScore) {
          bestScore = score;
          chosenPos = cand;
        }
      }
    }

    this.box = {
      x: chosenPos.x,
      y: chosenPos.y,
      w: boxW,
      h: boxH,
    };

    // Apply directional consistency verification against final coordinate placement
    this.enforceDirectionalConsistency(this.box);

    return this.box;
  }

  /**
   * Draw the classical cartouche plaque with Renaissance strapwork,
   * indented corners, intaglio plate borders, inscribed typography, and publisher imprint.
   */
  draw(ctx, palette, progress = 1.0) {
    if (!this.box || progress <= 0.15) return;

    ctx.save();
    const { x, y, w, h } = this.box;
    const animProgress = Math.min(1.0, (progress - 0.15) / 0.85);

    // Fade-in opacity
    ctx.globalAlpha = Math.min(1.0, animProgress * 1.25);

    const cornerRadius = 6;
    const scrollLen = 7;

    // 1. Opaque Parchment Base Mask (clears ocean waterlines, wash, and terrain)
    ctx.fillStyle = palette.paper;
    ctx.beginPath();
    ctx.moveTo(x + cornerRadius, y);
    ctx.lineTo(x + w - cornerRadius, y);
    ctx.arcTo(x + w, y, x + w, y + cornerRadius, cornerRadius);
    ctx.lineTo(x + w, y + h - cornerRadius);
    ctx.arcTo(x + w, y + h, x + w - cornerRadius, y + h, cornerRadius);
    ctx.lineTo(x + cornerRadius, y + h);
    ctx.arcTo(x, y + h, x, y + h - cornerRadius, cornerRadius);
    ctx.lineTo(x, y + cornerRadius);
    ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
    ctx.closePath();
    ctx.fill();

    // 2. Subtle Intaglio Cast Shadow (gives plate indentation feel)
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.22 * Math.min(1.0, animProgress * 1.2);
    ctx.strokeRect(x + 1.5, y + 1.5, w, h);

    // 3. Outer Plate Rule (Bold cartographic frame)
    ctx.globalAlpha = Math.min(1.0, animProgress * 1.15);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = palette.ink;
    ctx.strokeRect(x, y, w, h);

    // 4. Inner Delicate Hairline Rule (inset by 4px)
    ctx.lineWidth = 0.70;
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);

    // 5. Renaissance Strapwork Corner Ear Ornaments (Antique quadrant scrolls)
    ctx.lineWidth = 0.90;
    // Top-Left corner scroll
    ctx.beginPath();
    ctx.moveTo(x - 2, y + scrollLen);
    ctx.lineTo(x - 2, y - 2);
    ctx.lineTo(x + scrollLen, y - 2);
    ctx.stroke();
    // Top-Right corner scroll
    ctx.beginPath();
    ctx.moveTo(x + w + 2, y + scrollLen);
    ctx.lineTo(x + w + 2, y - 2);
    ctx.lineTo(x + w - scrollLen, y - 2);
    ctx.stroke();
    // Bottom-Left corner scroll
    ctx.beginPath();
    ctx.moveTo(x - 2, y + h - scrollLen);
    ctx.lineTo(x - 2, y + h + 2);
    ctx.lineTo(x + scrollLen, y + h + 2);
    ctx.stroke();
    // Bottom-Right corner scroll
    ctx.beginPath();
    ctx.moveTo(x + w + 2, y + h - scrollLen);
    ctx.lineTo(x + w + 2, y + h + 2);
    ctx.lineTo(x + w - scrollLen, y + h + 2);
    ctx.stroke();

    // 6. Center Top Crest Pediment (Ornamental diamond & finial)
    const midX = x + w * 0.5;
    ctx.beginPath();
    ctx.moveTo(midX - 16, y);
    ctx.lineTo(midX, y - 5);
    ctx.lineTo(midX + 16, y);
    ctx.stroke();

    ctx.fillStyle = palette.ink;
    ctx.beginPath();
    ctx.arc(midX, y - 5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 7. Center Bottom Apron Pendant
    ctx.beginPath();
    ctx.moveTo(midX - 14, y + h);
    ctx.lineTo(midX, y + h + 4);
    ctx.lineTo(midX + 14, y + h);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX, y + h + 4, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // 8. Inscribed Typography:
    // (a) Archival Header: Spaced small caps Latin
    const headerY = y + this.headerFontSize + 9;
    ctx.font = `600 ${this.headerFontSize}px "Cinzel", "Times New Roman", serif`;
    ctx.fillStyle = palette.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.65 * Math.min(1.0, animProgress * 1.3);

    const spacedHeader = this.header.length > 32
      ? this.header
      : this.header.split("").join(" ");
    ctx.fillText(spacedHeader, midX, headerY);

    // (b) Subtle Horizontal Dividing Hairline with Center Rhombus
    const divY = headerY + this.headerFontSize * 0.8 + 4;
    const divHalfW = Math.min(80, w * 0.32);
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 0.55;
    ctx.globalAlpha = 0.45 * Math.min(1.0, animProgress * 1.2);

    ctx.beginPath();
    ctx.moveTo(midX - divHalfW, divY);
    ctx.lineTo(midX - 6, divY);
    ctx.moveTo(midX + 6, divY);
    ctx.lineTo(midX + divHalfW, divY);
    ctx.stroke();

    // Small center rhombus
    ctx.fillStyle = palette.ink;
    ctx.beginPath();
    ctx.moveTo(midX, divY - 2.5);
    ctx.lineTo(midX + 3.5, divY);
    ctx.lineTo(midX, divY + 2.5);
    ctx.lineTo(midX - 3.5, divY);
    ctx.closePath();
    ctx.fill();

    // (c) Primary Realm Title
    const titleY = divY + (h - (divY - y) - (this.imprintFontSize + 12)) * 0.50;
    ctx.font = `${this.fontObj.style} ${this.titleFontSize}px ${this.fontObj.css}`;
    ctx.fillStyle = palette.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = Math.min(1.0, animProgress * 1.3);
    ctx.fillText(this.title, midX, titleY);

    // (d) Historical Publisher Imprint (at bottom of cartouche plaque)
    if (this.imprint) {
      const imprintDivY = y + h - this.imprintFontSize - 10;
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 0.45;
      ctx.globalAlpha = 0.35 * Math.min(1.0, animProgress * 1.2);

      ctx.beginPath();
      ctx.moveTo(midX - divHalfW * 0.75, imprintDivY);
      ctx.lineTo(midX + divHalfW * 0.75, imprintDivY);
      ctx.stroke();

      ctx.font = `italic 400 ${this.imprintFontSize}px "EB Garamond", Garamond, serif`;
      ctx.fillStyle = palette.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.55 * Math.min(1.0, animProgress * 1.2);
      ctx.fillText(this.imprint, midX, y + h - this.imprintFontSize - 3);
    }

    ctx.restore();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CartoucheEngine,
    AUTHENTIC_LATIN_MAP_TITLES,
    HISTORICAL_PUBLISHER_IMPRINTS,
    CARTOUCHE_FEATURES,
    CARTOUCHE_ADJECTIVES,
    CARTOUCHE_REALMS,
    CARTOUCHE_EPITHETS,
  };
}
