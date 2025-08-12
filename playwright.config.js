import { defineConfig, devices } from '@playwright/test';

// Playwright configuration for Vibe
// - Launches Five Server via `bun run serve` on port 5500 (reuse if already running)
// - Sets baseURL so page.goto('/') works in tests
// - Stores HTML report in /playwright-report (default)
// - Keeps timeouts modest for local runs; adjust for CI if needed

export default defineConfig({
  testDir: './tests',
  // Ignore non-Playwright tests (e.g., Vitest unit/integration tests) so Playwright
  // doesn\'t attempt to run them and clash with its own expect implementation.
  testIgnore: ['**/tests/api/**', '**/tests/cli/**'],

  outputDir: './test-results',
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
      slowMo: 0,
    },
  },
  // We orchestrate server start/stop externally via `bun run test:orchestrated`
  // to ensure prechecks (scan:consistency, validate:sounds) and robust port handling.
  // When running Playwright standalone, it can still launch Five Server if desired – leave disabled by default for CI stability.
  // webServer: {
  //   command: 'bunx five-server --port 5500 --root . --no-browser',
  //   port: 5500,
  //   reuseExistingServer: true,
  //   timeout: 120_000,
  //   env: {
  //     NODE_ENV: 'test',
  //     ELECTRON_RUN_AS_NODE: undefined,
  //   },
  // },
});
