const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = parseInt(params.get("screens") || "1", 10);
const isPrimary = screenIndex === 0;

if (!isPrimary) document.getElementById("hud").style.display = "none";

document.title = `Arabesque ${screenIndex}`;

const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

function resize() {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener("resize", resize);

// ── Palettes ──────────────────────────────────────────────────────────────────
const PALETTES = [
  {
    name: "Gold",
    warmLow:    [0.08, 0.03, 0.01],
    warmHigh:   [0.98, 0.65, 0.15],
    warmAccent: [0.78, 0.38, 0.08],
    coolLow:    [0.01, 0.16, 0.28],
    coolHigh:   [0.25, 0.88, 1.00],
  },
  {
    name: "Lapis",
    warmLow:    [0.12, 0.08, 0.01],
    warmHigh:   [0.95, 0.78, 0.12],
    warmAccent: [0.75, 0.50, 0.03],
    coolLow:    [0.01, 0.02, 0.12],
    coolHigh:   [0.15, 0.40, 0.95],
  },
  {
    name: "Jade",
    warmLow:    [0.05, 0.08, 0.02],
    warmHigh:   [0.85, 0.72, 0.15],
    warmAccent: [0.55, 0.45, 0.05],
    coolLow:    [0.01, 0.12, 0.05],
    coolHigh:   [0.18, 0.82, 0.42],
  },
  {
    name: "Amethyst",
    warmLow:    [0.06, 0.02, 0.10],
    warmHigh:   [0.88, 0.84, 0.95],
    warmAccent: [0.68, 0.55, 0.80],
    coolLow:    [0.08, 0.02, 0.18],
    coolHigh:   [0.72, 0.38, 0.98],
  },
  {
    name: "Copper",
    warmLow:    [0.12, 0.04, 0.01],
    warmHigh:   [0.90, 0.48, 0.14],
    warmAccent: [0.68, 0.28, 0.08],
    coolLow:    [0.01, 0.09, 0.07],
    coolHigh:   [0.22, 0.78, 0.58],
  },
  {
    name: "Moonlight",
    warmLow:    [0.02, 0.02, 0.06],
    warmHigh:   [0.80, 0.86, 0.98],
    warmAccent: [0.48, 0.55, 0.72],
    coolLow:    [0.01, 0.01, 0.10],
    coolHigh:   [0.88, 0.93, 1.00],
  },
  {
    name: "Sepia",
    warmLow:    [0.10, 0.06, 0.02],
    warmHigh:   [0.92, 0.80, 0.58],
    warmAccent: [0.78, 0.58, 0.32],
    coolLow:    [0.08, 0.05, 0.02],
    coolHigh:   [0.96, 0.88, 0.72],
  },
];

const PALETTE_HOLD = 30;  // seconds to dwell on each palette
const PALETTE_FADE = 15;  // seconds to blend into the next

// ── Init (async to fetch shader sources) ─────────────────────────────────────
async function init() {
  const [vertSrc, fragSrc] = await Promise.all([
    fetch("arabesque.vert").then(r => r.text()),
    fetch("arabesque.frag").then(r => r.text()),
  ]);

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error(gl.getShaderInfoLog(s));
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(prog, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uVirtualRes  = gl.getUniformLocation(prog, "u_virtual_resolution");
  const uScreenOff   = gl.getUniformLocation(prog, "u_screen_offset");
  const uTime        = gl.getUniformLocation(prog, "u_time");
  const uPalTime     = gl.getUniformLocation(prog, "u_palette_time");
  const uBorders     = gl.getUniformLocation(prog, "u_show_borders");
  const uWarmLow     = gl.getUniformLocation(prog, "u_warm_low");
  const uWarmHigh    = gl.getUniformLocation(prog, "u_warm_high");
  const uWarmAccent  = gl.getUniformLocation(prog, "u_warm_accent");
  const uCoolLow     = gl.getUniformLocation(prog, "u_cool_low");
  const uCoolHigh    = gl.getUniformLocation(prog, "u_cool_high");

  // ── Palette blending state ─────────────────────────────────────────────────
  let showBorders  = 0.0;
  let paletteSpeed = 0.3;
  let paletteTime  = 0.0;
  let lastTime     = 0;
  let lastDrawNow  = 0;
  let lastDrawPal  = 0;

  let fromIdx     = Math.floor(Math.random() * PALETTES.length);
  let toIdx       = fromIdx;
  let blend       = 1.0;  // 0 = fully fromIdx, 1 = fully toIdx
  let paletteTick = 0;    // time within current HOLD+FADE cycle

  function lerp3(a, b, t) {
    return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
  }

  function uploadPalette() {
    const f = PALETTES[fromIdx], t = PALETTES[toIdx];
    gl.uniform3fv(uWarmLow,    lerp3(f.warmLow,    t.warmLow,    blend));
    gl.uniform3fv(uWarmHigh,   lerp3(f.warmHigh,   t.warmHigh,   blend));
    gl.uniform3fv(uWarmAccent, lerp3(f.warmAccent, t.warmAccent, blend));
    gl.uniform3fv(uCoolLow,    lerp3(f.coolLow,    t.coolLow,    blend));
    gl.uniform3fv(uCoolHigh,   lerp3(f.coolHigh,   t.coolHigh,   blend));
  }

  function advancePalette() {
    fromIdx     = toIdx;
    toIdx       = (toIdx + 1) % PALETTES.length;
    blend       = 0.0;
    paletteTick = 0;
  }

  uploadPalette();

  function tickPalette(dt) {
    paletteTick += dt;
    if (paletteTick >= PALETTE_HOLD + PALETTE_FADE) {
      // cycle complete — snap to toIdx and start fresh
      fromIdx     = toIdx;
      toIdx       = (toIdx + 1) % PALETTES.length;
      paletteTick -= PALETTE_HOLD + PALETTE_FADE;
    }
    blend = paletteTick <= PALETTE_FADE
      ? paletteTick / PALETTE_FADE
      : 1.0;
    uploadPalette();
  }

  function draw(now, palTime) {
    lastDrawNow = now;
    lastDrawPal = palTime;
    gl.uniform2f(uVirtualRes, canvas.width * totalScreens, canvas.height);
    gl.uniform1f(uScreenOff,  screenIndex * canvas.width);
    gl.uniform1f(uTime,       now * 0.001);
    gl.uniform1f(uPalTime,    palTime);
    gl.uniform1f(uBorders,    showBorders);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function redraw() { draw(lastDrawNow, lastDrawPal); }

  // ── Multi-screen sync via BroadcastChannel ──────────────────────────────────
  const bc = new BroadcastChannel("arabesque");

  bc.addEventListener("message", ({ data }) => {
    if (data.quit) { window.close(); return; }
    if (data.cmd === "borders") { showBorders = data.showBorders; redraw(); return; }
    if (data.cmd === "palette") {
      fromIdx = data.fromIdx; toIdx = data.toIdx;
      blend = data.blend; paletteTick = data.paletteTick;
      uploadPalette();
      return;
    }
    if (isPrimary) return;
    showBorders = data.showBorders;
    fromIdx = data.fromIdx; toIdx = data.toIdx;
    blend = data.blend;
    uploadPalette();
    draw(data.time, data.paletteTime);
  });

  resize();

  if (isPrimary) {
    function loop(now) {
      const dt = lastTime ? (now - lastTime) * 0.001 : 0.016;
      lastTime = now;
      paletteTime += dt * paletteSpeed;
      tickPalette(dt);
      draw(now, paletteTime);
      bc.postMessage({ time: now, paletteTime, showBorders, fromIdx, toIdx, blend });
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // ── Fullscreen & Keys ───────────────────────────────────────────────────────
  document.addEventListener("click", () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "q" || e.key === "Q") { bc.postMessage({ quit: true }); window.close(); return; }
    if (e.key === "p" || e.key === "P") {
      advancePalette();
      uploadPalette();
      bc.postMessage({ cmd: "palette", fromIdx, toIdx, blend, paletteTick });
      return;
    }
    if (e.code === "KeyB" || e.code === "Space") {
      showBorders = showBorders === 1.0 ? 0.0 : 1.0;
      bc.postMessage({ cmd: "borders", showBorders });
      redraw();
      return;
    }
    if (!isPrimary) return;
    if (e.key === "]") {
      paletteSpeed = Math.min(paletteSpeed + 0.5, 10.0);
      document.getElementById("speedVal").textContent = paletteSpeed.toFixed(1) + "x";
    } else if (e.key === "[") {
      paletteSpeed = Math.max(paletteSpeed - 0.5, 0.0);
      document.getElementById("speedVal").textContent = paletteSpeed.toFixed(1) + "x";
    }
  });
}

init();
