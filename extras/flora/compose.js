/** Orchestrate one page of flora. */
import * as G from './geom.js';
import { Rng } from './rng.js';
import { Painter } from './paint.js';
import * as Layout from './layout.js';
import * as Plant from './layout.js';
import * as Flower from './flower.js';
import * as Leaf from './leaf.js';
import * as Sprig from './sprig.js';
import * as Brush from './brush.js';
import * as Grow from './grow.js';
import * as Ornament from './ornament.js';
import { Space } from './space.js';

function splitSprayBatch(batch, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(new Sprig.Batch());
  for (let i = 0; i < batch.ribbons.length; i++) out[i % n].ribbons.push(batch.ribbons[i]);
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < batch.lines[c].length; i++) out[i % n].lines[c].push(batch.lines[c][i]);
  }
  for (let i = 0; i < batch.florets.length; i++) out[i % n].florets.push(batch.florets[i]);
  for (let i = 0; i < batch.buds.length; i++) out[i % n].buds.push(batch.buds[i]);
  return out;
}
import { Tune, mixCfg, scaleDensity } from './tune.js';

const PI = Math.PI;

// Element step that scales from 0 to full size over a few frames.
function growStep(name, center, drawFn, speed = 0.5) {
  const c = center || [0, 0];
  return {
    name, center: c, grow: true, scale: 0,
    draw(pt) {
      this.scale = Math.min(1, this.scale + speed);
      const s = this.scale * (2 - this.scale); // ease-out
      pt.drawScaled(this.center, s, () => drawFn(pt));
    }
  };
}

// Element step that traces a path progressively from 0 to full length.
function traceStep(name, drawFn, speed = 0.04) {
  return {
    name, trace: true, progress: 0,
    draw(pt) {
      this.progress = Math.min(1, this.progress + speed);
      drawFn(pt, this.progress);
    }
  };
}

function centroid(pts) {
  if (!pts || !pts.length) return [0, 0];
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function buildPlant(rng, spec, g, m, W, heroXBias = 0) {
  const mw = m.x1 - m.x0;
  const top = spec.header_y || spec.text.y1;
  const cfg = mixCfg(Tune.compose, spec.mix);
  const heroCap = (spec.mix && spec.mix.hero_cap) || 80;
  const R = G.clamp(mw * cfg.hero, 28, heroCap);
  const hy = Math.min(top - R * 0.32, spec.height - 8 - R * 0.8);
  const hero = [G.clamp(m.x0 + mw * 0.5 + heroXBias, m.x0 + R * 0.75, m.x1 - R * 0.95), hy, R];
  g.field();
  g.disc(hero[0], hero[1], R, 0.85);
  g.disc(hero[0] - R * 0.45, hero[1], R * 0.55, 0.85);
  g.disc(hero[0] + R * 0.45, hero[1], R * 0.55, 0.85);

  const gest = Layout.gesture(rng.fork('gesture'), m, hero);
  const dens = scaleDensity(gest.density, spec.mix);
  const py = gest.quiet[0] || (m.y0 + (hero[1] - m.y0) * 0.5);
  const [pw, ph] = Layout.cartoucheSize(mw);
  const avoid = [m.x0, py - ph / 2 - 3, m.x0 + pw + 5, py + ph / 2 + 3];
  const [strands] = Layout.strands(rng.fork('strands'), m, hero, W, gest, avoid);
  const runners = Layout.runners(rng.fork('runners'), m, strands[0].pts[0], W, spec.edge || 16);
  for (const s of strands) if (s.cum) Plant.fork(s, 0.005, 0.8);
  const stems = [...strands, ...runners];
  for (const s of stems) g.reserveLine(s.pts, 2, 4);

  const stemBatch = new Sprig.Batch();
  const sprayBatch = new Sprig.Batch();
  const leaves = [];
  const leaflets = [];
  const blooms = [];

  // Ghost bloom
  const gr = rng.fork('ghost');
  let ghost = null;
  if (gr.chance(0.7)) {
    for (let i = 0; i < 8; i++) {
      const r = mw * gr.range(0.23, 0.28);
      const x = m.x0 + mw * gr.range(0.35, 0.5);
      const y = m.foot + gr.range(35, 75);
      let ok = true;
      for (let k = 0; k < 12; k++) {
        const q = G.polar([x, y], k * PI / 6, r * 0.9);
        if (!g.openAt(q[0], q[1])) ok = false;
      }
      if (ok) {
        g.disc(x, y, r, 0.8);
        ghost = { x, y, r };
        break;
      }
    }
  }

  const ctx2 = {
    cfg, mix: spec.mix, mw, dens, ylo: m.y0, span: hero[1] - m.y0,
    strands, stems, stem_batch: stemBatch, sprays: sprayBatch,
    leaves, leaflets, blooms, g, sprayCount: 0,
  };
  Grow.nodeLeaves(g, rng.fork('nodes'), strands, ctx2);
  Grow.tips(g, rng.fork('tips'), strands, ctx2);
  Grow.holes(g, rng.fork('holes'), ctx2);
  Grow.details(g, rng.fork('details'), ctx2);

  for (const s of strands) {
    if (!s.cum) stemBatch.stemBy(s.pts, s.width);
  }
  for (const s of runners) stemBatch.stemBy(s.pts, s.width);

  const sr = rng.fork('stem paint');
  const lr = rng.fork('leaflets');
  const hr = rng.fork('hero');

  const steps = [];
  if (ghost) {
    steps.push(growStep('ghost', [ghost.x, ghost.y], pt => Flower.bloom(pt, gr, ghost.x, ghost.y, ghost.r, { kind: 'ghost', look: 'ghost', width: 0.55, outline: 0 })));
  }
  // Gilt compass star on the running-head rule (only for side-margin layouts).
  if (spec.layout !== 'surround') {
    steps.push({ name: 'compass', draw: pt => {
      const hx = spec.text.x0 - 8, hy = (spec.header_y || spec.text.y1) - 3;
      pt.stroke([G.polyline([[hx + 4, hy], [spec.text.x1, hy]])], pt.ink, 0.4, 0.9);
      Ornament.compass(pt, hx, hy, 12);
    }});
  }
  const stemPts = [];
  for (const s of strands) if (s.cum) stemPts.push(...s.pts);
  for (const s of stems) if (!s.cum) stemPts.push(...s.pts);
  steps.push(traceStep('stems', (pt, p) => {
    for (const s of strands) if (s.cum) {
      const partial = G.truncatePts(s.pts, p);
      const plen = G.length(partial);
      Brush.stem(pt, sr, partial, t => Plant.widthAt(s, t * plen), Tune.plant);
    }
    stemBatch.paint(pt, pt.ink, p);
  }, 0.018));
  const spraySubs = splitSprayBatch(sprayBatch, 8);
  for (let i = 0; i < spraySubs.length; i++) {
    const sub = spraySubs[i];
    const pts = [];
    sub.eachPoint((x, y) => pts.push([x, y]));
    steps.push(growStep('sprays', centroid(pts), pt => sub.paint(pt, mix(pt.ink, pt.sky, 0.4)), 0.5));
  }
  if (leaflets.length) steps.push({ name: 'leaflets', draw: pt => Leaf.leaflets(pt, lr, leaflets) });
  for (let i = 0; i < leaves.length; i += 5) {
    const batch = leaves.slice(i, i + 5);
    const c = centroid(batch.map(f => f.center));
    steps.push(growStep('leaf', c, pt => { for (const f of batch) f.draw(pt); }, 0.2));
  }
  for (let i = 0; i < blooms.length; i += 3) {
    const batch = blooms.slice(i, i + 3);
    const c = centroid(batch.map(f => f.center));
    steps.push(growStep('bloom', c, pt => { for (const f of batch) f.draw(pt); }, 0.2));
  }
  steps.push(growStep('hero', [hero[0], hero[1]], pt => Flower.hero(pt, hr, hero), 0.2));

  return {
    counts: {
      strands: strands.length, stems: stems.length, leaves: leaves.length,
      leaflets: leaflets.length, blooms: blooms.length, sprayCount: ctx2.sprayCount,
      leafTries: ctx2.counts?.leafTries, leafFailDisc: ctx2.counts?.leafFailDisc, leafFailPath: ctx2.counts?.leafFailPath,
    },
    steps,
    coverage: () => g.coverage(),
  };
}

// Elegant horizontal garland for top/bottom of surround layout.
function hBorder(rng, spec, side) {
  const W = spec.width, H = spec.height;
  const t = spec.text;
  const edge = spec.edge || 16;
  const gutter = spec.gutter || 9;
  const top = side === 'top';
  const y0 = top ? t.y1 + gutter : edge;
  const y1 = top ? H - edge : t.y0 - gutter;
  const mw = y1 - y0;
  if (mw < 30) return { steps: [], coverage: () => 0 };

  const g = new Space(W, H, 3);
  g.open(t.x0 - gutter, y0, t.x1 + gutter, y1);

  const stems = [];
  const ybase = top ? y1 - mw * 0.45 : y0 + mw * 0.45;
  const amp = mw * 0.12;
  const n = 7;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const x = t.x0 - gutter + (t.x1 - t.x0 + gutter * 2) * (i / (n - 1));
    const y = ybase + (i % 2 === 0 ? 1 : -1) * amp * rng.range(0.3, 1.0);
    pts.push([x, y]);
  }
  const main = G.splinePoints(pts, 8);
  stems.push({ pts: main, w0: 2.6, w1: 1.6 });

  // A few short side shoots pointing inward.
  for (let i = 0; i < 4; i++) {
    const idx = rng.int(1, pts.length - 2);
    const base = pts[idx];
    const inward = top ? -PI / 2 : PI / 2;
    const shoot = G.curve(base, inward + rng.jit(0.6), mw * rng.range(0.25, 0.45), rng.jit(0.4), 0, 6);
    stems.push({ pts: shoot, w0: 1.4, w1: 0.8 });
  }
  for (const s of stems) g.reserveLine(s.pts, 2, 3);

  const sprayBatch = new Sprig.Batch();
  const leaves = [];
  const blooms = [];
  const lr = rng.fork('leaves');
  const cfg = mixCfg(Tune.compose, spec.mix);

  for (const s of stems) {
    const cum = [0]; let total = 0;
    for (let i = 1; i < s.pts.length; i++) { total += G.dist(s.pts[i - 1], s.pts[i]); cum[i] = total; }
    const len = Math.max(total, 1e-9);
    for (let d = 0.15; d < 0.92; d += rng.range(0.22, 0.38)) {
      let s0 = d * len, i = 1;
      while (i < s.pts.length - 1 && cum[i] < s0) i++;
      const a = s.pts[i - 1], b = s.pts[i];
      const u = (s0 - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
      const p = G.mix(a, b, u);
      const ang = G.angle(a, b) + (top ? -1 : 1) * rng.range(0.5, 1.1);
      const size = cfg.leaf_size * mw * rng.range(0.30, 0.50);
      if (!g.openAt(p[0], p[1], size * 0.45)) continue;
      const o = Leaf.options(lr, size, ang);
      g.disc(p[0], p[1], size * 0.45);
      leaves.push({ center: [p[0], p[1]], draw: pt => Leaf.leaf(pt, lr, p[0], p[1], ang, o) });
    }
  }

  const br = rng.fork('blooms');
  for (let i = 0; i < 5; i++) {
    const r = mw * br.range(0.16, 0.26);
    const x = br.range(t.x0 + mw * 0.25, t.x1 - mw * 0.25);
    const y = br.range(y0 + mw * 0.25, y1 - mw * 0.25);
    if (g.openAt(x, y, r + 4)) {
      g.disc(x, y, r, 0.85);
      blooms.push({ center: [x, y], draw: pt => Flower.bloom(pt, br, x, y, r, { kind: br.pick(['round', 'fan', 'wedge']), look: 'vivid', width: 0.38 }) });
    }
  }

  // Delicate sprays, widely spaced.
  for (let i = 0; i < 3; i++) {
    const x = rng.range(t.x0 + mw * 0.2, t.x1 - mw * 0.2);
    const y = rng.range(y0 + mw * 0.25, y1 - mw * 0.25);
    if (g.openAt(x, y, 12)) {
      Sprig.cyme(sprayBatch, rng.fork('su' + i), [x, y], top ? -PI / 2 : PI / 2, mw * rng.range(0.25, 0.40), rng.chance(0.5) ? 1 : -1);
      g.disc(x, y, 8, 0.8);
    }
  }

  const sr = rng.fork('stems');
  const steps = [];
  steps.push(traceStep(side + '-stems', (pt, p) => {
    for (const s of stems) {
      const partial = G.truncatePts(s.pts, p);
      const plen = G.length(partial);
      const total = G.length(s.pts);
      Brush.stem(pt, sr, partial, t => s.w0 + (s.w1 - s.w0) * (t * plen / Math.max(total, 1e-9)), Tune.plant);
    }
  }, 0.04));
  for (let i = 0; i < leaves.length; i += 4) {
    const batch = leaves.slice(i, i + 4);
    const c = centroid(batch.map(f => f.center));
    steps.push(growStep(side + '-leaf', c, pt => { for (const f of batch) f.draw(pt); }, 0.2));
  }
  for (let i = 0; i < blooms.length; i += 3) {
    const batch = blooms.slice(i, i + 3);
    const c = centroid(batch.map(f => f.center));
    steps.push(growStep(side + '-bloom', c, pt => { for (const f of batch) f.draw(pt); }, 0.2));
  }
  const sprayPts = [];
  sprayBatch.eachPoint((x, y) => sprayPts.push([x, y]));
  steps.push({ name: side + '-sprays', draw: pt => sprayBatch.paint(pt, mix(pt.ink, pt.sky, 0.4)) });

  return { steps, coverage: () => g.coverage() };
}

function buildSurround(spec) {
  const rng = new Rng(spec.seed || 1);
  const W = spec.width, H = spec.height;
  const t = spec.text;
  const edge = spec.edge || 16;
  const gutter = spec.gutter || 9;

  // Left vertical border: text starts at centre t.x0.
  const leftSpec = Object.assign({}, spec, {
    text: { x0: t.x0, y0: edge + 6, x1: W - edge, y1: H - edge - 6 },
    header_y: H - edge - 8,
  });
  const [lg, lm] = Layout.region(leftSpec);
  const left = buildPlant(rng.fork('left'), leftSpec, lg, lm, W, 0);

  // Right vertical border: mirror the left plant around the page centre.
  const cx = W / 2;
  const flipX = pt => { pt.projection = (x, y) => [cx - (x - cx), y]; };
  const unflipX = pt => { pt.projection = null; };

  const top = hBorder(rng.fork('top'), spec, 'top');
  const bottom = hBorder(rng.fork('bottom'), spec, 'bottom');

  const coverage = (left.coverage() + top.coverage() + bottom.coverage()) / 3;

  // Categorise steps so the frame grows by layer (stems everywhere, then leaves, ...)
  // rather than finishing one side before starting the next.
  const cats = {
    ghost: [], stems: [], sprays: [], leaflets: [], leaf: [], bloom: [], hero: [],
    'top-stems': [], 'top-leaf': [], 'top-bloom': [], 'top-sprays': [],
    'bottom-stems': [], 'bottom-leaf': [], 'bottom-bloom': [], 'bottom-sprays': [],
  };
  function put(s, prefix = '') {
    const name = prefix + s.name;
    if (cats[name]) cats[name].push(s);
    else cats[name] = [s];
  }
  for (const s of top.steps) put(s);
  for (const s of left.steps) put(s);
  for (const s of left.steps) {
    // Clone so left and right mirrors have independent animation state.
    const clone = Object.assign({}, s);
    clone.name = 'right-' + s.name;
    const originalDraw = s.draw;
    clone.draw = function(pt) { flipX(pt); originalDraw.call(this, pt); unflipX(pt); };
    if (cats['right-' + s.name]) cats['right-' + s.name].push(clone);
    else cats['right-' + s.name] = [clone];
  }
  for (const s of bottom.steps) put(s);

  const steps = [];
  const add = name => { if (cats[name]) steps.push(...cats[name]); };
  add('ghost');
  add('top-stems'); add('right-stems'); add('bottom-stems'); add('stems');
  add('top-sprays'); add('right-sprays'); add('bottom-sprays'); add('sprays');
  add('leaflets');
  // Sort leaves and blooms clockwise around the text centre, then interleave them.
  const tcx = (t.x0 + t.x1) / 2, tcy = (t.y0 + t.y1) / 2;
  function angle(s) {
    const c = s.center || [tcx, tcy];
    let a = Math.atan2(c[1] - tcy, c[0] - tcx) - PI / 2;
    while (a < 0) a += 2 * PI;
    return a;
  }
  function sortClockwise(arr) {
    return arr.slice().sort((a, b) => angle(a) - angle(b));
  }
  const allLeaves = sortClockwise([
    ...(cats['top-leaf'] || []), ...(cats['leaf'] || []),
    ...(cats['right-leaf'] || []), ...(cats['bottom-leaf'] || []),
  ]);
  const allBlooms = sortClockwise([
    ...(cats['top-bloom'] || []), ...(cats['bloom'] || []),
    ...(cats['right-bloom'] || []), ...(cats['bottom-bloom'] || []),
  ]);
  let li = 0, bi = 0;
  while (li < allLeaves.length || bi < allBlooms.length) {
    if (li < allLeaves.length) steps.push(allLeaves[li++]);
    if (bi < allBlooms.length) steps.push(allBlooms[bi++]);
  }
  add('hero'); add('right-hero');

  return { steps, coverage, counts: left.counts };
}

export function build(spec) {
  const rng = new Rng(spec.seed || 1);
  const W = spec.width, H = spec.height;
  const layout = spec.layout || 'left';
  const steps = [];
  let coverage = 0;

  if (layout === 'surround') {
    const scene = buildSurround(spec);
    coverage = scene.coverage;
    steps.push({ name: 'paper', draw: pt => { pt.clear(W, H); pt.texture(W, H, rng.seed); } });
    steps.push(...scene.steps);
    return { steps, coverage, counts: scene.counts };
  }

  if (layout === 'dual') {
    const margin = Math.min(W * 0.30, 360);
    const dualSpec = Object.assign({}, spec, {
      text: { x0: margin, y0: H * 0.12, x1: W, y1: H * 0.88 },
      header_y: H * 0.08,
    });
    const [lg, lm] = Layout.region(dualSpec);
    const left = buildPlant(rng.fork('left'), dualSpec, lg, lm, W, 0);
    const [rg, rm] = Layout.region(dualSpec);
    const right = buildPlant(rng.fork('right'), dualSpec, rg, rm, W, 0);

    const cx = W / 2;
    const flip = pt => { pt.projection = (x, y) => [cx - (x - cx), y]; };
    const unflip = pt => { pt.projection = null; };

    coverage = (left.coverage() + right.coverage()) / 2;
    steps.push({ name: 'paper', draw: pt => {
      const fillsScreen = spec.page &&
        spec.page.x === 0 && spec.page.y === 0 &&
        spec.page.width === spec.width && spec.page.height === spec.height;
      if (spec.page && !fillsScreen) {
        pt.clearDesk(spec.width, spec.height, spec.page.desk);
        pt.clearPage(spec.page.x, spec.page.y, spec.page.width, spec.page.height);
        pt.ctx.save();
        pt.ctx.beginPath();
        pt.ctx.rect(spec.page.x, spec.page.y, spec.page.width, spec.page.height);
        pt.ctx.clip();
        pt.texture(W, H, rng.seed);
        pt.ctx.restore();
      } else {
        pt.clear(W, H);
        pt.texture(W, H, rng.seed);
      }
    }});
    for (const s of left.steps) steps.push({
      name: 'left-' + s.name, center: s.center,
      grow: s.grow, scale: s.scale, trace: s.trace, progress: s.progress,
      draw(pt) { s.draw(pt); this.scale = s.scale; this.progress = s.progress; }
    });
    for (const s of right.steps) {
      const clone = Object.assign({}, s);
      clone.name = 'right-' + s.name;
      const originalDraw = s.draw;
      clone.draw = function(pt) { flip(pt); originalDraw.call(this, pt); unflip(pt); };
      steps.push(clone);
    }
  } else {
    const [g, m] = Layout.region(spec);
    const plant = buildPlant(rng, spec, g, m, W, 0);
    coverage = plant.coverage();
    steps.push({ name: 'paper', draw: pt => {
      const fillsScreen = spec.page &&
        spec.page.x === 0 && spec.page.y === 0 &&
        spec.page.width === spec.width && spec.page.height === spec.height;
      if (spec.page && !fillsScreen) {
        pt.clearDesk(spec.width, spec.height, spec.page.desk);
        pt.clearPage(spec.page.x, spec.page.y, spec.page.width, spec.page.height);
        pt.ctx.save();
        pt.ctx.beginPath();
        pt.ctx.rect(spec.page.x, spec.page.y, spec.page.width, spec.page.height);
        pt.ctx.clip();
        pt.texture(W, H, rng.seed);
        pt.ctx.restore();
      } else {
        pt.clear(W, H);
        pt.texture(W, H, rng.seed);
      }
    }});
    steps.push(...plant.steps);
    return { steps, coverage, counts: plant.counts };
  }

  return { steps, coverage };
}

export function page(spec, ctx) {
  const scene = build(spec);
  const pt = new Painter(ctx, spec.height);
  for (const s of scene.steps) s.draw(pt);
  return { coverage: scene.coverage };
}
