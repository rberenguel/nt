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

      const linkBlocks = results.flat().filter((r) => r.kind === "links");
      for (let links of linkBlocks) {
        const destination = links.div;
        delete links["div"];
        delete links["kind"];
        linksFromMarkdown(Object.keys(links), (ls) =>
          addLinksToDiv(ls, destination),
        );
      }

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
            const hours = d.getHours();
            const minutes = d.getMinutes();
            const seconds = d.getSeconds();

            const formattedHours = String(hours).padStart(2, "0");
            const formattedMinutes = String(minutes).padStart(2, "0");
            const formattedSeconds = String(seconds).padStart(2, "0");

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

            const futureDate = new Date(year, month, day, hour, minute);

            if (now >= futureDate) {
              if (countdown) {
                countdown.innerText = "Time's up!";
              }
              return;
            }

            let monthDiff =
              (futureDate.getFullYear() - now.getFullYear()) * 12 +
              (futureDate.getMonth() - now.getMonth());
            let tempCompareDate = new Date(now);

            tempCompareDate.setMonth(tempCompareDate.getMonth() + monthDiff, 1);

            const daysInTargetMonth = new Date(
              tempCompareDate.getFullYear(),
              tempCompareDate.getMonth() + 1,
              0,
            ).getDate();
            const targetDay = Math.min(now.getDate(), daysInTargetMonth);
            tempCompareDate.setDate(targetDay);

            tempCompareDate.setHours(
              now.getHours(),
              now.getMinutes(),
              now.getSeconds(),
              now.getMilliseconds(),
            );

            if (tempCompareDate > futureDate) {
              monthDiff--;

              tempCompareDate = new Date(now);
              tempCompareDate.setMonth(
                tempCompareDate.getMonth() + monthDiff,
                1,
              );
              const daysInTargetMonthAdjusted = new Date(
                tempCompareDate.getFullYear(),
                tempCompareDate.getMonth() + 1,
                0,
              ).getDate();
              const targetDayAdjusted = Math.min(
                now.getDate(),
                daysInTargetMonthAdjusted,
              );
              tempCompareDate.setDate(targetDayAdjusted);
              tempCompareDate.setHours(
                now.getHours(),
                now.getMinutes(),
                now.getSeconds(),
                now.getMilliseconds(),
              );
            }

            monthDiff = Math.max(0, monthDiff);

            const remainingDiffMs =
              futureDate.getTime() - tempCompareDate.getTime();

            if (remainingDiffMs < 0) {
              console.warn(
                "Negative remainingDiffMs after month calculation, potential edge case.",
              );
            }

            const remainingTotalSeconds = Math.floor(remainingDiffMs / 1000);
            const remainingTotalMinutes = Math.floor(
              remainingTotalSeconds / 60,
            );
            const remainingTotalHours = Math.floor(remainingTotalMinutes / 60);

            const days = Math.max(0, Math.floor(remainingTotalHours / 24));
            const hours = Math.max(0, remainingTotalHours % 24);
            const minutes = Math.max(0, remainingTotalMinutes % 60);
            const seconds = Math.max(0, remainingTotalSeconds % 60);

            const delta = {
              months: monthDiff,
              days: days,
              hours: hours,
              minutes: minutes,
              seconds: seconds,
            };

            let deltaString = "";
            let foundNonZero = false;

            for (let p of ["months", "days", "hours", "minutes", "seconds"]) {
              const num = delta[p];
              let affix = p;
              if (num === 1) {
                affix = p.slice(0, -1);
              }
              if (num != 0) {
                deltaString += `${num} ${affix} `;
                foundNonZero = true;
              } else if (
                foundNonZero &&
                precision !== "months" &&
                precision !== "days" &&
                p !== "seconds"
              ) {
              }

              if (precision === p) {
                break;
              }
            }

            if (countdown) {
              countdown.innerText = deltaString.trim() || "Time's up!";
            }
          };

          if (target) {
            updateCountdownInline();
            setInterval(updateCountdownInline, 1000);
          }
          for (const key in rest) {
            wrapper.style[key] = rest[key];
          }
        }
      }
    })
    .catch((error) => console.error("Error loading markdown file:", error));
}
