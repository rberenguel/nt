export { links };

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

const goog = {
  url: "https://google.com",
  display: "Goog",
  shortcut: "g ",
  kind: "title",
};

const googGemini = {
  url: "https://gemini.google.com",
  display: "Gemini",
  shortcut: "gg",
  kind: "normal",
};

const googDocs = {
  url: "https://docs.google.com",
  display: "Goog Docs",
  shortcut: "gdo", // Just to show 3 letters works
  kind: "normal",
  url2: "https://docs.new",
  display2: "(new)",
};

const newspapers = {
  display: "Newspapers",
  kind: "title",
};

const theGuardian = {
  url: "https://theguardian.co.uk",
  display: "The Guardian",
  shortcut: "t",
  kind: "normal",
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

const links = [
  fontsize,
  goog,
  googGemini,
  googDocs,
  hr,
  col,
  newspapers,
  theGuardian,
];
