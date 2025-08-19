import { Bullet } from './bullet.js';
import { CONFIG } from '@vibe/core';
import {
  sin,
  cos,
  atan2,
  randomRange,
  random,
  sqrt,
  floor,
  max,
  min,
  PI,
} from '@vibe/core';
import { getEnemyConfig, effectsConfig } from '@vibe/fx/effectsConfig.js';
import { drawGlow } from '@vibe/fx/visualEffects.js';
import EffectsProfiler from '@vibe/fx/EffectsProfiler.js';

/**
 * BaseEnemy class - Contains shared functionality for all enemy types
 * Handles position, health, basic movement, common rendering, and speech systems
 */
export class BaseEnemy {
  /**
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} type - Enemy type
   * @param {object} config - Enemy config
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

    this.p = p;
    this.audio = audio;

    // Initialize type-specific colors
    this.initializeColors();
  }

  /**
   * Initialize cosmic aurora colors for each enemy type
   */
  initializeColors() {
    if (this.type === 'rusher') {
      this.skinColor = this.p.color(255, 105, 180); // Hot pink skin
      this.helmetColor = this.p.color(139, 0, 139); // Dark magenta helmet
      this.weaponColor = this.p.color(255, 20, 147); // Deep pink claws
      this.eyeColor = this.p.color(255, 215, 0); // Gold eyes (feral)
    } else if (this.type === 'tank') {
      this.skinColor = this.p.color(123, 104, 238); // Medium slate blue skin
      this.helmetColor = this.p.color(72, 61, 139); // Dark slate blue helmet
      this.weaponColor = this.p.color(138, 43, 226); // Blue violet weapon
      this.eyeColor = this.p.color(0, 191, 255); // Deep sky blue eyes (tech)
    } else if (this.type === 'stabber') {
      this.skinColor = this.p.color(255, 215, 0); // Gold skin - stunning against cosmic background
      this.helmetColor = this.p.color(218, 165, 32); // Goldenrod helmet
      this.weaponColor = this.p.color(255, 255, 224); // Light yellow laser knife
      this.eyeColor = this.p.color(255, 69, 0); // Red orange eyes (deadly)
    } else {
      // Grunt colors - lime green theme
      this.skinColor = this.p.color(50, 205, 50); // Lime green skin
      this.helmetColor = this.p.color(34, 139, 34); // Forest green helmet
      this.weaponColor = this.p.color(0, 255, 127); // Spring green weapon
      this.eyeColor = this.p.color(255, 20, 147); // Deep pink eyes (contrast)
    }
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

    // Calculate basic aim angle (subclasses can override targeting)
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    if (dx !== 0 || dy !== 0) {
      this.aimAngle = atan2(dy, dx);
    }

    // Apply velocity
    this.x += this.velocity.x;
    this.y += this.velocity.y;

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
  drawGlow(p) {
    if (typeof drawGlow === 'function') {
      try {
        // Check if currently speaking (has active speech timer)
        const isSpeaking = this.speechTimer > 0;
        const cfg = getEnemyConfig(this.type);
        const baseGlow = cfg.glow || {};

        const intensityBase = baseGlow.alpha ? baseGlow.alpha / 255 : 0.3;
        const speechGlowIntensity = isSpeaking
          ? intensityBase * 1.6
          : intensityBase;
        const speechGlowSize = isSpeaking ? 1.3 : 1.0;

        const glowColorArr = baseGlow.color || [255, 255, 255];
        const glowColor = this.p.color(...glowColorArr);
        const glowSize =
          (baseGlow.sizeMult || 1.0) * this.size * speechGlowSize;

        drawGlow(p, this.x, this.y, glowSize, glowColor, speechGlowIntensity);

        // Add extra pulsing glow for aggressive speech
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
              this.p.color(255, 0, 0),
              aggressivePulse * 0.6
            );
          }
        }

        // Profiling hook
        EffectsProfiler.registerEffect('glow', { enemy: this.type });
      } catch (error) {
        console.log('⚠️ Enemy glow error:', error);
      }
    }
  }

  /**
   * Get glow color for this enemy type - can be overridden by subclasses
   */
  getGlowColor(isSpeaking) {
    if (this.type === 'tank') {
      return isSpeaking
        ? this.p.color(150, 100, 255)
        : this.p.color(100, 50, 200);
    } else if (this.type === 'rusher') {
      return isSpeaking
        ? this.p.color(255, 150, 200)
        : this.p.color(255, 100, 150);
    } else if (this.type === 'stabber') {
      return isSpeaking
        ? this.p.color(255, 200, 50)
        : this.p.color(255, 140, 0);
    } else {
      // Grunt default
      return isSpeaking
        ? this.p.color(100, 255, 100)
        : this.p.color(50, 200, 50);
    }
  }

  /**
   * Get glow size for this enemy type
   */
  getGlowSize() {
    if (this.type === 'tank') {
      return this.size * 1.5;
    } else if (this.type === 'rusher' || this.type === 'stabber') {
      return this.size * 1.2;
    } else {
      return this.size * 1.1;
    }
  }

  /**
   * Draw method - handles common rendering and calls specific draw methods
   */
  draw(p = this.p) {
    // Debug: Log enemy type and position every 30 frames
    if (
      typeof p.frameCount !== 'undefined' &&
      p.frameCount % 30 === 0 &&
      CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS
    ) {
      console.log(
        `[ENEMY DRAW] type=${this.type} x=${this.x.toFixed(1)} y=${this.y.toFixed(1)} health=${this.health} visible=${this.isVisible ? this.isVisible : 'n/a'}`
      );
    }
    // Draw glow effects first
    this.drawGlow(p);

    // Add motion trail for fast enemies (can be overridden)
    this.drawMotionTrail();

    p.push();
    p.translate(this.x, this.y);
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

    // Hit flash effect
    if (this.hitFlash > 0) {
      p.tint(255, 255, 255, 100);
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

    // Reset tint before drawing contour lines
    p.noTint();
    this.drawBodyOutline(s, p);

    p.pop();

    // Draw UI elements
    this.drawHealthBar(p);
    this.drawSpeechBubble(p);

    // Draw type-specific indicators
    this.drawSpecificIndicators(p);

    p.noTint();
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
   * Draw body outline - can be overridden by subclasses
   */
  drawBodyOutline(s, p) {
    // Base implementation does nothing; subclasses can override for contour lines
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

  /**
   * Draw health bar
   */
  drawHealthBar(p) {
    if (this.health < this.maxHealth && !this.markedForRemoval) {
      const barWidth = this.size * 1.2;
      const barHeight = 4;
      const barY = this.y - this.size * 0.8;
      // Debug: Log health bar rendering only if collision debug is enabled
      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(
          `[ENEMY DEBUG] drawHealthBar: type=${this.type} health=${this.health} maxHealth=${this.maxHealth} at (${this.x.toFixed(1)},${this.y.toFixed(1)})`
        );
      }
      // Background bar
      p.fill(100, 100, 100);
      p.rect(this.x - barWidth / 2, barY, barWidth, barHeight);
      // Health bar
      const healthPercent = this.health / this.maxHealth;
      const healthColor =
        healthPercent > 0.5
          ? p.color(0, 255, 0)
          : healthPercent > 0.25
            ? p.color(255, 255, 0)
            : p.color(255, 0, 0);
      p.fill(healthColor);
      p.rect(this.x - barWidth / 2, barY, barWidth * healthPercent, barHeight);
      // Visual cue: Draw red X if health is zero or negative
      if (this.health <= 0) {
        p.stroke(255, 0, 0);
        p.strokeWeight(3);
        p.line(
          this.x - barWidth / 2,
          barY,
          this.x + barWidth / 2,
          barY + barHeight
        );
        p.line(
          this.x + barWidth / 2,
          barY,
          this.x - barWidth / 2,
          barY + barHeight
        );
        p.noStroke();
      }
    }
  }

  /**
   * Draw speech bubble
   */
  drawSpeechBubble(p) {
    if (!this.speechText) return;

    // Simple text above head - smaller and closer
    p.fill(255, 255, 255);
    p.stroke(0, 0, 0);
    p.strokeWeight(1);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(10);
    p.text(this.speechText, this.x, this.y - this.size - 15);
    p.noStroke();
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
    const bullet = new Bullet(
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
        `🔫 ${this.type} created bullet at (${Math.round(bulletX)}, ${Math.round(
          bulletY
        )}) angle=${Math.round((this.aimAngle * 180) / PI)}° owner="${bullet.owner}" ownerId="${bullet.ownerId}"`
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
        `[DEBUG] ${this.type} takeDamage called: health=${this.health} markedForRemoval=${this.markedForRemoval}`
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
    const threshold = (this.size + other.size) * 0.5; // Use radii for consistency
    return distance < threshold;
  }
}
