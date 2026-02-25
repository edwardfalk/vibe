import { Bullet } from './bullet.js';
import { CONFIG } from '../config.js';
import { random, randomRange, sin, cos, atan2 } from '../mathUtils.js';
import { drawGlow } from '../effects/glowUtils.js';
import {
  getEnemyColors,
  getGlowColorForType,
  getGlowSizeForType,
  drawEnemyHealthBar,
  drawEnemySpeechBubble,
} from './BaseEnemyHelpers.js';

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

    // Speech bubble system
    this.speechText = '';
    this.speechTimer = 0;
    this.maxSpeechTime = 180; // 3 seconds - better sync with TTS

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

    this.initializeColors();
  }

  getContextValue(key) {
    if (this.context && typeof this.context.get === 'function') {
      return this.context.get(key);
    }
    return undefined;
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
  update(playerX, playerY, deltaTimeMs = 16.6667) {
    // Update animation frame
    this.animFrame += 0.1;

    // Normalize deltaTime to 60fps baseline for frame-independent behavior
    const dt = deltaTimeMs / 16.6667;

    // Decrease cooldowns using deltaTime
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.speechTimer > 0) this.speechTimer -= dt;
    if (this.speechCooldown > 0) this.speechCooldown -= dt;
    if (this.speechTimer <= 0 && this.speechText) this.speechText = '';

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

    // Subclasses should override this method for specific behavior
    return this.updateSpecificBehavior(playerX, playerY, deltaTimeMs);
  }

  /**
   * Handle ambient speech timing - shared across all enemy types
   * @param {number} deltaTimeMs - Time elapsed since last frame in milliseconds
   */
  updateAmbientSpeech(deltaTimeMs) {
    // Normalize deltaTime to 60fps baseline
    const dt = deltaTimeMs / 16.6667;

    // Handle ambient speech
    if (this.ambientSpeechTimer > 0) {
      this.ambientSpeechTimer -= dt;
    }

    if (this.ambientSpeechTimer <= 0 && this.speechCooldown <= 0) {
      // Trigger ambient speech
      this.triggerAmbientSpeech();

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
   * Trigger ambient speech - should be overridden by subclasses
   */
  triggerAmbientSpeech() {
    // Base implementation - subclasses should override
    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      console.log(`${this.type} making ambient noise`);
    }
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

  /**
   * Enhanced glow effects with speech indicators
   */
  drawEnemyGlow(p) {
    try {
      const isSpeaking = this.speechTimer > 0;
      const speechGlowIntensity = isSpeaking ? 0.8 : 0.3;
      const speechGlowSize = isSpeaking ? 1.3 : 1.0;

      const glowColor = this.getGlowColor(isSpeaking);
      const glowSize = this.getGlowSize() * speechGlowSize;

      drawGlow(p, this.x, this.y, glowSize, glowColor, speechGlowIntensity);

      if (isSpeaking && this.audio) {
        const activeTexts = this.audio.activeTexts || [];
        const myText = activeTexts.find((text) => text.entity === this);
        if (myText && myText.isAggressive) {
          const aggressivePulse = sin(p.frameCount * 0.8) * 0.3 + 0.5;
          drawGlow(
            p,
            this.x,
            this.y,
            this.size * 2,
            p.color(255, 0, 0),
            aggressivePulse * 0.6
          );
        }
      }
    } catch (error) {
      console.log('⚠️ Enemy glow error:', error);
    }
  }

  getGlowColor(isSpeaking) {
    return getGlowColorForType(this.type, this.p, isSpeaking);
  }

  getGlowSize() {
    return getGlowSizeForType(this.type, this.size);
  }

  /**
   * Draw method - handles common rendering and calls specific draw methods
   */
  draw(p = this.p) {
    if (p.frameCount % 30 === 0 && CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      console.log(
        `[ENEMY DRAW] type=${this.type} x=${this.x.toFixed(1)} y=${this.y.toFixed(1)} health=${this.health}`
      );
    }

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
    this.drawMotionTrail();

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

    // Apply animation offsets
    p.translate(waddle, bobble);

    // Compose spawn alpha with hit-flash alpha; p.tint doesn't affect shape primitives, use globalAlpha
    const hitAlpha = this.hitFlash > 0 ? 100 : 255;
    const finalAlpha = Math.round(spawnAlpha * (hitAlpha / 255)) / 255;
    const prevAlpha = p.drawingContext?.globalAlpha ?? 1;
    if (p.drawingContext) p.drawingContext.globalAlpha = finalAlpha;

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

    p.pop();

    if (p.drawingContext) p.drawingContext.globalAlpha = prevAlpha;

    // Draw UI elements
    this.drawHealthBar(p);
    this.drawSpeechBubble(p);

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
   * Draw motion trail - can be overridden by subclasses
   */
  drawMotionTrail() {
    // Base implementation does nothing - subclasses can override
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
      this.muzzleFlash--;
    }
  }

  drawHealthBar(p) {
    drawEnemyHealthBar(p, this);
  }

  drawSpeechBubble(p) {
    drawEnemySpeechBubble(p, this);
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
    const bulletDistance = this.size * 0.9;
    const bulletX = this.x + cos(this.aimAngle) * bulletDistance;
    const bulletY = this.y + sin(this.aimAngle) * bulletDistance;

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
      this.audio.playAlienShoot(this.x, this.y);
    }

    // DEBUG: Log bullet creation only if collision debug is enabled
    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      console.log(
        `🔫 ${this.type} created bullet at (${Math.round(bulletX)}, ${Math.round(bulletY)}) angle=${Math.round((this.aimAngle * 180) / Math.PI)}° owner="${bullet.owner}" ownerId="${bullet.ownerId}"`
      );
    }

    return bullet;
  }

  /**
   * Take damage - handles basic damage logic
   */
  takeDamage(amount, bulletAngle = null, damageSource = null) {
    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      console.log(
        `[DEBUG] ${this.type || this.constructor.name} takeDamage called: health=${this.health} markedForRemoval=${this.markedForRemoval}`
      );
    }
    this.health -= amount;
    this.hitFlash = 8;
    if (this.health <= 0) {
      return true; // Enemy died
    }
    return false;
  }

  /**
   * Check collision with another object
   */
  checkCollision(other) {
    const distance = this.p.dist(this.x, this.y, other.x, other.y);
    return distance < (this.size + other.size) * 0.85;
  }
}
