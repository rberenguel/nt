// --- lib/postit.js --- V7 (Corrected) - Allow title update on Enter ---

// --- Global Check for Storage API ---
const CAN_USE_STORAGE =
  typeof chrome !== "undefined" &&
  typeof chrome.storage !== "undefined" &&
  typeof chrome.storage.local !== "undefined";

if (!CAN_USE_STORAGE) {
  console.log("Chrome Storage API not found. Post-it saving/loading disabled.");
}

// --- Storage Key ---
const STORAGE_KEY = "postItNotesData";

// --- List of valid color names ---
const VALID_COLORS = ["yellow", "red", "green", "blue"];
const DEFAULT_COLOR = "yellow";

// --- Save Function (Unchanged) ---
function saveAllNotesState() {
  if (!CAN_USE_STORAGE) return;
  const notesData = [];
  document.querySelectorAll(".post-it").forEach((noteEl) => {
    const contentArea = noteEl.querySelector(".content-area");
    if (!contentArea) return;
    const title = noteEl.dataset.title || null; // Read title from dataset
    const content = contentArea.innerHTML;
    const color = noteEl.dataset.color || DEFAULT_COLOR;
    const fontSizePercent =
      parseFloat(contentArea.dataset.fontSizePercent) || 100;
    let currentX = parseFloat(noteEl.getAttribute("data-x")) || 0;
    let currentY = parseFloat(noteEl.getAttribute("data-y")) || 0;
    let baseLeft = parseFloat(noteEl.style.left) || 0;
    let baseTop = parseFloat(noteEl.style.top) || 0;
    let finalLeft = baseLeft + currentX;
    let finalTop = baseTop + currentY;
    notesData.push({
      id: noteEl.id,
      title: title,
      content: content,
      left: finalLeft + "px",
      top: finalTop + "px",
      color: color,
      fontSizePercent: fontSizePercent,
    });
  });
  const dataToSave = {};
  dataToSave[STORAGE_KEY] = notesData;
  chrome.storage.local.set(dataToSave, () => {
    if (chrome.runtime.lastError)
      console.error("Error saving notes:", chrome.runtime.lastError);
  });
}

// --- Load Function (Unchanged) ---
function loadNotes() {
  if (!CAN_USE_STORAGE) return;
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    if (chrome.runtime.lastError)
      return console.error("Error loading notes:", chrome.runtime.lastError);
    const notesArray = result[STORAGE_KEY];
    if (notesArray && Array.isArray(notesArray)) {
      console.log(`Loading ${notesArray.length} notes...`);
      notesArray.forEach((noteData) => {
        if (!document.getElementById(noteData.id)) createPostIt(noteData);
      });
    }
  });
}

// --- Helper: Adjust Min Width (Unchanged) ---
function adjustPostItMinWidthForTitle(postItElement) {
  const handleTitle = postItElement.querySelector(".handle-title");
  const dragHandle = postItElement.querySelector(".drag-handle");
  const deleteBtn = postItElement.querySelector(".delete-button");
  const BASE_MIN_WIDTH_PX = 75;
  let currentMinWidth =
    parseFloat(postItElement.style.minWidth) || BASE_MIN_WIDTH_PX;
  let requiredWidth = currentMinWidth;
  if (
    handleTitle &&
    handleTitle.textContent.trim() &&
    dragHandle &&
    deleteBtn
  ) {
    const tempSpan = document.createElement("span");
    document.body.appendChild(tempSpan);
    const titleStyle = window.getComputedStyle(handleTitle);
    tempSpan.style.font = titleStyle.font;
    tempSpan.style.letterSpacing = titleStyle.letterSpacing;
    tempSpan.style.whiteSpace = "nowrap";
    tempSpan.style.visibility = "hidden";
    tempSpan.style.position = "absolute";
    tempSpan.textContent = handleTitle.textContent;
    const titleWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);
    const deleteBtnWidth = deleteBtn.offsetWidth || 20;
    const internalHandlePadding = 10;
    const handleContentRequiredWidth =
      titleWidth + deleteBtnWidth + internalHandlePadding;
    const postitStyle = window.getComputedStyle(postItElement);
    const postItHorizontalPadding =
      (parseFloat(postitStyle.paddingLeft) || 0) +
      (parseFloat(postitStyle.paddingRight) || 0);
    const handleBuffer = 10;
    requiredWidth =
      handleContentRequiredWidth + postItHorizontalPadding + handleBuffer;
  }
  const newMinWidth = Math.max(
    BASE_MIN_WIDTH_PX,
    currentMinWidth,
    requiredWidth
  );
  if (
    Math.ceil(newMinWidth) !== Math.ceil(currentMinWidth) ||
    !postItElement.style.minWidth
  ) {
    postItElement.style.minWidth = Math.ceil(newMinWidth) + "px";
  }
}

// --- Post-it Creation Function (Only keydown listener is changed below) ---
function createPostIt(noteData) {
  const d = document.createElement("DIV");
  d.id = noteData.id;
  d.classList.add("post-it");
  let initialColor =
    noteData.color && VALID_COLORS.includes(noteData.color)
      ? noteData.color
      : DEFAULT_COLOR;
  d.classList.add("postit-" + initialColor);
  d.dataset.color = initialColor;
  if (noteData.title) d.dataset.title = noteData.title;
  d.style.left = noteData.left;
  d.style.top = noteData.top;
  d.setAttribute("data-x", "0");
  d.setAttribute("data-y", "0");
  d.style.transform = "translate(0px, 0px)";

  // Controls
  const dragHandle = document.createElement("div");
  dragHandle.classList.add("drag-handle");
  dragHandle.setAttribute("aria-label", "Drag Note");
  const handleTitle = document.createElement("div");
  handleTitle.classList.add("handle-title");
  if (noteData.title) {
    handleTitle.textContent = noteData.title;
    dragHandle.classList.add("has-title");
  }
  dragHandle.appendChild(handleTitle);
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

  // Content Area
  const contentArea = document.createElement("div");
  contentArea.classList.add("content-area");
  contentArea.contentEditable = true;
  contentArea.innerHTML = noteData.content || "";
  const initialFontSizePercent = noteData.fontSizePercent || 100;
  contentArea.style.fontSize = initialFontSizePercent + "%";
  contentArea.dataset.fontSizePercent = initialFontSizePercent;
  d.appendChild(contentArea);

  // Interact.js
  interact(d).draggable({
    allowFrom: ".drag-handle",
    inertia: true,
    autoScroll: true,
    listeners: {
      move: dragMoveListener,
      start(event) {
        document.body.classList.add("user-select-none");
        event.target.classList.add("interact-dragging");
        if (document.activeElement) document.activeElement.blur();
      },
      end(event) {
        document.body.classList.remove("user-select-none");
        event.target.classList.remove("interact-dragging");
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

  // --- Keyboard Listener (CORRECTED Enter Logic) ---
  contentArea.addEventListener("keydown", (e) => {
    const postItElement = d; // Parent element already in scope
    const currentContentArea = e.target; // contentArea
    const currentDragHandle = postItElement.querySelector(".drag-handle");
    if (!currentDragHandle) return;

    let shouldSave = false;
    let preventDefault = false; // Should we prevent default action?

    // --- Handle Enter Key Press ---
    if (e.key === "Enter" && !e.shiftKey) {
      // --- REMOVED check for !postItElement.dataset.title ---
      // --- Now, always check if the first line is a potential title command ---
      const firstChild = currentContentArea.firstChild;
      let firstLineText = "";
      let nodeToRemove = null;
      let removeBreak = false;

      // Carefully check the first node's text content
      if (firstChild) {
        if (firstChild.nodeType === Node.ELEMENT_NODE) {
          // E.g. <div># Title</div>
          let text = (
            firstChild.textContent ||
            firstChild.innerText ||
            ""
          ).trimStart();
          if (text.startsWith("# ")) {
            firstLineText = text;
            nodeToRemove = firstChild;
          }
        } else if (firstChild.nodeType === Node.TEXT_NODE) {
          // E.g. # Title<br>...
          let text = (firstChild.nodeValue || "").trimStart();
          if (text.startsWith("# ")) {
            firstLineText = text;
            nodeToRemove = firstChild;
            if (
              firstChild.nextSibling &&
              firstChild.nextSibling.nodeName === "BR"
            )
              removeBreak = true;
          }
        }
      }

      // If pattern matches
      if (firstLineText.startsWith("# ")) {
        const title = firstLineText.substring(2).trim();
        // Check if title is non-empty to proceed with setting it
        if (title) {
          console.log(
            "Title pattern detected on Enter, setting/updating:",
            title
          );
          preventDefault = true; // Prevent the default newline action

          // Update title visually and in data attribute
          const handleTitleElement =
            currentDragHandle.querySelector(".handle-title");
          if (handleTitleElement) handleTitleElement.textContent = title;
          currentDragHandle.classList.add("has-title");
          postItElement.dataset.title = title; // Update or set the title data

          // Remove the title line/node from contentEditable
          if (nodeToRemove) {
            try {
              currentContentArea.removeChild(nodeToRemove);
              if (
                removeBreak &&
                currentContentArea.firstChild &&
                currentContentArea.firstChild.nodeName === "BR"
              ) {
                currentContentArea.removeChild(currentContentArea.firstChild);
              }
            } catch (removeError) {
              console.error("Error removing title node:", removeError);
            }
          }

          // Adjust min width for the new title
          adjustPostItMinWidthForTitle(postItElement);
          shouldSave = true; // Save the new title and cleaned content immediately
        } else {
          // '# ' alone was typed, treat as normal Enter + Save
          shouldSave = true;
          // No preventDefault, allow newline
        }
      } else {
        // No title pattern found on first line -> treat as normal Enter + Save
        shouldSave = true;
        // No preventDefault, allow newline
      }
    } // --- End Enter Key Handling ---

    // --- Other Key Handlers (Font Size, Color, Space) ---
    else if (
      e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.shiftKey &&
      (e.key === "." || e.key === ",")
    ) {
      preventDefault = true;
      shouldSave = true;
      let currentPercent =
        parseFloat(currentContentArea.dataset.fontSizePercent) || 100;
      let increment = 8;
      let newPercent =
        e.key === "." ? currentPercent + increment : currentPercent - increment;
      const minSizePercent = 50;
      const maxSizePercent = 500;
      newPercent = Math.max(
        minSizePercent,
        Math.min(maxSizePercent, newPercent)
      );
      newPercent = Math.round(newPercent * 10) / 10;
      currentContentArea.style.fontSize = newPercent + "%";
      currentContentArea.dataset.fontSizePercent = newPercent;
      adjustPostItMinWidthForTitle(postItElement);
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
        default:
          shouldSave = false;
      }
      if (shouldSave) {
        VALID_COLORS.forEach((c) =>
          postItElement.classList.remove("postit-" + c)
        );
        postItElement.classList.add("postit-" + newColor);
        postItElement.dataset.color = newColor;
      }
    } else if (e.key === " ") {
      shouldSave = true;
    }

    // Prevent default ONLY if specifically needed (Title creation, Ctrl+ shortcuts)
    if (preventDefault) {
      e.preventDefault();
    }

    // Trigger save if needed
    if (shouldSave) {
      // If we prevented default (Title creation/Ctrl+shortcuts), save immediately.
      // Otherwise (normal Enter/Space), save after timeout to allow default action.
      if (preventDefault) {
        console.log("Saving immediately after prevented action.");
        saveAllNotesState();
      } else {
        // console.log("Saving with timeout after allowed action.");
        setTimeout(saveAllNotesState, 0);
      }
    }
  }); // --- End Keydown Listener ---

  // --- Blur Listener (Unchanged) ---
  contentArea.addEventListener("blur", (e) => {
    saveAllNotesState();
  });

  document.body.appendChild(d);
  // *** Update min-width AFTER initial creation and appending ***
  setTimeout(() => adjustPostItMinWidthForTitle(d), 0);
  return d;
}

// --- Drag Move Listener (Unchanged) ---
function dragMoveListener(event) {
  var target = event.target;
  var x = (parseFloat(target.getAttribute("data-x")) || 0) + event.dx;
  var y = (parseFloat(target.getAttribute("data-y")) || 0) + event.dy;
  target.style.transform = "translate(" + x + "px, " + y + "px)";
  target.setAttribute("data-x", x);
  target.setAttribute("data-y", y);
}

// --- Alt+Click Listener (Unchanged) ---
document.addEventListener("click", (ev) => {
  if (ev.altKey && !ev.target.closest(".post-it")) {
    const newId =
      "postit-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
    const noteData = {
      id: newId,
      title: null,
      content: "",
      left: ev.pageX + "px",
      top: ev.pageY + "px",
      color: DEFAULT_COLOR,
      fontSizePercent: 100,
    };
    const newNoteElement = createPostIt(noteData);
    newNoteElement.querySelector(".content-area")?.focus();
  }
});

// --- Initial Load on DOM Ready (Unchanged) ---
document.addEventListener("DOMContentLoaded", loadNotes);
