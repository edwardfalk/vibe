import { test, expect } from '@playwright/test';

// The hum's level against the kick, as Edward heard them on the listening
// page (docs/superpowers/specs/2026-10-04-universe-hum-design.md). Each is
// rendered offline through the game's limiter, then a 250 Hz high-pass:
// laptop speakers play little below it. Both are measured over the same two
// bars, from WINDOW_SEC, once the hum's fades and its fight filter (2 s time
// constant) have settled. On the page's engine with Edward's settings the
// hum, dipping, measured 5.1 dB under the kick; with the level-5 layers and
// the filter fully open, 5.0 dB under (2026-10-04).
const HUM_UNDER_KICK_DB = -5;
const HUM_TOLERANCE_DB = 2;

test('the hum sits under the kick, quiet and on a full screen at level 5', async ({
  page,
}) => {
  // Any blank page on the test server will do; the speech gate's is one
  await page.goto('/tests/helpers/speech-gate.html');
  const levels = await page.evaluate(async () => {
    const { CONFIG } = await import('/js/config.js');
    const { BeatTrack, clickNoise } = await import('/js/audio/BeatTrack.js');
    const { Hum } = await import('/js/audio/Hum.js');
    const { createMasterLimiter } = await import('/js/Audio.js');
    const RATE = 44100;
    const BEAT_SEC = 0.5; // 120 BPM
    const BAR_SEC = 4 * BEAT_SEC;
    const WINDOW_SEC = 10; // five of the fight filter's time constants
    const END_SEC = WINDOW_SEC + 2 * BAR_SEC;
    const HIGHPASS_HZ = 250;
    const PASS_SEC = 0.025; // BeatTrack's scheduler interval

    // dB RMS of what play() sends into the limiter, inside the window
    async function rms(play) {
      const ctx = new OfflineAudioContext(
        1,
        Math.ceil(RATE * (END_SEC + 0.5)),
        RATE
      );
      const highpass = new BiquadFilterNode(ctx, {
        type: 'highpass',
        frequency: HIGHPASS_HZ,
        Q: 0.7,
      });
      highpass.connect(ctx.destination);
      const limiter = createMasterLimiter(ctx);
      limiter.connect(highpass);
      play(ctx, limiter);
      const data = (await ctx.startRendering()).getChannelData(0);
      let sum = 0;
      for (let i = WINDOW_SEC * RATE; i < END_SEC * RATE; i++) {
        sum += data[i] ** 2;
      }
      return 10 * Math.log10(sum / ((END_SEC - WINDOW_SEC) * RATE));
    }

    // The kick: eight over the two bars, through the beat track's volume
    const kick = await rms((ctx, out) => {
      const track = new BeatTrack({});
      track.ctx = ctx;
      track.masterGain = new GainNode(ctx, {
        gain: CONFIG.MIX.BEAT_TRACK_VOLUME,
      });
      track.masterGain.connect(out);
      track._noiseBuffer = clickNoise(ctx);
      for (let t = WINDOW_SEC; t < END_SEC; t += BEAT_SEC) track._playKick(t);
    });

    // The hum at a level and enemy count, as at run time: a sync every
    // scheduler pass (so the drift moves), a dip every beat, a bar every 4
    const hum = (level, enemies) =>
      rms((ctx, out) => {
        const h = new Hum(ctx, out);
        for (let t = 0; t < END_SEC; t += PASS_SEC) h.sync(t, level, enemies);
        for (let beat = 0; beat * BEAT_SEC < END_SEC; beat++) {
          h.dipAt(beat * BEAT_SEC);
          if (beat % 4 === 0) h.barAt(beat * BEAT_SEC, BAR_SEC);
        }
      });

    return {
      kick,
      quiet: await hum(1, 0),
      busy: await hum(5, CONFIG.PACING.MAX_ENEMIES_CAP),
    };
  });
  console.log('dB RMS above 250 Hz:', levels);
  expect(levels.quiet - levels.kick).toBeGreaterThanOrEqual(
    HUM_UNDER_KICK_DB - HUM_TOLERANCE_DB
  );
  expect(levels.quiet - levels.kick).toBeLessThanOrEqual(
    HUM_UNDER_KICK_DB + HUM_TOLERANCE_DB
  );
  expect(levels.busy).toBeLessThanOrEqual(levels.kick);
});

test('a bad root costs only the hum: the kick and the effects play on', async ({
  page,
}) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.waitForSelector('canvas', { state: 'attached' });
  // The game's own CONFIG (the same module URL), before a key starts the audio
  await page.evaluate(async () => {
    const { CONFIG } = await import('/js/config.js');
    CONFIG.HUM.ROOT = 'H';
  });
  await page.keyboard.press(' ');
  await page.waitForFunction(() => window.beatTrack?.isPlaying);
  await page.evaluate(() => {
    const track = window.beatTrack;
    const play = track._playKick.bind(track);
    window.kicksPlayed = 0;
    track._playKick = (time) => {
      play(time);
      window.kicksPlayed++; // counted only once it played without throwing
    };
  });
  // 120 BPM, four on the floor: 2 kicks a second
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => ({
    kicks: window.kicksPlayed,
    hum: window.audio.hum,
    enabled: window.audio.enabled,
  }));
  expect(after.kicks).toBeGreaterThanOrEqual(3);
  expect(after.hum).toBe(null);
  expect(after.enabled).toBe(true);
  // Audio's and the kick's, each logged once
  expect(errors.filter((e) => e.includes('The hum failed'))).toHaveLength(2);
});

// The dash and the frying became noise through a band-pass (audio PR 2).
// They keep their old saw's level against the kick, as laptop speakers hear
// it (loudest 50 ms above 250 Hz), measured on 59b8f7d
const NOISE_OVER_KICK_DB = { playerDash: 0.1, enemyFrying: 2.7 };
const NOISE_TOLERANCE_DB = 1.5;

test('the dash and the frying, now noise, keep their level against the kick', async ({
  page,
}) => {
  await page.goto('/tests/helpers/speech-gate.html');
  const overKick = await page.evaluate(async (names) => {
    Math.random = () => 0.5; // no random level or length
    const { CONFIG } = await import('/js/config.js');
    const { Audio } = await import('/js/Audio.js');
    const { SOUND_CONFIG } = await import('/js/audio/SoundConfig.js');
    const { BeatTrack, clickNoise } = await import('/js/audio/BeatTrack.js');
    const RATE = 44100;
    const AT = 0.05;
    const WINDOW = Math.round(RATE * 0.05);
    // dB of the loudest 50 ms that play() sends through a 250 Hz high-pass
    async function loudest(play) {
      const ctx = new OfflineAudioContext(1, RATE, RATE);
      const highpass = new BiquadFilterNode(ctx, {
        type: 'highpass',
        frequency: 250,
        Q: 0.7,
      });
      highpass.connect(ctx.destination);
      play(ctx, highpass);
      const data = (await ctx.startRendering()).getChannelData(0);
      let loud = 0;
      for (let i = 0; i + WINDOW <= data.length; i += WINDOW >> 2) {
        let sum = 0;
        for (let j = i; j < i + WINDOW; j++) sum += data[j] ** 2;
        loud = Math.max(loud, sum / WINDOW);
      }
      return 10 * Math.log10(loud);
    }
    const kick = await loudest((ctx, out) => {
      const track = new BeatTrack({});
      track.ctx = ctx;
      track.masterGain = new GainNode(ctx, {
        gain: CONFIG.MIX.BEAT_TRACK_VOLUME,
      });
      track.masterGain.connect(out);
      track._noiseBuffer = clickNoise(ctx);
      track._playKick(AT);
    });
    const over = {};
    for (const name of names) {
      const level = await loudest((ctx, out) => {
        const audio = Object.assign(Object.create(Audio.prototype), {
          audioContext: ctx,
          masterGain: out,
          effects: { reverb: null },
          player: { x: 0, y: 0 },
          context: null,
        });
        audio.playTone(SOUND_CONFIG[name], null, null, name);
      });
      over[name] = level - kick;
    }
    return over;
  }, Object.keys(NOISE_OVER_KICK_DB));
  console.log('noise over the kick, dB:', overKick);
  for (const [name, db] of Object.entries(NOISE_OVER_KICK_DB)) {
    expect(overKick[name], name).toBeGreaterThanOrEqual(
      db - NOISE_TOLERANCE_DB
    );
    expect(overKick[name], name).toBeLessThanOrEqual(db + NOISE_TOLERANCE_DB);
  }
});
