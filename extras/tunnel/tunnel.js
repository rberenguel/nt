// Infinite Neon Wireframe Tunnel Flythrough
// Synchronized dual-screen 32:9 low-poly crystalline flythrough

const params = new URLSearchParams(window.location.search);
const screenIndex = parseInt(params.get("screen") || "0", 10);
// Default to 1 if not specified, or 2 for dual-screen setups
const totalScreens = params.has("screens") ? parseInt(params.get("screens"), 10) : 2;
const isPrimary = screenIndex === 0;

document.title = `Tunnel ${screenIndex}`;

const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2", { alpha: false, antialias: true, depth: true });

if (!gl) {
  document.body.innerHTML = "<div style='color:white;padding:30px;font-family:sans-serif'>WebGL2 is required for this screensaver.</div>";
  throw new Error("WebGL2 not supported");
}

console.log(`[Tunnel] WebGL2 context ready: screenIndex=${screenIndex}, totalScreens=${totalScreens}`);

// ── Multi-screen BroadcastChannel ─────────────────────────────────────────────
const bc = new BroadcastChannel("tunnel");

function saveCanvas() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tunnel-screen${screenIndex}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

// ── Color Palettes ────────────────────────────────────────────────────────────
const PALETTES = [
  {
    name: "Monochrome Phosphor", // Exactly matches reference image
    coreColor: [1.0, 1.0, 1.0],
    glowColor: [0.90, 0.94, 1.0],
    nodeCore: [1.0, 1.0, 1.0],
    nodeGlow: [0.94, 0.97, 1.0],
    bg: [0.0, 0.0, 0.0],
    fogDensity: 0.024,
  },
  {
    name: "Cyber Synthwave",
    coreColor: [0.65, 1.0, 1.0],
    glowColor: [0.0, 0.82, 1.0],
    nodeCore: [1.0, 0.85, 0.98],
    nodeGlow: [1.0, 0.08, 0.65],
    bg: [0.005, 0.005, 0.015],
    fogDensity: 0.022,
  },
  {
    name: "Electric Emerald",
    coreColor: [0.85, 1.0, 0.88],
    glowColor: [0.05, 1.0, 0.40],
    nodeCore: [1.0, 1.0, 1.0],
    nodeGlow: [0.1, 0.9, 0.5],
    bg: [0.002, 0.012, 0.005],
    fogDensity: 0.023,
  },
  {
    name: "Solar Amber",
    coreColor: [1.0, 0.94, 0.78],
    glowColor: [1.0, 0.52, 0.05],
    nodeCore: [1.0, 1.0, 1.0],
    nodeGlow: [1.0, 0.75, 0.15],
    bg: [0.012, 0.006, 0.002],
    fogDensity: 0.025,
  },
  {
    name: "Ultraviolet Void",
    coreColor: [0.92, 0.85, 1.0],
    glowColor: [0.65, 0.18, 1.0],
    nodeCore: [1.0, 1.0, 1.0],
    nodeGlow: [0.85, 0.35, 1.0],
    bg: [0.008, 0.002, 0.014],
    fogDensity: 0.022,
  },
];

let paletteIdx = 0;
let flightSpeed = 16.0; // Units per second
let camZ = 0.0;
let paused = false;
let bankingEnabled = true;
let showBezel = 0.0;
let lookYaw = 0.0;
let lookPitch = 0.0;
let lastTimestamp = 0;

// ── Spline Path Math ──────────────────────────────────────────────────────────
function getSplinePos(z) {
  const x = 3.8 * Math.sin(z * 0.042) + 1.8 * Math.sin(z * 0.088);
  const y = 2.6 * Math.cos(z * 0.035) + 1.2 * Math.sin(z * 0.076);
  return [x, y, z];
}

function getSplineTangent(z) {
  const eps = 0.1;
  const p1 = getSplinePos(z - eps);
  const p2 = getSplinePos(z + eps);
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const dz = p2[2] - p1[2];
  const len = Math.hypot(dx, dy, dz);
  return [dx / len, dy / len, dz / len];
}

function getSplineCurvatureX(z) {
  return -(3.8 * 0.042 * 0.042 * Math.sin(z * 0.042) + 1.8 * 0.088 * 0.088 * Math.sin(z * 0.088));
}

// ── Procedural Tunnel Mesh Geometry ───────────────────────────────────────────
const NUM_RINGS = 72;
const NUM_SIDES = 8; // Octagonal faceted low-poly cross section
const RING_STEP = 1.65; // Distance between adjacent rings
const BASE_RADIUS = 4.2;

const MAX_STRUTS = NUM_RINGS * NUM_SIDES * 3;
const MAX_NODES = NUM_RINGS * NUM_SIDES;

// Instance Float32 buffers:
// Strut: [posA.x, posA.y, posA.z, posB.x, posB.y, posB.z, width, fade] = 8 floats per instance
const strutInstanceData = new Float32Array(MAX_STRUTS * 8);
// Node:  [pos.x, pos.y, pos.z, 0, 0, 0, radius, fade] = 8 floats per instance
const nodeInstanceData = new Float32Array(MAX_NODES * 8);

let activeStrutsCount = 0;
let activeNodesCount = 0;

// Vertex coordinates cache: [NUM_RINGS][NUM_SIDES][3]
const ringVertices = [];
for (let r = 0; r < NUM_RINGS; r++) {
  const sides = [];
  for (let s = 0; s < NUM_SIDES; s++) {
    sides.push([0, 0, 0]);
  }
  ringVertices.push(sides);
}

function updateTunnelGeometry(cameraZ) {
  const firstRingZ = Math.floor(cameraZ / RING_STEP) * RING_STEP;

  activeStrutsCount = 0;
  activeNodesCount = 0;

  // 1. Calculate vertex positions for each ring ahead of the camera
  for (let r = 0; r < NUM_RINGS; r++) {
    const rZ = firstRingZ + r * RING_STEP;
    const center = getSplinePos(rZ);
    const tangent = getSplineTangent(rZ);

    // Coordinate frame perpendicular to tangent
    const up0 = [0, 1, 0];
    let rx = tangent[1] * up0[2] - tangent[2] * up0[1];
    let ry = tangent[2] * up0[0] - tangent[0] * up0[2];
    let rz = tangent[0] * up0[1] - tangent[1] * up0[0];
    let rlen = Math.hypot(rx, ry, rz);
    if (rlen < 0.001) { rx = 1; ry = 0; rz = 0; rlen = 1; }
    rx /= rlen; ry /= rlen; rz /= rlen;

    const ux = ry * tangent[2] - rz * tangent[1];
    const uy = rz * tangent[0] - rx * tangent[2];
    const uz = rx * tangent[1] - ry * tangent[0];

    // Subtle twist along the tunnel
    const twist = rZ * 0.035;
    const distFromCam = rZ - cameraZ;

    let ringFade = 1.0;
    if (distFromCam < 3.0) ringFade = Math.max(0.0, (distFromCam - 1.0) / 2.0);
    else if (distFromCam > 85.0) ringFade = Math.max(0.0, (115.0 - distFromCam) / 30.0);

    // Wide 32:9 rectangular profile matching dual screens (width ~ 1.95x height)
    const baseWidth = BASE_RADIUS * 1.95;
    const baseHeight = BASE_RADIUS * 1.05;

    for (let s = 0; s < NUM_SIDES; s++) {
      const angle = (s / NUM_SIDES) * Math.PI * 2.0 + twist;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Squircle power q = 0.72 squares off the corners into a wide rectangular aperture
      const sqX = Math.sign(cosA) * Math.pow(Math.abs(cosA), 0.72);
      const sqY = Math.sign(sinA) * Math.pow(Math.abs(sinA), 0.72);

      const rNoise = 0.14 * Math.sin(s * 2.5 + rZ * 0.42) + 0.08 * Math.cos(s * 1.8 - rZ * 0.25);
      const posX = sqX * baseWidth * (1.0 + rNoise);
      const posY = sqY * baseHeight * (1.0 + rNoise);

      const vx = center[0] + rx * posX + ux * posY;
      const vy = center[1] + ry * posX + uy * posY;
      const vz = center[2] + rz * posX + uz * posY;

      ringVertices[r][s][0] = vx;
      ringVertices[r][s][1] = vy;
      ringVertices[r][s][2] = vz;

      // Add Node instance
      if (distFromCam > 1.2 && activeNodesCount < MAX_NODES) {
        const nodeIdx8 = activeNodesCount * 8;
        nodeInstanceData[nodeIdx8 + 0] = vx;
        nodeInstanceData[nodeIdx8 + 1] = vy;
        nodeInstanceData[nodeIdx8 + 2] = vz;
        nodeInstanceData[nodeIdx8 + 3] = 0;
        nodeInstanceData[nodeIdx8 + 4] = 0;
        nodeInstanceData[nodeIdx8 + 5] = 0;
        nodeInstanceData[nodeIdx8 + 6] = 0.22 + 0.05 * Math.sin(s * 3.1 + rZ * 0.6);
        nodeInstanceData[nodeIdx8 + 7] = ringFade;
        activeNodesCount++;
      }
    }
  }

  // 2. Generate Struts connecting ring vertices
  function addStrut(pA, pB, width, fade) {
    if (activeStrutsCount >= MAX_STRUTS) return;
    const idx8 = activeStrutsCount * 8;
    strutInstanceData[idx8 + 0] = pA[0];
    strutInstanceData[idx8 + 1] = pA[1];
    strutInstanceData[idx8 + 2] = pA[2];
    strutInstanceData[idx8 + 3] = pB[0];
    strutInstanceData[idx8 + 4] = pB[1];
    strutInstanceData[idx8 + 5] = pB[2];
    strutInstanceData[idx8 + 6] = width;
    strutInstanceData[idx8 + 7] = fade;
    activeStrutsCount++;
  }

  for (let r = 0; r < NUM_RINGS; r++) {
    const rZ = firstRingZ + r * RING_STEP;
    const distFromCam = rZ - cameraZ;
    if (distFromCam < 1.0) continue;

    let ringFade = 1.0;
    if (distFromCam < 3.0) ringFade = Math.max(0.0, (distFromCam - 1.0) / 2.0);
    else if (distFromCam > 85.0) ringFade = Math.max(0.0, (115.0 - distFromCam) / 30.0);

    // Ring perimeter edges
    for (let s = 0; s < NUM_SIDES; s++) {
      const sNext = (s + 1) % NUM_SIDES;
      addStrut(ringVertices[r][s], ringVertices[r][sNext], 0.065, ringFade);
    }

    // Longitudinal and diagonal edges to next ring
    if (r < NUM_RINGS - 1) {
      for (let s = 0; s < NUM_SIDES; s++) {
        const sNext = (s + 1) % NUM_SIDES;
        addStrut(ringVertices[r][s], ringVertices[r + 1][s], 0.065, ringFade);
        addStrut(ringVertices[r][s], ringVertices[r + 1][sNext], 0.055, ringFade);
      }
    }
  }
}

// ── Matrix Math Helpers (Column-Major) ─────────────────────────────────────────
function createMat4() {
  return new Float32Array([
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
    0,0,0,1
  ]);
}

function lookAtMatrix(out, eye, target, up) {
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz);
  if (len < 0.0001) { zx = 0; zy = 0; zz = 1; len = 1; }
  zx /= len; zy /= len; zz /= len;

  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz);
  if (len < 0.0001) { xx = 1; xy = 0; xz = 0; len = 1; }
  xx /= len; xy /= len; xz /= len;

  let yx = zy * xz - zz * xy;
  let yy = zz * xx - zx * xz;
  let yz = zx * xy - zy * xx;

  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

function frustumMatrix(out, left, right, bottom, top, near, far) {
  const rl = 1 / (right - left);
  const tb = 1 / (top - bottom);
  const fn = 1 / (far - near);

  out[0] = (2 * near) * rl;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  out[4] = 0;
  out[5] = (2 * near) * tb;
  out[6] = 0;
  out[7] = 0;

  out[8] = (right + left) * rl;
  out[9] = (top + bottom) * tb;
  out[10] = -(far + near) * fn;
  out[11] = -1;

  out[12] = 0;
  out[13] = 0;
  out[14] = -(2 * far * near) * fn;
  out[15] = 0;
  return out;
}

// ── Resize ────────────────────────────────────────────────────────────────────
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener("resize", resize);
resize();

// ── Shader Initialization & Direct Rendering ──────────────────────────────────
async function init() {
  const [vertSrc, fragSrc] = await Promise.all([
    fetch("tunnel.vert").then((r) => r.text()),
    fetch("tunnel.frag").then((r) => r.text()),
  ]);

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(s);
      console.error("[Tunnel] Shader compile error:", err);
      throw new Error(err);
    }
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const err = gl.getProgramInfoLog(prog);
    console.error("[Tunnel] Program link error:", err);
    throw new Error(err);
  }
  gl.useProgram(prog);

  // Symmetric unit billboard quad [-1, 1] x [-1, 1]
  const quadVerts = new Float32Array([
    -1.0, -1.0,
     1.0, -1.0,
    -1.0,  1.0,
     1.0,  1.0,
  ]);
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

  // Instanced attribute buffer
  const instanceVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceVBO);
  gl.bufferData(gl.ARRAY_BUFFER, Math.max(strutInstanceData.byteLength, nodeInstanceData.byteLength), gl.DYNAMIC_DRAW);

  // VAO for Struts & Nodes
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // a_corner (attrib 0): vec2 from quadBuf
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // Instance attributes from instanceVBO:
  // a_posA (attrib 1): vec3 (offset 0)
  // a_posB (attrib 2): vec3 (offset 12)
  // a_params (attrib 3): vec2 (offset 24)
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceVBO);
  const stride = 8 * 4;

  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 0);
  gl.vertexAttribDivisor(1, 1);

  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 12);
  gl.vertexAttribDivisor(2, 1);

  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 24);
  gl.vertexAttribDivisor(3, 1);

  gl.bindVertexArray(null);

  // Uniform locations
  const uView = gl.getUniformLocation(prog, "u_view");
  const uProj = gl.getUniformLocation(prog, "u_proj");
  const uMode = gl.getUniformLocation(prog, "u_mode");
  const uCoreColor = gl.getUniformLocation(prog, "u_coreColor");
  const uGlowColor = gl.getUniformLocation(prog, "u_glowColor");
  const uNodeCore = gl.getUniformLocation(prog, "u_nodeCore");
  const uNodeGlow = gl.getUniformLocation(prog, "u_nodeGlow");
  const uFogDensity = gl.getUniformLocation(prog, "u_fogDensity");
  const uTime = gl.getUniformLocation(prog, "u_time");

  const viewMat = createMat4();
  const projMat = createMat4();

  console.log("[Tunnel] Program ready. Starting render loop.");

  // ── Render Frame Directly to Canvas ─────────────────────────────────────────
  function render(simTime) {
    const pal = PALETTES[paletteIdx];

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.clearColor(pal.bg[0], pal.bg[1], pal.bg[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Compute Camera Position on Spline
    const camPos = getSplinePos(camZ);
    const lookTarget = getSplinePos(camZ + 7.5);

    // Apply interactive look yaw/pitch
    lookTarget[0] += Math.sin(lookYaw) * 6.0;
    lookTarget[1] += Math.sin(lookPitch) * 6.0;

    // Banking roll into curves
    let rollAngle = 0.0;
    if (bankingEnabled) {
      const curveX = getSplineCurvatureX(camZ + 3.0);
      rollAngle = Math.max(-0.48, Math.min(0.48, -curveX * 24.0));
    }

    const tangent = getSplineTangent(camZ);
    const baseUp = [0, 1, 0];
    let rx = tangent[1] * baseUp[2] - tangent[2] * baseUp[1];
    let ry = tangent[2] * baseUp[0] - tangent[0] * baseUp[2];
    let rz = tangent[0] * baseUp[1] - tangent[1] * baseUp[0];
    let rlen = Math.hypot(rx, ry, rz);
    if (rlen < 0.001) { rx = 1; ry = 0; rz = 0; rlen = 1; }
    rx /= rlen; ry /= rlen; rz /= rlen;

    const ux0 = ry * tangent[2] - rz * tangent[1];
    const uy0 = rz * tangent[0] - rx * tangent[2];
    const uz0 = rx * tangent[1] - ry * tangent[0];

    const cosRoll = Math.cos(rollAngle);
    const sinRoll = Math.sin(rollAngle);
    const camUp = [
      ux0 * cosRoll - rx * sinRoll,
      uy0 * cosRoll - ry * sinRoll,
      uz0 * cosRoll - rz * sinRoll,
    ];

    lookAtMatrix(viewMat, camPos, lookTarget, camUp);

    // ── Frustum Projection (Dual 32:9 or Single Screen) ────────────────────────
    const near = 0.4;
    const far = 140.0;
    const vFov = 1.309; // 75 deg vFOV
    const top = near * Math.tan(vFov * 0.5);
    const bottom = -top;

    let left = 0;
    let right = 0;

    if (totalScreens >= 2) {
      const totalAspect = (canvas.width / canvas.height) * totalScreens;
      const totalWidth = top * totalAspect;
      const sliceW = (2.0 * totalWidth) / totalScreens;
      left = -totalWidth + screenIndex * sliceW;
      right = left + sliceW;
    } else {
      const aspect = canvas.width / canvas.height;
      left = -top * aspect;
      right = top * aspect;
    }

    frustumMatrix(projMat, left, right, bottom, top, near, far);

    gl.useProgram(prog);
    gl.uniformMatrix4fv(uView, false, viewMat);
    gl.uniformMatrix4fv(uProj, false, projMat);
    gl.uniform3fv(uCoreColor, pal.coreColor);
    gl.uniform3fv(uGlowColor, pal.glowColor);
    gl.uniform3fv(uNodeCore, pal.nodeCore);
    gl.uniform3fv(uNodeGlow, pal.nodeGlow);
    gl.uniform1f(uFogDensity, pal.fogDensity);
    gl.uniform1f(uTime, simTime);

    // Depth test enabled with depth mask disabled for radiant additive bloom
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive luminous neon

    gl.bindVertexArray(vao);

    // Draw Struts (Mode 0)
    if (activeStrutsCount > 0) {
      gl.uniform1i(uMode, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceVBO);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, strutInstanceData.subarray(0, activeStrutsCount * 8));
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, activeStrutsCount);
    }

    // Draw Nodes (Mode 1)
    if (activeNodesCount > 0) {
      gl.uniform1i(uMode, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceVBO);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, nodeInstanceData.subarray(0, activeNodesCount * 8));
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, activeNodesCount);
    }

    gl.bindVertexArray(null);
    gl.depthMask(true);
  }

  let frameCount = 0;

  // ── Animation Loop ──────────────────────────────────────────────────────────
  function loop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min((timestamp - lastTimestamp) * 0.001, 0.05);
    lastTimestamp = timestamp;

    if (!paused) {
      camZ += flightSpeed * dt;
    }

    updateTunnelGeometry(camZ);

    if (frameCount === 1) {
      console.log(`[Tunnel] Frame 1 rendered. Struts: ${activeStrutsCount}, Nodes: ${activeNodesCount}, camZ: ${camZ.toFixed(2)}`);
    }
    frameCount++;

    // Sync via BroadcastChannel
    if (isPrimary && Math.floor(camZ * 6) !== Math.floor((camZ - flightSpeed * dt) * 6)) {
      bc.postMessage({
        cmd: "heartbeat",
        camZ,
        flightSpeed,
        paletteIdx,
        paused,
        bankingEnabled,
        showBezel,
        lookYaw,
        lookPitch,
      });
    }

    render(camZ * 0.1);
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
      if (Math.abs(camZ - data.camZ) > 0.4) {
        camZ = data.camZ;
      }
      flightSpeed = data.flightSpeed;
      paletteIdx = data.paletteIdx;
      paused = data.paused;
      bankingEnabled = data.bankingEnabled;
      showBezel = data.showBezel;
      lookYaw = data.lookYaw;
      lookPitch = data.lookPitch;
      return;
    }
    if (data.cmd === "palette") {
      paletteIdx = data.paletteIdx;
      return;
    }
    if (data.cmd === "speed") {
      flightSpeed = data.flightSpeed;
      return;
    }
    if (data.cmd === "pause") {
      paused = data.paused;
      return;
    }
    if (data.cmd === "bank") {
      bankingEnabled = data.bankingEnabled;
      return;
    }
    if (data.cmd === "bezel") {
      showBezel = data.showBezel;
      return;
    }
    if (data.cmd === "look") {
      lookYaw = data.lookYaw;
      lookPitch = data.lookPitch;
      return;
    }
  };

  // ── Interactive Look Drag Controls ──────────────────────────────────────────
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

    lookYaw += dx * 0.004;
    lookPitch = Math.max(-0.6, Math.min(0.6, lookPitch - dy * 0.003));

    bc.postMessage({
      cmd: "look",
      lookYaw,
      lookPitch,
    });
  });

  window.addEventListener("pointerup", () => {
    isDragging = false;
  });

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
      paused = !paused;
      bc.postMessage({ cmd: "pause", paused });
      return;
    }
    if (e.key === "ArrowUp") {
      flightSpeed = Math.min(50.0, flightSpeed + 4.0);
      bc.postMessage({ cmd: "speed", flightSpeed });
      return;
    }
    if (e.key === "ArrowDown") {
      flightSpeed = Math.max(4.0, flightSpeed - 4.0);
      bc.postMessage({ cmd: "speed", flightSpeed });
      return;
    }
    if (e.key === "c" || e.key === "C") {
      paletteIdx = (paletteIdx + 1) % PALETTES.length;
      bc.postMessage({ cmd: "palette", paletteIdx });
      return;
    }
    if (e.key === "r" || e.key === "R") {
      bankingEnabled = !bankingEnabled;
      bc.postMessage({ cmd: "bank", bankingEnabled });
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
