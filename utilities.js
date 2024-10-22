const DateTime = luxon.DateTime;

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
  targetDiv.addEventListener("mouseover", () => toTop(targetDiv));
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

const numMojis = [
  "&#9312;",
  "&#9313;",
  "&#9314;",
  "&#9315;",
  "&#9316;",
  "&#9317;",
  "&#9318;",
  "&#9319;"
];

function addLinksToDiv(links, targetDivId) {
  const targetDiv = document.getElementById(targetDivId);
  if (!targetDiv) {
    console.error("Target div not found:", targetDivId);
    return;
  }
  targetDiv.addEventListener("mouseover", () => toTop(targetDiv));
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
    if (event.metaKey) {
      return;
    }
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
        s.closest(".quicklink-div").classList.add("highlight");
      } else {
        Array.from(s.querySelectorAll("span")).map((l) => {
          l.classList.remove("highlight");
          s.closest(".quicklink-div").classList.remove("highlight");
        });
      }
    });

    if (window.hasKeys) {
      console.info(`Shortcut: ${shortcut}`);
      const matchingLink = links.find((link) => link.shortcut === shortcut);
      if (matchingLink) {
        window.hasKeys = ""; // This is kind of pointless though
        if (matchingLink.alsoOpen2) {
          window.open(matchingLink.url2, "_blank");
        }
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
  targetDiv.addEventListener("mouseover", () => toTop(targetDiv));
  for (let iframe of iframes) {
    const frame = document.createElement("IFRAME");
    for (const key in iframe) {
      frame.setAttribute(key, iframe[key]);
    }
    targetDiv.appendChild(frame);
  }
}

function toTop(div) {
  const allDivs = document.querySelectorAll("div");
  const zs = Array.from(allDivs)
    .map((d) => getComputedStyle(d).getPropertyValue("z-index"))
    .filter((z) => z != "auto");
  console.log(zs);
  const maxZ = Math.max(0, ...zs);
  console.log(maxZ);
  div.style.zIndex = maxZ + 1;
  console.info("Sent to top");
}

function addTasksToDiv(tasks, targetDivId) {
  const d = () => document.createElement("DIV");
  const targetDiv = document.getElementById(targetDivId);
  if (!targetDiv) {
    console.error("Target div not found:", targetDivId);
    return;
  }
  targetDiv.addEventListener("mouseover", () => toTop(targetDiv));
  let projects = [];
  targetDiv.innerHTML = "";
  let wrapperNode = d();
  wrapperNode.id = "taskWrapper";
  const maxPrio = Math.max(...tasks.map((e) => e.prio ?? 0));
  // This is to allow explicit prio = 0 to be at the bottom
  const _prio = (a) => (a.prio !== undefined ? a.prio : 1);
  for (
    let i = 0;
    i <
    tasks.sort((a, b) => _prio(b) - _prio(a) + (b.projects ? 10000 : 0)).length;
    i++
  ) {
    const task = tasks.sort((a, b) => _prio(b) - _prio(a) + (b.projects ? 10000 : 0))[i];
    if (task.settings) {
      for (const key in task.settings) {
        targetDiv.style[key] = task.settings[key];
      }
      continue;
    }
    if (task.projects) {
      projects = task.projects;
      continue;
    }
    console.info(task);
    const taskWrapper = d();
    taskWrapper.classList.add("taskRow");
    const taskText = d();
    const taskExtra = d();
    taskText.classList.add("taskText");
    taskExtra.classList.add("taskExtra");
    let text = task.text.replace("#kr", "✨ #kr");
    const extra = task.extra ? task.extra : "";
    const taskColor = task.color ? task.color : "task-default";
    const extraColor = task.extraColor ? task.extraColor : "task-extra-default";
    const link = task.link;
    taskText.style.color = `var(--${taskColor})`;
    taskExtra.style.color = `var(--${extraColor})`;
    if (task.prio) {
      const sqrr = (s) => Math.sqrt(Math.sqrt(s));
      const f = sqrr(task.prio / maxPrio);
      const fuzz = f * 40;
      taskText.style.color = `color-mix(in srgb, ${taskText.style.color} ${
        100 - fuzz
      }%, var(--light) ${fuzz}%)`;
    }
    for (let i = 0; i < projects.length; i++) {
      const _p = projects[i];
      let pproj = _p;
      if (typeof _p === "string") {
        pproj = [_p];
      }
      const color = colors[i % colors.length];
      for (let proj of pproj) {
        const adjColor = `color-mix(in srgb, var(${color}) 98%, var(--light) 2%)`;
        text = text.replace(
          proj,
          `<strong style="color: ${adjColor};">${proj}</strong>`,
        );
      }
    }
    taskText.innerHTML = text;
    taskExtra.innerHTML = extra;
    if (link) {
      taskText.addEventListener("click", (e) => (window.location.href = link));
      taskText.innerHTML += " &#128279;";
      taskText.style.cursor = "pointer";
    }
    const extralinkWrapper = document.createElement("div");
    extralinkWrapper.classList.add("extralinkWrapper");
    const links = task.links ?? [];
    for (let i = 0; i < links.length; i++) {
      const extralink = document.createElement("SPAN");
      extralink.classList.add("extralink");
      const num = numMojis[i % numMojis.length];
      extralink.innerHTML = num;
      if (typeof links[i] === "string") {
        extralink.dataset.title = links[i];
        extralink.dataset.href = links[i];
      } else {
        extralink.dataset.title = links[i][0];
        extralink.dataset.href = links[i][1];
      }
      extralinkWrapper.appendChild(extralink);
      extralink.addEventListener("click", () => {
        window.open(extralink.dataset.href, "_blank");
      });
      extralink.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        extralink.classList.remove("visited");
      });
    }
    if (task.links) {
      taskText.appendChild(extralinkWrapper);
    }
    taskWrapper.appendChild(taskText);
    taskWrapper.appendChild(taskExtra);
    wrapperNode.appendChild(taskWrapper);
  }
  targetDiv.appendChild(wrapperNode);
}
