// Procedural Celestial Asterism & Voronoi Partition Engine
// Deconstructs the celestial vault into natural Voronoi territories (Lloyd relaxed)
// and generates organically rotated, grand constellations adapted to each cell's geometry.

/**
 * 2D Geometry helpers
 */
function dist2D(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function triangleArea(p1, p2, p3) {
  return 0.5 * Math.abs((p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y));
}

function distPointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-6) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function getMinStarDistance(mag1, mag2) {
  const r1 = (STAR_MAGNITUDES[mag1] || STAR_MAGNITUDES[6]).radius;
  const r2 = (STAR_MAGNITUDES[mag2] || STAR_MAGNITUDES[6]).radius;
  const base = (r1 + r2) * 2.2;
  if (mag1 === 1 || mag2 === 1) return Math.max(base, 56);
  if (mag1 === 2 || mag2 === 2) return Math.max(base, 44);
  if (mag1 === 3 || mag2 === 3) return Math.max(base, 34);
  return Math.max(base, 22);
}

function distToPolygonEdges(px, py, poly) {
  let minDist = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    let t = ((px - a.x) * dx + (py - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    const d = Math.hypot(px - projX, py - projY);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function pointInsidePoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Sutherland-Hodgman Polygon Half-Plane Clipping
 */
function clipPolygon(poly, nx, ny, px, py) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const da = (a.x - px) * nx + (a.y - py) * ny;
    const db = (b.x - px) * nx + (b.y - py) * ny;
    if (da >= 0) {
      if (db >= 0) {
        out.push(b);
      } else {
        const t = da / (da - db);
        out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
      }
    } else if (db >= 0) {
      const t = da / (da - db);
      out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
      out.push(b);
    }
  }
  return out;
}

/**
 * Computes polygon area and centroid
 */
function polygonCentroid(poly) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  area = area / 2;
  if (Math.abs(area) < 1e-5) return { area: 0, cx: poly[0].x, cy: poly[0].y };
  return { area: Math.abs(area), cx: cx / (6 * area), cy: cy / (6 * area) };
}

/**
 * Computes exact Voronoi cells inside rectangular bounds
 */
function computeVoronoiCells(sites, bounds) {
  const cells = [];
  const initialPoly = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];

  for (let i = 0; i < sites.length; i++) {
    let poly = [...initialPoly];
    const si = sites[i];

    for (let j = 0; j < sites.length; j++) {
      if (i === j) continue;
      const sj = sites[j];
      const mx = (si.x + sj.x) / 2;
      const my = (si.y + sj.y) / 2;
      const nx = si.x - sj.x;
      const ny = si.y - sj.y;
      poly = clipPolygon(poly, nx, ny, mx, my);
      if (poly.length === 0) break;
    }

    if (poly.length >= 3) {
      const { area, cx, cy } = polygonCentroid(poly);
      cells.push({ site: si, polygon: poly, area, cx, cy });
    }
  }
  return cells;
}

/**
 * Generates organic Voronoi breakdown using Lloyd's relaxation
 */
function generateRelaxedVoronoiPartition(bounds, numCells, rng) {
  const rawSites = [];
  const padX = (bounds.maxX - bounds.minX) * 0.08;
  const padY = (bounds.maxY - bounds.minY) * 0.08;

  for (let i = 0; i < numCells; i++) {
    rawSites.push({
      x: bounds.minX + padX + rng() * (bounds.maxX - bounds.minX - padX * 2),
      y: bounds.minY + padY + rng() * (bounds.maxY - bounds.minY - padY * 2),
    });
  }

  // 2 iterations of Lloyd relaxation for well-proportioned organic territories
  let sites = rawSites;
  for (let iter = 0; iter < 2; iter++) {
    const c = computeVoronoiCells(sites, bounds);
    if (c.length === sites.length) {
      sites = c.map((cell) => ({ x: cell.cx, y: cell.cy }));
    }
  }

  return computeVoronoiCells(sites, bounds);
}

function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  function ccw(ax, ay, bx, by, cx, cy) {
    return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
  }
  return (
    ccw(x1, y1, x3, y3, x4, y4) !== ccw(x2, y2, x3, y3, x4, y4) &&
    ccw(x1, y1, x2, y2, x3, y3) !== ccw(x1, y1, x2, y2, x4, y4)
  );
}

// ── Organic Procedural Asterism Generator ─────────────────────────────────────
// Generates 100% unique, non-repeating asterisms with realistic topological structures
// (spanning trees, local closed loops, natural branchings) tailored to the cell.

function generateProceduralAsterism(rng, aspectRatio) {
  const n = 5 + Math.floor(rng() * 6); // 5 to 10 stars
  const stars = [];

  function tryAddStar(candidate, minD = 0.38) {
    for (const s of stars) {
      if (dist2D(s, candidate) < minD) return false;
    }
    stars.push(candidate);
    return true;
  }

  // Determine structural morphology based on cell aspect ratio and randomized seeds
  let mode;
  if (aspectRatio > 1.4) {
    // Elongated cell -> Sinuous Spine or Wandering Chain
    mode = rng() < 0.6 ? 0 : 3;
  } else {
    // Balanced / compact cell -> Core Polygon with limbs or Branching Trident
    mode = rng() < 0.55 ? 1 : (rng() < 0.8 ? 2 : 0);
  }

  if (mode === 0) {
    // Mode 0: Spine + Branches (Vertebral structure with limbs)
    const spineCount = 3 + Math.floor(rng() * 3); // 3 to 5
    let curX = -0.5 * (spineCount - 1) * 0.42;
    let curY = (rng() - 0.5) * 0.2;
    let angle = (rng() - 0.5) * 0.35;
    for (let i = 0; i < spineCount; i++) {
      tryAddStar({ x: curX, y: curY }, 0.38);
      angle += (rng() - 0.5) * 0.5;
      curX += Math.cos(angle) * (0.40 + rng() * 0.25);
      curY += Math.sin(angle) * (0.40 + rng() * 0.25);
    }
    let attempts = 0;
    while (stars.length < n && attempts++ < 60) {
      const parent = stars[Math.floor(rng() * stars.length)];
      const bAngle = rng() * Math.PI * 2;
      const bDist = 0.38 + rng() * 0.30;
      tryAddStar({ x: parent.x + Math.cos(bAngle) * bDist, y: parent.y + Math.sin(bAngle) * bDist }, 0.38);
    }
  } else if (mode === 1) {
    // Mode 1: Core Polygon (triangle, quad, or trapezoid) + Trailing Rays / Tail
    const coreCount = rng() < 0.45 ? 3 : 4;
    const r = 0.38 + rng() * 0.20;
    for (let i = 0; i < coreCount; i++) {
      const a = (i / coreCount) * Math.PI * 2 + (rng() - 0.5) * 0.35;
      tryAddStar({ x: Math.cos(a) * r, y: Math.sin(a) * r }, 0.38);
    }
    let attempts = 0;
    while (stars.length < n && attempts++ < 60) {
      const parent = stars[Math.floor(rng() * stars.length)];
      const a = rng() * Math.PI * 2;
      const d = 0.38 + rng() * 0.32;
      tryAddStar({ x: parent.x + Math.cos(a) * d, y: parent.y + Math.sin(a) * d }, 0.38);
    }
  } else if (mode === 2) {
    // Mode 2: Branching Fork / Trident
    tryAddStar({ x: 0, y: 0 }, 0.38); // Central hub
    const numBranches = 2 + Math.floor(rng() * 2); // 2 or 3 branches
    for (let b = 0; b < numBranches; b++) {
      const bAngle = (b / numBranches) * Math.PI * 2 + (rng() - 0.5) * 0.45;
      let px = 0, py = 0;
      const segs = 1 + Math.floor(rng() * 2);
      for (let s = 0; s < segs && stars.length < n; s++) {
        px += Math.cos(bAngle + (rng() - 0.5) * 0.25) * (0.40 + rng() * 0.24);
        py += Math.sin(bAngle + (rng() - 0.5) * 0.25) * (0.40 + rng() * 0.24);
        tryAddStar({ x: px, y: py }, 0.38);
      }
    }
    let attempts = 0;
    while (stars.length < n && attempts++ < 60) {
      const parent = stars[Math.floor(rng() * stars.length)];
      const a = rng() * Math.PI * 2;
      const d = 0.38 + rng() * 0.30;
      tryAddStar({ x: parent.x + Math.cos(a) * d, y: parent.y + Math.sin(a) * d }, 0.38);
    }
  } else {
    // Mode 3: Sinuous Wandering Chain with companion stars
    let cx = 0, cy = 0;
    tryAddStar({ x: cx, y: cy }, 0.38);
    let a = (rng() - 0.5) * 0.8;
    const mainChain = Math.min(n, 4 + Math.floor(rng() * 3));
    for (let i = 1; i < mainChain; i++) {
      a += (rng() - 0.5) * 0.85;
      const d = 0.40 + rng() * 0.26;
      cx += Math.cos(a) * d;
      cy += Math.sin(a) * d;
      tryAddStar({ x: cx, y: cy }, 0.38);
    }
    let attempts = 0;
    while (stars.length < n && attempts++ < 60) {
      const parent = stars[Math.floor(rng() * stars.length)];
      const bAngle = rng() * Math.PI * 2;
      const bDist = 0.38 + rng() * 0.30;
      tryAddStar({ x: parent.x + Math.cos(bAngle) * bDist, y: parent.y + Math.sin(bAngle) * bDist }, 0.38);
    }
  }

  // Build Euclidean Minimum Spanning Tree (MST) on pairwise distances
  const numStars = stars.length;
  const allEdges = [];
  for (let i = 0; i < numStars; i++) {
    for (let j = i + 1; j < numStars; j++) {
      allEdges.push({ u: i, v: j, dist: dist2D(stars[i], stars[j]) });
    }
  }
  allEdges.sort((a, b) => a.dist - b.dist);

  const parent = Array.from({ length: numStars }, (_, i) => i);
  function find(i) {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  }
  function union(i, j) {
    const rI = find(i);
    const rJ = find(j);
    if (rI !== rJ) {
      parent[rI] = rJ;
      return true;
    }
    return false;
  }

  const edges = [];
  const degrees = new Array(numStars).fill(0);

  for (const e of allEdges) {
    if (union(e.u, e.v)) {
      edges.push(e);
      degrees[e.u]++;
      degrees[e.v]++;
      if (edges.length === numStars - 1) break;
    }
  }

  // Add 1 or 2 non-crossing chord loops between nearby low-degree stars
  // STRICT REFINEMENT: Never add a line if it forms a triangle with very small area or altitude,
  // or if it passes too close to an intermediate unconnected star.
  const candidateChords = allEdges.filter((e) => {
    const inMst = edges.some((me) => (me.u === e.u && me.v === e.v) || (me.u === e.v && me.v === e.u));
    if (inMst) return false;
    if (degrees[e.u] > 2 || degrees[e.v] > 2) return false;

    const p1 = stars[e.u];
    const p2 = stars[e.v];

    // Check no intersection with existing edges
    for (const ex of edges) {
      if (ex.u === e.u || ex.u === e.v || ex.v === e.u || ex.v === e.v) continue;
      const p3 = stars[ex.u];
      const p4 = stars[ex.v];
      if (segmentsIntersect(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y)) return false;
    }

    // Check clearance to all other stars and triangle areas
    for (let w = 0; w < numStars; w++) {
      if (w === e.u || w === e.v) continue;
      const pw = stars[w];

      // Disallow lines that slice right past an intermediate star
      if (distPointToSegment(pw.x, pw.y, p1.x, p1.y, p2.x, p2.y) < 0.16) return false;

      // If adding this line closes a triangle with existing edges (u-w and v-w),
      // verify the triangle has substantial, open area (no skinny slivers)
      const hasUW = edges.some((ex) => (ex.u === e.u && ex.v === w) || (ex.u === w && ex.v === e.u));
      const hasVW = edges.some((ex) => (ex.u === e.v && ex.v === w) || (ex.u === w && ex.v === e.v));
      if (hasUW && hasVW) {
        const area = triangleArea(p1, p2, pw);
        const maxSide = Math.max(dist2D(p1, p2), dist2D(p1, pw), dist2D(p2, pw));
        const altitude = (2 * area) / Math.max(1e-4, maxSide);
        if (area < 0.05 || altitude < 0.20) return false;
      }
    }

    return true;
  });

  const numChords = rng() < 0.65 ? 1 : (rng() < 0.28 ? 2 : 0);
  for (let c = 0; c < numChords && c < candidateChords.length; c++) {
    const chord = candidateChords[c];
    edges.push(chord);
    degrees[chord.u]++;
    degrees[chord.v]++;
  }

  // Assign magnitudes by degree and position with strict spacing for bright stars
  // Sort vertices by degree descending (highest degree hub gets alpha consideration)
  const sortedIndices = Array.from({ length: numStars }, (_, i) => i)
    .sort((a, b) => degrees[b] - degrees[a]);

  let alphaAssigned = false;
  let betaAssigned = false;
  let alphaStar = null;

  for (const idx of sortedIndices) {
    const deg = degrees[idx];
    let mag;

    if (!alphaAssigned && deg >= 2) {
      mag = 1; // Major Alpha luminary (1st magnitude)
      alphaAssigned = true;
      alphaStar = stars[idx];
    } else if (!betaAssigned && deg >= 2 && (!alphaStar || dist2D(stars[idx], alphaStar) > 0.70)) {
      mag = 2; // Beta luminary (2nd magnitude, well-separated from Alpha)
      betaAssigned = true;
    } else if (deg >= 2) {
      mag = rng() < 0.55 ? 3 : 4;
    } else {
      mag = rng() < 0.50 ? 4 : 5;
    }
    stars[idx].mag = mag;
  }

  return { stars, edges };
}

/**
 * Creates an asterism and fits it into a Voronoi cell with natural rotation
 */
function createConstellationForVoronoiCell(cell, rng, runFont, cIdx, usedNames, totalW = 0, totalH = 0) {
  const { cx, cy, polygon } = cell;

  // 1. Calculate the cell's principal axis (inertia tensor)
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of polygon) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const principalTheta = 0.5 * Math.atan2(2 * sxy, sxx - syy);

  // 2. Measure spans along principal and perpendicular axes
  const cosT = Math.cos(principalTheta);
  const sinT = Math.sin(principalTheta);
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (const p of polygon) {
    const u = (p.x - cx) * cosT + (p.y - cy) * sinT;
    const v = -(p.x - cx) * sinT + (p.y - cy) * cosT;
    if (u < uMin) uMin = u;
    if (u > uMax) uMax = u;
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
  }
  const spanU = uMax - uMin;
  const spanV = vMax - vMin;
  const aspectRatio = spanU / Math.max(1, spanV);

  // 3. Generate 100% procedural asterism adapted to cell geometry
  const unitAsterism = generateProceduralAsterism(rng, aspectRatio);
  let rawMinX = Infinity, rawMaxX = -Infinity, rawMinY = Infinity, rawMaxY = -Infinity;
  for (const s of unitAsterism.stars) {
    if (s.x < rawMinX) rawMinX = s.x;
    if (s.x > rawMaxX) rawMaxX = s.x;
    if (s.y < rawMinY) rawMinY = s.y;
    if (s.y > rawMaxY) rawMaxY = s.y;
  }
  const midX = (rawMinX + rawMaxX) / 2;
  const midY = (rawMinY + rawMaxY) / 2;

  // 5. Rotate unit asterism along cell's natural orientation (+ natural jitter)
  const rotAngle = principalTheta + (rng() - 0.5) * 0.35;
  const cosR = Math.cos(rotAngle);
  const sinR = Math.sin(rotAngle);

  const rotatedUnitStars = unitAsterism.stars.map((s, idx) => {
    const lx = s.x - midX;
    const ly = s.y - midY;
    const rx = lx * cosR - ly * sinR;
    const ry = lx * sinR + ly * cosR;
    return { rx, ry, mag: s.mag, starIdx: idx };
  });

  // Constellation name & label dimensions
  const normX = totalW > 0 ? cx / totalW : 0.5;
  const normY = totalH > 0 ? cy / totalH : 0.5;
  const nameData = generateConstellationName(rng, usedNames, normX, normY);
  let name = typeof nameData === "object" ? nameData.text : nameData;
  let lines = typeof nameData === "object" && nameData.lines ? nameData.lines : [name];

  const fontSize = 13.5;
  const longestLine = lines.reduce((max, l) => (l.length > max.length ? l : max), lines[0]);
  const approxCharW = fontSize * 0.62;
  const labelW = Math.round(longestLine.length * approxCharW + 16);
  const labelH = Math.round(lines.length > 1 ? fontSize * 2.3 : fontSize * 1.2);

  // 6. Maximize scale inside the Voronoi cell using binary search
  function checkFit(scale, labelPos) {
    const offsetY = labelPos === "below" ? -scale * 0.14 : scale * 0.14;
    let minSY = Infinity, maxSY = -Infinity, sumSX = 0;

    for (const s of rotatedUnitStars) {
      const sx = cx + scale * s.rx;
      const sy = cy + scale * s.ry + offsetY;
      if (sy < minSY) minSY = sy;
      if (sy > maxSY) maxSY = sy;
      sumSX += sx;

      // Stars must be inside polygon with at least 15px margin
      if (!pointInsidePoly(sx, sy, polygon) || distToPolygonEdges(sx, sy, polygon) < 15) {
        return false;
      }
    }

    const lx = sumSX / rotatedUnitStars.length;
    const ly = labelPos === "below" ? maxSY + 22 + labelH / 2 : minSY - 22 - labelH / 2;

    // Label 4 corners must be inside polygon with at least 8px margin
    const corners = [
      { x: lx - labelW / 2, y: ly - labelH / 2 },
      { x: lx + labelW / 2, y: ly - labelH / 2 },
      { x: lx - labelW / 2, y: ly + labelH / 2 },
      { x: lx + labelW / 2, y: ly + labelH / 2 },
    ];
    for (const c of corners) {
      if (!pointInsidePoly(c.x, c.y, polygon) || distToPolygonEdges(c.x, c.y, polygon) < 8) {
        return false;
      }
    }

    return true;
  }

  function findMaxScale(labelPos) {
    let low = 25, high = Math.min(spanU, spanV) * 0.95;
    if (high < low) return low;
    for (let iter = 0; iter < 10; iter++) {
      const mid = (low + high) / 2;
      if (checkFit(mid, labelPos)) low = mid;
      else high = mid;
    }
    return low;
  }

  // Try placing label below first; if restricted, check if placing above yields larger scale
  let bestLabelPos = "below";
  let bestScale = findMaxScale("below");
  const aboveScale = findMaxScale("above");
  if (aboveScale > bestScale * 1.15) {
    bestScale = aboveScale;
    bestLabelPos = "above";
  }

  // Apply 95% of maximum scale so it takes maximum space while maintaining breathing room
  const optimalScale = bestScale * 0.95;
  const finalOffsetY = bestLabelPos === "below" ? -optimalScale * 0.14 : optimalScale * 0.14;

  const finalStars = [];
  let sMinX = Infinity, sMaxX = -Infinity, sMinY = Infinity, sMaxY = -Infinity, sumX = 0;

  for (let i = 0; i < rotatedUnitStars.length; i++) {
    const s = rotatedUnitStars[i];
    const absX = cx + optimalScale * s.rx;
    const absY = cy + optimalScale * s.ry + finalOffsetY;

    if (absX < sMinX) sMinX = absX;
    if (absX > sMaxX) sMaxX = absX;
    if (absY < sMinY) sMinY = absY;
    if (absY > sMaxY) sMaxY = absY;
    sumX += absX;

    const conf = STAR_MAGNITUDES[s.mag] || STAR_MAGNITUDES[4];
    finalStars.push({
      x: absX,
      y: absY,
      mag: s.mag,
      points: conf.points,
      finalRadius: conf.radius * (0.92 + rng() * 0.16),
      rot: rng() * Math.PI,
      constellationIndex: cIdx,
      starIdx: i,
    });
  }

  // Post-pass: Enforce magnitude-aware distance between stars in final pixel space.
  // The larger magnitude/radius a star has, the more distance is left around it.
  // Demote any clustered bright stars to avoid "dark cloud" ink smudges.
  for (let i = 0; i < finalStars.length; i++) {
    for (let j = i + 1; j < finalStars.length; j++) {
      const s1 = finalStars[i];
      const s2 = finalStars[j];
      const d = dist2D(s1, s2);
      if (s1.mag <= 2 && s2.mag <= 2 && d < 60) {
        const victim = s1.mag >= s2.mag ? s1 : s2;
        victim.mag = 4;
        const cConf = STAR_MAGNITUDES[4];
        victim.points = cConf.points;
        victim.finalRadius = cConf.radius * (0.92 + rng() * 0.16);
      } else if (s1.mag <= 3 && s2.mag <= 3 && d < 38) {
        const victim = s1.mag >= s2.mag ? s1 : s2;
        victim.mag = 5;
        const cConf = STAR_MAGNITUDES[5];
        victim.points = cConf.points;
        victim.finalRadius = cConf.radius * (0.92 + rng() * 0.16);
      }
    }
  }

  const finalLabelX = Math.round(sumX / finalStars.length);
  const finalLabelY = Math.round(bestLabelPos === "below" ? sMaxY + 22 : sMinY - 22);

  // Guarantee that directional qualifiers (Borealis, Australis, Occidentalis, Orientalis)
  // strictly match the final rendered position of the constellation and its label
  const finalNormX = totalW > 0 ? finalLabelX / totalW : normX;
  const finalNormY = totalH > 0 ? finalLabelY / totalH : normY;
  const isBoreal = name.includes("Borealis") || name.includes("Septentrionalis");
  const isAustral = name.includes("Australis") || name.includes("Meridionalis");
  const isOccidental = name.includes("Occidentalis");
  const isOriental = name.includes("Orientalis");

  if (
    (isBoreal && finalNormY >= 0.48) ||
    (isAustral && finalNormY <= 0.52) ||
    (isOccidental && finalNormX >= 0.48) ||
    (isOriental && finalNormX <= 0.52)
  ) {
    usedNames.delete(name);
    const correctedNameData = generateConstellationName(rng, usedNames, finalNormX, finalNormY);
    name = typeof correctedNameData === "object" ? correctedNameData.text : correctedNameData;
    lines = typeof correctedNameData === "object" && correctedNameData.lines ? correctedNameData.lines : [name];
  }

  const labelObj = {
    text: name,
    lines,
    x: finalLabelX,
    y: finalLabelY,
    fontSize,
    font: runFont,
    w: labelW,
    h: labelH,
    aabb: {
      minX: finalLabelX - labelW / 2,
      maxX: finalLabelX + labelW / 2,
      minY: finalLabelY - labelH / 2,
      maxY: finalLabelY + labelH / 2,
    },
  };

  // Orient each edge left-to-right (p1.x <= p2.x) so lines animate deliberately West-to-East
  const orientedEdges = unitAsterism.edges.map((e) => {
    const s1 = finalStars[e.u];
    const s2 = finalStars[e.v];
    if (s1.x > s2.x) {
      return { u: e.v, v: e.u, dist: e.dist };
    }
    return { u: e.u, v: e.v, dist: e.dist };
  });

  // Sort edges strictly left-to-right by start star X coordinate
  orientedEdges.sort((a, b) => {
    const ax = finalStars[a.u].x;
    const bx = finalStars[b.u].x;
    if (Math.abs(ax - bx) > 1e-3) return ax - bx;
    return finalStars[a.v].x - finalStars[b.v].x;
  });

  // Strict refinement: Never add a line if the triangle it forms has very small area or altitude
  const safeEdges = [];
  for (const e of orientedEdges) {
    let causesSmallTri = false;
    for (let w = 0; w < finalStars.length; w++) {
      if (w === e.u || w === e.v) continue;
      const hasUW = safeEdges.some((x) => (x.u === e.u && x.v === w) || (x.u === w && x.v === e.u));
      const hasVW = safeEdges.some((x) => (x.u === e.v && x.v === w) || (x.u === w && x.v === e.v));
      if (hasUW && hasVW) {
        const a = triangleArea(finalStars[e.u], finalStars[e.v], finalStars[w]);
        const dUV = dist2D(finalStars[e.u], finalStars[e.v]);
        const dUW = dist2D(finalStars[e.u], finalStars[w]);
        const dVW = dist2D(finalStars[e.v], finalStars[w]);
        const alt = (2 * a) / Math.max(1, Math.max(dUV, dUW, dVW));
        if (a < 450 || alt < 24) {
          causesSmallTri = true;
          break;
        }
      }
    }
    if (!causesSmallTri) {
      safeEdges.push(e);
    }
  }

  return {
    index: cIdx,
    name,
    cell,
    stars: finalStars,
    edges: safeEdges,
    label: labelObj,
    rotAngle,
  };
}

/**
 * Generates background field stars based on ~/code/sketches/synthwave density & distribution,
 * filling the negative celestial space between stars.
 */
function generateBackgroundFieldStars(totalW, totalH, margin, constellationStars, constellationLabels, rng, roseCenter = null) {
  const fieldStars = [];
  const step = 26; // Sampling step in pixels
  const startX = margin + 18;
  const endX = totalW - margin - 18;
  const startY = margin + 18;
  const endY = totalH - margin - 18;

  const hitProb = 0.088;

  for (let x = startX; x < endX; x += step) {
    for (let y = startY; y < endY; y += step) {
      if (rng() >= hitProb) continue;

      const px = x + (rng() - 0.5) * step * 0.85;
      const py = y + (rng() - 0.5) * step * 0.85;

      // Magnitude distribution using easeInSq from synthwave
      const u = easeInSq(rng());
      let mag;
      if (u < 0.60) mag = 6;       // 6th mag (small 4-point star/cross)
      else if (u < 0.86) mag = 5;  // 5th mag (4-point star)
      else if (u < 0.97) mag = 4;  // 4th mag (5-point star)
      else mag = 3;                // 3rd mag (occasional bright field luminary)

      // Magnitude-aware clearance from constellation stars:
      // Larger magnitude / brighter stars demand wider empty space around them
      let tooClose = false;
      for (const cs of constellationStars) {
        const minD = getMinStarDistance(cs.mag, mag);
        const dx = cs.x - px;
        const dy = cs.y - py;
        if (dx * dx + dy * dy < minD * minD) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Magnitude-aware clearance from other field stars to avoid clumping
      for (const fs of fieldStars) {
        const minD = getMinStarDistance(fs.mag, mag);
        const dx = fs.x - px;
        const dy = fs.y - py;
        if (dx * dx + dy * dy < minD * minD) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Clearance from constellation labels
      for (const lbl of constellationLabels) {
        if (
          px >= lbl.aabb.minX - 6 &&
          px <= lbl.aabb.maxX + 6 &&
          py >= lbl.aabb.minY - 4 &&
          py <= lbl.aabb.maxY + 4
        ) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Clearance from Rosa Coelestis (if present on this chart)
      if (roseCenter) {
        const dx = px - roseCenter.x;
        const dy = py - roseCenter.y;
        if (dx * dx + dy * dy < roseCenter.r * roseCenter.r) continue;
      }

      const conf = STAR_MAGNITUDES[mag];
      fieldStars.push({
        x: px,
        y: py,
        mag,
        points: conf.points,
        finalRadius: conf.radius * (0.85 + rng() * 0.25),
        rot: rng() * Math.PI,
        constellationIndex: -1,
        starIdx: -1,
      });
    }
  }

  return fieldStars;
}

/**
 * Master generator for the entire constellation celestial scene using Voronoi partitioning.
 */
function generateConstellationScene(totalW, totalH, totalScreens, seed) {
  const rng = createRNG(seed);
  const margin = Math.max(28, Math.round(totalH * 0.042));

  // Consistent typography across this entire map rendering:
  // ONE font family is selected for this run, rotating across reruns.
  const runFont = pick(GOOGLE_FONTS, rng);

  const screenW = totalW / totalScreens;
  const numCellsPerScreen = 16; // 16 constellations per screen as requested

  const allCells = [];

  // Generate Voronoi breakdown per screen to guarantee bezel avoidance
  for (let s = 0; s < totalScreens; s++) {
    const sBounds = {
      minX: s === 0 ? margin + 14 : s * screenW + 28,
      maxX: s === totalScreens - 1 ? totalW - margin - 14 : (s + 1) * screenW - 28,
      minY: margin + 35,
      maxY: totalH - margin - 35,
    };
    const screenCells = generateRelaxedVoronoiPartition(sBounds, numCellsPerScreen, rng);
    allCells.push(...screenCells);
  }

  const rawConstellations = [];
  const usedNames = new Set();

  for (let i = 0; i < allCells.length; i++) {
    const constObj = createConstellationForVoronoiCell(allCells[i], rng, runFont, i, usedNames, totalW, totalH);
    rawConstellations.push(constObj);
  }

  // Shuffle constellations in random drawing order across the celestial vault using deterministic PRNG
  for (let i = rawConstellations.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = rawConstellations[i];
    rawConstellations[i] = rawConstellations[j];
    rawConstellations[j] = temp;
  }
  rawConstellations.forEach((c, idx) => {
    c.index = idx;
    c.stars.forEach((s) => { s.constellationIndex = idx; });
  });

  const constellations = rawConstellations;
  const allConstellationStars = [];
  const constellationLabels = [];

  for (const c of constellations) {
    allConstellationStars.push(...c.stars);
    constellationLabels.push(c.label);
  }

  // The Rosa Coelestis (Celestial Wind / Compass Rose) is randomized per chart for visual variety (~55% chance)
  const hasCompassRose = rng() < 0.55;

  let roseCenter = null;
  if (hasCompassRose) {
    if (totalScreens > 1) {
      roseCenter = { x: Math.round(screenW + screenW * 0.5), y: margin + 56, r: 44 };
    } else {
      roseCenter = { x: margin + 82, y: totalH - margin - 72, r: 44 };
    }
  }

  // Fill celestial negative space with background field stars using synthwave density
  const fieldStars = generateBackgroundFieldStars(totalW, totalH, margin, allConstellationStars, constellationLabels, rng, roseCenter);

  // Combine all stars into a single array and shuffle randomly for star bloom animation
  const allStars = [...allConstellationStars, ...fieldStars];
  for (let i = allStars.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = allStars[i];
    allStars[i] = allStars[j];
    allStars[j] = temp;
  }

  return {
    margin,
    voronoiCells: allCells,
    constellations,
    fieldStars,
    allStars,
    runFont,
    hasCompassRose,
    seed,
  };
}

/**
 * Draws constellations sequentially West-to-East:
 * For each constellation, its lines are etched left-to-right (first 70% of its slot),
 * and immediately upon completion its Latin name animates into place (last 30% of its slot).
 * All completed constellations keep their lines and names visible.
 */
function drawConstellationsWithNames(ctx, constellations, pal, progress) {
  if (!constellations || constellations.length === 0 || progress <= 0) return;

  const totalConst = constellations.length;
  const timePerConst = 1.0 / totalConst;

  ctx.save();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.05;
  ctx.lineCap = "round";

  for (let c = 0; c < totalConst; c++) {
    const constStart = c * timePerConst;
    if (progress < constStart) break;

    const constProgress = Math.min(1.0, (progress - constStart) / timePerConst);
    const constellation = constellations[c];
    const edges = constellation.edges;
    const totalEdges = edges.length;

    // Line engraving takes the first 75% of this constellation's window
    const lineProg = Math.min(1.0, constProgress / 0.75);
    if (lineProg > 0 && totalEdges > 0) {
      const edgeTime = 1.0 / totalEdges;
      for (let e = 0; e < totalEdges; e++) {
        const eStart = e * edgeTime;
        if (lineProg < eStart) break;

        const eProg = Math.min(1.0, (lineProg - eStart) / edgeTime);
        const edge = edges[e];
        const p1 = constellation.stars[edge.u];
        const p2 = constellation.stars[edge.v];

        const curX = p1.x + (p2.x - p1.x) * eProg;
        const curY = p1.y + (p2.y - p1.y) * eProg;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(curX, curY);
        ctx.stroke();
      }
    }

    // Name label animates in immediately as lines reach completion (last 25% of window)
    if (constProgress > 0.75) {
      const nameProg = (constProgress - 0.75) / 0.25;
      drawConstellationLabel(ctx, constellation.label, pal, nameProg);
    }
  }

  ctx.restore();
}

/**
 * Draws constellation lines sequentially constellation by constellation.
 */
function drawConstellationLines(ctx, constellations, pal, progress) {
  if (!constellations || constellations.length === 0 || progress <= 0) return;

  const totalConst = constellations.length;
  const timePerConst = 1.0 / totalConst;

  ctx.save();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.05;
  ctx.lineCap = "round";

  for (let c = 0; c < totalConst; c++) {
    const constStart = c * timePerConst;
    if (progress < constStart) break;

    const constProgress = Math.min(1.0, (progress - constStart) / timePerConst);
    const constellation = constellations[c];
    const edges = constellation.edges;
    const totalEdges = edges.length;
    if (totalEdges === 0) continue;

    const edgeTime = 1.0 / totalEdges;

    for (let e = 0; e < totalEdges; e++) {
      const eStart = e * edgeTime;
      if (constProgress < eStart) break;

      const eProg = Math.min(1.0, (constProgress - eStart) / edgeTime);
      const edge = edges[e];
      const p1 = constellation.stars[edge.u];
      const p2 = constellation.stars[edge.v];

      const curX = p1.x + (p2.x - p1.x) * eProg;
      const curY = p1.y + (p2.y - p1.y) * eProg;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(curX, curY);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Draws constellation labels sequentially or with ink fade.
 */
function drawConstellationLabels(ctx, constellations, pal, progress) {
  if (!constellations || constellations.length === 0 || progress <= 0) return;

  const total = constellations.length;
  const timePerLabel = 1.0 / total;

  for (let i = 0; i < total; i++) {
    const lStart = i * timePerLabel;
    if (progress < lStart) break;

    const labelProg = Math.min(1.0, (progress - lStart) / timePerLabel);
    drawConstellationLabel(ctx, constellations[i].label, pal, labelProg);
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.generateConstellationScene = generateConstellationScene;
  globalThis.drawConstellationsWithNames = drawConstellationsWithNames;
  globalThis.drawConstellationLines = drawConstellationLines;
  globalThis.drawConstellationLabels = drawConstellationLabels;
}
