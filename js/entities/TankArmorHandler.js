/**
 * TankArmorHandler - Encapsulates tank armor and anger logic.
 * Extracted from Tank.js for file-size split (~500 line guideline).
 */

import { cos, sin, PI, normalizeAngle, floor, random } from '../mathUtils.js';

const PI_4 = PI / 4;
const THREE_PI_4 = (3 * PI) / 4;

/** Spawn visual effect when an armor plate is destroyed. */
export function spawnArmorBreakEffect(tank, plate) {
  let ox = 0,
    oy = 0;
  if (plate === 'front') {
    ox = cos(tank.aimAngle) * tank.size * 0.6;
    oy = sin(tank.aimAngle) * tank.size * 0.6;
  } else if (plate === 'left') {
    ox = cos(tank.aimAngle - PI / 2) * tank.size * 0.6;
    oy = sin(tank.aimAngle - PI / 2) * tank.size * 0.6;
  } else if (plate === 'right') {
    ox = cos(tank.aimAngle + PI / 2) * tank.size * 0.6;
    oy = sin(tank.aimAngle + PI / 2) * tank.size * 0.6;
  }

  const explosionManager = tank.getContextValue('explosionManager');
  const floatingText = tank.getContextValue('floatingText');
  const cameraSystem = tank.getContextValue('cameraSystem');
  if (explosionManager) {
    explosionManager.addExplosion(tank.x + ox, tank.y + oy, 'armor-break');
  }
  if (floatingText) {
    floatingText.addText(
      tank.x + ox,
      tank.y + oy - 15,
      'ARMOR BREAK!',
      [150, 150, 200],
      12
    );
  }
  if (cameraSystem) {
    cameraSystem.addShake(12, 15);
  }
}

/** Track anger when hit by non-player damage. */
export function handleAngerForDamage(tank, damageSource, amount) {
  if (!damageSource || damageSource === 'player') return;
  const currentCount = tank.damageTracker.get(damageSource) || 0;
  tank.damageTracker.set(damageSource, currentCount + 1);
  if (currentCount + 1 >= tank.angerThreshold && !tank.isAngry) {
    tank.isAngry = true;
    tank.angerTarget = damageSource;
    tank.angerCooldown = tank.maxAngerCooldown;
    const audioAnger = tank.getContextValue('audio');
    if (audioAnger) {
      const angerLines = [
        'ENOUGH! YOU DIE FIRST!',
        'TARGETING TRAITORS!',
        'FRIENDLY FIRE? NOT ANYMORE!',
        'YOU MADE ME MAD!',
        'TURNING GUNS ON YOU!',
      ];
      audioAnger.speak(
        tank,
        angerLines[floor(random() * angerLines.length)],
        'tank'
      );
    }
  }
}

/**
 * Process armor hit. Mutates tank armor state. Returns { absorbed, overflowAmount, plate }.
 * absorbed=true: armor absorbed all damage. overflowAmount: damage to pass to main body. plate: which plate broke.
 */
export function processArmorHit(tank, amount, bulletAngle, damageSource) {
  const impactAngle = normalizeAngle(bulletAngle - tank.aimAngle + PI);

  if (
    !tank.frontArmorDestroyed &&
    impactAngle >= -PI_4 &&
    impactAngle <= PI_4
  ) {
    tank.frontArmorHP -= amount;
    const audioHit = tank.getContextValue('audio');
    if (audioHit) audioHit.playSound('hit', tank.x, tank.y);
    if (tank.frontArmorHP <= 0) {
      const leftover = -tank.frontArmorHP;
      tank.frontArmorDestroyed = true;
      tank.frontArmorHP = 0;
      console.log('💥 Tank Front Armor Destroyed!');
      if (audioHit) audioHit.playSound('explosion', tank.x, tank.y);
      tank.hitFlash = 8;
      return { absorbed: false, overflowAmount: leftover, plate: 'front' };
    }
    tank.hitFlash = 8;
    return { absorbed: true };
  }

  if (
    !tank.leftArmorDestroyed &&
    impactAngle > PI_4 &&
    impactAngle < THREE_PI_4
  ) {
    tank.leftArmorHP -= amount;
    const audioLeft = tank.getContextValue('audio');
    if (audioLeft) audioLeft.playSound('hit', tank.x, tank.y);
    if (tank.leftArmorHP <= 0) {
      const leftover = -tank.leftArmorHP;
      tank.leftArmorDestroyed = true;
      tank.leftArmorHP = 0;
      console.log('💥 Tank Left Armor Destroyed!');
      if (audioLeft) audioLeft.playSound('explosion', tank.x, tank.y);
      tank.hitFlash = 8;
      return { absorbed: false, overflowAmount: leftover, plate: 'left' };
    }
    tank.hitFlash = 8;
    return { absorbed: true };
  }

  if (
    !tank.rightArmorDestroyed &&
    impactAngle < -PI_4 &&
    impactAngle > -THREE_PI_4
  ) {
    tank.rightArmorHP -= amount;
    const audioRight = tank.getContextValue('audio');
    if (audioRight) audioRight.playSound('hit', tank.x, tank.y);
    if (tank.rightArmorHP <= 0) {
      const leftover = -tank.rightArmorHP;
      tank.rightArmorDestroyed = true;
      tank.rightArmorHP = 0;
      console.log('💥 Tank Right Armor Destroyed!');
      if (audioRight) audioRight.playSound('explosion', tank.x, tank.y);
      tank.hitFlash = 8;
      return { absorbed: false, overflowAmount: leftover, plate: 'right' };
    }
    tank.hitFlash = 8;
    return { absorbed: true };
  }

  return null; // Main body hit
}
