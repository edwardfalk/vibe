import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    // CPU-heavy tests (espeak-ng runs as plain JavaScript in Node, the hero's
    // sprites are measured pixel by pixel) take 1-2 s alone and pass the 5 s
    // default when parallel agents load the laptop
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['js/**/*.js'],
    },
  },
});
