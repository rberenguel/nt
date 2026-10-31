/** Minimal gilt ornaments: compass star and edge chain. */
import * as G from './geom.js';

const PI = Math.PI;

function tri(a, b, c) {
  return [['m', a[0], a[1]], ['l', b[0], b[1]], ['l', c[0], c[1]], ['z']];
}

export function compass(pt, x, y, R) {
  const lit = [], shade = [];
  for (let k = 0; k < 8; k++) {
    const a = k * PI / 4 + PI / 2;
    const major = k % 2 === 0;
    const len = major ? R : R * 0.48;
    const half = major ? 0.11 : 0.13;
    const tip = G.polar([x, y], a, len);
    const l = G.polar([x, y], a + PI / 4, len * half);
    const r = G.polar([x, y], a - PI / 4, len * half);
    lit.push(tri([x, y], tip, l));
    shade.push(tri([x, y], tip, r));
  }
  pt.stroke([G.polyline([[x, y - R * 1.7], [x, y + R * 1.7]]), G.polyline([[x - R * 1.7, y], [x + R * 1.7, y]])], pt.gold, 0.22, 0.75, { many: true });
  pt.fill(shade, pt.copper, 0.95, { many: true });
  pt.fill(lit, pt.gold, 0.95, { many: true });
  pt.fill([['o', x, y, R * 0.07]], pt.cream, 1);
  pt.stroke([['o', x, y, R * 0.07]], pt.copper, 0.2, 0.9);
  const dots = [];
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) * 2 * PI / 8 + PI / 2;
    const p = G.polar([x, y], a, R * 0.62);
    dots.push(['o', p[0], p[1], R * 0.035]);
  }
  if (dots.length) pt.fill(dots, pt.gold, 0.9, { many: true });
}

export function chain(pt, rng, x, ytop, ybot) {
  const dots = [];
  for (let y = ytop; y > ybot; y -= 5) {
    dots.push(['o', x, y, 0.55]);
  }
  if (dots.length) pt.fill(dots, pt.gold, 0.85, { many: true });
}
