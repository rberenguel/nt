// Procedural Topographic Elevation Maps & Orographic Relief Cartography
// Dual-screen BroadcastChannel coordination with WebGL aquatint rosin noise quad.

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = params.has("screens") ? parseInt(params.get("screens"), 10) : 1;
const isPrimary = screenIndex === 0;

document.title = `Topography ${screenIndex}`;

const canvas = document.getElementById("topographyCanvas");

// ── WebGL Postprocessing Pipeline (Concurrent Aquatint Rosin Noise) ───────────
function hexToRgb01(hex) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((ch) => ch + ch).join("");
  const num = parseInt(c, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

const vsSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fsSource = `
  precision highp float;

  uniform sampler2D u_texture;
  uniform sampler2D u_noiseTex;
  uniform float u_screenIndex;
  uniform float u_totalScreens;
  uniform float u_grainAmount;
  uniform float u_alpha;
  uniform vec3 u_paperColor;

  varying vec2 v_uv;

  void main() {
    // Panoramic slice across displays (flip Y so 2D top-down aligns with WebGL)
    float u = (v_uv.x + u_screenIndex) / u_totalScreens;
    float v = 1.0 - v_uv.y;
    vec4 texColor = texture2D(u_texture, vec2(u, v));

    // Sample pure noise texture with 256.0 repeat tiling to eliminate all hash-banding
    vec2 coord1 = gl_FragCoord.xy / 256.0;
    vec2 coord2 = (gl_FragCoord.yx * 0.5 + vec2(0.37, 0.71)) / 256.0;

    vec4 nSample1 = texture2D(u_noiseTex, coord1);
    vec4 nSample2 = texture2D(u_noiseTex, coord2);

    float n1 = (nSample1.r - 0.5) * u_grainAmount;
    float n2 = (nSample2.g - 0.5) * (u_grainAmount * 0.45);

    vec3 color = clamp(texColor.rgb + n1 + n2, 0.0, 1.0);

    // Fade transition into antique paper tone
    color = mix(u_paperColor, color, u_alpha);

    gl_FragColor = vec4(color, 1.0);
  }
`;

let glState = null;
let fallbackCtx2D = null;

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

function initWebGLState() {
  let gl = null;
  try {
    gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: false, alpha: false }) ||
         canvas.getContext("experimental-webgl", { preserveDrawingBuffer: true, antialias: false, alpha: false });
  } catch (e) {
    gl = null;
  }
  if (!gl) {
    fallbackCtx2D = canvas.getContext("2d");
    return null;
  }

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("WebGL Shader error:", gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const vs = compileShader(gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) {
    fallbackCtx2D = canvas.getContext("2d");
    return null;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("WebGL Link error:", gl.getProgramInfoLog(prog));
    fallbackCtx2D = canvas.getContext("2d");
    return null;
  }

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]),
    gl.STATIC_DRAW
  );

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const noiseTex = createNoiseTexture(gl);

  return {
    gl,
    prog,
    posAttr: gl.getAttribLocation(prog, "a_position"),
    posBuf,
    tex,
    noiseTex,
    uniforms: {
      u_texture: gl.getUniformLocation(prog, "u_texture"),
      u_noiseTex: gl.getUniformLocation(prog, "u_noiseTex"),
      u_screenIndex: gl.getUniformLocation(prog, "u_screenIndex"),
      u_totalScreens: gl.getUniformLocation(prog, "u_totalScreens"),
      u_grainAmount: gl.getUniformLocation(prog, "u_grainAmount"),
      u_alpha: gl.getUniformLocation(prog, "u_alpha"),
      u_paperColor: gl.getUniformLocation(prog, "u_paperColor"),
    },
  };
}

glState = initWebGLState();

// ── Multi-screen BroadcastChannel ─────────────────────────────────────────────
const bc = new BroadcastChannel("topography");

function saveCanvas() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `topography-screen${screenIndex}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

let paletteIdx = Math.floor(Math.random() * TOPOGRAPHY_PALETTES.length);
let topoSeed = Math.floor(Math.random() * 10000000);
let paused = false;
let showBezel = 0.0;

// Animation timing configuration (ms)
const INITIAL_DELAY  = 500;    // Wait 500ms on first launch for Chrome multi-window sync
const DRAW_DURATION  = 28000;  // Deliberate line-by-line elevation engraving (~28s)
const PAUSE_DURATION = 14000;  // Linger for 14s to admire completed topographic chart
const FADE_DURATION  = 900;    // Dissolve into next map (~0.9s)

let initialDelayDone = false;
let initialStartTime = 0;
let phase = "drawing"; // "drawing" | "pausing" | "fading"
let phaseStart = 0;
let currentProgress = 0.0;
let currentAlpha = 1.0;

let topoScene = null;
let renderedFinalSeed = null;

// ── Offscreen Panoramic Topography Canvas ──────────────────────────────────────
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");

function generateMap(totalW, totalH, seed) {
  renderedFinalSeed = null;
  if (offscreenCanvas.width !== totalW || offscreenCanvas.height !== totalH) {
    offscreenCanvas.width = totalW;
    offscreenCanvas.height = totalH;
  }
  topoScene = generateTopographyScene(totalW, totalH, totalScreens, seed);
}

function renderOffscreenScene(totalW, totalH, seed, progress, alpha) {
  if (offscreenCanvas.width !== totalW || offscreenCanvas.height !== totalH) {
    offscreenCanvas.width = totalW;
    offscreenCanvas.height = totalH;
  }

  const pal = TOPOGRAPHY_PALETTES[paletteIdx];
  const { margin, waterlines, hachures, runFont } = topoScene;

  // 1. Base Antique Laid Paper Wash with subtle tooth
  offscreenCtx.fillStyle = pal.paper;
  offscreenCtx.fillRect(0, 0, totalW, totalH);

  const pat = getLaidPattern(offscreenCtx);
  if (pat) {
    offscreenCtx.save();
    offscreenCtx.fillStyle = pat;
    offscreenCtx.globalCompositeOperation = pal.isDark ? "screen" : "multiply";
    offscreenCtx.globalAlpha = pal.isDark ? 0.18 : 0.55;
    offscreenCtx.fillRect(0, 0, totalW, totalH);
    offscreenCtx.restore();
  }

  if (progress <= 0) return;

  // 1. Base Coordinate Graticule Grid: 0.00 -> 0.14
  const gridProgress = Math.min(1.0, progress / 0.14);
  if (gridProgress > 0) {
    drawGraticuleGrid(offscreenCtx, totalW, totalH, margin, pal, gridProgress, runFont);
  }

  // 1.5 Soft Watercolor Hill-Shade Relief Wash: 0.04 -> 0.30
  const washProgress = Math.max(0.0, Math.min(1.0, (progress - 0.04) / 0.26));
  if (washProgress > 0) {
    drawReliefWash(offscreenCtx, topoScene, pal, washProgress);
  }

  // 2. Lake Waterlines (Echo contours): 0.08 -> 0.35
  const waterProgress = Math.max(0.0, Math.min(1.0, (progress - 0.08) / 0.27));
  if (waterProgress > 0) {
    drawWaterlines(offscreenCtx, waterlines, pal, waterProgress);
  }

  // 3. Elevation Contour Lines: Traced continuously around each isoline: 0.14 -> 0.82
  const contourProgress = Math.max(0.0, Math.min(1.0, (progress - 0.14) / 0.68));
  if (contourProgress > 0) {
    drawContourLines(offscreenCtx, topoScene, pal, contourProgress);
  }

  // 4. Imhof Slope Relief Hachures: 0.55 -> 0.88
  const hachureProgress = Math.max(0.0, Math.min(1.0, (progress - 0.55) / 0.33));
  if (hachureProgress > 0) {
    drawImhofHachures(offscreenCtx, hachures, pal, hachureProgress);
  }

  // Always clean margins outside the neatline boundary
  cleanOuterMargins(offscreenCtx, totalW, totalH, margin, pal);

  // 5. Summits & Mountain Passes: 0.78 -> 0.94
  const summitProgress = Math.max(0.0, Math.min(1.0, (progress - 0.78) / 0.16));
  if (summitProgress > 0) {
    drawSummitsAndPasses(offscreenCtx, topoScene, pal, summitProgress);
  }

  // 6. Double Neatline Framing Border & Master Cartouche: 0.88 -> 1.00
  const decorProgress = Math.max(0.0, Math.min(1.0, (progress - 0.88) / 0.12));
  if (decorProgress > 0) {
    drawNeatlineBorder(offscreenCtx, totalW, totalH, margin, pal, decorProgress);
    drawMasterCartouche(offscreenCtx, topoScene, pal, decorProgress);
  }

  // Dual-screen bezel line guide (if enabled)
  if (showBezel > 0.5) {
    offscreenCtx.save();
    offscreenCtx.strokeStyle = "#ff4411";
    offscreenCtx.lineWidth = 3.0;
    const screenW = totalW / totalScreens;
    for (let s = 1; s < totalScreens; s++) {
      const bx = s * screenW;
      offscreenCtx.beginPath();
      offscreenCtx.moveTo(bx, 0);
      offscreenCtx.lineTo(bx, totalH);
      offscreenCtx.stroke();
    }
    offscreenCtx.restore();
  }
}

// ── Main Page Draw Call ───────────────────────────────────────────────────────
function drawTopographyOnScreen(progress, alpha = 1.0) {
  if (offscreenCanvas.width === 0 || offscreenCanvas.height === 0 || !topoScene) return;

  const pal = TOPOGRAPHY_PALETTES[paletteIdx];
  document.body.style.background = pal.paper;

  const totalW = canvas.width * totalScreens;
  const totalH = canvas.height;

  // Only re-render offscreen if drawing is in-flight or seed has changed
  if (progress < 1.0 || renderedFinalSeed !== topoSeed) {
    renderOffscreenScene(totalW, totalH, topoSeed, progress, alpha);
    if (progress >= 1.0) renderedFinalSeed = topoSeed;
  }

  // Render on screen with real-time aquatint fragment shader
  if (glState) {
    const { gl, prog, posAttr, posBuf, tex, noiseTex, uniforms } = glState;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);

    // Upload offscreen canvas to texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreenCanvas);
    gl.uniform1i(uniforms.u_texture, 0);

    // Bind tiled random noise texture (unit 1)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.uniform1i(uniforms.u_noiseTex, 1);

    gl.uniform1f(uniforms.u_screenIndex, screenIndex);
    gl.uniform1f(uniforms.u_totalScreens, totalScreens);
    gl.uniform1f(uniforms.u_grainAmount, pal.isDark ? 0.055 : 0.080);
    gl.uniform1f(uniforms.u_alpha, alpha);

    const paperRgb = hexToRgb01(pal.paper);
    gl.uniform3f(uniforms.u_paperColor, paperRgb[0], paperRgb[1], paperRgb[2]);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  } else if (fallbackCtx2D) {
    fallbackCtx2D.clearRect(0, 0, canvas.width, canvas.height);
    fallbackCtx2D.save();
    fallbackCtx2D.globalAlpha = alpha;
    const offsetX = screenIndex * canvas.width;
    fallbackCtx2D.drawImage(offscreenCanvas, -offsetX, 0);
    fallbackCtx2D.restore();
  }
}

// ── Resize ────────────────────────────────────────────────────────────────────
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  renderedFinalSeed = null;
  generateMap(canvas.width * totalScreens, canvas.height, topoSeed);
  drawTopographyOnScreen(currentProgress, currentAlpha);
}
window.addEventListener("resize", resize);

// ── Advance to Next Topography Map ────────────────────────────────────────────
function nextTopography() {
  topoSeed = Math.floor(Math.random() * 10000000);
  paletteIdx = Math.floor(Math.random() * TOPOGRAPHY_PALETTES.length);
  renderedFinalSeed = null;
  generateMap(canvas.width * totalScreens, canvas.height, topoSeed);
  phase = "drawing";
  phaseStart = 0;
  currentProgress = 0.0;
  currentAlpha = 1.0;
}

// ── Primary Animation Loop ────────────────────────────────────────────────────
function primaryLoop(timestamp) {
  if (!initialDelayDone) {
    if (initialStartTime === 0) initialStartTime = timestamp;
    currentProgress = 0.0;
    currentAlpha = 1.0;
    drawTopographyOnScreen(0.0, 1.0);

    bc.postMessage({
      cmd: "sync",
      seed: topoSeed,
      paletteIdx,
      phase: "drawing",
      progress: 0.0,
      alpha: 1.0,
      paused,
      showBezel,
    });

    if (timestamp - initialStartTime >= INITIAL_DELAY) {
      initialDelayDone = true;
      phaseStart = timestamp;
    }
    requestAnimationFrame(primaryLoop);
    return;
  }

  if (!paused) {
    if (phase === "drawing") {
      if (phaseStart === 0) phaseStart = timestamp;
      const elapsed = Math.max(0, timestamp - phaseStart);
      currentProgress = Math.min(1.0, elapsed / DRAW_DURATION);
      currentAlpha = 1.0;

      drawTopographyOnScreen(currentProgress, 1.0);

      if (currentProgress >= 1.0) {
        phase = "pausing";
        phaseStart = timestamp;
      }
    } else if (phase === "pausing") {
      currentProgress = 1.0;
      currentAlpha = 1.0;
      drawTopographyOnScreen(1.0, 1.0);

      if (timestamp - phaseStart >= PAUSE_DURATION) {
        phase = "fading";
        phaseStart = timestamp;
      }
    } else if (phase === "fading") {
      currentProgress = 1.0;
      const t = (timestamp - phaseStart) / FADE_DURATION;
      currentAlpha = Math.max(0.0, 1.0 - t);
      drawTopographyOnScreen(1.0, currentAlpha);

      if (t >= 1.0) {
        nextTopography();
        requestAnimationFrame(primaryLoop);
        return;
      }
    }
  }

  bc.postMessage({
    cmd: "sync",
    seed: topoSeed,
    paletteIdx,
    phase,
    progress: currentProgress,
    alpha: currentAlpha,
    paused,
    showBezel,
  });

  requestAnimationFrame(primaryLoop);
}

// ── Multi-screen BroadcastChannel Communication ───────────────────────────────
bc.onmessage = (ev) => {
  const data = ev.data;
  if (!data) return;

  if (data.quit) {
    window.close();
    return;
  }

  if (isPrimary) {
    if (data.cmd === "requestSync") {
      bc.postMessage({
        cmd: "sync",
        seed: topoSeed,
        paletteIdx,
        phase,
        progress: currentProgress,
        alpha: currentAlpha,
        paused,
        showBezel,
      });
    } else if (data.cmd === "save") {
      saveCanvas();
    } else if (data.cmd === "next") {
      nextTopography();
    } else if (data.cmd === "palette") {
      paletteIdx = (paletteIdx + 1) % TOPOGRAPHY_PALETTES.length;
      renderedFinalSeed = null;
    } else if (data.cmd === "pause") {
      paused = !paused;
    } else if (data.cmd === "bezel") {
      showBezel = data.showBezel;
    }
    return;
  }

  // Secondary display client (100% matched to map.js architecture)
  if (data.cmd === "sync") {
    if (data.seed !== topoSeed) {
      topoSeed = data.seed;
      paletteIdx = data.paletteIdx;
      renderedFinalSeed = null;
      generateMap(canvas.width * totalScreens, canvas.height, topoSeed);
    } else if (data.paletteIdx !== paletteIdx) {
      paletteIdx = data.paletteIdx;
      renderedFinalSeed = null;
    }
    phase = data.phase;
    currentProgress = data.progress;
    currentAlpha = data.alpha;
    paused = data.paused;
    showBezel = data.showBezel;
    drawTopographyOnScreen(currentProgress, currentAlpha);
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
    if (isPrimary) saveCanvas();
    else bc.postMessage({ cmd: "save" });
    return;
  }
  if (e.code === "Space" || e.key === "n" || e.key === "N") {
    if (isPrimary) nextTopography();
    else bc.postMessage({ cmd: "next" });
    return;
  }
  if (e.key === "c" || e.key === "C") {
    if (isPrimary) {
      paletteIdx = (paletteIdx + 1) % TOPOGRAPHY_PALETTES.length;
      renderedFinalSeed = null;
    } else {
      bc.postMessage({ cmd: "palette" });
    }
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

// ── Startup ───────────────────────────────────────────────────────────────────
resize();

if (isPrimary) {
  generateMap(canvas.width * totalScreens, canvas.height, topoSeed);
  requestAnimationFrame(primaryLoop);
} else {
  bc.postMessage({ cmd: "requestSync" });
}
