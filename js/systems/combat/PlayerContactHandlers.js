import { sqrt } from '../../mathUtils.js';
import { CONFIG } from '../../config.js';
import { tryPlaceTankBomb } from '../BombSystem.js';

export function handleContactCollisions({
  player,
  enemies,
  audio,
  activeBombs,
}) {
  if (!player || !enemies) return false;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (enemy.markedForRemoval || !enemy.checkCollision(player)) continue;

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

    if (damage > 0 && player.hurt(damage, `${enemy.type}-contact`)) {
      return true;
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
  cameraSystem,
  explosionManager,
}) {
  if (!player) return;

  const distance = sqrt(
    (player.x - explosion.x) ** 2 + (player.y - explosion.y) ** 2
  );
  if (distance > explosion.radius) return;

  audio?.playSound('explosion', explosion.x, explosion.y);

  if (player.hurt(explosion.damage, 'rusher-explosion')) return;

  player.knockBack(
    explosion.x,
    explosion.y,
    CONFIG.PLAYER.KNOCKBACK_RUSHER_BLAST
  );

  cameraSystem?.addShake?.(15, 25);
  explosionManager?.addExplosion?.(player.x, player.y, 'hit');

  if (rusherEnemy) {
    rusherEnemy.markedForRemoval = true;
  }
}
