const PERF_SAMPLE_WINDOW_FRAMES = 300;

export function createEmptyFrameMetrics() {
  return {
    playerBulletCandidates: 0,
    playerBulletChecks: 0,
    playerBulletHits: 0,
    enemyBulletCandidates: 0,
    enemyBulletChecks: 0,
    enemyBulletHits: 0,
    enemiesAtFrameStart: 0,
    playerBulletsAtFrameStart: 0,
    enemyBulletsAtFrameStart: 0,
  };
}

export function createEmptyRollingMetrics() {
  return {
    frames: 0,
    totalPlayerBulletCandidates: 0,
    totalPlayerBulletChecks: 0,
    totalPlayerBulletHits: 0,
    totalEnemyBulletCandidates: 0,
    totalEnemyBulletChecks: 0,
    totalEnemyBulletHits: 0,
    peakPlayerBulletCandidatesPerFrame: 0,
    peakEnemyBulletCandidatesPerFrame: 0,
  };
}

export function beginMetricsFrame(snapshot) {
  const frameMetrics = createEmptyFrameMetrics();
  frameMetrics.enemiesAtFrameStart = snapshot.enemiesLength || 0;
  frameMetrics.playerBulletsAtFrameStart = snapshot.playerBulletsLength || 0;
  frameMetrics.enemyBulletsAtFrameStart = snapshot.enemyBulletsLength || 0;
  return frameMetrics;
}

export function finalizeMetricsFrame(rollingMetrics, frameMetrics) {
  rollingMetrics.frames++;
  rollingMetrics.totalPlayerBulletCandidates +=
    frameMetrics.playerBulletCandidates;
  rollingMetrics.totalPlayerBulletChecks += frameMetrics.playerBulletChecks;
  rollingMetrics.totalPlayerBulletHits += frameMetrics.playerBulletHits;
  rollingMetrics.totalEnemyBulletCandidates +=
    frameMetrics.enemyBulletCandidates;
  rollingMetrics.totalEnemyBulletChecks += frameMetrics.enemyBulletChecks;
  rollingMetrics.totalEnemyBulletHits += frameMetrics.enemyBulletHits;
  rollingMetrics.peakPlayerBulletCandidatesPerFrame = Math.max(
    rollingMetrics.peakPlayerBulletCandidatesPerFrame,
    frameMetrics.playerBulletCandidates
  );
  rollingMetrics.peakEnemyBulletCandidatesPerFrame = Math.max(
    rollingMetrics.peakEnemyBulletCandidatesPerFrame,
    frameMetrics.enemyBulletCandidates
  );
}

export function buildPerformanceSnapshot(rollingMetrics, frameMetrics) {
  const frames = Math.max(1, rollingMetrics.frames);
  return {
    frameSampleSize: Math.min(rollingMetrics.frames, PERF_SAMPLE_WINDOW_FRAMES),
    latestFrame: { ...frameMetrics },
    averages: {
      playerBulletCandidatesPerFrame:
        rollingMetrics.totalPlayerBulletCandidates / frames,
      playerBulletChecksPerFrame:
        rollingMetrics.totalPlayerBulletChecks / frames,
      playerBulletHitsPerFrame: rollingMetrics.totalPlayerBulletHits / frames,
      enemyBulletCandidatesPerFrame:
        rollingMetrics.totalEnemyBulletCandidates / frames,
      enemyBulletChecksPerFrame: rollingMetrics.totalEnemyBulletChecks / frames,
      enemyBulletHitsPerFrame: rollingMetrics.totalEnemyBulletHits / frames,
    },
    peaks: {
      playerBulletCandidatesPerFrame:
        rollingMetrics.peakPlayerBulletCandidatesPerFrame,
      enemyBulletCandidatesPerFrame:
        rollingMetrics.peakEnemyBulletCandidatesPerFrame,
    },
  };
}
