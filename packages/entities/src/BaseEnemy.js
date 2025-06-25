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
} from '@vibe/core';
import { getEnemyConfig, effectsConfig } from '@vibe/fx/effectsConfig.js';
import EffectsProfiler from '@vibe/fx/EffectsProfiler.js';
import { EnemyEventBus } from './EnemyEventBus.js';

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
    this.knockVX = 0;
    this.knockVY = 0;

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

    // Apply velocity and transient knock-back impulse
    this.x += this.velocity.x + this.knockVX;
    this.y += this.velocity.y + this.knockVY;

    // Decay knock-back each frame for smooth slowdown
    this.knockVX *= 0.85;
    this.knockVY *= 0.85;

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
    if (typeof drawGlow !== 'undefined') {
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

        drawGlow(
          this.p,
          this.x,
          this.y,
          glowSize,
          glowColor,
          speechGlowIntensity
        );

        // Add extra pulsing glow for aggressive speech
        if (isSpeaking && this.audio) {
          const activeTexts = this.audio.activeTexts || [];
          const myText = activeTexts.find((text) => text.entity === this);
          if (myText && myText.isAggressive) {
            const aggressivePulse = sin(p.frameCount * 0.8) * 0.3 + 0.5;
            drawGlow(
              this.p,
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

  getGlowColor(isSpeaking) {
    const cfg = getEnemyConfig(this.type);
    const glowConfig = cfg.glow || {};
    const baseColor = this.p.color(...(glowConfig.color || [255, 255, 255]));

    if (isSpeaking) {
      // Make glow brighter/whiter when speaking
      return this.p.lerpColor(baseColor, this.p.color(255), 0.4);
    }
    return baseColor;
  }

  getGlowSize() {
    const isSpeaking = this.speechTimer > 0;
    const baseSize =
      (getEnemyConfig(this.type).glow?.sizeMult || 1.0) * this.size;
    return isSpeaking ? baseSize * 1.3 : baseSize;
  }

  draw(p = this.p) {
    if (this.health <= 0) return;

    p.push();
    p.translate(this.x, this.y);
    p.rotate(this.aimAngle + p.PI / 2);

    if (this.hitFlash > 0) {
      const flashAlpha = (this.hitFlash / 4) * 150;
      p.fill(255, 255, 255, flashAlpha);
      p.ellipse(0, 0, this.size * 1.5, this.size * 1.5);
    }

    const s = this.size;
    this.drawBody(s, p);
    this.drawHead(s, p);
    this.drawArms(s, p);
    this.drawWeapon(s, p);
    this.drawSpecificIndicators(p);

    p.pop();

    this.drawHealthBar(p);
    this.drawSpeechBubble(p);
    this.drawGlow(p);
  }

  drawMotionTrail() {
    // Default: no trail. Override in subclasses like Rusher
  }

  drawBody(s, p) {
    p.fill(this.skinColor);
    p.stroke(this.helmetColor);
    p.strokeWeight(3);
    p.ellipse(0, 0, s, s);
  }

  drawHead(s, p) {
    p.fill(this.helmetColor);
    p.noStroke();
    p.rect(-s / 2, -s / 2, s, s / 2);

    p.fill(this.eyeColor);
    p.ellipse(-s / 4, -s / 4, s / 8, s / 8);
    p.ellipse(s / 4, -s / 4, s / 8, s / 8);
  }

  drawArms(s, p) {
    p.fill(this.skinColor);
    p.stroke(this.helmetColor);
    p.strokeWeight(2);
    p.rect(-s / 2 - 5, -5, 5, 10);
    p.rect(s / 2, -5, 5, 10);
  }

  drawWeapon(s, p) {
    p.fill(this.weaponColor);
    p.noStroke();
    p.rect(-s / 8, -s, s / 4, s / 2);
  }

  drawHealthBar(p) {
    if (this.health < this.maxHealth) {
      const barWidth = this.size;
      const barHeight = 5;
      const barX = this.x - barWidth / 2;
      const barY = this.y + this.size / 2 + 5;

      p.fill(0, 0, 0, 150);
      p.rect(barX, barY, barWidth, barHeight);

      const healthPercentage = this.health / this.maxHealth;
      let healthColor;
      if (healthPercentage > 0.5) {
        healthColor = p.color(0, 255, 0);
      } else if (healthPercentage > 0.25) {
        healthColor = p.color(255, 255, 0);
      } else {
        healthColor = p.color(255, 0, 0);
      }

      p.fill(healthColor);
      p.rect(barX, barY, barWidth * healthPercentage, barHeight);
    }
  }

  drawSpeechBubble(p) {
    if (this.speechText && this.speechTimer > 0) {
      const alpha = min(1, this.speechTimer / 20) * 255;
      const bubblePadding = 10;
      const bubbleY = this.y - this.size / 2 - 30;

      p.textSize(16);
      p.textAlign(p.CENTER, p.CENTER);
      const textW = p.textWidth(this.speechText) + bubblePadding * 2;
      const textH = p.textAscent() + p.textDescent() + bubblePadding * 2;

      p.fill(0, 0, 0, alpha * 0.7);
      p.stroke(255, 255, 255, alpha);
      p.rect(this.x - textW / 2, bubbleY - textH / 2, textW, textH, 10);

      p.fill(255, 255, 255, alpha);
      p.noStroke();
      p.text(this.speechText, this.x, bubbleY);
    }
  }

  drawSpecificIndicators(p) {
    // Can be implemented by subclasses (e.g., Tank's armor)
  }

  createBullet() {
    const bulletSpeed = 5;
    const bulletSize = 8;
    const bulletDamage = 5;
    const bulletColor = [255, 0, 0];
    const bulletRange = 500;

    return new Bullet(
      this.x,
      this.y,
      this.aimAngle,
      bulletSpeed,
      bulletSize,
      bulletColor,
      bulletDamage,
      bulletRange,
      this.p,
      'enemy-grunt' // Pass owner type
    );
  }

  takeDamage(amount, bulletAngle = null, damageSource = null) {
    if (this.health <= 0) return;

    this.health -= amount;
    this.hitFlash = 4; // 4 frames of white flash

    // Emit an event for other systems to consume (VFX, audio, etc.)
    EnemyEventBus.emitEnemyHit({
      id: this.id, // Pass the unique ID
      x: this.x,
      y: this.y,
      type: this.type,
      damageSource: damageSource,
      bulletAngle: bulletAngle,
    });

    if (this.health <= 0) {
      // Use the new, specific event for enemy death
      EnemyEventBus.emitEnemyKilled({
        x: this.x,
        y: this.y,
        type: this.type,
      });

      // Let game state know this enemy is gone
      if (window.gameState) {
        window.gameState.enemyKilled(this.type);
      }
    }
  }

  checkCollision(other) {
    const distance = sqrt(
      (this.x - other.x) * (this.x - other.x) +
        (this.y - other.y) * (this.y - other.y)
    );
    return distance < this.size / 2 + other.size / 2;
  }

  applyImpulse(angle, strength = 1) {
    if (angle !== null) {
      this.knockVX += cos(angle) * strength;
      this.knockVY += sin(angle) * strength;
    }
  }
}
