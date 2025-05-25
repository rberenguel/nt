function addCurrentTimeToDiv(timezoneObj, targetDiv) {
  function updateTime() {
    const now = DateTime.now().setZone(timezoneObj.timezone);

    const formattedTime = now.toLocaleString(DateTime.TIME_24_SIMPLE);

    const name = targetDiv.querySelector(".name");
    name.textContent = timezoneObj.name;
    const time = targetDiv.querySelector(".time");
    time.textContent = formattedTime;

    const millisecondsUntilNextMinute =
      60000 - (now.second * 1000 + now.millisecond);

    setTimeout(updateTime, millisecondsUntilNextMinute);
  }

  updateTime();
}

function addTimesToDiv(timezoneObjs, targetDivId) {
  const targetDiv = document.getElementById(targetDivId);
  if (!targetDiv) {
    console.error("Target div not found:", targetDivId);
    return;
  }
  targetDiv.addEventListener("mouseover", () => toTop(targetDiv));
  targetDiv.innerHTML = "";
  for (let i = 0; i < timezoneObjs.length; i++) {
    const timezoneObj = timezoneObjs[i];
    if (timezoneObj.settings) {
      for (const key in timezoneObj.settings) {
        targetDiv.style[key] = timezoneObj.settings[key];
      }
      continue;
    }
    const id = `timezone-${i}`;
    const tzDiv = document.createElement("DIV");
    tzDiv.id = id;
    tzDiv.classList.add("timezone");

    const nameDiv = document.createElement("DIV");
    nameDiv.style.color = `var(${colors[i % colors.length]})`;
    nameDiv.classList.add("name");
    tzDiv.appendChild(nameDiv);
    const timeDiv = document.createElement("DIV");
    timeDiv.classList.add("time");
    tzDiv.appendChild(timeDiv);
    targetDiv.appendChild(tzDiv);
    addCurrentTimeToDiv(timezoneObj, tzDiv);
  }
}

function processTimezones(timezoneItems) {
  console.info(
    `HANDLER: processTimezones called with ${timezoneItems.length} item(s)`,
  );
  if (!timezoneItems || timezoneItems.length === 0) return;
  if (typeof addTimesToDiv !== "function")
    return console.error(
      "Dependency check failed inside processTimezones: 'addTimesToDiv' is not a function.",
    );
  let mergedTimezones = [];
  let settingsItem = timezoneItems[0];
  let settings = settingsItem ? { ...settingsItem } : {};
  delete settings["title"];
  delete settings["tz"];
  delete settings["kind"];
  delete settings["div"];
  if (settingsItem && Object.keys(settings).length > 0)
    mergedTimezones.push({ settings: settings });
  for (let tz of timezoneItems) {
    if (tz.tz && tz.title)
      mergedTimezones.push({ timezone: tz.tz, name: tz.title });
  }
  if (
    settingsItem?.div &&
    mergedTimezones.length > (settingsItem.hasOwnProperty("settings") ? 1 : 0)
  ) {
    console.info("Calling addTimesToDiv...");
    addTimesToDiv(mergedTimezones, settingsItem.div);
  } else if (mergedTimezones.length > 0) {
    console.warn(
      "Could not process timezones fully: Missing target div or data incomplete.",
    );
  } else {
    console.warn("No valid timezone entries found to process.");
  }
}
