/**
 * GameState.js - Manages all game state including score, level, health, and transitions
 * (moved to @vibe/core)
 */

import { max, min, setRandomSeed } from './mathUtils.js';

export class GameState {
  constructor(restartContext = null) {
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('vibeHighScore')) || 0;
    this.level = 1;
    this.nextLevelThreshold = 150;
    this.gameState = 'playing';

    this.killStreak = 0;
    this.totalKills = 0;
    this.shotsFired = 0;

    // --- Unified arrays replacing window globals -------------------------
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.activeBombs = [];

    // Proxy accessors on window were removed (2025-08-16). Modules should now
    // reference arrays via window.gameState.<array> directly.

    this.gameOverTimer = 0;
    this.pauseStartTime = 0;

    // Optional injected dependencies for restart()
    this._restartContext = restartContext;
  }

  addScore(points) {
    this.score += points;
    this.checkLevelProgression();
    this.updateHighScore();
  }
  addKill() {
    this.totalKills++;
    this.killStreak++;
  }
  resetKillStreak() {
    this.killStreak = 0;
  }
  addShotFired() {
    this.shotsFired++;
  }

  checkLevelProgression() {
    if (this.score >= this.nextLevelThreshold) {
      this.level++;
      const nextLevelIncrease = this.level * 150;
      this.nextLevelThreshold += nextLevelIncrease;
      console.log(
        `🎉 LEVEL UP! Now level ${this.level}. Next at ${this.nextLevelThreshold}`
      );
      if (window.cameraSystem) window.cameraSystem.addShake(15, 30);
      if (window.audio && window.player)
        window.audio.speakPlayerLine(window.player, 'start');
    }
  }

  updateHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('vibeHighScore', this.highScore.toString());
    }
  }

  setGameState(newState) {
    const old = this.gameState;
    this.gameState = newState;
    if (newState === 'paused' && old === 'playing') {
      this.pauseStartTime = Date.now();
    } else if (newState === 'playing' && old === 'paused') {
      console.log('🎮 Game resumed');
    } else if (newState === 'gameOver') {
      this.gameOverTimer = 0;
      this.resetKillStreak();
      if (window.audio && window.player)
        window.audio.speakPlayerLine(window.player, 'death');
      console.log(
        `💀 Game Over! Score: ${this.score}, Level: ${this.level}, Kills: ${this.totalKills}`
      );

      // Trigger death-transition system if available
      if (
        window.deathTransitionSystem &&
        typeof window.deathTransitionSystem.onPlayerDeath === 'function'
      ) {
        window.deathTransitionSystem.onPlayerDeath();
      }
    }
  }

  restart(restartContext = null) {
    const ctx = restartContext || this._restartContext;
    if (!ctx) {
      throw new Error(
        'GameState.restart requires a context. Pass one to the constructor or to restart().'
      );
    }

    console.log('🔄 Robust Restart: Re-initializing systems...');

    // Ensure deterministic RNG across restarts (fallback to local util if not injected)
    const rngSetter = ctx.setRandomSeed || setRandomSeed;
    rngSetter(ctx.gameSeed || 1337);

    // Recreate entity arrays
    const enemies = (this.enemies = []);
    const playerBullets = (this.playerBullets = []);
    const enemyBullets = (this.enemyBullets = []);
    const activeBombs = (this.activeBombs = []);
    if (typeof ctx.assignEntityArrays === 'function') {
      ctx.assignEntityArrays({
        enemies,
        playerBullets,
        enemyBullets,
        activeBombs,
      });
    }

    // Recreate player centered on canvas if we have an active p5 instance
    const p = typeof ctx.getP5 === 'function' ? ctx.getP5() : null;
    if (
      p &&
      typeof ctx.createPlayer === 'function' &&
      typeof ctx.setPlayer === 'function'
    ) {
      const newPlayer = ctx.createPlayer(
        p,
        p.width / 2,
        p.height / 2,
        ctx.cameraSystem || null
      );
      ctx.setPlayer(newPlayer);
      if (typeof ctx.dispatchPlayerChanged === 'function') {
        ctx.dispatchPlayerChanged(newPlayer);
      }
    }

    // Reset camera
    if (ctx.cameraSystem) {
      ctx.cameraSystem.x = 0;
      ctx.cameraSystem.y = 0;
      ctx.cameraSystem.targetX = 0;
      ctx.cameraSystem.targetY = 0;
    }

    // Recreate managers
    const explosionManager = ctx.createExplosionManager
      ? ctx.createExplosionManager()
      : null;
    const effectsManager = ctx.createEffectsManager
      ? ctx.createEffectsManager()
      : null;

    let visualEffectsManager = ctx.visualEffectsManager || null;
    const backgroundLayers =
      typeof ctx.getVisualEffectsBackgroundLayers === 'function'
        ? ctx.getVisualEffectsBackgroundLayers()
        : null;
    if (
      !visualEffectsManager &&
      backgroundLayers &&
      typeof ctx.createVisualEffectsManager === 'function'
    ) {
      visualEffectsManager = ctx.createVisualEffectsManager(backgroundLayers);
    } else if (
      visualEffectsManager &&
      backgroundLayers &&
      typeof ctx.createVisualEffectsManager === 'function'
    ) {
      // Rebuild to ensure clean state, mirroring legacy behavior
      visualEffectsManager = ctx.createVisualEffectsManager(backgroundLayers);
    }
    if (
      visualEffectsManager &&
      p &&
      typeof ctx.initVisualEffectsManager === 'function'
    ) {
      ctx.initVisualEffectsManager(visualEffectsManager, p);
    }
    if (typeof ctx.setManagers === 'function') {
      ctx.setManagers({
        explosionManager,
        effectsManager,
        visualEffectsManager,
      });
    }

    // Recreate systems
    const spawnSystem = ctx.createSpawnSystem ? ctx.createSpawnSystem() : null;
    const collisionSystem = ctx.createCollisionSystem
      ? ctx.createCollisionSystem()
      : null;
    const beatClock = ctx.createBeatClock ? ctx.createBeatClock(120) : null;
    if (typeof ctx.setSystems === 'function') {
      ctx.setSystems({ spawnSystem, collisionSystem, beatClock });
    }

    // Reset game stats
    this.score = 0;
    this.level = 1;
    this.nextLevelThreshold = 150;
    this.killStreak = 0;
    this.totalKills = 0;
    this.shotsFired = 0;
    this.gameOverTimer = 0;
    this.pauseStartTime = 0;
    this.gameState = 'playing';

    // Initial spawn
    if (spawnSystem && typeof spawnSystem.spawnEnemies === 'function') {
      spawnSystem.spawnEnemies(1);
    } else if (typeof ctx.spawnEnemies === 'function') {
      ctx.spawnEnemies(1);
    }

    // Ensure local references reflect newly assigned arrays/managers (single invocation)
    if (typeof ctx.updateGameLoopLocals === 'function') {
      ctx.updateGameLoopLocals();
    }

    // Audio prompt after restart (delayed slightly)
    setTimeout(() => {
      if (
        typeof ctx.speakPlayerLine === 'function' &&
        typeof ctx.getPlayer === 'function'
      ) {
        const player = ctx.getPlayer();
        if (player) ctx.speakPlayerLine(player, 'start');
      }
    }, 500);

    console.log('✅ Robust game restart complete.');
  }

  setRestartContext(restartContext) {
    this._restartContext = restartContext;
  }

  getAccuracy() {
    return this.shotsFired > 0
      ? Math.round((this.totalKills / this.shotsFired) * 100)
      : 0;
  }
  getProgressToNextLevel() {
    const level = this.level || 1;
    const required = level * 150;
    if (required <= 0) return 0;

    // Cumulative points required to reach the start of the current level
    const previousThreshold = (150 * (level - 1) * level) / 2;
    const rawProgress = this.score - previousThreshold;
    const progress = max(0, min(rawProgress, required));
    return progress / required;
  }

  updateGameOverTimer() {
    if (this.gameState === 'gameOver') {
      this.gameOverTimer++;
    }
  }

  /** Read-only accessors (migration helpers) */
  getEnemies() {
    return this.enemies;
  }
  getPlayerBullets() {
    return this.playerBullets;
  }
  getEnemyBullets() {
    return this.enemyBullets;
  }
  getActiveBombs() {
    return this.activeBombs;
  }
}
