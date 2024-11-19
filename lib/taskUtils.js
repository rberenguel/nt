/*

Given a list of tasks, they will be added with custom formatting to targetDivId.

This has a lot of features, so I'll try to just list them. Most are controlled
by properties of a task object / task definition text or as part of one.

Tasks can be defined either as JS objects or in markdown-like structured text.

- Tasks are ordered by priority, if not provided priority is 1. Use negative numbers to place at the end of the list.
- Tasks can be marked as done, then they are placed at priority -42 and with custom styling for them.
- Tasks can have a main link and sub-links.
- The idea is that sublinks correspond to sub-items (like, watch video 1 out of N).
- If the URL of a sublink starts with `check-` it will be treated as a checkmark.
- Whether sublinks have ever been clicked is tracked in Chrome's extension storage.
  - Right clicking a sublink unsets this.
- Settings for formatting can be passed as a "task", any CSS property defined there will be applied to the wrapping div.
- A list of projects can be passed as a "task". This can be a list of strings or a list of lists of strings.
  - When the keyword is found in a task text it will have a different color and styling.
  - If a task ends in .project (for a particular project name) the whole task will be of the project color (and the project name will be removed)
  - Strings in the same sublist share the same color.
- A task can have a "message" that is displayed on hover. Useful for done tasks. Can be used as a "log".
- You can add a "hr task" to display a separator.
  - It can be styled with color and message and have priority. Useful to split by priority.
- A task can have a main text and "extra text". Extra text is for additional context.

Some examples from my task list in Javascript:
  {
    settings: {
      backgroundColor: "var(--grey-trans)",
      fontSize: "2vh",
      borderRadius: "0.2em",
    },
  },
  {
    projects: [
      ["Inktober", "drawing", "Drawing"],
      "Post",
      ["Weave", "NT"],
    ],
  },
  {
    text: "Weave: persistent file access",
    extra: "",
    color: "red",
    prio: 3,
  },
  {
    text: "Inktober",
    links: [
      ["27", "check-27"],
      ["28", "check-28"],
      ["29", "check-29"],
      ["30", "check-30"],
      ["31", "check-31"],
      ["final post", "check-final-post"],
    ],
    prio: 12,
    msg: "success",
    done: true,
  },

Some equivalences in markdown. The format should be kind of obvious compared with
the objects above:

# Settings

- backgroundColor: var(--grey-trans)
- fontSize: 2vh
- borderRadius: 0.2em

---

# Projects

- Inktober, drawing, Drawing
- Post
- Backgammon

---

# Weave: persistent file access
prio: 3
color: red

---

# Inktober

[x]
prio: 12

- [27](check-27)
- [28](check-28)
- [29](check-29)
- [30](check-30)
- [31](check-31)

- Success

*/

const linkHandler = (e) => {
  window.location.href =
    e.target.closest(`[data-destination]`).dataset["destination"];
};

function tasksFromMarkdown(paths, cb, basepath) {
  // By providing a basepath, shift + right clicking on the task opens VS Code at the
  // exact task heading
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
          let tasks = [];
          const headingLineNumbers = markdown
            .split("\n")
            .map((line, index) => (line.startsWith("#") ? index + 1 : null))
            .filter((number) => number !== null);
          const blocks = markdown.split(/---/);
          for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            let obj = textToObject(block, (hPos = headingLineNumbers[i]));
            console.log(basepath);
            if (basepath) {
              obj = textToObject(
                block,
                (hPos = headingLineNumbers[i]),
                (filepath = basepath + path),
              );
            }

            if (!obj._valid) {
              tasks.push({
                text: `Error loading task ${i} from file ${path}`,
                error: true,
              });
              continue;
            }
            tasks.push(obj);
          }
          return tasks;
        }),
    );
  });

  Promise.all(promises)
    .then((results) => {
      // Flatten the array of arrays into a single array of tasks
      const allTasks = results.flat();
      window._tasks = allTasks;
      cb(allTasks);
    })
    .catch((error) => console.error("Error loading markdown file:", error));
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function addTasksToDiv(_tasks, targetDivId) {
  const tasks = shuffleArray(_tasks);
  const d = () => document.createElement("DIV");
  const targetDiv = document.getElementById(targetDivId);
  if (!targetDiv) {
    console.error("Target div not found:", targetDivId);
    return;
  }
  let addedDoneSeparator = false;
  let someday = false;
  let reference = false;
  targetDiv.addEventListener("mouseover", () => toTop(targetDiv));
  let projects = [];
  let wrapperNode = d();
  wrapperNode.id = "taskWrapper";
  const maxPrio = Math.max(...tasks.map((e) => e.prio ?? 0));
  // This is to allow explicit prio = 0 to be at the bottom
  const _prio = (a) => {
    if (a.projects) {
      return 10000;
    }
    if (a.done) {
      return -42;
    }
    if (a.prio !== undefined) {
      return a.prio;
    }
    return 1;
  };
  const sorted = tasks.sort((a, b) => _prio(b) - _prio(a));
  window._sorted_tasks = sorted;
  for (let i = 0; i < sorted.length; i++) {
    const task = sorted[i];
    if (task.settings) {
      for (const key in task.settings) {
        wrapperNode.style[key] = task.settings[key];
      }
      continue;
    }
    if (task.projects) {
      projects = projects.concat(task.projects);
      continue;
    }
    const taskWrapper = d();
    taskWrapper.classList.add("taskRow");
    if (task.prio) {
      taskWrapper.dataset.prio = task.prio;
    }
    if (task.msg) {
      let msgs = task.msg;
      if (typeof msgs === "string") {
        msgs = [task.msg];
      }
      taskWrapper.dataset.title = msgs.join("\n");
    }
    if (task.hr) {
      addHr(wrapperNode, task);
      continue;
    }
    if (task.error) {
      taskWrapper.classList.add("error");
    }
    const taskText = d();
    const taskExtra = d();
    taskText.classList.add("taskText");
    const taskTitle = d();
    taskTitle.classList.add("taskTitle");
    taskText.appendChild(taskTitle);
    taskExtra.classList.add("taskExtra");
    let text = task.text.replace("#kr", "&#x2728; #kr");
    const extra = task.extra ? task.extra : "";
    const taskColor = task.color ? task.color : "task-default";
    const extraColor = task.extraColor ? task.extraColor : "task-extra-default";
    const link = task.link;
    taskText.style.color = `var(--${taskColor})`;
    taskExtra.style.color = `var(--${extraColor})`;
    if (task.prio) {
      const prio = task.prio > 0 ? task.prio : 0;
      const sqrr = (s) => Math.sqrt(Math.sqrt(s));
      const f = sqrr(prio / maxPrio);
      const fuzz = f * 40;
      taskText.style.color = `color-mix(in srgb, ${taskText.style.color} ${
        100 - fuzz
      }%, var(--light) ${fuzz}%)`;
    }
    if (task.someday && !task.done) {
      taskWrapper.classList.add("someday", "hide");
      someday = true; // Global catch for "there is someday"
    }
    if (task.reference) {
      taskWrapper.classList.add("reference", "hide");
      reference = true; // Global catch for "there are references"
    }
    for (let i = 0; i < projects.length; i++) {
      const _p = projects[i];
      let pproj = _p;
      if (typeof _p === "string") {
        pproj = [_p];
      }
      const color = colors[i % colors.length];

      for (let proj of pproj) {
        const full = `.${proj}`;
        const adjColor = `color-mix(in srgb, var(${color}) 98%, var(--light) 2%)`;
        if (text.endsWith(full)) {
          text = text.replace(full, "");
          text = `<span style="color: ${adjColor};">${text}</span>`;
        } else {
          text = text.replace(
            proj,
            `<strong style="color: ${adjColor};">${proj}</strong>`,
          );
        }
      }
    }
    taskTitle.innerHTML = text;
    taskExtra.innerHTML = extra;
    taskTitle.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.ctrlKey) {
        if (task._filepath) {
          window.open(`vscode://file/${task._filepath}:${task._hPos}`);
        }
        return;
      }
      const allRows = Array.from(document.querySelectorAll(".taskRow"));
      let skip = false;
      if (taskWrapper.classList.contains("highlight")) {
        skip = true;
        taskWrapper.classList.remove("highlight");

        taskWrapper.classList.add("dim");

        try {
          chrome.storage.local.get(["highlighted"], (data) => {
            const highlighted = data.highlighted || {};
            highlighted[taskWrapper.textContent] = false;
            chrome.storage.local.set({ highlighted });
          });
        } catch {}
      }

      const allHighlights = allRows.filter((r) =>
        r.classList.contains("highlight"),
      );

      if (allHighlights.length == 0) {
        allRows.map((t) => {
          t.classList.remove("dim");
        });
      }

      if (skip) {
        return;
      }

      taskWrapper.classList.remove("dim");
      taskWrapper.classList.add("highlight");

      try {
        chrome.storage.local.get(["highlighted"], (data) => {
          const highlighted = data.highlighted || {};
          highlighted[taskWrapper.textContent] = true;
          chrome.storage.local.set({ highlighted });
        });
      } catch {}

      allRows.map((t) => {
        if (t != taskWrapper) {
          if (!t.classList.contains("highlight")) t.classList.add("dim");
        }
      });
    });
    if (link) {
      taskTitle.dataset["destination"] = link;
      taskTitle._clickHandler = linkHandler;
      taskTitle.addEventListener("click", taskTitle._clickHandler);
      taskTitle.innerHTML += " &#128279;";
      taskTitle.style.cursor = "pointer";
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
        try {
          chrome.storage.local.get(["visitedLinks"], (data) => {
            const visitedLinks = data.visitedLinks || {};
            visitedLinks[extralink.dataset.href] = true;
            extralink.classList.add("visited");
            chrome.storage.local.set({ visitedLinks });
          });
        } catch {}
        // This assumes extra links are "things we might want to open a lot of"
        // Check "links" are just placeholders to count stuff done (like Inktober drawings left)
        if (!extralink.dataset.href.startsWith("check-")) {
          window.open(extralink.dataset.href, "_blank");
        }
      });
      extralink.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        try {
          chrome.storage.local.get(["visitedLinks"], (data) => {
            const visitedLinks = data.visitedLinks || {};
            visitedLinks[extralink.dataset.href] = false;
            extralink.classList.remove("visited");
            chrome.storage.local.set({ visitedLinks });
          });
        } catch {}
        extralink.classList.remove("visited");
      });
    }
    if (task.links) {
      taskText.appendChild(extralinkWrapper);
    }
    taskWrapper.appendChild(taskText);
    taskWrapper.appendChild(taskExtra);
    if (task.done) {
      taskWrapper.classList.add("done", "hide");
      if (!addedDoneSeparator) {
        const done = document.createElement("HR");
        done.id = "doneSep";
        wrapperNode.appendChild(done);
        addedDoneSeparator = true;
      }
    }
    wrapperNode.appendChild(taskWrapper);
  }
  if (someday) {
    // I could just use count
    const somedays = tasks.filter((t) => t.someday && !t.done);
    const count = somedays.length;
    const taskWrapper = d();
    taskWrapper.classList.add("taskRow");
    taskWrapper.id = "someday";
    const taskText = d();
    taskText.classList.add("taskText");
    taskWrapper.appendChild(taskText);
    taskText.textContent = `Someday (${count})`;
    taskText.style.color = `var(--task-default)`;
    const firstSomeday = wrapperNode.querySelector(".taskRow.someday");
    const hr = document.createElement("HR");
    hr.style.borderColor = `var(--task-default)`;
    hr.classList.add("dim");
    wrapperNode.insertBefore(hr, firstSomeday);
    wrapperNode.insertBefore(taskWrapper, firstSomeday);
    taskText.addEventListener("click", (e) => {
      e.preventDefault();
      const somedays = document.querySelectorAll(".taskRow.someday");
      Array.from(somedays).map((s) => s.classList.toggle("hide"));
    });
    taskText.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  if (reference) {
    // I could just use count
    const references = tasks.filter((t) => t.reference);
    const count = references.length;
    const taskWrapper = d();
    taskWrapper.classList.add("taskRow");
    taskWrapper.id = "reference";
    const taskText = d();
    taskText.classList.add("taskText");
    taskWrapper.appendChild(taskText);
    taskText.textContent = `References (${count})`;
    taskText.style.color = `var(--task-default)`;
    const firstReference = wrapperNode.querySelector(".taskRow.reference");
    const hr = document.createElement("HR");
    hr.style.borderColor = `var(--task-default)`;
    hr.classList.add("dim");
    wrapperNode.insertBefore(hr, firstReference);
    wrapperNode.insertBefore(taskWrapper, firstReference);
    taskText.addEventListener("click", (e) => {
      e.preventDefault();
      const references = document.querySelectorAll(".taskRow.reference");
      Array.from(references).map((s) => s.classList.toggle("hide"));
    });
    taskText.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  const dones = tasks.filter((t) => t.done);
  if (dones.length) {
    const count = dones.length;
    const taskWrapper = d();
    taskWrapper.classList.add("taskRow");
    taskWrapper.id = "done";
    const taskText = d();
    taskText.classList.add("taskText");
    taskWrapper.appendChild(taskText);
    taskText.textContent = `Done (${count})`;
    taskText.style.color = `var(--task-default)`;
    const firstDone = wrapperNode.querySelector(".taskRow.done");
    //const hr = document.createElement("HR");
    wrapperNode.insertBefore(taskWrapper, firstDone);
    taskText.addEventListener("click", (e) => {
      e.preventDefault();
      const dones = document.querySelectorAll(".taskRow.done");
      Array.from(dones).map((s) => s.classList.toggle("hide"));
    });
    taskText.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  try {
    chrome.storage.local.get(["visitedLinks"], (data) => {
      const visitedLinks = data.visitedLinks || {};
      for (const href in visitedLinks) {
        const elms = document.querySelectorAll(`[data-href="${href}"]`);
        for (const elm of elms) {
          if (visitedLinks[href]) {
            elm.classList.add("visited");
          }
        }
      }
    });
  } catch {}

  try {
    chrome.storage.local.get(["highlighted"], (data) => {
      const highlighted = data.highlighted || {};
      let hl = false;
      const taskRows = Array.from(document.querySelectorAll(".taskRow"));
      for (let row of taskRows) {
        row.classList.add("dim");
        if (highlighted[row.textContent]) {
          row.classList.add("highlight");
          row.classList.remove("dim");
          hl = true;
        }
      }
      if (!hl) {
        taskRows.map((t) => t.classList.remove("dim"));
      }
    });
  } catch {}
  targetDiv.appendChild(wrapperNode);
}

const addHr = (wrapperNode, task) => {
  const hr = document.createElement("HR");
  if (task.msg) {
    hr.dataset.title = task.msg;
  }
  hr.classList.add("taskHr");
  const taskColor = task.color ? task.color : "task-default";
  hr.style.borderColor = `var(--${taskColor})`;
  wrapperNode.appendChild(hr);
};
