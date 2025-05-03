const CAN_USE_STORAGE =
  typeof chrome !== "undefined" &&
  typeof chrome.storage !== "undefined" &&
  typeof chrome.storage.local !== "undefined";

if (!CAN_USE_STORAGE) {
  console.log("Chrome Storage API not found. Post-it saving/loading disabled.");
}

const STORAGE_KEY = "postItNotesData";

const VALID_COLORS = ["yellow", "red", "green", "blue"];
const DEFAULT_COLOR = "yellow";

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
    const titleWidth = handleTitle.scrollWidth;
    const deleteBtnWidth = deleteBtn.offsetWidth || 20;

    const titleStyle = window.getComputedStyle(handleTitle);
    const internalHandlePadding =
      (parseFloat(titleStyle.paddingLeft) || 0) +
      (parseFloat(titleStyle.paddingRight) || 0);
    const handleContentRequiredWidth =
      titleWidth + deleteBtnWidth + internalHandlePadding + 10;
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

/**
 * Renders the title string inside the handle title container,
 * applying special formatting if it matches YYYYMMDD pattern.
 * @param {HTMLElement | null} handleTitleContainer - The '.handle-title' element.
 * @param {string | null} titleString - The title text (can be null).
 */
function renderTitle(handleTitleContainer, titleString) {
  if (!handleTitleContainer) return;

  const dragHandle = handleTitleContainer.closest(".drag-handle");
  const datePattern = /^\d{8}$/;

  handleTitleContainer.innerHTML = "";
  let hasActualTitle = false;
  if (dragHandle) dragHandle.classList.remove("is-date-title", "has-title");

  if (titleString && datePattern.test(titleString)) {
    hasActualTitle = true;
    if (dragHandle) dragHandle.classList.add("is-date-title", "has-title");

    const year = titleString.substring(0, 4);
    const month = titleString.substring(4, 6);
    const day = titleString.substring(6, 8);

    const createSpan = (text, className) => {
      const span = document.createElement("span");
      if (className) span.className = className;
      span.textContent = text;
      return span;
    };

    handleTitleContainer.appendChild(createSpan(year, "date-year"));
    handleTitleContainer.appendChild(createSpan(month, "date-month"));
    handleTitleContainer.appendChild(createSpan(day, "date-day"));
  } else if (titleString) {
    hasActualTitle = true;
    handleTitleContainer.textContent = titleString;
    if (dragHandle) dragHandle.classList.add("has-title");
  } else {
    handleTitleContainer.textContent = "";
  }
}

function saveAllNotesState() {
  if (!CAN_USE_STORAGE) return;
  const notesData = [];
  document.querySelectorAll(".post-it").forEach((noteEl) => {
    const contentArea = noteEl.querySelector(".content-area");
    if (!contentArea) return;
    const title = noteEl.dataset.title || null;
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
  if (noteData.title) d.dataset.title = noteData.title;
  d.style.left = noteData.left;
  d.style.top = noteData.top;
  d.setAttribute("data-x", "0");
  d.setAttribute("data-y", "0");
  d.style.transform = "translate(0px, 0px)";

  const dragHandle = document.createElement("div");
  dragHandle.classList.add("drag-handle");
  dragHandle.setAttribute("aria-label", "Drag Note");
  const handleTitle = document.createElement("div");
  handleTitle.classList.add("handle-title");
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

  const contentArea = document.createElement("div");
  contentArea.classList.add("content-area");
  contentArea.contentEditable = true;
  contentArea.innerHTML = noteData.content || "";
  const initialFontSizePercent = noteData.fontSizePercent || 100;
  contentArea.style.fontSize = initialFontSizePercent + "%";
  contentArea.dataset.fontSizePercent = initialFontSizePercent;
  d.appendChild(contentArea);

  renderTitle(handleTitle, noteData.title);

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

  contentArea.addEventListener("click", (e) => {
    const targetItem = e.target.closest(".task-item");
    if (targetItem) {
      const style = window.getComputedStyle(targetItem);
      const checkWidth = parseFloat(style.paddingLeft || "0");
      if (e.offsetX <= checkWidth) {
        targetItem.classList.toggle("task-done");
        saveAllNotesState();
      }
    }
    const targetLink = e.target.closest('a'); 

        
        if (targetLink && (e.ctrlKey || e.metaKey)) {
            e.preventDefault(); 
            e.stopPropagation(); 

            const href = targetLink.href;
            if (href) {
                console.log(`Ctrl/Cmd+Clicked link, opening in new tab: ${href}`);
                window.open(href, '_blank', 'noopener,noreferrer'); 
            } else {
                console.warn("Ctrl/Cmd+Clicked link has no href:", targetLink);
            }
            return; 
        }
  });

  contentArea.addEventListener("keydown", (e) => {
    const postItElement = d;
    const currentContentArea = e.target;
    const currentDragHandle = postItElement.querySelector(".drag-handle");

    let shouldSave = false;
    let preventDefault = false;

    if (e.key === "Enter" && !e.shiftKey) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      let container = range.startContainer;
      let currentLineElement = null;
      while (container && container !== currentContentArea) {
        if (
          container.nodeType === Node.ELEMENT_NODE &&
          container.parentNode === currentContentArea
        ) {
          currentLineElement = container;
          break;
        }
        container = container.parentNode;
      }

      if (currentLineElement) {
        const text = (currentLineElement.textContent || "").trimStart();
        const startsWithHash = text.startsWith("# ");
        const startsWithOpen = text.startsWith("[ ]");
        const startsWithChecked = text.startsWith("[x]");

        if (startsWithHash) {
          const title = text.substring(2).trim();
          if (title) {
            preventDefault = true;
            shouldSave = true;
            console.log(
              "Title pattern '# ' detected on Enter, setting/updating:",
              title
            );

            const handleTitleElement =
              currentDragHandle?.querySelector(".handle-title");
            renderTitle(handleTitleElement, title);
            postItElement.dataset.title = title;

            const elementToRemove = currentLineElement;
            const newDiv = document.createElement("div");
            newDiv.innerHTML = "<br>";
            currentContentArea.insertBefore(
              newDiv,
              elementToRemove.nextSibling
            );
            try {
              currentContentArea.removeChild(elementToRemove);
            } catch (e) {
              console.error("Error removing title line:", e);
            }
            adjustPostItMinWidthForTitle(postItElement);
            try {
              range.setStart(newDiv, 0);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
            } catch (e) {
              console.error("Error setting range after title set:", e);
            }
          } else {
            shouldSave = true;
          }
        } else if (startsWithOpen || startsWithChecked) {
          preventDefault = true;
          shouldSave = true;
          const taskText = text.substring(3).trim();
          const isDone = startsWithChecked;
          console.log(`Task detected on Enter: "${taskText}", Done: ${isDone}`);
          currentLineElement.textContent = taskText;
          currentLineElement.classList.add("task-item");
          if (isDone) currentLineElement.classList.add("task-done");
          else currentLineElement.classList.remove("task-done");
          const newDiv = document.createElement("div");
          newDiv.innerHTML = "<br>";
          currentContentArea.insertBefore(
            newDiv,
            currentLineElement.nextSibling
          );
          try {
            range.setStart(newDiv, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          } catch (e) {
            console.error("Error setting range after task creation:", e);
          }
        } else {
          shouldSave = true;
        }
      } else {
        shouldSave = true;
      }
    } else if (
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

    if (preventDefault) {
      e.preventDefault();
    }
    if (shouldSave) {
      if (preventDefault) {
        console.log("Saving immediately after prevented action.");
        saveAllNotesState();
      } else {
        setTimeout(saveAllNotesState, 0);
      }
    }
  });

  contentArea.addEventListener("blur", (e) => {
    saveAllNotesState();
  });

  

  contentArea.addEventListener("paste", (e) => {
    
    const selection = window.getSelection();

    
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return; 
    }
    const range = selection.getRangeAt(0);
    if (!contentArea.contains(range.commonAncestorContainer)) {
      return; 
    }

    
    let pastedText = (e.clipboardData || window.clipboardData)?.getData(
      "text/plain"
    );
    if (!pastedText) {
      return; 
    }

    
    let isValidUrl = false;
    let url = "";
    try {
      
      if (
        pastedText.startsWith("http:
        pastedText.startsWith("https:
      ) {
        
        url = new URL(pastedText).href;
        isValidUrl = true;
      }
    } catch (_) {
      isValidUrl = false; 
    }

    
    if (isValidUrl) {
      
      e.preventDefault();

      try {
        
        const selectedText = selection.toString();

        
        const link = document.createElement("a");
        link.href = url;
        
        link.textContent = selectedText.trim() || url;
        link.target = "_blank"; 
        link.rel = "noopener noreferrer"; 
        link.title = url;
        
        range.deleteContents(); 
        range.insertNode(link); 

        
        range.setStartAfter(link);
        range.collapse(true); 
        selection.removeAllRanges(); 
        selection.addRange(range); 

        console.log(`Link created: ${link.textContent} -> ${url}`);
        saveAllNotesState(); 
      } catch (domError) {
        console.error("Error creating link on paste:", domError);
        
        
      }
    }
    
    
  });

  document.body.appendChild(d);

  setTimeout(() => adjustPostItMinWidthForTitle(d), 50);
  return d;
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

if (typeof interact !== "undefined") {
  interact(document).on("hold", (ev) => {
    if (ev.target.closest(".post-it, input, button, a, [contenteditable=true]"))
      return;

    console.log("Hold event detected for new post-it:", ev);
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
  });
} else {
  console.warn("interact.js not loaded, hold listener disabled.");
}

document.addEventListener("DOMContentLoaded", loadNotes);
