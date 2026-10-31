// Minimal smoke test: mock a 2D context and run build() + layers without crashing.
import { build } from './compose.js';
import { Painter } from './paint.js';

function createMockCtx() {
  return {
    save: () => {}, restore: () => {}, beginPath: () => {}, closePath: () => {},
    moveTo: () => {}, lineTo: () => {}, bezierCurveTo: () => {},
    fill: () => {}, stroke: () => {}, clip: () => {},
    translate: () => {}, scale: () => {}, rotate: () => {},
    fillRect: () => {}, strokeRect: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(W * H * 4) }),
    putImageData: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    setTransform: () => {},
    _gco: 'source-over', _alpha: 1, _fs: '#000', _ss: '#000', _lw: 1,
    get globalCompositeOperation() { return this._gco; },
    set globalCompositeOperation(v) { this._gco = v; },
    get globalAlpha() { return this._alpha; },
    set globalAlpha(v) { this._alpha = v; },
    get fillStyle() { return this._fs; },
    set fillStyle(v) { this._fs = v; },
    get strokeStyle() { return this._ss; },
    set strokeStyle(v) { this._ss = v; },
    get lineWidth() { return this._lw; },
    set lineWidth(v) { this._lw = v; },
    lineCap: 'butt', lineJoin: 'miter',
  };
}

const W = 800, H = 600;
const ctx = createMockCtx();
// y-up page coordinates: text block is in the middle of the page.
const spec = {
  width: W, height: H,
  text: { x0: W * 0.35, y0: H - (H - 60), x1: W - 40, y1: H - 80 },
  header_y: H - 52,
  seed: 7,
  edge: 16,
  gutter: 10,
  layout: 'dual',
};

try {
  const t0 = performance.now();
  const scene = build(spec);
  const buildTime = performance.now() - t0;
  const pt = new Painter(ctx, H);
  for (const s of scene.steps) s.draw(pt);
  console.log('OK steps=' + scene.steps.length + ' coverage=' + (scene.coverage * 100).toFixed(1) + '% build=' + buildTime.toFixed(1) + 'ms');
  const single = build(Object.assign({}, spec, { layout: 'left' }));
  console.log('single counts:', single.counts);
} catch (e) {
  console.error('FAIL', e.stack);
  process.exit(1);
}
