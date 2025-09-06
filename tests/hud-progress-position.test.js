import { test, expect } from '@playwright/test';

test('level progress bar sits on the right side', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Shift+Control+Alt+D'); // show dev HUD, if needed
  const bar = page.locator('#levelProgressBar');    // use actual element ID
  const box = await bar.boundingBox();
  expect(box.x).toBeGreaterThan(0.6 * page.viewportSize().width);
});
