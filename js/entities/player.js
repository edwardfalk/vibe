// Requires p5.js for global utility functions: constrain(), random(), lerp(), etc.
// Requires p5.js in instance mode: all p5 functions/vars must use the 'p' parameter (e.g., p.ellipse, p.fill)
import { CONFIG } from '../config.js';
import { Bullet } from './bullet.js';
import { max, atan2 } from '../mathUtils.js';
import { createContextAccessor } from '../shared/ContextAccessor.js';
import { updateDash, tryStartDash } from './PlayerDash.js';
import { drawPlayer } from './PlayerRenderer.js';

const WORLD_WIDTH = CONFIG.GAME_SETTINGS.WORLD_WIDTH;
const WORLD_HEIGHT = CONFIG.GAME_SETTINGS.WORLD_HEIGHT;

export class Player {
  /**
   * @param {p5} p - The p5 instance
   * @param {number} x - Initial x position
   * @param {number} y - Initial y position
   * @param {CameraSystem} cameraSystem - The camera system (dependency injected for modularity)
   * @param {GameContext} [context] - Game context for bullets, audio, etc.
   */
  constructor(p, x, y, cameraSystem, context = null) {
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

    // Burst state: the first shot is immediate, held fire snaps to eighth notes
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

    this.context = context;
    this.getContextValue = createContextAccessor(() => this.context);
  }

  update(deltaTimeMs) {
    // Handle movement (check both keyboard and testing keys)
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.isMoving = false;

    // Check for W key (up movement)
    if (this.p.keyIsDown(87)) {
      this.velocity.y = -this.speed;
      this.isMoving = true;
    }
    // Check for S key (down movement)
    if (this.p.keyIsDown(83)) {
      this.velocity.y = this.speed;
      this.isMoving = true;
    }
    // Check for A key (left movement)
    if (this.p.keyIsDown(65)) {
      this.velocity.x = -this.speed;
      this.isMoving = true;
    }
    // Check for D key (right movement)
    if (this.p.keyIsDown(68)) {
      this.velocity.x = this.speed;
      this.isMoving = true;
    }

    // Normalize diagonal movement
    if (this.velocity.x !== 0 && this.velocity.y !== 0) {
      this.velocity.x *= 0.707;
      this.velocity.y *= 0.707;
    }

    if (this.isDashing) {
      updateDash(this, deltaTimeMs);
    } else {
      // Apply normal movement
      const dt = deltaTimeMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS; // 60 fps baseline
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
      }
    } else if (this.cameraSystem) {
      // Aim at the mouse in world coordinates (the camera moves)
      const worldMouse = this.cameraSystem.screenToWorld(
        this.p.mouseX,
        this.p.mouseY
      );
      this.aimAngle = atan2(worldMouse.y - this.y, worldMouse.x - this.x);
    } else {
      // Fallback for when camera system is not available
      this.aimAngle = atan2(this.p.mouseY - this.y, this.p.mouseX - this.x);
    }

    // Update animation
    if (this.isMoving) {
      this.animFrame += 0.15;
    }

    // Handle queued shots
    if (this.queuedShot) {
      if (deltaTimeMs > 0) {
        this.queuedShot.timerMs -= deltaTimeMs;
      }

      if (this.queuedShot.timerMs <= 0) {
        // Time to fire the queued shot
        const playerBullets = this.getContextValue('playerBullets');
        if (!playerBullets) {
          this.queuedShot = null;
          // Fall through so cooldowns and other update logic still run
        } else {
          const bullet = this.fireBullet();
          const gameState = this.getContextValue('gameState');
          const audio = this.getContextValue('audio');
          if (bullet) {
            playerBullets.push(bullet);

            if (gameState) {
              gameState.addShotFired();
            }

            if (audio) {
              audio.playPlayerShoot(this.x, this.y);
            }
          }

          // Set proper cooldown to prevent double shot from shoot() later this frame
          this.shootCooldownMs = 200;

          this.queuedShot = null; // Clear the queue
        }
        // Don't immediately re-queue - let the regular shoot() call handle it
      }
    }

    // Reset continuous shooting flag (will be set again if mouse still pressed)
    const wasShooting = this.isCurrentlyShooting;
    this.wantsToContinueShooting = false;

    // The burst ends when no fire input is held (mouse or keys), so held
    // keyboard fire is quantised to eighth notes like the mouse
    if (wasShooting && !window.playerIsShooting) {
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
    drawPlayer(p, this);
  }

  shoot() {
    if (!this.getContextValue('playerBullets')) return null;

    this.wantsToContinueShooting = true;

    // First shot tracking
    if (!this.isCurrentlyShooting) {
      this.isCurrentlyShooting = true;
      this.firstShotFired = false;
    }

    if (this.shootCooldownMs <= 0) {
      // First shot: always immediate
      if (!this.firstShotFired) {
        this.firstShotFired = true;
        const bullet = this.fireBullet();
        this.shootCooldownMs = 200; // Tap cooldown (~8th note)
        return bullet;
      }

      // Sustained fire: quantized to 8th notes
      const beatClock = this.getContextValue('beatClock');
      if (beatClock) {
        if (beatClock.isOnEighthNote()) {
          const bullet = this.fireBullet();
          this.shootCooldownMs = 200;
          return bullet;
        } else if (!this.queuedShot) {
          const timeToNext = beatClock.getTimeToNextEighthNote();
          this.queueShot(timeToNext);
          return null;
        }
      } else {
        // Fallback: fixed 250ms interval
        const bullet = this.fireBullet();
        this.shootCooldownMs = 250;
        return bullet;
      }
    }
    return null;
  }

  fireBullet() {
    // Cooldown is set by the caller (shoot method) after this returns
    this.muzzleFlash = 4;
    this.queuedShot = null; // any shot replaces a pending one, or both fire

    // Calculate bullet spawn position
    const bulletDistance = this.size * 0.8;
    const bulletX = this.x + this.p.cos(this.aimAngle) * bulletDistance;
    const bulletY = this.y + this.p.sin(this.aimAngle) * bulletDistance;

    return Bullet.acquire(bulletX, bulletY, this.aimAngle, 8, 'player');
  }

  queueShot(timeToNextBeat) {
    // Queue shot for next beat - allow re-queuing if no shot is currently queued
    if (!this.queuedShot) {
      this.queuedShot = {
        timerMs: timeToNextBeat, // Store milliseconds directly
        aimAngle: this.aimAngle, // Store current aim angle
      };
    }
  }

  dash() {
    return tryStartDash(this);
  }

  takeDamage(amount, damageSource = 'unknown') {
    const prevHealth = this.health;
    this.health -= amount;

    const gameState = this.getContextValue('gameState');
    const audio = this.getContextValue('audio');

    // Play low health warning sound when crossing the 30% threshold
    if (
      audio &&
      this.health > 0 &&
      this.health <= this.maxHealth * 0.3 &&
      prevHealth > this.maxHealth * 0.3
    ) {
      audio.playSound('lowHealthWarning', this.x, this.y);
    }

    if (gameState && gameState.gameState === 'playing' && audio) {
      const context =
        this.health <= 0
          ? 'death'
          : this.health < this.maxHealth * 0.3
            ? 'lowHealth'
            : 'damage';
      audio.speakPlayerLine(this, context);
    }

    if (this.health <= 0) {
      this.health = 0;
      return true; // Player died
    }
    return false;
  }

  checkCollision(other) {
    const distance = this.p.dist(this.x, this.y, other.x, other.y);
    return distance < (this.size + other.size) * 0.5;
  }
}
