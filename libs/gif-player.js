// Self-contained GIF frame decoder and canvas player.
// Handles: GIF87a/GIF89a, transparency, disposal 0/1/2/3, interlacing.
// No dependencies — uses only Fetch + Canvas APIs.

(function (global) {
  "use strict";

  // ── GIF binary parser ────────────────────────────────────────────────────

  function parseGIF(buffer) {
    const b = new Uint8Array(buffer);
    let p = 0;

    function r16() {
      return b[p++] | (b[p++] << 8);
    }

    if (b[0] !== 71 || b[1] !== 73 || b[2] !== 70)
      throw new Error("Not a GIF");
    p = 6; // skip header "GIF87a" / "GIF89a"

    // Logical Screen Descriptor
    const canvasW = r16();
    const canvasH = r16();
    const lsd = b[p++];
    p += 2; // bg color index, pixel aspect ratio

    const hasGCT = lsd >> 7;
    const gctN = 2 << (lsd & 7);
    let gct = null;
    if (hasGCT) {
      gct = b.subarray(p, p + gctN * 3);
      p += gctN * 3;
    }

    function skipSubBlocks() {
      let size;
      while ((size = b[p++]) !== 0) p += size;
    }

    function readSubBlocks() {
      const chunks = [];
      let size;
      while ((size = b[p++]) !== 0) {
        chunks.push(b.subarray(p, p + size));
        p += size;
      }
      return chunks;
    }

    const frames = [];
    // RGBA accumulation buffer — composite of all drawn frames
    let composite = new Uint8ClampedArray(canvasW * canvasH * 4);
    let savedComposite = null; // for disposal method 3

    let gc = null;

    outer: while (p < b.length) {
      switch (b[p++]) {
        case 0x3b: // Trailer
          break outer;

        case 0x21: { // Extension
          const label = b[p++];
          if (label === 0xf9) {
            // Graphic Control Extension
            p++; // block size = 4
            const flags = b[p++];
            const delayCs = r16();
            const tidx = b[p++];
            p++; // terminator
            gc = {
              disposal: (flags >> 3) & 7,
              transparent: flags & 1 ? tidx : -1,
              delay: Math.max(20, delayCs * 10), // centiseconds → ms
            };
          } else {
            skipSubBlocks();
          }
          break;
        }

        case 0x2c: { // Image Descriptor
          const left = r16(), top = r16(), w = r16(), h = r16();
          const iflags = b[p++];
          const hasLCT = iflags >> 7;
          const interlaced = (iflags >> 6) & 1;
          const lctN = 2 << (iflags & 7);

          let ct = gct;
          if (hasLCT) {
            ct = b.subarray(p, p + lctN * 3);
            p += lctN * 3;
          }

          const minCodeSize = b[p++];
          const chunks = readSubBlocks();
          let totalLen = 0;
          for (const c of chunks) totalLen += c.length;
          const lzwData = new Uint8Array(totalLen);
          let off = 0;
          for (const c of chunks) { lzwData.set(c, off); off += c.length; }

          const pixels = lzwDecompress(minCodeSize, lzwData);
          const ordered = interlaced ? deinterlace(pixels, w, h) : pixels;

          const thisGC = gc || { disposal: 0, transparent: -1, delay: 100 };

          // Apply disposal of previous frame before drawing this one
          const prevDisposal = frames.length > 0
            ? frames[frames.length - 1]._disposal
            : 0;
          if (prevDisposal === 2) {
            composite = new Uint8ClampedArray(canvasW * canvasH * 4);
          } else if (prevDisposal === 3 && savedComposite) {
            composite = savedComposite.slice();
          }

          // Save pre-draw state if this frame requests "restore to previous"
          if (thisGC.disposal === 3) {
            savedComposite = composite.slice();
          }

          // Draw this frame's pixels into the composite
          for (let i = 0; i < ordered.length; i++) {
            const ci = ordered[i];
            if (ci === thisGC.transparent) continue;
            const px = left + (i % w);
            const py = top + Math.floor(i / w);
            if (px >= canvasW || py >= canvasH) continue;
            const dp = (py * canvasW + px) * 4;
            const cp = ci * 3;
            composite[dp]     = ct[cp];
            composite[dp + 1] = ct[cp + 1];
            composite[dp + 2] = ct[cp + 2];
            composite[dp + 3] = 255;
          }

          frames.push({
            data: composite.slice(),
            width: canvasW,
            height: canvasH,
            delay: thisGC.delay,
            _disposal: thisGC.disposal,
          });

          gc = null;
          break;
        }
      }
    }

    return frames;
  }

  // ── LZW decompressor ────────────────────────────────────────────────────

  function lzwDecompress(minCodeSize, data) {
    const clearCode = 1 << minCodeSize;
    const eoi = clearCode + 1;

    let dict = [];
    let codeSize, mask;

    function initDict() {
      dict = [];
      for (let i = 0; i < clearCode; i++) dict.push([i]);
      dict.push(null); // clearCode placeholder
      dict.push(null); // eoi placeholder
      codeSize = minCodeSize + 1;
      mask = (1 << codeSize) - 1;
    }
    initDict();

    let bitBuf = 0, bitsLeft = 0, dataPos = 0;

    function readCode() {
      while (bitsLeft < codeSize) {
        if (dataPos >= data.length) return -1;
        bitBuf |= data[dataPos++] << bitsLeft;
        bitsLeft += 8;
      }
      const code = bitBuf & mask;
      bitBuf >>>= codeSize;
      bitsLeft -= codeSize;
      return code;
    }

    const output = [];
    let prev = null;

    while (true) {
      const code = readCode();
      if (code === -1 || code === eoi) break;
      if (code === clearCode) { initDict(); prev = null; continue; }

      let entry;
      if (code < dict.length && dict[code] !== null) {
        entry = dict[code];
      } else if (code === dict.length && prev !== null) {
        // KwKwK: code not yet in dict, entry = prev + prev[0]
        entry = prev.concat(prev[0]);
      } else {
        break; // corrupt GIF
      }

      for (const v of entry) output.push(v);

      if (prev !== null) {
        dict.push(prev.concat(entry[0]));
        // Expand code size when dict is full for current width
        if (dict.length > mask && codeSize < 12) {
          codeSize++;
          mask = (1 << codeSize) - 1;
        }
      }

      prev = entry;
    }

    return output;
  }

  // ── Deinterlace ──────────────────────────────────────────────────────────

  function deinterlace(pixels, w, h) {
    const out = new Array(w * h);
    let src = 0;
    for (const { start, step } of [
      { start: 0, step: 8 },
      { start: 4, step: 8 },
      { start: 2, step: 4 },
      { start: 1, step: 2 },
    ]) {
      for (let y = start; y < h; y += step) {
        for (let x = 0; x < w; x++) out[y * w + x] = pixels[src++];
      }
    }
    return out;
  }

  // ── GifPlayer ────────────────────────────────────────────────────────────

  class GifPlayer {
    constructor(options = {}) {
      this.speed = options.speed ?? 1;
      this.bgColor = null; // fills letterbox bars; set by caller after load()
      this.frames = [];
      this.currentFrame = 0;
      this._timer = null;
      this._running = false;
      this.gifWidth = 0;
      this.gifHeight = 0;
      this._canvas = null;
      this._ctx = null;
      this._tempCanvas = null;
      this._tempCtx = null;
    }

    async load(url) {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to fetch GIF: ${resp.status}`);
      const buf = await resp.arrayBuffer();
      this.frames = parseGIF(buf);
      if (this.frames.length > 0) {
        this.gifWidth = this.frames[0].width;
        this.gifHeight = this.frames[0].height;
        // Temp canvas at native GIF dimensions for ImageData → drawImage scaling
        this._tempCanvas = document.createElement("canvas");
        this._tempCanvas.width = this.gifWidth;
        this._tempCanvas.height = this.gifHeight;
        this._tempCtx = this._tempCanvas.getContext("2d");
      }
      return this;
    }

    start(canvas) {
      this.stop();
      this._canvas = canvas;
      this._ctx = canvas.getContext("2d");
      this._ctx.imageSmoothingEnabled = false;
      this._running = true;
      this.currentFrame = 0;
      this._scheduleFrame();
    }

    stop() {
      this._running = false;
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    }

    redraw() {
      if (this.frames.length > 0) this._drawFrame(this.frames[this.currentFrame]);
    }

    _scheduleFrame() {
      if (!this._running || !this.frames.length) return;
      const frame = this.frames[this.currentFrame];
      this._drawFrame(frame);
      this._timer = setTimeout(() => {
        if (!this._running) return;
        this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        this._scheduleFrame();
      }, frame.delay / this.speed);
    }

    _drawFrame(frame) {
      const cw = this._canvas.width;
      const ch = this._canvas.height;
      const gw = this.gifWidth;
      const gh = this.gifHeight;

      // Largest integer multiplier that fits within the canvas
      const scale = Math.max(1, Math.min(Math.floor(cw / gw), Math.floor(ch / gh)));
      const dw = gw * scale;
      const dh = gh * scale;
      const dx = Math.floor((cw - dw) / 2);
      const dy = Math.floor((ch - dh) / 2);

      this._tempCtx.putImageData(new ImageData(frame.data, gw, gh), 0, 0);
      // Fill entire canvas first — makes letterbox bars opaque so the parent's
      // backgroundImage can't bleed through the transparent canvas areas.
      if (this.bgColor) {
        this._ctx.fillStyle = this.bgColor;
        this._ctx.fillRect(0, 0, cw, ch);
      } else {
        this._ctx.clearRect(0, 0, cw, ch);
      }
      this._ctx.imageSmoothingEnabled = false;
      this._ctx.drawImage(this._tempCanvas, dx, dy, dw, dh);
    }
  }

  global.GifPlayer = GifPlayer;
})(window);
