const DateTime = luxon.DateTime;

const colors = [
  "--yellow",
  "--orange",
  "--magenta",
  "--violet",
  "--blue",
  "--green",
];

const numMojis = [
  "&#9312;",
  "&#9313;",
  "&#9314;",
  "&#9315;",
  "&#9316;",
  "&#9317;",
  "&#9318;",
  "&#9319;",
];

const linkRegex = /\[(.*?)\]\((.*?)\)/;
const linkPlusRegex = /\[(.*?)\]\((.*?)\)(\s*.*)/;
const linkWithShortcut = /`(.*?)`\s*\[(.*?)\]\((.*?)\)/;

function toTop(div) {
  const allDivs = document.querySelectorAll("div");
  const zs = Array.from(allDivs)
    .map((d) => getComputedStyle(d).getPropertyValue("z-index"))
    .filter((z) => z != "auto");
  const maxZ = Math.max(0, ...zs);
  div.style.zIndex = maxZ + 1;
}

let extraSeed = 0; // Initial value

function getDailyRandom(n, callback) {
  const today = new Date();
  const daySeed = formatDateToSeed(today);

  let hash = 0;
  for (let i = 0; i < daySeed.length; i++) {
    const char = daySeed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  const reSeededRandom = (seed) => {
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32);
    let localSeed = hash + seed;

    function seededRandom() {
      localSeed = (a * localSeed + c) % m;
      return localSeed / m;
    }

    const randomIndex = Math.floor(seededRandom() * n + seed) % n;
    return randomIndex;
  };
  try {
    chrome.storage.local.get(["extraSeed"], (data) => {
      const storedSeed = data.extraSeed || 0;
      callback(reSeededRandom(storedSeed)); // Call the callback with the result
    });
  } catch {
    const urlParams = new URLSearchParams(window.location.search);
    const seed = urlParams.get("seed") ?? 0;
    callback(reSeededRandom(seed));
  }
}

function formatDateToSeed(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setBackgroundDiv() {
  const bgDiv = document.createElement("DIV");
  bgDiv.id = "background";
  document.body.insertBefore(bgDiv, document.body.firstChild);
}

function setPi() {
  const pi = document.createElement("SPAN");
  pi.innerHTML = "&pi;";
  pi.id = "pi";
  pi.addEventListener("click", (ev) => {
    const newExtraSeed = Math.floor(Math.random() * 1729);
    console.info(`Setting base seed to ${newExtraSeed}`);
    try {
      chrome.storage.local.set({ extraSeed: newExtraSeed }); // Ensure key matches
      location.reload();
    } catch {
      const url = new URL(window.location.href);
      url.searchParams.set("seed", newExtraSeed);
      location.href = url.toString();
    }
  });
  document.body.appendChild(pi);
}

function setEpsilon() {
  const epsilon = document.createElement("SPAN");
  epsilon.innerHTML = "&epsilon;";
  epsilon.id = "epsilon";
  epsilon.addEventListener("click", (ev) => {
    getZenMode().then(currentState => {
      const newState = !currentState;
      console.info(`Toggling zen mode to ${newState}`);
      setZenMode(newState);
      applyZenMode(newState);
    });
  });
  document.body.appendChild(epsilon);
}

function getZenMode() {
  try {
    // Try chrome.storage.local first (extension)
    return new Promise((resolve) => {
      chrome.storage.local.get(["zenMode"], (data) => {
        resolve(data.zenMode === true);
      });
    });
  } catch {
    // Fallback to URL params (GitHub Pages)
    const urlParams = new URLSearchParams(window.location.search);
    return Promise.resolve(urlParams.get("zen") === "true");
  }
}

function setZenMode(enabled) {
  try {
    chrome.storage.local.set({ zenMode: enabled });
  } catch {
    // Fallback to URL params (GitHub Pages)
    const url = new URL(window.location.href);
    url.searchParams.set("zen", enabled.toString());
    window.history.replaceState({}, "", url);
  }
}

function applyZenMode(enabled) {
  const contentDivs = document.querySelectorAll("#upper-left, #upper-right, #lower-left, #lower-right, #center, .iframe-wrapper, .post-it");
  contentDivs.forEach(div => {
    if (enabled) {
      div.classList.add("zen-hidden");
    } else {
      div.classList.remove("zen-hidden");
    }
  });
}

function initZenMode() {
  getZenMode().then(isZen => {
    if (isZen) {
      // Apply zen mode immediately without animation
      const contentDivs = document.querySelectorAll("#upper-left, #upper-right, #lower-left, #lower-right, #center, .iframe-wrapper, .post-it");
      contentDivs.forEach(div => {
        div.style.transition = "none";
        div.classList.add("zen-hidden");
      });
      // Re-enable transitions after a frame
      requestAnimationFrame(() => {
        contentDivs.forEach(div => {
          div.style.transition = "";
        });
      });
    }
  });
}

function clearLinkHighlights() {
  // Clear keyboard shortcut highlights
  window.hasKeys = "";
  document.querySelectorAll(".quicklink-div.highlight").forEach(div => {
    div.classList.remove("highlight");
  });
  document.querySelectorAll(".quicklink.shortcut .highlight").forEach(span => {
    span.classList.remove("highlight");
  });
}

function handleCommonHashChange() {
  if (window.location.hash === "#zen") {
    getZenMode().then(currentState => {
      const newState = !currentState;
      console.info(`Toggling zen mode to ${newState} via hash`);
      setZenMode(newState);
      applyZenMode(newState);
      // Clear hash and highlights
      history.replaceState(null, null, ' ');
      clearLinkHighlights();
    });
  }

  if (window.location.hash === "#randomBackground") {
    const newExtraSeed = Math.floor(Math.random() * 1729);
    console.info(`Setting base seed to ${newExtraSeed} via hash`);
    // Clear hash first to prevent reload loop
    history.replaceState(null, null, ' ');
    clearLinkHighlights();
    try {
      chrome.storage.local.set({ extraSeed: newExtraSeed });
      location.reload();
    } catch {
      const url = new URL(window.location.href);
      url.searchParams.set("seed", newExtraSeed);
      location.href = url.toString();
    }
  }
}

setBackgroundDiv();
setPi();
setEpsilon();
initZenMode();

// Handle hash-based commands on page load
handleCommonHashChange();

// Listen for hash changes
window.addEventListener("hashchange", handleCommonHashChange, false);
