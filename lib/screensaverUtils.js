// Screensaver configuration storage
const screensaverConfigs = {};

function processScreensavers(items) {
  items.forEach((item) => {
    if (!item.title || !item.url) {
      console.warn("Screensaver missing title or url:", item);
      return;
    }

    const name = item.title.trim();
    screensaverConfigs[name] = {
      url: item.url,
      screens: parseInt(item.screens, 10) || 2,
    };

    console.info(`Registered screensaver: "${name}"`, screensaverConfigs[name]);
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
  const config = screensaverConfigs[name];
  if (!config) {
    console.error(`Screensaver "${name}" not found`);
    return;
  }

  const { url, screens } = config;

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
