/**
 * The voice playground's saved edits (voices.html keeps them in this
 * browser), read the same way by the playground and by ?tune's "Playground
 * voices" box, so the game plays exactly what the playground shows.
 */
import { validateChain } from '../audio/speech/effects.js';

export const STORE_KEY = 'vibe.voices.v1';

// Slider ranges [min, max, step]; SAM reads 0 as "its default" for pitch
// and speed, so those start at 1
export const VOICE_PARAMS = {
  sam: {
    pitch: [1, 255, 1],
    speed: [1, 255, 1],
    mouth: [0, 255, 1],
    throat: [0, 255, 1],
  },
  espeak: { pitch: [0, 100, 1], range: [0, 100, 1], speed: [80, 450, 5] },
};

function fits(group, edit) {
  if (group === 'respell') {
    return (
      edit !== null &&
      typeof edit === 'object' &&
      Object.values(edit).every((as) => typeof as === 'string')
    );
  }
  try {
    if (!VOICE_PARAMS[edit?.engine] || !Array.isArray(edit.chain)) return false;
    validateChain(edit.chain);
    return true;
  } catch {
    return false;
  }
}

// `game` is { speakers, respell } as config.js has them. Returns a copy with
// the saved edits in, one entry at a time: an entry whose config has changed
// since (or that the playground can't use) is left out and named in
// `dropped`. `blocked` when the browser refuses site storage.
export function savedVoices(game) {
  const voices = structuredClone(game);
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
  } catch {
    return { voices, dropped: [], blocked: true };
  }
  const dropped = [];
  for (const group of ['speakers', 'respell']) {
    for (const [name, saved] of Object.entries(stored?.[group] ?? {})) {
      const current = game[group][name];
      if (
        current !== undefined &&
        JSON.stringify(saved?.base) === JSON.stringify(current) &&
        fits(group, saved.edit)
      ) {
        voices[group][name] = saved.edit;
      } else {
        dropped.push(name);
      }
    }
  }
  return { voices, dropped, blocked: false };
}
