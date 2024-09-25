export { links };

/*
link = {
  url: "destination", optional, even if it's "links" it can actually be just text
  display: "text to show, can be HTML (is assumed to be HTML)",
  shortcut: "One or two letter shortcut to quickly visit this site",
  kind: "one of title or normal. Title is larger and has different styling. Used as class",
  url2: "additional URL to show to the right, floating of the first",
  display2: "additional text to show, can be HTML"
}
*/

const goog = {
  url: "https://google.com",
  display: "<i>G</i>oog",
  shortcut: "go",
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
  shortcut: "gd",
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

const links = [goog, googGemini, googDocs, hr, newspapers, theGuardian];
