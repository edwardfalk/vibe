import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/screenshot.js',
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:5500',
  },

  webServer: {
    command: 'bunx five-server --port=5500',
    port: 5500,
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
