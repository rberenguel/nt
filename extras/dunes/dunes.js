// Procedural Shifting Sand Dunes
// Aeolian geomorphology, asymmetric barchan ridges, windward micro-ripples,
// low-angle crepuscular lighting, subsurface rim scattering, and quartz sand glints.
// Ultra-wide dual-monitor 32:9 synchronization via BroadcastChannel.

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = params.has("screens") ? parseInt(params.get("screens"), 10) : 1;
const isPrimary = screenIndex === 0;

document.title = `Dunes ${screenIndex}`;

const canvas = document.getElementById("duneCanvas");
const gl = canvas.getContext("webgl2", { alpha: false, depth: false, antialias: false });

if (!gl) {
  alert("WebGL 2 not supported on this browser.");
}

// ── Multi-screen BroadcastChannel ─────────────────────────────────────────────
const bc = new BroadcastChannel("dunes");

function saveCanvas() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dunes-screen${screenIndex}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

// ── Desert Atmospheres & Lighting Palettes ────────────────────────────────────
const PALETTES = [
  {
    name: "Golden Hour Sahara",
    sunDir: [0.65, 0.22, 0.72],
    sunColor: [1.0, 0.78, 0.45],
    skyZenith: [0.18, 0.32, 0.65],
    skyHorizon: [0.98, 0.62, 0.35],
    sandSunlit: [0.96, 0.68, 0.38],
    sandShadow: [0.22, 0.16, 0.30],
    sssColor: [1.0, 0.38, 0.12],
    fogColor: [0.92, 0.58, 0.36],
  },
  {
    name: "Twilight Crimson",
    sunDir: [0.72, 0.08, 0.68],
    sunColor: [1.0, 0.45, 0.20],
    skyZenith: [0.12, 0.14, 0.38],
    skyHorizon: [0.85, 0.28, 0.32],
    sandSunlit: [0.92, 0.48, 0.32],
    sandShadow: [0.15, 0.12, 0.24],
    sssColor: [1.0, 0.25, 0.15],
    fogColor: [0.75, 0.30, 0.35],
  },
  {
    name: "High Noon Erg",
    sunDir: [0.45, 0.78, 0.42],
    sunColor: [1.0, 0.96, 0.85],
    skyZenith: [0.22, 0.52, 0.92],
    skyHorizon: [0.82, 0.88, 0.96],
    sandSunlit: [0.98, 0.82, 0.54],
    sandShadow: [0.42, 0.44, 0.52],
    sssColor: [0.98, 0.68, 0.25],
    fogColor: [0.85, 0.82, 0.78],
  },
  {
    name: "Nocturnal Moonlit",
    sunDir: [-0.55, 0.42, 0.72],
    sunColor: [0.65, 0.78, 0.98],
    skyZenith: [0.02, 0.04, 0.09],
    skyHorizon: [0.08, 0.12, 0.22],
    sandSunlit: [0.42, 0.52, 0.68],
    sandShadow: [0.04, 0.05, 0.09],
    sssColor: [0.25, 0.45, 0.75],
    fogColor: [0.06, 0.08, 0.15],
  },
  {
    name: "Mars Red Planet",
    sunDir: [0.58, 0.32, 0.75],
    sunColor: [0.95, 0.62, 0.45],
    skyZenith: [0.62, 0.32, 0.22],
    skyHorizon: [0.88, 0.52, 0.35],
    sandSunlit: [0.85, 0.38, 0.22],
    sandShadow: [0.25, 0.12, 0.10],
    sssColor: [0.95, 0.22, 0.10],
    fogColor: [0.72, 0.38, 0.26],
  },
];

let paletteIdx = Math.floor(Math.random() * PALETTES.length);
let simTime = Math.random() * 500.0;
let lastTimestamp = 0;
let paused = false;
let showBezel = 0.0;
let windSpeed = 1.0;

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

// ── Vertex Shader ─────────────────────────────────────────────────────────────
const VS_SOURCE = `#version 300 es
layout(location = 0) in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// ── Fragment Shader (Aeolian Dunes Raymarcher) ────────────────────────────────
const FS_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform int u_screen;
uniform int u_screens;
uniform float u_showBezel;

// Lighting & Color Uniforms
uniform vec3 u_sunDir;
uniform vec3 u_sunColor;
uniform vec3 u_skyZenith;
uniform vec3 u_skyHorizon;
uniform vec3 u_sandSunlit;
uniform vec3 u_sandShadow;
uniform vec3 u_sssColor;
uniform vec3 u_fogColor;

// ── Procedural Simplex / Hash Functions ───────────────────────────────────────
vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Asymmetric Barchan Dune Profile Function
// Sharp slip face (20% wavelength), gentle windward stoss slope (80% wavelength)
float barchanWave(float phase) {
  float p = fract(phase);
  if (p < 0.80) {
    // Gentle windward slope rising slowly
    return pow(p / 0.80, 1.35);
  } else {
    // Steep slip face collapsing at angle of repose
    float drop = (p - 0.80) / 0.20;
    return 1.0 - pow(drop, 0.85);
  }
}

// Multi-Scale Aeolian Dune Elevation Field h(x, z, t)
float duneElevation(vec2 p, float t) {
  float h = 0.0;

  // Prevailing desert wind along slightly rotated axis
  vec2 windDir = normalize(vec2(0.85, 0.52));
  vec2 perpWind = vec2(-windDir.y, windDir.x);

  // 1. Primary macro-dune ridges (wavelength ~ 14.0m)
  float w1 = dot(p, windDir) * 0.075 - t * 0.007;
  float s1 = dot(p, perpWind) * 0.045;
  float curv1 = sin(s1 * 1.5 + w1 * 0.5) * 0.35;
  h += barchanWave(w1 + curv1) * 2.20;

  // 2. Secondary transverse dunes (wavelength ~ 7.0m, offset angle)
  vec2 wind2 = normalize(vec2(0.72, 0.69));
  float w2 = dot(p, wind2) * 0.14 - t * 0.012;
  float s2 = dot(p, vec2(-wind2.y, wind2.x)) * 0.09;
  h += barchanWave(w2 + sin(s2 * 1.8) * 0.25) * 1.10;

  // 3. Tertiary dune undulations (wavelength ~ 3.5m)
  vec2 wind3 = normalize(vec2(0.92, 0.38));
  float w3 = dot(p, wind3) * 0.28 - t * 0.020;
  h += barchanWave(w3) * 0.45;

  // 4. Fine windward micro-ripples (aligned perpendicular to wind)
  float ripplePhase = dot(p, windDir) * 3.8 - t * 0.05;
  float rippleWobble = sin(dot(p, perpWind) * 2.5) * 0.4;
  float ripple = sin(ripplePhase + rippleWobble);
  // Ripples are prominent on the gradual slopes, reduced on steep drops
  h += ripple * 0.028;

  return h;
}

// Normal Evaluation via Analytical Finite Differences
vec3 duneNormal(vec2 p, float t, float h) {
  vec2 eps = vec2(0.015, 0.0);
  float hr = duneElevation(p + eps.xy, t);
  float hl = duneElevation(p - eps.xy, t);
  float hu = duneElevation(p + eps.yx, t);
  float hd = duneElevation(p - eps.yx, t);
  return normalize(vec3(hl - hr, 2.0 * eps.x, hd - hu));
}

// Soft Shadow Raymarching
float duneShadow(vec3 ro, vec3 rd, float tSim, float k) {
  float res = 1.0;
  float t = 0.08;
  for (int i = 0; i < 32; i++) {
    vec3 p = ro + rd * t;
    float h = duneElevation(p.xz, tSim);
    float diff = p.y - h;
    if (diff < 0.002) return 0.0;
    res = min(res, k * diff / t);
    t += max(0.04, diff * 0.65);
    if (t > 24.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

void main() {
  // Ultra-Wide Panoramic 32:9 Camera Coordinate Setup
  // Map current screen to global panoramic UV: [0.0, 1.0] across both displays
  float panoU = (v_uv.x + float(u_screen)) / float(u_screens);
  float panoAspect = (u_resolution.x * float(u_screens)) / u_resolution.y;

  vec2 ndc = vec2((panoU - 0.5) * 2.0 * (panoAspect * 0.5), (v_uv.y - 0.5) * 2.0);

  // Camera Position & View Frame
  // Camera elevated on a scenic ridge overlooking sweeping dune valleys
  float camTime = u_time * 0.015;
  vec3 ro = vec3(sin(camTime) * 1.5, 3.4, -9.0 + cos(camTime * 0.8) * 0.8);
  vec3 target = vec3(sin(camTime * 0.7) * 0.8, 1.2, 5.0);

  vec3 ww = normalize(target - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);

  // Camera ray direction (horizontal FOV ~ 110 degrees for grand cinematic panorama)
  vec3 rd = normalize(ndc.x * uu + ndc.y * vv + 1.25 * ww);

  // Sun Vector
  vec3 sunDir = normalize(u_sunDir);

  // Sky Gradient Background
  float sunDot = max(0.0, dot(rd, sunDir));
  float sunDisc = smoothstep(0.9985, 0.9995, sunDot);
  float sunCorona = pow(sunDot, 6.0) * 0.65 + pow(sunDot, 32.0) * 0.45;

  float skyGradient = clamp((rd.y + 0.05) / 0.85, 0.0, 1.0);
  vec3 sky = mix(u_skyHorizon, u_skyZenith, pow(skyGradient, 0.65));
  sky += u_sunColor * (sunCorona + sunDisc * 3.5);

  // Raymarching Heightfield
  float t = 0.5;
  float tMax = 65.0;
  bool hit = false;
  vec3 p = ro;
  float h = 0.0;

  for (int i = 0; i < 95; i++) {
    p = ro + rd * t;
    h = duneElevation(p.xz, u_time);
    float diff = p.y - h;

    if (diff < 0.004) {
      // Binary search refinement for razor-sharp dune crests
      float tA = t - max(0.03, t * 0.01);
      float tB = t;
      for (int b = 0; b < 5; b++) {
        float tMid = (tA + tB) * 0.5;
        vec3 pMid = ro + rd * tMid;
        float hMid = duneElevation(pMid.xz, u_time);
        if (pMid.y < hMid) {
          tB = tMid;
        } else {
          tA = tMid;
        }
      }
      t = (tA + tB) * 0.5;
      p = ro + rd * t;
      h = duneElevation(p.xz, u_time);
      hit = true;
      break;
    }

    t += max(0.025, diff * 0.65 + t * 0.006);
    if (t > tMax) break;
  }

  vec3 col = sky;

  if (hit) {
    vec3 N = duneNormal(p.xz, u_time, h);

    // Direct Sun Lighting & Geometric Shadow Penumbra
    float NdotL = max(0.0, dot(N, sunDir));
    float shadow = NdotL > 0.001 ? duneShadow(p + N * 0.03, sunDir, u_time, 12.0) : 0.0;

    // Ambient Sky Light & Ground Valley Bounce
    float ambient = clamp(0.5 + 0.5 * N.y, 0.0, 1.0);
    vec3 ambLight = mix(u_sandShadow, u_skyHorizon * 0.75, ambient);

    // Direct Diffuse Light
    vec3 diffLight = u_sandSunlit * u_sunColor * (NdotL * shadow);

    // Subsurface Scattering & Razor Crest Glow
    // When viewing backlit sand ridges, light scatters through thin crest sand
    float sssFactor = pow(clamp(dot(-rd, sunDir), 0.0, 1.0), 3.5) * (1.0 - NdotL * 0.65);
    vec3 sss = u_sssColor * sssFactor * (0.35 + 0.65 * shadow);

    // Quartz Sand Specular Glints (Microscopic Crystalline Sparkles)
    vec3 H = normalize(sunDir - rd);
    float spec = pow(max(0.0, dot(N, H)), 90.0);
    float sparkleNoise = hash21(floor(p.xz * 140.0));
    float glint = spec * step(0.72, sparkleNoise) * shadow * 1.8;

    // Combined Surface Lighting
    col = ambLight + diffLight + sss + vec3(glint) * u_sunColor;

    // Atmospheric Distance Fog & Dust Haze
    float fogFactor = clamp((t - 4.0) / (tMax - 4.0), 0.0, 1.0);
    fogFactor = pow(fogFactor, 1.4);
    col = mix(col, u_fogColor, fogFactor);
  }

  // Dual-screen bezel line guide (if enabled)
  if (u_showBezel > 0.5) {
    if (v_uv.x < 0.003 || v_uv.x > 0.997) {
      col = mix(col, vec3(1.0, 0.25, 0.0), 0.85);
    }
  }

  // Filmic Color Grading / ACES Tone Mapping
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

// ── Compile Program & Uniform Locations ───────────────────────────────────────
const prog = createProgram(gl, VS_SOURCE, FS_SOURCE);

const uRes = gl.getUniformLocation(prog, "u_resolution");
const uTime = gl.getUniformLocation(prog, "u_time");
const uScreen = gl.getUniformLocation(prog, "u_screen");
const uScreens = gl.getUniformLocation(prog, "u_screens");
const uBezel = gl.getUniformLocation(prog, "u_showBezel");

const uSunDir = gl.getUniformLocation(prog, "u_sunDir");
const uSunColor = gl.getUniformLocation(prog, "u_sunColor");
const uSkyZenith = gl.getUniformLocation(prog, "u_skyZenith");
const uSkyHorizon = gl.getUniformLocation(prog, "u_skyHorizon");
const uSandSunlit = gl.getUniformLocation(prog, "u_sandSunlit");
const uSandShadow = gl.getUniformLocation(prog, "u_sandShadow");
const uSSSColor = gl.getUniformLocation(prog, "u_sssColor");
const uFogColor = gl.getUniformLocation(prog, "u_fogColor");

// ── Resize ────────────────────────────────────────────────────────────────────
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener("resize", resize);
resize();

// ── Broadcast Initial Sync on Startup ─────────────────────────────────────────
if (isPrimary) {
  bc.postMessage({
    cmd: "heartbeat",
    simTime,
    paletteIdx,
    paused,
    showBezel,
    windSpeed,
  });
} else {
  bc.postMessage({ cmd: "requestSync" });
}

// ── Render Loop ───────────────────────────────────────────────────────────────
function loop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const dt = Math.min((timestamp - lastTimestamp) * 0.001, 0.05);
  lastTimestamp = timestamp;

  if (!paused) {
    simTime += dt * windSpeed;
  }

  // Periodic heartbeat sync
  if (isPrimary && Math.floor(simTime * 3) !== Math.floor((simTime - dt * windSpeed) * 3)) {
    bc.postMessage({
      cmd: "heartbeat",
      simTime,
      paletteIdx,
      paused,
      showBezel,
      windSpeed,
    });
  }

  // Auto-cycle palettes every 90 seconds
  if (isPrimary && Math.floor(simTime / 90.0) !== Math.floor((simTime - dt * windSpeed) / 90.0)) {
    paletteIdx = (paletteIdx + 1) % PALETTES.length;
    bc.postMessage({
      cmd: "palette",
      paletteIdx,
    });
  }

  gl.useProgram(prog);

  gl.uniform2f(uRes, canvas.width, canvas.height);
  gl.uniform1f(uTime, simTime);
  gl.uniform1i(uScreen, screenIndex);
  gl.uniform1i(uScreens, totalScreens);
  gl.uniform1f(uBezel, showBezel);

  const pal = PALETTES[paletteIdx];
  gl.uniform3fv(uSunDir, pal.sunDir);
  gl.uniform3fv(uSunColor, pal.sunColor);
  gl.uniform3fv(uSkyZenith, pal.skyZenith);
  gl.uniform3fv(uSkyHorizon, pal.skyHorizon);
  gl.uniform3fv(uSandSunlit, pal.sandSunlit);
  gl.uniform3fv(uSandShadow, pal.sandShadow);
  gl.uniform3fv(uSSSColor, pal.sssColor);
  gl.uniform3fv(uFogColor, pal.fogColor);

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
      windSpeed,
    });
    return;
  }
  if (data.cmd === "heartbeat" && !isPrimary) {
    simTime = data.simTime;
    paletteIdx = data.paletteIdx;
    paused = data.paused;
    showBezel = data.showBezel;
    windSpeed = data.windSpeed;
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
  if (data.cmd === "wind") {
    windSpeed = data.windSpeed;
    return;
  }
  if (data.cmd === "bezel") {
    showBezel = data.showBezel;
    return;
  }
};

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
    let next;
    do {
      next = Math.floor(Math.random() * PALETTES.length);
    } while (next === paletteIdx && PALETTES.length > 1);
    paletteIdx = next;
    bc.postMessage({ cmd: "palette", paletteIdx });
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
  if (e.key === "w" || e.key === "W") {
    windSpeed = windSpeed > 1.5 ? 1.0 : 3.5;
    bc.postMessage({ cmd: "wind", windSpeed });
    return;
  }
  if (e.key === "b" || e.key === "B") {
    showBezel = showBezel > 0.5 ? 0.0 : 1.0;
    bc.postMessage({ cmd: "bezel", showBezel });
    return;
  }
});

// Click to pick a random atmospheric palette or enter fullscreen
canvas.addEventListener("click", () => {
  let next;
  do {
    next = Math.floor(Math.random() * PALETTES.length);
  } while (next === paletteIdx && PALETTES.length > 1);
  paletteIdx = next;
  bc.postMessage({ cmd: "palette", paletteIdx });

  const el = document.documentElement;
  if (!document.fullscreenElement) {
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }
});
