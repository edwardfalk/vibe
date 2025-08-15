// UpdateLoop.js – Extracted per-frame update/draw orchestration
import EffectsProfiler from '@vibe/fx/EffectsProfiler.js';
import AdaptiveLODManager from '@vibe/fx/AdaptiveLODManager.js';
import {
  updateGame as legacyUpdateGame,
  drawGame as legacyDrawGame,
} from '../GameLoop.js';
import {
  updateBullets,
  updateBombs,
  processBulletCollisions,
  processContactCollisions,
} from './CombatOps.js';
import { updateEnemies, handleAreaDamageEvents } from './EnemyOps.js';

export function updateFrame(p) {
  // Maintain frameCount for probes in instance mode
  window.frameCount = p.frameCount;
  legacyUpdateGame(p);
  // Extracted ops executed in core after legacy update body
  updateBullets();
  processBulletCollisions();
  updateBombs();
  processContactCollisions();
  // Enemy updates and area effects
  if (Array.isArray(window.enemies)) {
    updateEnemies(
      p,
      window.enemies,
      window.player,
      window.playerBullets,
      window.enemyBullets
    );
  }
  if (window.explosionManager) {
    const damageEvents = window.explosionManager.update(p.deltaTime);
    if (damageEvents && damageEvents.length > 0) {
      handleAreaDamageEvents(damageEvents, window.enemies || []);
    }
  }
}

export function drawFrame(p) {
  EffectsProfiler.startFrame();
  legacyDrawGame(p);
  EffectsProfiler.endFrame();
  if (window.profilerOverlay) {
    window.profilerOverlay.draw(p);
  }
  AdaptiveLODManager.update();
}
