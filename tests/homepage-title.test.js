import { test, expect } from '@playwright/test';

// Simple smoke test to confirm the homepage loads and has the expected title
// This ensures the basic HTML entry point is reachable before running heavier probes

test('homepage shows game title', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page).toHaveTitle('Vibe - Geometric Space Shooter');
});
