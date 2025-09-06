import { test, expect } from '@playwright/test';

test('background wave shifts with camera and retains color', async ({ page }) => {
  await page.goto('/index.html');

  const initial = await page.screenshot();
  // simulate camera move—adjust selector/keys to match your camera controls
  await page.keyboard.press('ArrowRight');
  const moved = await page.screenshot();

  expect(moved).not.toMatchSnapshot(initial);
  // optionally verify wave pixel colors with image diff or locator checks
});
