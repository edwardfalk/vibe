import { CONFIG } from '../../config.js';

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

  if (
    CONFIG?.GAME_SETTINGS?.DEBUG_COLLISIONS &&
    typeof p.frameCount !== 'undefined' &&
    p.frameCount % 30 === 0
  ) {
    const cam = cameraSystem
      ? { x: cameraSystem.x, y: cameraSystem.y }
      : { x: 0, y: 0 };
    const safeEnemies = enemies ?? [];
    console.log(
      `🎮 [DRAW GAME] camera=(${cam.x},${cam.y}) enemies=${safeEnemies.length}`
    );
  }

  if (visualEffectsManager) {
    visualEffectsManager.applyScreenEffects(p);
  }

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
}
