// 16th/17th Century Celestial Chart Embellishments & Intaglio Framing
// Includes celestial coordinate arcs, neatline degree ticks, and the "Magnitudines Stellarum" key.

/**
 * Draws celestial coordinate grid arcs (declination parallels & right ascension meridians).
 */
/**
 * Draws celestial coordinate grid arcs (declination parallels & right ascension meridians).
 * Progressively animates the engraving:
 * 1. Declination arches sweep gracefully from West to East across the sky (0.0 -> 0.55).
 * 2. Right Ascension meridians radiate outward South-to-North, cascading West to East (0.35 -> 0.85).
 * 3. Degree labels and optional Voronoi boundary grid fade in (0.80 -> 1.00).
 */
function drawCelestialGrid(ctx, totalW, totalH, margin, pal, progress = 1.0, voronoiCells = null, showVoronoi = false) {
  if (progress <= 0) return;

  ctx.save();
  ctx.strokeStyle = pal.gridColor || "rgba(20, 20, 20, 0.22)";
  ctx.lineWidth = 0.65;
  ctx.setLineDash([4, 4]);

  const centerX = totalW * 0.5;
  const centerY = totalH * 1.35; // Projected celestial pole below for graceful upward arches

  // Arcs of Declination
  const minR = totalH * 0.45;
  const maxR = totalH * 1.55;
  const numArcs = 7;
  const degLabels = ["+60°", "+45°", "+30°", "+15°", "0° (Aequator)", "-15°", "-30°"];

  const arcStart = -Math.PI * 0.85;
  const arcEnd = -Math.PI * 0.15;

  // Phase 1: Arcs sweep across the sky West-to-East (0.0 -> 0.55)
  const arcProg = Math.min(1.0, progress / 0.55);
  if (arcProg > 0) {
    const curEndAngle = arcStart + (arcEnd - arcStart) * arcProg;

    for (let i = 0; i < numArcs; i++) {
      const r = minR + (i / (numArcs - 1)) * (maxR - minR);
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, arcStart, curEndAngle);
      ctx.stroke();

      // Subtle degree annotation along left margin once arches have passed
      if (progress >= 0.80) {
        ctx.save();
        ctx.fillStyle = pal.gridColor || pal.ink;
        ctx.globalAlpha = Math.min(1.0, (progress - 0.80) / 0.20);
        ctx.font = 'italic 400 9px "EB Garamond", Garamond, serif';
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const labelX = margin + 8;
        const dy = r * r - (labelX - centerX) * (labelX - centerX);
        if (dy > 0) {
          const labelY = centerY - Math.sqrt(dy);
          if (labelY > margin + 12 && labelY < totalH - margin - 12) {
            ctx.fillText(degLabels[i], labelX, labelY);
          }
        }
        ctx.restore();
      }
    }
  }

  // Phase 2: Radiating Right Ascension Meridians cascade South-to-North, West-to-East (0.35 -> 0.85)
  const numMeridians = 13;
  const spanAngle = Math.PI * 0.62;
  const startAngle = -Math.PI / 2 - spanAngle / 2;

  const mPhase = Math.max(0.0, Math.min(1.0, (progress - 0.35) / 0.50));
  if (mPhase > 0) {
    for (let i = 0; i < numMeridians; i++) {
      const iStart = (i / numMeridians) * 0.65;
      const iDur = 0.35;
      if (mPhase <= iStart) continue;

      const iProg = Math.min(1.0, (mPhase - iStart) / iDur);
      const a = startAngle + (i / (numMeridians - 1)) * spanAngle;
      const x1 = centerX + Math.cos(a) * (minR * 0.95);
      const y1 = centerY + Math.sin(a) * (minR * 0.95);
      const x2 = centerX + Math.cos(a) * (maxR * 1.05);
      const y2 = centerY + Math.sin(a) * (maxR * 1.05);

      const curX2 = x1 + (x2 - x1) * iProg;
      const curY2 = y1 + (y2 - y1) * iProg;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(curX2, curY2);
      ctx.stroke();
    }
  }

  // Optional faint dashed constellation territorial boundaries (historical Delporte/Bode boundary style)
  if (voronoiCells && showVoronoi && progress >= 0.75) {
    ctx.strokeStyle = pal.gridColor || "rgba(20, 20, 20, 0.16)";
    ctx.lineWidth = 0.50;
    ctx.setLineDash([2, 5]);
    ctx.globalAlpha = Math.min(1.0, (progress - 0.75) / 0.25);

    for (const cell of voronoiCells) {
      const p = cell.polygon;
      if (!p || p.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      for (let k = 1; k < p.length; k++) {
        ctx.lineTo(p[k].x, p[k].y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Draws the double neatline framing border with astronomical degree ticks.
 */
function drawNeatlineBorder(ctx, totalW, totalH, margin, pal, progress = 1.0) {
  if (progress <= 0) return;

  ctx.save();
  const bx = margin;
  const by = margin;
  const bw = totalW - margin * 2;
  const bh = totalH - margin * 2;
  const band = 10.0; // Width of the degree-tick band

  // Clean paper margins
  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, 0, totalW, margin);
  ctx.fillRect(0, totalH - margin, totalW, margin);
  ctx.fillRect(0, 0, margin, totalH);
  ctx.fillRect(totalW - margin, 0, margin, totalH);

  ctx.strokeStyle = pal.ink;

  // 1. Outer main plate rule
  ctx.lineWidth = 2.2;
  ctx.strokeRect(bx, by, bw, bh);

  // 2. Inner neatline hairline
  ctx.lineWidth = 0.8;
  ctx.strokeRect(bx + band, by + band, bw - band * 2, bh - band * 2);

  // 3. Degree ticks in the margin band
  if (progress >= 0.3) {
    ctx.lineWidth = 0.65;
    ctx.beginPath();

    // Top and bottom border ticks
    const tickStepX = 14;
    for (let x = bx + band; x <= bx + bw - band; x += tickStepX) {
      const isMajor = Math.round((x - (bx + band)) / tickStepX) % 5 === 0;
      const tickH = isMajor ? band : band * 0.5;

      // Top ticks
      ctx.moveTo(x, by);
      ctx.lineTo(x, by + tickH);

      // Bottom ticks
      ctx.moveTo(x, by + bh);
      ctx.lineTo(x, by + bh - tickH);
    }

    // Left and right border ticks
    const tickStepY = 14;
    for (let y = by + band; y <= by + bh - band; y += tickStepY) {
      const isMajor = Math.round((y - (by + band)) / tickStepY) % 5 === 0;
      const tickW = isMajor ? band : band * 0.5;

      // Left ticks
      ctx.moveTo(bx, y);
      ctx.lineTo(bx + tickW, y);

      // Right ticks
      ctx.moveTo(bx + bw, y);
      ctx.lineTo(bx + bw - tickW, y);
    }
    ctx.stroke();
  }

  // 4. Corner fleurons / astronomical rosettes
  const corners = [
    { x: bx + band / 2, y: by + band / 2 },
    { x: bx + bw - band / 2, y: by + band / 2 },
    { x: bx + band / 2, y: by + bh - band / 2 },
    { x: bx + bw - band / 2, y: by + bh - band / 2 },
  ];

  ctx.fillStyle = pal.ink;
  for (const c of corners) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws the authentic 17th-century "Magnitudines Stellarum" (Magnitude Scale Table).
 */
function drawMagnitudeKeyCartouche(ctx, totalW, totalH, margin, pal, progress = 1.0, runFont = null) {
  if (progress <= 0) return;

  ctx.save();
  const boxW = 126;
  const boxH = 92;
  const boxX = totalW - margin - boxW - 16;
  const boxY = totalH - margin - boxH - 16;

  ctx.globalAlpha = Math.min(1.0, progress * 1.2);

  // 1. Paper backing
  ctx.fillStyle = pal.paper;
  ctx.fillRect(boxX, boxY, boxW, boxH);

  // 2. Double rule cartouche border
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(boxX, boxY, boxW, boxH);
  ctx.lineWidth = 0.6;
  ctx.strokeRect(boxX + 2.5, boxY + 2.5, boxW - 5, boxH - 5);

  // 3. Title: "Magnitudines"
  ctx.fillStyle = pal.ink;
  const titleCss = runFont ? runFont.css : '"Cinzel", "Times New Roman", serif';
  ctx.font = `italic 700 10.5px ${titleCss}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("MAGNITUDINES", boxX + boxW / 2, boxY + 14);

  // Underline flourish
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(boxX + 16, boxY + 22);
  ctx.lineTo(boxX + boxW - 16, boxY + 22);
  ctx.stroke();

  // 4. Render 1st to 6th Magnitude sample stars with labels
  const rowStartY = boxY + 34;
  const rowH = 18;

  for (let m = 1; m <= 6; m++) {
    const col = m <= 3 ? 0 : 1;
    const row = (m - 1) % 3;
    const sx = boxX + (col === 0 ? 20 : 76);
    const sy = rowStartY + row * rowH;

    const conf = STAR_MAGNITUDES[m];
    const sampleStar = {
      x: sx,
      y: sy,
      mag: m,
      points: conf.points,
      finalRadius: Math.min(6.5, conf.radius * 0.72),
      rot: -Math.PI / 2,
    };
    drawEngravedStar(ctx, sampleStar, pal, 1.0);

    // Label text
    ctx.font = `italic 500 9px ${titleCss}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${m}. Mag.`, sx + 10, sy);
  }

  ctx.restore();
}

const CELESTIAL_TITLES = [
  { main: "URANOGRAPHIA COELESTIS", sub: "Totum Sphaerae Stelliferae Ambitum Fideliter Exhibens" },
  { main: "HARMONIA MACROCOSMICA", sub: "Atlas Coelestis Novus Triplicis Mundi Theoria" },
  { main: "PLANISPHAERIUM STELLATUM", sub: "Asterismos Omnes ac Sidera Praecipua Delineata" },
  { main: "FIRMAMENTUM SOBIESKIANUM", sub: "Sive Uranographia Nova ac Siderum Fixarum Tabula" },
  { main: "ATLAS COELESTIS METROPOLITANUS", sub: "Secundum Exactissimas Observationes Astronomicas" },
  { main: "THEATRUM SYDERUM ERRANTIUM", sub: "In Quo Omnes Asterismi ad Amussim Depinguntur" },
  { main: "HEMISPHAERIUM BOREALE", sub: "Cum Stellis Fixis ac Confinibus Asterismis" },
  { main: "SYNOPSIS COELESTIS AMPLISSIMA", sub: "Ad Epocham Veram et Motus Stellarum Fixarum" },
  { main: "GLOBUS COELESTIS COMPARATUS", sub: "Continens Magnitudines et Situm Omnium Astrorum" },
  { main: "DESCRIPTIO COELI ET SIDERUM", sub: "Tabula Nova Omnium Constellationum Exacte Delineata" },
  { main: "URANOMETRIA OMNIUM ASTRORUM", sub: "Ex Typographia Academica et Observationibus Deducta" },
  { main: "SPECULUM URANIAE COELESTIS", sub: "Adiectis Singulorum Asterismorum Propriis Figuris" },
  { main: "MAGNUM THEATRUM COELESTE", sub: "Omnia Sidera et Lumina Coeli Fideliter Exhibens" },
  { main: "COELUM STELLATUM ET SPHAERICUM", sub: "Pro Verificandis Astrorum Motibus Accommodatum" },
];

const CELESTIAL_IMPRINTS = [
  "Norimbergae • Anno Salutis MDCLX",
  "Gedani • Sumptibus et Typis Autoris MDCLXXXVII",
  "Augustae Vindelicorum • Anno MDCXC",
  "Amstelodami • Apud Petrum Schenk MDCCVIII",
  "Londini • Typis Regiae Societatis MDCCXII",
  "Parisiis • E Typographia Regia MDCLXXIX",
  "Lugduni Batavorum • Ex Officina Elzeviriana MDCLIV",
  "Romae • Ex Typographia Apostolica MDCLXXV",
];

/**
 * Draws the celestial master banner with rich procedural 17th-century titles.
 */
function drawMasterHeaderCartouche(ctx, totalW, totalH, margin, pal, progress = 1.0, seed = 0, totalScreens = 1, runFont = null) {
  if (progress <= 0) return;

  ctx.save();
  const screenW = totalW / totalScreens;
  const bannerW = Math.min(410, screenW * 0.46);
  const bannerH = 46;
  let bx;
  if (totalScreens > 1) {
    // Centered on Screen 0 to avoid the physical monitor bezel
    bx = Math.round((screenW - bannerW) * 0.5);
  } else {
    bx = Math.round((totalW - bannerW) * 0.5);
  }
  const by = margin + 14;

  ctx.globalAlpha = Math.min(1.0, progress * 1.25);

  // Deterministically select title and imprint from chart seed
  const rng = createRNG(seed ^ 0x5a5a5a5a);
  const titleObj = pick(CELESTIAL_TITLES, rng);
  const imprint = pick(CELESTIAL_IMPRINTS, rng);

  // Paper backing
  ctx.fillStyle = pal.paper;
  ctx.fillRect(bx, by, bannerW, bannerH);

  // Double rule cartouche border with corner rosettes
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.3;
  ctx.strokeRect(bx, by, bannerW, bannerH);
  ctx.lineWidth = 0.55;
  ctx.strokeRect(bx + 2.5, by + 2.5, bannerW - 5, bannerH - 5);

  // Line 1: Primary Title in Roman Capitals
  ctx.fillStyle = pal.ink;
  const bannerCss = runFont ? runFont.css : '"Cinzel", "Times New Roman", serif';
  ctx.font = `600 11.5px ${bannerCss}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(titleObj.main, bx + bannerW / 2, by + 14);

  // Line 2: Latin Subtitle
  ctx.font = `italic 500 8.5px ${bannerCss}`;
  ctx.fillText(titleObj.sub, bx + bannerW / 2, by + 26);

  // Subtle divider rule
  ctx.beginPath();
  ctx.lineWidth = 0.4;
  ctx.moveTo(bx + bannerW * 0.28, by + 33);
  ctx.lineTo(bx + bannerW * 0.72, by + 33);
  ctx.stroke();

  // Line 3: Classical Imprint & Roman Numeral Epoch
  ctx.font = `italic 500 7.2px ${bannerCss}`;
  ctx.fillText(imprint, bx + bannerW / 2, by + 39);

  ctx.restore();
}

/**
 * Draws an authentic 17th-century copperplate Rosa Coelestis (Celestial Wind / Compass Rose).
 * Features 8 faceted intaglio rays with alternating cast shadows, an engraved fleur-de-lis pointing North (Septentrio),
 * astrolabe perimeter degree ticks, and Latin cardinal inscriptions.
 */
function drawCelestialCompassRose(ctx, cx, cy, R, pal, progress = 1.0, runFont = null) {
  if (progress <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1.0, progress * 1.25);

  const fontCss = runFont ? runFont.css : '"Cinzel", "Times New Roman", serif';

  // 1. Paper circular backing to mask out background grid lines and stars
  ctx.fillStyle = pal.paper;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 11, 0, Math.PI * 2);
  ctx.fill();

  // 2. Double outer concentric engraved rings
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 1.5, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Astrolabe perimeter ticks (32 celestial points around the band)
  const numTicks = 32;
  ctx.beginPath();
  ctx.lineWidth = 0.5;
  for (let i = 0; i < numTicks; i++) {
    const a = (i * Math.PI * 2) / numTicks;
    const isMajor = i % 4 === 0;
    const rIn = isMajor ? R - 0.5 : R + 1.8;
    const rOut = R + 5;
    ctx.moveTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn);
    ctx.lineTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut);
  }
  ctx.stroke();

  // 4. Faceted 8-Point Starburst (4 Cardinal Points + 4 Intercardinal Points)
  // Alternating black and white (ink and paper) facets for classic 3D cast-shadow engraving
  const innerR = R * 0.28;
  const minorTipR = R * 0.65;
  const majorTipR = R;

  for (let i = 0; i < 8; i++) {
    const tipAngle = -Math.PI / 2 + (i * Math.PI) / 4;
    const isMajor = i % 2 === 0;
    const tipR = isMajor ? majorTipR : minorTipR;

    const tipX = cx + Math.cos(tipAngle) * tipR;
    const tipY = cy + Math.sin(tipAngle) * tipR;

    const leftBaseAngle = tipAngle - Math.PI / 8;
    const rightBaseAngle = tipAngle + Math.PI / 8;

    const leftBaseX = cx + Math.cos(leftBaseAngle) * innerR;
    const leftBaseY = cy + Math.sin(leftBaseAngle) * innerR;

    const rightBaseX = cx + Math.cos(rightBaseAngle) * innerR;
    const rightBaseY = cy + Math.sin(rightBaseAngle) * innerR;

    // Left facet: shaded in solid ink
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(leftBaseX, leftBaseY);
    ctx.closePath();
    ctx.fillStyle = pal.ink;
    ctx.fill();
    ctx.stroke();

    // Right facet: light facet (paper wash with crisp ink hairline)
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(rightBaseX, rightBaseY);
    ctx.closePath();
    ctx.fillStyle = pal.paper;
    ctx.fill();
    ctx.stroke();
  }

  // 5. Hand-engraved Fleur-de-lis pointing North (Septentrio / Polus Arcticus)
  const fleurTipY = cy - majorTipR - 7.5;
  const fleurBaseY = cy - majorTipR + 1.5;
  ctx.fillStyle = pal.ink;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 0.7;

  // Central spear petal
  ctx.beginPath();
  ctx.moveTo(cx, fleurTipY);
  ctx.quadraticCurveTo(cx + 3, fleurTipY + 4, cx + 1, fleurBaseY);
  ctx.lineTo(cx - 1, fleurBaseY);
  ctx.quadraticCurveTo(cx - 3, fleurTipY + 4, cx, fleurTipY);
  ctx.fill();

  // Left curling scroll
  ctx.beginPath();
  ctx.moveTo(cx - 1, fleurBaseY);
  ctx.bezierCurveTo(cx - 5.5, fleurBaseY - 1.5, cx - 7, fleurTipY + 4, cx - 3.5, fleurTipY + 5);
  ctx.quadraticCurveTo(cx - 1.5, fleurTipY + 5, cx - 0.8, fleurBaseY);
  ctx.fill();

  // Right curling scroll
  ctx.beginPath();
  ctx.moveTo(cx + 1, fleurBaseY);
  ctx.bezierCurveTo(cx + 5.5, fleurBaseY - 1.5, cx + 7, fleurTipY + 4, cx + 3.5, fleurTipY + 5);
  ctx.quadraticCurveTo(cx + 1.5, fleurTipY + 5, cx + 0.8, fleurBaseY);
  ctx.fill();

  // Fleur horizontal collar
  ctx.beginPath();
  ctx.rect(cx - 4, fleurBaseY - 1, 8, 1.8);
  ctx.fill();

  // 6. Center Brass Pivot Rosette
  ctx.beginPath();
  ctx.arc(cx, cy, innerR * 0.85, 0, Math.PI * 2);
  ctx.fillStyle = pal.paper;
  ctx.fill();
  ctx.lineWidth = 0.9;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, innerR * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = pal.ink;
  ctx.fill();

  // 7. Latin Celestial Cardinal Inscriptions (SEPTENTRIO, MERIDIES, ORIENS, OCCIDENS)
  ctx.fillStyle = pal.ink;
  ctx.font = `600 7.8px ${fontCss}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // North (Septentrio) above fleur-de-lis
  ctx.fillText("SEPT.", cx, cy - R - 13);

  // South (Meridies)
  ctx.fillText("MERID.", cx, cy + R + 11);

  // East (Oriens)
  ctx.fillText("ORIENS", cx + R + 15, cy);

  // West (Occidens)
  ctx.fillText("OCCID.", cx - R - 15, cy);

  ctx.restore();
}

/**
 * Places the Rosa Coelestis in visual balance with chart elements.
 */
function drawCelestialCompassRoseOnChart(ctx, totalW, totalH, margin, pal, progress = 1.0, totalScreens = 1, runFont = null) {
  const R = 25;
  let cx, cy;
  if (totalScreens > 1) {
    const screenW = totalW / totalScreens;
    // On dual-screens: Screen 0 has title banner at top center.
    // Screen 1 has the Rosa Coelestis placed inside the neatline with generous top margin
    cx = Math.round(screenW + screenW * 0.5);
    cy = margin + 56;
  } else {
    // Single-screen: Placed inside bottom-left corner with generous clearance from border rules
    cx = margin + 82;
    cy = totalH - margin - 72;
  }
  drawCelestialCompassRose(ctx, cx, cy, R, pal, progress, runFont);
}

if (typeof globalThis !== "undefined") {
  globalThis.drawCelestialGrid = drawCelestialGrid;
  globalThis.drawNeatlineBorder = drawNeatlineBorder;
  globalThis.drawMagnitudeKeyCartouche = drawMagnitudeKeyCartouche;
  globalThis.drawMasterHeaderCartouche = drawMasterHeaderCartouche;
  globalThis.drawCelestialCompassRose = drawCelestialCompassRose;
  globalThis.drawCelestialCompassRoseOnChart = drawCelestialCompassRoseOnChart;
}
