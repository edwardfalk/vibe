/**
 * A swarm of grunts (docs/superpowers/specs/2026-10-10-grunt-swarms-design.md):
 * the alien throws its cannon fodder in as one loose, jostling cloud that
 * drifts after the hero. The game's enemies array stays the only list of
 * grunts: a grunt in a swarm carries `swarm`, and the swarm finds its grunts
 * there each frame, so one that dies, is removed or is cleared by a restart
 * is gone from it at once. It decides their movement; their damage, deaths
 * and removal stay their own. The numbers are CONFIG.SWARM.
 */
import { CONFIG } from '../config.js';
import { random, sqrt, min, max } from '../mathUtils.js';
import { GRUNT_FIRE_RANGE } from '../entities/Grunt.js';

// The centre holds its stand-off within this either way before it moves
export const STANDOFF_BAND_PX = 50;
// Each grunt's idle jitter a frame, either way (a lone grunt's, before swarms)
const IDLE_JITTER = 0.3;
// Grunts backing off move at this share of the swarm's speed (as a lone
// grunt retreated a little slower than he advanced)
const RETREAT_SHARE = 0.8;

/** A swarm's size at a level: SIZE_FIRST, SIZE_PER_LEVEL more a level, up to SIZE_MAX */
export function swarmSize(level) {
  const { SIZE_FIRST, SIZE_PER_LEVEL, SIZE_MAX } = CONFIG.SWARM;
  return max(1, min(SIZE_MAX, SIZE_FIRST + SIZE_PER_LEVEL * (level - 1)));
}

/** About how far a cloud of n grunts reaches from its centre, px */
export function cloudRadius(n) {
  return (CONFIG.SWARM.SPACING_PX * sqrt(n)) / 2;
}

export class GruntSwarm {
  /**
   * @param {object} o { size: the grunts it spawns with, x, y: its centre }
   */
  constructor({ size, x, y }) {
    this.size = size;
    this.x = x;
    this.y = y;
    // It comes in at a grunt's full speed until one of its grunts is in range
    this.entering = true;
    // Which way its centre went last frame: 'advance', 'retreat' or null
    this.heading = null;
  }

  /** Its grunts, found in the enemies array: its own, live, not pending a death */
  members(enemies) {
    return enemies.filter(
      (e) =>
        e.swarm === this &&
        e.type === 'grunt' &&
        !e.markedForRemoval &&
        !e.pendingStabDeath &&
        e.health > 0
    );
  }

  /** Cleared when all its grunts are dead */
  isCleared(enemies) {
    return this.members(enemies).length === 0;
  }

  /**
   * Each grunt's velocity this frame (px a frame at 60 fps): the cloud's
   * drift toward its stand-off from the hero, a loose pull toward its
   * centre, a push off neighbours closer than SPACING_PX, and the idle
   * jitter; never faster than a grunt can go
   */
  steer(members, hero) {
    if (members.length === 0) return;
    const { STANDOFF_PX, DRIFT_SHARE, PULL, SPACING_PX } = CONFIG.SWARM;
    const speed = members[0].speed;
    let cx = 0;
    let cy = 0;
    for (const g of members) {
      cx += g.x;
      cy += g.y;
    }
    cx /= members.length;
    cy /= members.length;
    this.x = cx;
    this.y = cy;

    if (
      members.some(
        (g) => Math.hypot(hero.x - g.x, hero.y - g.y) < GRUNT_FIRE_RANGE
      )
    ) {
      this.entering = false;
    }
    const dx = hero.x - cx;
    const dy = hero.y - cy;
    const d = Math.hypot(dx, dy);
    const want = STANDOFF_PX + cloudRadius(members.length);
    const pace = (this.entering ? 1 : DRIFT_SHARE) * speed;
    let driftX = 0;
    let driftY = 0;
    this.heading = null;
    if (d > 0 && d > want + STANDOFF_BAND_PX) {
      driftX = (dx / d) * pace;
      driftY = (dy / d) * pace;
      this.heading = 'advance';
    } else if (d > 0 && d < want - STANDOFF_BAND_PX) {
      driftX = (-dx / d) * pace * RETREAT_SHARE;
      driftY = (-dy / d) * pace * RETREAT_SHARE;
      this.heading = 'retreat';
    }

    for (let i = 0; i < members.length; i++) {
      const g = members[i];
      let vx = driftX + PULL * (cx - g.x);
      let vy = driftY + PULL * (cy - g.y);
      for (let j = 0; j < members.length; j++) {
        if (j === i) continue;
        const h = members[j];
        const ox = g.x - h.x;
        const oy = g.y - h.y;
        const gap = Math.hypot(ox, oy);
        if (gap >= SPACING_PX) continue;
        // Harder the closer they are; two on one spot part by their places
        // in the swarm
        const push = ((SPACING_PX - gap) / SPACING_PX) * speed;
        const a = (2 * Math.PI * (i - j)) / members.length;
        vx += (gap > 0 ? ox / gap : Math.cos(a)) * push;
        vy += (gap > 0 ? oy / gap : Math.sin(a)) * push;
      }
      // At its stand-off a grunt only jitters, as a lone one did
      if (this.heading === null) {
        vx += random(-IDLE_JITTER, IDLE_JITTER);
        vy += random(-IDLE_JITTER, IDLE_JITTER);
      }
      const v = Math.hypot(vx, vy);
      if (v > speed) {
        vx = (vx / v) * speed;
        vy = (vy / v) * speed;
      }
      g.velocity = { x: vx, y: vy };
    }
  }
}
