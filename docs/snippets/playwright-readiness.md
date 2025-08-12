---
libraryId: /microsoft/playwright
topic: readiness (dev server, frameCount)
lastVerified: 2025-08-12
status: curated
---

# Playwright – Readiness Gates

- Dev server readiness: wait for HTTP 200 and key DOM.
- Game readiness: wait until `frameCount > 0` inside the sketch.

## Example
```js
await page.goto('http://localhost:5500');
await page.waitForSelector('canvas');
await page.waitForFunction(() => {
  // window.p5Instances[0] if exposed; otherwise expose a readiness flag in app
  return window.frameCount && window.frameCount > 0;
}, { timeout: 5000 });
```
