// Procedural Renaissance Nautical Compass Rose (Rosa Ventorum)
// Emulates 16th/17th Century copperplate engraved sea compass roses (Blaeu, Ortelius, Speed).
// Features:
// 1. Faceted 8-point / 16-point starburst with alternating ink and paper facets for 3D cast-shadow engraving.
// 2. 32-point astrolabe / wind perimeter ticks within double concentric engraved rings.
// 3. Hand-engraved Fleur-de-lis pointing North (Septentrio / Polus Arcticus).
// 4. Classical Latin cardinal inscriptions (SEPTENTRIO, MERIDIES, ORIENS, OCCIDENS).
// 5. Intelligent placement: finds open ocean water or corner margin clear of neatlines, coasts, and cartouches.

class CompassRoseEngine {
  constructor(totalW, totalH, seed = Math.floor(Math.random() * 1000000)) {
    this.totalW = totalW;
    this.totalH = totalH;
    this.seed = seed;
    this.rng = createRNG(seed);
    this.pos = null; // { cx, cy, r }
    this.visible = this.rng() < 0.58; // ~58% chance procedural variety per map
  }

  /**
   * Find an optimal, visually balanced location for the compass rose.
   * Prioritizes open ocean water in an opposite quadrant/area from the cartouche plaque,
   * avoiding coastline overlap, monitor bezels, and the outer neatline.
   */
  layout(coastEngine, cartoucheEngine, totalScreens = 1) {
    const { totalW, totalH, rng } = this;
    const neatlinePad = 28;
    const margin = 24;
    const radius = Math.max(34, Math.min(52, Math.round(totalH * 0.055)));
    const clearRadius = radius + 22; // Clearance buffer from obstacles
    const screenW = totalW / totalScreens;

    const cartoucheBox = cartoucheEngine ? cartoucheEngine.box : null;

    // Helper: test if candidate position (cx, cy) is valid and obstacle-free
    const isCandidateValid = (cx, cy) => {
      // 1. Neatline boundary clearance
      if (
        cx - clearRadius < neatlinePad + margin ||
        cx + clearRadius > totalW - neatlinePad - margin ||
        cy - clearRadius < neatlinePad + margin ||
        cy + clearRadius > totalH - neatlinePad - margin
      ) {
        return false;
      }

      // 2. Multi-screen bezel clearance
      if (totalScreens > 1) {
        for (let s = 1; s < totalScreens; s++) {
          const bezelX = s * screenW;
          if (Math.abs(cx - bezelX) < clearRadius + 18) {
            return false;
          }
        }
      }

      // 3. Cartouche avoidance (must not overlap title plaque)
      if (cartoucheBox) {
        const cLeft = cartoucheBox.x - 30;
        const cRight = cartoucheBox.x + cartoucheBox.w + 30;
        const cTop = cartoucheBox.y - 30;
        const cBottom = cartoucheBox.y + cartoucheBox.h + 30;
        if (
          cx + clearRadius > cLeft &&
          cx - clearRadius < cRight &&
          cy + clearRadius > cTop &&
          cy - clearRadius < cBottom
        ) {
          return false;
        }
      }

      // 4. Must be completely floating in open water (or open plains if inland)
      if (coastEngine) {
        // Sample radial perimeter to guarantee no coastline clipping
        const numChecks = 16;
        for (let i = 0; i < numChecks; i++) {
          const a = (i * Math.PI * 2) / numChecks;
          const px = cx + Math.cos(a) * (radius + 8);
          const py = cy + Math.sin(a) * (radius + 8);
          if (!coastEngine.isOcean({ x: px, y: py }, 6)) {
            return false;
          }
        }
      }

      return true;
    };

    // Candidate positions based on coast style and quadrants
    const candidates = [];
    const style = coastEngine ? coastEngine.coastStyle : "west-ocean";

    if (style === "west-ocean") {
      // Ocean on the left: candidate spots in upper-left or lower-left
      candidates.push({ x: neatlinePad + margin + radius + 15, y: neatlinePad + margin + radius + 15 });
      candidates.push({ x: neatlinePad + margin + radius + 15, y: totalH - neatlinePad - margin - radius - 15 });
      candidates.push({ x: neatlinePad + margin + radius + 25, y: totalH * 0.5 });
    } else if (style === "east-ocean") {
      // Ocean on the right
      candidates.push({ x: totalW - neatlinePad - margin - radius - 15, y: neatlinePad + margin + radius + 15 });
      candidates.push({ x: totalW - neatlinePad - margin - radius - 15, y: totalH - neatlinePad - margin - radius - 15 });
      candidates.push({ x: totalW - neatlinePad - margin - radius - 25, y: totalH * 0.5 });
    } else if (style === "south-ocean") {
      // Ocean across the bottom
      candidates.push({ x: neatlinePad + margin + radius + 20, y: totalH - neatlinePad - margin - radius - 15 });
      candidates.push({ x: totalW - neatlinePad - margin - radius - 20, y: totalH - neatlinePad - margin - radius - 15 });
      if (totalScreens > 1) {
        candidates.push({ x: screenW * 0.5, y: totalH - neatlinePad - margin - radius - 15 });
        candidates.push({ x: screenW + screenW * 0.5, y: totalH - neatlinePad - margin - radius - 15 });
      }
    } else if (style === "north-ocean") {
      // Ocean across the top
      candidates.push({ x: neatlinePad + margin + radius + 20, y: neatlinePad + margin + radius + 15 });
      candidates.push({ x: totalW - neatlinePad - margin - radius - 20, y: neatlinePad + margin + radius + 15 });
      if (totalScreens > 1) {
        candidates.push({ x: screenW * 0.5, y: neatlinePad + margin + radius + 15 });
        candidates.push({ x: screenW + screenW * 0.5, y: neatlinePad + margin + radius + 15 });
      }
    }

    // Filter valid sea candidates
    let valid = candidates.filter((c) => isCandidateValid(c.x, c.y));

    // Prefer candidate farthest from cartouche for visual diagonal balance
    if (valid.length > 0) {
      if (cartoucheBox) {
        const cartX = cartoucheBox.x + cartoucheBox.w * 0.5;
        const cartY = cartoucheBox.y + cartoucheBox.h * 0.5;
        valid.sort((a, b) => {
          const distA = Math.hypot(a.x - cartX, a.y - cartY);
          const distB = Math.hypot(b.x - cartX, b.y - cartY);
          return distB - distA;
        });
      }
      this.pos = { cx: Math.round(valid[0].x), cy: Math.round(valid[0].y), r: radius };
      return this.pos;
    }

    // Fallback: four corners of the map
    const corners = [
      { x: neatlinePad + margin + radius + 15, y: neatlinePad + margin + radius + 15 },
      { x: totalW - neatlinePad - margin - radius - 15, y: neatlinePad + margin + radius + 15 },
      { x: neatlinePad + margin + radius + 15, y: totalH - neatlinePad - margin - radius - 15 },
      { x: totalW - neatlinePad - margin - radius - 15, y: totalH - neatlinePad - margin - radius - 15 },
    ];

    let bestCorner = null;
    let bestDist = -1;
    if (cartoucheBox) {
      const cartX = cartoucheBox.x + cartoucheBox.w * 0.5;
      const cartY = cartoucheBox.y + cartoucheBox.h * 0.5;
      for (let c of corners) {
        const d = Math.hypot(c.x - cartX, c.y - cartY);
        if (d > bestDist) {
          bestDist = d;
          bestCorner = c;
        }
      }
    } else {
      bestCorner = corners[0];
    }

    this.pos = { cx: Math.round(bestCorner.x), cy: Math.round(bestCorner.y), r: radius };
    return this.pos;
  }

  /**
   * Render the engraved copperplate compass rose.
   */
  draw(ctx, palette, progress = 1.0) {
    if (!this.pos || progress <= 0.1) return;

    const { cx, cy, r: R } = this.pos;
    const animProgress = Math.min(1.0, (progress - 0.1) / 0.9);

    ctx.save();
    ctx.globalAlpha = Math.min(1.0, animProgress * 1.25);

    // 1. Opaque parchment backing (masks underlying waterlines and sea wash)
    ctx.fillStyle = palette.paper;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 12, 0, Math.PI * 2);
    ctx.fill();

    // 2. Double outer concentric engraved rings
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 1.8, 0, Math.PI * 2);
    ctx.stroke();

    // 3. 32-point nautical perimeter wind ticks
    const numTicks = 32;
    ctx.beginPath();
    ctx.lineWidth = 0.55;
    for (let i = 0; i < numTicks; i++) {
      const a = (i * Math.PI * 2) / numTicks;
      const isMajor = i % 4 === 0;
      const isMinor = i % 2 === 0;
      const rIn = isMajor ? R - 1.0 : isMinor ? R + 1.0 : R + 2.5;
      const rOut = R + 6;
      ctx.moveTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn);
      ctx.lineTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut);
    }
    ctx.stroke();

    // 4. Faceted 16-point Starburst (4 Cardinal + 4 Intercardinal + 8 Secondary Points)
    // Major cardinal points reach R; intercardinal reach 0.70 R; secondary reach 0.45 R.
    const innerR = R * 0.28;
    const majorTipR = R;
    const interTipR = R * 0.70;
    const minorTipR = R * 0.46;

    // Draw secondary 8 points first (in background)
    for (let i = 0; i < 8; i++) {
      const tipAngle = -Math.PI / 2 + Math.PI / 8 + (i * Math.PI) / 4;
      const tipX = cx + Math.cos(tipAngle) * minorTipR;
      const tipY = cy + Math.sin(tipAngle) * minorTipR;

      const leftAngle = tipAngle - Math.PI / 16;
      const rightAngle = tipAngle + Math.PI / 16;

      const lx = cx + Math.cos(leftAngle) * (innerR * 0.75);
      const ly = cy + Math.sin(leftAngle) * (innerR * 0.75);
      const rx = cx + Math.cos(rightAngle) * (innerR * 0.75);
      const ry = cy + Math.sin(rightAngle) * (innerR * 0.75);

      // Left facet shaded
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(lx, ly);
      ctx.closePath();
      ctx.fillStyle = palette.ink;
      ctx.fill();
      ctx.stroke();

      // Right facet light
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(rx, ry);
      ctx.closePath();
      ctx.fillStyle = palette.paper;
      ctx.fill();
      ctx.stroke();
    }

    // Draw 8 Primary Points (alternating ink and paper facets for 3D cast-shadow engraving)
    for (let i = 0; i < 8; i++) {
      const tipAngle = -Math.PI / 2 + (i * Math.PI) / 4;
      const isMajor = i % 2 === 0;
      const tipR = isMajor ? majorTipR : interTipR;

      const tipX = cx + Math.cos(tipAngle) * tipR;
      const tipY = cy + Math.sin(tipAngle) * tipR;

      const leftAngle = tipAngle - Math.PI / 8;
      const rightAngle = tipAngle + Math.PI / 8;

      const lx = cx + Math.cos(leftAngle) * innerR;
      const ly = cy + Math.sin(leftAngle) * innerR;
      const rx = cx + Math.cos(rightAngle) * innerR;
      const ry = cy + Math.sin(rightAngle) * innerR;

      // Left facet: shaded in solid ink
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(lx, ly);
      ctx.closePath();
      ctx.fillStyle = palette.ink;
      ctx.fill();
      ctx.lineWidth = 0.7;
      ctx.stroke();

      // Right facet: light facet (paper wash with crisp hairline)
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(rx, ry);
      ctx.closePath();
      ctx.fillStyle = palette.paper;
      ctx.fill();
      ctx.stroke();
    }

    // 5. Hand-engraved Fleur-de-lis pointing North (Septentrio)
    const fleurTipY = cy - majorTipR - 9.0;
    const fleurBaseY = cy - majorTipR + 1.5;
    ctx.fillStyle = palette.ink;
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 0.7;

    // Central spear petal
    ctx.beginPath();
    ctx.moveTo(cx, fleurTipY);
    ctx.quadraticCurveTo(cx + 3.5, fleurTipY + 4.5, cx + 1.2, fleurBaseY);
    ctx.lineTo(cx - 1.2, fleurBaseY);
    ctx.quadraticCurveTo(cx - 3.5, fleurTipY + 4.5, cx, fleurTipY);
    ctx.fill();

    // Left curling scroll
    ctx.beginPath();
    ctx.moveTo(cx - 1, fleurBaseY);
    ctx.bezierCurveTo(cx - 6.5, fleurBaseY - 1.5, cx - 8, fleurTipY + 4.5, cx - 4, fleurTipY + 5.5);
    ctx.quadraticCurveTo(cx - 1.5, fleurTipY + 5.5, cx - 0.8, fleurBaseY);
    ctx.fill();

    // Right curling scroll
    ctx.beginPath();
    ctx.moveTo(cx + 1, fleurBaseY);
    ctx.bezierCurveTo(cx + 6.5, fleurBaseY - 1.5, cx + 8, fleurTipY + 4.5, cx + 4, fleurTipY + 5.5);
    ctx.quadraticCurveTo(cx + 1.5, fleurTipY + 5.5, cx + 0.8, fleurBaseY);
    ctx.fill();

    // Fleur horizontal collar
    ctx.beginPath();
    ctx.rect(cx - 4.5, fleurBaseY - 1.2, 9, 2.0);
    ctx.fill();

    // 6. Center Brass Pivot Rosette
    ctx.beginPath();
    ctx.arc(cx, cy, innerR * 0.88, 0, Math.PI * 2);
    ctx.fillStyle = palette.paper;
    ctx.fill();
    ctx.lineWidth = 0.95;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, innerR * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = palette.ink;
    ctx.fill();

    // 7. Classical Latin Cardinal Wind Inscriptions
    ctx.fillStyle = palette.ink;
    ctx.font = '600 8.5px "Cinzel", "Times New Roman", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // North (Septentrio) above fleur-de-lis
    ctx.fillText("SEPTENTRIO", cx, cy - R - 15);

    // South (Meridies)
    ctx.fillText("MERIDIES", cx, cy + R + 13);

    // East (Oriens)
    ctx.fillText("ORIENS", cx + R + 18, cy);

    // West (Occidens)
    ctx.fillText("OCCIDENS", cx - R - 18, cy);

    ctx.restore();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CompassRoseEngine };
}
