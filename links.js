/*
link = {
  url: "destination", optional, even if it's "links" it can actually be just text
  display: "text to show, can be HTML (is assumed to be HTML)",
  shortcut: "One or two letter shortcut to quickly visit this site",
  kind: "in general, one of title or normal. Title is larger and has different styling. Used as class",
  url2: "additional URL to show to the right, floating of the first",
  display2: "additional text to show, can be HTML"
}

kind can also be:
- sep to add an HR
- col to break into a new column
- settings, then display holds a CSS style rule, named as a Javascript property identifier (no dashes, using capitalisation)
*/

const gemini = {
  url: "https://gemini.google.com",
  display: "Gemini",
  shortcut: "gg",
  kind: "normal",
};

const omnivore = {
  url: "https://omnivore.app/home",
  display: "Omnivore",
  shortcut: "o",
  kind: "normal",
};

const githubRepoList = {
  url: "https://github.com/rberenguel?tab=repositories",
  display: "Repo list",
  shortcut: "gr",
  kind: "normal",
};

const githubWeave = {
  url: "https://github.com/rberenguel/weave",
  display: "Weave",
  shortcut: "gw",
  kind: "normal",
};

const github = {
  display: "Github",
  kind: "title",
};

const hr = {
  kind: "sep",
};

const col = {
  kind: "col",
};

const fontsize = {
  display: "fontSize: 20px",
  kind: "settings",
};

const vscode = {
  kind: "title",
  display: "VSCode",
};

const vscodeLinks = {
  url: "vscode://file/Users/ruben/fromsource/nt/links.js",
  display: "Edit links",
  kind: "normal",
  shortcut: ".l",
};

const vscodeTasks = {
  url: "vscode://file//Users/ruben/Library/Mobile%20Documents/com~apple~CloudDocs/_nt/tasks.js",
  display: "Edit tasks",
  kind: "normal",
  shortcut: ".t",
};

const usenixSRE = {
  url: "https://www.usenix.org/publications/loginonline?field_lv2_article_type_tid=All&field_lv2_tags_tid=1102",
  display: "usenix SRE",
  kind: "normal",
  shortcut: "u",
};

const links = [
  fontsize,
  omnivore,
  gemini,
  usenixSRE,
  github,
  githubRepoList,
  githubWeave,
  hr,
  vscode,
  vscodeLinks,
  vscodeTasks,
];

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = { links }; 
} else {
  window.links = links;
}