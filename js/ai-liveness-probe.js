// ai-liveness-probe.js
// Probe: Liveness and Entity Presence with Automated Bug Reporting

/**
 * Run a browser-side liveness probe and return structured diagnostics.
 */
export async function runAiLivenessProbe() {
  const fc = window.frameCount ?? null;
  const result = {
    frameCount: fc,
    gameState: window.gameState ? window.gameState.gameState : null,
    playerAlive: !!window.player && !window.player.markedForRemoval,
    enemyCount: Array.isArray(window.enemies)
      ? window.enemies.filter((e) => !e.markedForRemoval).length
      : 0,
    timestamp: Date.now(),
    failure: null,
  };

  if (fc === null || fc === undefined) {
    result.failure = 'Frame count not available (draw loop may be stopped)';
  }

  // Player check
  if (!result.playerAlive) {
    result.failure = 'Player missing or marked for removal';
  }

  // Enemy check
  if (result.enemyCount === 0) {
    result.failure = 'No enemies present or all marked for removal';
  }

  // If failure, capture screenshot and log state for debugging.
  if (result.failure) {
    if (window.mcp && window.mcp.screenshot) {
      await window.mcp.screenshot(
        'failure-' + result.failure.replace(/\s+/g, '-')
      );
    }

    console.error('Liveness/Entity Probe Failure:', result);
  }

  return result;
}

export default runAiLivenessProbe;
