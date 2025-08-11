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

  // Layer 1: Deep space background (parallax layers, space elements) - BEFORE camera transform
  window.backgroundRenderer.draw(p, window.cameraSystem);

  // Visual background is owned by BackgroundRenderer. VisualEffectsManager handles particles/screen FX only.

  p.push();
  p.translate(window.cameraSystem.x, window.cameraSystem.y);

  // Layer 3: Game objects (world space, WITH camera transform)
  window.player.draw(p);
  for (const enemy of window.enemies) enemy.draw(p);

  // Layer 4: Bullets (world space, WITH camera transform)
  for (const bullet of [
    ...window.playerBullets,
    ...window.enemyBullets,
    ...window.bullets,
  ]) {
    bullet.draw(p);
  }

  // Layer 5: Visual effects particles (world space, WITH camera transform)
  window.visualEffectsManager.updateParticles();
  window.visualEffectsManager.drawParticles(p);

  p.pop();

  // Layer 6: Screen effects (screen space, NO camera transform)
  window.visualEffectsManager.applyScreenEffects(p);
}
