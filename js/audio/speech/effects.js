/**
 * Speech effect chains: a speaker's list of stages, rendered offline onto a
 * finished line. Stages add no make-up gain, so a chain can leave a line
 * quieter or hotter; Voicebox levels the result. Also the reverb impulse the
 * sound effects in Audio.js use.
 */
import { mulberry32, random } from '../../mathUtils.js';

const TAIL_CAP_SEC = 1.5; // the longest effect tail kept after a line
const SILENT = 1e-4; // trailing samples quieter than -80 dBFS are trimmed
const REVERB_DECAY = 3.2; // speech reverb envelope (1 - t)^3.2, as auditioned
const REVERB_SEED = 7; // the same impulse every time, so a line always sounds the same
const MAX_FEEDBACK = 0.9; // a slapback loop above this rings for ever
const MAX_DELAY_SEC = 1;
const MIN_DRIVE = 0.1; // tanh(0)/tanh(0) is 0/0
const CURVE_SIZE = 4096;

// Each stage's parameters: [min, max, step, default] (the playground's sliders)
export const STAGE_PARAMS = {
  highpass: { freq: [20, 8000, 10, 400], q: [0.1, 20, 0.1, 0.7] },
  lowpass: { freq: [200, 11000, 10, 3000], q: [0.1, 20, 0.1, 0.7] },
  bandpass: { freq: [100, 8000, 10, 1500], q: [0.1, 20, 0.1, 1] },
  crush: { levels: [2, 64, 1, 15] },
  drive: { amount: [MIN_DRIVE, 50, 0.1, 5] },
  ringmod: { freq: [1, 400, 1, 40], mix: [0, 1, 0.01, 0.7] },
  tremolo: { rate: [0.5, 30, 0.5, 8], depth: [0, 1, 0.01, 0.5] },
  slapback: {
    time: [0.02, 0.5, 0.005, 0.09],
    feedback: [0, MAX_FEEDBACK, 0.01, 0.3],
    mix: [0, 1, 0.01, 0.3],
  },
  reverb: { seconds: [0.1, 3, 0.05, 1], mix: [0, 1, 0.01, 0.2] },
};

// What a stage uses for each parameter its config leaves out
export const stageDefaults = (type) =>
  Object.fromEntries(
    Object.entries(STAGE_PARAMS[type]).map(([key, [, , , value]]) => [
      key,
      value,
    ])
  );

export function createReverbImpulse(ctx, duration, decay, rand = random) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (rand() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

// A staircase from -1 to 1 with `levels` evenly spaced steps
export function stepCurve(levels, size = CURVE_SIZE) {
  const step = 2 / (levels - 1);
  return Float32Array.from(
    { length: size },
    (_, i) => Math.round(((i / (size - 1)) * 2) / step) * step - 1
  );
}

// Hard saturation, as auditioned: tanh(amount·x), scaled so ±1 stays ±1
export function driveCurve(amount, size = CURVE_SIZE) {
  const k = Math.max(amount, MIN_DRIVE);
  return Float32Array.from(
    { length: size },
    (_, i) => Math.tanh(k * ((i / (size - 1)) * 2 - 1)) / Math.tanh(k)
  );
}

function filter(ctx, input, type, { freq, q }) {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = freq;
  node.Q.value = q;
  return input.connect(node);
}

function shaper(ctx, input, curve) {
  const node = ctx.createWaveShaper();
  node.curve = curve;
  return input.connect(node);
}

function oscillator(ctx, frequency) {
  const node = ctx.createOscillator();
  node.frequency.value = frequency;
  node.start();
  return node;
}

// Dry and wet shares that add up to one: `mix` is the wet share
function blend(ctx, dry, wet, mix) {
  const out = ctx.createGain();
  const dryShare = ctx.createGain();
  dryShare.gain.value = 1 - mix;
  const wetShare = ctx.createGain();
  wetShare.gain.value = mix;
  dry.connect(dryShare).connect(out);
  wet.connect(wetShare).connect(out);
  return out;
}

// Each stage wires `input` through itself and returns its output node
const STAGES = {
  highpass: (ctx, input, s) => filter(ctx, input, 'highpass', s),
  lowpass: (ctx, input, s) => filter(ctx, input, 'lowpass', s),
  bandpass: (ctx, input, s) => filter(ctx, input, 'bandpass', s),
  crush: (ctx, input, { levels }) => shaper(ctx, input, stepCurve(levels)),
  drive: (ctx, input, { amount }) => shaper(ctx, input, driveCurve(amount)),
  ringmod: (ctx, input, { freq, mix }) => {
    const ring = ctx.createGain();
    ring.gain.value = 0; // the carrier alone sets the gain: input × carrier
    oscillator(ctx, freq).connect(ring.gain);
    return blend(ctx, input, input.connect(ring), mix);
  },
  tremolo: (ctx, input, { rate, depth }) => {
    const swell = ctx.createGain();
    swell.gain.value = 1 - depth / 2; // swings between 1 - depth and 1
    const amount = ctx.createGain();
    amount.gain.value = depth / 2;
    oscillator(ctx, rate).connect(amount).connect(swell.gain);
    return input.connect(swell);
  },
  slapback: (ctx, input, { time, feedback, mix }) => {
    const delay = ctx.createDelay(MAX_DELAY_SEC);
    delay.delayTime.value = time;
    const loop = ctx.createGain();
    loop.gain.value = Math.min(feedback, MAX_FEEDBACK);
    input.connect(delay).connect(loop).connect(delay);
    return blend(ctx, input, delay, mix);
  },
  reverb: (ctx, input, { seconds, mix }) => {
    const room = ctx.createConvolver();
    room.buffer = createReverbImpulse(
      ctx,
      seconds,
      REVERB_DECAY,
      mulberry32(REVERB_SEED)
    );
    return blend(ctx, input, input.connect(room), mix);
  },
};

export function validateChain(chain) {
  for (const stage of chain) {
    if (!Object.hasOwn(STAGES, stage?.type)) {
      throw new Error(`Unknown effect stage "${stage?.type}"`);
    }
  }
}

// Run a line through a chain: mono, at the line's own rate, with up to
// 1.5 s of tail kept and trailing silence trimmed
export async function renderChain(samples, sampleRate, chain) {
  validateChain(chain);
  if (chain.length === 0) return samples;
  const ctx = new OfflineAudioContext(
    1,
    samples.length + Math.round(TAIL_CAP_SEC * sampleRate),
    sampleRate
  );
  const line = ctx.createBuffer(1, samples.length, sampleRate);
  line.copyToChannel(samples, 0);
  const source = ctx.createBufferSource();
  source.buffer = line;
  let out = source;
  for (const stage of chain) {
    out = STAGES[stage.type](ctx, out, {
      ...stageDefaults(stage.type),
      ...stage,
    });
  }
  out.connect(ctx.destination);
  source.start();
  const rendered = (await ctx.startRendering()).getChannelData(0);
  let end = rendered.length;
  while (end > samples.length && Math.abs(rendered[end - 1]) < SILENT) end--;
  return rendered.slice(0, end);
}
