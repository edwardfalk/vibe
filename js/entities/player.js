// Requires p5.js for global utility functions: constrain(), random(), lerp(), etc.
// Requires p5.js in instance mode: all p5 functions/vars must use the 'p' parameter (e.g., p.ellipse, p.fill)
import { CONFIG } from '../config.js';
import { Bullet } from './bullet.js';
import { max, atan2, cos, sin, env, clamp01 } from '../mathUtils.js';
import { createContextAccessor } from '../shared/ContextAccessor.js';
import {
  drawPlayer,
  heroShoulder,
  heroMuzzle,
  PROTO_SIZE,
  FEET_Y,
  CRACK_AHEAD,
} from './PlayerRenderer.js';
import { nextFacing, mod } from './GruntRenderer.js';
import { rusherTilt } from './RusherRenderer.js';
import { heardKickOf } from '../audio/BeatTrack.js';

const WORLD_WIDTH = CONFIG.GAME_SETTINGS.WORLD_WIDTH;
const WORLD_HEIGHT = CONFIG.GAME_SETTINGS.WORLD_HEIGHT;
// A dash step clamps the frame time to this range
const MIN_DASH_DELTA_MS = 1;
const MAX_DASH_DELTA_MS = 100;
// His look's timing (PlayerRenderer.js draws from pose())
const DEFAULT_BEAT_MS = 500; // without a beat clock
const STAMPS = ['shotAt', 'hurtAt', 'shieldBackAt']; // beat positions; null = never
const FOOTFALLS_KEPT = 3; // a crack lasts under a beat
const CONTACT_FLINCH_SEC = 0.35; // contact ticks (one a frame) restamp his flinch this seldom
const FIRING_SEC = 0.3; // he yells this long after a shot (held fire is an eighth apart)
const KICK_TAU_SEC = 0.12; // his pulses on the heard kick
const NOD_TAU_SEC = 0.12; // his nod on each beat
const BACK_SHARE = 0.25; // walking this much against his facing, he backs off

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
    this.speed = 3; // px a frame. Keep it constant: his flipbook's stride is drawn for it (PlayerRenderer.js)

    // Movement
    this.velocity = { x: 0, y: 0 };
    this.knockback = { x: 0, y: 0 }; // px/frame, fades (CONFIG.PLAYER)
    this.isMoving = false;

    // Shooting
    this.aimAngle = 0;
    this.shootCooldownMs = 0;
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

    // Shield: takes one real hit, then recharges (CONFIG.PLAYER)
    this.shieldUp = true;
    this.shieldDownMs = 0;
    this.msSinceHit = 0;

    // His look: the beat position update() last kept (so pause and hitstop
    // freeze his pose), the way he faces, and when things happened to him,
    // in beat positions (null = never)
    this.poseBeats = null;
    this.facing = 1; // 1 faces right, -1 left (nextFacing)
    this.shotAt = null;
    this.hurtAt = null;
    this.shieldBackAt = null;
    this.footfalls = []; // { x, y, at, foot }: where his last stomps landed
    this.lastEighth = null; // the eighth note his last stomp landed on

    this.context = context;
    this.getContextValue = createContextAccessor(() => this.context);
    // As the tank and the rusher do: a hit before his first update stamps a real beat
    this.poseBeats =
      this.getContextValue('beatClock')?.getBeatPosition?.() ?? null;
  }

  /** Push him away from (fromX, fromY) with `force` px/frame */
  knockBack(fromX, fromY, force) {
    const angle = atan2(this.y - fromY, this.x - fromX);
    this.knockback.x += cos(angle) * force;
    this.knockback.y += sin(angle) * force;
  }

  update(deltaTimeMs) {
    this.keepPoseBeats();

    // The shield recharges, then comes back on the beat
    if (!this.shieldUp) {
      this.shieldDownMs += deltaTimeMs;
      const beatClock = this.getContextValue('beatClock');
      if (
        this.shieldDownMs >= CONFIG.PLAYER.SHIELD_RECHARGE_MS &&
        // Any beat, but only once it has landed: never ahead of the kick
        (!beatClock || beatClock.isOnBeat([1, 2, 3, 4]))
      ) {
        this.shieldUp = true;
        this.shieldBackAt = this.poseBeats;
        this.getContextValue('audio')?.playSound('shieldUp', this.x, this.y);
      }
    }

    // Slow healing once he has gone REGEN_DELAY_MS without a hit
    this.msSinceHit += deltaTimeMs;
    const { REGEN_DELAY_MS, REGEN_PER_SEC } = CONFIG.PLAYER;
    if (this.health > 0 && this.msSinceHit > REGEN_DELAY_MS) {
      this.health = Math.min(
        this.maxHealth,
        this.health + (REGEN_PER_SEC * deltaTimeMs) / 1000
      );
    }

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
      const clampedDelta = Math.max(
        MIN_DASH_DELTA_MS,
        Math.min(deltaTimeMs, MAX_DASH_DELTA_MS)
      );
      const dt = clampedDelta / CONFIG.GAME_SETTINGS.FRAME_TIME_MS;
      this.x += this.dashVelocity.x * dt;
      this.y += this.dashVelocity.y * dt;

      this.dashTimerMs += clampedDelta;
      if (this.dashTimerMs >= this.maxDashTimeMs) {
        this.isDashing = false;
        this.dashTimerMs = 0;
      }
    } else {
      // Apply normal movement
      const dt = deltaTimeMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS; // 60 fps baseline
      this.x += this.velocity.x * dt;
      this.y += this.velocity.y * dt;
    }

    // Knockback rides on top of steering and dashing, and fades
    const frames = deltaTimeMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS;
    this.x += this.knockback.x * frames;
    this.y += this.knockback.y * frames;
    const keep = CONFIG.PLAYER.KNOCKBACK_DECAY ** frames;
    this.knockback.x *= keep;
    this.knockback.y *= keep;

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

    // His aim. With the arrow keys it is their direction. With the mouse
    // he faces the cursor as seen from his centre, then aims from his
    // shoulder, so his shots leave the drawn gun on a line through the cursor
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
      this.facing = nextFacing(
        this.facing,
        this.aimAngle,
        CONFIG.PLAYER_LOOK.FLIP_COS
      );
    } else {
      // The mouse in world coordinates (the camera moves)
      const at = this.cameraSystem
        ? this.cameraSystem.screenToWorld(this.p.mouseX, this.p.mouseY)
        : { x: this.p.mouseX, y: this.p.mouseY };
      this.facing = nextFacing(
        this.facing,
        atan2(at.y - this.y, at.x - this.x),
        CONFIG.PLAYER_LOOK.FLIP_COS
      );
      const sh = heroShoulder(this.x, this.y, this.facing, this.drawnSize());
      this.aimAngle = atan2(at.y - sh.y, at.x - sh.x);
    }
    this.recordFootfall();

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
              audio.playSound('playerShoot', this.x, this.y);
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
    if (this.dashCooldownMs > 0) {
      this.dashCooldownMs -= deltaTimeMs;
      this.dashCooldownMs = max(0, this.dashCooldownMs);
    }
  }

  /**
   * Keep the beat position for his look. Anything stamped after it is
   * dropped: the clock was moved back (restart() resets it), so it would
   * otherwise come round again in the new run.
   */
  keepPoseBeats() {
    const beats =
      this.getContextValue('beatClock')?.getBeatPosition?.() ?? null;
    this.poseBeats = beats;
    if (beats === null) return;
    for (const key of STAMPS) {
      if (this[key] !== null && this[key] > beats) this[key] = null;
    }
    if (this.footfalls.some((f) => f.at > beats)) {
      this.footfalls = this.footfalls.filter((f) => f.at <= beats);
    }
    if (this.lastEighth !== null && this.lastEighth > beats * 2) {
      this.lastEighth = null;
    }
  }

  /** A stomp on each new eighth note he walks into: his look's cracks */
  recordFootfall() {
    const beats = this.poseBeats;
    if (!this.isMoving || this.isDashing || beats === null) {
      this.lastEighth = null;
      return;
    }
    const eighth = Math.floor(beats * 2);
    // Setting off mid-eighth, his first foot lands on the next one
    if (this.lastEighth === null) this.lastEighth = eighth;
    if (eighth === this.lastEighth) return;
    this.lastEighth = eighth;
    const k = this.drawnSize() / PROTO_SIZE;
    this.footfalls.push({
      x: this.x + this.facing * CRACK_AHEAD * k,
      y: this.y + FEET_Y * k,
      at: eighth / 2,
      foot: mod(eighth, 2),
    });
    if (this.footfalls.length > FOOTFALLS_KEPT) this.footfalls.shift();
  }

  /** His drawn size: his size times PLAYER_LOOK.ART_SCALE */
  drawnSize() {
    return this.size * CONFIG.PLAYER_LOOK.ART_SCALE;
  }

  /** Seconds since a beat-position stamp; Infinity if never (or no clock) */
  sinceStamp(at) {
    if (this.poseBeats === null || at === null) return Infinity;
    const beatMs =
      this.getContextValue('beatClock')?.beatInterval ?? DEFAULT_BEAT_MS;
    return ((this.poseBeats - at) * beatMs) / 1000;
  }

  /** His pose, at the beat update() last kept (frozen while paused), and what happened when */
  pose() {
    const beats = this.poseBeats;
    const beatSec =
      (this.getContextValue('beatClock')?.beatInterval ?? DEFAULT_BEAT_MS) /
      1000;
    const since = (at) => this.sinceStamp(at);
    const eighths = beats === null ? 0 : beats * 2;
    const e8 = Math.floor(eighths);
    const kick =
      beats === null
        ? null
        : heardKickOf(
            this.getContextValue('beatTrack'),
            beats,
            beatSec,
            !!this.getContextValue('audio')?.soundPaused
          );
    const kickEnv = kick ? env(kick.kickAge, KICK_TAU_SEC) : 0;
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    // Without a clock he stands still in his pose, keys or not
    const walking = beats !== null && this.isMoving && !this.isDashing;
    return {
      t: beats === null ? 0 : beats * beatSec,
      side: this.facing,
      aimRel: rusherTilt(this.aimAngle, this.facing), // his aim in his mirrored frame
      moving: walking,
      back: walking && this.velocity.x * this.facing < -BACK_SHARE * speed,
      stepFoot: mod(e8, 2),
      stepPhase: eighths - e8,
      beat:
        beats === null
          ? 0
          : env((beats - Math.floor(beats)) * beatSec, NOD_TAU_SEC),
      kick: kickEnv,
      kickAge: kick ? kick.kickAge : Infinity,
      prevKickAge: kick ? kick.prevKickAge : Infinity,
      downbeatKick: kick?.downbeat ? kickEnv : 0,
      dash: this.isDashing ? clamp01(this.dashTimerMs / this.maxDashTimeMs) : 0,
      dashDir: Math.atan2(this.dashVelocity.y, this.dashVelocity.x),
      hp: this.health / this.maxHealth,
      hurtAge: since(this.hurtAt),
      shotAge: since(this.shotAt),
      firing: this.isCurrentlyShooting || since(this.shotAt) < FIRING_SEC,
      shield: this.shieldUp,
      shatterAge: this.shieldUp ? Infinity : this.shieldDownMs / 1000,
      shieldBackAge: since(this.shieldBackAt),
      footfalls: this.footfalls.map((f) => ({ ...f, age: since(f.at) })),
    };
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
    this.shotAt = this.poseBeats;
    this.queuedShot = null; // any shot replaces a pending one, or both fire

    // It leaves the drawn gun's muzzle
    const m = heroMuzzle(
      this.x,
      this.y,
      this.aimAngle,
      this.facing,
      this.drawnSize()
    );
    return Bullet.acquire(m.x, m.y, this.aimAngle, 8, 'player');
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

  /** Try to start a dash (keys, else toward the mouse). True if it started. */
  dash() {
    if (this.dashCooldownMs > 0 || this.isDashing) return false;

    let dashDirX = 0;
    let dashDirY = 0;
    let dashFromKeyboard = false;

    if (this.p.keyIsDown(87)) {
      dashDirY = -1;
      dashFromKeyboard = true;
    }
    if (this.p.keyIsDown(83)) {
      dashDirY = 1;
      dashFromKeyboard = true;
    }
    if (this.p.keyIsDown(65)) {
      dashDirX = -1;
      dashFromKeyboard = true;
    }
    if (this.p.keyIsDown(68)) {
      dashDirX = 1;
      dashFromKeyboard = true;
    }

    if (dashDirX === 0 && dashDirY === 0 && this.cameraSystem) {
      const worldMouse = this.cameraSystem.screenToWorld(
        this.p.mouseX,
        this.p.mouseY
      );
      const mouseAngle = atan2(worldMouse.y - this.y, worldMouse.x - this.x);
      dashDirX = cos(mouseAngle);
      dashDirY = sin(mouseAngle);
    }

    if (dashFromKeyboard && dashDirX !== 0 && dashDirY !== 0) {
      dashDirX *= 0.707;
      dashDirY *= 0.707;
    }

    // Guard: don't waste dash cooldown on a zero-velocity dash
    if (dashDirX === 0 && dashDirY === 0) return false;

    this.dashVelocity = {
      x: dashDirX * this.dashSpeed,
      y: dashDirY * this.dashSpeed,
    };
    this.isDashing = true;
    this.dashTimerMs = 0;
    this.dashCooldownMs = this.maxDashCooldownMs;
    this.getContextValue('audio')?.playSound('playerDash', this.x, this.y);

    return true;
  }

  takeDamage(amount, damageSource = 'unknown') {
    const gameState = this.getContextValue('gameState');
    const audio = this.getContextValue('audio');
    this.msSinceHit = 0;

    // The shield takes a real hit whole; contact ticks (1 per frame) go
    // straight through and leave it up
    if (this.shieldUp && !damageSource.endsWith('-contact')) {
      this.shieldUp = false;
      this.shieldDownMs = 0;
      audio?.playSound('shieldBreak', this.x, this.y);
      return false;
    }
    audio?.playSound('playerHit');
    gameState?.resetKillStreak?.();
    this.stampHurt(damageSource);

    const prevHealth = this.health;
    this.health -= amount;

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

  /** His look's flinch; contact ticks (one a frame) restamp it at most every CONTACT_FLINCH_SEC */
  stampHurt(damageSource) {
    if (
      damageSource.endsWith('-contact') &&
      this.sinceStamp(this.hurtAt) < CONTACT_FLINCH_SEC
    ) {
      return;
    }
    this.hurtAt = this.poseBeats;
  }

  // Take a hit; a fatal one ends the run. Returns true if the player died.
  hurt(amount, damageSource) {
    if (!this.takeDamage(amount, damageSource)) return false;
    this.getContextValue('gameState')?.setGameState('gameOver');
    return true;
  }

  checkCollision(other) {
    const distance = this.p.dist(this.x, this.y, other.x, other.y);
    return distance < (this.size + other.size) * 0.5;
  }
}
