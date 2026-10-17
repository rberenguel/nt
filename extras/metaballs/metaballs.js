// Topographic 3D Metaball Slices (Metaball Interactions)
// Dual-screen 32:9 analytical planar slicing with BroadcastChannel synchronization

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = parseInt(params.get("screens") || "2", 10);
const isPrimary = screenIndex === 0;

document.title = `Metaballs ${screenIndex}`;

const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

if (!gl) {
  document.body.innerHTML = "<div style='color:white;padding:30px;font-family:sans-serif'>WebGL2 is required for this screensaver.</div>";
  throw new Error("WebGL2 not supported");
}

// ── Downscaled Internal Render Buffer for Silky 60+ FPS Fill Rate ─────────────
function resize() {
  // Lower internal render resolution (0.5x) for silky-smooth fill rate & soft paper edge
  const scale = 0.50;
  canvas.width = Math.max(640, Math.round(window.innerWidth * scale));
  canvas.height = Math.max(360, Math.round(window.innerHeight * scale));
}
window.addEventListener("resize", resize);
resize();

// ── Multi-screen BroadcastChannel ─────────────────────────────────────────────
const bc = new BroadcastChannel("metaballs");

function saveCanvas() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metaballs-screen${screenIndex}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

// ── 32 Playful Swarm Metaballs Setup ──────────────────────────────────────────
const NUM_METABALLS = 32;
const metaballData = new Float32Array(NUM_METABALLS * 4); // [x, y, z, radius, ...]

// Nimble, diverse droplet sizes (smaller radii for delicate contours and quick break-offs)
const baseRadii = new Float32Array([
  // Cluster A (Left Screen Center): 1 anchor (0.44) + 5 medium (0.28-0.34) + 6 satellite droplets (0.16-0.22)
  0.44, 0.34, 0.32, 0.30, 0.28, 0.28, 0.22, 0.20, 0.19, 0.18, 0.16, 0.16,
  // Cluster B (Right Screen Center): 1 anchor (0.44) + 5 medium (0.28-0.34) + 6 satellite droplets (0.16-0.22)
  0.44, 0.34, 0.32, 0.30, 0.28, 0.28, 0.22, 0.20, 0.19, 0.18, 0.16, 0.16,
  // Inter-Screen Voyagers (sweeping across screens and through the fold): 4 medium + 4 agile beads
  0.30, 0.28, 0.26, 0.25, 0.22, 0.20, 0.18, 0.16,
]);

let userAzimuth = 0.0;
let userElevation = 0.82; // ~47 degrees pitch looking down
let cameraDist = 9.8;
let orbitPaused = false;
let darkMode = 0.0; // 0.0: Washi Parchment, 1.0: Obsidian Slate
let showBezel = 0.0;
let simTime = 0.0;
let lastTimestamp = 0;

// ── Smooth Analytical Harmonic Swarm Kinematics with Break-Apart Cycles ───────
function updateMetaballSwarm(t) {
  // Breathing dispersion cycle (~24 second period):
  // When disp > 0: swarm expands and breaks apart into isolated droplets
  // When disp < 0: swarm gathers and merges into organic amoeba islands
  const disp = Math.sin(t * 0.26);
  const breakApart = Math.max(0.0, disp);
  const coalesce = Math.max(0.0, -disp);

  const swarmSpread = 1.0 + breakApart * 0.90 - coalesce * 0.22;
  const radiusScale = 1.0 - breakApart * 0.16 + coalesce * 0.10;

  for (let i = 0; i < NUM_METABALLS; i++) {
    const idx4 = i * 4;
    let cx = 0.0;
    let cy = 0.0;
    let cz = 0.0;

    // Individual slingshot ejection burst for satellite droplets
    const flingPhase = t * (0.34 + (i % 5) * 0.08) + i * 1.95;
    const fling = Math.pow(Math.max(0.0, Math.sin(flingPhase)), 4.0) * 0.85;
    const flingDirX = Math.cos(i * 2.39);
    const flingDirZ = Math.sin(i * 2.39);

    if (i < 12) {
      // Anchored in the center of the Left Display (X ~ -3.8)
      cx = -3.8 + 0.65 * Math.sin(t * 0.22);
      cy = 0.35 * Math.cos(t * 0.28 + i * 0.35);
      cz = 0.50 * Math.sin(t * 0.19 + i * 0.30);
    } else if (i < 24) {
      // Anchored in the center of the Right Display (X ~ +3.8)
      cx = 3.8 + 0.65 * Math.cos(t * 0.20);
      cy = -0.35 * Math.sin(t * 0.26 + i * 0.35);
      cz = -0.50 * Math.cos(t * 0.21 + i * 0.30);
    } else {
      // Inter-screen voyagers sweeping from left screen center to right screen center
      const phase = (i - 24) * 0.78;
      // Large amplitude sweeping between -4.2 (left screen) and +4.2 (right screen)
      cx = Math.sin(t * 0.30 + phase) * (4.2 + (i % 3) * 0.3);
      cy = 0.65 * Math.sin(t * 0.55 + i * 1.1);
      cz = 0.75 * Math.cos(t * 0.42 + i * 0.8);
    }

    // Individual 3D orbit around local center with dynamic spread
    const rx = (0.42 + (i % 4) * 0.22) * swarmSpread;
    const ry = (0.28 + (i % 3) * 0.16);
    const rz = (0.42 + (i % 5) * 0.18) * swarmSpread;
    const w = 0.52 + (i % 7) * 0.18;

    metaballData[idx4 + 0] = cx + rx * Math.cos(t * w + i * 1.25) + flingDirX * fling;
    metaballData[idx4 + 1] = cy + ry * Math.sin(t * w * 1.35 + i * 1.65);
    metaballData[idx4 + 2] = cz + rz * Math.sin(t * w * 0.90 + i * 0.85) + flingDirZ * fling;

    // Dynamic radius with breathing pulsation and break-apart pinching
    const pulse = Math.sin(t * 1.6 + i * 1.3) * 0.025;
    metaballData[idx4 + 3] = baseRadii[i] * radiusScale + pulse;
  }
}

// ── Shader Setup ──────────────────────────────────────────────────────────────
async function init() {
  const [vertSrc, fragSrc] = await Promise.all([
    fetch("metaballs.vert").then((r) => r.text()),
    fetch("metaballs.frag").then((r) => r.text()),
  ]);

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);

  // Fullscreen quad
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

  // Uniform locations
  const uRes = gl.getUniformLocation(prog, "u_resolution");
  const uVirtRes = gl.getUniformLocation(prog, "u_virtual_resolution");
  const uScreenOff = gl.getUniformLocation(prog, "u_screen_offset");
  const uTime = gl.getUniformLocation(prog, "u_time");
  const uShowBorder = gl.getUniformLocation(prog, "u_show_border");
  const uScreenIdx = gl.getUniformLocation(prog, "u_screen_index");
  const uTotScreens = gl.getUniformLocation(prog, "u_total_screens");
  const uCamAngles = gl.getUniformLocation(prog, "u_camera_angles");
  const uCamDist = gl.getUniformLocation(prog, "u_camera_dist");
  const uDarkMode = gl.getUniformLocation(prog, "u_dark_mode");
  const uMetaballs = gl.getUniformLocation(prog, "u_metaballs[0]");

  // ── Render Draw Call ────────────────────────────────────────────────────────
  function render(timeNow, curAzimuth, curElevation) {
    gl.useProgram(prog);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uVirtRes, canvas.width * totalScreens, canvas.height);
    gl.uniform1f(uScreenOff, screenIndex * canvas.width);
    gl.uniform1f(uTime, timeNow);
    gl.uniform1f(uShowBorder, showBezel);
    gl.uniform1i(uScreenIdx, screenIndex);
    gl.uniform1i(uTotScreens, totalScreens);
    gl.uniform2f(uCamAngles, curAzimuth, curElevation);
    gl.uniform1f(uCamDist, cameraDist);
    gl.uniform1f(uDarkMode, darkMode);
    gl.uniform4fv(uMetaballs, metaballData);

    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ── Animation Loop ──────────────────────────────────────────────────────────
  function loop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min((timestamp - lastTimestamp) * 0.001, 0.05);
    lastTimestamp = timestamp;

    if (!orbitPaused) {
      simTime += dt;
    }

    // Subtle parallax sway: keeps clusters in their respective screen centers
    // while providing continuous 3D depth and slice shading shifting
    const curAzimuth = userAzimuth + (orbitPaused ? 0.0 : Math.sin(simTime * 0.15) * 0.08);
    const curElevation = userElevation + (orbitPaused ? 0.0 : Math.sin(simTime * 0.11) * 0.03);

    // Deterministic smooth swarm evaluation
    updateMetaballSwarm(simTime);

    // Primary window periodically syncs time clock & state (at low frequency to avoid GC stutter)
    if (isPrimary && Math.floor(simTime * 4) !== Math.floor((simTime - dt) * 4)) {
      bc.postMessage({
        cmd: "heartbeat",
        simTime,
        userAzimuth,
        userElevation,
        cameraDist,
        darkMode,
        showBezel,
        orbitPaused,
      });
    }

    render(simTime, curAzimuth, curElevation);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // ── BroadcastChannel Message Handler ────────────────────────────────────────
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
    if (data.cmd === "heartbeat" && !isPrimary) {
      // Gently align clock without jarring snap
      if (Math.abs(simTime - data.simTime) > 0.1) {
        simTime = data.simTime;
      }
      userAzimuth = data.userAzimuth;
      userElevation = data.userElevation;
      cameraDist = data.cameraDist;
      darkMode = data.darkMode;
      showBezel = data.showBezel;
      orbitPaused = data.orbitPaused;
      return;
    }
    if (data.cmd === "cam") {
      userAzimuth = data.userAzimuth;
      userElevation = data.userElevation;
      cameraDist = data.cameraDist;
      return;
    }
    if (data.cmd === "theme") {
      darkMode = data.darkMode;
      return;
    }
    if (data.cmd === "bezel") {
      showBezel = data.showBezel;
      return;
    }
    if (data.cmd === "orbit") {
      orbitPaused = data.orbitPaused;
      return;
    }
  };

  // ── Pointer Drag & Orbit Controls ───────────────────────────────────────────
  let isDragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  window.addEventListener("pointerdown", (e) => {
    isDragging = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  });

  window.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;

    userAzimuth += dx * 0.006;
    userElevation = Math.max(0.25, Math.min(1.45, userElevation - dy * 0.005));

    bc.postMessage({
      cmd: "cam",
      userAzimuth,
      userElevation,
      cameraDist,
    });
  });

  window.addEventListener("pointerup", () => {
    isDragging = false;
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    cameraDist = Math.max(5.5, Math.min(22.0, cameraDist + e.deltaY * 0.01));
    bc.postMessage({
      cmd: "cam",
      userAzimuth,
      userElevation,
      cameraDist,
    });
  }, { passive: false });

  document.addEventListener("click", () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  });

  // ── Keyboard Shortcuts ──────────────────────────────────────────────────────
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
    if (e.code === "Space") {
      orbitPaused = !orbitPaused;
      bc.postMessage({ cmd: "orbit", orbitPaused });
      return;
    }
    if (e.key === "d" || e.key === "D") {
      darkMode = darkMode > 0.5 ? 0.0 : 1.0;
      bc.postMessage({ cmd: "theme", darkMode });
      return;
    }
    if (e.key === "b" || e.key === "B") {
      showBezel = showBezel > 0.5 ? 0.0 : 1.0;
      bc.postMessage({ cmd: "bezel", showBezel });
      return;
    }
  });
}

init().catch(console.error);
