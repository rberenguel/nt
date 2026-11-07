// Forward Ray-Splatting Caustics — WebGL point-splatting edition.
// Each output pixel is the accumulated density of refracted rays.

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = params.has("screens")
  ? parseInt(params.get("screens"), 10)
  : 1;
const isPrimary = screenIndex === 0;

document.title = `Caustics ${screenIndex}`;

const canvas = document.getElementById("caustics");
const overlay = document.getElementById("brightness-overlay");
const bc = new BroadcastChannel("caustics");

// ── Palettes ─────────────────────────────────────────────────────────────────
const PALETTES = [
  { name: "Deep Neon", bg: "#03040a", gainBias: [1.0, 0.85, 0.7] },
  { name: "Amber Pool", bg: "#0a0502", gainBias: [1.0, 0.72, 0.42] },
  { name: "Arctic Glass", bg: "#02070a", gainBias: [0.55, 0.85, 1.0] },
  { name: "Rose Gold", bg: "#0a0205", gainBias: [1.0, 0.65, 0.75] },
];

let seed = Math.floor(Math.random() * 10000000);
let paletteIdx = Math.floor(Math.random() * PALETTES.length);
let simTime = 0;
let paused = false;
let showBezel = false;
let brightnessLevel = 0;
let lastTimestamp = 0;
let needParams = true;

// ── Utilities ────────────────────────────────────────────────────────────────
function mulberry32(s) {
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function detuneCycles(c, totalScreens) {
  // Push frequencies away from integer cycles and integer cycles-per-screen,
  // which cause the same caustic squiggle to repeat on each monitor.
  for (let k = 1; k <= 12; k++) {
    if (Math.abs(c - k) < 0.08) c += 0.13;
  }
  if (totalScreens > 1) {
    for (let k = 1; k <= totalScreens * 4; k++) {
      const target = k / totalScreens;
      if (Math.abs(c - target) < 0.08) c += 0.13;
    }
  }
  return c;
}

function hexToRgb01(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => x / 255);
}

function saveCanvas() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caustics-screen${screenIndex}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function adjustBrightness(delta) {
  brightnessLevel = Math.max(0, Math.min(10, brightnessLevel + delta));
  overlay.style.opacity = brightnessLevel * 0.1;
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

// ── WebGL Renderer ───────────────────────────────────────────────────────────
const ACC_VS = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform int u_totalScreens;
uniform int u_screenIndex;
uniform float u_seed;
uniform float u_time;
uniform int u_gridStep;
uniform float u_pointSize;
uniform float u_scale;
uniform float u_maxAspect;

uniform vec4 u_waves[12];      // x=fx, y=fy, z=freq, w=amp
uniform vec2 u_phaseSpeed[12]; // x=phase, y=speed
uniform int u_waveCount;
uniform vec3 u_gains;

in float a_index;
flat out vec3 v_color;
flat out float v_aspect;
flat out float v_angle;
flat out float v_density;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  int idx = int(a_index) / 3;
  int ch = int(a_index) - idx * 3;

  float virtualW = u_resolution.x * float(u_totalScreens);
  float virtualH = u_resolution.y;
  float gstep = float(u_gridStep);

  int gridW = int(ceil(virtualW / gstep));
  int gridH = int(ceil(virtualH / gstep));

  if (idx >= gridW * gridH) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    v_color = vec3(0.0);
    return;
  }

  int cx = idx - (idx / gridW) * gridW;
  int cy = idx / gridW;
  vec2 cell = vec2(float(cx), float(cy));

  vec2 jitter = vec2(hash21(cell + u_seed + 0.5), hash21(cell + u_seed + 1.5));
  vec2 source = (cell + jitter) * gstep;
  vec2 n = source / vec2(virtualW, virtualH);

  // Slow global rotation keeps the caustic field evolving without abrupt jumps.
  float rot = u_time * 0.025;
  float cr = cos(rot), sr = sin(rot);
  n = vec2(n.x * cr - n.y * sr, n.x * sr + n.y * cr);

  // Low-frequency warp breaks rigid tiling/repetition across multi-screen setups.
  vec2 warp = vec2(
    0.04 * sin(n.x * 6.28318530718 * 0.27 + n.y * 6.28318530718 * 0.19 + u_time * 0.02),
    0.04 * cos(n.x * 6.28318530718 * 0.21 - n.y * 6.28318530718 * 0.31 + u_time * 0.015)
  );
  vec2 nw = n + warp;

  vec2 slope = vec2(0.0);
  for (int i = 0; i < 12; i++) {
    if (i >= u_waveCount) break;
    vec4 w = u_waves[i];
    vec2 ps = u_phaseSpeed[i];
    float arg = w.z * (w.x * nw.x + w.y * nw.y) * 6.28318530718 + ps.x + u_time * ps.y;
    float d = w.w * w.z * 6.28318530718 * cos(arg);
    slope += vec2(w.x, w.y) * d;
  }

  float gain = (ch == 0) ? u_gains.x : (ch == 1) ? u_gains.y : u_gains.z;
  // Breathing gain: makes the RGB fringes shift in and out over time.
  gain *= 1.0 + 0.08 * sin(u_time * 0.2 + float(ch));
  vec2 landing = source + slope * (gain * u_scale);

  float sliceLeft = u_resolution.x * float(u_screenIndex);
  float sliceRight = sliceLeft + u_resolution.x;

  if (landing.x < sliceLeft || landing.x >= sliceRight || landing.y < 0.0 || landing.y >= u_resolution.y) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    v_color = vec3(0.0);
    return;
  }

  // Smooth spatial noise field that drives the per-ray ellipse shape.
  float shapePhase =
    sin((n.x * 1.7 + n.y * 2.3) * 6.28318530718 + u_time * 0.12) * 0.5 +
    cos((n.x * 2.9 - n.y * 1.4) * 6.28318530718 + u_time * 0.05) * 0.5;
  float cycle = sin(u_time * 0.35 + shapePhase * 3.0);
  float t = abs(cycle);
  float aspect = 1.0 + (1.0 - t) * (u_maxAspect - 1.0);

  // Density mask: breaks the otherwise uniform field into brighter/dimmer regions.
  float densityNoise = 0.5 + 0.5 * (
    sin((n.x * 1.3 + n.y * 2.1) * 6.28318530718 + u_time * 0.07) *
    cos((n.x * 2.7 - n.y * 1.9) * 6.28318530718)
  );
  float density = 0.25 + 0.75 * densityNoise;

  float clipX = (landing.x - sliceLeft) / u_resolution.x * 2.0 - 1.0;
  float clipY = 1.0 - landing.y / u_resolution.y * 2.0;
  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
  gl_PointSize = u_pointSize * aspect;

  v_color = vec3(0.0);
  v_color[ch] = 1.0;
  v_aspect = aspect;
  v_angle = shapePhase * 2.5;
  v_density = density;
}
`;

const ACC_FS = `#version 300 es
precision highp float;
flat in vec3 v_color;
flat in float v_aspect;
flat in float v_angle;
flat in float v_density;
out vec4 fragColor;

vec2 rotate(vec2 p, float a) {
  float s = sin(a), c = cos(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

void main() {
  vec2 c = gl_PointCoord - 0.5;
  c = rotate(c, -v_angle);
  c.x *= v_aspect;
  if (length(c) > 0.5) discard;
  // Normalise by splat area; apply spatial density mask.
  fragColor = vec4(v_color * v_density / v_aspect, 1.0);
}
`;

const PRES_VS = `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  vec2 p = vec2(float(gl_VertexID % 2), float(gl_VertexID / 2)) * 2.0 - 1.0;
  gl_Position = vec4(p, 0.0, 1.0);
  v_uv = p * 0.5 + 0.5;
}
`;

const PRES_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_acc;
uniform vec3 u_bg;
uniform float u_exposure;
uniform vec2 u_pixel;
void main() {
  vec3 acc = texture(u_acc, v_uv).rgb;
  // Subtle neighbour sampling adds a soft glow around bright caustic filaments.
  acc += texture(u_acc, v_uv + vec2( u_pixel.x, 0.0)).rgb * 0.08;
  acc += texture(u_acc, v_uv + vec2(-u_pixel.x, 0.0)).rgb * 0.08;
  acc += texture(u_acc, v_uv + vec2(0.0,  u_pixel.y)).rgb * 0.08;
  acc += texture(u_acc, v_uv + vec2(0.0, -u_pixel.y)).rgb * 0.08;
  // Steeper tone curve: crush midtones so bright filaments pop against dark gaps.
  vec3 tone = pow(1.0 - exp(-acc * u_exposure), vec3(1.7));
  fragColor = vec4(u_bg + (vec3(1.0) - u_bg) * tone, 1.0);
}
`;

let gl = null;
let accProgram, presProgram;
let accFbo, accTex;
let indexBuffer, indexCount;
let uResolution, uTotalScreens, uScreenIndex, uSeed, uTime, uGridStep, uPointSize, uScale, uMaxAspect;
let uWaves, uPhaseSpeed, uWaveCount, uGains;
let aIndexLoc = -1;
let uAcc, uBg, uExposure, uPixel;
let wavesFlat = new Float32Array(12 * 4);
let phaseSpeedFlat = new Float32Array(12 * 2);
let pointSize = 1.5;
let gridStep = 2;
let exposure = 1.0;

function compileShader(type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function createProgram(vsSrc, fsSrc) {
  const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

function initWebGL() {
  gl = canvas.getContext("webgl2", { alpha: false, premultipliedAlpha: false });
  if (!gl) gl = canvas.getContext("webgl", { alpha: false, premultipliedAlpha: false });
  if (!gl) return false;

  const isWebGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
  const extColor = isWebGL2
    ? gl.getExtension("EXT_color_buffer_float")
    : gl.getExtension("WEBGL_color_buffer_float");
  const extFloat = isWebGL2 ? true : gl.getExtension("OES_texture_float");
  const extBlend = gl.getExtension("EXT_float_blend");
  if (!extFloat || !extColor || !extBlend) {
    console.warn("WebGL float render target/blending not available, falling back to CPU.");
    gl = null;
    return false;
  }

  accProgram = createProgram(ACC_VS, ACC_FS);
  presProgram = createProgram(PRES_VS, PRES_FS);
  if (!accProgram || !presProgram) return false;

  uResolution = gl.getUniformLocation(accProgram, "u_resolution");
  uTotalScreens = gl.getUniformLocation(accProgram, "u_totalScreens");
  uScreenIndex = gl.getUniformLocation(accProgram, "u_screenIndex");
  uSeed = gl.getUniformLocation(accProgram, "u_seed");
  uTime = gl.getUniformLocation(accProgram, "u_time");
  uGridStep = gl.getUniformLocation(accProgram, "u_gridStep");
  uPointSize = gl.getUniformLocation(accProgram, "u_pointSize");
  uScale = gl.getUniformLocation(accProgram, "u_scale");
  uMaxAspect = gl.getUniformLocation(accProgram, "u_maxAspect");
  uWaves = gl.getUniformLocation(accProgram, "u_waves");
  uPhaseSpeed = gl.getUniformLocation(accProgram, "u_phaseSpeed");
  uWaveCount = gl.getUniformLocation(accProgram, "u_waveCount");
  uGains = gl.getUniformLocation(accProgram, "u_gains");
  aIndexLoc = gl.getAttribLocation(accProgram, "a_index");
  indexBuffer = gl.createBuffer();

  uAcc = gl.getUniformLocation(presProgram, "u_acc");
  uBg = gl.getUniformLocation(presProgram, "u_bg");
  uExposure = gl.getUniformLocation(presProgram, "u_exposure");
  uPixel = gl.getUniformLocation(presProgram, "u_pixel");

  accTex = gl.createTexture();
  accFbo = gl.createFramebuffer();

  gl.disable(gl.DEPTH_TEST);
  return true;
}

function resizeWebGL() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pixelCount = canvas.width * canvas.height;
  const targetCells = 400000;
  gridStep = Math.max(1, Math.round(Math.sqrt(pixelCount / targetCells)));
  pointSize = Math.max(1.2, Math.min(2.0, gridStep * 0.7));

  const virtualW = canvas.width * totalScreens;
  const virtualH = canvas.height;
  const cellsX = Math.ceil(virtualW / gridStep);
  const cellsY = Math.ceil(virtualH / gridStep);
  const cells = cellsX * cellsY;
  indexCount = cells * 3;

  const indices = new Float32Array(indexCount);
  for (let i = 0; i < indexCount; i++) indices[i] = i;
  gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.bindTexture(gl.TEXTURE_2D, accTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, canvas.width, canvas.height, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindFramebuffer(gl.FRAMEBUFFER, accFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, accTex, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    console.warn("Framebuffer incomplete", status);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  needParams = true;
}

function uploadParams() {
  const rng = mulberry32(seed);
  const pal = PALETTES[paletteIdx];
  const waveCount = 4 + Math.floor(rng() * 2); // 4–5 mixed-frequency waves
  const lowCount = 2;

  for (let i = 0; i < 12; i++) {
    if (i < waveCount) {
      const angle = rng() * Math.PI * 2;
      const isHighFreq = i >= lowCount;
      let freq = isHighFreq ? 3.0 + rng() * 5.0 : 0.25 + rng() * 1.3;
      freq = detuneCycles(freq, totalScreens);
      const amp = isHighFreq ? 0.04 + rng() * 0.10 : 0.5 + rng() * 1.0;
      wavesFlat[i * 4 + 0] = Math.cos(angle);
      wavesFlat[i * 4 + 1] = Math.sin(angle);
      wavesFlat[i * 4 + 2] = freq;
      wavesFlat[i * 4 + 3] = amp;
      phaseSpeedFlat[i * 2 + 0] = rng() * Math.PI * 2;
      phaseSpeedFlat[i * 2 + 1] = (rng() - 0.5) * (isHighFreq ? 0.14 : 0.24);
    } else {
      wavesFlat[i * 4 + 0] = 0;
      wavesFlat[i * 4 + 1] = 0;
      wavesFlat[i * 4 + 2] = 0;
      wavesFlat[i * 4 + 3] = 0;
      phaseSpeedFlat[i * 2 + 0] = 0;
      phaseSpeedFlat[i * 2 + 1] = 0;
    }
  }

  const baseGain = 0.015 + rng() * 0.025;
  const gains = [
    baseGain * (0.8 + rng() * 0.4) * pal.gainBias[0],
    baseGain * (0.8 + rng() * 0.4) * pal.gainBias[1],
    baseGain * (0.8 + rng() * 0.4) * pal.gainBias[2],
  ];

  const virtualW = canvas.width * totalScreens;
  const virtualH = canvas.height;
  const scale = Math.min(virtualW, virtualH);
  const maxAspect = 2.0 + rng() * 0.8; // 2.0–2.8, less fill-rate spiking

  const cellsX = Math.ceil(virtualW / gridStep);
  const cellsY = Math.ceil(virtualH / gridStep);
  const raysPerChannel = cellsX * cellsY;
  const pixelCount = canvas.width * canvas.height;
  const density = raysPerChannel / pixelCount;
  exposure = (0.18 / density) * (0.8 + rng() * 0.4);

  gl.useProgram(accProgram);
  gl.uniform2f(uResolution, canvas.width, canvas.height);
  gl.uniform1i(uTotalScreens, totalScreens);
  gl.uniform1i(uScreenIndex, screenIndex);
  gl.uniform1f(uSeed, seed);
  gl.uniform1i(uGridStep, gridStep);
  gl.uniform1f(uPointSize, pointSize);
  gl.uniform1f(uScale, scale);
  gl.uniform1f(uMaxAspect, maxAspect);
  gl.uniform4fv(uWaves, wavesFlat);
  gl.uniform2fv(uPhaseSpeed, phaseSpeedFlat);
  gl.uniform1i(uWaveCount, waveCount);
  gl.uniform3fv(uGains, gains);

  gl.useProgram(presProgram);
  gl.uniform3fv(uBg, hexToRgb01(pal.bg));
  gl.uniform1f(uExposure, exposure);
}

function drawWebGL() {
  // Accumulate
  gl.bindFramebuffer(gl.FRAMEBUFFER, accFbo);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);

  gl.useProgram(accProgram);
  gl.uniform1f(uTime, simTime);
  gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
  gl.enableVertexAttribArray(aIndexLoc);
  gl.vertexAttribPointer(aIndexLoc, 1, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.POINTS, 0, indexCount);
  gl.disableVertexAttribArray(aIndexLoc);

  // Present
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.BLEND);

  gl.useProgram(presProgram);
  gl.uniform2f(uPixel, 1.0 / canvas.width, 1.0 / canvas.height);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, accTex);
  gl.uniform1i(uAcc, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// ── CPU Fallback (kept for compatibility) ────────────────────────────────────
const CPU_DOWNSAMPLE = 2;
const CPU_GRID_STEP = 4;
const cpuOffscreen = document.createElement("canvas");
const cpuCtx = cpuOffscreen.getContext("2d", { alpha: false });

function generateCPU() {
  const W = Math.ceil(canvas.width / CPU_DOWNSAMPLE);
  const H = Math.ceil(canvas.height / CPU_DOWNSAMPLE);
  const totalW = W * totalScreens;
  const totalH = H;

  cpuOffscreen.width = totalW;
  cpuOffscreen.height = totalH;

  const rng = mulberry32(seed);
  const pal = PALETTES[paletteIdx];
  const bg = hexToRgb01(pal.bg).map((x) => x * 255);

  const waveCount = 4 + Math.floor(rng() * 2);
  const lowCount = 2;
  const waves = [];
  for (let i = 0; i < waveCount; i++) {
    const angle = rng() * Math.PI * 2;
    let isHighFreq = i >= lowCount;
    let freq = isHighFreq ? 3.0 + rng() * 5.0 : 0.25 + rng() * 1.3;
    freq = detuneCycles(freq, totalScreens);
    waves.push({
      fx: Math.cos(angle),
      fy: Math.sin(angle),
      freq,
      amp: isHighFreq ? 0.04 + rng() * 0.10 : 0.5 + rng() * 1.0,
      phase: rng() * Math.PI * 2,
      speed: (rng() - 0.5) * (isHighFreq ? 0.07 : 0.16),
    });
  }

  const baseGain = 0.015 + rng() * 0.025;
  const gains = [
    baseGain * (0.8 + rng() * 0.4) * pal.gainBias[0],
    baseGain * (0.8 + rng() * 0.4) * pal.gainBias[1],
    baseGain * (0.8 + rng() * 0.4) * pal.gainBias[2],
  ];

  const scale = Math.min(totalW, totalH);
  const acc = new Float32Array(totalW * totalH * 4);
  let maxR = 0;
  let maxG = 0;
  let maxB = 0;

  const step = CPU_GRID_STEP;
  const invW = 1 / totalW;
  const invH = 1 / totalH;

  for (let y = 0; y < totalH; y += step) {
    for (let x = 0; x < totalW; x += step) {
      const jx = x + rng() * step;
      const jy = y + rng() * step;
      const nx = jx * invW;
      const ny = jy * invH;

      let sx = 0;
      let sy = 0;
      for (let i = 0; i < waves.length; i++) {
        const w = waves[i];
        const arg = w.freq * (w.fx * nx + w.fy * ny) * Math.PI * 2 + w.phase + simTime * w.speed;
        const c = Math.cos(arg);
        const d = w.amp * w.freq * Math.PI * 2;
        sx += d * w.fx * c;
        sy += d * w.fy * c;
      }

      for (let ch = 0; ch < 3; ch++) {
        const g = gains[ch] * scale;
        const lx = jx + sx * g;
        const ly = jy + sy * g;
        if (lx < 0 || ly < 0 || lx >= totalW - 1 || ly >= totalH - 1) continue;

        const x0 = lx | 0;
        const y0 = ly | 0;
        const fx = lx - x0;
        const fy = ly - y0;
        const row = y0 * totalW;
        const i00 = (row + x0) * 4 + ch;
        const i10 = i00 + 4;
        const i01 = (row + totalW + x0) * 4 + ch;
        const i11 = i01 + 4;

        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;

        let v;
        v = acc[i00] += w00;
        if (v > maxR && ch === 0) maxR = v;
        if (v > maxG && ch === 1) maxG = v;
        if (v > maxB && ch === 2) maxB = v;
        v = acc[i10] += w10;
        if (v > maxR && ch === 0) maxR = v;
        if (v > maxG && ch === 1) maxG = v;
        if (v > maxB && ch === 2) maxB = v;
        v = acc[i01] += w01;
        if (v > maxR && ch === 0) maxR = v;
        if (v > maxG && ch === 1) maxG = v;
        if (v > maxB && ch === 2) maxB = v;
        v = acc[i11] += w11;
        if (v > maxR && ch === 0) maxR = v;
        if (v > maxG && ch === 1) maxG = v;
        if (v > maxB && ch === 2) maxB = v;
      }
    }
  }

  const imgData = cpuCtx.createImageData(totalW, totalH);
  const data = imgData.data;
  const halfR = maxR * 0.42 + 0.001;
  const halfG = maxG * 0.42 + 0.001;
  const halfB = maxB * 0.42 + 0.001;

  for (let i = 0; i < acc.length; i += 4) {
    const tr = acc[i] / (acc[i] + halfR);
    const tg = acc[i + 1] / (acc[i + 1] + halfG);
    const tb = acc[i + 2] / (acc[i + 2] + halfB);
    data[i] = bg[0] + (255 - bg[0]) * tr;
    data[i + 1] = bg[1] + (255 - bg[1]) * tg;
    data[i + 2] = bg[2] + (255 - bg[2]) * tb;
    data[i + 3] = 255;
  }

  cpuCtx.putImageData(imgData, 0, 0);
}

function drawCPU() {
  const pal = PALETTES[paletteIdx];
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sliceW = cpuOffscreen.width / totalScreens;
  const sx = screenIndex * sliceW;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    cpuOffscreen,
    sx,
    0,
    sliceW,
    cpuOffscreen.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  ctx.restore();

  if (showBezel) {
    ctx.strokeStyle = "#ff4411";
    ctx.lineWidth = 2;
    for (let s = 1; s < totalScreens; s++) {
      const bx = (s - screenIndex) * canvas.width;
      if (bx > 0 && bx < canvas.width) {
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx, canvas.height);
        ctx.stroke();
      }
    }
  }
}

// ── Setup ────────────────────────────────────────────────────────────────────
const useWebGL = initWebGL();

function resize() {
  if (useWebGL) resizeWebGL();
  else {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}
window.addEventListener("resize", resize);
resize();

function loop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const dt = Math.min((timestamp - lastTimestamp) * 0.001, 0.05);
  lastTimestamp = timestamp;

  if (!paused) simTime += dt;

  if (useWebGL) {
    if (needParams) {
      uploadParams();
      needParams = false;
    }
    drawWebGL();
  } else {
    generateCPU();
    drawCPU();
  }

  if (isPrimary && Math.floor(simTime * 4) !== Math.floor((simTime - dt) * 4)) {
    bc.postMessage({
      cmd: "heartbeat",
      seed,
      paletteIdx,
      simTime,
      paused,
      showBezel,
    });
  }

  requestAnimationFrame(loop);
}

// ── BroadcastChannel ─────────────────────────────────────────────────────────
if (isPrimary) {
  bc.postMessage({
    cmd: "heartbeat",
    seed,
    paletteIdx,
    simTime,
    paused,
    showBezel,
  });
} else {
  bc.postMessage({ cmd: "requestSync" });
}

bc.onmessage = (ev) => {
  const d = ev.data;
  if (!d) return;

  if (d.quit) {
    window.close();
    return;
  }
  if (d.cmd === "save") {
    saveCanvas();
    return;
  }
  if (d.cmd === "requestSync" && isPrimary) {
    bc.postMessage({
      cmd: "heartbeat",
      seed,
      paletteIdx,
      simTime,
      paused,
      showBezel,
    });
    return;
  }
  if (d.cmd === "heartbeat" && !isPrimary) {
    if (seed !== d.seed || paletteIdx !== d.paletteIdx) needParams = true;
    seed = d.seed;
    paletteIdx = d.paletteIdx;
    simTime = d.simTime;
    paused = d.paused;
    showBezel = d.showBezel;
    return;
  }
  if (d.cmd === "next") {
    seed = d.seed ?? Math.floor(Math.random() * 10000000);
    paletteIdx = d.paletteIdx ?? paletteIdx;
    needParams = true;
    return;
  }
  if (d.cmd === "palette") {
    paletteIdx = d.paletteIdx;
    needParams = true;
    return;
  }
  if (d.cmd === "pause") {
    paused = d.paused;
    return;
  }
  if (d.cmd === "bezel") {
    showBezel = d.showBezel;
    return;
  }
};

// ── Controls ─────────────────────────────────────────────────────────────────
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
    seed = Math.floor(Math.random() * 10000000);
    paletteIdx = (paletteIdx + 1) % PALETTES.length;
    needParams = true;
    bc.postMessage({ cmd: "next", seed, paletteIdx });
    return;
  }
  if (e.key === "p" || e.key === "P") {
    paused = !paused;
    bc.postMessage({ cmd: "pause", paused });
    return;
  }
  if (e.key === "c" || e.key === "C") {
    paletteIdx = (paletteIdx + 1) % PALETTES.length;
    needParams = true;
    bc.postMessage({ cmd: "palette", paletteIdx });
    return;
  }
  if (e.key === "b" || e.key === "B") {
    showBezel = !showBezel;
    bc.postMessage({ cmd: "bezel", showBezel });
    return;
  }
  if (e.key === "f" || e.key === "F") {
    toggleFullscreen();
    return;
  }
  if (e.key === ",") {
    adjustBrightness(1);
    return;
  }
  if (e.key === ".") {
    adjustBrightness(-1);
    return;
  }
});

canvas.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    toggleFullscreen();
  } else {
    seed = Math.floor(Math.random() * 10000000);
    needParams = true;
    bc.postMessage({ cmd: "next", seed, paletteIdx });
  }
});

requestAnimationFrame(loop);
