/**
 * GameState.js - Manages all game state including score, level, health, and transitions
 * (moved to @vibe/core)
 */

export class GameState {
  constructor() {
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('vibeHighScore')) || 0;
    this.level = 1;
    this.nextLevelThreshold = 150;
    this.gameState = 'playing';

    this.killStreak = 0;
    this.totalKills = 0;
    this.shotsFired = 0;

    this.gameOverTimer = 0;
    this.pauseStartTime = 0;
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
    }
  }

  /**
   * TODO: This method is tightly coupled to window globals (cameraSystem, audio, etc.).
   * Refactor to use dependency injection for better modularity.
   */
  restart() {
    console.log('🔄 Robust Restart: Re-initializing systems...');
    this._resetEntities();
    // ... rest of restart logic ...
  }

  _resetEntities() {
    window.enemies = [];
    window.playerBullets = [];
    window.enemyBullets = [];
    window.activeBombs = [];
  }

    if (window.player && window.player.p) {
      const p = window.player.p;
      window.player = new window.Player(
        p,
        p.width / 2,
        p.height / 2,
        window.cameraSystem
      );
      // Notify systems of the new player reference (event-bus pattern)
      window.dispatchEvent(
        new CustomEvent('playerChanged', { detail: window.player })
      );
    }
    if (window.cameraSystem) {
      window.cameraSystem.x = 0;
      window.cameraSystem.y = 0;
      window.cameraSystem.targetX = 0;
      window.cameraSystem.targetY = 0;
    }
    // [BUGFIX: see ticket "Legacy explosionManager triggers wrong VFX colors"]
    // All legacy explosion manager logic removed. Only event-bus VFX system is re-initialized on restart.
    window.effectsManager = new window.EffectsManager();
    if (
      window.visualEffectsManager &&
      window.visualEffectsManager.backgroundLayers
    ) {
      window.visualEffectsManager = new window.VisualEffectsManager(
        window.visualEffectsManager.backgroundLayers
      );
      // Initialize visual effects manager with current p5 instance
      if (window.player && window.player.p) {
        window.visualEffectsManager.init(window.player.p);
      }
    }
    window.audio = window.audio || null;
    window.speechManager = null;
    window.spawnSystem = new window.SpawnSystem();
    window.collisionSystem = new window.CollisionSystem();
    window.beatClock = new window.BeatClock(120);

    this.score = 0;
    this.level = 1;
    this.nextLevelThreshold = 150;
    this.killStreak = 0;
    this.totalKills = 0;
    this.shotsFired = 0;
    this.gameOverTimer = 0;
    this.pauseStartTime = 0;
    this.gameState = 'playing';

    if (window.spawnSystem) window.spawnSystem.spawnEnemies(1);
    if (typeof window.updateGameLoopLocals === 'function')
      window.updateGameLoopLocals();

    setTimeout(() => {
      if (window.audio && window.player)
        window.audio.speakPlayerLine(window.player, 'start');
    }, 500);

    console.log('✅ Robust game restart complete.');
  }

  getAccuracy() {
    return this.shotsFired > 0
      ? Math.round((this.totalKills / this.shotsFired) * 100)
      : 0;
  }
  getProgressToNextLevel() {
    const currentLevelStart = this.nextLevelThreshold - this.level * 150;
    const progress = this.score - currentLevelStart;
    const required = this.nextLevelThreshold - currentLevelStart;
    return Math.min(progress / required, 1);
  }

  updateGameOverTimer() {
    if (this.gameState === 'gameOver') {
      this.gameOverTimer++;
      if (window.testMode && this.gameOverTimer >= 60) {
        console.log('🔄 Auto-restarting in test mode');
        this.restart();
      }
    }
  }

  update(p, player, enemyCount, deltaTimeMs = 16.6667) {
    // Core per-frame bookkeeping; extend as needed.
    // For now, just advance the game-over timer and maybe level progression hooks.
    this.updateGameOverTimer();
    // Future: hook in difficulty scaling, per-frame analytics, etc.
  }

  isGameOver() {
    return this.gameState === 'gameOver';
  }

  reset() {
    // Reset core state fields to initial values without touching other systems.
    this.score = 0;
    this.level = 1;
    this.nextLevelThreshold = 150;
    this.killStreak = 0;
    this.totalKills = 0;
    this.shotsFired = 0;
    this.gameOverTimer = 0;
    this.pauseStartTime = 0;
    this.gameState = 'playing';
  }
}
