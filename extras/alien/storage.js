// Unified storage adapter for Chrome Extension (chrome.storage.local) and Web (localStorage)
// plus JSON export / import helpers for evolved creatures and ecosystems.

(function () {
  const STORAGE_KEY = "nt_alien_ecosystem_v2";
  const BACKUP_LS_KEY = "nt_alien_ecosystem_v2_ls";

  function hasChromeStorage() {
    return (
      typeof chrome !== "undefined" &&
      chrome &&
      chrome.storage &&
      chrome.storage.local &&
      typeof chrome.storage.local.get === "function"
    );
  }

  function getBackendName() {
    return hasChromeStorage() ? "CHROME" : "LOCAL";
  }

  async function saveSnapshot(snapshot) {
    const json = JSON.stringify(snapshot);
    // Keep a localStorage mirror when small enough (also acts as fast fallback)
    try {
      if (json.length < 4_000_000) {
        localStorage.setItem(BACKUP_LS_KEY, json);
      }
    } catch (_) {
      // Ignore quota errors on mirror
    }

    if (hasChromeStorage()) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.set({ [STORAGE_KEY]: snapshot }, () => {
            if (chrome.runtime && chrome.runtime.lastError) {
              console.warn("[alien] chrome.storage.local.set error:", chrome.runtime.lastError);
              resolve(false);
            } else {
              resolve(true);
            }
          });
        } catch (err) {
          console.warn("[alien] chrome.storage.local.set exception:", err);
          resolve(false);
        }
      });
    }

    try {
      localStorage.setItem(STORAGE_KEY, json);
      return true;
    } catch (err) {
      console.warn("[alien] localStorage.setItem error:", err);
      return false;
    }
  }

  // Synchronous save for beforeunload (chrome.storage.local is async and may not finish on unload)
  function saveSnapshotSync(snapshot) {
    try {
      const json = JSON.stringify(snapshot);
      if (json.length < 4_000_000) {
        localStorage.setItem(BACKUP_LS_KEY, json);
        if (!hasChromeStorage()) {
          localStorage.setItem(STORAGE_KEY, json);
        }
      }
    } catch (_) {}
  }

  async function loadSnapshot() {
    let chromeData = null;
    if (hasChromeStorage()) {
      chromeData = await new Promise((resolve) => {
        try {
          chrome.storage.local.get([STORAGE_KEY], (res) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              resolve(null);
            } else {
              resolve(res ? res[STORAGE_KEY] || null : null);
            }
          });
        } catch (_) {
          resolve(null);
        }
      });
    }

    let lsData = null;
    try {
      const raw =
        localStorage.getItem(BACKUP_LS_KEY) || localStorage.getItem(STORAGE_KEY);
      if (raw) lsData = JSON.parse(raw);
    } catch (_) {}

    // Pick whichever snapshot is newer (handles beforeunload sync mirror)
    if (chromeData && lsData) {
      return (lsData.savedAt || 0) > (chromeData.savedAt || 0) ? lsData : chromeData;
    }
    return chromeData || lsData || null;
  }

  async function clearSnapshot() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(BACKUP_LS_KEY);
    } catch (_) {}

    if (hasChromeStorage()) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.remove([STORAGE_KEY], () => resolve());
        } catch (_) {
          resolve();
        }
      });
    }
  }

  function exportToFile(snapshot) {
    const payload = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `alien-creatures-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function validateImportedData(data) {
    if (!data || typeof data !== "object") return null;

    // Support full ecosystem snapshot: { version, organisms: [...], hallOfFame: [...] }
    if (Array.isArray(data.organisms) && data.organisms.length > 0) {
      return {
        kind: "snapshot",
        organisms: data.organisms.filter(
          (o) => o && o.genome && Array.isArray(o.genome.nodes) && o.genome.nodes.length > 0
        ),
        hallOfFame: Array.isArray(data.hallOfFame) ? data.hallOfFame : [],
        history: Array.isArray(data.history) ? data.history : [],
        stats: data.stats || null,
        paletteIdx: typeof data.paletteIdx === "number" ? data.paletteIdx : null,
      };
    }

    // Support bare array of genomes or creatures
    if (Array.isArray(data) && data.length > 0) {
      const valid = data
        .map((item) => (item && item.genome ? item : item && Array.isArray(item.nodes) ? { genome: item } : null))
        .filter(Boolean);
      if (valid.length > 0) {
        return { kind: "list", organisms: valid, hallOfFame: [], stats: null, paletteIdx: null };
      }
    }

    // Support single genome object
    if (Array.isArray(data.nodes) && data.nodes.length > 0) {
      return { kind: "single", organisms: [{ genome: data }], hallOfFame: [], stats: null, paletteIdx: null };
    }

    return null;
  }

  window.AlienStorage = {
    hasChromeStorage,
    getBackendName,
    saveSnapshot,
    saveSnapshotSync,
    loadSnapshot,
    clearSnapshot,
    exportToFile,
    validateImportedData,
  };
})();
