/*
link = {
  url: "destination", optional, even if it's "links" it can actually be just text
  display: "text to show, can be HTML (is assumed to be HTML)",
  shortcut: "One or two letter shortcut to quickly visit this site",
  kind: "in general, one of title or normal. Title is larger and has different styling. Used as class",
  url2: "additional URL to show to the right, floating of the first",
  display2: "additional text to show, can be HTML"
  alsoOpen2: true/false, keyboard shortcut also opens secondary link.
}

kind can also be:
- sep to add an HR
- col to break into a new column
- settings, then display holds a CSS style rule, named as a Javascript property identifier (no dashes, using capitalisation)

All of this can be written in markdown-like, equivalently.
Use different files for different columns, and prefix secondary URL title by *

*/

window.hasKeys = ""; // Store the first key pressed

const linkWithShortcut = /`(.*?)`\s*\[(.*?)\]\((.*?)\)/;

function textToLinkObjects(text) {
  let links = [];
  let valid;
  let settings = false;
  const split = text.split("\n");
  let link = {};
  for (let i = 0; i < split.length; i++) {
    const line = split[i].trim();
    // Handle titles and settings
    if (line === "---") {
      if (link.kind) {
        links.push(link); // Store and
        link = {}; // clean up the existing link
      }
      links.push({
        kind: "sep",
      });
      continue;
    }
    let cleaned;
    if (line.startsWith("- ")) {
      cleaned = line.replace("- ", "").trim();
      if (settings) {
        links.push({
          display: cleaned,
          kind: "settings",
        });
        continue;
      } else {
        const matchLink = cleaned.match(linkRegex);
        if (matchLink) {
          link.display2 = matchLink[1];
          if (link.display2.startsWith("*")) {
            link.alsoOpen2 = true;
            link.display2 = link.display2.slice(1);
          }
          link.url2 = matchLink[2];
          continue;
        }
      }
    }
    if (line.startsWith("# ")) {
      if (settings) {
        settings = false;
      }
      if (link.kind) {
        links.push(link); // Store and
        link = {}; // clean up the existing link
      }

      cleaned = line.replace("# ", "").trim();
      if (cleaned == "Settings") {
        settings = true;
        continue;
      } else {
        link.kind = "title";
      }
      valid = true;
    }
    if (line.startsWith("## ")) {
      if (settings) {
        settings = false;
      }
      if (link.kind) {
        links.push(link); // Store and
        link = {}; // clean up the existing link
      }
      cleaned = line.replace("## ", "").trim();
      link.kind = "normal";
      valid = true;
    }
    if (!valid) {
      console.log("Invalid?");
      console.log(line);
      continue;
    }
    if (!cleaned) {
      continue;
    }
    const matchShortcut = cleaned.match(linkWithShortcut);
    if (matchShortcut) {
      link.shortcut = matchShortcut[1];
      link.display = matchShortcut[2];
      link.url = matchShortcut[3];
      continue;
    }
    const matchLink = cleaned.match(linkRegex);
    if (matchLink) {
      link.display = matchLink[1];
      link.url = matchLink[2];
      continue;
    } else {
      link.display = cleaned;
    }
  }
  if (link.display) {
    links.push(link);
  }
  return links;
}

function linksFromMarkdown(paths, cb) {
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
          console.log(markdown);
          return textToLinkObjects(markdown);
        }),
    );
  });

  Promise.all(promises)
    .then((results) => {
      // Flatten the array of arrays into a single array of tasks
      let allLinks = [];
      for (let block of results) {
        console.log(block);
        allLinks = allLinks.concat({ kind: "col" });
        allLinks.push(block);
      }
      const flattened = allLinks.slice(1).flat();
      window._links = flattened;
      cb(flattened);
    })
    .catch((error) => console.error("Error loading markdown file:", error));
}

function addLinksToDiv(links, targetDivId) {
  const targetDiv = document.getElementById(targetDivId);
  if (!targetDiv) {
    console.error("Target div not found:", targetDivId);
    return;
  }
  targetDiv.addEventListener("mouseover", () => toTop(targetDiv));
  targetDiv.innerHTML = "";
  let wrapperNode = document.createElement("DIV");
  wrapperNode.classList.add("quicklink-column");
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (link.kind == "settings") {
      const property = link.display.split(":")[0].trim();
      const value = link.display.split(":")[1].trim();
      targetDiv.style[property] = value;
      continue;
    }
    if (link.kind == "sep") {
      const hr = document.createElement("HR");
      wrapperNode.appendChild(hr);
      continue;
    }
    if (link.kind == "col") {
      wrapperNode = document.createElement("DIV");
      wrapperNode.classList.add("quicklink-column");
      continue;
    }
    const div = document.createElement("DIV");
    div.classList.add("quicklink-div");
    let node;
    if (link.url) {
      node = document.createElement("A");
      node.href = link.url;
    } else {
      node = document.createElement("SPAN");
    }
    node.classList.add("quicklink");
    node.classList.add(link.kind);
    node.innerHTML = link.display;
    div.appendChild(node);
    if (link.url2) {
      const b = document.createElement("A");
      b.classList.add("quicklink");
      b.classList.add("extra");
      b.innerHTML = link.display2;
      b.href = link.url2;
      div.appendChild(b);
    }
    if (link.shortcut) {
      node.title = `${link.display} (${link.shortcut})`;
      const shortcutDiv = document.createElement("DIV");
      shortcutDiv.classList.add("quicklink");
      shortcutDiv.classList.add("shortcut");
      const one = link.shortcut[0];
      const two = link.shortcut[1];
      let shortcut = "[";
      for (let i = 0; i < link.shortcut.length; i++) {
        shortcut += `<span class="letter-${i}">${link.shortcut[i]}</span>`;
      }
      shortcutDiv.innerHTML = `${shortcut}]`;
      div.appendChild(shortcutDiv);
    }
    wrapperNode.appendChild(div);
    targetDiv.appendChild(wrapperNode);
  }

  document.addEventListener("keydown", function (event) {
    if (event.metaKey) {
      return;
    }
    event.preventDefault();
    const shortcuts = document.querySelectorAll(".quicklink.shortcut");
    console.info(`Keys: ${window.hasKeys}`);
    const nextKey = event.key;
    window.hasKeys = window.hasKeys + [nextKey];
    const shortcut = window.hasKeys;
    let match = false;
    Array.from(shortcuts).map((s) => {
      if (s.textContent.startsWith(`[${shortcut}`)) {
        match = true;
        for (let i = 0; i < shortcut.length; i++) {
          s.querySelector(`span.letter-${i}`).classList.add("highlight");
        }
        s.closest(".quicklink-div").classList.add("highlight");
      } else {
        Array.from(s.querySelectorAll("span")).map((l) => {
          l.classList.remove("highlight");
          s.closest(".quicklink-div").classList.remove("highlight");
        });
      }
    });

    if (window.hasKeys) {
      console.info(`Shortcut: ${shortcut}`);
      const matchingLink = links.find((link) => link.shortcut === shortcut);
      if (matchingLink) {
        window.hasKeys = ""; // This is kind of pointless though
        if (matchingLink.alsoOpen2) {
          window.open(matchingLink.url2, "_blank");
        }
        window.location.href = matchingLink.url;
      } else {
        if (!match) {
          window.hasKeys = "";
        }
      }
    } else {
      window.hasKeys = [event.key];
      const matchingLink = links.find((link) => link.shortcut === event.key);

      if (matchingLink) {
        window.location.href = matchingLink.url;
        window.hasKeys = ""; // Reset firstKey after a successful match
      }
    }
  });
  targetDiv.focus();
}
