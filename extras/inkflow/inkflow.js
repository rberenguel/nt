// Inkflow — flowing pigment network
// WebGL2 + Transform Feedback + MRT soft-brush deposit + flow advection + display compositing

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = parseInt(params.get("screens") || "1", 10);
const isPrimary = screenIndex === 0;

document.title = `Inkflow ${screenIndex}`;

const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2", {
  preserveDrawingBuffer: true,
  alpha: false,
  antialias: false,
});

if (!gl) {
  document.body.innerHTML = `<div style="color:#333;padding:30px;font-family:sans-serif">
    WebGL2 is required for this screensaver.
  </div>`;
  throw new Error("WebGL2 not supported");
}

// ── HUD ─────────────────────────────────────────────────────────────────────
const hud = document.getElementById("hud");
const hudScreen = document.getElementById("hudScreen");
const hudMaster = document.getElementById("hudMaster");
const hudPalette = document.getElementById("hudPalette");
const hudBezel = document.getElementById("hudBezel");
const hudAgents = document.getElementById("hudAgents");
const hudGrid = document.getElementById("hudGrid");

if (hudScreen) hudScreen.textContent = `${screenIndex + 1} / ${totalScreens}`;
if (hudMaster) hudMaster.textContent = isPrimary ? "YES" : "NO (Client)";
if (hud) hud.classList.add("hidden");

function resize() {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
}
window.addEventListener("resize", resize);
resize();

// ── BroadcastChannel ────────────────────────────────────────────────────────
const bc = new BroadcastChannel("inkflow");

function saveCanvas() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inkflow-screen${screenIndex}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

// ── Simulation Constants ────────────────────────────────────────────────────
const GRID_W = 1024 * totalScreens;
const GRID_H = 1024;
const MAX_AGENTS = 60000;
const SENSOR_OFFSET = 2.2;    // finer sensing → finer veins
const SENSOR_ANGLE = Math.PI / 5.5;
const TURN_SPEED = 0.10;      // calmer turns
const WANDER = 0.035;
const TRAIL_DEPOSIT = 0.005;
const PIGMENT_DEPOSIT = 0.005;
const AGENT_LIFE = 18.0;      // longer life → longer strokes
const FLOW_STRENGTH = 1.2;    // pigment advection along gradients
const FLOW_DIFFUSION = 0.25;  // pigment diffusion
const TRAIL_DECAY = 0.96;     // trail decay keeps the network evolving
const PIGMENT_DECAY = 0.9997; // almost no pigment fade — accumulates and deepens

// ── Palettes (K = absorption; low K = reflects that channel) ────────────────
const PALETTES = [
  {
    name: "Warm Earth",
    colors: [
      [0.08, 0.10, 0.72],  // yellow
      [0.18, 0.45, 0.70],  // orange
      [0.72, 0.80, 0.12],  // crimson
      [0.55, 0.15, 0.45],  // teal
      [0.25, 0.30, 0.55],  // ochre
    ],
  },
  {
    name: "Indigo & Sienna",
    colors: [
      [0.78, 0.58, 0.10],  // deep blue
      [0.12, 0.65, 0.75],  // burnt sienna
      [0.32, 0.30, 0.28],  // payne's grey
      [0.60, 0.35, 0.12],  // ultramarine
    ],
  },
  {
    name: "Full Spectrum",
    colors: [
      [0.65, 0.85, 0.15],  // scarlet
      [0.08, 0.12, 0.75],  // lemon yellow
      [0.70, 0.10, 0.60],  // emerald
      [0.70, 0.35, 0.10],  // cobalt
      [0.35, 0.75, 0.15],  // violet
    ],
  },
  {
    name: "Sumi-e",
    colors: [
      [0.55, 0.52, 0.48],  // soft black
      [0.35, 0.32, 0.28],  // grey
      [0.22, 0.19, 0.17],  // warm grey
      [0.60, 0.52, 0.35],  // sepia
    ],
  },
];

let currentPalette = Math.floor(Math.random() * PALETTES.length);
let showBezel = 0.0;
let paused = false;
let inkVisibility = 1.0;
let seed = Math.floor(Math.random() * 1000000);

function mulberry32(s) {
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(seed);

function reseed(newSeed) {
  seed = newSeed;
  rng = mulberry32(seed);
}

// ── Agent Data (8 floats = 32 bytes) ────────────────────────────────────────
const AGENT_STRIDE = 32;
const OFF_POS = 0;
const OFF_ANGLE = 8;
const OFF_K = 12;
const OFF_SPEED = 24;
const OFF_LIFE = 28;

let agentData = new Float32Array(MAX_AGENTS * (AGENT_STRIDE / 4));
let activeAgents = 0;
let prevActiveAgents = 0;
let needsFullUpload = false;

function spawnAgent(x, y, angle, K, speed, life) {
  if (activeAgents >= MAX_AGENTS) return false;
  const i = activeAgents;
  const base = i * (AGENT_STRIDE / 4);
  agentData[base + 0] = x;
  agentData[base + 1] = y;
  agentData[base + 2] = angle;
  agentData[base + 3] = K[0];
  agentData[base + 4] = K[1];
  agentData[base + 5] = K[2];
  agentData[base + 6] = speed;
  agentData[base + 7] = life;
  activeAgents++;
  return true;
}

// Directional brush stroke spawning
function spawnStroke(x0, y0, angle, paletteIdx, count, strokeSeed = null) {
  if (strokeSeed === null) strokeSeed = Math.floor(rng() * 2147483647);
  const srng = mulberry32(strokeSeed);

  const palette = PALETTES[paletteIdx].colors;
  const K = palette[Math.floor(srng() * palette.length)];
  const spread = 4.0;
  const angleSpread = 0.18;
  const speedBase = 0.3 + srng() * 0.3;
  const lengthStep = 1.8;

  for (let i = 0; i < count; i++) {
    const t = i / Math.max(count - 1, 1);
    const off = (srng() - 0.5) * spread;
    const perp = angle + Math.PI * 0.5;
    const px = x0 + Math.cos(angle) * t * count * lengthStep * 0.3 + Math.cos(perp) * off;
    const py = y0 + Math.sin(angle) * t * count * lengthStep * 0.3 + Math.sin(perp) * off;
    const aangle = angle + (srng() - 0.5) * angleSpread;
    const speed = speedBase * (0.85 + srng() * 0.3);
    const life = AGENT_LIFE * (0.6 + srng() * 0.5);
    if (!spawnAgent(px, py, aangle, K, speed, life)) break;
  }
}

function initAgents() {
  activeAgents = 0;
  prevActiveAgents = 0;
  needsFullUpload = true;
  for (let i = 0; i < 5; i++) {
    const cx = rng() * GRID_W;
    const cy = rng() * GRID_H;
    const angle = rng() * Math.PI * 2;
    spawnStroke(cx, cy, angle, currentPalette, 18 + Math.floor(rng() * 25));
  }
}

let nextStrokeTime = 0;

function scheduleStrokes(t) {
  if (t >= nextStrokeTime) {
    const cx = rng() * GRID_W;
    const cy = rng() * GRID_H;
    const angle = rng() * Math.PI * 2;
    const count = 15 + Math.floor(rng() * 22);
    const strokeSeed = Math.floor(rng() * 2147483647);
    spawnStroke(cx, cy, angle, currentPalette, count, strokeSeed);
    nextStrokeTime = t + 1.2 + rng() * 2.5;

    if (isPrimary) {
      bc.postMessage({ cmd: "stroke", cx, cy, angle, palette: currentPalette, count, strokeSeed });
    }
  }
}

// ── WebGL Helpers ───────────────────────────────────────────────────────────
function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(s));
    console.error(src.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n"));
  }
  return s;
}

function createProgram(vsSrc, fsSrc, tfVaryings) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc));
  if (fsSrc) gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
  if (tfVaryings) {
    gl.transformFeedbackVaryings(p, tfVaryings, gl.INTERLEAVED_ATTRIBS);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error("Link error:", gl.getProgramInfoLog(p));
  }
  return p;
}

function createFloatTexture(w, h, internalFmt, fmt, type) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFmt, w, h, 0, fmt, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return tex;
}

function createFBO(tex, attachment = gl.COLOR_ATTACHMENT0) {
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, tex, 0);
  return fbo;
}

// ── Main Setup ──────────────────────────────────────────────────────────────
async function init() {
  const [fsQuadVert, agentsVert, agentsFrag, flowFrag, displayFrag] = await Promise.all([
    fetch("fullscreen.vert").then((r) => r.text()),
    fetch("agents-update.vert").then((r) => r.text()),
    fetch("agents-deposit.frag").then((r) => r.text()),
    fetch("flow.frag").then((r) => r.text()),
    fetch("display.frag").then((r) => r.text()),
  ]);

  const agentProg = createProgram(agentsVert, agentsFrag, [
    "v_position", "v_angle", "v_K", "v_speed", "v_life",
  ]);
  const flowProg = createProgram(fsQuadVert, flowFrag);
  const displayProg = createProgram(fsQuadVert, displayFrag);

  // ── Fullscreen Quad ───────────────────────────────────────────────────────
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  const quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // ── Agent Buffers ─────────────────────────────────────────────────────────
  const agentBufA = gl.createBuffer();
  const agentBufB = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, agentBufA);
  gl.bufferData(gl.ARRAY_BUFFER, agentData.byteLength, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, agentBufB);
  gl.bufferData(gl.ARRAY_BUFFER, agentData.byteLength, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  function makeAgentVao(buf) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, AGENT_STRIDE, OFF_POS);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, AGENT_STRIDE, OFF_ANGLE);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, AGENT_STRIDE, OFF_K);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, AGENT_STRIDE, OFF_SPEED);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, AGENT_STRIDE, OFF_LIFE);
    return vao;
  }

  let agentVaoRead = makeAgentVao(agentBufA);
  let agentVaoWrite = makeAgentVao(agentBufB);
  let agentBufRead = agentBufA;
  let agentBufWrite = agentBufB;

  // ── Trail Textures (8-bit, guaranteed renderable) ─────────────────────────
  const trailTexA = createFloatTexture(GRID_W, GRID_H, gl.R8, gl.RED, gl.UNSIGNED_BYTE);
  const trailTexB = createFloatTexture(GRID_W, GRID_H, gl.R8, gl.RED, gl.UNSIGNED_BYTE);
  const trailFboA = createFBO(trailTexA);
  const trailFboB = createFBO(trailTexB);

  gl.bindFramebuffer(gl.FRAMEBUFFER, trailFboA);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, trailFboB);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // ── Pigment Textures (ping-pong, 8-bit, guaranteed renderable) ───────────
  const pigmentTexA = createFloatTexture(GRID_W, GRID_H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
  const pigmentTexB = createFloatTexture(GRID_W, GRID_H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
  const pigmentFboA = createFBO(pigmentTexA);
  const pigmentFboB = createFBO(pigmentTexB);

  gl.bindFramebuffer(gl.FRAMEBUFFER, pigmentFboA);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, pigmentFboB);
  gl.clear(gl.COLOR_BUFFER_BIT);

  let pigmentRead = pigmentTexA;
  let pigmentWrite = pigmentTexB;
  let pigmentFboRead = pigmentFboA;
  let pigmentFboWrite = pigmentFboB;

  // ── Deposit FBO (trailB + pigmentRead) ────────────────────────────────────
  const depositFbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, depositFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, trailTexB, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, pigmentRead, 0);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

  // ── Flow FBO (trailA + pigmentWrite) ──────────────────────────────────────
  const flowFbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, flowFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, trailTexA, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, pigmentWrite, 0);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

  // ── Uniforms ──────────────────────────────────────────────────────────────
  const uAgentTrail = gl.getUniformLocation(agentProg, "u_trail");
  const uAgentGrid = gl.getUniformLocation(agentProg, "u_gridSize");
  const uAgentSensorOff = gl.getUniformLocation(agentProg, "u_sensorOffset");
  const uAgentSensorAngle = gl.getUniformLocation(agentProg, "u_sensorAngle");
  const uAgentTurn = gl.getUniformLocation(agentProg, "u_turnSpeed");
  const uAgentWander = gl.getUniformLocation(agentProg, "u_wander");
  const uAgentSimTime = gl.getUniformLocation(agentProg, "u_simTime");
  const uAgentDt = gl.getUniformLocation(agentProg, "u_dt");
  const uAgentTrailDep = gl.getUniformLocation(agentProg, "u_trailDeposit");
  const uAgentPigmentDep = gl.getUniformLocation(agentProg, "u_pigmentDeposit");

  const uFlowTrail = gl.getUniformLocation(flowProg, "u_trail");
  const uFlowPigment = gl.getUniformLocation(flowProg, "u_pigment");
  const uFlowGrid = gl.getUniformLocation(flowProg, "u_gridSize");
  const uFlowStrength = gl.getUniformLocation(flowProg, "u_flowStrength");
  const uFlowDiffusion = gl.getUniformLocation(flowProg, "u_diffusion");
  const uFlowTrailDecay = gl.getUniformLocation(flowProg, "u_trailDecay");
  const uFlowPigmentDecay = gl.getUniformLocation(flowProg, "u_pigmentDecay");

  const uDispTrail = gl.getUniformLocation(displayProg, "u_trail");
  const uDispPigment = gl.getUniformLocation(displayProg, "u_pigment");
  const uDispTime = gl.getUniformLocation(displayProg, "u_time");
  const uDispRes = gl.getUniformLocation(displayProg, "u_resolution");
  const uDispSeed = gl.getUniformLocation(displayProg, "u_seed");
  const uDispScreenIdx = gl.getUniformLocation(displayProg, "u_screen_index");
  const uDispTotScreens = gl.getUniformLocation(displayProg, "u_total_screens");
  const uDispPaper = gl.getUniformLocation(displayProg, "u_paper_color");
  const uDispGrain = gl.getUniformLocation(displayProg, "u_grain");
  const uDispBorder = gl.getUniformLocation(displayProg, "u_show_border");
  const uDispInkVis = gl.getUniformLocation(displayProg, "u_ink_visibility");

  // ── State ─────────────────────────────────────────────────────────────────
  let lastTime = 0;
  let simTime = 0;
  let seedLocked = false;
  let hasDriver = false;

  initAgents();
  if (hudAgents) hudAgents.textContent = activeAgents;
  if (hudGrid) hudGrid.textContent = GRID_W;
  if (hudPalette) hudPalette.textContent = PALETTES[currentPalette].name;

  gl.bindBuffer(gl.ARRAY_BUFFER, agentBufRead);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, agentData);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // Seed handshake: primary broadcasts its seed so all screens share one
  if (isPrimary) {
    bc.postMessage({ cmd: "hello", seed: seed, palette: currentPalette });
  } else {
    setTimeout(() => {
      if (!seedLocked) {
        seedLocked = true; // fallback: use own seed as standalone
        hasDriver = false;
      }
    }, 1500);
  }

  // ── Render Functions ──────────────────────────────────────────────────────
  function updateDepositFBO() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, depositFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, trailTexB, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, pigmentRead, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  }

  function updateFlowFBO() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, flowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, trailTexA, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, pigmentWrite, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  }

  function runAgentUpdateAndDeposit(dt, simTime) {
    updateDepositFBO();

    // Clear only trail attachment
    gl.clearBufferfv(gl.COLOR, 0, new Float32Array([0, 0, 0, 0]));
    // Pigment attachment is NOT cleared — it accumulates

    gl.viewport(0, 0, GRID_W, GRID_H);
    gl.useProgram(agentProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, trailTexA);
    gl.uniform1i(uAgentTrail, 0);

    gl.uniform2f(uAgentGrid, GRID_W, GRID_H);
    gl.uniform1f(uAgentSensorOff, SENSOR_OFFSET);
    gl.uniform1f(uAgentSensorAngle, SENSOR_ANGLE);
    gl.uniform1f(uAgentTurn, TURN_SPEED);
    gl.uniform1f(uAgentWander, WANDER);
    gl.uniform1f(uAgentSimTime, simTime);
    gl.uniform1f(uAgentDt, dt);
    gl.uniform1f(uAgentTrailDep, TRAIL_DEPOSIT);
    gl.uniform1f(uAgentPigmentDep, PIGMENT_DEPOSIT);

    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, agentBufWrite);
    gl.bindVertexArray(agentVaoRead);

    // Soft brush: pre-multiplied alpha, add directly
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, activeAgents);
    gl.endTransformFeedback();
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);

    gl.disable(gl.BLEND);

    // Swap
    const tmpBuf = agentBufRead;
    agentBufRead = agentBufWrite;
    agentBufWrite = tmpBuf;
    const tmpVao = agentVaoRead;
    agentVaoRead = agentVaoWrite;
    agentVaoWrite = tmpVao;
  }

  function runFlow() {
    updateFlowFBO();
    gl.viewport(0, 0, GRID_W, GRID_H);
    gl.useProgram(flowProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, trailTexB);
    gl.uniform1i(uFlowTrail, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, pigmentRead);
    gl.uniform1i(uFlowPigment, 1);

    gl.uniform2f(uFlowGrid, GRID_W, GRID_H);
    gl.uniform1f(uFlowStrength, FLOW_STRENGTH);
    gl.uniform1f(uFlowDiffusion, FLOW_DIFFUSION);
    gl.uniform1f(uFlowTrailDecay, TRAIL_DECAY);
    gl.uniform1f(uFlowPigmentDecay, PIGMENT_DECAY);

    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Swap pigment textures for next frame
    const tmpTex = pigmentRead;
    pigmentRead = pigmentWrite;
    pigmentWrite = tmpTex;
    const tmpFbo = pigmentFboRead;
    pigmentFboRead = pigmentFboWrite;
    pigmentFboWrite = tmpFbo;
  }

  function runDisplay(time) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(displayProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, trailTexA);
    gl.uniform1i(uDispTrail, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, pigmentRead);
    gl.uniform1i(uDispPigment, 1);

    gl.uniform1f(uDispTime, time * 0.001);
    gl.uniform2f(uDispRes, canvas.width, canvas.height);
    gl.uniform1f(uDispSeed, seed);
    gl.uniform1i(uDispScreenIdx, screenIndex);
    gl.uniform1i(uDispTotScreens, totalScreens);
    gl.uniform3f(uDispPaper, 0.93, 0.90, 0.85);
    gl.uniform1f(uDispGrain, 0.045);
    gl.uniform1f(uDispBorder, showBezel);
    gl.uniform1f(uDispInkVis, inkVisibility);

    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ── Simulation Step ───────────────────────────────────────────────────────
  function step(dt, nowSec) {
    if (paused) return;
    simTime += dt;
    // Only the driver schedules strokes; replicas receive them as events.
    if (isPrimary || !hasDriver) {
      scheduleStrokes(simTime);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function uploadAgentDelta() {
    if (activeAgents <= prevActiveAgents && !needsFullUpload) return;
    const start = needsFullUpload ? 0 : prevActiveAgents;
    const offset = start * AGENT_STRIDE;
    const count = activeAgents - start;
    gl.bindBuffer(gl.ARRAY_BUFFER, agentBufRead);
    gl.bufferSubData(gl.ARRAY_BUFFER, offset, agentData, start * (AGENT_STRIDE / 4), count * (AGENT_STRIDE / 4));
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    prevActiveAgents = activeAgents;
    needsFullUpload = false;
  }

  // ── Animation Loop ────────────────────────────────────────────────────────
  // Driver screen runs the stroke schedule; all screens run the continuous
  // simulation in parallel and stay aligned via heartbeat simTime sync.
  let lastHeartbeatSimTime = -1;
  function frame(now) {
    const dt = lastTime ? Math.min((now - lastTime) * 0.001, 0.05) : 0.016;
    lastTime = now;

    if (!paused) {
      step(dt, simTime);
      uploadAgentDelta();
      runAgentUpdateAndDeposit(dt, simTime);
      runFlow();
    }
    runDisplay(now);

    // Primary broadcasts heartbeat a few times per second
    if (isPrimary) {
      const beat = Math.floor(simTime * 3);
      if (beat !== lastHeartbeatSimTime) {
        lastHeartbeatSimTime = beat;
        bc.postMessage({
          cmd: "heartbeat",
          simTime,
          palette: currentPalette,
          paused,
          showBezel,
        });
      }
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // ── BroadcastChannel ──────────────────────────────────────────────────────
  bc.addEventListener("message", ({ data }) => {
    if (data.quit) { window.close(); return; }
    if (data.cmd === "save") { saveCanvas(); return; }
    if (data.cmd === "bezel") {
      showBezel = data.showBezel;
      if (hudBezel) hudBezel.textContent = showBezel > 0.5 ? "ON" : "OFF";
      return;
    }
    if (data.cmd === "palette") {
      currentPalette = data.palette;
      if (hudPalette) hudPalette.textContent = PALETTES[currentPalette].name;
      return;
    }
    if (data.cmd === "pause") { paused = data.paused; return; }
    if (data.cmd === "clear") {
      gl.bindFramebuffer(gl.FRAMEBUFFER, pigmentFboRead);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, pigmentFboWrite);
      gl.clear(gl.COLOR_BUFFER_BIT);
      activeAgents = 0;
      prevActiveAgents = 0;
      return;
    }
    if (data.cmd === "seed") {
      reseed(data.seed);
      initAgents();
      gl.bindFramebuffer(gl.FRAMEBUFFER, pigmentFboRead);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, pigmentFboWrite);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    if (data.cmd === "hello") {
      if (!isPrimary && !seedLocked) {
        seedLocked = true;
        hasDriver = true;
        reseed(data.seed);
        if (data.palette !== undefined) currentPalette = data.palette;
        initAgents();
        gl.bindBuffer(gl.ARRAY_BUFFER, agentBufRead);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, agentData);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, pigmentFboRead);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, pigmentFboWrite);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      return;
    }
    if (data.cmd === "requestSync" && isPrimary) {
      bc.postMessage({ cmd: "hello", seed });
      bc.postMessage({
        cmd: "heartbeat",
        simTime,
        palette: currentPalette,
        paused,
        showBezel,
      });
      return;
    }
    if (data.cmd === "stroke" && !isPrimary) {
      spawnStroke(data.cx, data.cy, data.angle, data.palette, data.count, data.strokeSeed);
      if (hudAgents) hudAgents.textContent = activeAgents;
      return;
    }
    if (data.cmd === "heartbeat" && !isPrimary) {
      hasDriver = true;
      simTime = data.simTime;
      currentPalette = data.palette;
      paused = data.paused;
      showBezel = data.showBezel;
      if (hudPalette) hudPalette.textContent = PALETTES[currentPalette].name;
      if (hudBezel) hudBezel.textContent = showBezel > 0.5 ? "ON" : "OFF";
      return;
    }
  });

  // Secondaries request sync on startup; if no primary responds they fall back
  // to their own seed after a short timeout.
  if (!isPrimary) {
    bc.postMessage({ cmd: "requestSync" });
  }

  // ── Interaction ───────────────────────────────────────────────────────────
  function newSeed() {
    const newS = Math.floor(Math.random() * 1000000);
    reseed(newS);
    initAgents();
    gl.bindFramebuffer(gl.FRAMEBUFFER, pigmentFboRead);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pigmentFboWrite);
    gl.clear(gl.COLOR_BUFFER_BIT);
    bc.postMessage({ cmd: "seed", seed: newS });
  }

  function nextPalette() {
    currentPalette = (currentPalette + 1) % PALETTES.length;
    if (hudPalette) hudPalette.textContent = PALETTES[currentPalette].name;
    bc.postMessage({ cmd: "palette", palette: currentPalette });
  }

  function doClear() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, pigmentFboRead);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pigmentFboWrite);
    gl.clear(gl.COLOR_BUFFER_BIT);
    activeAgents = 0;
    prevActiveAgents = 0;
    bc.postMessage({ cmd: "clear" });
  }

  function togglePause() {
    paused = !paused;
    bc.postMessage({ cmd: "pause", paused });
  }

  function toggleBezel() {
    showBezel = showBezel > 0.5 ? 0.0 : 1.0;
    if (hudBezel) hudBezel.textContent = showBezel > 0.5 ? "ON" : "OFF";
    bc.postMessage({ cmd: "bezel", showBezel });
  }

  canvas.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    newSeed();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "q" || e.key === "Q") {
      bc.postMessage({ quit: true });
      window.close();
      return;
    }
    if (e.key === "s" || e.key === "S") {
      bc.postMessage({ cmd: "save" });
      saveCanvas();
      return;
    }
    if (e.code === "Space") { newSeed(); return; }
    if (e.key === "c" || e.key === "C") { nextPalette(); return; }
    if (e.key === "r" || e.key === "R") { doClear(); return; }
    if (e.key === "p" || e.key === "P") { togglePause(); return; }
    if (e.key === "b" || e.key === "B") { toggleBezel(); return; }
    if (e.key === "h" || e.key === "H") {
      if (hud) hud.classList.toggle("hidden");
      return;
    }
  });
}

init().catch(console.error);