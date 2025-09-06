import { test, expect } from '@playwright/test';

test('serves index.html', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Vibe/i);
});

test('shows initial score', async ({ page }) => {
  await page.goto('/');
  const score = page.locator('#score');
  await expect(score).toHaveText(/Score:\s*0/i);
});
