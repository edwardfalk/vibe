/**
 * The rusher's crash: a cymbal on beat 1 or 3 (SoundConfig's rusherCrash).
 * Six square waves at the 808 cymbal's ratios go over a noise wash, with a
 * short bright burst of noise for the bang. Everything goes through one
 * high-pass, so nothing sits in the kick's band: the crash plays a frame
 * after the kick, and any low energy would flam with it.
 */
import { mulberry32 } from '../mathUtils.js';

const NOISE_SEED = 808;
const SILENT = 0.0001; // exponential ramps can't reach 0
const ATTACK_SEC = 0.004;
const TAIL_SEC = 0.05; // sources stop this long after they fade out
const noiseByContext = new WeakMap(); // AudioContext → its noise buffer
// The noise's length: every sound that draws from it (the crash, the deaths,
// the bomb's bang and cloud) reads at most this far in
export const NOISE_SEC = 2;

/**
 * The crash's noise, NOISE_SEC long, built once per context from a fixed
 * seed (Audio.js calls this when audio starts), so a crash draws none of the
 * game's random numbers
 */
export function crashNoise(ctx) {
  let buffer = noiseByContext.get(ctx);
  if (!buffer) {
    const rand = mulberry32(NOISE_SEED);
    buffer = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * NOISE_SEC),
      ctx.sampleRate
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = rand() * 2 - 1;
    noiseByContext.set(ctx, buffer);
  }
  return buffer;
}

// A gain that rises to `peak` at once and fades out over `sec`
function fade(ctx, peak, sec, t) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENT, t);
  g.gain.exponentialRampToValueAtTime(Math.max(SILENT, peak), t + ATTACK_SEC);
  g.gain.exponentialRampToValueAtTime(SILENT, t + sec);
  return g;
}

/** One crash into `out`, at `volume` (times its recipe's levels), panned -1..1 */
export function playCrash(ctx, out, cfg, volume, pan) {
  const t = ctx.currentTime;
  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(pan, t);
  panner.connect(out);
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.setValueAtTime(cfg.highpassHz, t);
  highpass.connect(panner);

  const metal = fade(ctx, cfg.metal * volume, cfg.duration, t);
  metal.connect(highpass);
  const nodes = [panner, highpass, metal];
  const sources = cfg.partialsHz.map((hz) => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(hz, t);
    osc.connect(metal);
    return [osc, cfg.duration];
  });
  const buffer = crashNoise(ctx);
  for (const [level, sec] of [
    [cfg.wash, cfg.washSec],
    [cfg.bang, cfg.bangSec],
  ]) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = fade(ctx, level * volume, sec, t);
    src.connect(gain);
    gain.connect(highpass);
    nodes.push(gain);
    sources.push([src, sec]);
  }
  for (const [src, sec] of sources) {
    src.start(t);
    src.stop(t + sec + TAIL_SEC);
  }
  // The metal rings longest: once it stops, everything is silent
  disconnectWhenEnded(sources[0][0], [
    ...sources.map(([src]) => src),
    ...nodes,
  ]);
}

/** Disconnect every node once `last` has ended: a sound's nodes, freed */
export function disconnectWhenEnded(last, nodes) {
  last.onended = () => {
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        // already disconnected
      }
    }
  };
}
