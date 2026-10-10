/**
 * The stabber's strings: a horror-film string section on his own note, the
 * sour b5 outside the hum's scale (Harmony.js's DEGREES.b5, which the hum's
 * design reserved for the stabber's attack), all in octave 6 (1.85 to 2.48
 * kHz over the hum's roots), clear of the grunts' shots. A tremolo through
 * his wind-up, a stab at the lock, a screech at the lunge with an echo a
 * sixteenth later, a pizzicato when his spike lands.
 *
 * Ported from the prototype harness's stab(), tremolo() and pluck() in
 * docs/superpowers/specs/2026-10-07-stabber-studies/ (git-ignored); the spec
 * is docs/superpowers/specs/2026-10-08-shiv-stabber-design.md. The tremolo
 * and the pizzicato are an octave above the page's.
 *
 * Procedural only. Each part builds its nodes into `out` through placed()
 * (its volume and pan on the output gain, so a volume of 0 is silence) and
 * frees them when it ends. The noise is the crash's seeded buffer, read
 * from an offset the caller derives from a seed, so the strings draw none
 * of the game's random numbers.
 */
import { hz } from './Harmony.js';
import { placed } from './DeathSounds.js';
import { disconnectWhenEnded } from './CrashSynth.js';

const NOTE = ['b5', 6]; // the stab and the screech
// The tremolo and the pizzicato: an octave above the page's (its
// STRINGS.LOW); set this to ['b5', 5] to move them back
const TREM_PLUCK_NOTE = ['b5', 6];
const SILENT = 0.0001; // exponential ramps can't reach 0
const TAIL_SEC = 0.02; // sources stop this long after they fade out
const CENTS_PER_OCTAVE = 1200;
const NOISE_END = 0.001; // a noise burst fades to this
// Psycho's shower: three saws a few cents apart on the note, and three on
// the semitone above at a share of the level (a cluster); a scoop up into
// the pitch, a vibrato growing after it, a bow's scrape of noise
const STAB = {
  PEAK: 0.12,
  ATTACK_SEC: 0.007,
  HALF_SEC: 0.06, // down to half its peak by here
  SEC: 0.14,
  CENTS: [-7, 0, 6],
  CLUSTER: [
    [1, 1],
    [16 / 15, 0.55],
  ], // [ratio to the note, share of the level]
  SCOOP: 0.94, // it starts this far under its pitch
  SCOOP_SEC: 0.035,
  VIB_HZ: 6.5,
  VIB_DEPTH: 0.009, // of the pitch
  VIB_SEC: 0.1, // the vibrato grows in over this
  HP_HZ: 700,
  PEAK_HZ: 3200,
  PEAK_Q: 1,
  PEAK_DB: 5,
  LP_HZ: 8000,
  SCRAPE: 0.6, // the bow's noise, of the peak
  SCRAPE_BAND: 1.6, // its band, times the note
  SCRAPE_SEC: 0.03,
};
// The screech: the stab bent up over longer, and its echo a sixteenth later
const SCREECH = {
  GLISS: 1.06,
  SEC: 0.2,
  ECHO: 0.7, // of the peak
  ECHO_SEC: 0.16,
  ECHO_BEATS: 0.25,
};
// Through the wind-up: two saws trembling, growing, cut at the lock
const TREM = {
  FROM: 0.015,
  TO: 0.09,
  HZ: 14,
  DEPTH: 0.5, // the tremolo swings the level by this either way
  CENTS: [-8, 7],
  SAW: 0.5, // each saw's share
  HP_HZ: 900,
  PEAK_HZ: 3600,
  PEAK_Q: 1,
  PEAK_DB: 7,
  END_SEC: 0.01, // it peaks this long before the lock
  FADE_SEC: 0.015, // and fades out over this, at the lock or when cut
  // Cut this far before its start, it never sounds; this thread's clock
  // trails the audio thread's, so a cut nearer its start fades instead
  EARLY_CUT_SEC: 0.02,
  STOP_SEC: 0.03, // its sources stop this long after the lock
};
// The spike lands: a plucked saw closing fast, and a tick
const PLUCK = {
  PEAK: 0.22,
  ATTACK_SEC: 0.003,
  SEC: 0.16,
  LP_FROM_HZ: 5200,
  LP_TO_HZ: 700,
  LP_SEC: 0.09,
  LP_Q: 6,
  TICK: 0.12,
  TICK_HZ: 3500,
  TICK_SEC: 0.02,
};
/** The longest stretch of noise a part reads, s: offsets stay this far from the buffer's end */
export const STRINGS_NOISE_SEC = STAB.SCRAPE_SEC + TAIL_SEC;

const cents = (c) => 2 ** (c / CENTS_PER_OCTAVE);

function filter(ctx, type, freq, at, nodes) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, at);
  nodes.push(f);
  return f;
}

// A short burst of the noise through a filter into `into`
function noiseBurst(ctx, into, nodes, o, type, freq, peak, sec) {
  const src = ctx.createBufferSource();
  src.buffer = o.noise;
  const band = filter(ctx, type, freq, o.at, nodes);
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, o.at);
  g.gain.exponentialRampToValueAtTime(NOISE_END, o.at + sec);
  src.connect(band);
  band.connect(g);
  g.connect(into);
  src.start(o.at, o.offset);
  src.stop(o.at + sec + TAIL_SEC);
  nodes.push(src, g);
}

// The stab's recipe at o.at, peaking at `peak`, `sec` long, bent up by `gliss`
function bowed(ctx, out, o, peak, sec, gliss) {
  const { at } = o;
  const [bus, panner] = placed(ctx, out, o.volume, o.pan, at);
  const nodes = [bus, panner];
  const f = hz(NOTE, at);
  const env = ctx.createGain();
  env.gain.setValueAtTime(SILENT, at);
  env.gain.exponentialRampToValueAtTime(peak, at + STAB.ATTACK_SEC);
  env.gain.exponentialRampToValueAtTime(peak / 2, at + STAB.HALF_SEC);
  env.gain.exponentialRampToValueAtTime(SILENT, at + sec);
  nodes.push(env);
  const hp = filter(ctx, 'highpass', STAB.HP_HZ, at, nodes);
  const lift = filter(ctx, 'peaking', STAB.PEAK_HZ, at, nodes);
  lift.Q.setValueAtTime(STAB.PEAK_Q, at);
  lift.gain.setValueAtTime(STAB.PEAK_DB, at);
  const lp = filter(ctx, 'lowpass', STAB.LP_HZ, at, nodes);
  hp.connect(lift);
  lift.connect(lp);
  lp.connect(env);
  env.connect(bus);
  const vib = ctx.createOscillator();
  vib.frequency.setValueAtTime(STAB.VIB_HZ, at);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(f * STAB.VIB_DEPTH, at + STAB.VIB_SEC);
  vib.connect(depth);
  nodes.push(vib, depth);
  const sources = [vib];
  for (const [ratio, share] of STAB.CLUSTER) {
    for (const c of STAB.CENTS) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const fr = f * ratio * cents(c);
      osc.frequency.setValueAtTime(fr * STAB.SCOOP, at);
      osc.frequency.exponentialRampToValueAtTime(fr, at + STAB.SCOOP_SEC);
      osc.frequency.exponentialRampToValueAtTime(fr * gliss, at + sec);
      depth.connect(osc.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(share / STAB.CENTS.length, at);
      osc.connect(g);
      g.connect(hp);
      nodes.push(osc, g);
      sources.push(osc);
    }
  }
  for (const s of sources) {
    s.start(at);
    s.stop(at + sec + TAIL_SEC);
  }
  noiseBurst(
    ctx,
    bus,
    nodes,
    o,
    'bandpass',
    f * STAB.SCRAPE_BAND,
    peak * STAB.SCRAPE,
    STAB.SCRAPE_SEC
  );
  // The vibrato stops with the saws, after the scrape: then all is silent
  disconnectWhenEnded(vib, nodes);
}

/**
 * The stab at the lock.
 * @param {AudioContext} ctx
 * @param {AudioNode} out the effects' bus
 * @param {object} o { at, volume (1: the page's level), pan (-1..1), noise
 *   (an AudioBuffer), offset (s into it) }
 */
export function stab(ctx, out, o) {
  bowed(ctx, out, o, STAB.PEAK, STAB.SEC, 1);
}

/** The screech at the lunge, and its echo a sixteenth later (o.beatSec: a beat, s) */
export function screech(ctx, out, o) {
  bowed(ctx, out, o, STAB.PEAK, SCREECH.SEC, SCREECH.GLISS);
  const echo = { ...o, at: o.at + o.beatSec * SCREECH.ECHO_BEATS };
  bowed(
    ctx,
    out,
    echo,
    STAB.PEAK * SCREECH.ECHO,
    SCREECH.ECHO_SEC,
    SCREECH.GLISS
  );
}

/** The pizzicato when the spike lands */
export function pluck(ctx, out, o) {
  const { at } = o;
  const [bus, panner] = placed(ctx, out, o.volume, o.pan, at);
  const nodes = [bus, panner];
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(hz(TREM_PLUCK_NOTE, at), at);
  const lp = filter(ctx, 'lowpass', PLUCK.LP_FROM_HZ, at, nodes);
  lp.Q.setValueAtTime(PLUCK.LP_Q, at);
  lp.frequency.exponentialRampToValueAtTime(PLUCK.LP_TO_HZ, at + PLUCK.LP_SEC);
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENT, at);
  g.gain.exponentialRampToValueAtTime(PLUCK.PEAK, at + PLUCK.ATTACK_SEC);
  g.gain.exponentialRampToValueAtTime(SILENT, at + PLUCK.SEC);
  osc.connect(lp);
  lp.connect(g);
  g.connect(bus);
  osc.start(at);
  osc.stop(at + PLUCK.SEC + TAIL_SEC);
  nodes.push(osc, g);
  noiseBurst(
    ctx,
    bus,
    nodes,
    o,
    'bandpass',
    PLUCK.TICK_HZ,
    PLUCK.TICK,
    PLUCK.TICK_SEC
  );
  disconnectWhenEnded(osc, nodes);
}

/**
 * The tremolo through his wind-up, from o.at to the lock (o.untilSec on),
 * where it fades out by itself. Returns its handle: stop() cuts it at once
 * with a short fade on a gain of its own, never touching the envelope; it
 * is safe to call any number of times, after the tremolo has ended too.
 */
export function tremolo(ctx, out, o) {
  const { at } = o;
  const until = at + o.untilSec;
  const [bus, panner] = placed(ctx, out, o.volume, o.pan, at);
  const cut = ctx.createGain();
  cut.gain.setValueAtTime(1, at);
  cut.connect(bus);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(TREM.FROM, at);
  amp.gain.linearRampToValueAtTime(TREM.TO, until - TREM.END_SEC);
  amp.gain.linearRampToValueAtTime(SILENT, until + TREM.FADE_SEC);
  amp.connect(cut);
  const swing = ctx.createGain();
  swing.gain.setValueAtTime(TREM.DEPTH, at);
  swing.connect(amp);
  const lfo = ctx.createOscillator();
  lfo.frequency.setValueAtTime(TREM.HZ, at);
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.setValueAtTime(TREM.DEPTH, at);
  lfo.connect(lfoDepth);
  lfoDepth.connect(swing.gain);
  const nodes = [bus, panner, cut, amp, swing, lfoDepth];
  const hp = filter(ctx, 'highpass', TREM.HP_HZ, at, nodes);
  const lift = filter(ctx, 'peaking', TREM.PEAK_HZ, at, nodes);
  lift.Q.setValueAtTime(TREM.PEAK_Q, at);
  lift.gain.setValueAtTime(TREM.PEAK_DB, at);
  hp.connect(lift);
  lift.connect(swing);
  const f = hz(TREM_PLUCK_NOTE, at);
  const sources = [lfo];
  for (const c of TREM.CENTS) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f * cents(c), at);
    const g = ctx.createGain();
    g.gain.setValueAtTime(TREM.SAW, at);
    osc.connect(g);
    g.connect(hp);
    nodes.push(osc, g);
    sources.push(osc);
  }
  for (const s of sources) {
    s.start(at);
    s.stop(until + TREM.STOP_SEC);
  }
  nodes.push(lfo);
  disconnectWhenEnded(lfo, nodes);
  let stopped = false;
  return {
    stop() {
      const now = ctx.currentTime;
      if (stopped || now >= until) return;
      stopped = true;
      // Booked on its beat and well before it: it never sounds
      if (at - now > TREM.EARLY_CUT_SEC) {
        for (const s of sources) s.stop(at);
        return;
      }
      // Its booked start, if still ahead, mustn't reopen the gain after the fade
      if (at > now) cut.gain.cancelScheduledValues(now);
      cut.gain.setValueAtTime(1, now);
      cut.gain.linearRampToValueAtTime(0, now + TREM.FADE_SEC);
      for (const s of sources) s.stop(now + TREM.FADE_SEC + TAIL_SEC);
    },
  };
}

/** The parts by name, as Audio.playStabberStrings plays them */
export const STRING_PARTS = { tremolo, stab, screech, pluck };
