/**
 * How the bassist dies, Ink cloud (docs/superpowers/specs/2026-10-13-bassist-death-design.md;
 * the picture is BassistInk.js). What a death keeps from the kill is one
 * record, read by its picture and its sound alike (DeathSounds.js), so a
 * ?tune change mid-death applies to the next one. From the kill until its
 * start (on the next eighth, or with the bomb's bang) he hangs frozen in the
 * pose he died in, trembling; then the ink. Everything runs on the audio
 * clock, read when drawn, so the picture stays with its sound through
 * hitstop, and a pause (which suspends the clock) holds both. A change of
 * the lead or the output latency mid-death moves the picture against its
 * booked sound by that change, as for the stabber's death.
 */
import { CONFIG } from '../config.js';
import { env } from '../mathUtils.js';
import { drawInk, drawInkWait } from './BassistInk.js';

const KICK_TAU_SEC = 0.12; // the heard kick's pulse, as his pose's kick
const SLACK = 1e-6; // on beat positions, for floating-point error
/** His scroll jets on each of his lets from this long after his death's start, s */
export const FIRST_JET_SEC = 0.04;
/** ...and fizzles on the first let at least this long after it, s */
export const FIZZLE_FROM_SEC = 0.45;
const MAX_JETS = 8; // however the beat is set, a bounded schedule

/**
 * What his death keeps from the kill, read by its picture and its sound
 * alike (DeathSounds.js), so a ?tune change mid-death applies to the next:
 * the linger, the blow's way (rad), his seed, and his pose with the kill's
 * snaps. A lethal hit stamps none
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

/**
 * A bassist's death, for ExplosionManager's fragmentExplosions: its
 * update() and draw(p), and `active` false once it is all gone.
 */
export class BassistDeath {
  /**
   * @param {object} o
   * @param {number} o.x where he died (his centre)
   * @param {number} o.y
   * @param {object} o.record what it keeps from the kill (bassistDeathRecord)
   * @param {number} o.diedAt the audio clock at the kill, s
   * @param {number} o.startsAt when its start is heard, on the audio clock, s
   * @param {() => number} o.now the audio clock, s
   * @param {() => ?{x: number, y: number}} o.hero where the hero is, now
   * @param {() => number} o.kickAge seconds since the last heard kick
   */
  constructor({ x, y, record, diedAt, startsAt, now, hero, kickAge }) {
    Object.assign(this, { x, y, record, diedAt, startsAt, now, hero, kickAge });
    // The ink's caches, and the hero's place kept from its first frame of ink
    this.state = {};
    this.active = true;
  }

  // It runs on the audio clock, as it is drawn
  update() {}

  draw(p) {
    if (!this.active) return;
    const now = this.now();
    const age = now - this.startsAt;
    if (age >= 0 && !('hero' in this.state)) this.state.hero = this.heroAt();
    // The ink's frame: the record, its age (from its start), since the kill,
    // how long it waited, his scale (live, as the living bassists draw), the
    // hero kept from its first frame of ink, the heard kick
    const d = {
      ...this.record,
      aim: this.record.pose.aim,
      age,
      since: now - this.diedAt,
      wait: this.startsAt - this.diedAt,
      scale: CONFIG.BASSIST_LOOK.ART_SCALE,
      hero: this.state.hero ?? null,
      kick: this.kickAge ? env(this.kickAge(), KICK_TAU_SEC) : 0,
      state: this.state,
    };
    p.push();
    p.translate(this.x, this.y);
    if (age < 0) drawInkWait(p, d);
    else if (!drawInk(p, d)) this.active = false;
    p.pop();
  }

  /** Where the hero is, from where he died, or null */
  heroAt() {
    const h = this.hero?.();
    return h ? { x: h.x - this.x, y: h.y - this.y } : null;
  }
}
