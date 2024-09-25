// Construct whatever you want here.

import {
  addTimesToDiv,
  addLinksToDiv,
  randomBackground,
  addIframes,
} from "./utilities.js";
import { links } from "./links.js";
import { backgrounds } from "./backgrounds.js";
import { timezones } from "./timezones.js";
import { iframes } from "./iframes.js";

addLinksToDiv(links, "center");
addTimesToDiv(timezones, "upper-left");
randomBackground(backgrounds);
addIframes(iframes, "lower-left");
