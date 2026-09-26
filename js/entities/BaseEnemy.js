import { Bullet } from './bullet.js';
import { CONFIG } from '../config.js';
import { random, randomRange, sin, cos, atan2 } from '../mathUtils.js';
import { drawGlow } from '../effects/glowUtils.js';
import {
  getEnemyColors,
  getGlowColorForType,
  getGlowSizeForType,
  drawEnemyHealthBar,
} from './BaseEnemyHelpers.js';
import { createContextAccessor } from '../shared/ContextAccessor.js';

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
    this.animFrame = randomRange(0, p.TWO_PI);

    // Combat
    this.shootCooldown = 0;
    this.muzzleFlash = 0;
    this.hitFlash = 0;
    this.markedForRemoval = false;

    // Get per-type speech config
    const speechConfig =
      CONFIG.SPEECH_SETTINGS[type.toUpperCase()] ||
      CONFIG.SPEECH_SETTINGS.DEFAULT;
    // Speech cooldowns for different enemy types
    this.speechCooldown = 0;
    this.maxSpeechCooldown = speechConfig.COOLDOWN * 60; // seconds to frames
    // Random speech timer for ambient chatter
    this.ambientSpeechTimer = randomRange(
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
    if (this.muzzleFlash > 0) this.muzzleFlash -= dt;
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
      this.ambientSpeechTimer = randomRange(
        speechConfig.AMBIENT_MIN * 60,
        speechConfig.AMBIENT_MAX * 60
      ); // seconds to frames
    }
  }

  /**
   * Shift (local y, px) that centres an off-centre sprite on its hit circle.
   * Subclasses whose art leans to one side override it.
   */
  get artOffsetY() {
    return 0;
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
    return getGlowColorForType(this.type, this.p);
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

    p.rotate(this.aimAngle);

    const s = this.size;
    let bobble = sin(this.animFrame) * 2;
    let waddle = cos(this.animFrame * 0.8) * 1.5;

    // Allow subclasses to modify animation
    const animationMods = this.getAnimationModifications();
    bobble += animationMods.bobble;
    waddle += animationMods.waddle;

    // Apply animation offsets, and the art's own offset (see artOffsetY)
    p.translate(waddle, bobble + this.artOffsetY);

    // Compose spawn alpha with hit-flash alpha; p.tint doesn't affect shape primitives, use globalAlpha
    const hitAlpha = this.hitFlash > 0 ? 100 : 255;
    const finalAlpha = Math.round(spawnAlpha * (hitAlpha / 255)) / 255;
    const prevAlpha = p.drawingContext?.globalAlpha ?? 1;
    if (p.drawingContext) p.drawingContext.globalAlpha = finalAlpha;

    try {
      if (this.hitFlash > 0) {
        const hitIntensity = this.hitFlash / 8;
        const shakeX = randomRange(-hitIntensity * 4, hitIntensity * 4);
        const shakeY = randomRange(-hitIntensity * 3, hitIntensity * 3);
        p.translate(shakeX, shakeY);

        // Comical size distortion when hit
        const distortion = 1 + sin(p.frameCount * 2) * hitIntensity * 0.1;
        p.scale(distortion, 1 / distortion);
      }

      // Draw main body (subclasses implement specific shapes)
      this.drawBody(s, p);

      // Draw common elements
      this.drawHead(s, p);
      this.drawArms(s, p);
      this.drawWeapon(s, p);
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
   * Get animation modifications - can be overridden by subclasses
   */
  getAnimationModifications() {
    return { bobble: 0, waddle: 0 };
  }

  /**
   * Draw main body - must be implemented by subclasses
   */
  drawBody(s, p) {
    // Default body shape
    p.fill(this.bodyColor);
    p.noStroke();
    p.ellipse(0, 0, s, s * 0.8);
  }

  /**
   * Draw head
   */
  drawHead(s, p) {
    // Head
    p.fill(this.skinColor);
    p.ellipse(s * 0.1, -s * 0.3, s * 0.6, s * 0.5);

    // Helmet
    p.fill(this.helmetColor);
    p.arc(s * 0.1, -s * 0.35, s * 0.65, s * 0.4, p.PI, p.TWO_PI);

    // Eyes
    p.fill(this.eyeColor);
    p.ellipse(s * 0.25, -s * 0.35, s * 0.12, s * 0.08);
    p.ellipse(s * 0.05, -s * 0.35, s * 0.12, s * 0.08);

    // Eye glow
    p.fill(255, 255, 255, 120);
    p.ellipse(s * 0.27, -s * 0.36, s * 0.06, s * 0.04);
    p.ellipse(s * 0.07, -s * 0.36, s * 0.06, s * 0.04);
  }

  /**
   * Draw arms
   */
  drawArms(s, p) {
    // Left arm
    p.fill(this.skinColor);
    p.ellipse(-s * 0.25, s * 0.1, s * 0.2, s * 0.4);

    // Right arm
    p.ellipse(s * 0.45, s * 0.1, s * 0.2, s * 0.4);
  }

  /**
   * Draw weapon - can be overridden by subclasses
   */
  drawWeapon(s, p) {
    // Basic weapon
    p.fill(this.weaponColor);
    p.rect(s * 0.4, -s * 0.05, s * 0.3, s * 0.1);

    // Muzzle flash
    if (this.muzzleFlash > 0) {
      p.fill(255, 255, 100, this.muzzleFlash * 30);
      p.ellipse(s * 0.7, 0, s * 0.2, s * 0.1);
    }
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
   * Create bullet - should be overridden by subclasses
   */
  createBullet() {
    // From the drawn gun: along the aim, then artOffsetY across it
    const bulletDistance = this.size * 0.9;
    const bulletX =
      this.x +
      cos(this.aimAngle) * bulletDistance -
      sin(this.aimAngle) * this.artOffsetY;
    const bulletY =
      this.y +
      sin(this.aimAngle) * bulletDistance +
      cos(this.aimAngle) * this.artOffsetY;

    // Create bullet with enemy type information
    const bullet = Bullet.acquire(
      bulletX,
      bulletY,
      this.aimAngle,
      4,
      `enemy-${this.type}`
    );
    bullet.ownerId = this.id; // Use unique enemy ID to prevent self-shooting

    // Play alien shooting sound
    if (this.audio) {
      this.audio.playSound('alienShoot', this.x, this.y);
    }

    return bullet;
  }

  /**
   * Take damage - handles basic damage logic
   */
  takeDamage(amount, bulletAngle = null, damageSource = null) {
    this.health -= amount;
    this.hitFlash = Math.max(this.hitFlash, 8);
    if (this.health <= 0) {
      return true; // Enemy died
    }
    return false;
  }

  onNearbyDeath(deadEnemy) {
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
      const delay = beatClock.getTimeToNextEighthNote
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
   * Check collision with another object
   */
  checkCollision(other) {
    const distance = this.p.dist(this.x, this.y, other.x, other.y);
    return distance < (this.size + other.size) * 0.85;
  }
}
