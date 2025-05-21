if (location.href.startsWith("http")) {
  mainParser("config/online.md");
} else {
  mainParser("config/local.md");
}