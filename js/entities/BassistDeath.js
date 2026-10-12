import { CONFIG } from '../config.js';
import { clamp01 } from '../mathUtils.js';
import { drawBassistFigure } from './Bassist.js';

// A bassist's death (EnemyDeathHandler.bassistDies): shortcut: a simple
// one of his own until his own is picked on a studies page (the bassist
// spec, Death). On the next eighth he goes slack, his sinews curling, and
// drifts off limp along the blow, turning slowly and fading

/** How long it lasts, s, times CONFIG.DEATHS.LINGER */
export const DEATH_SEC = 1.6;
const SLACK_SEC = 0.25; // his sinews curl over this
const DRIFT_PX_S = 40;
const TURN_RAD_S = 0.7;

export class BassistDeath {
  /**
   * @param {object} o
   * @param {number} o.x where he died
   * @param {number} o.y
   * @param {number} o.size his drawn size
   * @param {number} o.aim the way he faced
   * @param {number} o.dir the blow's way, which he drifts
   * @param {number} o.seed his lookSeed: which way he turns
   * @param {number} o.startsAt when it starts, heard, on the audio clock, s
   * @param {() => number} o.now the audio clock, s
   */
  constructor({ x, y, size, aim, dir, seed, startsAt, now }) {
    Object.assign(this, { x, y, size, aim, dir, startsAt, now });
    this.turn = seed < 0.5 ? -1 : 1;
    this.active = true;
  }

  // It runs on the audio clock, as it is drawn
  update() {}

  draw(p) {
    if (!this.active) return;
    const age = this.now() - this.startsAt;
    const sec = DEATH_SEC * CONFIG.DEATHS.LINGER;
    if (age >= sec) {
      this.active = false;
      return;
    }
    const t = Math.max(0, age);
    p.push();
    p.translate(
      this.x + Math.cos(this.dir) * DRIFT_PX_S * t,
      this.y + Math.sin(this.dir) * DRIFT_PX_S * t
    );
    drawBassistFigure(
      p,
      this.size,
      this.aim + this.turn * TURN_RAD_S * t,
      clamp01(t / SLACK_SEC),
      1 - t / sec
    );
    p.pop();
  }
}
