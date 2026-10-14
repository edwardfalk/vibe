/**
 * The deaths' sounds, on the hum's notes (Harmony.js): a grunt's pop and
 * whine, and the Dude's last breath, ported from the `balloon` and `lieback`
 * variants' sound() in docs/superpowers/specs/2026-10-05-death-studies/
 * (git-ignored; the spec is
 * docs/superpowers/specs/2026-10-07-deaths-design.md); the tank's air,
 * ported from `allAir.sound` in deaths-tank-oct5.js, and a plate's clang,
 * from `plate` in `CLANGS` in deaths-tank.js, both in
 * docs/superpowers/specs/2026-10-08-explosion-studies/ (git-ignored; the
 * page is https://claude.ai/artifact/GHjWCySGwv8cVCtWDoE6nV; the spec is
 * docs/superpowers/specs/2026-10-09-bomb-kill-design.md); the stabber's
 * deaths, ported from `death-shell.js` and `death-shatter.js` in
 * docs/superpowers/specs/2026-10-12-stabber-death-studies/ (StabberDeath.js
 * names the page and the spec). From the port on, these constants are the
 * authority.
 *
 * Procedural only: oscillators, noise and filters. The noise is the crash's
 * (CrashSynth.js), so a death draws none of the game's random numbers. Each
 * sound builds its own nodes into `out` and disconnects them when it ends,
 * as the crash does.
 */
import { hz } from './Harmony.js';
import { disconnectWhenEnded, placed } from './CrashSynth.js';
import { hash01 } from '../entities/RusherRenderer.js';
import { shellShutAt } from '../entities/StabberShell.js';
import { shatterTimes } from '../entities/StabberShatter.js';
import { pluck } from './StabberStrings.js';
import { SYNTHS } from './Instruments.js';
import { CONFIG } from '../config.js';
import { dB, smooth } from '../mathUtils.js';

const SILENT = 0.0001; // exponential ramps can't reach 0
const OFF = 0.0005; // where a short sound's fade ends
const TAIL_SEC = 0.02; // sources stop this long after they fade out

// A grunt's pop: noise through a band sweeping down, and a bubble's bloop
const SPLASH = { FROM_HZ: 3200, TO_HZ: 450, PEAK: 0.3, SEC: 0.08, Q: 1.4 };
const SPLASH_ATTACK_SEC = 0.003;
const BLOOP = {
  FROM_HZ: 300,
  TO_HZ: 1100,
  PEAK: 0.09,
  SEC: 0.06,
  SLIDE: 0.035,
};
const BLOOP_ATTACK_SEC = 0.004;
// Its last whine: a nasal saw sliding from above down onto its note, with a
// vibrato growing as it lands
const WHINE = {
  DELAY_SEC: 0.03, // after the pop
  FROM: 1.5, // times its note
  SLIDE_SEC: 0.22,
  HOLD_SEC: 0.16,
  PEAK: 0.075,
  ATTACK_SEC: 0.02,
  VIB_HZ: 8,
  DEPTH: 0.025, // of the pitch
  DEPTH_START: 0.3, // of that, at first
  LP: 3, // the lowpass sits at its note times this
  LP_Q: 3,
  HELD: 0.6, // of the slide, at its peak
};
/** How long a grunt's pop lasts, s, for a noise offset that stays in the buffer */
export const GRUNT_POP_SEC = WHINE.DELAY_SEC + WHINE.SLIDE_SEC + WHINE.HOLD_SEC;
// The mix pass: the last breath over the page's level, in dB, to the top of
// the events' window: his death line ducked it 6 dB then (3 dB since), and
// Edward never heard it (docs/superpowers/specs/2026-10-10-mix-pass-design.md)
export const BREATH_MIX_DB = 14.56;

// The Dude's last breath: a soft pad an octave under his note, gliding down
// a whole tone, and a breath out under it
const PAD = {
  // [degree, octave, wave, detune cents, level]
  VOICES: [
    ['1', 3, 'sawtooth', -6, 0.35],
    ['1', 3, 'sawtooth', 6, 0.35],
    ['5', 3, 'triangle', 0, 0.4],
    ['1', 2, 'sine', 0, 0.6],
  ],
  SEC: 2,
  PEAK: 0.07,
  SWELL_SEC: 0.25,
  FADE_FROM_SEC: 0.6,
  FADE_TAU: 0.45,
  GLIDE_FROM_SEC: 0.3,
  GLIDE_SEMITONES: -2,
  LP_FROM_HZ: 900,
  LP_TO_HZ: 320,
  LP_Q: 0.7,
  TAIL_SEC: 0.05,
};
const EXHALE = {
  FROM_HZ: 700,
  TO_HZ: 260,
  Q: 0.9,
  PEAK: 0.04,
  PEAK_SEC: 0.12,
  SEC: 1.2,
  OFFSET_SEC: 0.3, // into the noise
  TAIL_SEC: 0.05,
};

/**
 * A grunt's pop and whine at audio time `at`, its whine landing on `note`
 * ([degree, octave], drifted to `at` if sounds drift).
 * @param {AudioContext} ctx
 * @param {AudioNode} out the effects' bus
 * @param {object} o { at, note, noise (an AudioBuffer), offset (s into it),
 *   volume (1: the page's level), pan (-1..1) }
 */
export function gruntPop(ctx, out, { at, note, noise, offset, volume, pan }) {
  const [bus, panner] = placed(ctx, out, volume, pan, at);
  const nodes = [bus, panner];
  const env = (peak, attack, sec) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(SILENT, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(OFF, at + sec);
    nodes.push(g);
    return g;
  };

  // The splash
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = SPLASH.Q;
  band.frequency.setValueAtTime(SPLASH.FROM_HZ, at);
  band.frequency.exponentialRampToValueAtTime(SPLASH.TO_HZ, at + SPLASH.SEC);
  src
    .connect(band)
    .connect(env(SPLASH.PEAK, SPLASH_ATTACK_SEC, SPLASH.SEC))
    .connect(bus);
  src.start(at, offset);
  src.stop(at + SPLASH.SEC + TAIL_SEC);
  nodes.push(src, band);

  // The bloop
  const bloop = ctx.createOscillator();
  bloop.type = 'sine';
  bloop.frequency.setValueAtTime(BLOOP.FROM_HZ, at);
  bloop.frequency.exponentialRampToValueAtTime(BLOOP.TO_HZ, at + BLOOP.SLIDE);
  bloop.connect(env(BLOOP.PEAK, BLOOP_ATTACK_SEC, BLOOP.SEC)).connect(bus);
  bloop.start(at);
  bloop.stop(at + BLOOP.SEC + TAIL_SEC);
  nodes.push(bloop);

  // The whine
  const t = at + WHINE.DELAY_SEC;
  const f1 = hz(note, at);
  const f0 = f1 * WHINE.FROM;
  const end = t + WHINE.SLIDE_SEC + WHINE.HOLD_SEC;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + WHINE.SLIDE_SEC);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = WHINE.VIB_HZ;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(f0 * WHINE.DEPTH * WHINE.DEPTH_START, t);
  depth.gain.linearRampToValueAtTime(f1 * WHINE.DEPTH, t + WHINE.SLIDE_SEC);
  lfo.connect(depth).connect(osc.frequency);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = f1 * WHINE.LP;
  lp.Q.value = WHINE.LP_Q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENT, t);
  g.gain.exponentialRampToValueAtTime(WHINE.PEAK, t + WHINE.ATTACK_SEC);
  g.gain.setValueAtTime(WHINE.PEAK, t + WHINE.SLIDE_SEC * WHINE.HELD);
  g.gain.exponentialRampToValueAtTime(OFF, end);
  osc.connect(lp).connect(g).connect(bus);
  for (const x of [osc, lfo]) {
    x.start(t);
    x.stop(end + TAIL_SEC);
  }
  nodes.push(osc, lfo, depth, lp, g);
  disconnectWhenEnded(osc, nodes);
}

/**
 * The Dude's last breath at audio time `at` (with the hum's drift then if sounds drift).
 * @param {AudioContext} ctx
 * @param {AudioNode} out its group's bus
 * @param {object} o { at, noise (an AudioBuffer), volume (1: the page's level,
 *   plus the mix pass's BREATH_MIX_DB) }
 */
export function lastBreath(ctx, out, { at, noise, volume }) {
  const [bus, panner] = placed(ctx, out, volume * dB(BREATH_MIX_DB), 0, at);
  const nodes = [bus, panner];
  const end = at + PAD.SEC;
  const pad = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = PAD.LP_Q;
  lp.frequency.setValueAtTime(PAD.LP_FROM_HZ, at);
  lp.frequency.exponentialRampToValueAtTime(PAD.LP_TO_HZ, end);
  pad.gain.setValueAtTime(SILENT, at);
  pad.gain.exponentialRampToValueAtTime(PAD.PEAK, at + PAD.SWELL_SEC);
  pad.gain.setTargetAtTime(SILENT, at + PAD.FADE_FROM_SEC, PAD.FADE_TAU);
  lp.connect(pad).connect(bus);
  nodes.push(pad, lp);
  let last = null;
  for (const [degree, octave, type, detune, level] of PAD.VOICES) {
    const f = hz([degree, octave], at);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f, at);
    o.frequency.setValueAtTime(f, at + PAD.GLIDE_FROM_SEC);
    o.frequency.exponentialRampToValueAtTime(
      f * 2 ** (PAD.GLIDE_SEMITONES / 12),
      end
    );
    g.gain.value = level;
    o.connect(g).connect(lp);
    o.start(at);
    o.stop(end + PAD.TAIL_SEC);
    nodes.push(o, g);
    last = o;
  }
  // The exhale: noise through a soft low band, a breath out
  const n = ctx.createBufferSource();
  n.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = EXHALE.Q;
  band.frequency.setValueAtTime(EXHALE.FROM_HZ, at);
  band.frequency.exponentialRampToValueAtTime(EXHALE.TO_HZ, at + EXHALE.SEC);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(SILENT, at);
  ng.gain.exponentialRampToValueAtTime(EXHALE.PEAK, at + EXHALE.PEAK_SEC);
  ng.gain.exponentialRampToValueAtTime(SILENT, at + EXHALE.SEC);
  n.connect(band).connect(ng).connect(bus);
  n.start(at, EXHALE.OFFSET_SEC);
  n.stop(at + EXHALE.SEC + EXHALE.TAIL_SEC);
  nodes.push(n, band, ng);
  disconnectWhenEnded(last, nodes);
}

// The tank's air: a hiss of it out of the hole in his back, and a rubbery
// squeal from his root's third octave down to the root, its nozzle flapping
// slower and slower, jumping up a little on each dart
const AIR_SOUND = {
  HISS_FROM_HZ: 5500,
  HISS_TO_HZ: 2200,
  HISS_Q: 0.9,
  HISS_DELAY_SEC: 0.02,
  HISS_PEAK: 0.07,
  HISS_ATTACK_SEC: 0.1,
  HISS_HOLD_LESS_SEC: 0.5, // it holds until this before the air is out
  HISS_MIN_HOLD_SEC: 0.1,
  HISS_RELEASE_SEC: 0.35,
  HISS_TAIL_SEC: 0.1,
  NOISE_TURNS: 7.3, // where in the noise it reads, from its time
  FROM: 8, // times the root
  MID: 2, // times the root, at MID_AT of the way
  MID_AT: 0.65,
  LAND_BEFORE_SEC: 0.15, // on the root this long before the air is out
  DART_CENTS: [120, 160], // a dart's jump, plus up to that much more
  DART_UP_SEC: 0.02,
  DART_DOWN_SEC: 0.085,
  FLAP_FROM_HZ: 30,
  FLAP_TO_HZ: 9,
  FLAP_CENTS: 40,
  FLAP_AM: [0.6, 0.4], // the level it flaps about, and how far
  LP_FROM_HZ: 3000,
  LP_TO_HZ: 800,
  LP_Q: 4,
  PEAK: 0.12,
  ATTACK_SEC: 0.05,
  HOLD_LESS_SEC: 0.25, // it holds until this before the air is out
  RELEASE_SEC: 0.2,
  TAIL_SEC: 0.1,
};
// A gain up to `peak` in `attack` s, held `hold` s, gone over `release` s
function heldGain(ctx, at, peak, attack, hold, release) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENT, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.setValueAtTime(peak, at + attack + hold);
  g.gain.exponentialRampToValueAtTime(SILENT, at + attack + hold + release);
  return g;
}

/**
 * The tank's death, All air, from audio time `at`, its squeal landing on
 * `note` ([degree, octave], drifted to `at` if sounds drift).
 * @param {AudioContext} ctx
 * @param {AudioNode} out the effects' bus
 * @param {object} o { at, note, noise (an AudioBuffer), volume (1: the
 *   page's level), pan (-1..1), timing ({ from, sec, done }: when his air
 *   starts, how long it lasts, when it is out, from his start), darts
 *   ([{ at, k }]: the picture's, from his start) }
 */
export function tankAir(
  ctx,
  out,
  { at, note, noise, volume, pan, timing, darts }
) {
  const A = AIR_SOUND;
  const [bus, panner] = placed(ctx, out, volume, pan, at);
  const nodes = [bus, panner];
  const root = hz(note, at);
  const f0 = at + timing.from;
  const f1 = at + timing.done;
  // The hiss of the air out of the hole
  const hiss = ctx.createBiquadFilter();
  hiss.type = 'bandpass';
  hiss.Q.value = A.HISS_Q;
  hiss.frequency.setValueAtTime(A.HISS_FROM_HZ, at);
  hiss.frequency.exponentialRampToValueAtTime(A.HISS_TO_HZ, f1);
  const h0 = at + A.HISS_DELAY_SEC;
  const hissGain = heldGain(
    ctx,
    h0,
    A.HISS_PEAK,
    A.HISS_ATTACK_SEC,
    Math.max(A.HISS_MIN_HOLD_SEC, f1 - at - A.HISS_HOLD_LESS_SEC),
    A.HISS_RELEASE_SEC
  );
  const n = ctx.createBufferSource();
  n.buffer = noise;
  n.loop = true; // a long zip reads past the end of the noise
  n.connect(hiss).connect(hissGain).connect(bus);
  n.start(h0, (h0 * A.NOISE_TURNS) % 1);
  n.stop(f1 + A.HISS_TAIL_SEC);
  nodes.push(hiss, hissGain, n);
  // The squeal
  const end = f1 + A.TAIL_SEC;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(root * A.FROM, f0);
  o.frequency.exponentialRampToValueAtTime(
    root * A.MID,
    f0 + A.MID_AT * timing.sec
  );
  o.frequency.exponentialRampToValueAtTime(root, f1 - A.LAND_BEFORE_SEC);
  o.detune.setValueAtTime(0, f0);
  for (const dart of darts) {
    const ta = at + dart.at;
    o.detune.setValueAtTime(0, ta);
    o.detune.linearRampToValueAtTime(
      A.DART_CENTS[0] + A.DART_CENTS[1] * dart.k,
      ta + A.DART_UP_SEC
    );
    o.detune.linearRampToValueAtTime(0, ta + A.DART_DOWN_SEC);
  }
  const flap = ctx.createOscillator();
  flap.frequency.setValueAtTime(A.FLAP_FROM_HZ, f0);
  flap.frequency.exponentialRampToValueAtTime(A.FLAP_TO_HZ, f1);
  const wob = ctx.createGain();
  wob.gain.value = A.FLAP_CENTS;
  flap.connect(wob).connect(o.detune);
  const am = ctx.createGain();
  am.gain.value = A.FLAP_AM[0];
  const depth = ctx.createGain();
  depth.gain.value = A.FLAP_AM[1];
  flap.connect(depth).connect(am.gain);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = A.LP_Q;
  lp.frequency.setValueAtTime(A.LP_FROM_HZ, f0);
  lp.frequency.exponentialRampToValueAtTime(A.LP_TO_HZ, f1);
  const g = heldGain(
    ctx,
    f0,
    A.PEAK,
    A.ATTACK_SEC,
    f1 - f0 - A.HOLD_LESS_SEC,
    A.RELEASE_SEC
  );
  o.connect(lp).connect(am).connect(g).connect(bus);
  for (const x of [o, flap]) {
    x.start(f0);
    x.stop(end);
  }
  nodes.push(o, flap, wob, am, depth, lp, g);
  disconnectWhenEnded(o, nodes);
}

// A plate breaking off under the hero's shots: a crack of bright noise, then
// it rings like struck sheet metal, sines at a plate's out-of-tune ratios of
// its note (the strongest on it), the high ones dying first, a click for
// the strike. Each break differs a little, from its time: its upper
// partials shift, its ring and crack vary
const CLANG = {
  NOTE: ['1', 5],
  RATIOS: [1, 1.594, 2.136, 2.653, 3.156], // a plate's modes
  AMPS: [1, 0.55, 0.42, 0.3, 0.2],
  SHIFT: 0.08, // the upper partials move up to half this either way
  LEVEL: 0.085,
  RING_SEC: [0.55, 0.25], // its ring, and up to this much longer
  HIGHER_DIES: 0.9, // each higher partial rings 1 / (1 + this × its index) as long
  PARTIAL_ATTACK_SEC: 0.0015,
  STRIKE_SEC: 0.004, // the ring starts this long after the crack
  CLICK: 0.3,
  CLICK_HZ_X: 4, // the click's band, times the note
  CLICK_MAX_HZ: 9000,
  CLICK_Q: 1.5,
  CLICK_SEC: [0.001, 0.012], // attack, release
  CRACK: [0.045, 0.03], // its level, and up to this much louder
  CRACK_HP_HZ: 2500,
  CRACK_SEC: [0.001, 0.004, 0.025], // attack, hold, release
  NOISE_SEC: 0.05,
  NOISE_TURNS: 7.3, // where in the noise it reads, from its time
  TAIL_SEC: 0.05,
};

/**
 * A plate breaking at audio time `at`, its ring on the hum's F#.
 * @param {AudioContext} ctx
 * @param {AudioNode} out the effects' bus
 * @param {object} o { at, noise (an AudioBuffer), volume (1: the page's level), pan (-1..1) }
 */
export function plateClang(ctx, out, { at, noise, volume, pan }) {
  const K = CLANG;
  const [bus, panner] = placed(ctx, out, volume, pan, at);
  const nodes = [bus, panner];
  const v = hash01(at);
  const burst = (from, sec) => {
    const n = ctx.createBufferSource();
    n.buffer = noise;
    n.start(from, (from * K.NOISE_TURNS) % 1);
    n.stop(from + sec);
    nodes.push(n);
    return n;
  };
  const band = (type, f, q) => {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    nodes.push(b);
    return b;
  };
  const gain = (...a) => {
    const g = heldGain(ctx, ...a);
    nodes.push(g);
    return g;
  };
  // The crack
  const [ca, ch, cr] = K.CRACK_SEC;
  burst(at, K.NOISE_SEC)
    .connect(band('highpass', K.CRACK_HP_HZ, 0.7))
    .connect(gain(at, K.CRACK[0] + K.CRACK[1] * v, ca, ch, cr))
    .connect(bus);
  // The ring
  const t = at + K.STRIKE_SEC;
  const f = hz(K.NOTE, at);
  const ring = K.RING_SEC[0] + K.RING_SEC[1] * v;
  const level = ctx.createGain();
  level.gain.value = K.LEVEL;
  level.connect(bus);
  nodes.push(level);
  let last = null;
  K.RATIOS.forEach((r, i) => {
    const ratio = i ? r * (1 + K.SHIFT * (v - 0.5)) : r;
    const rel = ring / (1 + K.HIGHER_DIES * i);
    const o = ctx.createOscillator();
    o.frequency.value = f * ratio;
    o.connect(gain(t, K.AMPS[i], K.PARTIAL_ATTACK_SEC, 0, rel)).connect(level);
    o.start(t);
    o.stop(t + rel + K.TAIL_SEC);
    nodes.push(o);
    if (i === 0) last = o; // the strongest rings longest
  });
  const [ka, kr] = K.CLICK_SEC;
  burst(t, K.NOISE_SEC)
    .connect(
      band('bandpass', Math.min(K.CLICK_MAX_HZ, f * K.CLICK_HZ_X), K.CLICK_Q)
    )
    .connect(gain(t, K.CLICK, ka, 0, kr))
    .connect(level);
  disconnectWhenEnded(last, nodes);
}

// A stabber's death, Empty shell: a crack running down the seam, then his
// bowed cluster gliding down from his sour note onto the hum's fifth, the
// sour semitone above it dying as he falls; cut off as the eye shuts, with
// a pluck on the fifth
const SHELL_SOUND = {
  // Its level in feedback's events window: about 2 dB over the kick, beside
  // the tank's death (tests/audio-levels.test.js; -4.3 dB at the page's level)
  TRIM_DB: 6.2,
  CLICK_ATTACK_SEC: 0.001,
  // A crack running down the seam: snaps of bright noise, unevenly spaced
  CRACK: [
    [0, 3800, 0.28], // [s after the crack, Hz, level]
    [0.009, 2400, 0.2],
    [0.019, 5200, 0.14],
    [0.034, 3000, 0.09],
  ],
  CRACK_Q: 1.3,
  CRACK_DECAY_SEC: 0.035,
  CRACK_SEC: 0.05,
  NOISE_FROM_SEC: 0.2, // into the noise, plus his seed (s): it reads under 2 s
  SIZZLE: 0.035, // white-hot: the spike's hiss as it cools
  SIZZLE_HZ: 5000,
  SIZZLE_DELAY_SEC: 0.02,
  SIZZLE_SEC: 0.35,
  SIZZLE_NOISE_SEC: 0.4,
  GLIDE_DELAY_SEC: 0.02, // the crack first, then his strings
  NOTE: ['b5', 6], // his strings' sour note
  HOT_BEND: 1.06, // white-hot, it starts from the screech's bent-up pitch
  LAND: ['5', 5], // the hum's fifth, an octave and a bit under his note
  PEAK: 0.13,
  ATTACK_SEC: 0.01,
  BODY: 0.55,
  BODY_SEC: 0.12,
  LANDED: 0.35,
  FALL_FROM_SEC: 0.07,
  FALL_SEC: 0.72,
  FALL_STEPS: 32,
  MAX_SEC: 1.25, // s: whatever the linger, it's over by then
  PLUCK: 0.07, // the pizzicato as the eye shuts
  PLUCK_ATTACK_SEC: 0.003,
  PLUCK_SEC: 0.14,
  PLUCK_LP_HZ: [4200, 700],
  PLUCK_LP_SEC: 0.08,
  PLUCK_Q: 4,
  RELEASE_SEC: 0.08,
  TAIL_SEC: 0.02,
  CENTS: [-7, 0, 6],
  CLUSTER: [
    [1, 1, false], // [ratio to his note, share, dies as he falls]
    [16 / 15, 0.55, true],
  ],
  SCOOP: 0.94,
  SCOOP_SEC: 0.035,
  VIB_HZ: [6.5, 4.2],
  VIB_DEPTH: [12, 45], // cents
  HP_HZ: 600,
  PEAK_HZ: 3200,
  PEAK_DB: 5,
  LP_FROM_HZ: 8000,
  LP_TO_HZ: 2600,
};

/**
 * A stabber's death, Empty shell, from audio time `at`, its pluck on the
 * eye's shut (StabberShell.js's shellShutAt, from the same record).
 * @param {AudioContext} ctx
 * @param {AudioNode} out the effects' bus
 * @param {object} o { at, record (StabberDeath.js), noise (an AudioBuffer),
 *   volume (1: the studies page's level, plus TRIM_DB), pan (-1..1) }
 */
export function stabberShell(ctx, out, { at, record, noise, volume, pan }) {
  const S = SHELL_SOUND;
  const [bus, panner] = placed(ctx, out, volume * dB(S.TRIM_DB), pan, at);
  const nodes = [bus, panner];
  const off = S.NOISE_FROM_SEC + record.seed;
  const burst = (t0, sec, type, f, q, peak, decay, from) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = type;
    band.frequency.setValueAtTime(f, t0);
    band.Q.setValueAtTime(q, t0);
    const g = ctx.createGain();
    // Silent before its first event too: else, where the source's start and
    // the event round to different frames, a raw sample of noise gets out
    g.gain.value = SILENT;
    g.gain.setValueAtTime(SILENT, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + S.CLICK_ATTACK_SEC);
    g.gain.exponentialRampToValueAtTime(SILENT, t0 + decay);
    src.connect(band).connect(g).connect(bus);
    src.start(t0, off + from);
    src.stop(t0 + sec);
    nodes.push(src, band, g);
  };
  // The crack: snaps of bright noise, a few ms apart
  for (const [dt, f, peak] of S.CRACK) {
    burst(
      at + dt,
      S.CRACK_SEC,
      'bandpass',
      f,
      S.CRACK_Q,
      peak,
      S.CRACK_DECAY_SEC,
      dt
    );
  }
  // White-hot: the spike's hiss as it cools
  if (record.hot) {
    burst(
      at + S.SIZZLE_DELAY_SEC,
      S.SIZZLE_SEC + S.TAIL_SEC,
      'highpass',
      S.SIZZLE_HZ,
      0.7,
      S.SIZZLE,
      S.SIZZLE_SEC,
      S.SIZZLE_NOISE_SEC
    );
  }
  // The glide: his bowed cluster on his sour note, falling onto the hum's
  // fifth, the sour semitone above it dying away as it falls
  const t0 = at + S.GLIDE_DELAY_SEC;
  const f0 = hz(S.NOTE, at) * (record.hot ? S.HOT_BEND : 1);
  const f1 = hz(S.LAND, at);
  const fall0 = t0 + S.FALL_FROM_SEC;
  const fall1 = t0 + S.FALL_SEC;
  const shut = at + shellShutAt(record);
  // Cut off as the eye shuts, never before it has landed
  const stop = Math.max(fall1 + S.RELEASE_SEC, Math.min(at + S.MAX_SEC, shut));
  const end = stop + S.RELEASE_SEC;
  // The fall: a sigh, slow off his note, sagging, settling onto the fifth
  const fall = Float32Array.from(
    { length: S.FALL_STEPS + 1 },
    (_, i) => (f1 / f0) ** smooth(i / S.FALL_STEPS)
  );
  const level = ctx.createGain();
  level.gain.value = SILENT;
  level.gain.setValueAtTime(SILENT, t0);
  level.gain.exponentialRampToValueAtTime(S.PEAK, t0 + S.ATTACK_SEC);
  level.gain.exponentialRampToValueAtTime(S.PEAK * S.BODY, t0 + S.BODY_SEC);
  level.gain.exponentialRampToValueAtTime(S.PEAK * S.LANDED, fall1);
  level.gain.setValueAtTime(S.PEAK * S.LANDED, stop - S.RELEASE_SEC);
  level.gain.exponentialRampToValueAtTime(SILENT, end);
  level.connect(bus);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(S.HP_HZ, t0);
  const lift = ctx.createBiquadFilter();
  lift.type = 'peaking';
  lift.frequency.setValueAtTime(S.PEAK_HZ, t0);
  lift.Q.setValueAtTime(1, t0);
  lift.gain.setValueAtTime(S.PEAK_DB, t0);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(S.LP_FROM_HZ, t0);
  lp.frequency.exponentialRampToValueAtTime(S.LP_TO_HZ, fall1);
  hp.connect(lift).connect(lp).connect(level);
  nodes.push(level, hp, lift, lp);
  // A vibrato that widens and slows as he goes
  const vib = ctx.createOscillator();
  vib.frequency.setValueAtTime(S.VIB_HZ[0], t0);
  vib.frequency.linearRampToValueAtTime(S.VIB_HZ[1], fall1);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, t0);
  depth.gain.linearRampToValueAtTime(S.VIB_DEPTH[0], fall0);
  depth.gain.linearRampToValueAtTime(S.VIB_DEPTH[1], fall1);
  vib.connect(depth);
  nodes.push(vib, depth);
  const sources = [vib];
  for (const [ratio, share, dies] of S.CLUSTER) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(share / S.CENTS.length, t0);
    if (dies) g.gain.linearRampToValueAtTime(SILENT, fall1);
    g.connect(hp);
    nodes.push(g);
    for (const c of S.CENTS) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const k = ratio * 2 ** (c / 1200);
      o.frequency.setValueAtTime(f0 * k * S.SCOOP, t0);
      o.frequency.exponentialRampToValueAtTime(f0 * k, t0 + S.SCOOP_SEC);
      o.frequency.setValueCurveAtTime(
        fall.map((r) => f0 * k * r),
        fall0,
        fall1 - fall0
      );
      // the vibrato in cents, so it scales with the falling pitch
      depth.connect(o.detune);
      o.connect(g);
      nodes.push(o);
      sources.push(o);
    }
  }
  for (const x of sources) {
    x.start(t0);
    x.stop(end + S.TAIL_SEC);
  }
  // The eye shuts: one pluck on the fifth he fell to
  const pl = ctx.createOscillator();
  pl.type = 'sawtooth';
  pl.frequency.setValueAtTime(f1, shut);
  const plp = ctx.createBiquadFilter();
  plp.type = 'lowpass';
  plp.Q.setValueAtTime(S.PLUCK_Q, shut);
  plp.frequency.setValueAtTime(S.PLUCK_LP_HZ[0], shut);
  plp.frequency.exponentialRampToValueAtTime(
    S.PLUCK_LP_HZ[1],
    shut + S.PLUCK_LP_SEC
  );
  const pg = ctx.createGain();
  pg.gain.value = SILENT;
  pg.gain.setValueAtTime(SILENT, shut);
  pg.gain.exponentialRampToValueAtTime(S.PLUCK, shut + S.PLUCK_ATTACK_SEC);
  pg.gain.exponentialRampToValueAtTime(SILENT, shut + S.PLUCK_SEC);
  pl.connect(plp).connect(pg).connect(bus);
  pl.start(shut);
  pl.stop(shut + S.PLUCK_SEC + S.TAIL_SEC);
  nodes.push(pl, plp, pg);
  // The last to end frees them all
  disconnectWhenEnded(shut + S.PLUCK_SEC > end ? pl : vib, nodes);
}

// A stabber's death, Gold shatter: his strings plucked as a cluster round his
// sour note (b5), the players a hair apart. The sour notes die at once; the
// fifth, which was always in his cluster (his stab's semitone above b5 is
// the hum's fifth), rings on: with him gone his grind resolves into the
// hum. His spike's last jab, his own pizzicato at a whisper; a dry crumble
// of bone when it goes
const SHATTER_SOUND = {
  // Its level in feedback's events window: about 2 dB over the kick, beside
  // the tank's death (tests/audio-levels.test.js; -1.8 dB at the page's level)
  TRIM_DB: 3.8,
  // The cluster round his note: [degree, octave, cents, level, onset s]. The
  // players pluck a hair apart (a rake), his note first, on the eighth
  SOUR: [
    ['b5', 6, -8, 1, 0],
    ['4', 6, 0, 0.7, 0.004],
    ['b5', 6, 7, 1, 0.007],
    ['b6', 6, 0, 0.7, 0.011],
  ],
  SOUR_PEAK: 0.055,
  SOUR_SEC: 0.17,
  SOUR_SAG: 0.985, // they sag as they die
  // The fifth rings on (in his cluster all along), and an octave under it
  RING: [
    ['5', 6, 0, 1, 0.002],
    ['5', 5, 0, 0.5, 0.009],
  ],
  RING_PEAK: 0.06,
  RING_HOLD: 0.6, // a pluck's drop to this share, then a long ring
  RING_DROP_SEC: 0.12,
  RING_TAU: 0.24,
  RING_SEC: 1.1, // by here it is 40 dB under its peak: it stops
  VIB_HZ: 5.5,
  VIB_DEPTH: 0.005, // of the pitch, growing in
  VIB_SEC: 0.35,
  ATTACK_SEC: 0.003,
  LP: { FROM: 6000, HOT: 8500, TO: 1000, SEC: 0.09, Q: 5 },
  RING_LP: { FROM: 7000, TO: 2600, SEC: 0.35, Q: 1.2 },
  HP_HZ: 600, // nothing near the kick
  SNAP: { HZ: 4200, Q: 1.2, PEAK: 0.09, HOT: 0.13, SEC: 0.03 }, // the shell cracking
  HISS: { HZ: 5500, PEAK: 0.018, SEC: 0.45, DELAY_SEC: 0.02 }, // white-hot: the spike hisses as it cools
  JAB_VOLUME: 0.3, // of his pluck in play (CONFIG.STABBER.PLUCK_VOLUME)
  JAB_NOISE_AT: 1.6, // s into the noise, for the jab's tick
  CRUMBLE: { N: 5, EVERY: 0.017, HZ: 3000, Q: 1.4, PEAK: 0.09, SEC: 0.025 },
  NOISE_AT: [0.4, 0.9, 1.3], // s into the noise: snap, hiss, crumble
  TAIL_SEC: 0.02,
};

/**
 * A stabber's death, Gold shatter, from audio time `at`: its jab and its
 * crumble on the picture's eighths (StabberShatter.js's shatterTimes, from
 * the same record).
 * @param {AudioContext} ctx
 * @param {AudioNode} out the effects' bus
 * @param {object} o { at, record (StabberDeath.js), noise (an AudioBuffer),
 *   volume (1: the studies page's level, plus TRIM_DB), pan (-1..1) }
 */
export function stabberShatter(ctx, out, { at, record, noise, volume, pan }) {
  const S = SHATTER_SOUND;
  const [placedGain, panner] = placed(
    ctx,
    out,
    volume * dB(S.TRIM_DB),
    pan,
    at
  );
  const bus = ctx.createBiquadFilter();
  bus.type = 'highpass';
  bus.frequency.setValueAtTime(S.HP_HZ, at);
  bus.connect(placedGain);
  const nodes = [placedGain, panner, bus];
  const ends = []; // [source, when it stops]
  // Silent from the start: a gain left at 1 lets a source's first sample
  // through (a highpass passes it whole: a click)
  const shape = (g, t0, peak, sec) => {
    g.gain.value = SILENT;
    g.gain.setValueAtTime(SILENT, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + S.ATTACK_SEC);
    g.gain.exponentialRampToValueAtTime(SILENT, t0 + sec);
  };
  const lowpass = (t0, P, from) => {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.setValueAtTime(P.Q, t0);
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(P.TO, t0 + P.SEC);
    return f;
  };
  // A plucked string: a saw through a closing lowpass; with vib, it rings
  const pluckOf = (
    [deg, oct, cents, level, onset],
    peak,
    sec,
    P,
    from,
    sag,
    vib
  ) => {
    const t0 = at + onset;
    const f = hz([deg, oct], at) * 2 ** (cents / 1200);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t0);
    if (sag !== 1) o.frequency.exponentialRampToValueAtTime(f * sag, t0 + sec);
    if (vib) {
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t0);
      depth.gain.linearRampToValueAtTime(f * S.VIB_DEPTH, t0 + S.VIB_SEC);
      vib.connect(depth);
      depth.connect(o.frequency);
      nodes.push(depth);
    }
    const lp = lowpass(t0, P, from);
    const g = ctx.createGain();
    if (vib) {
      g.gain.value = SILENT;
      g.gain.setValueAtTime(SILENT, t0);
      g.gain.exponentialRampToValueAtTime(peak * level, t0 + S.ATTACK_SEC);
      const hold = t0 + S.RING_DROP_SEC;
      g.gain.exponentialRampToValueAtTime(peak * level * S.RING_HOLD, hold);
      g.gain.setTargetAtTime(0, hold, S.RING_TAU);
    } else shape(g, t0, peak * level, sec);
    o.connect(lp);
    lp.connect(g);
    g.connect(bus);
    o.start(t0);
    o.stop(t0 + sec + S.TAIL_SEC);
    nodes.push(o, lp, g);
    ends.push([o, t0 + sec + S.TAIL_SEC]);
  };
  const burst = (t0, type, freq, q, peak, sec, offset) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    f.Q.setValueAtTime(q, t0);
    const g = ctx.createGain();
    shape(g, t0, peak, sec);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t0, offset);
    src.stop(t0 + sec + S.TAIL_SEC);
    nodes.push(src, f, g);
    ends.push([src, t0 + sec + S.TAIL_SEC]);
  };
  const hot = record.hot;
  const lpFrom = hot ? S.LP.HOT : S.LP.FROM;
  for (const v of S.SOUR) {
    pluckOf(v, S.SOUR_PEAK, S.SOUR_SEC, S.LP, lpFrom, S.SOUR_SAG);
  }
  const vib = ctx.createOscillator();
  vib.frequency.setValueAtTime(S.VIB_HZ, at);
  for (const v of S.RING) {
    pluckOf(v, S.RING_PEAK, S.RING_SEC, S.RING_LP, S.RING_LP.FROM, 1, vib);
  }
  vib.start(at);
  vib.stop(at + S.RING_SEC + S.TAIL_SEC);
  nodes.push(vib);
  burst(
    at,
    'bandpass',
    S.SNAP.HZ,
    S.SNAP.Q,
    hot ? S.SNAP.HOT : S.SNAP.PEAK,
    S.SNAP.SEC,
    S.NOISE_AT[0]
  );
  if (hot) {
    burst(
      at + S.HISS.DELAY_SEC,
      'highpass',
      S.HISS.HZ,
      0.7,
      S.HISS.PEAK,
      S.HISS.SEC,
      S.NOISE_AT[1]
    );
  }
  // The spike's last pathetic jab, then its crumble: on the picture's eighths
  const { jab, crumble } = shatterTimes(record);
  pluck(ctx, placedGain, {
    at: at + jab,
    volume: S.JAB_VOLUME * CONFIG.STABBER.PLUCK_VOLUME,
    pan: 0,
    noise,
    offset: S.JAB_NOISE_AT,
  });
  for (let i = 0; i < S.CRUMBLE.N; i++) {
    const k = 1 - i / S.CRUMBLE.N;
    burst(
      at + crumble + i * S.CRUMBLE.EVERY,
      'bandpass',
      S.CRUMBLE.HZ * (1 + 0.25 * (i % 2)),
      S.CRUMBLE.Q,
      S.CRUMBLE.PEAK * k,
      S.CRUMBLE.SEC,
      S.NOISE_AT[2] + i * 0.03
    );
  }
  // The last to stop frees them all (the jab frees its own)
  const [last] = ends.reduce((a, b) => (b[1] > a[1] ? b : a));
  disconnectWhenEnded(last, nodes);
}

// A bassist's death, Ink cloud (BassistInk.js), from the studies page's
// death-ink.js: his FM bass blurting a fluttering raspberry from his 5 down
// to his b3 under a squirt of ink; on each middle jet of his scroll a ghost
// pluck of his and a small squirt; on its fizzle a last squirt and his last
// note, sounding on his b3 and bent down onto the hum's root (gains at the
// page's deaths' bus; TRIM_DB sets the whole in feedback's events window)
const INK_SOUND = {
  // Its level in feedback's events window: about 2 dB over the kick, beside
  // the tank's and the stabber's deaths (tests/audio-levels.test.js; +5.8 dB
  // at the page's level, where the stand-in's twang sat)
  TRIM_DB: -3.8,
  NOISE_FROM_SEC: 0.3, // into the noise, plus his seed (s): it reads under 2 s
  BLURT: {
    FROM: ['5', 2],
    TO: ['b3', 2],
    PEAK: 0.22,
    ATTACK_SEC: 0.004,
    HOLD_SEC: 0.06,
    DECAY: 0.06,
    SEC: 0.4,
    BEND_SEC: 0.16,
    INDEX: [5, 0.9], // bright as it blurts, rounder as it goes
    INDEX_SEC: 0.14,
    FLUTTER: 0.5, // a raspberry: his note fluttering...
    FLUTTER_HZ: 27, // ...this fast
  },
  // A squirt of ink: noise through a band falling fast
  SQUIRT: {
    PEAK: 0.17,
    ATTACK_SEC: 0.003,
    HOLD_SEC: 0.02,
    DECAY: 0.05,
    Q: 1.3,
    HP_HZ: 200,
    FROM_HZ: 2400,
    TO_HZ: 500,
    SEC: 0.18,
    TAIL_SEC: 0.1,
  },
  // A middle jet of his scroll (not the one hard on the blurt: it is in it)
  JET: {
    FROM_SEC: 0.2,
    NOTE: ['5', 2],
    PLUCK: 0.35,
    SQUIRT: 0.06,
    SQUIRT_SEC: 0.1,
  },
  LAST: {
    FROM: ['b3', 2],
    TO: ['1', 2],
    PEAK: 0.11,
    ATTACK_SEC: 0.003,
    HOLD_SEC: 0.05,
    DECAY: 0.13,
    BEND_FROM_SEC: 0.04, // it sounds on his b3, then bends
    BEND_SEC: 0.24,
    INDEX: [2.4, 0.7],
    INDEX_SEC: 0.12,
    SEC: 0.6,
    SQUIRT: 0.05, // the fizzle's last squirt
    SQUIRT_SEC: 0.1,
  },
};

/**
 * A bassist's death, Ink cloud, from audio time `at`: the blurt there, his
 * scroll's jets and its fizzle at `at` plus their offsets in the record
 * (BassistDeath.js's bassistDeathRecord).
 * @param {AudioContext} ctx
 * @param {AudioNode} out the effects' bus
 * @param {object} o { at, record, noise (an AudioBuffer), volume (1: its
 *   level in feedback's events window), pan (-1..1) }
 */
export function bassistInk(ctx, out, { at, record, noise, volume, pan }) {
  const S = INK_SOUND;
  const B = S.BLURT;
  const L = S.LAST;
  // Everything worked out before the first node, so a bad value plays nothing
  const tLast = at + record.fizzle;
  const jets = record.jets
    .slice(1, -1)
    .filter((a) => a >= S.JET.FROM_SEC)
    .map((a) => at + a);
  const blurt = [hz(B.FROM, at), hz(B.TO, at)];
  const lastNote = [hz(L.FROM, tLast), hz(L.TO, tLast)];
  const last0 = lastNote[0];
  const level = volume * dB(S.TRIM_DB);
  // (his band pluck knob too: the jets' plucks read it, after the blurt starts)
  const knob = CONFIG.BAND.BASS_PLUCK_DB;
  for (const v of [...blurt, ...lastNote, level, tLast, knob, ...jets]) {
    if (!Number.isFinite(v)) throw new Error(`bassistInk: ${v} at ${at}`);
  }
  const [bus, panner] = placed(ctx, out, level, pan, at);
  const nodes = [bus, panner];
  const gainNode = (v) => {
    const g = ctx.createGain();
    g.gain.value = v;
    nodes.push(g);
    return g;
  };
  // A struck envelope: up to `peak`, held, then falling away
  const struck = (t, peak, attack, hold, decay) => {
    const g = gainNode(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0, t + hold, decay);
    return g;
  };
  // Every source stops by `stop`, which keeps the last of them: it frees all
  let last = null;
  let lastStop = -Infinity;
  const stop = (src, t) => {
    src.stop(t);
    if (t >= lastStop) [last, lastStop] = [src, t];
  };
  const squirt = (t, peak, sec) => {
    const Q = S.SQUIRT;
    const n = ctx.createBufferSource();
    n.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = Q.HP_HZ;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = Q.Q;
    bp.frequency.setValueAtTime(Q.FROM_HZ, t);
    bp.frequency.exponentialRampToValueAtTime(Q.TO_HZ, t + sec);
    const e = struck(
      t,
      peak,
      Q.ATTACK_SEC,
      Q.HOLD_SEC,
      Q.DECAY * (sec / Q.SEC)
    );
    n.connect(hp).connect(bp).connect(e).connect(bus);
    n.start(t, S.NOISE_FROM_SEC + record.seed);
    stop(n, t + sec + Q.TAIL_SEC);
    nodes.push(n, hp, bp);
  };
  // His FM bass: a sine whose frequency a sine of its own bends, on `from`
  // Hz until bendAt, then bending to `to` over bendSec; the bend's depth
  // (Hz) falls from depth[0] to depth[1] over depthSec
  const fm = (t, [from, to], bendAt, bendSec, depth, depthSec, sec, into) => {
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    for (const o of [car, mod]) {
      o.frequency.setValueAtTime(from, t);
      o.frequency.setValueAtTime(from, bendAt);
      o.frequency.exponentialRampToValueAtTime(to, bendAt + bendSec);
    }
    const idx = gainNode(depth[0]);
    idx.gain.setValueAtTime(depth[0], t);
    idx.gain.exponentialRampToValueAtTime(depth[1], t + depthSec);
    mod.connect(idx).connect(car.frequency);
    car.connect(into);
    for (const o of [car, mod]) {
      o.start(t);
      stop(o, t + sec);
    }
    nodes.push(car, mod);
  };

  // The blurt: fluttering, under a squirt of ink through his slits
  {
    const e = struck(at, B.PEAK, B.ATTACK_SEC, B.HOLD_SEC, B.DECAY);
    const flutter = gainNode(1 - B.FLUTTER);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = B.FLUTTER_HZ;
    lfo.connect(gainNode(B.FLUTTER)).connect(flutter.gain);
    lfo.start(at);
    stop(lfo, at + B.SEC);
    nodes.push(lfo);
    flutter.connect(e).connect(bus);
    const depth = [B.INDEX[0] * blurt[0], B.INDEX[1] * blurt[1]];
    fm(at, blurt, at, B.BEND_SEC, depth, B.INDEX_SEC, B.SEC, flutter);
    squirt(at, S.SQUIRT.PEAK, S.SQUIRT.SEC);
  }
  // His scroll's middle jets: a ghost pluck of his, into this bus (it frees
  // its own nodes), and a small squirt
  for (const t of jets) {
    SYNTHS.bassPluck(ctx, bus, null, {
      at: t,
      note: S.JET.NOTE,
      volume: S.JET.PLUCK,
      pan: 0,
    });
    squirt(t, S.JET.SQUIRT, S.JET.SQUIRT_SEC);
  }
  // Its fizzle, as its lure goes out: a last squirt and his last note, a
  // pluck on his b3 bent down onto the hum's root as it is then
  squirt(tLast, L.SQUIRT, L.SQUIRT_SEC);
  const e = struck(tLast, L.PEAK, L.ATTACK_SEC, L.HOLD_SEC, L.DECAY);
  e.connect(bus);
  const depth = [L.INDEX[0] * last0, L.INDEX[1] * last0];
  fm(
    tLast,
    lastNote,
    tLast + L.BEND_FROM_SEC,
    L.BEND_SEC,
    depth,
    L.INDEX_SEC,
    L.SEC,
    e
  );
  // The last to stop frees them all
  disconnectWhenEnded(last, nodes);
}

/** A stabber's death sound by its style (StabberDeath.js's styles) */
export const STABBER_DEATH_SOUNDS = Object.freeze({
  shatter: stabberShatter,
  shell: stabberShell,
});
