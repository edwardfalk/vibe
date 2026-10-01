import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

const VENDOR = new URL('../../js/vendor/', import.meta.url);
const size = (path) => statSync(new URL(path, VENDOR)).size;
const BUDGET_BYTES = 3 * 1024 * 1024;
const ROOT = new URL('../../', import.meta.url).pathname;

describe('vendored speech engines', () => {
  it('espeak-ng fits the 3 MB budget', () => {
    const bytes =
      size('espeak-ng/espeak-ng.js') + size('espeak-ng/espeak-ng.data');
    expect(bytes).toBeLessThan(BUDGET_BYTES);
  });

  it('commits every vendored file, so a fresh checkout has the engines', () => {
    // A broad ignore rule (*.min.js) once kept SAM off the branch: it
    // existed on one disk only, and every other checkout had no speech
    for (const file of [
      'espeak-ng/espeak-ng.js',
      'espeak-ng/espeak-ng.data',
      'espeak-ng/COPYING',
      'espeak-ng/SOURCE.md',
      'sam/samjs.esm.min.js',
      'sam/README.md',
    ]) {
      expect(
        () =>
          execFileSync(
            'git',
            ['ls-files', '--error-unmatch', `js/vendor/${file}`],
            {
              cwd: ROOT,
              stdio: 'pipe',
            }
          ),
        file
      ).not.toThrow();
    }
  });

  it('ships the licence and source notes', () => {
    for (const note of [
      'espeak-ng/COPYING',
      'espeak-ng/SOURCE.md',
      'sam/README.md',
      'sam/samjs.esm.min.js',
    ]) {
      expect(size(note)).toBeGreaterThan(100);
    }
  });
});
