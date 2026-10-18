// Procedural Fantasy River & Lake Engine
// - Rivers originate at ridge flank rays flowing sideways / downhill.
// - Meanders with authentic sinuous loops (meander wavelength + amplitude).
// - Rigorous collision prevention: line-of-sight checks prevent mountain-crossing.
// - Snaps river endpoint cleanly to the lake shoreline.

class RiverNetwork {
  constructor(totalW, totalH, seed = Math.floor(Math.random() * 1000000)) {
    this.totalW = totalW;
    this.totalH = totalH;
    this.seed = seed;
    this.rng = createRNG(seed);

    this.rivers = []; // Array of River objects
    this.lakes = [];  // Array of Lake objects
    this.coastEngine = null;
  }

  /**
   * Check if a 2D point is inside a polygon
   */
  static pointInPoly(pt, poly) {
    if (!poly || poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Test if segment (p1->p2) intersects segment (q1->q2)
   */
  static segmentsIntersect(p1, p2, q1, q2) {
    function ccw(a, b, c) {
      return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    }
    return (ccw(p1, q1, q2) !== ccw(p2, q1, q2)) && (ccw(p1, p2, q1) !== ccw(p1, p2, q2));
  }

  /**
   * Test if a line segment intersects any facet or spine of any mountain ridge
   */
  static segmentCrossesRidges(p1, p2, ridges) {
    for (let r of ridges) {
      // Test against ridge backbone spine segments
      for (let i = 0; i < r.backbone.length - 1; i++) {
        if (RiverNetwork.segmentsIntersect(p1, p2, r.backbone[i], r.backbone[i + 1])) {
          return true;
        }
      }
      // Test against ridge outer corridor bounding polygon edges
      if (r.boundingPoly && r.boundingPoly.length > 2) {
        for (let i = 0; i < r.boundingPoly.length; i++) {
          const next = (i + 1) % r.boundingPoly.length;
          if (RiverNetwork.segmentsIntersect(p1, p2, r.boundingPoly[i], r.boundingPoly[next])) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Check if a point is inside or within safety clearance of any mountain ridge
   */
  static isPointInsideRidge(pt, ridges, minDist = 25) {
    for (let r of ridges) {
      if (RiverNetwork.pointInPoly(pt, r.boundingPoly)) return true;
      for (let f of r.facets) {
        if (Math.hypot(pt.x - f.pA.x, pt.y - f.pA.y) < minDist) return true;
        if (Math.hypot(pt.x - f.leftEndA.x, pt.y - f.leftEndA.y) < minDist * 0.5) return true;
        if (Math.hypot(pt.x - f.rightEndA.x, pt.y - f.rightEndA.y) < minDist * 0.5) return true;
      }
    }
    return false;
  }

  /**
   * Rigorous geometric safety check for candidate lakes.
   * Ensures the lake never touches or overlaps any mountain ridge or ocean,
   * and stays safely within map bounds.
   */
  static isLakeSafe(lake, allRidges, coastEngine, totalW, totalH) {
    if (!lake || !lake.poly || lake.poly.length < 10) return false;

    const lakeRadius = lake.radius || (lake.baseRadius * Math.max(lake.stretchX, lake.stretchY) * 1.15);

    // 1. Map bounds clearance
    const pad = 32;
    if (totalW && totalH) {
      if (lake.x - lakeRadius < pad || lake.x + lakeRadius > totalW - pad ||
          lake.y - lakeRadius < pad || lake.y + lakeRadius > totalH - pad) {
        return false;
      }
      for (let p of lake.poly) {
        if (p.x < pad || p.x > totalW - pad || p.y < pad || p.y > totalH - pad) {
          return false;
        }
      }
    }

    // 2. Ocean Validation: Lake MUST be entirely inland on dry land
    if (coastEngine) {
      // Center must have ample buffer from ocean
      if (coastEngine.isOcean({ x: lake.x, y: lake.y }, lakeRadius + 18)) {
        return false;
      }
      // Every single perimeter point must be at least 18px away from coastline/ocean
      for (let p of lake.poly) {
        if (coastEngine.isOcean(p, 18)) {
          return false;
        }
      }
    }

    // 3. Mountain Ridge Validation: Lake MUST NOT overlap or encompass any ridge
    if (allRidges && allRidges.length > 0) {
      for (let r of allRidges) {
        // (a) Lake center cannot be inside ridge footprint
        if (RiverNetwork.pointInPoly({ x: lake.x, y: lake.y }, r.boundingPoly)) {
          return false;
        }

        // (b) Lake center must stay clear of all ridge backbone spine vertices
        if (r.backbone) {
          for (let bp of r.backbone) {
            if (Math.hypot(lake.x - bp.x, lake.y - bp.y) < lakeRadius + 22) {
              return false;
            }
          }
        }

        // (c) No facet spine or spur endpoints may be inside the lake
        if (r.facets) {
          for (let f of r.facets) {
            if (RiverNetwork.pointInPoly(f.pA, lake.poly) ||
                RiverNetwork.pointInPoly(f.leftEndA, lake.poly) ||
                RiverNetwork.pointInPoly(f.rightEndA, lake.poly)) {
              return false;
            }
            if (Math.hypot(lake.x - f.pA.x, lake.y - f.pA.y) < lakeRadius + 20) {
              return false;
            }
          }
        }

        // (d) Lake perimeter points must not penetrate the ridge footprint
        const checkStep = 4;
        for (let i = 0; i < lake.poly.length; i += checkStep) {
          if (RiverNetwork.pointInPoly(lake.poly[i], r.boundingPoly)) {
            return false;
          }
        }

        // (e) Ridge backbone segments must not cross the lake polygon perimeter
        if (r.backbone && r.backbone.length > 1) {
          const polyStep = 8;
          const polyLen = lake.poly.length;
          for (let i = 0; i < polyLen; i += polyStep) {
            const lp1 = lake.poly[i];
            const lp2 = lake.poly[(i + polyStep) % polyLen];
            for (let bi = 0; bi < r.backbone.length - 1; bi++) {
              if (RiverNetwork.segmentsIntersect(lp1, lp2, r.backbone[bi], r.backbone[bi + 1])) {
                return false;
              }
            }
          }
        }
      }
    }

    return true;
  }

  /**
   * Compute double-bank ribbon curves, intaglio bank fringe ticks,
   * and concentric waterline streamlines along the river channel.
   */
  static computeRiverRibbon(points, rng) {
    const N = points.length;
    const leftBank = [];
    const rightBank = [];
    const bankFringes = [];

    for (let i = 0; i < N; i++) {
      const p = points[i];
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(N - 1, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const halfW = p.width * 0.5;

      const lx = p.x - nx * halfW;
      const ly = p.y - ny * halfW;
      const rx = p.x + nx * halfW;
      const ry = p.y + ny * halfW;

      leftBank.push({ x: lx, y: ly });
      rightBank.push({ x: rx, y: ry });

      // Intaglio bank fringe ticks pointing inward into the water
      if (i % 2 === 0 && p.width >= 3.0) {
        const fLen = 1.6 + (rng ? rng() : 0.5) * 1.5;
        bankFringes.push({
          x1: lx, y1: ly,
          x2: lx + nx * fLen, y2: ly + ny * fLen,
        });
        bankFringes.push({
          x1: rx, y1: ry,
          x2: rx - nx * fLen, y2: ry - ny * fLen,
        });
      }
    }

    // Concentric waterline streamlines
    const streamlines = [];
    // 1. Center streamline (width >= 4.5px)
    const centerPts = [];
    for (let i = 0; i < N; i++) {
      if (points[i].width >= 4.5) {
        centerPts.push({ x: points[i].x, y: points[i].y });
      }
    }
    if (centerPts.length >= 2) {
      streamlines.push({ points: centerPts, opacity: 0.45, lineWidth: 0.75 });
    }

    // 2. Quarter-width streamlines for wide reaches (width >= 8.5px)
    const leftStream = [];
    const rightStream = [];
    for (let i = 0; i < N; i++) {
      if (points[i].width >= 8.5) {
        const p = points[i];
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(N - 1, i + 1)];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const off = p.width * 0.25;

        leftStream.push({ x: p.x - nx * off, y: p.y - ny * off });
        rightStream.push({ x: p.x + nx * off, y: p.y + ny * off });
      }
    }
    if (leftStream.length >= 2) {
      streamlines.push({ points: leftStream, opacity: 0.30, lineWidth: 0.60 });
    }
    if (rightStream.length >= 2) {
      streamlines.push({ points: rightStream, opacity: 0.30, lineWidth: 0.60 });
    }

    return { leftBank, rightBank, bankFringes, streamlines };
  }

  /**
   * Trace a river originating sideways from a ridge flank
   */
  createRiverFromRidge(ridge, allRidges, options = {}) {
    const { rng, totalW, totalH } = this;
    if (!ridge.facets || ridge.facets.length === 0) return null;

    // Midpoint facet along the ridge
    const midIdx = Math.floor(ridge.facets.length * (0.30 + rng() * 0.40));
    const facet = ridge.facets[midIdx];

    // Target mode: "ocean" or "lake"
    const hasOcean = this.coastEngine && this.coastEngine.coasts && this.coastEngine.coasts.length > 0;
    let target = options.target || (hasOcean ? "ocean" : "lake");

    // Intelligently select flank:
    // If ocean-bound, pick the flank facing the sea; if lake-bound, pick flank facing open valley
    let side = options.side;
    if (!side) {
      if (hasOcean && target === "ocean") {
        const leftCoast = this.coastEngine.getNearestCoastPoint(facet.leftEndA.x, facet.leftEndA.y);
        const rightCoast = this.coastEngine.getNearestCoastPoint(facet.rightEndA.x, facet.rightEndA.y);
        const distL = leftCoast ? Math.hypot(leftCoast.x - facet.leftEndA.x, leftCoast.y - facet.leftEndA.y) : 9999;
        const distR = rightCoast ? Math.hypot(rightCoast.x - facet.rightEndA.x, rightCoast.y - facet.rightEndA.y) : 9999;
        side = distL <= distR ? "left" : "right";
      } else {
        let clearanceL = 0, clearanceR = 0;
        for (let r of allRidges) {
          if (r !== ridge) {
            clearanceL += Math.hypot(facet.leftEndA.x - r.startX, facet.leftEndA.y - r.startY);
            clearanceR += Math.hypot(facet.rightEndA.x - r.startX, facet.rightEndA.y - r.startY);
          }
        }
        side = clearanceL >= clearanceR ? "left" : "right";
      }
    }

    const origin = side === "left" ? facet.leftEndA : facet.rightEndA;
    const spinePt = facet.pA;

    // Outward angle pointing down the mountain flank into the valley
    const outwardAngle = Math.atan2(origin.y - spinePt.y, origin.x - spinePt.x);
    const flowPower = Math.min(1.5, Math.max(0.7, (ridge.length || 200) / 200));

    let nearestCoastPt = null;
    let toCoastAngle = outwardAngle;
    if (hasOcean) {
      nearestCoastPt = this.coastEngine.getNearestCoastPoint(origin.x, origin.y);
      if (nearestCoastPt) {
        toCoastAngle = Math.atan2(nearestCoastPt.y - origin.y, nearestCoastPt.x - origin.x);
      }
    }

    let curAngle;
    if (target === "ocean" && nearestCoastPt) {
      // Flow outward from ridge, steered toward nearest ocean while retaining outward flank momentum
      const diff = Math.atan2(Math.sin(toCoastAngle - outwardAngle), Math.cos(toCoastAngle - outwardAngle));
      const steer = Math.max(-Math.PI * 0.40, Math.min(Math.PI * 0.40, diff));
      curAngle = outwardAngle + steer * 0.65;
    } else {
      // Flow outward into the valley plains
      curAngle = outwardAngle;
    }

    const meanderWavelength = 65 + rng() * 35;
    const meanderAmp = 0.60 + rng() * 0.25;
    const meanderSeed = rng() * 100;

    const points = [{ x: origin.x, y: origin.y }];
    let curX = origin.x;
    let curY = origin.y;
    let totalDist = 0;
    const step = 7;

    const pad = 36;
    let isSeaEstuary = false;
    let endLake = null;

    // Max steps: 280 steps (~1960px) allows reaching the ocean anywhere on the map;
    // lake: 30-55 steps (~210-385px) gives generous open plains clearance
    const maxSteps = target === "ocean" ? 280 : (30 + Math.floor(rng() * 25));

    for (let s = 0; s < maxSteps; s++) {
      // Harmonic meander wave
      const sinWave = Math.sin((totalDist + meanderSeed) / meanderWavelength * Math.PI * 2) * meanderAmp;
      const noiseWave = fbm1D(totalDist * 0.025, this.seed + 15) * 0.40;
      const stepAngle = curAngle + (sinWave * 0.7 + noiseWave * 0.3);

      const nextX = curX + Math.cos(stepAngle) * step;
      const nextY = curY + Math.sin(stepAngle) * step;

      // 1. Ocean Check: did we reach the sea?
      if (this.coastEngine && this.coastEngine.isOcean({ x: nextX, y: nextY })) {
        curX = nextX;
        curY = nextY;
        points.push({ x: curX, y: curY });
        isSeaEstuary = true;
        break;
      }

      // 2. Neatline boundary check: stop right at the border
      if (nextX < pad || nextX > totalW - pad || nextY < pad || nextY > totalH - pad) {
        break;
      }

      // 3. Ridge Collision Check (can't flow into a mountain!)
      // When leaving parent ridge (totalDist < 85), only test against other ridges and parent spine
      const testRidges = totalDist < 85 ? allRidges.filter(r => r !== ridge) : allRidges;
      if (RiverNetwork.segmentCrossesRidges({ x: curX, y: curY }, { x: nextX, y: nextY }, testRidges) ||
          RiverNetwork.isPointInsideRidge({ x: nextX, y: nextY }, testRidges, 22)) {
        break;
      }
      if (ridge.backbone && ridge.backbone.length > 1) {
        let crossedOwnSpine = false;
        for (let bi = 0; bi < ridge.backbone.length - 1; bi++) {
          if (RiverNetwork.segmentsIntersect({ x: curX, y: curY }, { x: nextX, y: nextY }, ridge.backbone[bi], ridge.backbone[bi + 1])) {
            crossedOwnSpine = true;
            break;
          }
        }
        if (crossedOwnSpine) break;
      }

      curX = nextX;
      curY = nextY;
      totalDist += step;
      points.push({ x: curX, y: curY });

      // If seeking ocean, continuously steer toward nearest coast point
      if (target === "ocean" && nearestCoastPt) {
        const localCoastPt = this.coastEngine.getNearestCoastPoint(curX, curY);
        if (localCoastPt) {
          const directAngle = Math.atan2(localCoastPt.y - curY, localCoastPt.x - curX);
          const diff = Math.atan2(Math.sin(directAngle - curAngle), Math.cos(directAngle - curAngle));
          curAngle += diff * 0.055;
        }
      }
    }

    // Estuary snap: If the river approached within reach of the ocean, discharge cleanly into the sea
    if (!isSeaEstuary && this.coastEngine) {
      const nearCoast = this.coastEngine.getNearestCoastPoint(curX, curY);
      if (nearCoast && Math.hypot(nearCoast.x - curX, nearCoast.y - curY) < 38) {
        points.push({ x: nearCoast.x, y: nearCoast.y });
        isSeaEstuary = true;
      }
    }

    // MANDATORY RULE: If the river did not reach the ocean, IT MUST FORM A SAFE LAKE!
    if (!isSeaEstuary) {
      let lakePlaced = false;
      const sizeMultipliers = [1.0, 0.78, 0.58, 0.42];

      // Search backwards along points to find where a safe lake fits without colliding with ridges or ocean
      const minIndex = Math.max(3, Math.floor(points.length * 0.15));
      for (let bi = points.length - 1; bi >= minIndex; bi -= 2) {
        const pt = points[bi];
        const prevPt = points[Math.max(0, bi - 1)];
        const entryAngle = Math.atan2(pt.y - prevPt.y, pt.x - prevPt.x);

        for (let mult of sizeMultipliers) {
          const candLake = this.createLake(pt.x, pt.y, entryAngle, flowPower * mult);
          if (RiverNetwork.isLakeSafe(candLake, allRidges, this.coastEngine, totalW, totalH)) {
            endLake = candLake;
            this.lakes.push(endLake);
            points.splice(bi + 1);
            points.push({ x: endLake.mouthX, y: endLake.mouthY });
            lakePlaced = true;
            break;
          }
        }
        if (lakePlaced) break;
      }

      // If no inland lake fit and the river is within reach of the coast, discharge to sea
      if (!lakePlaced && this.coastEngine) {
        const lastPt = points[points.length - 1];
        const nearCoast = this.coastEngine.getNearestCoastPoint(lastPt.x, lastPt.y);
        if (nearCoast && Math.hypot(nearCoast.x - lastPt.x, nearCoast.y - lastPt.y) < 70) {
          points.push({ x: nearCoast.x, y: nearCoast.y });
          isSeaEstuary = true;
        }
      }
    }

    // Compute widening progression along the river
    const N = points.length;
    for (let i = 0; i < N; i++) {
      const t = i / Math.max(1, N - 1);
      let w;
      if (isSeaEstuary) {
        // Mountain hairline (1.0px) -> Mid channel (6.0px) -> Coast (11.0px) -> Estuary mouth (18.0px)
        w = 1.0 + Math.pow(t, 0.70) * 8.5 * flowPower;
        if (t > 0.80) {
          w += Math.pow((t - 0.80) / 0.20, 1.2) * 8.5 * flowPower;
        }
      } else {
        // Mountain hairline (1.0px) -> Valley channel (5.5px) -> Lake entry (11.5px)
        w = 1.0 + Math.pow(t, 0.65) * 8.0 * flowPower;
      }
      points[i].width = Math.max(1.0, w);
    }

    const ribbon = RiverNetwork.computeRiverRibbon(points, rng);

    const river = {
      points,
      leftBank: ribbon.leftBank,
      rightBank: ribbon.rightBank,
      bankFringes: ribbon.bankFringes,
      streamlines: ribbon.streamlines,
      totalDist,
      flowPower,
      lake: endLake,
      isSeaEstuary,
      avgY: points.reduce((acc, p) => acc + p.y, 0) / points.length,
    };

    this.rivers.push(river);
    return river;
  }

  /**
   * Create an organic "punctured blob" lake.
   * Features:
   * - Oblique 2.5D projection: naturally wider along X than Y (horizontal stretch 1.45x).
   * - Scaled base radius (52 - 84px base, substantial landmark lake).
   */
  createLake(mouthX, mouthY, entryAngle, flowPower) {
    const { rng } = this;
    const baseRadius = (52 + rng() * 32) * Math.sqrt(flowPower);
    const stretchX = 1.45 + rng() * 0.20; // Oblique horizontal expansion
    const stretchY = 0.88 + rng() * 0.12;

    const centerX = mouthX + Math.cos(entryAngle) * (baseRadius * stretchX * 0.85);
    const centerY = mouthY + Math.sin(entryAngle) * (baseRadius * stretchY * 0.85);

    const lakeObj = {
      x: centerX,
      y: centerY,
      baseRadius,
      radius: baseRadius * Math.max(stretchX, stretchY) * 1.15,
      stretchX,
      stretchY,
      flowPower,
      entryAngle,
      riverCount: 1,
      poly: [],
      waterlines: [],
      coastFringes: [],
      mouthX,
      mouthY,
      avgY: centerY,
    };

    this.rebuildLakeGeometry(lakeObj);
    return lakeObj;
  }

  /**
   * Rebuilds the lake polygon, concentric waterlining echo contours,
   * and intaglio shoreline fringe ticks.
   * Called when a new river joins the lake to enlarge its basin!
   */
  rebuildLakeGeometry(lake) {
    const { rng } = this;
    // High-resolution sampling (120 points) for ultra-smooth curvilinear shores
    const numPoints = 120;
    const poly = [];
    const radialDists = [];
    const entryDir = (lake.entryAngle + Math.PI) % (Math.PI * 2);

    let actualMouthPt = { x: lake.mouthX, y: lake.mouthY };

    // Scale radius by number of rivers feeding it (major confluence expands the lake basin!)
    const confluenceScale = Math.pow(lake.riverCount, 0.45);
    const rBase = lake.baseRadius * confluenceScale;

    // Sample smooth harmonic radial curve (low frequency harmonic sines + subtle fbm)
    for (let i = 0; i < numPoints; i++) {
      const a = (i / numPoints) * Math.PI * 2;
      let diff = Math.abs(a - entryDir);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;

      // Puncture effect: smooth Gaussian-like pinch where river enters
      const punctureFactor = diff < 0.50 ? (0.75 + (diff / 0.50) * 0.25) : 1.0;
      // Smooth harmonic variations (no high-frequency jagged poly breaks)
      const rHarmonic = 1.0 + Math.sin(a * 2.0 + 1.2) * 0.12 + Math.cos(a * 3.0 - 0.7) * 0.08;
      const rNoise = rHarmonic * (0.94 + fbm1D(a * 1.5, this.seed + 80) * 0.12);
      const r = rBase * punctureFactor * rNoise;

      // Apply oblique projection stretch (wider along X than Y)
      const px = lake.x + Math.cos(a) * (r * lake.stretchX);
      const py = lake.y + Math.sin(a) * (r * lake.stretchY);
      poly.push({ x: px, y: py, normalAngle: a });
      radialDists.push(r);

      if (diff < (Math.PI * 2 / numPoints) * 0.7) {
        actualMouthPt = { x: px, y: py };
      }
    }

    // 1. Concentric Waterlining Echo Contours (radiating inward into the lake water)
    const distances = [3.5, 8.0, 14.5, 23.0, 33.0];
    const opacities = [0.65, 0.48, 0.32, 0.20, 0.12];
    const widths    = [1.1, 0.85, 0.70, 0.60, 0.50];
    const waterlines = [];

    for (let ringIdx = 0; ringIdx < distances.length; ringIdx++) {
      const d = distances[ringIdx];
      // Only draw this ring if the lake interior is wide enough
      if (rBase - d < 12) break;

      const ringPts = [];
      for (let i = 0; i < numPoints; i++) {
        const a = (i / numPoints) * Math.PI * 2;
        const rOrig = radialDists[i];
        const wave = 1.0 + Math.sin(a * 3.0 + ringIdx * 1.5) * 0.04;
        const rInner = Math.max(8, rOrig - (d * wave));

        const rx = lake.x + Math.cos(a) * (rInner * lake.stretchX);
        const ry = lake.y + Math.sin(a) * (rInner * lake.stretchY);
        ringPts.push({ x: rx, y: ry });
      }

      waterlines.push({
        points: ringPts,
        opacity: opacities[ringIdx],
        lineWidth: widths[ringIdx],
      });
    }

    // 2. Intaglio Shoreline Fringe Ticks (short pen marks pointing into water)
    const coastFringes = [];
    for (let i = 0; i < poly.length; i += 2) {
      const p = poly[i];
      const prev = poly[(i - 1 + poly.length) % poly.length];
      const next = poly[(i + 1) % poly.length];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len;
      let ny = dx / len;

      // Ensure normal points inward into the lake
      const testPt = { x: p.x + nx * 3, y: p.y + ny * 3 };
      if (!RiverNetwork.pointInPoly(testPt, poly)) {
        nx = -nx;
        ny = -ny;
      }

      const fringeLen = 2.0 + (rng() || 0.5) * 2.5;
      coastFringes.push({
        x1: p.x,
        y1: p.y,
        x2: p.x + nx * fringeLen,
        y2: p.y + ny * fringeLen,
      });
    }

    lake.poly = poly;
    lake.waterlines = waterlines;
    lake.coastFringes = coastFringes;
    lake.mouthX = actualMouthPt.x;
    lake.mouthY = actualMouthPt.y;
    lake.radius = rBase * Math.max(lake.stretchX, lake.stretchY) * 1.15;
  }

  /**
   * Connect a secondary ridge to an existing lake ONLY IF line of sight is clear (no mountain crossing!)
   */
  connectRidgeToLake(ridge, lake, allRidges) {
    if (!ridge.facets || ridge.facets.length === 0) return null;

    // Find the facet with clearest line-of-sight to the lake
    let candidates = [];
    for (let f of ridge.facets) {
      const leftDist = Math.hypot(lake.mouthX - f.leftEndA.x, lake.mouthY - f.leftEndA.y);
      const rightDist = Math.hypot(lake.mouthX - f.rightEndA.x, lake.mouthY - f.rightEndA.y);
      candidates.push({ origin: f.leftEndA, dist: leftDist, facet: f });
      candidates.push({ origin: f.rightEndA, dist: rightDist, facet: f });
    }
    candidates.sort((a, b) => a.dist - b.dist);

    let chosenOrigin = null;
    let chosenDist = 0;

    for (let c of candidates) {
      // Test direct line of sight: must NOT cross any mountain ridge!
      // (Only check against other ridges, or test outside candidate's own facet)
      const testP1 = {
        x: c.origin.x + (lake.mouthX - c.origin.x) * 0.05,
        y: c.origin.y + (lake.mouthY - c.origin.y) * 0.05,
      };
      const testP2 = {
        x: lake.mouthX - (lake.mouthX - c.origin.x) * 0.05,
        y: lake.mouthY - (lake.mouthY - c.origin.y) * 0.05,
      };

      if (!RiverNetwork.segmentCrossesRidges(testP1, testP2, allRidges)) {
        chosenOrigin = c.origin;
        chosenDist = c.dist;
        break;
      }
    }

    // If no ridge facet has clear line of sight without crossing a mountain, DO NOT CONNECT!
    if (!chosenOrigin) return null;

    // Trace smooth meandering path from chosen origin to the lake mouth
    const points = [{ x: chosenOrigin.x, y: chosenOrigin.y, width: 0.8 }];
    let curX = chosenOrigin.x;
    let curY = chosenOrigin.y;
    const step = 8;
    const meanderWavelength = 55;
    const meanderAmp = 0.55;

    let distTraveled = 0;
    while (Math.hypot(lake.mouthX - curX, lake.mouthY - curY) > step * 1.2) {
      const distToLake = Math.hypot(lake.mouthX - curX, lake.mouthY - curY);
      const directAngle = Math.atan2(lake.mouthY - curY, lake.mouthX - curX);

      const sinWave = Math.sin(distTraveled / meanderWavelength * Math.PI * 2) * meanderAmp;
      const angle = directAngle + sinWave * 0.6;

      const nextX = curX + Math.cos(angle) * step;
      const nextY = curY + Math.sin(angle) * step;

      // Abort if it encounters a mountain
      if (distTraveled > 25 && RiverNetwork.segmentCrossesRidges({ x: curX, y: curY }, { x: nextX, y: nextY }, allRidges)) {
        return null;
      }

      curX = nextX;
      curY = nextY;
      distTraveled += step;
      points.push({ x: curX, y: curY });

      if (points.length > 70) break; // safety
    }

    // Snap cleanly to the lake shoreline!
    points.push({ x: lake.mouthX, y: lake.mouthY });

    // Multi-river confluence: increase lake basin size if safe!
    const oldRiverCount = lake.riverCount || 1;
    lake.riverCount = oldRiverCount + 1;
    this.rebuildLakeGeometry(lake);
    if (!RiverNetwork.isLakeSafe(lake, allRidges, this.coastEngine, this.totalW, this.totalH)) {
      // Revert if expanded geometry violates safety clearance against ridges or ocean!
      lake.riverCount = oldRiverCount;
      this.rebuildLakeGeometry(lake);
    }

    // Compute widening progression along tributary
    const N = points.length;
    for (let i = 0; i < N; i++) {
      const t = i / Math.max(1, N - 1);
      points[i].width = 1.0 + Math.pow(t, 0.65) * 8.0;
    }

    const ribbon = RiverNetwork.computeRiverRibbon(points, this.rng);

    const river = {
      points,
      leftBank: ribbon.leftBank,
      rightBank: ribbon.rightBank,
      bankFringes: ribbon.bankFringes,
      streamlines: ribbon.streamlines,
      totalDist: chosenDist,
      flowPower: 1.0,
      lake,
      isSeaEstuary: false,
      avgY: points.reduce((acc, p) => acc + p.y, 0) / points.length,
    };

    this.rivers.push(river);
    return river;
  }

  /**
   * Render rivers and lakes
   */
  draw(ctx, palette, progress = 1.0) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 1. Draw Rivers first (so river lines terminate naturally under the lake's opaque paper mask)
    for (let river of this.rivers) {
      const maxPts = Math.floor(river.points.length * progress);
      if (maxPts < 2) continue;

      const subLeft = river.leftBank ? river.leftBank.slice(0, maxPts) : null;
      const subRight = river.rightBank ? river.rightBank.slice(0, maxPts) : null;

      if (subLeft && subRight && subLeft.length >= 2) {
        // A. Opaque Paper Mask (cleanly masks terrain and mountains underneath)
        ctx.fillStyle = palette.paper;
        ctx.beginPath();
        ctx.moveTo(subLeft[0].x, subLeft[0].y);
        for (let i = 1; i < subLeft.length; i++) ctx.lineTo(subLeft[i].x, subLeft[i].y);
        for (let i = subRight.length - 1; i >= 0; i--) ctx.lineTo(subRight[i].x, subRight[i].y);
        ctx.closePath();
        ctx.fill();

        // B. Atmospheric Watercolor Wash (Water Interior matching lakes & sea)
        if (palette.shadowWash) {
          ctx.fillStyle = palette.shadowWash;
          ctx.globalAlpha = 0.22;
          ctx.beginPath();
          ctx.moveTo(subLeft[0].x, subLeft[0].y);
          for (let i = 1; i < subLeft.length; i++) ctx.lineTo(subLeft[i].x, subLeft[i].y);
          for (let i = subRight.length - 1; i >= 0; i--) ctx.lineTo(subRight[i].x, subRight[i].y);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }

        // C. Concentric Waterline Streamlines (flowing down the river interior)
        if (river.streamlines) {
          ctx.strokeStyle = palette.ink;
          for (let st of river.streamlines) {
            const stPts = Math.floor(st.points.length * progress);
            if (stPts < 2) continue;

            ctx.lineWidth = st.lineWidth;
            ctx.globalAlpha = st.opacity;
            ctx.beginPath();
            ctx.moveTo(st.points[0].x, st.points[0].y);
            for (let i = 1; i < stPts; i++) {
              ctx.lineTo(st.points[i].x, st.points[i].y);
            }
            ctx.stroke();
          }
          ctx.globalAlpha = 1.0;
        }

        // D. Intaglio Bank Fringe Ticks (short perpendicular ticks pointing into the water)
        if (river.bankFringes) {
          ctx.strokeStyle = palette.ink;
          ctx.lineWidth = 0.70;
          ctx.globalAlpha = 0.55;
          const maxFringes = Math.floor(river.bankFringes.length * progress);
          for (let i = 0; i < maxFringes; i++) {
            const f = river.bankFringes[i];
            ctx.beginPath();
            ctx.moveTo(f.x1, f.y1);
            ctx.lineTo(f.x2, f.y2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1.0;
        }

        // E. Crisp Ink Bank Lines
        ctx.strokeStyle = palette.ink;
        ctx.lineWidth = 1.1;

        // Left Bank
        ctx.beginPath();
        ctx.moveTo(subLeft[0].x, subLeft[0].y);
        for (let i = 1; i < subLeft.length; i++) {
          ctx.lineTo(subLeft[i].x, subLeft[i].y);
        }
        ctx.stroke();

        // Right Bank
        ctx.beginPath();
        ctx.moveTo(subRight[0].x, subRight[0].y);
        for (let i = 1; i < subRight.length; i++) {
          ctx.lineTo(subRight[i].x, subRight[i].y);
        }
        ctx.stroke();
      }
    }

    // 2. Draw Lakes on top:
    // Opaque paper base mask cleanly covers any incoming river lines!
    for (let lake of this.lakes) {
      if (lake.poly.length < 3) continue;

      // 1. Opaque paper base mask
      ctx.fillStyle = palette.paper;
      ctx.beginPath();
      ctx.moveTo(lake.poly[0].x, lake.poly[0].y);
      for (let i = 1; i < lake.poly.length; i++) {
        ctx.lineTo(lake.poly[i].x, lake.poly[i].y);
      }
      ctx.closePath();
      ctx.fill();

      // 2. Atmospheric watercolor wash on lake surface
      if (palette.shadowWash) {
        ctx.fillStyle = palette.shadowWash;
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.moveTo(lake.poly[0].x, lake.poly[0].y);
        for (let i = 1; i < lake.poly.length; i++) {
          ctx.lineTo(lake.poly[i].x, lake.poly[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // 3. Concentric Waterlining Echo Contours (radiating inward into the water)
      if (lake.waterlines) {
        ctx.strokeStyle = palette.ink;
        for (let wl of lake.waterlines) {
          const maxPts = Math.floor(wl.points.length * progress);
          if (maxPts < 2) continue;

          ctx.lineWidth = wl.lineWidth;
          ctx.globalAlpha = wl.opacity;
          ctx.beginPath();
          ctx.moveTo(wl.points[0].x, wl.points[0].y);
          for (let i = 1; i < maxPts; i++) {
            ctx.lineTo(wl.points[i].x, wl.points[i].y);
          }
          if (progress >= 1.0) {
            ctx.closePath();
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
      }

      // 4. Intaglio Shoreline Fringe Ticks (short pen marks pointing into water)
      if (lake.coastFringes) {
        ctx.strokeStyle = palette.ink;
        ctx.lineWidth = 0.75;
        ctx.globalAlpha = 0.65;
        const maxFringes = Math.floor(lake.coastFringes.length * progress);
        for (let i = 0; i < maxFringes; i++) {
          const f = lake.coastFringes[i];
          ctx.beginPath();
          ctx.moveTo(f.x1, f.y1);
          ctx.lineTo(f.x2, f.y2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
      }

      // 5. Primary Shoreline Pen Stroke (Bold, crisp cartographic shore boundary)
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 1.8;
      const maxPts = Math.floor(lake.poly.length * progress);
      if (maxPts >= 2) {
        ctx.beginPath();
        ctx.moveTo(lake.poly[0].x, lake.poly[0].y);
        for (let i = 1; i < maxPts; i++) {
          ctx.lineTo(lake.poly[i].x, lake.poly[i].y);
        }
        if (progress >= 1.0) {
          ctx.closePath();
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { RiverNetwork };
}
