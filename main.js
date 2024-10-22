// Construct whatever you want here.

addLinksToDiv(links, "center");
addTimesToDiv(timezones, "upper-left");
randomBackground(backgrounds);

const locations = {
  Adliswil: {
    lat: 47.3081,
    long: 8.5318,
  },
};

plotWeather(locations["Adliswil"], "upper-right");

addTasksToDiv(tasks, "lower-left");
