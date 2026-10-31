import { Tune } from './tune.js';
import { Rng } from './rng.js';
import { PALETTES, applyPalette } from './palettes.js';

const canvas = document.getElementById('floraCanvas');
const ctx = canvas.getContext('2d');
const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d');

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get('screen') || '0', 10);
const isPrimary = screenIndex === 0;

let seed = parseInt(params.get('seed') || `${Math.floor(Math.random() * 100000)}`, 10);
let paletteIdx = parseInt(params.get('palette') || `${Math.floor(Math.random() * PALETTES.length)}`, 10) % PALETTES.length;
let scene = null;
let stepIndex = 0;
let buildTime = 0;
let renderTime = 0;
let paused = false;
let advanceTimer = null;
const ADVANCE_DELAY = 10000;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth * dpr;
  const h = window.innerHeight * dpr;
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  offscreen.width = w;
  offscreen.height = h;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function makeSpec() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  // Use internal y-up page coordinates (origin bottom-left), so the geometry
  // code matches the original Lua tikz-flora. Flip to Canvas y-down happens in Painter.
  const layout = params.get('layout') || 'surround';

  if (layout === 'page') {
    // Full-screen manuscript page: flora in the left margin, text on the right.
    // No simulated desk/shadow — the canvas itself is the page.
    const edge = 22;
    const textW = W * 0.58;
    return {
      width: W, height: H,
      text: { x0: W - textW, y0: edge + 8, x1: W - edge, y1: H - edge - 4 },
      header_y: H - edge - 8,
      seed: seed,
      edge: edge,
      gutter: 10,
      mix: Object.assign({}, Tune.mix, { hero_cap: 80 }),
      layout: layout,
      page: { x: 0, y: 0, width: W, height: H },
    };
  }

  if (layout === 'surround') {
    // Botanical frame on all four sides, text in the centre.
    const edge = 18;
    const tw = W * 0.52;
    const th = H * 0.62;
    return {
      width: W, height: H,
      text: { x0: (W - tw) / 2, y0: (H - th) / 2, x1: (W + tw) / 2, y1: (H + th) / 2 },
      header_y: H - (H - th) / 2 - 6,
      seed: seed,
      edge: edge,
      gutter: 10,
      mix: Object.assign({}, Tune.mix, { hero_cap: 55 }),
      layout: layout,
      page: { x: 0, y: 0, width: W, height: H },
    };
  }

  const margin = layout === 'dual' ? W * 0.30 : W * 0.32;
  const text = layout === 'dual'
    ? { x0: margin, y0: 80, x1: W - 40, y1: H - 60 }
    : { x0: margin, y0: 60, x1: W - 30, y1: H - 40 };
  return {
    width: W, height: H,
    text: { x0: text.x0, y0: H - text.y1, x1: text.x1, y1: H - text.y0 },
    header_y: H - 52,
    seed: seed,
    edge: 16,
    gutter: 10,
    mix: Tune.mix,
    layout: layout,
  };
}

function scheduleAdvance() {
  if (advanceTimer || !isPrimary) return;
  advanceTimer = setTimeout(() => {
    advanceTimer = null;
    next();
    channel.postMessage({ cmd: 'next' });
  }, ADVANCE_DELAY);
}

function present() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(offscreen, 0, 0);
  scene.pt.applyGrain(ctx, canvas.width, canvas.height, 0.13);
}

function nextFrame() {
  if (!scene || paused) return;
  if (stepIndex >= scene.steps.length) {
    present();
    scheduleAdvance();
    return;
  }
  const t0 = performance.now();
  const step = scene.steps[stepIndex];
  step.draw(scene.pt);
  const dt = performance.now() - t0;
  renderTime += dt;
  let done = true;
  if (step.grow && step.scale < 0.99) done = false;
  if (step.trace && step.progress < 0.99) done = false;
  if (done) stepIndex++;
  present();
  requestAnimationFrame(nextFrame);
}

async function draw() {
  if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
  const t0 = performance.now();
  const { build } = await import('./compose.js');
  const { Painter } = await import('./paint.js');
  const Scribe = await import('./scribe.js');
  if (document.fonts) {
    await Promise.race([
      document.fonts.load('20px UnifrakturMaguntia'),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  }
  applyPalette(PALETTES[paletteIdx], new Rng(seed + 999));
  const spec = makeSpec();
  scene = build(spec);
  const page = spec.page || { x: 0, y: 0 };
  scene.pt = new Painter(offCtx, spec.height, page.x, page.y);
  const paperIdx = scene.steps.findIndex(s => s.name === 'paper');
  if (paperIdx >= 0) {
    const fragments = Scribe.layout(ctx, spec, new Rng(seed + 777));
    const textSteps = [];
    if (fragments._rule) {
      const [rx0, ry0, rx1, ry1] = fragments._rule;
      textSteps.push({
        name: 'rule',
        draw: pt => {
          const c = pt.ctx;
          c.save();
          c.strokeStyle = '#8b4513';
          c.lineWidth = 1.2;
          c.beginPath();
          c.moveTo(rx0, ry0);
          c.lineTo(rx1, ry1);
          c.stroke();
          c.restore();
        }
      });
    }
    for (const f of fragments) {
      textSteps.push({ name: 'text', draw: pt => Scribe.drawFragment(pt.ctx, f) });
    }
    scene.steps.splice(paperIdx + 1, 0, ...textSteps);
  }
  buildTime = performance.now() - t0;
  stepIndex = 0;
  renderTime = 0;
  requestAnimationFrame(nextFrame);
}

function next() {
  if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
  seed = (seed + 1) % 100000;
  draw();
}

function cyclePalette() {
  paletteIdx = (paletteIdx + 1) % PALETTES.length;
  draw();
}

function save() {
  const link = document.createElement('a');
  link.download = `flora-${seed}-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}

const channel = new BroadcastChannel('flora-screensaver');
channel.onmessage = e => {
  const d = e.data;
  if (d.cmd === 'next') { next(); }
  else if (d.cmd === 'requestNext' && isPrimary) { next(); channel.postMessage({ cmd: 'next' }); }
  else if (d.paletteIdx !== undefined && d.paletteIdx !== paletteIdx) {
    paletteIdx = d.paletteIdx;
    draw();
  }
  if (d.quit) window.close();
};

function broadcast() {
  channel.postMessage({ paletteIdx, quit: false });
}

document.addEventListener('keydown', e => {
  if (e.key === 'q' || e.key === 'Q') { channel.postMessage({ quit: true }); window.close(); }
  else if (e.key === 'n' || e.key === 'N' || e.key === ' ') {
    if (isPrimary) { next(); channel.postMessage({ cmd: 'next' }); }
    else channel.postMessage({ cmd: 'requestNext' });
  }
  else if (e.key === 'c' || e.key === 'C') { cyclePalette(); broadcast(); }
  else if (e.key === 'p' || e.key === 'P') { paused = !paused; if (!paused) requestAnimationFrame(nextFrame); }
  else if (e.key === 's' || e.key === 'S') save();
  else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
});

document.addEventListener('click', () => {
  if (!document.fullscreenElement) toggleFullscreen();
});

window.addEventListener('resize', () => { resize(); draw(); });

resize();
draw();
if (isPrimary) broadcast();
