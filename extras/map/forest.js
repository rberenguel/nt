// Procedural Hand-Drawn Cartographic Forest & Tree Engine
// Tolkien & Dyson Logos style:
// - Deciduous trees (rounded bumpy crowns with small trunks and shadow hatching on right)
// - Conifer / Pine trees (layered triangular / serrated crowns)
// - Clustered in organic woodland groves along mountain foothills and riverbanks
// - Each tree has an opaque paper mask to cleanly occlude trees behind it (Z-depth)

class ForestEngine {
  constructor(totalW, totalH, seed = Math.floor(Math.random() * 1000000)) {
    this.totalW = totalW;
    this.totalH = totalH;
    this.seed = seed;
    this.rng = createRNG(seed);
    this.trees = []; // Individual tree symbols for Z-sorted rendering
  }

  /**
   * Generate an organic woodland grove clustered around an anchor point
   * (e.g. In foothills or near a river bend)
   */
  generateGrove(anchorX, anchorY, radius = 45, style = "deciduous", density = 18) {
    const { rng } = this;
    const groveSeed = this.seed + Math.floor(anchorX * 13 + anchorY * 31);
    const groveRng = createRNG(groveSeed);

    for (let i = 0; i < density; i++) {
      // Clustered Gaussian-like distribution around anchor
      const u = groveRng() + groveRng() - 1.0;
      const v = groveRng() + groveRng() - 1.0;
      const dist = Math.hypot(u, v);
      if (dist > 1.0) continue;

      // Oblique cartographic projection stretch (groves spread wider along X than Y)
      const tx = anchorX + u * (radius * 1.35);
      const ty = anchorY + v * (radius * 0.90);

      // Tree size: 10px to 16px crown width (small cartographic scale compared to 56px ridges)
      const size = 11 + groveRng() * 5;
      const treeSeed = groveSeed + i * 47;

      this.trees.push(new TreeSymbol(tx, ty, size, style, treeSeed));
    }
  }

  /**
   * Spawn natural groves across the map:
   * 1. Foothill forests: nestled along mountain flank bases.
   * 2. Riverine woods: scattered in bends along riverbanks.
   */
  populateForests(ridges, rivers, lakes, coastEngine = null) {
    const { rng, totalW, totalH } = this;
    this.trees = [];

    // 1. Dense Foothill Belts along mountain ranges (4 to 6 groves per range)
    for (let r of ridges) {
      if (!r.facets || r.facets.length === 0) continue;
      const tSamples = [0.15, 0.35, 0.55, 0.75, 0.90];
      for (let t of tSamples) {
        if (rng() < 0.20) continue; // slight organic variation
        const side = rng() < 0.5 ? "left" : "right";
        const fIdx = Math.min(r.facets.length - 1, Math.floor(r.facets.length * (t + (rng() - 0.5) * 0.10)));
        const facet = r.facets[fIdx];
        const flankEnd = side === "left" ? facet.leftEndA : facet.rightEndA;

        // Anchor nestled right at the foothill base
        const anchorX = flankEnd.x + (side === "left" ? -14 - rng() * 26 : 14 + rng() * 26);
        const anchorY = flankEnd.y + (rng() - 0.5) * 25;

        if (coastEngine && coastEngine.isOcean({ x: anchorX, y: anchorY }, 18)) continue;

        // High elevation or north = conifers; lower valleys = deciduous
        const style = (anchorY < totalH * 0.45 || rng() < 0.40) ? "conifer" : "deciduous";
        const groveRadius = 42 + rng() * 28;
        const groveDensity = 24 + Math.floor(rng() * 18);

        this.generateGrove(anchorX, anchorY, groveRadius, style, groveDensity);
      }
    }

    // 2. Riverine Gallery Woodlands along rivers (3 to 6 groves flanking the river)
    for (let river of rivers) {
      if (river.points.length < 10) continue;
      const numRiverGroves = 4 + Math.floor(rng() * 3);
      for (let rg = 0; rg < numRiverGroves; rg++) {
        const t = 0.15 + (rg / numRiverGroves) * 0.70 + (rng() - 0.5) * 0.08;
        const ptIdx = Math.min(river.points.length - 1, Math.max(0, Math.floor(river.points.length * t)));
        const pt = river.points[ptIdx];

        const riverSide = rg % 2 === 0 ? 1 : -1;
        const offsetDist = (pt.width || 3.0) * 0.5 + 16 + rng() * 22;
        const anchorX = pt.x + riverSide * offsetDist;
        const anchorY = pt.y + (rng() - 0.5) * 24;

        if (coastEngine && coastEngine.isOcean({ x: anchorX, y: anchorY }, 18)) continue;

        const groveRadius = 36 + rng() * 24;
        const groveDensity = 18 + Math.floor(rng() * 14);
        this.generateGrove(anchorX, anchorY, groveRadius, "deciduous", groveDensity);
      }
    }

    // 3. Lakeside Woods around lake perimeters
    for (let lake of lakes) {
      const numLakeGroves = 3 + Math.floor(rng() * 2);
      for (let lg = 0; lg < numLakeGroves; lg++) {
        const angle = (lg / numLakeGroves) * Math.PI * 2 + (rng() - 0.5) * 0.4;
        const lx = lake.x + Math.cos(angle) * (lake.radius * 1.15 + 12 + rng() * 18);
        const ly = lake.y + Math.sin(angle) * (lake.radius * 0.85 + 10 + rng() * 16);

        if (coastEngine && coastEngine.isOcean({ x: lx, y: ly }, 18)) continue;

        const groveRadius = 38 + rng() * 22;
        const groveDensity = 20 + Math.floor(rng() * 16);
        this.generateGrove(lx, ly, groveRadius, "deciduous", groveDensity);
      }
    }

    // 4. Grand Ancient Forest Tracts (Mirkwood / Fangorn scale, 2 large contiguous forests)
    const pad = 65;
    const numAncientForests = 2;
    for (let af = 0; af < numAncientForests; af++) {
      let attempts = 0;
      let placed = false;
      while (attempts < 20 && !placed) {
        attempts++;
        const cx = pad + rng() * (totalW - pad * 2);
        const cy = pad + rng() * (totalH - pad * 2);

        if (coastEngine && coastEngine.isOcean({ x: cx, y: cy }, 65)) continue;

        // Ensure not inside mountain spines
        let collidesRidge = false;
        for (let r of ridges) {
          if (RiverNetwork.pointInPoly({ x: cx, y: cy }, r.boundingPoly)) { collidesRidge = true; break; }
          for (let f of r.facets) {
            if (Math.hypot(cx - f.pA.x, cy - f.pA.y) < 75) { collidesRidge = true; break; }
          }
          if (collidesRidge) break;
        }
        if (collidesRidge) continue;

        // Generate a grand multi-cluster forest tract
        const forestStyle = rng() < 0.40 ? "conifer" : "deciduous";
        const numClusters = 3;
        for (let c = 0; c < numClusters; c++) {
          const subX = cx + (rng() - 0.5) * 60;
          const subY = cy + (rng() - 0.5) * 45;
          const subRadius = 45 + rng() * 30;
          const subDensity = 24 + Math.floor(rng() * 18);
          this.generateGrove(subX, subY, subRadius, forestStyle, subDensity);
        }
        placed = true;
      }
    }

    // 5. Scattered Countryside Copses & Groves
    const numCopses = 5 + Math.floor(rng() * 4);
    for (let cp = 0; cp < numCopses; cp++) {
      const cx = pad + rng() * (totalW - pad * 2);
      const cy = pad + rng() * (totalH - pad * 2);

      if (coastEngine && coastEngine.isOcean({ x: cx, y: cy }, 35)) continue;

      let collidesRidge = false;
      for (let r of ridges) {
        if (RiverNetwork.pointInPoly({ x: cx, y: cy }, r.boundingPoly)) { collidesRidge = true; break; }
      }
      if (collidesRidge) continue;

      const style = rng() < 0.35 ? "conifer" : "deciduous";
      const copseRadius = 32 + rng() * 20;
      const copseDensity = 14 + Math.floor(rng() * 10);
      this.generateGrove(cx, cy, copseRadius, style, copseDensity);
    }

    // Filter out trees that ended up inside water, mountain backbones, or ocean
    this.trees = this.trees.filter(tree => {
      // Not inside ocean
      if (coastEngine && coastEngine.isOcean({ x: tree.x, y: tree.y }, 6)) return false;

      // Not inside lake
      for (let l of lakes) {
        if (Math.hypot(tree.x - l.x, tree.y - l.y) < l.radius + 10) return false;
        if (RiverNetwork.pointInPoly({ x: tree.x, y: tree.y }, l.poly)) return false;
      }
      // Not on top of river channel
      for (let riv of rivers) {
        for (let rp of riv.points) {
          const minRiverDist = (rp.width || 2.0) * 0.5 + 5;
          if (Math.hypot(tree.x - rp.x, tree.y - rp.y) < minRiverDist) return false;
        }
      }
      // Not inside mountain backbone
      for (let r of ridges) {
        if (RiverNetwork.pointInPoly({ x: tree.x, y: tree.y }, r.boundingPoly)) return false;
      }
      return true;
    });
  }
}

// Single Hand-Drawn Cartographic Tree Symbol
class TreeSymbol {
  constructor(x, y, size = 13, style = "deciduous", seed = 0) {
    this.x = x;
    this.y = y; // Base position (ground contact)
    this.size = size;
    this.style = style; // "deciduous" or "conifer"
    this.seed = seed;
    this.rng = createRNG(seed);

    // Depth sorting metric: ground contact Y (lower Y = north/background)
    this.avgY = y;
  }

  draw(ctx, palette, progress = 1.0) {
    const { x, y, size, style, rng } = this;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const crownH = size * 1.15;
    const crownTop = y - crownH;
    const halfW = size * 0.55;

    if (style === "conifer") {
      // ── CONIFER / PINE TREE ──────────────────────────────────────────────
      // 3-tiered pointed pine with right-side shadow hatching
      const apex = { x, y: crownTop };
      const leftFoot = { x: x - halfW, y: y };
      const rightFoot = { x: x + halfW, y: y };

      // Opaque paper occlusion mask
      ctx.fillStyle = palette.paper;
      ctx.beginPath();
      ctx.moveTo(apex.x, apex.y);
      ctx.lineTo(rightFoot.x, rightFoot.y);
      ctx.lineTo(leftFoot.x, leftFoot.y);
      ctx.closePath();
      ctx.fill();

      // Right-side shadow wash
      if (palette.shadowWash) {
        ctx.fillStyle = palette.shadowWash;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(apex.x, apex.y);
        ctx.lineTo(rightFoot.x, rightFoot.y);
        ctx.lineTo(x, y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Serrated tiered pine arêtes (pen strokes)
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 1.0;

      // Tiered branches (3 tiers)
      const tiers = 3;
      for (let t = 0; t < tiers; t++) {
        const topY = crownTop + (crownH / tiers) * t;
        const botY = crownTop + (crownH / tiers) * (t + 1);
        const w = halfW * ((t + 1) / tiers);

        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x - w, botY);
        ctx.lineTo(x, botY - (botY - topY) * 0.25);
        ctx.lineTo(x + w, botY);
        ctx.closePath();
        ctx.stroke();
      }

      // Small trunk line
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 2.5);
      ctx.stroke();

      // Shadow intaglio hatch lines on right flank of pine
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = 0.75;
      for (let k = 1; k <= 3; k++) {
        const hy = crownTop + crownH * (0.35 + k * 0.18);
        ctx.beginPath();
        ctx.moveTo(x + 1, hy);
        ctx.lineTo(x + halfW * 0.65, hy + 2.0);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

    } else {
      // ── DECIDUOUS / BROADLEAF TREE ───────────────────────────────────────
      // Tolkien rounded billowing crown with right-side shadow intaglio
      const crownCenterY = y - size * 0.75;
      const radiusX = halfW;
      const radiusY = size * 0.55;

      // 1. Opaque paper mask
      ctx.fillStyle = palette.paper;
      ctx.beginPath();
      ctx.ellipse(x, crownCenterY, radiusX + 0.5, radiusY + 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Right-side shadow wash
      if (palette.shadowWash) {
        ctx.fillStyle = palette.shadowWash;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.ellipse(x + radiusX * 0.2, crownCenterY, radiusX * 0.8, radiusY, 0, -Math.PI * 0.3, Math.PI * 0.65);
        ctx.lineTo(x, crownCenterY);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // 3. Billowing scalloped crown outline (3-5 overlapping arcs)
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      const numBumps = 7;
      for (let b = 0; b < numBumps; b++) {
        const a1 = (b / numBumps) * Math.PI * 2;
        const a2 = ((b + 1) / numBumps) * Math.PI * 2;
        const midA = (a1 + a2) * 0.5;
        const px1 = x + Math.cos(a1) * radiusX;
        const py1 = crownCenterY + Math.sin(a1) * radiusY;
        const px2 = x + Math.cos(a2) * radiusX;
        const py2 = crownCenterY + Math.sin(a2) * radiusY;
        const cpx = x + Math.cos(midA) * (radiusX * 1.25);
        const cpy = crownCenterY + Math.sin(midA) * (radiusY * 1.25);

        if (b === 0) ctx.moveTo(px1, py1);
        ctx.quadraticCurveTo(cpx, cpy, px2, py2);
      }
      ctx.stroke();

      // 4. Short curved trunk
      ctx.beginPath();
      ctx.moveTo(x, crownCenterY + radiusY);
      ctx.lineTo(x, y + 2.0);
      ctx.stroke();

      // 5. Intaglio shadow hatching on the right hemisphere of the crown
      ctx.lineWidth = 0.65;
      ctx.globalAlpha = 0.70;
      for (let h = 0; h < 4; h++) {
        const hy = crownCenterY - radiusY * 0.25 + h * 3.2;
        const hx1 = x + 1.5;
        const hx2 = x + radiusX * 0.85;
        ctx.beginPath();
        ctx.moveTo(hx1, hy);
        ctx.lineTo(hx2, hy + 2.0);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ForestEngine, TreeSymbol };
}
