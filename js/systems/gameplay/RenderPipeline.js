export function drawGameplayWorld(context) {
  const {
    p,
    enemies,
    player,
    playerBullets,
    enemyBullets,
    explosionManager,
    floatingText,
    audio,
    cameraSystem,
    visualEffectsManager,
  } = context;

  if (cameraSystem) {
    cameraSystem.applyTransform();
  }

  for (const enemy of enemies ?? []) {
    enemy.draw(p);
  }

  if (player) {
    player.draw(p);
  }

  for (const bullet of playerBullets ?? []) {
    bullet.draw(p);
  }

  for (const bullet of enemyBullets ?? []) {
    bullet.draw(p);
  }

  if (explosionManager) {
    explosionManager.draw(p);
  }

  if (floatingText) {
    floatingText.draw(p);
  }

  if (audio) {
    audio.drawTexts(p);
  }

  if (cameraSystem) {
    cameraSystem.removeTransform();
  }

  // Screen-space effects applied after camera transform is removed
  if (visualEffectsManager) {
    visualEffectsManager.applyScreenEffects(p);
  }
}
