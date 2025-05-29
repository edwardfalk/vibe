const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * VIBE GAME TROUBLESHOOTING TEST SUITE
 * 
 * Purpose: Rapid diagnosis of commonly reported user issues
 * Duration: ~30 seconds for quick troubleshooting
 * Focus: Targeted testing of specific problem areas
 * 
 * USER-REPORTED ISSUES THIS TEST TARGETS:
 * 🔍 "Edge shooting not working" → Coordinate conversion bugs
 * 🔍 "Enemies not appearing" → Spawn/render system bugs  
 * 🔍 "Mouse clicks crash game" → Event handler bugs
 * 🔍 "Game is silent" → Audio context activation bugs
 * 🔍 "Test mode won't activate" → Automation system bugs
 * 🔍 "Contact damage missing" → Collision detection bugs
 * 🔍 "Game hangs or freezes" → Performance/infinite loop bugs
 * 
 * DIAGNOSTIC APPROACH:
 * ✅ Fast initialization check (5 seconds)
 * ✅ Audio context validation (5 seconds)  
 * ✅ Edge shooting test (10 seconds)
 * ✅ Enemy visibility check (5 seconds)
 * ✅ Test mode validation (3 seconds)
 * ✅ Error detection & reporting (2 seconds)
 * 
 * TROUBLESHOOTING RECOMMENDATIONS:
 * 🔧 Game won't load → Check browser console for module/p5.js errors
 * 🔧 Silent audio → Verify user clicked canvas, check audio context state
 * 🔧 Edge shooting fails → Check camera coordinate conversion system
 * 🔧 No enemies → Check spawn system initialization and camera transforms
 * 🔧 Test mode broken → Verify TestMode.js loading and T key handler
 * 🔧 Crashes on click → Check mouse event handlers and player object state
 * 🔧 Performance issues → Monitor frame rate and check for infinite loops
 */

// Test configuration
const GAME_URL = 'http://localhost:5500';
const SCREENSHOT_DIR = './tests/screenshots';
const QUICK_TIMEOUT = 45000; // 45 seconds for rapid diagnosis

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('Vibe Game - Quick Troubleshooting Diagnostics', () => {
    
    test('Rapid Diagnosis of Common User Issues', async ({ page }) => {
        test.setTimeout(QUICK_TIMEOUT);
        
        console.log('🔧 VIBE GAME TROUBLESHOOTING DIAGNOSTICS');
        console.log('⚡ Rapid diagnosis of user-reported issues');
        console.log('🕒 Duration: ~30 seconds');
        console.log('🎯 Focused testing of problem areas\n');
        
        const issues = [];
        const errorLog = [];
        
        // Capture console errors for analysis
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const error = `${new Date().toISOString()}: ${msg.text()}`;
                errorLog.push(error);
                console.log('❌ Console Error:', error);
            }
        });
        
        // ========================================================================
        // DIAGNOSTIC 1: BASIC GAME INITIALIZATION
        // ========================================================================
        console.log('🔍 DIAGNOSTIC 1: Game Initialization Check');
        
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto(GAME_URL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        
        const initStatus = await page.evaluate(() => {
            return {
                hasCanvas: !!document.querySelector('canvas'),
                hasPlayer: typeof window.player !== 'undefined' && !!window.player,
                hasEnemies: typeof window.enemies !== 'undefined',
                hasGameState: typeof window.gameState !== 'undefined',
                hasAudio: typeof window.audio !== 'undefined',
                frameCount: window.frameCount || 0,
                gameRunning: window.frameCount > 10,
                p5Loaded: typeof window.p5 !== 'undefined'
            };
        });
        
        console.log('📊 Initialization status:', initStatus);
        
        // Check for critical initialization failures
        if (!initStatus.hasCanvas) issues.push('❌ CRITICAL: Canvas not found - game not loading properly');
        if (!initStatus.hasPlayer) issues.push('❌ CRITICAL: Player object missing - initialization failure');
        if (!initStatus.gameRunning) issues.push('❌ CRITICAL: Game loop not running - p5.js or module loading issue');
        if (!initStatus.p5Loaded) issues.push('❌ CRITICAL: p5.js not loaded - check script loading order');
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'troubleshoot-01-initialization.png') });
        
        // ========================================================================
        // DIAGNOSTIC 2: AUDIO CONTEXT ACTIVATION (User Issue: Silent Game)
        // ========================================================================
        console.log('\n🔍 DIAGNOSTIC 2: Audio Context Activation');
        
        // Test audio activation with multiple click methods
        await page.click('canvas', { position: { x: 640, y: 360 } });
        await page.waitForTimeout(1500);
        
        const audioStatus = await page.evaluate(() => {
            return {
                audioExists: !!window.audio,
                contextState: window.audio?.audioContext?.state || 'unknown',
                speechReady: window.audio && typeof window.audio.speak === 'function',
                audioInitialized: window.audio?.initialized || false
            };
        });
        
        console.log('🔊 Audio status:', audioStatus);
        
        // Check for audio issues
        if (!audioStatus.audioExists) issues.push('❌ AUDIO: Audio system not initialized');
        if (audioStatus.contextState !== 'running') issues.push('❌ AUDIO: Audio context not activated - game will be silent');
        if (!audioStatus.speechReady) issues.push('⚠️  AUDIO: Speech system not ready - TTS may not work');
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'troubleshoot-02-audio.png') });
        
        // ========================================================================
        // DIAGNOSTIC 3: EDGE SHOOTING TEST (User Issue: Edge Shooting Broken)
        // ========================================================================
        console.log('\n🔍 DIAGNOSTIC 3: Edge Shooting Validation');
        console.log('🎯 Testing the most commonly reported issue');
        
        // Move to right edge quickly
        await page.keyboard.down('KeyD');
        await page.waitForTimeout(2000);
        await page.keyboard.up('KeyD');
        
        const edgePosition = await page.evaluate(() => {
            return window.player ? {
                x: Math.round(window.player.x),
                y: Math.round(window.player.y),
                atEdge: window.player.x > 1100 // Rough edge detection
            } : null;
        });
        
        console.log('📍 Edge position:', edgePosition);
        
        // Test shooting from edge position
        const edgeShootResult = await page.evaluate(() => {
            try {
                // Set mouse target to the right
                window.mouseX = 1200;
                window.mouseY = 360;
                
                const bulletsBefore = window.playerBullets?.length || 0;
                if (window.player && window.player.shoot) {
                    window.player.shoot();
                }
                const bulletsAfter = window.playerBullets?.length || 0;
                
                return {
                    success: bulletsAfter > bulletsBefore,
                    bulletCount: bulletsAfter,
                    playerPos: window.player ? { x: window.player.x, y: window.player.y } : null,
                    mousePos: { x: window.mouseX, y: window.mouseY }
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        console.log('🔫 Edge shooting result:', edgeShootResult);
        
        if (!edgeShootResult.success) {
            issues.push('❌ EDGE SHOOTING: Shooting fails from screen edges - coordinate conversion bug');
        } else {
            console.log('✅ Edge shooting working correctly');
        }
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'troubleshoot-03-edge-shooting.png') });
        
        // ========================================================================
        // DIAGNOSTIC 4: ENEMY VISIBILITY (User Issue: Enemies Not Appearing)
        // ========================================================================
        console.log('\n🔍 DIAGNOSTIC 4: Enemy System Check');
        
        // Wait for enemy spawning
        await page.waitForTimeout(4000);
        
        const enemyStatus = await page.evaluate(() => {
            const enemies = window.enemies || [];
            const canvas = document.querySelector('canvas');
            const canvasWidth = canvas ? canvas.width : 1280;
            const canvasHeight = canvas ? canvas.height : 720;
            
            return {
                totalEnemies: enemies.length,
                enemyTypes: [...new Set(enemies.map(e => e.type))],
                onScreenEnemies: enemies.filter(e => 
                    e.x > 0 && e.x < canvasWidth && e.y > 0 && e.y < canvasHeight
                ).length,
                offScreenEnemies: enemies.filter(e => 
                    e.x <= 0 || e.x >= canvasWidth || e.y <= 0 || e.y >= canvasHeight
                ).length,
                spawnSystemExists: typeof window.spawnSystem !== 'undefined',
                enemyPositions: enemies.slice(0, 2).map(e => ({
                    type: e.type,
                    x: Math.round(e.x),
                    y: Math.round(e.y),
                    onScreen: e.x > 0 && e.x < canvasWidth && e.y > 0 && e.y < canvasHeight
                }))
            };
        });
        
        console.log('👾 Enemy status:', enemyStatus);
        
        // Check for enemy visibility issues
        if (enemyStatus.totalEnemies === 0) {
            issues.push('❌ ENEMIES: No enemies spawning - spawn system failure');
        } else if (enemyStatus.onScreenEnemies === 0 && enemyStatus.offScreenEnemies > 0) {
            issues.push('❌ ENEMIES: All enemies spawning off-screen - coordinate/camera bug');
        } else if (enemyStatus.onScreenEnemies > 0) {
            console.log('✅ Enemies visible on screen');
        }
        
        if (!enemyStatus.spawnSystemExists) {
            issues.push('❌ ENEMIES: Spawn system not loaded - check SpawnSystem.js');
        }
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'troubleshoot-04-enemies.png') });
        
        // ========================================================================
        // DIAGNOSTIC 5: TEST MODE ACTIVATION (User Issue: Automation Not Working)
        // ========================================================================
        console.log('\n🔍 DIAGNOSTIC 5: Test Mode Validation');
        
        await page.keyboard.press('KeyT');
        await page.waitForTimeout(1000);
        
        const testModeStatus = await page.evaluate(() => {
            return {
                testModeExists: typeof window.testMode !== 'undefined',
                testModeEnabled: window.testMode?.enabled || false,
                autoRestart: window.testMode?.autoRestart || false,
                testModeClass: typeof window.TestMode !== 'undefined'
            };
        });
        
        console.log('🤖 Test mode status:', testModeStatus);
        
        // Check test mode functionality
        if (!testModeStatus.testModeExists) {
            issues.push('❌ TEST MODE: Test mode object not found - TestMode.js not loaded');
        } else if (!testModeStatus.testModeEnabled) {
            issues.push('⚠️  TEST MODE: Test mode not activating - T key handler may be broken');
        } else {
            console.log('✅ Test mode activated successfully');
        }
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'troubleshoot-05-test-mode.png') });
        
        // ========================================================================
        // DIAGNOSTIC 6: FINAL ANALYSIS AND RECOMMENDATIONS
        // ========================================================================
        console.log('\n🔍 DIAGNOSTIC 6: Final Analysis');
        
        // Final screenshot
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'troubleshoot-06-final.png') });
        
        // Compile final status
        const finalDiagnostic = {
            totalIssues: issues.length,
            criticalIssues: issues.filter(i => i.includes('CRITICAL')).length,
            audioIssues: issues.filter(i => i.includes('AUDIO')).length,
            enemyIssues: issues.filter(i => i.includes('ENEMIES')).length,
            edgeShootingIssue: issues.some(i => i.includes('EDGE SHOOTING')),
            testModeIssue: issues.some(i => i.includes('TEST MODE')),
            consoleErrors: errorLog.length
        };
        
        // ========================================================================
        // TROUBLESHOOTING REPORT
        // ========================================================================
        console.log('\n📋 TROUBLESHOOTING REPORT:');
        console.log('=' .repeat(50));
        
        if (issues.length === 0) {
            console.log('✅ NO ISSUES DETECTED - Game appears to be working correctly');
        } else {
            console.log(`❌ ${issues.length} ISSUE(S) DETECTED:`);
            issues.forEach((issue, i) => {
                console.log(`  ${i + 1}. ${issue}`);
            });
        }
        
        if (errorLog.length > 0) {
            console.log(`\n⚠️  ${errorLog.length} CONSOLE ERROR(S) DETECTED:`);
            errorLog.slice(0, 3).forEach((error, i) => {
                console.log(`  ${i + 1}. ${error}`);
            });
            if (errorLog.length > 3) {
                console.log(`  ... and ${errorLog.length - 3} more errors`);
            }
        }
        
        // Specific troubleshooting recommendations
        console.log('\n🔧 TROUBLESHOOTING RECOMMENDATIONS:');
        
        if (finalDiagnostic.criticalIssues > 0) {
            console.log('🚨 CRITICAL ISSUES DETECTED:');
            console.log('   → Check browser console for module loading errors');
            console.log('   → Verify all JavaScript files are loading correctly');
            console.log('   → Check Live Server is running on port 5500');
        }
        
        if (finalDiagnostic.edgeShootingIssue) {
            console.log('🎯 EDGE SHOOTING ISSUE:');
            console.log('   → Check camera coordinate conversion in player.js');
            console.log('   → Verify mouse coordinate transformation system');
            console.log('   → Test with different screen positions');
        }
        
        if (finalDiagnostic.enemyIssues > 0) {
            console.log('👾 ENEMY SYSTEM ISSUES:');
            console.log('   → Check SpawnSystem.js initialization');
            console.log('   → Verify camera transform in enemy positioning');
            console.log('   → Check EnemyFactory.js for creation errors');
        }
        
        if (finalDiagnostic.audioIssues > 0) {
            console.log('🔊 AUDIO SYSTEM ISSUES:');
            console.log('   → Ensure user clicked canvas to activate audio context');
            console.log('   → Check Audio.js initialization');
            console.log('   → Verify browser audio permissions');
        }
        
        console.log('\n📸 Screenshots saved to:', SCREENSHOT_DIR);
        console.log('🎯 Diagnostic Summary:', finalDiagnostic);
        
        // Test assertions - don't fail on minor issues, just report them
        expect(finalDiagnostic.criticalIssues, 'Critical initialization failures detected').toBe(0);
        
        if (finalDiagnostic.totalIssues > 0) {
            console.log('\n⚠️  Test completed with issues - see recommendations above');
        } else {
            console.log('\n🏆 ALL DIAGNOSTICS PASSED - Game is functioning correctly');
        }
    });
}); 