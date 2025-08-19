import { test, expect } from '@playwright/test';

test('dev menu shows only in dev mode', async ({ page }) => {
  await page.goto('/index.html');
  // Panel should not exist before enabling dev mode
  await expect(page.locator('#spawnInstructions')).toHaveCount(0);
  await page.waitForSelector('canvas');
  // Click the canvas to ensure key events go to the page
  await page.click('canvas');
  // Activate dev mode
  await page.keyboard.press('Shift+Control+Alt+D');
  const panel = page.locator('#spawnInstructions');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('I: Invincibility');
  await expect(panel).toContainText('R: Toggle autofire');
});
