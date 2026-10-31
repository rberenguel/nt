/** Placement of leaves, blooms and sprays. */
import * as G from './geom.js';
import * as L from './leaf.js';
import * as S from './sprig.js';
import * as F from './flower.js';
import * as Plant from './layout.js';
import * as Dist from './dist.js';
import { Tune, mixCfg, scaleDensity } from './tune.js';

const PI = Math.PI;
const REACH = 70;
const DISC_K = 0.85;

function openPath(g, pts) {
  for (let i = 0; i < pts.length; i += 2) if (!g.openAt(pts[i][0], pts[i][1])) return false;
  return true;
}

function leafDiscs(o, p, ang) {
  const spine = G.curve(p, ang, o.len, o.bend, o.hook, 20);
  return [0.2, 0.36, 0.52, 0.68, 0.84].map(t => {
    const q = spine[Math.floor(t * (spine.length - 1) + 0.5)];
    return [q[0], q[1], 0.85 * o.width * L.profile(o, t)];
  });
}

function discsFit(g, discs, k) {
  for (const d of discs) if (g.room(d[0], d[1]) < k * d[2]) return false;
  return true;
}

function nearest(stems, p, maxd) {
  let best = null, bd = maxd;
  for (const s of stems) {
    for (let i = 2; i < s.pts.length - 1; i += 3) {
      const d = G.dist(p, s.pts[i]);
      if (d < bd) { best = s.pts[i]; bd = d; }
    }
  }
  return best;
}

export function nodeLeaves(g, rng, strands, ctx) {
  const cfg = ctx.cfg;
  const sp = cfg.leaf_spacing;
  let failDisc = 0, failPath = 0, ok = 0;
  for (let k = 0; k < strands.length; k++) {
    const st = strands[k];
    const pts = st.pts;
    const total = G.length(pts);
    let side = rng.chance(0.5) ? 1 : -1;
    let d = rng.range(sp[0], sp[1]) * 0.5;
    let n = 0;
    while (d < total - 8 && ctx.leaves.length < cfg.leaves) {
      n++;
      const [p, a] = G.at(pts, d / total);
      const dn = ctx.dens(p[0], p[1]);
      side = -side;
      const ang = a + side * rng.range(0.6, 1.05);
      const len = Math.min(130, ctx.mw * 0.85) * cfg.leaf_size * (0.45 + 0.55 * dn) * Dist.sample(rng, Tune.sizes.leaf);
      const o = L.options(rng, len, ang);
      const discs = leafDiscs(o, p, ang);
      const fits = discsFit(g, discs, 1 - cfg.leaf_overlap);
      const pathOpen = openPath(g, G.transform(leafOutline(rng, o), p[0], p[1], ang - PI / 2));
      if (fits && pathOpen) {
        ok++;
        for (const d_ of discs) g.disc(d_[0], d_[1], d_[2], 1 - cfg.leaf_overlap);
        ctx.leaves.push({ center: [p[0], p[1]], draw: pt => L.leaf(pt, rng, p[0], p[1], ang, o) });
      } else {
        if (!fits) failDisc++; else failPath++;
        const q = G.polar(p, ang, 7);
        const room = g.room(q[0], q[1]);
        if (room >= 4) {
          const size = Math.min(room * 1.6, cfg.leaflet_size * Dist.sample(rng, Tune.sizes.leaflet));
          ctx.leaflets.push([p[0], p[1], ang, size]);
          const c = G.polar(p, ang, size * 0.5);
          g.disc(c[0], c[1], size * 0.3, DISC_K);
        }
      }
      d += rng.range(sp[0], sp[1]) * (1.7 - 0.7 * dn);
    }
  }
  ctx.counts = ctx.counts || {};
  ctx.counts.leafTries = ok + failDisc + failPath;
  ctx.counts.leafFailDisc = failDisc;
  ctx.counts.leafFailPath = failPath;
}

function leafOutline(rng, o) {
  const [localPts] = L.outline(rng, o);
  return localPts;
}

export function tips(g, rng, strands, ctx) {
  const cfg = ctx.cfg;
  for (let k = 0; k < strands.length; k++) {
    const st = strands[k];
    if (!st.tip) continue;
    const [p, a] = st.tip;
    const r = rng.fork('tip' + k);
    const len = Math.min(110, ctx.mw * 0.7) * cfg.leaf_size * Dist.sample(r, Tune.sizes.leaf);
    const o = L.options(r, len, a);
    const discs = leafDiscs(o, p, a);
    if (len >= 20 && cfg.leaves > 0 && discsFit(g, discs, 1 - cfg.leaf_overlap) && openPath(g, G.transform(leafOutline(r, o), p[0], p[1], a - PI / 2))) {
      for (const d of discs) g.disc(d[0], d[1], d[2], 1 - cfg.leaf_overlap);
      ctx.leaves.push({ center: [p[0], p[1]], draw: pt => L.leaf(pt, r, p[0], p[1], a, o) });
    } else {
      const tmp = new S.Batch();
      S.cyme(tmp, r, p, a, r.range(14, 22), r.chance(0.5) ? 1 : -1);
      if (fits(g, tmp)) {
        ctx.sprays.merge(tmp);
        g.disc(p[0], p[1], 8, DISC_K);
      }
    }
  }
}

function fits(g, b) {
  let ok = true;
  b.eachPoint((x, y, r) => {
    if (!ok) return;
    if (!(g.openAt(x, y) && g.openAt(x - r, y) && g.openAt(x + r, y) && g.openAt(x, y - r) && g.openAt(x, y + r))) ok = false;
  });
  return ok;
}

function growSpray(b, rng, kind, s, tangent, d, x, y, r, scale) {
  const target = [x, y];
  const chord = G.angle(s, target);
  const dir0 = G.depart(s, tangent, target, 0.35);
  const a = chord + G.turn(chord, dir0) * 0.6;
  const base = G.polar(s, chord, Math.max(d - r * 0.55, 3));
  const stalk = G.link(s, dir0, base, a);
  b.line(stalk, d > 30 ? 2 : 3);
  r *= scale;
  if (kind === 'gyps') S.gypsophila(b, rng, base, a, r * 0.5, r >= 14 ? 5 : (r >= 8 ? 4 : 3));
  else if (kind === 'cyme') S.cyme(b, rng, base, a, r * 1.25, rng.chance(0.5) ? 1 : -1);
  else if (kind === 'umbel') S.umbel(b, rng, base, a, r * 0.85);
  return stalk;
}

function buildReachMap(g, stems, maxd) {
  const nx = g.nx, ny = g.ny, c = g.c;
  const sd = new Float32Array(nx * ny).fill(Infinity);
  const sx = new Float32Array(nx * ny);
  const sy = new Float32Array(nx * ny);
  const st = new Int16Array(nx * ny).fill(-1);
  for (const stem of stems) {
    for (let i = 2; i < stem.pts.length - 1; i += 3) {
      const p = stem.pts[i];
      const i0 = Math.max(0, Math.floor((p[0] - maxd) / c));
      const i1 = Math.min(nx - 1, Math.floor((p[0] + maxd) / c));
      const j0 = Math.max(0, Math.floor((p[1] - maxd) / c));
      const j1 = Math.min(ny - 1, Math.floor((p[1] + maxd) / c));
      for (let j = j0; j <= j1; j++) {
        const dy = (j + 0.5) * c - p[1];
        for (let i = i0; i <= i1; i++) {
          const dx = (i + 0.5) * c - p[0];
          const d = Math.sqrt(dx * dx + dy * dy);
          const k = j * nx + i;
          if (d < sd[k]) { sd[k] = d; sx[k] = p[0]; sy[k] = p[1]; st[k] = 0; }
        }
      }
    }
  }
  return { sd, sx, sy, stems };
}

function nearestFrom(map, x, y) {
  const k = Math.floor(y / map.c) * map.nx + Math.floor(x / map.c);
  if (map.sd[k] >= REACH) return null;
  return [map.sx[k], map.sy[k]];
}

export function holes(g, rng, ctx) {
  const cfg = ctx.cfg;
  const map = buildReachMap(g, ctx.stems, REACH);
  const kinds = [
    { kind: 'bloom', w: 3, cap: cfg.small_blooms, rmin: 9, rmax: ctx.mw * 0.13 },
    { kind: 'soft', w: 1.5, cap: 2, rmin: 10, rmax: ctx.mw * 0.12 },
    { kind: 'umbel', w: 1.6, cap: 3, rmin: 12, rmax: ctx.mw * 0.19 },
    { kind: 'cyme', w: 3, rmin: 7, rmax: 22, spray: true },
    { kind: 'gyps', w: 4, rmin: 5, rmax: 30, spray: true },
  ];
  const counts = {};
  const rejected = new Set();
  // Candidate cells: within reach of a stem and above minimum clearance.
  let candidates = [];
  for (let k = 0; k < ctx.g.nx * ctx.g.ny; k++) {
    if (map.sd[k] < REACH && ctx.g.f[k] >= cfg.hole_min) candidates.push(k);
  }
  // Sort by clearance descending so the largest holes are tried first.
  candidates.sort((a, b) => ctx.g.f[b] - ctx.g.f[a]);

  for (let iter = 0; iter < 300 && candidates.length; iter++) {
    let best = -1, bi = null, bx, by;
    // Walk candidates; skip rejected and those no longer valid.
    while (candidates.length) {
      const k = candidates[0];
      if (rejected.has(k) || ctx.g.f[k] < cfg.hole_min) { candidates.shift(); continue; }
      const x = (k % ctx.g.nx + 0.5) * ctx.g.c;
      const y = (Math.floor(k / ctx.g.nx) + 0.5) * ctx.g.c;
      const floor = cfg.hole_min * (1 + 1.4 * (1 - ctx.dens(x, y)));
      if (ctx.g.f[k] >= floor) { best = ctx.g.f[k]; bi = k; bx = x; by = y; break; }
      candidates.shift();
    }
    if (bi === null) break;
    rejected.add(bi);
    candidates.shift();

    const s = nearest(ctx.stems, [bx, by], REACH);
    if (!s) continue;
    const sd = G.dist(s, [bx, by]);
    const elig = kinds.filter(m => {
      const n = counts[m.kind] || 0;
      return best >= m.rmin && (!m.cap || n < m.cap) && (!m.spray || ctx.sprayCount < cfg.sprays);
    });
    if (!elig.length) continue;
    const pick = rng.pick(elig);
    const r = Math.min(pick.rmax, best * 0.95);
    if (pick.spray || pick.kind === 'umbel') {
      const tmp = new S.Batch();
      growSpray(tmp, rng, pick.kind, s, G.angle(s, [bx, by]), sd, bx, by, r, 1);
      if (fits(g, tmp)) {
        ctx.sprays.merge(tmp);
        g.disc(bx, by, r, DISC_K);
        counts[pick.kind] = (counts[pick.kind] || 0) + 1;
        if (pick.spray || pick.kind === 'umbel') ctx.sprayCount++;
      }
    } else {
      const chord = G.angle(s, [bx, by]);
      const dir0 = G.depart(s, G.angle(s, [bx, by]), [bx, by], 0.35);
      const base = G.polar(s, chord, Math.max(sd - r * 0.45, 3));
      const stalk = G.link(s, dir0, base, chord + G.turn(chord, dir0) * 0.6);
      if (openPath(g, stalk)) {
        ctx.stem_batch.stem(stalk, 0.7, 0.4);
        g.disc(bx, by, r, DISC_K);
        if (pick.kind === 'soft') {
          ctx.blooms.push({ center: [bx, by], draw: pt => F.bloom(pt, rng, bx, by, r * 0.8, { style: 'soft' }) });
        } else {
          const style = F.pickStyle(rng, ['fan', 'round']);
          ctx.blooms.push({ center: [bx, by], draw: pt => F.bloom(pt, rng, bx, by, r * 0.8, { style }) });
        }
        counts[pick.kind] = (counts[pick.kind] || 0) + 1;
      }
    }
  }
}

export function details(g, rng, ctx) {
  const cfg = ctx.cfg;
  let made = 0;
  const rejected = new Set();
  // Precompute candidates with clearance in [3.5, 22].
  let candidates = [];
  for (let k = 0; k < ctx.g.nx * ctx.g.ny; k++) {
    const fk = ctx.g.f[k];
    if (fk >= 3.5 && fk < 22) candidates.push(k);
  }
  candidates.sort((a, b) => ctx.g.f[b] - ctx.g.f[a]);

  for (let iter = 0; iter < 200 && candidates.length; iter++) {
    if (made >= cfg.sprays) break;
    while (candidates.length && (rejected.has(candidates[0]) || ctx.g.f[candidates[0]] < 3.5)) candidates.shift();
    if (!candidates.length) break;
    const bi = candidates[0];
    const best = ctx.g.f[bi];
    candidates.shift();
    rejected.add(bi);
    if (best >= 22) continue;
    const bx = (bi % ctx.g.nx + 0.5) * ctx.g.c;
    const by = (Math.floor(bi / ctx.g.nx) + 0.5) * ctx.g.c;
    if (rng.next() < ctx.dens(bx, by)) {
      const s = nearest(ctx.stems, [bx, by], 25);
      if (!s) continue;
      const sd = G.dist(s, [bx, by]);
      const kind = best >= 6 ? (rng.chance(0.6) ? 'gyps' : 'cyme') : 'cyme';
      const tmp = new S.Batch();
      growSpray(tmp, rng, kind, s, G.angle(s, [bx, by]), sd, bx, by, best, 1);
      if (fits(g, tmp)) {
        ctx.sprays.merge(tmp);
        g.disc(bx, by, best, DISC_K);
        made++;
      }
    }
  }
}
