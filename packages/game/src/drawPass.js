// drawPass.js - Handles per-frame rendering (no game logic)
// Uses global window.* systems. p is the p5 instance.

/**
 * Draws the current game scene.
 * Must be called after updatePass each frame.
 * @param {import('p5')} p
 */
export function drawPass(p) {
  // Update camera & background
  window.cameraSystem.update(p, window.player.x, window.player.y);
  p.background(0);
  window.backgroundRenderer.draw(p, window.cameraSystem);

  p.push();
  p.translate(window.cameraSystem.x, window.cameraSystem.y);

  // Core objects
  window.player.draw(p);
  for (const enemy of window.enemies) enemy.draw(p);

  // Bullets (player, enemy, misc)
  for (const bullet of [
    ...window.playerBullets,
    ...window.enemyBullets,
    ...window.bullets,
  ]) {
    bullet.draw(p);
  }

  // Visual effects layer
  window.visualEffectsManager.draw(p);
  p.pop();
} 