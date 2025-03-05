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
      console.info(`Extra random seed: ${storedSeed}`);
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

function setPi() {
  const pi = document.createElement("DIV");
  pi.innerHTML = "&pi;";
  pi.id = "pi";
  pi.addEventListener("click", (ev) => {
    if (ev.altKey) {
      const newExtraSeed = Math.floor(Math.random() * 1729);
      console.log(`Setting base seed to ${newExtraSeed}`);
      try {
        chrome.storage.local.set({ extraSeed: newExtraSeed }); // Ensure key matches
        location.reload();
      } catch {
        const url = new URL(window.location.href);
        url.searchParams.set("seed", newExtraSeed);
        location.href = url.toString();
      }
    }
  });
  document.body.appendChild(pi);
}

setPi();
