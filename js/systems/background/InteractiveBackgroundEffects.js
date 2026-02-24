import { drawBeatPulseOverlay } from './BeatPulseOverlay.js';

export function drawInteractiveBackgroundEffectsLayer(
  p,
  player,
  gameState,
  beatClock,
  randomRangeFn
) {
  drawBeatPulseOverlay(p, beatClock);

  if (player && player.isMoving) {
    const rippleIntensity = p.map(player.speed, 0, 5, 0, 1);
    for (let i = 0; i < 3; i++) {
      const rippleRadius = (p.frameCount * 2 + i * 20) % 100;
      const rippleAlpha = p.map(rippleRadius, 0, 100, 30 * rippleIntensity, 0);
      p.stroke(64, 224, 208, rippleAlpha);
      p.strokeWeight(2);
      p.noFill();
      p.ellipse(player.x, player.y, rippleRadius, rippleRadius);
    }
  }

  if (player) {
    const healthPercent = player.health / player.maxHealth;
    if (healthPercent < 0.3) {
      const dangerPulse = p.sin(p.frameCount * 0.2) * 0.5 + 0.5;
      p.fill(255, 0, 0, dangerPulse * 15 * (1 - healthPercent));
      p.noStroke();
      p.rect(0, 0, p.width, p.height);
    } else if (healthPercent > 0.9) {
      p.fill(0, 150, 255, 8);
      p.noStroke();
      p.rect(0, 0, p.width, p.height);
    }
  }

  if (gameState && gameState.score > 0) {
    const energyLevel = p.min(gameState.score / 1000, 1);
    for (let i = 0; i < 5; i++) {
      const energyX = randomRangeFn(p.width);
      const energyY = randomRangeFn(p.height);
      const energySize = randomRangeFn(10, 30) * energyLevel;
      const energyAlpha = randomRangeFn(5, 15) * energyLevel;
      p.fill(255, 215, 0, energyAlpha);
      p.noStroke();
      p.ellipse(energyX, energyY, energySize, energySize);
    }
  }

  if (gameState && gameState.killStreak >= 5) {
    const streakIntensity = p.min(gameState.killStreak / 10, 1);
    const borderPulse = p.sin(p.frameCount * 0.3) * 0.5 + 0.5;
    p.stroke(255, 100, 255, borderPulse * 100 * streakIntensity);
    p.strokeWeight(4);
    p.noFill();
    p.rect(5, 5, p.width - 10, p.height - 10);

    for (let i = 0; i < gameState.killStreak && i < 15; i++) {
      const orbX = 50 + (i % 5) * 40;
      const orbY = 50 + p.floor(i / 5) * 30;
      const orbPulse = p.sin(p.frameCount * 0.1 + i) * 0.5 + 0.5;
      p.fill(255, 100, 255, orbPulse * 150);
      p.noStroke();
      p.ellipse(orbX, orbY, 8 + orbPulse * 4, 8 + orbPulse * 4);
    }
  }
}
