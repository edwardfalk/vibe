import { test, expect } from '@playwright/test';
import { statSync } from 'node:fs';

// SPEECH_BASE runs these under a subpath, as on GitHub Pages
const BASE = process.env.SPEECH_BASE ?? '';
const pick = (sorted, q) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
const vendorBytes = () =>
  [
    'espeak-ng/espeak-ng.js',
    'espeak-ng/espeak-ng.data',
    'sam/samjs.esm.min.js',
  ].reduce(
    (n, file) =>
      n + statSync(new URL(`../js/vendor/${file}`, import.meta.url)).size,
    0
  );

test('speech gate: both engines run in a worker, at level, every setting heard', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto(`${BASE}/tests/helpers/speech-gate.html`);
  const report = await page.evaluate(async () => {
    const at = (path) => new URL(`../../${path}`, location.href).href;
    const { CONFIG } = await import(at('js/config.js'));
    const { SPEAKER_LINES } = await import(at('js/audio/DialogueLines.js'));
    const { loudness, isUsable } = await import(
      at('js/audio/speech/levels.js')
    );
    const { pitchOf } = await import(at('tests/helpers/pitch.js'));
    const S = CONFIG.SPEECH;
    const workerUrl = at('js/audio/speech/speechWorker.js');
    let next = 0;
    const ask = (worker, message) =>
      new Promise((resolve, reject) => {
        const id = ++next;
        const onMessage = ({ data }) => {
          if (data.id !== id) return;
          worker.removeEventListener('message', onMessage);
          if (data.error) reject(new Error(data.error));
          else resolve(data);
        };
        worker.addEventListener('message', onMessage);
        worker.onerror = (e) =>
          reject(new Error(e.message || 'the worker failed to load'));
        worker.postMessage({ id, ...message });
      });
    const render = (worker, speaker, text, voice = S.SPEAKERS[speaker].voice) =>
      ask(worker, {
        type: 'render',
        engine: S.SPEAKERS[speaker].engine,
        text,
        voice,
        targetDb: S.TARGET_DB,
      });
    const differ = (a, b) =>
      a.length !== b.length || a.some((x, i) => x !== b[i]);

    // Cold start: a fresh worker's first line, three times
    const coldMs = [];
    for (let trial = 0; trial < 3; trial++) {
      const fresh = new Worker(workerUrl, { type: 'module' });
      const t0 = performance.now();
      await render(fresh, 'player', 'Rise!');
      coldMs.push(performance.now() - t0);
      fresh.terminate();
    }

    const worker = new Worker(workerUrl, { type: 'module' });
    const casts = {};
    for (const speaker of Object.keys(S.SPEAKERS)) {
      const out = await render(worker, speaker, SPEAKER_LINES[speaker][0]);
      casts[speaker] = {
        usable: isUsable(out.samples),
        db: loudness(out.samples, out.sampleRate),
      };
    }

    // Each setting changes the sound. espeak-ng varies each render slightly,
    // so its settings are measured by what they're for (pitch, spread,
    // length); SAM renders a line identically every time, so its samples
    // are compared directly
    const changed = {};
    const line = 'Kill human! Destroy target! Hostile detected!';
    // A fixed voice, not a cast: the thresholds below were set against it,
    // and retuning a speaker in config.js mustn't move them
    const grunt = {
      variant: 'AnxiousAndy',
      pitch: 50,
      range: 70,
      speed: 175,
    };
    const measure = async (voice) => {
      const out = await render(worker, 'grunt', line, voice);
      return {
        ...pitchOf(out.samples, out.sampleRate),
        length: out.samples.length,
      };
    };
    const plain = await measure(grunt);
    changed['espeak variant'] =
      (await measure({ ...grunt, variant: 'grandma' })).hz > plain.hz * 1.5;
    changed['espeak pitch'] =
      (await measure({ ...grunt, pitch: 90 })).hz > plain.hz * 1.4;
    changed['espeak range'] =
      (await measure({ ...grunt, range: 100 })).spread >
      (await measure({ ...grunt, range: 10 })).spread + 1;
    changed['espeak speed'] =
      (await measure({ ...grunt, speed: 120 })).length > plain.length * 1.2;
    const tank = S.SPEAKERS.tank.voice;
    const samPlain = (await render(worker, 'tank', 'Heavy artillery!')).samples;
    for (const key of ['pitch', 'speed', 'mouth', 'throat']) {
      const out = await render(worker, 'tank', 'Heavy artillery!', {
        ...tank,
        [key]: tank[key] + 40,
      });
      changed[`sam ${key}`] = differ(samPlain, out.samples);
    }

    // Engine time for every fixed line, as the worker measures it
    const lineMs = [];
    for (const [speaker, texts] of Object.entries(SPEAKER_LINES)) {
      for (const text of texts) {
        lineMs.push((await render(worker, speaker, text)).renderMs);
      }
    }

    // Four new lines at once, as when several enemies speak in one beat
    const t0 = performance.now();
    const burstMs = await Promise.all(
      ['grunt', 'tank', 'rusher', 'stabber'].map((speaker, i) =>
        render(worker, speaker, `Burst line ${i + 1}!`).then(
          () => performance.now() - t0
        )
      )
    );
    worker.terminate();
    return { coldMs, casts, changed, lineMs, burstMs, targetDb: S.TARGET_DB };
  });

  for (const [speaker, cast] of Object.entries(report.casts)) {
    expect(cast.usable, `${speaker} renders`).toBe(true);
    expect(
      Math.abs(cast.db - report.targetDb),
      `${speaker} level in`
    ).toBeLessThan(0.5);
  }
  for (const [setting, heard] of Object.entries(report.changed)) {
    expect(heard, `${setting} changes the sound`).toBe(true);
  }
  const sorted = [...report.lineMs].sort((a, b) => a - b);
  const ms = (n) => n.toFixed(0);
  console.log(
    `speech gate: cold start ${report.coldMs.map(ms).join('/')} ms; ` +
      `engine per line median ${ms(pick(sorted, 0.5))} ms, p95 ${ms(pick(sorted, 0.95))} ms, ` +
      `max ${ms(sorted.at(-1))} ms (${sorted.length} lines); ` +
      `burst of 4 done after ${ms(Math.max(...report.burstMs))} ms; ` +
      `engine files ${vendorBytes()} bytes`
  );
});

test('every shipped line comes out at level, under the ceiling', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto(`${BASE}/voices.html`);
  const { lines, limits } = await page.evaluate(async () => {
    const at = (path) => new URL(path, location.href).href;
    const { Voicebox, spoken } = await import(
      at('js/audio/speech/Voicebox.js')
    );
    const { loudness } = await import(at('js/audio/speech/levels.js'));
    const { CONFIG } = await import(at('js/config.js'));
    const { SPEAKER_LINES } = await import(at('js/audio/DialogueLines.js'));
    const S = CONFIG.SPEECH;
    const voicebox = new Voicebox({ audioContext: new AudioContext() });
    const lines = [];
    for (const [speaker, texts] of Object.entries(SPEAKER_LINES)) {
      const setup = S.SPEAKERS[speaker];
      for (const text of texts) {
        const t0 = performance.now();
        const line = await voicebox.renderLine(
          setup,
          spoken(setup.engine, text, S.RESPELL)
        );
        const totalMs = performance.now() - t0;
        const samples = line.buffer.getChannelData(0);
        const peak = samples.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
        lines.push({
          speaker,
          text,
          peakDb: 20 * Math.log10(peak),
          offBy:
            loudness(samples, line.buffer.sampleRate) -
            (S.TARGET_DB + (setup.levelDb ?? 0)),
          reductionDb: line.reductionDb,
          engineMs: line.renderMs,
          chainMs: line.chainMs,
          levelMs: line.levelMs,
          totalMs,
        });
      }
    }
    return {
      lines,
      limits: { peakDb: S.PEAK_DB, warnDb: S.REDUCTION_WARN_DB },
    };
  });

  for (const l of lines) {
    const name = `${l.speaker} "${l.text}"`;
    expect
      .soft(l.peakDb, `${name}: peak`)
      .toBeLessThanOrEqual(limits.peakDb + 0.01);
    expect.soft(Math.abs(l.offBy), `${name}: level out`).toBeLessThanOrEqual(1);
    expect
      .soft(l.reductionDb, `${name}: ceiling cost`)
      .toBeLessThan(limits.warnDb);
  }

  const timing = (key) => {
    const sorted = lines.map((l) => l[key]).sort((a, b) => a - b);
    return `${key} median ${pick(sorted, 0.5).toFixed(0)} / p95 ${pick(sorted, 0.95).toFixed(0)} ms`;
  };
  console.log(
    `speech lines: ${lines.length}; ${['engineMs', 'chainMs', 'levelMs', 'totalMs'].map(timing).join('; ')}`
  );
});

test('in a running game every line starts on the grid, and the count on its beats', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.waitForSelector('canvas', { state: 'attached' });
  // Before the run starts, so the game's own first line is recorded too:
  // what Voicebox scheduled, and every speech source's start(when)
  await page.evaluate(async () => {
    const { Voicebox } = await import('/js/audio/speech/Voicebox.js');
    window.__said = [];
    window.__started = [];
    const speech = new WeakSet();
    const { say, play } = Voicebox.prototype;
    Voicebox.prototype.say = async function (speaker, text, opts) {
      const askedMs = performance.now();
      const line = await say.call(this, speaker, text, opts);
      const readyMs = Math.round(performance.now() - askedMs);
      window.__said.push({ speaker, text, readyMs, ...line });
      return line;
    };
    Voicebox.prototype.play = function (line, ...rest) {
      speech.add(line.buffer);
      return play.call(this, line, ...rest);
    };
    const { start } = AudioBufferSourceNode.prototype;
    AudioBufferSourceNode.prototype.start = function (when = 0, ...rest) {
      if (speech.has(this.buffer)) window.__started.push(when);
      return start.call(this, when, ...rest);
    };
  });
  // The engines load on the title screen: wait until they have, as a player
  // looking at it would (a request answered after espeak-ng's load)
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const worker = window.audio.speechWorker;
        worker.addEventListener('message', ({ data }) => {
          if (data.id === -1) resolve();
        });
        worker.postMessage({ id: -1, type: 'variants' });
      })
  );
  await page.keyboard.press(' ');
  // The session's first line
  const { PLAYER_LINES } = await page.evaluate(
    () => import('/js/audio/DialogueLines.js')
  );
  await page.waitForFunction(
    (lines) => window.__said.some((l) => lines.includes(l.text)),
    PLAYER_LINES.start,
    { timeout: 5000 }
  );
  // The shout and the count were rendered ahead, when the audio started,
  // not when they're due
  expect(
    await page.evaluate(() =>
      ['TIMEBOMB!', '3', '2', '1'].every((w) =>
        window.audio.voicebox.lines.has(`player:${w}`)
      )
    )
  ).toBe(true);
  const report = await page.evaluate(async () => {
    const { plantBomb } = await import('/js/systems/BombSystem.js');
    const { SPEAKER_LINES } = await import('/js/audio/DialogueLines.js');
    const audio = window.audio;
    const clock = window.beatClock;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // One line from each speaker beside the hero, a beat and a bit apart, so
    // some are asked inside a beat window and some outside
    const hero = window.player;
    for (const [speaker, lines] of Object.entries(SPEAKER_LINES)) {
      audio.speak({ x: hero.x + 100, y: hero.y }, lines[1], speaker, true);
      await wait(610);
    }
    // The hero's bomb on a stand-in tank, well clear of him: "TIMEBOMB!",
    // then "3", "2", "1" on its beats 0, 2 and 4
    plantBomb(
      window.activeBombs,
      { id: 'test-tank', x: hero.x + 600, y: hero.y, size: 50, facing: 0 },
      clock,
      audio
    );
    await wait(5000);
    return {
      said: window.__said,
      started: window.__started,
      origin: clock.startTime / 1000,
      beat: clock.beatInterval / 1000,
      window: clock.tolerance / 1000,
    };
  });

  const { said, started, origin, beat } = report;
  const eighth = beat / 2;
  const since = (t, step) => (((t - origin) % step) + step) % step;
  console.log(
    'speech starts (s after an eighth):',
    said.map((l) => `${l.text} ${since(l.startsAt, eighth).toFixed(3)}`)
  );
  console.log(
    'ready after (ms):',
    said.map((l) => `${l.text} ${l.readyMs}`)
  );
  expect(errors).toEqual([]);
  // The session's first line played: the engines had loaded. Another line
  // may be dropped as late on a busy machine (MAX_WAIT_MS): dropping beats
  // playing off the beat
  expect(PLAYER_LINES.start).toContain(said[0].text);
  expect(said[0].dropped).toBeUndefined();
  const played = said.filter((l) => !l.dropped);
  console.log(
    'dropped:',
    said.filter((l) => l.dropped).map((l) => `${l.text} (${l.dropped})`)
  );
  expect(played.length).toBeGreaterThanOrEqual(8);
  // Every source Voicebox started, at the time it reported
  expect(started).toEqual(played.map((l) => l.startsAt));
  for (const when of started) {
    const d = since(when, eighth);
    // On an eighth note, or at once inside the window one opened
    const onGrid = d < 0.001 || eighth - d < 0.001 || d <= report.window;
    expect(onGrid, `a line ${d.toFixed(3)} s after an eighth`).toBe(true);
  }
  // The count: on its beats, two apart, each inside the window its beat
  // opened (it starts the frame the bomb notices the beat: 2-41 ms here)
  const count = ['3', '2', '1'].map((n) =>
    said.find((l) => l.speaker === 'player' && l.text === n)
  );
  expect(count.every(Boolean)).toBe(true);
  for (const l of count) {
    expect(
      since(l.startsAt, beat),
      `"${l.text}" after its beat`
    ).toBeLessThanOrEqual(report.window);
  }
  expect(count[1].startsAt - count[0].startsAt).toBeCloseTo(2 * beat, 1);
  expect(count[2].startsAt - count[1].startsAt).toBeCloseTo(2 * beat, 1);
  // "TIMEBOMB!" is said whole before the "3"
  const shout = said.find((l) => l.text === 'TIMEBOMB!');
  expect(shout?.dropped).toBeUndefined();
  expect(shout.startsAt + shout.duration).toBeLessThanOrEqual(
    count[0].startsAt
  );
});
