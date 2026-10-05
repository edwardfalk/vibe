/**
 * Voicebox: the game's speech. The worker renders a line (SAM or espeak-ng)
 * at a set loudness; the speaker's effect chain runs offline; the result is
 * levelled again, fitted under the ceiling, and played. The game says its
 * lines through say(), on the beat grid, from a cache: its lines are a fixed
 * set, so each is rendered once.
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
const newWorker = () => new Worker(workerUrl(), { type: 'module' });
// What say() races a line's render against
const LATE = Symbol('late');

// The speech worker, started before there is any audio (on the title screen)
// so its engines have loaded by the first line: SAM loads with the worker,
// espeak-ng on its first request, which this sends (its reply is nobody's
// request; a failed espeak-ng comes back fatal on its next one). A Voicebox
// takes it over through createWorker; an error before then waits for it.
export function startSpeechWorker() {
  const worker = newWorker();
  worker.onerror = (event) => {
    event.preventDefault?.();
    worker.earlyError = new Error(
      event.message || 'the speech worker failed to load'
    );
  };
  worker.postMessage({ id: 0, type: 'variants' });
  return worker;
}

export class Voicebox {
  constructor({
    audioContext,
    config = CONFIG.SPEECH,
    createWorker = newWorker,
    renderChain = renderEffectChain,
  }) {
    this.ctx = audioContext;
    this.config = config;
    this.renderChain = renderChain;
    this.output = audioContext.createGain();
    this.pending = new Map(); // worker request id → { resolve, reject, timer }
    this.nextId = 0;
    // speaker and spoken text → Promise<line | null>. Nothing changes
    // CONFIG.SPEECH in a running game; a live knob for it must clear this
    this.lines = new Map();
    this.playing = new Set(); // { source, startsAt, duration } until it ends
    this.epoch = 0; // cancelPending() moves it on
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
      if (this.worker.earlyError) this.fail(this.worker.earlyError);
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
    const playing = { source, startsAt: when, duration: line.spokenSec };
    this.playing.add(playing);
    source.onended = () => this.playing.delete(playing);
    return { startsAt: when, duration: line.spokenSec };
  }

  // A speaker's line, rendered once: asking again, even before it is ready,
  // gets the same render. One that can't be rendered is logged once and
  // stays silent (null).
  prepare(speaker, text) {
    const setup = this.config.SPEAKERS[speaker] ?? this.config.SPEAKERS.player;
    const words = spoken(setup.engine, text, this.config.RESPELL);
    const key = `${speaker}:${words}`;
    if (!this.lines.has(key)) {
      const line = this.renderLine(setup, words).catch((error) => {
        if (!this.failed) {
          console.warn(
            `Speech: ${speaker} can't say "${text}": ${error.message}`
          );
        }
        return null;
      });
      this.lines.set(key, line);
    }
    return this.lines.get(key);
  }

  // Say a line on the beat grid (startTime), panned and at `gain`. Resolves
  // { startsAt, duration } in audio seconds once it is scheduled (duration
  // is the spoken part, without the effect tail), or { dropped } with why it
  // won't play: 'failed' (no speech, or this line can't be rendered), 'late'
  // (not ready within MAX_WAIT_MS) or 'cancelled' (cancelPending() came first)
  async say(speaker, text, { gain = 1, pan = 0, clock = null } = {}) {
    const epoch = this.epoch;
    // A line not ready by MAX_WAIT_MS is dropped then, not when its render
    // ends: its bubble shows on time, and a hung worker can't stack them up
    let timer;
    const late = new Promise((resolve) => {
      timer = setTimeout(resolve, this.config.MAX_WAIT_MS, LATE);
    });
    const line = await Promise.race([this.prepare(speaker, text), late]);
    clearTimeout(timer);
    if (epoch !== this.epoch) return { dropped: 'cancelled' };
    if (line === LATE) return { dropped: 'late' };
    if (!line) return { dropped: 'failed' };
    return this.play(line, startTime(this.ctx.currentTime, clock), gain, pan);
  }

  // Stop the lines still waiting for their eighth note; lines still being
  // rendered won't play. Lines already playing finish, and so does one due
  // within LEAD_SEC: the main thread's clock trails the audio thread's, so
  // it may already be sounding, and cutting it would click.
  cancelPending() {
    this.epoch++;
    const now = this.ctx.currentTime;
    for (const line of this.playing) {
      if (line.startsAt <= now + LEAD_SEC) continue;
      line.source.stop();
      this.playing.delete(line);
    }
  }

  // True while a line is being spoken (its effect tail doesn't count), for
  // at most maxSec after it starts
  isSpeaking(maxSec = Infinity) {
    const now = this.ctx.currentTime;
    for (const { startsAt, duration } of this.playing) {
      if (startsAt <= now && now < startsAt + Math.min(duration, maxSec)) {
        return true;
      }
    }
    return false;
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
