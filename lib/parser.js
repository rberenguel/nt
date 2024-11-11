function textToObject(text, hPos = 0, filepath) {
  const lines = text.split("\n");
  let obj = {};
  obj._hPos = hPos;
  obj._filepath = filepath;
  obj.lines = []; // Only used (for now) for quotes
  let settings = false;
  let projects = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Extract the task. If it has a link, it is the main link.
    // Handle settings and projects inline, breaking.
    if (line.startsWith("# ")) {
      let cleaned = line.replace("# ", "").trim();
      if (cleaned == "Settings") {
        settings = true;
        obj._valid = true;
        obj.settings = {};
        continue;
      }
      if (cleaned == "Projects") {
        projects = true;
        obj._valid = true;
        obj.projects = [];
        continue;
      }
      if (cleaned == "hr") {
        obj.hr = true;
        obj._valid = true;
        continue;
      }
      if (cleaned.startsWith("[x]") || cleaned.startsWith("[X]")) {
        obj.done = true;
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith("(someday)") || cleaned.endsWith("(Someday)")) {
        obj.someday = true;
        obj.prio = -1000;
        cleaned = cleaned.replace(/\s+\(.omeday\)/, "");
      }
      const linkMatch = cleaned.match(linkPlusRegex);
      if (linkMatch) {
        obj.text = linkMatch[1] + (linkMatch[3] ?? "");
        obj.link = linkMatch[2];
      } else {
        obj.text = cleaned;
      }
      obj._valid = true;
      continue;
    }
    if (line == "[x]" || line == "[X]") {
      obj.done = true;
      continue;
    }
    if (line.startsWith("> ")) {
      obj.lines.push(line.replace(/^> /, ""));
      obj._valid = true;
      continue;
    }
    if (line.startsWith("prio:")) {
      if (!obj.someday) {
        obj.prio = parseInt(line.replace("prio:", ""));
      }
      continue;
    }
    if (line.startsWith("color:")) {
      obj.color = line.replace("color:", "").trim();
      continue;
    }
    if (line.startsWith("extracolor:")) {
      obj.extraColor = line.replace("extracolor:", "").trim();
      continue;
    }

    // Get the lists of links or properties if it's a settings list
    if (line.startsWith("- ")) {
      const cleaned = line.replace("- ", "").trim();
      if (settings) {
        const [prop, val] = cleaned.split(":");
        obj.settings[prop.trim()] = val.trim();
        continue;
      }
      if (projects) {
        const thingy = cleaned.split(",");
        if (thingy.length == 1) {
          obj.projects.push(thingy[0]);
        } else {
          obj.projects.push(thingy.map((p) => p.trim()));
        }
        continue;
      }
      const linkMatch = cleaned.match(linkRegex);
      if (linkMatch) {
        if (obj.links) {
          obj.links.push([linkMatch[1], linkMatch[2]]);
        } else {
          obj.links = [[linkMatch[1], linkMatch[2]]];
        }
        continue;
      } else {
        // If we are in a list, haven't matched a known property,
        // and match no link, we are in a log message.
        if (obj.msg) {
          obj.msg.push(cleaned);
        } else {
          obj.msg = [cleaned];
        }
      }
    } else {
      // If the line does not start a list and we have not processed a known command…
      const cleaned = line.trim();
      if (cleaned) {
        // Could be empty, so…
        obj.extra = cleaned;
      }
    }
  }
  return obj;
}
