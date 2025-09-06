import config from '../eslint.config.js';
import { test, expect } from 'vitest';

test('eslint globals include browser audio helpers', () => {
  const globals = config[0].languageOptions.globals;
  expect(globals.URLSearchParams).toBe('readonly');
  expect(globals.AbortController).toBe('readonly');
  expect(globals.getAudioContext).toBe('readonly');
  expect(globals.AudioContext).toBe('readonly');
});
