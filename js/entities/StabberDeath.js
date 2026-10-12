/**
 * How the stabber dies (docs/superpowers/specs/2026-10-12-stabber-death-design.md):
 * Empty shell (StabberShell.js), or Gold shatter (StabberShatter.js) picked
 * on ?tune (CONFIG.DEATHS.STABBER_STYLE). Ported from the stabber death studies page,
 * docs/superpowers/specs/2026-10-12-stabber-death-studies/ (git-ignored; the
 * page is https://claude.ai/artifact/VLR3dxtERhVhUCM4jEwPUD).
 *
 * What a death keeps from the kill is one record, read by its picture and
 * its sound alike (DeathSounds.js), so a ?tune change mid-death applies to
 * the next one. From the kill until its start (on the next eighth, or with
 * the bomb's bang) he hangs frozen in the pose he died in; then the style's
 * death. Everything runs on the audio clock, read when drawn, so the picture
 * stays with its sound through hitstop, and a pause (which suspends the
 * clock) holds both.
 */
import { stabberBody } from './StabberRenderer.js';
import { drawShellWait, drawShell, shellParts } from './StabberShell.js';
import { drawShatterWait, drawShatter } from './StabberShatter.js';

const STYLES = {
  shell: { wait: drawShellWait, draw: drawShell, prepare: shellParts },
  shatter: { wait: drawShatterWait, draw: drawShatter },
};
/** The styles on offer (CONFIG.DEATHS.STABBER_STYLE), for ?tune; the first is the default */
export const STABBER_STYLES = Object.freeze(Object.keys(STYLES));
const SLACK = 1e-6; // on beat positions, for floating-point error
// With no hero, the free eye looks this far along his aim at the kill
const NO_HERO_PX = 300;

/**
 * What a death keeps from the kill: its style (an unknown one is the
 * shell), linger and beat, his pose (clean: the death draws its own flash),
 * his body at it (stabberBody), his scale, the blow's way (rad) and whether
 * it was a blast, whether he was white-hot, his seed; and the song's eighths
 * from its start `at` (audio s): the first at or after it is `offset` s
 * after it, the next ones an eighth apart, whatever the start (a bang can
 * fall off the grid). origin: the beat clock's start, audio s.
 */
export function stabberDeathRecord({
  style,
  linger,
  beatSec,
  origin,
  at,
  pose,
  scale,
  dir,
  blast,
  seed,
}) {
  const eighth = beatSec / 2;
  const first = origin + Math.ceil((at - origin) / eighth - SLACK) * eighth;
  const offset = first - at;
  return Object.freeze({
    style: Object.hasOwn(STYLES, style) ? style : STABBER_STYLES[0],
    linger,
    beatSec,
    eighth,
    offset,
    /** The j-th of the song's eighths from the start (0: the first at or after it), s after the start */
    eighthAfter: (j) => offset + j * eighth,
    /** The last of the song's eighths at or before t s after the start: [j, its time] (j is -1 before the first) */
    lastEighth: (t) => {
      const j = Math.floor((t - offset) / eighth + SLACK);
      return [j, offset + j * eighth];
    },
    pose,
    body: stabberBody(pose),
    scale,
    dir,
    blast: !!blast,
    hot: !!(pose.windup?.locked || pose.lunge),
    seed,
  });
}

/** Build the default style's sprites now (at setup), so the first death doesn't hitch */
export function prepareStabberDeath(p, scale) {
  for (const style of Object.values(STYLES)) style.prepare?.(p, scale);
}

/**
 * A stabber's death, for ExplosionManager's fragmentExplosions: its
 * update() and draw(p), and `active` false once it is all gone.
 */
export class StabberDeath {
  /**
   * @param {object} o
   * @param {number} o.x where he died (his centre)
   * @param {number} o.y
   * @param {object} o.record what it keeps from the kill (stabberDeathRecord)
   * @param {number} o.diedAt the audio clock at the kill, s
   * @param {number} o.startsAt when its start is heard, on the audio clock, s
   * @param {() => number} o.now the audio clock, s
   * @param {() => ?{x: number, y: number}} o.hero where the hero is, now
   */
  constructor({ x, y, record, diedAt, startsAt, now, hero }) {
    Object.assign(this, { x, y, record, diedAt, startsAt, now, hero });
    this.state = {}; // the style's caches, from its first frame to its last
    this.active = true;
  }

  // It runs on the audio clock, as it is drawn
  update() {}

  draw(p) {
    if (!this.active) return;
    const now = this.now();
    const style = STYLES[this.record.style];
    // The style's frame: the record, its age (from its start), since the
    // kill, how long it waited, and where the hero is, from where he died
    const d = {
      ...this.record,
      age: now - this.startsAt,
      since: now - this.diedAt,
      wait: this.startsAt - this.diedAt,
      hero: this.heroAt(),
      state: this.state,
    };
    p.push();
    p.translate(this.x, this.y);
    if (d.age < 0) style.wait(p, d);
    else if (!style.draw(p, d)) this.active = false;
    p.pop();
  }

  heroAt() {
    const h = this.hero?.();
    if (h) return { x: h.x - this.x, y: h.y - this.y };
    const a = this.record.pose.aim;
    return { x: Math.cos(a) * NO_HERO_PX, y: Math.sin(a) * NO_HERO_PX };
  }
}
