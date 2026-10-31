/** Simplified brushwork and stem rendering. */
import * as G from './geom.js';
import * as Color from './color.js';
import { Tune } from './tune.js';

export function polygon(poly) {
  const cmds = [['m', poly[0][0], poly[0][1]]];
  for (let i = 1; i < poly.length; i++) cmds.push(['l', poly[i][0], poly[i][1]]);
  cmds.push(['z']);
  return cmds;
}

export function broken(rng, line, wmax, gap, dry) {
  const pts = G.resample(line, 32);
  const nz = G.noise(rng, 16);
  const phase = rng.range(0, 16);
  const out = [];
  let t = rng.range(0, 0.12);
  while (t < 0.95) {
    const t1 = Math.min(1, t + rng.range(0.14, 0.5) * (1 - 0.6 * gap));
    const i0 = Math.max(1, Math.floor(t * (pts.length - 1)) + 1);
    const i1 = Math.min(pts.length, Math.ceil(t1 * (pts.length - 1)) + 1);
    const seg = pts.slice(i0 - 1, i1);
    if (seg.length >= 2) {
      const a = t, b = t1;
      const wfn = u => {
        const tt = a + (b - a) * u;
        const taper = G.smoothstep(0, 0.12, tt) * Math.pow(1 - tt, 0.7);
        const ends = Math.sin(Math.PI * G.clamp(u, 0, 1)) ** 0.6;
        const swell = 0.5 + 0.5 * nz(phase + tt * 9);
        return wmax * taper * ends * (0.2 + swell);
      };
      if (rng.chance(dry)) {
        const k = rng.int(2, 3);
        for (let j = 1; j <= k; j++) {
          const d = (j - (k + 1) / 2) * wmax * 0.9;
          out.push(G.ribbon(G.offset(seg, d), u => wfn(u) * rng.range(0.25, 0.45)));
        }
      } else {
        out.push(G.ribbon(seg, wfn));
      }
    }
    t = t1 + rng.range(0.02, 0.12) * gap * 2.5;
  }
  return out;
}

function offset(pts, d) {
  return pts.map((p, i) => {
    const a = G.angle(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]) + Math.PI / 2;
    return G.polar(p, a, d);
  });
}

export function stemTone() {
  const h = Tune.color.hue;
  const choice = Tune.color.palette.stems;
  const ink = Color.inkFor(null, choice);
  if (ink) return Color.inkRgb(ink, Tune.plant.stem_l);
  return Color.oklch(Tune.plant.stem_l, 0.85 * Color.maxChroma(Tune.plant.stem_l, h), h);
}

export function stem(pt, rng, pts, wfn) {
  const outline = G.smooth(G.ribbon(pts, t => wfn(t) / 2), true);
  const tone = stemTone();
  pt.fill(outline, tone, 0.8, { blend: 'multiply' });
  if (Tune.plant.stem_brush <= 0) return;
  const line = G.resample(pts, Math.max(8, Math.floor(G.length(pts) / 3)));
  let wmax = 0;
  for (let i = 0; i <= 10; i++) wmax = Math.max(wmax, wfn(i / 10));
  pt.clipBegin(outline);
  let pieces = broken(rng, offset(line, -0.22), wmax * 0.32, 0.3, 0.2);
  let cmds = pieces.map(p => polygon(p));
  if (cmds.length) pt.fill(cmds, [tone[0] * 0.7, tone[1] * 0.7, tone[2] * 0.9], 0.5, { many: true, blend: 'multiply' });
  pieces = broken(rng, offset(line, 0.24), wmax * 0.16, 0.45, 0.3);
  cmds = pieces.map(p => polygon(p));
  if (cmds.length) pt.fill(cmds, pt.white, 0.4, { many: true });
  pt.clipEnd();
}
