/**
 * MANUAL TESTING WITH AUTO-CAPTURE
 * 
 * This test opens the game and automatically captures screenshots and logs
 * while you play manually. Perfect for debugging - just play normally and
 * all evidence is captured automatically!
 * 
 * Usage:
 * npx playwright test manual-testing-with-auto-capture.spec.js --headed
 * 
 * Features:
 * ✅ Screenshots every 3 seconds automatically
 * ✅ Console logs captured continuously  
 * ✅ Organized timestamp-based file naming
 * ✅ Manual control - you play, it captures
 * ✅ Video recording for session replay
 * ✅ Game state monitoring
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Configuration
const CAPTURE_DURATION = 300000; // 5 minutes (300 seconds)
const SCREENSHOT_INTERVAL = 3000; // Every 3 seconds
const LOG_CAPTURE_INTERVAL = 5000; // Every 5 seconds

test('Manual Testing Session with Auto-Capture', async ({ page, context }) => {
  // Create timestamped output directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join('tests', 'manual-sessions', `session-${timestamp}`);
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log(`🎬 Starting manual testing session with auto-capture`);
  console.log(`📁 Output directory: ${outputDir}`);
  console.log(`⏱️  Session duration: ${CAPTURE_DURATION / 1000} seconds`);
  console.log(`📸 Screenshots every ${SCREENSHOT_INTERVAL / 1000} seconds`);
  
  // Enhanced context settings for better capture
  await context.tracing.start({ 
    screenshots: true, 
    snapshots: true,
    sources: true
  });
  
  // Navigate to game with extended timeout
  await page.goto('http://localhost:5500', { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });
  
  // Wait for game to initialize
  await page.waitForFunction(() => window.gameState && window.audio);
  console.log('🎮 Game initialized - ready for manual testing!');
  
  // Click canvas to activate audio context
  await page.click('canvas', { position: { x: 400, y: 300 } });
  await page.waitForTimeout(1000);
  
  // Setup console monitoring
  const consoleLogs = [];
  page.on('console', msg => {
    const timestamp = new Date().toISOString();
    consoleLogs.push({
      timestamp,
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });
  
  console.log('📝 Console monitoring active');
  console.log('🎯 Click the browser window and start playing!');
  console.log('⚠️  Test will run for 5 minutes, capturing everything automatically');
  
  // Start automated capture intervals
  let screenshotCounter = 0;
  let captureStartTime = Date.now();
  
  // Screenshot capture interval
  const screenshotInterval = setInterval(async () => {
    try {
      screenshotCounter++;
      const timeElapsed = Math.floor((Date.now() - captureStartTime) / 1000);
      const screenshotName = `screenshot-${String(screenshotCounter).padStart(3, '0')}-${timeElapsed}s`;
      
      await page.screenshot({
        path: path.join(outputDir, `${screenshotName}.png`),
        fullPage: false
      });
      
      console.log(`📸 Screenshot ${screenshotCounter}: ${screenshotName}.png`);
    } catch (error) {
      console.log(`⚠️ Screenshot error: ${error.message}`);
    }
  }, SCREENSHOT_INTERVAL);
  
  // Console log capture interval
  const logInterval = setInterval(async () => {
    if (consoleLogs.length > 0) {
      const logFile = path.join(outputDir, `console-logs-${Date.now()}.json`);
      fs.writeFileSync(logFile, JSON.stringify(consoleLogs, null, 2));
      console.log(`📝 Saved ${consoleLogs.length} console logs`);
    }
  }, LOG_CAPTURE_INTERVAL);
  
  // Game state monitoring interval
  const gameStateInterval = setInterval(async () => {
    try {
      const gameState = await page.evaluate(() => {
        if (!window.gameState || !window.player) return null;
        
        const state = {
          timestamp: new Date().toISOString(),
          gameState: window.gameState.currentState,
          player: {
            x: Math.round(window.player.x),
            y: Math.round(window.player.y),
            health: window.player.health,
            alive: window.player.alive
          },
          enemies: window.enemies ? window.enemies.length : 0,
          bullets: window.bullets ? window.bullets.length : 0,
          frame: window.frameCount || 0
        };
        
        return state;
      });
      
      if (gameState) {
        const stateFile = path.join(outputDir, `game-state-${Date.now()}.json`);
        fs.writeFileSync(stateFile, JSON.stringify(gameState, null, 2));
      }
    } catch (error) {
      // Silent - don't spam console with errors
    }
  }, 10000); // Every 10 seconds
  
  // Manual testing period - just wait while user plays
  console.log('🎮 MANUAL TESTING ACTIVE - Play the game normally!');
  console.log('🔧 Try reproducing any bugs you want to investigate');
  console.log('📹 Everything is being captured automatically');
  
  await page.waitForTimeout(CAPTURE_DURATION);
  
  // Cleanup intervals
  clearInterval(screenshotInterval);
  clearInterval(logInterval);
  clearInterval(gameStateInterval);
  
  // Final capture
  await context.tracing.stop({ path: path.join(outputDir, 'trace.zip') });
  
  // Save final console logs
  const finalLogFile = path.join(outputDir, 'final-console-logs.json');
  fs.writeFileSync(finalLogFile, JSON.stringify(consoleLogs, null, 2));
  
  // Generate session summary
  const summary = {
    sessionStart: new Date(captureStartTime).toISOString(),
    sessionEnd: new Date().toISOString(),
    duration: Math.floor((Date.now() - captureStartTime) / 1000),
    screenshotsCaptured: screenshotCounter,
    consoleLogsCount: consoleLogs.length,
    outputDirectory: outputDir,
    notes: 'Manual testing session completed. Review screenshots and logs for debugging.'
  };
  
  const summaryFile = path.join(outputDir, 'session-summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  
  console.log('✅ Manual testing session completed!');
  console.log(`📊 Summary: ${screenshotCounter} screenshots, ${consoleLogs.length} console logs`);
  console.log(`📁 All files saved to: ${outputDir}`);
  console.log('🔍 Review the captured data to analyze any issues');
  
  // Don't fail the test - this is for data collection
  expect(summary.screenshotsCaptured).toBeGreaterThan(0);
});

test('Quick Manual Test (1 minute)', async ({ page, context }) => {
  // Shorter version for quick testing
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join('tests', 'manual-sessions', `quick-${timestamp}`);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('🚀 Quick 1-minute manual test starting...');
  
  await page.goto('http://localhost:5500');
  await page.waitForFunction(() => window.gameState);
  await page.click('canvas', { position: { x: 400, y: 300 } });
  
  let screenshotCounter = 0;
  const screenshotInterval = setInterval(async () => {
    screenshotCounter++;
    await page.screenshot({
      path: path.join(outputDir, `quick-${screenshotCounter}.png`)
    });
    console.log(`📸 Quick screenshot ${screenshotCounter}`);
  }, 2000); // Every 2 seconds for quick test
  
  console.log('🎮 Quick test active - 1 minute of manual play!');
  await page.waitForTimeout(60000); // 1 minute
  
  clearInterval(screenshotInterval);
  console.log(`✅ Quick test complete! ${screenshotCounter} screenshots in ${outputDir}`);
  
  expect(screenshotCounter).toBeGreaterThan(0);
}); 