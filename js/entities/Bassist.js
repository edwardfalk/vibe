import { BaseEnemy } from './BaseEnemy.js';
import { CONFIG } from '../config.js';
import { stalkWant } from './Stabber.js';

const FRAMES_PER_SEC = 60; // BaseEnemy's velocity is px per 60 Hz frame
const STRINGS = 4;

// shortcut: a stand-in figure until Edward picks his look on the studies
// page (the bassist spec, The creature); the picked one replaces it
const SHELL_RGB = [150, 95, 55];
const SINEW_RGB = [235, 225, 200];

/** Whether a bassist is about: the hero's grid swings while one is (BeatClock.wantSwing) */
export const bassistAbout = (enemies) =>
  enemies.some((e) => e.type === 'bassist' && !e.markedForRemoval);

/**
 * Bassist: an alien that resembles an upright bass, a pure creature with no
 * words. He hangs back from the hero as the stabber does, and plays the let
 * before every beat (the bassist spec, docs/superpowers/specs).
 */
export class Bassist extends BaseEnemy {
  constructor(x, y, type, config, p, audio) {
    const B = CONFIG.BASSIST;
    super(
      x,
      y,
      'bassist',
      {
        ...config,
        size: B.SIZE,
        health: STRINGS * B.HITS_PER_STRING,
        speed: B.APPROACH_PX_S / FRAMES_PER_SEC,
      },
      p,
      audio
    );
    this.circle = this.lookSeed < 0.5 ? 1 : -1; // which way he circles the hero
    this.distance = Infinity; // to the hero, at his last update
    this.toHero = 0;
    this.walk = { x: 0, y: 0 }; // his drift, px/s
  }

  /** He drifts in his band round the hero; nothing he plays yet */
  updateSpecificBehavior(
    playerX,
    playerY,
    deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS
  ) {
    this.keepInWorld();
    this.distance = Math.hypot(playerX - this.x, playerY - this.y);
    this.toHero = Math.atan2(playerY - this.y, playerX - this.x);
    this.steer(deltaTimeMs / 1000);
    this.velocity.x = this.walk.x / FRAMES_PER_SEC;
    this.velocity.y = this.walk.y / FRAMES_PER_SEC;
    return null;
  }

  /** His drift eases toward the stabber's stalk, on his own band and speeds */
  steer(dtSec) {
    const B = CONFIG.BASSIST;
    const want = stalkWant(
      B,
      this.distance,
      this.circle,
      Math.cos(this.toHero),
      Math.sin(this.toHero)
    );
    const k = 1 - Math.exp(-dtSec / B.STEER_SEC);
    this.walk.x += (want.x - this.walk.x) * k;
    this.walk.y += (want.y - this.walk.y) * k;
  }

  drawFigure(p, s) {
    this.applyHitShake(p);
    p.rotate(this.aimAngle + Math.PI / 2);
    p.noStroke();
    p.fill(...SHELL_RGB);
    p.ellipse(0, s * 0.25, s * 0.9, s * 0.7);
    p.ellipse(0, -s * 0.15, s * 0.7, s * 0.55);
    p.stroke(...SINEW_RGB);
    p.strokeWeight(1);
    for (let i = 0; i < STRINGS; i++) {
      const x = (i - (STRINGS - 1) / 2) * s * 0.08;
      p.line(x, s * 0.4, x, -s * 0.6);
    }
  }
}
