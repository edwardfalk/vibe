// EnemyEventBus.js - Lightweight helper to dispatch gameplay events that visual
// effects (and other systems) can observe without tight coupling to entity
// classes.  Uses `window.dispatchEvent(new CustomEvent(...))` under the hood.
//
// NOTE: We intentionally keep this file dependency-free to avoid circular
// imports.  It must run in both browser and test environments.

// 🔄 Standard event names so we don't typo them elsewhere
export const ENEMY_HIT = 'enemyHit';
export const ARMOR_DAMAGED = 'armorDamaged';
export const ARMOR_BROKEN = 'armorBroken';
export const ENEMY_KILLED = 'enemyKilled';

function _dispatch(name, detail) {
  if (typeof window === 'undefined') return; // Safety for headless tests
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (err) {
    console.error('⚠️ EnemyEventBus dispatch failed:', name, err);
  }
}

export const EnemyEventBus = {
  emitEnemyHit(detail) {
    _dispatch(ENEMY_HIT, detail);
  },
  emitArmorDamaged(detail) {
    _dispatch(ARMOR_DAMAGED, detail);
  },
  emitArmorBroken(detail) {
    _dispatch(ARMOR_BROKEN, detail);
  },
  emitEnemyKilled(detail) {
    _dispatch(ENEMY_KILLED, detail);
  },
};

// Convenience default export for ergonomic imports
export default EnemyEventBus; 