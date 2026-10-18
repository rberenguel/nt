// Procedural Fantasy Coastline & Waterlining Engine
// Features:
// 1. Organic continental and coastal outlines (fjords, capes, peninsulas, bays).
// 2. Authentic cartographic "waterlining" (concentric ripple echo contours radiating into the sea).
// 3. Intaglio coastal stipple/shading fringe.
// 4. Watercolor sea glaze distinguishing ocean from landmass.

class CoastlineEngine {
  constructor(totalW, totalH, seed = Math.floor(Math.random() * 1000000)) {
    this.totalW = totalW;
    this.totalH = totalH;
    this.seed = seed;
    this.rng = createRNG(seed);

    this.coasts = [];       // Array of continuous coastal curves (polylines)
    this.oceanPolys = [];   // Polygons covering the sea (for subtle wash)
    this.waterlines = [];   // Concentric echo contour paths radiating into the water
    this.coastFringes = []; // Intaglio stipples/short hash ticks along the land-water edge
  }

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

  isOcean(pt, margin = 0) {
    if (this.oceanPolys.length === 0) return false;
    for (let poly of this.oceanPolys) {
      if (CoastlineEngine.pointInPoly(pt, poly)) return true;
    }
    if (margin > 0 && this.coasts.length > 0) {
      for (let coast of this.coasts) {
        for (let cp of coast) {
          if (Math.hypot(pt.x - cp.x, pt.y - cp.y) < margin) {
            return true;
          }
        }
      }
    }
    return false;
  }

  getNearestCoastPoint(x, y) {
    let nearest = null;
    let minDist = Infinity;
    for (let coast of this.coasts) {
      for (let p of coast) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < minDist) {
          minDist = d;
          nearest = p;
        }
      }
    }
    return nearest;
  }

  /**
   * Generate an organic coastal boundary.
   * Styles:
   * - "west-ocean": Ocean on the left/west, land on the right/east.
   * - "east-ocean": Ocean on the right/east, land on the left/west.
   * - "south-ocean": Ocean across the bottom/south.
   * - "north-ocean": Ocean across the top/north.
   */
  generateCoast(style = "west-ocean") {
    const { rng, totalW, totalH } = this;
    const pad = 28; // align with neatline
    this.coastStyle = style;
    this.pad = pad;
    this.coasts = [];
    this.oceanPolys = [];
    this.waterlines = [];
    this.coastFringes = [];

    // Base jagged coastline path
    let mainCoast = [];

    if (style === "west-ocean") {
      // Ocean on the left (west): coast runs from top to bottom at ~26-34% width
      const startX = totalW * (0.24 + rng() * 0.10);
      const endX   = totalW * (0.26 + rng() * 0.10);
      const numNodes = 7;
      const baseNodes = [{ x: startX, y: pad }];

      for (let i = 1; i < numNodes; i++) {
        const t = i / numNodes;
        // Large bays and peninsulas
        const bayNoise = fbm1D(t * 3.5, this.seed + 30) * (totalW * 0.18);
        baseNodes.push({
          x: startX + (endX - startX) * t + bayNoise,
          y: pad + (totalH - pad * 2) * t,
        });
      }
      baseNodes.push({ x: endX, y: totalH - pad });

      // Fractalize with fine craggy coastal detail (fjords & coves)
      mainCoast = this.fractalizeCoast(baseNodes, 4, 0.32);

      // Ocean polygon: left edge to coast
      const oceanPoly = [
        { x: pad, y: pad },
        ...mainCoast,
        { x: pad, y: totalH - pad },
      ];
      this.oceanPolys.push(oceanPoly);

      // Waterlining radiating WEST into the sea
      this.generateWaterlines(mainCoast, -1, 0, 5);

    } else if (style === "east-ocean") {
      // Ocean on the right (east): coast runs from top to bottom at ~66-76% width
      const startX = totalW * (0.74 - rng() * 0.10);
      const endX   = totalW * (0.72 - rng() * 0.10);
      const numNodes = 7;
      const baseNodes = [{ x: startX, y: pad }];

      for (let i = 1; i < numNodes; i++) {
        const t = i / numNodes;
        const bayNoise = fbm1D(t * 3.5, this.seed + 40) * (totalW * 0.18);
        baseNodes.push({
          x: startX + (endX - startX) * t + bayNoise,
          y: pad + (totalH - pad * 2) * t,
        });
      }
      baseNodes.push({ x: endX, y: totalH - pad });

      mainCoast = this.fractalizeCoast(baseNodes, 4, 0.32);

      const oceanPoly = [
        { x: totalW - pad, y: pad },
        ...mainCoast,
        { x: totalW - pad, y: totalH - pad },
      ];
      this.oceanPolys.push(oceanPoly);

      // Waterlining radiating EAST into the sea
      this.generateWaterlines(mainCoast, 1, 0, 5);

    } else if (style === "north-ocean") {
      // North-ocean: Coast running west-to-east across the upper third
      const startY = totalH * (0.28 + rng() * 0.10);
      const endY   = totalH * (0.30 + rng() * 0.10);
      const numNodes = 8;
      const baseNodes = [{ x: pad, y: startY }];

      for (let i = 1; i < numNodes; i++) {
        const t = i / numNodes;
        const bayNoise = fbm1D(t * 4.0, this.seed + 60) * (totalH * 0.16);
        baseNodes.push({
          x: pad + (totalW - pad * 2) * t,
          y: startY + (endY - startY) * t + bayNoise,
        });
      }
      baseNodes.push({ x: totalW - pad, y: endY });

      mainCoast = this.fractalizeCoast(baseNodes, 4, 0.32);

      const oceanPoly = [
        { x: pad, y: pad },
        ...mainCoast,
        { x: totalW - pad, y: pad },
      ];
      this.oceanPolys.push(oceanPoly);

      // Waterlining radiating NORTH into the sea
      this.generateWaterlines(mainCoast, 0, -1, 5);

    } else {
      // South-ocean: Coast running west-to-east across the lower third
      const startY = totalH * (0.70 - rng() * 0.10);
      const endY   = totalH * (0.68 - rng() * 0.10);
      const numNodes = 8;
      const baseNodes = [{ x: pad, y: startY }];

      for (let i = 1; i < numNodes; i++) {
        const t = i / numNodes;
        const bayNoise = fbm1D(t * 4.0, this.seed + 50) * (totalH * 0.16);
        baseNodes.push({
          x: pad + (totalW - pad * 2) * t,
          y: startY + (endY - startY) * t + bayNoise,
        });
      }
      baseNodes.push({ x: totalW - pad, y: endY });

      mainCoast = this.fractalizeCoast(baseNodes, 4, 0.32);

      const oceanPoly = [
        { x: pad, y: totalH - pad },
        ...mainCoast,
        { x: totalW - pad, y: totalH - pad },
      ];
      this.oceanPolys.push(oceanPoly);

      // Waterlining radiating SOUTH into the sea
      this.generateWaterlines(mainCoast, 0, 1, 5);
    }

    this.coasts.push(mainCoast);

    // Intaglio coastal edge fringe (fine hatching / stipples along water line)
    this.generateCoastFringe(mainCoast);
  }

  fractalizeCoast(nodes, iterations, roughness) {
    let currentPath = nodes;
    for (let k = 0; k < iterations; k++) {
      const nextPath = [currentPath[0]];
      const octaveRoughness = roughness * Math.pow(0.75, k);

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

  /**
   * Authentic cartographic waterlining:
   * Generates concentric echo lines radiating into open water.
   * Spacing progressively widens: ring 1 is 3.5px, ring 2 is 8px, ring 3 is 14px, ring 4 is 22px...
   * Stroke opacity progressively fades: 0.65 -> 0.45 -> 0.30 -> 0.18 -> 0.10
   */
  generateWaterlines(coast, oceanDirX, oceanDirY, numRings = 5) {
    this.waterlines = [];
    const distances = [3.5, 8.0, 14.5, 23.0, 34.0];
    const opacities = [0.65, 0.48, 0.32, 0.20, 0.12];
    const widths = [1.1, 0.85, 0.70, 0.60, 0.50];
    const pad = this.pad || 28;

    for (let r = 0; r < Math.min(numRings, distances.length); r++) {
      const dist = distances[r];
      const ring = [];

      for (let i = 0; i < coast.length; i++) {
        const p = coast[i];
        // Calculate tangent and perpendicular normal vector
        let nx = 0, ny = 0;
        if (i === 0) {
          const dx = coast[1].x - p.x;
          const dy = coast[1].y - p.y;
          nx = -dy; ny = dx;
        } else if (i === coast.length - 1) {
          const dx = p.x - coast[i - 1].x;
          const dy = p.y - coast[i - 1].y;
          nx = -dy; ny = dx;
        } else {
          const dx = coast[i + 1].x - coast[i - 1].x;
          const dy = coast[i + 1].y - coast[i - 1].y;
          nx = -dy; ny = dx;
        }

        const len = Math.hypot(nx, ny) || 1;
        nx /= len; ny /= len;

        // Ensure normal points toward the ocean using pointInPoly test point
        const testPt = { x: p.x + nx * 5, y: p.y + ny * 5 };
        let pointsToOcean = false;
        for (let op of this.oceanPolys) {
          if (CoastlineEngine.pointInPoly(testPt, op)) {
            pointsToOcean = true;
            break;
          }
        }
        if (!pointsToOcean) {
          if (nx * oceanDirX + ny * oceanDirY < 0) {
            nx = -nx;
            ny = -ny;
          }
        }

        // Slight harmonic variation in waterline spacing
        const wave = 1.0 + Math.sin(i * 0.15 + r * 1.5) * 0.08;
        const wx = p.x + nx * (dist * wave);
        const wy = p.y + ny * (dist * wave);

        ring.push({
          x: Math.max(pad, Math.min(this.totalW - pad, wx)),
          y: Math.max(pad, Math.min(this.totalH - pad, wy)),
        });
      }

      this.waterlines.push({
        points: ring,
        opacity: opacities[r],
        lineWidth: widths[r],
      });
    }
  }

  /**
   * Intaglio coastal edge fringe:
   * Tiny short pen ticks pointing outward from the land into the immediate water line.
   */
  generateCoastFringe(coast) {
    this.coastFringes = [];
    const pad = this.pad || 28;
    for (let i = 1; i < coast.length - 1; i += 2) {
      const p = coast[i];
      const prev = coast[i - 1];
      const next = coast[i + 1];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      let px = -dy / len;
      let py = dx / len;

      const testPt = { x: p.x + px * 3, y: p.y + py * 3 };
      let pointsToOcean = false;
      for (let op of this.oceanPolys) {
        if (CoastlineEngine.pointInPoly(testPt, op)) {
          pointsToOcean = true;
          break;
        }
      }
      if (!pointsToOcean) {
        px = -px;
        py = -py;
      }

      const fringeLen = 2.2 + this.rng() * 2.8;

      this.coastFringes.push({
        x1: p.x,
        y1: p.y,
        x2: Math.max(pad, Math.min(this.totalW - pad, p.x + px * fringeLen)),
        y2: Math.max(pad, Math.min(this.totalH - pad, p.y + py * fringeLen)),
      });
    }
  }

  /**
   * Render ocean wash, waterlines, and coastal pen strokes
   */
  draw(ctx, palette, progress = 1.0) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 1. Subtle Ocean Watercolor Wash
    if (palette.shadowWash && this.oceanPolys.length > 0) {
      ctx.fillStyle = palette.shadowWash;
      ctx.globalAlpha = 0.18; // soft oceanic tint
      for (let poly of this.oceanPolys) {
        if (poly.length < 3) continue;
        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) {
          ctx.lineTo(poly[i].x, poly[i].y);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    }

    // 2. Concentric Waterlining Echo Contours
    ctx.strokeStyle = palette.ink;
    for (let wl of this.waterlines) {
      const maxPts = Math.floor(wl.points.length * progress);
      if (maxPts < 2) continue;

      ctx.lineWidth = wl.lineWidth;
      ctx.globalAlpha = wl.opacity;
      ctx.beginPath();
      ctx.moveTo(wl.points[0].x, wl.points[0].y);
      for (let i = 1; i < maxPts; i++) {
        ctx.lineTo(wl.points[i].x, wl.points[i].y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // 3. Intaglio Coastal Edge Fringes
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 0.75;
    ctx.globalAlpha = 0.65;
    const maxFringes = Math.floor(this.coastFringes.length * progress);
    for (let i = 0; i < maxFringes; i++) {
      const f = this.coastFringes[i];
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1);
      ctx.lineTo(f.x2, f.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // 4. Primary Coastline Pen Ink Stroke (Bold, crisp shore boundary)
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.8;
    for (let coast of this.coasts) {
      const maxPts = Math.floor(coast.length * progress);
      if (maxPts < 2) continue;

      ctx.beginPath();
      ctx.moveTo(coast[0].x, coast[0].y);
      for (let i = 1; i < maxPts; i++) {
        ctx.lineTo(coast[i].x, coast[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CoastlineEngine };
}
