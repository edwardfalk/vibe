// ai-liveness-probe.js
// Probe: Liveness and Entity Presence with Automated Bug Reporting

(async function () {
  const { random } = await import('./mathUtils.js');
  // Import ticketManager API if available (assume browser context with ES modules)
  let ticketManager = null;
  try {
    ticketManager = await import('./ticketManager.js');
  } catch (e) {
    // Not available in all contexts
  }

  const result = {
    frameCount: typeof frameCount !== 'undefined' ? frameCount : null,
    gameState: window.gameState ? window.gameState.gameState : null,
    playerAlive: !!window.player && !window.player.markedForRemoval,
    enemyCount: Array.isArray(window.enemies)
      ? window.enemies.filter((e) => !e.markedForRemoval).length
      : 0,
    timestamp: Date.now(),
    failure: null,
  };

  // Liveness check
  if (typeof frameCount === 'undefined' || frameCount === null) {
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

  // If failure, trigger screenshot, log state, and file bug report
  if (result.failure) {
    let screenshotData = null;
    if (window.mcp && window.mcp.screenshot) {
      // If MCP API is available, capture screenshot and get base64
      screenshotData = await window.mcp.screenshot(
        'failure-' + result.failure.replace(/\s+/g, '-')
      );
    } else if (document.querySelector('canvas')) {
      // Fallback: capture canvas as base64
      screenshotData = document.querySelector('canvas').toDataURL('image/png');
    }
    // Log state for diagnosis
    console.error('Liveness/Entity Probe Failure:', result);
    // Automated bug reporting via ticketManager API
    if (ticketManager && ticketManager.createTicket) {
      try {
        const shortId = random().toString(36).substr(2, 6);
        const ticketData = {
          id: shortId,
          title: 'probe-failure',
          description: result.failure,
          timestamp: new Date().toISOString(),
          state: result,
          artifacts: screenshotData ? [screenshotData] : [],
          status: 'Open',
          history: [
            {
              type: 'probe_failure',
              description: result.failure,
              at: new Date().toISOString(),
            },
          ],
          verification: [],
          relatedTickets: [],
        };
        await ticketManager.createTicket(ticketData);
        console.log('🎫 Automated bug ticket created for probe failure.');
      } catch (err) {
        console.error('Failed to create automated bug ticket:', err);
      }
    }
  }

  return result;
})();
