// CoreUpdate.js – Modular per-frame update pipeline replacing legacy GameLoop.updateGame
// Phase-1: behaviour parity with legacy code but calling extracted systems

import {
  updateBullets,
  updateBombs,
  processBulletCollisions,
  processContactCollisions,
} from './CombatOps.js';
import { updateEnemies } from './EnemyOps.js';

// Normalise p5 deltaTime (ms) → 60 fps baseline factor
const DT60 = 16.6667;

export function coreUpdateGame(p) {
  // Compute time-scaled delta once
  const effectsMgr = window.effectsManager;
  const timeScale = effectsMgr ? effectsMgr.getTimeScale() : 1;
  const dtMs = (p?.deltaTime || DT60) * timeScale;

  const gs = window.gameState;

  // Beat / music / automated test harness
  window.beatClock?.update();
  window.musicManager?.update();
  window.testModeManager?.update();

  // Player & camera
  window.player?.update(dtMs);
  window.cameraSystem?.update?.();

  // Parallax element rotation (close debris, etc.)
  if (window.backgroundRenderer?.updateParallaxElements) {
    window.backgroundRenderer.updateParallaxElements(dtMs / DT60);
  }

  // Shooting input → bullet spawn
  if (window.playerIsShooting && window.player) {
    const b = window.player.shoot();
    if (b) {
      gs.playerBullets.push(b);
      window.gameState?.addShotFired();
      window.audio?.playPlayerShoot(window.player.x, window.player.y);
    }
  }

  // Bullets & bombs (BulletSystem already uses GameState arrays)
  updateBullets();
  processBulletCollisions();
  updateBombs();

  // Enemies (AI, bullets, explosions) – pass GameState arrays explicitly
  updateEnemies(
    p,
    gs.enemies,
    window.player,
    gs.playerBullets,
    gs.enemyBullets
  );

  // Contact collisions after enemy movement
  processContactCollisions();

  // Cull removed enemies
  gs.enemies = gs.enemies.filter((e) => !e.markedForRemoval);

  // Spawning & managers
  window.spawnSystem?.update();
  window.effectsManager?.update?.(dtMs);
  window.explosionManager?.update?.(dtMs);
  window.visualEffectsManager?.updateParticles?.();
  window.audio?.update();

  // Keep legacy GameLoop local caches in sync while we still draw via legacyDrawGame
  if (typeof window.updateGameLoopLocals === 'function') {
    window.updateGameLoopLocals();
  }
}
