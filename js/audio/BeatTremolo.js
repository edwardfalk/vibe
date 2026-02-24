export function applyBeatTremolo(
  audioContext,
  beatClock,
  targetGain,
  duration
) {
  if (!audioContext || !beatClock || !targetGain) return;

  const lfo = audioContext.createOscillator();
  const depth = audioContext.createGain();

  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(beatClock.bpm / 60, audioContext.currentTime);
  depth.gain.setValueAtTime(0.5, audioContext.currentTime);

  lfo.connect(depth);
  depth.connect(targetGain.gain);

  lfo.start(audioContext.currentTime);
  lfo.stop(audioContext.currentTime + duration);
}
