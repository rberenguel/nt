/** 2D geometry helpers. Points are [x, y]. */
const PI = Math.PI;

export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
export function dist(p, q) {
  const dx = q[0] - p[0], dy = q[1] - p[1];
  return Math.sqrt(dx * dx + dy * dy);
}
export function angle(p, q) { return Math.atan2(q[1] - p[1], q[0] - p[0]); }
export function polar(p, a, r) { return [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)]; }
export function mix(p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; }

export function transform(pts, ox, oy, ang, sx = 1, sy = sx) {
  const c = Math.cos(ang || 0), s = Math.sin(ang || 0);
  return pts.map(p => {
    const x = p[0] * sx, y = p[1] * sy;
    return [ox + x * c - y * s, oy + x * s + y * c];
  });
}

export function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
    y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
  }
  return [x0, y0, x1, y1];
}

export function area(pts) {
  let a = 0, n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}

export function noise(rng, period = 64) {
  const v = [];
  for (let i = 0; i < period; i++) v[i] = rng.next() * 2 - 1;
  return x => {
    const i = Math.floor(x);
    const f = x - i;
    const a = v[(i % period + period) % period];
    const b = v[((i + 1) % period + period) % period];
    const t = f * f * (3 - 2 * f);
    return a + (b - a) * t;
  };
}

export function fbm(rng, period) {
  const n1 = noise(rng, period), n2 = noise(rng, period * 2);
  return x => 0.7 * n1(x) + 0.3 * n2(x * 2);
}

export function polyline(pts, closed = false) {
  if (!pts.length) return [];
  const cmds = [['m', pts[0][0], pts[0][1]]];
  for (let i = 1; i < pts.length; i++) cmds.push(['l', pts[i][0], pts[i][1]]);
  if (closed) cmds.push(['z']);
  return cmds;
}

export function truncatePts(pts, t) {
  if (t <= 0) return pts.slice(0, 1);
  if (t >= 1) return pts;
  const total = length(pts);
  const target = t * total;
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    if (d + seg >= target) {
      const f = seg > 0 ? (target - d) / seg : 0;
      const out = pts.slice(0, i);
      out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]);
      return out;
    }
    d += seg;
  }
  return pts;
}

export function chaikin(pts, iterations = 2, closed = false) {
  let cur = pts;
  for (let it = 0; it < iterations; it++) {
    const next = [];
    const n = cur.length;
    if (closed) {
      for (let i = 0; i < n; i++) {
        const p0 = cur[i];
        const p1 = cur[(i + 1) % n];
        next.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);
        next.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
      }
    } else {
      next.push(cur[0]);
      for (let i = 0; i < n - 1; i++) {
        const p0 = cur[i];
        const p1 = cur[i + 1];
        next.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);
        next.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
      }
      next.push(cur[n - 1]);
    }
    cur = next;
  }
  return cur;
}

export function smooth(pts, closed = false, tension = 1) {
  const k = tension / 6, n = pts.length;
  if (n < 3) return polyline(pts, closed);
  const at = i => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
  const cmds = [['m', pts[0][0], pts[0][1]]];
  const last = closed ? n : n - 1;
  for (let i = 1; i <= last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    cmds.push(['c',
      p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k,
      p2[0], p2[1]
    ]);
  }
  if (closed) cmds.push(['z']);
  return cmds;
}

export function splinePoints(pts, per = 6) {
  if (pts.length < 2) return [pts[0] ? [...pts[0]] : [0, 0]];
  const at = i => pts[clamp(i, 0, pts.length - 1)];
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
  return out;
}

export function length(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  return L;
}

export function at(pts, t) {
  const total = length(pts);
  let target = clamp(t, 0, 1) * total;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (target <= d || i === pts.length - 1) {
      const f = d > 0 ? clamp(target / d, 0, 1) : 0;
      return [mix(pts[i - 1], pts[i], f), angle(pts[i - 1], pts[i])];
    }
    target -= d;
  }
  return [[...pts[pts.length - 1]], 0];
}

export function resample(pts, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(at(pts, i / (n - 1))[0]);
  return out;
}

export function ribbon(pts, w) {
  const n = pts.length, left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)];
    const ang = angle(a, b) + PI / 2;
    const hw = w(i / (n - 1));
    left[i] = polar(pts[i], ang, hw);
    right[i] = polar(pts[i], ang, -hw);
  }
  const out = [...left];
  for (let i = n - 1; i >= 0; i--) out.push(right[i]);
  return out;
}

export function deform(pts, rng, amp) {
  const nz = noise(rng, pts.length), nz2 = noise(rng, pts.length);
  return pts.map((p, i) => [p[0] + amp * nz(i * 0.35), p[1] + amp * nz2(i * 0.35)]);
}

export function curve(p, ang, len, bend, curl = 0, n = 24) {
  const pts = [[p[0], p[1]]];
  let x = p[0], y = p[1];
  const step = len / n;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const a = ang + bend * t + curl * Math.pow(t, 4);
    x += step * Math.cos(a); y += step * Math.sin(a);
    pts.push([x, y]);
  }
  return pts;
}

export function flow(p, heading, len, kfun) {
  let kmax = 0;
  for (let i = 0; i < 64; i++) kmax = Math.max(kmax, Math.abs(kfun((i + 0.5) / 64)));
  const n = Math.max(8, Math.ceil(len / 1.5), Math.ceil(len * kmax / 0.12));
  const step = len / n;
  let x = p[0], y = p[1], a = heading;
  const pts = [[x, y]];
  for (let i = 1; i <= n; i++) {
    a += kfun((i - 0.5) / n) * step;
    x += step * Math.cos(a); y += step * Math.sin(a);
    pts.push([x, y]);
  }
  return pts;
}

export function curlCoefficient(len, turns, pw) {
  return 2 * PI * turns * (pw + 1) / len;
}

export function bezier(p0, p1, p2, p3, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
              a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return out;
}

export function link(p0, dir0, p1, dir1, k = 0.5, n) {
  const h = dist(p0, p1) * k;
  return bezier(p0, polar(p0, dir0, h), polar(p1, dir1 + PI, h), p1,
    n || Math.max(12, Math.ceil(dist(p0, p1) / 1.2)));
}

export function turn(a, b) {
  let d = (a - b) % (2 * PI);
  if (d > PI) d -= 2 * PI;
  return d;
}

export function depart(p, along, target, bias = 0.3) {
  const want = angle(p, target);
  const fwd = Math.abs(turn(want, along)) <= PI / 2 ? along : along + PI;
  const side = turn(want, fwd) >= 0 ? 1 : -1;
  return fwd + side * bias;
}

export function pursue(p, heading, targetAt, opts) {
  const step = opts.step || 2, kmax = opts.kmax || 1 / 30, dk = opts.dk || 1 / 900;
  const pts = [[p[0], p[1]]];
  let a = heading, k = opts.k0 || 0, s = 0, x = p[0], y = p[1];
  while (s < opts.len) {
    const t = targetAt([x, y], s, a);
    if (!t) break;
    const d = Math.max(1e-6, dist([x, y], t));
    const want = clamp(2 * Math.sin(turn(angle([x, y], t), a)) / d, -kmax, kmax);
    k += clamp(want - k, -dk * step, dk * step);
    a += k * step;
    x += step * Math.cos(a); y += step * Math.sin(a);
    if (opts.stop && opts.stop([x, y])) break;
    pts.push([x, y]);
    s += step;
  }
  return [pts, a];
}

export function follow(guide, ahead = 14, finish = 2) {
  const cum = [0];
  for (let i = 1; i < guide.length; i++) cum[i] = cum[i - 1] + dist(guide[i - 1], guide[i]);
  let j = 1;
  const last = guide[guide.length - 1];
  return q => {
    if (dist(q, last) < finish) return null;
    let best = j, bd = dist(guide[j], q);
    for (let i = j + 1; i <= Math.min(guide.length - 1, j + 40); i++) {
      const d = dist(guide[i], q);
      if (d < bd) { best = i; bd = d; }
    }
    j = best;
    let k = j;
    while (k < guide.length - 1 && cum[k] - cum[j] < ahead) k++;
    return guide[k];
  };
}

export function toward(pts, cx, cy, s) {
  return pts.map(p => [cx + (p[0] - cx) * s, cy + (p[1] - cy) * s]);
}

export function offset(pts, d) {
  return pts.map((p, i) => {
    const a = angle(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]) + Math.PI / 2;
    return polar(p, a, d);
  });
}

export function inside(poly, x, y) {
  let c = false, n = poly.length, j = n - 1;
  for (let i = 0; i < n; i++) {
    const pi = poly[i], pj = poly[j];
    if ((pi[1] > y) !== (pj[1] > y) &&
        x < (pj[0] - pi[0]) * (y - pi[1]) / (pj[1] - pi[1]) + pi[0]) c = !c;
    j = i;
  }
  return c;
}
