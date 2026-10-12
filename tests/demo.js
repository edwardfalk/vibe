import { test } from '@playwright/test';
import { aimAtNearestEnemy, bootGame, jumpToLevel } from './helpers/boot.js';

// Records the bot playing, for the README's animation: a video in
// test-results/, DURATION ms from LEVEL on. docs/TESTING.md has the line
// that makes the animation
const DURATION_MS = parseInt(process.env.DURATION) || 40000;
const START_LEVEL = parseInt(process.env.LEVEL) || 5; // every type is in
const AIM_MS = 50;
// The bot circles a tank this far out, a quarter turn ahead of where it is,
// so it never crosses his front (a shove); once behind him it walks into his
// back, which plants a bomb. Behind is past 3/4 of a half turn from his
// facing, as the game judges it (tankSide)
const AROUND_PX = 140;
const BEHIND_RAD = (3 * Math.PI) / 4;
// Keys are held only while the target is further than this on that axis
const DEAD_ZONE_PX = 15;
// With no tank to bomb it circles the world's middle, (0, 0), this fast and
// wide
const CIRCLE_RAD_PER_SEC = 0.6;
const CIRCLE_PX = 220;

test('demo', async ({ page }) => {
  await bootGame(page);
  await jumpToLevel(page, START_LEVEL);
  const box = await page.locator('#defaultCanvas0').boundingBox();
  await page.mouse.down();
  let held = [];
  for (const end = Date.now() + DURATION_MS; Date.now() < end; ) {
    await aimAtNearestEnemy(page, box);
    const keys = await page.evaluate(
      ({ around, behindRad, deadZone, rad, wide }) => {
        const hero = window.player;
        const tank = window.enemies.find(
          (e) =>
            e.type === 'tank' &&
            !e.markedForRemoval &&
            !e.isSpawning &&
            !window.activeBombs.some((b) => b.tankId === e.id)
        );
        let to;
        if (tank) {
          // The hero's angle round the tank from his facing, in (-PI, PI]
          const rel = Math.atan2(hero.y - tank.y, hero.x - tank.x);
          const a = Math.atan2(
            Math.sin(rel - tank.facing),
            Math.cos(rel - tank.facing)
          );
          if (Math.abs(a) >= behindRad) {
            to = tank;
          } else {
            const side = a < 0 ? -1 : 1;
            const ahead =
              tank.facing + side * Math.min(Math.abs(a) + Math.PI / 2, Math.PI);
            to = {
              x: tank.x + around * Math.cos(ahead),
              y: tank.y + around * Math.sin(ahead),
            };
          }
        } else {
          const t = (performance.now() / 1000) * rad;
          to = { x: wide * Math.cos(t), y: wide * Math.sin(t) };
        }
        const dx = to.x - hero.x;
        const dy = to.y - hero.y;
        const keys = [];
        if (Math.abs(dx) > deadZone) keys.push(dx > 0 ? 'd' : 'a');
        if (Math.abs(dy) > deadZone) keys.push(dy > 0 ? 's' : 'w');
        return keys;
      },
      {
        around: AROUND_PX,
        behindRad: BEHIND_RAD,
        deadZone: DEAD_ZONE_PX,
        rad: CIRCLE_RAD_PER_SEC,
        wide: CIRCLE_PX,
      }
    );
    for (const k of held) if (!keys.includes(k)) await page.keyboard.up(k);
    for (const k of keys) if (!held.includes(k)) await page.keyboard.down(k);
    held = keys;
    await page.waitForTimeout(AIM_MS);
  }
  await page.mouse.up();
});
