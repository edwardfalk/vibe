/**
 * GameState.js - Manages all game state including score, level, health, and game state transitions
 */

import { CONFIG } from '../config.js';
import { isWaiting } from '../audio/TextDisplay.js';

// An end this close to an eighth (in eighths) counts as on it
const ON_EIGHTH = 1e-6;

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
    // His death scene, the first bar of 'gameOver' (startDeathScene)
    this.scene = null;
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

      // A new level: the next place he looks for his carpet
      if (window.audio && window.player) {
        window.audio.speakPlayerLine(window.player, 'levelUp');
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
    // The run ends once: a second fatal hit in the frame that ended it
    // changes nothing
    if (newState === 'gameOver' && this.gameState === 'gameOver') return;
    this.gameState = newState;

    if (newState === 'gameOver') {
      this.resetKillStreak();
      this._flushHighScore();
      this.startDeathScene();
    }
  }

  /**
   * The run is over, and for CONFIG.DEATHS.SCENE_BEATS the world holds still
   * while he lies back (DudeDeath.js): his last breath now, his death line on
   * the beat grid, past the speech cooldown and ahead of any line still
   * waiting. Then GAME OVER, on an eighth note (updateScene). Times are on
   * the audio clock, which a restart doesn't move.
   */
  startDeathScene() {
    const clock = window.beatClock;
    const audio = window.audio;
    if (!clock) {
      // Unit tests with no beat clock: GAME OVER at once
      audio?.playSound('gameOver');
      return;
    }
    // Audio first: starting it moves the clock onto audio time, and the
    // scene's times must be on the clock it is read by
    audio?.ensureAudioContext?.();
    const at = clock.nowSec();
    const eighth = clock.beatInterval / 2000;
    const origin = clock.startTime / 1000;
    const end = at + CONFIG.DEATHS.SCENE_BEATS * eighth * 2;
    this.scene = {
      at,
      // The first eighth at least the scene's length after the hit
      overlayAt:
        origin + Math.ceil((end - origin) / eighth - ON_EIGHTH) * eighth,
      shown: false,
    };
    if (!audio) return;
    audio.playLastBreath(at);
    audio.voicebox?.cancelPending();
    const player = window.player;
    if (!player) return;
    // His death line takes over: his earlier bubbles go, and so do the
    // bubbles of the lines just cancelled, still waiting to show
    audio.activeTexts = audio.activeTexts.filter(
      (t) => t.entity !== player && !isWaiting(t, audio.textTime)
    );
    audio.speakPlayerLine(player, 'death', true);
  }

  /** Every frame: GAME OVER comes up, with its sound, as his scene ends */
  updateScene() {
    const scene = this.scene;
    if (this.gameState !== 'gameOver' || !scene || scene.shown) return;
    if (window.beatClock.nowSec() < scene.overlayAt) return;
    scene.shown = true;
    window.audio?.playSound('gameOver');
  }

  /** Is GAME OVER up? The run is over and his death scene has played */
  overlayUp() {
    return this.gameState === 'gameOver' && (!this.scene || this.scene.shown);
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
    this.scene = null;

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
      // His look starts clean: the beat clock's reset below can land it
      // near beat 4 (it snaps to a beat), so last run's first stamps would
      // otherwise survive; and a dash he died in doesn't carry over
      window.player.shotAt = null;
      window.player.hurtAt = null;
      window.player.shieldBackAt = null;
      window.player.footfalls = [];
      window.player.lastEighth = null;
      window.player.isDashing = false;
      window.player.dashTimerMs = 0;
    }

    // Clear all game objects
    if (window.enemies) window.enemies.length = 0;
    if (window.playerBullets) window.playerBullets.length = 0;
    if (window.enemyBullets) window.enemyBullets.length = 0;
    if (window.activeBombs) window.activeBombs.length = 0;

    // Reset camera, including any screen shake
    if (window.cameraSystem) window.cameraSystem.reset();

    // Every explosion, cloud and death of the last run
    window.explosionManager?.reset();

    // Clear the last run's leftovers on screen
    if (window.floatingText) window.floatingText.texts = [];
    if (window.audio) window.audio.activeTexts = [];
    // Lines still waiting to start belong to the last run, on its grid
    window.audio?.voicebox?.cancelPending();
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
