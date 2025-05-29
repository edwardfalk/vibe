import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('chrome-error://chromewebdata/');
  await page.getByRole('button', { name: 'Hämta igen' }).click();
  await page.goto('chrome-error://chromewebdata/');
});