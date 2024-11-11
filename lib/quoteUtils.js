// TODO(me) Just a copypaste of pieces of taskUtils to get this working. Needs cleanup, and might not merge settings correctly

/*

Example quotes file:

# Settings

- backgroundColor: var(--grey-trans)
- fontSize: 1.5vh
- borderRadius: 0.2em
- width: 20em
- padding: 1em

---

> I love deadlines. I love the whooshing noise they make as they go by

Douglas Adams



*/

function textToQuoteObject(text) {
  const lines = text.split("\n");
  let obj = {};
  obj._valid = true;
  obj.lines = [];
  let settings = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line == "# Settings") {
      settings = true;
      obj._valid = true;
      obj.settings = {};
      continue;
    }
    if (line.startsWith("- ") && settings) {
      const cleaned = line.replace("- ", "").trim();

      const [prop, val] = cleaned.split(":");
      obj.settings[prop.trim()] = val.trim();
      continue;
    }

    console.log(line);
    if (line.startsWith("> ")) {
      obj.lines.push(line.replace(/^> /, ""));
    }
    if (line.length === 0) {
      continue;
    }
    obj.author = line;
  }
  return obj;
}

function quotesFromMarkdown(paths, cb, basepath) {
  const promises = [];

  if (typeof paths === "string") {
    paths = [paths];
  }

  paths.forEach((path) => {
    promises.push(
      fetch(path)
        .then((response) => response.text())
        .then((markdown) => {
          let quotes = [];

          const blocks = markdown.split(/---/);
          for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            let obj = textToQuoteObject(block);
            if (basepath) {
              obj = textToQuoteObject(block);
            }

            if (!obj._valid) {
              tasks.push({
                text: `Error loading quote ${i} from file ${path}`,
                error: true,
              });
              continue;
            }
            quotes.push(obj);
          }
          return quotes;
        }),
    );
  });
  Promise.all(promises)
    .then((results) => {
      // Flatten the array of arrays into a single array of tasks
      const allQuotes = results.flat();
      window._quotes = allQuotes;
      cb(allQuotes);
    })
    .catch((error) => console.error("Error loading markdown file:", error));
}

function addQuotesToDiv(_quotes, targetDivId) {
  const quotes = shuffleArray(_quotes);
  const d = () => document.createElement("DIV");
  const targetDiv = document.getElementById(targetDivId);
  if (!targetDiv) {
    console.error("Target div not found:", targetDivId);
    return;
  }
  for (let i = 0; i < quotes.length; i++) {
    const quote = quotes[i];
    if (quote.settings) {
      for (const key in quote.settings) {
        targetDiv.style[key] = quote.settings[key];
      }
      continue;
    }
    const div = d();
    const color = colors[i % colors.length];
    div.style.color = `var(${color})`;
    div.classList.add("quote-wrapper");
    const q = d();
    q.classList.add("quote");
    const a = d();
    a.classList.add("author");
    for (const line of quote.lines) {
      const p = document.createElement("p");
      p.textContent = line;
      q.appendChild(p);
    }
    a.textContent = quote.author;
    div.appendChild(q);
    div.appendChild(a);
    targetDiv.appendChild(div);
  }
}
