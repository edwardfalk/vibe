import { CONFIG } from '../config.js';
import { clamp01, smooth } from '../mathUtils.js';
import { drawBassist } from './BassistRenderer.js';

// A bassist's death (EnemyDeathHandler.bassistDies): shortcut: a simple one
// of his own until his own is picked on a studies page (the bassist spec,
// Death; docs/ROADMAP.md). As on the look's page: his last sinew snaps and
// he trembles, frozen, until the next eighth; then he goes slack, sinews
// curled and scroll unrolled, and drifts off limp along the blow, turning
// slowly and fading

const SLACK = 1e-6; // on beat positions, for floating-point error
/** His scroll jets on each of his lets from this long after his death's start, s */
export const FIRST_JET_SEC = 0.04;
/** ...and fizzles on the first let at least this long after it, s */
export const FIZZLE_FROM_SEC = 0.45;
const MAX_JETS = 8; // however the beat is set, a bounded schedule

/**
 * What his death keeps from the kill, read by its picture and its sound
 * alike (DeathSounds.js), so a ?tune change mid-death applies to the next:
 * the linger, the beat and where his let falls in it, the blow's way (rad),
 * his seed, and his pose with the kill's snaps. A lethal hit stamps none
 * (Bassist.takeDamage), so every sinew still whole is snapped at the kill:
 * no strings, nothing played, and clean of the hit's flash (the death draws
 * its own). And his scroll's jets, as offsets from the start `at` (audio
 * s): the pop at 0, one on each of his lets from FIRST_JET_SEC, the last
 * (`fizzle`) on the first let at least FIZZLE_FROM_SEC on. His lets are
 * beat n + andAt of the song (origin: the beat clock's start, audio s),
 * whatever the start (a bang can fall off the grid).
 */
export function bassistDeathRecord({
  linger,
  andAt,
  beatSec,
  origin,
  at,
  pose,
  dir,
  seed,
}) {
  const b0 = (at - origin) / beatSec; // the start's beat
  const offset = (n) => (n + andAt - b0) * beatSec;
  const first = Math.ceil(b0 - andAt + FIRST_JET_SEC / beatSec - SLACK);
  const last = Math.ceil(b0 - andAt + FIZZLE_FROM_SEC / beatSec - SLACK);
  const jets = [0];
  for (let n = first; n <= last && jets.length < MAX_JETS; n++) {
    jets.push(offset(n));
  }
  return Object.freeze({
    linger,
    beatSec,
    andAt,
    pose: Object.freeze({
      ...pose,
      strings: 0,
      plays: [false, false, false, false],
      sinews: pose.sinews.map((s) =>
        s.snapped < 0 ? { ...s, snapped: 0 } : s
      ),
      hit: 0,
    }),
    dir,
    seed,
    jets: Object.freeze(jets),
    fizzle: jets[jets.length - 1],
  });
}

/** How long he drifts off slack, s, times CONFIG.DEATHS.LINGER */
export const DEATH_SEC = 2.4;
const DRIFT_PX_S = 28;
const TURN_RAD_S = 0.9;
const FADE_FROM = 0.55; // he fades over the rest of it, from this share
const LAST = 3; // the slap's sinew, the last to go

export class BassistDeath {
  /**
   * @param {object} o
   * @param {number} o.x where he died
   * @param {number} o.y
   * @param {object} o.pose his pose at the kill (Bassist#pose())
   * @param {number} o.scale his BASSIST_LOOK.ART_SCALE at the kill
   * @param {number} o.dir the blow's way, which he drifts
   * @param {number} o.seed his lookSeed: which way he turns
   * @param {number} o.diedAt the beat clock's time at the kill, s
   * @param {number} o.startsAt when he goes slack, heard, on that clock, s
   * @param {() => number} o.now that clock, s
   */
  constructor({ x, y, pose, scale, dir, seed, diedAt, startsAt, now }) {
    Object.assign(this, { x, y, pose, scale, dir, diedAt, startsAt, now });
    this.turn = seed < 0.5 ? -1 : 1;
    this.active = true;
  }

  // It runs on the clock, as it is drawn
  update() {}

  draw(p) {
    if (!this.active) return;
    const now = this.now();
    const age = now - this.startsAt;
    const sec = DEATH_SEC * CONFIG.DEATHS.LINGER;
    if (age >= sec) {
      this.active = false;
      return;
    }
    const t = Math.max(0, age);
    const k = t / sec;
    const since = now - this.diedAt;
    const P = this.pose;
    const L = {
      ...P,
      t: P.t + since,
      aim: P.aim + this.turn * TURN_RAD_S * t,
      vx: Math.cos(this.dir) * DRIFT_PX_S,
      vy: Math.sin(this.dir) * DRIFT_PX_S,
      speed: DRIFT_PX_S,
      sinews: P.sinews.map((s, i) =>
        i === LAST ? { ...s, snapped: since } : s
      ),
      tell: null,
      hit: 0,
      dying: age < 0 ? { age: since } : null,
      slack: age < 0 ? null : { age, k },
    };
    p.push();
    p.translate(
      this.x + Math.cos(this.dir) * DRIFT_PX_S * t,
      this.y + Math.sin(this.dir) * DRIFT_PX_S * t
    );
    const ctx = p.drawingContext;
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha =
      a0 * (1 - smooth(clamp01((k - FADE_FROM) / (1 - FADE_FROM))));
    drawBassist(p, this.scale, L);
    ctx.globalAlpha = a0;
    p.pop();
  }
}
