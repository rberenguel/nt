/** Named colour palettes for the Flora screensaver.
 *
 * Each palette mutates Tune.color to set an overall hue family.  The existing
 * Oklch ink/look system is reused; setting palette entries to 'look' makes
 * them follow the hue directly.  A small tonal jitter is applied per palette
 * so every generation is slightly different even with the same named palette.
 */
import { Tune } from './tune.js';

export const PALETTES = [
  {
    name: 'red',
    hue: 24,
    hue_jitter: 10,
    hue_drift: -18,
    palette: { hero: 'look', blooms: 'look', leaves: 'look', leaflets: 'look', stems: 'look' },
    looks: { leaf: { base_l: [0.62, 0.78], tip_l: [0.30, 0.50], chroma: [0.55, 0.85], curve: [0.4, 2.0] } },
  },
  {
    name: 'green',
    hue: 142,
    hue_jitter: 14,
    hue_drift: -22,
    palette: { hero: 'look', blooms: 'look', leaves: 'look', leaflets: 'look', stems: 'look' },
    looks: { leaf: { base_l: [0.66, 0.82], tip_l: [0.28, 0.55], chroma: [0.60, 0.90], curve: [0.4, 2.2] } },
  },
  {
    name: 'blue',
    hue: 263,
    hue_jitter: 12,
    hue_drift: -24,
    palette: { hero: 'look', blooms: 'look', leaves: 'look', leaflets: 'look', stems: 'look' },
    looks: { leaf: { base_l: [0.64, 0.80], tip_l: [0.28, 0.52], chroma: [0.60, 0.92], curve: [0.4, 2.2] } },
  },
  {
    name: 'violet',
    hue: 305,
    hue_jitter: 14,
    hue_drift: -20,
    palette: { hero: 'look', blooms: 'look', leaves: 'look', leaflets: 'look', stems: 'look' },
    looks: { leaf: { base_l: [0.66, 0.82], tip_l: [0.32, 0.55], chroma: [0.55, 0.85], curve: [0.5, 2.1] } },
  },
  {
    name: 'amber',
    hue: 72,
    hue_jitter: 12,
    hue_drift: -16,
    palette: { hero: 'look', blooms: 'look', leaves: 'look', leaflets: 'look', stems: 'look' },
    looks: { leaf: { base_l: [0.70, 0.86], tip_l: [0.34, 0.58], chroma: [0.50, 0.80], curve: [0.5, 2.0] } },
  },
];

export function applyPalette(palette, rng) {
  const cfg = Tune.color;
  cfg.hue = palette.hue + rng.jit(palette.hue_jitter || 6);
  cfg.hue_jitter = palette.hue_jitter !== undefined ? palette.hue_jitter : cfg.hue_jitter;
  cfg.hue_drift = palette.hue_drift !== undefined ? palette.hue_drift : cfg.hue_drift;
  if (palette.palette) Object.assign(cfg.palette, palette.palette);
  if (palette.looks) {
    for (const k in palette.looks) {
      if (cfg.looks[k]) Object.assign(cfg.looks[k], palette.looks[k]);
    }
  }
}

export function paletteByName(name) {
  return PALETTES.find(p => p.name === name) || PALETTES[Math.floor(Math.random() * PALETTES.length)];
}
