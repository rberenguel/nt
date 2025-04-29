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
            // Assuming year, month, day, hour, minute are defined correctly earlier as in your original code
            const futureDate = new Date(year, month, day, hour, minute);

            // Ensure the futureDate is actually in the future
            if (now >= futureDate) {
              if (countdown) {
                // Check if countdown element exists
                countdown.innerText = "Time's up!";
              }
              return; // Stop the update if the time has passed
            }

            // --- Start of Revised Calculation Logic ---

            let diffInMilliseconds = futureDate.getTime() - now.getTime();

            // 1. Calculate Month Difference
            let monthDiff =
              (futureDate.getFullYear() - now.getFullYear()) * 12 +
              (futureDate.getMonth() - now.getMonth());
            let tempCompareDate = new Date(now);
            // Be cautious setting month directly if day is > days in target month
            // A safer way might be to set date to 1 first, then month, then check original day
            tempCompareDate.setMonth(tempCompareDate.getMonth() + monthDiff, 1); // Set date to 1 to avoid month overflow issues initially

            // Adjust target day if it exceeds days in the calculated month
            const daysInTargetMonth = new Date(
              tempCompareDate.getFullYear(),
              tempCompareDate.getMonth() + 1,
              0,
            ).getDate();
            const targetDay = Math.min(now.getDate(), daysInTargetMonth);
            tempCompareDate.setDate(targetDay);

            // Restore original time components from 'now'
            tempCompareDate.setHours(
              now.getHours(),
              now.getMinutes(),
              now.getSeconds(),
              now.getMilliseconds(),
            );

            // Adjust monthDiff if adding it overshoots the target date/time
            if (tempCompareDate > futureDate) {
              monthDiff--;
              // Recalculate tempCompareDate with the adjusted monthDiff
              tempCompareDate = new Date(now);
              tempCompareDate.setMonth(
                tempCompareDate.getMonth() + monthDiff,
                1,
              ); // Set date to 1
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

            // Ensure monthDiff is not negative
            monthDiff = Math.max(0, monthDiff);

            // 2. Calculate Remaining Difference after subtracting full months
            // Use the adjusted tempCompareDate for calculating the remaining time
            const remainingDiffMs =
              futureDate.getTime() - tempCompareDate.getTime();

            // Check for edge cases where remainingDiffMs might be slightly negative due to precision
            if (remainingDiffMs < 0) {
              // This might happen if the calculation lands extremely close to the month boundary
              // Consider handling this case, e.g., by recalculating days/hours/mins/secs based on total diff if months are 0
              // For now, let's proceed assuming remainingDiffMs is >= 0 after month adjustment logic
              console.warn(
                "Negative remainingDiffMs after month calculation, potential edge case.",
              );
            }

            // 3. Calculate Days, Hours, Minutes, Seconds from the *remaining* difference
            const remainingTotalSeconds = Math.floor(remainingDiffMs / 1000);
            const remainingTotalMinutes = Math.floor(
              remainingTotalSeconds / 60,
            );
            const remainingTotalHours = Math.floor(remainingTotalMinutes / 60);

            const days = Math.max(0, Math.floor(remainingTotalHours / 24)); // Ensure non-negative
            const hours = Math.max(0, remainingTotalHours % 24); // Ensure non-negative
            const minutes = Math.max(0, remainingTotalMinutes % 60); // Ensure non-negative
            const seconds = Math.max(0, remainingTotalSeconds % 60); // Ensure non-negative

            // --- End of Revised Calculation Logic ---

            const delta = {
              months: monthDiff, // Corrected: Use monthDiff
              days: days, // No need for < 0 check, handled above
              hours: hours, // No need for < 0 check
              minutes: minutes, // No need for < 0 check
              seconds: seconds, // No need for < 0 check
            };

            // --- String formatting remains the same ---
            let deltaString = "";
            let foundNonZero = false; // Flag to check if we found any non-zero component

            for (let p of ["months", "days", "hours", "minutes", "seconds"]) {
              const num = delta[p];
              let affix = p;
              if (num === 1) {
                affix = p.slice(0, -1); // Singular form
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
                // Optionally add zero components like '0 hours' if needed
                // Only if a higher unit was non-zero and it's not the last unit (or precision demands it)
                // Example: "1 month 0 days 5 hours..."
                // deltaString += `${num} ${affix} `;
              }

              // Stop if the desired precision is reached
              if (precision === p) {
                break;
              }
            }

            if (countdown) {
              // Check if countdown element exists
              // Trim trailing space and handle the case where all components are zero
              countdown.innerText = deltaString.trim() || "Time's up!";
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
