// Requires p5.js for global utility functions: constrain(), random(), lerp(), etc.
// Requires p5.js in instance mode: all p5 functions/vars must use the 'p' parameter (e.g., p.ellipse, p.fill)
import { CONFIG } from '../config.js';
import { Bullet } from './bullet.js';
import { max, atan2, sin } from '../mathUtils.js';
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

    this.context = context;
    this.getContextValue = createContextAccessor(() => this.context);
  }

  update(deltaTimeMs) {
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
        if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
          console.log(
            '[AIM] Arrow keys: dx=' +
              dx +
              ', dy=' +
              dy +
              ', angle=' +
              ((this.aimAngle * 180) / Math.PI).toFixed(1)
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
        this.p.frameCount % 60 === 0
      ) {
        console.log(
          `[AIM] Mouse: screen(${this.p.mouseX}, ${this.p.mouseY}) world(${worldMouse.x.toFixed(1)}, ${worldMouse.y.toFixed(1)}) player(${this.x.toFixed(1)}, ${this.y.toFixed(1)}) angle=${((this.aimAngle * 180) / Math.PI).toFixed(1)}°`
        );
      }
    } else {
      // Fallback for when camera system is not available
      this.aimAngle = atan2(this.p.mouseY - this.y, this.p.mouseX - this.x);
      if (
        CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS &&
        this.p.frameCount % 60 === 0
      ) {
        console.log(
          `[AIM] Fallback: mouse(${this.p.mouseX}, ${this.p.mouseY}) player(${this.x.toFixed(1)}, ${this.y.toFixed(1)}) angle=${((this.aimAngle * 180) / Math.PI).toFixed(1)}°`
        );
      }
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

            console.log('🎵 Queued shot fired on beat!');
          }

          // Ensure cooldown doesn't expire this frame (prevents double shots)
          this.shootCooldownMs += deltaTimeMs;

          this.queuedShot = null; // Clear the queue
        }
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
    console.log(
      `🩸 PLAYER DAMAGE: ${amount} HP from ${damageSource} (Health: ${this.health} → ${this.health - amount})`
    );

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
      if (audio.speakPlayerLine(this, context)) {
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
