// Construct whatever you want here.

import {
  addTimesToDiv,
  addLinksToDiv,
  randomBackground,
} from "./utilities.js";
import { links } from "./links.js";
import { backgrounds } from "./backgrounds.js";
import { timezones } from "./timezones.js";
import { plotWeather } from "./weather.js";

addLinksToDiv(links, "center");
addTimesToDiv(timezones, "upper-left");
randomBackground(backgrounds);

const locations = {
  "Adliswil": {
    lat: 47.3081, long: 8.5318
  }
}

plotWeather(locations["Adliswil"], "upper-right");
