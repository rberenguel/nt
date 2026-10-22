// Procedural Antique Fantasy Cartography — Settlements & Cities Engine
// Features:
// 1. Procedural 16th-century copperplate intaglio town silhouettes with high building variety:
//    - "city": Walled imperial citadel with varied towers, cathedrals, domes, spires, and gables.
//    - "town": Compact borough with randomized clusters of timber gables and belfry watchtowers.
//    - "keep": Stone fortress / bastion keep guarding mountain passes with battlements & pennants.
//    - "port": Coastal haven with lighthouse, waterfront warehouses, wooden pier, and rigged ship.
// 2. High-randomness procedural building blueprints generated per seed.
// 3. Antique miniature cartouche scroll banner with double-line borders and swallow-tail ribbons.
// 4. Opaque parchment masks for strict Z-depth occlusion.

const SETTLEMENT_NAMES = [
  "Nessus", "Thrax", "Saltus", "Orixa", "Volex", "Phaedrus", "Tyana",
  "Alverna", "Arx Aquilae", "Portus Aureus", "Castellum Umbrae", "Novum Castrum",
  "Mons Solaris", "Vallis Aurea", "Turris Stellae", "Rhyncolis", "Caelestis",
  "Portus Lunae", "Aethelgard", "Pont-le-Roi", "Astraea", "Marrowgate",
  "Kestrel", "Val d'Or", "Ironhaven", "Silverkeep", "Lorn", "Highwater"
];

class SettlementSymbol {
  constructor(x, y, type = "town", name = "Urbs", seed = 0) {
    this.x = x;
    this.y = y; // Ground contact base
    this.type = type; // "city" | "town" | "keep" | "port"
    this.name = name;
    this.seed = seed;
    this.rng = createRNG(seed);
    this.avgY = y;

    this.initBlueprint();
  }

  /**
   * Generates a procedural architectural blueprint with rich randomness per seed.
   */
  initBlueprint() {
    const { rng, type } = this;

    if (type === "city") {
      // ── IMPERIAL CAPITAL CITADEL ──
      this.width = 40 + Math.floor(rng() * 12); // 40px to 52px wide
      this.height = 26 + Math.floor(rng() * 8);  // 26px to 34px high
      this.wallHeight = this.height * (0.35 + rng() * 0.12);
      this.gateWidth = 7 + Math.floor(rng() * 3);
      this.gateHeight = 7 + Math.floor(rng() * 3);
      this.gateStyle = rng() < 0.5 ? "round" : "gothic";

      // 4 to 7 randomized buildings & towers
      this.numBuildings = 4 + Math.floor(rng() * 4);
      this.buildings = [];

      const halfW = this.width * 0.5;
      const slotWidth = (this.width - 8) / this.numBuildings;

      // Ensure at least one grand cathedral / central spire tower
      const cathedralIdx = Math.floor(rng() * (this.numBuildings - 2)) + 1;

      for (let i = 0; i < this.numBuildings; i++) {
        const bx = -halfW + 4 + i * slotWidth + (rng() - 0.5) * (slotWidth * 0.35);
        const isCathedral = i === cathedralIdx;

        let bw, bh, roofType, finial;
        if (isCathedral) {
          bw = 8 + Math.floor(rng() * 4);
          bh = this.height * (0.85 + rng() * 0.15); // tallest structure
          const roofs = ["spire", "steeple", "dome", "belfry"];
          roofType = roofs[Math.floor(rng() * roofs.length)];
          finial = rng() < 0.55 ? "cross" : "pennant";
        } else {
          bw = 6 + Math.floor(rng() * 4);
          bh = this.wallHeight + (this.height - this.wallHeight) * (0.25 + rng() * 0.65);
          const roofs = ["gable", "steeple", "flat-crenellated", "gable", "round-cap"];
          roofType = roofs[Math.floor(rng() * roofs.length)];
          finial = rng() < 0.30 ? "pennant" : "none";
        }

        this.buildings.push({
          relX: bx,
          w: bw,
          h: bh,
          roofType,
          finial,
          shadowHatch: true,
        });
      }

      // Sort buildings so taller ones sit slightly behind or layer naturally
      this.buildings.sort((a, b) => b.h - a.h);
    } else if (type === "town") {
      // ── WALLED BOROUGH / TOWN ──
      this.width = 28 + Math.floor(rng() * 10); // 28px to 38px
      this.height = 19 + Math.floor(rng() * 6);  // 19px to 25px
      this.wallHeight = this.height * (0.32 + rng() * 0.10);

      // 3 to 5 randomized buildings
      this.numBuildings = 3 + Math.floor(rng() * 3);
      this.buildings = [];

      const halfW = this.width * 0.5;
      const slotWidth = (this.width - 6) / this.numBuildings;
      const towerIdx = Math.floor(rng() * this.numBuildings);

      for (let i = 0; i < this.numBuildings; i++) {
        const bx = -halfW + 3 + i * slotWidth + (rng() - 0.5) * (slotWidth * 0.30);
        const isTower = i === towerIdx;

        let bw, bh, roofType, finial;
        if (isTower) {
          bw = 6 + Math.floor(rng() * 3);
          bh = this.height * (0.75 + rng() * 0.25);
          roofType = rng() < 0.6 ? "steeple" : "flat-crenellated";
          finial = rng() < 0.4 ? "pennant" : "none";
        } else {
          bw = 6 + Math.floor(rng() * 4);
          bh = this.wallHeight + (this.height - this.wallHeight) * (0.20 + rng() * 0.55);
          roofType = "gable";
          finial = "none";
        }

        this.buildings.push({
          relX: bx,
          w: bw,
          h: bh,
          roofType,
          finial,
          shadowHatch: true,
        });
      }
      this.buildings.sort((a, b) => b.h - a.h);
    } else if (type === "keep") {
      // ── MOUNTAIN FORTRESS / KEEP ──
      this.width = 24 + Math.floor(rng() * 8); // 24px to 32px
      this.height = 24 + Math.floor(rng() * 8); // 24px to 32px
      this.keepStyle = rng() < 0.5 ? "square-donjon" : "twin-bastion";
      this.bannerLength = 6 + Math.floor(rng() * 5);
      this.numSlits = 2 + Math.floor(rng() * 2);
    } else {
      // ── MARITIME PORT / HAVEN ──
      this.width = 32 + Math.floor(rng() * 10); // 32px to 42px
      this.height = 22 + Math.floor(rng() * 6);  // 22px to 28px
      this.pierSide = rng() < 0.5 ? "right" : "left";
      this.pierLength = 14 + Math.floor(rng() * 8);
      this.numWarehouses = 2 + Math.floor(rng() * 2);
      this.shipMasts = rng() < 0.55 ? 2 : 1;
    }
  }

  draw(ctx, palette, progress = 1.0) {
    if (progress <= 0) return;
    const { x, y, width, height, type } = this;
    const halfW = width * 0.5;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (progress < 1.0) {
      // Reveal architecture rising upward from baseline
      const revealH = (height + 12) * Math.min(1.0, progress * 1.15);
      ctx.beginPath();
      ctx.rect(x - halfW - 12, y - revealH, width + 24, revealH + 8);
      ctx.clip();
      ctx.globalAlpha = Math.min(1.0, progress * 1.25);
    }

    // 1. Opaque paper mask covering the footprint and buildings
    ctx.fillStyle = palette.paper;
    ctx.beginPath();
    ctx.rect(x - halfW - 4, y - height - 4, width + 8, height + 6);
    ctx.fill();

    // 2. Render settlement architecture by type
    if (type === "city") {
      this.drawCity(ctx, palette);
    } else if (type === "keep") {
      this.drawKeep(ctx, palette);
    } else if (type === "port") {
      this.drawPort(ctx, palette);
    } else {
      this.drawTown(ctx, palette);
    }

    // 3. Ground baseline and entrance path
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.15;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(x - halfW - 4, y);
    ctx.lineTo(x + halfW + 4, y);
    ctx.stroke();

    ctx.restore();
  }

  drawCity(ctx, pal) {
    const { x, y, width, height, wallHeight, buildings, gateWidth, gateHeight, gateStyle } = this;
    const halfW = width * 0.5;

    // Right-side delicate watercolor shadow wash
    if (pal.shadowWash) {
      ctx.fillStyle = pal.shadowWash;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(x, y - height, halfW + 2, height);
      ctx.globalAlpha = 1.0;
    }

    // 1. Draw procedural buildings and steeples first (sitting within/behind walls)
    for (let b of buildings) {
      this.drawBuilding(ctx, x + b.relX, y, b.w, b.h, b.roofType, b.finial, pal);
    }

    // 2. Perimeter Stone Curtain Wall
    const wallTop = y - wallHeight;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.25;

    ctx.beginPath();
    ctx.moveTo(x - halfW, y);
    ctx.lineTo(x - halfW, wallTop);
    ctx.lineTo(x + halfW, wallTop);
    ctx.lineTo(x + halfW, y);
    ctx.stroke();

    // Crenellations along ramparts
    ctx.lineWidth = 0.85;
    const cStep = 4.5;
    for (let cx = x - halfW + 2; cx < x + halfW - 3; cx += cStep * 1.8) {
      ctx.strokeRect(cx, wallTop - 2.5, cStep, 2.5);
    }

    // Arched Gatehouse
    const gx = x;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (gateStyle === "round") {
      ctx.arc(gx, y, gateWidth * 0.5, Math.PI, 0);
    } else {
      ctx.moveTo(gx - gateWidth * 0.5, y);
      ctx.lineTo(gx - gateWidth * 0.5, y - gateHeight * 0.6);
      ctx.lineTo(gx, y - gateHeight);
      ctx.lineTo(gx + gateWidth * 0.5, y - gateHeight * 0.6);
      ctx.lineTo(gx + gateWidth * 0.5, y);
    }
    ctx.stroke();

    // Portcullis iron bars
    ctx.lineWidth = 0.65;
    ctx.globalAlpha = 0.60;
    ctx.beginPath();
    ctx.moveTo(gx - 1.5, y - gateHeight * 0.7);
    ctx.lineTo(gx - 1.5, y);
    ctx.moveTo(gx + 1.5, y - gateHeight * 0.7);
    ctx.lineTo(gx + 1.5, y);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Shadow etching on right wall flank
    ctx.lineWidth = 0.75;
    ctx.globalAlpha = 0.60;
    ctx.beginPath();
    for (let hx = gx + gateWidth * 0.5 + 2; hx < x + halfW - 1; hx += 2.4) {
      ctx.moveTo(hx, wallTop + 1);
      ctx.lineTo(hx, y - 1);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  drawTown(ctx, pal) {
    const { x, y, width, height, wallHeight, buildings } = this;
    const halfW = width * 0.5;

    // Draw buildings
    for (let b of buildings) {
      this.drawBuilding(ctx, x + b.relX, y, b.w, b.h, b.roofType, b.finial, pal);
    }

    // Low stone boundary wall
    const wallTop = y - wallHeight * 0.8;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(x - halfW, y);
    ctx.lineTo(x - halfW, wallTop);
    ctx.lineTo(x + halfW, wallTop);
    ctx.lineTo(x + halfW, y);
    ctx.stroke();

    // Gate opening
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(x, y, 3, Math.PI, 0);
    ctx.stroke();
  }

  drawBuilding(ctx, bx, by, bw, bh, roofType, finial, pal) {
    const bHalfW = bw * 0.5;
    const eaveY = by - bh * 0.62;
    const roofApexY = by - bh;

    ctx.save();
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.05;

    // Building body walls
    ctx.beginPath();
    ctx.moveTo(bx - bHalfW, by);
    ctx.lineTo(bx - bHalfW, eaveY);
    ctx.lineTo(bx + bHalfW, eaveY);
    ctx.lineTo(bx + bHalfW, by);
    ctx.stroke();

    // Roof styles
    if (roofType === "spire") {
      // Tall needle cathedral spire
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(bx - bHalfW, eaveY);
      ctx.lineTo(bx - bHalfW * 0.7, eaveY - (bh - bh * 0.62) * 0.4);
      ctx.lineTo(bx, roofApexY);
      ctx.lineTo(bx + bHalfW * 0.7, eaveY - (bh - bh * 0.62) * 0.4);
      ctx.lineTo(bx + bHalfW, eaveY);
      ctx.stroke();
    } else if (roofType === "dome") {
      // Rounded cathedral dome
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.arc(bx, eaveY, bHalfW, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx, eaveY - bHalfW);
      ctx.lineTo(bx, roofApexY);
      ctx.stroke();
    } else if (roofType === "steeple" || roofType === "round-cap") {
      // Pointed conical/pyramidal steeple
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(bx - bHalfW - 0.5, eaveY);
      ctx.lineTo(bx, roofApexY);
      ctx.lineTo(bx + bHalfW + 0.5, eaveY);
      ctx.closePath();
      ctx.stroke();
    } else if (roofType === "flat-crenellated") {
      // Flat battlemented watchtower
      ctx.strokeRect(bx - bHalfW - 1, eaveY - 2.5, bw + 2, 2.5);
      ctx.strokeRect(bx - bHalfW - 1, eaveY - 4.5, 2.5, 2);
      ctx.strokeRect(bx + bHalfW - 1.5, eaveY - 4.5, 2.5, 2);
    } else {
      // "gable": Classic pitched triangular roof
      ctx.beginPath();
      ctx.moveTo(bx - bHalfW - 0.5, eaveY);
      ctx.lineTo(bx, roofApexY);
      ctx.lineTo(bx + bHalfW + 0.5, eaveY);
      ctx.stroke();
    }

    // Finials (cross or pennant banner)
    if (finial === "cross") {
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(bx, roofApexY - 4.5);
      ctx.lineTo(bx, roofApexY);
      ctx.moveTo(bx - 2, roofApexY - 3);
      ctx.lineTo(bx + 2, roofApexY - 3);
      ctx.stroke();
    } else if (finial === "pennant") {
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(bx, roofApexY - 5);
      ctx.lineTo(bx, roofApexY);
      ctx.lineTo(bx + 4, roofApexY - 3.5);
      ctx.lineTo(bx, roofApexY - 2);
      ctx.stroke();
    }

    // Shadow hatching on right side of building
    ctx.lineWidth = 0.65;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let hx = bx + 1; hx < bx + bHalfW; hx += 2.0) {
      ctx.moveTo(hx, eaveY + 1);
      ctx.lineTo(hx, by - 1);
    }
    ctx.stroke();

    ctx.restore();
  }

  drawKeep(ctx, pal) {
    const { x, y, width, height, keepStyle, bannerLength, numSlits } = this;
    const halfW = width * 0.5;

    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.25;

    if (keepStyle === "twin-bastion") {
      // Twin-tower fortress with central curtain
      const tW = 8;
      // Left tower
      ctx.strokeRect(x - halfW, y - height, tW, height);
      ctx.strokeRect(x - halfW - 1, y - height - 2.5, tW + 2, 2.5);

      // Right tower
      ctx.strokeRect(x + halfW - tW, y - height, tW, height);
      ctx.strokeRect(x + halfW - tW - 1, y - height - 2.5, tW + 2, 2.5);

      // Central curtain wall
      ctx.strokeRect(x - halfW + tW, y - height * 0.55, width - tW * 2, height * 0.55);

      // Banner pole on left tower
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(x - halfW + 4, y - height - 2.5);
      ctx.lineTo(x - halfW + 4, y - height - 2.5 - bannerLength);
      ctx.lineTo(x - halfW + 4 + bannerLength * 0.75, y - height - 2.5 - bannerLength * 0.7);
      ctx.lineTo(x - halfW + 4, y - height - 2.5 - bannerLength * 0.4);
      ctx.stroke();
    } else {
      // Imposing square Donjon
      const keepW = width * 0.65;
      const kx = x - keepW * 0.5;
      const ky = y - height;

      ctx.strokeRect(kx, ky, keepW, height);
      // Crenellated parapet
      ctx.strokeRect(kx - 1.5, ky - 3, keepW + 3, 3);
      ctx.strokeRect(kx - 1.5, ky - 5.5, 3.5, 2.5);
      ctx.strokeRect(kx + keepW - 2, ky - 5.5, 3.5, 2.5);

      // Central flagpole & pennant
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x, ky - 5.5);
      ctx.lineTo(x, ky - 5.5 - bannerLength);
      ctx.lineTo(x + bannerLength * 0.85, ky - 5.5 - bannerLength * 0.65);
      ctx.lineTo(x, ky - 5.5 - bannerLength * 0.3);
      ctx.stroke();

      // Arrow slits
      ctx.lineWidth = 1.0;
      for (let s = 1; s <= numSlits; s++) {
        const sy = ky + 5 + s * 6;
        ctx.beginPath();
        ctx.moveTo(x, sy);
        ctx.lineTo(x, sy + 3.5);
        ctx.stroke();
      }

      // Shadow etching on right facet
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = 0.60;
      ctx.beginPath();
      for (let hx = x + 1; hx < kx + keepW - 1; hx += 2.2) {
        ctx.moveTo(hx, ky + 1);
        ctx.lineTo(hx, y - 1);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
  }

  drawPort(ctx, pal) {
    const { x, y, width, height, pierSide, pierLength, numWarehouses, shipMasts } = this;
    const halfW = width * 0.5;

    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.2;

    const isLeft = pierSide === "left";
    const ltX = isLeft ? x + halfW - 8 : x - halfW + 2;

    // Lighthouse / sea tower
    ctx.strokeRect(ltX, y - height * 0.85, 7, height * 0.85);
    ctx.beginPath();
    ctx.arc(ltX + 3.5, y - height * 0.85, 3.5, Math.PI, 0);
    ctx.stroke();
    // Beacon finial
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(ltX + 3.5, y - height * 0.85 - 3.5);
    ctx.lineTo(ltX + 3.5, y - height * 0.85 - 7);
    ctx.stroke();

    // Waterfront gabled warehouses
    ctx.lineWidth = 1.05;
    const whStart = isLeft ? x - halfW + 2 : ltX + 9;
    const wStep = 9;
    for (let w = 0; w < numWarehouses; w++) {
      const wx = whStart + w * wStep;
      const whH = height * (0.42 + (w % 2) * 0.12);
      ctx.beginPath();
      ctx.moveTo(wx, y);
      ctx.lineTo(wx, y - whH * 0.6);
      ctx.lineTo(wx + 4.5, y - whH);
      ctx.lineTo(wx + 9, y - whH * 0.6);
      ctx.lineTo(wx + 9, y);
      ctx.stroke();
    }

    // Wooden jetty / pier extending into the water
    ctx.lineWidth = 1.2;
    const pierStartX = isLeft ? x - halfW + 2 : x + halfW - 4;
    const pierEndX = isLeft ? pierStartX - pierLength : pierStartX + pierLength;

    ctx.beginPath();
    ctx.moveTo(pierStartX, y + 1);
    ctx.lineTo(pierEndX, y + 1);
    // Pier pilings
    const numPilings = 4;
    for (let p = 1; p <= numPilings; p++) {
      const px = pierStartX + (pierEndX - pierStartX) * (p / (numPilings + 1));
      ctx.moveTo(px, y + 1);
      ctx.lineTo(px, y + 5.5);
    }
    ctx.stroke();

    // Moored Caravel / Rigged Vessel at pier
    ctx.lineWidth = 0.95;
    const shipX = pierEndX + (isLeft ? -4 : 4);
    ctx.beginPath();
    ctx.moveTo(shipX - 4, y + 2);
    ctx.lineTo(shipX + 6, y + 2);
    ctx.lineTo(shipX + 4, y + 5.5);
    ctx.lineTo(shipX - 2, y + 5.5);
    ctx.closePath();
    ctx.stroke();

    // Masts & rigging
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(shipX + 1, y + 2);
    ctx.lineTo(shipX + 1, y - 7);
    ctx.lineTo(shipX + 4, y - 5); // mast pennant

    if (shipMasts === 2) {
      ctx.moveTo(shipX - 2, y + 2);
      ctx.lineTo(shipX - 2, y - 5);
    }
    ctx.stroke();
  }

  /**
   * Classical Miniature Cartouche Scroll Banner Inscription
   */
  drawCartoucheLabel(ctx, pal, progress = 1.0) {
    if (progress <= 0) return;
    const { x, y, name, type } = this;
    ctx.save();
    if (progress < 1.0) {
      ctx.globalAlpha = Math.min(1.0, progress * 1.35);
    } else {
      ctx.globalAlpha = 1.0;
    }

    // Typography: larger, bold, authentic antique serif
    const isMajor = type === "city";
    const fontSize = isMajor ? 13 : 11.5;
    ctx.font = `600 ${fontSize}px 'Cinzel', 'Cormorant Garamond', 'EB Garamond', 'Georgia', serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const textMetrics = ctx.measureText(name);
    const textW = textMetrics.width;

    const padH = isMajor ? 12 : 9;
    const boxW = Math.max(textW + padH * 2, isMajor ? 52 : 42);
    const boxH = isMajor ? 18 : 15;
    // Lowered comfortably below the city ground line and gate (no obscuring the city)
    const boxY = y + (isMajor ? 19 : 16);
    const boxHalfW = boxW * 0.5;

    // 1. Ribbon Swallow-Tail Ends extending left and right
    const ribbonTailW = isMajor ? 9 : 7;
    const ribbonNotch = isMajor ? 4 : 3;

    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.05;
    ctx.fillStyle = pal.paper;

    // Left swallow-tail ribbon
    ctx.beginPath();
    ctx.moveTo(x - boxHalfW, boxY - boxH * 0.5 + 2);
    ctx.lineTo(x - boxHalfW - ribbonTailW, boxY - boxH * 0.5);
    ctx.lineTo(x - boxHalfW - ribbonTailW + ribbonNotch, boxY);
    ctx.lineTo(x - boxHalfW - ribbonTailW, boxY + boxH * 0.5);
    ctx.lineTo(x - boxHalfW, boxY + boxH * 0.5 - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right swallow-tail ribbon
    ctx.beginPath();
    ctx.moveTo(x + boxHalfW, boxY - boxH * 0.5 + 2);
    ctx.lineTo(x + boxHalfW + ribbonTailW, boxY - boxH * 0.5);
    ctx.lineTo(x + boxHalfW + ribbonTailW - ribbonNotch, boxY);
    ctx.lineTo(x + boxHalfW + ribbonTailW, boxY + boxH * 0.5);
    ctx.lineTo(x + boxHalfW, boxY + boxH * 0.5 - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Central Cartouche Plaque Body (100% Opaque Paper Mask)
    ctx.fillStyle = pal.paper;
    ctx.fillRect(x - boxHalfW, boxY - boxH * 0.5, boxW, boxH);

    // 3. Double-line antique engraved border (100% opacity)
    // Outer border
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x - boxHalfW, boxY - boxH * 0.5, boxW, boxH);

    // Inner hairline border
    ctx.lineWidth = 0.55;
    const inset = 2.0;
    ctx.strokeRect(x - boxHalfW + inset, boxY - boxH * 0.5 + inset, boxW - inset * 2, boxH - inset * 2);

    // Corner decorative tick florets
    const cr = inset + 1.5;
    ctx.beginPath();
    ctx.moveTo(x - boxHalfW + cr, boxY - boxH * 0.5 + inset);
    ctx.lineTo(x - boxHalfW + inset, boxY - boxH * 0.5 + cr);
    ctx.moveTo(x + boxHalfW - cr, boxY - boxH * 0.5 + inset);
    ctx.lineTo(x + boxHalfW - inset, boxY - boxH * 0.5 + cr);
    ctx.moveTo(x - boxHalfW + cr, boxY + boxH * 0.5 - inset);
    ctx.lineTo(x - boxHalfW + inset, boxY + boxH * 0.5 - cr);
    ctx.moveTo(x + boxHalfW - cr, boxY + boxH * 0.5 - inset);
    ctx.lineTo(x + boxHalfW - inset, boxY + boxH * 0.5 - cr);
    ctx.stroke();

    // 4. Inscribed Name Lettering (100% solid opacity)
    ctx.fillStyle = pal.ink;
    ctx.fillText(name, x, boxY + 0.5);

    ctx.restore();
  }
}

class SettlementEngine {
  constructor(totalW, totalH, seed = Math.floor(Math.random() * 1000000)) {
    this.totalW = totalW;
    this.totalH = totalH;
    this.seed = seed;
    this.rng = createRNG(seed);
    this.settlements = [];
  }

  /**
   * Draws settlements one by one sequentially:
   * Architecture rises in first 65% of window, then cartouche banner & Latin name inscribe!
   */
  draw(ctx, palette, progress = 1.0) {
    if (!this.settlements || this.settlements.length === 0 || progress <= 0) return;

    const total = this.settlements.length;
    const timePerSettlement = 1.0 / total;

    for (let i = 0; i < total; i++) {
      const sStart = i * timePerSettlement;
      if (progress < sStart) break;

      const sProg = Math.min(1.0, (progress - sStart) / timePerSettlement);
      const s = this.settlements[i];

      // 1. Architecture draws in the first 65% of its window
      const archProg = Math.min(1.0, sProg / 0.65);
      s.draw(ctx, palette, archProg);

      // 2. Banner & Latin name reveal in remaining 35%
      if (sProg > 0.65) {
        const labelProg = (sProg - 0.65) / 0.35;
        s.drawCartoucheLabel(ctx, palette, labelProg);
      }
    }
  }

  /**
   * Draws all settlement cartouche banners on top of all terrain with 100% opacity
   */
  drawLabels(ctx, pal, progress = 1.0) {
    if (!this.settlements || this.settlements.length === 0 || progress <= 0) return;

    const total = this.settlements.length;
    const timePerSettlement = 1.0 / total;

    for (let i = 0; i < total; i++) {
      const sStart = i * timePerSettlement;
      if (progress < sStart) break;

      const sProg = Math.min(1.0, (progress - sStart) / timePerSettlement);
      if (sProg > 0.65) {
        const labelProg = (sProg - 0.65) / 0.35;
        this.settlements[i].drawCartoucheLabel(ctx, pal, labelProg);
      }
    }
  }

  /**
   * Places settlements organically across the realm:
   * 1. Maritime Ports at river mouths and protected bays.
   * 2. Imperial Capital at a major river bend, confluence, or lakehead.
   * 3. Walled Towns in fertile valley plains.
   * 4. Mountain Fortresses / Keeps at foothill passes.
   */
  populateSettlements(coastEngine, ridges, riverNetwork, lakes, hillsEngine, nameBucket = null) {
    const { rng, totalW, totalH } = this;
    this.settlements = [];
    const bucket = nameBucket || (typeof NameBucket !== "undefined" ? new NameBucket(this.seed) : null);
    const usedNames = new Set();

    const getName = (sRng) => {
      if (bucket) {
        return bucket.getSettlementName();
      }
      for (let i = 0; i < 30; i++) {
        const n = SETTLEMENT_NAMES[Math.floor(sRng() * SETTLEMENT_NAMES.length)];
        if (!usedNames.has(n)) {
          usedNames.add(n);
          return n;
        }
      }
      return SETTLEMENT_NAMES[0];
    };

    const rivers = riverNetwork ? riverNetwork.rivers : [];

    // ── 1. Maritime Ports at River Estuaries or Coastal Embayments ──────────
    const estuaryRivers = rivers.filter(r => r.isSeaEstuary && r.points.length > 5);
    for (let er of estuaryRivers) {
      if (this.settlements.length >= 2) break;
      const lastPt = er.points[er.points.length - 1];
      const prevPt = er.points[Math.max(0, er.points.length - 4)];
      const dx = lastPt.x - prevPt.x;
      const dy = lastPt.y - prevPt.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      // Place port right on the coastal riverbank
      const portX = lastPt.x + nx * 16;
      const portY = lastPt.y + ny * 16;

      if (portX > 40 && portX < totalW - 40 && portY > 40 && portY < totalH - 40) {
        const pSeed = this.seed + 100 + this.settlements.length * 37;
        this.settlements.push(new SettlementSymbol(portX, portY, "port", getName(rng), pSeed));
      }
    }

    // ── 2. Imperial Capital City at Confluence, Lakehead, or River Bend ────
    let capitalPlaced = false;
    // Prefer lake mouth if a lake exists
    if (lakes && lakes.length > 0) {
      const lake = lakes[0];
      const cx = lake.x + (rng() - 0.5) * (lake.radius * 0.7);
      const cy = lake.y + lake.radius + 20;
      if (!coastEngine || !coastEngine.isOcean({ x: cx, y: cy }, 24)) {
        const cSeed = this.seed + 200;
        this.settlements.push(new SettlementSymbol(cx, cy, "city", getName(rng), cSeed));
        capitalPlaced = true;
      }
    }

    // Otherwise place at major river mid-point
    if (!capitalPlaced && rivers.length > 0) {
      const primaryRiver = rivers[0];
      const midIdx = Math.floor(primaryRiver.points.length * 0.50);
      const pt = primaryRiver.points[midIdx];
      const cx = pt.x + 24;
      const cy = pt.y + 12;
      if (!coastEngine || !coastEngine.isOcean({ x: cx, y: cy }, 24)) {
        const cSeed = this.seed + 200;
        this.settlements.push(new SettlementSymbol(cx, cy, "city", getName(rng), cSeed));
        capitalPlaced = true;
      }
    }

    // ── 3. Walled Towns in Valley Plains & River Reaches ────────────────────
    const numTowns = 2 + Math.floor(rng() * 3); // 2 to 4 towns
    let townAttempts = 0;
    while (this.settlements.filter(s => s.type === "town").length < numTowns && townAttempts < 40) {
      townAttempts++;
      let tx, ty;

      // 60% chance: along a secondary river
      if (rivers.length > 1 && rng() < 0.60) {
        const riv = rivers[1 + Math.floor(rng() * (rivers.length - 1))];
        const rPt = riv.points[Math.floor(riv.points.length * (0.35 + rng() * 0.40))];
        tx = rPt.x + (rng() < 0.5 ? -26 : 26);
        ty = rPt.y + (rng() - 0.5) * 18;
      } else {
        // In open fertile plains
        tx = totalW * 0.12 + rng() * (totalW * 0.76);
        ty = totalH * 0.15 + rng() * (totalH * 0.70);
      }

      const pt = { x: tx, y: ty };
      if (coastEngine && coastEngine.isOcean(pt, 28)) continue;

      // Check ridges
      let inRidge = false;
      for (let r of ridges) {
        if (RiverNetwork.pointInPoly(pt, r.boundingPoly)) { inRidge = true; break; }
      }
      if (inRidge) continue;

      // Distance from other settlements
      let tooClose = false;
      for (let s of this.settlements) {
        if (Math.hypot(tx - s.x, ty - s.y) < 140) { tooClose = true; break; }
      }
      if (tooClose) continue;

      const tSeed = this.seed + 300 + this.settlements.length * 41;
      this.settlements.push(new SettlementSymbol(tx, ty, "town", getName(rng), tSeed));
    }

    // ── 4. Mountain Fortresses / Keeps Guarding Passes ──────────────────────
    const numKeeps = 1 + Math.floor(rng() * 2); // 1 to 2 keeps
    for (let k = 0; k < numKeeps; k++) {
      if (ridges.length === 0) break;
      const ridge = ridges[Math.floor(rng() * ridges.length)];
      if (!ridge.facets || ridge.facets.length === 0) continue;

      const facet = ridge.facets[Math.floor(ridge.facets.length * (0.20 + rng() * 0.60))];
      const side = rng() < 0.5 ? facet.leftEndA : facet.rightEndA;
      const kx = side.x + (rng() - 0.5) * 20;
      const ky = side.y + 18 + rng() * 14;

      if (coastEngine && coastEngine.isOcean({ x: kx, y: ky }, 22)) continue;

      let tooClose = false;
      for (let s of this.settlements) {
        if (Math.hypot(kx - s.x, ky - s.y) < 120) { tooClose = true; break; }
      }
      if (tooClose) continue;

      const kSeed = this.seed + 500 + k * 53;
      this.settlements.push(new SettlementSymbol(kx, ky, "keep", getName(rng), kSeed));
    }
  }
}
