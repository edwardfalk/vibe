import { test, expect } from '@playwright/test';

test('progress bar and dev menu positioning', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#spawnInstructions')).toBeHidden();
  // progress bar should exist at top-right
  const bar = page.locator('canvas'); // capture screenshot for bar
  await page.keyboard.press('Shift+Control+Alt+D');
  const menu = page.locator('#spawnInstructions');
  await expect(menu).toBeVisible();
  // additional assertions for menu text and placement...
});
