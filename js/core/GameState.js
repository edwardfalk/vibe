/**
 * GameState.js - Manages all game state including score, level, health, and game state transitions
 */

export class GameState {
  constructor() {
    // Core game state
    this.score = 0;
    this.startSpeechTimer = null;
    this.highScore = parseInt(localStorage.getItem('vibeHighScore')) || 0;
    this.level = 1;
    this.previousLevelThreshold = 0;
    this.nextLevelThreshold = 150; // First level up at 150 points
    this.gameState = 'playing'; // 'playing', 'gameOver', 'paused'

    // Combat statistics
    this.killStreak = 0;
    this.totalKills = 0;
    this.shotsFired = 0;

    // Timers
    this.gameOverTimer = 0;
    this.pauseStartTime = 0;

    // High score write debounce
    this._highScoreDirty = false;
    this._highScoreDebounceTimer = null;
    this._boundFlush = () => this._flushHighScore();
    if (
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function'
    ) {
      window.addEventListener('beforeunload', this._boundFlush);
    }
  }

  // Score management
  addScore(points) {
    this.score += points;
    this.checkLevelProgression();
    this.updateHighScore();
  }

  addKill() {
    this.totalKills++;
    this.killStreak++;
    if (this.killStreak > 0 && this.killStreak % 5 === 0 && window.audio) {
      window.audio.playSound('killStreak');
    }
  }

  resetKillStreak() {
    this.killStreak = 0;
  }

  addShotFired() {
    this.shotsFired++;
  }

  // Level progression
  checkLevelProgression() {
    while (this.score >= this.nextLevelThreshold) {
      this.level++;

      // Calculate next level threshold with increasing requirements
      const nextLevelIncrease = this.level * 150;
      this.previousLevelThreshold = this.nextLevelThreshold;
      this.nextLevelThreshold += nextLevelIncrease;

      console.log(
        `🎉 LEVEL UP! Now level ${this.level}. Next level at ${this.nextLevelThreshold} points (need ${nextLevelIncrease} more)`
      );

      // Trigger level up effects
      if (window.cameraSystem) {
        window.cameraSystem.addShake(15, 30);
      }

      if (window.audio) {
        window.audio.playSound('levelUp');
      }

      // Level up speech
      if (window.audio && window.player) {
        window.audio.speakPlayerLine(window.player, 'start');
      }
    }
  }

  // High score management
  updateHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this._highScoreDirty = true;
      if (!this._highScoreDebounceTimer) {
        this._highScoreDebounceTimer = setTimeout(() => {
          this._highScoreDebounceTimer = null;
          this._flushHighScore();
        }, 5000);
      }
    }
  }

  _flushHighScore() {
    if (this._highScoreDirty) {
      localStorage.setItem('vibeHighScore', this.highScore.toString());
      this._highScoreDirty = false;
    }
    if (this._highScoreDebounceTimer) {
      clearTimeout(this._highScoreDebounceTimer);
      this._highScoreDebounceTimer = null;
    }
  }

  // Game state transitions
  setGameState(newState) {
    const oldState = this.gameState;
    this.gameState = newState;

    if (newState === 'paused' && oldState === 'playing') {
      this.pauseStartTime = Date.now();
    } else if (newState === 'playing' && oldState === 'paused') {
      // Resume from pause
      console.log('🎮 Game resumed');
    } else if (newState === 'gameOver') {
      this.gameOverTimer = 0;
      this.resetKillStreak();
      this._flushHighScore();

      if (window.audio) {
        window.audio.playSound('gameOver');
      }

      // Game over speech
      if (window.audio && window.player) {
        window.audio.speakPlayerLine(window.player, 'death');
      }

      console.log(
        `💀 Game Over! Final Score: ${this.score}, Level: ${this.level}, Kills: ${this.totalKills}`
      );
      if (window.player) {
        console.log(
          `[DEBUG] setGameState('gameOver'): playerHealth=${window.player.health}, playerPos=(${window.player.x},${window.player.y})`
        );
      }
    }
  }

  // Game restart
  restart() {
    console.log('🔄 Restarting game...');

    if (this.startSpeechTimer) {
      clearTimeout(this.startSpeechTimer);
      this.startSpeechTimer = null;
    }

    // Reset all state
    this.score = 0;
    this.level = 1;
    this.previousLevelThreshold = 0;
    this.nextLevelThreshold = 150;
    this.killStreak = 0;
    this.totalKills = 0;
    this.shotsFired = 0;
    this.gameOverTimer = 0;
    this.pauseStartTime = 0;
    this._flushHighScore();

    // Reset game state
    this.gameState = 'playing';

    // Reset player
    if (window.player) {
      // Use the p5 instance from the player object
      const p = window.player.p;
      window.player.x = p.width / 2;
      window.player.y = p.height / 2;
      window.player.health = window.player.maxHealth;
      window.player.velocity = { x: 0, y: 0 };
      console.log(
        `[DEBUG] restart(): playerHealth=${window.player.health}, playerPos=(${window.player.x},${window.player.y})`
      );
    }

    // Clear all game objects
    if (window.enemies) window.enemies.length = 0;
    if (window.playerBullets) window.playerBullets.length = 0;
    if (window.enemyBullets) window.enemyBullets.length = 0;
    if (window.activeBombs) window.activeBombs.length = 0;

    // Reset camera
    if (window.cameraSystem) {
      window.cameraSystem.x = 0;
      window.cameraSystem.y = 0;
      window.cameraSystem.targetX = 0;
      window.cameraSystem.targetY = 0;
    }

    // Reset explosion manager
    if (window.explosionManager) {
      window.explosionManager.explosions = [];
      window.explosionManager.plasmaClouds = [];
      window.explosionManager.radioactiveDebris = [];
    }

    // Reset spawning
    if (window.spawnSystem) {
      window.spawnSystem.reset();
    }

    // Spawn initial enemies
    if (window.spawnSystem) {
      window.spawnSystem.spawnEnemies(1);
    }

    // Game start speech
    if (this.startSpeechTimer) {
      clearTimeout(this.startSpeechTimer);
      this.startSpeechTimer = null;
    }
    this.startSpeechTimer = setTimeout(() => {
      this.startSpeechTimer = null;
      if (window.audio && window.player) {
        window.audio.speakPlayerLine(window.player, 'start');
      }
    }, 500);

    console.log('✅ Game restarted successfully');
  }

  // Getters for computed values
  getAccuracy() {
    return this.shotsFired > 0
      ? Math.round((this.totalKills / this.shotsFired) * 100)
      : 0;
  }

  getProgressToNextLevel() {
    const progress = this.score - this.previousLevelThreshold;
    const range = this.nextLevelThreshold - this.previousLevelThreshold;
    return range > 0 ? Math.min(1, Math.max(0, progress / range)) : 0;
  }

  // Auto-restart for test mode
  updateGameOverTimer() {
    if (this.gameState === 'gameOver') {
      this.gameOverTimer++;

      // Auto-restart in test mode
      if (window.testModeManager?.enabled && this.gameOverTimer >= 60) {
        console.log(
          '🔄 Auto-restarting game in test mode for continuous testing'
        );
        this.restart();
      }
    }
  }
}
