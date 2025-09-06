import { test, expect } from '@playwright/test';
import { DebugLogger } from '../packages/tooling/src/DebugLogger.js';

process.on('uncaughtException', (err) =>
  DebugLogger.log('Uncaught Exception (test)', err)
);
process.on('unhandledRejection', (err) =>
  DebugLogger.log('Unhandled Rejection (test)', err)
);

// Test to ensure dash leaves trailing silhouettes behind the player
// Enables dev mode, triggers a dash and captures a screenshot for comparison

test('player dash leaves semi-transparent trail', async ({ page }) => {
  try {
    await page.goto('/index.html');
    await page.waitForSelector('canvas');

    // Unlock audio / focus canvas
    await page.click('canvas');

    // Enable developer mode using secret key combo
    await page.keyboard.press('Control+Alt+Shift+D');
    await page.waitForFunction(() => window.uiRenderer?.devMode === true);

    // Trigger a dash via keyboard
    await page.keyboard.press('KeyE');

    // Allow time for dash trail to render
    await page.waitForTimeout(100);

    const canvas = page.locator('canvas');
    const screenshot = await canvas.screenshot();
    expect(screenshot).toMatchSnapshot('player-dash-trail.png');
  } catch (err) {
    DebugLogger.log('Playwright test failed: Player dash trail', err);
    throw err;
  }
});
