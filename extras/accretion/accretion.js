// Relativistic Accretion Disk Ray Tracer
// Dual-screen 32:9 Schwarzschild geodesic solver with BroadcastChannel synchronization

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = parseInt(params.get("screens") || "2", 10);
const isPrimary = screenIndex === 0;

document.title = `Accretion ${screenIndex}`;

const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

if (!gl) {
  document.body.innerHTML = "<div style='color:white;padding:30px;font-family:sans-serif'>WebGL is required for this screensaver.</div>";
  throw new Error("WebGL not supported");
}

function resize() {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
}
window.addEventListener("resize", resize);
resize();

// ── Multi-screen BroadcastChannel ─────────────────────────────────────────────
const bc = new BroadcastChannel("accretion");

function saveCanvas() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accretion-screen${screenIndex}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

// ── State Variables ───────────────────────────────────────────────────────────
let cameraAzimuth = 0.0;
let cameraElevation = 0.22; // ~12.6 degrees above disk plane
let cameraDist = 14.5;      // 14.5 Schwarzschild radii
let orbitPaused = false;
let dopplerEnabled = 1.0;
let showBezel = 0.0;
let lastTime = 0;
let lastPrimaryMessageTime = 0;

// ── Shader Setup ──────────────────────────────────────────────────────────────
async function init() {
  const [vertSrc, fragSrc] = await Promise.all([
    fetch("accretion.vert").then((r) => r.text()),
    fetch("accretion.frag").then((r) => r.text()),
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

  // Fullscreen quad buffer
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
  const uDoppler = gl.getUniformLocation(prog, "u_doppler_enabled");

  // ── Render Draw Call ────────────────────────────────────────────────────────
  function render(timeNow) {
    gl.useProgram(prog);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uVirtRes, canvas.width * totalScreens, canvas.height);
    gl.uniform1f(uScreenOff, screenIndex * canvas.width);
    gl.uniform1f(uTime, timeNow * 0.001);
    gl.uniform1f(uShowBorder, showBezel);
    gl.uniform1i(uScreenIdx, screenIndex);
    gl.uniform1i(uTotScreens, totalScreens);
    gl.uniform2f(uCamAngles, cameraAzimuth, cameraElevation);
    gl.uniform1f(uCamDist, cameraDist);
    gl.uniform1f(uDoppler, dopplerEnabled);

    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ── BroadcastChannel Message Listener ───────────────────────────────────────
  bc.addEventListener("message", ({ data }) => {
    if (data.quit) {
      window.close();
      return;
    }
    if (data.cmd === "save") {
      saveCanvas();
      return;
    }
    if (data.cmd === "bezel") {
      showBezel = data.showBezel;
      if (hudBezel) hudBezel.textContent = showBezel > 0.5 ? "ON" : "OFF";
      return;
    }
    if (data.cmd === "doppler") {
      dopplerEnabled = data.dopplerEnabled;
      if (hudDoppler) hudDoppler.textContent = dopplerEnabled > 0.5 ? "ON" : "OFF";
      return;
    }
    if (data.cmd === "orbit") {
      orbitPaused = data.orbitPaused;
      if (hudOrbit) hudOrbit.textContent = orbitPaused ? "Paused" : "Slow Drift";
      return;
    }
    if (data.cmd === "tilt") {
      cameraElevation = data.cameraElevation;
      if (hudTilt) hudTilt.textContent = `${Math.round((cameraElevation * 180) / Math.PI)}°`;
      return;
    }
    if (data.cmd === "cam") {
      cameraAzimuth = data.cameraAzimuth;
      cameraElevation = data.cameraElevation;
      cameraDist = data.cameraDist;
      if (hudTilt) hudTilt.textContent = `${Math.round((cameraElevation * 180) / Math.PI)}°`;
      return;
    }

    // Synchronized frame step from primary
    if (!isPrimary && data.sync) {
      lastPrimaryMessageTime = performance.now();
      cameraAzimuth = data.azimuth;
      cameraElevation = data.elevation;
      cameraDist = data.dist;
      dopplerEnabled = data.doppler;
      render(data.time);
    }
  });

  // ── Main Animation Loop ─────────────────────────────────────────────────────
  function frame(now) {
    const dt = lastTime ? Math.min((now - lastTime) * 0.001, 0.033) : 0.016;
    lastTime = now;

    if (isPrimary) {
      // Slow continuous orbital drift around the black hole
      if (!orbitPaused) {
        cameraAzimuth += dt * 0.05;
      }
      render(now);

      bc.postMessage({
        sync: true,
        time: now,
        azimuth: cameraAzimuth,
        elevation: cameraElevation,
        dist: cameraDist,
        doppler: dopplerEnabled,
      });
    } else if (performance.now() - lastPrimaryMessageTime > 600) {
      // Standalone preview fallback if secondary opened without primary
      if (!orbitPaused) {
        cameraAzimuth += dt * 0.05;
      }
      render(now);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // ── User Interaction (Mouse Drag to Orbit & Wheel to Zoom) ───────────────────
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  canvas.addEventListener("pointerdown", (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  window.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    cameraAzimuth += dx * 0.005;
    cameraElevation = Math.max(-0.6, Math.min(0.8, cameraElevation - dy * 0.005));

    if (hudTilt) hudTilt.textContent = `${Math.round((cameraElevation * 180) / Math.PI)}°`;

    bc.postMessage({
      cmd: "cam",
      cameraAzimuth,
      cameraElevation,
      cameraDist,
    });
  });

  window.addEventListener("pointerup", () => {
    isDragging = false;
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    cameraDist = Math.max(8.0, Math.min(30.0, cameraDist + e.deltaY * 0.015));
    bc.postMessage({
      cmd: "cam",
      cameraAzimuth,
      cameraElevation,
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

  // ── Keyboard Controls ───────────────────────────────────────────────────────
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
      dopplerEnabled = dopplerEnabled > 0.5 ? 0.0 : 1.0;
      bc.postMessage({ cmd: "doppler", dopplerEnabled });
      return;
    }
    if (e.key === "t" || e.key === "T") {
      // Cycle inclination presets: 12 deg, 25 deg, 45 deg, 5 deg
      const tilts = [0.22, 0.44, 0.78, 0.08];
      const curIdx = tilts.findIndex((v) => Math.abs(v - cameraElevation) < 0.08);
      cameraElevation = tilts[(curIdx + 1) % tilts.length];
      bc.postMessage({ cmd: "tilt", cameraElevation });
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
