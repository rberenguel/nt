/** Simplified sprays and line-work batch. */
import * as G from './geom.js';
import * as Flower from './flower.js';
import { Tune } from './tune.js';

const PI = Math.PI;

export class Batch {
  constructor() {
    this.stems = [];
    this.ribbons = [];
    this.lines = [[], [], []];
    this.florets = [];
    this.buds = [];
  }
  stem(pts, w0, w1) {
    this.stems.push({ pts, wfn: t => (w0 + (w1 - w0) * t) / 2 });
  }
  stemBy(pts, w) {
    this.stems.push({ pts, wfn: t => w(t) / 2 });
  }
  line(pts, cls = 2) { this.lines[cls - 1].push(G.smooth(pts, false)); }
  floret(x, y, r, rot, tint) { this.florets.push([x, y, r, rot, tint]); }
  bud(x, y, ang, len) { this.buds.push([x, y, ang, len]); }

  paint(pt, ink, progress = 1) {
    ink = ink || pt.ink;
    const ribbons = this.ribbons.slice();
    for (const s of this.stems) {
      const partial = progress >= 1 ? s.pts : G.truncatePts(s.pts, progress);
      if (partial.length >= 2) ribbons.push(G.smooth(G.ribbon(G.chaikin(partial, 2, false), s.wfn), true));
    }
    if (ribbons.length) pt.fill(ribbons, ink, 0.92, { many: true, blend: 'multiply' });
    const widths = [0.55, 0.38, 0.26];
    for (let i = 0; i < 3; i++) {
      if (this.lines[i].length) pt.stroke(this.lines[i], ink, widths[i], 0.9, { many: true, blend: 'multiply' });
    }
    for (const b of this.buds) {
      const [x, y, ang, len] = b;
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const w = len * 0.32 * Math.sin(PI * Math.pow(t, 0.7)) ** 0.9;
        pts.push([-w, len * t]);
      }
      for (let i = 15; i >= 1; i--) {
        const t = i / 16;
        const w = len * 0.32 * Math.sin(PI * Math.pow(t, 0.7)) ** 0.9;
        pts.push([w, len * t]);
      }
      pt.fill(G.smooth(G.transform(pts, x, y, ang - PI / 2), true), pt.deep, 0.9, { blend: 'multiply' });
    }
    if (this.florets.length) Flower.florets(pt, this.florets);
  }

  eachPoint(fn) {
    const walk = list => {
      for (const c of list) {
        for (const op of c) {
          if (op[0] === 'm' || op[0] === 'l') fn(op[1], op[2], 0);
          else if (op[0] === 'c') fn(op[5], op[6], 0);
        }
      }
    };
    walk(this.ribbons);
    for (const l of this.lines) walk(l);
    for (const f of this.florets) fn(f[0], f[1], f[2]);
    for (const b of this.buds) fn(b[0], b[1], b[4]);
  }

  merge(other) {
    this.stems.push(...other.stems);
    this.ribbons.push(...other.ribbons);
    for (let i = 0; i < 3; i++) this.lines[i].push(...other.lines[i]);
    this.florets.push(...other.florets);
    this.buds.push(...other.buds);
  }
}

export function tendril(p, ang, len, dir) {
  const c = G.curlCoefficient(len, 1.05, 2.5);
  return G.flow(p, ang, len, t => dir * Math.min(0.25 / len + c * Math.pow(t, 2.5), 1 / 4));
}

export function umbel(b, rng, base, ang, R) {
  const m = rng.int(13, 19);
  const spread = rng.range(2.0, 2.6);
  for (let j = 1; j <= m; j++) {
    const u = (j - 0.5) / m;
    const a = ang - spread / 2 + spread * u + rng.jit(0.05);
    const len = R * (0.72 + 0.28 * Math.cos((u - 0.5) * PI)) * rng.range(0.9, 1.05);
    const ray = G.curve(base, a, len, (u - 0.5) * 0.35, 0, 6);
    b.line(ray, 3);
    const tip = ray[ray.length - 1];
    const k = rng.int(4, 7);
    for (let i = 1; i <= k; i++) {
      const a2 = a - 1.1 + 2.2 * (i - 0.5) / k + rng.jit(0.08);
      const sub = G.curve(tip, a2, R * rng.range(0.13, 0.22), rng.jit(0.3), 0, 3);
      b.line(sub, 3);
      const e = sub[sub.length - 1];
      b.floret(e[0], e[1], R * rng.range(0.020, 0.030), rng.range(0, 2 * PI), rng.chance(0.6) ? 2 : 3);
    }
  }
}

export function cyme(b, rng, base, ang, len, dir) {
  const axis = tendril(base, ang, len, dir);
  b.line(axis, 2);
  const n = axis.length;
  const count = rng.int(7, 11);
  for (let i = 1; i <= count; i++) {
    const t = (i - 0.5) / count;
    const idx = Math.max(2, Math.floor(t * (n - 1)) + 1);
    const p = axis[idx - 1], q = axis[idx];
    const a = G.angle(p, q) + ((i % 2 === 0) ? 1 : -1) * rng.range(0.6, 1.1);
    const size = len * 0.075 * (1.15 - 0.8 * t);
    const ped = G.curve(q, a, size * 1.4, rng.jit(0.4), 0, 3);
    b.line(ped, 3);
    const e = ped[ped.length - 1];
    if (t < 0.72) b.floret(e[0], e[1], size, rng.range(0, 2 * PI), rng.chance(0.35) ? 3 : 2);
    else b.bud(e[0], e[1], a, size * 1.5);
  }
  return axis;
}

export function gypsophila(b, rng, base, ang, len, depth) {
  function branch(p, a, l, d) {
    const pts = G.curve(p, a, l, rng.jit(0.3), 0, 4);
    b.line(pts, d >= depth - 1 ? 2 : 3);
    const e = pts[pts.length - 1];
    const ea = G.angle(pts[pts.length - 2], e);
    if (d === 0) {
      const n = rng.chance(0.7) ? 1 : 2;
      for (let k = 1; k <= n; k++) {
        const q = k === 1 ? e : G.polar(e, ea + rng.jit(1.6), rng.range(2.8, 3.8));
        b.floret(q[0], q[1], rng.range(0.9, 1.5), rng.range(0, 2 * PI),
          rng.weighted({ 1: 0.4, 2: 3, 3: 5 }), true);
      }
      return;
    }
    const spread = 0.25 + 0.45 * (1 - d / depth);
    const kids = rng.chance(0.4) ? 3 : 2;
    for (let k = 1; k <= kids; k++) {
      const off = kids === 2 ? ((k === 1) ? -1 : 1) * spread * rng.range(0.7, 1.2)
        : (k - 2) * spread * rng.range(0.8, 1.2);
      branch(e, ea + off, l * rng.range(0.55, 0.72), d - 1);
    }
  }
  branch(base, ang, len, depth);
}

export function leafletItems(rng, pts, every, len) {
  const items = [];
  const L = G.length(pts);
  const lo = Array.isArray(every) ? every[0] : every;
  const hi = Array.isArray(every) ? every[1] : every;
  let d = 0, i = 0;
  while (true) {
    d += rng.range(lo, hi);
    if (d > L - lo * 0.3) break;
    i++;
    const [p, a] = G.at(pts, (d + rng.jit(0.2) * lo) / L);
    const side = (i % 2 === 0) ? 1 : -1;
    items.push([p[0], p[1], a + side * rng.range(0.5, 0.9), len * (0.7 + 0.6 * rng.next())]);
  }
  return items;
}
