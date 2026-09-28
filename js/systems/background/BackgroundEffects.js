/**
 * BackgroundEffects - screen-space feedback drawn over the sky while playing:
 * a red wash when the hero is badly hurt (a faint blue tint at full health),
 * and the kill-streak border and orbs.
 */

export function drawInteractiveBackgroundEffectsLayer(p, player, gameState) {
  p.push();

  if (player) {
    const health =
      player.maxHealth > 0
        ? Math.max(0, Math.min(1, player.health / player.maxHealth))
        : 0;
    p.noStroke();
    if (health < 0.3) {
      const dangerPulse = p.sin((p.millis() / 1000) * (0.2 * 60)) * 0.5 + 0.5;
      p.fill(255, 0, 0, dangerPulse * 15 * (1 - health));
      p.rect(0, 0, p.width, p.height);
    } else if (health > 0.9) {
      p.fill(0, 150, 255, 8);
      p.rect(0, 0, p.width, p.height);
    }
  }

  if (gameState && gameState.killStreak >= 5) {
    const streakIntensity = p.min(gameState.killStreak / 10, 1);
    const borderPulse = p.sin((p.millis() / 1000) * (0.3 * 60)) * 0.5 + 0.5;
    p.stroke(255, 100, 255, borderPulse * 100 * streakIntensity);
    p.strokeWeight(4);
    p.noFill();
    p.rect(5, 5, p.width - 10, p.height - 10);

    for (let i = 0; i < gameState.killStreak && i < 15; i++) {
      const orbX = 50 + (i % 5) * 40;
      const orbY = 50 + p.floor(i / 5) * 30;
      const orbPulse = p.sin((p.millis() / 1000) * (0.1 * 60) + i) * 0.5 + 0.5;
      p.fill(255, 100, 255, orbPulse * 150);
      p.noStroke();
      p.ellipse(orbX, orbY, 8 + orbPulse * 4, 8 + orbPulse * 4);
    }
  }
  p.pop();
}
