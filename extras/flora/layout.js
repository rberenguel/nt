/** Page planning: region, gesture, strands. */
import * as G from './geom.js';
import { Space } from './space.js';
import { Tune } from './tune.js';

export function region(spec) {
  const W = spec.width, H = spec.height, t = spec.text;
  const edge = spec.edge || 16;
  const gutter = spec.gutter || 9;
  const g = new Space(W, H, 3);
  const m = {
    x0: edge, x1: t.x0 - gutter,
    y0: edge + 4, y1: H - edge - 6,
    foot: t.y0 - gutter * 0.8,
  };
  g.open(m.x0, m.y0, m.x1, m.y1);
  g.open(m.x0, m.y0, W - edge, m.foot);
  g.open(t.x1 + 5, m.y0, W - edge * 0.6, t.y0 + (t.y1 - t.y0) * 0.22);
  if (spec.lines && spec.lines.length) {
    for (const l of spec.lines) g.blockText(l.x0 - 4, l.y0 - 3, l.x1 + 4, l.y1 + 3);
  }
  if (spec.header_y) g.blockText(t.x0 - 4, spec.header_y - 4, t.x1, spec.header_y + 12);
  if (spec.closed) for (const r of spec.closed) g.close(r[0], r[1], r[2], r[3]);
  return [g, m];
}

export function cartoucheSize(mw, k = 1) {
  return [
    G.clamp(mw * 0.27 * k, 16, 48),
    G.clamp(mw * 0.365 * k, 22, 66),
  ];
}

export function gesture(rng, m, hero) {
  const cfg = Tune.gesture;
  const mw = m.x1 - m.x0;
  const lo = m.y0 + mw * 0.75 + 40;
  const hi = hero[1] - hero[2] * 1.2;
  const n = cfg.bows;
  const band = (hi - lo) / n;
  const bows = [], quiet = [];
  for (let i = 1; i <= n; i++) {
    bows.push({
      y: lo + band * (i - 0.5 + rng.jit(0.18)),
      amp: mw * rng.range(cfg.bow_amp[0], cfg.bow_amp[1]),
      h: band * rng.range(cfg.bow_width[0], cfg.bow_width[1]),
    });
    if (i > 1) quiet.push((bows[i - 2].y + bows[i - 1].y) / 2);
  }
  const edge = m.x0 + mw * cfg.edge;
  const clusters = [
    [hero[0], hero[1], hero[2] * cfg.end_reach],
    [m.x0 + mw * 0.6, m.y0 + 30, 110 * cfg.end_reach / 2.2],
    [m.x0 + mw * 0.35, m.y0 + mw * 0.9, mw * 0.6],
  ];
  for (const b of bows) clusters.push([edge + b.amp * 0.7, b.y, band * 0.32, cfg.bow_density]);
  const floor = cfg.density_floor;
  return {
    edge, bows, quiet,
    bow(y, dy = 0, gain) {
      let x = 0;
      for (let i = 0; i < bows.length; i++) {
        const b = bows[i];
        const u = (y - b.y - dy) / b.h;
        if (Math.abs(u) < 1) x += b.amp * (gain ? gain[i] : 1) * 0.5 * (1 + Math.cos(Math.PI * u));
      }
      return x;
    },
    density(x, y) {
      let best = 0;
      for (const c of clusters) {
        const dx = (x - c[0]) / c[2], dy_ = (y - c[1]) / c[2];
        best = Math.max(best, (c[3] || 1) * Math.exp(-(dx * dx + dy_ * dy_)));
      }
      return floor + (1 - floor) * best;
    },
  };
}

function clearOf(box, q, gap, ease = 60) {
  if (!box) return q;
  const push = G.smoothstep(box[1] - 12 - ease, box[1] - 12, q[1]) *
    (1 - G.smoothstep(box[3] + 12, box[3] + 12 + ease, q[1]));
  const need = box[2] + gap - q[0];
  if (need <= 0 || push <= 0) return q;
  return [q[0] + need * push, q[1]];
}

function stem(pts, w0, w1) {
  const cum = [0]; let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += G.dist(pts[i - 1], pts[i]);
    cum[i] = total;
  }
  return { pts, cum, len: Math.max(total, 1e-9), w0, w1, forks: [] };
}

function widthAt(st, s) {
  const t = G.clamp(s / st.len, 0, 1);
  let w = st.w0 + (st.w1 - st.w0) * t;
  for (const f of st.forks) {
    const u = G.smoothstep(f.s - 2, f.s + 6, s);
    w *= (1 - u + u * f.keep);
  }
  return Math.max(w, st.min || 0.35);
}

function widthFn(st) { return t => widthAt(st, t * st.len); }

function forkAt(st, t, cw, floor = 0.82) {
  const s = t * st.len;
  const w = widthAt(st, s);
  const r = G.clamp(cw / w, 0, 0.95);
  st.forks.push({ s, keep: Math.max(floor, Math.sqrt(1 - r * r)) });
  return w;
}

function atStem(st, s) {
  s = G.clamp(s, 0, st.len);
  let i = 1;
  while (i < st.pts.length - 1 && st.cum[i] < s) i++;
  const a = st.pts[i - 1], b = st.pts[i];
  const u = (s - st.cum[i - 1]) / Math.max(1e-9, st.cum[i] - st.cum[i - 1]);
  return [G.mix(a, b, u), G.angle(a, b), i];
}

function avoiding(follow, box) {
  if (!box) return follow;
  return (q, s, a) => {
    const t = follow(q, s, a);
    if (!t) return null;
    for (const d of [15, 35, 60, 100]) {
      const f = G.polar(q, a, d);
      if (f[0] < box[2] + 6 && f[1] > box[1] - 6 && f[1] < box[3] + 6) return [box[2] + 16, f[1] + 10];
    }
    return t;
  };
}

export function mainStem(rng, m, hero, W, gest, avoid) {
  const cfg = Tune.plant;
  const mw = m.x1 - m.x0;
  const R = mw * 0.32;
  const footy = m.y0 + 6;
  const xr = gest.edge;
  const rise_y = footy + R;
  const pts = [];
  const period = rng.range(120, 170);
  let x = W * cfg.root;
  while (x > xr + R + 12) {
    const ramp = G.smoothstep(xr + R, xr + R + 60, x);
    pts.push([x, footy + 4 * ramp * Math.sin(1 + 2 * Math.PI * x / period)]);
    x -= 20;
  }
  for (let i = 0; i <= 10; i++) {
    const th = -Math.PI / 2 - (Math.PI / 2) * i / 10;
    pts.push([xr + R + R * Math.cos(th), rise_y + R * Math.sin(th)]);
  }
  const sway_len = rng.range(300, 400);
  const amp = mw * rng.range(0.015, 0.03);
  const cap = [G.clamp(hero[0] - hero[2] * 0.1, m.x0 + 4, m.x1 - 4), hero[1] - hero[2] * 0.15];
  const pull_from = cap[1] - Math.max(hero[2] * 2.4, 90);
  let y = rise_y + 16;
  while (y < cap[1] - 12) {
    const ramp = G.smoothstep(rise_y, rise_y + 80, y);
    const sway = Math.sin(2 * Math.PI * (y - rise_y) / sway_len);
    let gx = xr + ramp * (amp * sway + gest.bow(y, 0));
    gx += (cap[0] - gx) * G.smoothstep(pull_from, cap[1], y);
    pts.push(clearOf(avoid, [gx, y], 9));
    y += 12;
  }
  pts.push(cap);
  const kmax = 1 / cfg.bend_radius;
  const targetAt = avoiding(G.follow(pts, cfg.lookahead, 14), avoid);
  const grown = G.pursue(pts[0], G.angle(pts[0], pts[1]), targetAt, {
    len: G.length(pts) * 1.3, kmax, dk: kmax / cfg.bend_ease, step: 2,
  });
  const pts2 = grown[0];
  const tail = pts2[pts2.length - 1];
  const a = G.angle(pts2[pts2.length - 2], tail);
  const link = G.link(tail, a, cap, G.angle(cap, [hero[0], hero[1]]), 0.45);
  for (let i = 1; i < link.length; i++) pts2.push(link[i]);
  const st = stem(pts2, cfg.root_width, cfg.root_width * 0.8);
  st.main = true; st.min = cfg.tip_width;
  return [st, [xr, rise_y], cap];
}

export function longShoots(rng, main, m, hero, gest, avoid) {
  const cfg = Tune.plant;
  const mw = m.x1 - m.x0;
  const out = [];
  let bow_max = 1e-9;
  for (const b of gest.bows) bow_max = Math.max(bow_max, b.amp);
  let rise0 = main.len;
  for (let s = 0; s < main.len; s += 4) {
    if (atStem(main, s)[0][1] > m.y0 + mw * 0.5) { rise0 = s; break; }
  }
  let rise1 = main.len;
  for (let s = main.len; s >= 0; s -= 4) {
    if (atStem(main, s)[0][1] < hero[1] - hero[2] * 0.7) { rise1 = s; break; }
  }
  const span = Math.max(1, rise1 - rise0);
  const n = cfg.long_shoots;
  for (let k = 1; k <= n; k++) {
    const r = rng.fork('long' + k);
    const ss = cfg.shoot_start, se = cfg.shoot_end;
    const s0 = Math.max(main.len * 0.15, rise0 + span * r.range(ss[0], ss[1]));
    const f = G.clamp((k - 0.5 + r.jit(0.3)) / n + 0.5 / n, 0, 1);
    const s1 = Math.min(rise1, Math.max(s0 + 60, rise0 + span * (se[0] + (se[1] - se[0]) * f)));
    const A = mw * r.range(cfg.shoot_reach[0], cfg.shoot_reach[1]);
    const wave = r.range(cfg.shoot_wave[0], cfg.shoot_wave[1]);
    const side = (k % 2 === 0) ? 1 : -1;
    const ph = r.range(0, 0.5);
    const pv = atStem(main, s0 + (s1 - s0) * 0.65)[0];
    const veer = (pv[0] - m.x0 > m.x1 - pv[0]) ? 1 : -1;
    const gpts = [];
    for (let s = s0 + 6; s < s1; s += 8) {
      const [p, a] = atStem(main, s);
      const u = s - s0;
      const env = 0.5 + 0.5 * G.clamp(gest.bow(p[1], 0) / bow_max, 0, 1);
      let off = side * A * env * G.smoothstep(0, 50, u) * Math.sin(2 * Math.PI * (ph + u / wave));
      off += veer * A * 1.4 * G.smoothstep(0.65, 1, u / (s1 - s0));
      const upright = G.smoothstep(0.3, 0.7, Math.abs(Math.sin(a)));
      const dx = (Math.cos(a + Math.PI / 2) >= 0 ? 1 : -1) * off * upright;
      const q = clearOf(avoid, [p[0] + dx, p[1]], 6, 150);
      gpts.push([G.clamp(q[0], m.x0 + 6, m.x1 - 6), q[1]]);
    }
    if (gpts.length >= 4) {
      const [p0, a0] = atStem(main, s0);
      const kmax = 1 / (cfg.bend_radius * 0.6);
      const ahead = Math.min(cfg.lookahead * 0.7, wave * 0.12);
      const grown = G.pursue(p0, a0 + side * 0.08, avoiding(G.follow(gpts, ahead, 10), avoid), {
        len: (s1 - s0) * 1.3, kmax, dk: kmax / (cfg.bend_ease * 0.7), step: 2,
        stop: q => q[0] > m.x1 - 3 || q[0] < m.x0 + 2,
      });
      if (grown[0].length >= 6) {
        const w = forkAt(main, s0 / main.len, cfg.root_width * cfg.fork_ratio, 0.75);
        const st = stem(grown[0], w * cfg.fork_ratio, 0.35);
        st.min = 0.3; st.kind = 'long';
        st.tip = [grown[0][grown[0].length - 1], grown[1]];
        out.push(st);
      }
    }
  }
  return out;
}

export function footShoots(rng, main, m, corner, avoid) {
  const cfg = Tune.plant;
  const out = [];
  const inside = [corner[0] + (m.x1 - m.x0) * 0.6, corner[1] + 60];
  const s_end = main.len * 0.3;
  for (let k = 1; k <= cfg.foot_shoots; k++) {
    const r = rng.fork('foot' + k);
    const s0 = s_end * (k - 0.6 + r.jit(0.25)) / cfg.foot_shoots;
    const [p0, a0] = atStem(main, s0);
    const nx = Math.cos(a0 + Math.PI / 2), ny = Math.sin(a0 + Math.PI / 2);
    const sign = (nx * (inside[0] - p0[0]) + ny * (inside[1] - p0[1]) >= 0) ? 1 : -1;
    const len = r.range(cfg.foot_reach[0], cfg.foot_reach[1]);
    const target = G.polar(p0, a0 + sign * r.range(0.55, 0.95), len);
    const kmax = 1 / cfg.shoot_bend;
    const grown = G.pursue(p0, a0 + sign * 0.1, q => G.dist(q, target) < 4 ? null : target, {
      len: len * 1.6, kmax, dk: kmax / 20, step: 1.5,
      stop: q => (q[0] > m.x1 - 4 && q[1] > m.foot - 8) || q[0] < m.x0 + 3 || q[1] < m.y0 - 2 ||
        (avoid && q[0] <= avoid[2] + 2 && q[1] >= avoid[1] - 2 && q[1] <= avoid[3] + 2),
    });
    if (grown[0].length >= 8) {
      const w = forkAt(main, s0 / main.len, 1.0, 0.9);
      const st = stem(grown[0], Math.min(1.1, w * 0.4), 0.3);
      st.min = 0.3; st.kind = 'foot';
      st.tip = [grown[0][grown[0].length - 1], grown[1]];
      out.push(st);
    }
  }
  return out;
}

export function crownShoots(rng, main, m, hero) {
  const cfg = Tune.plant;
  const R = hero[2];
  let s0 = main.len;
  for (let s = main.len; s >= 0; s -= 2) {
    if (atStem(main, s)[1] < hero[1] - R * 1.5) { s0 = s; break; }
  }
  const out = [];
  for (let k = 0; k < 2; k++) {
    const side = k === 0 ? -1 : 1;
    const r = rng.fork('crown' + k);
    const s = Math.max(0, s0 - r.range(0, R * 0.9));
    const [p0, a0] = atStem(main, s);
    const ta = (side < 0 ? Math.PI : 0) - side * r.range(0.15, 0.55);
    let to = G.polar(hero, ta, R * r.range(0.85, 0.95));
    to[0] = G.clamp(to[0], m.x0 + 4, m.x1 - 4);
    const pts = G.link(p0, a0 - side * 0.55, to, Math.PI / 2 - side * 0.5, 0.6);
    let clear = true;
    for (const q of pts) if (G.dist(q, hero) < R * 0.7) clear = false;
    if (clear && pts.length >= 6) {
      const w = forkAt(main, s / main.len, cfg.root_width * cfg.fork_ratio * 0.6, 0.75);
      const st = stem(pts, w * 0.7, 0.35);
      st.min = 0.3; st.kind = 'crown';
      st.tip = [pts[pts.length - 1], G.angle(pts[pts.length - 2], pts[pts.length - 1])];
      out.push(st);
    }
  }
  return out;
}

export function runners(rng, m, root, W, edge) {
  const cx = W - edge - 6;
  const a = root;
  const b = [cx, m.y0 + 70];
  const stemPts = G.link(a, 0.05, b, Math.PI / 2 + 0.08, 0.6);
  // simplified tendril tip
  return [{ pts: stemPts, width: t => 0.8 - 0.6 * t }];
}

export function strands(rng, m, hero, W, gest, avoid) {
  const [main, corner] = mainStem(rng.fork('main'), m, hero, W, gest, avoid);
  const out = [main];
  for (const st of longShoots(rng.fork('shoots'), main, m, hero, gest, avoid)) out.push(st);
  for (const st of footShoots(rng.fork('foot shoots'), main, m, corner, avoid)) out.push(st);
  for (const st of crownShoots(rng.fork('crown'), main, m, hero)) out.push(st);
  for (const st of out) st.width = widthFn(st);
  return [out, corner, gest];
}

export { stem, widthAt, widthFn, forkAt as fork, atStem };
