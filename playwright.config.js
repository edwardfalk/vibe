import { defineConfig } from '@playwright/test';

// One config, four projects: the E2E suite (CI) and three dev tools.
// Always pick one with --project; package.json scripts do.
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:5500',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'e2e',
      testMatch: '*.test.js',
      testIgnore: ['**/unit/**', '**/helpers/**'],
    },
    { name: 'screenshot', testMatch: '**/screenshot.js', retries: 0 },
    {
      name: 'playtest',
      testMatch: '**/playtest.js',
      timeout: 120000,
      retries: 0,
    },
    { name: 'beats', testMatch: '**/beat-assertions.js', retries: 0 },
  ],

  webServer: {
    command: 'node_modules/.bin/five-server --port=5500 --open=false',
    port: 5500,
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
