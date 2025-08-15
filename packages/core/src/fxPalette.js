/**
 * fxPalette.js – Centralised colour schemes for explosion FX.
 * Each key corresponds to an explosion type; the value is an array of RGB triplets.
 * Design team can tweak hues here without touching core logic.
 */

export const explosionPalette = {
  'tank-plasma': [
    [138, 43, 226],
    [123, 104, 238],
    [147, 112, 219],
    [100, 50, 200],
    [170, 130, 255],
  ],
  'rusher-explosion': [
    [255, 20, 147],
    [255, 40, 130],
    [255, 80, 160],
    [255, 120, 180],
    [220, 0, 120],
  ],
  'grunt-death': [
    [50, 205, 50],
    [60, 220, 60],
    [40, 180, 40],
    [30, 150, 30],
    [80, 240, 80],
  ],
  'stabber-death': [
    [255, 215, 0],
    [255, 200, 40],
    [240, 180, 0],
    [255, 230, 90],
    [220, 160, 0],
  ],
  'tank-death': [
    [138, 43, 226],
    [123, 104, 238],
    [147, 112, 219],
    [100, 50, 200],
    [170, 130, 255],
  ],
  // Neutral fallback only – avoids warm/pink hues contaminating enemy-specific colors
  default: [
    [255, 255, 255],
    [220, 220, 220],
    [200, 200, 200],
    [180, 180, 180],
    [160, 160, 160],
  ],
};
