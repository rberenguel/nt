const VALID_COLORS = ["yellow", "red", "green", "blue", "white"];
const DEFAULT_COLOR = "yellow";

function createPostIt(noteData) {
  const d = document.createElement("DIV");
  d.addEventListener("mouseover", () => toTop(d));
  d.id = noteData.id;
  d.classList.add("post-it");

  let initialColor =
    noteData.color && VALID_COLORS.includes(noteData.color)
      ? noteData.color
      : DEFAULT_COLOR;
  d.classList.add("postit-" + initialColor);
  d.dataset.color = initialColor;

  d.style.left = noteData.left;
  d.style.top = noteData.top;
  d.setAttribute("data-x", "0");
  d.setAttribute("data-y", "0");
  d.style.transform = "translate(0px, 0px)";

  const dragHandle = document.createElement("div");
  dragHandle.classList.add("drag-handle");
  dragHandle.setAttribute("aria-label", "Drag Note");
  d.appendChild(dragHandle);

  const deleteBtn = document.createElement("button");
  deleteBtn.classList.add("delete-button");
  deleteBtn.setAttribute("aria-label", "Delete Note");
  deleteBtn.innerHTML = "&times;";
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    d.remove();
    saveAllNotesState();
  });
  d.appendChild(deleteBtn);

  const contentArea = document.createElement("div");
  contentArea.classList.add("content-area");
  contentArea.contentEditable = true;
  contentArea.innerHTML = noteData.content;
  d.appendChild(contentArea);
  const initialFontSizePercent = noteData.fontSizePercent || 100;
  contentArea.style.fontSize = initialFontSizePercent + "%";
  contentArea.dataset.fontSizePercent = initialFontSizePercent;

  interact(d).draggable({
    allowFrom: ".drag-handle",
    inertia: true,
    autoScroll: true,
    listeners: {
      move: dragMoveListener,
      start(event) {
        event.target.classList.add("interact-dragging");
        document.body.classList.add("user-select-none");
        if (document.activeElement) document.activeElement.blur();
      },
      end(event) {
        event.target.classList.remove("interact-dragging");
        document.body.classList.remove("user-select-none");

        let target = event.target;
        let x = parseFloat(target.getAttribute("data-x")) || 0;
        let y = parseFloat(target.getAttribute("data-y")) || 0;
        if (x !== 0 || y !== 0) {
          let currentLeft = parseFloat(target.style.left) || 0;
          let currentTop = parseFloat(target.style.top) || 0;
          target.style.left = currentLeft + x + "px";
          target.style.top = currentTop + y + "px";
          target.style.transform = "translate(0px, 0px)";
          target.setAttribute("data-x", "0");
          target.setAttribute("data-y", "0");
          saveAllNotesState();
        }
      },
    },
  });

  contentArea.addEventListener("keydown", (e) => {
    const postItElement = e.target.closest(".post-it");
    if (!postItElement) return;

    let shouldSave = false;
    let preventDefault = false;

    if (
      e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.shiftKey &&
      (e.key === "." || e.key === ",")
    ) {
      preventDefault = true;
      const currentContentArea = e.target;

      let currentPercent =
        parseFloat(currentContentArea.dataset.fontSizePercent) || 100;
      let increment = 8;
      let newPercent;

      if (e.key === ".") {
        newPercent = currentPercent + increment;
      } else {
        newPercent = currentPercent - increment;
      }

      const minSizePercent = 50;
      const maxSizePercent = 500;
      newPercent = Math.max(
        minSizePercent,
        Math.min(maxSizePercent, newPercent),
      );

      newPercent = Math.round(newPercent * 10) / 10;

      currentContentArea.style.fontSize = newPercent + "%";
      currentContentArea.dataset.fontSizePercent = newPercent;

      shouldSave = true;
    } else if (
      e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.shiftKey &&
      VALID_COLORS.map((c) => c[0]).includes(e.key.toLowerCase())
    ) {
      preventDefault = true;
      shouldSave = true;

      let newColor;
      switch (e.key.toLowerCase()) {
        case "y":
          newColor = "yellow";
          break;
        case "r":
          newColor = "red";
          break;
        case "g":
          newColor = "green";
          break;
        case "b":
          newColor = "blue";
          break;
        case "w":
          newColor = "white";
          break;
        default:
          shouldSave = false;
      }

      if (shouldSave) {
        VALID_COLORS.forEach((c) =>
          postItElement.classList.remove("postit-" + c),
        );
        postItElement.classList.add("postit-" + newColor);
        postItElement.dataset.color = newColor;
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      shouldSave = true;
    } else if (e.key === " ") {
      shouldSave = true;
    }

    if (preventDefault) {
      e.preventDefault();
    }

    if (shouldSave) {
      setTimeout(saveAllNotesState, 0);
    }
  });

  contentArea.addEventListener("blur", (e) => {
    console.log("Content area blurred, saving state...");

    saveAllNotesState();
  });

  document.body.appendChild(d);
  return d;
}

const CAN_USE_STORAGE =
  typeof chrome !== "undefined" &&
  typeof chrome.storage !== "undefined" &&
  typeof chrome.storage.local !== "undefined";

if (!CAN_USE_STORAGE) {
  console.log("Chrome Storage API not found. Post-it saving/loading disabled.");
}

const STORAGE_KEY = "postItNotesData";

function saveAllNotesState() {
  if (!CAN_USE_STORAGE) return;

  const notesData = [];
  document.querySelectorAll(".post-it").forEach((noteEl) => {
    const contentArea = noteEl.querySelector(".content-area");
    if (!contentArea) {
      console.warn(
        "Note skipped during save: Could not find content area for",
        noteEl.id,
      );
      return;
    }

    const color = noteEl.dataset.color || DEFAULT_COLOR;

    let currentX = parseFloat(noteEl.getAttribute("data-x")) || 0;
    let currentY = parseFloat(noteEl.getAttribute("data-y")) || 0;
    let baseLeft = parseFloat(noteEl.style.left) || 0;
    let baseTop = parseFloat(noteEl.style.top) || 0;
    let finalLeft = baseLeft + currentX;
    let finalTop = baseTop + currentY;
    const fontSizePercent =
      parseFloat(contentArea.dataset.fontSizePercent) || 100;
    notesData.push({
      id: noteEl.id,
      content: contentArea.innerHTML,
      left: finalLeft + "px",
      top: finalTop + "px",
      color: color,
      fontSizePercent: fontSizePercent,
    });
  });

  const dataToSave = {};
  dataToSave[STORAGE_KEY] = notesData;

  chrome.storage.local.set(dataToSave, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving notes:", chrome.runtime.lastError);
    } else {
      console.log(`Saved ${notesData.length} notes.`);
    }
  });
}

function loadNotes() {
  if (!CAN_USE_STORAGE) return;
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    if (chrome.runtime.lastError) {
      console.error("Error loading notes:", chrome.runtime.lastError);
      return;
    }
    const notesArray = result[STORAGE_KEY];
    if (notesArray && Array.isArray(notesArray)) {
      console.log(`Loading ${notesArray.length} notes...`);
      notesArray.forEach((noteData) => {
        if (!document.getElementById(noteData.id)) {
          createPostIt(noteData);
        }
      });
    } else {
      console.log("No saved notes found or data is invalid.");
    }
  });
}

function dragMoveListener(event) {
  var target = event.target;
  var x = (parseFloat(target.getAttribute("data-x")) || 0) + event.dx;
  var y = (parseFloat(target.getAttribute("data-y")) || 0) + event.dy;
  target.style.transform = "translate(" + x + "px, " + y + "px)";
  target.setAttribute("data-x", x);
  target.setAttribute("data-y", y);
}

document.addEventListener("click", (ev) => {
  if (ev.altKey && !ev.target.closest(".post-it")) {
    const newId =
      "postit-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
    const noteData = {
      id: newId,
      content: "",
      left: ev.pageX + "px",
      top: ev.pageY + "px",
      color: DEFAULT_COLOR,
    };
    createPostIt(noteData);
  }
});

document.addEventListener("DOMContentLoaded", loadNotes);
