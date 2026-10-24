// Procedural Stippled Terrain Screensaver - Multi-Screen WebGL2 Implementation
// Features: Dual-screen BroadcastChannel coordination, Oren-Nayar lighting,
// volumetric fog, streaming Poisson disk stippling, and instanced capsule SDF rendering.

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = params.has("screens") ? parseInt(params.get("screens"), 10) : 1;
const isPrimary = screenIndex === 0;

document.title = `Terrain ${screenIndex}`;

const canvas = document.getElementById("terrainCanvas");
const gl = canvas.getContext("webgl2", {
  alpha: false,
  depth: false,
  antialias: false,
  preserveDrawingBuffer: true,
});

if (!gl) {
  alert("WebGL 2 is required for Terrain screensaver.");
}

// ── Multi-screen BroadcastChannel ─────────────────────────────────────────────
const bc = new BroadcastChannel("terrain");

// Time-based randomized seed on each launch without URL modification
function generateSeed() {
  const t = Date.now();
  const rand1 = Math.floor(Math.random() * 0x100000000);
  const rand2 = Math.floor(Math.random() * 0x100000000);
  const rand3 = Math.floor(Math.random() * 0x100000000);
  return (
    "0x" +
    t.toString(16).padStart(16, "0") +
    rand1.toString(16).padStart(16, "0") +
    rand2.toString(16).padStart(16, "0") +
    rand3.toString(16).padStart(16, "0")
  );
}

let terrainSeed = generateSeed();
let paletteIdx = Math.floor(Math.random() * TERRAIN_PALETTES.length);
let motionEnabled = true;
let paused = false;
let showBezel = 0.0;

// Progressive Drawing & Linger State
let currentAlpha = 1.0;
let phase = "drawing"; // "drawing" (stream as sampled) -> "linger" (live wind wisps) -> "fade"
let phaseTimer = 0.0;
let animTime = 0.0;

// Geometry Buffers & Generator
let landscapeGenerator = null;
let landscapeData = {
  count: 0,
  maxCapacity: 0,
};
let glResources = null;

// ── WebGL2 Shader Programs ────────────────────────────────────────────────────
const vsCapsuleSource = `#version 300 es
layout(location = 0) in vec2 a_corner; // [-1, -1] to [1, 1]
layout(location = 1) in vec2 a_centre; // Panoramic world (x, y)
layout(location = 2) in vec3 a_shape;  // length, width, angle
layout(location = 3) in float a_threshold; // Drawing appearance order

uniform float u_screenIndex;
uniform float u_screenWidth;
uniform float u_screenHeight;
uniform float u_progress;
uniform float u_time;
uniform float u_motion;

out vec2 v_local;
out vec3 v_dims; // halfLength, radius, pixelSize
out float v_visible;

void main() {
  // Block-by-block animated drawing on reveal
  if (a_threshold > u_progress) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_visible = 0.0;
    return;
  }

  // If culled by dither, throw off-screen
  if (a_shape.y <= 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_visible = 0.0;
    return;
  }
  v_visible = 1.0;

  // Wind direction unit vector from flow angle
  vec2 windDir = vec2(cos(a_shape.z), sin(a_shape.z));
  vec2 perpDir = vec2(-windDir.y, windDir.x);

  // Traveling atmospheric wind wisps advecting along flow direction
  float along = dot(a_centre, windDir) * 0.003 - u_time * 0.45;
  float across = dot(a_centre, perpDir) * 0.006;

  // High-frequency turbulent wisp streamers
  float wispNoise = sin(along * 3.1415 + sin(across * 2.0)) * cos(across * 3.0);
  float wispStream = smoothstep(0.2, 0.8, 0.5 + 0.5 * wispNoise);

  // Stipple mark sizing and organic modulation
  float widthMod = 1.0;
  vec2 drift = vec2(0.0);

  if (u_motion > 0.5) {
    widthMod = clamp(0.75 + 0.5 * wispStream + 0.15 * sin(u_time * 1.5 + along), 0.5, 1.5);
    drift = windDir * (wispStream * 3.0);
  }

  float halfLength = a_shape.x * 0.5;
  float radius = a_shape.y * 0.5 * widthMod;
  float pixelSize = 0.75; // Subpixel antialiasing edge

  vec2 extent = vec2(halfLength + radius + pixelSize, radius + pixelSize);
  v_local = a_corner * extent;

  // Rotation matrix
  float cosA = cos(a_shape.z);
  float sinA = sin(a_shape.z);
  vec2 axis = vec2(cosA, sinA);
  vec2 norm = vec2(-sinA, cosA);

  vec2 worldPos = a_centre + drift + axis * v_local.x + norm * v_local.y;

  // Horizontal Panoramic Slicing across displays
  float localX = worldPos.x - u_screenIndex * u_screenWidth;
  float clipX = (localX / u_screenWidth) * 2.0 - 1.0;
  float clipY = 1.0 - (worldPos.y / u_screenHeight) * 2.0;

  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
  v_dims = vec3(halfLength, radius, pixelSize);
}
`;

const fsCapsuleSource = `#version 300 es
precision highp float;

in vec2 v_local;
in vec3 v_dims;
in float v_visible;

uniform vec3 u_inkColor;
uniform float u_alpha;
uniform float u_showBezel;
uniform float u_screenIndex;
uniform float u_totalScreens;

out vec4 outColor;

void main() {
  if (v_visible <= 0.0) discard;

  // Signed distance to line segment
  vec2 p = vec2(max(abs(v_local.x) - v_dims.x, 0.0), v_local.y);
  float d = length(p) - v_dims.y;

  // Smooth subpixel antialiasing edge coverage
  float coverage = clamp(0.5 - d / v_dims.z, 0.0, 1.0);
  if (coverage <= 0.0) discard;

  outColor = vec4(u_inkColor, 1.0) * coverage * u_alpha;
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Shader compile error: " + info);
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error("Program link error: " + info);
  }
  return prog;
}

// ── Bezel Overlay Shader ──────────────────────────────────────────────────────
const vsBezelSource = `#version 300 es
layout(location = 0) in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fsBezelSource = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 outColor;
void main() {
  outColor = u_color;
}
`;

// ── Aquatint Rosin Aging Noise Shader (Matching Map & Constellation) ──────────
const vsGrainSource = `#version 300 es
layout(location = 0) in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fsGrainSource = `#version 300 es
precision highp float;
uniform sampler2D u_noiseTex;
uniform float u_grainAmount;
uniform float u_alpha;
out vec4 outColor;

void main() {
  // Dual-frequency tiling coordinates matching Map & Constellation
  vec2 coord1 = gl_FragCoord.xy / 256.0;
  vec2 coord2 = (gl_FragCoord.yx * 0.5 + vec2(0.37, 0.71)) / 256.0;

  vec4 nSample1 = texture(u_noiseTex, coord1);
  vec4 nSample2 = texture(u_noiseTex, coord2);

  float n1 = (nSample1.r - 0.5) * u_grainAmount;
  float n2 = (nSample2.g - 0.5) * (u_grainAmount * 0.45);
  float n = (n1 + n2) * u_alpha;

  // Real-time aging tooth over paper and ink
  if (n >= 0.0) {
    outColor = vec4(vec3(1.0), n * 2.2);
  } else {
    outColor = vec4(vec3(0.0), -n * 2.2);
  }
}
`;

function createNoiseTexture(gl) {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4 + 0] = Math.floor(Math.random() * 256);
    data[i * 4 + 1] = Math.floor(Math.random() * 256);
    data[i * 4 + 2] = Math.floor(Math.random() * 256);
    data[i * 4 + 3] = 255;
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  return tex;
}

// ── Streaming Terrain Generation Pipeline ─────────────────────────────────────
function ensureGPUBufferCapacity(neededCapacity) {
  if (landscapeData.maxCapacity >= neededCapacity) return;
  const newCapacity = Math.max(neededCapacity, 100000);

  gl.bindBuffer(gl.ARRAY_BUFFER, glResources.centreVBO);
  gl.bufferData(gl.ARRAY_BUFFER, newCapacity * 2 * 4, gl.DYNAMIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, glResources.shapeVBO);
  gl.bufferData(gl.ARRAY_BUFFER, newCapacity * 3 * 4, gl.DYNAMIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, glResources.threshVBO);
  gl.bufferData(gl.ARRAY_BUFFER, newCapacity * 1 * 4, gl.DYNAMIC_DRAW);

  landscapeData.maxCapacity = newCapacity;
}

function startLandscapeGeneration(totalW, totalH, seed) {
  const rng = createRandom(seed);
  const noiseFunc = createSimplexNoise(rng);
  const toneNoise = createSimplexNoise(rng.fork());

  // Terrain Parameters
  const terrainParams = {
    top: rng.range(20.0, 25.0),
    offset: [rng.range(0.0, 1000.0), rng.range(0.0, 1000.0)],
    bands: rng.pick([8, 16, 32]),
    angle: rng.range(-Math.PI, Math.PI),
    wind: rng.pick([0.6, 1.0, 1.6]),
  };

  const sunElevation = rng.range(0.5, 0.8);
  const sunAzimuthRatio = rng.range(0.3, 0.7);
  const viewPitch = (30.0 * Math.PI) / 180.0; // Dimetric / isometric view

  const heightfield = createHeightfield(terrainParams, noiseFunc);
  const camera = createCamera(viewPitch, sunElevation, sunAzimuthRatio, heightfield, totalW, totalH);
  const windGrid = createWindGrid(terrainParams, heightfield, camera);
  const atmosphere = createAtmosphere(terrainParams, heightfield, camera, windGrid, noiseFunc);

  const mmScale = totalH / 420.0;
  const spacing = Math.max(1.7, 0.481 * mmScale * 0.95);
  const dotDiameter = 0.765 * mmScale * 1.35;

  const poissonGen = createPoissonGenerator(totalW, totalH, spacing, rng);

  // Pre-allocate GPU buffers with generous capacity
  const estCapacity = Math.ceil((totalW * totalH) / (spacing * spacing * 0.45)) + 50000;
  ensureGPUBufferCapacity(estCapacity);

  landscapeData.count = 0;
  landscapeGenerator = {
    poissonGen,
    terrainParams,
    camera,
    atmosphere,
    toneNoise,
    noiseFunc,
    dotDiameter,
    rng,
    totalH,
    isDone: false,
  };
}

function stepLandscapeGeneration() {
  if (!landscapeGenerator || landscapeGenerator.isDone) return;

  const gen = landscapeGenerator;
  const minThickness = 0.19 / 0.765;
  const t0 = performance.now();
  let pointsProcessed = 0;

  // Process batches while keeping under 8ms frame budget or at least 1500 points
  while (!gen.isDone && (performance.now() - t0 < 8.0 || pointsProcessed < 1500)) {
    const batch = gen.poissonGen.step(1500);
    if (batch.count === 0 && batch.done) {
      gen.isDone = true;
      phase = "linger";
      phaseTimer = 0.0;
      break;
    }

    let count = batch.count;
    const currentOffset = landscapeData.count;

    // Safety clamp if exceeding allocated capacity
    if (currentOffset + count > landscapeData.maxCapacity) {
      count = landscapeData.maxCapacity - currentOffset;
      if (count <= 0) {
        gen.isDone = true;
        phase = "linger";
        phaseTimer = 0.0;
        break;
      }
    }

    const chunkCentres = new Float32Array(count * 2);
    const chunkShapes = new Float32Array(count * 3);
    const chunkThresholds = new Float32Array(count); // All 0.0 so immediately visible

    for (let i = 0; i < count; i++) {
      const px = batch.chunkX[i];
      const py = batch.chunkY[i];

      const h = gen.camera.hit(px, py);
      const fog = gen.atmosphere.fogThrough(h, 0.0);

      const bandNoise = fbmRotated(gen.toneNoise, h.distance / gen.terrainParams.bands, gen.terrainParams.offset[1], 6);
      const tone = bandNoise * fog.clear + fog.tone;

      const dither = hashDither(px, py, gen.rng.value() * 0x7fffffff);
      const shouldDraw = dither < tone / minThickness;

      chunkCentres[i * 2 + 0] = px;
      chunkCentres[i * 2 + 1] = py;

      const slopeNoise = gen.noiseFunc(h.x / 10.0 - gen.terrainParams.offset[0], h.z / 10.0 - gen.terrainParams.offset[1]);
      const strokeAngle = gen.terrainParams.angle + (slopeNoise - 0.5) * 0.7;

      const patchNoise = gen.noiseFunc(h.x * 0.06 + 149.0, h.z * 0.06 + 311.0);
      const slopeSteepness = 1.0 - Math.abs(h.normal[1]);
      const isLineBlotch = patchNoise > 0.52 || slopeSteepness > 0.65;

      let sLength = 0.0;
      let sWidth = 0.0;

      if (shouldDraw) {
        if (isLineBlotch) {
          sLength = gen.dotDiameter * (1.6 + 1.2 * slopeSteepness);
          sWidth = gen.dotDiameter * Math.max(minThickness, tone) * 0.88;
        } else {
          sLength = 0.0;
          sWidth = gen.dotDiameter * Math.max(minThickness, tone) * 1.25;
        }
      }

      chunkShapes[i * 3 + 0] = sLength;
      chunkShapes[i * 3 + 1] = sWidth;
      chunkShapes[i * 3 + 2] = strokeAngle;
      chunkThresholds[i] = 0.0;
    }

    // Sub-upload this batch to GPU
    gl.bindBuffer(gl.ARRAY_BUFFER, glResources.centreVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, currentOffset * 2 * 4, chunkCentres);

    gl.bindBuffer(gl.ARRAY_BUFFER, glResources.shapeVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, currentOffset * 3 * 4, chunkShapes);

    gl.bindBuffer(gl.ARRAY_BUFFER, glResources.threshVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, currentOffset * 1 * 4, chunkThresholds);

    landscapeData.count += count;
    pointsProcessed += count;

    if (batch.done) {
      gen.isDone = true;
      phase = "linger";
      phaseTimer = 0.0;
      break;
    }
  }
}

// ── WebGL Resource Management ─────────────────────────────────────────────────
function setupGLResources() {
  const progCapsule = createProgram(gl, vsCapsuleSource, fsCapsuleSource);
  const progBezel = createProgram(gl, vsBezelSource, fsBezelSource);

  // Instanced Quad Corners [-1, -1] to [1, 1]
  const quadVertices = new Float32Array([
    -1.0, -1.0,
     1.0, -1.0,
    -1.0,  1.0,
     1.0,  1.0,
  ]);
  const quadVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
  gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

  // Instance VBOs
  const centreVBO = gl.createBuffer();
  const shapeVBO = gl.createBuffer();
  const threshVBO = gl.createBuffer();

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // Attr 0: Quad corner (non-instanced)
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // Attr 1: Centre vec2 (instanced)
  gl.bindBuffer(gl.ARRAY_BUFFER, centreVBO);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1);

  // Attr 2: Shape vec3 (instanced)
  gl.bindBuffer(gl.ARRAY_BUFFER, shapeVBO);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(2, 1);

  // Attr 3: Threshold float (instanced)
  gl.bindBuffer(gl.ARRAY_BUFFER, threshVBO);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(3, 1);

  gl.bindVertexArray(null);

  // Bezel Guide Buffer
  const bezelVBO = gl.createBuffer();

  // Aging Grain Program and VAO (Matching Map & Constellation)
  const progGrain = createProgram(gl, vsGrainSource, fsGrainSource);
  const grainVAO = gl.createVertexArray();
  gl.bindVertexArray(grainVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const noiseTex = createNoiseTexture(gl);

  glResources = {
    progCapsule,
    progBezel,
    progGrain,
    vao,
    grainVAO,
    noiseTex,
    centreVBO,
    shapeVBO,
    threshVBO,
    bezelVBO,
    u_screenIndex: gl.getUniformLocation(progCapsule, "u_screenIndex"),
    u_screenWidth: gl.getUniformLocation(progCapsule, "u_screenWidth"),
    u_screenHeight: gl.getUniformLocation(progCapsule, "u_screenHeight"),
    u_progress: gl.getUniformLocation(progCapsule, "u_progress"),
    u_time: gl.getUniformLocation(progCapsule, "u_time"),
    u_motion: gl.getUniformLocation(progCapsule, "u_motion"),
    u_inkColor: gl.getUniformLocation(progCapsule, "u_inkColor"),
    u_alpha: gl.getUniformLocation(progCapsule, "u_alpha"),
    u_bezelColor: gl.getUniformLocation(progBezel, "u_color"),
    u_noiseTex: gl.getUniformLocation(progGrain, "u_noiseTex"),
    u_grainAmount: gl.getUniformLocation(progGrain, "u_grainAmount"),
    u_grainAlpha: gl.getUniformLocation(progGrain, "u_alpha"),
  };
}

// ── Rendering Loop ────────────────────────────────────────────────────────────
function drawFrame() {
  if (!glResources || !landscapeData) return;

  gl.viewport(0, 0, canvas.width, canvas.height);

  // Synchronize document body background with current palette paper
  const pal = TERRAIN_PALETTES[paletteIdx];
  const paperRgb = hexToRgb01(pal.paper);
  document.body.style.backgroundColor = pal.paper;

  // Paper Background Clear
  gl.clearColor(paperRgb[0], paperRgb[1], paperRgb[2], 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (landscapeData.count > 0) {
    // Subtractive / Premultiplied Ink Blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Render Instanced Capsules
    gl.useProgram(glResources.progCapsule);
    gl.bindVertexArray(glResources.vao);

    gl.uniform1f(glResources.u_screenIndex, screenIndex);
    gl.uniform1f(glResources.u_screenWidth, canvas.width);
    gl.uniform1f(glResources.u_screenHeight, canvas.height);
    gl.uniform1f(glResources.u_progress, 1.0);
    gl.uniform1f(glResources.u_time, animTime);
    gl.uniform1f(glResources.u_motion, motionEnabled && !paused ? 1.0 : 0.0);

    const inkRgb = hexToRgb01(pal.ink);
    gl.uniform3f(glResources.u_inkColor, inkRgb[0], inkRgb[1], inkRgb[2]);
    gl.uniform1f(glResources.u_alpha, currentAlpha);

    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, landscapeData.count);
    gl.bindVertexArray(null);
  }

  // Real-time Aquatint Rosin Aging Noise (Matching Map & Constellation)
  gl.useProgram(glResources.progGrain);
  gl.bindVertexArray(glResources.grainVAO);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, glResources.noiseTex);
  gl.uniform1i(glResources.u_noiseTex, 0);
  gl.uniform1f(glResources.u_grainAmount, 0.08); // Authentic antique paper tooth
  gl.uniform1f(glResources.u_grainAlpha, currentAlpha);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);

  // Draw Bezel Guide if requested
  if (showBezel > 0.5) {
    drawBezelGuide();
  }
}

function drawBezelGuide() {
  gl.useProgram(glResources.progBezel);
  gl.uniform4f(glResources.u_bezelColor, 1.0, 0.1, 0.1, 0.85);

  const leftLine = [-0.998, -1.0, -0.998, 1.0];
  const rightLine = [0.998, -1.0, 0.998, 1.0];
  const lines = new Float32Array([...leftLine, ...rightLine]);

  gl.bindBuffer(gl.ARRAY_BUFFER, glResources.bezelVBO);
  gl.bufferData(gl.ARRAY_BUFFER, lines, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.lineWidth(3.0);
  gl.drawArrays(gl.LINES, 0, 4);
  gl.disableVertexAttribArray(0);
}

// ── Animation & State Machine ─────────────────────────────────────────────────
let lastFrameTime = performance.now();

function primaryLoop(now) {
  const dt = Math.min(0.1, (now - lastFrameTime) / 1000.0);
  lastFrameTime = now;

  if (!paused) {
    animTime += dt;

    if (phase === "drawing") {
      stepLandscapeGeneration();
    } else if (phase === "linger") {
      // Linger and appreciate full scene with live wind wisps (~18s)
      phaseTimer += dt;
      if (phaseTimer >= 18.0) {
        phase = "fade";
        phaseTimer = 0.0;
      }
    } else if (phase === "fade") {
      // Fade to paper wash (~1.5s)
      phaseTimer += dt;
      currentAlpha = Math.max(0.0, 1.0 - phaseTimer / 1.5);
      if (phaseTimer >= 1.5) {
        nextTerrain();
      }
    }
  }

  drawFrame();

  // Broadcast state to secondary display
  bc.postMessage({
    cmd: "sync",
    seed: terrainSeed,
    paletteIdx,
    progress: 1.0,
    alpha: currentAlpha,
    time: animTime,
    phase,
    paused,
    motionEnabled,
    showBezel,
  });

  requestAnimationFrame(primaryLoop);
}

function nextTerrain() {
  terrainSeed = generateSeed();
  paletteIdx = (paletteIdx + 1) % TERRAIN_PALETTES.length;
  currentAlpha = 1.0;
  phase = "drawing";
  phaseTimer = 0.0;

  const totalW = canvas.width * totalScreens;
  const totalH = canvas.height;
  startLandscapeGeneration(totalW, totalH, terrainSeed);
}

// ── Secondary Screen Receiver ─────────────────────────────────────────────────
bc.onmessage = (event) => {
  const data = event.data;
  if (!data) return;

  if (data.quit) {
    window.close();
    return;
  }

  if (isPrimary) {
    if (data.cmd === "requestSync") {
      bc.postMessage({
        cmd: "sync",
        seed: terrainSeed,
        paletteIdx,
        progress: 1.0,
        alpha: currentAlpha,
        time: animTime,
        phase,
        paused,
        motionEnabled,
        showBezel,
      });
    } else if (data.cmd === "next") {
      nextTerrain();
    } else if (data.cmd === "palette") {
      paletteIdx = (paletteIdx + 1) % TERRAIN_PALETTES.length;
    } else if (data.cmd === "pause") {
      paused = !paused;
    } else if (data.cmd === "bezel") {
      showBezel = data.showBezel;
    }
    return;
  }

  // Secondary Display Client
  if (data.cmd === "sync") {
    if (data.seed !== terrainSeed) {
      terrainSeed = data.seed;
      paletteIdx = data.paletteIdx;
      const totalW = canvas.width * totalScreens;
      const totalH = canvas.height;
      startLandscapeGeneration(totalW, totalH, terrainSeed);
    } else if (data.paletteIdx !== paletteIdx) {
      paletteIdx = data.paletteIdx;
    }

    if (data.phase === "drawing") {
      stepLandscapeGeneration();
    }

    currentAlpha = data.alpha;
    animTime = data.time;
    phase = data.phase;
    paused = data.paused;
    motionEnabled = data.motionEnabled;
    showBezel = data.showBezel;

    drawFrame();
  }
};

// ── Window Resize & Screenshots ───────────────────────────────────────────────
function resize() {
  const dpr = Math.min(2.0, window.devicePixelRatio || 1.0);
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";

  const totalW = canvas.width * totalScreens;
  const totalH = canvas.height;

  if (glResources) {
    startLandscapeGeneration(totalW, totalH, terrainSeed);
  }
  drawFrame();
}

function saveCanvas() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrain-screen${screenIndex}-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

// ── Interactive Keybindings ───────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key === "q" || e.key === "Q") {
    bc.postMessage({ quit: true });
    window.close();
    return;
  }
  if (e.key === "s" || e.key === "S") {
    saveCanvas();
    return;
  }
  if (e.code === "Space" || e.key === "n" || e.key === "N") {
    if (isPrimary) nextTerrain();
    else bc.postMessage({ cmd: "next" });
    return;
  }
  if (e.key === "c" || e.key === "C") {
    if (isPrimary) paletteIdx = (paletteIdx + 1) % TERRAIN_PALETTES.length;
    else bc.postMessage({ cmd: "palette" });
    return;
  }
  if (e.key === "p" || e.key === "P") {
    paused = !paused;
    if (!isPrimary) bc.postMessage({ cmd: "pause" });
    return;
  }
  if (e.key === "b" || e.key === "B") {
    showBezel = showBezel > 0.5 ? 0.0 : 1.0;
    if (!isPrimary) bc.postMessage({ cmd: "bezel", showBezel });
    return;
  }
});

// Click to toggle fullscreen
canvas.addEventListener("click", () => {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }
});

window.addEventListener("resize", resize);

// ── Bootstrapping ─────────────────────────────────────────────────────────────
setupGLResources();
resize();

if (isPrimary) {
  requestAnimationFrame(primaryLoop);
} else {
  bc.postMessage({ cmd: "requestSync" });
}
