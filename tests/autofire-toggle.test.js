import { test, expect } from '@playwright/test';

test('R key toggles auto-fire', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForSelector('canvas');
  await page.click('canvas');
  // Initial state: off
  expect(await page.evaluate(() => window.autoFireEnabled)).toBeFalsy();
  // Toggle on
  await page.keyboard.press('KeyR');
  expect(await page.evaluate(() => window.autoFireEnabled)).toBeTruthy();
  expect(await page.evaluate(() => window.playerIsShooting)).toBeTruthy();
  // Toggle off
  await page.keyboard.press('KeyR');
  expect(await page.evaluate(() => window.autoFireEnabled)).toBeFalsy();
  expect(await page.evaluate(() => window.playerIsShooting)).toBeFalsy();
});
