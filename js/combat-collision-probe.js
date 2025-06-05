// combat-collision-probe.js
// Probe: Combat System and Collision Detection with Automated Bug Reporting

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
    collisionSystem: {},
    bulletSystem: {},
    combatMechanics: {},
    healthSystem: {},
    failure: null,
    warnings: []
  };

  // Check Collision System
  if (window.collisionSystem) {
    result.collisionSystem.exists = true;
    
    // Check for essential collision methods
    const collisionMethods = ['checkCollisions', 'checkBulletEnemyCollisions', 'checkPlayerEnemyCollisions'];
    result.collisionSystem.availableMethods = [];
    
    collisionMethods.forEach(method => {
      if (typeof window.collisionSystem[method] === 'function') {
        result.collisionSystem.availableMethods.push(method);
      }
    });
    
    result.collisionSystem.hasEssentialMethods = result.collisionSystem.availableMethods.length >= 2;
    
    if (!result.collisionSystem.hasEssentialMethods) {
      result.warnings.push('Collision system missing essential methods');
    }
  } else {
    result.failure = 'Collision system not found (window.collisionSystem missing)';
    return result;
  }

  // Check Bullet System
  if (Array.isArray(window.playerBullets)) {
    result.bulletSystem.playerBulletsArray = true;
    result.bulletSystem.playerBulletCount = window.playerBullets.length;
    
    // Check bullet properties if any exist
    if (window.playerBullets.length > 0) {
      const sampleBullet = window.playerBullets[0];
      result.bulletSystem.bulletHasPosition = typeof sampleBullet.x === 'number' && typeof sampleBullet.y === 'number';
      result.bulletSystem.bulletHasVelocity = typeof sampleBullet.vx === 'number' && typeof sampleBullet.vy === 'number';
      result.bulletSystem.bulletHasUpdate = typeof sampleBullet.update === 'function';
      
      if (!result.bulletSystem.bulletHasPosition || !result.bulletSystem.bulletHasVelocity) {
        result.warnings.push('Player bullets missing essential properties');
      }
    }
  } else {
    result.warnings.push('Player bullets array not found or not an array');
  }

  // Check enemy bullets if they exist
  if (Array.isArray(window.enemyBullets)) {
    result.bulletSystem.enemyBulletsArray = true;
    result.bulletSystem.enemyBulletCount = window.enemyBullets.length;
  } else {
    result.bulletSystem.enemyBulletsArray = false;
    // This might be normal if enemies don't shoot
  }

  // Check Combat Mechanics
  if (window.player) {
    result.combatMechanics.playerExists = true;
    result.combatMechanics.playerHealth = window.player.health || null;
    result.combatMechanics.playerMaxHealth = window.player.maxHealth || null;
    result.combatMechanics.playerAlive = !window.player.markedForRemoval;
    
    // Check if player has combat-related methods
    const playerCombatMethods = ['takeDamage', 'shoot', 'die'];
    result.combatMechanics.playerCombatMethods = [];
    
    playerCombatMethods.forEach(method => {
      if (typeof window.player[method] === 'function') {
        result.combatMechanics.playerCombatMethods.push(method);
      }
    });
    
    result.combatMechanics.playerHasCombatMethods = result.combatMechanics.playerCombatMethods.length >= 2;
    
    if (!result.combatMechanics.playerHasCombatMethods) {
      result.warnings.push('Player missing essential combat methods');
    }
  } else {
    result.failure = 'Player not found for combat testing';
    return result;
  }

  // Check Enemy Combat Capabilities
  if (Array.isArray(window.enemies)) {
    const activeEnemies = window.enemies.filter(e => !e.markedForRemoval);
    result.combatMechanics.activeEnemyCount = activeEnemies.length;
    
    if (activeEnemies.length > 0) {
      const sampleEnemy = activeEnemies[0];
      result.combatMechanics.enemyHasHealth = typeof sampleEnemy.health === 'number';
      result.combatMechanics.enemyHasTakeDamage = typeof sampleEnemy.takeDamage === 'function';
      result.combatMechanics.enemyHasDie = typeof sampleEnemy.die === 'function';
      
      // Check if enemies can attack
      const enemyAttackMethods = ['attack', 'shoot', 'updateSpecificBehavior'];
      result.combatMechanics.enemyAttackMethods = [];
      
      enemyAttackMethods.forEach(method => {
        if (typeof sampleEnemy[method] === 'function') {
          result.combatMechanics.enemyAttackMethods.push(method);
        }
      });
      
      result.combatMechanics.enemiesCanAttack = result.combatMechanics.enemyAttackMethods.length > 0;
      
      if (!result.combatMechanics.enemiesCanAttack) {
        result.warnings.push('Enemies appear to lack attack capabilities');
      }
    }
  } else {
    result.warnings.push('Enemies array not found for combat testing');
  }

  // Check Health System Integration
  if (window.gameState) {
    result.healthSystem.gameStateExists = true;
    result.healthSystem.gameState = window.gameState.gameState || null;
    
    // Check if game over conditions work
    if (window.player && window.player.health !== undefined) {
      result.healthSystem.playerHealthTracked = true;
      result.healthSystem.playerCurrentHealth = window.player.health;
      
      // Check if low health triggers appropriate states
      if (window.player.health <= 0 && window.gameState.gameState !== 'gameOver') {
        result.warnings.push('Player has zero health but game is not in game over state');
      }
    }
  }

  // Test collision detection capability (non-destructive)
  if (window.collisionSystem && typeof window.collisionSystem.checkCollisions === 'function') {
    try {
      // Create mock objects for collision testing
      const mockObj1 = { x: 100, y: 100, width: 20, height: 20 };
      const mockObj2 = { x: 110, y: 110, width: 20, height: 20 };
      const mockObj3 = { x: 200, y: 200, width: 20, height: 20 };
      
      // Test overlapping collision
      const shouldCollide = window.collisionSystem.checkCollisions(mockObj1, mockObj2);
      const shouldNotCollide = window.collisionSystem.checkCollisions(mockObj1, mockObj3);
      
      result.collisionSystem.collisionDetectionWorks = shouldCollide === true && shouldNotCollide === false;
      
      if (!result.collisionSystem.collisionDetectionWorks) {
        result.warnings.push('Collision detection may not be working correctly');
      }
    } catch (error) {
      result.collisionSystem.collisionTestError = error.message;
      result.warnings.push(`Collision testing error: ${error.message}`);
    }
  }

  // Check for critical combat failures
  const criticalFailures = [];
  
  if (!window.collisionSystem) {
    criticalFailures.push('Collision system missing');
  } else if (!result.collisionSystem.hasEssentialMethods) {
    criticalFailures.push('Collision system missing essential methods');
  }
  
  if (!window.player) {
    criticalFailures.push('Player missing for combat');
  } else if (!result.combatMechanics.playerHasCombatMethods) {
    criticalFailures.push('Player missing combat methods');
  }
  
  if (!Array.isArray(window.playerBullets)) {
    criticalFailures.push('Player bullet system missing');
  }
  
  if (result.collisionSystem.collisionDetectionWorks === false) {
    criticalFailures.push('Collision detection not functioning');
  }

  if (criticalFailures.length > 0) {
    result.failure = criticalFailures.join('; ');
    
    // Return early after detecting critical failures to reduce noise and wasted work
    console.error('⚔️ Combat Collision Probe Critical Failure:', result.failure);
    return result;
  }

  // If failure, trigger screenshot and automated bug reporting
  if (result.failure) {
    let screenshotData = null;
    if (window.mcp && window.mcp.screenshot) {
      screenshotData = await window.mcp.screenshot('combat-collision-failure-' + Date.now());
    } else if (document.querySelector('canvas')) {
      screenshotData = document.querySelector('canvas').toDataURL('image/png');
    }
    
    console.error('💥 Combat/Collision Probe Failure:', result);
    
    if (ticketManager && ticketManager.createTicket) {
      try {
        const shortId = 'CMB-' + Math.random().toString(36).substr(2, 6);
        const ticketData = {
          id: shortId,
          title: 'combat-collision-failure',
          description: result.failure,
          timestamp: new Date().toISOString(),
          state: result,
          artifacts: screenshotData ? [screenshotData] : [],
          status: 'Open',
          history: [
            {
              type: 'combat_probe_failure',
              description: result.failure,
              at: new Date().toISOString(),
            }
          ],
          verification: [],
          relatedTickets: [],
        };
        await ticketManager.createTicket(ticketData);
        console.log('💥 Automated combat bug ticket created:', shortId);
      } catch (err) {
        console.error('⚠️ Failed to create automated combat bug ticket:', err);
      }
    }
  }

  return result;
})();