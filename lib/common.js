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

function getDailyRandom(n) {
  const today = new Date();
  const daySeed = formatDateToSeed(today); // Get a seed based on the date

  // Simple hashing function (you could use a more robust one if needed)
  let hash = 0;
  for (let i = 0; i < daySeed.length; i++) {
    const char = daySeed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Linear Congruential Generator (LCG) - using hash as seed
  const a = 1664525; // Multiplier
  const c = 1013904223; // Increment
  const m = Math.pow(2, 32); // Modulus (2^32 for 32-bit integer)

  let seed = hash; // Initialize the seed with the hash of the date

  function seededRandom() {
    seed = (a * seed + c) % m;
    return seed / m; // Returns a float between 0 and 1
  }

  const randomIndex = Math.floor(seededRandom() * n);
  return randomIndex;
}

function formatDateToSeed(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Month is 0-indexed
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`; // Format: YYYY-MM-DD
}
