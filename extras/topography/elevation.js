// Procedural Topographic Elevation Map Generator
// Implements DEM field generation, Marching Squares isolines, Imhof-style orographic relief shading,
// slope hachuring, spot height summits, mountain passes, graticules, and antique intaglio cartouches.

function generateTopographyScene(totalW, totalH, totalScreens, seed) {
  const rng = createRNG(seed);

  // 1. Grid Resolution for Digital Elevation Model (DEM)
  const cellSize = 12; // 12px cell size provides fine resolution with instantaneous generation
  const cols = Math.ceil(totalW / cellSize) + 1;
  const rows = Math.ceil(totalH / cellSize) + 1;

  // Margin for neatline border (inner neatline that bounds the map)
  const margin = 56;

  // Choose a random font for this map
  const runFont = TOPOGRAPHY_FONTS[Math.floor(rng() * TOPOGRAPHY_FONTS.length)];

  // 2. Generate Heightfield with sharp mountain ridges, cirques, and valleys
  const heightGrid = [];
  const freqX = (rng() * 1.5 + 2.2) / totalW;
  const freqY = (rng() * 1.5 + 2.2) / totalH;
  const seedOffset = Math.floor(rng() * 10000);

  // Dominant mountain range spine angle (slanted diagonal, crescent, or east-west)
  const spineAngle = (rng() - 0.5) * 0.7; // ~ -20 deg to +20 deg
  const cosSpine = Math.cos(spineAngle);
  const sinSpine = Math.sin(spineAngle);

  // Water level threshold (lakes/fjords)
  const waterLevel = 0.14 + rng() * 0.06;

  let minH = 1e9;
  let maxH = -1e9;

  for (let r = 0; r < rows; r++) {
    const row = new Float32Array(cols);
    const y = r * cellSize;
    for (let c = 0; c < cols; c++) {
      const x = c * cellSize;

      // Coordinate transformation along spine
      const rx = (x - totalW * 0.5) * cosSpine - (y - totalH * 0.5) * sinSpine + totalW * 0.5;
      const ry = (x - totalW * 0.5) * sinSpine + (y - totalH * 0.5) * cosSpine + totalH * 0.5;

      const px = rx * freqX;
      const py = ry * freqY;

      // Primary sharp ridged spine
      const r1 = ridgedNoise2D(px * 1.0, py * 1.0, 4, seedOffset);
      const r2 = ridgedNoise2D(px * 2.2 + 5.1, py * 2.2 + 3.7, 3, seedOffset + 50);

      // Rolling base topography and valley sculpting
      const f1 = fbm2D(px * 0.8, py * 0.8, 3, seedOffset + 100);
      const f2 = warpedFbm2D(px * 0.6 + 2.0, py * 0.6 + 4.0, seedOffset + 150);

      // Massif elevation: high mountain crests with steep glacial valleys
      let h = (r1 * 0.55 + r2 * 0.25 + f1 * 0.12 + f2 * 0.08);

      // Edge falloff near neatline borders
      const edgeDistX = Math.min(x, totalW - x) / (totalW * 0.12);
      const edgeDistY = Math.min(y, totalH - y) / (totalH * 0.16);
      const edgeDamp = Math.min(1.0, Math.max(0.0, Math.min(edgeDistX, edgeDistY)));
      h *= 0.65 + 0.35 * edgeDamp;

      // Power shaping: sharp peaks and broad U-shaped valleys
      h = Math.pow(Math.max(0.0, Math.min(1.0, h)), 1.32);

      row[c] = h;
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
    }
    heightGrid.push(row);
  }

  // Normalize grid
  const range = maxH - minH || 1.0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      heightGrid[r][c] = (heightGrid[r][c] - minH) / range;
    }
  }

  // 3. Marching Squares: Extract Contour Lines (Isolines)
  // Number of contour levels: 28 to 34 levels
  const numLevels = 30;
  const contourLevels = [];
  const levelStep = (0.95 - waterLevel) / numLevels;

  for (let l = 0; l < numLevels; l++) {
    const elev = waterLevel + l * levelStep;
    const isIndex = l % 5 === 0; // Every 5th level is an Index Contour
    const altitudeMeters = Math.round(400 + (elev / 0.95) * 3100); // 400m to 3500m
    contourLevels.push({
      levelIndex: l,
      elevation: elev,
      isIndex,
      altitudeMeters,
      segments: [],
      polylines: [],
    });
  }

  // Linear interpolation along grid edges for sub-cell accuracy
  function getInterp(v1, v2, target) {
    if (Math.abs(v2 - v1) < 1e-6) return 0.5;
    return Math.max(0.0, Math.min(1.0, (target - v1) / (v2 - v1)));
  }

  // Run Marching Squares for each level
  for (let l = 0; l < numLevels; l++) {
    const cl = contourLevels[l];
    const target = cl.elevation;
    const segs = [];

    for (let r = 0; r < rows - 1; r++) {
      const y0 = r * cellSize;
      const y1 = (r + 1) * cellSize;
      for (let c = 0; c < cols - 1; c++) {
        const x0 = c * cellSize;
        const x1 = (c + 1) * cellSize;

        const v00 = heightGrid[r][c];
        const v10 = heightGrid[r][c + 1];
        const v11 = heightGrid[r + 1][c + 1];
        const v01 = heightGrid[r + 1][c];

        // 4-bit square index
        let caseIndex = 0;
        if (v00 >= target) caseIndex |= 1;
        if (v10 >= target) caseIndex |= 2;
        if (v11 >= target) caseIndex |= 4;
        if (v01 >= target) caseIndex |= 8;

        if (caseIndex === 0 || caseIndex === 15) continue;

        // Points on the 4 edges
        // Edge 0: Top (v00 -> v10)
        // Edge 1: Right (v10 -> v11)
        // Edge 2: Bottom (v01 -> v11)
        // Edge 3: Left (v00 -> v01)
        const t0 = getInterp(v00, v10, target);
        const p0 = { x: x0 + t0 * cellSize, y: y0 };

        const t1 = getInterp(v10, v11, target);
        const p1 = { x: x1, y: y0 + t1 * cellSize };

        const t2 = getInterp(v01, v11, target);
        const p2 = { x: x0 + t2 * cellSize, y: y1 };

        const t3 = getInterp(v00, v01, target);
        const p3 = { x: x0, y: y0 + t3 * cellSize };

        switch (caseIndex) {
          case 1:  segs.push([p3, p0]); break;
          case 2:  segs.push([p0, p1]); break;
          case 3:  segs.push([p3, p1]); break;
          case 4:  segs.push([p1, p2]); break;
          case 5:  segs.push([p3, p0]); segs.push([p1, p2]); break; // Saddle ambiguity resolved
          case 6:  segs.push([p0, p2]); break;
          case 7:  segs.push([p3, p2]); break;
          case 8:  segs.push([p2, p3]); break;
          case 9:  segs.push([p2, p0]); break;
          case 10: segs.push([p0, p1]); segs.push([p2, p3]); break; // Saddle
          case 11: segs.push([p2, p1]); break;
          case 12: segs.push([p1, p3]); break;
          case 13: segs.push([p1, p0]); break;
          case 14: segs.push([p0, p3]); break;
        }
      }
    }
    cl.segments = segs;

    // Stitch segments into continuous polylines
    cl.polylines = stitchSegmentsToPolylines(segs);
  }

  // 4. Slope Gradients & Eduard Imhof Relief Hachuring
  // Northwest light source (315 degrees: light comes from upper-left)
  const lx = -0.7071;
  const ly = -0.7071;

  const hachures = [];
  const slopeStep = 18; // Sample points for hachuring every 18px

  for (let y = margin + 10; y < totalH - margin - 10; y += slopeStep) {
    const r = Math.floor(y / cellSize);
    if (r <= 0 || r >= rows - 1) continue;
    for (let x = margin + 10; x < totalW - margin - 10; x += slopeStep) {
      const c = Math.floor(x / cellSize);
      if (c <= 0 || c >= cols - 1) continue;

      const hVal = heightGrid[r][c];
      if (hVal < waterLevel) continue; // No hachures in lakes/sea

      // Gradients
      const dhdx = (heightGrid[r][c + 1] - heightGrid[r][c - 1]) / (2 * cellSize);
      const dhdy = (heightGrid[r + 1][c] - heightGrid[r - 1][c]) / (2 * cellSize);

      const slope = Math.hypot(dhdx, dhdy);
      if (slope < 0.007) continue; // Too flat for slope hachures

      // Dot product with northwest light vector
      // Facing northwest: dhdx < 0, dhdy < 0 -> dot > 0 (sunlit)
      // Facing southeast: dhdx > 0, dhdy > 0 -> dot < 0 (shadowed)
      const lightDot = -(dhdx * lx + dhdy * ly) / slope;

      // Imhof cartographic rule: hachures are denser and darker on the shadow (southeast) slopes,
      // and very delicate or absent on direct sunlit slopes.
      if (lightDot < 0.25 && slope > 0.008) {
        // Gradient descent unit vector (points downhill, perpendicular to contour)
        const gx = dhdx / slope;
        const gy = dhdy / slope;

        // Stroke length and thickness based on Lehmann's rule (slope steepness)
        const steepness = Math.min(1.0, slope * 45.0);
        const len = 5.0 + steepness * 9.0;
        const width = 0.6 + steepness * 1.1;

        // Slight organic jitter
        const jx = (rng() - 0.5) * 4.0;
        const jy = (rng() - 0.5) * 4.0;

        hachures.push({
          x1: x + jx - gx * (len * 0.5),
          y1: y + jy - gy * (len * 0.5),
          x2: x + jx + gx * (len * 0.5),
          y2: y + jy + gy * (len * 0.5),
          width,
          opacity: 0.35 + steepness * 0.45,
        });
      }
    }
  }

  // 5. Detect Summits (Local Peaks) & Mountain Passes (Cols)
  const summits = [];
  const passes = [];
  const minPeakDist = 180; // Minimum distance between summit labels to prevent clutter

  // Screen boundaries for dual-monitor bezel avoidance
  const screenW = totalW / totalScreens;

  for (let r = 4; r < rows - 4; r++) {
    for (let c = 4; c < cols - 4; c++) {
      const h = heightGrid[r][c];
      if (h < 0.60) continue; // Must be significant high elevation

      const x = c * cellSize;
      const y = r * cellSize;

      // Keep summits comfortably inside the inner neatline
      if (x < margin + 45 || x > totalW - margin - 45 || y < margin + 45 || y > totalH - margin - 45) {
        continue;
      }

      // Bezel clearance: Avoid placing peak labels directly across monitor seams
      let nearBezel = false;
      for (let s = 1; s < totalScreens; s++) {
        if (Math.abs(x - s * screenW) < 55) {
          nearBezel = true;
          break;
        }
      }
      if (nearBezel) continue;

      // Check if local maximum in a 5x5 window
      let isMax = true;
      for (let dr = -2; dr <= 2 && isMax; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (dr === 0 && dc === 0) continue;
          if (heightGrid[r + dr][c + dc] > h) {
            isMax = false;
            break;
          }
        }
      }

      if (isMax) {
        // Check minimum distance to existing summits
        let tooClose = false;
        for (const p of summits) {
          if (Math.hypot(p.x - x, p.y - y) < minPeakDist) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          const altitude = Math.round(1800 + h * 1900);
          summits.push({
            x,
            y,
            elevation: h,
            altitude,
            name: generatePeakName(rng),
          });
        }
      }
    }
  }

  // Sort summits by altitude descending (most prominent peaks first)
  summits.sort((a, b) => b.altitude - a.altitude);

  // Detect 2 to 4 mountain passes (saddles between peaks)
  if (summits.length >= 2) {
    for (let i = 0; i < summits.length - 1 && passes.length < 3; i++) {
      const p1 = summits[i];
      const p2 = summits[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (dist > 180 && dist < 480) {
        // Sample midpoint
        const midX = (p1.x + p2.x) * 0.5;
        const midY = (p1.y + p2.y) * 0.5;
        const mr = Math.floor(midY / cellSize);
        const mc = Math.floor(midX / cellSize);
        if (mr > 0 && mr < rows && mc > 0 && mc < cols) {
          const midH = heightGrid[mr][mc];
          if (midH > waterLevel && midH < Math.min(p1.elevation, p2.elevation) * 0.9) {
            if (midX > margin + 40 && midX < totalW - margin - 40 && midY > margin + 40 && midY < totalH - margin - 40) {
              passes.push({
                x: midX,
                y: midY,
                altitude: Math.round(1100 + midH * 1600),
                name: generatePassName(rng),
              });
            }
          }
        }
      }
    }
  }

  // 6. Water Bodies (Lakes & Fjords) & Concentric Waterlines
  const waterlines = [];
  const waterSpacings = [4.0, 9.0, 16.0, 25.0, 36.0];
  for (let sIdx = 0; sIdx < waterSpacings.length; sIdx++) {
    const dVal = waterSpacings[sIdx];
    // Slightly lower threshold into water to create concentric inward waterlines
    const wTarget = Math.max(0.01, waterLevel - (sIdx + 1) * 0.022);
    const segs = [];
    for (let r = 0; r < rows - 1; r++) {
      const y0 = r * cellSize;
      for (let c = 0; c < cols - 1; c++) {
        const x0 = c * cellSize;
        const v00 = heightGrid[r][c];
        const v10 = heightGrid[r][c + 1];
        const v11 = heightGrid[r + 1][c + 1];
        const v01 = heightGrid[r + 1][c];
        let caseIndex = 0;
        if (v00 >= wTarget) caseIndex |= 1;
        if (v10 >= wTarget) caseIndex |= 2;
        if (v11 >= wTarget) caseIndex |= 4;
        if (v01 >= wTarget) caseIndex |= 8;
        if (caseIndex === 0 || caseIndex === 15) continue;
        const t0 = getInterp(v00, v10, wTarget);
        const p0 = { x: x0 + t0 * cellSize, y: y0 };
        const t1 = getInterp(v10, v11, wTarget);
        const p1 = { x: x0 + cellSize, y: y0 + t1 * cellSize };
        const t2 = getInterp(v01, v11, wTarget);
        const p2 = { x: x0 + t2 * cellSize, y: y0 + cellSize };
        const t3 = getInterp(v00, v01, wTarget);
        const p3 = { x: x0, y: y0 + t3 * cellSize };
        switch (caseIndex) {
          case 1:  segs.push([p3, p0]); break;
          case 2:  segs.push([p0, p1]); break;
          case 3:  segs.push([p3, p1]); break;
          case 4:  segs.push([p1, p2]); break;
          case 5:  segs.push([p3, p0]); segs.push([p1, p2]); break;
          case 6:  segs.push([p0, p2]); break;
          case 7:  segs.push([p3, p2]); break;
          case 8:  segs.push([p2, p3]); break;
          case 9:  segs.push([p2, p0]); break;
          case 10: segs.push([p0, p1]); segs.push([p2, p3]); break;
          case 11: segs.push([p2, p1]); break;
          case 12: segs.push([p1, p3]); break;
          case 13: segs.push([p1, p0]); break;
          case 14: segs.push([p0, p3]); break;
        }
      }
    }
    waterlines.push({
      spacing: dVal,
      opacity: Math.max(0.12, 0.55 - sIdx * 0.10),
      polylines: stitchSegmentsToPolylines(segs),
    });
  }

  // 7. Master Title Cartouche Placement (Bottom corner or low-slope valley)
  const cartoucheW = 356;
  const cartoucheH = 122;
  // Place on Left screen bottom-right or Right screen bottom-left
  let cartX = margin + 30;
  let cartY = totalH - margin - cartoucheH - 30;

  // Make sure cartouche doesn't cross any monitor bezel
  for (let s = 1; s < totalScreens; s++) {
    const bx = s * screenW;
    if (cartX + cartoucheW > bx - 40 && cartX < bx + 40) {
      cartX = bx + 50; // Shift to the right of the bezel
      break;
    }
  }

  const primaryPeak = summits && summits.length > 0 ? summits[0] : null;
  const secondaryPeak = summits && summits.length > 1 ? summits[1] : null;
  const mapTitle = generateMapTitle(rng, primaryPeak, secondaryPeak);

  // 8. Generate Soft Watercolor Hill-Shade Wash Texture (cols x rows)
  let washCanvas = null;
  if (typeof document !== "undefined") {
    washCanvas = document.createElement("canvas");
    washCanvas.width = cols;
    washCanvas.height = rows;
    const wCtx = washCanvas.getContext("2d");
    const imgData = wCtx.createImageData(cols, rows);
    const data = imgData.data;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = (r * cols + c) * 4;
        const hVal = heightGrid[r][c];

        if (hVal < waterLevel) {
          // Lake / aquatic basin wash
          data[idx + 0] = 70;
          data[idx + 1] = 120;
          data[idx + 2] = 150;
          data[idx + 3] = 48;
        } else {
          const cL = Math.max(0, c - 1);
          const cR = Math.min(cols - 1, c + 1);
          const rU = Math.max(0, r - 1);
          const rD = Math.min(rows - 1, r + 1);

          const dhdx = (heightGrid[r][cR] - heightGrid[r][cL]) * 0.5;
          const dhdy = (heightGrid[rD][c] - heightGrid[rU][c]) * 0.5;
          const slope = Math.hypot(dhdx, dhdy);

          if (slope > 0.003) {
            const lightDot = -(dhdx * lx + dhdy * ly) / slope;
            if (lightDot < 0) {
              // Shadow slope (Southeast facing) -> Umber tone
              const shadeAlpha = Math.min(1.0, -lightDot * Math.min(1.0, slope * 28.0));
              data[idx + 0] = 40;
              data[idx + 1] = 25;
              data[idx + 2] = 15;
              data[idx + 3] = Math.round(shadeAlpha * 65);
            } else {
              // Sunlit slope (Northwest facing) -> Warm sunlight highlight
              const sunAlpha = Math.min(1.0, lightDot * Math.min(1.0, slope * 20.0));
              data[idx + 0] = 255;
              data[idx + 1] = 245;
              data[idx + 2] = 210;
              data[idx + 3] = Math.round(sunAlpha * 45);
            }
          }
        }
      }
    }
    wCtx.putImageData(imgData, 0, 0);
  }

  return {
    totalW,
    totalH,
    totalScreens,
    margin,
    cellSize,
    cols,
    rows,
    waterLevel,
    heightGrid,
    contourLevels,
    hachures,
    summits,
    passes,
    waterlines,
    washCanvas,
    cartouche: {
      x: cartX,
      y: cartY,
      w: cartoucheW,
      h: cartoucheH,
      masterTitle: mapTitle.master,
      subtitle: mapTitle.subtitle,
    },
    runFont,
    seed,
  };
}

// ── Stitch segments into continuous polyline chains ──────────────────────────
function stitchSegmentsToPolylines(segments) {
  if (!segments || segments.length === 0) return [];

  // Spatial point hash key with 0.5px quantization
  function ptKey(p) {
    return `${Math.round(p.x * 2)},${Math.round(p.y * 2)}`;
  }

  // Build adjacency lookup from endpoint key to segment list
  const adj = new Map();
  function addEntry(key, seg, isHead) {
    let list = adj.get(key);
    if (!list) {
      list = [];
      adj.set(key, list);
    }
    list.push({ seg, isHead });
  }

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    s._used = false;
    addEntry(ptKey(s[0]), s, true);
    addEntry(ptKey(s[1]), s, false);
  }

  const polylines = [];

  for (let i = 0; i < segments.length; i++) {
    const startSeg = segments[i];
    if (startSeg._used) continue;
    startSeg._used = true;

    const currentPts = [startSeg[0], startSeg[1]];

    // Extend forward from tail
    let tailExtended = true;
    while (tailExtended) {
      tailExtended = false;
      const tail = currentPts[currentPts.length - 1];
      const list = adj.get(ptKey(tail));
      if (list) {
        for (let k = 0; k < list.length; k++) {
          const item = list[k];
          if (!item.seg._used) {
            item.seg._used = true;
            if (item.isHead) {
              currentPts.push(item.seg[1]);
            } else {
              currentPts.push(item.seg[0]);
            }
            tailExtended = true;
            break;
          }
        }
      }
    }

    // Extend backward from head
    let headExtended = true;
    while (headExtended) {
      headExtended = false;
      const head = currentPts[0];
      const list = adj.get(ptKey(head));
      if (list) {
        for (let k = 0; k < list.length; k++) {
          const item = list[k];
          if (!item.seg._used) {
            item.seg._used = true;
            if (item.isHead) {
              currentPts.unshift(item.seg[1]);
            } else {
              currentPts.unshift(item.seg[0]);
            }
            headExtended = true;
            break;
          }
        }
      }
    }

    if (currentPts.length > 3) {
      const isClosed = Math.hypot(
        currentPts[0].x - currentPts[currentPts.length - 1].x,
        currentPts[0].y - currentPts[currentPts.length - 1].y
      ) < 6.0;

      // 1. Chaikin Smoothing (2 passes) to eliminate 12px marching-squares stair-steps
      const smoothed = chaikinSmooth(currentPts, 2, isClosed);
      if (isClosed && smoothed.length > 2) {
        smoothed.push({ x: smoothed[0].x, y: smoothed[0].y });
      }

      // 2. Precompute fine cumulative arc-lengths (points now spaced ~2px apart)
      const n = smoothed.length;
      const dists = new Float32Array(n);
      dists[0] = 0;
      for (let d = 1; d < n; d++) {
        dists[d] = dists[d - 1] + Math.hypot(smoothed[d].x - smoothed[d - 1].x, smoothed[d].y - smoothed[d - 1].y);
      }
      smoothed._dists = dists;
      smoothed._totalLen = dists[n - 1];
      smoothed._isClosed = isClosed;

      // Discard tiny micro-speckles under 28px
      if (smoothed._totalLen >= 28) {
        polylines.push(smoothed);
      }
    }
  }

  return polylines;
}

// ── Chaikin Subdivision Smoothing ─────────────────────────────────────────────
function chaikinSmooth(pts, iterations = 2, isClosed = false) {
  let cur = pts;
  for (let it = 0; it < iterations; it++) {
    const next = [];
    const n = cur.length;
    if (isClosed) {
      for (let i = 0; i < n; i++) {
        const p0 = cur[i];
        const p1 = cur[(i + 1) % n];
        next.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y });
        next.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y });
      }
    } else {
      next.push(cur[0]);
      for (let i = 0; i < n - 1; i++) {
        const p0 = cur[i];
        const p1 = cur[i + 1];
        next.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y });
        next.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y });
      }
      next.push(cur[n - 1]);
    }
    cur = next;
  }
  return cur;
}

// ── Append Polyline to Path at Sub-Pixel Distance (Zero Draw-Call Overhead) ────
function appendPolylineToPath(ctx, poly, t) {
  if (t <= 0 || poly.length < 2) return;

  if (t >= 1.0) {
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i].x, poly[i].y);
    }
    return;
  }

  const dists = poly._dists;
  const targetDist = t * (poly._totalLen || 1.0);
  if (targetDist <= 0.001) return;

  // Find active segment along smooth 2px spline
  let idx = 1;
  while (idx < poly.length && dists[idx] < targetDist) {
    idx++;
  }

  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < idx; i++) {
    ctx.lineTo(poly[i].x, poly[i].y);
  }

  // Exact sub-pixel interpolation on the leading tip
  if (idx < poly.length) {
    const dPrev = dists[idx - 1];
    const dCur = dists[idx];
    const segLen = dCur - dPrev;
    if (segLen > 0.0001) {
      const frac = (targetDist - dPrev) / segLen;
      ctx.lineTo(
        poly[idx - 1].x + (poly[idx].x - poly[idx - 1].x) * frac,
        poly[idx - 1].y + (poly[idx].y - poly[idx - 1].y) * frac
      );
    }
  }
}

// ── Drawing Functions ────────────────────────────────────────────────────────

// 1. Base Graticule Grid & Coordinate Ticks with Incremental Numbers
function drawGraticuleGrid(ctx, totalW, totalH, margin, pal, progress, runFont) {
  const gridSpacing = 160;
  ctx.save();
  ctx.strokeStyle = pal.inkFaint;
  ctx.fillStyle = pal.inkFaint;
  ctx.lineWidth = 0.6;
  ctx.font = runFont.gridFont || '500 10px sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const numCols = Math.floor((totalW - margin * 2) / gridSpacing);
  const numRows = Math.floor((totalH - margin * 2) / gridSpacing);

  const maxTicks = numCols * numRows;
  const currentTicks = Math.floor(maxTicks * progress);
  let count = 0;

  for (let c = 1; c <= numCols; c++) {
    const x = margin + c * gridSpacing;
    for (let r = 1; r <= numRows; r++) {
      if (count++ >= currentTicks) break;
      const y = margin + r * gridSpacing;

      // Small crosshair tick '+'
      const s = 4.5;
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.lineTo(x + s, y);
      ctx.moveTo(x, y - s);
      ctx.lineTo(x, y + s);
      ctx.stroke();

      // Inscribe coordinate numbers incrementally right with the cross
      if (c % 2 === 1 && r % 2 === 1) {
        ctx.fillText(`+ ${c * 4}km / ${r * 4}km`, x + 24, y + 9);
      }
    }
  }
  ctx.restore();
}

// 2. Waterlines (Echo contours traced continuously around lakes/fjords)
function drawWaterlines(ctx, waterlines, pal, progress) {
  if (!waterlines || waterlines.length === 0 || progress <= 0) return;
  ctx.save();
  ctx.strokeStyle = pal.waterLine || pal.contour;
  ctx.lineWidth = 0.85;

  for (let i = 0; i < waterlines.length; i++) {
    const wl = waterlines[i];
    const ringStart = i * 0.12;
    const ringDur = 0.50;
    const ringT = Math.max(0.0, Math.min(1.0, (progress - ringStart) / ringDur));
    if (ringT <= 0) continue;

    ctx.globalAlpha = wl.opacity * Math.min(1.0, ringT * 1.5);
    ctx.beginPath();
    for (const poly of wl.polylines) {
      appendPolylineToPath(ctx, poly, ringT);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// 3. Contour Lines: Smooth Sub-Pixel Continuous Tracing (Batched for 60 FPS)
function drawContourLines(ctx, scene, pal, progress) {
  const { contourLevels, runFont } = scene;
  if (!contourLevels || progress <= 0) return;

  const totalLevels = contourLevels.length;

  const intermediatePolys = [];
  const indexPolys = [];
  const labelsToDraw = [];

  for (let l = 0; l < totalLevels; l++) {
    const cl = contourLevels[l];
    const isIndex = cl.isIndex;

    // Elevation wave: lower elevations begin tracing first, higher follow smoothly
    const startFrac = (l / totalLevels) * 0.62;
    const duration = 0.38;

    const levelProgress = Math.max(0.0, Math.min(1.0, (progress - startFrac) / duration));
    if (levelProgress <= 0) continue;

    for (let pIdx = 0; pIdx < cl.polylines.length; pIdx++) {
      const poly = cl.polylines[pIdx];
      if (poly.length < 2) continue;

      if (isIndex) {
        indexPolys.push({ poly, t: levelProgress });
      } else {
        intermediatePolys.push({ poly, t: levelProgress });
      }

      // Check if index label should appear once the curve has reached the halfway mark
      if (isIndex && poly.length > 25 && l % 2 === 0 && levelProgress >= 0.55) {
        labelsToDraw.push({
          poly,
          cl,
          alpha: Math.min(1.0, (levelProgress - 0.55) / 0.25),
        });
      }
    }
  }

  // 1. Draw all intermediate contours in a single GPU-batched stroke
  if (intermediatePolys.length > 0) {
    ctx.save();
    ctx.strokeStyle = pal.contour || pal.inkFaint;
    ctx.lineWidth = 0.75;
    ctx.globalAlpha = 0.65;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < intermediatePolys.length; i++) {
      appendPolylineToPath(ctx, intermediatePolys[i].poly, intermediatePolys[i].t);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 2. Draw all index contours in a single GPU-batched stroke
  if (indexPolys.length > 0) {
    ctx.save();
    ctx.strokeStyle = pal.indexContour || pal.ink;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.90;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < indexPolys.length; i++) {
      appendPolylineToPath(ctx, indexPolys[i].poly, indexPolys[i].t);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 3. Draw clean masked altitude labels on index contours
  if (labelsToDraw.length > 0) {
    ctx.save();
    for (let i = 0; i < labelsToDraw.length; i++) {
      const { poly, cl, alpha } = labelsToDraw[i];
      const midIdx = Math.floor(poly.length * 0.5);
      const ptA = poly[Math.max(0, midIdx - 3)];
      const ptB = poly[Math.min(poly.length - 1, midIdx + 3)];
      const midPt = poly[midIdx];

      const dx = ptB.x - ptA.x;
      const dy = ptB.y - ptA.y;
      let angle = Math.atan2(dy, dx);
      if (angle > Math.PI * 0.5) angle -= Math.PI;
      else if (angle < -Math.PI * 0.5) angle += Math.PI;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(midPt.x, midPt.y);
      ctx.rotate(angle);

      const labelText = `${cl.altitudeMeters}`;
      ctx.font = runFont.contourFont || '600 10px sans-serif';
      const metrics = ctx.measureText(labelText);

      // Mask background
      ctx.fillStyle = pal.paper;
      ctx.fillRect(-metrics.width * 0.5 - 3, -6, metrics.width + 6, 12);

      // Inscribed altitude numeral
      ctx.fillStyle = pal.indexContour || pal.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
}

// 4. Imhof Slope Hachures: Progressively Carving Downhill
function drawImhofHachures(ctx, hachures, pal, progress) {
  if (!hachures || hachures.length === 0 || progress <= 0) return;
  ctx.save();
  ctx.strokeStyle = pal.hachure || pal.ink;
  ctx.lineCap = "round";

  const total = hachures.length;

  ctx.beginPath();
  for (let i = 0; i < total; i++) {
    const h = hachures[i];
    const hStart = (i / total) * 0.65;
    const hDur = 0.35;
    const hT = Math.max(0.0, Math.min(1.0, (progress - hStart) / hDur));
    if (hT <= 0) continue;

    // Stroke grows down the slope
    const x2 = h.x1 + (h.x2 - h.x1) * hT;
    const y2 = h.y1 + (h.y2 - h.y1) * hT;
    ctx.moveTo(h.x1, h.y1);
    ctx.lineTo(x2, y2);
  }
  ctx.lineWidth = 0.9;
  ctx.globalAlpha = 0.65;
  ctx.stroke();

  ctx.restore();
}

// 5. Summits & Spot Heights (Meshing naturally without square white background)
function drawSummitsAndPasses(ctx, scene, pal, progress) {
  const { summits, passes, runFont } = scene;
  if (progress <= 0) return;

  ctx.save();

  // Summits
  const summitCount = Math.floor(summits.length * progress);
  for (let i = 0; i < summitCount; i++) {
    const s = summits[i];

    // Prominent Peak Symbol: Sharp solid ▲ directly on mountain terrain
    ctx.fillStyle = pal.indexContour || pal.ink;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 7);
    ctx.lineTo(s.x + 6, s.y + 4);
    ctx.lineTo(s.x - 6, s.y + 4);
    ctx.closePath();
    ctx.fill();

    // Inner center dot
    ctx.fillStyle = pal.paper;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Mountain Name: text halo hugs letters without ugly white rectangular cutout
    ctx.font = runFont.peakFont || 'italic 600 12.5px serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.strokeStyle = pal.paper;
    ctx.lineWidth = 3.0;
    ctx.lineJoin = "round";
    ctx.strokeText(s.name, s.x, s.y - 14);

    ctx.fillStyle = pal.ink;
    ctx.fillText(s.name, s.x, s.y - 14);

    // Altitude Tag with text halo
    ctx.font = runFont.contourFont || '600 10px sans-serif';
    const altText = `▲ ${s.altitude.toLocaleString()} m`;
    ctx.strokeStyle = pal.paper;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.strokeText(altText, s.x, s.y + 16);

    ctx.fillStyle = pal.inkFaint;
    ctx.fillText(altText, s.x, s.y + 16);
  }

  // Mountain Passes (Cols) with text halo
  const passCount = Math.floor(passes.length * progress);
  for (let i = 0; i < passCount; i++) {
    const p = passes[i];

    // Col symbol: )(
    ctx.save();
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(p.x - 3.5, p.y, 4, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x + 3.5, p.y, 4, Math.PI * 0.6, Math.PI * 1.4);
    ctx.stroke();
    ctx.restore();

    ctx.font = runFont.passFont || 'italic 500 11px serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.strokeStyle = pal.paper;
    ctx.lineWidth = 2.8;
    ctx.lineJoin = "round";
    ctx.strokeText(p.name, p.x, p.y - 9);

    ctx.fillStyle = pal.ink;
    ctx.fillText(p.name, p.x, p.y - 9);

    ctx.font = runFont.contourFont || '600 9.5px sans-serif';
    const passAlt = `)( ${p.altitude} m`;
    ctx.strokeStyle = pal.paper;
    ctx.lineWidth = 2.4;
    ctx.strokeText(passAlt, p.x, p.y + 14);

    ctx.fillStyle = pal.inkFaint;
    ctx.fillText(passAlt, p.x, p.y + 14);
  }

  ctx.restore();
}

// 6. Clean Outer Margins Outside Boundary
function cleanOuterMargins(ctx, totalW, totalH, margin, pal) {
  ctx.save();
  ctx.fillStyle = pal.paper;
  // Top margin band
  ctx.fillRect(0, 0, totalW, margin);
  // Bottom margin band
  ctx.fillRect(0, totalH - margin, totalW, margin);
  // Left margin band
  ctx.fillRect(0, margin, margin, totalH - margin * 2);
  // Right margin band
  ctx.fillRect(totalW - margin, margin, margin, totalH - margin * 2);

  // Re-apply laid pattern over the cleaned outer margin
  const pat = getLaidPattern(ctx);
  if (pat) {
    ctx.fillStyle = pat;
    ctx.globalCompositeOperation = pal.isDark ? "screen" : "multiply";
    ctx.globalAlpha = pal.isDark ? 0.18 : 0.55;
    ctx.fillRect(0, 0, totalW, margin);
    ctx.fillRect(0, totalH - margin, totalW, margin);
    ctx.fillRect(0, margin, margin, totalH - margin * 2);
    ctx.fillRect(totalW - margin, margin, margin, totalH - margin * 2);
  }
  ctx.restore();
}

// 7. Outset Neatline Border with Piano-Key Kilometer Graduations
function drawNeatlineBorder(ctx, totalW, totalH, margin, pal, progress) {
  if (progress <= 0) return;

  // Clean outside boundary first: guarantees map content NEVER extends outside inner neatline
  cleanOuterMargins(ctx, totalW, totalH, margin, pal);

  ctx.save();
  ctx.globalAlpha = Math.min(1.0, progress * 1.5);

  const ribbonW = 10;
  const innerX = margin;
  const innerY = margin;
  const innerW = totalW - margin * 2;
  const innerH = totalH - margin * 2;

  const outerX = innerX - ribbonW;
  const outerY = innerY - ribbonW;
  const outerW = innerW + ribbonW * 2;
  const outerH = innerH + ribbonW * 2;

  // 1. Opaque base fill for the entire outset ribbon ring (pure paper tone)
  ctx.fillStyle = pal.paper;
  ctx.fillRect(outerX, outerY, outerW, ribbonW); // Top ribbon
  ctx.fillRect(outerX, innerY + innerH, outerW, ribbonW); // Bottom ribbon
  ctx.fillRect(outerX, innerY, ribbonW, innerH); // Left ribbon
  ctx.fillRect(innerX + innerW, innerY, ribbonW, innerH); // Right ribbon

  // 2. Checkered / Piano-key graduations (alternating ink and paper blocks)
  const numCols = Math.max(1, Math.round(innerW / 24));
  const tickW = innerW / numCols;

  const numRows = Math.max(1, Math.round(innerH / 24));
  const tickH = innerH / numRows;

  // Top & bottom ribbons
  for (let i = 0; i < numCols; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = pal.ink;
      const tx = innerX + i * tickW;
      ctx.fillRect(tx, outerY, Math.ceil(tickW), ribbonW);
      ctx.fillRect(tx, innerY + innerH, Math.ceil(tickW), ribbonW);
    }
  }

  // Left & right ribbons
  for (let j = 0; j < numRows; j++) {
    if (j % 2 === 0) {
      ctx.fillStyle = pal.ink;
      const ty = innerY + j * tickH;
      ctx.fillRect(outerX, ty, ribbonW, Math.ceil(tickH));
      ctx.fillRect(innerX + innerW, ty, ribbonW, Math.ceil(tickH));
    }
  }

  // 3. Four corner blocks (solid ink squares to cleanly frame corners)
  ctx.fillStyle = pal.ink;
  ctx.fillRect(outerX, outerY, ribbonW, ribbonW); // Top-left
  ctx.fillRect(innerX + innerW, outerY, ribbonW, ribbonW); // Top-right
  ctx.fillRect(outerX, innerY + innerH, ribbonW, ribbonW); // Bottom-left
  ctx.fillRect(innerX + innerW, innerY + innerH, ribbonW, ribbonW); // Bottom-right

  // 4. Inner neatline (crisp boundary wrapping the map content)
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.0;
  ctx.strokeRect(innerX, innerY, innerW, innerH);

  // 5. Outer neatline (framing the outside of the ribbon against the collar)
  ctx.lineWidth = 1.6;
  ctx.strokeRect(outerX, outerY, outerW, outerH);

  ctx.restore();
}

// 7. Master Title Cartouche & Graphical Scale Bar (Modern Geodetic Survey Style)
function drawMasterCartouche(ctx, scene, pal, progress) {
  const { cartouche, runFont } = scene;
  if (!cartouche || progress <= 0) return;

  const { x, y, w, h, masterTitle, subtitle } = cartouche;

  ctx.save();
  ctx.globalAlpha = Math.min(1.0, progress * 1.5);

  // Opaque paper base plate
  ctx.fillStyle = pal.paper;
  ctx.fillRect(x, y, w, h);

  // Modern survey box: crisp neatline (outer border + inner hairline)
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x, y, w, h);

  ctx.lineWidth = 0.5;
  ctx.strokeStyle = pal.inkFaint;
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);

  ctx.fillStyle = pal.ink;
  ctx.textAlign = "center";

  // Official survey header (neutral geodetic series)
  ctx.font = runFont.noticeFont || '600 8.5px sans-serif';
  ctx.fillStyle = pal.inkFaint;
  ctx.fillText("FEDERAL TOPOGRAPHIC SURVEY  •  NATIONAL RECONNAISSANCE", x + w * 0.5, y + 20);

  // Maximum content width inside inner frame padding
  const maxContentW = w - 34;

  // Master Sheet Title with dynamic font scaling to ensure ZERO overflow
  let titleSize = 16.5;
  const titleFontMatch = (runFont.titleFont || '').match(/(\d+(?:\.\d+)?)\s*px\s*(.*)$/);
  const titleFamily = titleFontMatch ? titleFontMatch[2] : '"Cardo", "Times New Roman", serif';
  const titleWeight = (runFont.titleFont && runFont.titleFont.includes('600')) ? '600' : '700';

  ctx.font = `${titleWeight} ${titleSize}px ${titleFamily}`;
  while (ctx.measureText(masterTitle).width > maxContentW && titleSize > 9.0) {
    titleSize -= 0.5;
    ctx.font = `${titleWeight} ${titleSize}px ${titleFamily}`;
  }
  ctx.fillStyle = pal.ink;
  ctx.fillText(masterTitle, x + w * 0.5, y + 44);

  // Official sheet designation / scale subtitle (with dynamic fitting)
  let subSize = 10;
  const subMatch = (runFont.cartoSubFont || '').match(/(\d+(?:\.\d+)?)\s*px\s*(.*)$/);
  const subFamily = subMatch ? subMatch[2] : '"Barlow Semi Condensed", sans-serif';
  ctx.font = `500 ${subSize}px ${subFamily}`;
  while (ctx.measureText(subtitle).width > maxContentW && subSize > 7.0) {
    subSize -= 0.5;
    ctx.font = `500 ${subSize}px ${subFamily}`;
  }
  ctx.fillStyle = pal.inkFaint;
  ctx.fillText(subtitle, x + w * 0.5, y + 61);

  // Clean horizontal divider
  ctx.strokeStyle = pal.gridCross || pal.inkFaint;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + 28, y + 70);
  ctx.lineTo(x + w - 28, y + 70);
  ctx.stroke();

  // Contour Interval Notice
  ctx.font = runFont.noticeFont || '600 8.5px sans-serif';
  ctx.fillStyle = pal.ink;
  ctx.fillText("ÉQUIDISTANCE DES COURBES: 25 M  •  CONTOUR INTERVAL: 25 M", x + w * 0.5, y + 84);

  // Modern Metric Graphical Scale Bar (0 ── 1 ── 2 ── 4 KM)
  const barY = y + 101;
  const barW = 180;
  const barLeft = x + (w - barW) * 0.5;
  const barH = 4;

  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(barLeft, barY, barW, barH);

  // Alternating filled segments: 4 segments (each 1 km)
  const segW = barW / 4;
  for (let s = 0; s < 4; s++) {
    if (s % 2 === 0) {
      ctx.fillStyle = pal.ink;
      ctx.fillRect(barLeft + s * segW, barY, segW, barH);
    }
  }

  // Scale numerals
  ctx.font = runFont.scaleFont || '600 8.5px sans-serif';
  ctx.fillStyle = pal.ink;
  ctx.textAlign = "center";
  ctx.fillText("0", barLeft, barY - 4);
  ctx.fillText("1", barLeft + segW, barY - 4);
  ctx.fillText("2", barLeft + segW * 2, barY - 4);
  ctx.fillText("4 KM", barLeft + barW, barY - 4);

  ctx.restore();
}

// 8. Soft Watercolor Hill-Shade Relief Wash
function drawReliefWash(ctx, scene, pal, progress) {
  if (!scene.washCanvas || progress <= 0) return;
  const { totalW, totalH } = scene;
  ctx.save();
  ctx.globalAlpha = Math.min(1.0, progress * 1.5) * (pal.isDark ? 0.25 : 0.45);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(scene.washCanvas, 0, 0, totalW, totalH);
  ctx.restore();
}

if (typeof globalThis !== "undefined") {
  globalThis.generateTopographyScene = generateTopographyScene;
  globalThis.drawReliefWash = drawReliefWash;
  globalThis.drawGraticuleGrid = drawGraticuleGrid;
  globalThis.drawWaterlines = drawWaterlines;
  globalThis.drawContourLines = drawContourLines;
  globalThis.drawImhofHachures = drawImhofHachures;
  globalThis.drawSummitsAndPasses = drawSummitsAndPasses;
  globalThis.cleanOuterMargins = cleanOuterMargins;
  globalThis.drawNeatlineBorder = drawNeatlineBorder;
  globalThis.drawMasterCartouche = drawMasterCartouche;
}
