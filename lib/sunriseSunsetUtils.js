function displaySunriseSunset(item) {
  console.info("WIDGET: displaySunriseSunset", { item });
  const { title, lat, lon, div, kind, ...rest } = item;

  if (typeof SunCalc === "undefined")
    return console.error("Dependency check failed: 'SunCalc' is undefined.");
  if (!lat || !lon || !div) {
    console.warn("Skipping sunrise/sunset: missing lat, lon, or div.", item);
    return;
  }

  const target = document.getElementById(div);
  if (!target) {
    console.error(`Target element #${div} for sunrise/sunset not found.`);
    return;
  }

  const formatTime = (d) => {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return "--:--:--";
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  try {
    const sunTimes = SunCalc.getTimes(new Date(), lat, lon);
    const d = () => document.createElement("DIV");
    const wrapper = d();
    wrapper.className = "sunrise-sunset";
    const sunriseEl = d();
    sunriseEl.className = "sunrise";
    sunriseEl.textContent = formatTime(sunTimes.sunrise);
    wrapper.appendChild(sunriseEl);
    const sunsetEl = d();
    sunsetEl.className = "sunset";
    sunsetEl.textContent = formatTime(sunTimes.sunset);
    wrapper.appendChild(sunsetEl);
    for (const key in rest) {
      if (Object.hasOwnProperty.call(rest, key)) {
        try {
          wrapper.style[key] = rest[key];
        } catch (e) {
          console.warn(
            `Cannot apply style ${key}:${rest[key]} to sunrise/sunset`,
          );
        }
      }
    }
    target.appendChild(wrapper);
  } catch (error) {
    console.error(
      "Error calculating or displaying sunrise/sunset:",
      error,
      item,
    );
  }
}

function processSunriseSunset(sunriseItems) {
  console.info(
    `HANDLER: processSunriseSunset called with ${sunriseItems.length} item(s)`,
  );
  if (!sunriseItems || sunriseItems.length === 0) return;
  // Dependency check for SunCalc happens inside displaySunriseSunset

  sunriseItems.forEach((item) => displaySunriseSunset(item));
}
