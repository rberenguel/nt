const gemini = {
  url: "https://gemini.google.com",
  display: "Gemini",
  shortcut: "gg",
  kind: "normal",
};

const jellyfin = {
  url: "http://localhost:8096/web",
  display: "Jellyfin",
  shortcut: "j",
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
  jellyfin,
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

/*

Equivalent markdown file:

# Settings

- fontSize: 20px

## `j` [jellyfin](http://localhost:8096/web)

## `gg` [Gemini](https://gemini.google.com)
- [Gem manager](https://gemini.google.com/gems/view)

## `u` [usenix SRE](https://www.usenix.org/publications/loginonline?field_lv2_article_type_tid=All&field_lv2_tags_tid=1102)


# Github

## `gr` [Repo list](https://github.com/rberenguel?tab=repositories) 

## `gw` [Weave](https://github.com/rberenguel/weave) 

---

# VSCode

## `.l` [Edit links](vscode://file/Users/ruben/fromsource/nt/links.js)

## `.t` [Edit tasks](vscode://file//Users/ruben/Library/Mobile%20Documents/com~apple~CloudDocs/_nt/tasks.js)

*/
