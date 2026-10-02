/**
 * Live tuning panel, shown when the URL has ?tune: CONFIG.BEAT_TRACK, SKY, PACING,
 * MIX, RUSHER, TANK_ARMOR, the tank's turn, aim, motion and health (TANK)
 * and look (TANK_LOOK), the bomb (BOMB), HITBOX, the grunt's motion (GRUNT_LOOK), a Sound
 * while paused box (ticked here: the beat plays on while paused), the
 * stabber's knockback and the hero's
 * shield, healing, knockback, the damage hits do to him and his head size,
 * and each speaker's voice (a new pick says a sample line). Sound and spawn changes apply from the next
 * beat or wave; level thresholds from the next level-up (the first one after
 * a restart); armour on tanks spawned after the change (and the tank's health); the rest at once.
 * To keep a setting, copy the JSON at the bottom into js/config.js.
 */

import { CONFIG } from '../config.js';
import { SPEAKERS, englishVoicesOf } from '../audio/VoiceSelection.js';

// [group, key, options]: group is a path under CONFIG; options is
// [min, max, step] for a slider, a list of choices for a dropdown, or a
// function returning that list (refilled when the browser's voices change);
// booleans get a checkbox.
const KICK = 'BEAT_TRACK.KICK';
const PACING = 'PACING';
const MIX = 'MIX';
const RUSHER = 'RUSHER';
const HITBOX = 'HITBOX';
const SKY = 'SKY';
const GRUNT = 'GRUNT_LOOK';
const TANK = 'TANK';
const TANK_LOOK = 'TANK_LOOK';
const BOMB = 'BOMB';

// The voices this browser has; Chrome fills the list in a moment after load
const voiceChoices = () => [
  'auto',
  ...englishVoicesOf(window.speechSynthesis?.getVoices() ?? []).map(
    (voice) => voice.name
  ),
];
// What each speaker says when you pick a voice for it
const VOICE_SAMPLES = {
  player: 'Time to dance.',
  tank: 'Targeting traitors!',
  stabber: 'Precise. Silent. Deadly.',
  rusher: 'Leeroy Jenkins!',
  grunt: 'Kill human!',
};

const KNOBS = [
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
  ['BEAT_TRACK.SUB_PULSE', 'ENABLED'],
  ['BEAT_TRACK.SUB_PULSE', 'VOLUME', [0, 4, 0.05]],
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
  [MIX, 'SFX_VOLUME', [0, 1, 0.01]],
  [MIX, 'BEAT_TRACK_VOLUME', [0, 1, 0.01]],
  [MIX, 'SPEECH_VOLUME', [0, 1, 0.05]],
  [MIX, 'SPEECH_DISTANCE_FLOOR', [0, 1, 0.05]],
  [MIX, 'DUCK_SFX_DB', [-24, 0, 1]],
  [MIX, 'DUCK_BEAT_DB', [-24, 0, 1]],
  [MIX, 'DUCK_RELEASE_SEC', [0.05, 1.5, 0.05]],
  [RUSHER, 'FUSE_MIN_MS', [0, 3000, 100]],
  [RUSHER, 'BRAKE', [0, 0.99, 0.01]],
  [RUSHER, 'EXPLOSION_RADIUS', [60, 300, 10]],
  [RUSHER, 'EXPLOSION_DAMAGE', [5, 100, 5]],
  ['TANK_ARMOR', 'FRONT', [0, 200, 5]],
  ['TANK_ARMOR', 'SIDE', [0, 150, 5]],
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
  [BOMB, 'FUSE_BEATS', [2, 16, 1]],
  [BOMB, 'COUNT_LEAD_BEATS', [1, 4, 1]],
  [BOMB, 'RADIUS_PX', [80, 400, 10]],
  [BOMB, 'ENEMY_DAMAGE_MAX', [0, 100, 5]],
  [BOMB, 'PLAYER_DAMAGE_MAX', [0, 100, 5]],
  [HITBOX, 'SHOW'],
  [HITBOX, 'grunt', [8, 50, 1]],
  [HITBOX, 'rusher', [8, 50, 1]],
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
  ['STABBER_SETTINGS', 'KNOCKBACK_FORCE', [0, 20, 0.5]],
  ['STABBER_SETTINGS', 'MAX_KNOCKBACK', [0, 40, 1]],
  ['PLAYER', 'SHIELD_RECHARGE_MS', [1000, 20000, 500]],
  ['PLAYER', 'REGEN_DELAY_MS', [0, 10000, 250]],
  ['PLAYER', 'REGEN_PER_SEC', [0, 10, 0.1]],
  ['PLAYER', 'DAMAGE_GRUNT_BULLET', [0, 30, 1]],
  ['PLAYER', 'DAMAGE_TANK_BALL', [0, 100, 1]],
  ['PLAYER', 'DAMAGE_STAB', [0, 60, 1]],
  ['PLAYER', 'DAMAGE_TANK_SHOVE', [0, 60, 1]],
  ['PLAYER', 'HEAD_SIZE', [0.25, 0.6, 0.01]],
  ['PLAYER', 'KNOCKBACK_DECAY', [0, 0.98, 0.01]],
  ['PLAYER', 'KNOCKBACK_STAB', [0, 30, 0.5]],
  ['PLAYER', 'KNOCKBACK_RUSHER_BLAST', [0, 30, 0.5]],
  ['PLAYER', 'KNOCKBACK_AREA', [0, 30, 0.5]],
  ['PLAYER', 'KNOCKBACK_BOMB', [0, 30, 0.5]],
  ['PLAYER', 'KNOCKBACK_TANK_SHOVE', [0, 30, 0.5]],
  ...SPEAKERS.map((speaker) => ['VOICES', speaker, voiceChoices]),
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

  // Sound while paused: on here, so the kick can be tuned by ear while the
  // game is paused. Not a knob, so it never lands in the JSON for config.js
  CONFIG.SOUND_WHILE_PAUSED = true;
  const soundRow = document.createElement('label');
  soundRow.style.cssText = 'display:block;margin:6px 0;';
  const sound = document.createElement('input');
  sound.type = 'checkbox';
  sound.checked = true;
  sound.onchange = () => {
    CONFIG.SOUND_WHILE_PAUSED = sound.checked;
    window.audio?.syncPause?.(window.gameState?.gameState === 'paused');
    sound.blur(); // hand the keyboard back to the game, so P still works
  };
  soundRow.append(sound, ' Sound while paused');
  panel.append(soundRow);

  const json = document.createElement('pre');
  json.style.cssText = 'white-space:pre-wrap;color:#0ff;margin:8px 0 0;';
  const showJson = () => {
    const groups = Object.fromEntries(JSON_GROUPS.map((g) => [g, CONFIG[g]]));
    json.textContent = JSON.stringify(groups, null, 2);
  };

  for (const [path, key, options] of KNOBS) {
    const settings = resolve(path);
    const group = path.split('.').pop();
    const value = settings[key];
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin:6px 0;';
    const name = document.createElement('div');
    const readout = () => {
      name.textContent = `${group}.${key}: ${settings[key]}`;
    };

    let input;
    if (typeof value === 'boolean') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = value;
      input.onchange = () => (settings[key] = input.checked);
    } else if (
      typeof options === 'function' ||
      typeof options[0] === 'string'
    ) {
      const select = document.createElement('select');
      select.style.maxWidth = '100%';
      const fill = () => {
        const choices = typeof options === 'function' ? options() : options;
        // A saved choice this browser lacks still shows, rather than a blank
        if (!choices.includes(settings[key])) choices.push(settings[key]);
        select.replaceChildren(...choices.map((c) => new Option(c, c)));
        select.value = settings[key];
      };
      fill();
      if (typeof options === 'function') {
        window.speechSynthesis?.addEventListener('voiceschanged', fill);
      }
      select.onchange = () => {
        settings[key] = select.value;
        // Say a sample once audio runs (not on the title screen, where
        // speaking would start the audio and the beat early)
        if (path === 'VOICES' && window.audio?.initialized) {
          window.audio.speak(null, VOICE_SAMPLES[key], key, true);
        }
      };
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
    row.append(name, input);
    panel.append(row);
  }

  showJson();
  panel.append(json);
  document.body.append(panel);
}
