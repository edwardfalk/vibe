import { describe, it, expect } from 'vitest';
import { SYNTHS } from '../../js/audio/Instruments.js';
import { hz } from '../../js/audio/Harmony.js';
import { fakeAudio } from './helpers/fakeAudio.js';

// His instrument, Edward's pick on the listening page: the 80s FM bass, a
// sine on his note bent by sines (the bassist spec, Sound)
function play(name, note) {
  const { ctx, made } = fakeAudio();
  const out = ctx.createGain();
  SYNTHS[name](ctx, out, {}, { at: 3, volume: 1, pan: 0, note });
  const oscs = made.filter((n) => n.kind === 'osc');
  const freq = (o) => o.frequency.setValueAtTime.mock.calls[0][0];
  return { oscs, freq };
}

describe('his FM bass', () => {
  it('a ghost pluck: a sine on his note, bent by one sine on it', () => {
    const { oscs, freq } = play('bassPluck', ['4', 2]);
    expect(oscs).toHaveLength(2);
    for (const o of oscs) expect(o.type).toBe('sine');
    expect(freq(oscs[0])).toBeCloseTo(hz(['4', 2], 3), 6);
    expect(freq(oscs[1])).toBeCloseTo(hz(['4', 2], 3), 6);
  });

  it('a slap: his b7, bent by a sine on it and one seven times it, its metal', () => {
    const { oscs, freq } = play('bassSlap', ['b7', 2]);
    expect(oscs).toHaveLength(3);
    const f = hz(['b7', 2], 3);
    expect(freq(oscs[0])).toBeCloseTo(f, 6);
    expect(freq(oscs[1])).toBeCloseTo(f, 6);
    expect(freq(oscs[2])).toBeCloseTo(7 * f, 6);
  });
});
