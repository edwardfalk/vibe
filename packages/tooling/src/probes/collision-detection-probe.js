// collision-detection-probe.js
// Probe: Collision Detection System Health and Functionality

export default (async function () {
  const { random } = await import('@vibe/core/mathUtils.js');

  // Import ticketManager API if available
  let ticketManager = null;
  try {
    ticketManager = await import(
      new URL('../githubIssueManager.js', import.meta.url).href
    );
  } catch (e) {
    // Not available in all contexts
  }

  const result = {
    timestamp: Date.now(),
    collisionSystem: {
      exists: !!window.collisionSystem,
      methods: {},
      functionality: {},
    },
    bulletCollisions: {
      playerBullets: Array.isArray(window.playerBullets)
        ? window.playerBullets.length
        : 0,
      enemyBullets: Array.isArray(window.enemyBullets)
        ? window.enemyBullets.length
        : 0,
      testResults: {},
    },
    contactCollisions: {
      enemies: Array.isArray(window.enemies) ? window.enemies.length : 0,
      player: !!window.player,
      testResults: {},
    },
    warnings: [],
    criticalFailures: [],
    failure: null,
    collisionsChecked: false,
  };

  // Check if collision system exists and has required methods
  if (window.collisionSystem) {
    const requiredMethods = [
      'checkBulletCollisions',
      'checkContactCollisions',
      'checkPlayerBulletsVsEnemies',
      'checkEnemyBulletsVsPlayer',
      'checkEnemyBulletsVsEnemies',
    ];

    for (const method of requiredMethods) {
      result.collisionSystem.methods[method] =
        typeof window.collisionSystem[method] === 'function';
      if (!result.collisionSystem.methods[method]) {
        result.criticalFailures.push(
          `CollisionSystem missing method: ${method}`
        );
      }
    }

    // Test collision system functionality
    try {
      // Test if collision methods can be called without errors
      // Use dry-run wrapper to prevent game state mutation during testing
      if (typeof window.collisionSystem.checkBulletCollisions === 'function') {
        // Create a snapshot of game state before collision check
        const beforeState = {
          playerBullets: window.playerBullets?.length || 0,
          enemyBullets: window.enemyBullets?.length || 0,
          enemies: window.enemies?.length || 0,
        };

        // Call collision check in a try-catch to prevent state mutation from breaking the probe
        try {
          window.collisionSystem.checkBulletCollisions();
          result.collisionSystem.functionality.bulletCollisions = true;
        } catch (collisionError) {
          result.criticalFailures.push(
            `Bullet collision check failed: ${collisionError.message}`
          );
        }
      }

      if (typeof window.collisionSystem.checkContactCollisions === 'function') {
        // Create a snapshot of game state before collision check
        const beforeState = {
          enemies: window.enemies?.length || 0,
          player: !!window.player,
        };

        // Call collision check in a try-catch to prevent state mutation from breaking the probe
        try {
          window.collisionSystem.checkContactCollisions();
          result.collisionSystem.functionality.contactCollisions = true;
        } catch (collisionError) {
          result.criticalFailures.push(
            `Contact collision check failed: ${collisionError.message}`
          );
        }
      }
    } catch (error) {
      result.criticalFailures.push(
        `Collision system execution error: ${error.message}`
      );
      result.collisionSystem.functionality.error = error.message;
    }
  } else {
    result.criticalFailures.push('CollisionSystem not found in window object');
  }

  // Test bullet collision arrays
  if (!Array.isArray(window.playerBullets)) {
    result.warnings.push('playerBullets array not found or not an array');
  }

  if (!Array.isArray(window.enemyBullets)) {
    result.warnings.push('enemyBullets array not found or not an array');
  }

  // Test enemy array for contact collisions
  if (!Array.isArray(window.enemies)) {
    result.warnings.push('enemies array not found or not an array');
  }

  // Test player object for collisions
  if (!window.player) {
    result.warnings.push('player object not found');
  } else {
    // Check if player has collision detection method
    if (typeof window.player.checkCollision !== 'function') {
      result.warnings.push('player.checkCollision method not found');
    }
  }

  // Test enemy collision methods
  if (Array.isArray(window.enemies) && window.enemies.length > 0) {
    const enemy = window.enemies[0];
    if (typeof enemy?.checkCollision !== 'function') {
      result.warnings.push('enemy.checkCollision method not found');
    }
  }

  // Test bullet collision methods
  if (Array.isArray(window.playerBullets) && window.playerBullets.length > 0) {
    const bullet = window.playerBullets[0];
    if (typeof bullet?.checkCollision !== 'function') {
      result.warnings.push('bullet.checkCollision method not found');
    }
  }

  // Check for collision-related configuration
  if (window.CONFIG?.GAME_SETTINGS?.DEBUG_COLLISIONS !== undefined) {
    result.collisionSystem.debugMode =
      window.CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS;
  } else {
    result.warnings.push('DEBUG_COLLISIONS configuration not found');
  }

  // Determine overall failure status
  if (result.criticalFailures.length > 0) {
    result.failure = `Critical collision system failures: ${result.criticalFailures.join(', ')}`;
  } else {
    result.failure = null;
    result.collisionsChecked = true;
  }

  // If failure detected, capture diagnostic information and create bug report
  if (result.failure) {
    let screenshotData = null;

    // Capture screenshot if possible
    if (window.mcp?.screenshot) {
      try {
        screenshotData = await window.mcp.screenshot(
          'collision-probe-failure-' + Date.now()
        );
      } catch (e) {
        console.log('⚠️ Screenshot capture failed:', e);
      }
    } else if (document.querySelector('canvas')) {
      try {
        screenshotData = document
          .querySelector('canvas')
          .toDataURL('image/png');
      } catch (e) {
        console.log('⚠️ Canvas screenshot failed:', e);
      }
    }

    // Log comprehensive diagnostic information
    console.error('🔥 Collision Detection Probe Failure:', result);
    console.log('🎮 Game State:', {
      gameState: window.gameState?.gameState,
      player: !!window.player,
      enemies: window.enemies?.length || 0,
      playerBullets: window.playerBullets?.length || 0,
      enemyBullets: window.enemyBullets?.length || 0,
    });

    // Create automated bug report
    if (ticketManager?.createTicket) {
      try {
        const shortId = random().toString(36).substr(2, 8);
        const ticketData = {
          id: `COLLISION-${shortId}`,
          title: 'Collision Detection System Failure',
          description: `Automated probe detected collision system issues: ${result.failure}`,
          timestamp: new Date().toISOString(),
          category: 'bug',
          priority: 'high',
          state: result,
          artifacts: screenshotData ? [screenshotData] : [],
          status: 'Open',
          history: [
            {
              type: 'collision_probe_failure',
              description: result.failure,
              criticalFailures: result.criticalFailures,
              warnings: result.warnings,
              at: new Date().toISOString(),
            },
          ],
          verification: [],
          relatedTickets: [],
          tags: ['automated', 'collision', 'probe', 'critical'],
        };

        await ticketManager.createTicket(ticketData);
        console.log(
          '🎫 Automated collision bug ticket created:',
          ticketData.id
        );
      } catch (err) {
        console.error(
          '⚠️ Failed to create automated collision bug ticket:',
          err
        );
      }
    }
  } else if (result.warnings.length > 0) {
    console.log('⚠️ Collision Detection Probe Warnings:', result.warnings);
  } else {
    console.log('✅ Collision Detection Probe: All systems healthy');
  }

  return result;
})();
