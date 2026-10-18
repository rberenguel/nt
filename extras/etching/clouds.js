// Multiscale Arch-Carved Engraved Clouds (generativelight technique)

let cloudsList = [];

function generateCloudLobes(cx, cy, spanW, spanH, rng, style) {
  const lobes = [];
  const baseY = cy + spanH * 0.38;

  // Horizontal baseline lobes to ensure solid flat bottom
  const baseR = Math.max(8, spanH * 0.22);
  const numBase = Math.max(5, Math.floor(spanW / (baseR * 1.5)));
  for (let i = 0; i <= numBase; i++) {
    const t = i / numBase;
    const bx = cx - spanW * 0.48 + t * spanW * 0.96;
    const by = baseY - baseR * 0.3 + (rng() - 0.5) * (baseR * 0.25);
    lobes.push({ x: bx, y: by, r: baseR });
  }

  // Upper billowing lobes: adjacent billows overlap by at least 40-50% for smooth continuity
  let billows = [];
  if (style === "towering") {
    billows = [
      { t: 0.12, h: 0.28, r: 0.25 },
      { t: 0.24, h: 0.55, r: 0.36 },
      { t: 0.38, h: 0.92, r: 0.48 },
      { t: 0.52, h: 0.70, r: 0.42 },
      { t: 0.66, h: 0.52, r: 0.36 },
      { t: 0.78, h: 0.36, r: 0.28 },
      { t: 0.88, h: 0.22, r: 0.20 },
    ];
  } else if (style === "twin_peaks") {
    billows = [
      { t: 0.14, h: 0.30, r: 0.26 },
      { t: 0.28, h: 0.72, r: 0.40 },
      { t: 0.42, h: 0.52, r: 0.34 },
      { t: 0.56, h: 0.78, r: 0.42 },
      { t: 0.72, h: 0.55, r: 0.36 },
      { t: 0.86, h: 0.28, r: 0.24 },
    ];
  } else if (style === "rolling") {
    billows = [
      { t: 0.12, h: 0.32, r: 0.26 },
      { t: 0.26, h: 0.60, r: 0.36 },
      { t: 0.42, h: 0.72, r: 0.40 },
      { t: 0.58, h: 0.58, r: 0.36 },
      { t: 0.74, h: 0.65, r: 0.38 },
      { t: 0.88, h: 0.30, r: 0.24 },
    ];
  } else if (style === "wisp") {
    billows = [
      { t: 0.20, h: 0.25, r: 0.24 },
      { t: 0.50, h: 0.52, r: 0.38 },
      { t: 0.80, h: 0.28, r: 0.24 },
    ];
  } else {
    // Windswept
    billows = [
      { t: 0.12, h: 0.20, r: 0.20 },
      { t: 0.28, h: 0.35, r: 0.28 },
      { t: 0.46, h: 0.52, r: 0.36 },
      { t: 0.64, h: 0.75, r: 0.42 },
      { t: 0.82, h: 0.85, r: 0.46 },
      { t: 0.92, h: 0.45, r: 0.30 },
    ];
  }

  for (let b = 0; b < billows.length; b++) {
    const bil = billows[b];
    const px = cx - spanW * 0.48 + bil.t * spanW * 0.96 + (rng() - 0.5) * 6;
    const py = baseY - bil.h * spanH;
    const prad = bil.r * spanH + Math.max(3, spanH * 0.08);

    lobes.push({ x: px, y: py, r: prad });

    const numFill = Math.max(2, Math.floor(bil.h * 3.5));
    for (let f = 1; f <= numFill; f++) {
      const fy = py + (baseY - py) * (f / (numFill + 0.5));
      lobes.push({ x: px + (rng() - 0.5) * 4, y: fy, r: prad * 0.95 });
    }

    if (bil.h > 0.35) {
      lobes.push({ x: px - prad * 0.55, y: py + prad * 0.35, r: prad * 0.65 });
      lobes.push({ x: px + prad * 0.55, y: py + prad * 0.35, r: prad * 0.65 });
    }
  }

  return { lobes, baseY };
}

function generateClouds(totalW, totalH, seed) {
  const rng = createRNG(seed + 303);
  cloudsList = [];

  const numClouds = 7;
  const sizeTiers = ["large", "small", "medium", "small", "large", "medium", "small"];

  for (let c = 0; c < numClouds; c++) {
    const tier = sizeTiers[c % sizeTiers.length];
    let peakStyle;
    let spanW;

    if (tier === "small") {
      spanW = totalW * (0.032 + rng() * 0.018);
      peakStyle = rng() < 0.5 ? "wisp" : "windswept";
    } else if (tier === "medium") {
      spanW = totalW * (0.055 + rng() * 0.025);
      const medStyles = ["rolling", "twin_peaks", "towering"];
      peakStyle = medStyles[Math.floor(rng() * medStyles.length)];
    } else {
      spanW = totalW * (0.090 + rng() * 0.030);
      const lgStyles = ["towering", "rolling", "twin_peaks"];
      peakStyle = lgStyles[Math.floor(rng() * lgStyles.length)];
    }

    const spanH = peakStyle === "rolling" ? spanW * (0.19 + rng() * 0.04) : spanW * (0.28 + rng() * 0.06);
    const cx = ((c + 0.5) / numClouds) * totalW + (rng() - 0.5) * (totalW * 0.06);
    let cy = totalH * (0.12 + (c % 3) * 0.10 + rng() * 0.04);
    if (tier === "small") {
      cy += (rng() - 0.5) * totalH * 0.06;
    }

    const { lobes, baseY } = generateCloudLobes(cx, cy, spanW, spanH, rng, peakStyle);

    function cloudDist(x, y) {
      let minD = Infinity;
      for (let i = 0; i < lobes.length; i++) {
        const d = Math.hypot(x - lobes[i].x, y - lobes[i].y) - lobes[i].r;
        if (d < minD) minD = d;
      }
      return Math.max(minD, y - baseY);
    }

    function inFrame(x, y) {
      return cloudDist(x, y) <= 2.0;
    }

    const scaleRef = Math.max(0.40, Math.min(1.15, spanH / 75.0));
    const scales = [
      { step: 8.5 * scaleRef, minR: 7.0 * scaleRef, maxR: 9.2 * scaleRef, probMult: 0.85 },
      { step: 5.2 * scaleRef, minR: 4.2 * scaleRef, maxR: 5.8 * scaleRef, probMult: 1.0 },
      { step: 3.6 * scaleRef, minR: 2.4 * scaleRef, maxR: 3.5 * scaleRef, probMult: 1.25 },
    ];

    const minX = Math.floor(cx - spanW * 0.55);
    const maxX = Math.ceil(cx + spanW * 0.55);
    const minY = Math.floor(cy - spanH * 0.85);
    const maxY = Math.ceil(baseY + 6);
    const edgeBand = Math.max(8, spanH * 0.22);

    const circles = [];

    for (let s = 0; s < scales.length; s++) {
      const sc = scales[s];
      const step = sc.step;
      const wiggle = step * 0.45;
      const minR = sc.minR;
      const maxR = sc.maxR;
      const probMult = sc.probMult;

      for (let gx = minX; gx <= maxX; gx += step) {
        for (let gy = minY; gy <= maxY; gy += step) {
          const wx = gx + (rng() - 0.5) * wiggle;
          const wy = gy + (rng() - 0.5) * wiggle;
          if (inFrame(wx, wy)) {
            const cd = cloudDist(wx, wy);
            const edgeFactor = Math.max(0, Math.min(1.0, (cd + edgeBand) / edgeBand));
            const baseProb = 0.08 + 0.44 * edgeFactor;

            const nVal = fbm2D(wx * 0.03, wy * 0.03, 3);
            const prob = Math.max(0.03, Math.min(0.62, (baseProb + nVal * 0.28) * probMult));

            const rVal = minR + rng() * (maxR - minR);

            if (rng() < prob) {
              const opacity = Math.max(0.25, Math.min(0.95, 0.40 + 0.55 * edgeFactor + (rng() - 0.5) * 0.2));
              const sw = 0.70 + 0.3 * edgeFactor;
              circles.push({
                type: "border",
                x: wx,
                y: wy,
                r: rVal,
                opacity,
                sw,
                z: rng(),
              });
              const ang = rng() * Math.PI * 2;
              const dist = rVal * (0.35 + rng() * 0.40);
              circles.push({
                type: "carver",
                x: wx + Math.cos(ang) * dist,
                y: wy + Math.sin(ang) * dist,
                r: rVal * (0.85 + rng() * 0.30),
                z: circles[circles.length - 1].z + 0.01,
              });
            } else {
              circles.push({
                type: "ambient",
                x: wx,
                y: wy,
                r: rVal,
                z: rng(),
              });
            }
          }
        }
      }
    }

    // Sort by z so paper fill circles carve borders into arches
    circles.sort((a, b) => a.z - b.z);

    cloudsList.push({
      cx,
      cy,
      spanW,
      spanH,
      minX,
      maxX,
      minY,
      baseY,
      circles,
    });
  }
}

function drawClouds(ctx, pal, progress = 1.0) {
  if (progress <= 0 || cloudsList.length === 0) return;

  const nClouds = cloudsList.length;
  const cloudSpan = 1.4 / nClouds;
  for (let c = 0; c < nClouds; c++) {
    const startP = (c / nClouds) * (1.0 - cloudSpan);
    if (progress <= startP) break;

    const cloudP = Math.min(1.0, (progress - startP) / cloudSpan);
    const cloud = cloudsList[c];

    ctx.save();
    if (cloudP < 1.0) {
      // Billow upward from baseY to minY
      const currentTopY = cloud.baseY - (cloud.baseY - cloud.minY) * cloudP;
      ctx.beginPath();
      ctx.rect(cloud.minX - 10, currentTopY, (cloud.maxX - cloud.minX) + 20, (cloud.baseY - currentTopY) + 20);
      ctx.clip();
    }

    for (let i = 0; i < cloud.circles.length; i++) {
      const circ = cloud.circles[i];
      if (circ.type === "border") {
        ctx.fillStyle = pal.paper;
        ctx.beginPath();
        ctx.arc(circ.x, circ.y, circ.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.globalAlpha = circ.opacity;
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = circ.sw;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = pal.paper;
        ctx.beginPath();
        ctx.arc(circ.x, circ.y, circ.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
