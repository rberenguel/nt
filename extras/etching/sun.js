// Celestial Sun Designs & Radiating Engraved Rays

let sunPos = { x: 0, y: 0, rad: 0 };
let sunStyle = 0;
let sunElements = null;

function generateSun(totalW, totalH, seed) {
  const rng = createRNG(seed + 101);
  sunPos = {
    x: totalW * (0.22 + rng() * 0.56),
    y: totalH * (0.16 + rng() * 0.12),
    rad: Math.min(totalW, totalH) * (0.046 + rng() * 0.018),
  };
  sunStyle = Math.floor(rng() * 3);

  const { x, y, rad } = sunPos;
  const elements = { style: sunStyle, rays: [], rings: [], hatchings: [] };

  if (sunStyle === 0) {
    const numRays = 36;
    for (let i = 0; i < numRays; i++) {
      const angle = -Math.PI / 2 + (i / numRays) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const rVal = rng();
      let rayLen, strokeW;
      if (rVal < 0.35) {
        rayLen = rad * (0.25 + rng() * 0.35);
        strokeW = 1.4 + rng() * 0.8;
      } else if (rVal < 0.80) {
        rayLen = rad * (0.65 + rng() * 0.75);
        strokeW = 2.0 + rng() * 1.2;
      } else {
        rayLen = rad * (1.40 + rng() * 1.50);
        strokeW = 2.8 + rng() * 1.6;
      }
      elements.rays.push({
        angle,
        x1: x + cosA * (rad + 1.5),
        y1: y + sinA * (rad + 1.5),
        x2: x + cosA * (rad + 1.5 + rayLen),
        y2: y + sinA * (rad + 1.5 + rayLen),
        strokeW,
      });
    }
  } else if (sunStyle === 1) {
    const numSpikes = 26;
    for (let i = 0; i < numSpikes; i++) {
      const angle = -Math.PI / 2 + (i / numSpikes) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const isMajor = i % 2 === 0;
      const rayLen = isMajor ? rad * (1.1 + rng() * 0.9) : rad * (0.45 + rng() * 0.45);
      const strokeW = isMajor ? 3.0 : 1.6;
      elements.rays.push({
        angle,
        x1: x + cosA * (rad + 3.0),
        y1: y + sinA * (rad + 3.0),
        x2: x + cosA * (rad + 3.0 + rayLen),
        y2: y + sinA * (rad + 3.0 + rayLen),
        strokeW,
      });
    }
  } else {
    // Style 2: Woodcut Halo
    const numHaloRings = 5;
    for (let i = 1; i <= numHaloRings; i++) {
      elements.rings.push({
        r: rad + i * 11.0,
        dash: i % 2 === 0 ? [8, 10] : [16, 12],
      });
    }
    for (let py = y - rad; py <= y + rad; py += 4.5) {
      if (py > y - rad * 0.1) {
        elements.hatchings.push({ x1: x - rad, y1: py, x2: x + rad, y2: py });
      }
    }
    const numBeams = 32;
    for (let i = 0; i < numBeams; i++) {
      const angle = -Math.PI / 2 + (i / numBeams) * Math.PI * 2;
      const innerR = rad + numHaloRings * 11.0 + 12;
      const outerR = innerR + 70 + ((i * 37) % 180);
      elements.rays.push({
        angle,
        x1: x + Math.cos(angle) * innerR,
        y1: y + Math.sin(angle) * innerR,
        x2: x + Math.cos(angle) * outerR,
        y2: y + Math.sin(angle) * outerR,
        strokeW: 1.4,
      });
    }
  }

  sunElements = elements;
}

function drawSunAndRays(ctx, totalW, totalH, pal, progress = 1.0) {
  if (!sunElements || progress <= 0) return;
  const { x, y, rad } = sunPos;
  ctx.save();
  ctx.lineCap = "round";

  if (sunElements.style === 0) {
    // Style 0: Black Burst / Intaglio Eclipse
    const discP = Math.min(1.0, progress / 0.28);
    ctx.fillStyle = pal.ink;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.0;

    ctx.beginPath();
    ctx.arc(x, y, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * discP);
    if (discP >= 1.0) {
      ctx.fill();
    } else {
      ctx.stroke();
    }

    const rayProgress = Math.max(0, Math.min(1.0, (progress - 0.28) / 0.72));
    if (rayProgress > 0) {
      const nRays = sunElements.rays.length;
      const raySpan = 4.0 / nRays;
      for (let i = 0; i < nRays; i++) {
        const startP = (i / nRays) * (1.0 - raySpan);
        if (rayProgress <= startP) break;
        const ray = sunElements.rays[i];
        const frac = Math.min(1.0, (rayProgress - startP) / raySpan);

        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = ray.strokeW;
        ctx.beginPath();
        ctx.moveTo(ray.x1, ray.y1);
        ctx.lineTo(ray.x1 + (ray.x2 - ray.x1) * frac, ray.y1 + (ray.y2 - ray.y1) * frac);
        ctx.stroke();
      }
    }
  } else if (sunElements.style === 1) {
    // Style 1: Sol Invictus / Flame Wedges
    const discP = Math.min(1.0, progress / 0.28);
    ctx.fillStyle = pal.ink;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.0;

    ctx.beginPath();
    ctx.arc(x, y, rad * 0.82, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * discP);
    if (discP >= 1.0) {
      ctx.fill();
    } else {
      ctx.stroke();
    }

    if (discP > 0.4) {
      const ringP = (discP - 0.4) / 0.6;
      ctx.beginPath();
      ctx.arc(x, y, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ringP);
      ctx.stroke();
    }

    const rayProgress = Math.max(0, Math.min(1.0, (progress - 0.28) / 0.72));
    if (rayProgress > 0) {
      const nSpikes = sunElements.rays.length;
      const spikeSpan = 4.0 / nSpikes;
      for (let i = 0; i < nSpikes; i++) {
        const startP = (i / nSpikes) * (1.0 - spikeSpan);
        if (rayProgress <= startP) break;
        const ray = sunElements.rays[i];
        const frac = Math.min(1.0, (rayProgress - startP) / spikeSpan);

        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = ray.strokeW;
        ctx.beginPath();
        ctx.moveTo(ray.x1, ray.y1);
        ctx.lineTo(ray.x1 + (ray.x2 - ray.x1) * frac, ray.y1 + (ray.y2 - ray.y1) * frac);
        ctx.stroke();
      }
    }
  } else {
    // Style 2: Woodcut Halo
    const ringP = Math.min(1.0, progress / 0.35);
    const nRings = sunElements.rings.length;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.6;

    for (let i = 0; i < nRings; i++) {
      const startP = i / nRings;
      if (ringP <= startP) break;
      const endP = (i + 1) / nRings;
      const frac = Math.min(1.0, (ringP - startP) / (endP - startP));
      const ring = sunElements.rings[i];
      ctx.setLineDash(ring.dash);
      ctx.beginPath();
      ctx.arc(x, y, ring.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Solid paper disc & inner horizontal hatching: 0.35 -> 0.55
    const hatchProgress = Math.max(0.0, Math.min(1.0, (progress - 0.35) / 0.20));
    if (hatchProgress > 0) {
      ctx.fillStyle = pal.paper;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, rad - 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.lineWidth = 1.4;

      const nHatch = sunElements.hatchings.length;
      for (let i = 0; i < nHatch; i++) {
        if ((i + 1) / nHatch <= hatchProgress) {
          const h = sunElements.hatchings[i];
          ctx.beginPath();
          ctx.moveTo(h.x1, h.y1);
          ctx.lineTo(h.x2, h.y2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Outer radiating beams: 0.55 -> 1.00
    const beamProgress = Math.max(0.0, Math.min(1.0, (progress - 0.55) / 0.45));
    if (beamProgress > 0) {
      const nBeams = sunElements.rays.length;
      const beamSpan = 4.0 / nBeams;
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = pal.ink;
      for (let i = 0; i < nBeams; i++) {
        const startP = (i / nBeams) * (1.0 - beamSpan);
        if (beamProgress <= startP) break;
        const ray = sunElements.rays[i];
        const frac = Math.min(1.0, (beamProgress - startP) / beamSpan);
        ctx.beginPath();
        ctx.moveTo(ray.x1, ray.y1);
        ctx.lineTo(ray.x1 + (ray.x2 - ray.x1) * frac, ray.y1 + (ray.y2 - ray.y1) * frac);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}
