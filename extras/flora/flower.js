/** Simplified flowers. */
import * as G from './geom.js';
import * as Color from './color.js';
import { Tune } from './tune.js';

const PI = Math.PI;

const KINDS = {
  fan: { k: 0.56, e: 0.42, claw: 0.50, notch: 0.04, wave: 0.16, freq: 6 },
  round: { k: 0.95, e: 0.50, claw: 0.20, notch: 0.05, wave: 0.07, freq: 3 },
  soft: { k: 0.95, e: 0.50, claw: 0.20, notch: 0.05, wave: 0.07, freq: 3 },
  obovate: { k: 0.72, e: 0.60, claw: 0.46, notch: 0.10, wave: 0.11, freq: 5 },
  ghost: { k: 0.85, e: 0.60, claw: 0.20, notch: 0.06, wave: 0.14, freq: 4 },
  wedge: { wedge: true, shoulder: 0.74, base: 0.06, rise: 1.3, notch: 0.03, wave: 0.12, scallop: 0.035, freq: 6 },
};

function profile(K, t) {
  if (K.wedge) {
    if (t <= K.shoulder) return K.base + (1 - K.base) * Math.sin(PI / 2 * t / K.shoulder) ** K.rise;
    const u = (t - K.shoulder) / (1 - K.shoulder);
    return Math.sqrt(Math.max(0, 1 - u * u));
  }
  return Math.sin(PI * Math.pow(t, K.k)) ** K.e * Math.pow(G.smoothstep(0, K.claw, t), 0.7);
}

function petal(rng, kind, L, Wd, bend, wave) {
  const K = KINDS[kind];
  const n = 26;
  const nl = G.noise(rng, 32), nr = G.noise(rng, 32);
  const al = 1 + rng.jit(0.12), ar = 1 + rng.jit(0.12);
  const left = [], right = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let w = Wd * profile(K, t);
    const y = L * t - K.notch * L * Math.exp(-Math.pow((1 - t) / 0.045, 2));
    const wobble = (wave || K.wave) * Math.pow(t, 1.5);
    const bx = (bend || 0) * L * t * t;
    const wl = w * al * (1 + wobble * nl(t * K.freq * 3));
    const wr = w * ar * (1 + wobble * nr(t * K.freq * 3));
    left.push([bx - wl, y]);
    right.push([bx + wr, y]);
  }
  const out = [...left];
  for (let i = right.length - 2; i >= 1; i--) out.push(right[i]);
  return out;
}

const LOOKS = {
  vivid: { pigment: [0.080, 0.280, 0.780], pool: [0.045, 0.125, 0.470], strength: 1.15 },
  hero: { pigment: [0.080, 0.280, 0.780], pool: [0.045, 0.125, 0.470], strength: 1.15 },
  fan: { pigment: [0.080, 0.280, 0.780], pool: [0.045, 0.125, 0.470], strength: 1.15 },
  soft: { pigment: [0.300, 0.470, 0.830], pool: [0.045, 0.125, 0.470], strength: 0.95 },
  ghost: { pigment: [0.780, 0.850, 0.950], pool: [0.300, 0.470, 0.830], strength: 0.45 },
};

export function pickStyle(rng, names) {
  const w = {};
  for (const n of names) w[n] = Math.max(0, Tune.blooms[n].weight);
  return rng.weighted(w) || names[0];
}

export function bloom(pt, rng, cx, cy, R, o = {}) {
  const st = o.style ? Tune.blooms[o.style] : null;
  const baseKind = o.style === 'soft' ? 'round' : (o.style === 'wedge' ? 'wedge' : (o.style === 'fan' ? 'fan' : 'obovate'));
  const kind = o.kind || baseKind;
  const lookName = o.look || (o.style === 'soft' ? 'soft' : 'vivid');
  const look = LOOKS[lookName];
  const n = o.petals || (st ? rng.int(st.petals[0], st.petals[1]) : 5);
  const width = o.width || (st ? rng.range(st.width[0], st.width[1]) : 0.34);
  const a0 = o.rot !== undefined ? o.rot : rng.range(0, 2 * PI);
  const petals = [];
  for (let i = 0; i < n; i++) {
    const r = rng.fork('petal' + i);
    const a = a0 + i * 2 * PI / n + r.jit(st ? st.spacing : 0.12);
    const L = R * r.range(0.9, 1.05);
    const Wd = R * width * r.range(0.92, 1.08);
    const local = petal(r, kind, L, Wd, r.jit(0.10), st ? st.rim : 0.08);
    const poly = G.transform(local, cx, cy, a - PI / 2);
    petals.push({ poly, a, L });
  }
  for (const pe of petals) {
    const light = [cx, cy];
    const tip = pe.poly.reduce((best, p) => G.dist(p, light) > G.dist(best, light) ? p : best, pe.poly[0]);
    // knockout
    pt.fill(G.smooth(pe.poly, true), pt.paper, 0.9);
    // simple wash
    pt.fill(G.smooth(pe.poly, true), look.pigment, 0.25 * look.strength, { blend: 'multiply' });
    // gradient
    pt.clipBegin(G.smooth(pe.poly, true));
    const [stops] = Color.ramp(rng, lookName, o.part);
    pt.shade(stops, light, tip, pe.L * 1.2);
    // rays: faint white streaks from eye toward rim
    if (st && st.rays && st.rays[1] > 0) {
      const rayCount = rng.int(st.rays[0], st.rays[1]);
      for (let k = 0; k < rayCount; k++) {
        const t = rng.range(st.ray_reach[0], st.ray_reach[1]);
        const q = G.mix(light, tip, t);
        const w = rng.range(0.5, 1.2);
        pt.stroke([G.polyline([light, q])], pt.white, Math.max(0.5, pe.L * 0.018) * w, rng.range(st.ray_contrast[0], st.ray_contrast[1]) * 0.6);
      }
    }
    pt.clipEnd();
    // outline
    if ((o.outline || 0.5) > 0) {
      pt.stroke(G.smooth(pe.poly, true), pt.ink, Math.max(0.25, pe.L * 0.008), o.outline || 0.5, { blend: 'multiply' });
    }
  }
  // eye: white glow + stamens
  const halo = lookName === 'ghost' ? 0.25 : 0.2;
  for (let k = 1; k <= 4; k++) {
    const r = R * halo * (1 - (k - 1) / 5);
    pt.fill([['o', cx, cy, r]], pt.white, 0.18);
  }
  if (lookName !== 'ghost') {
    const stamens = [];
    for (let i = 0; i < 10; i++) {
      const a = i * 2 * PI / 10 + rng.range(0, 0.3);
      const r = R * rng.range(0.06, 0.14);
      stamens.push(['o', cx + r * Math.cos(a), cy + r * Math.sin(a), R * rng.range(0.015, 0.025)]);
    }
    if (stamens.length) pt.fill(stamens, pt.copper, 0.85, { many: true, blend: 'multiply' });
    pt.fill([['o', cx, cy, R * 0.04]], [0.55, 0.26, 0.22], 0.9);
  }
}

export function hero(pt, rng, hero) {
  bloom(pt, rng, hero[0], hero[1], hero[2], {
    style: Tune.hero.style, look: 'hero', petals: Tune.hero.petals,
    width: Tune.hero.petal_width, outline: 0.55,
  });
}

export function florets(pt, items) {
  const tints = [[], [], []];
  const eyes = [];
  for (const f of items) {
    const [x, y, r, rot, tint] = f;
    const bucket = tints[(tint || 2) - 1];
    for (let i = 0; i < 5; i++) {
      const a = (rot || 0) + i * 2 * PI / 5;
      bucket.push([['o', x + 0.55 * r * Math.cos(a), y + 0.55 * r * Math.sin(a), 0.47 * r]]);
    }
    if (r > 0.9) eyes.push([['o', x, y, 0.28 * r]]);
  }
  const cols = [pt.deep, pt.blue, pt.sky];
  for (let i = 0; i < 3; i++) {
    if (tints[i].length) pt.fill(tints[i], cols[i], 0.88, { many: true, blend: 'multiply' });
  }
  if (eyes.length) pt.fill(eyes, pt.white, 0.85, { many: true });
}
