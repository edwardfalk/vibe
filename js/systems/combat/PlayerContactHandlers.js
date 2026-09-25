import { sqrt, atan2, cos, sin } from '../../mathUtils.js';
import { tryPlaceTankBomb } from '../BombSystem.js';

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
      audio?.playPlayerHit?.();
      gameState?.resetKillStreak?.();
      if (player.takeDamage(damage, `${enemy.type}-contact`)) {
        gameState?.setGameState?.('gameOver');
        return true;
      }
    }

    if (!shouldPlaceBomb || !activeBombs) continue;
    tryPlaceTankBomb(activeBombs, enemy);
  }

  return false;
}

export function handleRusherExplosionCollision({
  explosion,
  rusherEnemy,
  player,
  audio,
  gameState,
  cameraSystem,
  explosionManager,
}) {
  if (!player) return;

  const distance = sqrt(
    (player.x - explosion.x) ** 2 + (player.y - explosion.y) ** 2
  );
  if (distance > explosion.radius) return;

  audio?.playPlayerHit?.();
  audio?.playRusherExplosion?.(explosion.x, explosion.y);
  gameState?.resetKillStreak?.();

  if (player.takeDamage(explosion.damage, 'rusher-explosion')) {
    gameState?.setGameState?.('gameOver');
    return;
  }

  const knockbackAngle = atan2(player.y - explosion.y, player.x - explosion.x);
  const knockbackForce = 12;
  player.velocity.x += cos(knockbackAngle) * knockbackForce;
  player.velocity.y += sin(knockbackAngle) * knockbackForce;

  cameraSystem?.addShake?.(15, 25);
  explosionManager?.addExplosion?.(player.x, player.y, 'hit');

  if (rusherEnemy) {
    rusherEnemy.markedForRemoval = true;
  }
}
