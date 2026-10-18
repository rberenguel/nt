// Seeded Fast PRNG (Mulberry32) and Noise Utilities for Procedural Fantasy Maps

function createRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Procedural Fractal 1D Noise
function noise1D(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3.0 - 2.0 * f);
  const h0 = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  const h1 = Math.sin((i + 1) * 127.1 + 311.7) * 43758.5453;
  const v0 = (h0 - Math.floor(h0)) * 2.0 - 1.0;
  const v1 = (h1 - Math.floor(h1)) * 2.0 - 1.0;
  return v0 + (v1 - v0) * u;
}

function fbm1D(x, seedOffset = 0, octaves = 4) {
  let v = 0.0;
  let amp = 0.55;
  let freq = 1.0;
  for (let o = 0; o < octaves; o++) {
    v += noise1D(x * freq + seedOffset * 13.7 + o * 47.1) * amp;
    freq *= 2.05;
    amp *= 0.5;
  }
  return v;
}

// Procedural Fractal 2D Value Noise
function hash2D(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (n - Math.floor(n)) * 2.0 - 1.0;
}

function noise2D(x, y) {
  const iX = Math.floor(x);
  const iY = Math.floor(y);
  const fX = x - iX;
  const fY = y - iY;
  const u = fX * fX * (3.0 - 2.0 * fX);
  const v = fY * fY * (3.0 - 2.0 * fY);

  const a = hash2D(iX, iY);
  const b = hash2D(iX + 1, iY);
  const c = hash2D(iX, iY + 1);
  const d = hash2D(iX + 1, iY + 1);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm2D(x, y, octaves = 3) {
  let val = 0;
  let amp = 0.5;
  let freq = 1.0;
  let tot = 0;
  for (let i = 0; i < octaves; i++) {
    val += noise2D(x * freq, y * freq) * amp;
    tot += amp;
    freq *= 2.05;
    amp *= 0.5;
  }
  return val / tot;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createRNG, noise1D, fbm1D, hash2D, noise2D, fbm2D };
}
