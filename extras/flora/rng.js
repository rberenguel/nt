/** Seeded PRNG (mulberry32) with fork/clone/pick helpers. */
class Rng {
  constructor(seed) {
    if (typeof seed === 'string') seed = Rng.hash(seed);
    this.seed = (Math.floor(seed) & 0xffffffff) >>> 0;
    this.s = this.seed;
  }

  static hash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }

  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = ((t ^ (t >>> 15)) * (t | 1)) >>> 0;
    t = (t ^ (t + (((t ^ (t >>> 7)) * (t | 61)) >>> 0))) >>> 0;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
  }

  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  jit(a) { return (this.next() * 2 - 1) * a; }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
  weighted(weights) {
    const keys = Object.keys(weights).filter(k => weights[k] > 0).sort();
    const total = keys.reduce((s, k) => s + weights[k], 0);
    if (total <= 0) return keys[0] || null;
    let x = this.next() * total;
    for (const k of keys) {
      x -= weights[k];
      if (x < 0) return k;
    }
    return keys[keys.length - 1];
  }
  fork(label) { return new Rng(Rng.hash(String(label) + ':' + this.seed)); }
  clone() { const r = new Rng(this.seed); r.s = this.s; return r; }
}

export { Rng };
