// Procedural Renaissance & Baroque Sea Monster Engine (Monstra Marina / Hic Sunt Dracones)
// Inspired by 16th/17th Century antique cartographic engraving (Olaus Magnus, Ortelius, Münster, Blaeu).
// Features:
// 1. Serpens Marinus Draconicus (Baroque Coiling Sea Dragon): toothy draconic skull, frilled crest,
//    undulating barbels, acanthus finlets, cross-hatched scales, and spiraling volute tail.
// 2. Cetus Monstruosus (Baroque Spouting Leviathan): menacing gaping jaw with fangs and tusks,
//    heavy furrowed brow, twin spiraling baroque water plumes, acanthus pectoral fins, and ornate scroll flukes.
// 3. Deep-ocean placement avoiding coasts, cartouche, compass rose, and monitor bezels.
// 4. Opaque parchment masking to occlude underlying waterlines cleanly.

class SeaMonsterEngine {
  constructor(totalW, totalH, seed = Math.floor(Math.random() * 1000000)) {
    this.totalW = totalW;
    this.totalH = totalH;
    this.seed = seed;
    this.rng = createRNG(seed);
    this.monsters = [];
    this.visible = this.rng() < 0.68; // ~68% natural spawn rate
  }

  /**
   * Layout sea monsters in verified deep ocean basins,
   * avoiding coasts, river mouths, cartouche, compass rose, and monitor bezels.
   */
  layout(coastEngine, cartoucheEngine, compassEngine, totalScreens = 1) {
    this.monsters = [];
    if (!coastEngine || !coastEngine.coasts || coastEngine.coasts.length === 0) return;

    const { totalW, totalH, rng } = this;
    const neatlinePad = 28;
    const margin = 28;
    const screenW = totalW / totalScreens;

    const cartoucheBox = cartoucheEngine ? cartoucheEngine.box : null;
    const compassPos = compassEngine ? compassEngine.pos : null;

    const isClearOfObstacles = (cx, cy, radius = 75) => {
      // 1. Neatline boundary
      if (
        cx - radius < neatlinePad + margin ||
        cx + radius > totalW - neatlinePad - margin ||
        cy - radius < neatlinePad + margin ||
        cy + radius > totalH - neatlinePad - margin
      ) {
        return false;
      }

      // 2. Monitor bezels
      if (totalScreens > 1) {
        for (let s = 1; s < totalScreens; s++) {
          const bx = s * screenW;
          if (Math.abs(cx - bx) < radius + 22) return false;
        }
      }

      // 3. Cartouche avoidance
      if (cartoucheBox) {
        const cLeft = cartoucheBox.x - radius - 22;
        const cRight = cartoucheBox.x + cartoucheBox.w + radius + 22;
        const cTop = cartoucheBox.y - radius - 22;
        const cBottom = cartoucheBox.y + cartoucheBox.h + radius + 22;
        if (cx > cLeft && cx < cRight && cy > cTop && cy < cBottom) return false;
      }

      // 4. Compass rose avoidance
      if (compassPos) {
        const d = Math.hypot(cx - compassPos.cx, cy - compassPos.cy);
        if (d < compassPos.r + radius + 28) return false;
      }

      // 5. Must be deep ocean (all perimeter points at least 65px clear of coast)
      const numChecks = 12;
      for (let i = 0; i < numChecks; i++) {
        const a = (i * Math.PI * 2) / numChecks;
        const px = cx + Math.cos(a) * (radius * 0.85);
        const py = cy + Math.sin(a) * (radius * 0.85);
        if (!coastEngine.isOcean({ x: px, y: py }, 25)) return false;
      }

      return true;
    };

    // Candidate search across grid points in ocean
    const candidates = [];
    const stepX = Math.round(totalW / 24);
    const stepY = Math.round(totalH / 16);

    for (let x = neatlinePad + 50; x < totalW - neatlinePad - 50; x += stepX) {
      for (let y = neatlinePad + 50; y < totalH - neatlinePad - 50; y += stepY) {
        if (coastEngine.isOcean({ x, y }, 70)) {
          if (isClearOfObstacles(x, y, 75)) {
            const nearestC = coastEngine.getNearestCoastPoint(x, y);
            const clearance = nearestC ? Math.hypot(nearestC.x - x, nearestC.y - y) : 120;
            candidates.push({ x, y, clearance });
          }
        }
      }
    }

    if (candidates.length === 0) return;

    // Sort by deepest ocean clearance
    candidates.sort((a, b) => b.clearance - a.clearance);

    // Number of monsters: 1 on single screen, up to 2 on multi-screen if ample deep water exists
    const maxMonsters = totalScreens > 1 && candidates.length > 8 ? 2 : 1;

    for (let i = 0; i < candidates.length && this.monsters.length < maxMonsters; i++) {
      const cand = candidates[i];
      let tooClose = false;
      for (let m of this.monsters) {
        if (Math.hypot(m.x - cand.x, m.y - cand.y) < 190) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const monsterSeed = this.seed + this.monsters.length * 31337;
      const mRng = createRNG(monsterSeed);

      // Facing direction: face toward center of the landmass / screen
      const dir = cand.x < totalW * 0.5 ? 1 : -1;
      const type = mRng() < 0.52 ? "serpent" : "leviathan";
      const scale = 0.90 + mRng() * 0.35;

      this.monsters.push({
        x: cand.x,
        y: cand.y,
        type,
        dir,
        scale,
        seed: monsterSeed,
      });
    }
  }

  /**
   * Draw the sea monsters onto the offscreen canvas.
   */
  draw(ctx, palette, progress = 1.0) {
    if (!this.visible || this.monsters.length === 0 || progress < 0.15) return;

    const animProgress = Math.min(1.0, (progress - 0.15) / 0.85);

    for (let m of this.monsters) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.scale(m.dir * m.scale, m.scale);
      ctx.globalAlpha = Math.min(1.0, animProgress * 1.3);

      if (m.type === "serpent") {
        this.drawBaroqueSeaSerpent(ctx, palette, animProgress, m.seed);
      } else {
        this.drawBaroqueLeviathan(ctx, palette, animProgress, m.seed);
      }

      ctx.restore();
    }
  }

  /**
   * 1. Serpens Marinus (16th-Century Engraved Sea Serpent)
   * Directly modeled after classical copperplate & woodcut cartography:
   * - Massive arched neck rearing from water with spiky collar ruff, dragon skull, fangs & horn
   * - Single mid-body inverted U-arch topped with an erect fan-shaped webbed dorsal fin
   * - Sinuous tapered tail terminating in an ornamental barbed arrowhead fluke
   * - Dense engraved overlapping scallop fish-scales and transverse belly banding
   * - 3-4 layered sinusoidal engraved wave lines with fine broken dashes at waterline
  /**
   * 1. Serpens Marinus (16th-Century Engraved Sea Serpent)
   * Directly modeled after classical copperplate & woodcut cartography:
   * - Full-length elongated dragon skull with swept horns, toothy beak, fangs & forked tongue
   * - Generously spread three-part anatomy: sinuous tail on left, mid-body arch with fan fin, wide open air gap, and towering rearing neck
   * - Dense engraved overlapping scallop fish-scales and transverse belly banding
   * - 3-4 layered sinusoidal engraved wave lines with fine broken dashes at waterline
   */
  drawBaroqueSeaSerpent(ctx, palette, progress, seed) {
    const sRng = createRNG(seed);
    const ink = palette.ink;
    const paper = palette.paper;

    ctx.save();
    ctx.globalAlpha = Math.min(1.0, progress * 1.3);

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Element B: MID-BODY INVERTED U-ARCH ("THE HUMP") - Centered at x = 0
    // Thick 17px body tube with 18px thick crest:
    // Left leg at x = -24..-7, right leg at x = 7..24, crest at x = 0, y = -44
    // ──────────────────────────────────────────────────────────────────────────
    const mx1 = -24, mx2 = -7; // Left leg (17px wide tube)
    const mx3 = 7, mx4 = 24;   // Right leg (17px wide tube)
    const mCrestX = 0;

    // (a) Opaque paper base mask (extends slightly below y=0 for seamless wave junction)
    ctx.fillStyle = paper;
    ctx.beginPath();
    ctx.moveTo(mx1, 2);
    // Outer arch curve
    ctx.bezierCurveTo(mx1, -28, mCrestX - 11, -44, mCrestX, -44);
    ctx.bezierCurveTo(mCrestX + 11, -44, mx4, -28, mx4, 2);
    ctx.lineTo(mx3, 2);
    // Inner arch curve (18px thick tube across entire arch)
    ctx.bezierCurveTo(mx3, -20, mCrestX + 6, -26, mCrestX, -26);
    ctx.bezierCurveTo(mCrestX - 6, -26, mx2, -20, mx2, 2);
    ctx.closePath();
    ctx.fill();

    // (b) Transverse Belly Bands & Shadow Hatching across inner curve
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.55;
    ctx.globalAlpha = 0.40;
    ctx.beginPath();
    for (let y = 2; y >= -42; y -= 2.6) {
      ctx.moveTo(-30, y);
      ctx.lineTo(30, y + 6);
    }
    ctx.stroke();
    ctx.restore();

    // (c) Engraved Scallop Scales (overlapping U-shapes across both legs of the arch)
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.50;
    ctx.globalAlpha = 0.65;
    const archScaleRows = [
      { y: -38, xs: [-8, 0, 8] },
      { y: -32, xs: [-15, -9, 0, 9, 15] },
      { y: -24, xs: [-19, -13, 13, 19] },
      { y: -16, xs: [-20, -14, 14, 20] },
      { y: -8,  xs: [-20, -14, 14, 20] },
      { y: -1,  xs: [-20, -14, 14, 20] },
    ];
    for (let row of archScaleRows) {
      for (let sx of row.xs) {
        ctx.beginPath();
        ctx.arc(sx, row.y, 2.3, 0, Math.PI);
        ctx.stroke();
      }
    }
    ctx.restore();

    // (d) Arch Ink Outlines
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.30;
    ctx.beginPath();
    ctx.moveTo(mx1, 2);
    ctx.bezierCurveTo(mx1, -28, mCrestX - 11, -44, mCrestX, -44);
    ctx.bezierCurveTo(mCrestX + 11, -44, mx4, -28, mx4, 2);
    ctx.stroke();

    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(mx2, 2);
    ctx.bezierCurveTo(mx2, -20, mCrestX - 6, -26, mCrestX, -26);
    ctx.bezierCurveTo(mCrestX + 6, -26, mx3, -20, mx3, 2);
    ctx.stroke();

    // (e) Erect Fan-Shaped Webbed Dorsal Fin atop the Arch Crest
    const fx = mCrestX;
    const fy = -44;
    ctx.fillStyle = paper;
    ctx.lineWidth = 0.75;

    // Webbed fan fin rays: 4 curved rays spreading upward
    const rays = [
      { bx: fx - 10, by: fy + 2, tx: fx - 16, ty: fy - 18 },
      { bx: fx - 4,  by: fy + 1, tx: fx - 7,  ty: fy - 22 },
      { bx: fx + 3,  by: fy + 1, tx: fx + 4,  ty: fy - 22 },
      { bx: fx + 8,  by: fy + 2, tx: fx + 14, ty: fy - 18 },
    ];

    ctx.beginPath();
    ctx.moveTo(rays[0].bx, rays[0].by);
    ctx.lineTo(rays[0].tx, rays[0].ty);
    for (let r = 0; r < rays.length - 1; r++) {
      const cur = rays[r];
      const next = rays[r + 1];
      const midX = (cur.tx + next.tx) * 0.5;
      const midY = Math.max(cur.ty, next.ty) + 2.5;
      ctx.quadraticCurveTo(midX, midY, next.tx, next.ty);
    }
    ctx.lineTo(rays[rays.length - 1].bx, rays[rays.length - 1].by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = 0.55;
    for (let r of rays) {
      ctx.beginPath();
      ctx.moveTo(r.bx, r.by);
      ctx.lineTo(r.tx, r.ty);
      ctx.stroke();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Element C: THE SINUOUS TAIL (Left)
    // Sits at distance of 18px from mid-arch (arch left edge = -24 -> tail right = -42)
    // 16px wide base: emerges at x = -58..-42, curves up to barbed fluke at (-40, -58)
    // ──────────────────────────────────────────────────────────────────────────
    const tx1 = -58, tx2 = -42;

    // (a) Tail paper mask
    ctx.fillStyle = paper;
    ctx.beginPath();
    ctx.moveTo(tx1, 2);
    ctx.quadraticCurveTo(-66, -20, -62, -38);
    ctx.bezierCurveTo(-58, -48, -48, -50, -44, -44);
    ctx.lineTo(-46, -40);
    ctx.bezierCurveTo(-50, -42, -54, -38, -52, -28);
    ctx.quadraticCurveTo(-50, -18, tx2, 2);
    ctx.closePath();
    ctx.fill();

    // (b) Transverse tail segment banding
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.45;
    ctx.globalAlpha = 0.65;
    for (let y = 2; y >= -46; y -= 2.8) {
      ctx.beginPath();
      ctx.moveTo(-70, y);
      ctx.lineTo(-38, y + 2);
      ctx.stroke();
    }
    ctx.restore();

    // (c) Tail ink outlines
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(tx1, 2);
    ctx.quadraticCurveTo(-66, -20, -62, -38);
    ctx.bezierCurveTo(-58, -48, -48, -50, -44, -44);
    ctx.stroke();

    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(tx2, 2);
    ctx.quadraticCurveTo(-50, -18, -52, -28);
    ctx.bezierCurveTo(-54, -38, -50, -42, -46, -40);
    ctx.stroke();

    // (d) Dorsal spine finlets along outer curve of tail
    ctx.lineWidth = 0.55;
    const tailSpines = [
      { x: -65, y: -14, dx: -3.5, dy: -2 },
      { x: -65, y: -24, dx: -4,   dy: -2.5 },
      { x: -62, y: -34, dx: -3.5, dy: -3 },
      { x: -56, y: -42, dx: -2.5, dy: -4 },
    ];
    for (let sp of tailSpines) {
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sp.x + sp.dx, sp.y + sp.dy);
      ctx.lineTo(sp.x + 1, sp.y - 3);
      ctx.stroke();
    }

    // (e) Barbed Arrowhead / Spearhead Fluke Tip (at x = -44, y = -44)
    ctx.fillStyle = paper;
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    ctx.moveTo(-46, -42);
    ctx.lineTo(-38, -58); // Long spear tip
    ctx.lineTo(-48, -50); // Left barb
    ctx.lineTo(-44, -49);
    ctx.lineTo(-41, -52); // Center ridge
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(-46, -42);
    ctx.lineTo(-38, -58);
    ctx.stroke();

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Element A: THE MASSIVE ARCHED NECK & FULL-SIZED DRAGON HEAD (Right)
    // Sits at distance of 18px from mid-arch to snout beak (arch right = 24 -> beak = 42)
    // Matched rhythm: Middle Arch <--- 18px ---> Snout & Tongue (identical to tail distance)
    // Neck base at x = 78..100 (22px wide, thick and powerful)
    // ──────────────────────────────────────────────────────────────────────────
    const nx1 = 78, nx2 = 100;

    // (a) Opaque paper base mask for arched neck & full-sized dragon head
    ctx.fillStyle = paper;
    ctx.beginPath();
    ctx.moveTo(nx2, 2);
    // Outer back curve arching high and proud
    ctx.quadraticCurveTo(106, -34, 100, -52);
    ctx.bezierCurveTo(94, -66, 78, -66, 68, -56); // Over cranium
    // Long draconic snout extending forward and downward toward mid-arch
    ctx.quadraticCurveTo(56, -46, 42, -32); // Upper bridge of long snout
    ctx.lineTo(39, -31);                   // Hooked beak tip
    // Mouth gape & elongated lower jaw
    ctx.lineTo(48, -26);                   // Deep mouth interior
    ctx.lineTo(44, -21);                   // Lower jaw tip
    ctx.lineTo(60, -20);                   // Lower jaw line
    // Throat & inner neck curve
    ctx.quadraticCurveTo(70, -24, 76, -32);
    ctx.quadraticCurveTo(80, -18, nx1, 2);
    ctx.closePath();
    ctx.fill();

    // (b) Transverse Belly Bands on inner neck curve
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.55;
    ctx.globalAlpha = 0.40;
    ctx.beginPath();
    for (let y = 2; y >= -42; y -= 2.6) {
      ctx.moveTo(68, y);
      ctx.lineTo(92, y + 4);
    }
    ctx.stroke();
    ctx.restore();

    // (c) Dense Engraved Scallop Scales down the neck column
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.50;
    ctx.globalAlpha = 0.70;
    const neckScaleRows = [
      { y: -56, xs: [76, 82, 88, 94] },
      { y: -48, xs: [78, 84, 90, 96] },
      { y: -40, xs: [80, 86, 92, 98] },
      { y: -32, xs: [82, 88, 94, 100] },
      { y: -24, xs: [82, 88, 94, 100] },
      { y: -16, xs: [82, 88, 94, 100] },
      { y: -8,  xs: [82, 88, 94, 100] },
    ];
    for (let row of neckScaleRows) {
      for (let sx of row.xs) {
        ctx.beginPath();
        ctx.arc(sx, row.y, 2.3, 0, Math.PI);
        ctx.stroke();
      }
    }
    ctx.restore();

    // (d) Neck Outlines
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(nx2, 2);
    ctx.quadraticCurveTo(106, -34, 100, -52);
    ctx.bezierCurveTo(94, -66, 78, -66, 68, -56);
    ctx.stroke();

    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(nx1, 2);
    ctx.quadraticCurveTo(80, -18, 76, -32);
    ctx.quadraticCurveTo(70, -24, 60, -20);
    ctx.stroke();

    // (e) Spiky Neck Ruff / Mane (5 sharp triangular tufts along back curve)
    ctx.fillStyle = paper;
    ctx.lineWidth = 0.75;
    const neckManes = [
      { x: 104, y: -34, dx: 8, dy: -6 },
      { x: 102, y: -46, dx: 8, dy: -7 },
      { x: 94,  y: -58, dx: 6, dy: -8 },
      { x: 84,  y: -65, dx: 4, dy: -9 },
      { x: 74,  y: -63, dx: 2, dy: -8 },
    ];
    for (let m of neckManes) {
      ctx.beginPath();
      ctx.moveTo(m.x - 3, m.y + 2);
      ctx.lineTo(m.x + m.dx, m.y + m.dy);
      ctx.lineTo(m.x + 3, m.y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // (f) Full-Sized Dragon Head Engraving Details
    // Long swept backward horn
    ctx.fillStyle = paper;
    ctx.lineWidth = 0.90;
    ctx.beginPath();
    ctx.moveTo(68, -58);
    ctx.quadraticCurveTo(78, -70, 86, -68); // Long swept horn
    ctx.lineTo(74, -54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Long upper snout with hooked predatory beak
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(68, -56);
    ctx.quadraticCurveTo(56, -46, 42, -32); // Long snout bridge
    ctx.lineTo(39, -31);                   // Hooked tip
    ctx.lineTo(48, -26);                   // Mouth interior
    ctx.stroke();

    // Full-length dropped lower jaw
    ctx.beginPath();
    ctx.moveTo(44, -21);
    ctx.lineTo(60, -20);
    ctx.stroke();

    // Rows of sharp triangular fangs
    ctx.lineWidth = 0.60;
    ctx.beginPath();
    // Upper jaw fangs
    ctx.moveTo(41, -31);
    ctx.lineTo(42, -27);
    ctx.lineTo(44, -29);
    ctx.lineTo(45, -26);
    ctx.lineTo(47, -28);
    ctx.lineTo(48, -25);
    // Lower jaw teeth
    ctx.moveTo(45, -21);
    ctx.lineTo(46, -24);
    ctx.lineTo(48, -22);
    ctx.lineTo(49, -25);
    ctx.lineTo(51, -22);
    ctx.stroke();

    // Cold Piercing Eye under heavy brow ridge
    ctx.lineWidth = 0.70;
    ctx.beginPath();
    ctx.moveTo(64, -50);
    ctx.quadraticCurveTo(60, -53, 56, -48); // Brow
    ctx.stroke();

    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(59, -47, 1.6, 0, Math.PI * 2); // Eye dot
    ctx.fill();

    // Long forked tongue darting out into water gap toward mid-arch
    ctx.lineWidth = 0.70;
    ctx.beginPath();
    ctx.moveTo(47, -26);
    ctx.lineTo(38, -26);
    ctx.lineTo(33, -30);
    ctx.moveTo(38, -26);
    ctx.lineTo(33, -22);
    ctx.stroke();

    // ──────────────────────────────────────────────────────────────────────────
    // 4. THE ANTIQUE ENGRAVED WATERLINE BASE
    // Solid opaque paper backing + 4 rich sinusoidal engraved waves + dashed ticks
    // Generously spans 235px (x = -96 to 138), fully showing water below at all scales
    // ──────────────────────────────────────────────────────────────────────────
    const wLeft = -96;
    const wRight = 138;
    const wFreq = 0.26;

    // (a) Opaque paper foundation below y=0 so background never bleeds through
    ctx.fillStyle = paper;
    ctx.fillRect(wLeft, 0, wRight - wLeft, 24);

    // Wave 1: Crisp surface wave (oscillates across y=0)
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let x = wLeft; x <= wRight; x += 2) {
      const y = Math.sin(x * wFreq) * 2.4;
      if (x === wLeft) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Wave 2: Middle parallel wave
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    for (let x = wLeft + 2; x <= wRight - 2; x += 2) {
      const y = Math.sin(x * wFreq + 0.6) * 2.3 + 4.8;
      if (x === wLeft + 2) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Wave 3: Lower ripple wave
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    for (let x = wLeft + 5; x <= wRight - 5; x += 2) {
      const y = Math.sin(x * wFreq + 1.2) * 2.1 + 9.6;
      if (x === wLeft + 5) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Wave 4: Bottom deep wave
    ctx.lineWidth = 0.50;
    ctx.beginPath();
    for (let x = wLeft + 7; x <= wRight - 7; x += 2) {
      const y = Math.sin(x * wFreq + 1.8) * 1.8 + 14.4;
      if (x === wLeft + 7) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Wave 5: Delicate broken dash ticks under the bottom wave
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    for (let x = wLeft + 8; x <= wRight - 8; x += 8) {
      ctx.moveTo(x, 19.5);
      ctx.lineTo(x + 4, 19.5);
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 2. Cetus Monstruosus (Baroque Spouting Leviathan / Sea Beast)
   * A genuinely menacing, ferocious Renaissance sea monster:
   * Gaping predatory jaw with upward-curving boar tusks and saw teeth,
   * heavy furrowed brow, twin spiraling baroque fountain plumes,
   * acanthus pectoral flipper, muscular striations, and baroque scroll-curled flukes.
   */
  drawBaroqueLeviathan(ctx, palette, progress, seed) {
    // (a) Churning Froth & Concentric Wake at Waterline
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 0.60;
    ctx.globalAlpha = 0.40 * progress;

    for (let rx of [-52, 52]) {
      for (let r = 4; r <= 11; r += 2.8) {
        ctx.beginPath();
        ctx.ellipse(rx, 0, r * 1.6, r * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Froth spray dots
      ctx.beginPath();
      ctx.arc(rx - 3, -1.5, 1.5, 0, Math.PI * 2);
      ctx.arc(rx + 4, -1.8, 1.2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // (b) Opaque Base Paper Mask for Massive Grotesque Body
    ctx.globalAlpha = Math.min(1.0, progress * 1.25);
    ctx.fillStyle = palette.paper;
    ctx.beginPath();
    ctx.moveTo(-54, 0);

    // Gaping lower jaw dropped menacingly
    ctx.quadraticCurveTo(-60, 4, -66, -4);
    // Deep predatory mouth gape
    ctx.lineTo(-48, -12);
    // Upper snout with heavy brow ridge
    ctx.quadraticCurveTo(-68, -20, -52, -28);
    // Cranial hump with blowhole
    ctx.quadraticCurveTo(-44, -34, -30, -32);
    // Massive arched muscular back with dorsal scutes
    ctx.bezierCurveTo(-15, -44, 20, -46, 42, -18);
    // Rising tail peduncle
    ctx.quadraticCurveTo(50, -8, 56, -20);
    // Magnificent Baroque Scroll Fluke
    ctx.bezierCurveTo(62, -34, 76, -30, 68, -16);
    ctx.bezierCurveTo(80, -12, 74, -2, 58, -6);
    ctx.quadraticCurveTo(50, 0, 50, 0);
    ctx.lineTo(-54, 0);
    ctx.closePath();
    ctx.fill();

    // (c) Intaglio Muscular Striations & Shaded Belly
    ctx.save();
    ctx.clip(); // Clip to monster body
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 0.65;
    ctx.globalAlpha = 0.44;
    ctx.beginPath();
    // Curved muscular hatching along underbelly
    for (let hx = -75; hx < 75; hx += 3.0) {
      ctx.moveTo(hx, 6);
      ctx.quadraticCurveTo(hx + 8, -14, hx + 18, -30);
    }
    // Counter-hatch on lower throat
    for (let hx = -68; hx < -36; hx += 2.8) {
      ctx.moveTo(hx + 12, 6);
      ctx.lineTo(hx - 6, -16);
    }
    ctx.stroke();
    ctx.restore();

    // (d) Ink Outlines & Grotesque Anatomical Details
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.35;

    // Body silhouette outline
    ctx.beginPath();
    ctx.moveTo(-54, 0);
    ctx.quadraticCurveTo(-60, 4, -66, -4);
    ctx.lineTo(-48, -12);
    ctx.quadraticCurveTo(-68, -20, -52, -28);
    ctx.quadraticCurveTo(-44, -34, -30, -32);
    ctx.bezierCurveTo(-15, -44, 20, -46, 42, -18);
    ctx.quadraticCurveTo(50, -8, 56, -20);
    // Upper fluke scroll
    ctx.bezierCurveTo(62, -34, 76, -30, 68, -16);
    // Lower fluke scroll
    ctx.bezierCurveTo(80, -12, 74, -2, 58, -6);
    ctx.stroke();

    // Waterline base rule
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(-56, 0);
    ctx.lineTo(52, 0);
    ctx.stroke();

    // (e) Baroque Scalloped Dorsal Crest / Scutes
    ctx.lineWidth = 0.90;
    ctx.fillStyle = palette.paper;
    const dorsalScutes = [
      { x: -18, y: -38, h: 7 },
      { x: -6,  y: -42, h: 9 },
      { x: 8,   y: -41, h: 8 },
      { x: 22,  y: -35, h: 6 },
    ];
    for (let sc of dorsalScutes) {
      ctx.beginPath();
      ctx.moveTo(sc.x - 4, sc.y);
      ctx.quadraticCurveTo(sc.x, sc.y - sc.h, sc.x + 3, sc.y - sc.h * 0.5);
      ctx.lineTo(sc.x + 4, sc.y + 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // (f) Baroque Acanthus-Style Pectoral Flipper
    ctx.lineWidth = 0.95;
    ctx.fillStyle = palette.paper;
    ctx.beginPath();
    ctx.moveTo(-22, -14);
    // Upper acanthus lobe
    ctx.bezierCurveTo(-18, -4, -10, -2, -4, 0);
    // Serrated fin tip with baroque scroll
    ctx.bezierCurveTo(-8, -8, -6, -14, -14, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fin ray striations
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-20, -14);
    ctx.lineTo(-8, -4);
    ctx.moveTo(-18, -14);
    ctx.lineTo(-10, -8);
    ctx.stroke();

    // (g) Ferocious Gaping Mouth with Boar Tusks & Sharp Fangs
    // Dropped menacing jaw, NO cheerful smile!
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    // Upward-curving ivory boar tusk on lower jaw
    ctx.moveTo(-65, -3);
    ctx.quadraticCurveTo(-63, -9, -60, -10);
    ctx.lineTo(-59, -5);
    ctx.stroke();

    // Jagged saw teeth along upper and lower jaw
    ctx.beginPath();
    // Upper jaw fangs
    ctx.moveTo(-64, -18);
    ctx.lineTo(-62, -13);
    ctx.lineTo(-60, -17);
    ctx.lineTo(-58, -12);
    ctx.lineTo(-56, -16);
    ctx.lineTo(-54, -12);
    ctx.lineTo(-52, -15);
    // Lower jaw teeth
    ctx.moveTo(-58, -6);
    ctx.lineTo(-56, -9);
    ctx.lineTo(-54, -6);
    ctx.lineTo(-52, -8.5);
    ctx.lineTo(-50, -6);
    ctx.stroke();

    // (h) Heavy Scowling Brow & Piercing Eye
    // Deep furrowed brow crease
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(-48, -24);
    ctx.quadraticCurveTo(-42, -26, -36, -21);
    ctx.stroke();

    // Piercing predatory eye
    ctx.fillStyle = palette.ink;
    ctx.beginPath();
    ctx.arc(-42, -20, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Radiating angry brow wrinkles
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-45, -24);
    ctx.lineTo(-46, -27);
    ctx.moveTo(-42, -25);
    ctx.lineTo(-41, -28);
    ctx.stroke();

    // (i) Sinuous Tendril Whiskers / Barbels Curling from Snout
    ctx.lineWidth = 0.70;
    ctx.beginPath();
    ctx.moveTo(-64, -5);
    ctx.bezierCurveTo(-72, 2, -64, 12, -56, 6);
    ctx.stroke();

    // (j) Dramatic Baroque Twin Spouting Fountain Plumes
    // Twin spiraling plumes erupting from flared blowhole nostril (at x ~ -46, y ~ -31)
    const bx = -46;
    const by = -31;

    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 0.85;

    // Left spiraling plume
    ctx.beginPath();
    ctx.moveTo(bx - 2, by);
    ctx.bezierCurveTo(bx - 12, by - 14, bx - 26, by - 26, bx - 28, by - 16);
    // Volute spiral curl at fountain peak
    ctx.bezierCurveTo(bx - 30, by - 10, bx - 24, by - 8, bx - 25, by - 13);
    ctx.stroke();

    // Right spiraling plume
    ctx.beginPath();
    ctx.moveTo(bx + 2, by);
    ctx.bezierCurveTo(bx + 10, by - 18, bx + 24, by - 30, bx + 22, by - 18);
    ctx.bezierCurveTo(bx + 20, by - 12, bx + 14, by - 12, bx + 16, by - 16);
    ctx.stroke();

    // Central eruption spray rays
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - 14, by - 26);
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 10, by - 28);
    ctx.stroke();

    // Baroque cascading water droplets and foam beads
    const sprayDroplets = [
      { x: bx - 28, y: by - 14 },
      { x: bx - 32, y: by - 18 },
      { x: bx - 22, y: by - 28 },
      { x: bx - 14, y: by - 32 },
      { x: bx + 14, y: by - 32 },
      { x: bx + 24, y: by - 28 },
      { x: bx + 26, y: by - 20 },
      { x: bx + 18, y: by - 10 },
      { x: bx - 8,  y: by - 24 },
      { x: bx + 5,  y: by - 22 },
    ];

    ctx.fillStyle = palette.ink;
    for (let dp of sprayDroplets) {
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SeaMonsterEngine };
}
