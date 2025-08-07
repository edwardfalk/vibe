// updatePass.js - Handles the per-frame simulation phase (no rendering)
// Requires p5 instance for deltaTime but performs no drawing.
// Uses global window.* systems as defined by the Vibe architecture.

import EffectsProfiler from '@vibe/fx/EffectsProfiler.js';
import { BulletSystem } from '@vibe/systems';

/**
 * Runs one simulation tick: clock, AI, bullets, collisions, spawns.
 * Must be called once per frame before camera transform & rendering.
 * @param {import('p5')} p – p5 instance for timing helpers
 * @param {number} dtSeconds – elapsed seconds since last frame (optional)
 */
export function updatePass(p, dtSeconds = p.deltaTime / 1000) {
  // --- Core time-based systems -------------------------------------------
  window.beatClock?.update(p);
  window.testMode?.update(p, window.player, window.enemies, dtSeconds);
  window.player?.update(p.deltaTime);

  // --- Enemy AI / bullet spawning ----------------------------------------
  const enemyStart = performance.now();
  for (let i = window.enemies.length - 1; i >= 0; i--) {
    const enemy = window.enemies[i];
    const bullet = enemy.update(window.player.x, window.player.y, p.deltaTime);
    if (bullet) window.enemyBullets.push(bullet);
    if (enemy.health <= 0) {
      window.enemies.splice(i, 1);
    }
  }
  EffectsProfiler.registerEffect('enemy-update', {
    ms: performance.now() - enemyStart,
  });

  // --- Bullets logic & culling -------------------------------------------
  const bulletStart = performance.now();
  BulletSystem.update(); // Player & enemy bullets

  // Neutral/other bullets maintained in window.bullets
  for (let i = window.bullets.length - 1; i >= 0; i--) {
    const bullet = window.bullets[i];
    bullet.update();
    if (!bullet.active) window.bullets.splice(i, 1);
  }
  EffectsProfiler.registerEffect('bullet-update', {
    ms: performance.now() - bulletStart,
  });

  // --- Collision checks ---------------------------------------------------
  const collisionStart = performance.now();
  window.collisionSystem?.checkCollisions(
    window.player,
    window.enemies,
    window.bullets,
    window.playerBullets
  );
  EffectsProfiler.registerEffect('collision-check', {
    ms: performance.now() - collisionStart,
  });

  // --- Spawning & other systems ------------------------------------------
  window.spawnSystem?.update(p, window.player, window.enemies.length);
}
