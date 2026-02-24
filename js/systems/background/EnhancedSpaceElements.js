import { drawAuroraWisps } from './AuroraWisps.js';

const SPARKLE_COLORS = [
  [255, 215, 0],
  [255, 182, 193],
  [173, 216, 230],
  [221, 160, 221],
  [255, 255, 224],
];

function drawFlowingNebulaStreams(p) {
  p.fill(64, 224, 208, 12);
  p.noStroke();
  for (let i = 0; i < 12; i++) {
    const streamX = ((i * 97 + p.frameCount * 0.15) % (p.width + 150)) - 75;
    const streamY = (i * 143) % p.height;
    const streamSize = 80 + p.sin(p.frameCount * 0.008 + i) * 30;
    const streamFlow = p.sin(p.frameCount * 0.01 + i * 0.5) * 20;

    for (let j = 0; j < 5; j++) {
      const segmentX = streamX + j * 15 + streamFlow;
      const segmentY = streamY + p.sin(p.frameCount * 0.006 + i + j) * 10;
      const segmentAlpha = 12 - j * 2;
      p.fill(64 + j * 10, 224 - j * 5, 208 + j * 8, segmentAlpha);
      p.ellipse(
        segmentX,
        segmentY,
        streamSize - j * 10,
        (streamSize - j * 10) * 0.6
      );
    }
  }
}

function drawShootingStars(p) {
  for (let i = 0; i < 3; i++) {
    const starLife = (p.frameCount + i * 200) % 600;
    if (starLife >= 120) continue;

    const progress = starLife / 120;
    const startX = -50 + i * 300;
    const startY = 50 + i * 150;
    const endX = p.width + 100;
    const endY = p.height - 100 - i * 100;

    const starX = p.lerp(startX, endX, progress);
    const starY = p.lerp(startY, endY, progress);

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

function drawEnhancedSparkles(p) {
  for (let i = 0; i < 20; i++) {
    const sparkleX = (i * 67) % p.width;
    const sparkleY = (i * 103) % p.height;
    const twinkle = p.sin(p.frameCount * 0.02 + i * 2) * 0.5 + 0.5;
    const colorPhase = p.frameCount * 0.008 + i;

    const colorIndex = p.floor(colorPhase) % SPARKLE_COLORS.length;
    const currentColor = SPARKLE_COLORS[colorIndex];
    const alpha = 30 + twinkle * 40;

    p.fill(currentColor[0], currentColor[1], currentColor[2], alpha);
    p.noStroke();
    p.ellipse(sparkleX, sparkleY, 2 + twinkle, 2 + twinkle);

    if (twinkle > 0.7) {
      p.stroke(currentColor[0], currentColor[1], currentColor[2], alpha * 0.8);
      p.strokeWeight(1);
      const sparkleSize = 4 + twinkle * 2;
      p.line(
        sparkleX - sparkleSize,
        sparkleY,
        sparkleX + sparkleSize,
        sparkleY
      );
      p.line(
        sparkleX,
        sparkleY - sparkleSize,
        sparkleX,
        sparkleY + sparkleSize
      );
      p.noStroke();
    }
  }
}

function drawDistantGalaxies(p) {
  for (let i = 0; i < 4; i++) {
    const galaxyX = (i * 200 + 100) % p.width;
    const galaxyY = (i * 150 + 80) % p.height;
    const rotation = p.frameCount * 0.002 + i;
    const galaxySize = 60 + p.sin(p.frameCount * 0.005 + i) * 15;

    p.push();
    p.translate(galaxyX, galaxyY);
    p.rotate(rotation);

    for (let arm = 0; arm < 3; arm++) {
      p.push();
      p.rotate((arm * p.TWO_PI) / 3);

      for (let r = 0; r < galaxySize; r += 3) {
        const armAngle = r * 0.1;
        const armX = p.cos(armAngle) * r;
        const armY = p.sin(armAngle) * r;
        const armAlpha = p.map(r, 0, galaxySize, 20, 2);

        p.fill(200, 150, 255, armAlpha);
        p.ellipse(armX, armY, 3, 1);
      }
      p.pop();
    }

    p.fill(255, 200, 255, 40);
    p.ellipse(0, 0, galaxySize * 0.3, galaxySize * 0.3);
    p.pop();
  }
}

export function drawEnhancedSpaceElementsLayer(p, beatClock = null) {
  drawFlowingNebulaStreams(p);
  drawAuroraWisps(p, beatClock);
  drawShootingStars(p);
  drawEnhancedSparkles(p);
  drawDistantGalaxies(p);
}
