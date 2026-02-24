import { round, sqrt, atan2, cos, sin } from '../../mathUtils.js';
import { CONFIG } from '../../config.js';
import { tryPlaceTankBomb } from '../BombSystem.js';

function logDebug(message) {
  if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
    console.log(message);
  }
}

export function handleContactCollisions({
  player,
  enemies,
  audio,
  gameState,
  activeBombs,
}) {
  if (!player || !enemies) return false;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (!enemy.checkCollision(player)) continue;

    let damage = 0;
    let shouldPlaceBomb = false;

    switch (enemy.type) {
      case 'grunt':
        damage = 1;
        break;
      case 'tank':
        shouldPlaceBomb = true;
        break;
      case 'rusher':
      case 'stabber':
        break;
    }

    if (damage > 0) {
      logDebug(`💥 ${enemy.type} contact damage! Damage: ${damage}`);
      audio?.playPlayerHit?.();
      gameState?.resetKillStreak?.();
    }

    if (player.takeDamage(damage, `${enemy.type}-contact`)) {
      gameState?.setGameState?.('gameOver');
      logDebug(`💀 PLAYER DIED from ${enemy.type} contact!`);
      return true;
    }

    if (!shouldPlaceBomb || !activeBombs) continue;
    logDebug('💣 Tank contact - placing time bomb!');
    tryPlaceTankBomb(activeBombs, enemy);
    logDebug(
      `💣 Tank placed time bomb at (${round(enemy.x)}, ${round(enemy.y)})`
    );
  }

  return false;
}

export function handleStabberAttackCollision({
  attack,
  stabber,
  player,
  audio,
  gameState,
  cameraSystem,
  explosionManager,
}) {
  if (!player) return;

  logDebug('🗡️ Stabber executing deadly stab attack!');
  const distance = sqrt(
    (player.x - stabber.x) ** 2 + (player.y - stabber.y) ** 2
  );

  if (distance > attack.range + 10) {
    logDebug(
      `🗡️ Stabber attack missed! Player distance: ${distance.toFixed(1)}, range: ${attack.range}`
    );
    return;
  }

  logDebug(
    `⚔️ STABBER HIT! Player took ${attack.damage} damage from stab attack`
  );
  audio?.playPlayerHit?.();
  audio?.playStabberAttack?.(stabber.x, stabber.y);
  gameState?.resetKillStreak?.();

  if (player.takeDamage(attack.damage, 'stabber-legacy')) {
    gameState?.setGameState?.('gameOver');
    logDebug('💀 PLAYER KILLED BY STABBER ATTACK!');
    return;
  }

  const knockbackAngle = atan2(player.y - stabber.y, player.x - stabber.x);
  const knockbackForce = 8;
  player.velocity.x += cos(knockbackAngle) * knockbackForce;
  player.velocity.y += sin(knockbackAngle) * knockbackForce;

  cameraSystem?.addShake?.(10, 20);
  explosionManager?.addExplosion?.(player.x, player.y, 'hit');
}

export function handleRusherExplosionCollision({
  explosion,
  rusherIndex,
  player,
  audio,
  gameState,
  cameraSystem,
  explosionManager,
  enemies,
}) {
  if (!player) return;

  const distance = sqrt(
    (player.x - explosion.x) ** 2 + (player.y - explosion.y) ** 2
  );
  if (distance > explosion.radius) return;

  logDebug(
    `💥 RUSHER EXPLOSION HIT PLAYER! Distance: ${distance.toFixed(1)}, Radius: ${explosion.radius}`
  );

  audio?.playPlayerHit?.();
  audio?.playRusherExplosion?.(explosion.x, explosion.y);
  gameState?.resetKillStreak?.();

  if (player.takeDamage(explosion.damage, 'rusher-explosion')) {
    gameState?.setGameState?.('gameOver');
    console.log('💀 PLAYER KILLED BY RUSHER EXPLOSION!');
    return;
  }

  const knockbackAngle = atan2(player.y - explosion.y, player.x - explosion.x);
  const knockbackForce = 12;
  player.velocity.x += cos(knockbackAngle) * knockbackForce;
  player.velocity.y += sin(knockbackAngle) * knockbackForce;

  cameraSystem?.addShake?.(15, 25);
  explosionManager?.addExplosion?.(player.x, player.y, 'hit');

  if (enemies && rusherIndex >= 0 && rusherIndex < enemies.length) {
    enemies[rusherIndex].markedForRemoval = true;
  }
}
