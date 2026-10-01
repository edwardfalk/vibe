import { describe, it, expect } from 'vitest';
import { statSync } from 'node:fs';

const VENDOR = new URL('../../js/vendor/', import.meta.url);
const size = (path) => statSync(new URL(path, VENDOR)).size;
const BUDGET_BYTES = 3 * 1024 * 1024;

describe('vendored speech engines', () => {
  it('espeak-ng fits the 3 MB budget', () => {
    const bytes =
      size('espeak-ng/espeak-ng.js') + size('espeak-ng/espeak-ng.data');
    expect(bytes).toBeLessThan(BUDGET_BYTES);
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
