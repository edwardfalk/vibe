/**
 * Instruments.js - The sounds with a synth of their own (a preset's
 * `synth`): the rusher's crash, the hero's shot and the band's
 * instruments. Audio.playSound sends them here placed and timed, with its
 * caller's options:
 *   SYNTHS[cfg.synth](ctx, out, cfg, { ...opts, volume, pan, at, eighth })
 * volume is the distance's (and the hero's softening), at the audio time the
 * sound starts and eighth BeatClock's eighth note it plays on. A seeded call
 * also gets detuneCents (Audio.playSynth).
 */
import { CONFIG } from '../config.js';
import { hz, stepUp } from './Harmony.js';
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

// Each node starts at `at`, connected to `out` when there is one
function gainAt(ctx, value, at, out) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(value, at);
  if (out) g.connect(out);
  return g;
}

function filterAt(ctx, type, frequency, q, at, out) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(frequency, at);
  f.Q.setValueAtTime(q, at);
  if (out) f.connect(out);
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

// ---- The band: each enemy's instrument (audio PR 3) ----------------------
// From the 9 October listening page
// (docs/superpowers/specs/2026-10-09-band-studies/candidates.js): each
// sound's numbers as Edward heard them, and its trim (dB) matching it to the
// sound it replaced, measured there by measure.mjs

function osc(ctx, type, f, at, out, cents) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  o.detune.setValueAtTime(cents, at);
  if (out) o.connect(out);
  return o;
}

// The shared noise, read from `offset` s
function noiseAt(ctx, at, out, offset) {
  const s = ctx.createBufferSource();
  s.buffer = crashNoise(ctx);
  s.connect(out);
  s.start(at, offset);
  return s;
}

// A soft clipper: tanh(amount·x), scaled back to full range
const DRIVE_POINTS = 1024;
function drive(ctx, amount) {
  const curve = new Float32Array(DRIVE_POINTS);
  for (let i = 0; i < DRIVE_POINTS; i++) {
    const x = (i / (DRIVE_POINTS - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / Math.tanh(amount);
  }
  const w = ctx.createWaveShaper();
  w.curve = curve;
  w.oversample = '2x';
  return w;
}

/**
 * One of the band's sounds into `out`, panned and at its trim plus its
 * knob, times `volume`. Its notes and its level come first, so a bad root,
 * a missing note, a step out of range, or a knob or detune that isn't a
 * finite number throws before any node is made. A sound is { trim, notes(opts), play(ctx, bus,
 * at, hzs, cents, opts) → [sources, nodes, stopSec] }; its first source
 * lets every node go when it ends.
 */
function playBand(ctx, out, sound, knobDb, opts) {
  const { at, volume, pan, detuneCents = 0 } = opts;
  const hzs = sound.notes(opts).map((note) => hz(note, at));
  // A knob that isn't a number would join the trim as text ('6' → 0.46 dB)
  if (!Number.isFinite(knobDb) || !Number.isFinite(detuneCents)) {
    throw new Error(`Band knob ${knobDb} dB or detune ${detuneCents} c`);
  }
  const level = dB(sound.trim + knobDb) * volume;
  if (!Number.isFinite(level)) {
    throw new Error(`Band level ${knobDb} dB × ${volume} is not a number`);
  }
  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(pan, at);
  panner.connect(out);
  const bus = gainAt(ctx, level, at, panner);
  const [sources, nodes, sec] = sound.play(
    ctx,
    bus,
    at,
    hzs,
    detuneCents,
    opts
  );
  for (const s of sources) s.stop(at + sec);
  disconnectWhenEnded(sources[0], [...sources, ...nodes, bus, panner]);
}

// The sound `name` of a choice (`what`, for the error); an unknown one
// throws, and playSound logs it once and plays nothing
function chosen(sounds, name, what) {
  if (!Object.hasOwn(sounds, name)) {
    throw new Error(`Unknown ${what}: ${name}`);
  }
  return sounds[name];
}

// The grunt's shot on beats 2 and 4, on the note he is given
const GRUNT_SHOTS = {
  // Two saws either side of his note through a low-pass that snaps shut,
  // over a noise snap: the synthwave stab
  stab: {
    trim: -6.8,
    SAW_CENTS: 9,
    LOWPASS: { FROM_HZ: 4200, TO_HZ: 700, Q: 5, SWEEP_SEC: 0.07 },
    PEAK: 0.5,
    ATTACK_SEC: 0.002,
    SEC: 0.13,
    SNAP: {
      PEAK: 0.35,
      ATTACK_SEC: 0.001,
      SEC: 0.045,
      BAND_HZ: 2600,
      Q: 0.8,
      NOISE_SEC: 0.2,
    },
    STOP_SEC: 0.16,
    notes: ({ note }) => [note],
    play(ctx, bus, at, [f], cents) {
      const { LOWPASS: L, SNAP: S } = this;
      const e = envelope(ctx, this.PEAK, this.ATTACK_SEC, this.SEC, at, bus);
      const lp = filterAt(ctx, 'lowpass', L.FROM_HZ, L.Q, at, e);
      lp.frequency.exponentialRampToValueAtTime(L.TO_HZ, at + L.SWEEP_SEC);
      const saws = [-1, 1].map((side) =>
        osc(ctx, 'sawtooth', f, at, lp, cents + side * this.SAW_CENTS)
      );
      const snap = envelope(ctx, S.PEAK, S.ATTACK_SEC, S.SEC, at, bus);
      const bp = filterAt(ctx, 'bandpass', S.BAND_HZ, S.Q, at, snap);
      const n = noiseAt(ctx, at, bp, S.NOISE_SEC);
      for (const s of saws) s.start(at);
      return [[...saws, n], [e, lp, snap, bp], this.STOP_SEC];
    },
  },
  // A square dropping an octave onto his note, with a click: the arcade
  // blaster, in key
  zap: {
    trim: 0.2,
    PEAK: 0.3,
    ATTACK_SEC: 0.002,
    SEC: 0.09,
    LOWPASS_HZ: 5000,
    LOWPASS_Q: 0.7,
    DROP_SEC: 0.025,
    CLICK: {
      PEAK: 0.25,
      ATTACK_SEC: 0.0005,
      SEC: 0.012,
      HIGHPASS_HZ: 3000,
      Q: 0.7,
      NOISE_SEC: 1.1,
    },
    STOP_SEC: 0.1,
    notes: ({ note }) => [note],
    play(ctx, bus, at, [f], cents) {
      const C = this.CLICK;
      const e = envelope(ctx, this.PEAK, this.ATTACK_SEC, this.SEC, at, bus);
      const lp = filterAt(
        ctx,
        'lowpass',
        this.LOWPASS_HZ,
        this.LOWPASS_Q,
        at,
        e
      );
      const o = osc(ctx, 'square', f * 2, at, lp, cents);
      o.frequency.exponentialRampToValueAtTime(f, at + this.DROP_SEC);
      const click = envelope(ctx, C.PEAK, C.ATTACK_SEC, C.SEC, at, bus);
      const hp = filterAt(ctx, 'highpass', C.HIGHPASS_HZ, C.Q, at, click);
      const n = noiseAt(ctx, at, hp, C.NOISE_SEC);
      o.start(at);
      return [[o, n], [e, lp, click, hp], this.STOP_SEC];
    },
  },
};

/** The grunt's shots on offer (CONFIG.BAND.GRUNT_SHOT), for ?tune */
export const GRUNT_SHOT_SOUNDS = Object.keys(GRUNT_SHOTS);

/** The grunt's shot: CONFIG.BAND.GRUNT_SHOT on his `note` */
export function gruntShot(ctx, out, _cfg, opts) {
  const { GRUNT_SHOT, GRUNT_SHOT_DB } = CONFIG.BAND;
  const sound = chosen(GRUNT_SHOTS, GRUNT_SHOT, 'CONFIG.BAND.GRUNT_SHOT');
  playBand(ctx, out, sound, GRUNT_SHOT_DB, opts);
}

// The tank's shot on beat 1: an 808 boom dropping onto his root and
// ringing, driven, with today's falling zap shortened on top (two layers 3%
// apart, whose beating is the electric buzz)
const TANK_SHOT = {
  trim: 1.5,
  DRIVE: 2.5,
  PEAK: 0.75,
  ATTACK_SEC: 0.002,
  SEC: 0.95,
  DROP_SEC: 0.06,
  ZAP: { PEAK: 0.16, ATTACK_SEC: 0.002, SEC: 0.3, SWEEP_SEC: 0.3, BEAT: 1.03 },
  STOP_SEC: 1,
  // The boom from his root two octaves up to his low root; the zap from his
  // fifth to his root
  notes: () => [
    ['1', 3],
    ['1', 1],
    ['5', 5],
    ['1', 2],
  ],
  play(ctx, bus, at, [boomHz, rootHz, zapHz, zapToHz], cents) {
    const Z = this.ZAP;
    const e = envelope(ctx, this.PEAK, this.ATTACK_SEC, this.SEC, at, bus);
    const sat = drive(ctx, this.DRIVE);
    sat.connect(e);
    const boom = osc(ctx, 'sine', boomHz, at, sat, cents);
    boom.frequency.exponentialRampToValueAtTime(rootHz, at + this.DROP_SEC);
    const zapEnv = envelope(ctx, Z.PEAK, Z.ATTACK_SEC, Z.SEC, at, bus);
    const zaps = [
      osc(ctx, 'sawtooth', zapHz, at, zapEnv, cents),
      osc(ctx, 'square', zapHz * Z.BEAT, at, zapEnv, cents),
    ];
    for (const z of zaps) {
      z.frequency.exponentialRampToValueAtTime(zapToHz, at + Z.SWEEP_SEC);
    }
    const sources = [boom, ...zaps];
    for (const o of sources) o.start(at);
    return [sources, [e, sat, zapEnv], this.STOP_SEC];
  },
};

// The tank's charge: a short square pluck a beat, a scale step up each beat
// from his root (the octave on the eighth), louder as he strains
const TANK_CHARGE = {
  trim: -1.9,
  FROM: ['1', 3],
  PEAK: 0.4,
  // The first pluck at this share of PEAK, the last at all of it
  SWELL_FROM: 0.55,
  ATTACK_SEC: 0.003,
  SEC: 0.16,
  LOWPASS: { FROM_HZ: 2400, TO_HZ: 500, Q: 3, SWEEP_SEC: 0.12 },
  STOP_SEC: 0.18,
  notes({ step, steps }) {
    if (!(Number.isInteger(step) && step >= 0 && step < steps)) {
      throw new Error(`Step ${step} is not one of 0..${steps - 1}`);
    }
    return [stepUp(this.FROM, step)];
  },
  play(ctx, bus, at, [f], cents, { step, steps }) {
    const L = this.LOWPASS;
    const swell =
      this.SWELL_FROM + ((1 - this.SWELL_FROM) * step) / Math.max(1, steps - 1);
    const e = envelope(
      ctx,
      this.PEAK * swell,
      this.ATTACK_SEC,
      this.SEC,
      at,
      bus
    );
    const lp = filterAt(ctx, 'lowpass', L.FROM_HZ, L.Q, at, e);
    lp.frequency.exponentialRampToValueAtTime(L.TO_HZ, at + L.SWEEP_SEC);
    const o = osc(ctx, 'square', f, at, lp, cents);
    o.start(at);
    return [[o], [e, lp], this.STOP_SEC];
  },
};

// The grunts' chatter, now and then on 2 or 4: each grunt has one voice
const CHATTER_VOICES = {
  // A soft tone sliding up a step into his minor third, with a nervous
  // wobble
  whine: {
    trim: -1.1,
    PEAK: 0.35,
    ATTACK_SEC: 0.01,
    SEC: 0.2,
    SLIDE_SEC: 0.06,
    WOBBLE_HZ: 9,
    WOBBLE_CENTS: 30,
    STOP_SEC: 0.22,
    notes: () => [
      ['2', 5],
      ['b3', 5],
    ],
    play(ctx, bus, at, [from, to], cents) {
      const e = envelope(ctx, this.PEAK, this.ATTACK_SEC, this.SEC, at, bus);
      const o = osc(ctx, 'triangle', from, at, e, cents);
      o.frequency.exponentialRampToValueAtTime(to, at + this.SLIDE_SEC);
      const wobble = osc(ctx, 'sine', this.WOBBLE_HZ, at, null, cents);
      const depth = gainAt(ctx, this.WOBBLE_CENTS, at, o.detune);
      wobble.connect(depth);
      o.start(at);
      wobble.start(at);
      return [[o, wobble], [e, depth], this.STOP_SEC];
    },
  },
  // A saw through two vowel filters, blipping up onto his minor third: a
  // little "eep"
  squeak: {
    trim: 9.6,
    PEAK: 0.5,
    ATTACK_SEC: 0.005,
    SEC: 0.13,
    VOWELS: [
      { HZ: 2800, Q: 6 },
      { HZ: 900, Q: 5 },
    ],
    BLIP_SEC: 0.05,
    STOP_SEC: 0.14,
    notes: () => [
      ['5', 4],
      ['b3', 5],
    ],
    play(ctx, bus, at, [from, to], cents) {
      const e = envelope(ctx, this.PEAK, this.ATTACK_SEC, this.SEC, at, bus);
      const vowels = this.VOWELS.map((v) =>
        filterAt(ctx, 'bandpass', v.HZ, v.Q, at, e)
      );
      const o = osc(ctx, 'sawtooth', from, at, null, cents);
      o.frequency.exponentialRampToValueAtTime(to, at + this.BLIP_SEC);
      for (const v of vowels) o.connect(v);
      o.start(at);
      return [[o], [e, ...vowels], this.STOP_SEC];
    },
  },
};

/** The grunts' chatter voices; a grunt has one for life (Grunt.chatterVoice) */
export const GRUNT_VOICES = Object.keys(CHATTER_VOICES);
/** CONFIG.BAND.CHATTER's choices, for ?tune: each his own, or all one */
export const CHATTER_CHOICES = ['both', ...GRUNT_VOICES];

/**
 * A grunt's chatter: his own `voice`, or CONFIG.BAND.CHATTER's for every
 * grunt; read live, so ?tune reaches grunts already alive
 */
export function gruntChatter(ctx, out, _cfg, opts) {
  const { CHATTER, CHATTER_DB } = CONFIG.BAND;
  const voice = CHATTER === 'both' ? opts.voice : CHATTER;
  const sound = chosen(CHATTER_VOICES, voice, 'chatter voice');
  playBand(ctx, out, sound, CHATTER_DB, opts);
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
  gruntShot,
  tankShot: (ctx, out, _cfg, opts) =>
    playBand(ctx, out, TANK_SHOT, CONFIG.BAND.TANK_SHOT_DB, opts),
  tankCharge: (ctx, out, _cfg, opts) =>
    playBand(ctx, out, TANK_CHARGE, CONFIG.BAND.CHARGE_DB, opts),
  gruntChatter,
};
