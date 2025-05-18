let audioContext;
let oscillatorL;
let oscillatorR;
let gainL;
let gainR;
let merger;
let isPlaying = false;

const baseFrequency = 100; // Base frequency in Hz
const binauralBeatFrequency = 40; // Desired beat frequency in Hz

function startBinauralBeat() {
  if (isPlaying) return;

  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  oscillatorL = audioContext.createOscillator();
  oscillatorR = audioContext.createOscillator();

  gainL = audioContext.createGain();
  gainR = audioContext.createGain();

  merger = audioContext.createChannelMerger(2);

  oscillatorL.type = "sine";
  oscillatorL.frequency.setValueAtTime(baseFrequency, audioContext.currentTime);
  gainL.gain.setValueAtTime(0.05, audioContext.currentTime); // Adjust volume as needed (0.0 to 1.0)
  oscillatorL.connect(gainL);
  gainL.connect(merger, 0, 0); // Connect to left channel of merger

  oscillatorR.type = "sine";
  oscillatorR.frequency.setValueAtTime(
    baseFrequency + binauralBeatFrequency,
    audioContext.currentTime,
  );
  gainR.gain.setValueAtTime(0.05, audioContext.currentTime); // Adjust volume
  oscillatorR.connect(gainR);
  gainR.connect(merger, 0, 1); // Connect to right channel of merger

  merger.connect(audioContext.destination);

  oscillatorL.start();
  oscillatorR.start();

  isPlaying = true;
  console.log(
    `Playing binaural beat at ${binauralBeatFrequency}Hz (L: ${baseFrequency}Hz, R: ${
      baseFrequency + binauralBeatFrequency
    }Hz)`,
  );
}

let brownNoiseAudioContext;
let brownNoiseSource;
let brownNoiseGainNode;

function startBrownNoise() {
  if (brownNoiseAudioContext && brownNoiseAudioContext.state === "running") {
    console.log("Brown noise is already playing.");
    return;
  }

  brownNoiseAudioContext = new (window.AudioContext ||
    window.webkitAudioContext)();

  const bufferSizeSeconds = 5;
  const sampleRate = brownNoiseAudioContext.sampleRate;
  const bufferSizeSamples = sampleRate * bufferSizeSeconds;

  const buffer = brownNoiseAudioContext.createBuffer(
    1,
    bufferSizeSamples,
    sampleRate,
  );
  const output = buffer.getChannelData(0);

  let lastOut1 = 0.0;
  let lastOut2 = 0.0;
  const factor = 0.01;

  for (let i = 0; i < bufferSizeSamples; i++) {
    const white = Math.random() * 2 - 1;
    const pass1 = (lastOut1 + factor * white) / (1 + factor);
    lastOut1 = pass1;
    const pass2 = (lastOut2 + factor * pass1) / (1 + factor);
    lastOut2 = pass2;
    output[i] = pass2 * 4.5; // Adjust as needed
  }

  // Normalize the buffer
  let max = 0;
  for (let i = 0; i < bufferSizeSamples; i++) {
    if (Math.abs(output[i]) > max) {
      max = Math.abs(output[i]);
    }
  }
  if (max > 0) {
    for (let i = 0; i < bufferSizeSamples; i++) {
      output[i] /= max;
    }
  }

  // ---- ADD CROSSFADE TO ELIMINATE CLICK ----
  const crossfadeDurationSeconds = 0.001;
  const crossfadeSamples = Math.floor(sampleRate * crossfadeDurationSeconds);

  if (crossfadeSamples > 0 && crossfadeSamples < bufferSizeSamples / 2) {
    for (let i = 0; i < crossfadeSamples; i++) {
      const blendFactor = i / (crossfadeSamples - 1); // Goes from 0 to 1

      // Sample from the very end of the buffer corresponding to this crossfade position
      const sampleFromEnd = output[bufferSizeSamples - crossfadeSamples + i];
      // Original sample at the very start of the buffer
      const sampleFromStart = output[i];

      // Blend them: fade out the "end" part, fade in the "start" part
      output[i] =
        sampleFromEnd * (1 - blendFactor) + sampleFromStart * blendFactor;
    }
  }
  // ---- END CROSSFADE ----

  brownNoiseSource = brownNoiseAudioContext.createBufferSource();
  brownNoiseSource.buffer = buffer;
  brownNoiseSource.loop = true;

  brownNoiseGainNode = brownNoiseAudioContext.createGain();
  brownNoiseGainNode.gain.setValueAtTime(
    0.2,
    brownNoiseAudioContext.currentTime,
  );

  brownNoiseSource.connect(brownNoiseGainNode);
  brownNoiseGainNode.connect(brownNoiseAudioContext.destination);

  brownNoiseSource.start();
  console.log(
    "Playing brown noise with double integration and loop crossfade.",
  );
}

function handleHashChange() {
  let called = false;
  console.log(window.location.hash);
  if (window.location.hash === "#startBrownNoise") {
    startBrownNoise();
    called = true;
  }
  if (window.location.hash === "#startB40") {
    startBinauralBeat();
    called = true;
  }
  if (window.location.hash === "#startB40&&startBrownNoise") {
    startBrownNoise();
    startBinauralBeat();
    called = true;
  }
  if (called) {
    window.history.replaceState(null, null, " "); // Removes hash without page reload
  }
}

window.addEventListener("hashchange", handleHashChange, false);
