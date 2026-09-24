/**
 * Live tuning panel for CONFIG.BEAT_TRACK, shown when the URL has ?tune.
 * Changes apply from the next beat. To keep a setting, copy the JSON at the
 * bottom of the panel into js/config.js.
 */

import { CONFIG } from '../config.js';

// [group, key, options]: options is [min, max, step] for a slider, or a list
// of choices for a dropdown; booleans get a checkbox.
const KNOBS = [
  ['KICK', 'ENABLED'],
  ['KICK', 'PATTERN', ['four', 'oneThree']],
  ['KICK', 'VOLUME', [0, 1.5, 0.01]],
  ['KICK', 'PITCH_START_HZ', [60, 300, 1]],
  ['KICK', 'PITCH_END_HZ', [30, 120, 1]],
  ['KICK', 'PITCH_DROP_SEC', [0.01, 0.3, 0.005]],
  ['KICK', 'DECAY_SEC', [0.05, 1, 0.01]],
  ['KICK', 'CLICK_LEVEL', [0, 1, 0.01]],
  ['KICK', 'CLICK_DECAY_SEC', [0.001, 0.03, 0.001]], // noise buffer is 30 ms
  ['KICK', 'CLICK_HIGHPASS_HZ', [500, 8000, 50]],
  ['SUB_PULSE', 'ENABLED'],
  ['SUB_PULSE', 'VOLUME', [0, 4, 0.05]],
];

export function createTunePanel() {
  const settings = CONFIG.BEAT_TRACK;
  const panel = document.createElement('div');
  panel.id = 'tunePanel';
  // Clicks and keys here must not start the game, shoot or steer
  panel.dataset.noStart = '';
  for (const type of ['mousedown', 'pointerdown', 'keydown', 'keyup']) {
    panel.addEventListener(type, (e) => e.stopPropagation());
  }
  panel.style.cssText =
    'position:fixed;top:8px;right:8px;z-index:200;width:280px;max-height:calc(100vh - 16px);overflow:auto;padding:10px;background:rgba(5,2,15,0.9);border:1px solid #0ff;color:#fff;font:12px monospace;';
  panel.innerHTML =
    '<b style="color:#0ff">BEAT TRACK TUNING</b><div style="color:#aaa;margin:4px 0 8px">P pauses the game; the beat keeps playing.</div>';

  const json = document.createElement('pre');
  json.style.cssText = 'white-space:pre-wrap;color:#0ff;margin:8px 0 0;';
  const showJson = () => {
    json.textContent = `BEAT_TRACK: ${JSON.stringify(settings, null, 2)}`;
  };

  for (const [group, key, options] of KNOBS) {
    const value = settings[group][key];
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin:6px 0;';
    const name = document.createElement('div');
    const readout = () => {
      name.textContent = `${group}.${key}: ${settings[group][key]}`;
    };

    let input;
    if (typeof value === 'boolean') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = value;
      input.onchange = () => (settings[group][key] = input.checked);
    } else if (typeof options[0] === 'string') {
      input = document.createElement('select');
      for (const choice of options) input.add(new Option(choice, choice));
      input.value = value;
      input.onchange = () => (settings[group][key] = input.value);
    } else {
      const [min, max, step] = options;
      input = document.createElement('input');
      Object.assign(input, { type: 'range', min, max, step, value });
      input.style.width = '100%';
      input.oninput = () => (settings[group][key] = Number(input.value));
    }
    input.addEventListener('input', () => {
      readout();
      showJson();
    });
    input.addEventListener('change', () => {
      readout();
      showJson();
    });

    readout();
    row.append(name, input);
    panel.append(row);
  }

  showJson();
  panel.append(json);
  document.body.append(panel);
}
