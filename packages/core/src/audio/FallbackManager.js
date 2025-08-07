// FallbackManager.js – Generates tiny synth beeps for missing samples.
// Only intended for developer builds so the game remains audible.

import * as Tone from 'tone';

export class FallbackManager {
  /**
   * Create synths for each missingId and connect them to given Tone.Gain node.
   * @param {string[]} missingIds
   * @param {Tone.Gain} outputGain
   * @param {{ enabled?: boolean }} [opts]
   * @returns {Map<string, Tone.Synth>}
   */
  static create(missingIds, outputGain, opts = {}) {
    const enabled = opts.enabled ?? true;
    const map = new Map();
    if (!enabled || !missingIds.length) return map;

    const fallbackFreqs = [261.63, 329.63, 392.0, 523.25]; // C4–C5 triads
    let idx = 0;
    for (const id of missingIds) {
      const freq = fallbackFreqs[idx % fallbackFreqs.length];
      idx += 1;
      const synth = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 },
      }).connect(outputGain);
      map.set(id, synth);
      console.warn(`⚠️  [Audio] Sample for "${id}" missing – using synth fallback`);
    }
    return map;
  }
}

export default FallbackManager; 