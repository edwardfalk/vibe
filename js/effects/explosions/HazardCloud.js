/**
 * Hazard cloud: a zone that lingers and deals area damage. Two kinds, both
 * left by the hero's bomb: PLASMA, and the longer-lasting DEBRIS. Anything
 * within RADIUS takes DAMAGE every DAMAGE_INTERVAL frames for DURATION
 * frames (CONFIG[kind], read when it is made); it ends before a tick that
 * would come at its last frame. How the pair looks is one BombSmoke.
 */
import { CONFIG } from '../../config.js';

export class HazardCloud {
  /** @param {'PLASMA' | 'DEBRIS'} kind */
  constructor(x, y, kind) {
    const config = CONFIG[kind];
    this.x = x;
    this.y = y;
    this.radius = config.RADIUS;
    this.active = true;
    this.timer = 0;
    this.maxTimer = config.DURATION;
    this.damageTimer = 0;
    this.damageInterval = config.DAMAGE_INTERVAL;
    this.damage = config.DAMAGE;
  }

  /** A frame: its damage this frame ({ x, y, radius, damage }), or null */
  update() {
    this.timer++;
    this.damageTimer++;

    if (this.timer >= this.maxTimer) {
      this.active = false;
      return null;
    }

    if (this.damageTimer >= this.damageInterval) {
      this.damageTimer = 0;
      return {
        x: this.x,
        y: this.y,
        radius: this.radius,
        damage: this.damage,
      };
    }

    return null;
  }
}
