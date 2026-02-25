import {
  computeMediumStarVisual,
  getBeatReactiveValues,
} from './BeatReactiveBackground.js';

export function drawMediumStarsLayer(stars, p) {
  const { beatPulse, measurePhase } = getBeatReactiveValues();

  p.noStroke();
  let starIndex = 0;
  for (const star of stars) {
    const { alpha, finalSize, combinedBrightness } = computeMediumStarVisual(
      star,
      starIndex,
      p.frameCount,
      p.TWO_PI,
      beatPulse,
      measurePhase,
      p.sin.bind(p)
    );

    switch (star.color) {
      case 'cyan':
        p.fill(0, 243, 255, alpha);
        p.drawingContext.shadowColor = '#00F3FF';
        break;
      case 'magenta':
        p.fill(255, 0, 200, alpha);
        p.drawingContext.shadowColor = '#FF00C8';
        break;
      default: {
        const modAlpha = p.constrain(alpha + beatPulse * 40, 0, 255);
        p.fill(255, 255, 255, modAlpha);
        p.drawingContext.shadowColor = '#FFFFFF';
      }
    }

    // Note: beatPulse from getBeatReactiveValues() is typically in [0,1], 
    // but we clamp shadowBlur and currentSize defensively.
    const shadowBlurCandidate = 5 + beatPulse * 20;
    p.drawingContext.shadowBlur = Math.max(0, shadowBlurCandidate);
    const currentSizeCandidate = finalSize + beatPulse * 2;
    const currentSize = Math.max(1, currentSizeCandidate);
    p.ellipse(star.x, star.y, currentSize, currentSize);

    starIndex++;
  }
  p.drawingContext.shadowBlur = 0;
  p.drawingContext.shadowColor = 'transparent';
}
