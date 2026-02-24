export function applyKillFeedback({
  gameState,
  enemy,
  enemyType,
  beatClock,
  floatingText,
  visualEffectsManager,
  cameraSystem,
  getHitStopFrames,
  setHitStopFrames,
}) {
  if (!gameState) return;

  gameState.addKill();

  let points = 10;
  if (gameState.killStreak >= 5) points *= 2;
  if (gameState.killStreak >= 10) points *= 1.5;
  gameState.addScore(points);

  if (floatingText) {
    floatingText.addKill(enemy.x, enemy.y, enemyType, gameState.killStreak);
  }

  const isOnBeat = beatClock && beatClock.isOnBeat();
  const baseStopFrames = isOnBeat ? 5 : 3;
  const streakBonus = gameState.killStreak >= 5 ? 2 : 0;
  const stopFrames = baseStopFrames + streakBonus;
  if (
    typeof getHitStopFrames === 'function' &&
    typeof setHitStopFrames === 'function'
  ) {
    const current = getHitStopFrames();
    setHitStopFrames(Math.max(current, stopFrames));
  }

  if (isOnBeat && visualEffectsManager) {
    const chromaIntensity = gameState.killStreak >= 5 ? 0.8 : 0.5;
    visualEffectsManager.triggerChromaticAberration(
      chromaIntensity,
      stopFrames * 3
    );
    visualEffectsManager.triggerBloom(0.4, stopFrames * 2);
  }

  if (cameraSystem && enemyType !== 'tank') {
    const shakeIntensity = enemyType === 'rusher' ? 12 : 8;
    cameraSystem.addShake(shakeIntensity, 12);
  }
}
