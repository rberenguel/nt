// Parse URL parameters
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") || "lightning";
const enableRain = mode === "storm";
const screenIndex = parseInt(params.get("screen") || "0", 10);
const totalScreens = parseInt(params.get("screens") || "1", 10);

// Initialize storm with handlers disabled for screensaver mode
initStorm({
  rain: enableRain,
  thunder: true,
  disableDefaultKeyHandler: true,
  disableClickHandler: true,
  screenIndex,
  totalScreens,
});

// Brightness control
const overlay = document.getElementById("brightness-overlay");
let brightnessLevel = 0;

function adjustBrightness(delta) {
  brightnessLevel = Math.max(0, Math.min(10, brightnessLevel + delta));
  overlay.style.opacity = brightnessLevel * 0.1;
}

// Fullscreen functionality
function enterFullscreen() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch((err) => {
      console.log("Fullscreen request failed:", err);
    });
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  }
}

const stormChannel = new BroadcastChannel("storm-screensaver");
stormChannel.onmessage = (e) => {
  if (e.data === "close") window.close();
};

// Keyboard controls matching matrix screensaver
document.addEventListener("keydown", (e) => {
  if (e.key === "q" || e.key === "Q") {
    stormChannel.postMessage("close");
    window.close();
  } else if (e.key === ",") {
    adjustBrightness(1); // Darker
  } else if (e.key === ".") {
    adjustBrightness(-1); // Brighter
  } else if (e.key === "f" || e.key === "F") {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      enterFullscreen();
    }
  } else if (!document.fullscreenElement) {
    // Any other key enters fullscreen if not already
    enterFullscreen();
  }
});

// Click anywhere to enter fullscreen (repeatable)
document.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    enterFullscreen();
  }
});
