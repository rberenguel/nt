/** Simplified leaves. */
import * as G from './geom.js';
import * as Color from './color.js';
import { Tune } from './tune.js';

const PI = Math.PI;
const STALK = 0.07;

function blade(t, kp, ep) {
  const u = Math.max(0, (t - STALK) / (1 - STALK));
  return 0.035 + 0.965 * Math.sin(PI * Math.pow(u, kp)) ** ep * Math.pow(G.smoothstep(0, 0.32, u), 0.6);
}

export function profile(o, t) {
  return o.shape === 'lance' ? blade(t, 0.55, 1.05) : blade(t, 0.68, 0.85);
}

export function outline(rng, o) {
  const n = Math.max(48, (o.teeth || 0) * 7);
  const spine = G.curve([0, 0], PI / 2, o.len, o.bend || 0, o.hook || 0, n);
  const nz = G.fbm(rng, 32);
  const al = 1 + rng.jit(0.12), ar = 1 + rng.jit(0.12);
  const left = [], right = [];
  for (let i = 0; i < spine.length; i++) {
    const t = i / (spine.length - 1);
    const a = spine[Math.max(i - 1, 0)];
    const b = spine[Math.min(i + 1, spine.length - 1)];
    const nrm = G.angle(a, b) + PI / 2;
    const w = o.width * blade(t, 0.68, 0.85) * (1 + 0.06 * nz(t * 6));
    left.push(G.polar(spine[i], nrm, w * al));
    right.push(G.polar(spine[i], nrm + PI, w * ar));
  }
  const out = [...left];
  for (let i = right.length - 2; i >= 1; i--) out.push(right[i]);
  return [out, spine, left, right];
}

export function options(rng, len, ang) {
  const up = Math.cos(ang) < 0 ? -1 : 1;
  const kind = rng.weighted({ feather: 6, acanthus: 1.5, lance: 2.5 }) || 'lance';
  const droop = rng.chance(0.5);
  const o = {
    len: len * rng.range(0.85, 1.0),
    width: len * rng.range(Tune.compose.leaf_width[0], Tune.compose.leaf_width[1]),
    bend: up * rng.range(0.6, 1.3),
    hook: (droop ? -up : up) * rng.range(0.5, 1.4),
    margin: kind === 'lance' ? 'entire' : kind,
    look: rng.weighted({ vivid: 3, soft: 2 }) || 'vivid',
  };
  if (kind === 'acanthus') {
    o.teeth = rng.int(4, 7); o.depth = rng.range(0.45, 0.75);
    o.width *= 1.25;
  } else if (kind === 'feather') {
    o.teeth = rng.int(6, 10); o.depth = rng.range(0.55, 0.85);
    o.width *= 0.85; o.bend *= 1.25;
  } else {
    o.width *= 0.75; o.bend *= 0.5;
  }
  return o;
}

export function leaf(pt, rng, x, y, ang, o) {
  const [localPts, spine] = outline(rng, o);
  const rot = ang - PI / 2;
  const poly = G.transform(localPts, x, y, rot);
  const spineP = G.transform(spine, x, y, rot);
  const look = o.look === 'soft' ? 'soft' : 'leaf';
  const [stops] = Color.ramp(rng, look, 'leaves');
  const light = spineP[0];
  const tip = spineP[spineP.length - 1];
  // knockout + wash + gradient
  pt.fill(G.smooth(poly, true), pt.paper, 0.9);
  pt.fill(G.smooth(poly, true), [0.080, 0.280, 0.780], 0.2, { blend: 'multiply' });
  pt.clipBegin(G.smooth(poly, true));
  pt.shade(stops, light, tip, o.len * 0.8);
  // wet edge / rim darkening
  pt.stroke(G.smooth(poly, true), pt.deep, o.len * 0.05, 0.12, { blend: 'multiply' });
  // veins: midrib + laterals
  pt.stroke([G.polyline(spineP)], pt.white, Math.max(0.2, o.len * 0.025), 0.55);
  const n = Math.max(3, Math.floor(o.len / 18));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = G.at(spineP, t)[0];
    const side = i % 2 === 0 ? 1 : -1;
    const q = G.polar(p, G.angle(spineP[0], spineP[spineP.length - 1]) + side * rng.range(0.6, 1.0), o.width * 0.7 * Math.sin(PI * t));
    pt.stroke([G.polyline([p, q])], pt.white, Math.max(0.15, o.len * 0.018), 0.35);
  }
  pt.clipEnd();
  pt.stroke(G.smooth(poly, true), pt.ink, Math.max(0.25, o.len * 0.008), 0.75, { blend: 'multiply' });
  return spineP;
}

export function leaflets(pt, rng, items) {
  const bodies = [];
  for (const it of items) {
    const [x, y, ang, len] = it;
    const bend = rng.jit(0.35);
    const wd = len * rng.range(0.17, 0.23);
    const kp = rng.range(0.62, 0.74), ep = rng.range(0.8, 0.95);
    const al = 1 + rng.jit(0.12), ar = 1 + rng.jit(0.12);
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      pts.push([-wd * al * blade(t, kp, ep) + bend * len * t * t, len * t]);
    }
    for (let i = 15; i >= 1; i--) {
      const t = i / 16;
      pts.push([wd * ar * blade(t, kp, ep) + bend * len * t * t, len * t]);
    }
    bodies.push(G.smooth(G.transform(pts, x, y, ang - PI / 2), true));
  }
  if (bodies.length) pt.fill(bodies, [0.080, 0.280, 0.780], 0.8, { many: true, blend: 'multiply' });
}
