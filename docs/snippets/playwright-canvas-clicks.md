---
libraryId: /microsoft/playwright
topic: canvas clicks & audio unlock
lastVerified: 2025-08-12
status: curated
---

# Playwright – Canvas Clicks and Audio Unlock

- Prefer coordinate click on the game canvas to unlock audio.
- Wait for canvas to be ready and stable.

## Example
```js
import { test, expect } from '@playwright/test';

test('unlock audio via canvas click', async ({ page }) => {
  await page.goto('http://localhost:5500');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
});
```
