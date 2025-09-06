import { test, expect } from '@playwright/test';

test('dev menu toggles and progress bar sits on right edge', async ({ page }) => {
  await page.goto('/index.html');

  const menu = page.locator('#spawnInstructions');
  await expect(menu).toBeHidden();                        // hidden before dev mode

  await page.keyboard.press('Shift+Control+Alt+D');       // toggle dev mode
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('1');
  await expect(menu).toContainText('2');
  await expect(menu).toContainText('3');
  await expect(menu).toContainText('4');
  await expect(menu).toContainText('P');   // profiler
  await expect(menu).toContainText('F10'); // audio debug
  await expect(menu).toContainText('I');   // invincibility

  const bar = page.locator('#levelProgressBar');          // adjust ID if needed
  const { x, width } = await bar.boundingBox();
  const viewport = page.viewportSize();
  expect(x + width).toBeGreaterThan(viewport.width * 0.9);
});
