// TODO(me) This might need cleanup, it has been hacked quickly into the parser

/*

- Handles settings as in task lists
- Start the text by adding a blockquote block > (can be multiple lines)
- Add a line at the end with the author or reference.

Example quotes file:

# Settings

- backgroundColor: var(--grey-trans)
- fontSize: 1.5vh
- borderRadius: 0.2em
- width: 20em
- padding: 1em
- margin-bottom: 2em

---

> I love deadlines. I love the whooshing noise they make as they go by

Douglas Adams

---

> Everyone has a plan: until they get punched in the face

Mike Tyson



*/

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
            let obj = textToObject(block);
            if (basepath) {
              obj = textToObject(block);
            }

            if (!obj._valid) {
              quotes.push({
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

const getSettings = (objs) => {
    return objs.filter(o => o.settings)
}

function addQuotesToDiv(_quotes, targetDivId) {
  const settings = getSettings(_quotes)
  const quotes = settings.concat(shuffleArray(_quotes)); // Just place them at the beginning and call it a day
  const d = () => document.createElement("DIV");
  const targetDiv = document.getElementById(targetDivId);
  if (!targetDiv) {
    console.error("Target div not found:", targetDivId);
    return;
  }
  let wrapperNode = d();
  wrapperNode.id = "quoteWrapper";
  let rendered = false;
  for (let i = 0; i < quotes.length; i++) {
    const quote = quotes[i];
    if (quote.settings) {
      for (const key in quote.settings) {
        wrapperNode.style[key] = quote.settings[key];
      }
      continue;
    }
    if(rendered){
        // Just show one quote.
        return;
    }
    const div = d();
    const color = colors[Math.floor((Math.random()*colors.length) % colors.length)];
    div.style.color = `var(${color})`;
    div.classList.add("quote");
    const q = d();
    q.classList.add("text");
    const a = d();
    a.classList.add("author");
    for (const line of quote.lines) {
      const p = document.createElement("p");
      p.textContent = line;
      q.appendChild(p);
    }
    a.textContent = quote.extra;
    div.appendChild(q);
    div.appendChild(a);
    wrapperNode.appendChild(div);
    targetDiv.appendChild(wrapperNode)
    rendered = true;
  }
}
