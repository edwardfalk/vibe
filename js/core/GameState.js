/**
 * GameState.js - Manages all game state including score, level, health, and game state transitions
 */

import { CONFIG } from '../config.js';

export class GameState {
  constructor() {
    // Core game state
    this.score = 0;
    this.startSpeechTimer = null;
    this.highScore = parseInt(localStorage.getItem('vibeHighScore')) || 0;
    // What this run has to beat; highScore itself follows the score up
    this.highScoreAtRunStart = this.highScore;
    this.level = 1;
    this.previousLevelThreshold = 0;
    this.nextLevelThreshold = CONFIG.PACING.FIRST_LEVEL_POINTS;
    this.gameState = 'playing'; // 'title', 'playing', 'gameOver', 'paused'
    this.practiceRun = false; // set by ?tune jumps: no high score this run

    // Combat statistics
    this.killStreak = 0;
    this.totalKills = 0;
    this.shotsFired = 0;

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
  // A run that is over earns nothing more: the frame the hero dies in keeps
  // running, and bombs, blasts and friendly fire can still kill enemies in it
  addScore(points) {
    if (this.gameState === 'gameOver') return;
    this.score += points;
    this.checkLevelProgression();
    this.updateHighScore();
  }

  addKill() {
    if (this.gameState === 'gameOver') return;
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
      const nextLevelIncrease =
        this.level * CONFIG.PACING.LEVEL_POINTS_PER_LEVEL;
      this.previousLevelThreshold = this.nextLevelThreshold;
      this.nextLevelThreshold += nextLevelIncrease;

      // Notify BeatTrack of level change for pulse evolution
      if (window.beatTrack && window.beatTrack.setLevel) {
        window.beatTrack.setLevel(this.level);
      }

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
    if (this.practiceRun) return;
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
    this.gameState = newState;

    if (newState === 'gameOver') {
      this.resetKillStreak();
      this._flushHighScore();

      if (window.audio) {
        window.audio.playSound('gameOver');
      }

      // Game over speech
      if (window.audio && window.player) {
        window.audio.speakPlayerLine(window.player, 'death');
      }
    }
  }

  // Hold on the title screen until the first user gesture; restart() starts the run.
  showTitle() {
    this.gameState = 'title';
    if (this.startSpeechTimer) {
      clearTimeout(this.startSpeechTimer);
      this.startSpeechTimer = null;
    }
  }

  // Game restart
  restart() {
    // Reset all state
    this.score = 0;
    this.level = 1;
    this.previousLevelThreshold = 0;
    this.nextLevelThreshold = CONFIG.PACING.FIRST_LEVEL_POINTS;
    this.killStreak = 0;
    this.totalKills = 0;
    this.shotsFired = 0;
    this._flushHighScore();
    this.highScoreAtRunStart = this.highScore;

    // Reset game state
    this.practiceRun = false;
    this.gameState = 'playing';

    // Reset player
    if (window.player) {
      window.player.x = 0; // the world's centre
      window.player.y = 0;
      window.player.health = window.player.maxHealth;
      window.player.velocity = { x: 0, y: 0 };
      window.player.knockback = { x: 0, y: 0 };
      window.player.shieldUp = true;
      window.player.shieldDownMs = 0;
      window.player.msSinceHit = 0;
    }

    // Clear all game objects
    if (window.enemies) window.enemies.length = 0;
    if (window.playerBullets) window.playerBullets.length = 0;
    if (window.enemyBullets) window.enemyBullets.length = 0;
    if (window.activeBombs) window.activeBombs.length = 0;

    // Reset camera, including any screen shake
    if (window.cameraSystem) window.cameraSystem.reset();

    // Reset explosion manager
    if (window.explosionManager) {
      window.explosionManager.explosions = [];
      window.explosionManager.plasmaClouds = [];
      window.explosionManager.radioactiveDebris = [];
      window.explosionManager.fragmentExplosions = [];
    }

    // Clear the last run's leftovers on screen
    if (window.floatingText) window.floatingText.texts = [];
    if (window.audio) window.audio.activeTexts = [];
    if (window.rhythmFX) window.rhythmFX.telegraphs = [];
    this.gameContext?.set('hitStopFrames', 0);
    window.visualEffectsManager?.reset();

    // Reset BeatClock so enemies sync to fresh beat positions
    if (window.beatClock) {
      window.beatClock.reset();
    }

    // Reset BeatTrack to level 1
    if (window.beatTrack && window.beatTrack.setLevel) {
      window.beatTrack.setLevel(1);
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
}
