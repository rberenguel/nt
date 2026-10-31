/** Occupancy grid over the page. */
export class Space {
  constructor(width, height, cell = 3) {
    this.w = width; this.h = height; this.c = cell;
    this.nx = Math.ceil(width / cell);
    this.ny = Math.ceil(height / cell);
    this.v = new Uint8Array(this.nx * this.ny).fill(1);
    this.f = null; this.maxf = 0;
  }

  _idx(i, j) { return j * this.nx + i; }

  _setRect(x0, y0, x1, y1, val) {
    const c = this.c;
    const i0 = Math.max(0, Math.floor(x0 / c));
    const i1 = Math.min(this.nx - 1, Math.ceil(x1 / c) - 1);
    const j0 = Math.max(0, Math.floor(y0 / c));
    const j1 = Math.min(this.ny - 1, Math.ceil(y1 / c) - 1);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) this.v[this._idx(i, j)] = val;
    }
  }

  open(x0, y0, x1, y1) { this._setRect(x0, y0, x1, y1, 0); }
  blockText(x0, y0, x1, y1) { this._setRect(x0, y0, x1, y1, 2); }
  close(x0, y0, x1, y1) { this._setRect(x0, y0, x1, y1, 1); }

  free(x, y, overStems = false) {
    const i = Math.floor(x / this.c), j = Math.floor(y / this.c);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return false;
    const v = this.v[this._idx(i, j)];
    return v === 0 || (overStems && v === 4);
  }

  openAt(x, y) {
    const i = Math.floor(x / this.c), j = Math.floor(y / this.c);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return false;
    const v = this.v[this._idx(i, j)];
    return v === 0 || v === 3 || v === 4;
  }

  field() {
    const nx = this.nx, ny = this.ny, v = this.v, c = this.c;
    const big = 1e9;
    const f = new Float32Array(nx * ny);
    for (let k = 0; k < nx * ny; k++) f[k] = (v[k] === 0 || v[k] === 4) ? big : 0;
    const at = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny) ? 0 : f[j * nx + i];
    const d1 = 1, d2 = Math.sqrt(2);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (f[k] > 0) {
          f[k] = Math.min(f[k], at(i - 1, j) + d1, at(i, j - 1) + d1, at(i - 1, j - 1) + d2, at(i + 1, j - 1) + d2);
        }
      }
    }
    for (let j = ny - 1; j >= 0; j--) {
      for (let i = nx - 1; i >= 0; i--) {
        const k = j * nx + i;
        if (f[k] > 0) {
          f[k] = Math.min(f[k], at(i + 1, j) + d1, at(i, j + 1) + d1, at(i + 1, j + 1) + d2, at(i - 1, j + 1) + d2);
        }
      }
    }
    let maxf = 0;
    for (let k = 0; k < nx * ny; k++) {
      f[k] = Math.max(0, (f[k] - 0.5) * c);
      if (f[k] > maxf) maxf = f[k];
    }
    this.f = f; this.maxf = maxf;
  }

  room(x, y) {
    const i = Math.floor(x / this.c), j = Math.floor(y / this.c);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return -1;
    return this.f ? this.f[j * this.nx + i] : 0;
  }

  disc(x, y, r, k = 1) {
    const kr = k * r;
    if (this.f) {
      const c = this.c, f = this.f, reach = kr + this.maxf;
      const i0 = Math.max(0, Math.floor((x - reach) / c));
      const i1 = Math.min(this.nx - 1, Math.floor((x + reach) / c));
      const j0 = Math.max(0, Math.floor((y - reach) / c));
      const j1 = Math.min(this.ny - 1, Math.floor((y + reach) / c));
      for (let j = j0; j <= j1; j++) {
        const cy = (j + 0.5) * c - y;
        for (let i = i0; i <= i1; i++) {
          const cx = (i + 0.5) * c - x;
          const d = Math.sqrt(cx * cx + cy * cy) - kr;
          const idx = j * this.nx + i;
          if (d < f[idx]) f[idx] = Math.max(0, d);
        }
      }
    }
    this._mark(x, y, kr, 3);
  }

  box(x0, y0, x1, y1) {
    const c = this.c;
    if (this.f) {
      const f = this.f, reach = this.maxf;
      const i0 = Math.max(0, Math.floor((x0 - reach) / c));
      const i1 = Math.min(this.nx - 1, Math.floor((x1 + reach) / c));
      const j0 = Math.max(0, Math.floor((y0 - reach) / c));
      const j1 = Math.min(this.ny - 1, Math.floor((y1 + reach) / c));
      for (let j = j0; j <= j1; j++) {
        const dy = Math.max(y0 - (j + 0.5) * c, (j + 0.5) * c - y1, 0);
        for (let i = i0; i <= i1; i++) {
          const dx = Math.max(x0 - (i + 0.5) * c, (i + 0.5) * c - x1, 0);
          const d = Math.sqrt(dx * dx + dy * dy);
          const idx = j * this.nx + i;
          if (d < f[idx]) f[idx] = d;
        }
      }
    }
    const i0 = Math.max(0, Math.floor(x0 / c));
    const i1 = Math.min(this.nx - 1, Math.floor(x1 / c));
    const j0 = Math.max(0, Math.floor(y0 / c));
    const j1 = Math.min(this.ny - 1, Math.floor(y1 / c));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const idx = this._idx(i, j);
        if (this.v[idx] === 0 || this.v[idx] === 4) this.v[idx] = 3;
      }
    }
  }

  reserve(x, y, r, val = 3) {
    if (this.f && val === 3) return this.disc(x, y, r, 1);
    this._mark(x, y, r, val);
  }

  _mark(x, y, r, val) {
    const c = this.c;
    const i0 = Math.max(0, Math.floor((x - r) / c));
    const i1 = Math.min(this.nx - 1, Math.floor((x + r) / c));
    const j0 = Math.max(0, Math.floor((y - r) / c));
    const j1 = Math.min(this.ny - 1, Math.floor((y + r) / c));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const cx = (i + 0.5) * c, cy = (j + 0.5) * c;
        if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r) {
          const idx = this._idx(i, j);
          if (this.v[idx] === 0) this.v[idx] = val;
        }
      }
    }
  }

  reserveLine(pts, r, val = 3) {
    if (Array.isArray(r)) {
      for (let i = 0; i < pts.length; i++) this.reserve(pts[i][0], pts[i][1], r[i], val);
      return;
    }
    for (let i = 0; i < pts.length; i += 2) this.reserve(pts[i][0], pts[i][1], r, val);
  }

  clearance(x, y, maxr) {
    if (!this.free(x, y)) return 0;
    const c = this.c, ci = Math.floor(x / c), cj = Math.floor(y / c);
    const rings = Math.ceil(maxr / c);
    let best = maxr + c;
    const test = (di, dj) => {
      const d = Math.sqrt(di * di + dj * dj) * c;
      if (d >= best) return;
      const i = ci + di, j = cj + dj;
      const cv = (i >= 0 && j >= 0 && i < this.nx && j < this.ny) ? this.v[j * this.nx + i] : null;
      if (cv === null || (cv !== 0 && cv !== 4)) best = d;
    };
    for (let r = 1; r <= rings; r++) {
      if ((r - 1) * c >= best) break;
      for (let di = -r; di <= r; di++) { test(di, -r); test(di, r); }
      for (let dj = -r + 1; dj <= r - 1; dj++) { test(-r, dj); test(r, dj); }
    }
    return Math.min(maxr, Math.max(0, best - c));
  }

  freeCells(step = 1) {
    const out = [];
    for (let j = 0; j < this.ny; j += step) {
      for (let i = 0; i < this.nx; i += step) {
        if (this.v[j * this.nx + i] === 0) out.push([(i + 0.5) * this.c, (j + 0.5) * this.c]);
      }
    }
    return out;
  }

  coverage() {
    let free = 0, placed = 0;
    for (let k = 0; k < this.nx * this.ny; k++) {
      const v = this.v[k];
      if (v === 0) free++;
      else if (v === 3 || v === 4) placed++;
    }
    return free + placed === 0 ? 1 : placed / (free + placed);
  }
}
