function parser(content) {
  const lines = content.split("\n");
  let current = {};
  let items = [];
  for (let line of lines) {
    if (line.startsWith("# ")) {
      if (current.kind) items.push(current);
      current = {};
      const k = line.split(" ");
      // Handle multi-word kinds like "8 ball" by taking everything after the first space
      current.kind =
        k.length > 1 ? k.slice(1).join(" ").trim().toLowerCase() : "unknown";
    }
    if (line.startsWith("## ")) {
      if (!current.kind) continue;
      if (current.hasOwnProperty("title")) {
        items.push(current);
        const k = current.kind;
        current = { kind: k };
      }
      current.title = line.split(" ").slice(1).join(" ");
    }
    if (line.startsWith("- ")) {
      if (!current.kind) continue;
      line = line.replace("- ", "").trim();
      const p = line.split(":");
      const prop = p[0]?.trim();
      const v = p.slice(1).join(":")?.trim();
      if (prop) current[prop] = v ?? "";
    }
  }
  if (current.kind) items.push(current);
  return items;
}

let countdownIntervals = [];
function clearCountdownIntervals() {
  console.info(`Clearing ${countdownIntervals.length} countdown intervals.`);
  countdownIntervals.forEach(clearInterval);
  countdownIntervals = [];
}

async function mainParser(paths) {
  console.info("mainParser (async/await version) started with paths:", paths);
  const filePaths = Array.isArray(paths) ? paths : [paths];
  const fetchPromises = [];

  filePaths.forEach((path) => {
    fetchPromises.push(
      fetch(path)
        .then((r) => (!r.ok ? Promise.reject(`HTTP ${r.status}`) : r.text()))
        .then(parser)
        .catch((e) => {
          console.error(path, e);
          return [];
        }),
    );
  });

  try {
    console.info("Waiting for all fetches/parses to complete...");
    const resultsArrays = await Promise.all(fetchPromises);
    const allItems = resultsArrays.flat();

    const itemsByKind = allItems.reduce((acc, item) => {
      if (item && item.kind) {
        const kind = item.kind;
        if (!acc[kind]) acc[kind] = [];
        acc[kind].push(item);
      }
      return acc;
    }, {});
    console.info("Items grouped by kind:", Object.keys(itemsByKind));

    const processingState = {
      countdownCounter: 0,
    };

    clearCountdownIntervals();

    if (itemsByKind["timezones"]) processTimezones(itemsByKind["timezones"]);
    if (itemsByKind["iframes"]) processIframes(itemsByKind["iframes"]);
    if (itemsByKind["replacements"])
      processReplacements(itemsByKind["replacements"]);
    if (itemsByKind["links"]) processLinks(itemsByKind["links"]);
    if (itemsByKind["quotes"]) processQuotes(itemsByKind["quotes"]);
    if (itemsByKind["backgrounds"])
      processBackgrounds(itemsByKind["backgrounds"]);
    if (itemsByKind["weather"]) processWeather(itemsByKind["weather"]);
    if (itemsByKind["sunrise/sunset"])
      processSunriseSunset(itemsByKind["sunrise/sunset"]);
    if (itemsByKind["8 ball"]) process8Ball(itemsByKind["8 ball"]);
    if (itemsByKind["screensaver"])
      processScreensavers(itemsByKind["screensaver"]);
    if (itemsByKind["countdowns"])
      processCountdowns(itemsByKind["countdowns"], processingState);
  } catch (error) {
    console.error("Error in main processing chain (async/await):", error);
  }
  setTimeout(() => {
    metaP.maxCommands = 10;
    metaP.bind(window._ntCommands, { sepia: 30 });
  }, 100);
}
