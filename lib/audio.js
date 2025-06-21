let audioContext;
let oscillatorL, oscillatorR, gainL, gainR, merger;
let isPlaying = false;

let brownNoiseAudioContext;
let brownNoiseSource, brownNoiseGainNode;

let binauralVolumeSlider = null;
let brownNoiseVolumeSlider = null;

// Global variables for the MP3 loop
let mp3LoopAudioContext;
let sourceNodeA, sourceNodeB; // To hold AudioBufferSourceNode instances
let gainNodeA, gainNodeB; // To hold GainNode instances for crossfading
let audioBufferForLoop = null;
let isMP3LoopPlaying = false;
let currentMP3LoopFile = null;
let loopCrossfadeTime = 1.0; // Default crossfade duration in seconds
let nextMP3SegmentStartTime = 0;
let isSourceANext = true; // Keeps track of which source/gain pair is next to play
let mp3LoopVolumeSlider = null;
let masterLoopGainNode = null; // Master gain for the MP3 loop
const MP3_LOOP_MAX_GAIN = 1.0; // Max gain for the loop slider
const MP3_LOOP_DEFAULT_GAIN = 0.75; // Default gain for the loop

// Global variables for the Web Audio Stream
let streamAudioContext;
let streamAudioElement;
let streamSourceNode;
let streamGainNode;
let isStreamPlaying = false;
let currentStreamUrl = null;
let streamVolumeSlider = null;
const STREAM_MAX_GAIN = 1.0;
const STREAM_DEFAULT_GAIN = 0.75;

const baseFrequency = 100;
const binauralBeatFrequency = 40;

const BINAURAL_MAX_GAIN = 0.3;
const BROWN_NOISE_MAX_GAIN = 1.0;

function createVolumeSlider(
  id,
  labelText,
  initialGain,
  maxGain,
  audioGainNodeUpdater,
) {
  let sliderContainer = document.getElementById(id);
  let labelElement;

  if (sliderContainer) {
    // Slider exists, update its label if different
    labelElement = sliderContainer.querySelector(".audio-slider-label");
    if (labelElement && labelElement.textContent !== labelText) {
      labelElement.textContent = labelText;
    }
    // Update stored properties on the slider DOM element itself for consistency
    sliderContainer.initialGain = initialGain;
    sliderContainer.maxGain = maxGain; // In case maxGain could change for this slider ID

    // Update the knob's visual position to reflect the new initialGain for this call
    updateSliderPosition(sliderContainer, initialGain);
    return sliderContainer;
  }

  // --- Creation logic (if sliderContainer does not exist) ---
  sliderContainer = document.createElement("div");
  sliderContainer.id = id;
  sliderContainer.className = "audio-slider-container";

  labelElement = document.createElement("div"); // Defined here for creation path
  labelElement.className = "audio-slider-label";
  labelElement.textContent = labelText; // Use the passed labelText
  sliderContainer.appendChild(labelElement);

  const track = document.createElement("div");
  track.className = "audio-slider-track";
  sliderContainer.appendChild(track);

  const knob = document.createElement("div");
  knob.className = "audio-slider-knob";

  const trackHeight = 100;
  const knobHeight = 20;

  let currentKnobY = (1 - initialGain / maxGain) * (trackHeight - knobHeight);
  currentKnobY = Math.max(0, Math.min(currentKnobY, trackHeight - knobHeight));
  knob.style.top = `${currentKnobY}px`;

  track.appendChild(knob);
  document.body.appendChild(sliderContainer);

  // Store references and initial values on the slider container
  sliderContainer.knob = knob;
  sliderContainer.trackHeight = trackHeight; // Assuming fixed CSS height
  sliderContainer.knobHeight = knobHeight; // Assuming fixed CSS height
  sliderContainer.maxGain = maxGain;
  sliderContainer.initialGain = initialGain;

  // interact.js setup for knob (volume control)
  interact(knob)
    .draggable({
      modifiers: [interact.modifiers.restrictRect({ restriction: "parent" })], // Restrict to track
      listeners: {
        move(event) {
          let currentTop = parseFloat(knob.style.top) || 0;
          let newTop = currentTop + event.dy;
          newTop = Math.max(
            0,
            Math.min(
              newTop,
              sliderContainer.trackHeight - sliderContainer.knobHeight,
            ),
          );
          knob.style.top = `${newTop}px`;

          const gainFraction =
            1 -
            newTop / (sliderContainer.trackHeight - sliderContainer.knobHeight);
          let newGain = Math.max(
            0,
            Math.min(
              gainFraction * sliderContainer.maxGain,
              sliderContainer.maxGain,
            ),
          );
          audioGainNodeUpdater(newGain);
        },
      },
    })
    .on("dragstart", (event) => event.target.classList.add("dragging"))
    .on("dragend", (event) => event.target.classList.remove("dragging"));

  // interact.js setup for slider container (repositioning via label)
  interact(sliderContainer)
    .draggable({
      allowFrom: ".audio-slider-label",
      listeners: {
        move(event) {
          const target = event.target;
          const x = (parseFloat(target.getAttribute("data-x")) || 0) + event.dx;
          const y = (parseFloat(target.getAttribute("data-y")) || 0) + event.dy;
          target.style.transform = `translate(${x}px, ${y}px)`;
          target.setAttribute("data-x", x);
          target.setAttribute("data-y", y);
        },
      },
    })
    .on("dragstart", (event) => (event.target.style.zIndex = "1001")) // Bring to front
    .on("dragend", (event) => (event.target.style.zIndex = "1000")); // Reset z-index

  return sliderContainer;
}

function updateSliderPosition(sliderContainer, newGain) {
  if (sliderContainer && sliderContainer.knob) {
    const { knob, trackHeight, knobHeight, maxGain } = sliderContainer;
    if (
      knob &&
      typeof trackHeight === "number" &&
      typeof knobHeight === "number" &&
      typeof maxGain === "number"
    ) {
      let knobY = (1 - newGain / maxGain) * (trackHeight - knobHeight);
      knobY = Math.max(0, Math.min(knobY, trackHeight - knobHeight));
      knob.style.top = `${knobY}px`;
    }
  }
}

function startBinauralBeat() {
  if (binauralVolumeSlider && isPlaying) {
    stopBinauralBeat();
    return;
  }

  let currentGainSetting = 0.05;
  if (binauralVolumeSlider && binauralVolumeSlider.knob) {
    const knobY = parseFloat(binauralVolumeSlider.knob.style.top);
    const { trackHeight, knobHeight, maxGain } = binauralVolumeSlider;
    if (
      !isNaN(knobY) &&
      trackHeight != null &&
      knobHeight != null &&
      maxGain != null
    ) {
      const gainFraction = 1 - knobY / (trackHeight - knobHeight);
      currentGainSetting = Math.max(
        0,
        Math.min(gainFraction * maxGain, maxGain),
      );
    }
  } else {
    // Ensure initial gain does not exceed max gain if slider not yet created
    currentGainSetting = Math.min(currentGainSetting, BINAURAL_MAX_GAIN);
  }

  if (!audioContext || audioContext.state === "closed") {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    oscillatorL = audioContext.createOscillator();
    oscillatorR = audioContext.createOscillator();
    gainL = audioContext.createGain();
    gainR = audioContext.createGain();
    merger = audioContext.createChannelMerger(2);
    oscillatorL.type = "sine";
    oscillatorL.connect(gainL);
    gainL.connect(merger, 0, 0);
    oscillatorR.type = "sine";
    oscillatorR.connect(gainR);
    gainR.connect(merger, 0, 1);
    merger.connect(audioContext.destination);
    oscillatorL.start();
    oscillatorR.start();
  }

  oscillatorL.frequency.setValueAtTime(baseFrequency, audioContext.currentTime);
  oscillatorR.frequency.setValueAtTime(
    baseFrequency + binauralBeatFrequency,
    audioContext.currentTime,
  );

  gainL.gain.setValueAtTime(currentGainSetting, audioContext.currentTime);
  gainR.gain.setValueAtTime(currentGainSetting, audioContext.currentTime);

  if (!binauralVolumeSlider) {
    binauralVolumeSlider = createVolumeSlider(
      "binaural-slider",
      "Binaural",
      currentGainSetting,
      BINAURAL_MAX_GAIN,
      (newGain) => {
        if (
          gainL &&
          gainR &&
          audioContext &&
          audioContext.state === "running"
        ) {
          gainL.gain.setValueAtTime(newGain, audioContext.currentTime);
          gainR.gain.setValueAtTime(newGain, audioContext.currentTime);
        }
      },
    );
  } else {
    updateSliderPosition(binauralVolumeSlider, currentGainSetting);
  }

  if (audioContext.state === "suspended") audioContext.resume();
  isPlaying = true;
  console.info(
    `Playing binaural beat at ${binauralBeatFrequency}Hz, Gain: ${currentGainSetting.toFixed(2)}`,
  );
}

function stopBinauralBeat() {
  if (isPlaying && audioContext) {
    audioContext.close().then(() => {
      audioContext = null;
      oscillatorL = null;
      oscillatorR = null;
      gainL = null;
      gainR = null;
      merger = null;
    });
    isPlaying = false;
    console.info("Binaural beat stopped.");
  }
}

function startBrownNoise() {
  if (
    brownNoiseVolumeSlider &&
    brownNoiseAudioContext &&
    brownNoiseAudioContext.state === "running"
  ) {
    stopBrownNoise();
    return;
  }

  let currentGainSetting = 0.2;
  if (brownNoiseVolumeSlider && brownNoiseVolumeSlider.knob) {
    const knobY = parseFloat(brownNoiseVolumeSlider.knob.style.top);
    const { trackHeight, knobHeight, maxGain } = brownNoiseVolumeSlider;
    if (
      !isNaN(knobY) &&
      trackHeight != null &&
      knobHeight != null &&
      maxGain != null
    ) {
      const gainFraction = 1 - knobY / (trackHeight - knobHeight);
      currentGainSetting = Math.max(
        0,
        Math.min(gainFraction * maxGain, maxGain),
      );
    }
  } else {
    currentGainSetting = Math.min(currentGainSetting, BROWN_NOISE_MAX_GAIN);
  }

  if (!brownNoiseAudioContext || brownNoiseAudioContext.state === "closed") {
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
    let lastOut1 = 0.0,
      lastOut2 = 0.0,
      factor = 0.01;
    for (let i = 0; i < bufferSizeSamples; i++) {
      const white = Math.random() * 2 - 1;
      const pass1 = (lastOut1 + factor * white) / (1 + factor);
      lastOut1 = pass1;
      const pass2 = (lastOut2 + factor * pass1) / (1 + factor);
      lastOut2 = pass2;
      output[i] = pass2 * 4.5;
    }
    let max = 0;
    for (let i = 0; i < bufferSizeSamples; i++)
      if (Math.abs(output[i]) > max) max = Math.abs(output[i]);
    if (max > 0) for (let i = 0; i < bufferSizeSamples; i++) output[i] /= max;
    const crossfadeDurationSeconds = 0.001;
    const crossfadeSamples = Math.floor(sampleRate * crossfadeDurationSeconds);
    if (crossfadeSamples > 0 && crossfadeSamples < bufferSizeSamples / 2) {
      for (let i = 0; i < crossfadeSamples; i++) {
        const blendFactor = i / (crossfadeSamples - 1);
        const sampleFromEnd = output[bufferSizeSamples - crossfadeSamples + i];
        const sampleFromStart = output[i];
        output[i] =
          sampleFromEnd * (1 - blendFactor) + sampleFromStart * blendFactor;
      }
    }
    brownNoiseSource = brownNoiseAudioContext.createBufferSource();
    brownNoiseSource.buffer = buffer;
    brownNoiseSource.loop = true;
    brownNoiseGainNode = brownNoiseAudioContext.createGain();
    brownNoiseSource.connect(brownNoiseGainNode);
    brownNoiseGainNode.connect(brownNoiseAudioContext.destination);
    brownNoiseSource.start();
  }

  brownNoiseGainNode.gain.setValueAtTime(
    currentGainSetting,
    brownNoiseAudioContext.currentTime,
  );

  if (!brownNoiseVolumeSlider) {
    brownNoiseVolumeSlider = createVolumeSlider(
      "brown-noise-slider",
      "Brown Noise",
      currentGainSetting,
      BROWN_NOISE_MAX_GAIN,
      (newGain) => {
        if (
          brownNoiseGainNode &&
          brownNoiseAudioContext &&
          brownNoiseAudioContext.state === "running"
        ) {
          brownNoiseGainNode.gain.setValueAtTime(
            newGain,
            brownNoiseAudioContext.currentTime,
          );
        }
      },
    );
  } else {
    updateSliderPosition(brownNoiseVolumeSlider, currentGainSetting);
  }

  if (brownNoiseAudioContext.state === "suspended")
    brownNoiseAudioContext.resume();
  console.info(`Playing brown noise. Gain: ${currentGainSetting.toFixed(2)}`);
}

function stopBrownNoise() {
  if (brownNoiseAudioContext && brownNoiseAudioContext.state === "running") {
    brownNoiseAudioContext.close().then(() => {
      brownNoiseAudioContext = null;
      brownNoiseSource = null;
      brownNoiseGainNode = null;
    });
    console.info("Brown noise stopped.");
  }
}

// You might want a global variable to keep track of the current loop's display title, if needed elsewhere.
// let currentDisplayMP3LoopTitle = 'Loop'; // Example

async function playLoop(props = {}) {
  // Default to empty object if no props passed
  const filePath = props.filePath;

  let sliderTitleToDisplay = "Loop";
  if (
    props.title &&
    typeof props.title === "string" &&
    props.title.trim() !== ""
  ) {
    sliderTitleToDisplay = props.title.trim().replaceAll("%20", " ");
  } else if (filePath) {
    const lastSlashIndex = filePath.lastIndexOf("/");
    if (lastSlashIndex !== -1 && lastSlashIndex < filePath.length - 1) {
      sliderTitleToDisplay = filePath.substring(lastSlashIndex + 1);
    } else if (lastSlashIndex === -1 && filePath.length > 0) {
      sliderTitleToDisplay = filePath;
    }
  }
  // currentGlobalMP3LoopTitle = sliderTitleToDisplay; // If you have a global var for this

  const crossfadeInput = props.crossfade;
  const newLoopCrossfadeTime =
    typeof crossfadeInput === "number" && crossfadeInput >= 0
      ? Math.max(0.1, crossfadeInput)
      : 1.0;

  const initialGainFromProps = props.initialGain; // Get initialGain from props

  if (!filePath) {
    console.error("playLoop called without a valid filePath in props.");
    if (isMP3LoopPlaying) stopLoop();
    return;
  }

  if (isMP3LoopPlaying && filePath === currentMP3LoopFile) {
    stopLoop();
    return;
  }

  if (isMP3LoopPlaying) {
    stopLoop();
  }

  currentMP3LoopFile = filePath;
  loopCrossfadeTime = newLoopCrossfadeTime;

  // --- Autoplay priming logic would be here if used ---

  if (!mp3LoopAudioContext || mp3LoopAudioContext.state === "closed") {
    mp3LoopAudioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
  }

  if (mp3LoopAudioContext.state === "suspended") {
    try {
      await mp3LoopAudioContext.resume();
      console.warn("MP3 Loop AudioContext resumed for new loop.");
    } catch (e) {
      console.error("Error resuming MP3 Loop AudioContext:", e);
      return;
    }
  }

  if (!masterLoopGainNode) {
    if (mp3LoopAudioContext && mp3LoopAudioContext.state === "running") {
      masterLoopGainNode = mp3LoopAudioContext.createGain();
      masterLoopGainNode.connect(mp3LoopAudioContext.destination);
    } else {
      console.error(
        "MP3LoopAudioContext not running when trying to create masterLoopGainNode.",
      );
      return;
    }
  }

  // Determine the volume for this loop session
  let volumeForThisLoop;
  if (
    typeof initialGainFromProps === "number" &&
    initialGainFromProps >= 0 &&
    initialGainFromProps <= MP3_LOOP_MAX_GAIN
  ) {
    volumeForThisLoop = initialGainFromProps;
  } else if (
    mp3LoopVolumeSlider &&
    mp3LoopVolumeSlider.knob &&
    typeof mp3LoopVolumeSlider.trackHeight === "number"
  ) {
    const knobY = parseFloat(mp3LoopVolumeSlider.knob.style.top);
    const { trackHeight, knobHeight, maxGain } = mp3LoopVolumeSlider;
    if (
      !isNaN(knobY) &&
      trackHeight != null &&
      knobHeight != null &&
      maxGain != null
    ) {
      const gainFraction = 1 - knobY / (trackHeight - knobHeight);
      volumeForThisLoop = Math.max(
        0,
        Math.min(gainFraction * maxGain, maxGain),
      );
    } else {
      volumeForThisLoop = MP3_LOOP_DEFAULT_GAIN; // Fallback if slider properties are odd
    }
  } else {
    volumeForThisLoop = MP3_LOOP_DEFAULT_GAIN;
  }
  // Final clamp, though the logic above should mostly handle it.
  volumeForThisLoop = Math.max(
    0,
    Math.min(volumeForThisLoop, MP3_LOOP_MAX_GAIN),
  );

  masterLoopGainNode.gain.setValueAtTime(
    volumeForThisLoop,
    mp3LoopAudioContext.currentTime,
  );

  if (!gainNodeA) {
    gainNodeA = mp3LoopAudioContext.createGain();
    gainNodeA.connect(masterLoopGainNode);
  }
  if (!gainNodeB) {
    gainNodeB = mp3LoopAudioContext.createGain();
    gainNodeB.connect(masterLoopGainNode);
  }

  try {
    const response = await fetch(filePath);
    if (!response.ok)
      throw new Error(`HTTP error! status: ${response.status} for ${filePath}`);
    const arrayBuffer = await response.arrayBuffer();
    audioBufferForLoop = await mp3LoopAudioContext.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.error("Error loading or decoding MP3:", e);
    currentMP3LoopFile = null;
    isMP3LoopPlaying = false;
    return;
  }

  isMP3LoopPlaying = true;
  console.info(
    `Starting loop: "${sliderTitleToDisplay}" (File: ${currentMP3LoopFile}), Crossfade: ${loopCrossfadeTime}s, Initial Volume: ${volumeForThisLoop.toFixed(2)}`,
  );

  nextMP3SegmentStartTime = mp3LoopAudioContext.currentTime + 0.05;
  isSourceANext = true;
  if (gainNodeB)
    gainNodeB.gain.setValueAtTime(0, mp3LoopAudioContext.currentTime);

  if (typeof createVolumeSlider === "function") {
    mp3LoopVolumeSlider = createVolumeSlider(
      "mp3-loop-slider",
      sliderTitleToDisplay,
      volumeForThisLoop, // Pass the determined initial volume here
      MP3_LOOP_MAX_GAIN,
      (newGain) => {
        if (
          masterLoopGainNode &&
          mp3LoopAudioContext &&
          mp3LoopAudioContext.state === "running"
        ) {
          masterLoopGainNode.gain.setValueAtTime(
            newGain,
            mp3LoopAudioContext.currentTime,
          );
        }
      },
    );
  }

  scheduleNextSegmentForMP3(nextMP3SegmentStartTime, true);
}
function scheduleNextSegmentForMP3(startTime, isFirstSegment = false) {
  if (!isMP3LoopPlaying || !audioBufferForLoop || !mp3LoopAudioContext) return;

  const newSource = mp3LoopAudioContext.createBufferSource();
  newSource.buffer = audioBufferForLoop;

  const activeGainNode = isSourceANext ? gainNodeA : gainNodeB;
  const inactiveGainNode = isSourceANext ? gainNodeB : gainNodeA;

  newSource.connect(activeGainNode);
  newSource.start(startTime);

  // Manage fades
  if (isFirstSegment) {
    activeGainNode.gain.setValueAtTime(0, startTime);
    activeGainNode.gain.linearRampToValueAtTime(
      1.0,
      startTime + Math.min(loopCrossfadeTime, 0.2),
    ); // Quick fade-in for the very first play
  } else {
    // This new segment fades IN
    activeGainNode.gain.setValueAtTime(0, startTime);
    activeGainNode.gain.linearRampToValueAtTime(
      1.0,
      startTime + loopCrossfadeTime,
    );

    // The previous segment (now on inactiveGainNode) fades OUT
    // It should have been at 1.0 just before startTime.
    inactiveGainNode.gain.cancelScheduledValues(startTime); // Clear any prior ramps
    inactiveGainNode.gain.setValueAtTime(1.0, startTime);
    inactiveGainNode.gain.linearRampToValueAtTime(
      0.0,
      startTime + loopCrossfadeTime,
    );
  }

  newSource.onended = () => {
    newSource.disconnect();
    // If loop was stopped externally, ensure gain is forced to 0.
    if (!isMP3LoopPlaying) {
      activeGainNode.gain.cancelScheduledValues(
        mp3LoopAudioContext.currentTime,
      );
      activeGainNode.gain.setValueAtTime(0, mp3LoopAudioContext.currentTime);
    }
  };

  // Calculate the start time for the *next* segment (which will overlap this one)
  // This newSource plays for audioBufferForLoop.duration.
  // The next one starts playing 'loopCrossfadeTime' seconds before this one ends.
  const nextSegmentShouldStartAt =
    startTime + audioBufferForLoop.duration - loopCrossfadeTime;

  isSourceANext = !isSourceANext; // Toggle for the next segment

  // How long until we need to call this function again to schedule the next segment?
  // Schedule it a bit before 'nextSegmentShouldStartAt' to prepare.
  const timeUntilNextScheduling =
    (nextSegmentShouldStartAt - mp3LoopAudioContext.currentTime - 0.1) * 1000; // e.g. 100ms buffer

  if (isMP3LoopPlaying) {
    setTimeout(
      () => {
        if (isMP3LoopPlaying) {
          // Re-check because stopLoop might have been called
          scheduleNextSegmentForMP3(nextSegmentShouldStartAt, false);
        }
      },
      Math.max(10, timeUntilNextScheduling),
    ); // Ensure timeout is not negative and has a small minimum
  }
}

function stopLoop() {
  if (!isMP3LoopPlaying || !mp3LoopAudioContext) return;

  console.warn(`Stopping loop for ${currentMP3LoopFile}`);
  isMP3LoopPlaying = false;

  const now = mp3LoopAudioContext.currentTime;
  if (gainNodeA) {
    gainNodeA.gain.cancelScheduledValues(now);
    gainNodeA.gain.linearRampToValueAtTime(0.0, now + 0.1);
  }
  if (gainNodeB) {
    gainNodeB.gain.cancelScheduledValues(now);
    gainNodeB.gain.linearRampToValueAtTime(0.0, now + 0.1);
  }
  // Also fade out and cancel master gain for the loop
  if (masterLoopGainNode) {
    masterLoopGainNode.gain.cancelScheduledValues(now);
    // Let's set its gain based on slider for next play, or default.
    // For now, just ensuring it doesn't interfere with stopping.
    // If we want it to retain the slider value, don't ramp to 0 here,
    // playLoop will set it on next start.
    // For a "full stop" visual/audio feedback, ramping master to 0 is fine.
    // Let's assume playLoop will reset it.
  }

  currentMP3LoopFile = null;
  audioBufferForLoop = null;
  // Consider mp3LoopAudioContext.close() if not needed soon to free resources
}

async function playStream(props = {}) {
  const { streamUrl, title } = props;

  let sliderTitleToDisplay = "Stream";
  if (title && typeof title === "string" && title.trim() !== "") {
    sliderTitleToDisplay = title.trim();
  } else if (streamUrl) {
    try {
      const url = new URL(streamUrl);
      sliderTitleToDisplay = url.hostname;
    } catch (e) {
      sliderTitleToDisplay = "Stream";
    }
  }

  if (!streamUrl) {
    console.error("playStream called without a valid streamUrl in props.");
    if (isStreamPlaying) stopStream();
    return;
  }

  if (isStreamPlaying && streamUrl === currentStreamUrl) {
    stopStream();
    return;
  }

  if (isStreamPlaying) {
    stopStream();
  }

  currentStreamUrl = streamUrl;

  if (!streamAudioContext || streamAudioContext.state === "closed") {
    streamAudioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
  }

  if (streamAudioContext.state === "suspended") {
    await streamAudioContext.resume();
  }

  if (!streamGainNode) {
    streamGainNode = streamAudioContext.createGain();
    streamGainNode.connect(streamAudioContext.destination);
  }

  streamAudioElement = new Audio(streamUrl);
  streamAudioElement.crossOrigin = "anonymous";
  streamSourceNode =
    streamAudioContext.createMediaElementSource(streamAudioElement);
  streamSourceNode.connect(streamGainNode);

  let volumeForThisStream = STREAM_DEFAULT_GAIN;
  if (streamVolumeSlider && streamVolumeSlider.knob) {
    const knobY = parseFloat(streamVolumeSlider.knob.style.top);
    const { trackHeight, knobHeight, maxGain } = streamVolumeSlider;
    if (
      !isNaN(knobY) &&
      trackHeight != null &&
      knobHeight != null &&
      maxGain != null
    ) {
      const gainFraction = 1 - knobY / (trackHeight - knobHeight);
      volumeForThisStream = Math.max(
        0,
        Math.min(gainFraction * maxGain, maxGain),
      );
    }
  }

  streamGainNode.gain.setValueAtTime(
    volumeForThisStream,
    streamAudioContext.currentTime,
  );

  streamVolumeSlider = createVolumeSlider(
    "stream-slider",
    sliderTitleToDisplay,
    volumeForThisStream,
    STREAM_MAX_GAIN,
    (newGain) => {
      if (
        streamGainNode &&
        streamAudioContext &&
        streamAudioContext.state === "running"
      ) {
        streamGainNode.gain.setValueAtTime(
          newGain,
          streamAudioContext.currentTime,
        );
      }
    },
  );

  try {
    await streamAudioElement.play();
    isStreamPlaying = true;
    console.info(
      `Playing stream: "${sliderTitleToDisplay}" (URL: ${currentStreamUrl}), Initial Volume: ${volumeForThisStream.toFixed(2)}`,
    );
  } catch (err) {
    console.error("Error playing stream:", err);
    stopStream();
  }
}

function stopStream() {
  if (!isStreamPlaying) {
    return;
  }
  console.warn(`Stopping stream for ${currentStreamUrl}`);
  if (streamAudioElement) {
    streamAudioElement.pause();
    streamAudioElement.src = "";
    streamAudioElement = null;
  }
  if (streamSourceNode) {
    streamSourceNode.disconnect();
    streamSourceNode = null;
  }
  isStreamPlaying = false;
  currentStreamUrl = null;
}

function handleHashChange() {
  let called = false;
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
  if (window.location.hash.startsWith("#stream:")) {
    const parts = window.location.hash.substring(1).split(":");
    if (parts.length >= 2) {
      const streamUrl = decodeURIComponent(parts[1]);
      const title = parts.length > 2 ? decodeURIComponent(parts[2]) : undefined;
      playStream({ streamUrl: streamUrl, title: title });
      called = true;
    }
  }
  if (window.location.hash.startsWith("#loop")) {
    const [_, ...rest] = window.location.hash.split(":");
    const filePath = rest[0];
    const title = rest[1] ?? undefined;
    const gain = parseFloat(rest[2]) ?? 0.5;
    playLoop({ filePath: filePath, title: title, initialGain: gain });
    called = true;
  }
  if (called) {
    window.history.replaceState(null, null, " ");
  }
}

window.addEventListener("hashchange", handleHashChange, false);

const audioCommands = [
  {
    title: "B40Hz",
    lambda: startBinauralBeat,
  },
  {
    title: "Brown",
    lambda: startBrownNoise,
  },
];

window._ntCommands = window._ntCommands || [];
window._ntCommands = window._ntCommands.concat(audioCommands);
