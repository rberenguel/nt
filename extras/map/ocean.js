// Procedural Renaissance Nautical Ocean Engine (Mare Incognitum / Oceanus)
// Features authentic 16th/17th Century copperplate marine cartography:
// 1. Portolan Rhumb Lines (Loxodromic Navigation Web): 16/32-point radiating rays from nautical nodes.
// 2. Ocean Wavelet Clusters: delicate rhythmic engraved wave crests breaking open water expanses.
// 3. Tall Ships & Galleons (Navis Bellica & Caravel): multi-masted vessels under full billowing sail
//    with layered rigging, crow's nests, sterncastles, gunports, swallowtail pennants, and paper masks.

class OceanEngine {
  constructor(totalW, totalH, seed = Math.floor(Math.random() * 1000000)) {
    this.totalW = totalW;
    this.totalH = totalH;
    this.seed = seed;
    this.rng = createRNG(seed);

    this.waves = [];       // Array of ocean wave clusters
    this.rhumbNodes = [];  // Array of radiating navigation centers { cx, cy, rStart, rays }
    this.vessels = [];     // Array of Renaissance tall ships
    this.visible = true;
  }

  /**
   * Layout rhumb lines, wave crest clusters, and tall ships.
   * Ships are placed strictly offshore in proximity to coastal cities/havens (at most 1 large, or 1 large + 1 small).
   */
  layout(coastEngine, cartoucheEngine, compassEngine, monsterEngine, settlementEngine = null, totalScreens = 1) {
    this.waves = [];
    this.rhumbNodes = [];
    this.vessels = [];

    if (!coastEngine || !coastEngine.coasts || coastEngine.coasts.length === 0) return;

    const { totalW, totalH, rng } = this;
    const neatlinePad = 28;
    const margin = 26;
    const screenW = totalW / totalScreens;

    const cartoucheBox = cartoucheEngine ? cartoucheEngine.box : null;
    const compassPos = compassEngine && compassEngine.visible ? compassEngine.pos : null;
    const monsters = monsterEngine && monsterEngine.visible ? monsterEngine.monsters : [];

    // Helper: test if point (x, y) is clear of screen bezels
    const isClearOfBezel = (x, clearance = 30) => {
      if (totalScreens <= 1) return true;
      for (let s = 1; s < totalScreens; s++) {
        const bx = s * screenW;
        if (Math.abs(x - bx) < clearance) return false;
      }
      return true;
    };

    // Helper: test distance from (x, y) to cartouche
    const distToCartouche = (x, y) => {
      if (!cartoucheBox) return Infinity;
      const cx = Math.max(cartoucheBox.x, Math.min(x, cartoucheBox.x + cartoucheBox.w));
      const cy = Math.max(cartoucheBox.y, Math.min(y, cartoucheBox.y + cartoucheBox.h));
      return Math.hypot(x - cx, y - cy);
    };

    // Helper: test distance from (x, y) to compass rose
    const distToCompass = (x, y) => {
      if (!compassPos) return Infinity;
      return Math.hypot(x - compassPos.cx, y - compassPos.cy);
    };

    // Helper: test distance to nearest sea monster
    const distToMonster = (x, y) => {
      if (!monsters || monsters.length === 0) return Infinity;
      let minD = Infinity;
      for (let m of monsters) {
        const d = Math.hypot(x - m.x, y - m.y);
        if (d < minD) minD = d;
      }
      return minD;
    };

    // ── 1. PORTOLAN RHUMB LINE NODES ──────────────────────────────────────────
    // Determine 1 to 2 navigation nodes.
    // Primary node: Compass Rose center (if visible and inside ocean)
    if (compassPos && coastEngine.isOcean({ x: compassPos.cx, y: compassPos.cy })) {
      this.rhumbNodes.push({
        cx: compassPos.cx,
        cy: compassPos.cy,
        rStart: (compassPos.r || 42) + 6,
        rayCount: 32,
      });
    }

    // Secondary node: search for a large open ocean basin far from the primary node
    const candidateNodes = [];
    const stepX = 80;
    const stepY = 80;
    for (let x = neatlinePad + 80; x < totalW - neatlinePad - 80; x += stepX) {
      for (let y = neatlinePad + 80; y < totalH - neatlinePad - 80; y += stepY) {
        if (!isClearOfBezel(x, 40)) continue;
        if (distToCartouche(x, y) < 140) continue;
        if (distToCompass(x, y) < 280) continue;

        const coastPt = coastEngine.getNearestCoastPoint(x, y);
        if (!coastPt) continue;
        const coastDist = Math.hypot(x - coastPt.x, y - coastPt.y);
        if (coastDist > 100 && coastEngine.isOcean({ x, y })) {
          candidateNodes.push({ x, y, clearance: coastDist });
        }
      }
    }

    if (candidateNodes.length > 0) {
      candidateNodes.sort((a, b) => b.clearance - a.clearance);
      const chosen = candidateNodes[Math.floor(rng() * Math.min(3, candidateNodes.length))];
      if (this.rhumbNodes.length === 0 || (totalScreens > 1 && rng() < 0.75) || rng() < 0.45) {
        this.rhumbNodes.push({
          cx: chosen.x,
          cy: chosen.y,
          rStart: 6,
          rayCount: 16,
        });
      }
    }

    // Precalculate rhumb line ray endpoints for fast rendering
    const maxRayLen = Math.hypot(totalW, totalH) * 1.2;
    for (let node of this.rhumbNodes) {
      node.rays = [];
      const count = node.rayCount;
      for (let i = 0; i < count; i++) {
        const angle = (i * Math.PI * 2) / count;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const isMajor = i % (count / 4) === 0; // Cardinal
        const isHalf = i % (count / 8) === 0;  // Intercardinal

        node.rays.push({
          x1: node.cx + cosA * node.rStart,
          y1: node.cy + sinA * node.rStart,
          x2: node.cx + cosA * maxRayLen,
          y2: node.cy + sinA * maxRayLen,
          isMajor,
          isHalf,
        });
      }
    }

    // ── 2. RENAISSANCE TALL SHIPS (GALLEONS & CARAVELS) ────────────────────────
    // Strictly at most 1 large Galleon, or 1 large Galleon + 1 small Caravel,
    // and strictly placed offshore in proximity to coastal cities/havens.
    const settlements = settlementEngine ? settlementEngine.settlements : [];
    const coastalSettlements = [];
    for (let s of settlements) {
      const cp = coastEngine.getNearestCoastPoint(s.x, s.y);
      if (!cp) continue;
      const d = Math.hypot(s.x - cp.x, s.y - cp.y);
      if (s.type === "port" || d < 95) {
        coastalSettlements.push({ s, cp, d });
      }
    }

    // Sort: ports first, then nearest to coast
    coastalSettlements.sort((a, b) => {
      if (a.s.type === "port" && b.s.type !== "port") return -1;
      if (b.s.type === "port" && a.s.type !== "port") return 1;
      return a.d - b.d;
    });

    if (coastalSettlements.length > 0) {
      // Find offshore position for Ship 1 (Large Galleon)
      for (let cs of coastalSettlements) {
        const { s, cp } = cs;
        let outX = cp.x - s.x;
        let outY = cp.y - s.y;
        let outDist = Math.hypot(outX, outY);
        if (outDist < 1) { outX = 0; outY = 1; outDist = 1; }
        const normOutX = outX / outDist;
        const normOutY = outY / outDist;

        for (let offD of [85, 110, 135, 160]) {
          const candX = cp.x + normOutX * offD;
          const candY = cp.y + normOutY * offD;

          if (candX < neatlinePad + 50 || candX > totalW - neatlinePad - 50) continue;
          if (candY < neatlinePad + 50 || candY > totalH - neatlinePad - 50) continue;
          if (!isClearOfBezel(candX, 36)) continue;
          if (distToCartouche(candX, candY) < 105) continue;
          if (distToCompass(candX, candY) < 95) continue;
          if (distToMonster(candX, candY) < 120) continue;

          // Strict clearance from ALL settlements: never crowd city silhouettes or cartouche labels
          let nearSettlement = false;
          for (let st of settlements) {
            if (Math.hypot(candX - st.x, candY - st.y) < 135) {
              nearSettlement = true;
              break;
            }
          }
          if (nearSettlement) continue;

          const candCoastPt = coastEngine.getNearestCoastPoint(candX, candY);
          if (!candCoastPt) continue;
          const candCoastDist = Math.hypot(candX - candCoastPt.x, candY - candCoastPt.y);

          // Deep water anchorage: at least 48px from shoreline
          if (candCoastDist >= 48 && coastEngine.isOcean({ x: candX, y: candY })) {
            const vSeed = this.seed + 9000;
            const facing = normOutX >= 0 ? 1 : -1;

            this.vessels.push({
              x: candX,
              y: candY,
              facing,
              type: "galleon",
              scale: 0.88 + rng() * 0.14, // 1 Large Galleon
              seed: vSeed,
            });
            break;
          }
        }
        if (this.vessels.length > 0) break;
      }

      // Ship 2: At most one small Caravel, only if Ship 1 exists and rng() < 0.60
      if (this.vessels.length === 1 && rng() < 0.60) {
        const ship1 = this.vessels[0];
        for (let cs of coastalSettlements) {
          const { s, cp } = cs;
          let outX = cp.x - s.x;
          let outY = cp.y - s.y;
          let outDist = Math.hypot(outX, outY);
          if (outDist < 1) { outX = 0; outY = 1; outDist = 1; }
          const normOutX = outX / outDist;
          const normOutY = outY / outDist;
          const tangX = -normOutY;
          const tangY = normOutX;

          for (let offD of [75, 100, 130]) {
            for (let shift of [45, -45, 0]) {
              const candX = cp.x + normOutX * offD + tangX * shift;
              const candY = cp.y + normOutY * offD + tangY * shift;

              if (Math.hypot(candX - ship1.x, candY - ship1.y) < 110) continue;
              if (candX < neatlinePad + 45 || candX > totalW - neatlinePad - 45) continue;
              if (candY < neatlinePad + 45 || candY > totalH - neatlinePad - 45) continue;
              if (!isClearOfBezel(candX, 32)) continue;
              if (distToCartouche(candX, candY) < 95) continue;
              if (distToCompass(candX, candY) < 90) continue;
              if (distToMonster(candX, candY) < 115) continue;

              let nearSettlement = false;
              for (let st of settlements) {
                if (Math.hypot(candX - st.x, candY - st.y) < 120) {
                  nearSettlement = true;
                  break;
                }
              }
              if (nearSettlement) continue;

              const candCoastPt = coastEngine.getNearestCoastPoint(candX, candY);
              if (!candCoastPt) continue;
              const candCoastDist = Math.hypot(candX - candCoastPt.x, candY - candCoastPt.y);

              if (candCoastDist >= 40 && coastEngine.isOcean({ x: candX, y: candY })) {
                const vSeed = this.seed + 9777;
                const facing = normOutX >= 0 ? 1 : -1;

                this.vessels.push({
                  x: candX,
                  y: candY,
                  facing,
                  type: "caravel",
                  scale: 0.66 + rng() * 0.10, // 1 Small Caravel
                  seed: vSeed,
                });
                break;
              }
            }
            if (this.vessels.length >= 2) break;
          }
          if (this.vessels.length >= 2) break;
        }
      }
    }

    // ── 3. OCEAN WAVELET CLUSTERS ─────────────────────────────────────────────
    const waveCandidates = [];
    const wStep = 38;
    for (let x = neatlinePad + 40; x < totalW - neatlinePad - 40; x += wStep) {
      for (let y = neatlinePad + 40; y < totalH - neatlinePad - 40; y += wStep) {
        const jx = x + (rng() - 0.5) * 20;
        const jy = y + (rng() - 0.5) * 20;

        if (!isClearOfBezel(jx, 22)) continue;
        if (distToCartouche(jx, jy) < 80) continue;
        if (distToCompass(jx, jy) < 70) continue;
        if (distToMonster(jx, jy) < 75) continue;

        // Keep distance from ships
        let nearShip = false;
        for (let v of this.vessels) {
          if (Math.hypot(v.x - jx, v.y - jy) < 60) { nearShip = true; break; }
        }
        if (nearShip) continue;

        const coastPt = coastEngine.getNearestCoastPoint(jx, jy);
        if (!coastPt) continue;
        const cDist = Math.hypot(jx - coastPt.x, jy - coastPt.y);

        // Must be in ocean and at least 35px from shore so waterlines don't conflict
        if (cDist > 35 && coastEngine.isOcean({ x: jx, y: jy })) {
          waveCandidates.push({ x: jx, y: jy, seed: this.seed + waveCandidates.length * 43 });
        }
      }
    }

    // Sample a balanced density of wave clusters: ~35 to 65
    const targetWaves = Math.min(65, Math.max(25, Math.floor(waveCandidates.length * 0.42)));
    // Shuffle candidates deterministically
    for (let i = waveCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = waveCandidates[i];
      waveCandidates[i] = waveCandidates[j];
      waveCandidates[j] = tmp;
    }

    for (let i = 0; i < Math.min(targetWaves, waveCandidates.length); i++) {
      const wc = waveCandidates[i];
      const wRng = createRNG(wc.seed);
      const width = 13 + wRng() * 9; // 13 - 22px
      const count = 2 + Math.floor(wRng() * 2); // 2 or 3 strokes
      this.waves.push({
        x: wc.x,
        y: wc.y,
        width,
        count,
        seed: wc.seed,
      });
    }
  }

  /**
   * 1. Render Portolan Rhumb Lines
   * Clipped strictly to ocean polygons so they never cross onto dry land.
   */
  drawRhumbLines(ctx, palette, progress = 1.0, coastEngine) {
    if (!this.visible || this.rhumbNodes.length === 0 || progress < 0.05) return;
    if (!coastEngine || !coastEngine.oceanPolys || coastEngine.oceanPolys.length === 0) return;

    const anim = Math.min(1.0, (progress - 0.05) / 0.85);

    ctx.save();
    // Clip strictly to open ocean polygons
    ctx.beginPath();
    for (let poly of coastEngine.oceanPolys) {
      if (poly.length < 3) continue;
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y);
      }
      ctx.closePath();
    }
    ctx.clip();

    ctx.lineCap = "round";

    for (let node of this.rhumbNodes) {
      if (!node.rays) continue;
      for (let ray of node.rays) {
        // Interpolate ray length based on progress
        const rx2 = ray.x1 + (ray.x2 - ray.x1) * anim;
        const ry2 = ray.y1 + (ray.y2 - ray.y1) * anim;

        ctx.beginPath();
        ctx.moveTo(ray.x1, ray.y1);
        ctx.lineTo(rx2, ry2);

        if (ray.isMajor) {
          // Cardinal winds: solid firm line
          ctx.strokeStyle = palette.ink;
          ctx.lineWidth = 0.75;
          ctx.globalAlpha = 0.32;
        } else if (ray.isHalf) {
          // Half-winds: medium line
          ctx.strokeStyle = palette.inkFaint || palette.ink;
          ctx.lineWidth = 0.55;
          ctx.globalAlpha = 0.24;
        } else {
          // Quarter-winds: delicate hairline
          ctx.strokeStyle = palette.inkFaint || palette.ink;
          ctx.lineWidth = 0.45;
          ctx.globalAlpha = 0.16;
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * 2. Render Ocean Wavelet Clusters
   * Antique copperplate engraved horizontal sinusoidal wavelets with curling crests.
   */
  /**
   * 2. Render Ocean Wavelet Clusters
   * Modeled after the copperplate engraved serpent waterline in monster.js:
   * Continuous sinusoidal wave contours with phase-shifts, vertical descent,
   * and delicate broken dash ticks at the base.
   */
  drawWaves(ctx, palette, progress = 1.0) {
    if (!this.visible || this.waves.length === 0 || progress < 0.1) return;

    const anim = Math.min(1.0, (progress - 0.1) / 0.85);
    const visibleCount = Math.floor(this.waves.length * anim);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = palette.ink;

    for (let i = 0; i < visibleCount; i++) {
      const w = this.waves[i];
      const wRng = createRNG(w.seed);

      const cx = w.x;
      const cy = w.y;
      const hw = Math.max(16, (w.width || 28) * 0.5); // span: -hw to +hw
      const wFreq = 0.28;
      const amp = 1.7 + wRng() * 0.5;

      // Wave 1: Surface sinusoidal wave
      ctx.lineWidth = 0.85;
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      for (let x = -hw; x <= hw; x += 2) {
        const edgeTaper = Math.sin(((x + hw) / (hw * 2)) * Math.PI);
        const y = Math.sin(x * wFreq) * (amp * edgeTaper);
        if (x === -hw) ctx.moveTo(cx + x, cy + y);
        else ctx.lineTo(cx + x, cy + y);
      }
      ctx.stroke();

      // Wave 2: Middle parallel sinusoidal wave with phase shift
      ctx.lineWidth = 0.65;
      ctx.globalAlpha = 0.32;
      ctx.beginPath();
      for (let x = -hw + 2; x <= hw - 2; x += 2) {
        const edgeTaper = Math.sin(((x + hw) / (hw * 2)) * Math.PI);
        const y = Math.sin(x * wFreq + 0.6) * (amp * 0.9 * edgeTaper) + 3.8;
        if (x === -hw + 2) ctx.moveTo(cx + x, cy + y);
        else ctx.lineTo(cx + x, cy + y);
      }
      ctx.stroke();

      // Wave 3: Lower ripple wave (in ~75% of clusters)
      if (w.count >= 3) {
        ctx.lineWidth = 0.48;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        for (let x = -hw + 4; x <= hw - 4; x += 2) {
          const edgeTaper = Math.sin(((x + hw) / (hw * 2)) * Math.PI);
          const y = Math.sin(x * wFreq + 1.2) * (amp * 0.75 * edgeTaper) + 7.2;
          if (x === -hw + 4) ctx.moveTo(cx + x, cy + y);
          else ctx.lineTo(cx + x, cy + y);
        }
        ctx.stroke();
      }

      // Wave 4: Delicate broken dash ticks underneath
      if (wRng() < 0.70) {
        ctx.lineWidth = 0.40;
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        const startX = -hw + 4;
        const endX = hw - 4;
        for (let x = startX; x <= endX; x += 8) {
          ctx.moveTo(cx + x, cy + 9.6);
          ctx.lineTo(cx + Math.min(endX, x + 3.5), cy + 9.6);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * 3. Render Renaissance Tall Ships (Galleons & Caravels)
   * High-detail engraved ships with opaque paper masks, multi-tier rigging,
   * billowing sails, and dynamic bow wakes.
   */
  drawVessels(ctx, palette, progress = 1.0) {
    if (!this.visible || this.vessels.length === 0 || progress < 0.2) return;

    const anim = Math.min(1.0, (progress - 0.2) / 0.8);

    for (let v of this.vessels) {
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.scale(v.facing * v.scale, v.scale);
      ctx.globalAlpha = Math.min(1.0, anim * 1.2);

      if (v.type === "galleon") {
        this.drawGalleon(ctx, palette, anim, v.seed);
      } else {
        this.drawCaravel(ctx, palette, anim, v.seed);
      }

      ctx.restore();
    }
  }

  /**
   * Classical 3-Masted Renaissance Galleon (Navis Bellica)
   * High sterncastle, forecastle, 3 masts (fore, main, mizzen), spritsail,
   * gunports, crow's nests, billowing canvas, stays, shrouds with ratlines, and fluttering pennants.
   */
  drawGalleon(ctx, pal, anim, seed) {
    const rng = createRNG(seed);
    const ink = pal.ink;
    const paper = pal.paper;

    // Dimensions
    const hullL = 46;   // half length approx
    const keelY = 12;   // bottom of hull
    const deckY = -2;   // mid-ship main deck
    const sternX = -32; // aft
    const sternY = -18; // poop deck
    const bowX = 30;    // prow
    const bowY = -8;    // forecastle deck
    const bowspritTipX = 48;
    const bowspritTipY = -18;

    // ── STEP 1: OPAQUE PARCHMENT MASK ───────────────────────────────────────────
    // Solid mask covering hull, sterncastle, and billowed sail envelopes
    ctx.save();
    ctx.fillStyle = paper;

    // Hull mask
    ctx.beginPath();
    ctx.moveTo(bowX + 4, bowY);
    ctx.quadraticCurveTo(bowX + 8, bowY + 8, bowX - 2, keelY);
    ctx.lineTo(sternX + 6, keelY);
    ctx.quadraticCurveTo(sternX - 2, keelY - 6, sternX, sternY);
    ctx.lineTo(sternX + 14, sternY);
    ctx.lineTo(sternX + 14, deckY);
    ctx.lineTo(bowX - 10, deckY);
    ctx.lineTo(bowX - 10, bowY);
    ctx.closePath();
    ctx.fill();

    // Sail masks (Main & Fore course/topsails, Mizzen lateen)
    // Main course
    ctx.beginPath();
    ctx.moveTo(-16, -18);
    ctx.lineTo(12, -20);
    ctx.quadraticCurveTo(15, -8, 11, -3);
    ctx.quadraticCurveTo(-2, -5, -15, -3);
    ctx.closePath();
    ctx.fill();

    // Main topsail
    ctx.beginPath();
    ctx.moveTo(-12, -40);
    ctx.lineTo(10, -42);
    ctx.quadraticCurveTo(12, -30, 9, -24);
    ctx.quadraticCurveTo(-1, -26, -11, -24);
    ctx.closePath();
    ctx.fill();

    // Fore course
    ctx.beginPath();
    ctx.moveTo(8, -14);
    ctx.lineTo(30, -16);
    ctx.quadraticCurveTo(32, -6, 29, -2);
    ctx.quadraticCurveTo(18, -4, 9, -2);
    ctx.closePath();
    ctx.fill();

    // Fore topsail
    ctx.beginPath();
    ctx.moveTo(11, -34);
    ctx.lineTo(27, -35);
    ctx.quadraticCurveTo(28, -25, 26, -20);
    ctx.quadraticCurveTo(18, -21, 11, -20);
    ctx.closePath();
    ctx.fill();

    // Mizzen lateen sail (triangular)
    ctx.beginPath();
    ctx.moveTo(-28, -6);
    ctx.lineTo(-14, -28);
    ctx.lineTo(-24, -22);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // ── STEP 2: WATERLINE WAKE & FOAM ──────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.65;

    // Waterline baseline ripples
    ctx.beginPath();
    ctx.moveTo(sternX - 8, 3);
    ctx.quadraticCurveTo(-10, 5, 5, 2);
    ctx.quadraticCurveTo(20, -1, bowX + 10, 4);
    ctx.stroke();

    // Churning bow spray foam curl
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(bowX - 4, 3);
    ctx.bezierCurveTo(bowX + 6, 2, bowX + 12, -2, bowX + 15, -4);
    ctx.stroke();

    // Secondary wake ripple
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(sternX - 14, 5);
    ctx.lineTo(sternX - 2, 5);
    ctx.stroke();
    ctx.restore();

    // ── STEP 3: HULL PLANKING, GUNPORTS & STERNCASTLE ─────────────────────────
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Primary Hull Outline
    ctx.beginPath();
    // Sheerline from stern to bow
    ctx.moveTo(sternX, sternY);
    ctx.lineTo(sternX + 12, sternY);
    ctx.lineTo(sternX + 12, deckY);
    ctx.lineTo(bowX - 10, deckY);
    ctx.lineTo(bowX - 10, bowY);
    ctx.lineTo(bowX + 5, bowY);
    // Beakhead prow curving down to keel
    ctx.quadraticCurveTo(bowX + 7, bowY + 8, bowX - 2, keelY);
    // Bottom keel
    ctx.lineTo(sternX + 6, keelY);
    // Sternpost & rudder
    ctx.quadraticCurveTo(sternX - 2, keelY - 4, sternX, sternY);
    ctx.stroke();

    // Hull Strakes (horizontal wooden planking lines)
    ctx.lineWidth = 0.6;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    // Strake 1
    ctx.moveTo(sternX + 2, 2);
    ctx.quadraticCurveTo(-5, 4, bowX - 3, 2);
    // Strake 2
    ctx.moveTo(sternX + 4, 6);
    ctx.quadraticCurveTo(-5, 8, bowX - 4, 6);
    // Strake 3
    ctx.moveTo(sternX + 6, 9.5);
    ctx.quadraticCurveTo(-5, 10.5, bowX - 5, 9.5);
    ctx.stroke();

    // Sterncastle Poop Deck Details & Gallery Windows
    ctx.lineWidth = 0.7;
    // Step rail
    ctx.beginPath();
    ctx.moveTo(sternX + 1, sternY + 6);
    ctx.lineTo(sternX + 11, sternY + 6);
    ctx.stroke();

    // 2 miniature arched stern gallery windows
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(sternX + 2, sternY + 8, 3, 4);
    ctx.fillRect(sternX + 7, sternY + 8, 3, 4);

    // Stern Lantern on flagstaff
    ctx.beginPath();
    ctx.arc(sternX - 3, sternY - 2, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Forecastle rail
    ctx.beginPath();
    ctx.moveTo(bowX - 9, bowY + 4);
    ctx.lineTo(bowX + 3, bowY + 4);
    ctx.stroke();

    // Gunports along the gun deck (4 dark square ports)
    ctx.fillStyle = ink;
    const gunportX = [-18, -8, 2, 12];
    for (let gx of gunportX) {
      ctx.fillRect(gx, deckY + 4, 2.8, 2.8);
      // Tiny horizontal cannon barrel protruding
      ctx.beginPath();
      ctx.moveTo(gx + 2.8, deckY + 5.4);
      ctx.lineTo(gx + 4.8, deckY + 5.4);
      ctx.stroke();
    }

    ctx.restore();

    // ── STEP 4: MASTS, SPARS & BOWSPRIT ──────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineCap = "round";

    // Bowsprit spar
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(bowX - 4, bowY + 2);
    ctx.lineTo(bowspritTipX, bowspritTipY);
    ctx.stroke();

    // Foremast (at x = 18, rises to y = -40)
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(18, deckY);
    ctx.lineTo(18, -42);
    ctx.stroke();

    // Mainmast (at x = -2, rises to y = -52, tallest)
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-2, deckY);
    ctx.lineTo(-2, -54);
    ctx.stroke();

    // Mizzenmast (at x = -20, rises to y = -34)
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-20, sternY);
    ctx.lineTo(-20, -34);
    ctx.stroke();

    // Crow's Nests / Fighting Tops (on Fore & Main)
    ctx.fillStyle = ink;
    ctx.fillRect(15.5, -23, 5, 2.5);
    ctx.fillRect(-4.5, -31, 5, 2.5);

    // ── STEP 5: STANDING & RUNNING RIGGING ────────────────────────────────────
    ctx.lineWidth = 0.45;
    ctx.globalAlpha = 0.45;

    // Shrouds (Mainmast)
    ctx.beginPath();
    ctx.moveTo(-2, -31);
    ctx.lineTo(-12, deckY);
    ctx.moveTo(-2, -31);
    ctx.lineTo(8, deckY);
    // Horizontal ratlines (ladder rungs)
    for (let r = 0; r < 4; r++) {
      const t = 0.35 + r * 0.18;
      const ry = -31 + (deckY - (-31)) * t;
      const rxL = -2 + (-12 - (-2)) * t;
      const rxR = -2 + (8 - (-2)) * t;
      ctx.moveTo(rxL, ry);
      ctx.lineTo(rxR, ry);
    }
    ctx.stroke();

    // Forestays (Main to Fore, Fore to Bowsprit)
    ctx.beginPath();
    ctx.moveTo(-2, -50);
    ctx.lineTo(18, -32);
    ctx.moveTo(18, -38);
    ctx.lineTo(bowspritTipX, bowspritTipY);
    ctx.moveTo(-2, -30);
    ctx.lineTo(18, -16);
    ctx.stroke();

    ctx.restore();

    // ── STEP 6: BILLOWING CANVAS SAILS ───────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.0;
    ctx.lineJoin = "round";

    // Main Course Sail
    // Yardarm
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-16, -18);
    ctx.lineTo(12, -20);
    ctx.stroke();
    // Billowing canvas body
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(-16, -18);
    ctx.quadraticCurveTo(-17, -8, -15, -3); // left leech
    ctx.quadraticCurveTo(-2, -5, 11, -3);    // arched foot
    ctx.quadraticCurveTo(14, -9, 12, -20);   // right leech
    ctx.stroke();
    // Sailcloth vertical seams
    ctx.lineWidth = 0.4;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(-9, -18.5); ctx.lineTo(-8, -4);
    ctx.moveTo(-2, -19);   ctx.lineTo(-2, -4.5);
    ctx.moveTo(5, -19.5);  ctx.lineTo(5, -3.8);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Main Topsail
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-12, -40);
    ctx.lineTo(10, -42);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-12, -40);
    ctx.quadraticCurveTo(-13, -30, -11, -24);
    ctx.quadraticCurveTo(-1, -26, 9, -24);
    ctx.quadraticCurveTo(11, -31, 10, -42);
    ctx.stroke();

    // Fore Course Sail
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(8, -14);
    ctx.lineTo(30, -16);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(8, -14);
    ctx.quadraticCurveTo(7, -6, 9, -2);
    ctx.quadraticCurveTo(18, -4, 29, -2);
    ctx.quadraticCurveTo(31, -7, 30, -16);
    ctx.stroke();

    // Fore Topsail
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(11, -34);
    ctx.lineTo(27, -35);
    ctx.stroke();
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(11, -34);
    ctx.quadraticCurveTo(10, -25, 11, -20);
    ctx.quadraticCurveTo(18, -21, 26, -20);
    ctx.quadraticCurveTo(27, -26, 27, -35);
    ctx.stroke();

    // Mizzen Lateen Sail (diagonal yard with triangular canvas)
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-28, -6);
    ctx.lineTo(-14, -28);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-28, -6);
    ctx.quadraticCurveTo(-26, -14, -24, -22);
    ctx.lineTo(-14, -28);
    ctx.stroke();

    // Spritsail under bowsprit
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(bowspritTipX - 8, bowspritTipY + 4);
    ctx.quadraticCurveTo(bowspritTipX - 2, bowspritTipY + 8, bowspritTipX, bowspritTipY + 12);
    ctx.stroke();

    ctx.restore();

    // ── STEP 7: STREAMING PENNANTS & ENSIGN FLAGS ────────────────────────────
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 0.75;

    // Mainmast Swallowtail Pennant (fluttering forward with the wind)
    ctx.beginPath();
    ctx.moveTo(-2, -54);
    ctx.lineTo(14, -56);
    ctx.lineTo(10, -53);
    ctx.lineTo(14, -50);
    ctx.lineTo(-2, -51);
    ctx.closePath();
    ctx.fill();

    // Foremast Pennant
    ctx.beginPath();
    ctx.moveTo(18, -42);
    ctx.lineTo(30, -44);
    ctx.lineTo(26, -41.5);
    ctx.lineTo(30, -39);
    ctx.lineTo(18, -40);
    ctx.closePath();
    ctx.fill();

    // Stern Ensign Flag on Poop Deck Flagstaff
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(sternX, sternY);
    ctx.lineTo(sternX - 4, sternY - 14);
    ctx.stroke();
    // Broad rectangular ensign
    ctx.beginPath();
    ctx.moveTo(sternX - 4, sternY - 14);
    ctx.quadraticCurveTo(sternX - 12, sternY - 15, sternX - 16, sternY - 12);
    ctx.lineTo(sternX - 16, sternY - 6);
    ctx.quadraticCurveTo(sternX - 10, sternY - 8, sternX - 4, sternY - 8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Agile 2-Masted Renaissance Caravel / Pinnace
   * Sleek sheerline, square-rigged mainmast, lateen-rigged mizzenmast,
   * bowsprit, streaming flags, and curved bow wave.
   */
  drawCaravel(ctx, pal, anim, seed) {
    const rng = createRNG(seed);
    const ink = pal.ink;
    const paper = pal.paper;

    const hullL = 36;
    const keelY = 10;
    const deckY = -1;
    const sternX = -24;
    const sternY = -12;
    const bowX = 24;
    const bowY = -5;
    const bowspritTipX = 38;
    const bowspritTipY = -14;

    // 1. Paper Mask
    ctx.save();
    ctx.fillStyle = paper;

    ctx.beginPath();
    ctx.moveTo(bowX + 2, bowY);
    ctx.quadraticCurveTo(bowX + 6, bowY + 7, bowX - 2, keelY);
    ctx.lineTo(sternX + 4, keelY);
    ctx.quadraticCurveTo(sternX - 2, keelY - 5, sternX, sternY);
    ctx.lineTo(sternX + 10, sternY);
    ctx.lineTo(sternX + 10, deckY);
    ctx.lineTo(bowX - 6, deckY);
    ctx.lineTo(bowX - 6, bowY);
    ctx.closePath();
    ctx.fill();

    // Main course mask
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.lineTo(14, -16);
    ctx.quadraticCurveTo(16, -6, 13, -2);
    ctx.quadraticCurveTo(2, -4, -9, -2);
    ctx.closePath();
    ctx.fill();

    // Mizzen lateen mask
    ctx.beginPath();
    ctx.moveTo(-22, -4);
    ctx.lineTo(-10, -22);
    ctx.lineTo(-18, -16);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // 2. Waterline Wake
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.75;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.moveTo(sternX - 6, 2.5);
    ctx.quadraticCurveTo(-4, 4, bowX + 8, 3.5);
    ctx.stroke();

    // Bow wave curl
    ctx.beginPath();
    ctx.moveTo(bowX - 2, 2);
    ctx.quadraticCurveTo(bowX + 7, 0, bowX + 11, -2);
    ctx.stroke();
    ctx.restore();

    // 3. Hull
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.1;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(sternX, sternY);
    ctx.lineTo(sternX + 10, sternY);
    ctx.lineTo(sternX + 10, deckY);
    ctx.lineTo(bowX - 6, deckY);
    ctx.lineTo(bowX - 6, bowY);
    ctx.lineTo(bowX + 3, bowY);
    ctx.quadraticCurveTo(bowX + 5, bowY + 6, bowX - 2, keelY);
    ctx.lineTo(sternX + 4, keelY);
    ctx.quadraticCurveTo(sternX - 2, keelY - 4, sternX, sternY);
    ctx.stroke();

    // Planking lines
    ctx.lineWidth = 0.55;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(sternX + 2, 2.5);
    ctx.quadraticCurveTo(-2, 4, bowX - 2, 2);
    ctx.moveTo(sternX + 3, 6);
    ctx.quadraticCurveTo(-2, 7.5, bowX - 3, 5.5);
    ctx.stroke();

    // 2 Gunports
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-6, deckY + 3.5, 2.5, 2.5);
    ctx.fillRect(6, deckY + 3.5, 2.5, 2.5);

    ctx.restore();

    // 4. Masts & Bowsprit
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineCap = "round";

    // Bowsprit
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    ctx.moveTo(bowX - 2, bowY + 2);
    ctx.lineTo(bowspritTipX, bowspritTipY);
    ctx.stroke();

    // Mainmast (at x = 4, rises to y = -44)
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(4, deckY);
    ctx.lineTo(4, -44);
    ctx.stroke();

    // Mizzenmast (at x = -14, rises to y = -28)
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    ctx.moveTo(-14, sternY);
    ctx.lineTo(-14, -28);
    ctx.stroke();

    // Crow's Nest
    ctx.fillStyle = ink;
    ctx.fillRect(1.5, -24, 4.5, 2.2);

    // 5. Sails
    // Main Course
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.lineTo(14, -16);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.quadraticCurveTo(-11, -6, -9, -2);
    ctx.quadraticCurveTo(2, -4, 13, -2);
    ctx.quadraticCurveTo(15, -7, 14, -16);
    ctx.stroke();

    // Main Topsail
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(-6, -32);
    ctx.lineTo(12, -34);
    ctx.stroke();
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-6, -32);
    ctx.quadraticCurveTo(-7, -24, -5, -20);
    ctx.quadraticCurveTo(3, -22, 11, -20);
    ctx.quadraticCurveTo(13, -25, 12, -34);
    ctx.stroke();

    // Mizzen Lateen Sail
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    ctx.moveTo(-22, -4);
    ctx.lineTo(-10, -22);
    ctx.stroke();
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(-22, -4);
    ctx.quadraticCurveTo(-20, -10, -18, -16);
    ctx.lineTo(-10, -22);
    ctx.stroke();

    // 6. Pennants
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(4, -44);
    ctx.lineTo(16, -46);
    ctx.lineTo(13, -43.5);
    ctx.lineTo(16, -41);
    ctx.lineTo(4, -42);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
