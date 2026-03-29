import { createContextAccessor } from '../../shared/ContextAccessor.js';

export class EnemyDeathHandler {
  constructor(context = {}) {
    this.context = context;
    this.getContextValue = createContextAccessor(() => this.context);
  }

  setContext(context) {
    this.context = context;
  }

  handleEnemyDeath(enemy, enemyType, x, y) {
    const explosionManager = this.getContextValue('explosionManager');
    const audio = this.getContextValue('audio');
    const cameraSystem = this.getContextValue('cameraSystem');

    if (!explosionManager || !audio) return;

    if (enemyType === 'tank') {
      explosionManager.addFragmentExplosion(x, y, enemy);
      explosionManager.addPlasmaCloud(x, y);
      if (cameraSystem) {
        cameraSystem.addShake(8, 15);
      }
      audio.playTankOhNo(x, y);
      audio.playExplosion(x, y);

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
      return;
    }

    explosionManager.addFragmentExplosion(x, y, enemy);

    if (enemyType === 'grunt') {
      audio.playGruntPop(x, y);
    } else if (enemyType === 'stabber') {
      audio.playStabberOhNo(x, y);
    } else if (enemyType === 'rusher') {
      audio.playRusherOhNo(x, y);
    } else {
      audio.playEnemyOhNo(x, y);
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
