/**
 * GameState.js - Manages all game state including score, level, health, and game state transitions
 */

import { CONFIG } from '../config.js';
import { isWaiting } from '../audio/TextDisplay.js';

// An end this close to an eighth (in eighths) counts as on it
const ON_EIGHTH = 1e-6;
// A level-up whose bar line the game passed this many beats ago or more,
// with no frame to play it (a hidden tab, ?tune's sound while paused),
// waits for the next one; the stabber drops a step as late (Stabber.js)
const LEVEL_UP_LATE_BEATS = 0.25;

// The first beat 1 at or after the heard now, which the game may have passed
// by up to its lead (BeatClock); seconds on the clock
function nextBarLine(clock) {
  const bar = (clock.beatInterval * clock.beatsPerMeasure) / 1000;
  const origin = clock.startTime / 1000;
  const heard = clock.nowSec() - clock.aheadSec;
  return origin + Math.ceil((heard - origin) / bar) * bar;
}

// A browser that blocks site data throws on any access to localStorage
function readHighScore() {
  try {
    return parseInt(localStorage.getItem('vibeHighScore')) || 0;
  } catch {
    return 0;
  }
}

export class GameState {
  constructor() {
    // Core game state
    this.score = 0;
    this.startSpeechTimer = null;
    this.highScore = readHighScore();
    // What this run has to beat; highScore itself follows the score up
    this.highScoreAtRunStart = this.highScore;
    this.level = 1;
    this.previousLevelThreshold = 0;
    this.nextLevelThreshold = CONFIG.PACING.FIRST_LEVEL_POINTS;
    this.levelUpAt = null; // the bar line a level-up waits for (updateLevelUp)
    this.lastLevelUpAt = null; // the one it last played on, for the sky
    this.gameState = 'playing'; // 'title', 'playing', 'gameOver', 'paused'
    // His death scene, the first bar of 'gameOver' (startDeathScene)
    this.scene = null;
    this.practiceRun = false; // set by ?tune jumps: no high score this run

    // Combat statistics
    this.killStreak = 0;
    this.totalKills = 0;
    this.shotsFired = 0;
    this.shotsHit = 0; // his bullets that landed, for the accuracy

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

  addShotHit() {
    this.shotsHit++;
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

      // Its sound and shake wait for the next beat 1 you hear
      // (updateLevelUp). Two levels in one bar share it
      if (window.beatClock) this.levelUpAt = nextBarLine(window.beatClock);

      // A new level: the next place he looks for his carpet
      if (window.audio && window.player) {
        window.audio.speakPlayerLine(window.player, 'levelUp');
      }
    }
  }

  /**
   * Every frame: the level-up's sound and shake, once the game reaches its
   * bar line. Only in play: a death before it, even in the update that
   * earned it, drops them (restart)
   */
  updateLevelUp() {
    const at = this.levelUpAt;
    if (at === null || this.gameState !== 'playing') return;
    const clock = window.beatClock;
    const now = clock.nowSec();
    if (now < at) return;
    if (now - at >= (LEVEL_UP_LATE_BEATS * clock.beatInterval) / 1000) {
      this.levelUpAt = nextBarLine(clock);
      return;
    }
    this.levelUpAt = null;
    this.lastLevelUpAt = at;
    window.cameraSystem?.addShake(15, 30);
    window.audio?.playSound('levelUp', null, null, { at });
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
      // A browser that blocks site data throws here: the run goes on unsaved
      try {
        localStorage.setItem('vibeHighScore', this.highScore.toString());
      } catch {
        // nothing to keep it in
      }
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
    this.levelUpAt = null;
    this.lastLevelUpAt = null;
    this.killStreak = 0;
    this.totalKills = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
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
      // otherwise survive; and a dash he died in, its cooldown, a shot still
      // queued and a burst he was firing don't carry over (only his update
      // counts them down): his first shot is immediate, as any burst's is
      window.player.shotAt = null;
      window.player.hurtAt = null;
      window.player.shieldBackAt = null;
      window.player.footfalls = [];
      window.player.lastEighth = null;
      window.player.isDashing = false;
      window.player.dashTimerMs = 0;
      window.player.dashCooldownMs = 0;
      window.player.queuedShot = null;
      window.player.shootCooldownMs = 0;
      window.player.isCurrentlyShooting = false;
      window.player.firstShotFired = false;
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

    // A run's first swarm of grunts comes on the spawn system's first update
    // (SpawnSystem.update), in place of an initial enemy

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
      ? Math.round((this.shotsHit / this.shotsFired) * 100)
      : 0;
  }

  getProgressToNextLevel() {
    const progress = this.score - this.previousLevelThreshold;
    const range = this.nextLevelThreshold - this.previousLevelThreshold;
    return range > 0 ? Math.min(1, Math.max(0, progress / range)) : 0;
  }
}
