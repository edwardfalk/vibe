import { DEGREES } from './Harmony.js';
import { dB } from '../mathUtils.js';

// playTone's fade-in. Every tone must be comfortably longer than this, or the
// decay's end lands before the attack's and the tone is silent or clicks.
export const TONE_ATTACK_SEC = 0.01;

// The degrees each voice's notes use (Harmony.js); the stabber has them all,
// his sour b5 included
export const VOICE_DEGREES = {
  tank: ['1', '5'],
  grunt: ['b3', '5'],
  stabber: Object.keys(DEGREES),
  rusher: ['b7', '1'],
  hero: ['1', '5'],
  game: ['1', 'b3', '5', 'b7'],
};

// A grunt shoots one of these for life, by his look's seed (Grunt.shotNote):
// a crowd plays both
export const GRUNT_SHOT_NOTES = [
  ['b3', 5],
  ['5', 5],
];

// Each preset plays in its group (Audio.buses): the drums, the band or
// feedback. A volume `× dB(n)` is the mix pass's move into its group's window
// (docs/superpowers/specs/2026-10-10-mix-pass-design.md), on the level it had
export const SOUND_CONFIG = {
  // The hero's shot: one of four sounds (Instruments.js, CONFIG.HERO_SHOT)
  playerShoot: { synth: 'heroShot', group: 'drums' },
  // The grunt's shot: the band's synth stab or laser zap (Instruments.js,
  // CONFIG.BAND.GRUNT_SHOT), on his own note
  alienShoot: { synth: 'gruntShot', group: 'band' },
  // The tank's shot and his charge: the band's 808 boom with its zap, and a
  // rising pluck a beat (Instruments.js)
  tankShot: { synth: 'tankShot', group: 'band' },
  tankCharge: { synth: 'tankCharge', group: 'band' },
  // A tank ball killing an enemy on its way: short, dry, not the shot's boom
  tankBallKill: {
    group: 'feedback',
    voice: 'tank',
    note: ['1', 2],
    waveform: 'square',
    volume: 0.7 * dB(-3.1),
    duration: 0.3,
    sweep: { to: ['1', 1], curve: 'exponential' },
  },
  explosion: {
    group: 'feedback',
    voice: 'game',
    note: ['1', 3],
    waveform: 'sawtooth',
    volume: 0.7 * dB(-3.62),
    duration: 0.4,
    sweep: { to: ['b3', 1], curve: 'exponential' },
  },
  // A shot on one of the tank's intact plates: his fifth, high (his root up
  // there is the hero's tick)
  tankPlateHit: {
    group: 'feedback',
    voice: 'tank',
    note: ['5', 5],
    waveform: 'triangle',
    duration: 0.05,
    volume: 0.4,
    hit: true,
  },
  shieldBreak: {
    group: 'feedback',
    voice: 'hero',
    note: ['1', 6],
    waveform: 'square',
    volume: 0.35 * dB(-3.05),
    duration: 0.25,
    sweep: { to: ['5', 3], curve: 'exponential' },
  },
  shieldUp: {
    group: 'feedback',
    voice: 'hero',
    note: ['1', 4],
    waveform: 'triangle',
    volume: 0.3,
    duration: 0.3,
    sweep: { to: ['1', 6], curve: 'exponential' },
  },
  playerHit: {
    group: 'feedback',
    voice: 'hero',
    note: ['5', 3],
    waveform: 'sawtooth',
    volume: 0.4 * dB(-0.73),
    duration: 0.3,
  },
  // Noise through a band-pass at bandHz (Audio.playTone). The band keeps a
  // small share of the noise, so the volume is set to keep the old saw's
  // level against the kick (tests/audio-levels.test.js)
  enemyFrying: {
    group: 'feedback',
    waveform: 'noise',
    bandHz: 1400,
    duration: 0.3,
    volume: 0.8 * dB(-3),
  },
  gruntAdvance: {
    group: 'band',
    voice: 'grunt',
    note: ['b3', 4],
    waveform: 'square',
    volume: 0.2 * dB(-0.86),
    duration: 0.2,
  },
  gruntRetreat: {
    group: 'band',
    voice: 'grunt',
    note: ['5', 3],
    waveform: 'square',
    volume: 0.25,
    duration: 0.08,
  },
  // The rusher's lit fuse: the band's countdown beeps (Instruments.js)
  rusherFuse: { synth: 'rusherFuse', group: 'band' },
  rusherCharge: {
    group: 'band',
    voice: 'rusher',
    note: ['b7', 4],
    waveform: 'sawtooth',
    volume: 0.5 * dB(-5.99),
    duration: 0.4,
    tremolo: true,
    sweep: { to: ['1', 2], curve: 'exponential' },
  },
  enemyOhNo: {
    group: 'feedback',
    voice: 'game',
    note: ['1', 5],
    waveform: 'sawtooth',
    volume: 0.35,
    duration: 0.4,
    sweep: { to: ['1', 3], curve: 'exponential' },
  },
  stabberOhNo: {
    group: 'feedback',
    voice: 'stabber',
    note: ['b7', 5],
    waveform: 'triangle',
    volume: 0.3 * dB(-5.59),
    duration: 0.35,
    sweep: { to: ['b6', 3], curve: 'exponential' },
  },
  rusherOhNo: {
    group: 'feedback',
    voice: 'rusher',
    note: ['b7', 5],
    waveform: 'sawtooth',
    volume: 0.4 * dB(-7.04),
    duration: 0.5,
    sweep: { to: ['b7', 2], curve: 'exponential' },
  },
  // The grunts' chatter: the band's whine or squeak (Instruments.js)
  gruntChatter: { synth: 'gruntChatter', group: 'band' },
  gruntOw: {
    group: 'feedback',
    voice: 'grunt',
    note: ['5', 4],
    waveform: 'triangle',
    volume: 0.25 * dB(-2.89),
    duration: 0.18,
  },
  gruntHit: {
    group: 'feedback',
    voice: 'grunt',
    note: ['b3', 4],
    waveform: 'square',
    volume: 0.2,
    duration: 0.06,
    hit: true,
  },
  // The bouncer's shove: a whump falling from the hero's band into the
  // tank's, so it stands apart from the kick it often lands with and from
  // the hero's own hit
  tankShove: {
    group: 'feedback',
    voice: 'tank',
    note: ['5', 3],
    waveform: 'triangle',
    volume: 0.6 * dB(-2.92),
    duration: 0.16,
    sweep: { to: ['5', 1], curve: 'exponential' },
  },
  tankHit: {
    group: 'feedback',
    voice: 'tank',
    note: ['1', 1],
    waveform: 'square',
    volume: 0.35,
    duration: 0.2,
    hit: true,
  },
  stabberHit: {
    group: 'feedback',
    voice: 'stabber',
    note: ['5', 6],
    waveform: 'triangle',
    volume: 0.3,
    duration: 0.04,
    hit: true,
  },
  rusherHit: {
    group: 'feedback',
    voice: 'rusher',
    note: ['b7', 4],
    waveform: 'sawtooth',
    volume: 0.3,
    duration: 0.08,
    hit: true,
  },
  playerDash: {
    group: 'feedback',
    waveform: 'noise',
    bandHz: 200,
    volume: 1.65 * dB(1.07), // see enemyFrying
    duration: 0.15,
  },
  levelUp: {
    group: 'feedback',
    voice: 'game',
    note: ['1', 4],
    waveform: 'triangle',
    volume: 0.5 * dB(-6.23),
    duration: 0.6,
    sweep: { to: ['1', 5], curve: 'exponential' },
  },
  gameOver: {
    group: 'feedback',
    voice: 'game',
    note: ['1', 4],
    waveform: 'sawtooth',
    volume: 0.6 * dB(-6.54),
    duration: 1.0,
    sweep: { to: ['1', 1], curve: 'exponential' },
  },
  lowHealthWarning: {
    group: 'feedback',
    voice: 'hero',
    note: ['1', 3],
    waveform: 'square',
    volume: 0.2,
    duration: 0.3,
  },
  killStreak: {
    group: 'feedback',
    voice: 'game',
    note: ['b3', 5],
    waveform: 'triangle',
    volume: 0.35,
    duration: 0.3,
    sweep: { to: ['5', 5], curve: 'linear' },
  },
  gruntResponse: {
    group: 'band',
    voice: 'grunt',
    note: ['b3', 4],
    waveform: 'square',
    volume: 0.2,
    duration: 0.1,
  },
  tankResponse: {
    group: 'band',
    voice: 'tank',
    note: ['5', 1],
    waveform: 'square',
    volume: 0.3,
    duration: 0.3,
  },
  stabberResponse: {
    group: 'band',
    voice: 'stabber',
    note: ['b6', 6],
    waveform: 'triangle',
    volume: 0.25,
    duration: 0.06,
  },
  rusherResponse: {
    group: 'band',
    voice: 'rusher',
    note: ['1', 5],
    waveform: 'sawtooth',
    volume: 0.25,
    duration: 0.15,
    sweep: { to: ['b7', 4], curve: 'exponential' },
  },
  // The rusher's blast: a crash cymbal on beat 1 or 3, its own synth
  // (js/audio/CrashSynth.js). Six squares at the 808 cymbal's ratios, times
  // 1.7; one high-pass above the stabbers and the kick's click; a noise wash
  // and a short bright burst for the bang. CONFIG.RUSHER.CRASH_VOLUME scales it
  rusherCrash: {
    group: 'drums',
    synth: 'crash',
    partialsHz: [349, 517, 628, 889, 918, 1360],
    highpassHz: 5000,
    metal: 0.1, // the squares' level
    wash: 0.22, // the noise wash's level
    washSec: 1.3,
    bang: 0.5, // the burst's level
    bangSec: 0.06,
    volume: 1 * dB(-4.86),
    duration: 1.6, // the metal's ring, the longest part
  },
};
