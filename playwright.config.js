import { defineConfig } from '@playwright/test';

// PORT=5502 pnpm run test:e2e keeps clear of a dev server on 5500
const PORT = process.env.PORT || 5500;

const TOOL = { retries: 0, use: { trace: 'off', screenshot: 'off' } };

// One config, five projects: the E2E suite (CI) and four dev tools.
// Always pick one with --project; package.json scripts do.
// Chromium on the machine's real GPU, so the sky runs its shader as players
// see it (headless Chromium otherwise renders WebGL on the CPU)
const GPU_ARGS = ['--enable-gpu', '--use-angle=gl', '--ignore-gpu-blocklist'];
const DEMO_SIZE = { width: 800, height: 600 };

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
      // Chromium is dropping its automatic software-WebGL fallback; the sky's
      // link test needs WebGL on CI's GPU-less runners
      use: { launchOptions: { args: ['--enable-unsafe-swiftshader'] } },
    },
    // Dev tools measure the game, so no trace recording: it costs enough CPU
    // to cut the playtest's FPS by about a third
    { name: 'screenshot', testMatch: '**/screenshot.js', ...TOOL },
    {
      name: 'playtest',
      testMatch: '**/playtest.js',
      timeout: 120000,
      ...TOOL,
      use: { ...TOOL.use, launchOptions: { args: GPU_ARGS } },
    },
    { name: 'beats', testMatch: '**/beat-assertions.js', ...TOOL },
    // The README's animation: a video of the bot playing, at the canvas's size
    {
      name: 'demo',
      testMatch: '**/demo.js',
      timeout: 120000,
      ...TOOL,
      use: {
        ...TOOL.use,
        launchOptions: { args: GPU_ARGS },
        viewport: DEMO_SIZE,
        video: { mode: 'on', size: DEMO_SIZE },
      },
    },
  ],

  webServer: {
    // No live reload: it reloaded the page of a running test whenever a file
    // was written under the checkout, e.g. a failed test's files in
    // test-results/. It watches only a path that doesn't exist
    command: `node_modules/.bin/five-server --port=${PORT} --open=false --watch=.no-live-reload`,
    port: Number(PORT),
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
