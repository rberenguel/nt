/** Size distribution sampling. */
export function sample(rng, dist) {
  const [lo, hi] = dist.range;
  const pts = dist.points;
  // Build cumulative weights.
  const xs = pts.map(p => p[0]);
  const ws = pts.map(p => p[1]);
  const total = ws.reduce((a, b) => a + b, 0);
  let x = rng.next() * total;
  for (let i = 0; i < pts.length - 1; i++) {
    x -= ws[i];
    if (x <= 0) {
      const t = 1 + x / ws[i]; // remainder fraction in this segment
      const u = pts[i][0] + t * (pts[i + 1][0] - pts[i][0]);
      return lo + u * (hi - lo);
    }
  }
  return hi;
}
