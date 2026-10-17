// Screensaver configuration storage
const screensaverConfigs = {};

function findScreensaverConfig(name) {
  if (!name) return null;
  const trimmed = name.trim();
  if (screensaverConfigs[trimmed]) {
    return { name: trimmed, config: screensaverConfigs[trimmed] };
  }
  const lower = trimmed.toLowerCase();
  for (const key of Object.keys(screensaverConfigs)) {
    if (key.toLowerCase() === lower) {
      return { name: key, config: screensaverConfigs[key] };
    }
  }
  return null;
}

function processScreensavers(items) {
  items.forEach((item) => {
    if (!item.title) {
      console.warn("Screensaver missing title:", item);
      return;
    }

    const name = item.title.trim();

    if (item.url) {
      screensaverConfigs[name] = {
        url: item.url,
        screens: parseInt(item.screens, 10) || 2,
      };
      console.info(`Registered screensaver: "${name}"`, screensaverConfigs[name]);
      return;
    }

    const list = Object.keys(item).filter(
      (k) => k !== "kind" && k !== "title" && k !== "url" && k !== "screens",
    );

    if (list.length > 0) {
      if (screensaverConfigs[name]?.list) {
        screensaverConfigs[name].list.push(...list);
      } else {
        screensaverConfigs[name] = { list };
      }
      console.info(`Registered meta-screensaver: "${name}"`, screensaverConfigs[name]);
    } else {
      console.warn("Screensaver missing url or list:", item);
    }
  });
}

function appendScreenParams(url, screenIndex, totalScreens) {
  const urlObj = new URL(url, window.location.href);
  urlObj.searchParams.set("screen", screenIndex);
  urlObj.searchParams.set("screens", totalScreens);
  return urlObj.href;
}

function openScreensaverWindowFallback(url, name, index, bounds) {
  const features = `width=${bounds.width},height=${bounds.height},left=${bounds.left},top=${bounds.top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no`;

  const win = window.open(url, `screensaver_${name}_${index}`, features);

  if (!win) {
    console.warn(
      `Popup blocked for screen ${index}. Allow popups for this site.`,
    );
  }
}

function startScreensaver(name) {
  const match = findScreensaverConfig(name);

  // If name is "Random" (case-insensitive)
  if (name && name.trim().toLowerCase() === "random") {
    let pool = [];
    if (match?.config?.list && match.config.list.length > 0) {
      pool = match.config.list
        .map((k) => k.trim())
        .filter((k) => {
          if (k.toLowerCase() === "random") return false;
          const found = findScreensaverConfig(k);
          return found && found.config && found.config.url;
        });
    }

    // Fallback if list is empty or no valid candidates found
    if (pool.length === 0) {
      pool = Object.keys(screensaverConfigs).filter(
        (k) => k.toLowerCase() !== "random" && screensaverConfigs[k].url,
      );
    }

    if (pool.length === 0) {
      console.error("No valid screensavers available for Random");
      return;
    }

    const picked = pool[Math.floor(Math.random() * pool.length)];
    console.info(
      `Random screensaver selected: "${picked}" (from ${pool.length} candidates)`,
    );
    return startScreensaver(picked);
  }

  // Generic meta-screensaver with list
  if (match?.config?.list && !match.config.url) {
    const pool = match.config.list
      .map((k) => k.trim())
      .filter((k) => {
        if (k.toLowerCase() === name.trim().toLowerCase()) return false;
        const found = findScreensaverConfig(k);
        return found && found.config && found.config.url;
      });

    if (pool.length === 0) {
      console.error(
        `No valid screensavers available in meta-screensaver "${name}"`,
      );
      return;
    }

    const picked = pool[Math.floor(Math.random() * pool.length)];
    console.info(`Meta-screensaver "${name}" selected: "${picked}"`);
    return startScreensaver(picked);
  }

  if (!match || !match.config || !match.config.url) {
    console.error(`Screensaver "${name}" not found`);
    return;
  }

  const resolvedName = match.name;
  const { url, screens } = match.config;

  // Resolve relative URLs to absolute for chrome.windows.create
  const absoluteUrl = new URL(url, window.location.href).href;

  // Try chrome.system.display + chrome.windows API first (extension context)
  try {
    if (chrome?.system?.display?.getInfo && chrome?.windows?.create) {
      chrome.system.display.getInfo((displays) => {
        const totalScreens = displays.length;
        console.info(
          `Starting screensaver "${name}" on ${totalScreens} display(s): ${absoluteUrl}`,
        );
        displays.forEach((display, i) => {
          const screenUrl = appendScreenParams(absoluteUrl, i, totalScreens);
          console.info(`Display ${i} bounds:`, display.bounds);
          chrome.windows.create({
            url: screenUrl,
            type: "popup",
            left: display.bounds.left,
            top: display.bounds.top,
            width: display.bounds.width,
            height: display.bounds.height,
          });
        });
      });
      return;
    }
  } catch (e) {
    console.info(
      "chrome.system.display/windows not available, using fallback:",
      e,
    );
  }

  // Fallback: use configured screen count and assume side-by-side displays
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;

  console.info(
    `Starting screensaver "${name}" on ${screens} screen(s) (fallback): ${url}`,
  );

  for (let i = 0; i < screens; i++) {
    const screenUrl = appendScreenParams(url, i, screens);
    const bounds = {
      left: i * screenWidth,
      top: 0,
      width: screenWidth,
      height: screenHeight,
    };
    openScreensaverWindowFallback(screenUrl, name, i, bounds);
  }
}

function handleScreensaverHashChange() {
  if (window.location.hash.startsWith("#screensaver:")) {
    const name = decodeURIComponent(
      window.location.hash.substring("#screensaver:".length),
    );
    startScreensaver(name);

    // Clear hash and highlights
    window.history.replaceState(null, null, " ");
    clearLinkHighlights();
    return true;
  }
  return false;
}

window.addEventListener("hashchange", handleScreensaverHashChange, false);
