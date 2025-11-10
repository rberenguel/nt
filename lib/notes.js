const body = document.body;
const storageKey = "scratchpadContent";

const colorMap = {
  v: "color-violet",
  m: "color-magenta",
  b: "color-blue",
  c: "color-cyan",
  g: "color-green",
  y: "color-yellow",
  o: "color-orange",
  r: "color-red",
};
const validCommands = new Set(Object.keys(colorMap));
validCommands.add("n"); // for 'none'
const allColorClasses = Object.values(colorMap);

let commandSelection = "";

window.addEventListener("DOMContentLoaded", () => {
  const savedContent = localStorage.getItem(storageKey);
  body.innerHTML =
    savedContent ||
    "<div><!-- Select a letter (v,m,b,c,g,y,o,r,n) then Alt-click a line to style it. --></div>";

  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(body);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
});

let saveTimeout;
body.addEventListener("keyup", () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    localStorage.setItem(storageKey, body.innerHTML);
  }, 300);
});

body.addEventListener("mousedown", (e) => {
  if (!e.altKey) {
    commandSelection = "";
    return;
  }

  const selection = window.getSelection().toString().trim().toLowerCase();

  if (selection.length === 1 && validCommands.has(selection)) {
    e.preventDefault();
    commandSelection = selection;
  } else {
    commandSelection = "";
  }
});

body.addEventListener("click", (e) => {
  if (!e.altKey || !commandSelection) {
    return;
  }

  const command = commandSelection;

  let targetNode = e.target;
  while (targetNode && targetNode.nodeName !== "DIV") {
    targetNode = targetNode.parentNode;
  }

  if (targetNode && targetNode.parentNode === body) {
    allColorClasses.forEach((cls) => targetNode.classList.remove(cls));

    if (command !== "n") {
      const colorClass = colorMap[command];
      if (colorClass) {
        targetNode.classList.add(colorClass);
      }
    }
  }
  commandSelection = "";
});

body.addEventListener("input", () => {
  if (body.innerHTML === "" || body.innerHTML === "<br>") {
    body.innerHTML = "<div><br></div>";
    const range = document.createRange();
    range.setStart(body.firstChild, 0);
    range.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    return;
  }

  // Check for any direct child that is an unwrapped text node.
  for (const node of body.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "") {
      const sel = window.getSelection();
      const anchorOffset = sel.anchorOffset;

      const div = document.createElement("div");
      div.appendChild(node.cloneNode());
      body.replaceChild(div, node); // Replace original text node with the new div

      // Restore cursor inside the NEW text node within the div. This is reliable.
      const newTextNode = div.firstChild;
      if (newTextNode) {
        const range = document.createRange();
        const newOffset = Math.min(anchorOffset, newTextNode.length);
        range.setStart(newTextNode, newOffset);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      break; // Fix one unwrapped node per event.
    }
  }
});
