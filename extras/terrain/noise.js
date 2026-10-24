// Procedural Noise, Seeded PRNG, and Poisson Disk Sampling
// Multi-Screen Procedural Terrain screensaver

// ── Xoshiro128** Seeded PRNG with SplitMix State Initialization ───────────────
function createRandom(seedInput) {
  let s0 = 0x853c49e6;
  let s1 = 0xda342add;
  let s2 = 0x632be5ab;
  let s3 = 0xbf58476d;

  if (typeof seedInput === "string") {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c64e6d;
    for (let i = 0; i < seedInput.length; i++) {
      const ch = seedInput.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 0x9e3779b1);
      h2 = Math.imul(h2 ^ ch, 0x85ebca6b);
    }
    s0 ^= h1;
    s1 ^= h2;
    s2 ^= Math.imul(h1, 0x7feb352d);
    s3 ^= Math.imul(h2, 0x846ca68b);
  } else {
    let s = (seedInput || Date.now()) >>> 0;
    s0 ^= s;
    s1 ^= (s * 0x9e3779b9) >>> 0;
    s2 ^= (s * 0x85ebca6b) >>> 0;
    s3 ^= (s * 0xc2b2ae35) >>> 0;
  }

  function rotl(x, k) {
    return (x << k) | (x >>> (32 - k));
  }

  function value() {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9);
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return (result >>> 0) / 4294967296;
  }

  // 20 warm-up cycles
  for (let i = 0; i < 20; i++) value();

  return {
    value,
    range: (min, max) => min + (max - min) * value(),
    pick: (arr) => arr[Math.floor(value() * arr.length)],
    fork: () => createRandom(value() * 0x100000000),
  };
}

// ── Simplex 2D Noise ──────────────────────────────────────────────────────────
const F2 = (Math.sqrt(3) - 1) / 2;
const G2 = (3 - Math.sqrt(3)) / 6;

const GRAD_COS = Float64Array.from({ length: 16 }, (_, i) => Math.cos((2 * Math.PI * i) / 16));
const GRAD_SIN = Float64Array.from({ length: 16 }, (_, i) => Math.sin((2 * Math.PI * i) / 16));

function createSimplexNoise(rng) {
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.value() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }

  function hashCoord(x, y) {
    return perm[(perm[x & 255] + y) & 255] % 16;
  }

  function gradDot(dx, dy, gi) {
    const falloff = 0.5 - dx * dx - dy * dy;
    if (falloff <= 0) return 0;
    const f2 = falloff * falloff;
    return f2 * f2 * (GRAD_COS[gi] * dx + GRAD_SIN[gi] * dy);
  }

  function noise2D(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);

    const di = x0 > y0 ? 1 : 0;
    const dj = 1 - di;

    const x1 = x0 - di + G2;
    const y1 = y0 - dj + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const n0 = gradDot(x0, y0, hashCoord(i, j));
    const n1 = gradDot(x1, y1, hashCoord(i + di, j + dj));
    const n2 = gradDot(x2, y2, hashCoord(i + 1, j + 1));

    return 0.5 + 40.0 * (n0 + n1 + n2);
  }

  return noise2D;
}

// ── Multi-Octave Rotated Fractal Brownian Motion (FBM) ─────────────────────────
function fbmRotated(noiseFunc, x, y, octaves) {
  let sum = 0.0;
  let total = 0.0;
  let weight = 1.0;
  let px = x;
  let py = y;

  for (let i = 0; i < octaves; i++) {
    sum += weight * noiseFunc(px, py);
    total += weight;
    weight *= 0.5;

    // Fixed rotation ~34.37 deg to break axis regularity
    const turned = 0.8253356149096783 * px - 0.5646424733950354 * py;
    py = 2.0 * (0.5646424733950354 * px + 0.8253356149096783 * py) + 19.1;
    px = 2.0 * turned + 7.3;
  }
  return sum / total;
}

// ── Fast Bridson's Poisson Disk Sampling (Blue-Noise Distribution) ─────────────
function poissonDiskSampling(width, height, spacing, rng) {
  const cellSize = spacing / Math.SQRT2;
  const gridW = Math.ceil(width / cellSize);
  const gridH = Math.ceil(height / cellSize);
  const grid = new Int32Array(gridW * gridH).fill(-1);

  const pointsX = [];
  const pointsY = [];
  const activeList = [];

  function addPoint(x, y) {
    const idx = pointsX.length;
    pointsX.push(x);
    pointsY.push(y);
    activeList.push(idx);
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    if (gx >= 0 && gx < gridW && gy >= 0 && gy < gridH) {
      grid[gy * gridW + gx] = idx;
    }
  }

  function isValid(x, y) {
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    const r2 = spacing * spacing;

    const minX = Math.max(0, gx - 2);
    const maxX = Math.min(gridW - 1, gx + 2);
    const minY = Math.max(0, gy - 2);
    const maxY = Math.min(gridH - 1, gy + 2);

    for (let row = minY; row <= maxY; row++) {
      for (let col = minX; col <= maxX; col++) {
        const neighbor = grid[row * gridW + col];
        if (neighbor >= 0) {
          const dx = x - pointsX[neighbor];
          const dy = y - pointsY[neighbor];
          if (dx * dx + dy * dy < r2) return false;
        }
      }
    }
    return true;
  }

  // Seed multiple points across the canvas to guarantee uniform full-bleed coverage
  const seedCols = Math.max(2, Math.floor(width / (spacing * 15)));
  const seedRows = Math.max(2, Math.floor(height / (spacing * 15)));
  for (let r = 0; r < seedRows; r++) {
    for (let c = 0; c < seedCols; c++) {
      const sx = ((c + rng.range(0.2, 0.8)) / seedCols) * width;
      const sy = ((r + rng.range(0.2, 0.8)) / seedRows) * height;
      if (isValid(sx, sy)) addPoint(sx, sy);
    }
  }
  if (pointsX.length === 0) {
    addPoint(width * 0.5, height * 0.5);
  }

  // Run until the active list is exhausted (100% of the canvas is covered)
  while (activeList.length > 0) {
    const activeIdx = Math.floor(rng.value() * activeList.length);
    const pointIdx = activeList[activeIdx];
    const baseAngle = rng.range(0, 2 * Math.PI);
    let found = false;

    for (let step = 0; step < 20; step++) {
      const angle = baseAngle + (2 * Math.PI * step) / 20;
      const radius = spacing * (1.0 + rng.value() * 0.2);
      const nx = pointsX[pointIdx] + Math.cos(angle) * radius;
      const ny = pointsY[pointIdx] + Math.sin(angle) * radius;

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && isValid(nx, ny)) {
        addPoint(nx, ny);
        found = true;
        break;
      }
    }

    if (!found) {
      activeList[activeIdx] = activeList[activeList.length - 1];
      activeList.pop();
    }
  }

  return {
    x: Float32Array.from(pointsX),
    y: Float32Array.from(pointsY),
    count: pointsX.length,
  };
}

// ── Streaming Poisson Generator (Draw-as-you-sample) ─────────────────────────
function createPoissonGenerator(width, height, spacing, rng) {
  const cellSize = spacing / Math.SQRT2;
  const gridW = Math.ceil(width / cellSize);
  const gridH = Math.ceil(height / cellSize);
  const grid = new Int32Array(gridW * gridH).fill(-1);

  const pointsX = [];
  const pointsY = [];
  const activeList = [];

  function addPoint(x, y) {
    const idx = pointsX.length;
    pointsX.push(x);
    pointsY.push(y);
    activeList.push(idx);
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    if (gx >= 0 && gx < gridW && gy >= 0 && gy < gridH) {
      grid[gy * gridW + gx] = idx;
    }
  }

  function isValid(x, y) {
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    const r2 = spacing * spacing;

    const minX = Math.max(0, gx - 2);
    const maxX = Math.min(gridW - 1, gx + 2);
    const minY = Math.max(0, gy - 2);
    const maxY = Math.min(gridH - 1, gy + 2);

    for (let row = minY; row <= maxY; row++) {
      for (let col = minX; col <= maxX; col++) {
        const neighbor = grid[row * gridW + col];
        if (neighbor >= 0) {
          const dx = x - pointsX[neighbor];
          const dy = y - pointsY[neighbor];
          if (dx * dx + dy * dy < r2) return false;
        }
      }
    }
    return true;
  }

  // Seed grid points across canvas
  const seedCols = Math.max(2, Math.floor(width / (spacing * 15)));
  const seedRows = Math.max(2, Math.floor(height / (spacing * 15)));
  for (let r = 0; r < seedRows; r++) {
    for (let c = 0; c < seedCols; c++) {
      const sx = ((c + rng.range(0.2, 0.8)) / seedCols) * width;
      const sy = ((r + rng.range(0.2, 0.8)) / seedRows) * height;
      if (isValid(sx, sy)) addPoint(sx, sy);
    }
  }
  if (pointsX.length === 0) {
    addPoint(width * 0.5, height * 0.5);
  }

  let lastEmitted = 0;

  return {
    step(batchLimit) {
      while (activeList.length > 0 && (pointsX.length - lastEmitted) < batchLimit) {
        const activeIdx = Math.floor(rng.value() * activeList.length);
        const pointIdx = activeList[activeIdx];
        const baseAngle = rng.range(0, 2 * Math.PI);
        let found = false;

        for (let step = 0; step < 20; step++) {
          const angle = baseAngle + (2 * Math.PI * step) / 20;
          const radius = spacing * (1.0 + rng.value() * 0.2);
          const nx = pointsX[pointIdx] + Math.cos(angle) * radius;
          const ny = pointsY[pointIdx] + Math.sin(angle) * radius;

          if (nx >= 0 && nx < width && ny >= 0 && ny < height && isValid(nx, ny)) {
            addPoint(nx, ny);
            found = true;
            break;
          }
        }

        if (!found) {
          activeList[activeIdx] = activeList[activeList.length - 1];
          activeList.pop();
        }
      }

      const chunkCount = pointsX.length - lastEmitted;
      const chunkX = new Float32Array(chunkCount);
      const chunkY = new Float32Array(chunkCount);
      for (let i = 0; i < chunkCount; i++) {
        chunkX[i] = pointsX[lastEmitted + i];
        chunkY[i] = pointsY[lastEmitted + i];
      }
      lastEmitted = pointsX.length;

      return {
        chunkX,
        chunkY,
        count: chunkCount,
        done: activeList.length === 0,
      };
    },
  };
}

// ── Spatial Hash Dither for Stippled Mark Thresholding ─────────────────────────
function hashDither(x, y, seed) {
  let h = (seed | 0) ^ Math.imul(Math.floor(x * 3.0), 0xcc9e2d51);
  h = (h << 13) | (h >>> 19);
  h = (h + Math.imul(Math.floor(y * 3.0), 0x1b873593)) | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
