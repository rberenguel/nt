// Generative Watercolor Study
// Physically-inspired hydrodynamic pigment simulation with slope displacement,
// capillary edge darkening ("coffee-ring" effect), paper granulation, and subtractive glazing.
// Ultra-wide dual-monitor 32:9 synchronization via BroadcastChannel.

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = params.has("screens") ? parseInt(params.get("screens"), 10) : 1;
const isPrimary = screenIndex === 0;

document.title = `Watercolor ${screenIndex}`;

const canvas = document.getElementById("watercolorCanvas");
const gl = canvas.getContext("webgl2", { alpha: false, depth: false, antialias: true });

if (!gl) {
  alert("WebGL 2 not supported on this browser.");
}

// ── Multi-screen BroadcastChannel ─────────────────────────────────────────────
const bc = new BroadcastChannel("watercolor");

function saveCanvas() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watercolor-screen${screenIndex}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

// ── Color Palettes (Artist Pigment Formulations in CMY Space) ──────────────────
// Subtractive primary pigment weights (Cyan, Magenta, Yellow) in [0.0, 1.0]
const PALETTES = [
  {
    name: "Botanical Bloom",
    paper: [0.975, 0.958, 0.920],
    pigments: [
      { name: "Sap Green", cmy: [0.85, 0.15, 0.90] },
      { name: "Rose Madder", cmy: [0.05, 0.88, 0.42] },
      { name: "Cobalt Violet", cmy: [0.65, 0.82, 0.05] },
      { name: "Aureolin Yellow", cmy: [0.02, 0.12, 0.95] },
      { name: "Phthalo Blue", cmy: [0.95, 0.50, 0.05] },
    ],
  },
  {
    name: "Nordic Dusk",
    paper: [0.965, 0.955, 0.935],
    pigments: [
      { name: "Ultramarine Blue", cmy: [0.92, 0.70, 0.02] },
      { name: "Burnt Sienna", cmy: [0.15, 0.78, 0.92] },
      { name: "Raw Umber", cmy: [0.45, 0.65, 0.85] },
      { name: "Payne's Grey", cmy: [0.85, 0.75, 0.65] },
      { name: "Cerulean Blue", cmy: [0.80, 0.25, 0.08] },
    ],
  },
  {
    name: "Desert Canyon",
    paper: [0.975, 0.945, 0.895],
    pigments: [
      { name: "Cadmium Orange", cmy: [0.02, 0.65, 0.95] },
      { name: "Terracotta", cmy: [0.22, 0.82, 0.88] },
      { name: "Turquoise Wash", cmy: [0.88, 0.08, 0.35] },
      { name: "Raw Sienna", cmy: [0.08, 0.45, 0.92] },
      { name: "Deep Indigo", cmy: [0.95, 0.85, 0.35] },
    ],
  },
  {
    name: "Mineral Glaze",
    paper: [0.980, 0.960, 0.930],
    pigments: [
      { name: "Quinacridone Gold", cmy: [0.05, 0.48, 0.95] },
      { name: "Viridian Deep", cmy: [0.92, 0.12, 0.75] },
      { name: "Mauve Shadow", cmy: [0.55, 0.78, 0.22] },
      { name: "Prussian Blue", cmy: [0.95, 0.68, 0.25] },
      { name: "Venetian Red", cmy: [0.18, 0.85, 0.82] },
    ],
  },
  {
    name: "Monochrome Sumi",
    paper: [0.965, 0.945, 0.910],
    pigments: [
      { name: "Ivory Black", cmy: [0.88, 0.88, 0.88] },
      { name: "Warm Sepia", cmy: [0.72, 0.82, 0.90] },
      { name: "Slate Wash", cmy: [0.65, 0.62, 0.60] },
      { name: "Lamp Black", cmy: [0.95, 0.95, 0.95] },
      { name: "Diluted Ink", cmy: [0.35, 0.35, 0.35] },
    ],
  },
  {
    name: "Prism & Opal", // Vivid, high-saturation watercolor glazes
    paper: [0.985, 0.975, 0.950],
    pigments: [
      { name: "Opera Rose", cmy: [0.02, 0.95, 0.25] },
      { name: "Cerulean Cyan", cmy: [0.95, 0.15, 0.05] },
      { name: "Lemon Glaze", cmy: [0.02, 0.05, 0.98] },
      { name: "Royal Amethyst", cmy: [0.75, 0.92, 0.05] },
      { name: "Vivid Emerald", cmy: [0.92, 0.05, 0.85] },
    ],
  },
  {
    name: "Autumn Equinox", // Deep rich seasonal tones
    paper: [0.970, 0.950, 0.915],
    pigments: [
      { name: "Crimson Lake", cmy: [0.10, 0.92, 0.75] },
      { name: "Deep Gold Ochre", cmy: [0.05, 0.55, 0.98] },
      { name: "Pine Viridian", cmy: [0.90, 0.25, 0.88] },
      { name: "Midnight Navy", cmy: [0.95, 0.80, 0.30] },
      { name: "Burnt Copper", cmy: [0.15, 0.82, 0.95] },
    ],
  },
];

let paletteIdx = Math.floor(Math.random() * PALETTES.length);
let simTime = 0.0;
let lastTimestamp = 0;
let paused = false;
let showBezel = 0.0;
let nextDropTime = 1.0;
let paperClearTime = 85.0; // Fresh study paper every 85 seconds

// ── WebGL Shader Helpers ──────────────────────────────────────────────────────
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

// Fullscreen Quad Geometry
const QUAD_VERTS = new Float32Array([
  -1, -1,
   1, -1,
  -1,  1,
  -1,  1,
   1, -1,
   1,  1,
]);

const quadVAO = gl.createVertexArray();
const quadVBO = gl.createBuffer();
gl.bindVertexArray(quadVAO);
gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTS, gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

// ── Vertex Shader (Universal) ─────────────────────────────────────────────────
const VS_COMMON = `#version 300 es
layout(location = 0) in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// ── 1. Simulation Solver Fragment Shader (Advection & Capillary Edge) ─────────
// R: Cyan pigment, G: Magenta pigment, B: Yellow pigment, A: Wetness (water)
const FS_SIMULATION = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_state;
uniform vec2 u_texelSize;
uniform float u_time;
uniform float u_dt;
uniform float u_evapRate;
uniform float u_advectSpeed;

// Fast Simplex Noise for paper slope & curl turbulence
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 uv, float t) {
  float v = 0.0;
  v += 0.5000 * snoise(uv * 3.0 + vec2(t * 0.04, -t * 0.03));
  v += 0.2500 * snoise(uv * 6.5 - vec2(t * 0.05,  t * 0.06));
  v += 0.1250 * snoise(uv * 14.0 + vec2(t * 0.08, t * 0.04));
  return v;
}

vec2 getSlope(vec2 uv, float t) {
  vec2 eps = vec2(0.003, 0.0);
  float c = fbm(uv, t);
  float r = fbm(uv + eps.xy, t);
  float u = fbm(uv + eps.yx, t);
  return vec2(r - c, u - c) / eps.x;
}

void main() {
  vec4 center = texture(u_state, v_uv);
  vec4 left   = texture(u_state, v_uv - vec2(u_texelSize.x, 0.0));
  vec4 right  = texture(u_state, v_uv + vec2(u_texelSize.x, 0.0));
  vec4 down   = texture(u_state, v_uv - vec2(0.0, u_texelSize.y));
  vec4 up     = texture(u_state, v_uv + vec2(0.0, u_texelSize.y));

  float wetness = center.a;

  // 1. Capillary Edge Detection (Contact line gradient)
  vec2 wetGrad = vec2(right.a - left.a, up.a - down.a) * 0.5;
  float edgeMag = length(wetGrad);

  // 2. Hydrodynamic Slope Displacement & Advection
  vec2 slope = getSlope(v_uv, u_time);
  // Curl vector orthogonal to slope for organic meandering fluid eddies
  vec2 curl = vec2(-slope.y, slope.x);

  vec2 flow = (slope * 0.35 + curl * 0.65) * u_advectSpeed * wetness;
  vec2 traceUv = v_uv - flow * u_dt;
  traceUv = clamp(traceUv, vec2(0.001), vec2(0.999));

  vec4 advected = texture(u_state, traceUv);

  // 3. Diffusion in wet zones (4-neighbor blend)
  vec4 avgNeighbor = (left + right + down + up) * 0.25;
  vec3 diffusedPigment = mix(advected.rgb, avgNeighbor.rgb, clamp(wetness * 0.18 * u_dt * 60.0, 0.0, 0.45));

  // 4. Capillary Edge Darkening ("Coffee-Ring" Effect)
  // Pigment is pushed and deposited along the perimeter where water gradient is high
  float coffeeRingBoost = smoothstep(0.03, 0.22, edgeMag) * 1.6;
  diffusedPigment += diffusedPigment * coffeeRingBoost * clamp(wetness, 0.0, 1.0) * u_dt * 8.0;

  // 5. Water Evaporation (Rate slowed at edges, faster in deep pools)
  float evap = u_evapRate * (1.0 + (1.0 - wetness) * 0.5) * u_dt;
  float newWetness = max(0.0, wetness - evap);

  // Bound pigment values
  diffusedPigment = clamp(diffusedPigment, vec3(0.0), vec3(1.0));

  fragColor = vec4(diffusedPigment, newWetness);
}
`;

// ── 2. Drop Injection Fragment Shader (Wet-on-Wet & Glazing) ───────────────────
const FS_DROP = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_state;
uniform vec2 u_dropCenter;
uniform float u_dropRadius;
uniform vec3 u_dropCMY;
uniform float u_dropWetness;
uniform float u_dropSeed;

void main() {
  vec4 old = texture(u_state, v_uv);

  // Aspect ratio correction (panoramic 2:1 ratio)
  vec2 dVec = (v_uv - u_dropCenter) * vec2(2.0, 1.0);
  float dist = length(dVec);

  // Organic irregular contact line boundary
  float angle = atan(dVec.y, dVec.x);
  float wobble = 1.0 + 0.20 * sin(angle * 4.0 + u_dropSeed)
                     + 0.14 * cos(angle * 7.0 - u_dropSeed * 2.5)
                     + 0.08 * sin(angle * 13.0 + u_dropSeed * 4.0);

  float effectiveRadius = u_dropRadius * wobble;
  float mask = smoothstep(effectiveRadius, effectiveRadius * 0.65, dist);

  if (mask <= 0.001) {
    fragColor = old;
    return;
  }

  // Subtractive glazing: new pigment multiplies over old pigment
  vec3 glazed = 1.0 - (1.0 - old.rgb) * (1.0 - u_dropCMY * mask * 0.85);

  // Re-wetting the paper where drop lands
  float newWet = max(old.a, mask * u_dropWetness);

  fragColor = vec4(glazed, newWet);
}
`;

// ── 3. Paper Texture & Compositing Fragment Shader ────────────────────────────
const FS_DISPLAY = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_state;
uniform int u_screen;
uniform int u_screens;
uniform vec3 u_paperColor;
uniform float u_showBezel;

// High-frequency cold-press paper grain noise
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float paperGrain(vec2 uv) {
  vec2 p = uv * 950.0;
  float n1 = hash21(floor(p));
  float n2 = hash21(floor(p * 2.0));
  float n3 = hash21(floor(p * 4.0));
  return (n1 * 0.55 + n2 * 0.30 + n3 * 0.15);
}

void main() {
  // Map display coordinates to panoramic simulation space [0.0, 1.0]
  float panoU = (v_uv.x + float(u_screen)) / float(u_screens);
  vec2 panoUv = vec2(panoU, v_uv.y);

  vec4 state = texture(u_state, panoUv);
  vec3 cmy = state.rgb;
  float wetness = state.a;

  // 1. Cold-press paper granulation (pigments settle in pits)
  float grain = paperGrain(panoUv);
  float totalPigment = dot(cmy, vec3(0.333));
  float granulation = (grain - 0.5) * totalPigment * 0.18;

  // 2. Subtractive paint reconstruction (CMY -> RGB)
  // Physical watercolor glazing subtracts light from the natural paper substrate
  vec3 baseColor = u_paperColor;
  vec3 rgbPigment = baseColor * (vec3(1.0) - cmy + granulation);

  // 3. Contact-line drying rim
  vec2 eps = vec2(0.0015, 0.0);
  float leftP   = dot(texture(u_state, panoUv - eps.xy).rgb, vec3(0.333));
  float rightP  = dot(texture(u_state, panoUv + eps.xy).rgb, vec3(0.333));
  float downP   = dot(texture(u_state, panoUv - eps.yx).rgb, vec3(0.333));
  float upP     = dot(texture(u_state, panoUv + eps.yx).rgb, vec3(0.333));
  float edgeRim = length(vec2(rightP - leftP, upP - downP)) * 0.5;

  rgbPigment -= vec3(edgeRim * 0.35);

  // 4. Subtle wet specular sheen (reflection on freshly deposited puddles)
  if (wetness > 0.08) {
    vec3 lightDir = normalize(vec3(-0.4, 0.6, 1.0));
    vec2 normal2D = vec2(rightP - leftP, upP - downP);
    vec3 normal = normalize(vec3(-normal2D * 3.5, 1.0));
    float spec = pow(max(0.0, dot(normal, lightDir)), 24.0);
    rgbPigment += vec3(spec * wetness * 0.22);
  }

  // Paper fiber texture across the whole sheet
  rgbPigment *= (0.97 + grain * 0.06);

  // Dual-screen bezel line guide
  if (u_showBezel > 0.5) {
    if (v_uv.x < 0.003 || v_uv.x > 0.997) {
      rgbPigment = mix(rgbPigment, vec3(1.0, 0.2, 0.0), 0.85);
    }
  }

  fragColor = vec4(clamp(rgbPigment, 0.0, 1.0), 1.0);
}
`;

// ── Compile Shader Programs ───────────────────────────────────────────────────
const progSim = createProgram(gl, VS_COMMON, FS_SIMULATION);
const progDrop = createProgram(gl, VS_COMMON, FS_DROP);
const progDisplay = createProgram(gl, VS_COMMON, FS_DISPLAY);

// Simulation Uniform Locations
const uSimState = gl.getUniformLocation(progSim, "u_state");
const uSimTexel = gl.getUniformLocation(progSim, "u_texelSize");
const uSimTime = gl.getUniformLocation(progSim, "u_time");
const uSimDt = gl.getUniformLocation(progSim, "u_dt");
const uSimEvap = gl.getUniformLocation(progSim, "u_evapRate");
const uSimAdvect = gl.getUniformLocation(progSim, "u_advectSpeed");

// Drop Uniform Locations
const uDropState = gl.getUniformLocation(progDrop, "u_state");
const uDropCenter = gl.getUniformLocation(progDrop, "u_dropCenter");
const uDropRadius = gl.getUniformLocation(progDrop, "u_dropRadius");
const uDropCMY = gl.getUniformLocation(progDrop, "u_dropCMY");
const uDropWet = gl.getUniformLocation(progDrop, "u_dropWetness");
const uDropSeed = gl.getUniformLocation(progDrop, "u_dropSeed");

// Display Uniform Locations
const uDispState = gl.getUniformLocation(progDisplay, "u_state");
const uDispScreen = gl.getUniformLocation(progDisplay, "u_screen");
const uDispScreens = gl.getUniformLocation(progDisplay, "u_screens");
const uDispPaper = gl.getUniformLocation(progDisplay, "u_paperColor");
const uDispBezel = gl.getUniformLocation(progDisplay, "u_showBezel");

// ── Panoramic Ping-Pong Simulation Framebuffers ───────────────────────────────
// Internal resolution for fluid solver (2048x1024 for 2:1 panoramic ratio)
const SIM_W = 2048;
const SIM_H = 1024;

let fboA, fboB;
let texA, texB;
let currentRead = 0; // 0 = A, 1 = B

function createFBOTexture(w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

  // Clear to dry white paper (0 pigment, 0 wetness)
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  return { fbo, tex };
}

const resA = createFBOTexture(SIM_W, SIM_H);
const resB = createFBOTexture(SIM_W, SIM_H);
fboA = resA.fbo; texA = resA.tex;
fboB = resB.fbo; texB = resB.tex;

function clearPaper() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

// ── Drop Ingestion ────────────────────────────────────────────────────────────
function applyDrop(cx, cy, radius, cmy, wetness, seed) {
  const readTex = currentRead === 0 ? texA : texB;
  const writeFbo = currentRead === 0 ? fboB : fboA;

  gl.bindFramebuffer(gl.FRAMEBUFFER, writeFbo);
  gl.viewport(0, 0, SIM_W, SIM_H);

  gl.useProgram(progDrop);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, readTex);
  gl.uniform1i(uDropState, 0);

  gl.uniform2f(uDropCenter, cx, cy);
  gl.uniform1f(uDropRadius, radius);
  gl.uniform3f(uDropCMY, cmy[0], cmy[1], cmy[2]);
  gl.uniform1f(uDropWet, wetness);
  gl.uniform1f(uDropSeed, seed);

  gl.bindVertexArray(quadVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  currentRead = 1 - currentRead;
}

// ── Automatic Natural Pigment Drop Generator ──────────────────────────────────
function spawnNaturalDrop() {
  const pal = PALETTES[paletteIdx];
  const p = pal.pigments[Math.floor(Math.random() * pal.pigments.length)];

  // Dual-screen distribution: drops can fall across both displays [0.05, 0.95]
  const cx = 0.08 + Math.random() * 0.84;
  const cy = 0.15 + Math.random() * 0.70;
  const radius = 0.06 + Math.random() * 0.09;
  const seed = Math.random() * 100.0;
  const wetness = 0.85 + Math.random() * 0.15;

  applyDrop(cx, cy, radius, p.cmy, wetness, seed);

  bc.postMessage({
    cmd: "drop",
    cx,
    cy,
    radius,
    cmy: p.cmy,
    wetness,
    seed,
  });

  // Occasionally spawn a nearby wet-on-wet companion petal
  if (Math.random() < 0.55) {
    setTimeout(() => {
      const p2 = pal.pigments[Math.floor(Math.random() * pal.pigments.length)];
      const offsetAng = Math.random() * Math.PI * 2;
      const offsetDist = radius * (0.6 + Math.random() * 0.5);
      const cx2 = Math.max(0.05, Math.min(0.95, cx + Math.cos(offsetAng) * offsetDist * 0.5));
      const cy2 = Math.max(0.1, Math.min(0.9, cy + Math.sin(offsetAng) * offsetDist));
      const r2 = radius * (0.75 + Math.random() * 0.4);
      const s2 = Math.random() * 100.0;
      applyDrop(cx2, cy2, r2, p2.cmy, 1.0, s2);
      bc.postMessage({
        cmd: "drop",
        cx: cx2,
        cy: cy2,
        radius: r2,
        cmy: p2.cmy,
        wetness: 1.0,
        seed: s2,
      });
    }, 450 + Math.random() * 600);
  }
}

// ── Resize ────────────────────────────────────────────────────────────────────
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// Initial composition on startup
clearPaper();
if (isPrimary) {
  // Pre-seed the paper with an initial cluster of organic watercolor blooms
  for (let i = 0; i < 4; i++) {
    setTimeout(() => spawnNaturalDrop(), i * 350);
  }
}

// ── Animation Loop ────────────────────────────────────────────────────────────
function loop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const dt = Math.min((timestamp - lastTimestamp) * 0.001, 0.033);
  lastTimestamp = timestamp;

  if (!paused) {
    simTime += dt;

    // Simulation Step (Ping-Pong FBO)
    const readTex = currentRead === 0 ? texA : texB;
    const writeFbo = currentRead === 0 ? fboB : fboA;

    gl.bindFramebuffer(gl.FRAMEBUFFER, writeFbo);
    gl.viewport(0, 0, SIM_W, SIM_H);

    gl.useProgram(progSim);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readTex);
    gl.uniform1i(uSimState, 0);

    gl.uniform2f(uSimTexel, 1.0 / SIM_W, 1.0 / SIM_H);
    gl.uniform1f(uSimTime, simTime);
    gl.uniform1f(uSimDt, dt);
    gl.uniform1f(uSimEvap, 0.028);       // Gentle evaporation
    gl.uniform1f(uSimAdvect, 0.0042);    // Viscous fluid slope displacement

    gl.bindVertexArray(quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    currentRead = 1 - currentRead;

    // Automatic drop generation on primary screen
    if (isPrimary) {
      if (simTime >= nextDropTime) {
        spawnNaturalDrop();
        nextDropTime = simTime + 1.2 + Math.random() * 1.6;
      }

      // Fresh study paper every 85s
      if (simTime >= paperClearTime) {
        paperClearTime = simTime + 85.0;
        paletteIdx = (paletteIdx + 1) % PALETTES.length;
        clearPaper();
        bc.postMessage({
          cmd: "clear",
          paletteIdx,
          simTime,
        });
        setTimeout(() => spawnNaturalDrop(), 300);
      }
    }
  }

  // Periodic heartbeat sync
  if (isPrimary && Math.floor(simTime * 3) !== Math.floor((simTime - dt) * 3)) {
    bc.postMessage({
      cmd: "heartbeat",
      simTime,
      paletteIdx,
      paused,
      showBezel,
    });
  }

  // ── Render to Screen ────────────────────────────────────────────────────────
  const finalTex = currentRead === 0 ? texA : texB;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.useProgram(progDisplay);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, finalTex);
  gl.uniform1i(uDispState, 0);

  const pal = PALETTES[paletteIdx];
  gl.uniform1i(uDispScreen, screenIndex);
  gl.uniform1i(uDispScreens, totalScreens);
  gl.uniform3f(uDispPaper, pal.paper[0], pal.paper[1], pal.paper[2]);
  gl.uniform1f(uDispBezel, showBezel);

  gl.bindVertexArray(quadVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// ── Multi-screen BroadcastChannel Communication ───────────────────────────────
bc.onmessage = (ev) => {
  const data = ev.data;
  if (!data) return;

  if (data.quit) {
    window.close();
    return;
  }
  if (data.cmd === "save") {
    saveCanvas();
    return;
  }
  if (data.cmd === "requestSync" && isPrimary) {
    bc.postMessage({
      cmd: "heartbeat",
      simTime,
      paletteIdx,
      paused,
      showBezel,
    });
    return;
  }
  if (data.cmd === "heartbeat" && !isPrimary) {
    paletteIdx = data.paletteIdx;
    paused = data.paused;
    showBezel = data.showBezel;
    return;
  }
  if (data.cmd === "drop") {
    applyDrop(data.cx, data.cy, data.radius, data.cmy, data.wetness, data.seed);
    return;
  }
  if (data.cmd === "clear") {
    paletteIdx = data.paletteIdx;
    clearPaper();
    return;
  }
  if (data.cmd === "palette") {
    paletteIdx = data.paletteIdx;
    return;
  }
  if (data.cmd === "pause") {
    paused = data.paused;
    return;
  }
  if (data.cmd === "bezel") {
    showBezel = data.showBezel;
    return;
  }
};

if (!isPrimary) {
  bc.postMessage({ cmd: "requestSync" });
}

// ── User Input & Keyboard Shortcuts ───────────────────────────────────────────
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
  if (e.code === "Space" || e.key === "n" || e.key === "N") {
    // Drop immediate blooming burst
    spawnNaturalDrop();
    return;
  }
  if (e.key === "r" || e.key === "R") {
    // Clear paper for new study
    clearPaper();
    paletteIdx = (paletteIdx + 1) % PALETTES.length;
    bc.postMessage({ cmd: "clear", paletteIdx, simTime });
    spawnNaturalDrop();
    return;
  }
  if (e.key === "c" || e.key === "C") {
    paletteIdx = (paletteIdx + 1) % PALETTES.length;
    bc.postMessage({ cmd: "palette", paletteIdx });
    return;
  }
  if (e.key === "p" || e.key === "P") {
    paused = !paused;
    bc.postMessage({ cmd: "pause", paused });
    return;
  }
  if (e.key === "b" || e.key === "B") {
    showBezel = showBezel > 0.5 ? 0.0 : 1.0;
    bc.postMessage({ cmd: "bezel", showBezel });
    return;
  }
});

// Interactive click / touch: drop paint exactly at clicked position
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const screenNormX = (e.clientX - rect.left) / rect.width;
  const screenNormY = 1.0 - (e.clientY - rect.top) / rect.height; // WebGL Y up

  // Convert to panoramic coordinates
  const panoX = (screenNormX + screenIndex) / totalScreens;
  const panoY = screenNormY;

  const pal = PALETTES[paletteIdx];
  const p = pal.pigments[Math.floor(Math.random() * pal.pigments.length)];
  const radius = 0.07 + Math.random() * 0.08;
  const seed = Math.random() * 100.0;

  applyDrop(panoX, panoY, radius, p.cmy, 1.0, seed);
  bc.postMessage({
    cmd: "drop",
    cx: panoX,
    cy: panoY,
    radius,
    cmy: p.cmy,
    wetness: 1.0,
    seed,
  });

  const el = document.documentElement;
  if (!document.fullscreenElement) {
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }
});
