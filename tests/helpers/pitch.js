// The pitch of a rendered speech line, for tests: autocorrelation over 40 ms
// frames, voiced frames only. `hz` is the median fundamental; `spread` is
// how far the pitch moves around it, in semitones (standard deviation).
const FRAME_SEC = 0.04;
const MIN_HZ = 60;
const MAX_HZ = 500;
const VOICED_POWER = 1e-4;
const VOICED_CORRELATION = 0.5;

export function pitchOf(samples, sampleRate) {
  const size = Math.round(sampleRate * FRAME_SEC);
  const minLag = Math.round(sampleRate / MAX_HZ);
  const maxLag = Math.round(sampleRate / MIN_HZ);
  const track = [];
  for (let start = 0; start + size + maxLag < samples.length; start += size) {
    let power = 0;
    for (let i = 0; i < size; i++) power += samples[start + i] ** 2;
    if (power / size < VOICED_POWER) continue;
    let best = 0;
    let lag = 0;
    for (let k = minLag; k <= maxLag; k++) {
      let c = 0;
      for (let i = 0; i < size; i++)
        c += samples[start + i] * samples[start + i + k];
      if (c > best) [best, lag] = [c, k];
    }
    if (best > VOICED_CORRELATION * power) track.push(sampleRate / lag);
  }
  track.sort((a, b) => a - b);
  const hz = track[Math.floor(track.length / 2)];
  const semis = track.map((f) => 12 * Math.log2(f / hz));
  const spread = Math.sqrt(
    semis.reduce((sum, s) => sum + s * s, 0) / semis.length
  );
  return { hz, spread };
}
