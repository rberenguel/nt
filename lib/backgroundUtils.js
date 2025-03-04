// Chooses a random background for the path provided.
// Assumes the folder is _something_/backgrounds/filenames but accepts
// intermediate paths. If this does not suit you, just edit the url
// below.

function randomBackground(opts = {}) {
  const backgrounds = opts.backgrounds;
  const path = opts.path ?? ".";
  const today = opts.today;
  let randomIndex = Math.floor(Math.random() * backgrounds.length);
  if (today) {
    randomIndex = getDailyRandom(backgrounds.length);
  }
  const background = backgrounds[randomIndex];
  document.body.style.backgroundImage = `url(${path}/backgrounds/${background})`;
  document.body.style.backgroundSize = "cover";
  document.body.style.repeat = "no-repeat";
}
