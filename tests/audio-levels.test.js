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
const HERO_UNDER_KICK_DB = -4;
const HERO_TOLERANCE_DB = 1.5;

test("the hum and the hero's shots sit under the kick, the hum quiet and on a full screen at level 5", async ({
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

    // Each hero shot as the page played it: held fire on all 16 eighths of
    // the window, accents on, softening off
    const { heroShot, HERO_SHOT_SOUNDS } =
      await import('/js/audio/Instruments.js');
    const { SOUND_CONFIG } = await import('/js/audio/SoundConfig.js');
    const heroes = {};
    const saved = { ...CONFIG.HERO_SHOT };
    // The page's conditions: no softening, no level offset of Edward's
    CONFIG.HERO_SHOT.SOFTEN_SHOTS = 0;
    CONFIG.HERO_SHOT.LEVEL_DB = 0;
    for (const sound of HERO_SHOT_SOUNDS) {
      CONFIG.HERO_SHOT.SOUND = sound;
      heroes[sound] = await rms((ctx, out) => {
        for (let n = 0; n < 16; n++) {
          heroShot(ctx, out, SOUND_CONFIG.playerShoot, {
            volume: 1,
            pan: 0,
            at: WINDOW_SEC + (n * BEAT_SEC) / 2,
            eighth: n,
          });
        }
      });
    }
    Object.assign(CONFIG.HERO_SHOT, saved);

    return {
      kick,
      quiet: await hum(1, 0),
      busy: await hum(5, CONFIG.PACING.MAX_ENEMIES_CAP),
      heroes,
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
  // Each hero shot where Edward judged it on the listening page: about 4 dB
  // under the kick (the page measured -37.2 dB against the kick's -33)
  for (const [sound, level] of Object.entries(levels.heroes)) {
    expect(level - levels.kick, sound).toBeGreaterThanOrEqual(
      HERO_UNDER_KICK_DB - HERO_TOLERANCE_DB
    );
    expect(level - levels.kick, sound).toBeLessThanOrEqual(
      HERO_UNDER_KICK_DB + HERO_TOLERANCE_DB
    );
  }
});

test('a bad root costs only the hum and the pitched sounds: the kick plays on', async ({
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
          getContextValue: () => undefined, // no beat clock: now
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

// Copies of one sound started in one frame (grunts firing together on 2 or
// 4, on one note) must not add in phase: four in phase are 12 dB over one,
// four at random phases 6 dB on average. Each grunt's seed spreads his copy
// (Audio.playSynth). Averaged over many volleys, so chance alignment in one
// can't fail it
test('a volley of four grunt shots in one frame adds like random phases, not in phase', async ({
  page,
}) => {
  await page.goto('/tests/helpers/speech-gate.html');
  const overOne = await page.evaluate(async () => {
    const { Audio } = await import('/js/Audio.js');
    const { SOUND_CONFIG } = await import('/js/audio/SoundConfig.js');
    const RATE = 44100;
    const VOLLEYS = 64;
    const GAP_SEC = 0.25; // longer than the shot
    async function energy(copies) {
      const ctx = new OfflineAudioContext(
        1,
        Math.ceil(RATE * (VOLLEYS * GAP_SEC + 0.5)),
        RATE
      );
      // playSynth reads the clock from its context: this one says when
      const clock = { t: 0 };
      const timed = new Proxy(ctx, {
        get: (target, key) =>
          key === 'currentTime'
            ? clock.t
            : typeof target[key] === 'function'
              ? target[key].bind(target)
              : target[key],
      });
      const audio = Object.assign(Object.create(Audio.prototype), {
        audioContext: timed,
        masterGain: ctx.destination,
        effects: { reverb: null },
        player: { x: 0, y: 0 },
        context: null,
        getContextValue: () => undefined,
      });
      // Each volley's grunts are new ones on one note: fresh seeds from the
      // half that picks it (Grunt.shotNote)
      for (let v = 0; v < VOLLEYS; v++) {
        clock.t = v * GAP_SEC;
        for (let c = 0; c < copies; c++) {
          audio.playSynth(SOUND_CONFIG.alienShoot, null, null, {
            note: ['b3', 5],
            seed: Math.random() * 0.5,
          });
        }
      }
      const data = (await ctx.startRendering()).getChannelData(0);
      let sum = 0;
      for (const x of data) sum += x * x;
      return sum;
    }
    return 10 * Math.log10((await energy(4)) / (await energy(1)));
  });
  console.log('four grunt shots over one, dB:', overOne);
  expect(overOne).toBeGreaterThan(4);
  expect(overOne).toBeLessThan(8);
});

// The band's instruments (audio PR 3) at the levels Edward heard on the
// listening page: each matched there to the sound it replaced by
// measure.mjs (docs/superpowers/specs/2026-10-09-band-studies), so each is
// measured as it was: alone, centred, at volume 1, with no limiter, the
// loudest 50 ms through a 250 Hz high-pass, the loudest of the page's
// arguments. The targets are today's sounds measured that way on d677cd7;
// the fuse replaced silence, so it matches the grunt's shot. Each lands on
// its target plus its knob's default
const BAND_TARGET_DB = {
  gruntShot: -23.4,
  tankShot: -13.7,
  tankCharge: -19.5,
  gruntChatter: -22.9,
  rusherFuse: -23.4,
};
const BAND_TOLERANCE_DB = 1.5;

test("the band's instruments sit at the levels Edward heard on the page", async ({
  page,
}) => {
  await page.goto('/tests/helpers/speech-gate.html');
  const levels = await page.evaluate(async () => {
    const { CONFIG } = await import('/js/config.js');
    const { SYNTHS } = await import('/js/audio/Instruments.js');
    const RATE = 44100;
    const AT = 0.05;
    const WINDOW = Math.round(RATE * 0.05);
    // dB of the loudest 50 ms that play() sends through a 250 Hz high-pass
    async function loudest(play) {
      const ctx = new OfflineAudioContext(1, 2 * RATE, RATE);
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
    // Each sound: its synth, its ?tune choice, its knob, the page's arguments
    const steps = (list, steps) => list.map((step) => ({ step, steps }));
    const SOUNDS = {
      'gruntShot stab': [
        'gruntShot',
        { GRUNT_SHOT: 'stab' },
        'GRUNT_SHOT_DB',
        [{ note: ['b3', 5] }],
      ],
      'gruntShot zap': [
        'gruntShot',
        { GRUNT_SHOT: 'zap' },
        'GRUNT_SHOT_DB',
        [{ note: ['b3', 5] }],
      ],
      tankShot: ['tankShot', {}, 'TANK_SHOT_DB', [{}]],
      tankCharge: ['tankCharge', {}, 'CHARGE_DB', steps([0, 3, 7], 8)],
      'gruntChatter whine': [
        'gruntChatter',
        { CHATTER: 'both' },
        'CHATTER_DB',
        [{ voice: 'whine' }],
      ],
      'gruntChatter squeak': [
        'gruntChatter',
        { CHATTER: 'both' },
        'CHATTER_DB',
        [{ voice: 'squeak' }],
      ],
      rusherFuse: [
        'rusherFuse',
        {},
        'FUSE_DB',
        [3, 2, 1].map((left) => ({ left })),
      ],
    };
    const saved = { ...CONFIG.BAND };
    const out = {};
    for (const [name, [synth, band, knob, args]] of Object.entries(SOUNDS)) {
      Object.assign(CONFIG.BAND, band);
      let level = -Infinity;
      for (const a of args) {
        level = Math.max(
          level,
          await loudest((ctx, o) =>
            SYNTHS[synth](ctx, o, {}, { volume: 1, pan: 0, at: AT, ...a })
          )
        );
      }
      out[name] = { synth, level, knobDb: saved[knob] };
      Object.assign(CONFIG.BAND, saved);
    }
    return out;
  });
  console.log(
    'band levels, dB:',
    Object.fromEntries(
      Object.entries(levels).map(([n, l]) => [n, +l.level.toFixed(1)])
    )
  );
  for (const [name, { synth, level, knobDb }] of Object.entries(levels)) {
    const want = BAND_TARGET_DB[synth] + knobDb;
    expect(level, name).toBeGreaterThanOrEqual(want - BAND_TOLERANCE_DB);
    expect(level, name).toBeLessThanOrEqual(want + BAND_TOLERANCE_DB);
  }
});
