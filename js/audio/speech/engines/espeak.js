/**
 * espeak-ng compiled to WebAssembly (js/vendor/espeak-ng, GPL-3): English
 * text in one of espeak-ng's voice variants.
 */
import createModule from '../../../vendor/espeak-ng/espeak-ng.js';

const VARIANTS_DIR = '/usr/share/espeak-ng-data/voices/!v';
const DATA_URL = new URL(
  '../../../vendor/espeak-ng/espeak-ng.data',
  import.meta.url
);

let loading = null;

// The engine's own loader only logs a failed data download and then never
// finishes, so fetch the data here, where a failure can be reported.
// In Node (the unit tests) the loader reads the file from disk itself.
async function moduleOptions() {
  if (DATA_URL.protocol === 'file:') return {};
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.arrayBuffer();
  return { getPreloadedPackage: () => data };
}

function load() {
  loading ??= moduleOptions()
    .then(createModule)
    .then((m) => ({
      synth: new m.eSpeakNGWorker(),
      variants: m.FS.readdir(VARIANTS_DIR)
        .filter((name) => !name.startsWith('.'))
        .sort((a, b) => a.localeCompare(b)),
      voice: null,
    }))
    .catch((cause) => {
      // No espeak-ng for the rest of the session
      throw Object.assign(
        new Error(`espeak-ng didn't load: ${cause.message}`),
        {
          fatal: true,
        }
      );
    });
  return loading;
}

export async function variants() {
  return (await load()).variants;
}

export async function render(text, { variant, pitch, range, speed }) {
  const engine = await load();
  // espeak-ng quietly falls back to its default voice for a name it lacks
  if (!engine.variants.includes(variant)) {
    throw new Error(`espeak-ng has no voice variant "${variant}"`);
  }
  const name = `en-us+${variant}`;
  if (engine.voice !== name) {
    engine.synth.set_voice(name); // costs a few ms, so only on a change
    engine.voice = name;
  }
  engine.synth.set_rate(speed);
  engine.synth.set_pitch(pitch);
  engine.synth.set_range(range);
  const chunks = [];
  engine.synth.synthesize(text, (chunk) => {
    if (chunk) chunks.push(chunk);
    return false; // keep going
  });
  const samples = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) samples[at + i] = chunk[i] / 32768;
    at += chunk.length;
  }
  return { samples, sampleRate: engine.synth.samplerate };
}
