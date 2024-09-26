export { addTimesToDiv, addLinksToDiv, randomBackground, addIframes };

import { DateTime } from "./libs/luxon.js";

const colors = [
  "--yellow",
  "--orange",
  "--magenta",
  "--violet",
  "--blue",
  "--green",
];

function addCurrentTimeToDiv(timezoneObj, targetDiv) {
  function updateTime() {
    const now = DateTime.now().setZone(timezoneObj.timezone);

    const formattedTime = now.toLocaleString(DateTime.TIME_24_SIMPLE);

    const name = targetDiv.querySelector(".name");
    name.textContent = timezoneObj.name;
    const time = targetDiv.querySelector(".time");
    time.textContent = formattedTime;

    // Calculate milliseconds until next minute (Luxon way)
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
  targetDiv.innerHTML = "";
  for (let i = 0; i < timezoneObjs.length; i++) {
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
    const timezoneObj = timezoneObjs[i];
    addCurrentTimeToDiv(timezoneObj, tzDiv);
  }
}

window.hasKeys = ""; // Store the first key pressed

function addLinksToDiv(links, targetDivId) {
  const targetDiv = document.getElementById(targetDivId);
  if (!targetDiv) {
    console.error("Target div not found:", targetDivId);
    return;
  }
  targetDiv.innerHTML = "";
  let wrapperNode = document.createElement("DIV");
  wrapperNode.classList.add("quicklink-column");
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (link.kind == "settings") {
      const property = link.display.split(":")[0].trim();
      const value = link.display.split(":")[1].trim();
      targetDiv.style[property] = value;
      continue;
    }
    if (link.kind == "sep") {
      const hr = document.createElement("HR");
      wrapperNode.appendChild(hr);
      continue;
    }
    if (link.kind == "col") {
      wrapperNode = document.createElement("DIV");
      wrapperNode.classList.add("quicklink-column");
      continue;
    }
    const div = document.createElement("DIV");
    div.classList.add("quicklink-div");
    let node;
    if (link.url) {
      node = document.createElement("A");
      node.href = link.url;
    } else {
      node = document.createElement("SPAN");
    }
    node.classList.add("quicklink");
    node.classList.add(link.kind);
    node.innerHTML = link.display;
    div.appendChild(node);
    if (link.url2) {
      const b = document.createElement("A");
      b.classList.add("quicklink");
      b.classList.add("extra");
      b.innerHTML = link.display2;
      b.href = link.url2;
      div.appendChild(b);
    }
    if (link.shortcut) {
      node.title = `${link.display} (${link.shortcut})`;
      const shortcutDiv = document.createElement("DIV");
      shortcutDiv.classList.add("quicklink");
      shortcutDiv.classList.add("shortcut");
      const one = link.shortcut[0];
      const two = link.shortcut[1];
      let shortcut = "[";
      for (let i = 0; i < link.shortcut.length; i++) {
        shortcut += `<span class="letter-${i}">${link.shortcut[i]}</span>`;
      }
      shortcutDiv.innerHTML = `${shortcut}]`;
      div.appendChild(shortcutDiv);
    }
    wrapperNode.appendChild(div);
    targetDiv.appendChild(wrapperNode);
  }

  document.addEventListener("keydown", function (event) {
    event.preventDefault();
    const shortcuts = document.querySelectorAll(".quicklink.shortcut");
    console.info(`Keys: ${window.hasKeys}`);
    const nextKey = event.key;
    window.hasKeys = window.hasKeys + [nextKey];
    const shortcut = window.hasKeys;
    let match = false;
    Array.from(shortcuts).map((s) => {
      if (s.textContent.startsWith(`[${shortcut}`)) {
        match = true;
        for (let i = 0; i < shortcut.length; i++) {
          s.querySelector(`span.letter-${i}`).classList.add("highlight");
        }
      } else {
        Array.from(s.querySelectorAll("span")).map((l) =>
          l.classList.remove("highlight"),
        );
      }
    });

    if (window.hasKeys) {
      console.info(`Shortcut: ${shortcut}`);
      const matchingLink = links.find((link) => link.shortcut === shortcut);
      if (matchingLink) {
        window.hasKeys = ""; // This is kind of pointless though
        window.location.href = matchingLink.url;
      } else {
        if (!match) {
          window.hasKeys = "";
        }
      }
    } else {
      window.hasKeys = [event.key];
      const matchingLink = links.find((link) => link.shortcut === event.key);

      if (matchingLink) {
        window.location.href = matchingLink.url;
        window.hasKeys = ""; // Reset firstKey after a successful match
      }
    }
  });
  targetDiv.focus();
}

function randomBackground(backgrounds) {
  const randomIndex = Math.floor(Math.random() * backgrounds.length);

  const background = backgrounds[randomIndex];
  document.body.style.backgroundImage = `url(backgrounds/${background})`;
  document.body.style.backgroundSize = "cover";
  document.body.style.repeat = "no-repeat";
}

function addIframes(iframes, targetDivId) {
  const targetDiv = document.getElementById(targetDivId);
  if (!targetDiv) {
    console.error("Target div not found:", targetDivId);
    return;
  }
  for (let iframe of iframes) {
    const frame = document.createElement("IFRAME");
    for (const key in iframe) {
      frame.setAttribute(key, iframe[key]);
    }
    targetDiv.appendChild(frame);
  }
}
