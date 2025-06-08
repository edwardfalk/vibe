/**
 * GameState.js - Manages all game state including score, level, health, and game state transitions
 */

export class GameState {
  constructor() {
    // Core game state
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('vibeHighScore')) || 0;
    this.level = 1;
    this.nextLevelThreshold = 150; // First level up at 150 points
    this.gameState = 'playing'; // 'playing', 'gameOver', 'paused'

    // Combat statistics
    this.killStreak = 0;
    this.totalKills = 0;
    this.shotsFired = 0;

    // Timers
    this.gameOverTimer = 0;
    this.pauseStartTime = 0;
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
  }

  resetKillStreak() {
    this.killStreak = 0;
  }

  addShotFired() {
    this.shotsFired++;
  }

  // Level progression
  checkLevelProgression() {
    if (this.score >= this.nextLevelThreshold) {
      this.level++;

      // Calculate next level threshold with increasing requirements
      const nextLevelIncrease = this.level * 150;
      this.nextLevelThreshold += nextLevelIncrease;

      console.log(
        `🎉 LEVEL UP! Now level ${this.level}. Next level at ${this.nextLevelThreshold} points (need ${nextLevelIncrease} more)`
      );

      // Trigger level up effects
      if (window.cameraSystem) {
        window.cameraSystem.addShake(15, 30);
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
      localStorage.setItem('vibeHighScore', this.highScore.toString());
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

    // Reset all state
    this.score = 0;
    this.level = 1;
    this.nextLevelThreshold = 150;
    this.killStreak = 0;
    this.totalKills = 0;
    this.shotsFired = 0;
    this.gameOverTimer = 0;
    this.pauseStartTime = 0;

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
    setTimeout(() => {
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
    const currentLevelStart = this.nextLevelThreshold - this.level * 150;
    const progress = this.score - currentLevelStart;
    const required = this.nextLevelThreshold - currentLevelStart;
    return Math.min(progress / required, 1);
  }

  // Auto-restart for test mode
  updateGameOverTimer() {
    if (this.gameState === 'gameOver') {
      this.gameOverTimer++;

      // Auto-restart in test mode
      if (window.testMode && this.gameOverTimer >= 60) {
        console.log(
          '🔄 Auto-restarting game in test mode for continuous testing'
        );
        this.restart();
      }
    }
  }
}
