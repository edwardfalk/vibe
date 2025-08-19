import { test, expect } from '@playwright/test';

test('progress bar renders near top-right', async ({ page }) => {
  await page.goto('/index.html');
  // ensure canvas is ready
  await page.waitForSelector('canvas');
  const color = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    // sample a pixel inside the background bar near the right edge
    return Array.from(ctx.getImageData(canvas.width - 25, 24, 1, 1).data);
  });
  // Expect a non-black pixel (gray background bar)
  expect(color[0]).toBeGreaterThan(40);
  expect(color[1]).toBeGreaterThan(40);
  expect(color[2]).toBeGreaterThan(40);
});
