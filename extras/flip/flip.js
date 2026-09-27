const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = parseInt(params.get("screens") || "1", 10);

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

// Grid config
const CELL = 16; // px per cell
let cols, rows, totalCols;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  cols = Math.floor(window.innerWidth / CELL);
  rows = Math.floor(window.innerHeight / CELL);
  totalCols = cols * totalScreens;
}
resize();

// ── Simulation ────────────────────────────────────────────────────────────────
const GRAVITY = 20;
const OVERRELAX = 1.8;
const SOLVER_ITERS = 40;
const FLIP_RATIO = 0.85;
const FILL_FRAC = 0.30; // fraction of height to fill with water
const REST_DENSITY = 4;
const DENSITY_K = 0.5;
// ~4 particles per fluid cell, capped for performance
const NUM_PARTICLES = Math.min(25000, Math.floor((totalCols - 2) * Math.floor(rows * FILL_FRAC) * 4));

const AIR = 0, FLUID = 1, SOLID = 2;

let gridU, gridV, gridU_prev, gridV_prev, weightsU, weightsV, cellType;
let posX, posY, velX, velY;
const cellCounts = new Int16Array(totalCols * rows);

function initSim() {
  const gc = totalCols, gr = rows;
  gridU      = new Float32Array((gc + 1) * gr);
  gridV      = new Float32Array(gc * (gr + 1));
  gridU_prev = new Float32Array((gc + 1) * gr);
  gridV_prev = new Float32Array(gc * (gr + 1));
  weightsU   = new Float32Array((gc + 1) * gr);
  weightsV   = new Float32Array(gc * (gr + 1));
  cellType   = new Uint8Array(gc * gr);

  // Solid border: floor + left/right walls only (open top = free surface)
  for (let j = 0; j < gr; j++) {
    cellType[j * gc + 0]      = SOLID;
    cellType[j * gc + gc - 1] = SOLID;
  }
  for (let i = 0; i < gc; i++) {
    cellType[(gr - 1) * gc + i] = SOLID; // floor
  }

  posX = new Float32Array(NUM_PARTICLES);
  posY = new Float32Array(NUM_PARTICLES);
  velX = new Float32Array(NUM_PARTICLES);
  velY = new Float32Array(NUM_PARTICLES);

  // Fill bottom FILL_FRAC of interior (rows 1..gr-2) with particles
  const fillRows  = Math.floor((gr - 2) * FILL_FRAC);
  const fluidTop  = gr - 1 - fillRows;
  const fluidLeft = 1, fluidRight = gc - 2;
  const fluidW = fluidRight - fluidLeft;
  // Place on grid with jitter so cells start populated
  let p = 0;
  outer: for (let j = fluidTop; j < gr - 1; j++) {
    for (let i = fluidLeft; i < fluidRight; i++) {
      for (let k = 0; k < 4 && p < NUM_PARTICLES; k++, p++) {
        posX[p] = i + (k % 2) * 0.5 + Math.random() * 0.4;
        posY[p] = j + Math.floor(k / 2) * 0.5 + Math.random() * 0.4;
      }
      if (p >= NUM_PARTICLES) break outer;
    }
  }
}

function p2g(dt) {
  const gc = totalCols, gr = rows;
  gridU.fill(0); gridV.fill(0);
  weightsU.fill(0); weightsV.fill(0);
  cellCounts.fill(0);

  // Reset non-solid cells to AIR
  for (let i = 0; i < gc * gr; i++) {
    if (cellType[i] !== SOLID) cellType[i] = AIR;
  }

  for (let p = 0; p < NUM_PARTICLES; p++) {
    const x = posX[p], y = posY[p];
    const ci = Math.floor(x), ri = Math.floor(y);
    if (ci < 0 || ci >= gc || ri < 0 || ri >= gr) continue;
    cellType[ri * gc + ci] = FLUID;
    cellCounts[ri * gc + ci]++;

    // Splat U (horizontal face centers at i+0.5, j+0.5 -> actually face i, j+0.5)
    // U face at (i, j+0.5): position (i, j+0.5)
    const ux = x, uy = y - 0.5;
    const ui = Math.floor(ux), uj = Math.floor(uy);
    const ufx = ux - ui, ufy = uy - uj;
    for (let dj = 0; dj <= 1; dj++) {
      for (let di = 0; di <= 1; di++) {
        const ni = ui + di, nj = uj + dj;
        if (ni < 0 || ni > gc || nj < 0 || nj >= gr) continue;
        const w = (di ? ufx : 1 - ufx) * (dj ? ufy : 1 - ufy);
        const idx = nj * (gc + 1) + ni;
        gridU[idx]    += velX[p] * w;
        weightsU[idx] += w;
      }
    }

    // Splat V (vertical face centers at i+0.5, j)
    const vx = x - 0.5, vy = y;
    const vi = Math.floor(vx), vj = Math.floor(vy);
    const vfx = vx - vi, vfy = vy - vj;
    for (let dj = 0; dj <= 1; dj++) {
      for (let di = 0; di <= 1; di++) {
        const ni = vi + di, nj = vj + dj;
        if (ni < 0 || ni >= gc || nj < 0 || nj > gr) continue;
        const w = (di ? vfx : 1 - vfx) * (dj ? vfy : 1 - vfy);
        const idx = nj * gc + ni;
        gridV[idx]    += velY[p] * w;
        weightsV[idx] += w;
      }
    }
  }

  for (let i = 0; i < gridU.length; i++) if (weightsU[i] > 0) gridU[i] /= weightsU[i];
  for (let i = 0; i < gridV.length; i++) if (weightsV[i] > 0) gridV[i] /= weightsV[i];
  gridU_prev.set(gridU);
  gridV_prev.set(gridV);
}

function applyGravity(dt) {
  const gc = totalCols, gr = rows;
  for (let j = 0; j <= gr; j++) {
    for (let i = 0; i < gc; i++) {
      const above = j > 0  ? cellType[(j - 1) * gc + i] : AIR;
      const below = j < gr ? cellType[j * gc + i]       : AIR;
      if (above === FLUID || below === FLUID) {
        gridV[j * gc + i] += GRAVITY * dt;
      }
    }
  }
}

// Horizontal impulse for sloshing: add to gridU
let gx = 0; // current horizontal gravity component

function applyHorizontalForce(dt) {
  const gc = totalCols, gr = rows;
  for (let j = 0; j < gr; j++) {
    for (let i = 0; i <= gc; i++) {
      const left  = i > 0  ? cellType[j * gc + (i - 1)] : AIR;
      const right = i < gc ? cellType[j * gc + i]       : AIR;
      if (left === FLUID || right === FLUID) {
        gridU[j * (gc + 1) + i] += gx * dt;
      }
    }
  }
}

function project() {
  const gc = totalCols, gr = rows;
  for (let iter = 0; iter < SOLVER_ITERS; iter++) {
    for (let j = 0; j < gr - 1; j++) {       // include row 0 (open top), skip solid floor row
      for (let i = 1; i < gc - 1; i++) {
        if (cellType[j * gc + i] !== FLUID) continue;
        const leftT  = cellType[j * gc + (i - 1)];
        const rightT = cellType[j * gc + (i + 1)];
        const topT   = j > 0 ? cellType[(j - 1) * gc + i] : AIR; // free surface at top
        const botT   = cellType[(j + 1) * gc + i];

        let S = 0;
        if (leftT  !== SOLID) S++;
        if (rightT !== SOLID) S++;
        if (topT   !== SOLID) S++;
        if (botT   !== SOLID) S++;
        if (S === 0) continue;

        const div = (gridU[j * (gc+1) + i + 1] - gridU[j * (gc+1) + i]) +
                    (gridV[(j+1) * gc + i]      - gridV[j * gc + i]);
        const excess = Math.max(0, cellCounts[j * gc + i] - REST_DENSITY);
        const divTarget = excess * DENSITY_K;
        const delta = -((div - divTarget) / S) * OVERRELAX;

        if (leftT  !== SOLID) gridU[j * (gc+1) + i]     -= delta;
        if (rightT !== SOLID) gridU[j * (gc+1) + i + 1] += delta;
        if (topT   !== SOLID) gridV[j * gc + i]          -= delta;
        if (botT   !== SOLID) gridV[(j+1) * gc + i]      += delta;
      }
    }
  }
}

function sampleU(x, y) {
  const gc = totalCols, gr = rows;
  const ux = x, uy = y - 0.5;
  const ui = Math.floor(ux), uj = Math.floor(uy);
  const fx = ux - ui, fy = uy - uj;
  let v = 0;
  for (let dj = 0; dj <= 1; dj++) {
    for (let di = 0; di <= 1; di++) {
      const ni = Math.max(0, Math.min(gc, ui + di));
      const nj = Math.max(0, Math.min(gr - 1, uj + dj));
      const w = (di ? fx : 1-fx) * (dj ? fy : 1-fy);
      v += gridU[nj * (gc+1) + ni] * w;
    }
  }
  return v;
}

function sampleV(x, y) {
  const gc = totalCols, gr = rows;
  const vx = x - 0.5, vy = y;
  const vi = Math.floor(vx), vj = Math.floor(vy);
  const fx = vx - vi, fy = vy - vj;
  let v = 0;
  for (let dj = 0; dj <= 1; dj++) {
    for (let di = 0; di <= 1; di++) {
      const ni = Math.max(0, Math.min(gc - 1, vi + di));
      const nj = Math.max(0, Math.min(gr, vj + dj));
      const w = (di ? fx : 1-fx) * (dj ? fy : 1-fy);
      v += gridV[nj * gc + ni] * w;
    }
  }
  return v;
}

function enforceBoundaries() {
  const gc = totalCols, gr = rows;
  // Zero the inner faces between solid walls and fluid interior
  for (let j = 0; j < gr; j++) {
    gridU[j * (gc+1) + 1]      = 0; // left wall inner face
    gridU[j * (gc+1) + (gc-1)] = 0; // right wall inner face
  }
  for (let i = 0; i < gc; i++) {
    gridV[(gr-1) * gc + i] = 0; // floor inner face
  }
}

function g2p() {
  const gc = totalCols, gr = rows;
  for (let p = 0; p < NUM_PARTICLES; p++) {
    const x = posX[p], y = posY[p];
    const un = sampleU(x, y);
    const vn = sampleV(x, y);
    const uo = sampleUPrev(x, y);
    const vo = sampleVPrev(x, y);
    const vfx = velX[p] + (un - uo);
    const vfy = velY[p] + (vn - vo);
    velX[p] = FLIP_RATIO * vfx + (1 - FLIP_RATIO) * un;
    velY[p] = FLIP_RATIO * vfy + (1 - FLIP_RATIO) * vn;
  }
}

function sampleUPrev(x, y) {
  const gc = totalCols, gr = rows;
  const ux = x, uy = y - 0.5;
  const ui = Math.floor(ux), uj = Math.floor(uy);
  const fx = ux - ui, fy = uy - uj;
  let v = 0;
  for (let dj = 0; dj <= 1; dj++) {
    for (let di = 0; di <= 1; di++) {
      const ni = Math.max(0, Math.min(gc, ui + di));
      const nj = Math.max(0, Math.min(gr - 1, uj + dj));
      const w = (di ? fx : 1-fx) * (dj ? fy : 1-fy);
      v += gridU_prev[nj * (gc+1) + ni] * w;
    }
  }
  return v;
}

function sampleVPrev(x, y) {
  const gc = totalCols, gr = rows;
  const vx = x - 0.5, vy = y;
  const vi = Math.floor(vx), vj = Math.floor(vy);
  const fx = vx - vi, fy = vy - vj;
  let v = 0;
  for (let dj = 0; dj <= 1; dj++) {
    for (let di = 0; di <= 1; di++) {
      const ni = Math.max(0, Math.min(gc - 1, vi + di));
      const nj = Math.max(0, Math.min(gr, vj + dj));
      const w = (di ? fx : 1-fx) * (dj ? fy : 1-fy);
      v += gridV_prev[nj * gc + ni] * w;
    }
  }
  return v;
}

function advect(dt) {
  const gc = totalCols, gr = rows;
  const eps = 0.05;
  const MAX_VEL = 0.9 / dt;
  for (let p = 0; p < NUM_PARTICLES; p++) {
    if (velX[p] >  MAX_VEL) velX[p] =  MAX_VEL;
    if (velX[p] < -MAX_VEL) velX[p] = -MAX_VEL;
    if (velY[p] >  MAX_VEL) velY[p] =  MAX_VEL;
    if (velY[p] < -MAX_VEL) velY[p] = -MAX_VEL;
    posX[p] += velX[p] * dt;
    posY[p] += velY[p] * dt;

    if (posX[p] < 1.0 + eps)      { posX[p] = 1.0 + eps;      velX[p] =  Math.abs(velX[p]) * 0.3; }
    if (posX[p] > gc - 1.0 - eps) { posX[p] = gc - 1.0 - eps; velX[p] = -Math.abs(velX[p]) * 0.3; }
    if (posY[p] < 0.5)             { posY[p] = 0.5;             velY[p] =  Math.abs(velY[p]) * 0.3; }
    if (posY[p] > gr - 1.0 - eps) { posY[p] = gr - 1.0 - eps; velY[p] = -Math.abs(velY[p]) * 0.3; }
  }
}

function pushParticlesApart() {
  const gc = totalCols, gr = rows;
  for (let p = 0; p < NUM_PARTICLES; p++) {
    const ci = Math.floor(posX[p]), cj = Math.floor(posY[p]);
    if (ci <= 0 || ci >= gc - 1 || cj <= 0 || cj >= gr - 1) continue;
    const n = cellCounts[cj * gc + ci];
    if (n <= 4) continue;
    const angle = Math.random() * Math.PI * 2;
    const push = 0.08 * (n - 4) / 4;
    posX[p] += Math.cos(angle) * push;
    posY[p] += Math.sin(angle) * push;
  }
}

const SIM_DT = 1 / 30;
const SUB_STEPS = 2;

function step() {
  const dt = SIM_DT / SUB_STEPS;
  for (let s = 0; s < SUB_STEPS; s++) {
    p2g(dt);
    applyGravity(dt);
    applyHorizontalForce(dt);
    project();
    g2p();
    advect(dt);
    pushParticlesApart();
  }
}

// ── Periodic rocking with varying intensity ───────────────────────────────────
function updateImpulse(now) {
  const t = now / 1000;
  const amp = 2 + 6 * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 17));
  gx = amp * Math.sin(t * 2 * Math.PI / 7);
}

// ── Render ────────────────────────────────────────────────────────────────────
const DOT     = Math.max(2, CELL - 4);
const PAD     = (CELL - DOT) / 2;
const OFFSET_X = screenIndex * cols;

let tiltSmooth = 0;

function drawIndicator() {
  const W = 84, H = 54, margin = 40;
  const cx = canvas.width / 2;
  const cy = margin + H / 2;
  const angle = Math.atan2(tiltSmooth, GRAVITY);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle = "rgba(0,170,255,0.8)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-W / 2, -H / 2, W, H);
  ctx.restore();
}

function render() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#00aaff";
  const gc = totalCols, gr = rows;
  for (let j = 0; j < gr - 1; j++) {
    for (let i = OFFSET_X; i < OFFSET_X + cols; i++) {
      if (cellType[j * gc + i] === FLUID) {
        const cx = (i - OFFSET_X) * CELL + CELL / 2;
        const cy = j * CELL + CELL / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, DOT / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawIndicator();
}

// ── Multi-screen sync via BroadcastChannel ────────────────────────────────────
const bc = new BroadcastChannel("flip-sim");
const isPrimary = screenIndex === 0;

// ── Loop ──────────────────────────────────────────────────────────────────────
initSim();

let last = performance.now();

if (isPrimary) {
  function loop(now) {
    updateImpulse(now);
    tiltSmooth += (gx - tiltSmooth) * 0.08;
    step();
    render();
    bc.postMessage({ cellType: cellType.slice(), gx });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
} else {
  bc.onmessage = ({ data }) => {
    cellType.set(data.cellType);
    gx = data.gx;
    tiltSmooth += (gx - tiltSmooth) * 0.08;
    render();
  };
}

// ── Fullscreen & Keys ─────────────────────────────────────────────────────────
function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}

document.addEventListener("click", () => {
  if (!document.fullscreenElement) enterFullscreen();
});

document.addEventListener("keydown", e => {
  if (e.key === "q" || e.key === "Q") window.close();
});
