/**
 * GameState.js - Manages all game state including score, level, health, and transitions
 * (moved to @vibe/core)
 */

import { min } from './mathUtils.js';

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
    this.checkLevelProgression();
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

  // State-only restart; orchestration lives in GameLoop.restartGame(p)
  restart() {
    this._resetEntities();
    this.reset();
  }

  _resetEntities() {
    window.enemies = [];
    window.playerBullets = [];
    window.enemyBullets = [];
    window.activeBombs = [];
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
    return min(progress / required, 1);
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
