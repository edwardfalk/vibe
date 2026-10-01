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
    const grunt = { ...S.SPEAKERS.grunt.voice, pitch: 50 };
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
