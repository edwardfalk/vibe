// VFXDispatcher.js - Centralises translation of gameplay events into visual
// and screen effects.  Listens to EnemyEventBus CustomEvents on `window` and
// routes them to VisualEffectsManager (particles) and EffectsManager (screen
// shake / flash).  This keeps entity code decoupled from concrete VFX calls.

// [BUGFIX: see ticket "Legacy explosionManager triggers wrong VFX colors"]
// VFXDispatcher is now a strict delegate to visualEffectsManager, or a stub if not needed.

import { ENEMY_HIT, ARMOR_DAMAGED, ARMOR_BROKEN, ENEMY_KILLED } from '@vibe/entities';
import { effectsConfig } from './effectsConfig.js';

class VFXDispatcher {
  /**
   * @param {object} opts
   * @param {VisualEffectsManager} opts.visualFX
   * @param {EffectsManager} opts.screenFX
   * @param {object} opts.lodManager - module with shouldRender(className) -> bool
   */
  constructor({ visualFX, screenFX, lodManager }) {
    this.visualFX = visualFX;
    this.screenFX = screenFX;
    this.lod = lodManager || { shouldRender: () => true };

    if (typeof window !== 'undefined') {
      window.addEventListener(ENEMY_HIT, this.onEnemyHit);
      window.addEventListener(ARMOR_DAMAGED, this.onArmorDamaged);
      window.addEventListener(ARMOR_BROKEN, this.onArmorBroken);
      window.addEventListener(ENEMY_KILLED, this.onEnemyKilled);
    }
  }

  // Arrow fn to preserve `this`
  onEnemyHit = (evt) => {
    const d = evt.detail;
    const weight = (effectsConfig[d.type]?.effectWeight) ?? 1;
    if (this.lod.shouldRender('hitSpark')) {
      this.visualFX?.addHitSpark?.(d.x, d.y, weight);
    }
    // Knock-back for Grunt and others on bullet hit
    if (d.type === 'grunt' && d.damageSource === 'bullet' && typeof d.bulletAngle === 'number') {
      // Find the grunt instance by id
      const enemy = (window.enemies || []).find(e => e.id === d.id);
      if (enemy && typeof enemy.applyImpulse === 'function') {
        enemy.applyImpulse(d.bulletAngle, 0.8); // 0.8 = moderate knock-back
      }
    }
  };

  onArmorDamaged = (evt) => {
    const d = evt.detail;
    const damageFrac = 1 - (d.armorRemaining ?? 1);
    this.visualFX?.addCrackOverlay?.(d.x, d.y, damageFrac, d.part);
  };

  onArmorBroken = (evt) => {
    const d = evt.detail;
    if (this.lod.shouldRender('debris')) {
      this.visualFX?.addDebrisShards?.(d.x, d.y, 12);
    }
    this.screenFX?.addShake?.(6, 15);
    this.screenFX?.addScreenFlash?.([255, 180, 180], 6);
  };

  onEnemyKilled = (evt) => {
    // placeholder – explosions already happen elsewhere but we might add global flash here later
  };

  dispose() {
    if (typeof window === 'undefined') return;
    window.removeEventListener(ENEMY_HIT, this.onEnemyHit);
    window.removeEventListener(ARMOR_DAMAGED, this.onArmorDamaged);
    window.removeEventListener(ARMOR_BROKEN, this.onArmorBroken);
    window.removeEventListener(ENEMY_KILLED, this.onEnemyKilled);
  }
}

export default VFXDispatcher; 