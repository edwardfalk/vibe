import { test, expect } from '@playwright/test';

// Verify that the progress bar sits at the top-right and the dev panel
// appears directly beneath it when dev mode is enabled.
test('dev panel aligns under progress bar', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => window.uiRenderer && window.__hudBar);

  const initialSpawn = await page.$('#spawnInstructions');
  expect(initialSpawn).toBeNull();

  await page.evaluate(() => window.uiRenderer.toggleDevMode());
  await page.waitForSelector('#spawnInstructions');

  const style = await page.evaluate(() => {
    const el = document.getElementById('spawnInstructions');
    const c = window.getComputedStyle(el);
    return { top: parseInt(c.top, 10), right: parseInt(c.right, 10) };
  });

  const hudBar = await page.evaluate(() => window.__hudBar);
  expect(style.top).toBe(hudBar.y + hudBar.height + 10);
  expect(style.right).toBe(20);
  expect(hudBar.x + hudBar.width + 20).toBe(hudBar.canvasWidth);
});
