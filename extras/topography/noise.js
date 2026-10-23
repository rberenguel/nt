// Seeded Fast PRNG (Mulberry32) and Noise Utilities for Procedural Topography & Elevation Maps

function createRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D Value / Gradient Noise
function hash2D(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (n - Math.floor(n)) * 2.0 - 1.0;
}

function noise2D(x, y) {
  const iX = Math.floor(x);
  const iY = Math.floor(y);
  const fX = x - iX;
  const fY = y - iY;
  // Quintic Hermite interpolant for smooth derivatives (C2 continuity)
  const u = fX * fX * fX * (fX * (fX * 6.0 - 15.0) + 10.0);
  const v = fY * fY * fY * (fY * (fY * 6.0 - 15.0) + 10.0);

  const a = hash2D(iX, iY);
  const b = hash2D(iX + 1, iY);
  const c = hash2D(iX, iY + 1);
  const d = hash2D(iX + 1, iY + 1);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Fractal Brownian Motion (smooth rolling terrain)
function fbm2D(x, y, octaves = 4, seedOffset = 0) {
  let val = 0.0;
  let amp = 0.5;
  let freq = 1.0;
  let tot = 0.0;
  for (let i = 0; i < octaves; i++) {
    val += noise2D(x * freq + seedOffset * 17.3 + i * 31.7, y * freq + seedOffset * 29.1 + i * 43.1) * amp;
    tot += amp;
    freq *= 2.02;
    amp *= 0.5;
  }
  return (val / tot + 1.0) * 0.5; // Normalized to [0, 1]
}

// Ridged Multifractal Noise (sharp mountain spines, arêtes, crags)
function ridgedNoise2D(x, y, octaves = 4, seedOffset = 0) {
  let val = 0.0;
  let amp = 0.5;
  let freq = 1.0;
  let tot = 0.0;
  let weight = 1.0;
  for (let i = 0; i < octaves; i++) {
    let n = noise2D(x * freq + seedOffset * 11.3 + i * 23.9, y * freq + seedOffset * 37.1 + i * 19.3);
    n = 1.0 - Math.abs(n); // Invert valleys into sharp ridges
    n = n * n; // Square to sharpen peaks
    val += n * amp * weight;
    weight = Math.min(1.0, Math.max(0.0, n * 1.5));
    tot += amp;
    freq *= 2.05;
    amp *= 0.5;
  }
  return val / tot; // Normalized roughly to [0, 1]
}

// Domain Warped Fractal Noise (natural geological faults & valley curves)
function warpedFbm2D(x, y, seedOffset = 0) {
  const qx = fbm2D(x + 0.0, y + 0.0, 3, seedOffset);
  const qy = fbm2D(x + 5.2, y + 1.3, 3, seedOffset + 10);

  const rx = fbm2D(x + 4.0 * qx + 1.7, y + 4.0 * qy + 9.2, 3, seedOffset + 20);
  const ry = fbm2D(x + 4.0 * qx + 8.3, y + 4.0 * qy + 2.8, 3, seedOffset + 30);

  return fbm2D(x + 3.0 * rx, y + 3.0 * ry, 4, seedOffset + 40);
}

if (typeof globalThis !== "undefined") {
  globalThis.createRNG = createRNG;
  globalThis.noise2D = noise2D;
  globalThis.fbm2D = fbm2D;
  globalThis.ridgedNoise2D = ridgedNoise2D;
  globalThis.warpedFbm2D = warpedFbm2D;
}
