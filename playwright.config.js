import { defineConfig } from '@playwright/test';

// Playwright configuration for Vibe
// - Launches Five Server via `bun run serve` on port 5500 (reuse if already running)
// - Sets baseURL so page.goto('/') works in tests (must be origin, not an HTML file)
// - Stores HTML report in /playwright-report (default)
// - Keeps timeouts modest for local runs; adjust for CI if needed

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5500',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      env: { ELECTRON_RUN_AS_NODE: undefined },
      headless: true,
      slowMo: 100, // Add a small delay to make actions visible
    },
  },
  webServer: {
    // Launch our Express static server on port 5500 from repo root
    command: 'bun run serve',
    port: 5500,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      NODE_ENV: 'test',
      ELECTRON_RUN_AS_NODE: undefined,
    },
  },
});
