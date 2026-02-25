import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '*.test.js',
  testIgnore: '**/unit/**',
  timeout: 30000,
  retries: 1,
  workers: 1,
  reporter: 'line',

  use: {
    baseURL: 'http://localhost:5500',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  webServer: {
    command: 'bunx five-server --port=5500',
    port: 5500,
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
