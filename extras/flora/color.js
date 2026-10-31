/** OKLCH colour utilities and ink ramps. */
import { Tune } from './tune.js';

const cbrt = x => x < 0 ? -Math.pow(-x, 1 / 3) : Math.pow(x, 1 / 3);

function linear(L, Ch, h) {
  const rad = Math.PI * h / 180;
  const a = Ch * Math.cos(rad), b = Ch * Math.sin(rad);
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

function inGamut(L, Ch, h) {
  const [r, g, b] = linear(L, Ch, h);
  const e = 1e-4;
  return r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && b >= -e && b <= 1 + e;
}

export function maxChroma(L, h) {
  let lo = 0, hi = 0.4;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(L, mid, h)) lo = mid; else hi = mid;
  }
  return lo;
}

function encode(c) {
  if (c <= 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export function oklch(L, Ch, h) {
  Ch = Math.min(Ch, maxChroma(L, h));
  const [r, g, b] = linear(L, Ch, h);
  const clamp = v => Math.max(0, Math.min(1, encode(Math.max(0, v))));
  return [clamp(r), clamp(g), clamp(b)];
}

export function rgbToHex([r, g, b]) {
  const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Simplified ink ramps: {name: [[L, a, b], ...]} from dense to pale.
export const Inks = {
  ramps: {
    'kon-peki': [[0.2895, 0.0074, -0.1571], [0.4013, -0.0169, -0.1852], [0.5322, -0.0405, -0.1958], [0.6454, -0.0629, -0.1703], [0.7341, -0.0706, -0.1334], [0.8054, -0.0631, -0.0944], [0.8775, -0.0496, -0.0574], [0.9510, -0.0326, -0.0219]],
    'chiku-rin': [[0.4356, -0.0589, 0.0441], [0.5162, -0.0747, 0.0723], [0.5923, -0.0849, 0.0981], [0.6690, -0.0910, 0.1214], [0.7466, -0.0921, 0.1412], [0.8374, -0.0861, 0.1502], [0.9167, -0.0636, 0.1308], [0.9752, -0.0396, 0.1009]],
    'shin-kai': [[0.2306, 0.0010, -0.1100], [0.3777, 0.0135, -0.1368], [0.4566, 0.0005, -0.1551], [0.5713, -0.0017, -0.1476], [0.6629, -0.0033, -0.1300], [0.7422, -0.0039, -0.1083], [0.8168, -0.0038, -0.0854], [0.8775, -0.0032, -0.0594]],
    'tsuki-yo': [[0.2251, -0.0025, -0.0738], [0.3270, -0.0136, -0.0976], [0.4255, -0.0284, -0.1114], [0.5234, -0.0439, -0.1115], [0.6256, -0.0501, -0.1004], [0.7184, -0.0472, -0.0824], [0.8039, -0.0397, -0.0624], [0.8877, -0.0303, -0.0423]],
  },
  groups: {
    blue: ['kon-peki', 'shin-kai', 'tsuki-yo'],
    green: ['chiku-rin'],
  },
  order: ['kon-peki', 'chiku-rin', 'shin-kai', 'tsuki-yo'],
};

const richest = {};
for (const name in Inks.ramps) {
  const r = Inks.ramps[name];
  let best = -1, bi = 0;
  for (let i = 0; i < r.length; i++) {
    const c = r[i][1] * r[i][1] + r[i][2] * r[i][2];
    if (c > best) { best = c; bi = i; }
  }
  richest[name] = bi;
}

export function inkAt(name, L) {
  const all = Inks.ramps[name];
  const r = all.slice(richest[name]);
  const lo = r[0], hi = r[r.length - 1];
  let a, b;
  if (L <= lo[0]) { a = lo[1]; b = lo[2]; }
  else if (L >= hi[0]) { a = hi[1]; b = hi[2]; }
  else {
    for (let i = 0; i < r.length - 1; i++) {
      const p = r[i], q = r[i + 1];
      if (L >= p[0] && L <= q[0]) {
        const t = (L - p[0]) / Math.max(1e-9, q[0] - p[0]);
        a = p[1] + (q[1] - p[1]) * t;
        b = p[2] + (q[2] - p[2]) * t;
        break;
      }
    }
  }
  return [Math.sqrt(a * a + b * b), (Math.atan2(b, a) * 180 / Math.PI) % 360];
}

export function inkFor(rng, choice) {
  if (!choice || choice === 'look') return null;
  const g = Inks.groups[choice];
  if (g) return rng ? rng.pick(g) : g[0];
  if (Inks.ramps[choice]) return choice;
  return null;
}

export function inkRgb(name, L, share = 1) {
  const [ch, h] = inkAt(name, L);
  return oklch(L, ch * share, h);
}

const PART = { leaf: 'leaves', hero: 'hero', vivid: 'blooms', fan: 'blooms', soft: 'blooms' };

export function ramp(rng, lookName, part) {
  const cfg = Tune.color;
  const lk = cfg.looks[lookName] || cfg.looks.vivid;
  const h = cfg.hue + rng.jit(cfg.hue_jitter);
  const baseL = rng.range(lk.base_l[0], lk.base_l[1]);
  const tipL = rng.range(lk.tip_l[0], lk.tip_l[1]);
  const share = rng.range(lk.chroma[0], lk.chroma[1]);
  const curve = rng.range(lk.curve[0], lk.curve[1]);
  let grey = 1;
  if (lookName === 'leaf' && rng.chance(cfg.grey_chance)) grey = cfg.grey_share;
  const stops = [];
  const ink = inkFor(rng, cfg.palette[part || PART[lookName]]);
  if (ink) {
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const L = baseL + (tipL - baseL) * Math.pow(t, curve);
      stops.push([t, inkRgb(ink, L, grey)]);
    }
    const [ch, ih] = inkAt(ink, tipL);
    return [stops, { h: ih, L: tipL, share: Math.min(1, ch * grey / Math.max(1e-6, maxChroma(tipL, ih))) }];
  }
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const L = baseL + (tipL - baseL) * Math.pow(t, curve);
    const hh = h + cfg.hue_drift * (1 - t);
    const s = share * (0.55 + 0.45 * t) * grey;
    stops.push([t, oklch(L, s * maxChroma(L, hh), hh)]);
  }
  return [stops, { h, L: tipL, share: share * grey }];
}
