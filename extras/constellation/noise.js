// Seeded Fast PRNG (Mulberry32) and Noise Utilities for Constellation Screensaver

function createRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easeInSq(t) {
  return t * t;
}

function easeOutQuad(t) {
  return t * (2 - t);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

function pick(array, rng) {
  if (!array || array.length === 0) return null;
  return array[Math.floor(rng() * array.length)];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createRNG, easeInSq, easeOutQuad, easeInOutCubic, pick };
}
