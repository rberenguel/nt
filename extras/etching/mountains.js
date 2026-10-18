// Mountain Ridge Intaglio Hatching Engine

let mountainLayers = [];

function getRidgeY(layer, x) {
  const pts = layer.pts;
  const idx = Math.max(0, Math.min(pts.length - 2, Math.floor((x - pts[0].x) / layer.stepX)));
  const pA = pts[idx];
  const pB = pts[idx + 1];
  const t = (x - pA.x) / (pB.x - pA.x);
  return pA.y + (pB.y - pA.y) * t;
}

function generateMountains(totalW, totalH, seed) {
  const layers = [];
  const numLayers = 6;

  for (let l = 0; l < numLayers; l++) {
    const depthFrac = l / (numLayers - 1);
    const baseY = totalH * (0.58 + depthFrac * 0.34);
    const heightScale = totalH * (0.16 - depthFrac * 0.05);
    const freq = (0.0010 + (1.0 - depthFrac) * 0.0012);
    const seedOffset = seed + l * 100;

    const pts = [];
    const stepX = 14;
    const totalPts = Math.ceil(totalW / stepX) + 4;

    for (let i = -2; i <= totalPts; i++) {
      const px = i * stepX;
      const n = fbm1D(px * freq, seedOffset);
      const ridge = 1.0 - Math.abs(n);
      const py = baseY - Math.pow(ridge, 1.4) * heightScale;
      pts.push({ x: px, y: py });
    }

    const etchAngle = 0.96; // ~55 degrees
    const cosA = Math.cos(etchAngle);
    const sinA = Math.sin(etchAngle);
    const spacing = Math.max(18.0, 22.0 + l * 2.5);
    const maxLen = heightScale * (0.80 + l * 0.06);
    const minX = pts[0].x;
    const maxX = pts[pts.length - 1].x;

    const hatchLines = [];
    for (let x = minX; x <= maxX; x += spacing) {
      const ry = getRidgeY({ pts, stepX }, x);
      const n = fbm1D(x * 0.0038, seedOffset + 250);
      const rawN = 0.5 + 0.5 * n;
      let len = 0;
      if (rawN > 0.15) {
        const factor = (rawN - 0.15) / 0.85;
        len = (0.15 + 0.85 * Math.pow(factor, 1.3)) * maxLen;
      }
      if (len > 3.0) {
        hatchLines.push({
          x,
          ry,
          x2: x + cosA * len,
          y2: ry + sinA * len,
          len,
          cosA,
          sinA,
        });
      }
    }

    // Valley shadow hatching: dense diagonal shading in deep chasms where background peak towers above foreground
    const valleyLines = [];
    if (l > 0) {
      const prevLayer = layers[l - 1];
      const vSpacing = 3.5; // Dense intaglio spacing for velvety shadow tone
      // Match the intaglio angle of the mountains (~55 degrees, rising up along the slope slant)
      const vCos = -cosA;
      const vSin = -sinA;
      const vThreshold = Math.max(65.0, totalH * 0.075); // Only trigger in deep valley canyons

      for (let x = minX; x <= maxX; x += vSpacing) {
        const ryFront = getRidgeY({ pts, stepX }, x);
        const ryBack = getRidgeY(prevLayer, x);
        const deltaY = ryFront - ryBack; // Positive when background is taller (smaller y)

        if (deltaY > vThreshold) {
          const depthFactor = Math.min(1.0, (deltaY - vThreshold) / (heightScale * 0.75));
          const n = fbm1D(x * 0.007, seedOffset + 700);
          const noiseFactor = 0.85 + 0.3 * (0.5 + 0.5 * n);
          const vLen = Math.pow(depthFactor, 1.25) * Math.min(36.0, deltaY * 0.40) * noiseFactor;

          if (vLen > 2.5) {
            valleyLines.push({
              x,
              ry: ryFront,
              x2: x + vCos * vLen,
              y2: ryFront + vSin * vLen,
              len: vLen,
              cosA: vCos,
              sinA: vSin,
            });
          }
        }
      }
    }

    layers.push({
      depth: depthFrac,
      baseY,
      heightScale,
      pts,
      stepX,
      seedOffset,
      hatchLines,
      valleyLines,
      lineWidth: Math.max(1.5, 2.3 - l * 0.12),
    });
  }

  mountainLayers = layers;
}

function drawMountainLayer(ctx, layer, layerIdx, totalW, totalH, pal, progress = 1.0) {
  if (progress <= 0) return;
  const { pts } = layer;
  if (pts.length < 2) return;

  const minX = pts[0].x;
  const maxX = pts[pts.length - 1].x;
  const spanX = maxX - minX;

  ctx.save();

  const RIDGE_SPLIT = 0.28; // Deliberate time spent tracing ridge profile

  if (progress < RIDGE_SPLIT) {
    // Stage 1: Trace ridge silhouette from left to right
    const ridgeP = Math.min(1.0, progress / RIDGE_SPLIT);
    const curMaxX = minX + spanX * ridgeP;

    // Mask background with paper fill
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    let lastPt = pts[0];
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].x <= curMaxX) {
        ctx.lineTo(pts[i].x, pts[i].y);
        lastPt = pts[i];
      } else {
        const t = (curMaxX - lastPt.x) / (pts[i].x - lastPt.x);
        const curY = lastPt.y + (pts[i].y - lastPt.y) * t;
        ctx.lineTo(curMaxX, curY);
        break;
      }
    }
    ctx.lineTo(curMaxX, totalH + 50);
    ctx.lineTo(pts[0].x, totalH + 50);
    ctx.closePath();

    ctx.fillStyle = pal.paper;
    ctx.fill();

    // Silhouette outline stroke
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    lastPt = pts[0];
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].x <= curMaxX) {
        ctx.lineTo(pts[i].x, pts[i].y);
        lastPt = pts[i];
      } else {
        const t = (curMaxX - lastPt.x) / (pts[i].x - lastPt.x);
        const curY = lastPt.y + (pts[i].y - lastPt.y) * t;
        ctx.lineTo(curMaxX, curY);
        break;
      }
    }
    ctx.stroke();

  } else {
    // Stage 2: Ridge profile is complete
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.lineTo(pts[pts.length - 1].x, totalH + 50);
    ctx.lineTo(pts[0].x, totalH + 50);
    ctx.closePath();

    ctx.fillStyle = pal.paper;
    ctx.fill();

    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Valley shadow hatching rising UP from the ridge into obscured canyon recesses
    if (layer.valleyLines && layer.valleyLines.length > 0) {
      ctx.save();
      ctx.lineWidth = Math.max(0.85, layer.lineWidth * 0.52);
      ctx.strokeStyle = pal.ink;
      ctx.lineCap = "round";

      if (progress >= 1.0) {
        ctx.beginPath();
        for (const v of layer.valleyLines) {
          ctx.moveTo(v.x, v.ry);
          ctx.lineTo(v.x2, v.y2);
        }
        ctx.stroke();
      } else {
        const hatchP = (progress - RIDGE_SPLIT) / (1.0 - RIDGE_SPLIT);
        const nValley = layer.valleyLines.length;
        const vSpan = 5.0 / nValley;
        ctx.beginPath();
        for (let k = 0; k < nValley; k++) {
          const startP = (k / nValley) * (1.0 - vSpan);
          if (hatchP <= startP) break;
          const v = layer.valleyLines[k];
          const frac = Math.min(1.0, (hatchP - startP) / vSpan);
          ctx.moveTo(v.x, v.ry);
          ctx.lineTo(v.x + v.cosA * v.len * frac, v.ry + v.sinA * v.len * frac);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Clip to mountain body for downward slope hatchings
    ctx.clip();

    ctx.lineWidth = layer.lineWidth;
    ctx.strokeStyle = pal.ink;
    ctx.lineCap = "round";

    if (progress >= 1.0) {
      // 100% completed layer
      ctx.beginPath();
      for (const h of layer.hatchLines) {
        ctx.moveTo(h.x, h.ry);
        ctx.lineTo(h.x2, h.y2);
      }
      ctx.stroke();
    } else {
      // Carve slope hatch lines sequentially from left to right with visible stroke extension
      const hatchP = (progress - RIDGE_SPLIT) / (1.0 - RIDGE_SPLIT);
      const mLines = layer.hatchLines.length;
      if (mLines > 0) {
        const hatchSpan = 5.0 / mLines;
        ctx.beginPath();
        for (let k = 0; k < mLines; k++) {
          const startP = (k / mLines) * (1.0 - hatchSpan);
          if (hatchP <= startP) break;
          const h = layer.hatchLines[k];
          const frac = Math.min(1.0, (hatchP - startP) / hatchSpan);
          ctx.moveTo(h.x, h.ry);
          ctx.lineTo(h.x + h.cosA * h.len * frac, h.ry + h.sinA * h.len * frac);
        }
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}
