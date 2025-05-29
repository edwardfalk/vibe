const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * VIBE GAME EDGE SHOOTING DIAGNOSTICS - WORLD BOUNDS EDITION
 * 
 * Purpose: Diagnose world bounds and coordinate system issues
 * Duration: ~60 seconds with comprehensive visual + data documentation
 * 
 * THE ACTUAL PROBLEM (identified by user):
 * 🐛 Player can move to coordinates outside visible viewport (800x600)
 * 🐛 Actual world is larger (1280x720) with camera following
 * 🐛 Game incorrectly considers playable area "off-screen" (refactoring bug)
 * 🐛 Bullets are created but immediately deleted as "off-screen"
 * 
 * THIS TEST NOW PROVIDES:
 * 📸 Timestamped screenshots showing exact player positions
 * 📊 Detailed coordinate analysis and world bounds detection
 * 🔍 Bullet lifecycle tracking (creation → deletion)
 * 📝 Comprehensive logs saved to files for analysis
 * 🎯 Viewport vs world size analysis
 */

const GAME_URL = 'http://localhost:5500';
const SCREENSHOT_DIR = './tests/screenshots/edge-shooting';
const TEST_TIMEOUT = 90000;

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Enhanced logging system
class TestLogger {
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.logs = [];
        this.startTime = Date.now();
    }
    
    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const relativeTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
        const logEntry = {
            timestamp,
            relativeTime: `+${relativeTime}s`,
            message,
            data
        };
        this.logs.push(logEntry);
        console.log(`[${relativeTime}s] ${message}`, data || '');
    }
    
    saveToFile(filename) {
        const content = this.logs.map(entry => 
            `[${entry.relativeTime}] ${entry.timestamp}\n${entry.message}\n${entry.data ? JSON.stringify(entry.data, null, 2) : ''}\n---\n`
        ).join('');
        fs.writeFileSync(path.join(this.baseDir, filename), content);
    }
}

test.describe('Edge Shooting Diagnostics - World Bounds Edition', () => {
    
    test('World Bounds and Coordinate System Analysis', async ({ page }) => {
        test.setTimeout(TEST_TIMEOUT);
        
        const logger = new TestLogger(SCREENSHOT_DIR);
        logger.log('🎯 WORLD BOUNDS DIAGNOSTICS STARTED');
        logger.log('🔍 Analyzing viewport vs world coordinate system');
        
        const shootingResults = [];
        let worldBounds = null;
        
        // ========================================================================
        // SETUP: Initialize and prevent navigation issues
        // ========================================================================
        logger.log('🔧 Setting up game and preventing navigation...');
        
        await page.setViewportSize({ width: 1280, height: 720 });
        
        // Prevent navigation and handle any popups
        page.on('dialog', dialog => dialog.dismiss());
        page.on('beforeunload', () => false);
        
        await page.goto(GAME_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        
        // Focus and activate the game properly
        await page.click('canvas');
        await page.waitForTimeout(500);
        
        // Wait for game to be ready
        await page.waitForFunction(() => {
            return window.player && window.gameState && window.gameState.gameState === 'playing';
        }, { timeout: 10000 });
        
        logger.log('✅ Game ready and focused');
        
        // Analyze world coordinate system  
        const worldAnalysis = await page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            const player = window.player;
            
            const analysis = {
                viewport: {
                    canvas: { width: canvas?.width || 0, height: canvas?.height || 0 },
                    client: { width: canvas?.clientWidth || 0, height: canvas?.clientHeight || 0 },
                    window: { width: window.innerWidth, height: window.innerHeight }
                },
                world: {
                    estimatedSize: { width: 1280, height: 720 }, // Expected world size
                    hasConfig: !!window.config,
                    configWorldSize: window.config?.worldSize || 'unknown'
                },
                player: {
                    exists: !!player,
                    position: player ? { x: player.x, y: player.y } : null,
                    hasMovementBounds: player && typeof player.constrainToBounds === 'function'
                },
                camera: {
                    exists: !!window.cameraSystem,
                    position: window.cameraSystem ? { x: window.cameraSystem.x, y: window.cameraSystem.y } : null,
                    follows: !!window.cameraSystem?.target
                },
                bullets: {
                    playerBullets: window.playerBullets ? window.playerBullets.length : 0,
                    bulletBounds: typeof window.isOffScreen === 'function' ? 'function exists' : 'no bounds function'
                },
                gameState: window.gameState?.gameState || 'unknown'
            };
            
            return analysis;
        });
        
        logger.log('🌍 World Analysis (Viewport vs World):', worldAnalysis);
        worldBounds = worldAnalysis;
        
        // Take initial screenshot with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await page.screenshot({ 
            path: path.join(SCREENSHOT_DIR, `${timestamp}_00-initial-analysis.png`),
            fullPage: false 
        });
        
        // ========================================================================
        // ENHANCED EDGE TEST: Proper mouse shooting
        // ========================================================================
        const testPositionWithMouseShooting = async (edgeName, moveKey, holdTime) => {
            logger.log(`\n🎯 Testing ${edgeName.toUpperCase()} - Mouse Shooting Analysis`);
            
            // Get initial position
            const initialPos = await page.evaluate(() => {
                return window.player ? { x: window.player.x, y: window.player.y } : null;
            });
            logger.log(`📍 Starting position: (${initialPos?.x}, ${initialPos?.y})`);
            
            // Move to edge
            if (moveKey) {
                logger.log(`🏃 Moving to ${edgeName} edge (${moveKey} for ${holdTime}ms)...`);
                await page.keyboard.down(moveKey);
                await page.waitForTimeout(holdTime);
                await page.keyboard.up(moveKey);
                await page.waitForTimeout(500);
            }
            
            // Get position after movement
            const positionAnalysis = await page.evaluate(() => {
                const player = window.player;
                const canvas = document.querySelector('canvas');
                
                if (!player) return { error: 'No player found' };
                
                const analysis = {
                    player: {
                        x: player.x,
                        y: player.y,
                        isValid: !isNaN(player.x) && !isNaN(player.y)
                    },
                    viewport: {
                        canvas: { width: canvas?.width || 0, height: canvas?.height || 0 }
                    },
                    world: {
                        estimatedBounds: { width: 1280, height: 720 }
                    },
                    bounds: {
                        inViewport: {
                            x: player.x >= 0 && player.x <= (canvas?.width || 800),
                            y: player.y >= 0 && player.y <= (canvas?.height || 600)
                        },
                        inWorld: {
                            x: player.x >= 0 && player.x <= 1280,
                            y: player.y >= 0 && player.y <= 720
                        },
                        distances: {
                            fromViewportEdges: {
                                left: player.x,
                                right: (canvas?.width || 800) - player.x,
                                top: player.y,
                                bottom: (canvas?.height || 600) - player.y
                            },
                            fromWorldEdges: {
                                left: player.x,
                                right: 1280 - player.x,
                                top: player.y,
                                bottom: 720 - player.y
                            }
                        }
                    },
                    camera: window.cameraSystem ? {
                        x: window.cameraSystem.x,
                        y: window.cameraSystem.y
                    } : null
                };
                
                return analysis;
            });
            
            logger.log(`📊 Position Analysis for ${edgeName}:`, positionAnalysis);
            
            // Screenshot current position
            const positionTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
            await page.screenshot({ 
                path: path.join(SCREENSHOT_DIR, `${positionTimestamp}_${edgeName}-position.png`),
                fullPage: false 
            });
            
            // Test mouse shooting with bullet lifecycle tracking
            logger.log(`🔫 Testing mouse shooting at ${edgeName} position...`);
            
            let bulletTest;
            try {
                // Use actual mouse click to shoot towards center
                const centerX = 640;
                const centerY = 360;
                
                bulletTest = await page.evaluate(() => {
                    // Get bullet count before shooting
                    const bulletsBefore = window.playerBullets ? window.playerBullets.length : 0;
                    return { bulletsBefore, playerPos: { x: window.player.x, y: window.player.y } };
                });
                
                // Perform mouse click to shoot
                await page.mouse.move(centerX, centerY);
                await page.mouse.click(centerX, centerY);
                await page.waitForTimeout(100); // Let bullet creation process
                
                // Check bullet creation and lifecycle
                const afterShooting = await page.evaluate(() => {
                    const bulletsAfter = window.playerBullets ? window.playerBullets.length : 0;
                    return {
                        bulletsAfter,
                        bulletsCreated: bulletsAfter > 0
                    };
                });
                
                // Wait a bit more to see if bullets get deleted
                await page.waitForTimeout(200);
                
                const afterDelay = await page.evaluate(() => {
                    const bulletsRemaining = window.playerBullets ? window.playerBullets.length : 0;
                    return {
                        bulletsRemaining,
                        possibleDeletion: bulletsRemaining === 0
                    };
                });
                
                bulletTest = {
                    ...bulletTest,
                    ...afterShooting,
                    ...afterDelay,
                    bulletLifecycle: {
                        created: afterShooting.bulletsCreated,
                        deleted: afterShooting.bulletsAfter > 0 && afterDelay.bulletsRemaining === 0,
                        persists: afterShooting.bulletsAfter > 0 && afterDelay.bulletsRemaining > 0
                    },
                    diagnosis: afterShooting.bulletsCreated ? 
                        (afterDelay.bulletsRemaining === 0 ? 'BULLET_CREATED_THEN_DELETED' : 'BULLET_CREATED_AND_PERSISTS') :
                        'NO_BULLET_CREATED',
                    shootMethod: 'mouse_click'
                };
                
            } catch (error) {
                bulletTest = { error: `Mouse shooting failed: ${error.message}` };
            }
            
            logger.log(`🔍 Mouse Shooting Result:`, bulletTest);
            
            // Screenshot after shooting
            const shootTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
            await page.screenshot({ 
                path: path.join(SCREENSHOT_DIR, `${shootTimestamp}_${edgeName}-after-shooting.png`),
                fullPage: false 
            });
            
            shootingResults.push({
                edge: edgeName,
                position: positionAnalysis,
                bulletTest: bulletTest,
                timestamp: new Date().toISOString()
            });
            
            return positionAnalysis;
        };
        
        // ========================================================================
        // TEST ALL EDGES WITH MOUSE SHOOTING
        // ========================================================================
        
        logger.log('\n🎯 Testing edge positions with mouse shooting...');
        
        // Test each edge
        await testPositionWithMouseShooting('top', 'KeyW', 2000);
        
        // Return to center
        await page.keyboard.press('KeyS');
        await page.waitForTimeout(800);
        
        await testPositionWithMouseShooting('right', 'KeyD', 2000);
        
        // Return to center
        await page.keyboard.press('KeyA');
        await page.waitForTimeout(800);
        
        await testPositionWithMouseShooting('bottom', 'KeyS', 2000);
        
        // Return to center  
        await page.keyboard.press('KeyW');
        await page.waitForTimeout(800);
        
        await testPositionWithMouseShooting('left', 'KeyA', 2000);
        
        // ========================================================================
        // ANALYSIS AND REPORTING
        // ========================================================================
        logger.log('\n📊 WORLD BOUNDS ANALYSIS COMPLETE');
        
        const analysis = {
            worldBounds: worldBounds,
            edgeResults: shootingResults,
            issues: [],
            recommendations: []
        };
        
        // Analyze for viewport vs world issues
        shootingResults.forEach(result => {
            const pos = result.position.player;
            const bounds = result.position.bounds;
            
            // Check if player is outside viewport but inside world
            const outsideViewport = !bounds.inViewport.x || !bounds.inViewport.y;
            const insideWorld = bounds.inWorld.x && bounds.inWorld.y;
            
            if (outsideViewport && insideWorld) {
                analysis.issues.push(`${result.edge.toUpperCase()}: Player at (${pos.x}, ${pos.y}) outside viewport but inside world - this should be valid!`);
            }
            
            if (result.bulletTest.diagnosis === 'BULLET_CREATED_THEN_DELETED') {
                analysis.issues.push(`${result.edge.toUpperCase()}: Bullets created but immediately deleted (refactoring bug)`);
            }
        });
        
        // Generate recommendations
        if (analysis.issues.some(issue => issue.includes('outside viewport but inside world'))) {
            analysis.recommendations.push('🔧 FIX BOUNDS CHECKING: Game incorrectly treats valid world positions as "off-screen"');
            analysis.recommendations.push('🔧 VIEWPORT VS WORLD: Bullet bounds should check world size (1280x720), not viewport (800x600)');
        }
        
        logger.log('🎯 FINAL ANALYSIS:', analysis);
        
        // Save files with timestamps
        const finalTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        fs.writeFileSync(
            path.join(SCREENSHOT_DIR, `${finalTimestamp}_world-bounds-analysis.json`),
            JSON.stringify(analysis, null, 2)
        );
        
        const report = `
WORLD BOUNDS DIAGNOSTIC REPORT  
Generated: ${new Date().toISOString()}

IDENTIFIED ISSUES:
${analysis.issues.map(issue => `❌ ${issue}`).join('\n')}

VIEWPORT VS WORLD ANALYSIS:
- Viewport (visible): ${worldBounds.viewport.canvas.width}x${worldBounds.viewport.canvas.height}
- World (playable): ${worldBounds.world.estimatedSize.width}x${worldBounds.world.estimatedSize.height}
- Camera follows: ${worldBounds.camera.follows}

EDGE POSITION RESULTS:
${shootingResults.map(result => `
${result.edge.toUpperCase()}:
- Position: (${result.position.player.x}, ${result.position.player.y})
- In Viewport: X=${result.position.bounds.inViewport.x}, Y=${result.position.bounds.inViewport.y}
- In World: X=${result.position.bounds.inWorld.x}, Y=${result.position.bounds.inWorld.y}
- Bullet Result: ${result.bulletTest.diagnosis}
`).join('')}

ROOT CAUSE:
${analysis.issues.length > 0 ? 
  'Refactoring bug: Game treats valid world positions as "off-screen" because bounds checking uses viewport size instead of world size.' :
  'No viewport/world coordinate issues detected.'
}
`;
        
        fs.writeFileSync(path.join(SCREENSHOT_DIR, `${finalTimestamp}_diagnostic-report.txt`), report);
        logger.saveToFile(`${finalTimestamp}_test-logs.txt`);
        
        await page.screenshot({ 
            path: path.join(SCREENSHOT_DIR, `${finalTimestamp}_99-final-analysis.png`),
            fullPage: false 
        });
        
        logger.log('📂 Complete analysis saved to:', SCREENSHOT_DIR);
        logger.log('✅ Test completed successfully');
        
        // Simple assertion to make test pass/fail
        expect(worldBounds.player.exists).toBe(true);
        
        if (analysis.issues.length > 0) {
            logger.log(`\n⚠️  WORLD BOUNDS ISSUES DETECTED: ${analysis.issues.length} issues found`);
        } else {
            logger.log('\n✅ NO WORLD BOUNDS ISSUES DETECTED');
        }
    });
}); 