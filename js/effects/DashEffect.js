import { atan2, random, cos, sin, TWO_PI } from '../mathUtils.js';

export function drawPlayerDashEffect(p, playerSize, dashState) {
  const { isDashing, dashTimerMs, maxDashTimeMs, dashVelocity } = dashState;
  if (!isDashing) return;

  const safeMaxTime =
    maxDashTimeMs && Number.isFinite(maxDashTimeMs) ? maxDashTimeMs : 1;
  const dashProgress = Math.min(1, dashTimerMs / safeMaxTime);
  const dashIntensity = 1 - dashProgress;

  const vx = dashVelocity?.x ?? 0;
  const vy = dashVelocity?.y ?? 0;

  p.fill(100, 200, 255, dashIntensity * 80);
  p.noStroke();
  p.ellipse(0, 0, playerSize * 4 * dashIntensity);

  p.fill(150, 220, 255, dashIntensity * 120);
  p.ellipse(0, 0, playerSize * 2.5 * dashIntensity);

  p.fill(200, 240, 255, dashIntensity * 160);
  p.ellipse(0, 0, playerSize * 1.5 * dashIntensity);

  for (let layer = 0; layer < 3; layer++) {
    p.stroke(255, 255, 255, dashIntensity * (120 - layer * 30));
    p.strokeWeight(3 - layer);
    for (let i = 0; i < 8; i++) {
      const lineLength = playerSize * (1.5 + i * 0.4 + layer * 0.3);
      const lineAngle = atan2(-vy, -vx) + random(-0.3, 0.3);
      const startX = cos(lineAngle) * lineLength * (0.3 + layer * 0.2);
      const startY = sin(lineAngle) * lineLength * (0.3 + layer * 0.2);
      const endX = cos(lineAngle) * lineLength;
      const endY = sin(lineAngle) * lineLength;
      p.line(startX, startY, endX, endY);
    }
  }

  for (let i = 0; i < 12; i++) {
    const particleAngle = (i / 12) * TWO_PI;
    const particleDistance = playerSize * 2 * dashIntensity;
    const particleX = cos(particleAngle) * particleDistance;
    const particleY = sin(particleAngle) * particleDistance;
    p.fill(100 + i * 10, 200, 255, dashIntensity * 100);
    p.noStroke();
    p.ellipse(particleX, particleY, 4 * dashIntensity, 4 * dashIntensity);
  }

  for (let ring = 0; ring < 3; ring++) {
    const ringSize = playerSize * (2 + ring * 0.8) * dashIntensity;
    const ringAlpha = dashIntensity * (60 - ring * 15);
    p.stroke(150, 220, 255, ringAlpha);
    p.strokeWeight(2);
    p.noFill();
    p.ellipse(0, 0, ringSize, ringSize);
  }

  p.noStroke();
}
