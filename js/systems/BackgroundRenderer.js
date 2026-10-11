/**
 * BackgroundRenderer - draws the sky (NebulaSky) in every game state, and
 * while playing the health wash and the kill-streak border over it. Each
 * frame it turns the game into the sky's frame: the kick as the player hears
 * it, the eased level, the gas's flow, and the camera in world coordinates.
 */

import { NebulaSky, levelFraction } from './background/NebulaSky.js';
import { drawInteractiveBackgroundEffectsLayer } from './background/BackgroundEffects.js';
import { heardKickOf, NONE_SEC } from '../audio/BeatTrack.js';
import { CONFIG } from '../config.js';
import { constrain } from '../mathUtils.js';
import { createContextAccessor } from '../shared/ContextAccessor.js';

const MAX_SKY_LEVEL = 8; // the sky stops growing here (3,340 points)
const MAX_DT_SEC = 0.1; // a hidden tab can't jump the gas
const MIN_LEVEL_EASE_SEC = 0.05;
const FLOW_PER_LEVEL = 0.8; // the gas flows this much faster at level 8
const DEFAULT_BEAT_MS = 500;
// Painted when the sky fails: it is what clears the canvas each frame
const VOID_RGB = [2, 3, 6];

export class BackgroundRenderer {
  constructor(p, cameraSystem, player, gameState, context = null) {
    this.p = p;
    this.cameraSystem = cameraSystem;
    this.player = player;
    this.gameState = gameState;
    this.getContextValue = createContextAccessor(context);
    this.sky = null; // made on the first draw, when p5 can make buffers
    this.flow = 0;
    this.level = null; // the eased sky level; starts at its target
    this.skyFailed = false;
  }

  drawSky(p = this.p) {
    p.push();
    try {
      if (!this.sky) {
        // A sky that failed to build once is not rebuilt every frame
        if (this.skyFailed) return p.background(...VOID_RGB);
        this.sky = new NebulaSky(p);
      }
      this.sky.draw(p, this.skyFrame(p));
    } catch (err) {
      // p5 asks for the next frame only after draw returns, so an uncaught
      // error here would freeze the game; the void keeps the canvas clean
      p.background(...VOID_RGB);
      if (!this.skyFailed) {
        console.error('Sky: drawing failed, so the sky is flat.', err);
      }
      this.skyFailed = true;
      if (this.sky) this.sky.mode = 'flat';
    } finally {
      p.pop();
    }
  }

  /** The sky's frame (see NebulaSky.draw). Advances the flow and the level. */
  skyFrame(p) {
    // A pause that holds the sound holds the sky: no flow, no easing, no time
    const held = !!this.getContextValue('audio')?.soundPaused;
    const frameSec = held ? 0 : (p.deltaTime ?? 0) / 1000;
    const dt = constrain(frameSec, 0, MAX_DT_SEC);
    const target =
      CONFIG.SKY.LEVEL_OVERRIDE ||
      Math.min(this.gameState?.level ?? 1, MAX_SKY_LEVEL);
    if (this.level === null) this.level = target;
    const ease = Math.max(MIN_LEVEL_EASE_SEC, CONFIG.SKY.LEVEL_EASE_SEC);
    this.level += (target - this.level) * (1 - Math.exp(-dt / ease));
    this.flow += dt * (1 + FLOW_PER_LEVEL * levelFraction(this.level));

    const beatClock = this.getContextValue('beatClock');
    const beatSec = (beatClock?.beatInterval ?? DEFAULT_BEAT_MS) / 1000;
    const beats = beatClock
      ? beatClock.getTotalBeats() + beatClock.getBeatPhase()
      : 0;

    // While held, the stopped beat keeps the kick glow it had
    const kick = heardKickOf(
      this.getContextValue('beatTrack'),
      beats,
      beatSec,
      held
    );
    // The kick on the beat 1 the level-up played on breathes deeper: its age
    // counts from half a beat before that beat 1 as heard, so its own kick
    // is the first since. A restart clears it (GameState)
    const upAt = this.gameState?.lastLevelUpAt ?? null;
    const levelAge =
      upAt === null || !beatClock
        ? NONE_SEC
        : Math.min(
            NONE_SEC,
            kick.t - (upAt - beatClock.startTime / 1000) + beatSec / 2
          );

    const { WORLD_WIDTH, WORLD_HEIGHT } = CONFIG.GAME_SETTINGS;
    return {
      ...kick,
      beatSec,
      flow: this.flow,
      camX: (this.cameraSystem?.x ?? 0) + WORLD_WIDTH / 2,
      camY: (this.cameraSystem?.y ?? 0) + WORLD_HEIGHT / 2,
      level: this.level,
      levelAge,
    };
  }

  drawInteractiveBackgroundEffects(p = this.p) {
    drawInteractiveBackgroundEffectsLayer(p, this.player, this.gameState);
  }
}
