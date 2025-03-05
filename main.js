// Construct whatever you want here.

// Open each file called somethingUtils.js for a brief description of features

linksFromMarkdown(["links_sample.md"], (ls) => addLinksToDiv(ls, "center"));

addTimesToDiv(timezones, "lower-left");
randomBackground({
  backgrounds: backgrounds.concat(mwcBackgrounds),
  today: true, // This will fix the random seed so the background is the same through today
});

const locations = {
  Adliswil: {
    lat: 47.3081,
    long: 8.5318,
  },
};

plotWeather("Adliswil", locations["Adliswil"], "upper-right", {
  width: "400px",
});

/*tasksFromMarkdown(["common.md", "done.md"], (ts) =>
  addTasksToDiv(ts, "lower-left"),
);*/

const qfm = () =>
  quotesFromMarkdown(
    ["quotes_sample.md"],
    (ts) => {
      addQuotesToDiv({
        quotes: ts,
        target: "upper-left",
        today: true, // This will fix the random seed so the background is the same through today
      });
    },
    (basepath = ""),
  );

qfm();
