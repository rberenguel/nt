// Chooses a random background for the path provided.
// Assumes the folder is _something_/backgrounds/filenames but accepts
// intermediate paths. If this does not suit you, just edit the url
// below.

const setBackgroundByIndex = (backgrounds, idx, path) => {
  const background = backgrounds[idx];
  const bgDiv = document.getElementById("background");
  if (bgDiv) {
    bgDiv.style.backgroundImage = `url(${path}/backgrounds/${background})`;
    bgDiv.style.backgroundSize = "cover";
    bgDiv.style.backgroundRepeat = "no-repeat";
  }
};

function randomBackground(opts = {}) {
  const backgrounds = opts.backgrounds;
  const path = opts.path ?? ".";
  const today = opts.today;
  let randomIndex = Math.floor(Math.random() * backgrounds.length);
  if (today) {
    getDailyRandom(backgrounds.length, (randomIndex) => {
      setBackgroundByIndex(backgrounds, randomIndex, path);
    });
  } else {
    setBackgroundByIndex(backgrounds, randomIndex, path);
  }
}

function backgroundsFromMarkdown(paths, cb) {
  const promises = [];

  // Handle single string or array of strings
  if (typeof paths === "string") {
    paths = [paths];
  }

  paths.forEach((path) => {
    promises.push(
      fetch(path)
        .then((response) => response.text())
        .then((markdown) => {
          let backgrounds = [];
          const lines = markdown.split("\n");
          for (let line of lines) {
            if (line.startsWith("- ")) {
              backgrounds.push(line.replace("- ", "").trim());
            }
          }
          return backgrounds;
        }),
    );
  });

  Promise.all(promises)
    .then((results) => {
      // Flatten the array of arrays into a single array of tasks
      cb(results.flat());
    })
    .catch((error) => console.error("Error loading markdown file:", error));
}

function processBackgrounds(backgroundItems) {
  console.info(
    `HANDLER: processBackgrounds called with ${backgroundItems.length} item(s)`,
  );
  const backgrounds = backgroundItems?.[0];
  if (!backgrounds) {
    console.warn("No background items found.");
    return;
  }
  console.info("Processing background item:", backgrounds);
  if (
    typeof backgroundsFromMarkdown !== "function" ||
    typeof randomBackground !== "function"
  )
    return console.error(
      "Dependency check failed inside processBackgrounds: 'backgroundsFromMarkdown' or 'randomBackground'.",
    );
  const today = backgrounds.today !== "false";
  const backgroundKeys = Object.keys(backgrounds).filter(
    (k) => k !== "kind" && k !== "title" && k !== "div" && k !== "today",
  );
  if (backgroundKeys.length > 0) {
    console.info("Calling backgroundsFromMarkdown with keys:", backgroundKeys);
    backgroundsFromMarkdown(backgroundKeys, (b) => {
      randomBackground({ backgrounds: b, today: today });
    });
  } else {
    console.warn("No actual background keys found in background item.");
  }
}
