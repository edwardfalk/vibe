import { describe, it, expect, vi, afterEach } from 'vitest';
import { Voicebox, spoken, startTime } from '../../js/audio/speech/Voicebox.js';
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
    sources: [],
    createGain: () => ({ gain: { value: 1 }, connect: (n) => n }),
    createStereoPanner: () => ({ pan: { value: 0 }, connect: (n) => n }),
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
