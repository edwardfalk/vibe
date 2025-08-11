// tests/startup-dev-server-probe.test.js
// Playwright probe: ensure dev server HTML loads without 404/blank.
import { test, expect } from '@playwright/test';
import { INDEX_PAGE } from './playwright.setup.js';

test.describe('Startup Dev Server Probe', () => {
  test('index.html loads and displays UI elements', async ({ page }) => {
    const resp = await page.goto(INDEX_PAGE, {
      waitUntil: 'domcontentloaded',
    });
    expect(resp?.ok()).toBeTruthy();

    // UI elements should exist
    await expect(page.locator('#ui')).toBeVisible();
    await expect(page.locator('#score')).toHaveText(/Score:/);
  });
}); 