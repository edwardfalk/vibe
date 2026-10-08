import { CONFIG } from '../config.js';
import { random, sin, atan2, constrain } from '../mathUtils.js';
import { drawGlow } from '../effects/glowUtils.js';
import {
  getEnemyColors,
  getGlowColorForType,
  getGlowSizeForType,
  drawEnemyHealthBar,
} from './BaseEnemyHelpers.js';
import { createContextAccessor } from '../shared/ContextAccessor.js';
import { DAMAGE_RESULT } from '../shared/DamageResult.js';

/**
 * BaseEnemy class - Contains shared functionality for all enemy types
 * Handles position, health, basic movement, common rendering, and speech systems
 */
export class BaseEnemy {
  /**
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} type - Enemy type
   * @param {object} config - Enemy config (may include config.context for GameContext)
   * @param {p5} p - The p5 instance
   * @param {Audio} audio - The audio system (dependency injected for modularity)
   */
  constructor(x, y, type, config, p, audio) {
    // Core properties
    this.x = x;
    this.y = y;
    this.type = type;
    this.id = random().toString(36).substr(2, 9); // Unique ID for each enemy

    // Configuration from type-specific configs
    this.size = config.size;
    this.health = config.health;
    this.maxHealth = config.health;
    this.speed = config.speed;
    this.bodyColor = config.color;

    // Movement and animation
    this.velocity = { x: 0, y: 0 };
    this.aimAngle = 0;
    this.animFrame = random(0, p.TWO_PI);

    // Combat
    this.shootCooldown = 0;
    this.hitFlash = 0;
    this.hitFlashAlpha = 100; // how solid it is drawn just after a hit (of 255); a type may set its own
    this.markedForRemoval = false;

    // Get per-type speech config
    const speechConfig =
      CONFIG.SPEECH_SETTINGS[type.toUpperCase()] ||
      CONFIG.SPEECH_SETTINGS.DEFAULT;
    // Speech cooldowns for different enemy types
    this.speechCooldown = 0;
    this.maxSpeechCooldown = speechConfig.COOLDOWN * 60; // seconds to frames
    // Random speech timer for ambient chatter
    this.ambientSpeechTimer = random(
      speechConfig.AMBIENT_MIN * 60,
      speechConfig.AMBIENT_MAX * 60
    ); // seconds to frames

    // Spawn animation
    this.spawnTimer = 0;
    this.spawnDuration = 25; // frames to fully materialize
    this.isSpawning = true;

    this.p = p;
    this.audio = audio;
    this.context = config?.context ?? null;
    this.getContextValue = createContextAccessor(() => this.context);

    this.initializeColors();
  }

  initializeColors() {
    const colors = getEnemyColors(this.type, this.p);
    this.skinColor = colors.skinColor;
    this.helmetColor = colors.helmetColor;
    this.weaponColor = colors.weaponColor;
    this.eyeColor = colors.eyeColor;
  }

  /**
   * Basic movement update - should be overridden by subclasses for specific AI
   * @param {number} playerX - Player X position
   * @param {number} playerY - Player Y position
   * @param {number} deltaTimeMs - Time elapsed since last frame in milliseconds
   */
  update(playerX, playerY, deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS) {
    // Normalize deltaTime to 60fps baseline for frame-independent behavior
    const dt = deltaTimeMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS;

    // Update animation frame (delta-aware)
    this.animFrame += 0.1 * dt;

    // Decrease cooldowns using deltaTime
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.speechCooldown > 0) this.speechCooldown -= dt;

    // Spawn animation (frame-rate independent)
    if (this.isSpawning) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnDuration) {
        this.isSpawning = false;
      }
    }

    // Calculate basic aim angle (subclasses can override targeting)
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    if (dx !== 0 || dy !== 0) {
      this.aimAngle = atan2(dy, dx);
    }

    // Apply velocity (frame-rate independent)
    this.x += this.velocity.x * dt;
    this.y += this.velocity.y * dt;

    // Handle ambient speech timing
    this.updateAmbientSpeech(deltaTimeMs);

    // Don't run combat behavior during spawn animation (grace period)
    if (this.isSpawning) return null;

    // Subclasses should override this method for specific behavior
    return this.updateSpecificBehavior(playerX, playerY, deltaTimeMs);
  }

  /**
   * Handle ambient speech timing - shared across all enemy types
   * @param {number} deltaTimeMs - Time elapsed since last frame in milliseconds
   */
  updateAmbientSpeech(deltaTimeMs) {
    // Normalize deltaTime to 60fps baseline
    const dt = deltaTimeMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS;

    // Handle ambient speech
    if (this.ambientSpeechTimer > 0) {
      this.ambientSpeechTimer -= dt;
    }

    if (this.ambientSpeechTimer <= 0 && this.speechCooldown <= 0) {
      // Wait for this enemy's beat gate, then roll once. Trying on a single
      // frame would skip most turns now that gates are narrow.
      const config = this.getAmbientSpeechConfig();
      const beatClock = this.getContextValue('beatClock');
      if (config && !config.gate(beatClock)) return;
      if (config && random() < config.chance) this.triggerAmbientSpeech();

      // Reset timer for next speech using config
      const speechConfig =
        CONFIG.SPEECH_SETTINGS[this.type.toUpperCase()] ||
        CONFIG.SPEECH_SETTINGS.DEFAULT;
      this.ambientSpeechTimer = random(
        speechConfig.AMBIENT_MIN * 60,
        speechConfig.AMBIENT_MAX * 60
      ); // seconds to frames
    }
  }

  /** Collision radius for bullets; the sprite is wider than size/2 */
  get hitRadius() {
    return CONFIG.HITBOX[this.type] ?? this.size / 2;
  }

  /**
   * Trigger ambient speech using subclass-provided config.
   * Subclasses override getAmbientSpeechConfig() to provide lines and conditions.
   */
  triggerAmbientSpeech() {
    const config = this.getAmbientSpeechConfig();
    if (!config) return;

    const audio = this.getContextValue('audio');
    if (!audio || this.speechCooldown > 0) return;

    const line = random(config.lines);
    if (audio.speak(this, line, this.type)) {
      this.speechCooldown = this.maxSpeechCooldown;
    }
  }

  /**
   * Override in subclasses to provide ambient speech configuration.
   * Return { lines: string[], gate: (beatClock) => boolean, chance: number }
   * or null. The gate is when this enemy may speak; chance is per attempt.
   */
  getAmbientSpeechConfig() {
    return null;
  }

  /**
   * True the first time `open` is true within a beat (per key), then false
   * until the next beat. Beat-gated sounds use it so they play once per beat
   * instead of on every frame of the window.
   */
  onBeatOnce(beatClock, key, open) {
    if (!open || !beatClock) return false;
    const beat = beatClock.getTotalBeats();
    this._beatOnce ??= {};
    if (this._beatOnce[key] === beat) return false;
    this._beatOnce[key] = beat;
    return true;
  }

  /**
   * Update specific behavior - must be implemented by subclasses
   * @param {number} playerX - Player X position
   * @param {number} playerY - Player Y position
   * @param {number} deltaTimeMs - Time elapsed since last frame in milliseconds
   */
  updateSpecificBehavior(playerX, playerY, deltaTimeMs) {
    // Must be implemented by subclasses
    return null;
  }

  drawEnemyGlow(p) {
    try {
      const glowColor = this.getGlowColor();
      drawGlow(p, this.x, this.y, this.getGlowSize(), glowColor, 0.3);
    } catch (error) {
      console.warn('⚠️ Enemy glow error:', error);
    }
  }

  getGlowColor() {
    return getGlowColorForType(this.type);
  }

  getGlowSize() {
    return getGlowSizeForType(this.type, this.size);
  }

  /**
   * Draw method - handles common rendering and calls specific draw methods
   */
  draw(p = this.p) {
    const spawnProgress = this.isSpawning
      ? this.spawnTimer / this.spawnDuration
      : 1;

    // Draw spawn warp effect
    if (this.isSpawning) {
      const warpAlpha = (1 - spawnProgress) * 180;
      const warpSize = this.size * (2.5 - spawnProgress * 1.5);
      p.fill(255, 255, 255, warpAlpha * 0.3);
      p.noStroke();
      p.ellipse(this.x, this.y, warpSize, warpSize);
      p.stroke(255, 255, 255, warpAlpha);
      p.strokeWeight(1);
      p.noFill();
      p.ellipse(this.x, this.y, warpSize * 1.2, warpSize * 1.2);
      p.noStroke();
    }

    this.drawEnemyGlow(p);

    p.push();
    p.translate(this.x, this.y);

    // Apply spawn scale and opacity
    const spawnAlpha = this.isSpawning ? spawnProgress * 255 : 255;
    if (this.isSpawning) {
      const eased = spawnProgress * spawnProgress; // ease-in
      p.scale(0.3 + eased * 0.7);
    }

    // Compose spawn alpha with hit-flash alpha; p.tint doesn't affect shape primitives, use globalAlpha
    const hitAlpha = this.hitFlash > 0 ? this.hitFlashAlpha : 255;
    const finalAlpha = Math.round(spawnAlpha * (hitAlpha / 255)) / 255;
    const prevAlpha = p.drawingContext?.globalAlpha ?? 1;
    if (p.drawingContext) p.drawingContext.globalAlpha = finalAlpha;

    try {
      this.drawFigure(p, this.size);
    } finally {
      if (p.drawingContext) p.drawingContext.globalAlpha = prevAlpha;
      p.pop();
    }

    // Draw UI elements
    this.drawHealthBar(p);

    if (CONFIG.HITBOX.SHOW) {
      p.push();
      p.noFill();
      p.stroke(0, 255, 0);
      p.strokeWeight(1);
      p.ellipse(this.x, this.y, this.hitRadius * 2);
      p.pop();
    }

    // Draw type-specific indicators
    this.drawSpecificIndicators(p);
  }

  /**
   * The enemy's figure, drawn at its centre, inside the spawn's scale and
   * alpha. Every enemy draws its own (the grunt, tank, rusher and stabber
   * with their renderers); this draws nothing
   */
  drawFigure(p, s) {}

  /** Shake and squash the figure for a few frames after a hit */
  applyHitShake(p) {
    if (!(this.hitFlash > 0)) return;
    const hitIntensity = this.hitFlash / 8;
    const shakeX = random(-hitIntensity * 4, hitIntensity * 4);
    const shakeY = random(-hitIntensity * 3, hitIntensity * 3);
    p.translate(shakeX, shakeY);

    // Comical size distortion when hit
    const distortion = 1 + sin(p.frameCount * 2) * hitIntensity * 0.1;
    p.scale(distortion, 1 / distortion);
  }

  drawHealthBar(p) {
    drawEnemyHealthBar(p, this);
  }

  /**
   * Draw type-specific indicators - should be overridden by subclasses
   */
  drawSpecificIndicators(p) {
    // Base implementation does nothing
  }

  /**
   * Take damage - handles basic damage logic
   * @returns {string} DAMAGE_RESULT.DIED or DAMAGE_RESULT.DAMAGED
   */
  takeDamage(amount, bulletAngle = null, damageSource = null) {
    this.health -= amount;
    this.hitFlash = Math.max(this.hitFlash, 8);
    return this.health <= 0 ? DAMAGE_RESULT.DIED : DAMAGE_RESULT.DAMAGED;
  }

  /**
   * A neighbour of its kind died: it answers on the next eighth note, or,
   * when the death pops (a grunt's, at popsAt on the audio clock), an
   * eighth after the pop
   */
  onNearbyDeath(deadEnemy, popsAt = null) {
    if (!deadEnemy || deadEnemy.type !== this.type) return;
    if (this.markedForRemoval || this.health <= 0) return;

    const dx = this.x - deadEnemy.x;
    const dy = this.y - deadEnemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 300) return;

    const audio = this.getContextValue('audio');
    if (!audio) return;

    const responseKey = `${this.type}Response`;
    const beatClock = this.getContextValue('beatClock');

    if (beatClock) {
      // Quantize response to next eighth-note
      const eighthMs = beatClock.beatInterval / 2;
      const delay =
        popsAt !== null
          ? (popsAt - beatClock.nowSec()) * 1000 + eighthMs
          : beatClock.getTimeToNextEighthNote
            ? beatClock.getTimeToNextEighthNote()
            : beatClock.getTimeToNextBeat() / 2;
      setTimeout(
        () => {
          audio.playSound(responseKey, this.x, this.y);
        },
        Math.max(0, delay)
      );
    } else {
      audio.playSound(responseKey, this.x, this.y);
    }
  }

  /**
   * Keep inside the world, where the camera never goes past. The tank and
   * the rusher call it: a sidestep, or a rusher shooting past near a wall,
   * could otherwise carry them out
   */
  keepInWorld() {
    const halfW = CONFIG.GAME_SETTINGS.WORLD_WIDTH / 2 - this.size / 2;
    const halfH = CONFIG.GAME_SETTINGS.WORLD_HEIGHT / 2 - this.size / 2;
    this.x = constrain(this.x, -halfW, halfW);
    this.y = constrain(this.y, -halfH, halfH);
  }

  /**
   * Check collision with another object
   */
  checkCollision(other) {
    const distance = this.p.dist(this.x, this.y, other.x, other.y);
    return distance < (this.size + other.size) * 0.85;
  }
}
