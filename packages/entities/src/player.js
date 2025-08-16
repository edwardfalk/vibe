// Requires p5.js for global utility functions: constrain(), random(), lerp(), etc.
// Requires p5.js in instance mode: all p5 functions/vars must use the 'p' parameter (e.g., p.ellipse, p.fill)
import { CONFIG } from '@vibe/core';
import { Bullet } from './bullet.js';
import { max, atan2, sin, cos, random, TWO_PI, PI } from '@vibe/core';
import { drawGlow } from '@vibe/fx/visualEffects.js';

const WORLD_WIDTH = CONFIG.GAME_SETTINGS.WORLD_WIDTH;
const WORLD_HEIGHT = CONFIG.GAME_SETTINGS.WORLD_HEIGHT;

export class Player {
  /**
   * @param {p5} p - The p5 instance
   * @param {number} x - Initial x position
   * @param {number} y - Initial y position
   * @param {CameraSystem} cameraSystem - The camera system (dependency injected for modularity)
   */
  constructor(p, x, y, cameraSystem) {
    this.p = p;
    this.x = x;
    this.y = y;
    this.cameraSystem = cameraSystem;
    this.size = 32;
    this.health = 100;
    this.maxHealth = 100;
    this.speed = 3;

    // Movement
    this.velocity = { x: 0, y: 0 };
    this.isMoving = false;
    this.animFrame = 0;

    // Shooting
    this.aimAngle = 0;
    this.shootCooldownMs = 0;
    this.muzzleFlash = 0;
    this.queuedShot = null;
    this.wantsToContinueShooting = false;

    // NEW: Improved shooting system state
    this.isCurrentlyShooting = false;
    this.firstShotFired = false;

    // Dash ability
    this.isDashing = false;
    this.dashVelocity = { x: 0, y: 0 };
    this.dashTimerMs = 0; // ms
    this.maxDashTimeMs = 300; // ms (was 12 frames)
    this.dashSpeed = 8;
    this.dashCooldownMs = 0; // ms
    this.maxDashCooldownMs = 3000; // ms (was 180 frames)

    // Visual colors with better contrast
    this.vestColor = this.p.color(70, 130, 180); // Steel blue vest
    this.pantsColor = this.p.color(25, 25, 112); // Midnight blue pants
    this.skinColor = this.p.color(255, 219, 172); // Peach skin
    this.gunColor = this.p.color(169, 169, 169); // Dark gray gun
    this.bandanaColor = this.p.color(139, 69, 19); // Brown bandana

    // Speech is now handled by unified Audio system
  }

  update(deltaTimeMs) {
    // Log the current game state for debugging - DISABLED to reduce console spam
    // if (window.gameState && window.gameState.gameState) {
    //     console.log('[STATE] gameState:', window.gameState.gameState);
    // }

    // Handle movement (check both keyboard and testing keys)
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.isMoving = false;

    // Check for W key (up movement)
    if (
      this.p.keyIsDown(87) ||
      (window.keys && (window.keys.W || window.keys.w))
    ) {
      this.velocity.y = -this.speed;
      this.isMoving = true;
    }
    // Check for S key (down movement)
    if (
      this.p.keyIsDown(83) ||
      (window.keys && (window.keys.S || window.keys.s))
    ) {
      this.velocity.y = this.speed;
      this.isMoving = true;
    }
    // Check for A key (left movement)
    if (
      this.p.keyIsDown(65) ||
      (window.keys && (window.keys.A || window.keys.a))
    ) {
      this.velocity.x = -this.speed;
      this.isMoving = true;
    }
    // Check for D key (right movement)
    if (
      this.p.keyIsDown(68) ||
      (window.keys && (window.keys.D || window.keys.d))
    ) {
      this.velocity.x = this.speed;
      this.isMoving = true;
    }

    // Normalize diagonal movement
    if (this.velocity.x !== 0 && this.velocity.y !== 0) {
      this.velocity.x *= 0.707;
      this.velocity.y *= 0.707;
    }

    // Apply movement (normal or dash)
    if (this.isDashing) {
      // Apply dash movement scaled by elapsed time (same baseline as walking)
      const dt = deltaTimeMs / 16.6667; // 60 FPS baseline
      this.x += this.dashVelocity.x * dt;
      this.y += this.dashVelocity.y * dt;
    } else {
      // Apply normal movement
      const dt = deltaTimeMs / 16.6667; // 60 fps baseline
      this.x += this.velocity.x * dt;
      this.y += this.velocity.y * dt;
    }

    // Use world bounds consistent with CameraSystem.js and bullet.js
    const halfSize = this.size / 2;
    const margin = 5;
    const worldBounds = {
      left: -WORLD_WIDTH / 2 + margin,
      right: WORLD_WIDTH / 2 - margin,
      top: -WORLD_HEIGHT / 2 + margin,
      bottom: WORLD_HEIGHT / 2 - margin,
    };
    this.x = this.p.constrain(
      this.x,
      worldBounds.left + halfSize,
      worldBounds.right - halfSize
    );
    this.y = this.p.constrain(
      this.y,
      worldBounds.top + halfSize,
      worldBounds.bottom - halfSize
    );

    // Use arrow keys for aim if any are pressed
    if (
      window.arrowUpPressed ||
      window.arrowDownPressed ||
      window.arrowLeftPressed ||
      window.arrowRightPressed
    ) {
      let dx = 0,
        dy = 0;
      if (window.arrowUpPressed) dy -= 1;
      if (window.arrowDownPressed) dy += 1;
      if (window.arrowLeftPressed) dx -= 1;
      if (window.arrowRightPressed) dx += 1;
      if (dx !== 0 || dy !== 0) {
        this.aimAngle = atan2(dy, dx);
        if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
          console.log(
            '[AIM] Arrow keys: dx=' +
              dx +
              ', dy=' +
              dy +
              ', angle=' +
              ((this.aimAngle * 180) / PI).toFixed(1)
          );
        }
      }
    } else if (this.cameraSystem) {
      // FIXED: Proper camera-aware mouse aiming
      const worldMouse = this.cameraSystem.screenToWorld(
        this.p.mouseX,
        this.p.mouseY
      );
      this.aimAngle = atan2(worldMouse.y - this.y, worldMouse.x - this.x);
      if (
        CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS &&
        typeof this.p.frameCount !== 'undefined' &&
        this.p.frameCount % 60 === 0
      ) {
        console.log(
          `[AIM] Mouse: screen(${this.p.mouseX}, ${this.p.mouseY}) world(${worldMouse.x.toFixed(1)}, ${worldMouse.y.toFixed(1)}) player(${this.x.toFixed(1)}, ${this.y.toFixed(1)}) angle=${((this.aimAngle * 180) / PI).toFixed(1)}°`
        );
      }
    } else {
      // Fallback for when camera system is not available
      this.aimAngle = atan2(this.p.mouseY - this.y, this.p.mouseX - this.x);
      if (
        CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS &&
        typeof this.p.frameCount !== 'undefined' &&
        this.p.frameCount % 60 === 0
      ) {
        console.log(
          `[AIM] Fallback: mouse(${this.p.mouseX}, ${this.p.mouseY}) player(${this.x.toFixed(1)}, ${this.y.toFixed(1)}) angle=${((this.aimAngle * 180) / PI).toFixed(1)}°`
        );
      }
    }

    // Update animation
    if (this.isMoving) {
      this.animFrame += 0.15;
    }

    // Handle dash
    if (this.isDashing) {
      this.dashTimerMs += deltaTimeMs;
      if (this.dashTimerMs >= this.maxDashTimeMs) {
        this.isDashing = false;
        this.dashTimerMs = 0;
        console.log('💨 Dash completed!');
      }
      // Skip walking animation, BUT still update combat timers below
    }

    // Handle queued shots
    if (this.queuedShot) {
      if (deltaTimeMs > 0) {
        this.queuedShot.timerMs -= deltaTimeMs;
      }

      if (this.queuedShot.timerMs <= 0) {
        // Time to fire the queued shot
        const bullet = this.fireBullet();
        if (bullet && window.gameState?.playerBullets) {
          window.gameState.playerBullets.push(bullet);

          window.gameState?.addShotFired();

          // Play shooting sound with spatial audio
          if (window.audio) {
            window.audio.playPlayerShoot(this.x, this.y);
          }

          console.log('🎵 Queued shot fired on beat!');
        }

        // Ensure cooldown doesn't expire this frame (prevents double shots)
        this.shootCooldownMs += deltaTimeMs;

        this.queuedShot = null; // Clear the queue

        // Don't immediately re-queue - let the regular shoot() call handle it
      }
    }

    // Reset continuous shooting flag (will be set again if mouse still pressed)
    const wasShooting = this.isCurrentlyShooting;
    this.wantsToContinueShooting = false;

    // If mouse is not pressed and player was shooting, reset shooting state
    if (wasShooting && !this.p.mouseIsPressed) {
      this.isCurrentlyShooting = false;
      this.firstShotFired = false;
    }

    // Update timers - ENSURE cooldown always decrements
    if (this.shootCooldownMs > 0) {
      if (deltaTimeMs > 0) {
        this.shootCooldownMs -= deltaTimeMs;
        this.shootCooldownMs = max(0, this.shootCooldownMs);
      }
    }
    if (this.muzzleFlash > 0) this.muzzleFlash--;
    if (this.dashCooldownMs > 0) {
      this.dashCooldownMs -= deltaTimeMs;
      this.dashCooldownMs = max(0, this.dashCooldownMs);
    }
  }

  draw(p) {
    // Motion trail disabled for stability

    // Draw enhanced glow effect
    try {
      const healthPercent = this.health / this.maxHealth;
      if (healthPercent > 0.7) {
        drawGlow(p, this.x, this.y, this.size * 2, p.color(100, 200, 255), 0.6);
      } else if (healthPercent < 0.3) {
        // Pulsing red glow when low health
        const pulse = sin(p.frameCount * 0.3) * 0.5 + 0.5;
        drawGlow(
          p,
          this.x,
          this.y,
          this.size * 2.5,
          p.color(255, 100, 100),
          pulse * 0.8
        );
      }
    } catch (error) {
      console.log('⚠️ Player glow error:', error);
    }

    p.push();
    p.translate(this.x, this.y);
    p.rotate(this.aimAngle);

    const s = this.size;
    const walkBob = this.isMoving ? sin(this.animFrame) * 2 : 0;

    // Body bob
    p.translate(0, walkBob);

    // Draw legs (behind body) - ensure they're always visible
    p.fill(this.pantsColor);
    p.noStroke();

    // Reset any potential rendering state issues that might hide legs
    p.blendMode(p.BLEND);

    // Animated leg positions for walking
    const legOffset = this.isMoving ? sin(this.animFrame) * 3 : 0;
    // Ensure leg dimensions are always positive and visible
    const legWidth = max(s * 0.15, 2); // Minimum width of 2 pixels
    const legHeight = max(s * 0.35, 8); // Minimum height of 8 pixels

    p.rect(-s * 0.25, s * 0.1 - legOffset, legWidth, legHeight); // Left leg
    p.rect(s * 0.1, s * 0.1 + legOffset, legWidth, legHeight); // Right leg

    // Draw main body with better visibility
    p.fill(this.vestColor);
    p.stroke(255, 255, 255, 100); // Light outline for clarity
    p.strokeWeight(1);
    p.rect(-s * 0.3, -s * 0.1, s * 0.6, s * 0.4);
    p.noStroke();

    // Draw arms
    p.fill(this.skinColor);

    // Left arm (animated)
    p.push();
    p.translate(-s * 0.25, 0);
    p.rotate(this.isMoving ? sin(this.animFrame) * 0.3 : 0);
    p.rect(-s * 0.06, 0, s * 0.12, s * 0.25);
    p.pop();

    // Right arm (gun arm - steady)
    p.rect(s * 0.2, -s * 0.02, s * 0.12, s * 0.25);

    // Draw gun
    p.fill(this.gunColor);
    p.rect(s * 0.25, -s * 0.04, s * 0.4, s * 0.08);

    // Gun barrel
    p.fill(60);
    p.rect(s * 0.65, -s * 0.025, s * 0.12, s * 0.05);

    // Enhanced muzzle flash with glow
    if (this.muzzleFlash > 0) {
      const flashSize = this.muzzleFlash * 0.8;
      const flashIntensity = this.muzzleFlash / 10;

      // Outer glow
      p.push();
      p.blendMode(p.ADD);
      p.fill(255, 255, 100, 100 * flashIntensity);
      p.noStroke();
      p.ellipse(s * 0.8, 0, flashSize * 2);

      // Inner flash
      p.fill(255, 255, 200, 200 * flashIntensity);
      p.ellipse(s * 0.8, 0, flashSize);

      // Core
      p.fill(255, 255, 255, 255 * flashIntensity);
      p.ellipse(s * 0.8, 0, flashSize * 0.4);
      p.blendMode(p.BLEND);
      p.pop();
    }

    // Draw head
    p.fill(this.skinColor);
    p.ellipse(0, -s * 0.25, s * 0.3);

    // Draw bandana
    p.fill(this.bandanaColor);
    p.rect(-s * 0.15, -s * 0.35, s * 0.3, s * 0.08);

    // Bandana tails
    p.rect(-s * 0.12, -s * 0.27, s * 0.04, s * 0.15);
    p.rect(s * 0.08, -s * 0.25, s * 0.04, s * 0.12);

    // Mysterious eyes
    p.fill(0);
    const eyeOffset = s * 0.07;
    const eyeSize = s * 0.06;
    p.ellipse(-eyeOffset, -s * 0.25, eyeSize);
    p.ellipse(eyeOffset, -s * 0.25, eyeSize);

    // Sunglasses (slightly larger)
    p.fill(20); // Very dark gray/black
    const lensW = eyeSize * 1.92; // 20% larger than before
    const lensH = eyeSize * 1.32; // 20% larger than before
    p.ellipse(-eyeOffset, -s * 0.25, lensW, lensH); // Left lens
    p.ellipse(eyeOffset, -s * 0.25, lensW, lensH); // Right lens

    // Bridge
    p.stroke(20);
    p.strokeWeight(2);
    p.line(
      -eyeOffset + lensW / 2.5,
      -s * 0.25,
      eyeOffset - lensW / 2.5,
      -s * 0.25
    );

    // Arms
    p.line(-eyeOffset - lensW / 2, -s * 0.25, -eyeOffset - lensW, -s * 0.28);
    p.line(eyeOffset + lensW / 2, -s * 0.25, eyeOffset + lensW, -s * 0.28);
    p.noStroke();

    // Small cosmic horns for flair
    /* p.fill(128, 0, 128);
    p.triangle(
      -s * 0.12,
      -s * 0.35,
      -s * 0.05,
      -s * 0.55,
      -s * 0.01,
      -s * 0.35
    ); */
    //p.triangle(s * 0.12, -s * 0.35, s * 0.05, -s * 0.55, s * 0.01, -s * 0.35);

    // Add cosmic glow effect when healthy
    if (this.health > this.maxHealth * 0.7) {
      p.fill(64, 224, 208, 40); // Turquoise glow
      p.noStroke();
      p.ellipse(0, 0, s * 1.8);
    }

    // Add warning glow when low health
    if (this.health < this.maxHealth * 0.3) {
      const pulse = p.sin(p.frameCount * 0.3) * 0.5 + 0.5;
      p.fill(255, 20, 147, pulse * 60); // Deep pink warning
      p.noStroke();
      p.ellipse(0, 0, s * 2.2);
    }

    // Enhanced dash effect
    if (this.isDashing) {
      const dashProgress = this.dashTimerMs / this.maxDashTimeMs;
      const dashIntensity = 1 - dashProgress; // Fade out over dash duration

      // Multiple layered dash trail effects
      // Outer glow
      p.fill(100, 200, 255, dashIntensity * 80); // Cyan outer glow
      p.noStroke();
      p.ellipse(0, 0, s * 4 * dashIntensity);

      // Middle trail
      p.fill(150, 220, 255, dashIntensity * 120); // Brighter cyan
      p.ellipse(0, 0, s * 2.5 * dashIntensity);

      // Inner core
      p.fill(200, 240, 255, dashIntensity * 160); // Almost white core
      p.ellipse(0, 0, s * 1.5 * dashIntensity);

      // Enhanced speed lines with multiple layers
      for (let layer = 0; layer < 3; layer++) {
        p.stroke(255, 255, 255, dashIntensity * (120 - layer * 30));
        p.strokeWeight(3 - layer);
        for (let i = 0; i < 8; i++) {
          const lineLength = s * (1.5 + i * 0.4 + layer * 0.3);
          const lineAngle =
            atan2(-this.dashVelocity.y, -this.dashVelocity.x) +
            random(-0.3, 0.3);
          const startX = cos(lineAngle) * lineLength * (0.3 + layer * 0.2);
          const startY = sin(lineAngle) * lineLength * (0.3 + layer * 0.2);
          const endX = cos(lineAngle) * lineLength;
          const endY = sin(lineAngle) * lineLength;
          p.line(startX, startY, endX, endY);
        }
      }

      // Particle burst effect
      for (let i = 0; i < 12; i++) {
        const particleAngle = (i / 12) * TWO_PI;
        const particleDistance = s * 2 * dashIntensity;
        const particleX = cos(particleAngle) * particleDistance;
        const particleY = sin(particleAngle) * particleDistance;

        p.fill(100 + i * 10, 200, 255, dashIntensity * 100);
        p.noStroke();
        p.ellipse(particleX, particleY, 4 * dashIntensity, 4 * dashIntensity);
      }

      // Energy distortion rings
      for (let ring = 0; ring < 3; ring++) {
        const ringSize = s * (2 + ring * 0.8) * dashIntensity;
        const ringAlpha = dashIntensity * (60 - ring * 15);

        p.stroke(150, 220, 255, ringAlpha);
        p.strokeWeight(2);
        p.noFill();
        p.ellipse(0, 0, ringSize, ringSize);
      }

      p.noStroke();
    }

    // Health bar above player (drawn relative to player)
    this.drawHealthBar(p);

    p.pop();

    // Speech is now handled by the unified Audio system
  }

  drawHealthBar(p) {
    const barWidth = this.size * 1.2;
    const barHeight = 4;
    const yOffset = -this.size * 0.8;

    // Background
    p.fill(60);
    p.noStroke();
    p.rect(-barWidth / 2, yOffset, barWidth, barHeight);

    // Health
    const healthPercent = this.health / this.maxHealth;
    p.fill(
      healthPercent > 0.5
        ? this.p.color(100, 200, 100)
        : healthPercent > 0.25
          ? this.p.color(255, 255, 100)
          : this.p.color(255, 100, 100)
    );
    p.rect(-barWidth / 2, yOffset, barWidth * healthPercent, barHeight);
  }

  shoot() {
    // Rhythm-locked shooting: first shot instant, subsequent shots only on quarter-beats
    this.wantsToContinueShooting = true;

    // Initialise state when the player starts holding the trigger
    if (!this.isCurrentlyShooting) {
      this.isCurrentlyShooting = true;
      this.firstShotFired = false;
    }

    // Enforce BeatClock timing only when test mode is disabled
    const beatClockReady =
      window.beatClock &&
      typeof window.beatClock.canPlayerShootQuarterBeat === 'function';
    const testModeActive = !!(
      window.testModeManager && window.testModeManager.enabled
    );
    if (
      beatClockReady &&
      !testModeActive &&
      !window.beatClock.canPlayerShootQuarterBeat()
    ) {
      return null;
    }

    // Cool-down check
    if (this.shootCooldownMs > 0) {
      return null;
    }

    // First shot is always allowed for snappy response
    if (!this.firstShotFired) {
      this.firstShotFired = true;
      const quarterBeatMs =
        window.beatClock && window.beatClock.beatInterval
          ? window.beatClock.beatInterval / 4
          : 150;
      this.shootCooldownMs = quarterBeatMs;
      return this.fireBullet();
    }

    // Subsequent shots
    return this.fireBullet();
  }

  fireBullet() {
    // Set cooldown to a quarter-beat interval when BeatClock is present, otherwise 150 ms fallback
    const quarterBeatMs = window.beatClock
      ? window.beatClock.beatInterval / 4
      : 150;
    this.shootCooldownMs = quarterBeatMs;
    this.muzzleFlash = 4;

    // Calculate bullet spawn position
    const bulletDistance = this.size * 0.8;
    const bulletX = this.x + cos(this.aimAngle) * bulletDistance;
    const bulletY = this.y + sin(this.aimAngle) * bulletDistance;

    console.log(
      `🔫 Player firing bullet: aim=${((this.aimAngle * 180) / PI).toFixed(1)}° pos=(${bulletX.toFixed(1)}, ${bulletY.toFixed(1)})`
    );

    return new Bullet(bulletX, bulletY, this.aimAngle, 8, 'player');
  }

  queueShot(timeToNextBeat) {
    // Queue shot for next beat - allow re-queuing if no shot is currently queued
    if (!this.queuedShot) {
      this.queuedShot = {
        timerMs: timeToNextBeat, // Store milliseconds directly
        aimAngle: this.aimAngle, // Store current aim angle
      };
      console.log(
        `🎵 Shot queued for next beat in ${this.queuedShot.timerMs.toFixed(2)} ms`
      );
    }
  }

  dash() {
    // Can only dash if not on cooldown and not already dashing
    if (this.dashCooldownMs > 0 || this.isDashing) {
      return false;
    }

    // Determine dash direction based on current movement
    let dashDirX = 0;
    let dashDirY = 0;

    if (this.p.keyIsDown(87)) dashDirY = -1; // W
    if (this.p.keyIsDown(83)) dashDirY = 1; // S
    if (this.p.keyIsDown(65)) dashDirX = -1; // A
    if (this.p.keyIsDown(68)) dashDirX = 1; // D

    // If no movement keys, dash away from mouse (emergency escape)
    if (dashDirX === 0 && dashDirY === 0) {
      const mouseAngle = atan2(this.p.mouseY - this.y, this.p.mouseX - this.x);
      dashDirX = -cos(mouseAngle); // Opposite direction from mouse
      dashDirY = -sin(mouseAngle);
    }

    // Normalize diagonal dashes
    if (dashDirX !== 0 && dashDirY !== 0) {
      dashDirX *= 0.707;
      dashDirY *= 0.707;
    }

    // Set dash velocity
    this.dashVelocity = {
      x: dashDirX * this.dashSpeed,
      y: dashDirY * this.dashSpeed,
    };

    // Start dash
    this.isDashing = true;
    this.dashTimerMs = 0;
    this.dashCooldownMs = this.maxDashCooldownMs;

    console.log(
      `💨 Player dashed! Direction: (${dashDirX.toFixed(2)}, ${dashDirY.toFixed(2)})`
    );
    return true;
  }

  takeDamage(amount, damageSource = 'unknown') {
    if (window.gameState && window.gameState.gameState !== 'playing') {
      return false; // Ignore damage when not in active play state
    }
    console.log(
      `🩸 PLAYER DAMAGE: ${amount} HP from ${damageSource} (Health: ${this.health} → ${this.health - amount})`
    );

    this.health -= amount;

    // Trigger speech only during active play
    if (window.audio) {
      const context =
        this.health <= 0
          ? 'death'
          : this.health < this.maxHealth * 0.3
            ? 'lowHealth'
            : 'damage';
      if (window.audio.speakPlayerLine(this, context)) {
        console.log(`🎤 Player damage reaction triggered`);
      }
    }

    if (this.health <= 0) {
      this.health = 0;
      console.log(`💀 PLAYER KILLED by ${damageSource}!`);
      return true; // Player died
    }
    return false;
  }

  checkCollision(other) {
    const distance = this.p.dist(this.x, this.y, other.x, other.y);
    return distance < (this.size + other.size) * 0.5;
  }

  /**
   * Handle input for testing purposes
   * @param {Object} keys - Key state object
   */
  handleInput(keys) {
    // This method is used by the testing system to simulate input
    // The actual input handling is done in the update() method
    if (keys) {
      // Store previous position for testing
      const prevX = this.x;
      const prevY = this.y;

      // Reset velocity
      this.velocity.x = 0;
      this.velocity.y = 0;

      // Apply movement based on key states
      if (keys.W || keys.w) this.velocity.y = -this.speed;
      if (keys.S || keys.s) this.velocity.y = this.speed;
      if (keys.A || keys.a) this.velocity.x = -this.speed;
      if (keys.D || keys.d) this.velocity.x = this.speed;

      // Normalize diagonal movement
      if (this.velocity.x !== 0 && this.velocity.y !== 0) {
        this.velocity.x *= 0.707;
        this.velocity.y *= 0.707;
      }

      // Apply movement
      this.x += this.velocity.x;
      this.y += this.velocity.y;

      // Apply world bounds
      const halfSize = this.size / 2;
      const margin = 5;
      const worldBounds = {
        left: -WORLD_WIDTH / 2 + margin,
        right: WORLD_WIDTH / 2 - margin,
        top: -WORLD_HEIGHT / 2 + margin,
        bottom: WORLD_HEIGHT / 2 - margin,
      };
      this.x = this.p.constrain(
        this.x,
        worldBounds.left + halfSize,
        worldBounds.right - halfSize
      );
      this.y = this.p.constrain(
        this.y,
        worldBounds.top + halfSize,
        worldBounds.bottom - halfSize
      );

      return {
        moved: Math.abs(this.x - prevX) > 0.1 || Math.abs(this.y - prevY) > 0.1,
        prevPos: { x: prevX, y: prevY },
        newPos: { x: this.x, y: this.y },
      };
    }
    return { moved: false };
  }
}
