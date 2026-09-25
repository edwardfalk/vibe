import { defineConfig } from '@playwright/test';

// PORT=5502 pnpm run test:e2e keeps clear of a dev server on 5500
const PORT = process.env.PORT || 5500;

const TOOL = { retries: 0, use: { trace: 'off', screenshot: 'off' } };

// One config, four projects: the E2E suite (CI) and three dev tools.
// Always pick one with --project; package.json scripts do.
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'e2e',
      testMatch: '*.test.js',
      testIgnore: ['**/unit/**', '**/helpers/**'],
    },
    // Dev tools measure the game, so no trace recording: it costs enough CPU
    // to cut the playtest's FPS by about a third
    { name: 'screenshot', testMatch: '**/screenshot.js', ...TOOL },
    {
      name: 'playtest',
      testMatch: '**/playtest.js',
      timeout: 120000,
      ...TOOL,
    },
    { name: 'beats', testMatch: '**/beat-assertions.js', ...TOOL },
  ],

  webServer: {
    command: `node_modules/.bin/five-server --port=${PORT} --open=false`,
    port: Number(PORT),
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
