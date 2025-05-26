# NT (New Tab)

A highly customizable New Tab page extension for Chrome, built with vanilla JavaScript. Designed for easy tweaking by editing local configuration files and code, allowing for a personalized dashboard experience. This is my daily driver new tab page at work and home.

- [NT (New Tab)](#nt-new-tab)
  - [Overview](#overview)
  - [Features](#features)
  - [Configuration](#configuration)
    - [File Structure](#file-structure)
    - [Format](#format)
    - [Widget Kinds](#widget-kinds)
      - [Weather](#weather)
      - [Timezones](#timezones)
      - [Links](#links)
      - [Quotes](#quotes)
      - [Backgrounds](#backgrounds)
      - [Sunrise/Sunset](#sunrisesunset)
      - [Countdowns](#countdowns)
      - [Iframes](#iframes)
      - [Post-its](#post-its)
      - [Replacements](#replacements)
  - [Setup / Installation](#setup--installation)
  - [Tweaking / Customization](#tweaking--customization)
  - [Safari Conversion](#safari-conversion)
  - [Known Issues / Notes](#known-issues--notes)
  - [Dependencies \& Attribution](#dependencies--attribution)
  - [Image Credits](#image-credits)

## Overview

This extension replaces Chrome's default _New Tab_ page with a dynamic dashboard configured via simple markdown-like text files. It avoids build toolchains, making modifications as simple as editing text files. Configuration *is* code (or rather, structured text).

**DEMO**: You can see an example configuration "live" [here](https://mostlymaths.net/nt/) (Note: This online demo uses `config/online.md` and post its are not saveable).

![](https://raw.githubusercontent.com/rberenguel/nt/gh-pages/media/screenshot.png)

## Features

* **Weather:** Displays current weather for multiple locations using OpenMeteo API.
* **Timezones:** Shows clocks for multiple configured timezones.
* **Links (Quicklinks):** Customizable list of links, optionally with keyboard shortcuts for quick navigation (Press `ESC` then shortcut keys).
* **Quotes:** Displays quotes from configured files, can be set to rotate daily.
* **Backgrounds:** Rotates background images from configured lists, can be set to rotate daily. The seed for daily rotation can be changed by Alt-clicking the 'π' symbol.
* **Sunrise/Sunset:** Displays calculated sunrise and sunset times for specific locations using SunCalc.js.
* **Countdowns:** Shows countdown timers to specific future dates and times.
* **Iframes:** embeds an iframe. Like, random example, the current oncaller of an oncall rotation.
* **Post-its:** Allows creating draggable, editable, persistent sticky notes directly on the page (uses `interact.js` and `chrome.storage.local`). Colors and font size can be changed.
* **Replacements:** Uses the `metaP` library to perform text replacements. This is specific to some usecases I have and is hard to explain, so just ignore.

## Configuration

Configuration is primarily handled by editing markdown-like files within the `config/` directory.

### File Structure

* The entry point determines which main config file is loaded:
    * `config/local.md`: Used when accessing via `file://` protocol (typical for local unpacked extensions).
    * `config/online.md`: Used when accessing via `http://` or `https://` protocols.
* These main config files define different sections (widgets/features).
* Some sections (like Links, Quotes, Backgrounds, Replacements) can reference *other* files (e.g., `config/links.md`, `config/quotes.md`) which contain the actual lists of data.

You can check the `config/online.md` file as an example, although it might get outdated quickly, at the time of this writing it looks like this:

```
# Weather

## Adliswil

- lat: 47.3081
- lon: 8.5318
- div: upper-right
- width: 400px

## Zurich

- lat: 47.3797259
- lon: 8.529028
- div: upper-right
- width: 400px

# Timezones
- fontSize: 3em
- div: lower-left

## svl
- tz: America/Los_Angeles

## ny
- tz: America/New_York

## zrh
- tz: Europe/Zurich

# Links
- div: center
- config/links_sample.md

# Quotes
- div: upper-left
- today: false
- config/quotes_sample.md

# Backgrounds
- today: true
- config/backgrounds.md
- config/mwcBackgrounds.md

# Countdowns

## Sabaton
- target: 20251118 1900
- div: lower-right
- precision: minutes

# iframes

## Example Site
- src: https://example.com
- div: lower-right
- width: 90%
- height: 24px
```

### Format

The configuration files use a simple text format parsed by `lib/mainParser.js`:

* `# kind`: Defines the start of a new widget/section type (e.g., `# Weather`, `# Links`). The `kind` name is case-insensitive.
* `## title`: Defines a specific instance or sub-section within a `kind`. For kinds that support multiple instances (like Weather, Timezones, Countdowns, Sunrise/Sunset), each `## title` starts a new instance.
* `- key: value`: Defines properties for the current `kind` or `title` instance. Keys and values are trimmed. Values can contain colons.

### Widget Kinds

Here are the supported `kind` sections and their common properties based on `config/local.md` and `mainParser.js`:

#### Weather
* Starts with `# Weather`.
* Requires `## Location Name` for each instance.
* Properties:
    * `- lat: Latitude`
    * `- lon: Longitude`
    * `- div: ID of the target HTML div` (e.g., `upper-right`)
    * Other `- key: value` pairs are passed as options (e.g., `- width: 400px`).

#### Timezones
* Starts with `# Timezones`.
* The *first* item's properties often define settings for the whole block:
    * `- div: Target HTML div ID`
    * `- fontSize: CSS font size` (e.g., `3em`)
* Subsequent items define individual clocks:
    * `## Short Name` (e.g., `zrh`)
    * `- tz: TZ Database Name` (e.g., `Europe/Zurich`)

#### Links
* Starts with `# Links`.
* Properties:
    * `- div: Target HTML div ID`
    * Other lines define data sources or potentially direct links (e.g., `- config/links.md`). The keys from these properties are passed to `linksFromMarkdown`. Check `lib/linkUtils.js` for details on link/shortcut format within the target file or if keys/values here define them directly.

#### Quotes
* Starts with `# Quotes`.
* Properties:
    * `- div: Target HTML div ID`
    * `- today: true` (Optional, for daily rotation using a fixed seed)
    * Other lines specify files containing quotes (e.g., `- config/quotes.md`). Keys are passed to `quotesFromMarkdown`.

#### Backgrounds
* Starts with `# Backgrounds`.

* Properties:
    * `- today: true` (Optional, for daily rotation using a fixed seed per day)
    * Alt-clicking the `pi` symbol on the lower left (or wherever you place it via CSS) changes the seed for today.
    * Other lines specify files containing background image URLs or data (e.g., `- config/backgrounds.md`). Keys are passed to `backgroundsFromMarkdown`.

#### Sunrise/Sunset
* Starts with `# Sunrise/sunset`.
* Requires `## Location Name` for each instance.
* Properties:
    * `- lat: Latitude`
    * `- lon: Longitude`
    * `- div: Target HTML div ID`
    * Other `- key: value` pairs are passed as styles to the widget wrapper.

#### Countdowns
* Starts with `# Countdowns`.
* Requires `## Event Name` for each instance.
* Properties:
    * `- target: YYYYMMDD HHMM` (Target date and time, e.g., `20251118 1900`)
    * `- div: Target HTML div ID`
    * `- precision: months | days | hours | minutes | seconds` (Optional, defaults to `seconds`)
    * Other `- key: value` pairs are passed as styles to the widget wrapper.

#### Iframes
* Starts with `# iframes`
* Requires `## title` for each instance.
* Properties:
  * `- src: URL` URL of the iframe, can be local
  * `- div: Target HTML div ID`
  * `- hidden` and `- command` these go together to add iframes that are only shown via the command palette, see the example in `online.md`
  * width, height, frameborder are usually needed but can be ignored

##### Google Calendar embed tip

For Google calendar I don't like adding it to any particular div, so I just leave it floating and absolutely positioned like the following. The magic stuff about `overlay` and `wrapper-style` you can see below means:

- `overlay-style`: Add a div overlay with a backdrop filter on the iframe. This overlay turns it into a dark mode embed 💪
- `wrapper-style`: Add additional positioning directives so it does not appear wherever but in a particular place. Only useful for floating iframes.

Make sure you match the size of the embed (in the URL) with the size of the iframe in the configuration.

```
## Calendar

- src: https://calendar.google.com/calendar/embed?height=300REST_OF_YOUR_CALENDAR_EMBED_STUFF
- style: border-width: 0; border-radius: 0;
- width: 300px
- height: 300px
- frameborder: 0
- overlay: true
- overlay-style: backdrop-filter: invert(1)
- wrapper-style: left: calc(100vw * 3 / 4); top: calc(50vh - 150px);
```

![](https://raw.githubusercontent.com/rberenguel/nt/gh-pages/media/calendar-example.png)

#### Post-its
* No configuration needed in the markdown files.
* Functionality is enabled by `lib/postit.js`. Notes are created via `Alt+Click` or `click+hold` and stored using `chrome.storage.local`.
* Five colours available: yellow, red, green, blue, white. To switch colours press `Ctrl+first letter of the colour` while editing.
* Font size can be changed by pressing `Ctrl+.` (increase by 8%) and `Ctrl+,` (decrease by 8%).
* Add a title by creating a line starting with `# `, like `# Title` and pressing enter.
* Create a line with a checkbox by typing a line like `[ ] this is a task` and pressing enter.
* Select some text and paste a link to make it a link. Cmd/ctrl (Mac/Otherwise) click to open it.
* Add (only) a text like `foo bar baz @15:00` to create a timer that will ring in 15 minutes (if you have a new tab open). You can add as many as you want, with whatever timings you want


#### Replacements
* These are weird and for something I wanted. You may never want to use them
* Starts with `# Replacements`.
* Properties define data sources (e.g., `- config/replacements.md`). Keys are passed to `replacementsFromMarkdown`. Assumes only one replacement block is used.

#### Audio stuff

* 40Hz binaural beats, brown noise and single-audio-file looping are available as links and command palette commands (see the example in `links_sample.md`).
* Note that stopping/starting the looper will layer on top, just refresh the new tab to clean the audio contexts.

## Setup / Installation

1.  Clone or download this repository.
2.  In Chrome, navigate to `chrome://extensions`.
3.  Enable **Developer mode** (usually a toggle in the top-right).
4.  Click **Load unpacked**.
5.  Browse to and select the directory where you cloned/downloaded this repository.
6.  The extension should appear and override your _New Tab_ page. The first time, Chrome might ask for confirmation.
7.  By default (when loaded unpacked), it will use `config/local.md`. Edit it!

## Tweaking / Customization

* **Configuration:** Edit the `.md` files (`local.md` in general) in the `config/` directory to change widgets, locations, data sources, etc.
* **Functionality:** Edit the JavaScript files in the `lib/` directory (e.g., `weatherUtils.js`, `linkUtils.js`) to change how widgets behave or add new ones. Here be dragons, of course. You'll need to map any new `kind` in `mainParser.js`.
* **Styling:** Edit CSS files in the `styles/` directory. I'm trying to split the CSS into per-widget files at the moment
* **Reloading:** After saving changes, go back to `chrome://extensions` and click the reload icon for the "NT" extension (sometimes needed for JS changes), or often just reloading the _New Tab_ page is enough (for markdown files changed).

## Safari Conversion

It's possible to convert this for Safari using Apple's tools with `xcrun safari-web-extension-converter`, but it defeats the quick iteration in changing/adding to the configuration.

## Known Issues / Notes

* The `tests/` directory contains tests that are currently broken and may not reflect the latest refactorings.
* Some sections might be fragile, although I use this daily at work and home.
* Features like Tasks and Iframes mentioned are not currently processed by `mainParser.js`.

## Dependencies & Attribution

* **Libraries:** [Luxon.js](https://moment.github.io/luxon/#/), [Chart.js](https://chartsjs.org) (+ Annotation plugin), [SunCalc.js](https://github.com/mourner/suncalc), [interact.js](https://interactjs.io/), [metaP.js](https://github.com/rberenguel/metap.js)
* **APIs:** [Open-Meteo API](https://open-meteo.com/en/docs) (for weather)
* **Fonts:** Roboto Mono, Reforma 1969, Inter, Monoid, Permanent Marker
* **Assistance:** Google Gemini
* Audio example: [JS Bach and Kimiko Ishizaka, CC0, via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Kimiko_Ishizaka_-_J.S._Bach-_-Open-_Goldberg_Variations,_BWV_988_(Piano)_-_01_Aria.mp3)

## Image Credits
* Backgrounds in root `backgrounds` folder by me ([mostlymaths.net/sketches](https://mostlymaths.net/sketches)).
* Backgrounds in `backgrounds/mwc` folder from [DenverCoder1/minimalistic-wallpaper-collection](https://github.com/DenverCoder1/minimalistic-wallpaper-collection).