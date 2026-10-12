import { describe, it, expect, vi, afterEach } from 'vitest';
import { Audio } from '../../js/Audio.js';
import { clickNoise } from '../../js/audio/BeatTrack.js';
import { fakeBuses } from './helpers/audioBuses.js';

afterEach(() => vi.restoreAllMocks());

// A context that makes real sample buffers, and stand-in nodes
const ctx = {
  sampleRate: 8000,
  createBuffer: (channels, length) => {
    const data = Array.from(
      { length: channels },
      () => new Float32Array(length)
    );
    return { getChannelData: (c) => data[c] };
  },
  createConvolver: () => ({ connect: vi.fn() }),
};

// The replay compare seeds the game's random numbers: a sound buffer that
// drew from them would move every draw after it, and every frame would differ
describe("starting the audio draws none of the game's random numbers", () => {
  it('the ambient reverb, the same every time', () => {
    const random = vi.spyOn(Math, 'random');
    const made = () => {
      const audio = Object.assign(Object.create(Audio.prototype), {
        audioContext: ctx,
        effects: {},
        buses: fakeBuses(),
      });
      audio.createEffects();
      return audio.effects.reverb.buffer.getChannelData(1);
    };
    const a = made();
    const b = made();
    expect(a.every((v, i) => v === b[i])).toBe(true);
    expect(random).not.toHaveBeenCalled();
  });

  it("the kick's click, the same every time", () => {
    const random = vi.spyOn(Math, 'random');
    expect(clickNoise(ctx).getChannelData(0)).toEqual(
      clickNoise(ctx).getChannelData(0)
    );
    expect(random).not.toHaveBeenCalled();
  });
});
