// Global State
let blinkerDevice, blinkerControlChar, blinkerColorChar, blinkerBrightChar, blinkerTimerChar;
let isBlinkerRunning = false;

const TIMER_STEPS = [1, 5, 10, 25, 50];
let timerStepIdx = 3; // default: 25 min

const BRIGHT_STEPS = [0, 25, 50, 75, 100];    // display %
const BRIGHT_BLE   = [0, 64, 128, 191, 255];  // BLE byte values
let brightStepIdx = 3; // default: 75%

let blinkerCountdown = null;

function formatCountdown(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function createBlinkerWidget() {
    if (document.getElementById('blinker-widget')) return;

    const container = document.createElement("div");
    container.id = "blinker-widget";
    container.className = "audio-slider-container";
    container.style.left = "calc(100vw * 3 / 4 - 60px)";
    container.style.top = "calc(50vh - 280px)";
    container.style.width = "165px";

    const label = document.createElement("div");
    label.className = "audio-slider-label";
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "4px";
    label.innerHTML = `<span>Blinker</span><span id="blk-cdown" style="font-size: 10px; color: var(--yellow);"></span><span id="blk-dot" style="color: var(--red); transform: translate(0, -1pt);">●</span>`;
    container.appendChild(label);

    const controlsDiv = document.createElement("div");
    controlsDiv.style.display = "flex";
    controlsDiv.style.flexDirection = "column";
    controlsDiv.style.gap = "8px";
    controlsDiv.style.width = "100%";
    controlsDiv.style.fontFamily = "Monoid, monospace";

    const sWrap  = `display: flex; align-items: stretch; border: 1px solid var(--light-grey); border-radius: 3px; overflow: hidden;`;
    const sArrow = `background: var(--dark); color: var(--light); border: none; width: 24px; cursor: pointer; font-family: inherit; font-size: 10px; padding: 0;`;
    const sMid   = `flex: 1; display: flex; justify-content: space-between; align-items: center; border-left: 1px solid var(--light-grey); border-right: 1px solid var(--light-grey); padding: 5px 7px; font-size: 11px;`;

    controlsDiv.innerHTML = `
        <button id="blk-connect" style="background: var(--cyan); color: var(--dark); border: none; border-radius: 3px; padding: 6px; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: bold;">Connect Device</button>

        <div id="blk-body" style="display: flex; flex-direction: column; gap: 8px; opacity: 0.3; transition: opacity 0.2s;">

            <div style="display: flex; gap: 4px;">
                <button id="blk-start" disabled style="flex: 1; background: var(--green); color: var(--dark); border: none; border-radius: 3px; padding: 6px; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: bold;">Start</button>
                <button id="blk-stop" disabled style="flex: 1; background: var(--red); color: var(--light); border: none; border-radius: 3px; padding: 6px; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: bold;">Stop</button>
            </div>

            <div style="${sWrap}">
                <button id="blk-time-prev" disabled style="${sArrow}">◀</button>
                <div style="${sMid}">
                    <span style="color: var(--light-grey);">Timer</span>
                    <span id="blk-time-val" style="color: var(--light); white-space: nowrap;">${TIMER_STEPS[timerStepIdx]}'</span>
                </div>
                <button id="blk-time-next" disabled style="${sArrow}">▶</button>
            </div>

            <div style="${sWrap}">
                <button id="blk-bright-prev" disabled style="${sArrow}">◀</button>
                <div style="${sMid}">
                    <span style="color: var(--light-grey);">Bright</span>
                    <span id="blk-bright-val" style="color: var(--light); white-space: nowrap;">${BRIGHT_STEPS[brightStepIdx]}%</span>
                </div>
                <button id="blk-bright-next" disabled style="${sArrow}">▶</button>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; color: var(--light-grey); font-size: 11px;">
                <span>Inner</span>
                <input type="color" id="blk-c1" value="#ffffff" disabled style="width: 45px; height: 22px; padding: 0; border: none; background: transparent; cursor: pointer;">
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; color: var(--light-grey); font-size: 11px;">
                <span>Outer</span>
                <input type="color" id="blk-c2" value="#000000" disabled style="width: 45px; height: 22px; padding: 0; border: none; background: transparent; cursor: pointer;">
            </div>

        </div>
    `;

    container.appendChild(controlsDiv);
    document.body.appendChild(container);

    makeDraggable(container, { allowFrom: ".audio-slider-label" });

    bindBlinkerEvents(container);
}

function bindBlinkerEvents(container) {
    const SERVICE_UUID      = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
    const CHAR_CONTROL_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
    const CHAR_COLOR_UUID   = "beb5483e-36e1-4688-b7f5-ea07361b26a9";
    const CHAR_BRIGHT_UUID  = "beb5483e-36e1-4688-b7f5-ea07361b26aa";
    const CHAR_TIMER_UUID   = "beb5483e-36e1-4688-b7f5-ea07361b26ab";

    const els = {
        dot:        container.querySelector('#blk-dot'),
        cdown:      container.querySelector('#blk-cdown'),
        body:       container.querySelector('#blk-body'),
        connect:    container.querySelector('#blk-connect'),
        start:      container.querySelector('#blk-start'),
        stop:       container.querySelector('#blk-stop'),
        timePrev:   container.querySelector('#blk-time-prev'),
        timeNext:   container.querySelector('#blk-time-next'),
        timeVal:    container.querySelector('#blk-time-val'),
        brightPrev: container.querySelector('#blk-bright-prev'),
        brightNext: container.querySelector('#blk-bright-next'),
        brightVal:  container.querySelector('#blk-bright-val'),
        c1:         container.querySelector('#blk-c1'),
        c2:         container.querySelector('#blk-c2')
    };

    const inputs = [els.start, els.stop, els.timePrev, els.timeNext, els.brightPrev, els.brightNext, els.c1, els.c2];

    const stopCountdown = () => {
        if (blinkerCountdown) {
            clearInterval(blinkerCountdown);
            blinkerCountdown = null;
        }
        els.cdown.textContent = '';
    };

    const startCountdown = () => {
        stopCountdown();
        let remaining = TIMER_STEPS[timerStepIdx] * 60;
        const tick = () => {
            els.cdown.textContent = ` ${formatCountdown(remaining)} `;
            if (remaining === 0) {
                stopCountdown();
                els.dot.style.color = "var(--green)";
                isBlinkerRunning = false;
                return;
            }
            remaining--;
        };
        tick();
        blinkerCountdown = setInterval(tick, 1000);
    };

    const setUI = (enabled) => {
        inputs.forEach(el => el.disabled = !enabled);
        els.body.style.opacity = enabled ? "1" : "0.3";
        els.connect.innerText = enabled ? "Disconnect" : "Connect Device";
        els.connect.style.background = enabled ? "var(--light-grey)" : "var(--cyan)";
        els.dot.style.color = enabled ? "var(--green)" : "var(--red)";
        if (!enabled) {
            isBlinkerRunning = false;
            stopCountdown();
        }
    };

    const hexToRgb = (hex) => {
        const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return res ? [parseInt(res[1], 16), parseInt(res[2], 16), parseInt(res[3], 16)] : [0, 0, 0];
    };

    // Bluetooth Connect/Disconnect
    els.connect.addEventListener('click', async () => {
        if (blinkerDevice && blinkerDevice.gatt.connected) {
            blinkerDevice.gatt.disconnect();
            return;
        }
        try {
            els.dot.style.color = "var(--yellow)";
            blinkerDevice = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID] }] });
            blinkerDevice.addEventListener('gattserverdisconnected', () => setUI(false));

            const server = await blinkerDevice.gatt.connect();
            const service = await server.getPrimaryService(SERVICE_UUID);

            blinkerControlChar = await service.getCharacteristic(CHAR_CONTROL_UUID);
            blinkerColorChar   = await service.getCharacteristic(CHAR_COLOR_UUID);
            blinkerBrightChar  = await service.getCharacteristic(CHAR_BRIGHT_UUID);
            blinkerTimerChar   = await service.getCharacteristic(CHAR_TIMER_UUID);

            setUI(true);
        } catch (e) {
            console.error("Blinker BLE Error:", e);
            setUI(false);
        }
    });

    // Start / Stop
    els.start.addEventListener('click', async () => {
        if (!blinkerControlChar) return;
        await blinkerControlChar.writeValue(new Uint8Array([1]));
        // start() on the device resets timer to 25 — resend our values immediately after
        if (blinkerTimerChar)  await blinkerTimerChar.writeValue(new Uint8Array([TIMER_STEPS[timerStepIdx]]));
        if (blinkerBrightChar) await blinkerBrightChar.writeValue(new Uint8Array([BRIGHT_BLE[brightStepIdx]]));
        isBlinkerRunning = true;
        els.dot.style.color = "var(--blue)";
        startCountdown();
    });

    els.stop.addEventListener('click', async () => {
        if (!blinkerControlChar) return;
        await blinkerControlChar.writeValue(new Uint8Array([0]));
        isBlinkerRunning = false;
        els.dot.style.color = "var(--green)";
        stopCountdown();
    });

    // Timer stepper
    const updateTimer = async () => {
        els.timeVal.textContent = `${TIMER_STEPS[timerStepIdx]}'`;
        if (blinkerTimerChar) await blinkerTimerChar.writeValue(new Uint8Array([TIMER_STEPS[timerStepIdx]]));
    };
    els.timePrev.addEventListener('click', async () => {
        if (timerStepIdx > 0) { timerStepIdx--; await updateTimer(); }
    });
    els.timeNext.addEventListener('click', async () => {
        if (timerStepIdx < TIMER_STEPS.length - 1) { timerStepIdx++; await updateTimer(); }
    });

    // Brightness stepper
    const updateBright = async () => {
        els.brightVal.textContent = `${BRIGHT_STEPS[brightStepIdx]}%`;
        if (blinkerBrightChar) await blinkerBrightChar.writeValue(new Uint8Array([BRIGHT_BLE[brightStepIdx]]));
    };
    els.brightPrev.addEventListener('click', async () => {
        if (brightStepIdx > 0) { brightStepIdx--; await updateBright(); }
    });
    els.brightNext.addEventListener('click', async () => {
        if (brightStepIdx < BRIGHT_STEPS.length - 1) { brightStepIdx++; await updateBright(); }
    });

    // Color pickers
    const updateColors = async () => {
        if (!blinkerColorChar) return;
        const c1 = hexToRgb(els.c1.value);
        const c2 = hexToRgb(els.c2.value);
        await blinkerColorChar.writeValue(new Uint8Array([...c1, ...c2]));
    };

    els.c1.addEventListener('change', updateColors);
    els.c2.addEventListener('change', updateColors);
}

// Map it to a hash command just like your audio stream triggers
function checkBlinkerHash() {
    if (window.location.hash === "#blinker") {
        createBlinkerWidget();
        window.history.replaceState(null, null, " ");
    }
}

window.addEventListener("hashchange", checkBlinkerHash, false);

// Also expose as a command to map to quicklinks easily
window._ntCommands = window._ntCommands || [];
window._ntCommands.push({
    title: "Blinker",
    lambda: createBlinkerWidget
});
