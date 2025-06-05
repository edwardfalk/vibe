// enemy-ai-probe.js
// Probe: Enemy AI Behavior and Interactions with Automated Bug Reporting

(async function() {
  // Import ticketManager API if available
  let ticketManager = null;
  try {
    ticketManager = await import('./ticketManager.js');
  } catch (e) {
    // Not available in all contexts
  }

  const result = {
    timestamp: Date.now(),
    enemyCount: 0,
    enemyTypes: {},
    aiBehaviors: {},
    pathfinding: {},
    targeting: {},
    failure: null,
    warnings: []
  };

  // Check if enemies exist
  if (!Array.isArray(window.enemies)) {
    result.failure = 'Enemies array not found or not an array';
    return result;
  }

  const activeEnemies = window.enemies.filter(e => !e.markedForRemoval);
  result.enemyCount = activeEnemies.length;

  if (activeEnemies.length === 0) {
    result.failure = 'No active enemies found for AI testing';
    return result;
  }

  // Analyze enemy types and behaviors
  activeEnemies.forEach(enemy => {
    const type = enemy.type || 'unknown';
    result.enemyTypes[type] = (result.enemyTypes[type] || 0) + 1;

    // Check AI behavior properties
    if (enemy.updateSpecificBehavior && typeof enemy.updateSpecificBehavior === 'function') {
      result.aiBehaviors[type] = result.aiBehaviors[type] || {};
      result.aiBehaviors[type].hasUpdateBehavior = true;
      
      // Check for proper deltaTimeMs parameter support
      try {
        const behaviorResult = enemy.updateSpecificBehavior(
          window.player ? window.player.x : 400,
          window.player ? window.player.y : 300,
          16.6667 // Standard deltaTimeMs for 60fps
        );
        result.aiBehaviors[type].behaviorExecutes = true;
        result.aiBehaviors[type].returnValue = typeof behaviorResult;
      } catch (error) {
        result.aiBehaviors[type].behaviorError = error.message;
        result.warnings.push(`${type} AI behavior error: ${error.message}`);
      }
    } else {
      result.warnings.push(`${type} missing updateSpecificBehavior method`);
    }

    // Check targeting behavior
    if (window.player && enemy.x !== undefined && enemy.y !== undefined) {
      const distanceToPlayer = Math.sqrt(
        Math.pow(enemy.x - window.player.x, 2) + 
        Math.pow(enemy.y - window.player.y, 2)
      );
      
      result.targeting[type] = result.targeting[type] || {};
      result.targeting[type].distanceToPlayer = distanceToPlayer;
      result.targeting[type].canTarget = distanceToPlayer < 500; // Reasonable targeting range
      
      // Check if enemy is moving towards player (basic pathfinding check)
      if (enemy.vx !== undefined && enemy.vy !== undefined) {
        const directionToPlayer = {
          x: window.player.x - enemy.x,
          y: window.player.y - enemy.y
        };
        const magnitude = Math.sqrt(directionToPlayer.x * directionToPlayer.x + directionToPlayer.y * directionToPlayer.y);
        
        if (magnitude > 0) {
          const normalizedDirection = {
            x: directionToPlayer.x / magnitude,
            y: directionToPlayer.y / magnitude
          };
          
          // Check if enemy velocity is roughly aligned with player direction
          const velocityMagnitude = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
          if (velocityMagnitude > 0) {
            const normalizedVelocity = {
              x: enemy.vx / velocityMagnitude,
              y: enemy.vy / velocityMagnitude
            };
            
            const alignment = normalizedDirection.x * normalizedVelocity.x + normalizedDirection.y * normalizedVelocity.y;
            result.pathfinding[type] = result.pathfinding[type] || {};
            result.pathfinding[type].playerAlignment = alignment;
            result.pathfinding[type].isMovingTowardPlayer = alignment > 0.5; // 60-degree cone
          }
        }
      }
    }
  });

  // Check for critical AI failures
  const criticalFailures = [];
  
  // All enemies should have some form of AI behavior
  Object.keys(result.enemyTypes).forEach(type => {
    if (!result.aiBehaviors[type] || !result.aiBehaviors[type].hasUpdateBehavior) {
      criticalFailures.push(`${type} enemies lack AI behavior methods`);
    }
    if (result.aiBehaviors[type] && result.aiBehaviors[type].behaviorError) {
      criticalFailures.push(`${type} AI behavior throws errors`);
    }
  });

  // At least some enemies should be targeting the player
  const targetingEnemies = Object.values(result.targeting).filter(t => t.canTarget).length;
  if (targetingEnemies === 0 && window.player) {
    criticalFailures.push('No enemies are within targeting range of player');
  }

  if (criticalFailures.length > 0) {
    result.failure = criticalFailures.join('; ');
    
    // Return early after detecting critical failures to reduce noise and wasted work
    console.error('🤖 Enemy AI Probe Critical Failure:', result.failure);
    return result;
  }

  // If failure, trigger screenshot and automated bug reporting
  if (result.failure) {
    let screenshotData = null;
    if (window.mcp && window.mcp.screenshot) {
      screenshotData = await window.mcp.screenshot('enemy-ai-failure-' + Date.now());
    } else if (document.querySelector('canvas')) {
      screenshotData = document.querySelector('canvas').toDataURL('image/png');
    }
    
    console.error('🤖 Enemy AI Probe Failure:', result);
    
    if (ticketManager && ticketManager.createTicket) {
      try {
        const shortId = 'AI-' + Math.random().toString(36).substr(2, 6);
        const ticketData = {
          id: shortId,
          title: 'enemy-ai-failure',
          description: result.failure,
          timestamp: new Date().toISOString(),
          state: result,
          artifacts: screenshotData ? [screenshotData] : [],
          status: 'Open',
          history: [
            {
              type: 'ai_probe_failure',
              description: result.failure,
              at: new Date().toISOString(),
            }
          ],
          verification: [],
          relatedTickets: [],
        };
        await ticketManager.createTicket(ticketData);
        console.log('🎯 Automated AI bug ticket created:', shortId);
      } catch (err) {
        console.error('⚠️ Failed to create automated AI bug ticket:', err);
      }
    }
  }

  return result;
})(); 