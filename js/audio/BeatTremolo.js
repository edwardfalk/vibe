export function applyBeatTremolo(
  audioContext,
  beatClock,
  targetGain,
  duration
) {
  if (
    !audioContext ||
    !beatClock ||
    !targetGain ||
    typeof duration !== 'number' ||
    !isFinite(duration) ||
    duration < 0
  )
    return;

  const lfo = audioContext.createOscillator();
  const depth = audioContext.createGain();

  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(beatClock.bpm / 60, audioContext.currentTime);
  const baseGain = targetGain.gain.value;
  const safeDepth = Math.min(0.5, baseGain * 0.5);
  depth.gain.setValueAtTime(safeDepth, audioContext.currentTime);

  lfo.connect(depth);
  depth.connect(targetGain.gain);

  lfo.start(audioContext.currentTime);
  const stopTime = audioContext.currentTime + duration;
  lfo.stop(stopTime);
  lfo.onended = () => {
    lfo.disconnect();
    depth.disconnect();
  };
}
