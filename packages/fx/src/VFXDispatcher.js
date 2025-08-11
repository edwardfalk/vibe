// VFXDispatcher.js - Centralises translation of gameplay events into visual
// and screen effects.  Listens to EnemyEventBus CustomEvents on `window` and
// routes them to VisualEffectsManager (particles) and EffectsManager (screen
// shake / flash).  This keeps entity code decoupled from concrete VFX calls.

// [BUGFIX: see ticket "Legacy explosionManager triggers wrong VFX colors"]
// VFXDispatcher is now a strict delegate to visualEffectsManager, or a stub if not needed.

import {
  ENEMY_HIT,
  ARMOR_DAMAGED,
  ARMOR_BROKEN,
  ENEMY_KILLED,
} from '@vibe/entities';
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

    // Bind event handlers
    this.onEnemyHit = this.onEnemyHit.bind(this);
    this.onArmorDamaged = this.onArmorDamaged.bind(this);
    this.onArmorBroken = this.onArmorBroken.bind(this);
    this.onEnemyKilled = this.onEnemyKilled.bind(this);

    if (typeof window !== 'undefined') {
      window.addEventListener(ENEMY_HIT, this.onEnemyHit);
      window.addEventListener(ARMOR_DAMAGED, this.onArmorDamaged);
      window.addEventListener(ARMOR_BROKEN, this.onArmorBroken);
      window.addEventListener(ENEMY_KILLED, this.onEnemyKilled);
    }
  }

  onEnemyHit(evt) {
    const d = evt.detail;
    const weight = effectsConfig[d.type]?.effectWeight ?? 1;
    if (this.lod.shouldRender('hitSpark')) {
      this.visualFX?.addHitSpark?.(d.x, d.y, weight);
    }
    // NOTE: Knockback is now handled in BaseEnemy.takeDamage() to avoid double-application
    // No additional knockback logic needed here
  }

  onArmorDamaged(evt) {
    const d = evt.detail;
    const damageFrac = 1 - (d.armorRemaining ?? 1);
    this.visualFX?.addCrackOverlay?.(d.x, d.y, damageFrac, d.part);
  }

  onArmorBroken(evt) {
    const d = evt.detail;
    if (this.lod.shouldRender('debris')) {
      this.visualFX?.addDebrisShards?.(d.x, d.y, 12);
    }
    this.screenFX?.addShake?.(6, 15);
    this.screenFX?.addScreenFlash?.([255, 180, 180], 6);
  }

  onEnemyKilled(evt) {
    const d = evt.detail;
    // Add explosion at the enemy's death location
    this.visualFX?.addExplosionParticles?.(d.x, d.y, d.type);
    // Optionally, add screen shake or other effects
    this.screenFX?.addShake?.(8, 20);
  }

  dispose() {
    if (typeof window === 'undefined') return;
    window.removeEventListener(ENEMY_HIT, this.onEnemyHit);
    window.removeEventListener(ARMOR_DAMAGED, this.onArmorDamaged);
    window.removeEventListener(ARMOR_BROKEN, this.onArmorBroken);
    window.removeEventListener(ENEMY_KILLED, this.onEnemyKilled);
  }
}

export default VFXDispatcher;
