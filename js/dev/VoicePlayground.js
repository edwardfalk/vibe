/**
 * The voice playground (voices.html): any phrase in any speaker's voice and
 * effect chain, through the game's own speech modules. Edits live in this
 * browser until "Copy config" carries them into js/config.js.
 */
import { CONFIG } from '../config.js';
import { SPEAKER_LINES } from '../audio/DialogueLines.js';
import { BeatClock } from '../audio/BeatClock.js';
import { BeatTrack } from '../audio/BeatTrack.js';
import {
  STAGE_PARAMS,
  stageDefaults,
  validateChain,
} from '../audio/speech/effects.js';
import { Voicebox, spoken, startTime } from '../audio/speech/Voicebox.js';

const STORE_KEY = 'vibe.voices.v1';
const BPM = 120;
const PAUSE_BETWEEN_LINES_MS = 300;
// Slider ranges [min, max, step]; SAM reads 0 as "its default" for pitch
// and speed, so those start at 1
const VOICE_PARAMS = {
  sam: {
    pitch: [1, 255, 1],
    speed: [1, 255, 1],
    mouth: [0, 255, 1],
    throat: [0, 255, 1],
  },
  espeak: { pitch: [0, 100, 1], range: [0, 100, 1], speed: [80, 450, 5] },
};

const $ = (id) => document.getElementById(id);
const game = {
  speakers: structuredClone(CONFIG.SPEECH.SPEAKERS),
  respell: structuredClone(CONFIG.SPEECH.RESPELL),
};
let edits = restore();
let speaker = 'player';
let audioReady = null; // made on the first play, which is when the browser allows sound
let variants = [];
let run = 0; // bumped by every play, edit, speaker change and reset

// Switching engine starts from that engine's voice in the game's config
const voiceFor = (engine) =>
  structuredClone(
    Object.values(game.speakers).find((s) => s.engine === engine).voice
  );
const setup = () => edits.speakers[speaker];

function notice(text) {
  $('notice').textContent = text;
  $('notice').hidden = false;
}

function fits(group, edit) {
  if (group === 'respell') {
    return (
      edit !== null &&
      typeof edit === 'object' &&
      Object.values(edit).every((as) => typeof as === 'string')
    );
  }
  try {
    if (!VOICE_PARAMS[edit?.engine] || !Array.isArray(edit.chain)) return false;
    validateChain(edit.chain);
    return true;
  } catch {
    return false;
  }
}

// Saved edits come back one entry at a time: an entry whose config has
// changed since (or that this page can't use) is dropped, and named
function restore() {
  const restored = structuredClone(game);
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
  } catch {
    return restored; // storage blocked: edits last until the page reloads
  }
  const dropped = [];
  for (const group of ['speakers', 'respell']) {
    for (const [name, saved] of Object.entries(stored?.[group] ?? {})) {
      const current = game[group][name];
      if (
        current !== undefined &&
        JSON.stringify(saved?.base) === JSON.stringify(current) &&
        fits(group, saved.edit)
      ) {
        restored[group][name] = saved.edit;
      } else {
        dropped.push(name);
      }
    }
  }
  if (dropped.length) {
    notice(
      `Saved edits for ${dropped.join(', ')} were made against an older config.js, or no longer fit this page, so they were dropped.`
    );
  }
  return restored;
}

function save() {
  const record = (group) =>
    Object.fromEntries(
      Object.keys(game[group]).map((name) => [
        name,
        { base: game[group][name], edit: edits[group][name] },
      ])
    );
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        speakers: record('speakers'),
        respell: record('respell'),
      })
    );
  } catch {
    // Storage blocked
  }
}

// Any edit stops "Hear all lines" and drops a render still in flight
function edited() {
  run++;
  save();
}

function changed() {
  edited();
  render();
}

function show(text, kind = '') {
  $('readout').textContent = text;
  $('readout').className = kind;
}

function element(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function slider(name, target, key, [min, max, step]) {
  const value = element('span', { textContent: target[key] });
  const input = element('input', {
    type: 'range',
    min,
    max,
    step,
    value: target[key],
  });
  input.oninput = () => {
    target[key] = Number(input.value);
    value.textContent = input.value;
    edited();
  };
  return element('label', {}, name, input, value);
}

const button = (textContent, onclick, disabled = false) =>
  element('button', { textContent, onclick, disabled });

function renderVoice() {
  const s = setup();
  const box = $('voice');
  box.replaceChildren();
  if (s.engine === 'espeak') {
    const select = element('select', { ariaLabel: 'espeak-ng variant' });
    for (const name of variants.length ? variants : [s.voice.variant]) {
      select.add(new Option(name, name, false, name === s.voice.variant));
    }
    select.onchange = () => {
      s.voice.variant = select.value;
      edited();
    };
    box.append(element('label', {}, 'variant', select));
  }
  for (const [key, range] of Object.entries(VOICE_PARAMS[s.engine])) {
    box.append(slider(key, s.voice, key, range));
  }
}

function renderChain() {
  const s = setup();
  const move = (i, by) => {
    [s.chain[i], s.chain[i + by]] = [s.chain[i + by], s.chain[i]];
    changed();
  };
  $('chain').replaceChildren(
    ...s.chain.map((stage, i) => {
      const params = element('div', { className: 'row' });
      const defaults = stageDefaults(stage.type);
      for (const [key, range] of Object.entries(STAGE_PARAMS[stage.type])) {
        stage[key] ??= defaults[key];
        params.append(slider(key, stage, key, range));
      }
      const head = element(
        'div',
        { className: 'row' },
        element('b', { textContent: stage.type }),
        button('↑', () => move(i, -1), i === 0),
        button('↓', () => move(i, 1), i === s.chain.length - 1),
        button('Remove', () => {
          s.chain.splice(i, 1);
          changed();
        })
      );
      return element('div', { className: 'stage' }, head, params);
    })
  );
  s.levelDb ??= 0;
  $('level').value = s.levelDb;
  $('level-value').textContent = s.levelDb;
}

function renderRespell() {
  const engine = setup().engine;
  const words = (edits.respell[engine] ??= {});
  $('respell-list').replaceChildren(
    ...Object.entries(words).map(([word, as]) =>
      element(
        'div',
        { className: 'row' },
        `${word} → ${as}`,
        button('Remove', () => {
          delete words[word];
          changed();
        })
      )
    )
  );
  renderHears();
}

function renderHears() {
  const text = $('phrase').value;
  const engine = setup().engine;
  $('hears').textContent =
    `bubble shows: ${text.toUpperCase()} · ${engine} hears: ${spoken(engine, text, edits.respell)}`;
}

function render() {
  $('speaker').value = speaker;
  $('engine').value = setup().engine;
  $('lines').replaceChildren(
    new Option('Real lines…', ''),
    ...SPEAKER_LINES[speaker].map((line) => new Option(line, line))
  );
  renderVoice();
  renderChain();
  renderRespell();
}

async function startAudio() {
  const ctx = new AudioContext();
  // On audio time from its first moment: a grid origin before 0 would put
  // BeatTrack's first kick at a negative time, which Web Audio rejects
  const beatClock = new BeatClock(BPM, ctx);
  const kickBus = ctx.createGain();
  kickBus.connect(ctx.destination);
  const beatTrack = new BeatTrack({
    audio: { audioContext: ctx, beatDuckGain: kickBus },
    beatClock,
  });
  beatTrack.setMuted(!$('kick').checked);
  const voicebox = new Voicebox({ audioContext: ctx });
  voicebox.connect(ctx.destination);
  await ctx.resume();
  await beatTrack.start();
  variants = await voicebox.variants().catch(() => []);
  renderVoice();
  return { ctx, beatClock, beatTrack, voicebox };
}

// One audio setup per page; a failed start can be retried by the next click
function ensureAudio() {
  audioReady ??= startAudio().catch((error) => {
    audioReady = null;
    throw error;
  });
  return audioReady;
}

function readout(line, words) {
  const f = (n) => n.toFixed(1);
  const hot = line.reductionDb > CONFIG.SPEECH.REDUCTION_WARN_DB;
  return [
    `engine hears: ${words}`,
    `render ${f(line.renderMs)} ms + chain ${f(line.chainMs)} ms + level ${f(line.levelMs)} ms · spoken ${f(line.spokenSec)} s, ${f(line.buffer.duration)} s with the tail`,
    `loudness: in ${f(line.loudnessIn)} dB → after the chain ${f(line.loudnessChain)} dB → out ${f(line.loudnessOut)} dB`,
    `ceiling cost ${f(line.reductionDb)} dB` +
      (hot
        ? '. This chain is too hot: lower drive or crush, or add a filter.'
        : ''),
  ].join('\n');
}

// Render and play one line. `how` is 'now', 'grid' or 'game'.
async function playLine(how, text, myRun) {
  if (!text) {
    show('Type a phrase first.', 'error');
    return null;
  }
  // Snapshot before the first await, so an edit made while this renders
  // can't mix into it
  const version =
    how === 'game'
      ? { setup: game.speakers[speaker], respell: game.respell }
      : {
          setup: structuredClone(setup()),
          respell: structuredClone(edits.respell),
        };
  const words = spoken(version.setup.engine, text, version.respell);
  let audio = null;
  try {
    audio = await ensureAudio();
    const line = await audio.voicebox.renderLine(version.setup, words);
    if (myRun !== run) return null;
    const now = audio.ctx.currentTime;
    audio.voicebox.play(
      line,
      how === 'grid' ? startTime(now, audio.beatClock) : now
    );
    const hot = line.reductionDb > CONFIG.SPEECH.REDUCTION_WARN_DB;
    show(readout(line, words), hot ? 'warn' : '');
    return line;
  } catch (error) {
    if (myRun !== run) return null;
    const off = audio?.voicebox.failed;
    show(
      off
        ? `Speech is off: ${off.message}`
        : `Couldn't render "${words}": ${error.message}`,
      'error'
    );
    return null;
  }
}

const play = (how) => playLine(how, $('phrase').value.trim(), ++run);

async function playAll() {
  const myRun = ++run;
  for (const line of SPEAKER_LINES[speaker]) {
    if (myRun !== run) return;
    $('phrase').value = line;
    renderHears();
    const rendered = await playLine('now', line, myRun);
    if (!rendered || myRun !== run) return;
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        rendered.buffer.duration * 1000 + PAUSE_BETWEEN_LINES_MS
      )
    );
  }
}

$('phrase').maxLength = CONFIG.SPEECH.MAX_LINE_CHARS;
for (const name of Object.keys(CONFIG.SPEECH.SPEAKERS)) {
  $('speaker').add(new Option(name, name));
}
for (const type of Object.keys(STAGE_PARAMS)) {
  $('stage-type').add(new Option(type, type));
}
$('speaker').onchange = () => {
  run++;
  speaker = $('speaker').value;
  render();
};
$('engine').onchange = () => {
  const engine = $('engine').value;
  setup().engine = engine;
  setup().voice = voiceFor(engine);
  changed();
};
$('lines').onchange = () => {
  if ($('lines').value) $('phrase').value = $('lines').value;
  renderHears();
};
$('phrase').oninput = renderHears;
$('respell-add').onclick = () => {
  const word = $('respell-word').value.trim().toLowerCase();
  const as = $('respell-as').value.trim();
  if (!word || !as) return;
  (edits.respell[setup().engine] ??= {})[word] = as;
  changed();
};
$('stage-add').onclick = () => {
  const type = $('stage-type').value;
  setup().chain.push({ type, ...stageDefaults(type) });
  changed();
};
$('level').oninput = () => {
  setup().levelDb = Number($('level').value);
  $('level-value').textContent = $('level').value;
  edited();
};
$('play-now').onclick = () => play('now');
$('play-grid').onclick = () => play('grid');
$('play-game').onclick = () => play('game');
$('play-all').onclick = playAll;
$('kick').onchange = async () => {
  if (!audioReady) return; // the first play applies the box
  (await audioReady).beatTrack.setMuted(!$('kick').checked);
};
$('copy').onclick = async () => {
  const text = [
    `// CONFIG.SPEECH.SPEAKERS.${speaker}`,
    `${speaker}: ${JSON.stringify(setup(), null, 2)},`,
    '',
    '// CONFIG.SPEECH.RESPELL',
    `RESPELL: ${JSON.stringify(edits.respell, null, 2)},`,
  ].join('\n');
  try {
    await navigator.clipboard.writeText(text);
    show('Copied. Paste it into CONFIG.SPEECH in js/config.js.');
  } catch {
    $('copy-text').hidden = false;
    $('copy-text').value = text;
    $('copy-text').select();
    show('The clipboard is blocked here: copy the text below.');
  }
};
$('reset').onclick = () => {
  run++;
  edits = structuredClone(game);
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // Storage blocked
  }
  render();
  show("Back to the game's settings.");
};

render();
