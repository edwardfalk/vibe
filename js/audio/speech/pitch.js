/**
 * The pitch of a rendered line: the median fundamental of its voiced frames,
 * by YIN (de Cheveigné & Kawahara 2002) on a copy at half the sample rate.
 * Voicebox tunes a line by it. It runs in the speech worker, 3 to 25 ms a
 * line.
 *
 * shortcut: SAM above pitch ~126 rings at ~350 Hz inside each of its slow
 * periods and can read as that (singing at 147 reads true). The tank, the
 * only SAM voice up there, isn't tuned; read again before tuning another.
 */
const MIN_HZ = 40;
const MAX_HZ = 1000;
const FRAME_SEC = 0.03; // compared against itself up to 1 / MIN_HZ later
const HOP_SEC = 0.02;
// A frame's difference, normalised, must dip under this to count as voiced
const THRESHOLD = 0.1;
// Frames more than 20 dB under the line's RMS are skipped as silence
const GATE = 0.1;

export function medianHz(samples, sampleRate) {
  // Averaging pairs halves the rate; it filters enough for f0 <= MAX_HZ
  const x = new Float32Array(samples.length >> 1);
  let power = 0;
  for (let i = 0; i < x.length; i++) {
    x[i] = (samples[2 * i] + samples[2 * i + 1]) / 2;
    power += x[i] * x[i];
  }
  const rate = sampleRate / 2;
  const size = Math.round(FRAME_SEC * rate);
  const hop = Math.round(HOP_SEC * rate);
  const minLag = Math.floor(rate / MAX_HZ);
  const maxLag = Math.ceil(rate / MIN_HZ);
  const gate = GATE ** 2 * (power / x.length) * size;
  const d = new Float64Array(maxLag + 2);
  const found = [];
  for (let s = 0; s + size + maxLag + 1 <= x.length; s += hop) {
    let energy = 0;
    for (let i = 0; i < size; i++) energy += x[s + i] * x[s + i];
    if (!(energy > gate)) continue;
    let sum = 0;
    let lag = -1;
    for (let tau = 1; tau <= maxLag + 1; tau++) {
      let diff = 0;
      for (let i = 0; i < size; i++) {
        const v = x[s + i] - x[s + i + tau];
        diff += v * v;
      }
      sum += diff;
      d[tau] = (diff * tau) / sum;
      if (lag < 0) {
        if (tau > minLag && d[tau] < THRESHOLD) lag = tau;
      } else if (d[tau] >= d[tau - 1]) {
        lag = tau - 1; // the bottom of the first dip under the threshold
        break;
      }
    }
    if (lag < 0 || lag > maxLag) continue;
    // A parabola through the dip finds its bottom between samples
    const [a, b, c] = [d[lag - 1], d[lag], d[lag + 1]];
    const bend = a - 2 * b + c;
    found.push(rate / (lag + (bend > 0 ? (a - c) / (2 * bend) : 0)));
  }
  if (!found.length) return null;
  found.sort((p, q) => p - q);
  return found[Math.floor((found.length - 1) / 2)];
}
