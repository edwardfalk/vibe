/**
 * Instruments.js - The sounds with a synth of their own (a preset's
 * `synth`): the rusher's crash and the hero's shot. Audio.playSound sends
 * them here placed and timed, with its caller's options:
 *   SYNTHS[cfg.synth](ctx, out, cfg, { ...opts, volume, pan, at, eighth })
 * volume is the distance's (and the hero's softening), at the audio time the
 * sound starts and eighth BeatClock's eighth note it plays on. A seeded call
 * also gets detuneCents (Audio.playSynth).
 */
import { CONFIG } from '../config.js';
import { hz } from './Harmony.js';
import { crashNoise, disconnectWhenEnded, playCrash } from './CrashSynth.js';
import { SOUND_CONFIG } from './SoundConfig.js';

const SILENT = 0.0001; // exponential ramps can't reach 0
const dB = (d) => 10 ** (d / 20);

// The hero's shots, from the 4 October listening page
// (docs/superpowers/specs/2026-10-04-hum-studies/index.html, HEROES): each
// part's peak at full accent, before its sound's trim
const PEAK = 0.2;
// The "and" a little louder than the beat, like a dance beat
const ON_BEAT_ACCENT = 0.65;
const HAT = { HIGHPASS_HZ: 7000, Q: 0.8, SEC: 0.035, STOP_SEC: 0.05 };
const METAL = {
  BAND_HZ: 10000,
  BAND_Q: 0.9,
  HIGHPASS_HZ: 7000,
  HIGHPASS_Q: 0.7,
  SEC: 0.045,
  STOP_SEC: 0.06,
};
const TICK = { NOTE: ['1', 6], ATTACK_SEC: 0.002, SEC: 0.03, STOP_SEC: 0.04 };
// The ghost arpeggio's pluck under the hat
const PLUCK = {
  PEAK: 0.07,
  FROM_HZ: 1600,
  TO_HZ: 400,
  Q: 2,
  SWEEP_SEC: 0.1,
  ATTACK_SEC: 0.003,
  SEC: 0.09,
  STOP_SEC: 0.1,
};
// Its walk over two bars of eighths: 1, b3, 5, octave, with the b7 in the
// second bar
const ARP = [
  ['1', 4],
  ['b3', 4],
  ['5', 4],
  ['1', 5],
  ['5', 4],
  ['b3', 4],
  ['5', 4],
  ['b3', 4],
  ['1', 4],
  ['b3', 4],
  ['5', 4],
  ['b7', 4],
  ['1', 5],
  ['b7', 4],
  ['5', 4],
  ['b3', 4],
];
// The hat reads the shared noise from (eighth % ARP.length) × this, so the
// shot draws none of the game's random numbers
const NOISE_STEP_SEC = 0.1;

const mod = (n, m) => ((n % m) + m) % m;

function gainAt(ctx, value, at, out) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(value, at);
  g.connect(out);
  return g;
}

function filterAt(ctx, type, frequency, q, at, out) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(frequency, at);
  f.Q.setValueAtTime(q, at);
  f.connect(out);
  return f;
}

// A gain at `peak` falling to silence over `sec` (the page's hats)
function fall(ctx, peak, sec, at, out) {
  const g = gainAt(ctx, peak, at, out);
  g.gain.exponentialRampToValueAtTime(SILENT, at + sec);
  return g;
}

// A gain rising to `peak` over `attack`, then falling to silence by `sec`
function envelope(ctx, peak, attack, sec, at, out) {
  const g = gainAt(ctx, 0, at, out);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(SILENT, at + sec);
  return g;
}

function noiseHat(ctx, out, at, peak, eighth) {
  const g = fall(ctx, peak, HAT.SEC, at, out);
  const hp = filterAt(ctx, 'highpass', HAT.HIGHPASS_HZ, HAT.Q, at, g);
  const src = ctx.createBufferSource();
  src.buffer = crashNoise(ctx);
  src.connect(hp);
  src.start(at, mod(eighth, ARP.length) * NOISE_STEP_SEC);
  src.stop(at + HAT.STOP_SEC);
  return [src, [src, hp, g]];
}

/** The hero's four shots: each plays into `out` at `at`, and returns its last source and its nodes */
const HERO_SOUNDS = {
  softHat: {
    trim: 1.1,
    play: (ctx, out, at, peak, eighth) => noiseHat(ctx, out, at, peak, eighth),
  },
  // The 808's recipe: the crash's six squares, filtered high and cut short
  metalHat: {
    trim: 1.8,
    play(ctx, out, at, peak) {
      const g = fall(ctx, peak, METAL.SEC, at, out);
      const hp = filterAt(
        ctx,
        'highpass',
        METAL.HIGHPASS_HZ,
        METAL.HIGHPASS_Q,
        at,
        g
      );
      const bp = filterAt(ctx, 'bandpass', METAL.BAND_HZ, METAL.BAND_Q, at, hp);
      const oscs = SOUND_CONFIG.rusherCrash.partialsHz.map((f) => {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(f, at);
        o.connect(bp);
        o.start(at);
        o.stop(at + METAL.STOP_SEC);
        return o;
      });
      return [oscs[0], [...oscs, bp, hp, g]];
    },
  },
  // A click on the root, five octaves up: barely a note, inside the hum
  tick: {
    trim: 0.1,
    pitches: () => [TICK.NOTE],
    play(ctx, out, at, peak, eighth, [f]) {
      const g = envelope(ctx, peak, TICK.ATTACK_SEC, TICK.SEC, at, out);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, at);
      o.connect(g);
      o.start(at);
      o.stop(at + TICK.STOP_SEC);
      return [o, [o, g]];
    },
  },
  // The soft hat keeps time; under it a quiet pluck walks the chord
  ghostArp: {
    trim: -3.5,
    pitches: (eighth) => [ARP[mod(eighth, ARP.length)]],
    play(ctx, out, at, peak, eighth, [f]) {
      const [, hatNodes] = noiseHat(ctx, out, at, peak, eighth);
      const g = envelope(ctx, PLUCK.PEAK, PLUCK.ATTACK_SEC, PLUCK.SEC, at, out);
      const lp = filterAt(ctx, 'lowpass', PLUCK.FROM_HZ, PLUCK.Q, at, g);
      lp.frequency.exponentialRampToValueAtTime(
        PLUCK.TO_HZ,
        at + PLUCK.SWEEP_SEC
      );
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(f, at);
      o.connect(lp);
      o.start(at);
      o.stop(at + PLUCK.STOP_SEC);
      // The pluck outlasts the hat
      return [o, [...hatNodes, o, lp, g]];
    },
  },
};

/** The hero's shot sounds on offer (CONFIG.HERO_SHOT.SOUND), for ?tune */
export const HERO_SHOT_SOUNDS = Object.keys(HERO_SOUNDS);
const DEFAULT_HERO_SOUND = 'tick';
let warnedSound = null;

/**
 * The hero's shot: CONFIG.HERO_SHOT.SOUND (an unknown one warns once and
 * plays the tick) at its trim plus LEVEL_DB, accented on the "and"
 */
export function heroShot(ctx, out, _cfg, { volume, at, eighth }) {
  let name = CONFIG.HERO_SHOT.SOUND;
  if (!Object.hasOwn(HERO_SOUNDS, name)) {
    if (warnedSound !== name) {
      warnedSound = name;
      console.warn(
        `Unknown hero shot sound "${name}"; playing ${DEFAULT_HERO_SOUND}`
      );
    }
    name = DEFAULT_HERO_SOUND;
  }
  const sound = HERO_SOUNDS[name];
  // Every note first: one that can't resolve (a bad root) throws before
  // any node is made
  const pitches = (sound.pitches?.(eighth) ?? []).map((n) => hz(n, at));
  const accent = mod(eighth, 2) ? 1 : ON_BEAT_ACCENT;
  // No panner: his own shot is always centred, and a centred panner would
  // take 3 dB off each channel, where the page Edward judged it had none
  const level = dB(sound.trim + CONFIG.HERO_SHOT.LEVEL_DB) * volume;
  const bus = gainAt(ctx, level, at, out);
  const [last, nodes] = sound.play(
    ctx,
    bus,
    at,
    PEAK * accent,
    eighth,
    pitches
  );
  disconnectWhenEnded(last, [...nodes, bus]);
}

/** Every synth by name; the crash keeps CONFIG.RUSHER.CRASH_VOLUME */
export const SYNTHS = {
  crash: (ctx, out, cfg, { volume, pan }) =>
    playCrash(
      ctx,
      out,
      cfg,
      cfg.volume * CONFIG.RUSHER.CRASH_VOLUME * volume,
      pan
    ),
  heroShot,
};
