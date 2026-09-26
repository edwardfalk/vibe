import { describe, it, expect } from 'vitest';
import { DAMAGE_RESULT } from '../../js/shared/DamageResult.js';

describe('DAMAGE_RESULT constants', () => {
  it('has all expected values', () => {
    expect(DAMAGE_RESULT.NONE).toBe('none');
    expect(DAMAGE_RESULT.DAMAGED).toBe('damaged');
    expect(DAMAGE_RESULT.DIED).toBe('died');
    expect(DAMAGE_RESULT.EXPLODING).toBe('exploding');
  });
});
