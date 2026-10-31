/** Tunable parameters, ported from lua/flora/tune.lua. */
export const Tune = {
  gesture: {
    edge: 0.24,
    bows: 3,
    bow_amp: [0.20, 0.33],
    bow_width: [0.34, 0.42],
    density_floor: 0.24,
    bow_density: 0.6,
    end_reach: 3,
  },
  plant: {
    root: 0.64,
    lookahead: 82,
    bend_radius: 91,
    bend_ease: 23,
    long_shoots: 2,
    shoot_start: [-0.15, 0.3],
    shoot_end: [0.6, 1.0],
    shoot_reach: [0.24, 0.36],
    shoot_wave: [220, 330],
    foot_shoots: 5,
    foot_reach: [34, 70],
    shoot_bend: 29,
    root_width: 5.8,
    tip_width: 3,
    fork_ratio: 0.8,
    stem_l: 0.25,
    stem_brush: 1,
  },
  hero: {
    style: 'wedge',
    petals: 5,
    petal_width: 0.35,
    rotation: -1,
    lost_edges: 0.56,
    tilt: 35,
  },
  blooms: {
    fan: { weight: 3, petals: [5, 6], width: [0.32, 0.40], ragged: 0.10, spacing: 0.10, rim: 0.16, rays: [28, 44], ray_reach: [0.25, 0.85], ray_contrast: [0.35, 0.70], veins: [10, 18] },
    round: { weight: 2, petals: [5, 5], width: [0.52, 0.58], ragged: 0.08, spacing: 0.12, rim: 0.07, rays: [0, 0], ray_reach: [0.30, 0.80], ray_contrast: [0.45, 0.80], veins: [22, 22] },
    soft: { weight: 2, petals: [5, 5], width: [0.62, 0.72], ragged: 0.08, spacing: 0.12, rim: 0.07, rays: [0, 0], ray_reach: [0.30, 0.80], ray_contrast: [0.45, 0.80], veins: [12, 12] },
    obovate: { weight: 0, petals: [5, 5], width: [0.30, 0.36], ragged: 0.08, spacing: 0.12, rim: 0.11, rays: [0, 0], ray_reach: [0.30, 0.80], ray_contrast: [0.45, 0.80], veins: [22, 22] },
    wedge: { weight: 3.2, petals: [5, 5], width: [0.35, 0.44], ragged: 0.15, spacing: 0.09, rim: 0.12, rays: [30, 44], ray_reach: [0.25, 0.6], ray_contrast: [0.4, 0.6], veins: [12, 18], gap: 0.08, eye_fade: 0.28, backruns: 0.8 },
  },
  compose: {
    hero: 0.45,
    features: [1.0, 1.3],
    leaves: 120,
    leaf_size: 0.85,
    leaf_width: [0.14, 0.20],
    leaf_overlap: 0.60,
    leaf_spacing: [16, 28],
    hole_min: 4,
    sprays: 240,
    small_blooms: 12,
    curls: 0.65,
    leaflet_spacing: [24, 42],
    leaflet_size: 12,
  },
  mix: {
    bloom: 1, soft: 1, lily: 1, ghost: 1, umbel: 1, cyme: 1, gyps: 1,
    leaves: 1, leaflets: 1, sprays: 1, curls: 1, density: 1,
    bee: 0, butterfly: 0, bird: 0, snail: 0,
  },
  sizes: {
    gyps: { range: [0.3, 1.0], points: [[0, 0.35], [0.25, 0.8], [0.5, 1.0], [0.75, 0.75], [1, 0.5]] },
    leaf: { range: [0.35, 1.3], points: [[0, 0.4], [0.25, 0.9], [0.5, 1.0], [0.75, 0.6], [1, 0.3]] },
    leaflet: { range: [0.5, 2.0], points: [[0, 0.6], [0.25, 1.0], [0.5, 0.7], [0.75, 0.35], [1, 0.15]] },
  },
  color: {
    hue: 263,
    hue_jitter: 6,
    hue_drift: -24,
    grey_chance: 0.12,
    grey_share: 0.25,
    palette: { hero: 'look', blooms: 'look', leaves: 'blue', leaflets: 'blue', stems: 'chiku-rin' },
    looks: {
      vivid: { base_l: [0.80, 0.90], tip_l: [0.2, 0.32], chroma: [0.65, 1.00], curve: [0.4, 1.3] },
      hero: { base_l: [0.74, 1], tip_l: [0.36, 0.48], chroma: [0.81, 1], curve: [0.35, 0.75] },
      fan: { base_l: [0.68, 0.80], tip_l: [0.36, 0.50], chroma: [0.80, 1.00], curve: [0.35, 0.80] },
      soft: { base_l: [0.95, 0.99], tip_l: [0.48, 0.68], chroma: [0.40, 0.85], curve: [0.8, 1.8] },
      ghost: { base_l: [0.97, 0.99], tip_l: [0.83, 0.88], chroma: [0.25, 0.3], curve: [1, 1.2] },
      leaf: { base_l: [0.66, 0.8], tip_l: [0.32, 0.65], chroma: [0.65, 1], curve: [0.4, 2.2] },
    },
  },
  wash: {
    blotches: [2, 4],
    blotch_opacity: [0.10, 0.24],
    lifts: [0, 1],
    lift_opacity: [0.18, 0.32],
    blotch_hue: 10,
    tideline_chance: 0.55,
    streak_scale: 0.05,
    brush_bands: [5, 10],
    brush_pale: [10, 20],
    brush_width: 1.0,
    brush_gap: 0.35,
    brush_dry: 0.3,
    band_opacity: [0.38, 0.62],
    pale_contrast: [0.12, 0.65],
    vein_contrast: [0.15, 0.55],
    lost_edges: 0.42,
    lost_fade: 1.0,
    grain_clump: 0.55,
    grain_mottle: 0.8,
    vein_opacity: 0.34,
  },
};

export function mixCfg(base, mix) {
  function weight(kind) { return mix && mix[kind] !== undefined ? mix[kind] : Tune.mix[kind]; }
  let neutral = true;
  for (const k of ['leaves', 'leaflets', 'sprays', 'curls', 'density']) {
    if (weight(k) !== 1) { neutral = false; break; }
  }
  if (neutral) return base;
  const c = Object.assign({}, base);
  const k = Math.max(weight('density'), 0.05);
  c.hole_min = base.hole_min / k;
  const wLeaves = weight('leaves');
  if (wLeaves <= 0) c.leaves = 0;
  else {
    c.leaf_spacing = [base.leaf_spacing[0] / (wLeaves * k), base.leaf_spacing[1] / (wLeaves * k)];
    c.leaves = Math.floor(base.leaves * Math.max(1, wLeaves) + 0.5);
  }
  c.no_leaflets = weight('leaflets') <= 0;
  if (weight('leaflets') > 0) c.leaflet_spacing = [base.leaflet_spacing[0] / (weight('leaflets') * k), base.leaflet_spacing[1] / (weight('leaflets') * k)];
  c.sprays = Math.floor(base.sprays * weight('sprays') * Math.min(1, k) + 0.5);
  c.curls = base.curls * weight('curls');
  return c;
}

export function scaleDensity(dens, mix) {
  const k = mix && mix.density !== undefined ? mix.density : Tune.mix.density;
  if (k === 1) return dens;
  return (x, y) => Math.min(1, dens(x, y) * k);
}
