/**
 * fxPalette.js – Centralised colour schemes for explosion FX.
 * Each key corresponds to an explosion type; the value is an array of RGB triplets.
 * Design team can tweak hues here without touching core logic.
 */

export const explosionPalette = {
  'tank-plasma': [
    [138, 43, 226],
    [64, 224, 208],
    [255, 20, 147],
    [255, 255, 255],
    [0, 191, 255],
    [255, 215, 0],
  ],
  'rusher-explosion': [
    [255, 20, 147],
    [255, 69, 0],
    [255, 215, 0],
    [255, 255, 255],
    [255, 140, 0],
    [255, 182, 193],
    [255, 255, 0],
  ],
  'grunt-death': [
    [50, 205, 50],
    [0, 255, 127],
    [34, 139, 34],
    [255, 255, 255],
    [144, 238, 144],
    [0, 255, 0],
  ],
  'stabber-death': [
    [255, 215, 0],
    [255, 255, 0],
    [255, 140, 0],
    [255, 255, 255],
    [218, 165, 32],
    [255, 248, 220],
  ],
  'tank-death': [
    [138, 43, 226],
    [123, 104, 238],
    [72, 61, 139],
    [255, 255, 255],
    [0, 191, 255],
    [147, 112, 219],
  ],
  default: [
    [255, 69, 0],
    [255, 140, 0],
    [255, 215, 0],
    [255, 255, 255],
    [255, 20, 147],
    [138, 43, 226],
  ],
}; 