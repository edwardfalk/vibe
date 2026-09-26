/**
 * Live tuning panel, shown when the URL has ?tune: CONFIG.BEAT_TRACK, PACING,
 * MIX, RUSHER, TANK_ARMOR, HITBOX, the stabber's knockback and the hero's
 * shield, healing and knockback. Sound and spawn changes apply from the next
 * beat or wave; level thresholds from the next level-up (the first one after
 * a restart); armour on tanks spawned after the change; the rest at once.
 * To keep a setting, copy the JSON at the bottom into js/config.js.
 */

import { CONFIG } from '../config.js';

// [group, key, options]: group is a path under CONFIG; options is
// [min, max, step] for a slider, or a list of choices for a dropdown;
// booleans get a checkbox.
const KICK = 'BEAT_TRACK.KICK';
const PACING = 'PACING';
const MIX = 'MIX';
const RUSHER = 'RUSHER';
const HITBOX = 'HITBOX';
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
  [HITBOX, 'SHOW'],
  [HITBOX, 'grunt', [8, 50, 1]],
  [HITBOX, 'rusher', [8, 50, 1]],
  [HITBOX, 'stabber', [8, 50, 1]],
  [HITBOX, 'tank', [20, 70, 1]],
  ['STABBER_SETTINGS', 'KNOCKBACK_FORCE', [0, 20, 0.5]],
  ['STABBER_SETTINGS', 'MAX_KNOCKBACK', [0, 40, 1]],
  ['PLAYER', 'SHIELD_RECHARGE_MS', [1000, 20000, 500]],
  ['PLAYER', 'REGEN_DELAY_MS', [0, 10000, 250]],
  ['PLAYER', 'REGEN_PER_SEC', [0, 10, 0.5]],
  ['PLAYER', 'KNOCKBACK_DECAY', [0, 0.98, 0.01]],
  ['PLAYER', 'KNOCKBACK_STAB', [0, 30, 0.5]],
  ['PLAYER', 'KNOCKBACK_RUSHER_BLAST', [0, 30, 0.5]],
  ['PLAYER', 'KNOCKBACK_AREA', [0, 30, 0.5]],
  ['PLAYER', 'KNOCKBACK_BOMB', [0, 30, 0.5]],
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
    '<b style="color:#0ff">TUNING</b><div style="color:#aaa;margin:4px 0 8px">P pauses the game; the beat keeps playing.</div>';

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
    } else if (typeof options[0] === 'string') {
      input = document.createElement('select');
      for (const choice of options) input.add(new Option(choice, choice));
      input.value = value;
      input.onchange = () => (settings[key] = input.value);
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
