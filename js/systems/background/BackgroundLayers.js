/**
 * BackgroundLayers.js - Merged from 6 source files:
 *   ParallaxLayerConfig.js, ParallaxLayerFactory.js, ParallaxLayerRenderers.js,
 *   MediumStarRenderer.js, NearFieldParallax.js, BeatReactiveBackground.js
 */

import { random } from '../../mathUtils.js';
import {
  drawDistantGalaxiesLayer,
  drawFlowingNebulaStreamsLayer,
  drawShootingStarsLayer,
  drawEnhancedSparklesLayer,
} from './EnhancedSpaceElements.js';
import { drawAuroraWispsLayer } from './BackgroundEffects.js';

// ─── BeatReactiveBackground ───────────────────────────────────────────────────

function computeMediumStarVisual(
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
  const alpha = Math.min(255, combinedBrightness * 255 + beatPulse * 120);
  const sizeBoost = 1.0 + beatPulse * 0.3;
  const sizePulse = sizeBoost + beatPulse * 0.2 * ((starIndex % 3) / 3);
  const finalSize = star.size * sizePulse;

  return {
    alpha,
    finalSize,
    combinedBrightness,
    beatPulse,
  };
}

// ─── Parallax layers ──────────────────────────────────────────────────────────

const MEDIUM_STAR_COLORS = ['white', 'cyan', 'magenta'];
const DEBRIS_SHAPES = ['triangle', 'square', 'diamond'];

// Anywhere in a 3x3-screen area around the start view
const spot = (p) => ({
  x: random(-p.width, p.width * 2),
  y: random(-p.height, p.height * 2),
});
const phased = (p) => ({ ...spot(p), phase: random(0, p.TWO_PI) });

// How far (px) an element's drawing can reach from its position, at most:
// its size and motion, a glow (a canvas shadow fades out within about twice
// its shadowBlur) and antialiasing. Elements further off the canvas than this
// are skipped. The numbers are the draw functions' own maxima.
const glow = (shadowBlur) => 2 * shadowBlur;
const AA = 2;

// Back to front. speed is the parallax factor; make() is called count times,
// layer by layer, so a given random seed always gives the same sky.
const PARALLAX_LAYERS = [
  {
    speed: 0.05,
    count: 6,
    draw: drawDistantGalaxiesLayer,
    make: phased,
    reach: 75 * Math.SQRT2 + AA, // the 150 px image, rotated, scale <= 1
  },
  {
    speed: 0.1,
    count: 50,
    draw: drawDistantStarsLayer,
    reach: (3 + 10) / 2 + glow(15) + AA,
    make: (p) => ({
      ...spot(p),
      size: random(1, 3),
      brightness: random(0.3, 1),
      twinkleSpeed: random(0.01, 0.03),
    }),
  },
  {
    speed: 0.2,
    count: 15,
    draw: drawFlowingNebulaStreamsLayer,
    make: phased,
    // Flows 20 px; the 160x100 image scales up to 1.3
    reach: 20 + 1.3 * Math.hypot(80, 50) + AA,
  },
  {
    speed: 0.25,
    count: 12,
    draw: drawAuroraWispsLayer,
    make: phased,
    reach: (100 + 35 + 20) / 2 + AA, // widest: base + modulation + beat
  },
  {
    speed: 0.3,
    count: 8,
    draw: drawNebulaCloudLayer,
    reach: (300 + 10) / 2 + 20 + glow(80) + AA, // size, drift, glow
    make: (p) => ({
      ...spot(p),
      size: random(100, 300),
      color: {
        r: random(11, 46), // Deep violet range
        g: random(0, 11),
        b: random(26, 70), // Indigo range
      },
      alpha: random(0.05, 0.15),
      driftSpeed: random(0.1, 0.3),
    }),
  },
  {
    speed: 0.4,
    count: 40,
    draw: drawEnhancedSparklesLayer,
    make: phased,
    reach: 3 / 2 + glow(15) + AA,
  },
  {
    speed: 0.5,
    count: 30,
    draw: drawMediumStarsLayer,
    reach: (5 * 1.5 + 2) / 2 + glow(25) + AA, // size x pulse (< 1.5) + beat
    make: (p) => ({
      ...spot(p),
      size: random(2, 5),
      brightness: random(0.5, 1),
      color: random(MEDIUM_STAR_COLORS),
    }),
  },
  {
    speed: 0.6,
    count: 5,
    draw: drawShootingStarsLayer,
    reach: Infinity, // they fly; only five, so always drawn
    make: (p) => ({
      startX: random(-p.width, p.width * 2),
      startY: random(-p.height, p.height * 2),
      endXOffset: random(200, 500),
      endYOffset: random(-500, -200),
      phaseOffset: random(0, 600),
    }),
  },
  {
    speed: 0.8,
    count: 15,
    draw: drawCloseDebrisLayer,
    reach: Math.hypot(4, 4) + 1 + glow(10) + AA, // 8 px shape, 2 px stroke
    make: (p) => ({
      ...spot(p),
      size: random(3, 8),
      rotation: random(0, p.TWO_PI),
      rotationSpeed: random(-0.02, 0.02),
      shape: random(DEBRIS_SHAPES),
    }),
  },
  {
    speed: 1.2,
    count: 60,
    draw: drawForegroundSparksLayer,
    reach: 4 * 5 + 1 + glow(15) + AA, // a streak up to 20 px, 2 px stroke
    make: (p) => ({
      ...spot(p),
      size: random(2, 4),
      alpha: random(150 / 255, 1),
      flickerSpeed: random(0.05, 0.15),
    }),
  },
];

/** Each layer with its elements generated: { speed, draw, reach, elements }. */
export function createParallaxLayers(p) {
  return PARALLAX_LAYERS.map(({ speed, count, draw, make, reach }) => ({
    speed,
    draw,
    reach,
    elements: Array.from({ length: count }, () => make(p)),
  }));
}

// ─── ParallaxLayerRenderers ───────────────────────────────────────────────────

function drawDistantStarsLayer(stars, p, beatClock, onView) {
  const beatBoost = beatClock ? beatClock.getBeatIntensity(10) * 80 : 0;
  const beatPulse = beatClock ? beatClock.getBeatIntensity(6) : 0;
  const STAR_BEAT_MULTIPLIER = 10;

  p.noStroke();
  p.drawingContext.shadowBlur = 5 + beatPulse * 10;
  p.drawingContext.shadowColor = '#FFFFFF';
  for (const star of stars) {
    if (!onView(star.x, star.y)) continue;
    const twinkle =
      p.sin((p.millis() / 1000) * (star.twinkleSpeed * 60)) * 0.5 + 0.5;
    const alpha = Math.min(255, star.brightness * twinkle * 255 + beatBoost);

    p.fill(255, 255, 255, alpha);
    p.ellipse(
      star.x,
      star.y,
      star.size + beatPulse * STAR_BEAT_MULTIPLIER,
      star.size + beatPulse * STAR_BEAT_MULTIPLIER
    );
  }
  p.drawingContext.shadowBlur = 0;
  p.drawingContext.shadowColor = 'transparent';
}

function drawNebulaCloudLayer(clouds, p, beatClock, onView) {
  const beatPulse = beatClock ? beatClock.getBeatIntensity(6) : 0;

  p.noStroke();
  for (const cloud of clouds) {
    if (!onView(cloud.x, cloud.y)) continue;
    const drift = p.sin((p.millis() / 1000) * (cloud.driftSpeed * 60)) * 20;
    const boost = beatPulse * 0.7;
    const r = Math.min(255, cloud.color.r + boost * 60);
    const g = Math.min(255, cloud.color.g + boost * 30);
    const b = Math.min(255, cloud.color.b + boost * 80);
    const alpha = Math.min(255, cloud.alpha * 255 * (1 + boost * 2.5));

    p.drawingContext.shadowBlur = 40 + beatPulse * 40;
    p.drawingContext.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha / 255})`;
    p.fill(r, g, b, alpha);
    p.ellipse(
      cloud.x + drift,
      cloud.y,
      cloud.size + beatPulse * 10,
      (cloud.size + beatPulse * 10) * 0.6
    );
  }
  p.drawingContext.shadowBlur = 0;
  p.drawingContext.shadowColor = 'transparent';
}

// ─── MediumStarRenderer ───────────────────────────────────────────────────────

function drawMediumStarsLayer(stars, p, beatClock, onView) {
  const beatPulse = beatClock ? beatClock.getBeatIntensity(8) : 0;
  const measurePhase = beatClock ? beatClock.getMeasurePhase() : 0;

  p.noStroke();
  // beatPulse is constant for the entire call; set shadowBlur once before loop
  const shadowBlurCandidate = 5 + beatPulse * 20;
  p.drawingContext.shadowBlur = Math.max(0, shadowBlurCandidate);
  let starIndex = 0;
  for (const star of stars) {
    if (!onView(star.x, star.y)) {
      starIndex++; // the index sets the star's pulse
      continue;
    }
    const { alpha, finalSize } = computeMediumStarVisual(
      star,
      starIndex,
      p.millis() / 16.67,
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

    const currentSizeCandidate = finalSize + beatPulse * 2;
    const currentSize = Math.max(1, currentSizeCandidate);
    p.ellipse(star.x, star.y, currentSize, currentSize);

    starIndex++;
  }
  p.drawingContext.shadowBlur = 0;
  p.drawingContext.shadowColor = 'transparent';
}

// ─── NearFieldParallax ────────────────────────────────────────────────────────

function drawCloseDebrisLayer(debris, p, beatClock, onView) {
  p.stroke(255, 0, 200, 150); // Hot magenta
  p.strokeWeight(2);
  p.noFill();
  p.drawingContext.shadowBlur = 10;
  p.drawingContext.shadowColor = '#FF00C8';

  for (const piece of debris) {
    if (!onView(piece.x, piece.y)) {
      piece.rotation += piece.rotationSpeed; // it keeps spinning off view
      continue;
    }
    p.push();
    p.translate(piece.x, piece.y);
    p.rotate(piece.rotation);
    piece.rotation += piece.rotationSpeed;

    switch (piece.shape) {
      case 'triangle':
        p.triangle(
          -piece.size / 2,
          piece.size / 2,
          piece.size / 2,
          piece.size / 2,
          0,
          -piece.size / 2
        );
        break;
      case 'square':
        p.rect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
        break;
      case 'diamond':
        p.quad(
          0,
          -piece.size / 2,
          piece.size / 2,
          0,
          0,
          piece.size / 2,
          -piece.size / 2,
          0
        );
        break;
    }
    p.pop();
  }
  p.drawingContext.shadowBlur = 0;
  p.drawingContext.shadowColor = 'transparent';
}

function drawForegroundSparksLayer(sparks, p, beatClock, onView) {
  p.noFill();
  p.strokeWeight(2);
  p.drawingContext.shadowBlur = 15;
  p.drawingContext.shadowColor = '#00F3FF';
  for (const spark of sparks) {
    if (!onView(spark.x, spark.y)) continue;
    const flicker =
      p.sin((p.millis() / 1000) * (spark.flickerSpeed * 60)) * 0.5 + 0.5;
    const alpha = spark.alpha * 255 * flicker;
    p.stroke(0, 243, 255, alpha); // Cyan motion blur

    const length = spark.size * 5; // Motion blur length
    p.line(spark.x, spark.y, spark.x - length * 0.8, spark.y + length * 0.6);
  }
  p.drawingContext.shadowBlur = 0;
  p.drawingContext.shadowColor = 'transparent';
}
