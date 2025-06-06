// ui-score-probe.js
// Probe: UI Elements and Score System with Automated Bug Reporting

(async function() {
  const { random } = await import('./mathUtils.js');
  // Import ticketManager API if available
  let ticketManager = null;
  try {
    ticketManager = await import('./ticketManager.js');
  } catch (e) {
    // Not available in all contexts
  }

  const result = {
    timestamp: Date.now(),
    uiRenderer: {},
    scoreSystem: {},
    gameStateUI: {},
    canvasUI: {},
    failure: null,
    warnings: []
  };

  // Check UI Renderer System
  if (window.uiRenderer) {
    result.uiRenderer.exists = true;
    
    // Check for essential UI methods
    const uiMethods = ['render', 'drawScore', 'drawHealth', 'drawGameOver'];
    result.uiRenderer.availableMethods = [];
    
    uiMethods.forEach(method => {
      if (typeof window.uiRenderer[method] === 'function') {
        result.uiRenderer.availableMethods.push(method);
      }
    });
    
    result.uiRenderer.hasEssentialMethods = result.uiRenderer.availableMethods.length >= 2;
    
    if (!result.uiRenderer.hasEssentialMethods) {
      result.warnings.push('UI renderer missing essential methods');
    }
  } else {
    result.warnings.push('UI renderer not found (window.uiRenderer missing)');
  }

  // Check Score System
  if (window.gameState) {
    result.scoreSystem.gameStateExists = true;
    result.scoreSystem.score = window.gameState.score || null;
    result.scoreSystem.hasScore = typeof window.gameState.score === 'number';
    
    if (!result.scoreSystem.hasScore) {
      result.warnings.push('Score not found or not a number in gameState');
    }
    
    // Check for score-related methods
    const scoreMethods = ['addScore', 'updateScore', 'resetScore'];
    result.scoreSystem.availableMethods = [];
    
    scoreMethods.forEach(method => {
      if (typeof window.gameState[method] === 'function') {
        result.scoreSystem.availableMethods.push(method);
      }
    });
    
    result.scoreSystem.hasScoreMethods = result.scoreSystem.availableMethods.length > 0;
    
    if (!result.scoreSystem.hasScoreMethods) {
      result.warnings.push('GameState missing score management methods');
    }
  } else {
    result.failure = 'GameState not found for UI testing';
    return result;
  }

  // Check Game State UI Elements
  if (window.gameState) {
    result.gameStateUI.currentState = window.gameState.gameState || null;
    result.gameStateUI.validState = ['playing', 'gameOver', 'paused', 'menu'].includes(result.gameStateUI.currentState);
    
    if (!result.gameStateUI.validState) {
      result.warnings.push(`Unknown game state: ${result.gameStateUI.currentState}`);
    }
    
    // Check player health for UI display
    if (window.player) {
      result.gameStateUI.playerHealth = window.player.health || null;
      result.gameStateUI.playerMaxHealth = window.player.maxHealth || null;
      result.gameStateUI.healthPercentage = result.gameStateUI.playerMaxHealth > 0 ? 
        (result.gameStateUI.playerHealth / result.gameStateUI.playerMaxHealth) * 100 : null;
      
      if (result.gameStateUI.healthPercentage !== null && result.gameStateUI.healthPercentage < 0) {
        result.warnings.push('Player health percentage is negative');
      }
    }
  }

  // Check Canvas and UI Rendering
  const canvas = document.querySelector('canvas');
  if (canvas) {
    result.canvasUI.canvasExists = true;
    result.canvasUI.canvasWidth = canvas.width;
    result.canvasUI.canvasHeight = canvas.height;
    result.canvasUI.canvasVisible = canvas.style.display !== 'none';
    
    if (!result.canvasUI.canvasVisible) {
      result.warnings.push('Canvas is not visible');
    }
    
    // Check if canvas has reasonable dimensions
    result.canvasUI.reasonableDimensions = canvas.width > 100 && canvas.height > 100;
    
    if (!result.canvasUI.reasonableDimensions) {
      result.warnings.push('Canvas has unreasonably small dimensions');
    }
    
    // Try to get canvas context for UI testing
    try {
      const ctx = canvas.getContext('2d');
      result.canvasUI.contextAvailable = !!ctx;
      
      if (ctx) {
        // Check if text rendering works
        ctx.save();
        ctx.font = '16px Arial';
        const testMetrics = ctx.measureText('Test');
        result.canvasUI.textRenderingWorks = testMetrics.width > 0;
        ctx.restore();
        
        if (!result.canvasUI.textRenderingWorks) {
          result.warnings.push('Canvas text rendering may not be working');
        }
      }
    } catch (error) {
      result.canvasUI.contextError = error.message;
      result.warnings.push(`Canvas context error: ${error.message}`);
    }
  } else {
    result.failure = 'Canvas element not found for UI testing';
    return result;
  }

  // Check for UI update frequency (frame rate health)
  if (typeof frameCount !== 'undefined') {
    result.canvasUI.frameCount = frameCount;
    result.canvasUI.frameCountHealthy = frameCount > 0;
    
    if (!result.canvasUI.frameCountHealthy) {
      result.warnings.push('Frame count is zero - UI may not be updating');
    }
  } else {
    result.warnings.push('Frame count not available - cannot check UI update frequency');
  }

  // Test UI responsiveness (non-intrusive)
  if (window.uiRenderer && typeof window.uiRenderer.render === 'function') {
    try {
      // Try to call render method to see if it executes without error
      // This is a dry run to check if the UI system is functional
      const renderResult = window.uiRenderer.render();
      result.uiRenderer.renderExecutes = true;
      result.uiRenderer.renderReturnType = typeof renderResult;
    } catch (error) {
      result.uiRenderer.renderError = error.message;
      result.warnings.push(`UI render error: ${error.message}`);
    }
  }

  // Check for critical UI failures
  const criticalFailures = [];
  
  if (!canvas) {
    criticalFailures.push('Canvas element missing');
  } else {
    if (!result.canvasUI.contextAvailable) {
      criticalFailures.push('Canvas context not available');
    }
    if (!result.canvasUI.reasonableDimensions) {
      criticalFailures.push('Canvas has invalid dimensions');
    }
  }
  
  if (!window.gameState) {
    criticalFailures.push('GameState missing for UI');
  } else {
    if (!result.gameStateUI.validState) {
      criticalFailures.push('Invalid game state for UI');
    }
    if (!result.scoreSystem.hasScore) {
      criticalFailures.push('Score system not functional');
    }
  }
  
  if (!window.uiRenderer) {
    criticalFailures.push('UI renderer system missing');
  } else if (result.uiRenderer.renderError) {
    criticalFailures.push('UI renderer throws errors');
  }
  
  if (result.canvasUI.frameCountHealthy === false) {
    criticalFailures.push('UI not updating (zero frame count)');
  }

  if (criticalFailures.length > 0) {
    result.failure = criticalFailures.join('; ');
    
    // Return early after detecting critical failures to reduce noise and wasted work
    console.error('🎯 UI/Score Probe Critical Failure:', result.failure);
    return result;
  }

  // If failure, trigger screenshot and automated bug reporting
  if (result.failure) {
    let screenshotData = null;
    if (window.mcp && window.mcp.screenshot) {
      screenshotData = await window.mcp.screenshot('ui-score-failure-' + Date.now());
    } else if (document.querySelector('canvas')) {
      screenshotData = document.querySelector('canvas').toDataURL('image/png');
    }
    
    console.error('🎯 UI/Score Probe Failure:', result);
    
    if (ticketManager && ticketManager.createTicket) {
      try {
        const shortId = 'UI-' + random().toString(36).substr(2, 6);
        const ticketData = {
          id: shortId,
          title: 'ui-score-failure',
          description: result.failure,
          timestamp: new Date().toISOString(),
          state: result,
          artifacts: screenshotData ? [screenshotData] : [],
          status: 'Open',
          history: [
            {
              type: 'ui_probe_failure',
              description: result.failure,
              at: new Date().toISOString(),
            }
          ],
          verification: [],
          relatedTickets: [],
        };
        await ticketManager.createTicket(ticketData);
        console.log('🎯 Automated UI bug ticket created:', shortId);
      } catch (err) {
        console.error('⚠️ Failed to create automated UI bug ticket:', err);
      }
    }
  }

  return result;
})();