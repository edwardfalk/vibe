import { test, expect } from '@playwright/test';
import { DebugLogger } from '../packages/tooling/src/DebugLogger.js';

/**
 * Grunt Shoot-and-Death Probe
 *
 * Purpose: Verify natural ranged combat works in headless tests AND
 * that the player-death → gameOver transition is still functional.
 *
 * Steps
 *  1. Boot game, unlock audio.
 *  2. Force-spawn a grunt 150 px to the right of the player.
 *  3. Wait up to 15 s for the first enemy bullet to hit the player
 *     (assert bullet array growth + health reduction).
 *  4. After first hit, inflict deterministic lethal damage
 *     to finish quickly.
 *  5. Assert gameState transitions to 'gameOver'.
 *
 * The older “deterministic direct-damage” probe stays untouched;
 * use both to cross-check behaviour.
 */

test.describe('Grunt ranged combat', () => {
  test('Grunt fires and player eventually dies -> gameOver', async ({
    page,
  }) => {
    try {
      await page.goto('/index.html');

      // Unlock audio by clicking the canvas
      await page.waitForSelector('canvas');
      await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        canvas &&
          canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      // Wait for needed globals
      await page.waitForFunction(
        () =>
          window.player &&
          window.spawnSystem &&
          Array.isArray(window.gameState?.enemyBullets),
        { timeout: 10000 }
      );

      // Spawn grunt deterministically
      await page.evaluate(() => {
        const p = window.player;
        if (!p) return;
        // ensure p.color exists in playwright environment
        if (p && typeof p.color !== 'function') {
          p.color = () => ({ r: 255, g: 255, b: 255, a: 255 });
        }
        const x = p.x + 150;
        const y = p.y;
        const enemy = window.spawnSystem.enemyFactory.createEnemy(
          x,
          y,
          'grunt',
          p
        );
        window.gameState.enemies.push(enemy);
      });

      // Baseline counts before combat
      const baseline = await page.evaluate(() => ({
        bullets: window.gameState.enemyBullets.length,
        health: window.player.health,
      }));

      // Wait for first bullet impact or timeout (15 s)
      await page.waitForFunction(
        (baseBullets, baseHealth) =>
          window.gameState.enemyBullets.length > baseBullets &&
          window.player.health < baseHealth,
        { timeout: 15000 },
        baseline.bullets,
        baseline.health
      );

      // Capture state after first hit
      const afterHit = await page.evaluate(() => ({
        bullets: window.gameState.enemyBullets.length,
        health: window.player.health,
      }));

      // Finish him: deterministic lethal damage
      await page.evaluate(() => {
        if (window.player && typeof window.player.takeDamage === 'function') {
          window.player.takeDamage(window.player.health + 5, 'probe-finisher');
        }
      });

      // Wait for gameOver max 6 s
      await page.waitForFunction(
        () => window.gameState && window.gameState.gameState === 'gameOver',
        { timeout: 6000 }
      );

      const final = await page.evaluate(() => ({
        health: window.player.health,
        state: window.gameState.gameState,
      }));

      expect(afterHit.bullets).toBeGreaterThan(baseline.bullets);
      expect(afterHit.health).toBeLessThan(baseline.health);
      expect(final.health).toBe(0);
      expect(final.state).toBe('gameOver');
    } catch (err) {
      DebugLogger.log('Playwright test failed: Grunt shoot & death probe', err);
      throw err;
    }
  });
});
