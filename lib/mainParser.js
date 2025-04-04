function parser(content) {
  const lines = content.split("\n");
  let current = {};
  let items = [];
  for (let line of lines) {
    if (line.startsWith("# ")) {
      if (current.kind) {
        items.push(current);
      }
      current = {};
      current.kind = line.split(" ")[1].toLowerCase();
    }
    if (line.startsWith("## ")) {
      if (current.title) {
        items.push(current);
        const kind = current.kind;
        current = { kind: kind };
      }
      current.title = line.split(" ")[1];
    }
    if (line.startsWith("- ")) {
      line = line.replace("- ", "").trim();
      const property = line.split(":")[0].trim();
      const value = line.split(":")[1]?.trim();
      current[property] = value;
    }
  }
  items.push(current);
  return items;
}

function mainParser(paths) {
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
          return parser(markdown);
        }),
    );
  });

  Promise.all(promises)
    .then((results) => {
      // Handle timezones
      const tzs = results.flat().filter((r) => r.kind === "timezones");
      let mergedTimezones = [];
      let settings = { ...tzs[0] };
      delete settings["title"];
      delete settings["tz"];
      delete settings["kind"];
      delete settings["div"];
      mergedTimezones.push({ settings: settings });
      for (let tz of tzs) {
        mergedTimezones.push({ timezone: tz.tz, name: tz.title });
      }
      addTimesToDiv(mergedTimezones, tzs[0].div);
      // Handle replacements (only one block possible… and should be before links)
      {
        const replacements = results
          .flat()
          .filter((r) => r.kind === "replacements")[0];
        if (replacements) {
          delete replacements["kind"];
          replacementsFromMarkdown(Object.keys(replacements), (b) => {
            metaP.bind(b, { sepia: 30 });
          });
        }
      }
      // Handle links
      const linkBlocks = results.flat().filter((r) => r.kind === "links");
      for (let links of linkBlocks) {
        const destination = links.div;
        delete links["div"];
        delete links["kind"];
        linksFromMarkdown(Object.keys(links), (ls) =>
          addLinksToDiv(ls, destination),
        );
      }

      // Handle quotes
      const qfm = (files, target, today) =>
        quotesFromMarkdown(
          files,
          (ts) => {
            addQuotesToDiv({
              quotes: ts,
              target: target,
              today: today,
            });
          },
          (basepath = ""),
        );
      const quoteBlocks = results.flat().filter((r) => r.kind === "quotes");
      for (let quotes of quoteBlocks) {
        const target = quotes.div;
        const today = quotes.today;
        delete quotes["div"];
        delete quotes["today"];
        delete quotes["kind"];
        qfm(Object.keys(quotes), target, today != "false");
      }

      // Handle backgrounds (only one possible)
      {
        const backgrounds = results
          .flat()
          .filter((r) => r.kind === "backgrounds")[0];

        const today = backgrounds.today;
        delete backgrounds["today"];
        delete backgrounds["kind"];
        backgroundsFromMarkdown(Object.keys(backgrounds), (b) => {
          randomBackground({
            backgrounds: b,
            today: today != "false",
          });
        });
      }
      // Handle weather (why a for? It's annoying)
      for (let item of results.flat()) {
        if (item.kind === "weather") {
          const title = item.title;
          const lat = item.lat;
          const lon = item.lon;
          const div = item.div;
          let rest = { ...item };
          delete rest[title];
          delete rest[lat];
          delete rest[lon];
          delete rest[div];
          plotWeather(title, { lat: lat, long: lon }, div, rest);
        }
        if (item.kind === "sunrise/sunset") {
          console.log(item);
          const title = item.title;
          const lat = item.lat;
          const lon = item.lon;
          const div = item.div;
          let rest = { ...item };
          delete rest[title];
          delete rest[lat];
          delete rest[lon];
          delete rest[div];
          const suncalc = SunCalc.getTimes(new Date(), lat, lon);
          const formatTime = (d) => {
            const hours = d.getHours(); // Returns 0-23
            const minutes = d.getMinutes(); // Returns 0-59
            const seconds = d.getSeconds(); // Returns 0-59

            // Format each component with a leading zero if it's less than 10
            // padStart(targetLength, padString) adds padding to the start
            const formattedHours = String(hours).padStart(2, "0");
            const formattedMinutes = String(minutes).padStart(2, "0");
            const formattedSeconds = String(seconds).padStart(2, "0");

            // Combine them with colons

            return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
          };
          const target = document.getElementById(div);
          const d = () => document.createElement("DIV");
          const wrapper = d();
          wrapper.classList.add("sunrise-sunset");
          target.appendChild(wrapper);
          const sunrise = d();
          sunrise.classList.add("sunrise");
          sunrise.innerText = formatTime(suncalc.sunrise);
          const sunset = d();
          sunset.classList.add("sunset");
          sunset.innerText = formatTime(suncalc.sunset);
          wrapper.appendChild(sunrise);
          wrapper.appendChild(sunset);
          for (const key in rest) {
            console.log(key);
            wrapper.style[key] = rest[key];
          }
        }
      }
    })
    .catch((error) => console.error("Error loading markdown file:", error));
}
