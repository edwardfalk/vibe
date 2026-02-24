export function updatePerformanceDiagnostics(context) {
  const {
    frameCount,
    config,
    collisionSystem,
    bulletClass,
    floatingText,
    explosionManager,
  } = context;
  const gameSettings = config?.GAME_SETTINGS || {};
  const perfEnabled = Boolean(gameSettings.PERF_DIAGNOSTICS);
  const interval = Number(gameSettings.PERF_LOG_INTERVAL_FRAMES) || 300;

  if (!perfEnabled || frameCount % interval !== 0) return;

  const collisionStats =
    collisionSystem &&
    typeof collisionSystem.getPerformanceSnapshot === 'function'
      ? collisionSystem.getPerformanceSnapshot()
      : null;
  const bulletPoolStats =
    bulletClass && typeof bulletClass.getPoolStats === 'function'
      ? bulletClass.getPoolStats()
      : null;
  const floatingTextPoolStats =
    floatingText &&
    floatingText.textPool &&
    typeof floatingText.textPool.getStats === 'function'
      ? floatingText.textPool.getStats()
      : null;
  const explosionPoolStats =
    explosionManager && typeof explosionManager.getPoolStats === 'function'
      ? explosionManager.getPoolStats()
      : null;

  window.performanceDiagnostics = {
    frameCount,
    collision: collisionStats,
    pools: {
      bullets: bulletPoolStats,
      floatingText: floatingTextPoolStats,
      explosions: explosionPoolStats,
    },
  };

  console.log('🎮 PerfDiagnostics', {
    frameCount,
    collisionAverages: collisionStats?.averages,
    bulletPool: bulletPoolStats
      ? {
          inUse: bulletPoolStats.inUse,
          peakInUse: bulletPoolStats.peakInUse,
          poolSize: bulletPoolStats.poolSize,
          peakPoolSize: bulletPoolStats.peakPoolSize,
          created: bulletPoolStats.created,
          reused: bulletPoolStats.reused,
        }
      : null,
    floatingTextPool: floatingTextPoolStats
      ? {
          inUse: floatingTextPoolStats.inUse,
          peakInUse: floatingTextPoolStats.peakInUse,
          poolSize: floatingTextPoolStats.poolSize,
          peakPoolSize: floatingTextPoolStats.peakPoolSize,
        }
      : null,
    explosionPools: explosionPoolStats
      ? {
          fragmentPoolSize: explosionPoolStats.fragmentPoolSize,
          peakFragmentPoolSize: explosionPoolStats.peakFragmentPoolSize,
          centralPoolSize: explosionPoolStats.centralPoolSize,
          peakCentralPoolSize: explosionPoolStats.peakCentralPoolSize,
        }
      : null,
  });
}
