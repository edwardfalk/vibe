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
      case 'blue':
        p.fill(173, 216, 230, alpha);
        break;
      case 'yellow':
        p.fill(255, 255, 150 + beatPulse * 50, alpha);
        break;
      case 'orange':
        p.fill(255, 165 + beatPulse * 20, 0, alpha);
        break;
      default: {
        const modAlpha = p.constrain(alpha + beatPulse * 40, 0, 255);
        p.fill(255, 255, 255, modAlpha);
      }
    }
    p.ellipse(star.x, star.y, finalSize, finalSize);

    if (combinedBrightness > 0.85 && beatPulse > 0.3) {
      const sparkleAlpha = (combinedBrightness - 0.85) * beatPulse * 255;
      p.stroke(255, 255, 255, sparkleAlpha);
      p.strokeWeight(1);
      const sparkleSize = finalSize * 1.5;
      p.line(star.x - sparkleSize, star.y, star.x + sparkleSize, star.y);
      p.line(star.x, star.y - sparkleSize, star.x, star.y + sparkleSize);
      p.noStroke();
    }

    starIndex++;
  }
}
