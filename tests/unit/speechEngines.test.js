import { describe, it, expect } from 'vitest';
import * as sam from '../../js/audio/speech/engines/sam.js';
import * as espeak from '../../js/audio/speech/engines/espeak.js';
import {
  isUsable,
  loudness,
  matchLoudness,
} from '../../js/audio/speech/levels.js';
import { CONFIG } from '../../js/config.js';
import { pitchOf } from '../helpers/pitch.js';

const { SPEAKERS, TARGET_DB } = CONFIG.SPEECH;
const differ = (a, b) => a.length !== b.length || a.some((x, i) => x !== b[i]);

describe('SAM', () => {
  it("renders the tank's line", async () => {
    const { samples, sampleRate } = await sam.render(
      'Heavy artillery!',
      SPEAKERS.tank.voice
    );
    expect(sampleRate).toBe(22050);
    expect(isUsable(samples)).toBe(true);
  });

  it('rejects text with nothing to pronounce', async () => {
    for (const text of ['', '   ', '?!']) {
      await expect(sam.render(text, SPEAKERS.tank.voice)).rejects.toThrow(
        'nothing to say'
      );
    }
  });

  it('rejects text outside plain ASCII', async () => {
    await expect(sam.render('Ñandú', SPEAKERS.tank.voice)).rejects.toThrow(
      'plain ASCII'
    );
  });

  it('changes its sound with the mouth setting', async () => {
    const voice = SPEAKERS.tank.voice;
    const a = await sam.render('Stab time!', { ...voice, mouth: 80 });
    const b = await sam.render('Stab time!', { ...voice, mouth: 200 });
    expect(differ(a.samples, b.samples)).toBe(true);
  });
});

describe('espeak-ng', () => {
  it('renders every espeak-ng cast', async () => {
    for (const setup of Object.values(SPEAKERS)) {
      if (setup.engine !== 'espeak') continue;
      const { samples, sampleRate } = await espeak.render(
        'Kill human!',
        setup.voice
      );
      expect(sampleRate).toBe(22050);
      expect(isUsable(samples)).toBe(true);
    }
  });

  it('lists its voice variants', async () => {
    const names = await espeak.variants();
    expect(names).toEqual(
      expect.arrayContaining(['Tweaky', 'Mr serious', 'AnxiousAndy'])
    );
    expect(names.length).toBeGreaterThan(100);
  });

  it('changes its sound with the variant, pitch, range and speed', async () => {
    // espeak-ng varies each render slightly (no seed to pin), so measure what
    // each setting is for: the voice's pitch, how far it moves, the length
    // A fixed voice, not a cast: the thresholds below were set against it,
    // and retuning a speaker in config.js mustn't move them
    const base = { variant: 'AnxiousAndy', pitch: 50, range: 70, speed: 175 };
    const line = 'Kill human! Destroy target! Hostile detected!';
    const measure = async (voice) => {
      const { samples, sampleRate } = await espeak.render(line, voice);
      return { ...pitchOf(samples, sampleRate), length: samples.length };
    };
    const plain = await measure(base);
    const grandma = await measure({ ...base, variant: 'grandma' });
    const higher = await measure({ ...base, pitch: 90 });
    const flat = await measure({ ...base, range: 10 });
    const wide = await measure({ ...base, range: 100 });
    const slower = await measure({ ...base, speed: 120 });
    expect(grandma.hz).toBeGreaterThan(plain.hz * 1.5);
    expect(higher.hz).toBeGreaterThan(plain.hz * 1.4);
    expect(wide.spread).toBeGreaterThan(flat.spread + 1);
    expect(slower.length).toBeGreaterThan(plain.length * 1.2);
  });

  it('refuses a variant it does not have', async () => {
    await expect(
      espeak.render('Hello', { ...SPEAKERS.player.voice, variant: 'Nobody' })
    ).rejects.toThrow('no voice variant "Nobody"');
  });

  it('renders silence for text with nothing to say', async () => {
    const { samples } = await espeak.render('?!', SPEAKERS.player.voice);
    expect(isUsable(samples)).toBe(false);
  });
});

describe('real lines level-match', () => {
  it('hits the target within 0.5 dB from either engine', async () => {
    const lines = [
      await sam.render('Heavy artillery!', SPEAKERS.tank.voice),
      await espeak.render('Heavy artillery!', SPEAKERS.player.voice),
    ];
    for (const { samples, sampleRate } of lines) {
      const out = matchLoudness(samples, sampleRate, TARGET_DB);
      expect(Math.abs(loudness(out, sampleRate) - TARGET_DB)).toBeLessThan(0.5);
    }
  });
});
