/**
 * BackgroundLayers.js - Merged from 6 source files:
 *   ParallaxLayerConfig.js, ParallaxLayerFactory.js, ParallaxLayerRenderers.js,
 *   MediumStarRenderer.js, NearFieldParallax.js, BeatReactiveBackground.js
 */

import { floor, random, randomRange } from '../../mathUtils.js';

// ─── BeatReactiveBackground ───────────────────────────────────────────────────

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

// ─── ParallaxLayerConfig ──────────────────────────────────────────────────────

export function createParallaxLayerConfig() {
  return [
    {
      name: 'distant_galaxies',
      elements: [],
      speed: 0.05,
      depth: 0.95,
    },
    {
      name: 'distant_stars',
      elements: [],
      speed: 0.1,
      depth: 0.9,
    },
    {
      name: 'nebula_streams',
      elements: [],
      speed: 0.2,
      depth: 0.8,
    },
    {
      name: 'aurora_wisps',
      elements: [],
      speed: 0.25,
      depth: 0.75,
    },
    {
      name: 'nebula_clouds',
      elements: [],
      speed: 0.3,
      depth: 0.7,
    },
    {
      name: 'enhanced_sparkles',
      elements: [],
      speed: 0.4,
      depth: 0.6,
    },
    {
      name: 'medium_stars',
      elements: [],
      speed: 0.5,
      depth: 0.5,
    },
    {
      name: 'shooting_stars',
      elements: [],
      speed: 0.6,
      depth: 0.4,
    },
    {
      name: 'close_debris',
      elements: [],
      speed: 0.8,
      depth: 0.3,
    },
    {
      name: 'foreground_sparks',
      elements: [],
      speed: 1.2,
      depth: 0.1,
    },
  ];
}

// ─── ParallaxLayerFactory ─────────────────────────────────────────────────────

const DISTANT_STAR_COUNT = 50;
const NEBULA_CLOUD_COUNT = 8;
const MEDIUM_STAR_COUNT = 30;
const CLOSE_DEBRIS_COUNT = 15;
const FOREGROUND_SPARK_COUNT = 60;

const DISTANT_GALAXY_COUNT = 6;
const NEBULA_STREAM_COUNT = 15;
const AURORA_WISP_COUNT = 12;
const ENHANCED_SPARKLE_COUNT = 40;
const SHOOTING_STAR_COUNT = 5;

const MEDIUM_STAR_COLORS = ['white', 'cyan', 'magenta'];
const DEBRIS_SHAPES = ['triangle', 'square', 'diamond'];

export function generateParallaxLayerElements(parallaxLayers, p) {
  const findLayer = (name) => parallaxLayers.find((l) => l.name === name);

  const distantGalaxies = findLayer('distant_galaxies');
  if (distantGalaxies) {
    for (let i = 0; i < DISTANT_GALAXY_COUNT; i++) {
      distantGalaxies.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        phase: randomRange(0, p.TWO_PI),
      });
    }
  }

  const distantStars = findLayer('distant_stars');
  if (distantStars) {
    for (let i = 0; i < DISTANT_STAR_COUNT; i++) {
      distantStars.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(1, 3),
        brightness: randomRange(0.3, 1),
        twinkleSpeed: randomRange(0.01, 0.03),
      });
    }
  }

  const nebulaStreams = findLayer('nebula_streams');
  if (nebulaStreams) {
    for (let i = 0; i < NEBULA_STREAM_COUNT; i++) {
      nebulaStreams.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        phase: randomRange(0, p.TWO_PI),
      });
    }
  }

  const auroraWisps = findLayer('aurora_wisps');
  if (auroraWisps) {
    for (let i = 0; i < AURORA_WISP_COUNT; i++) {
      auroraWisps.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        phase: randomRange(0, p.TWO_PI),
      });
    }
  }

  const nebulaClouds = findLayer('nebula_clouds');
  if (nebulaClouds) {
    for (let i = 0; i < NEBULA_CLOUD_COUNT; i++) {
      nebulaClouds.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(100, 300),
        color: {
          r: randomRange(11, 46), // Deep violet range
          g: randomRange(0, 11),
          b: randomRange(26, 70), // Indigo range
        },
        alpha: randomRange(0.05, 0.15),
        driftSpeed: randomRange(0.1, 0.3),
      });
    }
  }

  const enhancedSparkles = findLayer('enhanced_sparkles');
  if (enhancedSparkles) {
    for (let i = 0; i < ENHANCED_SPARKLE_COUNT; i++) {
      enhancedSparkles.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        phase: randomRange(0, p.TWO_PI),
      });
    }
  }

  const mediumStars = findLayer('medium_stars');
  if (mediumStars) {
    for (let i = 0; i < MEDIUM_STAR_COUNT; i++) {
      mediumStars.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(2, 5),
        brightness: randomRange(0.5, 1),
        color: random(MEDIUM_STAR_COLORS),
      });
    }
  }

  const shootingStars = findLayer('shooting_stars');
  if (shootingStars) {
    for (let i = 0; i < SHOOTING_STAR_COUNT; i++) {
      shootingStars.elements.push({
        startX: randomRange(-p.width, p.width * 2),
        startY: randomRange(-p.height, p.height * 2),
        endXOffset: randomRange(200, 500),
        endYOffset: randomRange(-500, -200),
        phaseOffset: randomRange(0, 600),
      });
    }
  }

  const closeDebris = findLayer('close_debris');
  if (closeDebris) {
    for (let i = 0; i < CLOSE_DEBRIS_COUNT; i++) {
      closeDebris.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(3, 8),
        rotation: randomRange(0, p.TWO_PI),
        rotationSpeed: randomRange(-0.02, 0.02),
        shape: random(DEBRIS_SHAPES),
      });
    }
  }

  const foregroundSparks = findLayer('foreground_sparks');
  if (foregroundSparks) {
    for (let i = 0; i < FOREGROUND_SPARK_COUNT; i++) {
      foregroundSparks.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(2, 4),
        alpha: randomRange(150 / 255, 1),
        flickerSpeed: randomRange(0.05, 0.15),
      });
    }
  }
}

// ─── ParallaxLayerRenderers ───────────────────────────────────────────────────

export function drawDistantStarsLayer(stars, p, beatClock = null) {
  const beatBoost = beatClock ? beatClock.getBeatIntensity(10) * 80 : 0;
  const beatPulse = beatClock ? beatClock.getBeatIntensity(6) : 0;
  const STAR_BEAT_MULTIPLIER = 10;

  p.noStroke();
  p.drawingContext.shadowBlur = 5 + beatPulse * 10;
  p.drawingContext.shadowColor = '#FFFFFF';
  for (const star of stars) {
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

export function drawNebulaCloudLayer(clouds, p, beatClock = null) {
  const beatPulse = beatClock ? beatClock.getBeatIntensity(6) : 0;

  p.noStroke();
  for (const cloud of clouds) {
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

export function drawMediumStarsLayer(stars, p, beatClock = null) {
  const beatPulse = beatClock ? beatClock.getBeatIntensity(8) : 0;
  const measurePhase = beatClock ? beatClock.getMeasurePhase() : 0;

  p.noStroke();
  let starIndex = 0;
  for (const star of stars) {
    const { alpha, finalSize, combinedBrightness } = computeMediumStarVisual(
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

// ─── NearFieldParallax ────────────────────────────────────────────────────────

export function drawCloseDebrisLayer(debris, p) {
  p.stroke(255, 0, 200, 150); // Hot magenta
  p.strokeWeight(2);
  p.noFill();
  p.drawingContext.shadowBlur = 10;
  p.drawingContext.shadowColor = '#FF00C8';

  for (const piece of debris) {
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

export function drawForegroundSparksLayer(sparks, p) {
  p.noFill();
  p.strokeWeight(2);
  p.drawingContext.shadowBlur = 15;
  p.drawingContext.shadowColor = '#00F3FF';
  for (const spark of sparks) {
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
