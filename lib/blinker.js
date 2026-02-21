// Global State
let blinkerDevice, blinkerControlChar, blinkerColorChar, blinkerBrightChar, blinkerTimerChar;
let isBlinkerRunning = false;

function createBlinkerWidget() {
    // Check if it already exists
    if (document.getElementById('blinker-widget')) return;

    // 1. Construct Container (reusing your audio slider classes for consistent UI)
    const container = document.createElement("div");
    container.id = "blinker-widget";
    container.className = "audio-slider-container";
    // Default position (similar to your audio sliders)
    container.style.left = "calc(100vw * 3 / 4 - 60px)"; 
    container.style.top = "calc(50vh - 280px)";
    container.style.width = "140px";

    // 2. Drag Label
    const label = document.createElement("div");
    label.className = "audio-slider-label";
    label.innerHTML = `Blinker <span id="blk-dot" style="color: var(--red); font-size: 14px; vertical-align: middle;">●</span>`;
    container.appendChild(label);

    // 3. Controls Wrapper
    const controlsDiv = document.createElement("div");
    controlsDiv.style.display = "flex";
    controlsDiv.style.flexDirection = "column";
    controlsDiv.style.gap = "8px";
    controlsDiv.style.width = "100%";
    controlsDiv.style.fontFamily = "Monoid, monospace"; // Match your body font

    controlsDiv.innerHTML = `
        <button id="blk-connect" style="background: var(--cyan); color: var(--dark); border: none; border-radius: 3px; padding: 6px; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: bold;">Connect Device</button>
        
        <div style="display: flex; gap: 4px;">
            <button id="blk-start" disabled style="flex: 1; background: var(--green); color: var(--dark); border: none; border-radius: 3px; padding: 6px; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: bold;">Start</button>
            <button id="blk-stop" disabled style="flex: 1; background: var(--red); color: var(--light); border: none; border-radius: 3px; padding: 6px; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: bold;">Stop</button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; color: var(--light-grey); font-size: 11px;">
            <span>Timer</span>
            <input type="number" id="blk-time" value="25" min="1" max="255" disabled style="width: 45px; background: var(--dark); border: 1px solid var(--light-grey); color: var(--light); border-radius: 2px; text-align: center; font-family: inherit;">
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; color: var(--light-grey); font-size: 11px;">
            <span>Bright</span>
            <input type="number" id="blk-bright" value="200" min="0" max="255" disabled style="width: 45px; background: var(--dark); border: 1px solid var(--light-grey); color: var(--light); border-radius: 2px; text-align: center; font-family: inherit;">
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; color: var(--light-grey); font-size: 11px;">
            <span>Inner</span>
            <input type="color" id="blk-c1" value="#ffffff" disabled style="width: 45px; height: 22px; padding: 0; border: none; background: transparent; cursor: pointer;">
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; color: var(--light-grey); font-size: 11px;">
            <span>Outer</span>
            <input type="color" id="blk-c2" value="#000000" disabled style="width: 45px; height: 22px; padding: 0; border: none; background: transparent; cursor: pointer;">
        </div>
    `;

    container.appendChild(controlsDiv);
    document.body.appendChild(container);

    // 4. Setup Dragging (matching your audio.js interact logic)
    interact(container)
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
        .on("dragstart", (event) => (event.target.style.zIndex = "1001"))
        .on("dragend", (event) => (event.target.style.zIndex = "1000"));

    bindBlinkerEvents(container);
}

function bindBlinkerEvents(container) {
    const SERVICE_UUID      = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
    const CHAR_CONTROL_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
    const CHAR_COLOR_UUID   = "beb5483e-36e1-4688-b7f5-ea07361b26a9";
    const CHAR_BRIGHT_UUID  = "beb5483e-36e1-4688-b7f5-ea07361b26aa";
    const CHAR_TIMER_UUID   = "beb5483e-36e1-4688-b7f5-ea07361b26ab";

    const els = {
        dot: container.querySelector('#blk-dot'),
        connect: container.querySelector('#blk-connect'),
        start: container.querySelector('#blk-start'),
        stop: container.querySelector('#blk-stop'),
        time: container.querySelector('#blk-time'),
        bright: container.querySelector('#blk-bright'),
        c1: container.querySelector('#blk-c1'),
        c2: container.querySelector('#blk-c2')
    };

    const inputs = [els.start, els.stop, els.time, els.bright, els.c1, els.c2];

    const setUI = (enabled) => {
        inputs.forEach(el => el.disabled = !enabled);
        els.connect.innerText = enabled ? "Disconnect" : "Connect Device";
        els.connect.style.background = enabled ? "var(--light-grey)" : "var(--cyan)";
        els.dot.style.color = enabled ? "var(--green)" : "var(--red)";
        
        if (!enabled) {
            isBlinkerRunning = false;
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
            els.dot.style.color = "var(--yellow)"; // Connecting state
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

    // Control Buttons
    els.start.addEventListener('click', async () => {
        if (!blinkerControlChar) return;
        await blinkerControlChar.writeValue(new Uint8Array([1]));
        isBlinkerRunning = true;
        els.dot.style.color = "var(--blue)"; // Indicate running status
    });

    els.stop.addEventListener('click', async () => {
        if (!blinkerControlChar) return;
        await blinkerControlChar.writeValue(new Uint8Array([0]));
        isBlinkerRunning = false;
        els.dot.style.color = "var(--green)"; // Back to idle connected
    });

    // Auto-sync settings on change
    els.time.addEventListener('change', async () => {
        if (blinkerTimerChar) await blinkerTimerChar.writeValue(new Uint8Array([parseInt(els.time.value)]));
    });

    els.bright.addEventListener('change', async () => {
        if (blinkerBrightChar) await blinkerBrightChar.writeValue(new Uint8Array([parseInt(els.bright.value)]));
    });

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