// Soap Bubble Thin-Film Surface Screensaver
// Dual-screen 32:9 ultra-wide architecture with BroadcastChannel synchronization

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = parseInt(params.get("screens") || "2", 10);
const isPrimary = screenIndex === 0;

document.title = `Thin Film ${screenIndex}`;

const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

if (!gl) {
  document.body.innerHTML = "<div style='color:white;padding:30px;font-family:sans-serif'>WebGL is required for this screensaver.</div>";
  throw new Error("WebGL not supported");
}

// HUD Elements
const hud = document.getElementById("hud");
const hudScreen = document.getElementById("hudScreen");
const hudMaster = document.getElementById("hudMaster");
const hudSpeed = document.getElementById("hudSpeed");
const hudStyle = document.getElementById("hudStyle");
const hudBezel = document.getElementById("hudBezel");

if (hudScreen) hudScreen.textContent = `${screenIndex + 1} / ${totalScreens}`;
if (hudMaster) hudMaster.textContent = isPrimary ? "YES" : "NO (Client)";
if (!isPrimary && hud) hud.classList.add("hidden");

function resize() {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
}
window.addEventListener("resize", resize);
resize();

// ── Multi-screen BroadcastChannel ─────────────────────────────────────────────
const bc = new BroadcastChannel("thinfilm");

function saveCanvas() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thinfilm-screen${screenIndex}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

// ── State Variables ───────────────────────────────────────────────────────────
let flowSpeed = 1.0;
let marblingStyle = 0.0;
let showBezel = 0.0;
let lastTime = 0;
let simTime = 0.0;
let lastPrimaryMessageTime = 0;

const STYLE_NAMES = ["Natural Newton", "Vivid Spectral", "Opal Dream"];

const MAX_DISTURBANCES = 8;
const disturbances = []; // { x, y, radius, strength, age, maxAge }

function addDisturbance(globalX, globalY, strength = 1.3, radius = 0.18) {
  if (disturbances.length >= MAX_DISTURBANCES) {
    disturbances.shift();
  }
  disturbances.push({
    x: globalX,
    y: globalY,
    radius: radius,
    strength: strength,
    age: 0.0,
    maxAge: 2.5,
  });
}

// ── Shader Setup ──────────────────────────────────────────────────────────────
async function init() {
  const [vertSrc, renderFragSrc] = await Promise.all([
    fetch("thinfilm.vert").then((r) => r.text()),
    fetch("thinfilm.frag").then((r) => r.text()),
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

  function createProgram(vSrc, fSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vSrc));
    gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(p));
    }
    return p;
  }

  const renderProg = createProgram(vertSrc, renderFragSrc);

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

  // Uniform locations - Render Program
  const uRenderRes = gl.getUniformLocation(renderProg, "u_resolution");
  const uRenderVirtRes = gl.getUniformLocation(renderProg, "u_virtual_resolution");
  const uRenderScreenOff = gl.getUniformLocation(renderProg, "u_screen_offset");
  const uRenderTime = gl.getUniformLocation(renderProg, "u_time");
  const uRenderShowBorder = gl.getUniformLocation(renderProg, "u_show_border");
  const uRenderScreenIdx = gl.getUniformLocation(renderProg, "u_screen_index");
  const uRenderTotScreens = gl.getUniformLocation(renderProg, "u_total_screens");
  const uRenderNumDist = gl.getUniformLocation(renderProg, "u_num_disturbances");
  const uRenderDist = gl.getUniformLocation(renderProg, "u_disturbances[0]");
  const uRenderFlowSpeed = gl.getUniformLocation(renderProg, "u_flow_speed");
  const uRenderMarblingStyle = gl.getUniformLocation(renderProg, "u_marbling_style");

  // ── Render Screen Pass ──────────────────────────────────────────────────────
  function renderScreenPass(now) {
    gl.useProgram(renderProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.uniform2f(uRenderRes, canvas.width, canvas.height);
    gl.uniform2f(uRenderVirtRes, canvas.width * totalScreens, canvas.height);
    gl.uniform1f(uRenderScreenOff, screenIndex * canvas.width);
    gl.uniform1f(uRenderTime, now * 0.001);
    gl.uniform1f(uRenderShowBorder, showBezel);
    gl.uniform1i(uRenderScreenIdx, screenIndex);
    gl.uniform1i(uRenderTotScreens, totalScreens);

    // Pack active disturbances
    const distArray = new Float32Array(MAX_DISTURBANCES * 4);
    for (let i = 0; i < disturbances.length; i++) {
      const d = disturbances[i];
      const life = 1.0 - d.age / d.maxAge;
      distArray[i * 4 + 0] = d.x;
      distArray[i * 4 + 1] = d.y;
      distArray[i * 4 + 2] = d.radius;
      distArray[i * 4 + 3] = d.strength * life;
    }
    gl.uniform1i(uRenderNumDist, disturbances.length);
    gl.uniform4fv(uRenderDist, distArray);
    gl.uniform1f(uRenderFlowSpeed, flowSpeed);
    gl.uniform1f(uRenderMarblingStyle, marblingStyle);

    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ── Spontaneous Organic Marbling Swirls (Master authoring) ───────────────────
  let nextAutoSwirlTime = 0.5;
  function updateAutoSwirls(nowSec) {
    if (nowSec >= nextAutoSwirlTime) {
      const gx = Math.random();
      const gy = 0.15 + Math.random() * 0.7;
      const str = (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.9);
      const rad = 0.16 + Math.random() * 0.12;
      addDisturbance(gx, gy, str, rad);
      nextAutoSwirlTime = nowSec + 2.0 + Math.random() * 3.0;

      bc.postMessage({
        cmd: "disturbance",
        x: gx,
        y: gy,
        str: str,
        radius: rad,
      });
    }
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
    if (data.cmd === "speed") {
      flowSpeed = data.flowSpeed;
      if (hudSpeed) hudSpeed.textContent = `${flowSpeed.toFixed(1)}x`;
      return;
    }
    if (data.cmd === "style") {
      marblingStyle = data.marblingStyle;
      if (hudStyle) hudStyle.textContent = STYLE_NAMES[Math.round(marblingStyle)] || "Pearlescent";
      return;
    }
    if (data.cmd === "clear") {
      disturbances.length = 0;
      return;
    }
    if (data.cmd === "disturbance") {
      addDisturbance(data.x, data.y, data.str, data.radius);
      return;
    }

    // Synchronized simulation frame step from primary
    if (!isPrimary && data.sync) {
      lastPrimaryMessageTime = performance.now();
      const dt = data.dt;
      simTime = data.time;
      // Age disturbances
      for (let i = disturbances.length - 1; i >= 0; i--) {
        disturbances[i].age += dt;
        if (disturbances[i].age >= disturbances[i].maxAge) {
          disturbances.splice(i, 1);
        }
      }
      renderScreenPass(data.time);
    }
  });

  // ── Animation Loop ──────────────────────────────────────────────────────────
  function frame(now) {
    const dt = lastTime ? Math.min((now - lastTime) * 0.001, 0.033) : 0.016;
    lastTime = now;
    simTime = now;

    if (isPrimary) {
      // Age disturbances
      for (let i = disturbances.length - 1; i >= 0; i--) {
        disturbances[i].age += dt;
        if (disturbances[i].age >= disturbances[i].maxAge) {
          disturbances.splice(i, 1);
        }
      }
      updateAutoSwirls(now * 0.001);
      renderScreenPass(now);

      bc.postMessage({
        sync: true,
        time: now,
        dt: dt,
      });
    } else if (performance.now() - lastPrimaryMessageTime > 600) {
      // Standalone preview fallback when secondary screen is viewed without primary
      for (let i = disturbances.length - 1; i >= 0; i--) {
        disturbances[i].age += dt;
        if (disturbances[i].age >= disturbances[i].maxAge) {
          disturbances.splice(i, 1);
        }
      }
      renderScreenPass(now);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // ── User Interaction & Controls ─────────────────────────────────────────────
  let isPointerDown = false;

  function handlePointer(e) {
    const rect = canvas.getBoundingClientRect();
    const localX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const localY = (e.clientY - rect.top) * (canvas.height / rect.height);
    // Convert to unified 32:9 global coordinates
    const globalX = (localX + screenIndex * canvas.width) / (canvas.width * totalScreens);
    const globalY = 1.0 - localY / canvas.height;

    const str = (Math.random() > 0.5 ? 1 : -1) * 1.6;
    addDisturbance(globalX, globalY, str, 0.20);
    bc.postMessage({ cmd: "disturbance", x: globalX, y: globalY, str: str, radius: 0.20 });
  }

  canvas.addEventListener("pointerdown", (e) => {
    isPointerDown = true;
    handlePointer(e);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (isPointerDown) {
      handlePointer(e);
    }
  });

  window.addEventListener("pointerup", () => {
    isPointerDown = false;
  });

  document.addEventListener("click", () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
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
    if (e.code === "Space") {
      // Stir center of current display
      const globalX = (0.5 + screenIndex) / totalScreens;
      const globalY = 0.5;
      const str = (Math.random() > 0.5 ? 1 : -1) * 2.0;
      addDisturbance(globalX, globalY, str, 0.24);
      bc.postMessage({ cmd: "disturbance", x: globalX, y: globalY, str: str, radius: 0.24 });
      return;
    }
    if (e.key === "r" || e.key === "R") {
      disturbances.length = 0;
      bc.postMessage({ cmd: "clear" });
      return;
    }
    if (e.key === "b" || e.key === "B") {
      showBezel = showBezel > 0.5 ? 0.0 : 1.0;
      if (hudBezel) hudBezel.textContent = showBezel > 0.5 ? "ON" : "OFF";
      bc.postMessage({ cmd: "bezel", showBezel: showBezel });
      return;
    }
    if (e.key === "d" || e.key === "D") {
      const speeds = [1.0, 1.5, 2.0, 0.4, 0.7];
      const curIdx = speeds.indexOf(flowSpeed);
      flowSpeed = speeds[(curIdx + 1) % speeds.length];
      if (hudSpeed) hudSpeed.textContent = `${flowSpeed.toFixed(1)}x`;
      bc.postMessage({ cmd: "speed", flowSpeed: flowSpeed });
      return;
    }
    if (e.key === "m" || e.key === "M") {
      marblingStyle = (marblingStyle + 1.0) % 3.0;
      if (hudStyle) hudStyle.textContent = STYLE_NAMES[Math.round(marblingStyle)] || "Pearlescent";
      bc.postMessage({ cmd: "style", marblingStyle: marblingStyle });
      return;
    }
    if (e.key === "h" || e.key === "H") {
      if (hud) hud.classList.toggle("hidden");
      return;
    }
  });
}

init().catch(console.error);
