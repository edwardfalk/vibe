import { DEGREES } from './Harmony.js';

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

export const SOUND_CONFIG = {
  // The hero's shot: one of four sounds (Instruments.js, CONFIG.HERO_SHOT)
  playerShoot: { synth: 'heroShot' },
  // The grunt's shot: the band's synth stab or laser zap (Instruments.js,
  // CONFIG.BAND.GRUNT_SHOT), on his own note
  alienShoot: { synth: 'gruntShot' },
  // The tank's shot and his charge: the band's 808 boom with its zap, and a
  // rising pluck a beat (Instruments.js)
  tankShot: { synth: 'tankShot' },
  tankCharge: { synth: 'tankCharge' },
  // A tank ball killing an enemy on its way: short, dry, not the shot's boom
  tankBallKill: {
    voice: 'tank',
    note: ['1', 2],
    waveform: 'square',
    volume: 0.7,
    duration: 0.3,
    sweep: { to: ['1', 1], curve: 'exponential' },
  },
  explosion: {
    voice: 'game',
    note: ['1', 3],
    waveform: 'sawtooth',
    volume: 0.7,
    duration: 0.4,
    sweep: { to: ['b3', 1], curve: 'exponential' },
  },
  // A shot on one of the tank's intact plates: his fifth, high (his root up
  // there is the hero's tick)
  tankPlateHit: {
    voice: 'tank',
    note: ['5', 5],
    waveform: 'triangle',
    duration: 0.05,
    volume: 0.4,
    hit: true,
  },
  shieldBreak: {
    voice: 'hero',
    note: ['1', 6],
    waveform: 'square',
    volume: 0.35,
    duration: 0.25,
    sweep: { to: ['5', 3], curve: 'exponential' },
  },
  shieldUp: {
    voice: 'hero',
    note: ['1', 4],
    waveform: 'triangle',
    volume: 0.3,
    duration: 0.3,
    sweep: { to: ['1', 6], curve: 'exponential' },
  },
  playerHit: {
    voice: 'hero',
    note: ['5', 3],
    waveform: 'sawtooth',
    volume: 0.4,
    duration: 0.3,
  },
  // Noise through a band-pass at bandHz (Audio.playTone). The band keeps a
  // small share of the noise, so the volume is set to keep the old saw's
  // level against the kick (tests/audio-levels.test.js)
  enemyFrying: {
    waveform: 'noise',
    bandHz: 1400,
    duration: 0.3,
    volume: 0.8,
  },
  gruntAdvance: {
    voice: 'grunt',
    note: ['b3', 4],
    waveform: 'square',
    volume: 0.2,
    duration: 0.2,
  },
  gruntRetreat: {
    voice: 'grunt',
    note: ['5', 3],
    waveform: 'square',
    volume: 0.25,
    duration: 0.08,
  },
  rusherCharge: {
    voice: 'rusher',
    note: ['b7', 4],
    waveform: 'sawtooth',
    volume: 0.5,
    duration: 0.4,
    tremolo: true,
    sweep: { to: ['1', 2], curve: 'exponential' },
  },
  enemyOhNo: {
    voice: 'game',
    note: ['1', 5],
    waveform: 'sawtooth',
    volume: 0.35,
    duration: 0.4,
    sweep: { to: ['1', 3], curve: 'exponential' },
  },
  stabberOhNo: {
    voice: 'stabber',
    note: ['b7', 5],
    waveform: 'triangle',
    volume: 0.3,
    duration: 0.35,
    sweep: { to: ['b6', 3], curve: 'exponential' },
  },
  rusherOhNo: {
    voice: 'rusher',
    note: ['b7', 5],
    waveform: 'sawtooth',
    volume: 0.4,
    duration: 0.5,
    sweep: { to: ['b7', 2], curve: 'exponential' },
  },
  // The grunts' chatter: the band's whine or squeak (Instruments.js)
  gruntChatter: { synth: 'gruntChatter' },
  gruntOw: {
    voice: 'grunt',
    note: ['5', 4],
    waveform: 'triangle',
    volume: 0.25,
    duration: 0.18,
  },
  gruntHit: {
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
    voice: 'tank',
    note: ['5', 3],
    waveform: 'triangle',
    volume: 0.6,
    duration: 0.16,
    sweep: { to: ['5', 1], curve: 'exponential' },
  },
  tankHit: {
    voice: 'tank',
    note: ['1', 1],
    waveform: 'square',
    volume: 0.35,
    duration: 0.2,
    hit: true,
  },
  stabberHit: {
    voice: 'stabber',
    note: ['5', 6],
    waveform: 'triangle',
    volume: 0.3,
    duration: 0.04,
    hit: true,
  },
  rusherHit: {
    voice: 'rusher',
    note: ['b7', 4],
    waveform: 'sawtooth',
    volume: 0.3,
    duration: 0.08,
    hit: true,
  },
  playerDash: {
    waveform: 'noise',
    bandHz: 200,
    volume: 1.65, // see enemyFrying
    duration: 0.15,
  },
  levelUp: {
    voice: 'game',
    note: ['1', 4],
    waveform: 'triangle',
    volume: 0.5,
    duration: 0.6,
    sweep: { to: ['1', 5], curve: 'exponential' },
  },
  gameOver: {
    voice: 'game',
    note: ['1', 4],
    waveform: 'sawtooth',
    volume: 0.6,
    duration: 1.0,
    sweep: { to: ['1', 1], curve: 'exponential' },
  },
  lowHealthWarning: {
    voice: 'hero',
    note: ['1', 3],
    waveform: 'square',
    volume: 0.2,
    duration: 0.3,
  },
  killStreak: {
    voice: 'game',
    note: ['b3', 5],
    waveform: 'triangle',
    volume: 0.35,
    duration: 0.3,
    sweep: { to: ['5', 5], curve: 'linear' },
  },
  gruntResponse: {
    voice: 'grunt',
    note: ['b3', 4],
    waveform: 'square',
    volume: 0.2,
    duration: 0.1,
  },
  tankResponse: {
    voice: 'tank',
    note: ['5', 1],
    waveform: 'square',
    volume: 0.3,
    duration: 0.3,
  },
  stabberResponse: {
    voice: 'stabber',
    note: ['b6', 6],
    waveform: 'triangle',
    volume: 0.25,
    duration: 0.06,
  },
  rusherResponse: {
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
    synth: 'crash',
    partialsHz: [349, 517, 628, 889, 918, 1360],
    highpassHz: 5000,
    metal: 0.1, // the squares' level
    wash: 0.22, // the noise wash's level
    washSec: 1.3,
    bang: 0.5, // the burst's level
    bangSec: 0.06,
    volume: 1,
    duration: 1.6, // the metal's ring, the longest part
  },
};
