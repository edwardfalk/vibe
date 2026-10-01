import { describe, it, expect } from 'vitest';
import { renderRequest } from '../../js/audio/speech/speechWorker.js';
import { loudness } from '../../js/audio/speech/levels.js';
import { CONFIG } from '../../js/config.js';

const { SPEAKERS } = CONFIG.SPEECH;

describe('speech worker', () => {
  it('renders and levels a line from either engine', async () => {
    for (const speaker of ['tank', 'player']) {
      const { engine, voice } = SPEAKERS[speaker];
      const out = await renderRequest({
        engine,
        text: 'Heavy artillery!',
        voice,
        targetDb: -20,
      });
      expect(loudness(out.samples, out.sampleRate)).toBeCloseTo(-20, 0);
      expect(out.renderMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('refuses an engine it does not know', async () => {
    await expect(
      renderRequest({ engine: 'piper', text: 'Hi', voice: {}, targetDb: -20 })
    ).rejects.toThrow('No speech engine called "piper"');
  });

  it('refuses a render with no sound', async () => {
    await expect(
      renderRequest({
        engine: 'espeak',
        text: '?!',
        voice: SPEAKERS.player.voice,
        targetDb: -20,
      })
    ).rejects.toThrow('made no sound');
  });
});
