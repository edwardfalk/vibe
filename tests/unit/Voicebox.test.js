import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  Voicebox,
  spoken,
  startSpeechWorker,
  startTime,
} from '../../js/audio/speech/Voicebox.js';
import { CONFIG } from '../../js/config.js';

const RATE = 22050;
const GRUNT = CONFIG.SPEECH.SPEAKERS.grunt;
const tone = (seconds) =>
  Float32Array.from(
    { length: Math.round(RATE * seconds) },
    (_, i) => 0.1 * Math.sin((2 * Math.PI * 220 * i) / RATE)
  );

function fakeContext() {
  const ctx = {
    currentTime: 0,
    sources: [],
    gains: [], // the first is Voicebox's output; then one per line played
    panners: [],
    createGain() {
      const node = { gain: { value: 1 }, connect: (n) => n };
      ctx.gains.push(node);
      return node;
    },
    createStereoPanner() {
      const node = { pan: { value: 0 }, connect: (n) => n };
      ctx.panners.push(node);
      return node;
    },
    createBuffer: (channels, length, sampleRate) => ({
      length,
      sampleRate,
      duration: length / sampleRate,
      copyToChannel() {},
    }),
    createBufferSource() {
      const source = {
        connect: (n) => n,
        start(when) {
          source.when = when;
        },
        stop() {
          source.stopped = true;
        },
      };
      ctx.sources.push(source);
      return source;
    },
  };
  return ctx;
}

function setup({ chain = async (s) => s } = {}) {
  const worker = {
    posted: [],
    postMessage(message) {
      worker.posted.push(message);
    },
    terminate() {
      worker.terminated = true;
    },
  };
  const ctx = fakeContext();
  const voicebox = new Voicebox({
    audioContext: ctx,
    createWorker: () => worker,
    renderChain: (...args) => chain(...args),
  });
  const reply = (extra = {}) =>
    worker.onmessage({
      data: {
        id: worker.posted.at(-1).id,
        samples: tone(0.5),
        sampleRate: RATE,
        renderMs: 3,
        ...extra,
      },
    });
  return { voicebox, worker, ctx, reply };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('spoken', () => {
  const respell = { sam: { death: 'deth', "can't": 'cant' }, espeak: {} };

  it('respells whole words for that engine only', () => {
    expect(spoken('sam', 'DEATH TO HUMANS!', respell)).toBe('deth TO HUMANS!');
    expect(spoken('sam', 'deathly quiet', respell)).toBe('deathly quiet');
    expect(spoken('espeak', 'DEATH TO HUMANS!', respell)).toBe(
      'DEATH TO HUMANS!'
    );
  });

  it('keeps contractions whole, ignores quotes, and never reads built-ins', () => {
    expect(spoken('sam', "CAN'T STOP!", respell)).toBe('cant STOP!');
    expect(spoken('sam', "'death'", respell)).toBe("'deth'");
    expect(spoken('sam', 'constructor toString', respell)).toBe(
      'constructor toString'
    );
  });
});

describe('startTime', () => {
  // Grid origin 1 s, 120 BPM: eighths every 0.25 s, the window 100 ms
  const clock = {
    audioContext: {},
    startTime: 1000,
    beatInterval: 500,
    tolerance: 100,
  };

  it('starts at once inside the window an eighth opens', () => {
    expect(startTime(1.02, clock)).toBe(1.02);
    expect(startTime(1.09, clock)).toBe(1.09);
    expect(startTime(1.26, clock)).toBe(1.26); // just after the "and" of 1
    expect(startTime(1.5, clock)).toBe(1.5);
  });

  it('waits for the next eighth otherwise, at least 20 ms ahead', () => {
    expect(startTime(1.15, clock)).toBeCloseTo(1.25, 9);
    expect(startTime(1.24, clock)).toBeCloseTo(1.5, 9);
    expect(startTime(1.37, clock)).toBeCloseTo(1.5, 9);
  });

  it('starts at once before the clock runs on audio time', () => {
    expect(startTime(1.15, { ...clock, audioContext: null })).toBe(1.15);
    expect(startTime(1.15, null)).toBe(1.15);
  });
});

describe('Voicebox', () => {
  it('renders a line, levelled, and plays it with gain and pan', async () => {
    const { voicebox, worker, ctx, reply } = setup();
    const rendering = voicebox.renderLine(GRUNT, 'Kill human!');
    expect(worker.posted[0]).toMatchObject({
      type: 'render',
      engine: 'espeak',
      text: 'Kill human!',
      targetDb: CONFIG.SPEECH.TARGET_DB,
    });
    reply();
    const line = await rendering;
    expect(line.spokenSec).toBe(0.5);
    expect(line.loudnessOut).toBeCloseTo(CONFIG.SPEECH.TARGET_DB, 0);
    for (const key of ['renderMs', 'chainMs', 'levelMs', 'reductionDb']) {
      expect(Number.isFinite(line[key])).toBe(true);
    }
    expect(voicebox.play(line, 11, 0.5, -0.3)).toEqual({
      startsAt: 11,
      duration: 0.5,
    });
    expect(ctx.sources[0].when).toBe(11);
  });

  it('a chain that leaves silence', async () => {
    const { voicebox, reply } = setup({
      chain: async (s) => new Float32Array(s.length),
    });
    const rendering = voicebox.renderLine(GRUNT, 'Kill human!');
    reply();
    await expect(rendering).rejects.toThrow(
      'the effect chain left nothing to hear'
    );
  });

  it('a chain that leaves too little for level out to recover', async () => {
    // 40 dB down is past the +20 dB level out may add: the line would play
    // inaudibly while the readout showed numbers
    const { voicebox, reply } = setup({
      chain: async (s) => s.map((x) => x * 0.01),
    });
    const rendering = voicebox.renderLine(GRUNT, 'Kill human!');
    reply();
    await expect(rendering).rejects.toThrow(
      'the effect chain left almost nothing to hear'
    );
  });

  it('refuses a line that is too long, before asking the worker', async () => {
    const { voicebox, worker } = setup();
    const long = 'a'.repeat(CONFIG.SPEECH.MAX_LINE_CHARS + 1);
    await expect(voicebox.renderLine(GRUNT, long)).rejects.toThrow(
      `at most ${CONFIG.SPEECH.MAX_LINE_CHARS} characters`
    );
    expect(worker.posted).toHaveLength(0);
  });

  it('passes on a render error and stays on', async () => {
    const { voicebox, reply } = setup();
    const rendering = voicebox.renderLine(GRUNT, 'Kill human!');
    reply({ error: "SAM can't read" });
    await expect(rendering).rejects.toThrow("SAM can't read");
    expect(voicebox.failed).toBeNull();
  });

  it('goes silent for the session when the worker fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { voicebox, worker } = setup();
    const rendering = voicebox.renderLine(GRUNT, 'Kill human!');
    worker.onerror({ message: 'boom' });
    await expect(rendering).rejects.toThrow('boom');
    await expect(voicebox.renderLine(GRUNT, 'Wait, what?')).rejects.toThrow(
      'boom'
    );
    expect(worker.posted).toHaveLength(1);
    expect(worker.terminated).toBe(true);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('goes silent for the session on a fatal reply', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { voicebox, reply } = setup();
    const rendering = voicebox.renderLine(GRUNT, 'Kill human!');
    reply({ error: 'Aborted()', fatal: true });
    await expect(rendering).rejects.toThrow('Aborted()');
    expect(voicebox.failed.message).toBe('Aborted()');
  });

  it('is silent from the start when no worker can be made', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const voicebox = new Voicebox({
      audioContext: fakeContext(),
      createWorker: () => {
        throw new ReferenceError('Worker is not defined');
      },
    });
    expect(voicebox.failed).toBeInstanceOf(ReferenceError);
    await expect(voicebox.renderLine(GRUNT, 'Hi')).rejects.toThrow(
      'Worker is not defined'
    );
  });

  it('a worker that stops answering turns speech off', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { voicebox } = setup();
    const rendering = voicebox.renderLine(GRUNT, 'Kill human!');
    vi.advanceTimersByTime(CONFIG.SPEECH.WORKER_TIMEOUT_MS);
    await expect(rendering).rejects.toThrow('stopped answering');
    expect(voicebox.failed).not.toBeNull();
  });

  it('a failure while the chain runs stops the line', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const late = {}; // the chain runs after setup() has made the voicebox
    const { voicebox, reply } = setup({
      chain: async (s) => {
        late.voicebox.fail(new Error('gone'));
        return s;
      },
    });
    late.voicebox = voicebox;
    const rendering = voicebox.renderLine(GRUNT, 'Kill human!');
    reply();
    await expect(rendering).rejects.toThrow('gone');
  });
});

describe("Voicebox: the game's side", () => {
  // Grid origin 1 s, 120 BPM: eighths every 0.25 s, the window 100 ms
  const clock = {
    audioContext: {},
    startTime: 1000,
    beatInterval: 500,
    tolerance: 100,
  };

  it('says a line on the grid, panned, from one render', async () => {
    const { voicebox, worker, ctx, reply } = setup();
    ctx.currentTime = 1.15; // past the window: the next eighth
    const saying = voicebox.say('grunt', 'Kill human!', {
      gain: 0.7,
      pan: -0.4,
      clock,
    });
    reply();
    const line = await saying;
    expect(line.startsAt).toBeCloseTo(1.25, 9);
    expect(line.duration).toBe(0.5);
    expect(ctx.sources[0].when).toBeCloseTo(1.25, 9);
    expect(ctx.gains[1].gain.value).toBe(0.7);
    expect(ctx.panners[0].pan.value).toBe(-0.4);
    // Said again: no new render; another speaker's is its own
    ctx.currentTime = 2.02; // inside the window: at once
    expect(
      (await voicebox.say('grunt', 'Kill human!', { clock })).startsAt
    ).toBe(2.02);
    expect(worker.posted).toHaveLength(1);
    voicebox.say('rusher', 'Kill human!', { clock });
    expect(worker.posted).toHaveLength(2);
  });

  it("the engine hears the speaker's respelling; the cache keys on it", async () => {
    const { voicebox, worker } = setup();
    voicebox.say('tank', 'DEATH TO HUMANS!'); // the tank speaks through SAM
    voicebox.say('grunt', 'DEATH TO HUMANS!'); // the grunt through espeak-ng
    await Promise.resolve();
    expect(worker.posted.map((m) => m.text)).toEqual([
      'deth TO HUMANS!',
      'DEATH TO HUMANS!',
    ]);
  });

  it('two asks before the line is ready share one render', async () => {
    const { voicebox, worker, reply } = setup();
    const first = voicebox.say('grunt', 'Kill human!');
    voicebox.prepare('grunt', 'Kill human!');
    const second = voicebox.say('grunt', 'Kill human!');
    await Promise.resolve();
    expect(worker.posted).toHaveLength(1);
    reply();
    expect((await first).duration).toBe(0.5);
    expect((await second).duration).toBe(0.5);
  });

  it("a line it can't render is logged once and dropped, and speech stays on", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { voicebox, worker, reply } = setup();
    const saying = voicebox.say('stabber', 'Ugh');
    reply({ error: "SAM can't read" });
    expect(await saying).toEqual({ dropped: 'failed' });
    expect(await voicebox.say('stabber', 'Ugh')).toEqual({ dropped: 'failed' });
    expect(worker.posted).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(voicebox.failed).toBeNull();
  });

  it('a line not ready within MAX_WAIT_MS is dropped late then, and kept', async () => {
    vi.useFakeTimers();
    const { voicebox, worker, ctx, reply } = setup();
    const saying = voicebox.say('grunt', 'Kill human!');
    await vi.advanceTimersByTimeAsync(CONFIG.SPEECH.MAX_WAIT_MS - 1);
    let result = null;
    saying.then((r) => (result = r));
    await Promise.resolve();
    expect(result).toBeNull(); // not yet
    await vi.advanceTimersByTimeAsync(1);
    expect(await saying).toEqual({ dropped: 'late' }); // the render isn't done
    expect(ctx.sources).toHaveLength(0);
    reply(); // it finishes later, and is kept: next time it plays
    expect((await voicebox.say('grunt', 'Kill human!')).duration).toBe(0.5);
    expect(worker.posted).toHaveLength(1);
  });

  it('cancelPending: a line rendering is dropped, one waiting is stopped, one playing finishes', async () => {
    const { voicebox, ctx, reply } = setup();
    ctx.currentTime = 1.02;
    const playing = voicebox.say('grunt', 'Kill human!', { clock });
    reply();
    await playing; // starts at once, 1.02
    ctx.currentTime = 1.15;
    const waiting = voicebox.say('tank', 'FIRE!', { clock });
    reply();
    await waiting; // waits for 1.25
    const rendering = voicebox.say('rusher', 'Charge!', { clock });
    voicebox.cancelPending();
    reply();
    expect(await rendering).toEqual({ dropped: 'cancelled' });
    expect(ctx.sources.map((s) => !!s.stopped)).toEqual([false, true]);
    expect(voicebox.playing.size).toBe(1);
    // Asked after the cancel, it plays
    expect((await voicebox.say('rusher', 'Charge!', { clock })).duration).toBe(
      0.5
    );
  });

  it('cancelPending spares a line due within 20 ms: it may already be sounding', async () => {
    const { voicebox, ctx, reply } = setup();
    ctx.currentTime = 1.15;
    const saying = voicebox.say('grunt', 'Kill human!', { clock });
    reply();
    await saying; // due at 1.25
    ctx.currentTime = 1.24; // the audio thread may be at 1.25 already
    voicebox.cancelPending();
    expect(ctx.sources[0].stopped).toBeUndefined();
    expect(voicebox.playing.size).toBe(1);
  });

  it('isSpeaking only while a line is spoken, and for at most maxSec', async () => {
    const { voicebox, ctx, reply } = setup();
    ctx.currentTime = 1.15;
    const saying = voicebox.say('grunt', 'Kill human!', { clock });
    reply();
    await saying; // 1.25 to 1.75
    expect(voicebox.isSpeaking()).toBe(false); // waiting for its eighth
    ctx.currentTime = 1.25;
    expect(voicebox.isSpeaking()).toBe(true);
    ctx.currentTime = 1.6;
    expect(voicebox.isSpeaking()).toBe(true);
    expect(voicebox.isSpeaking(0.3)).toBe(false); // the cap: 0.3 s from its start
    ctx.currentTime = 1.75; // its tail may still ring; the words are done
    expect(voicebox.isSpeaking()).toBe(false);
    ctx.sources[0].onended();
    expect(voicebox.playing.size).toBe(0);
  });

  it('says nothing once speech is off, with its one error and no more', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { voicebox, worker } = setup();
    const saying = voicebox.say('grunt', 'Kill human!');
    worker.onerror({ message: 'boom' });
    expect(await saying).toEqual({ dropped: 'failed' });
    expect(await voicebox.say('grunt', 'Wait, what?')).toEqual({
      dropped: 'failed',
    });
    expect(worker.posted).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('startSpeechWorker', () => {
  class FakeWorker {
    constructor(url, options) {
      Object.assign(this, { url: String(url), options, posted: [] });
    }
    postMessage(message) {
      this.posted.push(message);
    }
    terminate() {}
  }
  afterEach(() => delete globalThis.Worker);

  it('starts the worker and espeak-ng loading, for a Voicebox to take over', () => {
    globalThis.Worker = FakeWorker;
    const worker = startSpeechWorker();
    expect(worker.url).toMatch(/speech\/speechWorker\.js$/);
    expect(worker.options).toEqual({ type: 'module' });
    expect(worker.posted).toEqual([{ id: 0, type: 'variants' }]);
    const voicebox = new Voicebox({
      audioContext: fakeContext(),
      createWorker: () => worker,
    });
    expect(voicebox.worker).toBe(worker);
    worker.onmessage({ data: { id: 0, variants: [] } }); // nobody's request
    expect(voicebox.failed).toBeNull();
    expect(voicebox.pending.size).toBe(0);
  });

  it('an error before a Voicebox takes it over still turns speech off', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.Worker = FakeWorker;
    const worker = startSpeechWorker();
    worker.onerror({ message: 'no such file' });
    const voicebox = new Voicebox({
      audioContext: fakeContext(),
      createWorker: () => worker,
    });
    expect(voicebox.failed.message).toBe('no such file');
  });
});
