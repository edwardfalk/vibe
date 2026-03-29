import { describe, it, expect } from 'vitest';
import {
  DAMAGE_RESULT,
  normalizeDamageResult,
} from '../../js/shared/DamageResult.js';

describe('DAMAGE_RESULT constants', () => {
  it('has all expected values', () => {
    expect(DAMAGE_RESULT.NONE).toBe('none');
    expect(DAMAGE_RESULT.DAMAGED).toBe('damaged');
    expect(DAMAGE_RESULT.DIED).toBe('died');
    expect(DAMAGE_RESULT.EXPLODING).toBe('exploding');
  });
});

describe('normalizeDamageResult()', () => {
  it('maps true to DIED', () => {
    expect(normalizeDamageResult(true)).toBe('died');
  });

  it('maps false to DAMAGED', () => {
    expect(normalizeDamageResult(false)).toBe('damaged');
  });

  it('maps "exploding" to EXPLODING', () => {
    expect(normalizeDamageResult('exploding')).toBe('exploding');
  });

  it('maps null/undefined to NONE', () => {
    expect(normalizeDamageResult(null)).toBe('none');
    expect(normalizeDamageResult(undefined)).toBe('none');
  });

  it('maps unknown values to NONE', () => {
    expect(normalizeDamageResult(42)).toBe('none');
    expect(normalizeDamageResult('random')).toBe('none');
  });
});
