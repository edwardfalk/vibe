// ai-liveness-probe.js
// Probe: Liveness and Entity Presence with Automated Bug Reporting

export default (async function () {
  const { random } = await import('@vibe/core/mathUtils.js');
  // Import ticketManager API if available (assume browser context with ES modules)
  let ticketManager = null;
  try {
    ticketManager = await import(
      new URL('../githubIssueManager.js', import.meta.url).href
    );
  } catch (e) {
    // Not available in all contexts
  }

  // Wait until p5 draw loop starts to avoid race on very first frames
  function currentFrameCount() {
    const p5fc =
      window.p5 && window.p5.instance && window.p5.instance.frameCount;
    if (typeof p5fc === 'number') return p5fc;
    const pInst = window.player && window.player.p;
    if (pInst && typeof pInst.frameCount === 'number') return pInst.frameCount;
    return null;
  }

  async function waitForDrawStart(timeoutMs = 3000) {
    const start = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
    return new Promise((resolve) => {
      function tick() {
        const now = (typeof performance !== 'undefined' && performance.now)
          ? performance.now()
          : Date.now();
        const fc = currentFrameCount();
        const ok = typeof fc === 'number' && fc > 0;
        if (ok) return resolve(true);
        if (now - start >= timeoutMs) return resolve(false);
        (typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame
          : setTimeout)(tick, 16);
      }
      tick();
    });
  }

  await waitForDrawStart(3500);

  const result = {
    frameCount: currentFrameCount(),
    gameState: window.gameState?.gameState ?? null,
    playerAlive: !!window.player && !window.player?.markedForRemoval,
    enemyCount: Array.isArray(window.enemies)
      ? window.enemies.filter((e) => !e?.markedForRemoval).length
      : 0,
    timestamp: Date.now(),
    failure: null,
  };

  // Liveness check with single retry to tolerate transient reloads
  if (!(typeof result.frameCount === 'number' && result.frameCount > 0)) {
    // retry once after a short wait
    await waitForDrawStart(1000);
    result.frameCount = currentFrameCount();
    if (!(typeof result.frameCount === 'number' && result.frameCount > 0)) {
      result.failure = 'Frame count not available (draw loop may be stopped)';
    }
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
    if (window.mcp?.screenshot) {
      screenshotData = await window.mcp.screenshot(
        'failure-' + result.failure.replace(/\s+/g, '-')
      );
    } else if (document.querySelector('canvas')) {
      screenshotData = document.querySelector('canvas').toDataURL('image/png');
    }
    console.error('Liveness/Entity Probe Failure:', result);
    // Automated bug reporting via GitHub Issues wrapper
    if (ticketManager?.createIssue || ticketManager?.createTicket) {
      try {
        const shortId = random().toString(36).slice(2, 8);
        const title = `probe-failure:${shortId}`;
        const body = [
          `Failure: ${result.failure}`,
          '',
          '```json',
          JSON.stringify(result, null, 2),
          '```',
        ].join('\n');
        if (ticketManager.createIssue) {
          await ticketManager.createIssue({
            title,
            body,
            labels: ['bug', 'probe-failure'],
          });
        } else {
          await ticketManager.createTicket({
            title,
            description: body,
            labels: ['bug', 'probe-failure'],
          });
        }
        console.log('🎫 Automated GitHub Issue created for probe failure.');
      } catch (err) {
        console.error(
          'Failed to create automated GitHub Issue for probe failure:',
          err
        );
      }
    }
  }

  return result;
})();
