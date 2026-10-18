// 16th/17th Century Celestial Star Intensity & Magnitude Rendering
// Based on historical star intensity tables (Bayer 1603, Hevelius 1690)
// where stars are classified by magnitude (1st to 6th) with point count and radius.

const STAR_MAGNITUDES = {
  1: { points: 8, radius: 11.0, innerRatio: 0.30, label: "1. Mag." },
  2: { points: 7, radius: 8.5,  innerRatio: 0.32, label: "2. Mag." },
  3: { points: 6, radius: 6.8,  innerRatio: 0.34, label: "3. Mag." },
  4: { points: 5, radius: 5.2,  innerRatio: 0.36, label: "4. Mag." },
  5: { points: 4, radius: 3.6,  innerRatio: 0.32, label: "5. Mag." },
  6: { points: 4, radius: 2.2,  innerRatio: 0.30, label: "6. Mag." },
};

/**
 * Draws a sharp N-pointed star polygon with outer and inner radii.
 */
function drawStarPolygon(ctx, cx, cy, points, outerR, innerR, rot = -Math.PI / 2) {
  ctx.beginPath();
  const step = Math.PI / points;
  for (let i = 0; i < 2 * points; i++) {
    const r = (i % 2 === 0) ? outerR : innerR;
    const a = rot + i * step;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Renders an authentic 16th/17th century engraved star.
 * If progress < 1.0, scales smoothly from a single pixel (tiny dot) up to full size.
 */
function drawEngravedStar(ctx, star, pal, progress = 1.0) {
  if (progress <= 0) return;

  const magConfig = STAR_MAGNITUDES[star.mag] || STAR_MAGNITUDES[6];
  const targetR = star.finalRadius || magConfig.radius;
  const points = star.points || magConfig.points;
  const innerRatio = magConfig.innerRatio;
  const rot = star.rot !== undefined ? star.rot : -Math.PI / 2;

  // Smooth scale from 0.8px (single pixel) to full target radius
  const t = easeOutQuad(Math.min(1.0, progress));
  const currentR = Math.max(0.75, 0.75 + (targetR - 0.75) * t);
  const currentInnerR = Math.max(0.35, currentR * innerRatio);

  ctx.save();
  ctx.fillStyle = pal.ink;
  ctx.strokeStyle = pal.ink;

  if (currentR <= 1.4 || points < 4) {
    // Single pixel / tiny dot appearance at initial blossom
    ctx.beginPath();
    ctx.arc(star.x, star.y, currentR, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Multi-pointed star geometry
    drawStarPolygon(ctx, star.x, star.y, points, currentR, currentInnerR, rot);

    // For 1st magnitude major luminaries: draw delicate secondary rays when near full size
    if (star.mag === 1 && currentR >= 8.0) {
      ctx.lineWidth = 0.75;
      const secR = currentR * 1.35;
      ctx.beginPath();
      // 4 cardinal secondary hairline spikes
      for (let i = 0; i < 4; i++) {
        const a = rot + (i * Math.PI) / 2;
        ctx.moveTo(star.x + Math.cos(a) * (currentR * 0.9), star.y + Math.sin(a) * (currentR * 0.9));
        ctx.lineTo(star.x + Math.cos(a) * secR, star.y + Math.sin(a) * secR);
      }
      ctx.stroke();

      // Tiny central ink point
      ctx.beginPath();
      ctx.arc(star.x, star.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Draws all stars given a global progress value (0.0 to 1.0).
 * Stars are animated sequentially one by one in the order of the starsArray.
 */
function drawAllStars(ctx, starsArray, pal, progress) {
  if (!starsArray || starsArray.length === 0 || progress <= 0) return;

  const total = starsArray.length;
  // Each star has an individual start time and takes a small time window to bloom
  const windowDuration = Math.min(0.06, 2.5 / total);

  for (let i = 0; i < total; i++) {
    const star = starsArray[i];
    const startTime = (i / total) * (1.0 - windowDuration);
    if (progress < startTime) {
      continue; // Has not appeared yet
    }
    const starProgress = Math.min(1.0, (progress - startTime) / windowDuration);
    drawEngravedStar(ctx, star, pal, starProgress);
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.STAR_MAGNITUDES = STAR_MAGNITUDES;
  globalThis.drawStarPolygon = drawStarPolygon;
  globalThis.drawEngravedStar = drawEngravedStar;
  globalThis.drawAllStars = drawAllStars;
}
