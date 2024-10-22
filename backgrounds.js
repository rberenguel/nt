const backgrounds = [
  "ideas.jpg",
  "synthwave.jpg",
  "pencils.jpg",
  "bubbles.jpg",
  "flows-78259.jpg",
  "creation.jpg",
  "big-bang.jpg",
  "underwater.jpg",
];


if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = { backgrounds }; 
} else {
  window.backgrounds = backgrounds;
}