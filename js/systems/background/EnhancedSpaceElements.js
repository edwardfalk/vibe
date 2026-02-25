import { drawAuroraWispsLayer } from './AuroraWisps.js';

const SPARKLE_COLORS = [
  [0, 243, 255], // Cyan
  [255, 0, 200], // Magenta
  [255, 255, 255], // White
];

let cachedGalaxy = null;
let cachedStream = null;

export function initEnhancedCaches(p) {
  if (!cachedGalaxy) {
    const maxSize = 75;
    const canvasSize = maxSize * 2;
    cachedGalaxy = p.createGraphics(canvasSize, canvasSize);
    cachedGalaxy.translate(canvasSize / 2, canvasSize / 2);
    cachedGalaxy.noStroke();

    for (let arm = 0; arm < 3; arm++) {
      cachedGalaxy.push();
      cachedGalaxy.rotate((arm * p.TWO_PI) / 3);

      for (let r = 0; r < maxSize; r += 3) {
        const armAngle = r * 0.1;
        const armX = p.cos(armAngle) * r;
        const armY = p.sin(armAngle) * r;
        const armAlpha = p.map(r, 0, maxSize, 20, 2);

        cachedGalaxy.fill(200, 150, 255, armAlpha);
        cachedGalaxy.ellipse(armX, armY, 3, 1);
      }
      cachedGalaxy.pop();
    }

    cachedGalaxy.fill(255, 200, 255, 40);
    cachedGalaxy.ellipse(0, 0, maxSize * 0.3, maxSize * 0.3);
  }

  if (!cachedStream) {
    const streamLen = 80;
    const streamWidth = 50;
    cachedStream = p.createGraphics(streamLen * 2, streamWidth * 2);
    cachedStream.translate(streamLen, streamWidth);
    cachedStream.noStroke();

    for (let j = 0; j < 5; j++) {
      const segmentX = j * 15 - 30; // centered roughly
      const segmentAlpha = 12 - j * 2;
      const baseSize = 80;
      cachedStream.fill(64 + j * 10, 224 - j * 5, 208 + j * 8, segmentAlpha);
      cachedStream.ellipse(
        segmentX,
        0,
        baseSize - j * 10,
        (baseSize - j * 10) * 0.6
      );
    }
  }
}

export function resetEnhancedSpaceElementsCache() {
  if (cachedGalaxy) {
    cachedGalaxy.remove();
    cachedGalaxy = null;
  }
  if (cachedStream) {
    cachedStream.remove();
    cachedStream = null;
  }
}

export function drawFlowingNebulaStreamsLayer(streams, p) {
  initEnhancedCaches(p);
  p.imageMode(p.CENTER);
  for (let i = 0; i < streams.length; i++) {
    const stream = streams[i];
    // Scale modulations
    const scaleMod = 1 + p.sin(p.frameCount * 0.008 + stream.phase) * 0.3;
    const flowOffset = p.sin(p.frameCount * 0.01 + stream.phase * 0.5) * 20;

    p.push();
    p.translate(stream.x + flowOffset, stream.y);
    p.scale(scaleMod);
    p.image(cachedStream, 0, 0);
    p.pop();
  }
}

export function drawShootingStarsLayer(stars, p) {
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    const starLife = (p.frameCount + star.phaseOffset) % 600;
    if (starLife >= 120) continue;

    const progress = starLife / 120;
    const endX = star.startX + star.endXOffset;
    const endY = star.startY + star.endYOffset;

    const starX = p.lerp(star.startX, endX, progress);
    const starY = p.lerp(star.startY, endY, progress);

    p.stroke(255, 215, 0, 150 * (1 - progress));
    p.strokeWeight(3);
    p.line(starX, starY, starX - 30, starY + 15);

    p.fill(255, 255, 255, 200 * (1 - progress));
    p.noStroke();
    p.ellipse(starX, starY, 4, 4);

    for (let j = 1; j <= 5; j++) {
      const trailX = starX - j * 8;
      const trailY = starY + j * 4;
      const trailAlpha = (150 * (1 - progress)) / j;
      p.fill(255, 215 - j * 20, 0, trailAlpha);
      p.ellipse(trailX, trailY, 3 - j * 0.4, 3 - j * 0.4);
    }
  }
}

export function drawEnhancedSparklesLayer(sparkles, p) {
  for (let i = 0; i < sparkles.length; i++) {
    const sparkle = sparkles[i];
    const twinkle = p.sin(p.frameCount * 0.02 + sparkle.phase * 2) * 0.5 + 0.5;
    const colorPhase = p.frameCount * 0.008 + sparkle.phase;

    const colorIndex = p.floor(colorPhase) % SPARKLE_COLORS.length;
    const currentColor = SPARKLE_COLORS[colorIndex];
    const alpha = 30 + twinkle * 40;

    p.drawingContext.shadowBlur = twinkle > 0.7 ? 15 : 5;
    p.drawingContext.shadowColor = `rgba(${currentColor[0]}, ${currentColor[1]}, ${currentColor[2]}, ${alpha / 255})`;

    p.fill(currentColor[0], currentColor[1], currentColor[2], alpha);
    p.noStroke();
    p.ellipse(sparkle.x, sparkle.y, 2 + twinkle, 2 + twinkle);
  }
  p.drawingContext.shadowBlur = 0;
}

export function drawDistantGalaxiesLayer(galaxies, p) {
  initEnhancedCaches(p);
  p.imageMode(p.CENTER);
  for (let i = 0; i < galaxies.length; i++) {
    const galaxy = galaxies[i];
    const rotation = p.frameCount * 0.002 + galaxy.phase;

    // Scale ranges roughly from 45/75 to 75/75 (0.6 to 1.0)
    const scaleMod =
      (60 + p.sin(p.frameCount * 0.005 + galaxy.phase) * 15) / 75;

    p.push();
    p.translate(galaxy.x, galaxy.y);
    p.rotate(rotation);
    p.scale(scaleMod);
    p.image(cachedGalaxy, 0, 0);
    p.pop();
  }
}

export { drawAuroraWispsLayer };
