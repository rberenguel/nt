// Large-Scale Perlin Noise Field + Quantized Intaglio Sky Engine

let skyColumns = [];
let skyPaths = null;

function getLightness(x, y, totalW, totalH, horizonY, seed) {
  const dSun = Math.hypot(x - sunPos.x, y - sunPos.y);
  const sunClearR = sunPos.rad + 55;
  if (dSun < sunClearR) return 1.0;

  const glowRadius = Math.max(300, totalW * 0.16);
  const sunGlow = Math.max(0.0, 1.0 - (dSun - sunClearR) / glowRadius);

  const pNoise = fbm2D(x * 0.0028, y * 0.0038 + seed * 0.05, 3);

  const angle = Math.atan2(y - sunPos.y, x - sunPos.x);
  const beam = Math.pow(0.5 + 0.5 * Math.sin(angle * 12.0), 3) * sunGlow;

  const alt = (y / horizonY) * 0.28;

  const V = 0.22 + sunGlow * 0.50 + beam * 0.30 + pNoise * 0.38 + alt;
  return Math.max(0.0, Math.min(1.0, V));
}

function generateSkyPaths(totalW, totalH, seed, backLayer) {
  if (!backLayer) return;
  const stepX = backLayer.stepX;

  const usePath2D = typeof Path2D !== "undefined";
  const pathContinuous = usePath2D ? new Path2D() : null;
  const pathDiscontinuous = usePath2D ? new Path2D() : null;
  const pathDots = usePath2D ? new Path2D() : null;

  skyColumns = [];
  const colStep = 22.0;

  for (let x = 16; x < totalW - 16; x += colStep) {
    const ptIdx = Math.max(0, Math.min(backLayer.pts.length - 2, Math.floor(x / stepX)));
    const pA = backLayer.pts[ptIdx];
    const pB = backLayer.pts[ptIdx + 1];
    const t = (x - pA.x) / (pB.x - pA.x);
    const horizonY = pA.y + (pB.y - pA.y) * t;

    let y = 14;
    const colRng = createRNG(Math.floor(x * 1337 + seed * 91));
    const segments = [];

    while (y < horizonY) {
      const V = getLightness(x, y, totalW, totalH, horizonY, seed);

      if (V >= 0.74) {
        y += 12 + colRng() * 10;
      } else if (V >= 0.50) {
        const segLen = 22.0 + (0.74 - V) * 60.0 + colRng() * 15.0;
        const segEnd = Math.min(horizonY, y + segLen);
        segments.push({ y1: y, y2: segEnd, tier: 3 });
        if (usePath2D) {
          pathDots.moveTo(x, y);
          pathDots.lineTo(x, segEnd);
        }
        const gap = 12.0 + colRng() * 8.0;
        y = segEnd + gap;
      } else if (V >= 0.28) {
        const segLen = 55.0 + (0.50 - V) * 110.0 + colRng() * 25.0;
        const segEnd = Math.min(horizonY, y + segLen);
        segments.push({ y1: y, y2: segEnd, tier: 2 });
        if (usePath2D) {
          pathDiscontinuous.moveTo(x, y);
          pathDiscontinuous.lineTo(x, segEnd);
        }
        const gap = 7.0 + (V - 0.28) * 14.0 + colRng() * 5.0;
        y = segEnd + gap;
      } else {
        const segLen = 120.0 + (0.28 - V) * 260.0 + colRng() * 35.0;
        const segEnd = Math.min(horizonY, y + segLen);
        segments.push({ y1: y, y2: segEnd, tier: 1 });
        if (usePath2D) {
          pathContinuous.moveTo(x, y);
          pathContinuous.lineTo(x, segEnd);
        }
        const gap = 3.5 + colRng() * 3.0;
        y = segEnd + gap;
      }
    }

    skyColumns.push({ x, horizonY, segments });
  }

  if (usePath2D) {
    skyPaths = {
      continuous: pathContinuous,
      discontinuous: pathDiscontinuous,
      dots: pathDots,
    };
  } else {
    skyPaths = null;
  }
}

function drawVerticalBrokenSky(ctx, pal, progress = 1.0) {
  if (progress <= 0 || skyColumns.length === 0) return;

  ctx.save();
  ctx.strokeStyle = pal.ink;
  ctx.lineCap = "round";

  if (progress >= 1.0 && skyPaths) {
    ctx.globalAlpha = 0.90;
    ctx.lineWidth = 2.80;
    ctx.stroke(skyPaths.continuous);

    ctx.globalAlpha = 0.80;
    ctx.lineWidth = 2.50;
    ctx.stroke(skyPaths.discontinuous);

    ctx.globalAlpha = 0.70;
    ctx.lineWidth = 2.20;
    ctx.stroke(skyPaths.dots);
    ctx.restore();
    return;
  }

  // Progressive line-by-line engraving: columns carved one by one from left to right with visible stroke sweep
  const nCols = skyColumns.length;
  const colSpan = 5.0 / nCols;
  for (let i = 0; i < nCols; i++) {
    const startP = (i / nCols) * (1.0 - colSpan);
    if (progress <= startP) break;
    const colP = Math.min(1.0, (progress - startP) / colSpan);
    const col = skyColumns[i];
    const maxDrawY = 14 + (col.horizonY - 14) * colP;

    for (const seg of col.segments) {
      if (seg.y1 >= maxDrawY) continue;
      const endY = Math.min(seg.y2, maxDrawY);

      if (seg.tier === 1) {
        ctx.globalAlpha = 0.90;
        ctx.lineWidth = 2.80;
      } else if (seg.tier === 2) {
        ctx.globalAlpha = 0.80;
        ctx.lineWidth = 2.50;
      } else {
        ctx.globalAlpha = 0.70;
        ctx.lineWidth = 2.20;
      }

      ctx.beginPath();
      ctx.moveTo(col.x, seg.y1);
      ctx.lineTo(col.x, endY);
      ctx.stroke();
    }
  }

  ctx.restore();
}
