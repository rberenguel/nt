// Procedural Antique Fantasy Cartography — Rolling Hills Engine
// Tolkien, Ortelius & Dyson Logos style:
// - Soft, rounded double-arc and single hummocks bridging mountain cordilleras and lowland plains.
// - Authentic copperplate intaglio etching on shadow (east/right) facet.
// - Opaque paper occlusion masks ensuring flawless north-to-south Z-ordering.
// - Organized into geological foothill belts, downland chains, and valley knolls.

class HillSymbol {
  constructor(x, y, width = 32, variant = "single", seed = 0) {
    this.x = x;
    this.y = y; // Base ground contact
    this.width = width;
    this.height = width * (0.36 + (Math.abs(Math.sin(seed * 1.7)) * 0.16)); // gentle rolling aspect ratio
    this.variant = variant; // "single" | "double-left" | "double-right"
    this.seed = seed;
    this.rng = createRNG(seed);
    this.avgY = y; // Sorting metric for unified Z-depth queue
  }

  draw(ctx, palette, progress = 1.0) {
    if (progress <= 0) return;
    const { x, y, width, height, variant, rng } = this;
    const halfW = width * 0.5;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (progress < 1.0) {
      ctx.globalAlpha = Math.min(1.0, progress * 1.3);
    }

    if (variant === "double-left" || variant === "double-right") {
      // ── DOUBLE-ARC HUMMOCK (Main dome with overlapping shoulder mound) ──
      const isLeft = variant === "double-left";
      const shoulderW = width * (0.55 + (seedRng(this.seed + 11) * 0.15));
      const shoulderH = height * (0.65 + (seedRng(this.seed + 13) * 0.15));
      const shoulderOffset = isLeft ? -halfW * 0.65 : halfW * 0.65;
      const shoulderX = x + shoulderOffset;

      // 1. Draw shoulder mound first if behind main dome
      this.drawSingleMound(ctx, shoulderX, y, shoulderW, shoulderH, palette, 0.95);

      // 2. Draw primary dome in front
      this.drawSingleMound(ctx, x, y, width, height, palette, 1.0);
    } else {
      // ── SINGLE SMOOTH ROLLING HUMMOCK ──
      this.drawSingleMound(ctx, x, y, width, height, palette, 1.0);
    }

    ctx.restore();
  }

  drawSingleMound(ctx, mx, my, w, h, palette, scale = 1.0) {
    const halfW = w * 0.5;
    const apexX = mx + (seedRng(this.seed + 23) - 0.5) * (w * 0.12);
    const apexY = my - h;
    const leftFoot = { x: mx - halfW, y: my };
    const rightFoot = { x: mx + halfW, y: my };

    // Bezier control points for a smooth, natural antique dome
    const cp1x = mx - halfW * 0.85;
    const cp1y = my - h * 0.65;
    const cp2x = apexX - halfW * 0.25;
    const cp2y = apexY;

    const cp3x = apexX + halfW * 0.25;
    const cp3y = apexY;
    const cp4x = mx + halfW * 0.85;
    const cp4y = my - h * 0.65;

    // 1. Opaque paper occlusion mask (cleanly masks terrain behind it)
    ctx.fillStyle = palette.paper;
    ctx.beginPath();
    ctx.moveTo(leftFoot.x, leftFoot.y);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, apexX, apexY);
    ctx.bezierCurveTo(cp3x, cp3y, cp4x, cp4y, rightFoot.x, rightFoot.y);
    ctx.lineTo(leftFoot.x, leftFoot.y);
    ctx.closePath();
    ctx.fill();

    // 2. Delicate shadow wash on right (east) facet
    if (palette.shadowWash) {
      ctx.fillStyle = palette.shadowWash;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.moveTo(apexX, apexY);
      ctx.bezierCurveTo(cp3x, cp3y, cp4x, cp4y, rightFoot.x, rightFoot.y);
      ctx.lineTo(apexX, my);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // 3. Intaglio copperplate shadow hatching on right side
    const numHatches = Math.max(4, Math.floor(w * 0.24));
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 0.85;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();

    for (let i = 1; i <= numHatches; i++) {
      const t = i / (numHatches + 1); // 0 (near apex) to 1 (near right foot)
      // Point along the right slope curve
      const u = 1 - t;
      const px = u*u*u*apexX + 3*u*u*t*cp3x + 3*u*t*t*cp4x + t*t*t*rightFoot.x;
      const py = u*u*u*apexY + 3*u*u*t*cp3y + 3*u*t*t*cp4y + t*t*t*rightFoot.y;

      // Downward hatch line curved slightly inward toward baseline
      const hatchLen = (my - py) * (0.65 + seedRng(this.seed + i * 7) * 0.35);
      const endX = px - hatchLen * 0.18; // slight 10-15° angle
      const endY = Math.min(my, py + hatchLen);

      ctx.moveTo(px, py);
      ctx.lineTo(endX, endY);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // 4. Clean antique ink outline
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(leftFoot.x, leftFoot.y);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, apexX, apexY);
    ctx.bezierCurveTo(cp3x, cp3y, cp4x, cp4y, rightFoot.x, rightFoot.y);
    ctx.stroke();

    // 5. Subtle grounded base tick
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(leftFoot.x - 2, leftFoot.y);
    ctx.lineTo(leftFoot.x + w * 0.28, leftFoot.y);
    ctx.moveTo(rightFoot.x - w * 0.22, rightFoot.y);
    ctx.lineTo(rightFoot.x + 2, rightFoot.y);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }
}

// Simple seedable float generator for deterministic rendering
function seedRng(s) {
  const x = Math.sin(s * 91.345 + 17.71) * 43758.5453;
  return x - Math.floor(x);
}

class HillsEngine {
  constructor(totalW, totalH, seed = Math.floor(Math.random() * 1000000)) {
    this.totalW = totalW;
    this.totalH = totalH;
    this.seed = seed;
    this.rng = createRNG(seed);
    this.hills = [];
  }

  /**
   * Spawn a geological cluster / chain of rolling hills
   */
  generateHillChain(startX, startY, endX, endY, count = 8, spread = 35) {
    const { rng } = this;
    const dx = endX - startX;
    const dy = endY - startY;

    for (let i = 0; i < count; i++) {
      const t = (i + 0.5 + (rng() - 0.5) * 0.4) / count;
      const lateral = (rng() - 0.5) * spread * 2;
      const angle = Math.atan2(dy, dx);
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);

      const hx = startX + dx * t + perpX * lateral;
      const hy = startY + dy * t + perpY * lateral;

      const hillW = 22 + rng() * 18; // 22px to 40px
      const variants = ["single", "double-left", "double-right", "single"];
      const variant = variants[Math.floor(rng() * variants.length)];
      const hillSeed = this.seed + this.hills.length * 107 + i * 31;

      this.hills.push(new HillSymbol(hx, hy, hillW, variant, hillSeed));
    }
  }

  /**
   * Populates rolling hill belts across the map:
   * 1. Foothill chains flanking mountain ranges (buffering high peaks).
   * 2. Downland chains filling barren valley expanses.
   * 3. Knoll clusters around solitary peak massifs.
   */
  populateHills(ridges, peaks, riverNetwork, coastEngine) {
    const { rng, totalW, totalH } = this;
    this.hills = [];

    // ── 1. Foothill Belts along Mountain Ranges ─────────────────────────────
    for (let r of ridges) {
      if (!r.facets || r.facets.length === 0) continue;

      // Sample along both flanks of each ridge
      for (let side of ["left", "right"]) {
        const numClusters = 2 + Math.floor(rng() * 3); // 2 to 4 hill chains per side
        for (let c = 0; c < numClusters; c++) {
          const tStart = 0.12 + (c / numClusters) * 0.65 + (rng() - 0.5) * 0.08;
          const tEnd = Math.min(0.95, tStart + 0.18 + rng() * 0.15);

          const fIdxA = Math.min(r.facets.length - 1, Math.floor(r.facets.length * tStart));
          const fIdxB = Math.min(r.facets.length - 1, Math.floor(r.facets.length * tEnd));
          const fA = r.facets[fIdxA];
          const fB = r.facets[fIdxB];

          const flankA = side === "left" ? fA.leftEndA : fA.rightEndA;
          const flankB = side === "left" ? fB.leftEndA : fB.rightEndA;

          const outwardDist = 24 + rng() * 32;
          const normalA = side === "left" ? -1 : 1;

          const sx = flankA.x + normalA * outwardDist;
          const sy = flankA.y + (rng() - 0.5) * 20;
          const ex = flankB.x + normalA * (outwardDist + (rng() - 0.5) * 20);
          const ey = flankB.y + (rng() - 0.5) * 20;

          this.generateHillChain(sx, sy, ex, ey, 5 + Math.floor(rng() * 4), 22);
        }
      }
    }

    // ── 2. Knoll Clusters near Solitary Peaks (Geological Foothills) ────────
    for (let p of peaks) {
      if (rng() < 0.45) continue; // cluster around ~55% of peaks
      const numKnolls = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < numKnolls; k++) {
        const angle = rng() * Math.PI * 2;
        const dist = (p.width * 0.5) + 14 + rng() * 22;
        const kx = p.x + Math.cos(angle) * dist;
        const ky = p.y + Math.sin(angle) * (dist * 0.75); // slight perspective flattening
        const kW = 18 + rng() * 14;
        const kSeed = this.seed + this.hills.length * 43 + k * 17;
        this.hills.push(new HillSymbol(kx, ky, kW, "single", kSeed));
      }
    }

    // ── 3. Downland Chains Crossing Open Valley Voids ───────────────────────
    const padX = totalW * 0.08;
    const padY = totalH * 0.10;
    const numDownlandChains = 4 + Math.floor(rng() * 4); // 4 to 7 rolling hill chains

    for (let dc = 0; dc < numDownlandChains; dc++) {
      let attempts = 0;
      let placed = false;

      while (attempts < 25 && !placed) {
        attempts++;
        const cx = padX + rng() * (totalW - padX * 2);
        const cy = padY + rng() * (totalH - padY * 2);

        // Keep out of ocean
        if (coastEngine && coastEngine.isOcean({ x: cx, y: cy }, 45)) continue;

        // Ensure not inside mountain spines
        let inRidge = false;
        for (let r of ridges) {
          if (RiverNetwork.pointInPoly({ x: cx, y: cy }, r.boundingPoly)) { inRidge = true; break; }
        }
        if (inRidge) continue;

        const chainLen = 120 + rng() * 160;
        const chainAngle = rng() * Math.PI * 2;
        const sx = cx - Math.cos(chainAngle) * (chainLen * 0.5);
        const sy = cy - Math.sin(chainAngle) * (chainLen * 0.5);
        const ex = cx + Math.cos(chainAngle) * (chainLen * 0.5);
        const ey = cy + Math.sin(chainAngle) * (chainLen * 0.5);

        if (coastEngine && (coastEngine.isOcean({ x: sx, y: sy }, 30) || coastEngine.isOcean({ x: ex, y: ey }, 30))) {
          continue;
        }

        const count = 5 + Math.floor(rng() * 5);
        this.generateHillChain(sx, sy, ex, ey, count, 28);
        placed = true;
      }
    }

    // ── 4. Spatial Safety Pruning (Ocean, Lakes, Riverbeds, Mountain Spines) ──
    const rivers = riverNetwork ? riverNetwork.rivers : [];
    const lakes = riverNetwork ? riverNetwork.lakes : [];

    this.hills = this.hills.filter(hill => {
      const pt = { x: hill.x, y: hill.y };

      // 1. Never spawn inside ocean
      if (coastEngine && coastEngine.isOcean(pt, 12)) return false;

      // 2. Never spawn inside lakes
      for (let l of lakes) {
        if (Math.hypot(hill.x - l.x, hill.y - l.y) < l.radius + 12) return false;
        if (RiverNetwork.pointInPoly(pt, l.poly)) return false;
      }

      // 3. Never spawn on river channels
      for (let riv of rivers) {
        for (let rp of riv.points) {
          const minRiverDist = (rp.width || 2.0) * 0.5 + 8;
          if (Math.hypot(hill.x - rp.x, hill.y - rp.y) < minRiverDist) return false;
        }
      }

      // 4. Never spawn directly inside mountain backbone ridges
      for (let r of ridges) {
        if (RiverNetwork.pointInPoly(pt, r.boundingPoly)) return false;
        for (let f of r.facets) {
          if (Math.hypot(hill.x - f.pA.x, hill.y - f.pA.y) < 32) return false;
        }
      }

      // 5. Bounds check
      const margin = 26;
      if (hill.x < margin || hill.x > totalW - margin || hill.y < margin || hill.y > totalH - margin) {
        return false;
      }

      return true;
    });

    // Ensure hills are sorted North-to-South for painter's depth occlusion
    this.hills.sort((a, b) => a.avgY - b.avgY);
  }

  /**
   * Draws rolling hills sequentially North-to-South with blooming windows
   */
  draw(ctx, palette, progress = 1.0) {
    if (!this.hills || this.hills.length === 0 || progress <= 0) return;

    const total = this.hills.length;
    const windowDuration = Math.min(0.18, 3.8 / total);

    for (let i = 0; i < total; i++) {
      const startTime = (i / total) * (1.0 - windowDuration);
      if (progress < startTime) continue;
      const hProg = Math.min(1.0, (progress - startTime) / windowDuration);
      this.hills[i].draw(ctx, palette, hProg);
    }
  }
}
