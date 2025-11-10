// TODO: Fix the mess Gemini created

const CAN_USE_STORAGE =
  typeof chrome !== "undefined" &&
  typeof chrome.storage !== "undefined" &&
  typeof chrome.storage.local !== "undefined";

if (!CAN_USE_STORAGE) {
  console.info(
    "Chrome Storage API not found. Post-it saving/loading disabled.",
  );
}

const STORAGE_KEY = "postItNotesData";

const VALID_COLORS = ["yellow", "red", "green", "blue", "white"];
const DEFAULT_COLOR = "yellow";

// --- New Timer Functionality ---
let timerIntervalId = null;
const activeRingingIntervals = {};

// --- Timer Specific Helper Functions ---
// (Assume other functions like formatTime, processPostItTextForTimer, saveAllNotesState, etc., are defined elsewhere)

let audioCtxDing; // For the ding sound

function showChromeNotification(noteId, title, message) {
  if (
    typeof chrome !== "undefined" &&
    typeof chrome.notifications !== "undefined"
  ) {
    const notificationId = `postit-timer-${noteId}-${Date.now()}`;
    const options = {
      type: "basic",
      iconUrl: chrome.runtime.getURL("./media/icon.png"),
      title: title || "Post-it Timer", // Fallback title
      message: message,
      priority: 2, // Highest priority
    };

    chrome.notifications.create(notificationId, options, (createdId) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Notification creation failed:",
          chrome.runtime.lastError.message,
        );
      } else {
        console.info(`Notification created successfully with ID: ${createdId}`);
      }
    });
  } else {
    console.warn(
      "Chrome Notifications API not available. Check permissions and reload extension.",
    );
  }
}

/**
 * Plays a "ding" sound using the Web Audio API.
 * This version plays the ding three times. (From Canvas)
 */
function playDingSound() {
  if (
    typeof window.AudioContext === "undefined" &&
    typeof window.webkitAudioContext === "undefined"
  ) {
    console.warn("Web Audio API not supported, cannot play ding sound.");
    return;
  }
  if (!audioCtxDing) {
    try {
      audioCtxDing = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.error("Failed to create AudioContext for ding sound:", e);
      audioCtxDing = null;
      return;
    }
  }
  if (!audioCtxDing) {
    console.error("AudioContext not available for ding sound.");
    return;
  }

  const dingCount = 3;
  const delayBetweenDings = 0.35; // Seconds
  const dingDuration = 0.5; // Seconds

  for (let i = 0; i < dingCount; i++) {
    const startTime = audioCtxDing.currentTime + i * delayBetweenDings;
    try {
      const oscillator = audioCtxDing.createOscillator();
      const gainNode = audioCtxDing.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtxDing.destination);
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(1046.5, startTime); // C6
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.3, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        startTime + dingDuration - 0.05,
      );
      oscillator.start(startTime);
      oscillator.stop(startTime + dingDuration);
    } catch (error) {
      console.error(`Error playing ding sound (iteration ${i}):`, error);
    }
  }
}

// Helper to format remaining milliseconds to MM:SS
function formatTime(milliseconds) {
  if (milliseconds < 0) milliseconds = 0;
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

// Updates the visual display of the timer on a post-it
function displayTimerStatus(postItElement) {
  let timerDisplay = postItElement.querySelector(".timer-display");
  if (!timerDisplay) {
    timerDisplay = document.createElement("div");
    timerDisplay.classList.add("timer-display");
    // Style this class with CSS, e.g., small font size, position it appropriately
    const dragHandle = postItElement.querySelector(".drag-handle");
    if (dragHandle) {
      // Try to insert after handle-title
      const handleTitle = dragHandle.querySelector(".handle-title");
      if (handleTitle && handleTitle.nextSibling) {
        dragHandle.insertBefore(timerDisplay, handleTitle.nextSibling);
      } else if (handleTitle) {
        dragHandle.appendChild(timerDisplay);
      } else {
        dragHandle.prepend(timerDisplay); // If no title, put at start of handle
      }
    } else {
      // Fallback if no drag handle (should not happen with your current structure)
      postItElement.prepend(timerDisplay);
    }
  }

  const isActive = postItElement.dataset.isTimerActive === "true";
  const triggerTimestamp = parseFloat(postItElement.dataset.triggerTimestamp);
  const originalTimerStr = postItElement.dataset.originalTimerString;

  if (isActive && triggerTimestamp) {
    const remainingMs = triggerTimestamp - Date.now();
    if (remainingMs > 0) {
      timerDisplay.textContent = `🔔 ${formatTime(remainingMs)}`;
      timerDisplay.style.display = "block";
    } else {
      // Timer has just elapsed or was missed, should be caught by checkAllTimers to play sound
      timerDisplay.textContent = `🔔`;
      timerDisplay.style.display = "block";
    }
  } else if (originalTimerStr && !isActive && triggerTimestamp > 0) {
    // Timer has finished (isTimerActive was set to false by checkAllTimers)
    timerDisplay.textContent = `✅ ${originalTimerStr}`;
    timerDisplay.style.display = "block";
  } else {
    timerDisplay.textContent = "";
    timerDisplay.style.display = "none";
  }
}

// Checks all post-it notes for active timers that should ring
/**
 * Iterates through all post-it notes, checks active timers,
 * and triggers them if due, starting a repeating alarm.
 * Updates timer displays.
 */
function checkAllTimers() {
  document.querySelectorAll(".post-it").forEach((noteEl) => {
    const isActiveTimer = noteEl.dataset.isTimerActive === "true";
    const triggerTimestamp = parseFloat(noteEl.dataset.triggerTimestamp);
    const originalTimerStr = noteEl.dataset.originalTimerString;
    const contentArea = noteEl.querySelector(".content-area");
    const noteId = noteEl.id;

    if (!contentArea) return;

    // Check if this note is already in a persistent ringing state
    if (noteEl.dataset.isRinging === "true") {
      // If it's already ringing, ensure its display is correct.
      // The actual sound repetition is handled by its own setInterval.
      if (
        contentArea.contentEditable === "true" ||
        contentArea.contentEditable === true
      ) {
        // Should be false
        contentArea.contentEditable = "false";
        noteEl.classList.add("postit-alarm-active"); // Ensure class is present
      }
      contentArea.innerHTML = `<div class="timer-content-display">🔔 ${
        originalTimerStr || ""
      }</div>`;
      return; // Don't re-process if already ringing
    }

    if (isActiveTimer && triggerTimestamp) {
      const now = Date.now();
      const remainingMs = triggerTimestamp - now;

      if (remainingMs > 0) {
        // Update display for active, non-ringing timer (if it's not already showing timer content)
        if (
          contentArea.contentEditable === "false" ||
          contentArea.contentEditable === false
        ) {
          // Timer is set, contentArea shows timer
          contentArea.innerHTML = `<div class="timer-content-display">🔔 ${formatTime(
            remainingMs,
          )}</div>`;
        }
      } else {
        // Timer reached! Start persistent ringing.
        console.info(
          `Timer reached for note ${noteId} (Originally: ${originalTimerStr}). Starting persistent ringing.`,
        );

        noteEl.dataset.isTimerActive = "false"; // Initial trigger has passed
        noteEl.dataset.isRinging = "true"; // Now in persistent ringing state

        const notificationTitle = noteEl.dataset.title || "Post-it Timer";
        const notificationMessage = `Your timer for "${originalTimerStr}" is done!`;
        showChromeNotification(noteId, notificationTitle, notificationMessage);

        contentArea.contentEditable = "false";
        noteEl.classList.add("postit-alarm-active"); // Ensure alarm styling
        noteEl.classList.add("postit-alarm-ringing"); // Optional: for specific ringing style
        contentArea.innerHTML = `<div class="timer-content-display">🔔 ${
          originalTimerStr || ""
        }</div>`;

        playDingSound(); // Play immediately once

        // Clear any old interval for this note (defensive)
        if (activeRingingIntervals[noteId]) {
          clearInterval(activeRingingIntervals[noteId]);
        }
        // Start repeating the sound
        const repeatIntervalSeconds = 5; // e.g., repeat every 10 seconds
        activeRingingIntervals[noteId] = setInterval(() => {
          // Before playing, double-check if the note still exists and is still ringing
          const currentNote = document.getElementById(noteId);
          if (currentNote && currentNote.dataset.isRinging === "true") {
            console.info(`Repeating alarm for note ${noteId}`);
            playDingSound();
          } else {
            // Note was deleted or ringing stopped by other means, clear this interval
            clearInterval(activeRingingIntervals[noteId]);
            delete activeRingingIntervals[noteId];
          }
        }, repeatIntervalSeconds * 1000);

        saveAllNotesState(); // Persist new state (isTimerActive=false, isRinging=true)
      }
    } else if (triggerTimestamp && noteEl.dataset.isRinging !== "true") {
      // For notes with timers that are no longer active and not ringing (e.g., loaded as "done")
      // This logic is mostly handled by _initializePostItState now.
      // We just ensure the display is correct if it's not an active or ringing timer.
      if (
        contentArea.contentEditable === "false" ||
        contentArea.contentEditable === false
      ) {
        // If it was showing timer
        if (originalTimerStr && !isActiveTimer) {
          // And timer is done
          contentArea.innerHTML = `<div class="timer-content-display timer-text-done">✅ ${originalTimerStr}</div>`;
          contentArea.contentEditable = "true";
          noteEl.classList.remove("postit-alarm-active");
          noteEl.classList.remove("postit-alarm-ringing");
          contentArea.style.fontSize =
            (contentArea.dataset.fontSizePercent || 100) + "%";
        }
      }
    }
  });
}

// Parses post-it content for "@MM:SS" timer commands
function processPostItTextForTimer(postItElement) {
  const contentArea = postItElement.querySelector(".content-area");
  if (
    !contentArea ||
    !(
      contentArea.contentEditable === "true" ||
      contentArea.contentEditable === true
    )
  ) {
    // Only process if editable (i.e., no timer is currently active and displaying)
    return;
  }

  const contentText = contentArea.textContent || "";
  const timerRegexGlobal = /@\s*(\d{1,3})\s*:\s*(\d{1,2})\b/g; // Global for finding last match
  let lastMatchResult = null;
  let execResult;
  while ((execResult = timerRegexGlobal.exec(contentText)) !== null) {
    lastMatchResult = execResult;
  }

  if (lastMatchResult) {
    const timerCommand = lastMatchResult[0]; // e.g., "@0:30"
    const minutes = parseInt(lastMatchResult[1], 10);
    const seconds = parseInt(lastMatchResult[2], 10);

    if (
      !isNaN(minutes) &&
      !isNaN(seconds) &&
      seconds < 60 &&
      (minutes > 0 || seconds > 0)
    ) {
      // Extract title from the line containing the timerCommand
      let titleFromContent = "";
      const lines = contentText.split("\n");
      for (const line of lines) {
        const timerCommandIndexInLine = line.indexOf(timerCommand);
        if (timerCommandIndexInLine !== -1) {
          titleFromContent = line.substring(0, timerCommandIndexInLine).trim();
          break;
        }
      }

      if (titleFromContent) {
        postItElement.dataset.title = titleFromContent;
        const handleTitleElement = postItElement.querySelector(
          ".drag-handle .handle-title",
        );
        if (handleTitleElement)
          renderTitle(handleTitleElement, titleFromContent);
        adjustPostItMinWidthForTitle(postItElement);
      }
      // If no text before @, title remains as is or null.

      const durationMs = minutes * 60 * 1000 + seconds * 1000;
      const triggerTimestamp = Date.now() + durationMs;

      postItElement.dataset.triggerTimestamp = String(triggerTimestamp);
      postItElement.dataset.isTimerActive = "true";
      // Store only the timer command itself as originalTimerString for the "done" message
      postItElement.dataset.originalTimerString = timerCommand;

      contentArea.contentEditable = "false";
      postItElement.classList.add("postit-alarm-active");
      contentArea.innerHTML = `<div class="timer-content-display">🔔 ${formatTime(durationMs)}</div>`;
      // CSS should handle font size for .postit-alarm-active .content-area
      // contentArea.style.fontSize = ""; // Clears inline style to let CSS take over

      console.info(
        `Timer set for note ${postItElement.id} (Title: "${titleFromContent || "N/A"}", Command: ${timerCommand})`,
      );
    }
  }
  // No "else" needed to clear timer here, as if no valid command is found, nothing changes.
  // If a user deletes a timer string, the next blur/save will simply not find one.
  // The visual state (editable, no alarm class) would be restored by checkAllTimers if it had rung and finished.
}

// --- End New Timer Functionality ---

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
    requiredWidth,
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
    const content = contentArea.innerHTML; // Keep innerHTML for rich content
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
      // === ADDED FOR TIMER ===
      triggerTimestamp: noteEl.dataset.triggerTimestamp || null,
      isTimerActive: noteEl.dataset.isTimerActive === "true", // Save as boolean
      originalTimerString: noteEl.dataset.originalTimerString || null,
      // === END ADDED FOR TIMER ===
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
      console.info(`Loading ${notesArray.length} notes...`);
      notesArray.forEach((noteData) => {
        if (!document.getElementById(noteData.id)) createPostIt(noteData);
      });
    }
  });
}

// --- Helper Functions (Assumed to be defined elsewhere, but shown for context) ---
// const VALID_COLORS = ["yellow", "red", "green", "blue", "white"];
// const DEFAULT_COLOR = "yellow";
// function toTop(element) { /* ... */ }
// function renderTitle(handleTitleContainer, titleString) { /* ... */ }
// function adjustPostItMinWidthForTitle(postItElement) { /* ... */ }
// function dragMoveListener(event) { /* ... */ }
// function saveAllNotesState() { /* ... */ }
// --- Timer Specific Helper Functions (Assumed to be defined elsewhere) ---
// function formatTime(milliseconds) { /* ... */ }
// function processPostItTextForTimer(postItElement) { /* ... */ }

/**
 * Creates the main shell for a post-it note.
 * @param {object} noteData - The data for the note.
 * @returns {HTMLElement} The main post-it DIV element.
 */
function _buildPostItShell(noteData) {
  const postItElement = document.createElement("DIV");
  postItElement.id = noteData.id;
  postItElement.classList.add("post-it");

  let initialColor =
    noteData.color && VALID_COLORS.includes(noteData.color)
      ? noteData.color
      : DEFAULT_COLOR;
  postItElement.classList.add("postit-" + initialColor);
  postItElement.dataset.color = initialColor;

  if (noteData.title) postItElement.dataset.title = noteData.title;

  postItElement.style.left = noteData.left;
  postItElement.style.top = noteData.top;
  postItElement.setAttribute("data-x", "0");
  postItElement.setAttribute("data-y", "0");
  postItElement.style.transform = "translate(0px, 0px)";

  postItElement.addEventListener("mouseover", () => toTop(postItElement));
  return postItElement;
}

/**
 * Creates and appends the header elements (drag handle, title, delete button) to the post-it.
 * @param {HTMLElement} postItElement - The main post-it element.
 * @param {object} noteData - The data for the note (used for title rendering).
 * @returns {{dragHandle: HTMLElement, handleTitle: HTMLElement, deleteBtn: HTMLElement}}
 */
function _buildPostItHeader(postItElement, noteData) {
  const dragHandle = document.createElement("div");
  dragHandle.classList.add("drag-handle");
  dragHandle.setAttribute("aria-label", "Drag Note");

  const handleTitle = document.createElement("div");
  handleTitle.classList.add("handle-title");
  dragHandle.appendChild(handleTitle);
  postItElement.appendChild(dragHandle);

  renderTitle(handleTitle, noteData.title); // Render initial title

  const deleteBtn = document.createElement("button");
  deleteBtn.classList.add("delete-button");
  deleteBtn.setAttribute("aria-label", "Delete Note");
  deleteBtn.innerHTML = "&times;";
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const noteId = postItElement.id;

    // === ADDED: Stop repeating alarm if this note was ringing ===
    if (activeRingingIntervals[noteId]) {
      clearInterval(activeRingingIntervals[noteId]);
      delete activeRingingIntervals[noteId];
      console.info(`Stopped repeating alarm for deleted note ${noteId}`);
    }
    // === END ADDED SECTION ===

    postItElement.remove();
    saveAllNotesState();
  });
  postItElement.appendChild(deleteBtn); // Appending to postItElement, not dragHandle

  return { dragHandle, handleTitle, deleteBtn };
}

/**
 * Creates and appends the content area for the post-it.
 * @param {HTMLElement} postItElement - The main post-it element.
 * @param {object} noteData - The data for the note.
 * @returns {HTMLElement} The content area element.
 */
function _buildPostItContentArea(postItElement, noteData) {
  const contentArea = document.createElement("div");
  contentArea.classList.add("content-area");

  const initialFontSizePercent = noteData.fontSizePercent || 100;
  contentArea.style.fontSize = initialFontSizePercent + "%";
  contentArea.dataset.fontSizePercent = initialFontSizePercent;

  postItElement.appendChild(contentArea);
  return contentArea;
}

/**
 * Initializes the timer state, contentEditable, and initial content display.
 * @param {HTMLElement} postItElement - The main post-it element.
 * @param {HTMLElement} contentArea - The content area element.
 * @param {object} noteData - The data for the note.
 */
function _initializePostItState(postItElement, contentArea, noteData) {
  const isTimerActiveFromLoad = noteData.isTimerActive === true;
  const triggerTimestampFromLoad = parseFloat(noteData.triggerTimestamp);
  const originalTimerStringFromLoad = noteData.originalTimerString;

  // Store timer data in dataset
  if (noteData.triggerTimestamp)
    postItElement.dataset.triggerTimestamp = noteData.triggerTimestamp;
  postItElement.dataset.isTimerActive = String(isTimerActiveFromLoad);
  if (originalTimerStringFromLoad)
    postItElement.dataset.originalTimerString = originalTimerStringFromLoad;

  // Set initial content and editable state based on timer
  if (isTimerActiveFromLoad && triggerTimestampFromLoad) {
    contentArea.contentEditable = "false";
    postItElement.classList.add("postit-alarm-active");
    const remainingMs = triggerTimestampFromLoad - Date.now();
    if (remainingMs > 0) {
      contentArea.innerHTML = `<div class="timer-content-display">🔔 ${formatTime(
        remainingMs,
      )}</div>`;
    } else {
      contentArea.innerHTML = `<div class="timer-content-display">🔔 00:00</div>`;
    }
    // Let CSS handle font size for alarm display
  } else if (
    originalTimerStringFromLoad &&
    !isTimerActiveFromLoad &&
    triggerTimestampFromLoad > 0
  ) {
    contentArea.contentEditable = "true";
    postItElement.classList.remove("postit-alarm-active");
    contentArea.innerHTML = `<div class="timer-content-display timer-text-done">✅ ${originalTimerStringFromLoad}</div>`;
    contentArea.style.fontSize =
      (contentArea.dataset.fontSizePercent || 100) + "%"; // Restore normal font size
  } else {
    contentArea.innerHTML = noteData.content || "<br>";
    contentArea.contentEditable = "true";
    postItElement.classList.remove("postit-alarm-active");
    contentArea.style.fontSize =
      (contentArea.dataset.fontSizePercent || 100) + "%"; // Ensure normal font size
  }
}

/**
 * Attaches interact.js draggable listener.
 * @param {HTMLElement} postItElement - The main post-it element.
 */
function _attachDragListener(postItElement) {
  interact(postItElement).draggable({
    allowFrom: ".drag-handle",
    inertia: true,
    autoScroll: true,
    listeners: {
      move: dragMoveListener,
      start(event) {
        document.body.classList.add("user-select-none");
        event.target.classList.add("interact-dragging");
        if (
          document.activeElement &&
          typeof document.activeElement.blur === "function"
        ) {
          document.activeElement.blur();
        }
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
}

/**
 * Attaches event listeners to the content area of the post-it.
 * This function still contains the complex keydown logic.
 * @param {HTMLElement} postItElement - The main post-it element.
 * @param {HTMLElement} contentArea - The content area element.
 */
function _attachContentAreaListeners(postItElement, contentArea) {
  contentArea.addEventListener("click", (e) => {
    const targetItem = e.target.closest(".task-item");
    if (targetItem) {
      if (
        contentArea.contentEditable === "true" ||
        contentArea.contentEditable === true
      ) {
        const style = window.getComputedStyle(targetItem);
        const checkWidth = parseFloat(style.paddingLeft || "0");
        if (e.offsetX <= checkWidth) {
          targetItem.classList.toggle("task-done");
          saveAllNotesState();
        }
      }
    }
    const targetLink = e.target.closest("a");
    if (targetLink && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      const href = targetLink.href;
      if (href) {
        window.open(href, "_blank", "noopener,noreferrer");
      }
      return;
    }
  });

  contentArea.addEventListener("keydown", (e) => {
    // const postItElement = d; // 'd' is already postItElement in this scope
    const currentContentArea = e.target; // Should be contentArea
    const currentDragHandle = postItElement.querySelector(".drag-handle");

    if (
      postItElement.dataset.isTimerActive === "true" &&
      (contentArea.contentEditable === "false" ||
        contentArea.contentEditable === false)
    ) {
      const isCopy = e.ctrlKey && e.key.toLowerCase() === "c";
      const isSelectAll = e.ctrlKey && e.key.toLowerCase() === "a";
      const isNavigationKey = [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "PageUp",
        "PageDown",
        "Tab",
      ].includes(e.key);
      if (!(isCopy || isSelectAll || isNavigationKey || e.metaKey)) {
        if (
          (e.key.length === 1 && !e.ctrlKey && !e.altKey) ||
          ["Backspace", "Delete", "Enter"].includes(e.key)
        ) {
          e.preventDefault();
          return;
        }
      }
    }

    let shouldSave = false;
    let preventDefault = false;

    if (e.key === "Enter" && !e.shiftKey) {
      if (
        contentArea.contentEditable === "false" ||
        contentArea.contentEditable === false
      ) {
        e.preventDefault();
        return;
      }
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        shouldSave = true;
        if (shouldSave) {
          processPostItTextForTimer(postItElement);
          setTimeout(saveAllNotesState, 0);
        }
        return;
      }
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
            const handleTitleElement =
              currentDragHandle?.querySelector(".handle-title");
            renderTitle(handleTitleElement, title);
            postItElement.dataset.title = title;
            const elementToRemove = currentLineElement;
            const newDiv = document.createElement("div");
            newDiv.innerHTML = "<br>";
            currentContentArea.insertBefore(
              newDiv,
              elementToRemove.nextSibling,
            );
            try {
              currentContentArea.removeChild(elementToRemove);
            } catch (err) {
              console.error("Error removing title line:", err);
            }
            adjustPostItMinWidthForTitle(postItElement);
            try {
              range.setStart(newDiv, 0);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
            } catch (err) {
              console.error("Error setting range after title set:", err);
            }
          } else {
            shouldSave = true;
          }
        } else if (startsWithOpen || startsWithChecked) {
          preventDefault = true;
          shouldSave = true;
          const taskText = text.substring(3).trim();
          const isDone = startsWithChecked;
          currentLineElement.textContent = taskText;
          currentLineElement.classList.add("task-item");
          if (isDone) currentLineElement.classList.add("task-done");
          else currentLineElement.classList.remove("task-done");
          const newDiv = document.createElement("div");
          newDiv.innerHTML = "<br>";
          currentContentArea.insertBefore(
            newDiv,
            currentLineElement.nextSibling,
          );
          try {
            range.setStart(newDiv, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          } catch (err) {
            console.error("Error setting range after task creation:", err);
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
        Math.min(maxSizePercent, newPercent),
      );
      newPercent = Math.round(newPercent * 10) / 10;
      contentArea.style.fontSize = newPercent + "%";
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
        case "w":
          newColor = "white";
          break;
        default:
          newColor = null;
          shouldSave = false;
      }
      if (shouldSave && newColor) {
        VALID_COLORS.forEach((c) =>
          postItElement.classList.remove("postit-" + c),
        );
        postItElement.classList.add("postit-" + newColor);
        postItElement.dataset.color = newColor;
      }
    } else if (e.key === " ") {
      if (
        contentArea.contentEditable === "false" ||
        contentArea.contentEditable === false
      ) {
        e.preventDefault();
        return;
      }
      shouldSave = true;
    } else if (
      e.key.length === 1 ||
      e.key === "Backspace" ||
      e.key === "Delete"
    ) {
      if (
        contentArea.contentEditable === "false" ||
        contentArea.contentEditable === false
      ) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          return;
        }
      } else {
        shouldSave = true;
      }
    }

    if (preventDefault) {
      e.preventDefault();
    }
    if (shouldSave) {
      // ** MODIFICATION: Defer processing and saving **
      setTimeout(() => {
        if (
          contentArea.contentEditable === "true" ||
          contentArea.contentEditable === true
        ) {
          //processPostItTextForTimer(postItElement);
        }
        // Always save if shouldSave was true.
        // processPostItTextForTimer might have changed dataset attributes
        // or contentEditable state which needs saving.
        saveAllNotesState();
      }, 0);
    }
  });

  contentArea.addEventListener("blur", (e) => {
    if (
      contentArea.contentEditable === "true" ||
      contentArea.contentEditable === true
    ) {
      processPostItTextForTimer(postItElement);
    }
    saveAllNotesState();
  });

  contentArea.addEventListener("paste", (e) => {
    if (
      contentArea.contentEditable === "false" ||
      contentArea.contentEditable === false
    ) {
      e.preventDefault();
      return;
    }
    const selection = window.getSelection();
    if (
      !selection ||
      selection.rangeCount === 0 ||
      !contentArea.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      setTimeout(() => {
        if (
          contentArea.contentEditable === "true" ||
          contentArea.contentEditable === true
        ) {
          processPostItTextForTimer(postItElement);
        }
        saveAllNotesState();
      }, 0);
      return;
    }
    const range = selection.getRangeAt(0);
    let pastedText = (e.clipboardData || window.clipboardData)?.getData(
      "text/plain",
    );
    if (!pastedText) {
      setTimeout(() => {
        if (
          contentArea.contentEditable === "true" ||
          contentArea.contentEditable === true
        ) {
          processPostItTextForTimer(postItElement);
        }
        saveAllNotesState();
      }, 0);
      return;
    }
    let isValidUrl = false;
    let url = "";
    try {
      if (
        pastedText.startsWith("http://") ||
        pastedText.startsWith("https://")
      ) {
        url = new URL(pastedText).href;
        isValidUrl = true;
      }
    } catch (_) {
      isValidUrl = false;
    }
    if (isValidUrl && selection.isCollapsed === false) {
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
        processPostItTextForTimer(postItElement);
        saveAllNotesState();
      } catch (domError) {
        console.error("Error creating link on paste:", domError);
        setTimeout(() => {
          processPostItTextForTimer(postItElement);
          saveAllNotesState();
        }, 0);
      }
    } else {
      setTimeout(() => {
        processPostItTextForTimer(postItElement);
        saveAllNotesState();
      }, 0);
    }
  });
}

/**
 * Main function to create a post-it note, now refactored.
 * @param {object} noteData - The data for the note.
 * @returns {HTMLElement} The created post-it element.
 */
function createPostIt(noteData) {
  const postItElement = _buildPostItShell(noteData);
  _buildPostItHeader(postItElement, noteData); // Returns {dragHandle, handleTitle, deleteBtn} if needed
  const contentArea = _buildPostItContentArea(postItElement, noteData);

  _initializePostItState(postItElement, contentArea, noteData);
  _attachDragListener(postItElement);
  _attachContentAreaListeners(postItElement, contentArea); // This is still a large part

  document.body.appendChild(postItElement);

  // Apply zen mode if active
  if (typeof getZenMode === "function" && getZenMode()) {
    postItElement.classList.add("zen-hidden");
  }

  // Assuming adjustPostItMinWidthForTitle is available globally or passed appropriately
  setTimeout(() => adjustPostItMinWidthForTitle(postItElement), 50);

  return postItElement;
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
    if (ev.button != 0) {
      return;
    }
    console.info("Hold event detected for new post-it:", ev);
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

document.addEventListener("DOMContentLoaded", () => {
  loadNotes(); // This will call createPostIt for each note, which now initializes timer display

  // === ADDED FOR TIMER ===
  // Start the global timer checker interval
  if (timerIntervalId) {
    clearInterval(timerIntervalId); // Clear any existing interval (e.g., from previous script run in dev)
  }
  timerIntervalId = setInterval(checkAllTimers, 1000); // Check timers every second
  // === END ADDED FOR TIMER ===
});
