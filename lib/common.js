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

function toTop(div) {
  const allDivs = document.querySelectorAll("div");
  const zs = Array.from(allDivs)
    .map((d) => getComputedStyle(d).getPropertyValue("z-index"))
    .filter((z) => z != "auto");
  const maxZ = Math.max(0, ...zs);
  div.style.zIndex = maxZ + 1;
}
