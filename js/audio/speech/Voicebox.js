/**
 * Voicebox: the game's speech. The worker renders a line (SAM or espeak-ng)
 * at a set loudness; the speaker's effect chain runs offline; the result is
 * levelled again, fitted under the ceiling, and played. PR 2 adds the game's
 * side: say(), the line cache, cancelPending() and isSpeaking().
 */
import { CONFIG } from '../../config.js';
import { renderChain as renderEffectChain } from './effects.js';
import { fitCeiling, isUsable, loudness, matchLoudness } from './levels.js';

// A start this close to now might already be past when Web Audio sees it
const LEAD_SEC = 0.02;
// Level out may miss its target by this much before a line counts as lost:
// past it, the chain took more than level out's +20 dB can give back
const LEVEL_MISS_DB = 1;
// A word, with contractions inside it ("can't"); quotes around it don't count
const WORD = /[A-Za-z]+(?:'[A-Za-z]+)*/g;

// The text an engine hears: respelled whole words, case-insensitive, with
// punctuation and every other word untouched. The bubble shows the original.
export function spoken(engine, text, respell = CONFIG.SPEECH.RESPELL) {
  const words = respell[engine] ?? {};
  return text.replace(WORD, (word) => {
    const key = word.toLowerCase();
    return Object.hasOwn(words, key) ? words[key] : word;
  });
}

// When a line ready at `now` (audio seconds) starts: at once inside the
// on-beat window after a grid line (so "FIRE!" lands with the tank's shot),
// else on the next eighth note at least LEAD_SEC ahead. Before BeatClock runs
// on audio time there is no grid to land on, so at once.
export function startTime(now, clock) {
  if (!clock?.audioContext) return now;
  const origin = clock.startTime / 1000;
  const eighth = clock.beatInterval / 2000;
  const sinceEighth = (((now - origin) % eighth) + eighth) % eighth;
  if (sinceEighth <= clock.tolerance / 1000) return now;
  return origin + Math.ceil((now + LEAD_SEC - origin) / eighth) * eighth;
}

const workerUrl = () => new URL('./speechWorker.js', import.meta.url);

export class Voicebox {
  constructor({
    audioContext,
    config = CONFIG.SPEECH,
    createWorker = () => new Worker(workerUrl(), { type: 'module' }),
    renderChain = renderEffectChain,
  }) {
    this.ctx = audioContext;
    this.config = config;
    this.renderChain = renderChain;
    this.output = audioContext.createGain();
    this.pending = new Map(); // worker request id → { resolve, reject, timer }
    this.nextId = 0;
    this.failed = null; // the Error that turned speech off for the session
    try {
      this.worker = createWorker();
      this.worker.onmessage = (event) => this.onMessage(event.data);
      this.worker.onerror = (event) => {
        event.preventDefault?.();
        this.fail(
          new Error(event.message || 'the speech worker failed to load')
        );
      };
      this.worker.onmessageerror = () =>
        this.fail(
          new Error('a message from the speech worker could not be read')
        );
    } catch (error) {
      this.fail(error);
    }
  }

  connect(node) {
    this.output.connect(node);
  }

  // Render a line: the worker's levelled dry line, the chain, level out,
  // then the ceiling
  async renderLine(setup, words) {
    const { TARGET_DB, PEAK_DB, MAX_LINE_CHARS } = this.config;
    if (words.length > MAX_LINE_CHARS) {
      throw new Error(`a line can be at most ${MAX_LINE_CHARS} characters`);
    }
    const dry = await this.request({
      type: 'render',
      engine: setup.engine,
      text: words,
      voice: setup.voice,
      targetDb: TARGET_DB,
    });
    const t0 = performance.now();
    const wet = await this.renderChain(
      dry.samples,
      dry.sampleRate,
      setup.chain
    );
    const t1 = performance.now();
    if (this.failed) throw this.failed; // speech went off while the chain ran
    const loudnessChain = loudness(wet, dry.sampleRate);
    const { samples, reductionDb } = fitCeiling(
      matchLoudness(wet, dry.sampleRate, TARGET_DB + (setup.levelDb ?? 0)),
      PEAK_DB
    );
    const levelMs = performance.now() - t1;
    if (!Number.isFinite(loudnessChain) || !isUsable(samples)) {
      throw new Error('the effect chain left nothing to hear');
    }
    const loudnessOut = loudness(samples, dry.sampleRate);
    const shortDb =
      TARGET_DB + (setup.levelDb ?? 0) - reductionDb - loudnessOut;
    if (shortDb > LEVEL_MISS_DB) {
      throw new Error(
        `the effect chain left almost nothing to hear (${shortDb.toFixed(0)} dB too quiet)`
      );
    }
    const buffer = this.ctx.createBuffer(1, samples.length, dry.sampleRate);
    buffer.copyToChannel(samples, 0);
    return {
      buffer,
      spokenSec: dry.samples.length / dry.sampleRate,
      renderMs: dry.renderMs,
      chainMs: t1 - t0,
      levelMs,
      loudnessIn: loudness(dry.samples, dry.sampleRate),
      loudnessChain,
      loudnessOut,
      reductionDb,
    };
  }

  play(line, when, gain = 1, pan = 0) {
    const source = this.ctx.createBufferSource();
    source.buffer = line.buffer;
    const level = this.ctx.createGain();
    level.gain.value = gain;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    source.connect(level).connect(panner).connect(this.output);
    source.start(when);
    return { startsAt: when, duration: line.spokenSec };
  }

  variants() {
    return this.request({ type: 'variants' }).then((reply) => reply.variants);
  }

  request(message) {
    if (this.failed) return Promise.reject(this.failed);
    const id = ++this.nextId;
    const { WORKER_TIMEOUT_MS } = this.config;
    return new Promise((resolve, reject) => {
      // A worker that never answers would leave speech silent with no word
      const timer = setTimeout(
        () =>
          this.fail(
            new Error(
              `the speech worker stopped answering (${WORKER_TIMEOUT_MS} ms)`
            )
          ),
        WORKER_TIMEOUT_MS
      );
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, ...message });
    });
  }

  onMessage(reply) {
    const job = this.pending.get(reply.id);
    if (!job) return;
    this.pending.delete(reply.id);
    clearTimeout(job.timer);
    if (!reply.error) {
      job.resolve(reply);
      return;
    }
    const error = new Error(reply.error);
    job.reject(error);
    if (reply.fatal) this.fail(error);
  }

  // Speech is off for the rest of the session: say so once, end every
  // pending request now
  fail(error) {
    if (this.failed) return;
    this.failed = error;
    console.error(`Speech is off for this session: ${error.message}`);
    for (const job of this.pending.values()) {
      clearTimeout(job.timer);
      job.reject(error);
    }
    this.pending.clear();
    this.worker?.terminate();
  }
}
