// Construct whatever you want here.

// Open each file called somethingUtils.js for a brief description of features

linksFromMarkdown(["links.md"], (ls) => addLinksToDiv(ls, "center"));

addTimesToDiv(timezones, "upper-left");
randomBackground(backgrounds);

const locations = {
  Adliswil: {
    lat: 47.3081,
    long: 8.5318,
  },
};

plotWeather(locations["Adliswil"], "upper-right");

tasksFromMarkdown(
  ["common.md", "lego.md", "web.md", "gamedev.md", "pico.md", "done.md"],
  (ts) => addTasksToDiv(ts, "lower-left"),
);
