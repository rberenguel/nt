// Main controller for Alien Artificial Life screensaver
// Coordinates simulation, WebGL2 rendering, multi-screen BroadcastChannel sync,
// chrome.storage.local / localStorage persistence, and JSON export/import.

(function () {
  const params = new URLSearchParams(window.location.search);
  const screenIndex = parseInt(params.get("screen") || "0", 10);
  const totalScreens = Math.max(1, parseInt(params.get("screens") || "1", 10));
  const isPrimary = screenIndex === 0;

  document.title = totalScreens > 1 ? `Alien (${screenIndex + 1}/${totalScreens})` : "Alien — Artificial Life";

  const canvas = document.getElementById("glcanvas");
  const hud = document.getElementById("hud");
  const toastEl = document.getElementById("toast");
  const fileInput = document.getElementById("fileInput");

  const hudStorage = document.getElementById("hudStorage");
  const hudOrgs = document.getElementById("hudOrgs");
  const hudCells = document.getElementById("hudCells");
  const hudMotes = document.getElementById("hudMotes");
  const hudGen = document.getElementById("hudGen");
  const hudBirths = document.getElementById("hudBirths");
  const hudCross = document.getElementById("hudCross");
  const hudSpeed = document.getElementById("hudSpeed");
  const hudSize = document.getElementById("hudSize");
  const hudFps = document.getElementById("hudFps");
  const hudScreen = document.getElementById("hudScreen");
  const hudPalette = document.getElementById("hudPalette");
  const hudPrey = document.getElementById("hudPrey");
  const hudPred = document.getElementById("hudPred");
  const lvCanvas = document.getElementById("lvChart");
  const lvCtx = lvCanvas ? lvCanvas.getContext("2d") : null;

  function drawLvChart(history) {
    if (!lvCtx || !history || history.length === 0) return;
    const w = lvCanvas.width;
    const h = lvCanvas.height;
    lvCtx.clearRect(0, 0, w, h);

    // Latest counts
    const last = history[history.length - 1];
    hudPrey.textContent = String(last[1]);
    hudPred.textContent = String(last[2]);

    // Find max Y across both series
    let maxY = 20;
    for (let i = 0; i < history.length; i++) {
      if (history[i][1] > maxY) maxY = history[i][1];
      if (history[i][2] > maxY) maxY = history[i][2];
    }
    maxY = Math.ceil(maxY * 1.12);

    // Subtle horizontal grid lines
    lvCtx.strokeStyle = "rgba(120, 175, 230, 0.12)";
    lvCtx.lineWidth = 1;
    for (let g = 1; g <= 3; g++) {
      const gy = Math.round((h * g) / 4) + 0.5;
      lvCtx.beginPath();
      lvCtx.moveTo(0, gy);
      lvCtx.lineTo(w, gy);
      lvCtx.stroke();
    }

    if (history.length < 2) return;
    const padX = 3;
    const padY = 4;
    const plotW = w - padX * 2;
    const plotH = h - padY * 2;
    const n = history.length;

    const plotSeries = (colIdx, stroke, fill) => {
      lvCtx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = padX + (i / (n - 1)) * plotW;
        const y = padY + plotH * (1 - history[i][colIdx] / maxY);
        if (i === 0) lvCtx.moveTo(x, y);
        else lvCtx.lineTo(x, y);
      }
      lvCtx.strokeStyle = stroke;
      lvCtx.lineWidth = 1.6;
      lvCtx.stroke();

      // Subtle translucent area fill
      lvCtx.lineTo(padX + plotW, padY + plotH);
      lvCtx.lineTo(padX, padY + plotH);
      lvCtx.closePath();
      lvCtx.fillStyle = fill;
      lvCtx.fill();
    };

    plotSeries(1, "#0af57a", "rgba(10, 245, 122, 0.10)");
    plotSeries(2, "#ff3b45", "rgba(255, 59, 69, 0.14)");
  }

  hudStorage.textContent = window.AlienStorage.getBackendName();
  hudScreen.textContent = `${screenIndex} / ${totalScreens}`;

  let renderer;
  try {
    renderer = new window.AlienRenderer(canvas, screenIndex, totalScreens);
  } catch (err) {
    document.body.innerHTML = `<div style="color:#d8eaff;padding:32px;font-family:monospace">${err.message}</div>`;
    throw err;
  }

  // Compute aspect-matched world dimensions so cells stay perfectly circular
  function computeWorldSize() {
    const worldH = 3000;
    const aspect = Math.max(0.5, window.innerWidth / Math.max(1, window.innerHeight));
    const worldW = Math.round(worldH * aspect * totalScreens);
    return { worldW, worldH };
  }

  let { worldW, worldH } = computeWorldSize();
  const sim = isPrimary ? new window.AlienSim(worldW, worldH) : null;

  let paused = false;
  let hudVisible = false;
  let importMode = "replace"; // "replace" | "inject"
  let toastTimer = null;
  let lastBroadcastHistLen = -1;
  let remoteHistory = [];

  // Secondary screen state buffer (received from Primary over BroadcastChannel)
  let remoteFrame = {
    cells: new Float32Array(0),
    cellCount: 0,
    bonds: new Float32Array(0),
    bondCount: 0,
    motes: new Float32Array(0),
    moteCount: 0,
    worldW,
    worldH,
    simTime: 0,
    orgs: 0,
    maxGen: 1,
    births: 0,
    crossovers: 0,
    avgSpeed: 0,
    avgCells: 0,
  };

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  function updateHudPalette() {
    hudPalette.textContent = renderer.getPalette().name;
  }

  // ── Multi-Screen BroadcastChannel ───────────────────────────────────────────
  const bc = new BroadcastChannel("alien-screensaver");

  async function saveAndClose() {
    if (isPrimary && sim) {
      const snap = sim.serializeSnapshot(renderer.paletteIdx);
      window.AlienStorage.saveSnapshotSync(snap);
      await window.AlienStorage.saveSnapshot(snap);
    }
    window.close();
  }

  bc.onmessage = ({ data }) => {
    if (!data || typeof data !== "object") return;
    if (data.cmd === "quit") {
      saveAndClose();
      return;
    }
    if (data.cmd === "palette") {
      renderer.paletteIdx = data.paletteIdx;
      renderer.clearTrails();
      updateHudPalette();
      return;
    }
    if (data.cmd === "bezel") {
      renderer.showBezel = data.showBezel;
      return;
    }
    if (data.cmd === "pause") {
      paused = data.paused;
      return;
    }

    if (isPrimary) {
      if (data.cmd === "feed") {
        sim.dropEnergyBurst(data.wx, data.wy, 24);
      } else if (data.cmd === "pulse") {
        sim.applyRadialImpulse(data.wx, data.wy);
      } else if (data.cmd === "reseed") {
        reseedWorld();
      } else if (data.cmd === "requestSync") {
        bc.postMessage({ cmd: "palette", paletteIdx: renderer.paletteIdx });
        bc.postMessage({ cmd: "bezel", showBezel: renderer.showBezel });
        bc.postMessage({ cmd: "pause", paused });
        if (sim) bc.postMessage({ cmd: "history", history: sim.popHistory });
      }
    } else if (data.cmd === "frame") {
      remoteFrame = data;
    } else if (data.cmd === "history") {
      remoteHistory = Array.isArray(data.history) ? data.history : [];
      if (hudVisible) drawLvChart(remoteHistory);
    }
  };

  // ── Persistence & Export / Import ───────────────────────────────────────────
  async function saveNow(silent = false) {
    if (!isPrimary || !sim) return;
    const snap = sim.serializeSnapshot(renderer.paletteIdx);
    const ok = await window.AlienStorage.saveSnapshot(snap);
    if (!silent) {
      showToast(
        ok
          ? `Saved ${snap.organisms.length} creatures (${window.AlienStorage.getBackendName()})`
          : "Save failed (storage quota?)"
      );
    }
  }

  function exportJson() {
    if (!isPrimary || !sim) {
      showToast("Export is available from the primary screen");
      return;
    }
    const snap = sim.serializeSnapshot(renderer.paletteIdx);
    window.AlienStorage.exportToFile(snap);
    showToast(`Exported ${snap.organisms.length} creatures + ${snap.hallOfFame.length} Hall of Fame genomes`);
  }

  function triggerImport(mode = "replace") {
    if (!isPrimary || !sim) {
      showToast("Import is available from the primary screen");
      return;
    }
    importMode = mode;
    fileInput.value = "";
    fileInput.click();
  }

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !sim) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const validated = window.AlienStorage.validateImportedData(parsed);
        if (!validated) {
          showToast("Invalid creature JSON format");
          return;
        }
        const inject = importMode === "inject";
        const count = sim.loadSnapshot(validated, { inject });
        if (!inject && typeof validated.paletteIdx === "number") {
          renderer.paletteIdx = validated.paletteIdx % window.AlienPalettes.length;
          bc.postMessage({ cmd: "palette", paletteIdx: renderer.paletteIdx });
          updateHudPalette();
        }
        renderer.clearTrails();
        saveNow(true);
        showToast(
          inject
            ? `Injected ${count} creatures into current world`
            : `Loaded ${count} creatures from ${file.name}`
        );
      } catch (err) {
        console.error("[alien] Import error:", err);
        showToast("Failed to parse JSON file");
      }
    };
    reader.readAsText(file);
  });

  function reseedWorld() {
    if (!isPrimary || !sim) {
      bc.postMessage({ cmd: "reseed" });
      return;
    }
    sim.seedFreshWorld();
    renderer.clearTrails();
    showToast("Reseeded fresh primordial world");
  }

  function cyclePalette() {
    renderer.paletteIdx = (renderer.paletteIdx + 1) % window.AlienPalettes.length;
    renderer.clearTrails();
    updateHudPalette();
    bc.postMessage({ cmd: "palette", paletteIdx: renderer.paletteIdx });
    showToast(`Palette: ${renderer.getPalette().name}`);
  }

  function togglePause() {
    paused = !paused;
    bc.postMessage({ cmd: "pause", paused });
    showToast(paused ? "Paused" : "Resumed");
  }

  function toggleBezel() {
    renderer.showBezel = !renderer.showBezel;
    bc.postMessage({ cmd: "bezel", showBezel: renderer.showBezel });
  }

  function saveScreenshot() {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alien-screen${screenIndex}-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Saved PNG screenshot");
    }, "image/png");
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  // ── HUD Buttons ─────────────────────────────────────────────────────────────
  document.getElementById("btnSave").addEventListener("click", (e) => {
    e.stopPropagation();
    saveNow(false);
  });
  document.getElementById("btnExport").addEventListener("click", (e) => {
    e.stopPropagation();
    exportJson();
  });
  document.getElementById("btnImport").addEventListener("click", (e) => {
    e.stopPropagation();
    triggerImport("replace");
  });
  document.getElementById("btnInject").addEventListener("click", (e) => {
    e.stopPropagation();
    triggerImport("inject");
  });
  const btnReset = document.getElementById("btnReset");
  let resetArmed = false;
  let resetArmTimer = null;
  btnReset.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!resetArmed) {
      resetArmed = true;
      btnReset.textContent = "Confirm Reseed?";
      showToast("Click 'Confirm Reseed?' again to wipe & reseed");
      clearTimeout(resetArmTimer);
      resetArmTimer = setTimeout(() => {
        resetArmed = false;
        btnReset.textContent = "Reseed";
      }, 4000);
      return;
    }
    clearTimeout(resetArmTimer);
    resetArmed = false;
    btnReset.textContent = "Reseed";
    reseedWorld();
  });

  // ── Microscope Scroll-to-Zoom & Pan State (local per screen) ────────────────
  let camZoom = 1.0;
  let targetZoom = 1.0;
  let camCenterX = (screenIndex + 0.5) * (worldW / totalScreens);
  let camCenterY = worldH * 0.5;
  let targetCenterX = camCenterX;
  let targetCenterY = camCenterY;

  function getActiveWorldSize() {
    return {
      w: isPrimary ? worldW : remoteFrame.worldW,
      h: isPrimary ? worldH : remoteFrame.worldH,
    };
  }

  function clampCamera(cx, cy, z) {
    const { w, h } = getActiveWorldSize();
    const sliceW = w / totalScreens;
    const minX = screenIndex * sliceW;
    const maxX = minX + sliceW;
    const halfW = (sliceW / z) * 0.5;
    const halfH = (h / z) * 0.5;
    return {
      x: Math.max(minX + halfW, Math.min(maxX - halfW, cx)),
      y: Math.max(halfH, Math.min(h - halfH, cy)),
    };
  }

  function getCameraView() {
    const { w, h } = getActiveWorldSize();
    const sliceW = w / totalScreens;
    const viewW = sliceW / camZoom;
    const viewH = h / camZoom;
    return {
      zoom: camZoom,
      x: camCenterX - viewW * 0.5,
      y: camCenterY - viewH * 0.5,
      viewW,
      viewH,
    };
  }

  function stepCamera() {
    const prevZoom = camZoom;
    camZoom += (targetZoom - camZoom) * 0.22;
    if (Math.abs(targetZoom - camZoom) < 0.002) camZoom = targetZoom;

    const clampedTarget = clampCamera(targetCenterX, targetCenterY, targetZoom);
    targetCenterX = clampedTarget.x;
    targetCenterY = clampedTarget.y;

    camCenterX += (targetCenterX - camCenterX) * 0.22;
    camCenterY += (targetCenterY - camCenterY) * 0.22;
    const clampedCur = clampCamera(camCenterX, camCenterY, camZoom);
    camCenterX = clampedCur.x;
    camCenterY = clampedCur.y;

    // Clear trail persistence while actively zooming so trails don't smear
    if (Math.abs(camZoom - prevZoom) > 0.008) {
      renderer.clearTrails();
    }
  }

  function clientToWorld(clientX, clientY) {
    const view = getCameraView();
    const wx = view.x + (clientX / Math.max(1, window.innerWidth)) * view.viewW;
    const wy = view.y + (clientY / Math.max(1, window.innerHeight)) * view.viewH;
    return { wx, wy };
  }

  function zoomAtClient(clientX, clientY, factor) {
    const { wx, wy } = clientToWorld(clientX, clientY);
    const nextZoom = Math.max(1.0, Math.min(6.0, targetZoom * factor));
    if (Math.abs(nextZoom - targetZoom) < 0.001) return;

    const { w, h } = getActiveWorldSize();
    const sliceW = w / totalScreens;
    const fx = clientX / Math.max(1, window.innerWidth) - 0.5;
    const fy = clientY / Math.max(1, window.innerHeight) - 0.5;
    targetZoom = nextZoom;
    const newCenterX = wx - fx * (sliceW / nextZoom);
    const newCenterY = wy - fy * (h / nextZoom);
    const clamped = clampCamera(newCenterX, newCenterY, nextZoom);
    targetCenterX = clamped.x;
    targetCenterY = clamped.y;
  }

  function resetZoom() {
    targetZoom = 1.0;
    const { w, h } = getActiveWorldSize();
    const sliceW = w / totalScreens;
    targetCenterX = (screenIndex + 0.5) * sliceW;
    targetCenterY = h * 0.5;
  }

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0018);
      zoomAtClient(e.clientX, e.clientY, factor);
    },
    { passive: false }
  );

  // ── Mouse Interaction (Click: Fullscreen, Shift+Click/Drag: Feed, Right-Click: Pulse, Middle-Drag: Pan) ──
  let feedingPointer = false;
  let panningPointer = false;
  let panLastX = 0;
  let panLastY = 0;
  let lastFeedTime = 0;

  canvas.addEventListener("pointerdown", (e) => {
    const { wx, wy } = clientToWorld(e.clientX, e.clientY);
    if (e.button === 1 && camZoom > 1.01) {
      e.preventDefault();
      panningPointer = true;
      panLastX = e.clientX;
      panLastY = e.clientY;
    } else if (e.button === 2) {
      if (isPrimary) sim.applyRadialImpulse(wx, wy);
      else bc.postMessage({ cmd: "pulse", wx, wy });
    } else if (e.shiftKey) {
      feedingPointer = true;
      if (isPrimary) sim.dropEnergyBurst(wx, wy, 22);
      else bc.postMessage({ cmd: "feed", wx, wy });
      lastFeedTime = performance.now();
    } else if (e.button === 0) {
      toggleFullscreen();
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (panningPointer) {
      const view = getCameraView();
      const dx = ((e.clientX - panLastX) / Math.max(1, window.innerWidth)) * view.viewW;
      const dy = ((e.clientY - panLastY) / Math.max(1, window.innerHeight)) * view.viewH;
      panLastX = e.clientX;
      panLastY = e.clientY;
      const clamped = clampCamera(targetCenterX - dx, targetCenterY - dy, targetZoom);
      targetCenterX = clamped.x;
      targetCenterY = clamped.y;
      return;
    }
    if (!feedingPointer) return;
    const now = performance.now();
    if (now - lastFeedTime < 70) return;
    lastFeedTime = now;
    const { wx, wy } = clientToWorld(e.clientX, e.clientY);
    if (isPrimary) sim.dropEnergyBurst(wx, wy, 10);
    else bc.postMessage({ cmd: "feed", wx, wy });
  });

  window.addEventListener("pointerup", () => {
    feedingPointer = false;
    panningPointer = false;
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // ── Keyboard Shortcuts ──────────────────────────────────────────────────────
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "c") {
      cyclePalette();
    } else if (k === "p") {
      togglePause();
    } else if (k === "h") {
      hudVisible = !hudVisible;
      hud.classList.toggle("hidden", !hudVisible);
      if (hudVisible) drawLvChart(isPrimary && sim ? sim.popHistory : remoteHistory);
    } else if (k === "b") {
      toggleBezel();
    } else if (k === "s") {
      saveScreenshot();
    } else if (k === "w") {
      saveNow(false);
    } else if (k === "e") {
      exportJson();
    } else if (k === "i") {
      triggerImport(e.shiftKey ? "inject" : "replace");
    } else if (k === "f") {
      toggleFullscreen();
    } else if (k === "=" || k === "+") {
      zoomAtClient(window.innerWidth * 0.5, window.innerHeight * 0.5, 1.35);
    } else if (k === "-") {
      zoomAtClient(window.innerWidth * 0.5, window.innerHeight * 0.5, 1 / 1.35);
    } else if (k === "0") {
      resetZoom();
    } else if (k === "q") {
      bc.postMessage({ cmd: "quit" });
      saveAndClose();
    }
  });

  // ── Resize & Unload Autosave ────────────────────────────────────────────────
  window.addEventListener("resize", () => {
    renderer.resize();
    if (isPrimary && sim) {
      const sz = computeWorldSize();
      worldW = sz.worldW;
      worldH = sz.worldH;
      sim.resizeWorld(worldW, worldH);
    }
  });

  window.addEventListener("beforeunload", () => {
    if (isPrimary && sim) {
      window.AlienStorage.saveSnapshotSync(sim.serializeSnapshot(renderer.paletteIdx));
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && isPrimary && sim) {
      saveNow(true);
    }
  });

  // Periodic autosave every 10 seconds
  if (isPrimary) {
    setInterval(() => {
      if (!paused && sim && sim.activeOrgCount > 0) {
        saveNow(true);
      }
    }, 10000);
  }

  // ── Boot & Animation Loop ───────────────────────────────────────────────────
  let lastTs = 0;
  let fpsFrames = 0;
  let fpsLast = performance.now();
  let frameCounter = 0;

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    frameCounter++;

    stepCamera();
    const camView = getCameraView();

    if (isPrimary && sim) {
      if (!paused) {
        sim.step(dt);
      }
      sim.packRenderBuffers();

      const renderData = {
        cells: sim.gpuCells,
        cellCount: sim.gpuCellCount,
        bonds: sim.gpuBonds,
        bondCount: sim.gpuBondCount,
        motes: sim.gpuMotes,
        moteCount: sim.gpuMoteCount,
      };
      renderer.render(renderData, worldW, worldH, sim.simTime, camView);

      // Broadcast compact active slices to secondary monitors
      if (totalScreens > 1) {
        bc.postMessage({
          cmd: "frame",
          cells: sim.gpuCells.slice(0, sim.gpuCellCount * 8),
          cellCount: sim.gpuCellCount,
          bonds: sim.gpuBonds.slice(0, sim.gpuBondCount * 8),
          bondCount: sim.gpuBondCount,
          motes: sim.gpuMotes.slice(0, sim.gpuMoteCount * 4),
          moteCount: sim.gpuMoteCount,
          worldW,
          worldH,
          simTime: sim.simTime,
          orgs: sim.activeOrgCount,
          maxGen: sim.maxGeneration,
          births: sim.totalBirths,
          crossovers: sim.totalCrossovers,
          avgSpeed: sim.avgSpeed,
          avgCells: sim.avgCells,
        });
        const histStamp =
          sim.popHistory.length > 0
            ? sim.popHistory[sim.popHistory.length - 1][0]
            : -1;
        if (histStamp !== lastBroadcastHistLen) {
          lastBroadcastHistLen = histStamp;
          bc.postMessage({ cmd: "history", history: sim.popHistory });
        }
      }

      if ((frameCounter & 7) === 0) {
        hudOrgs.textContent = String(sim.activeOrgCount);
        hudCells.textContent = String(sim.activeCellCount);
        hudMotes.textContent = String(sim.activeMoteCount);
        hudGen.textContent = String(sim.maxGeneration);
        hudBirths.textContent = String(sim.totalBirths);
        hudCross.textContent = String(sim.totalCrossovers);
        hudSpeed.textContent = sim.avgSpeed.toFixed(1);
        hudSize.textContent = sim.avgCells.toFixed(1);
        if (hudVisible && (frameCounter & 31) === 0) {
          drawLvChart(sim.popHistory);
        }
      }
    } else {
      renderer.render(remoteFrame, remoteFrame.worldW, remoteFrame.worldH, remoteFrame.simTime, camView);
      if ((frameCounter & 7) === 0) {
        hudOrgs.textContent = String(remoteFrame.orgs);
        hudCells.textContent = String(remoteFrame.cellCount);
        hudMotes.textContent = String(remoteFrame.moteCount);
        hudGen.textContent = String(remoteFrame.maxGen);
        hudBirths.textContent = String(remoteFrame.births);
        hudCross.textContent = String(remoteFrame.crossovers || 0);
        hudSpeed.textContent = (remoteFrame.avgSpeed || 0).toFixed(1);
        hudSize.textContent = (remoteFrame.avgCells || 0).toFixed(1);
      }
    }

    fpsFrames++;
    if (ts - fpsLast >= 600) {
      const fps = Math.round((fpsFrames * 1000) / (ts - fpsLast));
      hudFps.textContent = String(fps);
      fpsFrames = 0;
      fpsLast = ts;
    }
  }

  async function boot() {
    renderer.resize();
    if (isPrimary && sim) {
      const saved = await window.AlienStorage.loadSnapshot();
      const validated = window.AlienStorage.validateImportedData(saved);
      if (validated && validated.organisms.length > 0) {
        const count = sim.loadSnapshot(validated, { inject: false });
        if (typeof validated.paletteIdx === "number") {
          renderer.paletteIdx = validated.paletteIdx % window.AlienPalettes.length;
        }
        updateHudPalette();
        showToast(`Restored ${count} evolved creatures (${window.AlienStorage.getBackendName()})`);
      } else {
        sim.seedFreshWorld();
        updateHudPalette();
      }
    } else {
      updateHudPalette();
      bc.postMessage({ cmd: "requestSync" });
    }
    requestAnimationFrame(loop);
  }

  boot();
})();
