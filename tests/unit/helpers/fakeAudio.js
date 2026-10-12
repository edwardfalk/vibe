import { vi } from 'vitest';

// A Web Audio stand-in for a sound's unit tests: every node it makes is in
// `made`, by kind ('gain', 'pan', 'filter', 'osc', 'source', 'constant',
// 'shaper', 'convolver'), its params' calls recorded; connect returns its
// target, as Web Audio's does. `ctx` overrides the context's fields, e.g.
// fakeAudio({ currentTime: 0, sampleRate: 48000 }).
export function fakeAudio(ctx = {}) {
  const made = [];
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    setValueCurveAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const node = (kind, extra = {}) => {
    const n = {
      kind,
      connect: vi.fn((d) => d),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      ...extra,
    };
    made.push(n);
    return n;
  };
  return {
    ctx: {
      currentTime: 3,
      sampleRate: 8000,
      state: 'running',
      createStereoPanner: () => node('pan', { pan: param() }),
      createBiquadFilter: () =>
        node('filter', { frequency: param(), Q: param(), gain: param() }),
      createGain: () => node('gain', { gain: param() }),
      createOscillator: () =>
        node('osc', { frequency: param(), detune: param() }),
      createBufferSource: () =>
        node('source', { playbackRate: param(), detune: param() }),
      createConstantSource: () => node('constant', { offset: param() }),
      createWaveShaper: () => node('shaper'),
      createConvolver: () => node('convolver'),
      createBuffer: vi.fn((channels, length, rate) => {
        const data = new Float32Array(length);
        return { duration: length / rate, getChannelData: () => data };
      }),
      ...ctx,
    },
    made,
  };
}
