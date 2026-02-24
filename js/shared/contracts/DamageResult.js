export const DAMAGE_RESULT = {
  NONE: 'none',
  DAMAGED: 'damaged',
  DIED: 'died',
  EXPLODING: 'exploding',
};

/**
 * Normalize legacy enemy takeDamage return values into a stable contract.
 * Legacy return types:
 * - true/false
 * - "exploding"
 */
export function normalizeDamageResult(rawResult) {
  if (rawResult === true) {
    return DAMAGE_RESULT.DIED;
  }

  if (rawResult === 'exploding') {
    return DAMAGE_RESULT.EXPLODING;
  }

  if (rawResult === false) {
    return DAMAGE_RESULT.DAMAGED;
  }

  return DAMAGE_RESULT.NONE;
}

export function isEnemyDeadResult(result) {
  return normalizeDamageResult(result) === DAMAGE_RESULT.DIED;
}
