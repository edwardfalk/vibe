// BombSystem.js - Handles ticking tank time bombs and explosions.
// Requires core game globals via window.* as per Vibe standards.
// Math utilities from core package.

import { sqrt, max, floor, atan2, cos, sin } from '@vibe/core/mathUtils.js';

/**
 * BombSystem – static utility for updating active tank bombs every frame.
 * All state is read from the window.* globals that GameLoop sets up:
 *   window.activeBombs – array of bomb objects {x,y,timer,tankId}
 *   window.enemies – live enemy array (to track the owning tank)
 *   window.player – player instance
 *   window.explosionManager – visual FX manager
 *   window.audio – Audio system
 *   window.cameraSystem – camera shake
 *   window.gameState – score & kill-streak bookkeeping
 */
export class BombSystem {
  /**
   * Tick all bombs once per frame. Removes bombs that have exploded.
   */
  static update() {
    const bombs = window.activeBombs;
    if (!bombs || bombs.length === 0) return;

    for (let i = bombs.length - 1; i >= 0; i--) {
      const bomb = bombs[i];
      bomb.timer--;

      // Keep bomb tethered to its tank so we explode at current position.
      const tank = window.enemies?.find((e) => e.id === bomb.tankId);
      if (tank) {
        bomb.x = tank.x;
        bomb.y = tank.y;
      }

      // Countdown speech cue in last 3 seconds.
      const secondsLeft = Math.ceil(bomb.timer / 60);
      if (
        secondsLeft <= 3 &&
        secondsLeft > 0 &&
        bomb.timer % 60 === 0 &&
        window.audio?.speak &&
        tank
      ) {
        window.audio.speak(tank, secondsLeft.toString(), 'player');
        console.log(
          `⏰ TIME BOMB COUNTDOWN: ${secondsLeft} (Tank ID: ${tank.id})`
        );
      }

      if (bomb.timer > 0) continue; // still ticking

      // --- BOMB EXPLODES --------------------------------------------------
      console.log(
        `💥 TANK TIME BOMB EXPLODED at (${bomb.x.toFixed(1)}, ${bomb.y.toFixed(1)})`
      );

      // Visual FX
      window.explosionManager?.addExplosion(bomb.x, bomb.y, 'tank-plasma');
      window.explosionManager?.addRadioactiveDebris(bomb.x, bomb.y);
      window.explosionManager?.addPlasmaCloud(bomb.x, bomb.y);

      // Audio & camera
      window.audio?.playBombExplosion(bomb.x, bomb.y);
      window.cameraSystem?.addShake(20, 40);

      // Damage calculation constants
      const EXPLOSION_RADIUS = 250;
      const radiusSq = EXPLOSION_RADIUS * EXPLOSION_RADIUS;

      // --- Damage player --------------------------------------------------
      if (window.player) {
        const dx = bomb.x - window.player.x;
        const dy = bomb.y - window.player.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < radiusSq) {
          const distance = sqrt(distSq);
          const dmg = max(10, floor(40 * (1 - distance / EXPLOSION_RADIUS)));

          console.log(
            `💥 Player took ${dmg} bomb damage (distance ${distance.toFixed(1)})`
          );
          window.audio?.playPlayerHit();
          window.gameState?.resetKillStreak();

          if (window.player.takeDamage(dmg, 'tank-bomb')) {
            window.gameState?.setGameState('gameOver');
            console.log('💀 PLAYER KILLED BY TANK BOMB!');
          } else {
            // Massive knockback
            const angle = atan2(
              window.player.y - bomb.y,
              window.player.x - bomb.x
            );
            const force = 15;
            window.player.velocity.x += cos(angle) * force;
            window.player.velocity.y += sin(angle) * force;
          }
        }
      }

      // --- Damage enemies (incl. owning tank) ----------------------------
      const enemies = window.enemies || [];
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        const dx = bomb.x - enemy.x;
        const dy = bomb.y - enemy.y;
        const distSq = dx * dx + dy * dy;
        if (distSq >= radiusSq) continue;

        const distance = sqrt(distSq);
        const dmg = max(5, floor(30 * (1 - distance / EXPLOSION_RADIUS)));
        const result = enemy.takeDamage(dmg, null, 'bomb');

        if (result === true) {
          console.log(`💥 ${enemy.type} destroyed by tank bomb`);
          if (window.collisionSystem) {
            window.collisionSystem.handleEnemyDeath(
              enemy,
              enemy.type,
              enemy.x,
              enemy.y
            );
          }
          enemies.splice(j, 1);
          window.gameState?.addKill();
          window.gameState?.addScore(20);
        } else if (result === 'exploding') {
          try {
            window.dispatchEvent(
              new CustomEvent('vfx:enemy-hit', { detail: { x: enemy.x, y: enemy.y, type: enemy.type } })
            );
          } catch (_) {}
          console.log(`💥 Friendly bomb triggered ${enemy.type} explosion`);
        }
      }

      // Finally remove the spent bomb from the list.
      bombs.splice(i, 1);
    }
  }
}
