import { describe, it, expect, vi, afterEach } from 'vitest';
import { Audio } from '../../js/Audio.js';
import { CONFIG } from '../../js/config.js';

const MIX = { ...CONFIG.MIX };
afterEach(() => {
  Object.assign(CONFIG.MIX, MIX);
  vi.unstubAllGlobals();
});

const dB = (d) => 10 ** (d / 20);

// The game's Audio with its three buses, sound on, a beat track to hear
// what the mix tells it
function mixedAudio() {
  const gain = () => ({ gain: { value: 1 } });
  const beatTrack = { setVolume: vi.fn() };
  vi.stubGlobal('window', { beatTrack });
  const audio = Object.assign(Object.create(Audio.prototype), {
    enabled: true,
    masterGain: gain(),
    buses: { drums: gain(), band: gain(), feedback: gain() },
    voicebox: null,
  });
  return { audio, beatTrack };
}

describe("the mix's three groups", () => {
  it('each bus plays at its own knob, live', () => {
    const { audio } = mixedAudio();
    Object.assign(CONFIG.MIX, { DRUMS_DB: -3, BAND_DB: 2.5, FEEDBACK_DB: -7 });
    audio.applyMix();
    expect(audio.buses.drums.gain.value).toBeCloseTo(dB(-3), 9);
    expect(audio.buses.band.gain.value).toBeCloseTo(dB(2.5), 9);
    expect(audio.buses.feedback.gain.value).toBeCloseTo(dB(-7), 9);
    CONFIG.MIX.BAND_DB = -1.5;
    audio.applyMix();
    expect(audio.buses.band.gain.value).toBeCloseTo(dB(-1.5), 9);
  });

  it('mute stays on masterGain, so a muted bus keeps its level for unmuting', () => {
    const { audio } = mixedAudio();
    CONFIG.MIX.FEEDBACK_DB = -4;
    audio.enabled = false;
    audio.applyMix();
    expect(audio.masterGain.gain.value).toBe(0);
    expect(audio.buses.feedback.gain.value).toBeCloseTo(dB(-4), 9);
  });

  it('the drums knob leaves the kick on its own knob', () => {
    const { audio, beatTrack } = mixedAudio();
    CONFIG.MIX.DRUMS_DB = -6;
    audio.applyMix();
    expect(beatTrack.setVolume).toHaveBeenCalledWith(
      CONFIG.MIX.BEAT_TRACK_VOLUME
    );
  });

  it('start at 0 dB, so the groups play as levelled', () => {
    expect([MIX.DRUMS_DB, MIX.BAND_DB, MIX.FEEDBACK_DB]).toEqual([0, 0, 0]);
  });
});
