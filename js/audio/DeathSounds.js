/**
 * The deaths' sounds, on the hum's notes (Harmony.js): a grunt's pop and
 * whine, and the Dude's last breath. Ported from the `balloon` and `lieback`
 * variants' sound() in docs/superpowers/specs/2026-10-05-death-studies/
 * (git-ignored); the spec is
 * docs/superpowers/specs/2026-10-07-deaths-design.md.
 *
 * Procedural only: oscillators, noise and filters. The noise is the crash's
 * (CrashSynth.js), so a death draws none of the game's random numbers. Each
 * sound builds its own nodes into `out` and disconnects them when it ends,
 * as the crash does.
 */
import { hz } from './Harmony.js';
import { disconnectWhenEnded } from './CrashSynth.js';

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
 * @param {AudioNode} out the effects' bus
 * @param {object} o { at, noise (an AudioBuffer), volume (1: the page's level) }
 */
export function lastBreath(ctx, out, { at, noise, volume }) {
  const [bus, panner] = placed(ctx, out, volume, 0, at);
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
