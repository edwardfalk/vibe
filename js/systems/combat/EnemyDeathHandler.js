import { createContextAccessor } from '../../shared/ContextAccessor.js';

const DEATH_SOUND = {
  grunt: 'gruntPop',
  stabber: 'stabberOhNo',
  rusher: 'rusherOhNo',
};

export class EnemyDeathHandler {
  constructor(context = {}) {
    this.context = context;
    this.getContextValue = createContextAccessor(() => this.context);
  }

  handleEnemyDeath(enemy, enemyType, x, y) {
    const explosionManager = this.getContextValue('explosionManager');
    const audio = this.getContextValue('audio');
    const cameraSystem = this.getContextValue('cameraSystem');

    if (!explosionManager || !audio) return;

    explosionManager.addFragmentExplosion(x, y, enemy);
    if (enemyType === 'tank') {
      explosionManager.addPlasmaCloud(x, y);
      if (cameraSystem) {
        cameraSystem.addShake(8, 15);
      }
      audio.playSound('tankOhNo', x, y);
      audio.playSound('explosion', x, y);
    } else {
      audio.playSound(DEATH_SOUND[enemyType] ?? 'enemyOhNo', x, y);
    }

    // Call-and-response: notify nearby same-type enemies
    const enemies = this.getContextValue('enemies');
    if (enemies) {
      let responseCount = 0;
      for (const other of enemies) {
        if (responseCount >= 2) break;
        if (other === enemy || other.markedForRemoval) continue;
        if (other.type === enemyType && other.onNearbyDeath) {
          other.onNearbyDeath(enemy);
          responseCount++;
        }
      }
    }
  }
}
