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
 * deaths, ported from `death-shell.js` in
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
import { disconnectWhenEnded } from './CrashSynth.js';
import { hash01 } from '../entities/RusherRenderer.js';
import { shellShutAt } from '../entities/StabberShell.js';
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
// the events' window: his death line ducks it 6 dB, and Edward never heard
// it (docs/superpowers/specs/2026-10-10-mix-pass-design.md)
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

// Into `out` at `volume`, panned -1..1 (the stabber's strings use it too)
export function placed(ctx, out, volume, pan, at) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, at);
  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(pan, at);
  gain.connect(panner);
  panner.connect(out);
  return [gain, panner];
}

/**
 * A grunt's pop and whine at audio time `at`, its whine landing on `note`
 * ([degree, octave], with the hum's drift at `at`).
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
 * The Dude's last breath at audio time `at`, with the hum's drift then.
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
 * `note` ([degree, octave], with the hum's drift at `at`).
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
  TRIM_DB: 0, // the mix pass: this style's level in feedback's events window
  SILENT: 0.0001,
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
    g.gain.value = S.SILENT;
    g.gain.setValueAtTime(S.SILENT, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + S.CLICK_ATTACK_SEC);
    g.gain.exponentialRampToValueAtTime(S.SILENT, t0 + decay);
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
  level.gain.value = S.SILENT;
  level.gain.setValueAtTime(S.SILENT, t0);
  level.gain.exponentialRampToValueAtTime(S.PEAK, t0 + S.ATTACK_SEC);
  level.gain.exponentialRampToValueAtTime(S.PEAK * S.BODY, t0 + S.BODY_SEC);
  level.gain.exponentialRampToValueAtTime(S.PEAK * S.LANDED, fall1);
  level.gain.setValueAtTime(S.PEAK * S.LANDED, stop - S.RELEASE_SEC);
  level.gain.exponentialRampToValueAtTime(S.SILENT, end);
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
    if (dies) g.gain.linearRampToValueAtTime(S.SILENT, fall1);
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
  pg.gain.value = S.SILENT;
  pg.gain.setValueAtTime(S.SILENT, shut);
  pg.gain.exponentialRampToValueAtTime(S.PLUCK, shut + S.PLUCK_ATTACK_SEC);
  pg.gain.exponentialRampToValueAtTime(S.SILENT, shut + S.PLUCK_SEC);
  pl.connect(plp).connect(pg).connect(bus);
  pl.start(shut);
  pl.stop(shut + S.PLUCK_SEC + S.TAIL_SEC);
  nodes.push(pl, plp, pg);
  // The last to end frees them all
  disconnectWhenEnded(shut + S.PLUCK_SEC > end ? pl : vib, nodes);
}

/** A stabber's death sound by its style (StabberDeath.js's styles) */
export const STABBER_DEATH_SOUNDS = Object.freeze({ shell: stabberShell });
