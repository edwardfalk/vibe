/**
 * Live tuning panel, shown when the URL has ?tune: CONFIG.BEAT_TRACK (the kick, and whether it is tuned to the hum), HUM, SKY, PACING, the grunts' swarms (SWARM),
 * MIX, the rusher's flight, fuse, push and blast (RUSHER) and look (RUSHER_LOOK), the stabber's stalk, lunge, rest,
 * push, health and strings' volumes (STABBER) and size (STABBER_LOOK), the swing a bassist brings (SWING) and his stalk,
 * strings, puff, octave and note (BASSIST), TANK_ARMOR, the tank's turn, aim, motion and health (TANK)
 * and look (TANK_LOOK), the bomb (BOMB), HITBOX, the grunt's motion (GRUNT_LOOK), a Sound
 * while paused box (ticked here: the beat plays on while paused), an
 * Immortal hero box, a Playground voices box (the voice playground's saved
 * edits, in play), the hero's
 * shield, healing, knockback, the damage hits do to him and his size (PLAYER_LOOK),
 * the deaths (DEATHS): the grunt's pop and the Dude's last breath, how
 * long remains stay, how the stabber dies, and the Dude's death scene's
 * length and camera zoom, and the
 * chatter (SPEECH_SETTINGS): the gap between lines, how often each enemy
 * speaks, and the share of the tank's charges he calls out, and the rusher's
 * voice (SPEECH.SPEAKERS.rusher).
 * Voices are tuned in the voice playground (voices.html). Sound and spawn changes apply from the next
 * beat or wave; level thresholds from the next level-up (the first one after
 * a restart); armour on tanks spawned after the change (and the tank's health); the rest at once.
 * To keep a setting, copy the JSON at the bottom into js/config.js.
 */

import { CONFIG } from '../config.js';
import { ROOTS } from '../audio/Harmony.js';
import {
  HERO_SHOT_SOUNDS,
  GRUNT_SHOT_SOUNDS,
  CHATTER_CHOICES,
} from '../audio/Instruments.js';
import { STABBER_STYLES } from '../entities/StabberDeath.js';
import { STORE_KEY, savedVoices } from './SavedVoices.js';

// The rusher's voices from the 2026-10-12 voice studies, to try in play:
// the singer is the game's, the old one his voice before it.
// shortcut: trial voices; once one is picked, put it in config.js and
// delete these and their knob
const RUSHER_VOICES = {
  singer: CONFIG.SPEECH.SPEAKERS.rusher,
  ringmaster: {
    engine: 'espeak',
    voice: { variant: 'announcer', pitch: 55, range: 60, speed: 175 },
    chain: [
      { type: 'bandpass', freq: 1800, q: 2 },
      { type: 'drive', amount: 8 },
      { type: 'slapback', time: 0.12, feedback: 0.2, mix: 0.25 },
    ],
    levelDb: 0,
  },
  cousin: {
    engine: 'espeak',
    voice: { variant: 'Tweaky', pitch: 72, range: 50, speed: 170 },
    chain: [
      { type: 'drive', amount: 5 },
      { type: 'tremolo', rate: 6, depth: 0.2 },
    ],
    levelDb: 0,
  },
  old: {
    engine: 'espeak',
    voice: { variant: 'Tweaky', pitch: 72, range: 90, speed: 235 },
    chain: [
      { type: 'drive', amount: 5 },
      { type: 'tremolo', rate: 14, depth: 0.6 },
    ],
    levelDb: 0,
  },
};

// Quiet time after the voice playground's last save before ?tune's
// Playground voices box takes its edits
const PLAYGROUND_SETTLE_MS = 300;

// [group, key, options]: group is a path under CONFIG; options is
// [min, max, step] for a slider, a list of choices for a dropdown, or an
// object of named choices for a dropdown that sets the chosen value;
// booleans get a checkbox.
const BEAT_CLOCK = 'BEAT_CLOCK';
const KICK = 'BEAT_TRACK.KICK';
const HUM = 'HUM';
const PACING = 'PACING';
const SWARM = 'SWARM';
const MIX = 'MIX';
const TONES = 'TONES';
const HERO_SHOT = 'HERO_SHOT';
const HITS = 'HITS';
const BAND = 'BAND';
const RUSHER = 'RUSHER';
const STABBER = 'STABBER';
const SWING = 'SWING';
const BASSIST = 'BASSIST';
const HITBOX = 'HITBOX';
const SKY = 'SKY';
const GRUNT = 'GRUNT_LOOK';
const TANK = 'TANK';
const TANK_LOOK = 'TANK_LOOK';
const BOMB = 'BOMB';
const DEATHS = 'DEATHS';
const SPEECH = 'SPEECH_SETTINGS';

export const KNOBS = [
  [BEAT_CLOCK, 'AHEAD_MS', [0, 60, 1]],
  [KICK, 'ENABLED'],
  [KICK, 'PATTERN', ['four', 'oneThree']],
  [KICK, 'VOLUME', [0, 1.5, 0.01]],
  [KICK, 'PITCH_START_HZ', [60, 300, 1]],
  [KICK, 'PITCH_END_HZ', [30, 120, 1]],
  [KICK, 'PITCH_DROP_SEC', [0.01, 0.3, 0.005]],
  [KICK, 'DECAY_SEC', [0.05, 1, 0.01]],
  [KICK, 'DRIVE', [0, 20, 0.5]],
  [KICK, 'CLICK_LEVEL', [0, 1.5, 0.01]],
  [KICK, 'CLICK_DECAY_SEC', [0.001, 0.03, 0.001]], // noise buffer is 30 ms
  [KICK, 'CLICK_FREQ_HZ', [500, 8000, 50]],
  [KICK, 'TUNED'],
  [HUM, 'ROOT', Object.keys(ROOTS)],
  [HUM, 'LEVEL_DB', [-24, 12, 1]],
  [HUM, 'DRIFT_CENTS', [0, 30, 1]],
  [HUM, 'SOUNDS_DRIFT'],
  [HUM, 'DIP', [0, 0.9, 0.05]],
  [HUM, 'BREATH', [0, 1, 0.05]],
  [HUM, 'CUTOFF_HZ', [150, 1500, 10]],
  [HUM, 'FIGHT_OPEN', [0, 3, 0.1]],
  [HUM, 'FULL_SCREEN_ENEMIES', [1, 30, 1]],
  [SKY, 'KICK_STRENGTH', [0, 2, 0.05]],
  [SKY, 'DOWNBEAT_FRONT', [0, 2, 0.05]],
  [SKY, 'OFFBEAT_SHARE', [0, 1, 0.05]],
  [SKY, 'PULSE_DECAY_SEC', [0.05, 0.6, 0.01]],
  [SKY, 'OFFSET_MS', [-50, 150, 5]],
  [SKY, 'LEVEL_OVERRIDE', [0, 8, 1]],
  [SKY, 'LEVEL_EASE_SEC', [0.05, 3, 0.05]],
  [PACING, 'FIRST_LEVEL_POINTS', [30, 300, 10]],
  [PACING, 'LEVEL_POINTS_PER_LEVEL', [40, 300, 10]],
  [PACING, 'SPAWN_INTERVAL_BEATS', [2, 16, 1]],
  [PACING, 'SPAWN_INTERVAL_DROP_PER_LEVEL', [0, 2, 0.25]],
  [PACING, 'MIN_SPAWN_INTERVAL_BEATS', [1, 8, 1]],
  [PACING, 'BASE_MAX_ENEMIES', [1, 6, 1]],
  [PACING, 'MAX_ENEMIES_CAP', [2, 12, 1]],
  [PACING, 'PREVIEW_NEW_ENEMY'],
  [PACING, 'PREVIEW_AT_PROGRESS', [0, 1, 0.05]],
  [PACING, 'GRUNT_KILL_POINTS', [1, 10, 1]],
  [SWARM, 'COUNT', [1, 4, 1]],
  [SWARM, 'SIZE_FIRST', [1, 12, 1]],
  [SWARM, 'SIZE_PER_LEVEL', [0, 4, 1]],
  [SWARM, 'SIZE_MAX', [1, 24, 1]],
  [SWARM, 'SHOOTERS_MAX', [1, 8, 1]],
  [SWARM, 'GRUNTS_PER_SHOOTER', [1, 6, 1]],
  [SWARM, 'BREAK_BEATS', [0, 32, 1]],
  [SWARM, 'FIRE_RANGE_PX', [100, 500, 10]],
  [SWARM, 'STANDOFF_PX', [50, 400, 10]],
  [SWARM, 'DRIFT_SHARE', [0, 1, 0.05]],
  [SWARM, 'PULL', [0, 0.1, 0.005]],
  [SWARM, 'SPACING_PX', [10, 160, 2]],
  [SWARM, 'APART_DEG', [0, 180, 5]],
  [SWARM, 'VOLLEY_DB_PER_DOUBLING', [-6, 0, 0.5]],
  [MIX, 'SFX_VOLUME', [0, 1, 0.01]],
  [MIX, 'BEAT_TRACK_VOLUME', [0, 1, 0.01]],
  [MIX, 'SPEECH_VOLUME', [0, 1, 0.05]],
  [MIX, 'DRUMS_DB', [-12, 6, 0.5]],
  [MIX, 'BAND_DB', [-12, 6, 0.5]],
  [MIX, 'FEEDBACK_DB', [-12, 6, 0.5]],
  [MIX, 'SPEECH_DISTANCE_FLOOR', [0, 1, 0.05]],
  [MIX, 'DUCK_SFX_DB', [-24, 0, 1]],
  [MIX, 'DUCK_BEAT_DB', [-24, 0, 1]],
  [MIX, 'DUCK_RELEASE_SEC', [0.05, 1.5, 0.05]],
  [TONES, 'DETUNE_CENTS', [0, 25, 1]],
  [HERO_SHOT, 'SOUND', HERO_SHOT_SOUNDS],
  [HERO_SHOT, 'LEVEL_DB', [-24, 12, 1]],
  [HERO_SHOT, 'SOFTEN_DB', [0, 24, 1]],
  [HERO_SHOT, 'SOFTEN_SHOTS', [0, 32, 1]],
  [HITS, 'LEVEL_DB', [-24, 6, 0.5]],
  [HITS, 'CLIMB_STEPS', [0, 14, 1]],
  [BAND, 'GRUNT_SHOT', GRUNT_SHOT_SOUNDS],
  [BAND, 'GRUNT_SHOT_DB', [-24, 12, 1]],
  [BAND, 'TANK_SHOT_DB', [-24, 12, 1]],
  [BAND, 'CHARGE_DB', [-24, 12, 1]],
  [BAND, 'CHATTER', CHATTER_CHOICES],
  [BAND, 'CHATTER_DB', [-24, 12, 1]],
  [BAND, 'FUSE_DB', [-24, 12, 1]],
  [BAND, 'BASS_PLUCK_DB', [-24, 12, 0.5]],
  [BAND, 'BASS_SLAP_DB', [-24, 12, 0.5]],
  [RUSHER, 'BOOST_PX_S', [0, 600, 10]],
  [RUSHER, 'CRUISE_PX_S', [0, 400, 10]],
  [RUSHER, 'BOOST_TAU_SEC', [0.02, 1, 0.01]],
  [RUSHER, 'CHARGE_BOOST', [1, 2, 0.05]],
  [RUSHER, 'TURN_STEP_DEG', [10, 180, 5]],
  [RUSHER, 'LIGHT_DIST_PX', [10, 150, 5]],
  [RUSHER, 'FUSE_MIN_BEATS', [1, 8, 1]],
  [RUSHER, 'BRAKE', [0, 0.99, 0.01]],
  [RUSHER, 'PUSH'],
  [RUSHER, 'PUSH_PX_S', [0, 600, 10]],
  [RUSHER, 'PUSH_KEEP', [0, 1, 0.05]],
  [RUSHER, 'PUSH_BRAKE', [0.5, 0.99, 0.01]],
  [RUSHER, 'EXPLOSION_RADIUS', [60, 300, 10]],
  [RUSHER, 'EXPLOSION_DAMAGE', [5, 100, 5]],
  [RUSHER, 'CRASH_VOLUME', [0, 2, 0.05]],
  [SWING, 'AND_AT', [0.5, 0.75, 1 / 24]], // 2/3 is the triplet's let
  [BASSIST, 'STALK_MIN_PX', [50, 500, 10]],
  [BASSIST, 'STALK_MAX_PX', [100, 600, 10]],
  [BASSIST, 'APPROACH_PX_S', [0, 400, 10]],
  [BASSIST, 'STALK_PX_S', [0, 200, 5]],
  [BASSIST, 'BACKOFF_PX_S', [0, 300, 10]],
  [BASSIST, 'STEER_SEC', [0.05, 1, 0.05]],
  [BASSIST, 'HITS_PER_STRING', [1, 10, 1]],
  [BASSIST, 'LURCH_PX_S', [0, 600, 10]],
  [BASSIST, 'PUFF_KEEP', [0.5, 0.98, 0.01]],
  [BASSIST, 'TURN_SEC', [0.02, 0.5, 0.02]],
  ['BASSIST_LOOK', 'ART_SCALE', [0.5, 2, 0.05]],
  [BASSIST, 'RECOIL_PX_S', [0, 400, 10]],
  [BASSIST, 'KNOCK_PX_S', [0, 600, 10]],
  [BASSIST, 'KNOCK_MAX_PX_S', [0, 1500, 50]],
  [BASSIST, 'KNOCK_DECAY', [0.5, 0.98, 0.01]],
  [BASSIST, 'OCTAVE', [1, 4, 1]],
  // Above 0, so a note always leaves
  [BASSIST, 'NOTE_GLIDE_PX_S', [10, 300, 5]],
  [BASSIST, 'NOTE_LURCH_PX', [5, 200, 5]],
  [BASSIST, 'NOTE_DAMAGE_TO_TANKS', [0, 30, 1]],
  [STABBER, 'STALK_MIN_PX', [50, 500, 10]],
  [STABBER, 'STALK_MAX_PX', [100, 600, 10]],
  [STABBER, 'APPROACH_PX_S', [0, 400, 10]],
  [STABBER, 'STALK_PX_S', [0, 200, 5]],
  [STABBER, 'BACKOFF_PX_S', [0, 300, 10]],
  [STABBER, 'REACH_SLACK', [1, 2, 0.05]],
  [STABBER, 'DRAWBACK_PX_S', [0, 100, 5]],
  [STABBER, 'LUNGE_SEC', [0.1, 0.6, 0.05]], // ends before his phrase does
  [STABBER, 'OVERSHOOT_PX', [0, 200, 10]],
  [STABBER, 'LUNGE_MIN_PX', [50, 400, 10]],
  [STABBER, 'LUNGE_MAX_PX', [100, 700, 10]],
  [STABBER, 'TIP_HIT_PX', [5, 40, 1]],
  [STABBER, 'RECOIL_PX_S', [0, 2000, 50]],
  [STABBER, 'COAST_PX_S', [0, 1000, 25]],
  [STABBER, 'REST_BARS', [0, 3, 1]],
  [STABBER, 'KNOCK_PX_S', [0, 1200, 20]],
  [STABBER, 'KNOCK_MAX_PX_S', [0, 2400, 50]],
  [STABBER, 'KNOCK_DECAY', [0, 0.98, 0.01]],
  [STABBER, 'HEALTH', [1, 40, 1]], // stabbers spawned after a change
  [STABBER, 'ARMOR', [0, 5, 1]],
  [STABBER, 'ALIEN_STAB_DAMAGE', [0, 60, 1]],
  [STABBER, 'TREMOLO_VOLUME', [0, 3, 0.05]],
  [STABBER, 'STAB_VOLUME', [0, 3, 0.05]],
  [STABBER, 'PLUCK_VOLUME', [0, 3, 0.05]],
  ['STABBER_LOOK', 'ART_SCALE', [0.6, 1.6, 0.05]], // moves his reach too
  ['TANK_ARMOR', 'FRONT', [0, 200, 5]],
  ['TANK_ARMOR', 'SIDE', [0, 150, 5]],
  ['TANK_ARMOR', 'CLANG_VOLUME', [0, 3, 0.05]],
  [TANK, 'HEALTH', [10, 200, 5]],
  [TANK, 'TURN_STEP_DEG', [5, 180, 5]],
  [TANK, 'TURN_SEC', [0.05, 1.9, 0.05]], // under one bar at 120 BPM
  [TANK, 'AIM_ARC_DEG', [10, 180, 5]],
  [TANK, 'AIM_TAU_SEC', [0, 1, 0.05]],
  [TANK, 'DRIFT_PX_S', [0, 60, 1]],
  [TANK, 'LURCH_PX_S', [0, 300, 5]],
  [TANK, 'LURCH_TAU_SEC', [0.05, 1, 0.01]],
  [TANK, 'LURCH_MIN_DIST_PX', [0, 400, 10]],
  [TANK, 'SHOT_DAMAGE_TO_TANKS', [0, 60, 1]],
  // Wider spreads them further round the hero; keep it under LURCH_MIN_DIST_PX
  [TANK, 'FIRE_LANE_PX', [0, 120, 5]],
  [TANK, 'SIDESTEP_PX_S', [0, 150, 5]],
  [TANK_LOOK, 'ART_SCALE', [0.6, 1.6, 0.05]],
  [TANK_LOOK, 'SWAGGER', [0, 2, 0.1]],
  [TANK_LOOK, 'ANGER_MARK_SIZE', [0.5, 8, 0.25]],
  [TANK_LOOK, 'ANGER_MARK_BEATS', [1, 16, 1]],
  ['RUSHER_LOOK', 'ART_SCALE', [0.6, 1.6, 0.05]],
  ['PLAYER_LOOK', 'ART_SCALE', [0.7, 1.4, 0.05]], // 0.7 is about his old height
  [BOMB, 'FUSE_BEATS', [2, 16, 1]],
  [BOMB, 'COUNT_LEAD_BEATS', [1, 4, 1]],
  [BOMB, 'RADIUS_PX', [80, 400, 10]],
  [BOMB, 'BANG_VOLUME', [0, 3, 0.05]],
  [BOMB, 'CLOUD_VOLUME', [0, 3, 0.01]], // its 1.41 is +3 dB
  [BOMB, 'ENEMY_DAMAGE_MAX', [0, 100, 5]],
  [BOMB, 'PLAYER_DAMAGE_MAX', [0, 100, 5]],
  [HITBOX, 'SHOW'],
  [HITBOX, 'grunt', [8, 50, 1]],
  [HITBOX, 'rusher', [8, 50, 1]],
  [HITBOX, 'bassist', [8, 50, 1]],
  [HITBOX, 'stabber', [8, 50, 1]],
  [HITBOX, 'tank', [20, 70, 1]],
  [GRUNT, 'ART_SCALE', [0.8, 1.6, 0.05]],
  [GRUNT, 'HOP_PX', [0, 12, 0.5]],
  [GRUNT, 'IDLE_DANCE', [0, 1, 0.05]],
  [GRUNT, 'HOVER_PX', [0, 6, 0.1]],
  [GRUNT, 'LEAN_RAD', [0, 0.4, 0.01]],
  [GRUNT, 'WANDER_RAD', [0, 0.4, 0.01]],
  [GRUNT, 'JIGGLE', [0, 0.3, 0.01]],
  [GRUNT, 'COUGH_CHANCE', [0, 0.5, 0.01]],
  [GRUNT, 'TUMBLE_RAD', [0, 1, 0.05]],
  [GRUNT, 'FACING_DEADZONE', [0, 0.6, 0.01]],
  [GRUNT, 'SPIN_SEC', [0, 1, 0.02]],
  [GRUNT, 'WHINE_STRETCH', [0, 0.5, 0.01]],
  [GRUNT, 'CALL_LEAN_RAD', [0, 0.8, 0.02]],
  ['PLAYER', 'SHIELD_RECHARGE_MS', [1000, 20000, 500]],
  ['PLAYER', 'REGEN_DELAY_MS', [0, 10000, 250]],
  ['PLAYER', 'REGEN_PER_SEC', [0, 10, 0.1]],
  ['PLAYER', 'DAMAGE_GRUNT_BULLET', [0, 30, 1]],
  ['PLAYER', 'DAMAGE_TANK_BALL', [0, 100, 1]],
  ['PLAYER', 'DAMAGE_BASS_NOTE', [0, 60, 1]],
  ['PLAYER', 'DAMAGE_STAB', [0, 60, 1]],
  ['PLAYER', 'DAMAGE_TANK_SHOVE', [0, 60, 1]],
  ['PLAYER', 'DAMAGE_TANK_ELBOW', [0, 60, 1]],
  ['PLAYER', 'KNOCKBACK_DECAY', [0, 0.98, 0.01]],
  ['PLAYER', 'KNOCKBACK_STAB', [0, 30, 0.5]],
  ['PLAYER', 'KNOCKBACK_RUSHER_BLAST', [0, 30, 0.5]],
  ['PLAYER', 'KNOCKBACK_AREA', [0, 30, 0.5]],
  ['PLAYER', 'KNOCKBACK_BOMB', [0, 30, 0.5]],
  ['PLAYER', 'KNOCKBACK_TANK_SHOVE', [0, 30, 0.5]],
  ['PLAYER', 'KNOCKBACK_TANK_ELBOW', [0, 30, 0.5]],
  [DEATHS, 'GRUNT_VOLUME', [0, 3, 0.05]],
  [DEATHS, 'BREATH_VOLUME', [0, 3, 0.05]],
  [DEATHS, 'LINGER', [0.5, 2, 0.1]],
  [DEATHS, 'STABBER_STYLE', STABBER_STYLES],
  [DEATHS, 'STABBER_VOLUME', [0, 3, 0.05]],
  [DEATHS, 'BASSIST_VOLUME', [0, 3, 0.05]],
  [DEATHS, 'SCENE_BEATS', [4, 8, 1]],
  [DEATHS, 'SCENE_ZOOM', [1, 2, 0.05]],
  [DEATHS, 'TANK_VOLUME', [0, 3, 0.05]],
  [DEATHS, 'TANK_ZIP_SEC', [0.5, 2, 0.05]], // the timing needs at least 0.5
  [SPEECH, 'VOICE_GAP_SEC', [0, 8, 0.25]],
  [`${SPEECH}.GRUNT`, 'CHANCE', [0, 1, 0.05]],
  [`${SPEECH}.STABBER`, 'CHANCE', [0, 1, 0.05]],
  [`${SPEECH}.RUSHER`, 'CHANCE', [0, 1, 0.05]],
  [`${SPEECH}.TANK`, 'CHANCE', [0, 1, 0.05]],
  [`${SPEECH}.TANK`, 'CALLOUT_CHANCE', [0, 1, 0.05]],
  ['SPEECH.SPEAKERS', 'rusher', RUSHER_VOICES],
];

// The top-level CONFIG groups the knobs live in, in order: the JSON to copy
const JSON_GROUPS = [...new Set(KNOBS.map(([path]) => path.split('.')[0]))];

const resolve = (path) => path.split('.').reduce((obj, k) => obj[k], CONFIG);

export function createTunePanel() {
  const panel = document.createElement('div');
  panel.id = 'tunePanel';
  // Clicks and key presses here must not start the game, shoot or steer.
  // keyup still passes, so a key released over the panel can't stay stuck.
  panel.dataset.noStart = '';
  for (const type of ['mousedown', 'pointerdown', 'keydown']) {
    panel.addEventListener(type, (e) => e.stopPropagation());
  }
  panel.style.cssText =
    'position:fixed;top:8px;right:8px;z-index:200;width:280px;max-height:calc(100vh - 16px);overflow:auto;padding:10px;background:rgba(5,2,15,0.9);border:1px solid #0ff;color:#fff;font:12px monospace;';
  panel.innerHTML =
    '<b style="color:#0ff">TUNING</b><div style="color:#aaa;margin:4px 0 8px">P pauses the game; the beat plays on while Sound while paused is ticked. <a href="voices.html" target="voices" style="color:#0ff">Voice playground</a></div>';

  // Jump ahead to hear later levels without playing up to them
  const levelUp = document.createElement('button');
  levelUp.textContent = 'Level +1';
  levelUp.onclick = () => {
    const gs = window.gameState;
    if (gs?.gameState === 'playing') {
      gs.practiceRun = true; // fake points must not become a high score
      gs.addScore(gs.nextLevelThreshold - gs.score);
    }
    levelUp.blur();
  };
  panel.append(levelUp);

  // Boxes that aren't knobs: Sound while paused and Immortal hero never land
  // in the JSON for config.js (Playground voices changes CONFIG.SPEECH,
  // which the JSON shows for the rusher's knob)
  const addBox = (text, checked, onChange) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin:6px 0;';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = checked;
    box.onchange = () => {
      onChange(box.checked);
      box.blur(); // hand the keyboard back to the game, so P still works
    };
    const label = document.createElement('span');
    label.textContent = ` ${text}`;
    row.append(box, label);
    panel.append(row);
    return { box, label };
  };

  // Sound while paused: on here, so the kick can be tuned by ear while the
  // game is paused
  CONFIG.SOUND_WHILE_PAUSED = true;
  addBox('Sound while paused', true, (on) => {
    CONFIG.SOUND_WHILE_PAUSED = on;
    window.audio?.syncPause?.(window.gameState?.gameState === 'paused');
  });

  addBox('Immortal hero', CONFIG.IMMORTAL, (on) => (CONFIG.IMMORTAL = on));

  // Playground voices: the voice playground's saved edits in play, kept up
  // to date while it saves in another tab. The latest change wins, the box's
  // or a knob's; unticked, it puts back what it replaced
  const configVoices = {
    speakers: { ...CONFIG.SPEECH.SPEAKERS },
    respell: CONFIG.SPEECH.RESPELL,
  };
  const fromPlayground = new WeakSet();
  const replaced = {};
  const applied = {}; // each voice as the box last put it in
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // `saved`: the playground saved; a voice it left as it was stays as a
  // knob may have set it since
  const useVoices = (on, saved = false) => {
    const read = on ? savedVoices(configVoices) : { voices: configVoices };
    const { voices, dropped = [], blocked } = read;
    const edited = [];
    const current = CONFIG.SPEECH.SPEAKERS;
    for (const [name, setup] of Object.entries(voices.speakers)) {
      if (!same(setup, configVoices.speakers[name])) {
        // A voice left as it was keeps its object, and so its rendered lines
        const json = JSON.stringify(setup);
        const knobsTurn = saved && applied[name] === json;
        if (!same(setup, current[name]) && !knobsTurn) {
          if (!fromPlayground.has(current[name]))
            replaced[name] = current[name];
          fromPlayground.add(setup);
          current[name] = setup;
          applied[name] = json;
        }
        edited.push(name);
      } else if (fromPlayground.has(current[name])) {
        current[name] = replaced[name];
      }
    }
    CONFIG.SPEECH.RESPELL = voices.respell;
    if (!same(voices.respell, configVoices.respell)) edited.push('respell');
    let status = '';
    if (blocked) status = " (can't read its saves)";
    else if (on) status = ` (${edited.join(', ') || 'none edited'})`;
    if (dropped.length) {
      status += `; old saves skipped: ${dropped.join(', ')}`;
    }
    playground.label.textContent = ` Playground voices${status}`;
    for (const refresh of knobRefreshes) refresh();
    showJson();
    window.audio?.prepareTimedLines?.();
  };
  const playground = addBox('Playground voices', false, useVoices);
  // The playground saves on every slider step: wait for it to settle, or a
  // drag would queue a render of every timed line for each step
  let settling;
  window.addEventListener('storage', (e) => {
    if (e.key !== STORE_KEY || !playground.box.checked) return;
    clearTimeout(settling);
    settling = setTimeout(
      () => playground.box.checked && useVoices(true, true),
      PLAYGROUND_SETTLE_MS
    );
  });

  const json = document.createElement('pre');
  json.style.cssText = 'white-space:pre-wrap;color:#0ff;margin:8px 0 0;';
  const showJson = () => {
    const groups = Object.fromEntries(JSON_GROUPS.map((g) => [g, CONFIG[g]]));
    json.textContent = JSON.stringify(groups, null, 2);
  };

  const knobRefreshes = [];
  for (const [path, key, options] of KNOBS) {
    const settings = resolve(path);
    const group = path.split('.').pop();
    const value = settings[key];
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin:6px 0;';
    const name = document.createElement('div');
    // Named choices show the name of the one set
    const named = !Array.isArray(options) && typeof value === 'object';
    // (none of them: the Playground voices box put another voice in)
    const shown = () =>
      named
        ? (Object.keys(options).find((n) => options[n] === settings[key]) ??
          'playground')
        : settings[key];
    const readout = () => {
      name.textContent = `${group}.${key}: ${shown()}`;
    };

    let input;
    if (named) {
      const select = document.createElement('select');
      select.style.maxWidth = '100%';
      select.replaceChildren(
        ...Object.keys(options).map((c) => new Option(c, c))
      );
      select.value = shown();
      select.onchange = () => (settings[key] = options[select.value]);
      input = select;
    } else if (typeof value === 'boolean') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = value;
      input.onchange = () => (settings[key] = input.checked);
    } else if (typeof options[0] === 'string') {
      const select = document.createElement('select');
      select.style.maxWidth = '100%';
      select.replaceChildren(...options.map((c) => new Option(c, c)));
      select.value = settings[key];
      select.onchange = () => (settings[key] = select.value);
      input = select;
    } else {
      const [min, max, step] = options;
      input = document.createElement('input');
      Object.assign(input, { type: 'range', min, max, step, value });
      input.style.width = '100%';
      input.oninput = () => (settings[key] = Number(input.value));
    }
    input.addEventListener('input', () => {
      readout();
      showJson();
      window.audio?.applyMix?.();
    });
    input.addEventListener('change', () => {
      readout();
      showJson();
      window.audio?.applyMix?.();
      // Hand the keyboard back to the game, or arrows keep moving the control
      input.blur();
    });

    readout();
    if (named) {
      knobRefreshes.push(() => {
        input.value = shown();
        readout();
      });
    }
    row.append(name, input);
    panel.append(row);
  }

  showJson();
  panel.append(json);
  document.body.append(panel);
}
