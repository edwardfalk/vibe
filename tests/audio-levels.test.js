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
      busy: await hum(5, CONFIG.HUM.FULL_SCREEN_ENEMIES),
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

// Copies of one sound started in one frame (grunts firing together on 2 or
// 4, on one note) must not add in phase: four in phase are 12 dB over one,
// four at random phases 6 dB on average. Each grunt's seed spreads his copy
// (Audio.playSynth). Averaged over many volleys, so chance alignment in one
// can't fail it
// Grunt shots in one frame: four at full level add like random phases, not
// in phase; a swarm's volley (GruntSwarm.settle), each of its n shots at the
// swarm's gain, carries about one shot's energy, averaged over volleys
const VOLLEY_TOLERANCE_DB = 1;
test("grunt volleys: four shots add like random phases; a swarm's 2, 3 or 4 carry about one shot's energy", async ({
  page,
}) => {
  await page.goto('/tests/helpers/speech-gate.html');
  const overOne = await page.evaluate(async () => {
    const { Audio } = await import('/js/Audio.js');
    const { SOUND_CONFIG } = await import('/js/audio/SoundConfig.js');
    const { GruntSwarm } = await import('/js/systems/GruntSwarm.js');
    const RATE = 44100;
    const VOLLEYS = 64;
    const GAP_SEC = 0.25; // longer than the shot
    // The gain its own settle() gives a volley of n
    const gainFor = (n) => {
      const swarm = new GruntSwarm({ size: n, x: 0, y: 0 });
      const picks = Array.from({ length: n }, () => ({
        warnedOnBeat: 0,
        lineBlocked: () => false,
      }));
      swarm.settle(picks, 1);
      return swarm.volleyGain;
    };
    // Each volley's grunts are new ones: fresh seeds, each his own note by
    // his seed (Grunt.shotNote), from the half that picks the minor third
    // unless `bothNotes`
    async function energy(copies, { gain = 1, bothNotes = false } = {}) {
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
      const out = ctx.destination;
      const audio = Object.assign(Object.create(Audio.prototype), {
        audioContext: timed,
        masterGain: out,
        buses: { drums: out, band: out, feedback: out },
        effects: { reverb: null },
        player: { x: 0, y: 0 },
        context: null,
        getContextValue: () => undefined,
      });
      for (let v = 0; v < VOLLEYS; v++) {
        clock.t = v * GAP_SEC;
        for (let c = 0; c < copies; c++) {
          const seed = Math.random() * (bothNotes ? 1 : 0.5);
          audio.playSynth(SOUND_CONFIG.alienShoot, null, null, {
            note: seed < 0.5 ? ['b3', 5] : ['5', 5],
            seed,
            gain,
          });
        }
      }
      const data = (await ctx.startRendering()).getChannelData(0);
      let sum = 0;
      for (const x of data) sum += x * x;
      return sum;
    }
    const dB = (a, b) => 10 * Math.log10(a / b);
    const four = dB(await energy(4), await energy(1));
    const one = await energy(1, { bothNotes: true });
    const volley = {};
    for (const n of [2, 3, 4]) {
      volley[n] = dB(
        await energy(n, { gain: gainFor(n), bothNotes: true }),
        one
      );
    }
    return { four, volley };
  });
  console.log('grunt shots over one, dB:', overOne);
  expect(overOne.four).toBeGreaterThan(4);
  expect(overOne.four).toBeLessThan(8);
  for (const [n, db] of Object.entries(overOne.volley)) {
    expect(Math.abs(db), `${n} shots`).toBeLessThanOrEqual(VOLLEY_TOLERANCE_DB);
  }
});

// The mix pass (docs/superpowers/specs/2026-10-10-mix-pass-design.md): each
// sound sits in its group's window against the kick, by the loudest 50 ms
// through a 250 Hz high-pass (laptop speakers play little below it). Each
// is rendered alone, before the limiter, centred and near, the group knobs
// at 0 and every other knob at its default, Math.random at 0.5, in the
// default key, the band's dB knobs at 0; the kick in the same run. Where in
// a 128-frame render block a sound starts moves some by up to 2.3 dB (the
// kick most), and in play
// they start anywhere: each level is its mean over START_FRAMES. A group's
// offset, and a band sound's dB knob, are Edward's by ear on top: the
// windows check the levelling inside each group
const WINDOWS_DB = {
  drums: [0, 3],
  band: [-3, 3],
  frequent: [-6, 0],
  events: [0, 6],
};
const WINDOW_TOLERANCE_DB = 0.5;
// The tank's charge rises over its eight steps, more than a window: its top
// step sits in the band's, and the whole charge keeps its rise
const CHARGE_RISE_DB = 8.6;
// Where each render starts: through one render block, after a first one
const START_FRAMES = [0, 16, 32, 48, 64, 80, 96, 112].map((f) => 128 + f);
const WINDOW_TEST_MS = 120000;

// Every case of every sound in `tiers`, in dB over the kick
async function overKick(page, tiers) {
  await page.goto('/tests/helpers/speech-gate.html');
  return page.evaluate(
    async ([tiers, startFrames]) => {
      Math.random = () => 0.5;
      const { CONFIG } = await import('/js/config.js');
      const { Audio } = await import('/js/Audio.js');
      const { BeatTrack, clickNoise } = await import('/js/audio/BeatTrack.js');
      const { SOUND_CONFIG } = await import('/js/audio/SoundConfig.js');
      const { bangSound } = await import('/js/audio/BombSounds.js');
      const {
        tankAir,
        plateClang,
        gruntPop,
        lastBreath,
        STABBER_DEATH_SOUNDS,
      } = await import('/js/audio/DeathSounds.js');
      const { stabberDeathRecord } =
        await import('/js/entities/StabberDeath.js');
      const { crashNoise } = await import('/js/audio/CrashSynth.js');
      const { STRING_PARTS } = await import('/js/audio/StabberStrings.js');
      const { airTiming, airDarts } = await import('/js/entities/TankDeath.js');
      const { GRUNT_CHORD } =
        await import('/js/systems/combat/EnemyDeathHandler.js');
      // Edward's dB knobs on the band's sounds, at 0 (this page is the test's)
      for (const knob of Object.keys(CONFIG.BAND)) {
        if (knob.endsWith('_DB')) CONFIG.BAND[knob] = 0;
      }
      const RATE = 44100;
      const WINDOW = Math.round(RATE * 0.05);
      let AT = 0; // the start of the render under way (loudest)
      // The loudest 50 ms of play() started at `at`, as energy
      async function loudestAt(play, sec, at) {
        AT = at;
        const ctx = new OfflineAudioContext(
          1,
          Math.ceil(RATE * (at + sec)),
          RATE
        );
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
        return loud;
      }
      // dB of its loudest 50 ms, the mean over the start frames
      async function loudest(play, sec = 2) {
        let sum = 0;
        for (const f of startFrames)
          sum += await loudestAt(play, sec, f / RATE);
        return 10 * Math.log10(sum / startFrames.length);
      }
      // The game's Audio on one context, every bus straight to `out`, playing
      // at the render's start
      const gameAudio = (ctx, out) => {
        const audio = Object.assign(Object.create(Audio.prototype), {
          audioContext: ctx,
          masterGain: out,
          buses: { drums: out, band: out, feedback: out },
          effects: { reverb: null },
          player: { x: 0, y: 0 },
          context: null,
          getContextValue: () => undefined,
          beatTiming: () => ({ now: AT, at: AT, eighth: 0, game: AT }),
        });
        audio.createEffects(); // the ambient sounds' reverb
        return audio;
      };
      const preset =
        (name, opts = null) =>
        (ctx, out) => {
          const audio = gameAudio(ctx, out);
          const config = SOUND_CONFIG[name];
          if (config.synth) audio.playSynth(config, null, null, opts);
          else audio.playTone(config, null, null, name, opts);
        };
      const withBand = (band, play) => (ctx, out) => {
        const saved = { ...CONFIG.BAND };
        Object.assign(CONFIG.BAND, band);
        try {
          play(ctx, out);
        } finally {
          Object.assign(CONFIG.BAND, saved);
        }
      };
      const S = CONFIG.STABBER;
      const strings = (part, volume) => (ctx, out) =>
        STRING_PARTS[part](ctx, out, {
          at: AT,
          untilSec: 0.5,
          beatSec: 0.5,
          volume,
          pan: 0,
          noise: crashNoise(ctx),
          offset: 0,
        });
      const hits = (name) => ({
        [`${name} full`]: preset(name, { health: 10, maxHealth: 10 }),
        [`${name} last`]: preset(name, { health: 1, maxHealth: 10 }),
      });
      const steps = CONFIG.TANK.CHARGE_BEATS;
      // Each case is its play, or [play, seconds]; the tiers' members are the
      // spec's section 1
      // A stabber's death in `style`, on the grid at AT, as the game plays it
      const stabberDeath = (ctx, out, style, hot) =>
        STABBER_DEATH_SOUNDS[style](ctx, out, {
          at: AT,
          record: stabberDeathRecord({
            style,
            linger: CONFIG.DEATHS.LINGER,
            beatSec: 0.5,
            origin: AT,
            at: AT,
            pose: {
              t: 0,
              beatSec: 0.5,
              beats: 0,
              eighth: 0,
              kick: 0,
              aim: 0,
              toHero: 0,
              vx: 0,
              vy: 0,
              age: 1,
              windup: null,
              lunge: hot ? { k: 0.2 } : null,
              recover: null,
              stunned: null,
              hit: 0,
              hitAge: Infinity,
              hitDir: 0,
              push: 0,
              seed: 0.5,
              reach: 42,
            },
            scale: 1,
            dir: 0,
            blast: false,
            seed: 0.5,
          }),
          noise: crashNoise(ctx),
          volume: CONFIG.DEATHS.STABBER_VOLUME,
          pan: 0,
        });
      const CASES = {
        drums: { rusherCrash: preset('rusherCrash') },
        band: {
          ...Object.fromEntries(
            ['stab', 'zap'].flatMap((shot) =>
              [
                ['b3', 5],
                ['5', 5],
              ].map((note) => [
                `alienShoot ${shot} ${note[0]}`,
                withBand({ GRUNT_SHOT: shot }, preset('alienShoot', { note })),
              ])
            )
          ),
          tankShot: preset('tankShot'),
          'tankCharge top': preset('tankCharge', { step: steps - 1, steps }),
          ...Object.fromEntries(
            ['whine', 'squeak'].map((voice) => [
              `gruntChatter ${voice}`,
              withBand({ CHATTER: 'both' }, preset('gruntChatter', { voice })),
            ])
          ),
          ...Object.fromEntries(
            [3, 2, 1].map((left) => [
              `rusherFuse ${left}`,
              preset('rusherFuse', { left }),
            ])
          ),
          ...Object.fromEntries(
            [
              'rusherCharge',
              'gruntAdvance',
              'gruntRetreat',
              'gruntResponse',
              'tankResponse',
              'stabberResponse',
              'rusherResponse',
            ].map((name) => [name, preset(name)])
          ),
          'strings tremolo': strings('tremolo', S.TREMOLO_VOLUME),
          'strings stab': strings('stab', S.STAB_VOLUME),
          'strings screech': strings('screech', S.STAB_VOLUME),
          'strings pluck': strings('pluck', S.PLUCK_VOLUME),
        },
        frequent: {
          ...hits('gruntHit'),
          ...hits('tankHit'),
          ...hits('stabberHit'),
          ...hits('rusherHit'),
          ...hits('tankPlateHit'),
          plateClang: (ctx, out) =>
            plateClang(ctx, out, {
              at: AT,
              noise: crashNoise(ctx),
              volume: CONFIG.TANK_ARMOR.CLANG_VOLUME,
              pan: 0,
            }),
          gruntPop: (ctx, out) =>
            gruntPop(ctx, out, {
              at: AT,
              note: GRUNT_CHORD[0],
              noise: crashNoise(ctx),
              offset: 0.3,
              volume: CONFIG.DEATHS.GRUNT_VOLUME,
              pan: 0,
            }),
          ...Object.fromEntries(
            ['gruntOw', 'enemyFrying', 'stabberOhNo', 'rusherOhNo'].map(
              (name) => [name, preset(name)]
            )
          ),
        },
        events: {
          ...Object.fromEntries(
            [
              'levelUp',
              'gameOver',
              'killStreak',
              'explosion',
              'tankBallKill',
              'tankShove',
              'shieldBreak',
              'shieldUp',
              'playerHit',
              'lowHealthWarning',
              'playerDash',
            ].map((name) => [name, preset(name)])
          ),
          bombBang: [
            (ctx, out) =>
              bangSound(ctx, out, {
                at: AT,
                noise: crashNoise(ctx),
                volume: CONFIG.BOMB.BANG_VOLUME,
                pan: 0,
              }),
            3,
          ],
          tankAir: [
            (ctx, out) => {
              const timing = airTiming(CONFIG.DEATHS.TANK_ZIP_SEC);
              tankAir(ctx, out, {
                at: AT,
                note: ['1', 2],
                noise: crashNoise(ctx),
                volume: CONFIG.DEATHS.TANK_VOLUME,
                pan: 0,
                timing,
                darts: airDarts(timing, 0.5),
              });
            },
            3,
          ],
          lastBreath: [
            (ctx, out) =>
              lastBreath(ctx, out, {
                at: AT,
                noise: crashNoise(ctx),
                volume: CONFIG.DEATHS.BREATH_VOLUME,
              }),
            3,
          ],
          // A stabber's death, each style, killed stalking and white-hot
          ...Object.fromEntries(
            Object.keys(STABBER_DEATH_SOUNDS).flatMap((style) =>
              [false, true].map((hot) => [
                `stabber ${style}${hot ? ' white-hot' : ''}`,
                [(ctx, out) => stabberDeath(ctx, out, style, hot), 2],
              ])
            )
          ),
        },
      };
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
      const out = {};
      for (const tier of tiers) {
        out[tier] = {};
        for (const [name, c] of Object.entries(CASES[tier])) {
          const [play, sec] = Array.isArray(c) ? c : [c];
          out[tier][name] = (await loudest(play, sec)) - kick;
        }
      }
      if (tiers.includes('band')) {
        const charge = (step) => loudest(preset('tankCharge', { step, steps }));
        out.chargeRise = (await charge(steps - 1)) - (await charge(0));
      }
      return out;
    },
    [tiers, START_FRAMES]
  );
}

function expectInWindows(levels) {
  for (const [tier, sounds] of Object.entries(levels)) {
    if (!WINDOWS_DB[tier]) continue;
    const [low, high] = WINDOWS_DB[tier];
    for (const [name, db] of Object.entries(sounds)) {
      expect(db, `${tier}: ${name}`).toBeGreaterThanOrEqual(
        low - WINDOW_TOLERANCE_DB
      );
      expect(db, `${tier}: ${name}`).toBeLessThanOrEqual(
        high + WINDOW_TOLERANCE_DB
      );
    }
  }
}

// For the log: every level to 0.01 dB
const rounded = (levels) =>
  JSON.stringify(levels, (_, v) => (typeof v === 'number' ? +v.toFixed(2) : v));

test('the drums and the band each sit in their window against the kick', async ({
  page,
}) => {
  test.setTimeout(WINDOW_TEST_MS); // eight renders of every sound
  const levels = await overKick(page, ['drums', 'band']);
  console.log('drums and band over the kick, dB:', rounded(levels));
  expectInWindows(levels);
  expect(Math.abs(levels.chargeRise - CHARGE_RISE_DB)).toBeLessThanOrEqual(
    WINDOW_TOLERANCE_DB
  );
});

test('feedback sits in its windows: frequent sounds under the band, events a little above', async ({
  page,
}) => {
  test.setTimeout(WINDOW_TEST_MS); // eight renders of every sound
  const levels = await overKick(page, ['frequent', 'events']);
  console.log('feedback over the kick, dB:', rounded(levels));
  expectInWindows(levels);
});
