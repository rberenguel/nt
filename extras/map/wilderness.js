// Procedural Antique Fantasy Cartography — Wilderness, Desolations & Regional Lore Engine
// Features:
// 1. Classical Ground Micro-Textures:
//    - Grass tufts (gramina) in fertile plains & downs (\ | /).
//    - Desert sand dune ripples & barchan crescents in arid wastes.
//    - Wetland marsh reeds & water ticks (paludes) near deltas and depressions.
// 2. Sweeping Archaic Regional Territorial Inscriptions (e.g. DESERTA MAGNA, VASTITAS INTERIOR).
// 3. Ancient Wilderness Landmarks:
//    - Megalithic standing stones & trilithon dolmens.
//    - Barrow tumuli (ancient burial mounds with entry portals).
//    - Crumbling ruins & broken stone archways.
//    - Nomadic desert pavilion encampments.
// 4. Wandering Terrestrial Beasts (Bestiae Terrestres):
//    - Stalking lion, desert camel caravan, or wild dragon.

const REGIONAL_DESOLATION_NAMES = [
  "DESERTA MAGNA",
  "VASTITAS INTERIOR",
  "CAMPI SOLITUDINIS",
  "PLANITIES IMMENSA",
  "TERRA INCOGNITA",
  "REGIO TENEBROSA",
  "DESOLATIO ORIENTALIS",
  "HIC ABUNDANT LEONES",
  "DESERTUM ARIDUM",
  "VASTITAS BOREALIS",
  "SALTUS SILVESTRIS",
  "SOLITUDO AUREA"
];

// ── 1. Ground Micro-Texture Entities ──────────────────────────────────────────

class GrassTuft {
  constructor(x, y, scale = 1.0, seed = 0) {
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.seed = seed;
  }

  draw(ctx, pal) {
    const { x, y, scale, seed } = this;
    const h = (4.5 + (seed % 3) * 1.2) * scale;
    ctx.save();
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 0.75;
    ctx.globalAlpha = 0.42;

    ctx.beginPath();
    // Center blade
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.sin(seed * 3) * 1.2), y - h);
    // Left blade
    ctx.moveTo(x, y);
    ctx.lineTo(x - h * 0.55, y - h * 0.78);
    // Right blade
    ctx.moveTo(x, y);
    ctx.lineTo(x + h * 0.55, y - h * 0.75);

    // Optional 4th blade
    if (seed % 2 === 0) {
      ctx.moveTo(x, y);
      ctx.lineTo(x - h * 0.3, y - h * 0.9);
    }
    ctx.stroke();
    ctx.restore();
  }
}

class DuneRipple {
  constructor(x, y, width = 16, seed = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.seed = seed;
  }

  draw(ctx, pal) {
    const { x, y, width, seed } = this;
    const halfW = width * 0.5;
    ctx.save();
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = 0.38;

    // Sinuous crescent barchan arc
    ctx.beginPath();
    ctx.moveTo(x - halfW, y);
    ctx.quadraticCurveTo(x, y - width * 0.22, x + halfW, y);
    ctx.stroke();

    // Secondary subtle trailing ripple
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(x - halfW * 0.6, y + 2.5);
    ctx.quadraticCurveTo(x + 1, y + 1.2, x + halfW * 0.7, y + 2.8);
    ctx.stroke();

    ctx.restore();
  }
}

class MarshReeds {
  constructor(x, y, scale = 1.0, seed = 0) {
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.seed = seed;
  }

  draw(ctx, pal) {
    const { x, y, scale } = this;
    const h = 7 * scale;
    ctx.save();
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.48;

    ctx.beginPath();
    // 3 reeds with bulrush heads
    for (let i = -1; i <= 1; i++) {
      const rx = x + i * 3.5;
      const rh = h * (0.85 + Math.abs(i) * 0.2);
      ctx.moveTo(rx, y);
      ctx.lineTo(rx + i * 0.8, y - rh);
      // Bulrush seed head
      ctx.moveTo(rx + i * 0.8, y - rh);
      ctx.lineTo(rx + i * 0.8, y - rh + 3);
    }
    // Horizontal waterline ticks
    ctx.moveTo(x - 6, y + 1);
    ctx.lineTo(x + 6, y + 1);
    ctx.moveTo(x - 3, y + 3);
    ctx.lineTo(x + 3, y + 3);
    ctx.stroke();

    ctx.restore();
  }
}

// ── 2. Ancient Landmarks & Ruins ──────────────────────────────────────────────

class AncientLandmark {
  constructor(x, y, type = "standing-stones", seed = 0) {
    this.x = x;
    this.y = y;
    this.type = type; // "standing-stones" | "tumulus" | "ruin" | "nomad-camp"
    this.seed = seed;
    this.avgY = y;
    this.width = 24;
    this.height = 18;
  }

  draw(ctx, pal, progress = 1.0) {
    if (progress <= 0) return;
    const { x, y, type, seed } = this;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (progress < 1.0) {
      ctx.globalAlpha = Math.min(1.0, progress * 1.35);
    }

    // Opaque paper occlusion mask
    ctx.fillStyle = pal.paper;
    ctx.fillRect(x - 14, y - 18, 28, 20);

    ctx.strokeStyle = pal.ink;

    if (type === "standing-stones") {
      // ── Megalithic Trilithon / Dolmen ──
      ctx.lineWidth = 1.2;
      // Left monolith
      ctx.strokeRect(x - 8, y - 14, 4.5, 14);
      // Right monolith
      ctx.strokeRect(x + 3.5, y - 14, 4.5, 14);
      // Horizontal lintel capstone
      ctx.strokeRect(x - 11, y - 18, 22, 4.5);

      // Intaglio shadow hatching
      ctx.lineWidth = 0.65;
      ctx.globalAlpha = 0.60;
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 13);
      ctx.lineTo(x - 5, y - 1);
      ctx.moveTo(x + 6.5, y - 13);
      ctx.lineTo(x + 6.5, y - 1);
      ctx.stroke();
    } else if (type === "tumulus") {
      // ── Ancient Burial Mound / Barrow Tumulus ──
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(x - 14, y);
      ctx.bezierCurveTo(x - 12, y - 11, x + 12, y - 11, x + 14, y);
      ctx.lineTo(x - 14, y);
      ctx.stroke();

      // Stone slab portal entrance
      ctx.fillStyle = pal.ink;
      ctx.beginPath();
      ctx.rect(x - 2.5, y - 6, 5, 6);
      ctx.fill();

      // Right shadow hatching
      ctx.lineWidth = 0.65;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (let hx = x + 2; hx < x + 12; hx += 2.5) {
        ctx.moveTo(hx, y - 7);
        ctx.lineTo(hx - 1, y);
      }
      ctx.stroke();
    } else if (type === "ruin") {
      // ── Crumbling Archway & Broken Tower ──
      ctx.lineWidth = 1.2;
      // Broken tower stump on left
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x - 10, y - 14);
      ctx.lineTo(x - 7, y - 16);
      ctx.lineTo(x - 5, y - 12);
      ctx.lineTo(x - 2, y - 15);
      ctx.lineTo(x - 2, y);
      ctx.stroke();

      // Broken gothic archway
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 11);
      ctx.bezierCurveTo(x, y - 15, x + 6, y - 15, x + 6, y - 11);
      ctx.stroke();

      // Scattered stone rubble
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x + 8, y - 3, 3, 3);
      ctx.strokeRect(x + 4, y - 2, 2, 2);
    } else {
      // ── Nomadic Pavilion Encampment ──
      ctx.lineWidth = 1.1;
      // Main central tent
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.lineTo(x, y - 12);
      ctx.lineTo(x + 7, y);
      ctx.closePath();
      ctx.stroke();

      // Central tent pennant
      ctx.beginPath();
      ctx.moveTo(x, y - 12);
      ctx.lineTo(x, y - 16);
      ctx.lineTo(x + 4, y - 14.5);
      ctx.lineTo(x, y - 13);
      ctx.stroke();

      // Flanking smaller tent
      ctx.beginPath();
      ctx.moveTo(x + 6, y);
      ctx.lineTo(x + 11, y - 8);
      ctx.lineTo(x + 16, y);
      ctx.closePath();
      ctx.stroke();
    }

    // Ground line
    ctx.lineWidth = 0.9;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(x - 13, y);
    ctx.lineTo(x + 13, y);
    ctx.stroke();

    ctx.restore();
  }
}

// ── 3. Wandering Terrestrial Beasts ────────────────────────────────────────────

class WildBeastSymbol {
  constructor(x, y, kind = "lion", seed = 0) {
    this.x = x;
    this.y = y;
    this.kind = kind; // "lion" | "camel-caravan" | "dragon" | "stag"
    this.seed = seed;
    this.avgY = y;
  }

  draw(ctx, pal, progress = 1.0) {
    if (progress <= 0) return;
    const { x, y, kind } = this;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (progress < 1.0) {
      ctx.globalAlpha = Math.min(1.0, progress * 1.35);
    }

    // Opaque mask
    ctx.fillStyle = pal.paper;
    ctx.fillRect(x - 16, y - 18, 32, 20);

    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.0;

    if (kind === "camel-caravan") {
      // Two-camel caravan traversing the desert
      this.drawCamel(ctx, x - 7, y, 0.9);
      this.drawCamel(ctx, x + 8, y, 0.8);
      // Lead rope
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(x + 1, y - 4);
      ctx.lineTo(x + 5, y - 3);
      ctx.stroke();
    } else if (kind === "lion") {
      // Prowling desert lion (heraldic / Ortelius style)
      ctx.beginPath();
      // Body & back
      ctx.moveTo(x - 10, y - 5);
      ctx.bezierCurveTo(x - 6, y - 10, x + 2, y - 8, x + 6, y - 9);
      // Head & mane
      ctx.arc(x + 7, y - 10, 3, 0, Math.PI * 2);
      // Forelegs
      ctx.moveTo(x + 5, y - 7);
      ctx.lineTo(x + 6, y);
      ctx.moveTo(x + 2, y - 7);
      ctx.lineTo(x + 3, y);
      // Hind legs
      ctx.moveTo(x - 7, y - 6);
      ctx.lineTo(x - 8, y);
      ctx.moveTo(x - 5, y - 6);
      ctx.lineTo(x - 5, y);
      // Tail curving high
      ctx.moveTo(x - 10, y - 5);
      ctx.quadraticCurveTo(x - 13, y - 14, x - 9, y - 13);
      ctx.stroke();
    } else if (kind === "dragon") {
      // Winged wyvern / desert drake ("Hic sunt dracones")
      ctx.beginPath();
      // Coiled neck & head
      ctx.moveTo(x - 8, y - 2);
      ctx.quadraticCurveTo(x - 4, y - 12, x + 2, y - 11);
      ctx.lineTo(x + 7, y - 12);
      // Wing
      ctx.moveTo(x - 3, y - 9);
      ctx.lineTo(x + 3, y - 18);
      ctx.lineTo(x + 8, y - 12);
      ctx.lineTo(x + 1, y - 9);
      // Tail
      ctx.moveTo(x - 8, y - 2);
      ctx.quadraticCurveTo(x - 14, y + 1, x - 13, y - 5);
      // Claws
      ctx.moveTo(x - 4, y - 3);
      ctx.lineTo(x - 4, y);
      ctx.moveTo(x + 1, y - 3);
      ctx.lineTo(x + 1, y);
      ctx.stroke();
    } else {
      // Grazing stag
      ctx.beginPath();
      // Body
      ctx.moveTo(x - 8, y - 6);
      ctx.lineTo(x + 4, y - 7);
      // Neck & head down to ground
      ctx.lineTo(x + 9, y - 2);
      // Antlers
      ctx.moveTo(x + 6, y - 8);
      ctx.lineTo(x + 7, y - 14);
      ctx.lineTo(x + 5, y - 12);
      ctx.moveTo(x + 7, y - 13);
      ctx.lineTo(x + 9, y - 15);
      // Legs
      ctx.moveTo(x - 6, y - 5);
      ctx.lineTo(x - 6, y);
      ctx.moveTo(x + 2, y - 6);
      ctx.lineTo(x + 2, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawCamel(ctx, cx, cy, s = 1.0) {
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    // Two humps & neck
    ctx.moveTo(cx - 7 * s, cy - 3 * s);
    ctx.quadraticCurveTo(cx - 4 * s, cy - 10 * s, cx - 1 * s, cy - 5 * s);
    ctx.quadraticCurveTo(cx + 2 * s, cy - 10 * s, cx + 5 * s, cy - 5 * s);
    ctx.lineTo(cx + 8 * s, cy - 9 * s);
    // Head
    ctx.lineTo(cx + 10 * s, cy - 9 * s);
    // Legs
    ctx.moveTo(cx - 5 * s, cy - 3 * s);
    ctx.lineTo(cx - 5 * s, cy);
    ctx.moveTo(cx + 4 * s, cy - 3 * s);
    ctx.lineTo(cx + 4 * s, cy);
    ctx.stroke();
  }
}

// ── 4. Sweeping Regional Territorial Inscription ──────────────────────────────

class RegionalTitle {
  constructor(x, y, text = "DESERTA MAGNA", angle = 0, spread = 280) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.angle = angle;
    this.spread = spread;
  }

  draw(ctx, pal, progress = 1.0) {
    if (progress <= 0) return;
    const { x, y, text, angle, spread } = this;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Archaic, widely spaced Latin capital lettering
    ctx.font = "italic 600 14px 'Cinzel', 'EB Garamond', 'Georgia', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Faded iron-gall ink wash
    ctx.fillStyle = pal.ink;
    ctx.globalAlpha = 0.32 * Math.min(1.0, progress * 1.4);

    // Distribute letters evenly across the spread
    const chars = text.split("");
    const numChars = chars.length;
    const step = spread / Math.max(1, numChars - 1);
    const startOffset = -spread * 0.5;

    for (let i = 0; i < numChars; i++) {
      const cx = startOffset + i * step;
      // Gentle arch curve across the plain
      const archY = Math.sin((i / (numChars - 1)) * Math.PI) * -8;
      ctx.fillText(chars[i], cx, archY);
    }

    ctx.restore();
  }
}

// ── 5. Main Wilderness Engine ──────────────────────────────────────────────────

class WildernessEngine {
  constructor(totalW, totalH, seed = Math.floor(Math.random() * 1000000)) {
    this.totalW = totalW;
    this.totalH = totalH;
    this.seed = seed;
    this.rng = createRNG(seed);

    this.groundTextures = []; // Grass tufts, dunes, marsh reeds
    this.landmarks = [];      // Standing stones, tumuli, ruins, camps
    this.beasts = [];         // Lions, camels, dragons, stags
    this.regionalTitles = []; // Sweeping archaic regional names
  }

  /**
   * Identifies vast empty areas and populates them with historical textures and lore
   */
  populate(coastEngine, ridges, peaks, hillsEngine, riverNetwork, settlementEngine, forestEngine, nameBucket = null) {
    const { rng, totalW, totalH } = this;
    this.groundTextures = [];
    this.landmarks = [];
    this.beasts = [];
    this.regionalTitles = [];

    const padX = totalW * 0.10;
    const padY = totalH * 0.12;

    const rivers = riverNetwork ? riverNetwork.rivers : [];
    const lakes = riverNetwork ? riverNetwork.lakes : [];
    const settlements = settlementEngine ? settlementEngine.settlements : [];
    const hills = hillsEngine ? hillsEngine.hills : [];
    const trees = forestEngine ? forestEngine.trees : [];

    function isInsideObstacle(pt, minDist = 30) {
      if (coastEngine && coastEngine.isOcean(pt, minDist * 0.5)) return true;
      for (let r of ridges) {
        if (RiverNetwork.pointInPoly(pt, r.boundingPoly)) return true;
      }
      for (let l of lakes) {
        if (Math.hypot(pt.x - l.x, pt.y - l.y) < l.radius + minDist) return true;
      }
      return false;
    }

    // ── 1. Sweeping Archaic Regional Title ───────────────────────────────────
    // Find the largest open land quadrant devoid of major mountain cordilleras
    let bestRegionCenter = null;
    let maxClearance = 0;

    for (let sample = 0; sample < 18; sample++) {
      const sx = padX + rng() * (totalW - padX * 2);
      const sy = padY + rng() * (totalH - padY * 2);
      const pt = { x: sx, y: sy };

      if (coastEngine && coastEngine.isOcean(pt, 60)) continue;

      let nearestDist = Infinity;
      for (let r of ridges) {
        const d = Math.hypot(sx - (r.startX + r.endX) * 0.5, sy - (r.startY + r.endY) * 0.5);
        if (d < nearestDist) nearestDist = d;
      }
      for (let s of settlements) {
        const d = Math.hypot(sx - s.x, sy - s.y);
        if (d < nearestDist) nearestDist = d;
      }

      if (nearestDist > maxClearance) {
        maxClearance = nearestDist;
        bestRegionCenter = pt;
      }
    }

    if (bestRegionCenter && maxClearance > 160) {
      const bucket = nameBucket || (typeof NameBucket !== "undefined" ? new NameBucket(this.seed) : null);
      const titleName = bucket ? bucket.getWildernessTitle() : REGIONAL_DESOLATION_NAMES[Math.floor(rng() * REGIONAL_DESOLATION_NAMES.length)];
      const titleAngle = (rng() - 0.5) * 0.22; // subtle slanted arch
      const spreadW = Math.min(360, Math.max(220, maxClearance * 1.3));
      this.regionalTitles.push(new RegionalTitle(bestRegionCenter.x, bestRegionCenter.y, titleName, titleAngle, spreadW));
    }

    // ── 2. Ancient Wilderness Landmarks (1 to 3 remote points of interest) ────
    const numLandmarks = 2 + Math.floor(rng() * 2);
    const landmarkTypes = ["standing-stones", "tumulus", "ruin", "nomad-camp"];

    for (let lm = 0; lm < numLandmarks; lm++) {
      let attempts = 0;
      while (attempts < 25) {
        attempts++;
        const lx = padX + rng() * (totalW - padX * 2);
        const ly = padY + rng() * (totalH - padY * 2);
        const pt = { x: lx, y: ly };

        if (isInsideObstacle(pt, 45)) continue;

        // Keep well clear of cities (at least 140px)
        let nearCity = false;
        for (let s of settlements) {
          if (Math.hypot(lx - s.x, ly - s.y) < 140) { nearCity = true; break; }
        }
        if (nearCity) continue;

        const lmType = landmarkTypes[Math.floor(rng() * landmarkTypes.length)];
        const lmSeed = this.seed + lm * 137 + attempts * 19;
        this.landmarks.push(new AncientLandmark(lx, ly, lmType, lmSeed));
        break;
      }
    }

    // ── 3. Wandering Beasts (1 to 2 rare wild creatures roaming the plains) ───
    const numBeasts = 1 + (rng() < 0.65 ? 1 : 0);
    const beastKinds = ["lion", "camel-caravan", "dragon", "stag"];

    for (let b = 0; b < numBeasts; b++) {
      let attempts = 0;
      while (attempts < 20) {
        attempts++;
        const bx = padX + rng() * (totalW - padX * 2);
        const by = padY + rng() * (totalH - padY * 2);
        const pt = { x: bx, y: by };

        if (isInsideObstacle(pt, 35)) continue;

        let nearTown = false;
        for (let s of settlements) {
          if (Math.hypot(bx - s.x, by - s.y) < 100) { nearTown = true; break; }
        }
        if (nearTown) continue;

        const kind = beastKinds[Math.floor(rng() * beastKinds.length)];
        const bSeed = this.seed + b * 251 + attempts * 13;
        this.beasts.push(new WildBeastSymbol(bx, by, kind, bSeed));
        break;
      }
    }

    // ── 4. Ground Micro-Textures: Grass Tufts, Sand Dunes & Marsh Reeds ───────
    // A. Grass Tufts across valleys and plains (60 to 110 tufts)
    const numTufts = 70 + Math.floor(rng() * 45);
    for (let gt = 0; gt < numTufts; gt++) {
      const gx = padX + rng() * (totalW - padX * 2);
      const gy = padY + rng() * (totalH - padY * 2);
      const pt = { x: gx, y: gy };

      if (coastEngine && coastEngine.isOcean(pt, 12)) continue;

      let inRidge = false;
      for (let r of ridges) {
        if (RiverNetwork.pointInPoly(pt, r.boundingPoly)) { inRidge = true; break; }
      }
      if (inRidge) continue;

      const tuftSeed = this.seed + gt * 31;
      this.groundTextures.push(new GrassTuft(gx, gy, 0.85 + rng() * 0.35, tuftSeed));
    }

    // B. Sand Dunes in Arid Open Wastes (20 to 35 dune ripples)
    if (bestRegionCenter) {
      const numDunes = 22 + Math.floor(rng() * 14);
      for (let d = 0; d < numDunes; d++) {
        const angle = rng() * Math.PI * 2;
        const rad = rng() * (maxClearance * 0.75);
        const dx = bestRegionCenter.x + Math.cos(angle) * rad;
        const dy = bestRegionCenter.y + Math.sin(angle) * (rad * 0.75);
        const pt = { x: dx, y: dy };

        if (coastEngine && coastEngine.isOcean(pt, 16)) continue;

        let inRidge = false;
        for (let r of ridges) {
          if (RiverNetwork.pointInPoly(pt, r.boundingPoly)) { inRidge = true; break; }
        }
        if (inRidge) continue;

        const dSeed = this.seed + d * 47;
        this.groundTextures.push(new DuneRipple(dx, dy, 14 + rng() * 12, dSeed));
      }
    }

    // C. Wetland Marsh Reeds near River Reaches and Lake Perimeters (15 to 30)
    for (let l of lakes) {
      const numReeds = 5 + Math.floor(rng() * 5);
      for (let mr = 0; mr < numReeds; mr++) {
        const a = rng() * Math.PI * 2;
        const dist = l.radius + 6 + rng() * 18;
        const mx = l.x + Math.cos(a) * (dist * l.stretchX * 0.85);
        const my = l.y + Math.sin(a) * (dist * l.stretchY * 0.85);
        if (coastEngine && coastEngine.isOcean({ x: mx, y: my }, 10)) continue;
        this.groundTextures.push(new MarshReeds(mx, my, 0.85 + rng() * 0.3, this.seed + mr * 19));
      }
    }
  }

  /**
   * Draws all wilderness desolation elements: landmarks, roaming beasts, ground textures, and regional titles
   */
  draw(ctx, pal, progress = 1.0) {
    if (progress <= 0) return;

    // 1. Megaliths and ancient ruins (0.00 -> 0.60)
    if (this.landmarks.length > 0) {
      const totalLm = this.landmarks.length;
      for (let i = 0; i < totalLm; i++) {
        const start = (i / totalLm) * 0.50;
        if (progress < start) continue;
        const p = Math.min(1.0, (progress - start) / 0.35);
        this.landmarks[i].draw(ctx, pal, p);
      }
    }

    // 2. Roaming beasts (0.20 -> 0.80)
    if (this.beasts.length > 0) {
      const totalB = this.beasts.length;
      for (let i = 0; i < totalB; i++) {
        const start = 0.20 + (i / totalB) * 0.50;
        if (progress < start) continue;
        const p = Math.min(1.0, (progress - start) / 0.35);
        this.beasts[i].draw(ctx, pal, p);
      }
    }

    // 3. Ground micro-textures (0.30 -> 0.90)
    if (progress > 0.30) {
      const gtProg = Math.min(1.0, (progress - 0.30) / 0.60);
      const visibleGt = Math.floor(this.groundTextures.length * gtProg);
      for (let i = 0; i < visibleGt; i++) {
        this.groundTextures[i].draw(ctx, pal);
      }
    }

    // 4. Regional Latin titles (0.50 -> 1.00)
    if (progress > 0.50) {
      const titleProg = (progress - 0.50) / 0.50;
      for (let rt of this.regionalTitles) {
        rt.draw(ctx, pal, titleProg);
      }
    }
  }

  /**
   * Draws ground textures (tufts, dunes, reeds) and regional Latin titles on the terrain surface
   */
  drawGround(ctx, pal, progress = 1.0) {
    this.draw(ctx, pal, progress);
  }
}
