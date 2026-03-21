function initStorm({
  rain: enableRain = false,
  thunder: enableThunder = false,
  disableDefaultKeyHandler = false,
  disableClickHandler = false,
  screenIndex = 0,
  totalScreens = 1,
} = {}) {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { alpha: false });

  let w, h, dpr;
  let bolts = [];
  let rain = [];
  let skyFlash = 0;
  let windTime = 0;
  let audioCtx = null;
  let thunderBuffer = null;
  let rainBuffer = null;
  let rainNode = null;
  let thunderActive = false;

  // Seeded PRNG for synchronized randomness across screens
  // mulberry32 algorithm
  function seededRandom(seed) {
    let t = seed + 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Get a seed that changes roughly every 50ms (sync window)
  function getTimeSeed() {
    return Math.floor(Date.now() / 50);
  }

  const CFG = {
    baseSegments: 6,
    sway: 80,
    fractalIter: 6,
    roughness: 0.45,
    width: 2.5,
    glow: 20,
    fade: 0.03,
    branchProb: 0.7,
  };

  const RAIN = {
    count: 4000,
    baseSpeed: 25,
    baseWind: -2,
    color: "rgba(160, 180, 220, 0.15)",
  };

  function startRain(ac) {
    if (!enableRain || !thunderActive || !rainBuffer || rainNode) return;
    const gain = ac.createGain();
    gain.gain.value = 0.4;
    rainNode = ac.createBufferSource();
    rainNode.buffer = rainBuffer;
    rainNode.loop = true;
    rainNode.connect(gain).connect(ac.destination);
    rainNode.start();
  }

  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      fetch("thunder.mp3")
        .then((r) => r.arrayBuffer())
        .then((ab) => audioCtx.decodeAudioData(ab))
        .then((buf) => { thunderBuffer = buf; console.log("thunder loaded", buf.duration); })
        .catch((e) => console.error("thunder load failed", e));
      if (enableRain) {
        fetch("rain.mp3")
          .then((r) => r.arrayBuffer())
          .then((ab) => audioCtx.decodeAudioData(ab))
          .then((buf) => { rainBuffer = buf; startRain(audioCtx); })
          .catch(() => {});
      }
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().then(() => startRain(audioCtx));
    }
    return audioCtx;
  }

  function triggerThunder(boltX) {
    if (!enableThunder || !thunderActive || !thunderBuffer) {
      console.log("triggerThunder skip", { enableThunder, thunderActive, hasBuffer: !!thunderBuffer });
      return;
    }
    const ac = getAudioCtx();
    const now = ac.currentTime;
    const delay = 0.3 + Math.random() * 2.2;
    const pan = Math.max(-1, Math.min(1, (boltX / w) * 2 - 1));

    // Pick a random start offset so the file's different thunder claps get used
    const maxOffset = Math.max(0, thunderBuffer.duration - 8);
    const offset = Math.random() * maxOffset;

    const src = ac.createBufferSource();
    src.buffer = thunderBuffer;
    src.playbackRate.value = 0.9 + Math.random() * 0.2; // slight pitch variation

    const gainNode = ac.createGain();
    gainNode.gain.value = 0.7 + Math.random() * 0.5;

    const panner = ac.createStereoPanner();
    panner.pan.value = pan * 0.6;

    src.connect(gainNode).connect(panner).connect(ac.destination);
    src.start(now + delay, offset);
  }

  function fractalize(path, iterations) {
    let currentPath = path;
    for (let k = 0; k < iterations; k++) {
      const nextPath = [currentPath[0]];
      for (let i = 0; i < currentPath.length - 1; i++) {
        const p1 = currentPath[i],
          p2 = currentPath[i + 1];
        const dx = p2.x - p1.x,
          dy = p2.y - p1.y;
        const noise = (Math.random() - 0.5) * CFG.roughness;
        nextPath.push({
          x: (p1.x + p2.x) / 2 - dy * noise,
          y: (p1.y + p2.y) / 2 + dx * noise,
        });
        nextPath.push(p2);
      }
      currentPath = nextPath;
    }
    return currentPath;
  }

  function createSkeleton(x, y, targetY) {
    const path = [{ x, y }];
    const segs = CFG.baseSegments;
    const dy = (targetY - y) / segs;
    let cx = x;

    for (let i = 1; i <= segs; i++) {
      const cy = y + dy * i;
      const progress = i / segs;

      // Gentle pull towards center to keep it on screen
      const center = x < w * 0.25 ? w * 0.5 : x > w * 0.75 ? w * 0.5 : x;
      const pull = (center - cx) * (progress * 0.15);

      // Large low-frequency sway
      const sway = (Math.random() * 2 - 1) * CFG.sway;

      cx += pull + sway;
      path.push({ x: cx, y: cy });
    }
    return path;
  }

  function createBolt(x) {
    // 1. Create the low-res "Skeleton" (Big Zig-Zags)
    const skeleton = createSkeleton(x, 0, h);

    // Randomize fractal detail: 2-6 iterations (lower = sparser/cleaner)
    const fractalIter = 2 + Math.floor(Math.random() * 5);

    // 2. Add Branches (attached to skeleton nodes)
    // Sparse bolts (low fractal) get fewer branches
    const branches = [];
    const branchProb = fractalIter <= 3 ? 0.3 : CFG.branchProb;
    if (Math.random() < branchProb) {
      const maxBranches = fractalIter <= 3 ? 2 : 4;
      const num = 1 + Math.floor(Math.random() * maxBranches);
      for (let i = 0; i < num; i++) {
        // Pick a random spot on the skeleton
        const idx = Math.floor(skeleton.length * (0.2 + Math.random() * 0.6));
        const start = skeleton[idx];

        // Simple 3-point skeleton for branches [Start, Mid, End]
        const len = (h - start.y) * (0.3 + Math.random() * 0.4);
        const endY = start.y + len;
        const side = Math.random() < 0.5 ? -1 : 1;
        const drift = side * (w * 0.1 + Math.random() * w * 0.2);

        const branchSkel = [
          { x: start.x, y: start.y },
          {
            x: start.x + drift * 0.5 + (Math.random() * 2 - 1) * 40,
            y: start.y + len * 0.5,
          },
          { x: start.x + drift, y: endY },
        ];

        branches.push(fractalize(branchSkel, fractalIter));
      }
    }

    // 3. Fractalize the skeleton to add the "Electric" look
    const finalPath = fractalize(skeleton, fractalIter);

    return { life: 1.0, path: finalPath, branches };
  }

  function drawPath(pts, widthMul) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = CFG.width * dpr * widthMul;
    ctx.stroke();
  }

  function initRain() {
    if (!enableRain) {
      rain = [];
      return;
    }
    rain = [];
    for (let i = 0; i < RAIN.count; i++) {
      rain.push({
        x: Math.random() * w,
        y: Math.random() * h,
        l: Math.random() * 20 + 20,
        z: Math.random() * 0.5 + 0.5,
      });
    }
  }

  function loop() {
    if (!ctx || !w) return;

    if (enableRain) {
      // --- COMPLEX STORM BEHAVIOR (b.html logic) ---
      windTime += 0.01;
      const currentWind = RAIN.baseWind + Math.sin(windTime) * 3;

      // Sky Flash Logic - use seeded random for sync
      const seed = getTimeSeed();
      skyFlash *= 0.955; // Decay
      if (skyFlash < 0.02) skyFlash = 0;

      if (skyFlash > 0.15 && seededRandom(seed + 100) < 0.2)
        skyFlash += seededRandom(seed + 101) * 0.15;
      if (skyFlash > 1) skyFlash = 1;

      // Distant sheet lightning
      if (seededRandom(seed + 102) < 0.003) {
        if (skyFlash < 0.1) skyFlash = seededRandom(seed + 103) * 0.4 + 0.1;
      }

      // Render Background
      const bgLum = 5 + Math.floor(skyFlash * 50);
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgb(${bgLum},${bgLum},${bgLum + 6})`;
      ctx.fillRect(0, 0, w, h);

      // Render Rain
      ctx.strokeStyle = RAIN.color;
      ctx.lineWidth = 1 * dpr;
      if (skyFlash > 0.05)
        ctx.strokeStyle = `rgba(200, 220, 255, ${0.2 + skyFlash * 0.4})`;

      ctx.beginPath();
      for (let r of rain) {
        r.x += currentWind * r.z;
        r.y += RAIN.baseSpeed * r.z;
        if (r.y > h) {
          r.y = -r.l;
          r.x = Math.random() * w;
        }
        if (r.x > w) r.x = 0;
        else if (r.x < 0) r.x = w;

        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x + currentWind * 0.5, r.y + r.l);
      }
      ctx.stroke();

      // Spawn Bolts - use seeded random for sync across screens
      // Higher threshold to compensate for 50ms sync window (~20 rolls/sec vs ~60)
      const spawnRoll = seededRandom(seed);
      if (spawnRoll < 0.01) {
        // All screens flash
        skyFlash = 1.0;
        // Only one screen shows the bolt (randomly chosen but synced)
        const chosenScreen = Math.floor(seededRandom(seed + 1) * totalScreens);
        if (chosenScreen === screenIndex) {
          const boltX = seededRandom(seed + 2) * w;
          bolts.push(createBolt(boltX));
          triggerThunder(boltX);
        }
      }
    } else {
      // --- SIMPLE LIGHTNING BEHAVIOR (a.html logic) ---
      // Background
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, w, h);

      // Spawn - use seeded random for sync across screens
      // Higher threshold to compensate for 50ms sync window (~20 rolls/sec vs ~60)
      const seed = getTimeSeed();
      const spawnRoll = seededRandom(seed);
      if (spawnRoll < 0.015) {
        // All screens flash
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(0, 0, w, h);
        // Only one screen shows the bolt (randomly chosen but synced)
        const chosenScreen = Math.floor(seededRandom(seed + 1) * totalScreens);
        if (chosenScreen === screenIndex) {
          const boltX = seededRandom(seed + 2) * w;
          bolts.push(createBolt(boltX));
          triggerThunder(boltX);
        }
      }
    }

    // --- SHARED BOLT RENDERING ---
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= CFG.fade;
      if (b.life <= 0) {
        bolts.splice(i, 1);
        continue;
      }

      const flicker = Math.random() > 0.1 ? b.life : b.life * 0.6;

      ctx.globalAlpha = flicker * 0.4;
      ctx.strokeStyle = "#2299FF";
      ctx.shadowBlur = CFG.glow * dpr;
      ctx.shadowColor = "#2299FF";
      drawPath(b.path, 3.0);
      b.branches.forEach((br) => drawPath(br, 1.5));

      ctx.globalAlpha = flicker;
      ctx.strokeStyle = "#FFFFFF";
      ctx.shadowBlur = 0;
      drawPath(b.path, 1.0);
      b.branches.forEach((br) => drawPath(br, 0.5));
    }
    requestAnimationFrame(loop);
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    w = Math.ceil(window.innerWidth * dpr);
    h = Math.ceil(window.innerHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    initRain();
  }

  function handleInput(e) {
    let cx = e.clientX;
    if (cx === undefined && e.touches && e.touches.length > 0)
      cx = e.touches[0].clientX;
    if (cx !== undefined) {
      if (enableThunder) getAudioCtx(); // resume on user gesture
      bolts.push(createBolt(cx * dpr));
      triggerThunder(cx * dpr);
      if (enableRain) skyFlash = 1.0; // Only affect skyFlash if rain/storm mode is on
    }
  }

  function handleKey(e) {
    if (e.key === "s") {
      const name = document.title
        ? document.title.toLowerCase().replace(/ /g, "_")
        : "capture";
      const link = document.createElement("a");
      link.download = `${name}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  }

  window.addEventListener("resize", resize);
  if (enableThunder) {
    // Resume AudioContext on any user gesture, regardless of disableClickHandler
    const resumeAudio = () => getAudioCtx();
    window.addEventListener("mousedown", resumeAudio, { once: true });
    window.addEventListener("touchstart", resumeAudio, { once: true, passive: true });
    window.addEventListener("keydown", resumeAudio, { once: true });
  }
  if (!disableClickHandler) {
    window.addEventListener("mousedown", handleInput);
    window.addEventListener("touchstart", handleInput, { passive: false });
  }
  if (enableThunder) {
    window.addEventListener("keydown", (e) => {
      if (e.key === "t") {
        thunderActive = !thunderActive;
        if (thunderActive) {
          startRain(getAudioCtx());
        } else if (rainNode) {
          rainNode.stop();
          rainNode = null;
        }
      }
    });
  }
  if (!disableDefaultKeyHandler) {
    window.addEventListener("keydown", handleKey);
  }

  resize();
  requestAnimationFrame(loop);
}
