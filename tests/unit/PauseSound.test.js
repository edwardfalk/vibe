import { describe, it, expect, vi, afterEach } from 'vitest';
import { Audio } from '../../js/Audio.js';
import { CONFIG } from '../../js/config.js';

// An Audio with a fake context and speech engine, no browser needed
function fakeAudio() {
  const ctx = {
    state: 'running',
    suspend: vi.fn(async () => {
      ctx.state = 'suspended';
    }),
    resume: vi.fn(async () => {
      ctx.state = 'running';
    }),
  };
  const audio = Object.assign(Object.create(Audio.prototype), {
    audioContext: ctx,
    initialized: true,
    enabled: true,
    speechEnabled: true,
    initialize() {},
    voicebox: { failed: null, say: vi.fn(), cancelPending: vi.fn() },
    // As the constructor sets them
    _pausedByGame: false,
    _resuming: false,
    lastSpeechTime: { player: 0, enemies: 0 },
  });
  return { audio, ctx };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  CONFIG.SOUND_WHILE_PAUSED = false;
});

describe('pausing the game', () => {
  it('stops its sound, a line being spoken too, then starts it again on unpause', async () => {
    const { audio, ctx } = fakeAudio();
    audio.syncPause(true);
    audio.syncPause(true); // every frame: it acts once
    await Promise.resolve();
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
    // The suspended context holds a line mid-word; it finishes on unpause
    expect(audio.voicebox.cancelPending).not.toHaveBeenCalled();
    expect(audio.soundPaused).toBe(true);
    audio.syncPause(false);
    audio.syncPause(false);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    await settle();
    expect(audio.soundPaused).toBe(false);
  });

  it('holds the sky until the sound is really back, and quick presses end on the last', async () => {
    const { audio, ctx } = fakeAudio();
    let finishResume;
    ctx.resume = vi.fn(
      () =>
        new Promise((r) => {
          finishResume = r;
        })
    );
    audio.syncPause(true);
    audio.syncPause(false); // P, then P again before the context is back
    expect(audio.soundPaused).toBe(true);
    finishResume();
    await settle();
    expect(audio.soundPaused).toBe(false);
    // P P P: suspend, resume, suspend, in that order, and it ends held
    audio.syncPause(true);
    audio.syncPause(false);
    audio.syncPause(true);
    finishResume();
    await settle();
    expect(ctx.suspend).toHaveBeenCalledTimes(3);
    expect(audio.soundPaused).toBe(true);
    expect(audio.ensureAudioContext()).toBe(false);
  });

  it('keeps the sound playing with SOUND_WHILE_PAUSED, even if ticked mid-pause', () => {
    const { audio, ctx } = fakeAudio();
    CONFIG.SOUND_WHILE_PAUSED = true;
    audio.syncPause(true);
    expect(ctx.suspend).not.toHaveBeenCalled();
    CONFIG.SOUND_WHILE_PAUSED = false;
    audio.syncPause(true);
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
    CONFIG.SOUND_WHILE_PAUSED = true; // ticked in ?tune while paused
    audio.syncPause(true);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it("doesn't let a sound or a line during the pause restart the audio", async () => {
    const { audio, ctx } = fakeAudio();
    audio.syncPause(true);
    await Promise.resolve();
    expect(audio.ensureAudioContext()).toBe(false);
    expect(audio.speak(null, 'Kill human!', 'grunt', true)).toBe(false);
    expect(ctx.resume).not.toHaveBeenCalled();
    expect(audio.voicebox.say).not.toHaveBeenCalled();
  });

  it('keeps a sound or a line made while the audio comes back, for when it is', async () => {
    const { audio, ctx } = fakeAudio();
    audio.getContextValue = () => null;
    audio.voicebox.say = vi.fn(async () => ({ dropped: 'cancelled' }));
    // Each resume() settles when the context is back (a sound asks too)
    const pending = [];
    ctx.resume = vi.fn(() => new Promise((r) => pending.push(r)));
    audio.syncPause(true);
    await Promise.resolve();
    audio.syncPause(false); // the first frame after P: still suspended
    expect(ctx.state).toBe('suspended');
    expect(audio.ensureAudioContext()).toBe(true);
    expect(audio.speak(null, 'TIMEBOMB!', 'player', true)).toBe(true);
    expect(audio.voicebox.say).toHaveBeenCalledTimes(1);
    ctx.state = 'running';
    pending.forEach((r) => r());
    await settle();
    expect(audio.soundPaused).toBe(false);
    expect(audio.ensureAudioContext()).toBe(true);
  });

  it('does nothing before the audio has started', () => {
    const { audio } = fakeAudio();
    audio.audioContext = null;
    expect(() => audio.syncPause(true)).not.toThrow();
    expect(audio.soundPaused).toBe(false);
  });
});
