export function getBeatReactiveValues() {
  const beatClock = window.beatClock;
  if (!beatClock) {
    return {
      beatPulse: 0,
      measurePhase: 0,
      downbeatIntensity: 0,
      beatIntensity: 0,
    };
  }

  return {
    beatPulse: beatClock.getBeatIntensity(8),
    measurePhase: beatClock.getMeasurePhase(),
    downbeatIntensity: beatClock.getDownbeatIntensity(3),
    beatIntensity: beatClock.getBeatIntensity(4),
  };
}

export function computeMediumStarVisual(
  star,
  starIndex,
  frameCount,
  twoPi,
  beatPulse,
  measurePhase,
  sinFn
) {
  const starPhase = (star.x * 0.01 + star.y * 0.01) % twoPi;
  const twinkleSpeed = 0.05 + star.size * 0.01;
  const timeTwinkle = sinFn(frameCount * twinkleSpeed + starPhase) * 0.5 + 0.5;
  const beatTwinkle =
    (sinFn(measurePhase * twoPi + starPhase) * 0.5 + 0.5) * beatPulse;
  const combinedBrightness =
    star.brightness * (0.7 + timeTwinkle * 0.3 + beatTwinkle * 0.3);
  const alpha = Math.min(255, combinedBrightness * 255);
  const sizePulse = 1 + beatPulse * 0.2 * ((starIndex % 3) / 3);
  const finalSize = star.size * sizePulse;

  return {
    alpha,
    finalSize,
    combinedBrightness,
    beatPulse,
  };
}
