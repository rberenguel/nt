const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = parseInt(params.get("screens") || "1", 10);

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let worldSeed = parseInt(localStorage.getItem("aquarium-seed") || "0");
if (!worldSeed) {
  worldSeed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  localStorage.setItem("aquarium-seed", String(worldSeed));
}
const rng = mulberry32(worldSeed);

const SIM_W = 1000 * totalScreens;
const SIM_H = 600;
const SIM_HZ = 20;
const SIM_DT = 1 / SIM_HZ;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrapAngle = (a) => {
  while (a < -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
};

const KATA = "ア ァ カ サ タ ナ ハ マ ヤ ラ ワ ガ ザ ダ バ パ イ ィ キ シ チ ニ ヒ ミ リ ギ ジ ビ ウ ゥ ク ス ツ ヌ フ ム ユ ュ ル グ ズ ブ エ ェ ケ セ テ ネ ヘ メ レ ゲ ゼ デ ベ オ ォ コ ソ ト ノ ホ モ ヨ ョ ロ ヲ ゴ ゾ ド ボ ヴ ッ ン".split(" ");
const HIRA = "あ い う え お か き く け こ さ し す せ そ た ち つ て と な に ぬ ね の は ひ ふ へ ほ ま み む め も や ゆ よ ら り る れ ろ わ を ん".split(" ");
const rk = () => KATA[Math.floor(Math.random() * KATA.length)];
const rh = () => HIRA[Math.floor(Math.random() * HIRA.length)];

const SURF_ROWS = 7;
const SAND_ROWS = 3;

// ── Noise ─────────────────────────────────────────────────────────────────────
function hash3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
function smoothstep(t) { return t * t * (3 - 2 * t); }
function valueNoise3D(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smoothstep(x - ix), fy = smoothstep(y - iy), fz = smoothstep(z - iz);
  const lerp = (a, b, t) => a + (b - a) * t;
  const h = (dx, dy, dz) => hash3(ix+dx, iy+dy, iz+dz);
  return lerp(
    lerp(lerp(h(0,0,0), h(1,0,0), fx), lerp(h(0,1,0), h(1,1,0), fx), fy),
    lerp(lerp(h(0,0,1), h(1,0,1), fx), lerp(h(0,1,1), h(1,1,1), fx), fy),
    fz
  );
}
let noiseT = 0;

function getCurrentNudge(x, y) {
  const nx = (x / SIM_W) * NC_W;
  const ny = (y / SIM_H) * NC_H;
  const angle = valueNoise3D(nx * 0.4, ny * 0.4, noiseT) * Math.PI * 4;
  const strength = 7;
  return {
    dx: Math.cos(angle) * strength * SIM_DT,
    dy: Math.sin(angle) * strength * SIM_DT,
  };
}

// ── Color helpers ─────────────────────────────────────────────────────────────
function jitterColor(hex, amount) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const jr = clamp(r + Math.round((Math.random()*2-1) * amount), 0, 255);
  const jg = clamp(g + Math.round((Math.random()*2-1) * amount), 0, 255);
  const jb = clamp(b + Math.round((Math.random()*2-1) * amount), 0, 255);
  return `#${jr.toString(16).padStart(2,'0')}${jg.toString(16).padStart(2,'0')}${jb.toString(16).padStart(2,'0')}`;
}

function lerpColor(a, b, t) {
  const ra = parseInt(a.slice(1,3),16), ga = parseInt(a.slice(3,5),16), ba_ = parseInt(a.slice(5,7),16);
  const rb = parseInt(b.slice(1,3),16), gb = parseInt(b.slice(3,5),16), bb_ = parseInt(b.slice(5,7),16);
  const r = Math.round(ra + (rb-ra)*t);
  const g = Math.round(ga + (gb-ga)*t);
  const bv = Math.round(ba_ + (bb_-ba_)*t);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bv.toString(16).padStart(2,'0')}`;
}

// ── Brain ─────────────────────────────────────────────────────────────────────
class Brain {
  constructor(layers, weights) {
    this.layers = layers;
    this.w = new Float32Array(weights);
  }
  forward(inp) {
    let cur = inp, wi = 0;
    for (let l = 0; l < this.layers.length - 1; l++) {
      const id = this.layers[l], od = this.layers[l + 1];
      const nxt = new Float32Array(od);
      for (let j = 0; j < od; j++) {
        let s = this.w[wi++];
        for (let i = 0; i < id; i++) s += cur[i] * this.w[wi++];
        nxt[j] = Math.tanh(s);
      }
      cur = nxt;
    }
    return cur;
  }
}

// ── Entities ──────────────────────────────────────────────────────────────────
class Entity {
  constructor(x, y, maxSpeed, turnRate = 2.2) {
    this.x = x; this.y = y;
    this.heading = rng() * Math.PI * 2;
    this.speed = 0; this.maxSpeed = maxSpeed; this.turnRate = turnRate; this.alive = true;
  }
  step(turn, throttle) {
    this.heading = wrapAngle(this.heading + turn * this.turnRate * SIM_DT);
    this.speed = clamp(this.speed + throttle * this.maxSpeed * SIM_DT, 0, this.maxSpeed);
    this.x += Math.cos(this.heading) * this.speed * SIM_DT;
    this.y += Math.sin(this.heading) * this.speed * SIM_DT;
    if (this.x < 20)         { this.x = 20;         this.heading = Math.PI - this.heading; }
    if (this.x > SIM_W - 20) { this.x = SIM_W - 20; this.heading = Math.PI - this.heading; }
    if (this.y < 20)         { this.y = 20;          this.heading = -this.heading; }
    if (this.y > SIM_H - 20) { this.y = SIM_H - 20;  this.heading = -this.heading; }
    this.heading = wrapAngle(this.heading);
  }
}

class Prey extends Entity {
  constructor(x, y, brain, variant) {
    super(x, y, 95);
    this.brain = brain; this.variant = variant; this.energy = 0;
    this.color = jitterColor(PREY_COLORS[variant], 4);
    this.panicTimer = 0; this.panicCooldown = 0; this.panicX = 0; this.panicY = 0;
  }
  think(foods, preds, peers) {
    let nf = null, nfd = Infinity;
    for (const f of foods) { const d = Math.hypot(f.x-this.x,f.y-this.y); if(d<nfd){nfd=d;nf=f;} }
    let np = null, npd = Infinity;
    for (const p of preds) { const d = Math.hypot(p.x-this.x,p.y-this.y); if(d<npd){npd=d;np=p;} }
    let nb = null, nbd = Infinity;
    for (const b of peers) {
      if (b === this || !b.alive) continue;
      const d = Math.hypot(b.x-this.x,b.y-this.y); if(d<nbd){nbd=d;nb=b;}
    }
    const fa = nf ? wrapAngle(Math.atan2(nf.y-this.y,nf.x-this.x)-this.heading)/Math.PI : 0;
    const pa = np ? wrapAngle(Math.atan2(np.y-this.y,np.x-this.x)-this.heading)/Math.PI : 0;
    const ba = nb ? wrapAngle(Math.atan2(nb.y-this.y,nb.x-this.x)-this.heading)/Math.PI : 0;
    const [turn,thr] = this.brain.forward([
      nf?clamp(nfd/400,0,1):1, fa, np?clamp(npd/300,0,1):1, pa,
      (this.x/SIM_W)*2-1, (this.y/SIM_H)*2-1,
      nb?clamp(nbd/200,0,1):1, ba,
    ]);
    return { turn, throttle: (thr+1)*0.5 };
  }
}

class Predator extends Entity {
  constructor(x, y, brain, variant) {
    super(x, y, 120, 3.2);
    this.brain = brain; this.variant = variant; this.hunger = 0; this.satiatedTicks = 0;
    this.color = jitterColor(PRED_COLORS[variant], 4);
  }
  think(preyList, predList) {
    let np = null, npd = Infinity;
    for (const p of preyList) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x-this.x,p.y-this.y); if(d<npd){npd=d;np=p;}
    }
    let nb = null, nbd = Infinity;
    for (const p of predList) {
      if (p === this || !p.alive) continue;
      const d = Math.hypot(p.x-this.x,p.y-this.y); if(d<nbd){nbd=d;nb=p;}
    }
    const pa  = np ? wrapAngle(Math.atan2(np.y-this.y,np.x-this.x)-this.heading)/Math.PI : 0;
    const nba = nb ? wrapAngle(Math.atan2(nb.y-this.y,nb.x-this.x)-this.heading)/Math.PI : 0;
    const [turn,thr] = this.brain.forward([
      np?clamp(npd/500,0,1):1, pa, np?np.speed/np.maxSpeed:0,
      (this.x/SIM_W)*2-1, (this.y/SIM_H)*2-1,
      clamp(this.hunger/300, 0, 1),
      nb?clamp(nbd/300,0,1):1, nba,
    ]);
    return { turn, throttle: (thr+1)*0.5 };
  }
}

// ── Shrimp ────────────────────────────────────────────────────────────────────
class Shrimp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 18 + Math.random() * 15;
    this.timer = Math.random() * 1.5;
    this.variant = Math.floor(Math.random() * 2);
  }
  step(dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.heading = wrapAngle(this.heading + (Math.random() - 0.5) * Math.PI * 0.8);
      this.timer = 0.6 + Math.random() * 1.8;
    }
    if (this.y < SIM_H * 0.73) this.heading = wrapAngle(this.heading + 2.5 * dt);
    else if (this.y > SIM_H - 12) this.heading = wrapAngle(this.heading - 3.5 * dt);
    this.x += Math.cos(this.heading) * this.speed * dt;
    this.y += Math.sin(this.heading) * this.speed * dt;
    this.x = clamp(this.x, 20, SIM_W - 20);
    this.y = clamp(this.y, SIM_H * 0.6, SIM_H - 8);
  }
}

// ── Canvas + grid ─────────────────────────────────────────────────────────────
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
let W, H, scaleX, scaleY, dpr, CELL, COLS, ROWS;
let grid, cellBase, bgCanvas, bgCtx, trailCanvas, trailCtx, noiseCanvas, noiseCtx, NC_W, NC_H;

function initGrid() {
  CELL = Math.max(10, Math.round(Math.min(W, H) / 80));
  COLS = Math.ceil(W / CELL) + 1;
  ROWS = Math.ceil(H / CELL) + 1;

  cellBase = Array.from({length: COLS}, () =>
    Array.from({length: ROWS}, (_, r) => {
      if (r < SURF_ROWS) return lerpColor("#1b2e2e", "#141414", r / SURF_ROWS);
      if (r >= ROWS - SAND_ROWS) return lerpColor("#141414", "#231f10", (r - (ROWS - SAND_ROWS)) / (SAND_ROWS - 1));
      return "#141414";
    })
  );

  grid = Array.from({length: COLS}, () =>
    Array.from({length: ROWS}, (_, r) => r >= ROWS - SAND_ROWS ? rh() : rk())
  );

  bgCanvas = new OffscreenCanvas(COLS * CELL * dpr, ROWS * CELL * dpr);
  bgCtx = bgCanvas.getContext("2d");
  bgCtx.font = `${CELL * dpr}px monospace`;
  bgCtx.textBaseline = "top";
  bgCtx.textAlign = "left";
  bgCtx.fillStyle = "#000";
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const cellPx = CELL * dpr;
      const x = c * cellPx, y = r * cellPx;
      bgCtx.fillStyle = "#000";
      bgCtx.fillRect(x, y, cellPx, cellPx);
      bgCtx.fillStyle = cellBase[c][r];
      bgCtx.fillText(grid[c][r], x, y);
    }
  }

  trailCanvas = new OffscreenCanvas(COLS * CELL * dpr, ROWS * CELL * dpr);
  trailCtx = trailCanvas.getContext("2d");

  NC_W = Math.ceil(COLS / 3) + 2;
  NC_H = Math.ceil(ROWS / 3) + 2;
  noiseCanvas = new OffscreenCanvas(NC_W, NC_H);
  noiseCtx = noiseCanvas.getContext("2d");
}

function resize() {
  dpr = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + "px"; canvas.style.height = H + "px";
  scaleX = W / 1000; scaleY = H / SIM_H;
  initGrid();
  buildCosmetics();
}

function touchCell(c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
  const isSand = r >= ROWS - SAND_ROWS;
  grid[c][r] = isSand ? rh() : rk();
  const cellPx = CELL * dpr, x = c * cellPx, y = r * cellPx;
  bgCtx.fillStyle = "#000";
  bgCtx.fillRect(x, y, cellPx, cellPx);
  bgCtx.fillStyle = cellBase[c][r];
  bgCtx.fillText(grid[c][r], x, y);
}

function toC(sx, sy) {
  return [(sx * scaleX - screenIndex * W) * dpr, sy * scaleY * dpr];
}
function simToGrid(sx, sy) {
  const [cx, cy] = toC(sx, sy);
  return [Math.floor(cx / (CELL * dpr)), Math.floor(cy / (CELL * dpr))];
}

function paintCell(c, r, color) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
  const px = CELL * dpr, x = c * px, y = r * px;
  ctx.fillStyle = "#000";
  ctx.fillRect(x, y, px, px);
  ctx.fillStyle = color;
  ctx.fillText(grid[c][r], x, y);
}

function paintTrailCell(c, r, color) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
  const px = CELL * dpr, x = c * px, y = r * px;
  trailCtx.clearRect(x, y, px, px);
  trailCtx.fillStyle = color;
  trailCtx.fillText(grid[c][r], x, y);
}

// ── Cosmetics ─────────────────────────────────────────────────────────────────
let bubbles, weeds, shrimpList = [];

function buildCosmetics() {
  if (!COLS || !ROWS) return;
  bubbles = Array.from({length: Math.floor(COLS * 0.14)}, () => ({
    col: Math.floor(Math.random() * COLS),
    row: Math.random() * ROWS,
    speed: 8 + Math.random() * 18,
  }));
  weeds = [];
  for (let c = 0; c < COLS; c++)
    if (Math.random() < 0.09)
      weeds.push({ baseCol: c, height: 3 + Math.floor(Math.random() * 8), phase: Math.random() * Math.PI * 2 });

  const NUM_SHRIMP = Math.max(3, Math.floor(COLS * 0.04));
  shrimpList = Array.from({length: NUM_SHRIMP}, () => new Shrimp(
    20 + Math.random() * (SIM_W - 40),
    SIM_H * (0.72 + Math.random() * 0.2)
  ));
}

function paintNoise() {
  const id = new ImageData(NC_W, NC_H);
  for (let y = 0; y < NC_H; y++) {
    for (let x = 0; x < NC_W; x++) {
      const n1 = valueNoise3D(x * 0.35, y * 0.35, noiseT);
      const n2 = valueNoise3D(x * 0.8,  y * 0.8,  noiseT * 1.6);
      const n = n1 * 0.65 + n2 * 0.35;
      const i = (y * NC_W + x) * 4;
      id.data[i + 3] = Math.floor(n * n * 170);
    }
  }
  noiseCtx.putImageData(id, 0, 0);
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function drawBubbles(dt) {
  for (const b of bubbles) {
    b.row -= b.speed * dt;
    if (b.row < -1) { b.row = ROWS + 1; b.col = Math.floor(Math.random() * COLS); }
    paintTrailCell(Math.floor(b.col), Math.floor(b.row), "#2255aa");
  }
}

function drawAlgae(t) {
  for (const w of weeds) {
    for (let i = 0; i < w.height; i++) {
      const row = ROWS - 1 - i;
      const col = w.baseCol + Math.round(Math.sin(t * 0.9 + w.phase + i * 0.7));
      const g = Math.floor(90 + (i / w.height) * 110);
      paintCell(col, row, `rgb(0,${g},0)`);
    }
  }
}

function drawFood() {
  for (const f of foodList) {
    const [gc, gr] = simToGrid(f.x, f.y);
    paintCell(gc, gr, "#004433");
  }
}

const SHRIMP_COLORS = ["#e05a20", "#ff8c50"];

function drawShrimp() {
  if (!shrimpList.length) return;
  for (const s of shrimpList) {
    const [gc, gr] = simToGrid(s.x, s.y);
    const dc = -Math.cos(s.heading), dr = -Math.sin(s.heading);
    const col = SHRIMP_COLORS[s.variant];
    paintTrailCell(gc, gr, col);
    paintTrailCell(Math.round(gc + dc), Math.round(gr + dr), col);
  }
}

function drawScreenIndicator() {
  if (totalScreens < 2) return;
  const m = 6 * dpr, s = 4 * dpr;
  const x = screenIndex === 0 ? canvas.width - m - s : m;
  const y = canvas.height - m - s;
  ctx.fillStyle = "rgba(180,180,180,0.2)";
  ctx.fillRect(x, y, s, s);
}

function drawSurfaceShimmer(t) {
  for (let c = 0; c < COLS; c++) {
    const wave = (Math.sin(t * 0.55 + c * 0.22) + 1) * 0.5;
    for (let r = 0; r < ROWS; r++) {
      const depthFade = Math.pow(1 - r / ROWS, 2);
      const alpha = wave * depthFade * 0.09;
      if (alpha > 0.012) {
        const px = CELL * dpr;
        ctx.fillStyle = `rgba(80,200,200,${alpha.toFixed(3)})`;
        ctx.fillRect(c * px, r * px, px, px);
      }
    }
  }
}

const spawnFlashes = [];

function drawSpawnFlashes() {
  for (let i = spawnFlashes.length - 1; i >= 0; i--) {
    const s = spawnFlashes[i];
    const [gc, gr] = simToGrid(s.x, s.y);
    const alpha = ((s.frames / 10) * 0.5).toFixed(2);
    const col = `rgba(0,229,255,${alpha})`;
    paintTrailCell(gc, gr, col);
    if (s.frames > 5) {
      paintTrailCell(gc + 1, gr, col);
      paintTrailCell(gc - 1, gr, col);
      paintTrailCell(gc, gr + 1, col);
      paintTrailCell(gc, gr - 1, col);
    }
    if (--s.frames <= 0) spawnFlashes.splice(i, 1);
  }
}

const PREY_COLORS = ["#00e5ff", "#ffcc00"];
const PRED_COLORS = ["#bf5af2", "#05ffa1"];
const PRED_HUNT_COLORS = ["#e88aff", "#66ffbe"];

function drawEntities() {
  for (const p of preyList) {
    if (!p.alive) continue;
    const [gc, gr] = simToGrid(p.x, p.y);
    const dc = -Math.cos(p.heading), dr = -Math.sin(p.heading);
    const panicBright = p.panicTimer > 0 ? (p.panicTimer / 40) * 0.85 : 0;
    const color = panicBright > 0.05 ? lerpColor(p.color, "#ffffff", panicBright) : p.color;
    for (let i = 0; i < 3; i++)
      paintTrailCell(Math.round(gc + dc * i), Math.round(gr + dr * i), color);
  }
  for (const p of predList) {
    if (!p.alive) continue;
    const [gc, gr] = simToGrid(p.x, p.y);
    const dc = -Math.cos(p.heading), dr = -Math.sin(p.heading);
    const perpC = -Math.sin(p.heading), perpR = Math.cos(p.heading);

    // Subtle brighten when closing in on prey
    let minPreyDist = Infinity;
    for (const prey of preyList) {
      if (!prey.alive) continue;
      const d = Math.hypot(prey.x - p.x, prey.y - p.y);
      if (d < minPreyDist) minPreyDist = d;
    }
    const huntT = minPreyDist < 90 ? (1 - minPreyDist / 90) * 0.5 : 0;
    const color = huntT > 0.05
      ? lerpColor(p.color, PRED_HUNT_COLORS[p.variant], huntT)
      : p.color;

    for (let i = 0; i < 5; i++)
      paintTrailCell(Math.round(gc + dc * i), Math.round(gr + dr * i), color);
    paintTrailCell(Math.round(gc + perpC), Math.round(gr + perpR), color);
    paintTrailCell(Math.round(gc - perpC), Math.round(gr - perpR), color);
  }
}

function randomSplashCells() {
  const cells = [[0, 0]];
  for (let k = 0; k < 4 + Math.floor(Math.random() * 3); k++)
    cells.push([
      Math.round((Math.random() * 2 - 1) * 2),
      Math.round((Math.random() * 2 - 1) * 2 - 0.4),
    ]);
  return cells;
}

function drawDeathSplashes() {
  for (let i = deathSplashes.length - 1; i >= 0; i--) {
    const s = deathSplashes[i];
    const [gc, gr] = simToGrid(s.x, s.y);
    const grOff = gr - Math.round(s.dy);
    for (const [dc, dr] of s.cells)
      paintTrailCell(gc + dc, grOff + dr, "#ff0000");
    s.dy += 0.06;
    if (--s.frames <= 0) deathSplashes.splice(i, 1);
  }
}

const predDeathAnims = [];

function drawPredDeathAnims() {
  for (let i = predDeathAnims.length - 1; i >= 0; i--) {
    const s = predDeathAnims[i];
    const [gc, gr] = simToGrid(s.x, s.y);
    const grOff = gr - Math.round(s.dy);
    const dc = -Math.cos(s.heading), dr = -Math.sin(s.heading);
    const perpC = -Math.sin(s.heading), perpR = Math.cos(s.heading);
    for (let j = 0; j < 5; j++)
      paintTrailCell(Math.round(gc + dc*j), Math.round(grOff + dr*j), "#555555");
    paintTrailCell(Math.round(gc + perpC), Math.round(grOff + perpR), "#555555");
    paintTrailCell(Math.round(gc - perpC), Math.round(grOff - perpR), "#555555");
    s.dy += 0.1;
    if (--s.frames <= 0) predDeathAnims.splice(i, 1);
  }
}

// ── Simulation ────────────────────────────────────────────────────────────────
let preyRespawnCooldown = 0;
let predRespawnCooldown = 0;
let predMigrationTimer = 0;
const NUM_PREY = 28 * totalScreens;
const NUM_PRED =  4 * totalScreens;
const NUM_FOOD = 24 * totalScreens;
let preyBrain, predBrain, preyList, predList, foodList;
const deathSplashes = [];

const isPrimary = screenIndex === 0 || totalScreens === 1;

let predatorsEnabled = true;
let mouseSimX = -9999, mouseSimY = -9999;
document.addEventListener("mousemove", e => {
  mouseSimX = (e.clientX / W) * 1000 + screenIndex * 1000;
  mouseSimY = (e.clientY / H) * SIM_H;
});

function spawnFood() {
  return { x: 20 + rng() * (SIM_W-40), y: 20 + rng() * (SIM_H-40) };
}
function respawnPrey() {
  const alive = preyList.filter(p => p.alive);
  const parent = alive.length ? alive[Math.floor(rng() * alive.length)] : null;
  const x = parent ? clamp(parent.x + (rng()-0.5)*50, 20, SIM_W-20) : 20+rng()*(SIM_W-40);
  const y = parent ? clamp(parent.y + (rng()-0.5)*50, 20, SIM_H-20) : 20+rng()*(SIM_H-40);
  const dead = preyList.findIndex(p => !p.alive);
  const p = new Prey(x, y, preyBrain, Math.floor(rng()*2));
  if (dead >= 0) preyList[dead] = p; else preyList.push(p);
}
function respawnPredator() {
  const dead = predList.findIndex(p => !p.alive);
  const p = new Predator(20+rng()*(SIM_W-40), 20+rng()*(SIM_H-40), predBrain, Math.floor(rng()*2));
  if (dead >= 0) predList[dead] = p; else predList.push(p);
}

// Simplified Lotka-Volterra to estimate population after a tab pause
function lotkaVolterraSteps(prey, pred, ticks) {
  const r = 0.0007, a = 0.00004, b = 0.000015, d = 0.0005;
  for (let i = 0; i < ticks; i++) {
    const dP = r * prey - a * prey * pred;
    const dQ = b * prey * pred - d * pred;
    prey = Math.max(2, prey + dP);
    pred = Math.max(0, pred + dQ);
  }
  return {
    prey: clamp(Math.round(prey), 4, NUM_PREY),
    pred: clamp(Math.round(pred), 0, NUM_PRED),
  };
}

function initSim(nPrey = NUM_PREY, nPred = NUM_PRED) {
  preyList = Array.from({length: nPrey}, (_, i) =>
    new Prey(20+rng()*(SIM_W-40), 20+rng()*(SIM_H-40), preyBrain, i%2));
  predList = Array.from({length: nPred}, (_, i) =>
    new Predator(20+rng()*(SIM_W-40), 20+rng()*(SIM_H-40), predBrain, i%2));
  foodList = Array.from({length: NUM_FOOD}, spawnFood);
}

// ── Multi-screen state sync ───────────────────────────────────────────────────
function serializeState() {
  return {
    prey:        preyList.map(p => ({ x: p.x, y: p.y, h: p.heading, a: p.alive, v: p.variant, c: p.color, pt: p.panicTimer, pc: p.panicCooldown, px: p.panicX, py: p.panicY })),
    pred:        predList.map(p => ({ x: p.x, y: p.y, h: p.heading, a: p.alive, v: p.variant, c: p.color, hunger: p.hunger })),
    food:        foodList.map(f => ({ x: f.x, y: f.y })),
    splashes:    deathSplashes.map(s => ({ x: s.x, y: s.y, frames: s.frames, dy: s.dy, cells: s.cells.slice() })),
    predAnims:   predDeathAnims.map(s => ({ ...s })),
    spawnFlashes: spawnFlashes.map(s => ({ ...s })),
    noiseT,
    predatorsEnabled,
  };
}

function applyState(data) {
  while (preyList.length < data.prey.length) preyList.push(new Prey(0, 0, null, 0));
  preyList.length = data.prey.length;
  for (let i = 0; i < data.prey.length; i++) {
    const p = preyList[i], d = data.prey[i];
    p.x = d.x; p.y = d.y; p.heading = d.h; p.alive = d.a; p.variant = d.v; p.color = d.c;
    p.panicTimer = d.pt || 0; p.panicCooldown = d.pc || 0; p.panicX = d.px || 0; p.panicY = d.py || 0;
  }
  while (predList.length < data.pred.length) predList.push(new Predator(0, 0, null, 0));
  predList.length = data.pred.length;
  for (let i = 0; i < data.pred.length; i++) {
    const p = predList[i], d = data.pred[i];
    p.x = d.x; p.y = d.y; p.heading = d.h; p.alive = d.a; p.variant = d.v; p.color = d.c; p.hunger = d.hunger;
  }
  foodList.length = 0;
  data.food.forEach(f => foodList.push(f));
  deathSplashes.length = 0;
  data.splashes.forEach(s => deathSplashes.push(s));
  predDeathAnims.length = 0;
  data.predAnims.forEach(s => predDeathAnims.push(s));
  spawnFlashes.length = 0;
  data.spawnFlashes.forEach(s => spawnFlashes.push(s));
  noiseT = data.noiseT;
  predatorsEnabled = data.predatorsEnabled;
}

function stepOnce() {
  // Panic scatter: predator entering a cluster of 3+ prey triggers simultaneous radial burst
  for (const pred of predList) {
    if (!pred.alive) continue;
    const cluster = preyList.filter(p => p.alive && p.panicCooldown === 0 && Math.hypot(p.x - pred.x, p.y - pred.y) < 80);
    if (cluster.length >= 3) {
      for (const p of cluster) {
        p.panicTimer = 40; p.panicCooldown = 120; p.panicX = pred.x; p.panicY = pred.y;
      }
    }
  }

  for (const p of preyList) {
    if (!p.alive) continue;
    const [gc, gr] = simToGrid(p.x, p.y);
    const dc = -Math.cos(p.heading), dr = -Math.sin(p.heading);
    for (let i = 0; i < 3; i++) touchCell(Math.round(gc + dc * i), Math.round(gr + dr * i));

    const {turn: rawTurn, throttle: rawThrottle} = p.think(foodList, predList, preyList);

    // Mouse flee: steer and accelerate away from cursor
    let turn = rawTurn;
    let throttle = rawThrottle;
    const md = Math.hypot(mouseSimX - p.x, mouseSimY - p.y);
    if (md < 220 && md > 0) {
      const awayA = Math.atan2(p.y - mouseSimY, p.x - mouseSimX);
      const mRel = wrapAngle(awayA - p.heading) / Math.PI;
      const fleeFactor = 1 - md / 220;
      turn = turn * (1 - fleeFactor) + mRel * fleeFactor;
      throttle = Math.max(throttle, fleeFactor * 0.9);
    }

    // Panic scatter override
    if (p.panicTimer > 0) {
      p.panicTimer--;
      const pf = p.panicTimer / 40;
      const awayA = Math.atan2(p.y - p.panicY, p.x - p.panicX);
      const awayRel = wrapAngle(awayA - p.heading) / Math.PI;
      turn = turn * (1 - pf * 0.9) + awayRel * pf * 0.9;
      throttle = Math.max(throttle, pf);
    }
    if (p.panicCooldown > 0) p.panicCooldown--;

    let nearestPredDist = Infinity;
    for (const pred of predList) {
      if (!pred.alive) continue;
      const d = Math.hypot(pred.x - p.x, pred.y - p.y);
      if (d < nearestPredDist) nearestPredDist = d;
    }
    const prevMaxSpeed = p.maxSpeed;
    if (nearestPredDist < 60 || md < 80) p.maxSpeed = 155;
    if (p.panicTimer > 0) p.maxSpeed = Math.max(p.maxSpeed, 200);
    p.step(turn, throttle);
    p.maxSpeed = prevMaxSpeed;

    // Gentle current nudge from noise field
    const {dx, dy} = getCurrentNudge(p.x, p.y);
    p.x = clamp(p.x + dx, 20, SIM_W - 20);
    p.y = clamp(p.y + dy, 20, SIM_H - 20);

    for (let i = foodList.length-1; i >= 0; i--) {
      if (Math.hypot(foodList[i].x-p.x, foodList[i].y-p.y) < 12) {
        foodList[i] = spawnFood();
        p.energy++;
        if (p.energy >= 5 && preyList.filter(q => q.alive).length < NUM_PREY) {
          p.energy = 0;
          const nx = clamp(p.x + (rng()-0.5)*50, 20, SIM_W-20);
          const ny = clamp(p.y + (rng()-0.5)*50, 20, SIM_H-20);
          const dead = preyList.findIndex(q => !q.alive);
          const offspring = new Prey(nx, ny, preyBrain, Math.floor(rng()*2));
          if (dead >= 0) preyList[dead] = offspring; else preyList.push(offspring);
          spawnFlashes.push({ x: nx, y: ny, frames: 10 });
        }
      }
    }
  }
  for (const pred of predList) {
    if (!pred.alive) continue;
    const [gc, gr] = simToGrid(pred.x, pred.y);
    const dc = -Math.cos(pred.heading), dr = -Math.sin(pred.heading);
    for (let i = 0; i < 5; i++) touchCell(Math.round(gc + dc * i), Math.round(gr + dr * i));

    const {turn, throttle} = pred.think(preyList, predList);
    pred.step(turn, throttle);

    const {dx, dy} = getCurrentNudge(pred.x, pred.y);
    pred.x = clamp(pred.x + dx, 20, SIM_W - 20);
    pred.y = clamp(pred.y + dy, 20, SIM_H - 20);

    pred.hunger++;
    if (pred.satiatedTicks > 0) pred.satiatedTicks--;
    if (pred.hunger > 300) {
      pred.alive = false;
      predDeathAnims.push({ x: pred.x, y: pred.y, heading: pred.heading, frames: 50, dy: 0 });
    }
    if (pred.satiatedTicks === 0) {
      for (const p of preyList) {
        if (!p.alive) continue;
        if (Math.hypot(p.x-pred.x, p.y-pred.y) < 14) {
          p.alive = false;
          pred.hunger = 0;
          pred.satiatedTicks = 80;
          deathSplashes.push({ x: p.x, y: p.y, frames: 60, dy: 0, cells: randomSplashCells() });
          break;
        }
      }
    }
  }
  if (preyRespawnCooldown > 0) preyRespawnCooldown--;
  if (predRespawnCooldown > 0) predRespawnCooldown--;

  const alivePrey = preyList.filter(p => p.alive).length;
  const alivePred = predList.filter(p => p.alive).length;

  if (preyRespawnCooldown === 0) {
    if (alivePrey < Math.floor(NUM_PREY * 0.3)) {
      const count = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i++) respawnPrey();
      preyRespawnCooldown = 60;
    } else if (alivePrey < NUM_PREY) {
      respawnPrey();
      preyRespawnCooldown = 20;
    }
  }

  if (predatorsEnabled) {
    if (alivePred === 0 && predMigrationTimer === 0) predMigrationTimer = 300;
    if (predMigrationTimer > 0) {
      predMigrationTimer--;
      if (predMigrationTimer === 0 && alivePrey > NUM_PREY * 0.5) {
        respawnPredator();
        predRespawnCooldown = 150;
      }
    } else if (predRespawnCooldown === 0 && alivePred < NUM_PRED && alivePrey > NUM_PREY * 0.5) {
      respawnPredator();
      predRespawnCooldown = 150;
    }
  }
  noiseT += 0.015;
}

// ── Main loop ─────────────────────────────────────────────────────────────────
let lastStepIdx = Math.floor(Date.now() / (1000 / SIM_HZ));
let lastTs = null;

function tick(ts) {
  if (!lastTs) lastTs = ts;
  const elapsed = Math.min((ts - lastTs) / 1000, 0.2);
  lastTs = ts;

  const curIdx = Math.floor(Date.now() / (1000 / SIM_HZ));
  const steps = Math.min(curIdx - lastStepIdx, 8);
  for (let i = 0; i < steps; i++) stepOnce();
  lastStepIdx = curIdx;

  for (const s of shrimpList) s.step(elapsed);

  trailCtx.globalCompositeOperation = "destination-out";
  trailCtx.fillStyle = "rgba(0,0,0,0.055)";
  trailCtx.fillRect(0, 0, trailCanvas.width, trailCanvas.height);
  trailCtx.globalCompositeOperation = "source-over";
  trailCtx.font = `${CELL * dpr}px monospace`;
  trailCtx.textBaseline = "top";
  trailCtx.textAlign = "left";
  drawDeathSplashes();
  drawPredDeathAnims();
  drawEntities();
  drawBubbles(elapsed);
  drawShrimp();
  drawSpawnFlashes();

  paintNoise();
  ctx.drawImage(bgCanvas, 0, 0);
  ctx.drawImage(noiseCanvas, 0, 0, canvas.width, canvas.height);
  ctx.drawImage(trailCanvas, 0, 0);

  ctx.font = `${CELL * dpr}px monospace`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  drawAlgae(ts / 1000);
  drawFood();
  drawSurfaceShimmer(ts / 1000);

  drawScreenIndicator();
  if (totalScreens > 1) aqChannel.postMessage(serializeState());
  requestAnimationFrame(tick);
}

function tickSecondary(ts) {
  if (!lastTs) lastTs = ts;
  const elapsed = Math.min((ts - lastTs) / 1000, 0.2);
  lastTs = ts;

  if (!preyList || !preyList.length) { requestAnimationFrame(tickSecondary); return; }

  // Touch entity cells so bgCanvas chars cycle as fish pass through
  for (const p of preyList) {
    if (!p.alive) continue;
    const [gc, gr] = simToGrid(p.x, p.y);
    const dc = -Math.cos(p.heading), dr = -Math.sin(p.heading);
    for (let i = 0; i < 3; i++) touchCell(Math.round(gc + dc * i), Math.round(gr + dr * i));
  }
  for (const p of predList) {
    if (!p.alive) continue;
    const [gc, gr] = simToGrid(p.x, p.y);
    const dc = -Math.cos(p.heading), dr = -Math.sin(p.heading);
    for (let i = 0; i < 5; i++) touchCell(Math.round(gc + dc * i), Math.round(gr + dr * i));
  }

  for (const s of shrimpList) s.step(elapsed);

  trailCtx.globalCompositeOperation = "destination-out";
  trailCtx.fillStyle = "rgba(0,0,0,0.055)";
  trailCtx.fillRect(0, 0, trailCanvas.width, trailCanvas.height);
  trailCtx.globalCompositeOperation = "source-over";
  trailCtx.font = `${CELL * dpr}px monospace`;
  trailCtx.textBaseline = "top";
  trailCtx.textAlign = "left";
  drawDeathSplashes();
  drawPredDeathAnims();
  drawEntities();
  drawBubbles(elapsed);
  drawShrimp();
  drawSpawnFlashes();

  paintNoise();
  ctx.drawImage(bgCanvas, 0, 0);
  ctx.drawImage(noiseCanvas, 0, 0, canvas.width, canvas.height);
  ctx.drawImage(trailCanvas, 0, 0);

  ctx.font = `${CELL * dpr}px monospace`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  drawAlgae(ts / 1000);
  drawFood();
  drawSurfaceShimmer(ts / 1000);
  drawScreenIndicator();

  requestAnimationFrame(tickSecondary);
}

// ── Controls ──────────────────────────────────────────────────────────────────
function togglePredators() {
  predatorsEnabled = !predatorsEnabled;
  if (!predatorsEnabled) {
    for (const p of predList) {
      if (p.alive) {
        predDeathAnims.push({ x: p.x, y: p.y, heading: p.heading, frames: 50, dy: 0 });
        p.alive = false;
      }
    }
    predMigrationTimer = 0;
  } else {
    for (let i = 0; i < NUM_PRED; i++) respawnPredator();
  }
}

const overlay = document.getElementById("brightness-overlay");
let brightnessLevel = 0;
function adjustBrightness(d) {
  brightnessLevel = clamp(brightnessLevel + d, 0, 10);
  overlay.style.opacity = brightnessLevel * 0.1;
}
function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}

document.addEventListener("keydown", e => {
  if (e.key === "q" || e.key === "Q") { aqChannel.postMessage("close"); window.close(); }
  else if (e.key === "p" || e.key === "P") togglePredators();
  else if (e.key === ",") adjustBrightness(1);
  else if (e.key === ".") adjustBrightness(-1);
  else if (e.key === "f" || e.key === "F") {
    if (document.fullscreenElement) document.exitFullscreen();
    else enterFullscreen();
  } else if (!document.fullscreenElement) enterFullscreen();
});
document.addEventListener("click", () => { if (!document.fullscreenElement) enterFullscreen(); });
window.addEventListener("resize", resize);

// ── Boot ──────────────────────────────────────────────────────────────────────
const aqChannel = new BroadcastChannel("aquarium-screensaver");
aqChannel.onmessage = ({ data }) => {
  if (data === "close") { window.close(); return; }
  if (!isPrimary) applyState(data);
};

window.addEventListener("beforeunload", () => {
  if (!isPrimary || !preyList) return;
  localStorage.setItem("aquarium-close", String(Date.now()));
  localStorage.setItem("aquarium-pop", JSON.stringify({
    prey: preyList.filter(p => p.alive).length,
    pred: predList.filter(p => p.alive).length,
  }));
});

resize();

if (isPrimary) {
  fetch("ecosystem_brains.json")
    .then(r => r.json())
    .then(data => {
      preyBrain = new Brain(data.species.prey.architecture, data.species.prey.weights);
      predBrain = new Brain(data.species.predator.architecture, data.species.predator.weights);

      const lastClose = parseInt(localStorage.getItem("aquarium-close") || "0");
      const lastPopRaw = localStorage.getItem("aquarium-pop");
      let startPrey = NUM_PREY, startPred = NUM_PRED;
      if (lastClose && lastPopRaw) {
        try {
          const lastPop = JSON.parse(lastPopRaw);
          const elapsed = Math.min(Date.now() - lastClose, 120000);
          const ticks = Math.floor(elapsed / (1000 / SIM_HZ));
          const result = lotkaVolterraSteps(lastPop.prey, lastPop.pred, ticks);
          startPrey = result.prey;
          startPred = result.pred;
        } catch (_) {}
      }

      initSim(startPrey, startPred);
      requestAnimationFrame(tick);
    });
} else {
  preyList = []; predList = []; foodList = [];
  requestAnimationFrame(tickSecondary);
}
