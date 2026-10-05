import { describe, it, expect, vi } from 'vitest';
import { Audio } from '../../js/Audio.js';
import { CONFIG } from '../../js/config.js';
import {
  drawActiveTexts,
  updateActiveTexts,
} from '../../js/audio/TextDisplay.js';
import { transformP5 } from './helpers/transformP5.js';
import { Grunt } from '../../js/entities/Grunt.js';

// No beat track: mute and the mix reach for window.beatTrack
vi.stubGlobal('window', {});

// The game's Audio with running audio and a stand-in Voicebox whose say()
// resolves `line`. The hero stands at 0,0; the clock is the beat clock.
function speakingAudio(line = { startsAt: 10.25, duration: 0.8 }) {
  const clock = { beatInterval: 500 };
  const voicebox = {
    failed: null,
    output: { gain: { value: 1 } },
    say: vi.fn(async () => line),
    cancelPending: vi.fn(),
    isSpeaking: vi.fn(() => false),
  };
  const audio = new Audio(null, { x: 0, y: 0 }, { beatClock: clock });
  Object.assign(audio, {
    audioContext: { state: 'running', currentTime: 10.15 },
    initialized: true,
    voicebox,
  });
  return { audio, voicebox, clock };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('Audio.speak', () => {
  it('says the line through the voicebox, from where the speaker is, on the beat clock', () => {
    const { audio, voicebox, clock } = speakingAudio();
    const grunt = { x: 300, y: 0 };
    expect(audio.speak(grunt, 'Kill human!', 'grunt')).toBe(true);
    expect(voicebox.say).toHaveBeenCalledWith('grunt', 'Kill human!', {
      gain: 0.7, // 300 px off: 1 - 0.5 × 0.6
      pan: 0.75, // 300 / 400 to the right
      clock,
    });
  });

  it('far off, a speaker is still heard at the distance floor', () => {
    const { audio, voicebox } = speakingAudio();
    audio.speak({ x: -5000, y: 0 }, 'Kill human!', 'grunt');
    expect(voicebox.say.mock.calls[0][2]).toMatchObject({
      gain: CONFIG.MIX.SPEECH_DISTANCE_FLOOR,
      pan: -1,
    });
  });

  it('a line without a speaker comes from the hero', async () => {
    const { audio, voicebox } = speakingAudio();
    audio.speak(null, 'TIMEBOMB!', 'player', true);
    expect(voicebox.say.mock.calls[0][2]).toMatchObject({ gain: 1, pan: 0 });
    await settle();
    expect(audio.activeTexts[0].entity).toBe(audio.player);
  });

  it('shows the bubble as the line starts, for as long as it is spoken', async () => {
    const { audio } = speakingAudio({ startsAt: 10.25, duration: 2 });
    audio.speak({ x: 0, y: 0 }, 'Kill human!', 'grunt');
    expect(audio.activeTexts).toHaveLength(0); // not before it is scheduled
    await settle();
    expect(audio.activeTexts[0]).toMatchObject({
      text: 'KILL HUMAN!',
      voiceType: 'grunt',
      showsAt: 10.25, // as its line starts, 0.1 s ahead
      timer: 120,
    });
  });

  it('a short line still shows for 1.5 s', async () => {
    const { audio } = speakingAudio({ startsAt: 10.15, duration: 0.2 });
    audio.speak({ x: 0, y: 0 }, 'ow', 'grunt', true);
    await settle();
    expect(audio.activeTexts[0]).toMatchObject({ showsAt: 10.15, timer: 90 });
  });

  it("a line that won't play shows its bubble now; a cancelled one, none", async () => {
    for (const dropped of ['late', 'failed']) {
      const { audio } = speakingAudio({ dropped });
      // Six words at 150 a minute: 2.4 s
      audio.speak({ x: 0, y: 0 }, 'one two three four five six', 'tank');
      await settle();
      expect(audio.activeTexts[0]).toMatchObject({ showsAt: null, timer: 144 });
    }
    // A short one still shows for 1.5 s
    const short = speakingAudio({ dropped: 'late' }).audio;
    short.speak({ x: 0, y: 0 }, 'ow', 'grunt', true);
    await settle();
    expect(short.activeTexts[0]).toMatchObject({ showsAt: null, timer: 90 });
    const { audio } = speakingAudio({ dropped: 'cancelled' });
    audio.speak({ x: 0, y: 0 }, 'Kill human!', 'grunt');
    await settle();
    expect(audio.activeTexts).toHaveLength(0);
  });

  it('a line dropped as late says so in the console, once per line', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { audio } = speakingAudio({ dropped: 'late' });
    audio.speak({ x: 0, y: 0 }, 'Kill human!', 'grunt');
    await settle();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0].join(' ')).toContain('Kill human!');
    warn.mockRestore();
  });

  it('keeps the chatter cooldown, unless forced', () => {
    const { audio, voicebox } = speakingAudio();
    expect(audio.speak({ x: 0, y: 0 }, 'one', 'grunt')).toBe(true);
    expect(audio.speak({ x: 0, y: 0 }, 'two', 'grunt')).toBe(false);
    expect(audio.speak({ x: 0, y: 0 }, '3', 'player', true)).toBe(true);
    expect(voicebox.say.mock.calls.map((c) => c[1])).toEqual(['one', '3']);
  });

  it('refuses a line, untaken and unshown, without speech to say it', () => {
    const cases = {
      muted: (a) => (a.speechEnabled = false),
      paused: (a) => (a._pausedByGame = true),
      'speech is off': (a) => (a.voicebox.failed = new Error('gone')),
      'no voicebox': (a) => (a.voicebox = null),
      'audio not running': (a) => (a.audioContext.state = 'suspended'),
    };
    for (const [name, apply] of Object.entries(cases)) {
      const { audio, voicebox } = speakingAudio();
      audio.audioContext.resume = async () => {};
      apply(audio);
      expect(audio.speak({ x: 0, y: 0 }, 'ow', 'grunt', true), name).toBe(
        false
      );
      expect(voicebox.say, name).not.toHaveBeenCalled();
      // A refused line doesn't start the cooldown, nor show a bubble
      expect(audio.lastSpeechTime, name).toBe(0);
      expect(audio.activeTexts, name).toHaveLength(0);
    }
    const { audio } = speakingAudio();
    expect(audio.speak({ x: 0, y: 0 }, '', 'grunt', true)).toBe(false);
  });

  it("with speech off, a grunt's ow plays its sound instead", () => {
    const { audio } = speakingAudio();
    audio.voicebox.failed = new Error('gone');
    audio.playSound = vi.fn();
    Grunt.prototype.sayOw.call({ x: 5, y: 7 }, audio);
    expect(audio.playSound).toHaveBeenCalledWith('gruntOw', 5, 7);
  });
});

describe("Audio's speech engines", () => {
  it('start loading on the title screen, and its Voicebox takes the worker over', () => {
    globalThis.Worker = class {
      posted = [];
      postMessage(message) {
        this.posted.push(message);
      }
    };
    try {
      const audio = new Audio(null, { x: 0, y: 0 }, {});
      expect(audio.speechWorker.posted).toEqual([{ id: 0, type: 'variants' }]);
      const worker = audio.speechWorker;
      const ctx = { createGain: () => ({ gain: { value: 1 } }) };
      expect(audio.createVoicebox(ctx).worker).toBe(worker);
      // Once: a retried initialize() makes its own, not a second owner
      expect(audio.speechWorker).toBeNull();
      expect(audio.createVoicebox(ctx).worker).not.toBe(worker);
    } finally {
      delete globalThis.Worker;
    }
  });

  it('without a Worker (Node), its Voicebox makes its own and reports why not', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const audio = new Audio(null, { x: 0, y: 0 }, {});
    expect(audio.speechWorker).toBeNull();
    const ctx = { createGain: () => ({ gain: { value: 1 } }) };
    expect(audio.createVoicebox(ctx).failed).toBeInstanceOf(ReferenceError);
  });
});

describe("Audio's bubbles", () => {
  it('wait for their line by its audio clock', () => {
    const { audio } = speakingAudio();
    audio.showText({ x: 0, y: 0 }, 'FIRE!', 'tank', 90, 10.25);
    audio.updateTexts(); // at 10.15: still waiting
    expect(audio.activeTexts[0].timer).toBe(90);
    audio.audioContext.currentTime = 10.26;
    audio.updateTexts();
    expect(audio.activeTexts[0].timer).toBe(89);
  });

  it("wait out a pause that stopped the clock at their line's start", () => {
    const { audio } = speakingAudio();
    audio.audioContext.state = 'suspended';
    // Ready during the pause, inside the on-beat window: it starts at once,
    // where the suspended clock stands, so it is heard after the pause
    audio.showText({ x: 0, y: 0 }, 'FIRE!', 'tank', 90, 10.15);
    audio.updateTexts();
    audio.updateTexts();
    expect(audio.activeTexts[0].timer).toBe(90);
    audio.audioContext.currentTime = 10.17; // unpaused
    audio.updateTexts();
    expect(audio.activeTexts[0].timer).toBe(89);
  });
});

describe("Audio's speech mix", () => {
  const duck = () => ({
    gain: { cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() },
  });

  it('ducks while the voicebox says someone speaks, capped from the line start', () => {
    const { audio, voicebox } = speakingAudio();
    Object.assign(audio, { duckGain: duck(), beatDuckGain: duck() });
    voicebox.isSpeaking.mockReturnValue(true);
    audio.syncDuck();
    expect(voicebox.isSpeaking).toHaveBeenCalledWith(
      CONFIG.MIX.DUCK_MAX_HOLD_MS / 1000
    );
    expect(audio._ducked).toBe(true);
    voicebox.isSpeaking.mockReturnValue(false);
    audio.syncDuck();
    expect(audio._ducked).toBe(false);
  });

  it('mute silences speech, drops what waits to start and its bubble, and releases the duck', () => {
    const { audio, voicebox } = speakingAudio();
    Object.assign(audio, { duckGain: duck(), beatDuckGain: duck() });
    // At 10.15: one bubble showing, one waiting for its line at 10.25
    audio.showText({ x: 0, y: 0 }, 'NOW', 'grunt', 90, 10);
    audio.showText({ x: 0, y: 0 }, 'SOON', 'grunt', 90, 10.25);
    voicebox.isSpeaking.mockReturnValue(true);
    audio.applyMix();
    expect(voicebox.output.gain.value).toBe(CONFIG.MIX.SPEECH_VOLUME);
    audio.syncDuck();
    audio.toggle();
    expect(voicebox.output.gain.value).toBe(0);
    expect(voicebox.cancelPending).toHaveBeenCalledTimes(1);
    expect(audio.activeTexts.map((t) => t.text)).toEqual(['NOW']);
    audio.syncDuck();
    expect(audio._ducked).toBe(false);
    audio.toggle();
    expect(voicebox.output.gain.value).toBe(CONFIG.MIX.SPEECH_VOLUME);
    expect(voicebox.cancelPending).toHaveBeenCalledTimes(1);
  });
});

describe('a bubble that waits for its line', () => {
  // Each frame updates, then draws (GameLoop.js); the audio clock runs on
  // its own, through hitstop and slow frames
  it('shows once the audio clock passes its start, and only then counts down', () => {
    const texts = [{ text: 'FIRE!', timer: 2, showsAt: 1, x: 0, y: 0 }];
    const { p, calls } = transformP5();
    const drawn = () => calls.filter(([k]) => k === 'text').map(([, t]) => t);
    const frame = (now) => {
      updateActiveTexts(texts, now);
      drawActiveTexts(p, texts, false, 0, 0, null, now);
    };
    frame(0.9);
    frame(0.99);
    expect(drawn()).toEqual([]);
    expect(texts[0].timer).toBe(2);
    frame(1); // its line's start: the clock may stand there (a pause)
    expect(drawn()).toEqual([]);
    frame(1.01); // past it: its line is being heard
    expect(drawn()).toEqual(['FIRE!']);
    expect(texts[0].timer).toBe(1);
    frame(1.03);
    expect(texts).toEqual([]); // its two frames are up
  });

  it('shows at once without a start, or without an audio clock', () => {
    const texts = [
      { text: 'A', timer: 5, showsAt: null, x: 0, y: 0 },
      { text: 'B', timer: 5, showsAt: 99, x: 0, y: 0 },
    ];
    const { p, calls } = transformP5();
    const drawn = () => calls.filter(([k]) => k === 'text').map(([, t]) => t);
    updateActiveTexts(texts, 0);
    drawActiveTexts(p, texts, false, 0, 0, null, 0);
    expect(drawn()).toEqual(['A']);
    updateActiveTexts(texts); // no audio clock: every bubble shows
    drawActiveTexts(p, texts, false, 0, 0, null);
    expect(drawn()).toEqual(['A', 'A', 'B']);
  });
});
