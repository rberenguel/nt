class Replacer {
  constructor(title, placeholders, aliases) {
    this.title = title;
    this.inputs = placeholders;
    this.aliases = aliases;
  }
  lambda(...vals) {
    const replacement = this.updater(...vals);
    const text = new ClipboardItem({
      "text/plain": Promise.resolve(replacement).then(
        (text) => new Blob([text], { type: "text/plain" }),
      ),
    });
    navigator.clipboard
      .write([text])
      .then(() => console.info("Copied successfully"))
      .catch((err) => console.error(err));
  }
  updater(...vals) {
    let replacement = this.title;
    for (let i = 0; i < vals.length; i++) {
      replacement = replacement.replace(`{${this.inputs[i].title}}`, vals[i]);
    }
    return replacement;
  }
}

function replacementsFromMarkdown(paths, cb) {
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
          let commands = [];
          let current = {};
          let count = 0;
          current.replacements = [];
          current._title = [];
          const lines = markdown.split("\n");
          for (let line of lines) {
            if (line.startsWith("```")) {
              if (count == 2) {
                count = 0;
                current.title = current._title.join("\n");
                commands.push(current);
                current = {};
                current.replacements = [];
                current._title = [];
              }
              count++;
              continue;
            }
            if (line.startsWith("# ")) {
              if (count == 2) {
                count = 0;
                current.title = current._title.join("\n");
                commands.push(current);
                current = {};
                current.replacements = [];
                current._title = [];
              }
              current.aliases = [line.replace("# ", "").trim()];
              continue;
            }
            if (line.startsWith("- ")) {
              line = line.replace("- ", "").trim();
              const title = line.split(":")[0].trim();
              const value = line.split(":")[1]?.trim();

              if (value) {
                current.replacements.push({ title: title, default: value });
              } else {
                current.replacements.push({ title: title });
              }
            } else {
              if (line.trim().length > 0) {
                current._title.push(line.trim());
              }
            }
          }
          current.title = current._title.join("\n");
          commands.push(current);
          console.log(commands);
          return commands.map(
            (c) => new Replacer(c.title, c.replacements, c.aliases),
          );
        }),
    );
  });

  Promise.all(promises)
    .then((results) => {
      // Flatten the array of arrays into a single array of tasks
      cb(results.flat());
    })
    .catch((error) => console.error("Error loading markdown file:", error));
}

function processReplacements(replacementItems) {
  console.log(
    `HANDLER: processReplacements called with ${replacementItems.length} item(s)`,
  );
  const replacements = replacementItems?.[0];

  if (!replacements) {
    console.log("No replacement items found.");
    return;
  }
  if (
    typeof replacementsFromMarkdown !== "function" ||
    typeof metaP !== "object"
  )
    return console.error(
      "Dependency check failed inside processReplacements: 'replacementsFromMarkdown' or 'metaP'.",
    );
  const replacementKeys = Object.keys(replacements).filter(
    (k) => k !== "kind" && k !== "title" && k !== "div",
  );
  if (replacementKeys.length > 0) {
    console.log("Calling replacementsFromMarkdown for keys:", replacementKeys);
    replacementsFromMarkdown(replacementKeys, (b) => {
      metaP.bind(b, { sepia: 30 });
    });
  } else {
    console.log("No actual replacement keys found in replacement item.");
  }
}
