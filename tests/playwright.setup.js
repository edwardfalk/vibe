// playwright.setup.js
// Extends the base Playwright test runner with custom functionality.
// See: https://playwright.dev/docs/test-advanced#test-fixtures
//
// This setup file does a few things:
// 1. **Custom Fixtures**: It could add custom fixtures if needed (none currently).
// 2. **Console Log Interception**: It intercepts all browser console logs.
//    - It prefixes them with `[BROWSER]` for easy identification.
//    - It filters out noisy, irrelevant logs from Vite and other tools.
// 3. **Exports**: It exports the modified `test` and `expect` objects for use
//    in the actual test files (`*.test.js`).

// Adjust the filter as needed for more/less verbosity.
import { test as base, expect } from '@playwright/test';

base.beforeEach(async ({ page }) => {
  page.on('console', (msg) => {
    const text = msg.text();
    // Filter out noisy logs we don't care about
    if (
      text.includes('react-devtools') ||
      text.includes('[vite]') ||
      text.includes('Vite')
    ) {
      return;
    }
    console.log(`[BROWSER] ${text}`);
  });
});

export { base as test, expect }; 