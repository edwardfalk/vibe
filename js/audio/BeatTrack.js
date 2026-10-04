/**
 * BeatTrack.js - The steady backbone synced to BeatClock
 *
 * A kick drum anchors the beat (four on the floor by default) so enemy
 * sounds have something to fall into. It also keeps the hum's time
 * (Hum.js): the hum dips on every beat this schedules and breathes over its
 * bars. Enemies and player are the instruments; this keeps time.
 * Tunables live in CONFIG.BEAT_TRACK and CONFIG.HUM and are read on every
 * note or pass, so the ?tune panel changes them live.
 *
 * Uses a look-ahead scheduler for sample-accurate timing.
 * Runs on the game's AudioContext: Audio.initialize() starts it.
 */

import { CONFIG } from '../config.js';
import { createContextAccessor } from '../shared/ContextAccessor.js';
import { hz } from './Harmony.js';

const EIGHTH_NOTES_PER_MEASURE = 8;
const BEATS_PER_BAR = 4;
// The kick's click: this much white noise, made once (CLICK_DECAY_SEC stays under it)
const CLICK_NOISE_SEC = 0.03;
// Which beats (0-3) the kick plays on, per CONFIG.BEAT_TRACK.KICK.PATTERN
const KICK_PATTERNS = {
  four: [0, 1, 2, 3],
  oneThree: [0, 2],
};

const mod4 = (n) => ((n % 4) + 4) % 4;
// "None" for the sky: finite, so no maths downstream turns it into NaN
export const NONE_SEC = 99;
// How far back to look for the two latest kicks (oneThree kicks every 2 beats)
const LOOKBACK_BEATS = 8;

/** Does the kick play on this beat (0-3) of the bar? Read live, so ?tune applies at once. */
export function kicksOn(beat) {
  const { KICK } = CONFIG.BEAT_TRACK;
  return KICK.ENABLED && !!KICK_PATTERNS[KICK.PATTERN]?.includes(beat);
}

/**
 * The kick as the player hears it, for the sky. It works from the grid this
 * track plays on and the current pattern, so a pattern change, a stall or a
 * restart can cost one wrong pulse (see the spec). Times are seconds; "none"
 * is NONE_SEC.
 * @param {number} beats BeatClock's position in beats (getTotalBeats() + getBeatPhase())
 * @param {number} beatSec seconds per beat
 * @param {number} latencySec audio latency (base + output) plus the sky's offset
 * @param {boolean} running the track is playing on a running AudioContext
 */
export function heardKick(beats, beatSec, latencySec, running) {
  const heard = beats - latencySec / beatSec;
  const n = Math.floor(heard);
  const kicks = (k) => running && kicksOn(mod4(k));
  const back = [];
  for (let k = n; k > n - LOOKBACK_BEATS && back.length < 2; k--) {
    if (kicks(k)) back.push(k);
  }
  let next = null;
  for (let k = n + 1; k <= n + 4 && next === null; k++) {
    if (kicks(k)) next = k;
  }
  const age = (k) => (k === undefined ? NONE_SEC : (heard - k) * beatSec);
  return {
    t: heard * beatSec,
    kickAge: age(back[0]),
    prevKickAge: age(back[1]),
    downbeat: back[0] !== undefined && mod4(back[0]) === 0,
    nextKickIn: next === null ? NONE_SEC : (next - heard) * beatSec,
  };
}

/**
 * The heard kick at beat position `beats`, from this track's own state: its
 * AudioContext's latency plus CONFIG.SKY.OFFSET_MS, and whether it is
 * playing. A pause that holds the sound (held) keeps the glow the stopped
 * beat had. The sky and the hero's pulses both read it.
 * @param {?BeatTrack} beatTrack
 * @param {number} beats BeatClock's position in beats
 * @param {number} beatSec seconds per beat
 * @param {boolean} [held] a pause holds the sound
 */
export function heardKickOf(beatTrack, beats, beatSec, held = false) {
  const ctx = beatTrack?.ctx;
  const running = !!beatTrack?.isPlaying && (ctx?.state === 'running' || held);
  const latencySec =
    (ctx?.baseLatency ?? 0) +
    (ctx?.outputLatency ?? 0) +
    CONFIG.SKY.OFFSET_MS / 1000;
  return heardKick(beats, beatSec, latencySec, running);
}
// Look-ahead buffer for sample-accurate scheduling.
// 75ms balances glitch-free playback with minimal audio-visual desync.
const SCHEDULE_AHEAD_SEC = 0.075;
const SCHEDULER_INTERVAL_MS = 25;
// A note this late (a short main-thread stall) still plays, a little late;
// anything later (a hidden tab) is skipped rather than played in a burst
const LATE_GRACE_SEC = 0.05;
// Exponential ramps can't reach 0; this is inaudible
const SILENCE_GAIN = 0.001;
const DRIVE_CURVE_SAMPLES = 1024;
// Fade from SILENCE_GAIN to 0 before stopping, so drive can't turn the
// leftover sine into an audible tick
const TAIL_FADE_SEC = 0.005;

/** The kick's click noise, made once per track (the loudness test makes its own) */
export function clickNoise(ctx) {
  const length = Math.floor(ctx.sampleRate * CLICK_NOISE_SEC);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export class BeatTrack {
  // Tempo comes from BeatClock
  constructor(context = null) {
    this.context = context;
    this.getContextValue = createContextAccessor(context);
    this.volume = CONFIG.MIX.BEAT_TRACK_VOLUME;
    this.muted = false;

    // Web Audio state
    this.ctx = null;
    this.masterGain = null;
    this.isPlaying = false;

    // The run's level and enemy count, handed to the hum as the clock moves
    this._enemyCount = 0;
    this.level = 1;

    // The hum Audio.initialize made; start() picks it up (the voice
    // playground has none)
    this.hum = null;
    this._humFailed = false;
  }

  async start() {
    if (this.isPlaying) return;

    // Called from Audio.initialize(), right after it made the AudioContext
    const audio = this.getContextValue('audio');
    this.ctx = audio.audioContext;
    this.hum = audio.hum ?? null;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.volume;
    // The beat's own duck gain (→ limiter): speech dips it by DUCK_BEAT_DB
    this.masterGain.connect(audio.beatDuckGain);

    this.isPlaying = true;

    this._noiseBuffer = clickNoise(this.ctx);

    this._scheduler();
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this._applyGain();
  }

  setMuted(muted) {
    this.muted = muted;
    this._applyGain();
  }

  _applyGain() {
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
  }

  // -- Scheduler ----------------------------------------------------------

  _scheduler() {
    if (!this.isPlaying || !this.ctx) return;
    // Re-armed first, so an error in this pass can't stop the kick
    setTimeout(() => this._scheduler(), SCHEDULER_INTERVAL_MS);

    const now = this.ctx.currentTime;
    const clock = this.getContextValue('beatClock');
    // Silent until BeatClock runs on this AudioContext (the first moments
    // after start); from then on the kick uses the enemies' grid exactly
    if (clock?.audioContext === this.ctx) {
      const origin = clock.startTime / 1000;
      const eighth = clock.beatInterval / 2000;
      this._beatSec = clock.beatInterval / 1000;
      const n8 = EIGHTH_NOTES_PER_MEASURE;
      // From just before now (skips missed notes after a hidden tab, keeps
      // ones a short stall made late), never before audio time 0 (the grid
      // can begin earlier, and Web Audio rejects a negative time), and never
      // at or before a note already handed to Web Audio (a restart moves the
      // grid)
      const from = Math.max(
        0,
        now - LATE_GRACE_SEC,
        (this._lastNoteSec ?? -Infinity) + eighth / 2
      );
      for (
        let n = Math.ceil((from - origin) / eighth);
        origin + n * eighth < now + SCHEDULE_AHEAD_SEC;
        n++
      ) {
        this._lastNoteSec = origin + n * eighth;
        this._scheduleNote(this._lastNoteSec, ((n % n8) + n8) % n8);
      }
    }

    // The hum follows the root, the drift, the level and the fight, once
    // each time the audio clock moves: a pause or a stalled output freezes
    // it, and writes at one frozen time would pile up. On the game-over
    // screen the fight is over, whatever the frame that ended it last counted.
    if (this.hum && now > (this._humSyncSec ?? -Infinity)) {
      this._humSyncSec = now;
      const over = this.getContextValue('gameState')?.gameState === 'gameOver';
      const enemies = over ? 0 : this._enemyCount;
      this._tryHum(() => this.hum.sync(now, this.level, enemies));
    }
  }

  _scheduleNote(time, eighth) {
    // Only play on downbeats (8th notes 0, 2, 4, 6 = beats 1, 2, 3, 4)
    if (eighth % 2 !== 0) return;
    const beat = eighth / 2; // 0-3
    if (kicksOn(beat)) {
      this._playKick(time);
    }
    // Every beat dips the hum, kick or not; each bar's beat 1 turns its breath
    if (this.hum) {
      this._tryHum(() => {
        this.hum.dipAt(time);
        if (beat === 0) this.hum.barAt(time, BEATS_PER_BAR * this._beatSec);
      });
    }
  }

  // Nothing in the hum can stop the kick: its first error is logged, and
  // the work that threw is skipped
  _tryHum(work) {
    try {
      work();
    } catch (error) {
      if (!this._humFailed) {
        console.error('The hum failed; the kick plays on:', error);
      }
      this._humFailed = true;
    }
  }

  // -- Kick ---------------------------------------------------------------

  _playKick(time) {
    if (!this.ctx || !this.masterGain) return;
    const k = CONFIG.BEAT_TRACK.KICK;

    // Body: a sine whose pitch drops fast from punch to thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(k.PITCH_START_HZ, time);
    // Tuned, the drop ends on the hum's root, with its drift at this moment
    let endHz = k.PITCH_END_HZ;
    if (k.TUNED) this._tryHum(() => (endHz = hz(['1', 1], time)));
    osc.frequency.exponentialRampToValueAtTime(endHz, time + k.PITCH_DROP_SEC);
    gain.gain.setValueAtTime(k.VOLUME, time);
    gain.gain.exponentialRampToValueAtTime(SILENCE_GAIN, time + k.DECAY_SEC);
    gain.gain.linearRampToValueAtTime(0, time + k.DECAY_SEC + TAIL_FADE_SEC);
    osc.connect(gain);
    // Drive after the envelope, so the thump distorts most as it hits
    const shaper = k.DRIVE > 0 ? this._getDriveShaper(k.DRIVE) : null;
    if (shaper) {
      gain.connect(shaper);
      shaper.connect(this.masterGain);
    } else {
      gain.connect(this.masterGain);
    }
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      shaper?.disconnect();
    };
    osc.start(time);
    osc.stop(time + k.DECAY_SEC + TAIL_FADE_SEC);

    // Click: a few ms of high-passed noise for the attack
    if (k.CLICK_LEVEL > 0 && this._noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const clickGain = this.ctx.createGain();
      noise.buffer = this._noiseBuffer;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(k.CLICK_FREQ_HZ, time);
      clickGain.gain.setValueAtTime(k.VOLUME * k.CLICK_LEVEL, time);
      clickGain.gain.exponentialRampToValueAtTime(
        SILENCE_GAIN,
        time + k.CLICK_DECAY_SEC
      );
      noise.connect(filter);
      filter.connect(clickGain);
      clickGain.connect(this.masterGain);
      noise.onended = () => {
        noise.disconnect();
        filter.disconnect();
        clickGain.disconnect();
      };
      noise.start(time);
      noise.stop(time + k.CLICK_DECAY_SEC);
    }
  }

  // Soft-clipping curve tanh(drive * x), normalised so full scale stays full
  // scale. The curve is cached per drive value; each kick gets its own node.
  _getDriveShaper(drive) {
    if (this._driveCurveFor !== drive) {
      const curve = new Float32Array(DRIVE_CURVE_SAMPLES);
      for (let i = 0; i < DRIVE_CURVE_SAMPLES; i++) {
        const x = (i / (DRIVE_CURVE_SAMPLES - 1)) * 2 - 1;
        curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
      }
      this._driveCurve = curve;
      this._driveCurveFor = drive;
    }
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this._driveCurve;
    shaper.oversample = '2x'; // less aliasing from the added overtones
    return shaper;
  }

  setEnemyCount(count) {
    this._enemyCount = count;
  }

  setLevel(level) {
    this.level = level;
  }
}
