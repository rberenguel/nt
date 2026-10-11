'use strict';

// Mirrors the constants in arabesque.js exactly so timing matches the live view.
const PALETTES = [
  { name: "Gold",      warmLow: [0.08,0.03,0.01], warmHigh: [0.98,0.65,0.15], warmAccent: [0.78,0.38,0.08], coolLow: [0.01,0.16,0.28], coolHigh: [0.25,0.88,1.00] },
  { name: "Lapis",     warmLow: [0.12,0.08,0.01], warmHigh: [0.95,0.78,0.12], warmAccent: [0.75,0.50,0.03], coolLow: [0.01,0.02,0.12], coolHigh: [0.15,0.40,0.95] },
  { name: "Jade",      warmLow: [0.05,0.08,0.02], warmHigh: [0.85,0.72,0.15], warmAccent: [0.55,0.45,0.05], coolLow: [0.01,0.12,0.05], coolHigh: [0.18,0.82,0.42] },
  { name: "Amethyst",  warmLow: [0.06,0.02,0.10], warmHigh: [0.88,0.84,0.95], warmAccent: [0.68,0.55,0.80], coolLow: [0.08,0.02,0.18], coolHigh: [0.72,0.38,0.98] },
  { name: "Copper",    warmLow: [0.12,0.04,0.01], warmHigh: [0.90,0.48,0.14], warmAccent: [0.68,0.28,0.08], coolLow: [0.01,0.09,0.07], coolHigh: [0.22,0.78,0.58] },
  { name: "Moonlight", warmLow: [0.02,0.02,0.06], warmHigh: [0.80,0.86,0.98], warmAccent: [0.48,0.55,0.72], coolLow: [0.01,0.01,0.10], coolHigh: [0.88,0.93,1.00] },
  { name: "Sepia",     warmLow: [0.10,0.06,0.02], warmHigh: [0.92,0.80,0.58], warmAccent: [0.78,0.58,0.32], coolLow: [0.08,0.05,0.02], coolHigh: [0.96,0.88,0.72] },
];

const PALETTE_HOLD   = 30;   // seconds at full blend
const PALETTE_FADE   = 15;   // seconds to cross-fade
const PALETTE_SPEED  = 0.3;  // paletteTime advance rate (matches arabesque.js default)
const MAX_DROPS      = 8;
const DROP_MAX_AGE   = 5.0;  // seconds — matches arabesque.js:263

const canvas   = document.getElementById("glcanvas");
const gl       = canvas.getContext("webgl2") || canvas.getContext("webgl");
const statusEl = document.getElementById("status");
const fillEl   = document.getElementById("progressFill");
const startBtn = document.getElementById("startBtn");

let uVirtualRes, uScreenOff, uTime, uPalTime, uBorders;
let uWarmLow, uWarmHigh, uWarmAccent, uCoolLow, uCoolHigh, uRippleOn, uDrops;

// Deterministic PRNG so the same seed yields the same drop sequence every capture.
class LCG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return this.s / 4294967296;
  }
}

function makeEmptyDrops() {
  const d = new Float32Array(MAX_DROPS * 3);
  for (let i = 0; i < MAX_DROPS; i++) d[i * 3 + 2] = -1;
  return d;
}

function lerp3(a, b, t) {
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}

function uploadPalette(fIdx, tIdx, bln) {
  const f = PALETTES[fIdx], t = PALETTES[tIdx];
  gl.uniform3fv(uWarmLow,    lerp3(f.warmLow,    t.warmLow,    bln));
  gl.uniform3fv(uWarmHigh,   lerp3(f.warmHigh,   t.warmHigh,   bln));
  gl.uniform3fv(uWarmAccent, lerp3(f.warmAccent, t.warmAccent, bln));
  gl.uniform3fv(uCoolLow,    lerp3(f.coolLow,    t.coolLow,    bln));
  gl.uniform3fv(uCoolHigh,   lerp3(f.coolHigh,   t.coolHigh,   bln));
}

function drawFrame(virtualMs, paletteTime, fIdx, tIdx, bln, drops, rippleOn, showBorders) {
  uploadPalette(fIdx, tIdx, bln);
  gl.uniform2f(uVirtualRes, canvas.width, canvas.height);
  gl.uniform1f(uScreenOff, 0.0);
  gl.uniform1f(uTime,      virtualMs * 0.001);
  gl.uniform1f(uPalTime,   paletteTime);
  gl.uniform1f(uBorders,   showBorders);
  gl.uniform1f(uRippleOn,  rippleOn);
  gl.uniform3fv(uDrops,    drops);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function setResolution(w, h) {
  canvas.width  = w;
  canvas.height = h;
  canvas.style.aspectRatio = `${w} / ${h}`;
  gl.viewport(0, 0, w, h);
}

async function init() {
  const [vertSrc, fragSrc] = await Promise.all([
    fetch("arabesque.vert").then(r => r.text()),
    fetch("arabesque.frag").then(r => r.text()),
  ]);

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error("Shader compile error:", gl.getShaderInfoLog(s));
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER,   vertSrc));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    console.error("Program link error:", gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(prog, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  uVirtualRes  = gl.getUniformLocation(prog, "u_virtual_resolution");
  uScreenOff   = gl.getUniformLocation(prog, "u_screen_offset");
  uTime        = gl.getUniformLocation(prog, "u_time");
  uPalTime     = gl.getUniformLocation(prog, "u_palette_time");
  uBorders     = gl.getUniformLocation(prog, "u_show_borders");
  uWarmLow     = gl.getUniformLocation(prog, "u_warm_low");
  uWarmHigh    = gl.getUniformLocation(prog, "u_warm_high");
  uWarmAccent  = gl.getUniformLocation(prog, "u_warm_accent");
  uCoolLow     = gl.getUniformLocation(prog, "u_cool_low");
  uCoolHigh    = gl.getUniformLocation(prog, "u_cool_high");
  uRippleOn    = gl.getUniformLocation(prog, "u_ripple_on");
  uDrops       = gl.getUniformLocation(prog, "u_drops[0]");

  const palSel      = document.getElementById("paletteSelect");
  const rippleOnEl  = document.getElementById("rippleOn");
  const seedField   = document.getElementById("seedField");
  const bordersEl   = document.getElementById("showBorders");

  PALETTES.forEach((p, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = p.name;
    palSel.appendChild(opt);
  });

  function updatePreview() {
    const [w, h] = document.getElementById("resSelect").value.split("x").map(Number);
    const p = parseInt(palSel.value);
    setResolution(w, h);
    drawFrame(0, 0, p, p, 1.0, makeEmptyDrops(), 0.0, bordersEl.checked ? 1.0 : 0.0);
  }

  rippleOnEl.addEventListener("change", () => {
    seedField.style.display = rippleOnEl.checked ? "" : "none";
  });
  document.getElementById("resSelect").addEventListener("change", updatePreview);
  palSel.addEventListener("change", updatePreview);
  bordersEl.addEventListener("change", updatePreview);

  startBtn.addEventListener("click", startCapture);
  wireCopy("ffmpegCopy",  "ffmpegCmd");
  wireCopy("installCopy", "installCmd");

  // Initial preview
  updatePreview();
}

async function startCapture() {
  const fps         = parseInt(document.getElementById("fpsSelect").value);
  const durationIn  = Math.max(5, parseFloat(document.getElementById("duration").value));
  const startPal    = parseInt(document.getElementById("paletteSelect").value);
  const [w, h]      = document.getElementById("resSelect").value.split("x").map(Number);
  const rippleOn    = document.getElementById("rippleOn").checked ? 1.0 : 0.0;
  const seed        = parseInt(document.getElementById("seed").value) || 1;
  const showBorders = document.getElementById("showBorders").checked ? 1.0 : 0.0;
  const crf         = Math.max(10, Math.min(35, parseInt(document.getElementById("crf").value) || 22));

  // Even frame count so ping-pong mirror lands exactly on frame boundaries.
  let totalFrames = Math.round(fps * durationIn);
  if (totalFrames % 2 === 1) totalFrames++;
  const halfFrames = totalFrames / 2;
  const dt         = 1 / fps;

  setResolution(w, h);
  startBtn.disabled    = true;
  startBtn.textContent = "Pre-simulating…";
  document.getElementById("ffmpegSection").style.display = "none";
  fillEl.style.width   = "0%";
  statusEl.textContent = "Pre-simulating…";

  // ── Phase 1a: forward-simulate shader state (u_time, palette) for the first
  // half only; the second half mirrors it. shaderStates[halfFrames] = midpoint.
  const shaderStates = new Array(halfFrames + 1);
  let virtualMs      = 0;
  let paletteTime    = 0;
  let fIdx           = startPal;
  let tIdx           = startPal;
  let bln            = 1.0;
  let palTick        = 0;

  for (let i = 0; i <= halfFrames; i++) {
    shaderStates[i] = { virtualMs, paletteTime, fIdx, tIdx, bln };
    if (i === halfFrames) break;
    palTick     += dt;
    paletteTime += dt * PALETTE_SPEED;
    if (palTick >= PALETTE_HOLD + PALETTE_FADE) {
      fIdx    = tIdx;
      tIdx    = (tIdx + 1) % PALETTES.length;
      palTick -= PALETTE_HOLD + PALETTE_FADE;
    }
    bln = palTick <= PALETTE_FADE ? palTick / PALETTE_FADE : 1.0;
    virtualMs += 1000 * dt;
  }

  // ── Phase 1b: forward-simulate drops across the full video.
  // Ripple age in the shader is independent of u_time, so drops don't need
  // to ping-pong — running them forward the whole way lets each ripple fade
  // naturally via exp(-age*1.5). Stop spawning DROP_MAX_AGE before the end
  // so all live ripples die before the video loops back to frame 0.
  const dropTimeline    = new Array(totalFrames);
  const dropData        = makeEmptyDrops();
  const lcg             = new LCG(seed);
  const minDim          = Math.min(w, h);
  const halfWx          = w * 0.5 / minDim * 14.0;
  const halfWy          = h * 0.5 / minDim * 14.0;
  const dropSpawnCutoff = totalFrames * dt - DROP_MAX_AGE;
  let nextDropTime      = 0;
  let dropTimeMs        = 0;

  for (let i = 0; i < totalFrames; i++) {
    dropTimeline[i] = new Float32Array(dropData);
    if (i === totalFrames - 1) break;

    for (let d = 0; d < MAX_DROPS; d++) {
      if (dropData[d * 3 + 2] >= 0) {
        dropData[d * 3 + 2] += dt;
        if (dropData[d * 3 + 2] > DROP_MAX_AGE) dropData[d * 3 + 2] = -1;
      }
    }

    const nowSec = dropTimeMs / 1000;
    if (rippleOn === 1.0 && nowSec >= nextDropTime && nowSec < dropSpawnCutoff) {
      const x = (lcg.next() * 2 - 1) * halfWx;
      const y = (lcg.next() * 2 - 1) * halfWy;
      for (let d = 0; d < MAX_DROPS; d++) {
        if (dropData[d * 3 + 2] < 0) {
          dropData[d * 3 + 0] = x;
          dropData[d * 3 + 1] = y;
          dropData[d * 3 + 2] = 0;
          break;
        }
      }
      nextDropTime = nowSec + 0.4 + lcg.next() * 1.2;
    }

    dropTimeMs += 1000 * dt;

    if ((i & 127) === 0) {
      statusEl.textContent = `Pre-simulating… ${i} / ${totalFrames}`;
      fillEl.style.width   = (i / totalFrames * 10).toFixed(1) + "%";
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // ── Phase 2: record frames by replaying stored states (forward then mirrored).
  startBtn.textContent = "Recording…";
  statusEl.textContent = "Recording…";

  const stream = canvas.captureStream(0);
  const track  = stream.getVideoTracks()[0];

  // Prefer H.264 — Chrome's H.264 encoder (hw-accelerated on most Macs) is
  // sharper on high-frequency content than its real-time libvpx VP9. Fall
  // back through VP9 and raw webm.
  const codecCandidates = [
    { mime: "video/mp4;codecs=avc1.640028",      ext: "mp4"  },
    { mime: "video/mp4;codecs=avc1",             ext: "mp4"  },
    { mime: 'video/webm;codecs="avc1.640028"',   ext: "webm" },
    { mime: "video/webm;codecs=h264",            ext: "webm" },
    { mime: "video/webm;codecs=vp9",             ext: "webm" },
    { mime: "video/webm",                        ext: "webm" },
  ];
  const picked = codecCandidates.find(c => MediaRecorder.isTypeSupported(c.mime))
                 || codecCandidates[codecCandidates.length - 1];
  console.log("MediaRecorder using:", picked.mime);

  const recorder = new MediaRecorder(stream, {
    mimeType: picked.mime,
    videoBitsPerSecond: w >= 3840 ? 120_000_000 : 50_000_000,
  });

  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    const blob     = new Blob(chunks, { type: picked.mime });
    const url      = URL.createObjectURL(blob);
    const filename = `arabesque-${PALETTES[startPal].name.toLowerCase()}-${w}x${h}-${fps}fps.${picked.ext}`;
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    fillEl.style.width   = "100%";
    statusEl.textContent = `Saved: ${filename} (${picked.mime})`;
    showFfmpeg(fps, filename, crf);
    startBtn.disabled    = false;
    startBtn.textContent = "Start Recording";
  };

  recorder.start(5000);

  const frameIntervalMs = 1000 / fps;
  let frame = 0;

  function tick() {
    if (frame >= totalFrames) { recorder.stop(); return; }

    // Shader state ping-pongs; drops always run forward (own age clock).
    const idx = frame <= halfFrames ? frame : (2 * halfFrames - frame);
    const s   = shaderStates[idx];
    drawFrame(s.virtualMs, s.paletteTime, s.fIdx, s.tIdx, s.bln,
              dropTimeline[frame], rippleOn, showBorders);
    track.requestFrame();

    frame++;

    if (frame % fps === 0) {
      const secs = Math.floor(frame / fps);
      statusEl.textContent = `Capturing… ${secs} / ${totalFrames / fps} s`;
      fillEl.style.width   = (frame / totalFrames * 100).toFixed(1) + "%";
    }

    // Pace to real-time fps so webm playback (and u_time cadence) is 1x.
    setTimeout(tick, frameIntervalMs);
  }

  setTimeout(tick, frameIntervalMs);
}

function showFfmpeg(fps, srcName, crf) {
  const movName = srcName.replace(/\.(webm|mp4)$/, ".mov");
  document.getElementById("ffmpegCmd").textContent =
    `ffmpeg -r ${fps} -i '${srcName}' \\\n`
    + `  -c:v libx265 -tag:v hvc1 \\\n`
    + `  -pix_fmt yuv420p -crf ${crf} -an \\\n`
    + `  '${movName}'`;

  const aerials = `~/Library/Application\\ Support/com.apple.wallpaper/aerials/videos`;
  document.getElementById("installCmd").textContent =
    `cp ~/Downloads/'${movName}' ${aerials}/<UUID>.mov\n`
    + `chmod 644 ${aerials}/<UUID>.mov\n`
    + `rm -rf ~/Library/Containers/com.apple.wallpaper.*/Data/Library/Caches/\n`
    + `killall -9 "Wallpaper Video Extension" 2>/dev/null\n`
    + `killall -9 WallpaperAgent 2>/dev/null\n`
    + `killall -9 Dock`;

  document.getElementById("ffmpegSection").style.display = "block";
}

async function copyText(txt) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(txt);
      return true;
    }
  } catch (_) {}
  // Fallback for file:// and other non-secure contexts.
  const ta = document.createElement("textarea");
  ta.value = txt;
  ta.style.position = "fixed";
  ta.style.top = "-1000px";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (_) {}
  document.body.removeChild(ta);
  return ok;
}

function wireCopy(btnId, srcId) {
  const btn = document.getElementById(btnId);
  btn.addEventListener("click", async () => {
    const ok = await copyText(document.getElementById(srcId).textContent);
    const prev = btn.textContent;
    btn.textContent = ok ? "copied" : "copy failed";
    btn.classList.toggle("ok", ok);
    setTimeout(() => { btn.textContent = prev; btn.classList.remove("ok"); }, 1200);
  });
}

init();
