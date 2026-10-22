// Procedural Fractal Mountain Ridge Generator
// Features:
// 1. Lightning-style recursive midpoint displacement backbone (supporting arbitrary angles & curves).
// 2. 45-degree flank spurs (sunlit left, shadow right) with Perlin variance.
// 3. Etching hatch lines on shadow facet.
// 4. Strict Z-ordered facet occlusion (opaque paper fill masks background elements).

class MountainRidge {
  constructor(totalW, totalH, seed = Math.floor(Math.random() * 1000000), options = {}) {
    this.totalW = totalW;
    this.totalH = totalH;
    this.seed = seed;
    this.rng = createRNG(seed);

    // Geometry trajectory
    this.controlPoints = options.controlPoints || null;
    this.startX = options.startX ?? totalW * 0.35;
    this.startY = options.startY ?? totalH * 0.30;
    this.endX   = options.endX   ?? totalW * 0.65;
    this.endY   = options.endY   ?? totalH * 0.70;

    // Config parameters
    this.fractalIter = options.fractalIter ?? 5;
    this.backboneRoughness = options.backboneRoughness ?? 0.34;
    this.flankRoughness = options.flankRoughness ?? 0.28;
    this.flankIter = options.flankIter ?? 3;
    this.flankLength = options.flankLength ?? 32;

    this.hatchSpacing = options.hatchSpacing ?? 2.8;
    this.hatchAngle = options.hatchAngle ?? Math.PI * 0.25; // default 45° down-right

    // Generated cells/facets for depth sorting and occlusion
    this.backbone = [];
    this.facets = []; // Array of discrete depth-sorted mountain facet slices

    this.generate();
  }

  fractalizeLine(p1, p2, iterations, roughness) {
    let currentPath = [{ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y }];
    for (let k = 0; k < iterations; k++) {
      const nextPath = [currentPath[0]];
      const octaveRoughness = roughness * Math.pow(0.78, k);

      for (let i = 0; i < currentPath.length - 1; i++) {
        const a = currentPath[i];
        const b = currentPath[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const noise = (this.rng() - 0.5) * 2.0 * octaveRoughness;

        nextPath.push({
          x: (a.x + b.x) * 0.5 - dy * noise,
          y: (a.y + b.y) * 0.5 + dx * noise,
        });
        nextPath.push(b);
      }
      currentPath = nextPath;
    }
    return currentPath;
  }

  generate() {
    const { rng, fractalIter, backboneRoughness, flankRoughness, flankIter, flankLength } = this;

    // ── 1. Backbone Path (supports arbitrary curves / angles) ────────────────
    let baseNodes = [];
    if (this.controlPoints && this.controlPoints.length >= 2) {
      baseNodes = this.controlPoints;
    } else {
      // Create a naturally undulating curved spine
      const numBaseSegments = 5;
      const dx = this.endX - this.startX;
      const dy = this.endY - this.startY;
      const angle = Math.atan2(dy, dx);
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);

      baseNodes.push({ x: this.startX, y: this.startY });
      // Curvature / bend factor
      const curveBend = (rng() - 0.5) * 80;

      for (let i = 1; i < numBaseSegments; i++) {
        const t = i / numBaseSegments;
        const arch = Math.sin(t * Math.PI) * curveBend;
        const crag = (rng() - 0.5) * 25;
        baseNodes.push({
          x: this.startX + dx * t + perpX * (arch + crag),
          y: this.startY + dy * t + perpY * (arch + crag),
        });
      }
      baseNodes.push({ x: this.endX, y: this.endY });
    }

    // Fractalize spine segments (lightning style, no branching)
    let fullBackbone = [baseNodes[0]];
    for (let i = 0; i < baseNodes.length - 1; i++) {
      const seg = this.fractalizeLine(baseNodes[i], baseNodes[i + 1], fractalIter, backboneRoughness);
      for (let j = 1; j < seg.length; j++) {
        fullBackbone.push(seg[j]);
      }
    }
    this.backbone = fullBackbone;

    // ── 2. Construct Discrete Mountain Slices (Facets) with Depth ─────────────
    // To solve occlusion: we slice the mountain along the backbone into discrete segments.
    // Each slice has:
    //   - Backbone segment [pA, pB]
    //   - Left flank (sunlit spur)
    //   - Right flank (shadow spur)
    //   - Shadow etching lines
    //   - A closed polygon for opaque paper masking
    //   - A sorting depth (Z) based on its screen Y coordinate (smaller Y = further north = background)
    
    this.facets = [];
    const stride = Math.max(1, Math.floor(fullBackbone.length / 28));

    for (let i = 0; i < fullBackbone.length - stride; i += stride) {
      const idxA = i;
      const idxB = Math.min(i + stride, fullBackbone.length - 1);
      const pA = fullBackbone[idxA];
      const pB = fullBackbone[idxB];
      const t = i / fullBackbone.length;

      // Depth metric: average Y of this ridge segment
      // (in canvas coords, lower Y is north/background, higher Y is south/foreground)
      const avgY = (pA.y + pB.y) * 0.5;

      const lenNoiseA = 0.75 + fbm1D(t * 6.0, this.seed + 10) * 0.5;
      const lenA = flankLength * lenNoiseA;

      const lenNoiseB = 0.75 + fbm1D((t + 0.05) * 6.0, this.seed + 10) * 0.5;
      const lenB = flankLength * lenNoiseB;

      // Lateral reach / steepness noise:
      // Modulates how far outward the mountain base extends (steep crags vs broad spreading foothills)
      const steepnessNoiseA = fbm1D(t * 4.5, this.seed + 70) * (flankLength * 0.7);
      const steepnessNoiseB = fbm1D((t + 0.05) * 4.5, this.seed + 70) * (flankLength * 0.7);

      // Wider angle variation (between ~20° and ~70° rather than clamped ±15°)
      const leftAngleVarA = fbm1D(t * 6.0, this.seed + 20) * (Math.PI / 6); // ±30°
      const leftAngleA = Math.PI * 0.25 + leftAngleVarA;
      // Endpoint with lateral displacement (further left/outward or steeper)
      const leftEndA = {
        x: pA.x - Math.cos(leftAngleA) * lenA - Math.max(0, steepnessNoiseA),
        y: pA.y + Math.sin(leftAngleA) * lenA + Math.min(0, steepnessNoiseA * 0.3),
      };

      const leftAngleVarB = fbm1D((t + 0.05) * 6.0, this.seed + 20) * (Math.PI / 6);
      const leftAngleB = Math.PI * 0.25 + leftAngleVarB;
      const leftEndB = {
        x: pB.x - Math.cos(leftAngleB) * lenB - Math.max(0, steepnessNoiseB),
        y: pB.y + Math.sin(leftAngleB) * lenB + Math.min(0, steepnessNoiseB * 0.3),
      };

      const rightAngleVarA = fbm1D(t * 6.0, this.seed + 30) * (Math.PI / 6); // ±30°
      const rightAngleA = Math.PI * 0.25 + rightAngleVarA;
      // Endpoint with lateral displacement (further right/outward or steeper)
      const rightEndA = {
        x: pA.x + Math.cos(rightAngleA) * lenA + Math.max(0, steepnessNoiseA),
        y: pA.y + Math.sin(rightAngleA) * lenA + Math.min(0, steepnessNoiseA * 0.3),
      };

      const rightAngleVarB = fbm1D((t + 0.05) * 6.0, this.seed + 30) * (Math.PI / 6);
      const rightAngleB = Math.PI * 0.25 + rightAngleVarB;
      const rightEndB = {
        x: pB.x + Math.cos(rightAngleB) * lenB + Math.max(0, steepnessNoiseB),
        y: pB.y + Math.sin(rightAngleB) * lenB + Math.min(0, steepnessNoiseB * 0.3),
      };

      // Fractal paths for the spurs
      const leftSpurA = this.fractalizeLine(pA, leftEndA, flankIter, flankRoughness);
      const rightSpurA = this.fractalizeLine(pA, rightEndA, flankIter, flankRoughness);
      const rightSpurB = this.fractalizeLine(pB, rightEndB, flankIter, flankRoughness);

      // Shadow etching lines for this slice
      const sliceHatches = [];
      const hatchDirX = Math.cos(this.hatchAngle);
      const hatchDirY = Math.sin(this.hatchAngle);

      for (let k = idxA; k <= idxB; k += 2) {
        const pk = fullBackbone[k];
        // Hatch length scales with the actual reach of the right flank
        const flankSpan = Math.hypot(rightEndA.x - pA.x, rightEndA.y - pA.y);
        const hLen = flankSpan * (0.50 + rng() * 0.45);
        sliceHatches.push({
          x1: pk.x,
          y1: pk.y,
          x2: pk.x + hatchDirX * hLen,
          y2: pk.y + hatchDirY * hLen,
          alpha: 0.70 + rng() * 0.30,
          width: 0.65 + rng() * 0.40,
        });
      }

      // Sunlit contour dashes
      const sliceSunContours = [];
      for (let k = idxA; k <= idxB; k += 3) {
        if (rng() < 0.45) {
          const pk = fullBackbone[k];
          const cAngle = Math.PI * 0.25 + (rng() - 0.5) * 0.2;
          const cLen = 4 + rng() * 9;
          sliceSunContours.push({
            x1: pk.x,
            y1: pk.y,
            x2: pk.x - Math.cos(cAngle) * cLen,
            y2: pk.y + Math.sin(cAngle) * cLen,
            alpha: 0.35 + rng() * 0.25,
          });
        }
      }

      // Closed polygon representing the full footprint of this facet
      // Order: LeftFootA -> SpineA -> SpineB -> RightFootB -> RightFootA -> close
      const maskPoly = [
        leftEndA,
        pA,
        pB,
        rightEndB,
        rightEndA,
      ];

      // Also separate polygons for shadow wash and highlight wash
      const shadowWashPoly = [pA, pB, rightEndB, rightEndA];
      const highlightWashPoly = [pA, pB, leftEndB, leftEndA];

      this.facets.push({
        avgY,
        pA,
        pB,
        leftEndA,
        rightEndA,
        leftSpurA,
        rightSpurA,
        maskPoly,
        shadowWashPoly,
        highlightWashPoly,
        hatches: sliceHatches,
        sunContours: sliceSunContours,
        t,
      });
    }

    // Compute full continuous bounding polygon corridor of the ridge (along left edge, around end, along right edge)
    this.boundingPoly = [];
    for (let f of this.facets) this.boundingPoly.push(f.leftEndA);
    this.boundingPoly.push(this.facets[this.facets.length - 1].pB);
    for (let i = this.facets.length - 1; i >= 0; i--) this.boundingPoly.push(this.facets[i].rightEndA);
    this.boundingPoly.push(this.facets[0].pA);

    // Approximate length of the ridge
    this.length = Math.hypot(this.endX - this.startX, this.endY - this.startY);

    // ── 3. Depth Sort Facets (Z-Ordering) ─────────────────────────────────────
    // Sort from smallest Y (furthest North / background) to largest Y (foreground / South).
    // Foreground facets will paint an opaque background fill to cleanly occlude background facets!
    this.facets.sort((a, b) => a.avgY - b.avgY);
  }

  /**
   * Draw the mountain ridge with true Z-ordered facet occlusion
   */
  draw(ctx, palette, progress = 1.0) {
    if (progress <= 0 || this.facets.length === 0) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Progress determines how many facets along the spine trajectory have appeared
    // We filter facets by t <= progress
    const activeFacets = this.facets.filter(f => f.t <= progress);

    for (let f of activeFacets) {
      // 1. OPAQUE OCCLUSION MASK:
      // Fill this facet with opaque parchment paper color to occlude any background mountain lines!
      ctx.fillStyle = palette.paper;
      ctx.beginPath();
      ctx.moveTo(f.maskPoly[0].x, f.maskPoly[0].y);
      for (let i = 1; i < f.maskPoly.length; i++) {
        ctx.lineTo(f.maskPoly[i].x, f.maskPoly[i].y);
      }
      ctx.closePath();
      ctx.fill();

      // 2. Watercolor washes
      if (palette.shadowWash) {
        ctx.fillStyle = palette.shadowWash;
        ctx.beginPath();
        ctx.moveTo(f.shadowWashPoly[0].x, f.shadowWashPoly[0].y);
        for (let i = 1; i < f.shadowWashPoly.length; i++) {
          ctx.lineTo(f.shadowWashPoly[i].x, f.shadowWashPoly[i].y);
        }
        ctx.closePath();
        ctx.fill();
      }

      if (palette.highlightWash) {
        ctx.fillStyle = palette.highlightWash;
        ctx.beginPath();
        ctx.moveTo(f.highlightWashPoly[0].x, f.highlightWashPoly[0].y);
        for (let i = 1; i < f.highlightWashPoly.length; i++) {
          ctx.lineTo(f.highlightWashPoly[i].x, f.highlightWashPoly[i].y);
        }
        ctx.closePath();
        ctx.fill();
      }

      // 3. Etching hatch lines (Shadow side)
      ctx.strokeStyle = palette.ink;
      for (let h of f.hatches) {
        ctx.lineWidth = h.width;
        ctx.globalAlpha = h.alpha;
        ctx.beginPath();
        ctx.moveTo(h.x1, h.y1);
        ctx.lineTo(h.x2, h.y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // 4. Sunlit contour dashes (Left side)
      ctx.strokeStyle = palette.inkFaint ?? palette.ink;
      for (let c of f.sunContours) {
        ctx.lineWidth = 0.7;
        ctx.globalAlpha = c.alpha;
        ctx.beginPath();
        ctx.moveTo(c.x1, c.y1);
        ctx.lineTo(c.x2, c.y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // 5. Flank spur lines (Left & Right arêtes)
      ctx.strokeStyle = palette.inkFaint ?? palette.ink;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(f.leftSpurA[0].x, f.leftSpurA[0].y);
      for (let i = 1; i < f.leftSpurA.length; i++) {
        ctx.lineTo(f.leftSpurA[i].x, f.leftSpurA[i].y);
      }
      ctx.stroke();

      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(f.rightSpurA[0].x, f.rightSpurA[0].y);
      for (let i = 1; i < f.rightSpurA.length; i++) {
        ctx.lineTo(f.rightSpurA[i].x, f.rightSpurA[i].y);
      }
      ctx.stroke();

      // 6. Backbone crest segment (boldest sharp ink line)
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(f.pA.x, f.pA.y);
      ctx.lineTo(f.pB.x, f.pB.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// Procedural Solitary Mountain Peak Generator (Atomic Mountain Unit)
// A single-length mountain unit: an apex summit, a top-to-bottom central splitter spine,
// left and right 45-50° flank slopes, shadow etching, and opaque paper occlusion mask.

class MountainPeak {
  constructor(x, y, width = 45, seed = Math.floor(Math.random() * 1000000), options = {}) {
    this.x = x;
    this.y = y; // Apex summit position
    this.width = width;
    this.seed = seed;
    this.rng = createRNG(seed);

    // Height bound by ~45-50° triangle (tan(45°) = 1.0, tan(50°) ≈ 1.19)
    // height is roughly half the width times tan(slope)
    const slopeAngle = (45 + (this.rng() - 0.5) * 10) * (Math.PI / 180);
    this.height = (this.width * 0.5) * Math.tan(slopeAngle);

    this.fractalIter = options.fractalIter ?? 4;
    this.roughness = options.roughness ?? 0.32;
    this.hatchSpacing = options.hatchSpacing ?? 2.4;
    this.hatchAngle = options.hatchAngle ?? Math.PI * 0.25; // 45° down-right

    // Depth sorting metric: base of the mountain (higher Y = foreground)
    this.avgY = this.y + this.height;

    this.splitter = [];
    this.leftSlope = [];
    this.rightSlope = [];
    this.hatches = [];
    this.sunContours = [];
    this.maskPoly = [];
    this.shadowPoly = [];
    this.highlightPoly = [];

    this.generate();
  }

  fractalizeLine(p1, p2, iterations, roughness) {
    let currentPath = [{ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y }];
    for (let k = 0; k < iterations; k++) {
      const nextPath = [currentPath[0]];
      const octaveRoughness = roughness * Math.pow(0.78, k);

      for (let i = 0; i < currentPath.length - 1; i++) {
        const a = currentPath[i];
        const b = currentPath[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const noise = (this.rng() - 0.5) * 2.0 * octaveRoughness;

        nextPath.push({
          x: (a.x + b.x) * 0.5 - dy * noise,
          y: (a.y + b.y) * 0.5 + dx * noise,
        });
        nextPath.push(b);
      }
      currentPath = nextPath;
    }
    return currentPath;
  }

  // Downward-constrained fractal displacement:
  // Displacements are clamped so the slope line stays mostly *below* (or on) the pure 45° geometric slope line.
  // The 'area over line' is minimized so the profile never bulges unnaturally above the peak apex.
  fractalizeSlope(p1, p2, iterations, roughness, side = "left") {
    let currentPath = [{ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y }];
    for (let k = 0; k < iterations; k++) {
      const nextPath = [currentPath[0]];
      const octaveRoughness = roughness * Math.pow(0.70, k);

      for (let i = 0; i < currentPath.length - 1; i++) {
        const a = currentPath[i];
        const b = currentPath[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;

        // Noise biased so it doesn't push the profile upward/inward above the summit
        // For mountain slopes descending from apex: pushing 'up' reduces Y (higher on screen),
        // so we clamp noise to ensure the profile stays concave/downward rather than bulging above the slope.
        let noise = (this.rng() - 0.5) * 2.0 * octaveRoughness;
        if (side === "left") {
          // Left slope descends (dx < 0, dy > 0). Perpendicular vector (-dy, dx) points down-left or up-right.
          // We bias slightly outward/downward so it never arches higher than apex
          noise = Math.min(noise, 0.05);
        } else {
          // Right slope descends (dx > 0, dy > 0).
          noise = Math.max(noise, -0.05);
        }

        const midX = (a.x + b.x) * 0.5 - dy * noise;
        // Ensure Y never goes above the highest of the two parent points (strict non-increasing altitude)
        const midY = Math.max(Math.min(a.y, b.y), (a.y + b.y) * 0.5 + dx * noise);

        nextPath.push({ x: midX, y: midY });
        nextPath.push(b);
      }
      currentPath = nextPath;
    }
    return currentPath;
  }

  generate() {
    const { x, y, width, height, rng, fractalIter, roughness } = this;

    const apex = { x, y };

    // Base endpoints: left and right corners
    const halfW = width * 0.5;
    const leftCorner = {
      x: x - halfW,
      y: y + height,
    };
    const rightCorner = {
      x: x + halfW,
      y: y + height,
    };

    // Central splitter base endpoint:
    // Added noise so it can land in line with the sides (baseline y + height)
    // or project further forward/downward (up to 1.18x height), with lateral sway
    const splitterLateralOffset = (rng() - 0.5) * (halfW * 0.35);
    const splitterDownFactor = 1.0 + rng() * 0.18; // between 1.0 (in line with sides) and 1.18 (projecting forward)
    const splitterEnd = {
      x: x + splitterLateralOffset,
      y: y + height * splitterDownFactor,
    };

    // 1. Central Splitter Spine (Top to bottom lightning style)
    this.splitter = this.fractalizeLine(apex, splitterEnd, fractalIter, roughness * 0.85);

    // 2. Left Slope (Sunlit Arête) with minimal area-over-line
    this.leftSlope = this.fractalizeSlope(apex, leftCorner, fractalIter, roughness, "left");

    // 3. Right Slope (Shadow Arête) with minimal area-over-line
    this.rightSlope = this.fractalizeSlope(apex, rightCorner, fractalIter, roughness, "right");

    // 4. Polygons for Occlusion and Washes:
    // Built using the full fractal paths so that the boundaries are craggy and jagged:
    // - Shadow polygon: along central splitter (apex -> splitterEnd), along base to rightCorner, then backwards along rightSlope (rightCorner -> apex)
    this.shadowPoly = [
      ...this.splitter,
      ...this.rightSlope.slice().reverse(),
    ];

    // - Highlight polygon: along leftSlope (apex -> leftCorner), along base to splitterEnd, then backwards along splitter (splitterEnd -> apex)
    this.highlightPoly = [
      ...this.leftSlope,
      ...this.splitter.slice().reverse(),
    ];

    // - Full mask polygon: along leftSlope (apex -> leftCorner), through splitterEnd to rightCorner, then backwards along rightSlope to apex
    this.maskPoly = [
      ...this.leftSlope,
      this.splitter[this.splitter.length - 1],
      ...this.rightSlope.slice().reverse(),
    ];

    // Mountains don't need heavy side-to-side etching across the whole face;
    // just the shadow wash and subtle crease/ridge line shading is enough.
    this.hatches = [];
    this.sunContours = [];
  }

  draw(ctx, palette, progress = 1.0) {
    if (progress <= 0) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (progress < 1.0) {
      ctx.globalAlpha = Math.min(1.0, progress * 1.35);
    }

    // 1. OPAQUE PAPER OCCLUSION MASK
    ctx.fillStyle = palette.paper;
    ctx.beginPath();
    ctx.moveTo(this.maskPoly[0].x, this.maskPoly[0].y);
    for (let i = 1; i < this.maskPoly.length; i++) {
      ctx.lineTo(this.maskPoly[i].x, this.maskPoly[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // 2. Washes
    if (palette.shadowWash) {
      ctx.fillStyle = palette.shadowWash;
      ctx.beginPath();
      ctx.moveTo(this.shadowPoly[0].x, this.shadowPoly[0].y);
      for (let i = 1; i < this.shadowPoly.length; i++) {
        ctx.lineTo(this.shadowPoly[i].x, this.shadowPoly[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }

    if (palette.highlightWash) {
      ctx.fillStyle = palette.highlightWash;
      ctx.beginPath();
      ctx.moveTo(this.highlightPoly[0].x, this.highlightPoly[0].y);
      for (let i = 1; i < this.highlightPoly.length; i++) {
        ctx.lineTo(this.highlightPoly[i].x, this.highlightPoly[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }

    // 3. Shadow Etching Lines
    ctx.strokeStyle = palette.ink;
    const maxHatches = Math.floor(this.hatches.length * progress);
    for (let i = 0; i < maxHatches; i++) {
      const h = this.hatches[i];
      ctx.lineWidth = h.width;
      ctx.globalAlpha = h.alpha;
      ctx.beginPath();
      ctx.moveTo(h.x1, h.y1);
      ctx.lineTo(h.x2, h.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // 4. Sunlit Contours
    ctx.strokeStyle = palette.inkFaint ?? palette.ink;
    const maxContours = Math.floor(this.sunContours.length * progress);
    for (let i = 0; i < maxContours; i++) {
      const c = this.sunContours[i];
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = c.alpha;
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // 5. Left Slope Arête
    ctx.strokeStyle = palette.inkFaint ?? palette.ink;
    ctx.lineWidth = 1.0;
    const maxLeft = Math.floor(this.leftSlope.length * progress);
    if (maxLeft > 1) {
      ctx.beginPath();
      ctx.moveTo(this.leftSlope[0].x, this.leftSlope[0].y);
      for (let i = 1; i < maxLeft; i++) {
        ctx.lineTo(this.leftSlope[i].x, this.leftSlope[i].y);
      }
      ctx.stroke();
    }

    // 6. Right Slope Arête
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.2;
    const maxRight = Math.floor(this.rightSlope.length * progress);
    if (maxRight > 1) {
      ctx.beginPath();
      ctx.moveTo(this.rightSlope[0].x, this.rightSlope[0].y);
      for (let i = 1; i < maxRight; i++) {
        ctx.lineTo(this.rightSlope[i].x, this.rightSlope[i].y);
      }
      ctx.stroke();
    }

    // 7. Central Splitter Spine (Boldest central crest line)
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.8;
    const maxSplitter = Math.floor(this.splitter.length * progress);
    if (maxSplitter > 1) {
      ctx.beginPath();
      ctx.moveTo(this.splitter[0].x, this.splitter[0].y);
      for (let i = 1; i < maxSplitter; i++) {
        ctx.lineTo(this.splitter[i].x, this.splitter[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MountainRidge, MountainPeak };
}
