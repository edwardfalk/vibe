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
// Its sounds, rolled once each 2 or 4 (a lone grunt's chances): the move
// call while it moves, and one grunt's chatter, at most one a bar
const MOVE_CALL_CHANCE = 0.5;
const CHATTER_CHANCE = 0.2;
const BEATS_PER_BAR = 4;

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
    // No volley before this beat (SpawnSystem: GAP_BEATS after the last
    // swarm's clear; none for a run's first)
    this.quietUntil = -Infinity;
    // The beats it last picked shooters on, and last settled a volley on
    this.pickedBeat = null;
    this.settledBeat = null;
    // Each shot of its last volley plays at this share of a lone shot's level
    this.volleyGain = 1;
    // The one grunt of it who speaks (Grunt.getAmbientSpeechConfig)
    this.speaker = null;
    // The beat it last made its sounds on, and the bar its last chatter was in
    this.soundBeat = null;
    this.chatterBar = null;
  }

  /**
   * Each frame, before its grunts move: it steers them, picks and fires,
   * and makes its sounds; one of them speaks for it
   */
  update(enemies, hero, beatClock, audio = null) {
    const members = this.members(enemies);
    if (!members.includes(this.speaker)) this.speaker = members[0] ?? null;
    this.steer(members, hero);
    if (!beatClock) return;
    this.beat(members, hero, beatClock);
    if (audio) this.sounds(members, beatClock, audio);
  }

  /**
   * On each 2 and 4, once: its move call from its centre while it moves,
   * and one grunt's chatter, at most one a bar
   */
  sounds(members, beatClock, audio) {
    if (!beatClock.isOnBeat([2, 4]) || members.length === 0) return;
    const total = beatClock.getTotalBeats();
    if (this.soundBeat === total) return;
    this.soundBeat = total;
    if (this.heading && random() < MOVE_CALL_CHANCE) {
      const call = this.heading === 'advance' ? 'gruntAdvance' : 'gruntRetreat';
      audio.playSound(call, this.x, this.y);
    }
    const bar = Math.floor(total / BEATS_PER_BAR);
    if (this.chatterBar !== bar && random() < CHATTER_CHANCE) {
      this.chatterBar = bar;
      random(members).makeGruntWeirdNoise();
    }
  }

  /** How many fire on a 2 or 4: a share of its grunts, up to SHOOTERS_MAX */
  shooterQuota(n) {
    const { SHOOTERS_MAX, GRUNTS_PER_SHOOTER } = CONFIG.SWARM;
    return min(SHOOTERS_MAX, Math.ceil(n / GRUNTS_PER_SHOOTER));
  }

  /**
   * On its first update in beat 1 or 3 it picks who fires on the 2 or 4
   * after (pick); inside the 2-or-4 window it settles the volley (settle).
   * A window it never saw (hitstop, a pause with the sound on) holds: a
   * volley is never replayed.
   */
  beat(members, hero, beatClock) {
    const total = beatClock.getTotalBeats();
    if (beatClock.getCurrentBeat() % 2 === 0 && this.pickedBeat !== total) {
      this.pickedBeat = total;
      if (total + 1 >= this.quietUntil) this.pick(members, hero, total);
    }
    if (beatClock.canGruntShoot() && this.settledBeat !== total) {
      this.settledBeat = total;
      this.settle(members, total);
    }
  }

  /**
   * Its shooters for the next 2 or 4: grunts in range, nearest the hero
   * first, with a clear line of fire; each is stamped with the beat it was
   * warned on (warnedOnBeat), so only they wind up
   */
  pick(members, hero, total) {
    const near = (g) => Math.hypot(hero.x - g.x, hero.y - g.y);
    const ready = members
      .filter((g) => !g.isSpawning && near(g) < GRUNT_FIRE_RANGE)
      .filter((g) => !g.lineBlocked())
      .sort((a, b) => near(a) - near(b));
    for (const g of ready.slice(0, this.shooterQuota(this.size))) {
      g.warnedOnBeat = total;
    }
  }

  /**
   * The volley: a pick still in the swarm, warned on the beat before and
   * with a clear line fires (fireOnBeat); the rest hold. Each shot plays at
   * VOLLEY_DB_PER_DOUBLING a doubling of the n that fire, so a volley
   * carries about one shot's energy; a volley of one is a lone shot.
   */
  settle(members, total) {
    const shooters = members.filter(
      (g) => g.warnedOnBeat === total - 1 && !g.lineBlocked()
    );
    for (const g of shooters) g.fireOnBeat = total;
    const n = shooters.length;
    this.volleyGain =
      n > 1
        ? 10 ** ((CONFIG.SWARM.VOLLEY_DB_PER_DOUBLING * Math.log2(n)) / 20)
        : 1;
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
