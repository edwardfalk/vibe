/**
 * The bomb's sounds, on the hum's notes (Harmony.js). The cloud's: a fire's
 * crackle, ported from `smokeSound` in
 * docs/superpowers/specs/2026-10-08-explosion-studies/clouds.js (git-ignored;
 * the page is https://claude.ai/artifact/GHjWCySGwv8cVCtWDoE6nV); the spec is
 * docs/superpowers/specs/2026-10-09-bomb-kill-design.md. From the port on,
 * these constants are the authority.
 *
 * Procedural only: oscillators, noise and filters. The noise is the crash's
 * (CrashSynth.js), so a sound draws none of the game's random numbers. Each
 * builds its own nodes into `out` through its own placed bus.
 */
import { hz } from './Harmony.js';
import { mulberry32 } from '../mathUtils.js';
import { placed } from './DeathSounds.js';
import { disconnectWhenEnded } from './CrashSynth.js';

const SILENT = 0.0001; // exponential ramps can't reach 0
const STOP_TAU = 0.05; // a stopped sound fades this fast
const STOP_SEC = 0.3; // and its sources stop this long after

// The cloud: a low rumble of smoke (noise under 180 Hz), a soft triangle on
// the root that breathes with the beat, and crackles: most eighths while
// the plasma burns, a few stray ones in the smoulder. Its levels while the
// plasma burns, then through the smoulder; it is gone at the cloud's end.
const SMOKE = {
  RUMBLE: [0.32, 0.08],
  RUMBLE_HZ: 180,
  RUMBLE_RATE: 0.9, // the noise read a little slow
  RUMBLE_FROM: 0.3, // s into the noise
  TONE: [0.016, 0.003],
  TONE_ATTACK_SEC: 0.25,
  TONE_LP_HZ: 300,
  BREATHE: [0.75, 0.25], // the tone's level and how much it swells with the beat
  CRACKLE_ODDS: [0.85, 0.3], // of an eighth, burning and smouldering
  CRACKLE_LEVEL: [0.09, 0.04],
  CRACKLE_HZ: [1800, 2600], // from, and up to this much higher
  CRACKLE_Q: 2.5,
  CRACKLE_LATE: 0.3, // the share that lands an eighth of a beat after
  CRACKLE_LEVEL_MIN: 0.4, // a crackle is this to 1 times its level, at random
  NOISE_SKIP: 7.31, // where in the noise a crackle reads: its time times this
  LATE_BEATS: 1 / 8,
  CRACKLE_SEC: [0.012, 0.02], // decay, and up to this much longer
  CRACKLE_ATTACK_SEC: 0.002,
  BED_ATTACK_SEC: 0.02,
  BURN_HOLD_SEC: 0.4, // the burn's level holds until this before the plasma ends
  STEP_SEC: 0.3, // then falls to the smoulder's over this
  NOISE_LOOP_SEC: 1.9, // offsets into the noise wrap here
  SEED_STEPS: 1e9,
  SEED_SALT: 5,
};

/**
 * The bomb's cloud, from audio time `at` to the end of its debris.
 * @param {AudioContext} ctx
 * @param {AudioNode} out the effects' bus
 * @param {object} o { at, noise (an AudioBuffer), volume (1: the page's
 *   level), pan (-1..1), beatSec, plasmaSec, debrisSec, seed (0..1) }
 * @returns {{ stop(): void }} fades it out at once and lets its nodes go
 */
export function cloudSound(
  ctx,
  out,
  { at, noise, volume, pan, beatSec, plasmaSec, debrisSec, seed }
) {
  const [bus, panner] = placed(ctx, out, volume, pan, at);
  const nodes = [bus, panner];
  const sources = [];
  let last = null; // the source that ends last
  let lastEnd = -Infinity;
  const P = plasmaSec;
  const D = debrisSec;
  // A gain that follows the cloud: `burn` until the plasma ends, `smoulder`
  // after, down to nothing at its end
  const bed = ([burn, smoulder], attack = SMOKE.BED_ATTACK_SEC) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(burn, at + attack);
    g.gain.setValueAtTime(burn, at + P - SMOKE.BURN_HOLD_SEC);
    g.gain.exponentialRampToValueAtTime(smoulder, at + P + SMOKE.STEP_SEC);
    g.gain.linearRampToValueAtTime(0, at + D);
    g.connect(bus);
    nodes.push(g);
    return g;
  };
  const source = (node, from, dur, offset) => {
    node.start(from, offset);
    node.stop(from + dur);
    sources.push(node);
    nodes.push(node);
    if (from + dur >= lastEnd) {
      lastEnd = from + dur;
      last = node;
    }
    return node;
  };
  const noiseFrom = (from, dur, offset = 0, rate = 1) => {
    const n = ctx.createBufferSource();
    n.buffer = noise;
    n.loop = true;
    n.playbackRate.value = rate;
    return source(n, from, dur, offset % SMOKE.NOISE_LOOP_SEC);
  };
  const filter = (type, f, q = 0.7) => {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    nodes.push(b);
    return b;
  };
  const osc = (type, f, from, dur) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    return source(o, from, dur);
  };

  // The rumble
  noiseFrom(at, D, SMOKE.RUMBLE_FROM, SMOKE.RUMBLE_RATE)
    .connect(filter('lowpass', SMOKE.RUMBLE_HZ))
    .connect(bed(SMOKE.RUMBLE));
  // The root, breathing with the beat
  const tone = bed(SMOKE.TONE, SMOKE.TONE_ATTACK_SEC);
  const breathe = ctx.createGain();
  breathe.gain.value = SMOKE.BREATHE[0];
  const depth = ctx.createGain();
  depth.gain.value = SMOKE.BREATHE[1];
  nodes.push(breathe, depth);
  osc('sine', 1 / beatSec, at, D)
    .connect(depth)
    .connect(breathe.gain);
  osc('triangle', hz(['1', 2], at), at, D)
    .connect(filter('lowpass', SMOKE.TONE_LP_HZ))
    .connect(breathe)
    .connect(tone);
  // The crackles, on the eighths
  const rnd = mulberry32(Math.floor(seed * SMOKE.SEED_STEPS) + SMOKE.SEED_SALT);
  const eighth = beatSec / 2;
  for (let n = 1; n * eighth < D; n++) {
    const t = n * eighth;
    const burning = t < P;
    const odds = burning
      ? SMOKE.CRACKLE_ODDS[0]
      : SMOKE.CRACKLE_ODDS[1] * (1 - t / D);
    if (rnd() > odds) continue;
    const level =
      (burning ? SMOKE.CRACKLE_LEVEL[0] : SMOKE.CRACKLE_LEVEL[1]) *
      (SMOKE.CRACKLE_LEVEL_MIN + (1 - SMOKE.CRACKLE_LEVEL_MIN) * rnd()) *
      (burning ? 1 : 1 - t / D);
    const late = rnd() < SMOKE.CRACKLE_LATE ? beatSec * SMOKE.LATE_BEATS : 0;
    const when = at + t + late;
    const f = SMOKE.CRACKLE_HZ[0] + SMOKE.CRACKLE_HZ[1] * rnd();
    const decay = SMOKE.CRACKLE_SEC[0] + SMOKE.CRACKLE_SEC[1] * rnd();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(level, when + SMOKE.CRACKLE_ATTACK_SEC);
    g.gain.exponentialRampToValueAtTime(
      SILENT,
      when + SMOKE.CRACKLE_ATTACK_SEC + decay
    );
    nodes.push(g);
    noiseFrom(
      when,
      SMOKE.CRACKLE_ATTACK_SEC + decay + STOP_SEC,
      (when * SMOKE.NOISE_SKIP) % SMOKE.NOISE_LOOP_SEC
    )
      .connect(filter('bandpass', f, SMOKE.CRACKLE_Q))
      .connect(g)
      .connect(bus);
  }

  let stopped = false;
  // The last source to end lets every node go
  disconnectWhenEnded(last, nodes);
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      bus.gain.cancelScheduledValues?.(now);
      bus.gain.setTargetAtTime(0, now, STOP_TAU);
      for (const s of sources) {
        try {
          s.stop(now + STOP_SEC);
        } catch {
          // already stopped
        }
      }
    },
  };
}
