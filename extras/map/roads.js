// Procedural Antique Fantasy Cartography — Roads, Thoroughfares & Bridges Engine
// Features:
// 1. Classical antique dashed thoroughfares connecting capitals, towns, ports, and keeps.
// 2. Harmonic topographic curvature skirting mountain slopes and following natural valley paths.
// 3. Stone arch bridges wherever roads traverse river channels.

class RoadNetwork {
  constructor(totalW, totalH, seed = Math.floor(Math.random() * 1000000)) {
    this.totalW = totalW;
    this.totalH = totalH;
    this.seed = seed;
    this.rng = createRNG(seed);
    this.roads = [];   // Array of { points: [{x, y}], isMain: boolean }
    this.bridges = []; // Array of { x, y, angle, width }
  }

  /**
   * Generates road network connecting settlements using a natural regional proximity graph
   * (Minimum Spanning Tree + Relative Neighborhood Graph), eliminating redundant parallel spokes.
   */
  generateRoads(settlements, ridges, riverNetwork, coastEngine = null) {
    this.roads = [];
    this.bridges = [];
    if (!settlements || settlements.length < 2) return;

    const rivers = riverNetwork ? riverNetwork.rivers : [];
    const lakes = riverNetwork ? riverNetwork.lakes : [];

    // Calculate all pairwise candidate edges between settlements
    const edges = [];
    for (let i = 0; i < settlements.length; i++) {
      for (let j = i + 1; j < settlements.length; j++) {
        const s1 = settlements[i];
        const s2 = settlements[j];
        const dist = Math.hypot(s1.x - s2.x, s1.y - s2.y);

        // Strict sea check: if path cuts across open ocean, do NOT connect via overland road!
        if (coastEngine) {
          let oceanHits = 0;
          const numChecks = 10;
          for (let k = 1; k < numChecks; k++) {
            const t = k / numChecks;
            const px = s1.x + (s2.x - s1.x) * t;
            const py = s1.y + (s2.y - s1.y) * t;
            if (coastEngine.isOcean({ x: px, y: py }, 6)) {
              oceanHits++;
            }
          }
          if (oceanHits / numChecks > 0.20) {
            continue; // Sea barrier: cannot traverse open water
          }
        }

        edges.push({ i, j, s1, s2, dist });
      }
    }
    // Sort edges by distance (shortest first)
    edges.sort((a, b) => a.dist - b.dist);

    // 1. Build Minimum Spanning Tree (MST) so all reachable settlements are connected
    const parent = Array.from({ length: settlements.length }, (_, k) => k);
    const find = (x) => {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    };
    const union = (a, b) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) { parent[ra] = rb; return true; }
      return false;
    };

    const connectedPairs = new Set();
    const pairKey = (a, b) => Math.min(a, b) + "_" + Math.max(a, b);

    // Add MST edges
    for (let edge of edges) {
      if (union(edge.i, edge.j)) {
        connectedPairs.add(pairKey(edge.i, edge.j));
        const isMain = edge.s1.type === "city" || edge.s2.type === "city";
        this.traceRoad(edge.s1, edge.s2, ridges, rivers, lakes, coastEngine, isMain);
      }
    }

    // 2. Add selective regional shortcuts using Relative Neighborhood Graph (RNG)
    for (let edge of edges) {
      const k = pairKey(edge.i, edge.j);
      if (connectedPairs.has(k)) continue;
      if (edge.dist > 340) continue; // Keep local

      let isRelativeNeighbor = true;
      for (let m = 0; m < settlements.length; m++) {
        if (m === edge.i || m === edge.j) continue;
        const sM = settlements[m];
        const d1M = Math.hypot(edge.s1.x - sM.x, edge.s1.y - sM.y);
        const d2M = Math.hypot(edge.s2.x - sM.x, edge.s2.y - sM.y);
        if (Math.max(d1M, d2M) < edge.dist) {
          isRelativeNeighbor = false;
          break;
        }
      }

      if (isRelativeNeighbor && this.rng() < 0.45) {
        connectedPairs.add(k);
        this.traceRoad(edge.s1, edge.s2, ridges, rivers, lakes, coastEngine, false);
      }
    }
  }

  traceRoad(s1, s2, ridges, rivers, lakes = [], coastEngine = null, isMain = true) {
    const { rng } = this;
    const dist = Math.hypot(s2.x - s1.x, s2.y - s1.y);
    if (dist < 20) return;

    const numSteps = Math.max(8, Math.floor(dist / 14));
    const rawPoints = [];

    // Collect intermediate waypoints for ridges, lakes, and sea crossings
    const intermediates = [];

    // 1. Check if straight line crosses a mountain ridge; if so, find bypass waypoint
    for (let r of ridges) {
      if (RiverNetwork.segmentsIntersect(s1, s2, { x: r.startX, y: r.startY }, { x: r.endX, y: r.endY })) {
        const dStart = Math.hypot(s1.x - r.startX, s1.y - r.startY) + Math.hypot(s2.x - r.startX, s2.y - r.startY);
        const dEnd   = Math.hypot(s1.x - r.endX,   s1.y - r.endY)   + Math.hypot(s2.x - r.endX,   s2.y - r.endY);
        const ridgeBypass = dStart <= dEnd ? { x: r.startX, y: r.startY } : { x: r.endX, y: r.endY };
        const t = Math.max(0, Math.min(1, ((ridgeBypass.x - s1.x) * (s2.x - s1.x) + (ridgeBypass.y - s1.y) * (s2.y - s1.y)) / (dist * dist)));
        intermediates.push({ pt: ridgeBypass, t });
        break;
      }
    }

    // 2. Check if path cuts through any inland lakes; for each, find shoreline bypass waypoint
    for (let l of lakes) {
      let maxPolyR = l.radius || 48;
      if (l.poly) {
        for (let lp of l.poly) {
          const d = Math.hypot(lp.x - l.x, lp.y - l.y);
          if (d > maxPolyR) maxPolyR = d;
        }
      }
      const lRadius = maxPolyR + 20;

      const l2 = Math.hypot(s2.x - s1.x, s2.y - s1.y) ** 2;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((l.x - s1.x) * (s2.x - s1.x) + (l.y - s1.y) * (s2.y - s1.y)) / l2));
      const closeX = s1.x + t * (s2.x - s1.x);
      const closeY = s1.y + t * (s2.y - s1.y);
      const dToLake = Math.hypot(closeX - l.x, closeY - l.y);

      if (dToLake < lRadius || (l.poly && RiverNetwork.pointInPoly({ x: closeX, y: closeY }, l.poly))) {
        const segAngle = Math.atan2(s2.y - s1.y, s2.x - s1.x);
        const perpX = -Math.sin(segAngle);
        const perpY = Math.cos(segAngle);
        const bypassDist = lRadius + 18;

        const candA = { x: l.x + perpX * bypassDist, y: l.y + perpY * bypassDist };
        const candB = { x: l.x - perpX * bypassDist, y: l.y - perpY * bypassDist };

        const distA = Math.hypot(s1.x - candA.x, s1.y - candA.y) + Math.hypot(s2.x - candA.x, s2.y - candA.y);
        const distB = Math.hypot(s1.x - candB.x, s1.y - candB.y) + Math.hypot(s2.x - candB.x, s2.y - candB.y);

        const chosenBypass = distA <= distB ? candA : candB;
        intermediates.push({ pt: chosenBypass, t });
      }
    }

    // 3. Check if path clips a coastal bay; if so, push waypoint strictly inland
    if (coastEngine) {
      let maxOceanPen = 0;
      let worstPt = null;
      let worstT = 0.5;
      const testSamples = 12;
      for (let s = 1; s < testSamples; s++) {
        const st = s / testSamples;
        const sx = s1.x + (s2.x - s1.x) * st;
        const sy = s1.y + (s2.y - s1.y) * st;
        if (coastEngine.isOcean({ x: sx, y: sy }, 6)) {
          const cp = coastEngine.getNearestCoastPoint(sx, sy);
          const pen = cp ? Math.hypot(sx - cp.x, sy - cp.y) : 20;
          if (pen > maxOceanPen) {
            maxOceanPen = pen;
            worstPt = { x: sx, y: sy };
            worstT = st;
          }
        }
      }

      if (worstPt) {
        const inlandVec = coastEngine.getInlandVector ? coastEngine.getInlandVector() : { x: 0, y: 1 };
        const cp = coastEngine.getNearestCoastPoint(worstPt.x, worstPt.y) || worstPt;

        let chosenInlandBypass = null;
        for (let d of [35, 65, 100, 150, 200]) {
          const cand = { x: cp.x + inlandVec.x * d, y: cp.y + inlandVec.y * d };
          if (
            cand.x > 35 && cand.x < this.totalW - 35 &&
            cand.y > 35 && cand.y < this.totalH - 35 &&
            !coastEngine.isOcean(cand, 18)
          ) {
            chosenInlandBypass = cand;
            break;
          }
        }
        if (chosenInlandBypass) {
          intermediates.push({ pt: chosenInlandBypass, t: worstT });
        }
      }
    }

    // Sort intermediate waypoints naturally along the path from s1 to s2
    intermediates.sort((a, b) => a.t - b.t);

    const waypoints = [s1, ...intermediates.map(i => i.pt), s2];

    for (let w = 0; w < waypoints.length - 1; w++) {
      const pA = waypoints[w];
      const pB = waypoints[w + 1];
      const segDist = Math.hypot(pB.x - pA.x, pB.y - pA.y);
      const segSteps = Math.max(5, Math.floor(segDist / 14));
      const segAngle = Math.atan2(pB.y - pA.y, pB.x - pA.x);
      const perpX = -Math.sin(segAngle);
      const perpY = Math.cos(segAngle);

      for (let i = (w === 0 ? 0 : 1); i <= segSteps; i++) {
        const t = i / segSteps;
        // Natural meandering: subtle curve arch + noise
        const arch = Math.sin(t * Math.PI) * ((rng() - 0.5) * 16);
        const noise = (rng() - 0.5) * 3.5;
        let rx = pA.x + (pB.x - pA.x) * t + perpX * (arch + noise);
        let ry = pA.y + (pB.y - pA.y) * t + perpY * (arch + noise);

        // Strict lake perimeter clearance: push road points completely outward from lake waters
        for (let l of lakes) {
          let maxPolyR = l.radius || 48;
          if (l.poly) {
            for (let lp of l.poly) {
              const d = Math.hypot(lp.x - l.x, lp.y - l.y);
              if (d > maxPolyR) maxPolyR = d;
            }
          }
          const lRadius = maxPolyR + 18;
          let insidePoly = l.poly ? RiverNetwork.pointInPoly({ x: rx, y: ry }, l.poly) : false;
          let dToCenter = Math.hypot(rx - l.x, ry - l.y);

          if (insidePoly || dToCenter < lRadius) {
            const pushAngle = dToCenter > 0.1 ? Math.atan2(ry - l.y, rx - l.x) : Math.PI * 0.25;
            let pushDist = Math.max(dToCenter, lRadius);
            rx = l.x + Math.cos(pushAngle) * pushDist;
            ry = l.y + Math.sin(pushAngle) * pushDist;
            while (l.poly && RiverNetwork.pointInPoly({ x: rx, y: ry }, l.poly) && pushDist < 450) {
              pushDist += 12;
              rx = l.x + Math.cos(pushAngle) * pushDist;
              ry = l.y + Math.sin(pushAngle) * pushDist;
            }
          }
        }

        // Strict ocean / sea clearance: push road points strictly onto dry land along inlandVec
        if (coastEngine && coastEngine.isOcean({ x: rx, y: ry }, 16)) {
          const inlandVec = coastEngine.getInlandVector ? coastEngine.getInlandVector() : { x: 0, y: 1 };
          const cp = coastEngine.getNearestCoastPoint(rx, ry);
          const baseX = cp ? cp.x : rx;
          const baseY = cp ? cp.y : ry;
          let pushD = 22;
          let ix = baseX + inlandVec.x * pushD;
          let iy = baseY + inlandVec.y * pushD;
          while (coastEngine.isOcean({ x: ix, y: iy }, 10) && pushD < 220) {
            pushD += 14;
            ix = baseX + inlandVec.x * pushD;
            iy = baseY + inlandVec.y * pushD;
          }
          rx = ix;
          ry = iy;
        }

        rawPoints.push({ x: rx, y: ry });
      }
    }

    // Detect river crossings and place bridges
    for (let i = 0; i < rawPoints.length - 1; i++) {
      const p1 = rawPoints[i];
      const p2 = rawPoints[i + 1];

      for (let riv of rivers) {
        if (!riv.points || riv.points.length < 2) continue;
        for (let j = 0; j < riv.points.length - 1; j++) {
          const rp1 = riv.points[j];
          const rp2 = riv.points[j + 1];

          if (RiverNetwork.segmentsIntersect(p1, p2, rp1, rp2)) {
            const bx = (p1.x + p2.x) * 0.5;
            const by = (p1.y + p2.y) * 0.5;
            const riverAngle = Math.atan2(rp2.y - rp1.y, rp2.x - rp1.x);
            const riverWidth = rp1.width || 4.0;

            // Avoid duplicate bridges close to each other
            let dup = false;
            for (let b of this.bridges) {
              if (Math.hypot(bx - b.x, by - b.y) < 25) { dup = true; break; }
            }
            if (!dup) {
              this.bridges.push({
                x: bx,
                y: by,
                angle: riverAngle,
                roadAngle: Math.atan2(p2.y - p1.y, p2.x - p1.x),
                width: Math.max(12, riverWidth * 1.6 + 4),
              });
            }
          }
        }
      }
    }

    this.roads.push({ points: rawPoints, isMain });
  }

  draw(ctx, palette, progress = 1.0) {
    if (this.roads.length === 0 || progress <= 0) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 1. Draw dashed road tracks sequentially from city to city
    const totalRoads = this.roads.length;
    const timePerRoad = 1.0 / Math.max(1, totalRoads);

    for (let rIdx = 0; rIdx < totalRoads; rIdx++) {
      const rStart = rIdx * timePerRoad;
      if (progress < rStart) break;

      const rProg = Math.min(1.0, (progress - rStart) / timePerRoad);
      const road = this.roads[rIdx];
      if (road.points.length < 2) continue;

      const maxPts = Math.max(2, Math.floor(road.points.length * rProg));

      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = road.isMain ? 1.15 : 0.85;
      ctx.globalAlpha = road.isMain ? 0.60 : 0.45;
      ctx.setLineDash(road.isMain ? [4, 3] : [3, 2.5]);

      ctx.beginPath();
      ctx.moveTo(road.points[0].x, road.points[0].y);
      for (let i = 1; i < maxPts; i++) {
        ctx.lineTo(road.points[i].x, road.points[i].y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]); // Reset line dash

    // 2. Draw Stone Arch Bridges over rivers as roads advance
    if (this.bridges.length > 0 && progress > 0.25) {
      const bProg = Math.min(1.0, (progress - 0.25) / 0.50);
      const totalBridges = this.bridges.length;
      const visibleBridges = Math.floor(totalBridges * bProg);

      for (let i = 0; i < visibleBridges; i++) {
        const b = this.bridges[i];
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.roadAngle);

        const spanW = b.width;
        const deckH = 6;

        // Opaque paper mask under bridge
        ctx.fillStyle = palette.paper;
        ctx.fillRect(-spanW * 0.5 - 2, -deckH * 0.5 - 1, spanW + 4, deckH + 2);

        // Stone bridge parapets (two parallel ink lines)
        ctx.strokeStyle = palette.ink;
        ctx.lineWidth = 1.3;
        ctx.globalAlpha = 0.85;

        ctx.beginPath();
        // Upper parapet
        ctx.moveTo(-spanW * 0.5, -deckH * 0.5);
        ctx.lineTo(spanW * 0.5, -deckH * 0.5);
        // Lower parapet
        ctx.moveTo(-spanW * 0.5, deckH * 0.5);
        ctx.lineTo(spanW * 0.5, deckH * 0.5);
        ctx.stroke();

        // Stone abutment end ticks
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-spanW * 0.5, -deckH * 0.5 - 1.5);
        ctx.lineTo(-spanW * 0.5, deckH * 0.5 + 1.5);
        ctx.moveTo(spanW * 0.5, -deckH * 0.5 - 1.5);
        ctx.lineTo(spanW * 0.5, deckH * 0.5 + 1.5);
        ctx.stroke();

        ctx.restore();
      }
    }

    ctx.restore();
  }
}
