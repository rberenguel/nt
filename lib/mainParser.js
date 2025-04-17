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
      current.title = line.split(" ").slice(1).join(" ");
      console.log(line);
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
      let countedCountdowns = 0;
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
        // TODO countdowns is super long here
        if (item.kind === "countdowns") {
          countedCountdowns++;
          console.log(item);
          const title = item.title;
          console.log(item);
          const _target = item.target;
          const div = item.div;
          const precision = item.precision;
          console.log(precision);
          let rest = { ...item };
          delete rest[title];
          delete rest[_target];
          delete rest[precision];
          delete rest[div];
          const [datePart, timePart] = _target.split(" ");
          const year = parseInt(datePart.substring(0, 4));
          const month = parseInt(datePart.substring(4, 6)) - 1;
          const day = parseInt(datePart.substring(6, 8));
          const hour = parseInt(
            timePart.length === 3
              ? timePart.substring(0, 1)
              : timePart.substring(0, 2),
          );
          const minute =
            parseInt(
              timePart.length === 3
                ? timePart.substring(1, 3)
                : timePart.substring(2, 4),
            ) || 0;
          const futureDate = new Date(year, month, day, hour, minute);

          const target = document.getElementById(div);
          let wrapper;
          let countdown, countdownTitle;

          if (target) {
            const d = () => document.createElement("DIV");
            wrapper = d();
            wrapper.classList.add("countdown");
            target.appendChild(wrapper);
            countdownTitle = d();
            countdownTitle.classList.add("countdown-title");
            countdownTitle.innerText = title;
            countdownTitle.style.color = `var(${colors[countedCountdowns % colors.length]})`;
            wrapper.appendChild(countdownTitle);
            countdown = d();
            countdown.classList.add("countdown-item");
            wrapper.appendChild(countdown);
          }

          const updateCountdownInline = () => {
            const now = new Date();
            const diffInMilliseconds = futureDate.getTime() - now.getTime();

            const seconds = Math.floor(diffInMilliseconds / 1000) % 60;
            const minutes = Math.floor(diffInMilliseconds / (1000 * 60)) % 60;
            const hours =
              Math.floor(diffInMilliseconds / (1000 * 60 * 60)) % 24;
            const totalDays = Math.floor(
              diffInMilliseconds / (1000 * 60 * 60 * 24),
            );

            const futureYear = futureDate.getFullYear();
            const futureMonth = futureDate.getMonth();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            const currentDay = now.getDate();
            const futureDay = futureDate.getDate();

            let months =
              (futureYear - currentYear) * 12 + (futureMonth - currentMonth);

            // Adjust months if the day of the month has not yet occurred
            if (currentDay > futureDay) {
              months--;
            }

            // Calculate the number of days remaining after the calculated months
            let days = 0;
            const tempDate = new Date(
              currentYear,
              currentMonth + months,
              currentDay,
            );
            const remainingDiff = futureDate.getTime() - tempDate.getTime();
            days = Math.floor(remainingDiff / (1000 * 60 * 60 * 24));

            const delta = {
              months: months < 0 ? 0 : months,
              days: days < 0 ? 0 : days,
              hours: hours < 0 ? 0 : hours,
              minutes: minutes < 0 ? 0 : minutes,
              seconds: seconds < 0 ? 0 : seconds,
            };

            let deltaString = "";

            for (let p of ["months", "days", "hours", "minutes", "seconds"]) {
              const num = delta[p];
              let affix = p;
              if (num === 1) {
                affix = p.slice(0, -1);
              }
              if (num != 0) {
                deltaString += `${num} ${affix} `;
              }

              if (precision === p) {
                break;
              }
            }

            if (countdown) {
              countdown.innerText = deltaString || "Time's up!";
            }
          };

          // Assuming this is inside your larger function where the page is constructed
          if (target) {
            updateCountdownInline(); // Call it once to set the initial value
            setInterval(updateCountdownInline, 1000); // Call it every second to update
          }
          for (const key in rest) {
            wrapper.style[key] = rest[key];
          }
        }
      }
    })
    .catch((error) => console.error("Error loading markdown file:", error));
}
