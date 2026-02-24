import { floor, random, randomRange } from '../../mathUtils.js';

const DISTANT_STAR_COUNT = 50;
const NEBULA_CLOUD_COUNT = 8;
const MEDIUM_STAR_COUNT = 30;
const CLOSE_DEBRIS_COUNT = 15;
const FOREGROUND_SPARK_COUNT = 60;

const MEDIUM_STAR_COLORS = ['white', 'blue', 'yellow', 'orange'];
const DEBRIS_SHAPES = ['triangle', 'square', 'diamond'];

export function generateParallaxLayerElements(parallaxLayers, p) {
  const distantStars = parallaxLayers[0];
  for (let i = 0; i < DISTANT_STAR_COUNT; i++) {
    distantStars.elements.push({
      x: randomRange(-p.width, p.width * 2),
      y: randomRange(-p.height, p.height * 2),
      size: randomRange(1, 3),
      brightness: randomRange(0.3, 1),
      twinkleSpeed: randomRange(0.01, 0.03),
    });
  }

  const nebulaClouds = parallaxLayers[1];
  for (let i = 0; i < NEBULA_CLOUD_COUNT; i++) {
    nebulaClouds.elements.push({
      x: randomRange(-p.width, p.width * 2),
      y: randomRange(-p.height, p.height * 2),
      size: randomRange(100, 300),
      color: {
        r: randomRange(40, 80),
        g: randomRange(20, 60),
        b: randomRange(60, 120),
      },
      alpha: randomRange(0.05, 0.15),
      driftSpeed: randomRange(0.1, 0.3),
    });
  }

  const mediumStars = parallaxLayers[2];
  for (let i = 0; i < MEDIUM_STAR_COUNT; i++) {
    mediumStars.elements.push({
      x: randomRange(-p.width, p.width * 2),
      y: randomRange(-p.height, p.height * 2),
      size: randomRange(2, 5),
      brightness: randomRange(0.5, 1),
      color: MEDIUM_STAR_COLORS[floor(random() * MEDIUM_STAR_COLORS.length)],
    });
  }

  const closeDebris = parallaxLayers[3];
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

  const foregroundSparks = parallaxLayers[4];
  for (let i = 0; i < FOREGROUND_SPARK_COUNT; i++) {
    foregroundSparks.elements.push({
      x: randomRange(-p.width, p.width * 2),
      y: randomRange(-p.height, p.height * 2),
      size: randomRange(2, 4),
      alpha: randomRange(150, 255),
      flickerSpeed: randomRange(0.05, 0.15),
    });
  }
}
