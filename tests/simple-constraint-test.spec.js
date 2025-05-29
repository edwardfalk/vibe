const { test, expect } = require('@playwright/test');

test.describe('Vibe Game - Simple Constraint Testing', () => {
  test('Document 800x600 constraint behavior', async ({ page }) => {
    // Navigate to the game
    await page.goto('http://localhost:5500');
    
    // Wait for game to load
    await page.waitForTimeout(2000);
    
    // Click to activate audio context
    await page.click('canvas');
    await page.waitForTimeout(1000);
    
    // Verify game is running
    const gameRunning = await page.evaluate(() => {
      return window.gameState?.gameState === 'playing';
    });
    expect(gameRunning).toBe(true);
    
    // Check initial state
    const initialState = await page.evaluate(() => {
      if (!window.player) return null;
      return {
        player: { x: window.player.x, y: window.player.y },
        canvas: { width: window.width, height: window.height },
        time: Date.now()
      };
    });
    
    console.log('Initial state:', initialState);
    expect(initialState.player).toBeTruthy();
    expect(initialState.canvas.width).toBe(800);
    expect(initialState.canvas.height).toBe(600);
    
    // Test 1: Direct position setting (should work initially)
    const directSet = await page.evaluate(() => {
      if (!window.player) return null;
      
      const before = { x: window.player.x, y: window.player.y };
      window.player.x = 650;
      window.player.y = 650;
      const after = { x: window.player.x, y: window.player.y };
      
      return { before, attempted: { x: 650, y: 650 }, after };
    });
    
    console.log('Direct position set:', directSet);
    expect(directSet.after.x).toBe(650);
    expect(directSet.after.y).toBe(650);
    
    // Test 2: Check if game loop constrains it back
    await page.waitForTimeout(2000); // Let game loop run
    
    const afterGameLoop = await page.evaluate(() => {
      if (!window.player) return null;
      return { x: window.player.x, y: window.player.y };
    });
    
    console.log('Position after game loop:', afterGameLoop);
    
    // Document the constraint behavior
    const constraintHappened = afterGameLoop.x !== 650 || afterGameLoop.y !== 650;
    console.log('Constraint applied by game loop:', constraintHappened);
    
    if (constraintHappened) {
      console.log('✅ CONFIRMED: Game loop constrains player position');
      console.log(`Player was moved from (650,650) to (${afterGameLoop.x},${afterGameLoop.y})`);
    } else {
      console.log('❌ No constraint detected');
    }
    
    // Save final screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/constraint-behavior.png' 
    });
  });
}); 