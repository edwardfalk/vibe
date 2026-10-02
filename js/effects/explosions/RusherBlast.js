/**
 * The rusher's blast, the stuntman's big finish (RusherRenderer.js draws
 * it). It lives in the explosion manager's list, so a restart clears it. It
 * ages by the game's frame time, so it holds still while the game does and
 * lasts as long on any screen.
 */
import { CONFIG } from '../../config.js';
import {
  drawRusherBlast,
  hash01,
  BLAST_SEC,
} from '../../entities/RusherRenderer.js';

const MS_PER_SEC = 1000;
const SEED_Y = 7.31; // folds y into the seed, so blasts on one row differ

export class RusherBlast {
  constructor(x, y, { chain = false } = {}) {
    this.x = x;
    this.y = y;
    this.chain = chain; // lit by another blast: it gets an encore ring
    this.radius = CONFIG.RUSHER.EXPLOSION_RADIUS;
    this.seed = hash01(x + SEED_Y * y); // its stars and helmet vary with where it went off
    this.ageMs = 0;
    this.active = true;
  }

  update(deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS) {
    this.ageMs += deltaTimeMs;
    if (this.ageMs >= BLAST_SEC * MS_PER_SEC) this.active = false;
  }

  draw(p) {
    drawRusherBlast(p, this);
  }
}
