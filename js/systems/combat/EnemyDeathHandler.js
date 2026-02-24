export class EnemyDeathHandler {
  constructor(context = {}) {
    this.context = context;
  }

  setContext(context) {
    this.context = context;
  }

  getContextValue(key) {
    if (typeof this.context.get === 'function') {
      return this.context.get(key);
    }
    return this.context?.[key];
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
  }
}
