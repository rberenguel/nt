/** Canvas 2D painter. Translates flora path commands to canvas ops. */
import { rgbToHex, oklch, maxChroma } from './color.js';
import { Tune } from './tune.js';

function tone(h, L, share) {
  return oklch(L, share * maxChroma(L, h), h);
}

export class Painter {
  constructor(ctx, height = 0, pageX = 0, pageY = 0) {
    this.ctx = ctx;
    this.height = height;
    this.pageX = pageX;
    this.pageY = pageY;
    this._flipY = height > 0 ? (x, y) => [pageX + x, pageY + (height - y)] : null;
    const h = Tune.color.hue;
    this.paper = [0.976, 0.972, 0.955];
    this.white = [0.995, 0.993, 0.985];
    this.ink = tone(h, 0.12, 0.75);
    this.deep = tone(h, 0.18, 0.90);
    this.blue = tone(h, 0.42, 0.95);
    this.sky = tone(h, 0.66, 0.82);
    this.mist = tone(h, 0.84, 0.55);
    this.gold = [0.700, 0.560, 0.340];
    this.copper = [0.620, 0.330, 0.180];
    this.cream = [0.960, 0.900, 0.760];
    this.count = 0;
    this.clips = 0;
    this.projection = null;
  }

  _proj(x, y) {
    let p = [x, y];
    if (this.projection) p = this.projection(p[0], p[1]);
    if (this._flipY) p = this._flipY(p[0], p[1]);
    return p;
  }

  project(x, y) { return this._proj(x, y); }

  drawScaled(center, scale, drawFn) {
    const c = this.ctx;
    const p = this.project(center[0], center[1]);
    c.save();
    c.translate(p[0], p[1]);
    c.scale(scale, scale);
    c.translate(-p[0], -p[1]);
    drawFn();
    c.restore();
  }

  _path(cmds) {
    const c = this.ctx;
    const K = 0.5523;
    let first = true;
    for (const cmd of cmds) {
      const op = cmd[0];
      if (op === 'm') {
        const [x, y] = this._proj(cmd[1], cmd[2]);
        if (first) { c.moveTo(x, y); first = false; }
        else c.moveTo(x, y);
      } else if (op === 'l') {
        const [x, y] = this._proj(cmd[1], cmd[2]);
        c.lineTo(x, y);
      } else if (op === 'c') {
        const [a, b] = this._proj(cmd[1], cmd[2]);
        const [cc, d] = this._proj(cmd[3], cmd[4]);
        const [e, f] = this._proj(cmd[5], cmd[6]);
        c.bezierCurveTo(a, b, cc, d, e, f);
      } else if (op === 'z') {
        c.closePath();
      } else if (op === 'o') {
        const [cx, cy] = this._proj(cmd[1], cmd[2]);
        const r = cmd[3];
        const k = r * K;
        c.moveTo(cx + r, cy);
        c.bezierCurveTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r);
        c.bezierCurveTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy);
        c.bezierCurveTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r);
        c.bezierCurveTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy);
        c.closePath();
      }
    }
  }

  fill(cmds, rgb, opacity = 1, opts = {}) {
    const c = this.ctx;
    c.save();
    if (opts.blend) c.globalCompositeOperation = opts.blend;
    c.globalAlpha = opacity;
    c.fillStyle = rgbToHex(rgb);
    c.beginPath();
    if (opts.many) {
      for (const cc of cmds) this._path(cc);
    } else {
      this._path(cmds);
    }
    if (opts.evenodd) c.fill('evenodd'); else c.fill();
    c.restore();
    this.count++;
  }

  stroke(cmds, rgb, width, opacity = 1, opts = {}) {
    const c = this.ctx;
    c.save();
    if (opts.blend) c.globalCompositeOperation = opts.blend;
    c.globalAlpha = opacity;
    c.strokeStyle = rgbToHex(rgb);
    c.lineWidth = width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    if (opts.many) {
      for (const cc of cmds) this._path(cc);
    } else {
      this._path(cmds);
    }
    c.stroke();
    c.restore();
    this.count++;
  }

  // Canvas linear gradient clipped to a path. Fills an axis-aligned band.
  shade(stops, p0, p1, half) {
    const c = this.ctx;
    const [x0, y0] = this._proj(p0[0], p0[1]);
    const [x1, y1] = this._proj(p1[0], p1[1]);
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) return;
    const ux = dx / len, uy = dy / len;
    const nx = -uy * half, ny = ux * half;
    const ext = len * 0.5;
    const a = [x0 - ux * ext, y0 - uy * ext];
    const b = [x1 + ux * ext, y1 + uy * ext];
    const g = c.createLinearGradient(a[0], a[1], b[0], b[1]);
    for (const [t, col] of stops) g.addColorStop(t, rgbToHex(col));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(a[0] + nx, a[1] + ny);
    c.lineTo(b[0] + nx, b[1] + ny);
    c.lineTo(b[0] - nx, b[1] - ny);
    c.lineTo(a[0] - nx, a[1] - ny);
    c.closePath();
    c.fill();
  }

  clipBegin(cmds) {
    const c = this.ctx;
    c.save();
    c.beginPath();
    this._path(cmds);
    c.clip();
    this.clips++;
  }

  clipEnd() {
    this.ctx.restore();
    this.clips--;
  }

  groupBegin(opacity) {
    this.ctx.save();
    this.ctx.globalAlpha = opacity;
  }

  groupEnd() {
    this.ctx.restore();
  }

  clear(w, h) {
    this.ctx.fillStyle = rgbToHex(this.paper);
    this.ctx.fillRect(0, 0, w, h);
  }

  clearDesk(w, h, color) {
    this.ctx.fillStyle = color || '#e0d8c8';
    this.ctx.fillRect(0, 0, w, h);
  }

  clearPage(x, y, w, h) {
    const c = this.ctx;
    c.fillStyle = rgbToHex(this.paper);
    c.fillRect(x, y, w, h);
  }

  _ensureGrain(seed = 1) {
    if (this._grainPat) return;
    const c = this.ctx;
    const size = 256;
    const off = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!off) return;
    off.width = size; off.height = size;
    const nc = off.getContext('2d');
    const img = nc.getImageData(0, 0, size, size);
    const data = img.data;
    let s = seed >>> 0;
    const rnd = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = ((t ^ (t >>> 15)) * (t | 1)) >>> 0;
      t = (t ^ (t + (((t ^ (t >>> 7)) * (t | 61)) >>> 0))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.floor(rnd() * 256);
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
    nc.putImageData(img, 0, 0);
    this._grainPat = c.createPattern(off, 'repeat');
  }

  // Film-grain overlay: high-frequency neutral noise, very low opacity.
  // Built lazily and cached.
  grain(w, h, seed = 1) {
    this._ensureGrain(seed);
    const c = this.ctx;
    c.save();
    c.globalAlpha = 0.13;
    c.globalCompositeOperation = 'overlay';
    c.fillStyle = this._grainPat;
    c.fillRect(0, 0, w, h);
    c.restore();
  }

  // Stronger grain over a specific y-up rectangle (used to weather text).
  grainRect(x0, y0, x1, y1, seed = 1, alpha = 0.28, blend = 'overlay') {
    this._ensureGrain(seed);
    const c = this.ctx;
    const p0 = this.project(x0, y0);
    const p1 = this.project(x1, y1);
    c.save();
    c.globalAlpha = alpha;
    c.globalCompositeOperation = blend;
    c.fillStyle = this._grainPat;
    c.fillRect(p0[0], p1[1], p1[0] - p0[0], p0[1] - p1[1]);
    c.restore();
  }

  // Apply the cached grain pattern to an external 2D context (for per-frame post-processing).
  applyGrain(ctx, w, h, alpha = 0.13) {
    this._ensureGrain(1);
    if (!this._grainPat) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = this._grainPat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Subtle laid-paper grain overlay using a small repeating pattern.
  // Built lazily and cached so it never does a full-canvas getImageData.
  texture(w, h, seed = 1) {
    const c = this.ctx;
    if (!this._noisePat) {
      const size = 256;
      const off = typeof document !== 'undefined' ? document.createElement('canvas') : null;
      if (!off) return;
      off.width = size; off.height = size;
      const nc = off.getContext('2d');
      const img = nc.getImageData(0, 0, size, size);
      const data = img.data;
      let s = seed >>> 0;
      const rnd = () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = ((t ^ (t >>> 15)) * (t | 1)) >>> 0;
        t = (t ^ (t + (((t ^ (t >>> 7)) * (t | 61)) >>> 0))) >>> 0;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      for (let i = 0; i < data.length; i += 4) {
        const n = (rnd() - 0.5) * 18;
        data[i] = Math.max(0, Math.min(255, 245 + n));
        data[i + 1] = Math.max(0, Math.min(255, 240 + n));
        data[i + 2] = Math.max(0, Math.min(255, 232 + n));
        data[i + 3] = Math.max(0, Math.min(255, (rnd() * 60 + 10)));
      }
      nc.putImageData(img, 0, 0);
      this._noisePat = c.createPattern(off, 'repeat');
    }
    c.save();
    c.globalAlpha = 0.35;
    c.fillStyle = this._noisePat;
    c.fillRect(0, 0, w, h);
    c.restore();
  }
}
