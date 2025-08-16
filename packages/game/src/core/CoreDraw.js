// CoreDraw.js – Modular world drawing pipeline replacing legacy GameLoop.drawGame
// Phase-1: parity with legacy draw but without background / UI (those live in UpdateLoop)

export function coreDrawGame(p) {
  // Cache globals each frame; arrays may be reassigned by restart logic.
  const gs = window.gameState;
  const enemies = gs?.enemies || [];
  const playerBullets = gs?.playerBullets || [];
  const enemyBullets = gs?.enemyBullets || [];
  const explosionManager = window.explosionManager;
  const effectsManager = window.effectsManager;
  const visualEffectsManager = window.visualEffectsManager;
  const audio = window.audio;

  // Camera transform
  window.cameraSystem?.applyTransform();

  // Draw enemies
  for (const e of enemies) e.draw?.(p);

  // Draw player
  window.player?.draw?.(p);

  // Bullets
  for (const b of playerBullets) b.draw?.(p);
  for (const b of enemyBullets) b.draw?.(p);

  // Explosions & particle managers (world-space)
  explosionManager?.draw?.(p);
  effectsManager?.drawParticles?.(p);
  visualEffectsManager?.drawParticles?.(p);

  // Speech bubbles / overhead texts (world-space)
  audio?.drawTexts?.(p);

  // Remove camera transform
  window.cameraSystem?.removeTransform();

  // Screen-space effects (after camera reset)
  effectsManager?.drawScreenEffects?.(p);
  visualEffectsManager?.applyScreenEffects?.(p);
}
