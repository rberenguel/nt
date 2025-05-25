function setupCountdownWidget(item, state) {
  console.info("WIDGET: setupCountdownWidget", { item, state });
  const globalColors = colors || ["#FFFFFF"];
  const {
    title = "Countdown",
    target: targetDateStr,
    div,
    precision = "seconds",
    kind,
    ...rest
  } = item;
  const { counter } = state;

  if (!targetDateStr || !div) {
    console.warn("Skipping countdown: missing 'target' or 'div'.", item);
    return;
  }

  let futureDate;
  try {
    const parts = targetDateStr.split(" ");
    const datePart = parts[0];
    const timePart = parts[1] || "0000";
    if (datePart.length !== 8 || timePart.length < 3 || timePart.length > 4)
      throw new Error(
        `Invalid date/time format: ${targetDateStr}. Expected YYYYMMDD H(H)MM`,
      );
    const year = parseInt(datePart.substring(0, 4));
    const month = parseInt(datePart.substring(4, 6)) - 1;
    const day = parseInt(datePart.substring(6, 8));
    const hour = parseInt(
      timePart.length === 3
        ? timePart.substring(0, 1)
        : timePart.substring(0, 2),
    );
    const minute = parseInt(
      timePart.length === 3
        ? timePart.substring(1, 3)
        : timePart.substring(2, 4),
    );
    futureDate = new Date(year, month, day, hour, minute || 0);
    if (isNaN(futureDate.getTime()))
      throw new Error("Parsed date resulted in an invalid date object");
  } catch (e) {
    console.error(`Error parsing countdown target date '${targetDateStr}':`, e);
    return;
  }

  const targetElement = document.getElementById(div);
  if (!targetElement) {
    console.error(`Countdown target element #${div} not found.`);
    return;
  }

  const d = () => document.createElement("DIV");
  const wrapper = d();
  wrapper.className = "countdown";
  const countdownTitleElement = d();
  countdownTitleElement.className = "countdown-title";
  countdownTitleElement.innerText = title;
  if (globalColors.length > 0) {
    countdownTitleElement.style.color = `var(${
      globalColors[counter % globalColors.length]
    }, #FFFFFF)`;
  }
  wrapper.appendChild(countdownTitleElement);
  const countdownDisplayElement = d();
  countdownDisplayElement.className = "countdown-item";
  wrapper.appendChild(countdownDisplayElement);
  for (const key in rest) {
    if (Object.hasOwnProperty.call(rest, key)) {
      try {
        wrapper.style[key] = rest[key];
      } catch (e) {
        console.warn(
          `Cannot apply style ${key}:${rest[key]} to countdown wrapper`,
        );
      }
    }
  }

  let intervalId = null;
  const updateCountdownInline = () => {
    const now = new Date();
    if (now >= futureDate) {
      if (countdownDisplayElement)
        countdownDisplayElement.innerText = "Time's up!";
      if (intervalId) clearInterval(intervalId);
      return;
    }

    let monthDiff =
      (futureDate.getFullYear() - now.getFullYear()) * 12 +
      (futureDate.getMonth() - now.getMonth());
    let tempCompareDate = new Date(now);
    const originalDay = now.getDate();
    tempCompareDate.setDate(1);
    tempCompareDate.setMonth(tempCompareDate.getMonth() + monthDiff);
    const daysInTargetMonth = new Date(
      tempCompareDate.getFullYear(),
      tempCompareDate.getMonth() + 1,
      0,
    ).getDate();
    tempCompareDate.setDate(Math.min(originalDay, daysInTargetMonth));
    tempCompareDate.setHours(
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    );
    if (tempCompareDate > futureDate) {
      monthDiff--;
      tempCompareDate = new Date(now);
      tempCompareDate.setDate(1);
      tempCompareDate.setMonth(tempCompareDate.getMonth() + monthDiff);
      const daysInTargetMonthAdjusted = new Date(
        tempCompareDate.getFullYear(),
        tempCompareDate.getMonth() + 1,
        0,
      ).getDate();
      tempCompareDate.setDate(Math.min(originalDay, daysInTargetMonthAdjusted));
      tempCompareDate.setHours(
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
      );
    }
    monthDiff = Math.max(0, monthDiff);
    const remainingDiffMs = futureDate.getTime() - tempCompareDate.getTime();
    if (remainingDiffMs < 0) {
      console.warn("Negative remainingDiffMs");
    }
    const remainingTotalSeconds = Math.max(
      0,
      Math.floor(remainingDiffMs / 1000),
    );
    const days = Math.floor(remainingTotalSeconds / (60 * 60 * 24));
    const hours = Math.floor(
      (remainingTotalSeconds % (60 * 60 * 24)) / (60 * 60),
    );
    const minutes = Math.floor((remainingTotalSeconds % (60 * 60)) / 60);
    const seconds = remainingTotalSeconds % 60;
    const delta = {
      months: monthDiff,
      days: days,
      hours: hours,
      minutes: minutes,
      seconds: seconds,
    };

    let deltaString = "";
    const precisionLevels = ["months", "days", "hours", "minutes", "seconds"];
    let currentPrecisionIndex = precisionLevels.indexOf(precision);
    if (currentPrecisionIndex === -1) {
      currentPrecisionIndex = precisionLevels.length - 1;
      precision = "seconds";
    }
    let foundNonZero = false;
    for (let i = 0; i < precisionLevels.length; i++) {
      const p = precisionLevels[i];
      const num = delta[p];
      let affix = p;
      if (num === 1) affix = p.slice(0, -1);
      if (num !== 0) {
        deltaString += `${num} ${affix} `;
        foundNonZero = true;
      } else if (
        foundNonZero &&
        i <= currentPrecisionIndex &&
        p !== "seconds"
      ) {
        deltaString += `${num} ${affix} `;
      }
      if (p === precision) break;
    }
    if (countdownDisplayElement) {
      countdownDisplayElement.innerText = deltaString.trim() || "Time's up!";
    } else {
      if (intervalId) clearInterval(intervalId);
    }
  };

  updateCountdownInline();
  intervalId = setInterval(updateCountdownInline, 1000);
  countdownIntervals.push(intervalId);
  targetElement.appendChild(wrapper);
}

function processCountdowns(countdownItems, state) {
  console.info(
    `HANDLER: processCountdowns called with ${countdownItems.length} item(s)`,
  );
  if (!countdownItems || countdownItems.length === 0) return;

  countdownItems.forEach((item) => {
    setupCountdownWidget(item, { counter: state.countdownCounter });
    state.countdownCounter++;
  });
}
