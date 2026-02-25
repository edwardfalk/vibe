import { floor, random, randomRange } from '../../mathUtils.js';

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
        color: MEDIUM_STAR_COLORS[floor(random() * MEDIUM_STAR_COLORS.length)],
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
        shape: DEBRIS_SHAPES[floor(random() * DEBRIS_SHAPES.length)],
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
