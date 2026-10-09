/**
 * The bomb's sounds, on the hum's notes (Harmony.js): its bang, ported from
 * `comic.sound` (bangs.js, with its helpers in bang-parts.js), and its cloud,
 * a fire's crackle, ported from `smokeSound` (clouds.js), in
 * docs/superpowers/specs/2026-10-08-explosion-studies/ (git-ignored;
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
import { CONFIG } from '../config.js';
import { placed } from './DeathSounds.js';
import { disconnectWhenEnded } from './CrashSynth.js';
import { RING_LANDS_SEC } from '../effects/explosions/BombBlast.js';
import { driveCurve } from './speech/effects.js';

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

// ---- the bang ------------------------------------------------------------------------
// A crack, the ink line of the sound; a thump falling an octave onto the root
// through a drive with the kick's curve; the fifth over it; a roar of noise
// falling from bright to dull, half of it into a short dark room; a low
// rumble above the kick's band; and when the ring hits the edge, a short
// thud, fifth to root. [degree, octave] notes with the hum's drift at `at`.
const BANG = {
  ROOT: ['1', 2],
  FIFTH: ['5', 2],
  // [type, f0, q, hp, peak, attack, tau] noise bursts and [f0 x, f1 x, glide, peak, attack, tau] tones
  CRACK: {
    type: 'bandpass',
    f0: 2400,
    q: 0.8,
    hp: 400,
    peak: 0.25,
    atk: 0.001,
    tau: 0.015,
  },
  // The thump and the fifth fall an octave (UP: 2) onto their notes
  THUMP: { UP: 2, glide: 0.06, peak: 0.075, atk: 0.004, tau: 0.25 },
  FIFTH_TONE: { UP: 2, glide: 0.06, peak: 0.06, atk: 0.002, tau: 0.18 },
  ROAR: {
    f0: 3500,
    f1: 180,
    glide: 0.9,
    q: 0.9,
    peak: 0.17,
    atk: 0.012,
    tau: 0.3,
    from: 0.2,
  },
  ROAR_ROOM: {
    f0: 3000,
    f1: 200,
    glide: 0.8,
    q: 0.9,
    peak: 0.3,
    atk: 0.012,
    tau: 0.3,
    from: 0.6,
  },
  RUMBLE: {
    f0: 240,
    f1: 120,
    glide: 1,
    hp: 80,
    peak: 0.12,
    atk: 0.03,
    tau: 0.4,
    from: 0.1,
  },
  SLAM_TONE: { glide: 0.08, peak: 0.12, atk: 0.002, tau: 0.08 },
  SLAM_NOISE: { f0: 900, q: 0.7, peak: 0.08, atk: 0.003, tau: 0.04, from: 1.0 },
  ROOM_SEC: 1.3, // the room's impulse
  ROOM_SMOOTH: 0.2, // its one-pole: darker than white
  ROOM_TAU: 0.26,
  ROOM_SEED: 2410,
  HP_HZ: 90, // every noise burst's high-pass, unless it says
  LP_Q: 0.7,
  TAILS: 8, // a sound is silent this many time constants after its attack
  DRIVE_SAMPLES: 1024,
};
const rooms = new WeakMap(); // AudioContext → the bang's room

// The room: decaying, smoothed noise from a fixed seed, once per context
function roomOf(ctx) {
  let ir = rooms.get(ctx);
  if (ir) return ir;
  const n = Math.floor(ctx.sampleRate * BANG.ROOM_SEC);
  ir = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = ir.getChannelData(0);
  const rand = mulberry32(BANG.ROOM_SEED);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    lp += BANG.ROOM_SMOOTH * (rand() * 2 - 1 - lp);
    d[i] = lp * Math.exp(-i / ctx.sampleRate / BANG.ROOM_TAU);
  }
  rooms.set(ctx, ir);
  return ir;
}

/** The kick's drive (BeatTrack.js): tanh(k·x), scaled so ±1 stays ±1 */
/**
 * The bomb's bang at audio time `at`, placed.
 * @param {AudioContext} ctx
 * @param {AudioNode} out the effects' bus
 * @param {object} o { at, noise (an AudioBuffer), volume (1: the page's level), pan (-1..1) }
 */
export function bangSound(ctx, out, { at, noise, volume, pan }) {
  const [bus, panner] = placed(ctx, out, volume, pan, at);
  const nodes = [bus, panner];
  let last = null;
  let lastEnd = -Infinity;
  const ends = (src, end) => {
    if (end >= lastEnd) {
      lastEnd = end;
      last = src;
    }
  };
  // A gain up to `peak` in `atk` s, then decaying with time constant `tau`
  const envGain = (from, peak, atk, tau) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(SILENT, from);
    g.gain.exponentialRampToValueAtTime(Math.max(SILENT, peak), from + atk);
    g.gain.setTargetAtTime(0, from + atk, tau);
    nodes.push(g);
    return [g, from + atk + BANG.TAILS * tau];
  };
  const tone = (
    dest,
    { f0, f1, glide, peak, atk, tau, from = at, type = 'sine' }
  ) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, from);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, from + glide);
    const [g, end] = envGain(from, peak, atk, tau);
    o.connect(g).connect(dest);
    o.start(from);
    o.stop(end);
    nodes.push(o);
    ends(o, end);
  };
  const hiss = (dest, o) => {
    const {
      type = 'lowpass',
      f0,
      f1,
      glide = 0.5,
      q = BANG.LP_Q,
      hp = BANG.HP_HZ,
      peak,
      atk,
      tau,
      from = 0,
    } = o;
    const when = o.at ?? at;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, when);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, when + glide);
    const h = ctx.createBiquadFilter();
    h.type = 'highpass';
    h.frequency.value = hp;
    const [g, end] = envGain(when, peak, atk, tau);
    src.connect(f).connect(h).connect(g).connect(dest);
    src.start(when, from);
    src.stop(end);
    nodes.push(src, f, h);
    ends(src, end);
  };
  // Its room, a send from the bus back into it
  const wet = ctx.createGain();
  const room = ctx.createConvolver();
  room.buffer = roomOf(ctx);
  wet.connect(room).connect(bus);
  // The thump's drive, the kick's curve
  const drive = ctx.createWaveShaper();
  drive.curve = driveCurve(CONFIG.BEAT_TRACK.KICK.DRIVE, BANG.DRIVE_SAMPLES);
  drive.oversample = '2x'; // as the kick's
  drive.connect(bus);
  nodes.push(wet, room, drive);

  const root = hz(BANG.ROOT, at);
  const fifth = hz(BANG.FIFTH, at);
  hiss(bus, BANG.CRACK);
  tone(drive, { ...BANG.THUMP, f0: root * BANG.THUMP.UP, f1: root });
  tone(bus, {
    ...BANG.FIFTH_TONE,
    f0: fifth * BANG.FIFTH_TONE.UP,
    f1: fifth,
  });
  hiss(bus, BANG.ROAR);
  hiss(wet, BANG.ROAR_ROOM);
  hiss(bus, BANG.RUMBLE);
  // The slam at the edge, when the ring is seen to land
  const slam = at + RING_LANDS_SEC;
  tone(bus, { ...BANG.SLAM_TONE, f0: fifth, f1: root, from: slam });
  hiss(bus, { ...BANG.SLAM_NOISE, at: slam });
  disconnectWhenEnded(last, nodes);
}
