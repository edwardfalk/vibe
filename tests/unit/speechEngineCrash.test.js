import { describe, it, expect, vi } from 'vitest';

// The vendored espeak-ng is Emscripten's wasm2js build: a crash inside it
// throws a plain Error ("Aborted(…)"), never a WebAssembly.RuntimeError
vi.mock('../../js/vendor/espeak-ng/espeak-ng.js', () => ({
  default: async () => ({
    eSpeakNGWorker: class {
      samplerate = 22050;
      set_voice() {}
      set_rate() {}
      set_pitch() {}
      set_range() {}
      synthesize() {
        throw new Error('Aborted(native code called abort())');
      }
    },
    FS: { readdir: () => ['.', '..', 'Tweaky'] },
  }),
}));

const { renderRequest } = await import('../../js/audio/speech/speechWorker.js');

describe('an espeak-ng crash', () => {
  it('is fatal, so speech turns off instead of rendering on a dead engine', async () => {
    const voice = { variant: 'Tweaky', pitch: 50, range: 50, speed: 175 };
    const error = await renderRequest({
      engine: 'espeak',
      text: 'Kill human!',
      voice,
      targetDb: -20,
    }).catch((e) => e);
    expect(error.message).toContain('espeak-ng crashed');
    expect(error.fatal).toBe(true);
  });
});
