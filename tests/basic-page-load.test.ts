import { test, expect } from '@playwright/test';

test('index page displays initial score', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#score')).toHaveText('Score: 0');
});
