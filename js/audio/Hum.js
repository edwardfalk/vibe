/**
 * Hum.js - The universe's tone: a root and its fifth under everything
 *
 * "Warm saws" from the listening page (docs/superpowers/specs/
 * 2026-10-04-universe-hum-design.md): two detuned saws on the root's octave,
 * a saw on the fifth and a sine on the root, through a soft lowpass.
 * BeatTrack keeps its time: dipAt on every beat, barAt on each beat 1, and
 * sync as the audio clock moves (the root, the drift, the level and the fight).
 *
 * Chain: voices -> lowpass -> dip -> fade -> level -> out, which is Audio's
 * masterGain, so mute and the speech duck apply. Each AudioParam has one
 * writer: sync writes the voices' frequencies, the layers' gains, the
 * filter's frequency and the level; dipAt the dip; the first barAt the
 * fade. The breathing adds into the filter's frequency through its own
 * ConstantSource, which barAt ramps. Settings: CONFIG.HUM, read live.
 */

import { CONFIG } from '../config.js';
import { clamp01 } from '../mathUtils.js';
import { hz } from './Harmony.js';

// [note, waveform, detune in cents, level, the game level it joins at]
const VOICES = [
  [['1', 2], 'sawtooth', -7, 0.5, 1],
  [['1', 2], 'sawtooth', 7, 0.5, 1],
  [['5', 2], 'sawtooth', 0, 0.25, 1],
  [['1', 1], 'sine', 0, 0.6, 1],
  [['1', 3], 'sawtooth', 0, 0.15, 3], // the octave above the saws
  [['5', 3], 'sine', 0, 0.05, 5], // the shimmer: the fifth two
  [['5', 4], 'sine', 0, 0.05, 5], // and three octaves up
];
const FILTER_Q = 3;
// The listening page's level for Warm saws; CONFIG.HUM.LEVEL_DB adds to it
const TRIM_DB = -27;
// Time constants: voices follow the drift and a new root; ?tune's level
const VOICE_GLIDE_SEC = 0.1;
const LEVEL_GLIDE_SEC = 0.03;
// A level's layer fades in or out over this; a time constant of a quarter
// of it gets 98% of the way
const LAYER_FADE_SEC = 2;
const LAYER_TAU_SEC = LAYER_FADE_SEC / 4;
const FIGHT_TAU_SEC = 2; // how fast the filter follows the fight
// The dip: down fast at the beat, back up from DIP_HOLD_SEC after it
const DIP_FALL_TAU_SEC = 0.008;
const DIP_HOLD_SEC = 0.07;
const DIP_RISE_TAU_SEC = 0.12;
// BREATH 1 swings the filter by this share of CUTOFF_HZ either way
const BREATH_SHARE = 0.6;
const FADE_IN_SEC = 0.4;

const dbToGain = (db) => 10 ** (db / 20);
const levelGainOf = () => dbToGain(TRIM_DB + CONFIG.HUM.LEVEL_DB);

/**
 * The filter's target: brighter as the screen fills. Fill is enemies over
 * PACING.MAX_ENEMIES_CAP, clamped to 0-1, and 0 with no cap.
 */
export function filterTarget(enemies) {
  const { CUTOFF_HZ, FIGHT_OPEN } = CONFIG.HUM;
  const cap = CONFIG.PACING.MAX_ENEMIES_CAP;
  const fill = cap > 0 ? clamp01(enemies / cap) : 0;
  return CUTOFF_HZ * (1 + FIGHT_OPEN * fill);
}

export class Hum {
  /**
   * Throws on a bad CONFIG.HUM.ROOT before building anything.
   * @param {BaseAudioContext} ctx
   * @param {AudioNode} out where the hum plays (the game: Audio's masterGain)
   */
  constructor(ctx, out) {
    const now = ctx.currentTime;
    // Every pitch first: a bad root throws here, with nothing started
    const pitches = VOICES.map(([note]) => hz(note, now));

    this.levelGain = ctx.createGain();
    this.levelGain.gain.value = levelGainOf();
    this.fade = ctx.createGain();
    this.fade.gain.value = 0; // silent until the first bar
    this.fade.connect(this.levelGain);
    this.dip = ctx.createGain();
    this.dip.connect(this.fade);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = filterTarget(0);
    this.filter.Q.value = FILTER_Q;
    this.filter.connect(this.dip);

    this.breath = ctx.createConstantSource();
    this.breath.offset.value = 0;
    this.breath.connect(this.filter.frequency);
    this.breath.start(now);
    this._breathUp = false;
    this._started = false;

    this.voices = VOICES.map(([note, type, cents, level, from], i) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = pitches[i];
      osc.detune.value = cents;
      const gain = ctx.createGain();
      const on = from <= 1;
      gain.gain.value = on ? level : 0;
      osc.connect(gain);
      gain.connect(this.filter);
      osc.start(now);
      return { note, osc, gain, level, from, on };
    });
    this.levelGain.connect(out);
  }

  /**
   * As the audio clock moves: every voice glides toward its note on the
   * current root and drift; layers fade when the level crosses theirs; the
   * filter follows the fight and the level follows ?tune.
   */
  sync(now, level, enemies) {
    for (const v of this.voices) {
      v.osc.frequency.setTargetAtTime(hz(v.note, now), now, VOICE_GLIDE_SEC);
      const on = level >= v.from;
      if (on !== v.on) {
        v.on = on;
        v.gain.gain.setTargetAtTime(on ? v.level : 0, now, LAYER_TAU_SEC);
      }
    }
    this.filter.frequency.setTargetAtTime(
      filterTarget(enemies),
      now,
      FIGHT_TAU_SEC
    );
    this.levelGain.gain.setTargetAtTime(levelGainOf(), now, LEVEL_GLIDE_SEC);
  }

  /** A beat at audio time `time`: dip, then swell back */
  dipAt(time) {
    const { gain } = this.dip;
    gain.setTargetAtTime(1 - CONFIG.HUM.DIP, time, DIP_FALL_TAU_SEC);
    gain.setTargetAtTime(1, time + DIP_HOLD_SEC, DIP_RISE_TAU_SEC);
  }

  /**
   * A bar's beat 1 at audio time `time`: the filter's breath ramps up over
   * this bar and down over the next. A ramp starts where the last one ended,
   * so a restart that moves the bar line bends the breath. A missed bar (a
   * stall, a hidden tab) leaves the last ramp ended in the past, so the new
   * one is anchored at the value held since. The first bar fades the hum in.
   */
  barAt(time, barSec) {
    const { offset } = this.breath;
    if (!this._started) {
      this._started = true;
      this.fade.gain.setValueAtTime(0, time);
      this.fade.gain.linearRampToValueAtTime(1, time + FADE_IN_SEC);
      offset.setValueAtTime(0, time);
    } else if (time > this._breathEnd.sec) {
      offset.setValueAtTime(this._breathEnd.value, time);
    }
    const { CUTOFF_HZ, BREATH } = CONFIG.HUM;
    const swing = CUTOFF_HZ * BREATH_SHARE * BREATH;
    this._breathUp = !this._breathUp;
    const value = this._breathUp ? swing : -swing;
    offset.linearRampToValueAtTime(value, time + barSec);
    this._breathEnd = { sec: time + barSec, value };
  }
}
