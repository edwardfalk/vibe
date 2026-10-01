/**
 * Loudness and level helpers for rendered speech lines: pure functions on
 * mono Float32Array samples, shared by the speech worker and Voicebox.
 */

const FRAME_SEC = 0.05;
const GATE_BELOW_LOUDEST_DB = 40; // quieter frames are pauses, not speech
const MAX_GAIN_DB = 20; // a near-silent render must not become a roar

// RMS loudness in dB over 50 ms frames, counting only frames within 40 dB of
// the loudest one; -Infinity when there is nothing to hear
export function loudness(samples, sampleRate) {
  const size = Math.max(1, Math.round(sampleRate * FRAME_SEC));
  const powers = [];
  for (let start = 0; start < samples.length; start += size) {
    const end = Math.min(samples.length, start + size);
    let sum = 0;
    for (let i = start; i < end; i++) sum += samples[i] * samples[i];
    powers.push(sum / (end - start));
  }
  const loudest = powers.reduce((a, b) => Math.max(a, b), 0);
  if (!(loudest > 0)) return -Infinity;
  const gate = loudest * 10 ** (-GATE_BELOW_LOUDEST_DB / 10);
  const speech = powers.filter((p) => p >= gate);
  return 10 * Math.log10(speech.reduce((a, b) => a + b, 0) / speech.length);
}

// Scale a line to targetDb, by at most +20 dB; silence comes back unchanged
export function matchLoudness(samples, sampleRate, targetDb) {
  const current = loudness(samples, sampleRate);
  if (!Number.isFinite(current)) return samples;
  const gain = 10 ** (Math.min(MAX_GAIN_DB, targetDb - current) / 20);
  return samples.map((x) => x * gain);
}

// Lines are rendered ahead of time, so scaling the whole line down to fit
// the ceiling can never exceed it; reductionDb is what that cost
export function fitCeiling(samples, ceilingDb) {
  const ceiling = 10 ** (ceilingDb / 20);
  const peak = samples.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  if (peak <= ceiling) return { samples, reductionDb: 0 };
  const scale = ceiling / peak;
  return {
    samples: samples.map((x) =>
      Math.max(-ceiling, Math.min(ceiling, x * scale))
    ),
    reductionDb: -20 * Math.log10(scale),
  };
}

// False for an empty, all-zero or non-finite line: such a line never reaches
// the audio graph
export function isUsable(samples) {
  if (!samples?.length) return false;
  let heard = false;
  for (const x of samples) {
    if (!Number.isFinite(x)) return false;
    if (x !== 0) heard = true;
  }
  return heard;
}
