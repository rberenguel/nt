// WebGL2 Game of Life screensaver — port of lif algorithmic sketch (RB 2023)
// GPU ping-pong: state FBOs (Conway step) + glow FBOs (per-cell fade), no libraries.

// ═══════════════ CONFIGURATION ═══════════════
const CELL_SIZE = 3;          // canvas pixels per cell
const INITIAL_DENSITY = 0.28; // fraction of cells alive at start
const MS_PER_STEP = 50;       // life update interval (~20 steps/sec)
const DECAY = 0.88;           // glow decay per step for dead cells (~1.5s to black at 20fps)
// ═════════════════════════════════════════════

// All palettes: vivid color on near-black (slightly hue-tinted black for warmth)
const PALETTES = [
  { alive: [1.000, 0.800, 0.000], dead: [0.020, 0.015, 0.000] }, // amber:  gold on warm black
  { alive: [0.000, 1.000, 0.250], dead: [0.000, 0.020, 0.005] }, // matrix: green on cold black
  { alive: [1.000, 0.350, 0.000], dead: [0.025, 0.010, 0.000] }, // ember:  orange on warm black
  { alive: [0.000, 0.898, 1.000], dead: [0.000, 0.015, 0.025] }, // cyber:  cyan on blue-black
  { alive: [1.000, 0.100, 0.430], dead: [0.025, 0.000, 0.015] }, // sakura: pink on dark black
];

// ─── Vertex (shared by all programs) ───
const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// ─── Conway step shader ───
const LIFE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_state;
uniform vec2 u_texel;
out vec4 o;
int alive(vec2 uv) { return texture(u_state, uv).r > 0.5 ? 1 : 0; }
void main() {
  float dx = u_texel.x, dy = u_texel.y;
  vec2 uv = v_uv;
  int n = alive(uv+vec2(-dx,-dy)) + alive(uv+vec2( 0.,-dy)) + alive(uv+vec2(dx,-dy))
         + alive(uv+vec2(-dx, 0.))                            + alive(uv+vec2(dx, 0.))
         + alive(uv+vec2(-dx, dy)) + alive(uv+vec2( 0., dy)) + alive(uv+vec2(dx, dy));
  int s = alive(uv);
  bool next = (s==1 && (n==2||n==3)) || (s==0 && n==3);
  o = vec4(next ? 1.0 : 0.0, 0.0, 0.0, 1.0);
}`;

// ─── Glow / fade shader ───
// Per-cell: alive → glow stays at 1 (or rises gradually in soft mode).
// Dead → glow decays by DECAY each step, creating a smooth fade to background.
const GLOW_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_state;
uniform sampler2D u_glow;
uniform float u_decay;
uniform bool u_soft; // if true, cells rise gradually too
out vec4 o;
void main() {
  float alive = texture(u_state, v_uv).r > 0.5 ? 1.0 : 0.0;
  float prev  = texture(u_glow,  v_uv).r;
  float g = alive > 0.5
    ? (u_soft ? min(1.0, prev + 0.35) : 1.0)
    : prev * u_decay;
  o = vec4(g, 0.0, 0.0, 1.0);
}`;

// ─── Render shader ───
// Direct NEAREST sample of glow → palette color. No spatial blur = pixel-sharp cells.
const RENDER_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_glow;
uniform vec3 u_alive;
uniform vec3 u_dead;
out vec4 o;
void main() {
  float g = texture(u_glow, v_uv).r;
  o = vec4(mix(u_dead, u_alive, g), 1.0);
}`;

// ─── DOM / GL setup ───
const canvas = document.getElementById("life");
const overlay = document.getElementById("brightness-overlay");
const gl = canvas.getContext("webgl2");
if (!gl) {
  document.body.innerHTML =
    '<div style="color:white;font-family:monospace;padding:2em;font-size:1.5em">WebGL2 required</div>';
  throw new Error("WebGL2 not supported");
}

let gridW, gridH;
let stateTexA, stateTexB, stateFboA, stateFboB;
let glowTexA,  glowTexB,  glowFboA,  glowFboB;
let lifeProg, glowProg, renderProg, vao;
let stateIdx = 0, glowIdx = 0;
const _screenIdx = parseInt(new URLSearchParams(window.location.search).get("screen") ?? "0");
let paletteIdx = 0, softMode = false, brightnessLevel = 0;
let lastStep = 0, animId;

// ─── GL helpers ───
function makeShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    console.error("Shader compile error:", gl.getShaderInfoLog(s));
  return s;
}

function makeProgram(vSrc, fSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, makeShader(gl.VERTEX_SHADER, vSrc));
  gl.attachShader(p, makeShader(gl.FRAGMENT_SHADER, fSrc));
  gl.bindAttribLocation(p, 0, "a_pos"); // pin to location 0 so all progs share one VAO
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    console.error("Program link error:", gl.getProgramInfoLog(p));
  return p;
}

function makeGridTex(data) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  // R8 = 1 byte/pixel; UNPACK_ALIGNMENT=1 prevents row-padding errors
  // when gridW is not divisible by 4.
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gridW, gridH, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  return t;
}

function makeFBO(tex) {
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fbo;
}

function ul(prog, name) { return gl.getUniformLocation(prog, name); }

// ─── Programs + quad (once only) ───
function setupPrograms() {
  lifeProg   = makeProgram(VERT, LIFE_FRAG);
  glowProg   = makeProgram(VERT, GLOW_FRAG);
  renderProg = makeProgram(VERT, RENDER_FRAG);

  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1,  1,-1,  -1,1,  1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
}

// ─── Textures + FBOs (recreated on resize / reset) ───
function setupBuffers() {
  gridW = Math.floor(canvas.width  / CELL_SIZE);
  gridH = Math.floor(canvas.height / CELL_SIZE);

  [stateTexA, stateTexB, glowTexA, glowTexB]
    .forEach(t => t && gl.deleteTexture(t));
  [stateFboA, stateFboB, glowFboA, glowFboB]
    .forEach(f => f && gl.deleteFramebuffer(f));

  const init = new Uint8Array(gridW * gridH);
  for (let i = 0; i < init.length; i++)
    init[i] = Math.random() < INITIAL_DENSITY ? 255 : 0;

  stateTexA = makeGridTex(init);
  stateTexB = makeGridTex(new Uint8Array(gridW * gridH));
  stateFboA = makeFBO(stateTexA);
  stateFboB = makeFBO(stateTexB);

  // Glow starts matching initial state (alive=255, dead=0)
  glowTexA = makeGridTex(init);
  glowTexB = makeGridTex(new Uint8Array(gridW * gridH));
  glowFboA = makeFBO(glowTexA);
  glowFboB = makeFBO(glowTexB);

  stateIdx = 0;
  glowIdx  = 0;
}

// ─── Frame ───
function drawQuad() {
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function stepLife(ts) {
  if (ts - lastStep < MS_PER_STEP) return false;
  lastStep = ts;

  // Conway step: state[stateIdx] → state[1-stateIdx]
  const readState  = stateIdx === 0 ? stateTexA : stateTexB;
  const writeState = stateIdx === 0 ? stateFboB : stateFboA;
  gl.bindFramebuffer(gl.FRAMEBUFFER, writeState);
  gl.viewport(0, 0, gridW, gridH);
  gl.useProgram(lifeProg);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, readState);
  gl.uniform1i(ul(lifeProg, "u_state"), 0);
  gl.uniform2f(ul(lifeProg, "u_texel"), 1.0/gridW, 1.0/gridH);
  drawQuad();
  stateIdx = 1 - stateIdx;

  // Glow step: decay/rise using new state + prev glow → next glow
  const newState = stateIdx === 0 ? stateTexA : stateTexB;
  const readGlow  = glowIdx  === 0 ? glowTexA  : glowTexB;
  const writeGlow = glowIdx  === 0 ? glowFboB  : glowFboA;
  gl.bindFramebuffer(gl.FRAMEBUFFER, writeGlow);
  gl.viewport(0, 0, gridW, gridH);
  gl.useProgram(glowProg);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, newState);
  gl.uniform1i(ul(glowProg, "u_state"), 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, readGlow);
  gl.uniform1i(ul(glowProg, "u_glow"), 1);
  gl.uniform1f(ul(glowProg, "u_decay"), DECAY);
  gl.uniform1i(ul(glowProg, "u_soft"), softMode ? 1 : 0);
  drawQuad();
  glowIdx = 1 - glowIdx;

  return true;
}

function renderFrame() {
  const glowTex = glowIdx === 0 ? glowTexA : glowTexB;
  const pal = PALETTES[paletteIdx];

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(renderProg);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, glowTex);
  gl.uniform1i(ul(renderProg, "u_glow"), 0);
  gl.uniform3fv(ul(renderProg, "u_alive"), pal.alive);
  gl.uniform3fv(ul(renderProg, "u_dead"), pal.dead);
  drawQuad();
}

function loop(ts) {
  animId = requestAnimationFrame(loop);
  stepLife(ts);
  renderFrame();
}

// ─── Controls ───
function adjustBrightness(delta) {
  brightnessLevel = Math.max(0, Math.min(10, brightnessLevel + delta));
  overlay.style.opacity = brightnessLevel * 0.1;
}

function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}

const lifeChannel = new BroadcastChannel("life-screensaver");
lifeChannel.onmessage = e => {
  const msg = e.data;
  if (msg === "close") { window.close(); }
  else if (msg?.cmd === "palette") { paletteIdx = msg.idx; }
  else if (msg?.cmd === "soft")    { softMode = msg.val; }
};

// Screen 0 picks and broadcasts immediately; all screens delay start so every
// window has received the palette before the first frame is drawn.
if (_screenIdx === 0) {
  paletteIdx = Math.floor(Math.random() * PALETTES.length);
  lifeChannel.postMessage({ cmd: "palette", idx: paletteIdx });
}

document.addEventListener("keydown", e => {
  if (e.key === "q" || e.key === "Q") {
    lifeChannel.postMessage("close");
    window.close();
  } else if (e.key === ",") {
    adjustBrightness(1);           // per-window: each screen may need different brightness
  } else if (e.key === ".") {
    adjustBrightness(-1);
  } else if (e.key === "f" || e.key === "F") {
    document.fullscreenElement ? document.exitFullscreen() : enterFullscreen();
  } else if (e.key === "r" || e.key === "R") {
    cancelAnimationFrame(animId);
    setupBuffers();
    lastStep = 0;
    animId = requestAnimationFrame(loop);
  } else if (e.key === "b" || e.key === "B") {
    softMode = !softMode;
    lifeChannel.postMessage({ cmd: "soft", val: softMode });
  } else if (e.key === "p" || e.key === "P") {
    paletteIdx = (paletteIdx + 1) % PALETTES.length;
    lifeChannel.postMessage({ cmd: "palette", idx: paletteIdx });
  } else if (!document.fullscreenElement) {
    enterFullscreen();
  }
});

document.addEventListener("click", () => {
  if (!document.fullscreenElement) enterFullscreen();
});

window.addEventListener("resize", () => {
  cancelAnimationFrame(animId);
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  setupBuffers();
  lastStep = 0;
  animId = requestAnimationFrame(loop);
});

// ─── Start ───
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;
setupPrograms();
setupBuffers();
setTimeout(() => { animId = requestAnimationFrame(loop); }, 300);
