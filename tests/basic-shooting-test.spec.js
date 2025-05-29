const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * BASIC SHOOTING FUNCTIONALITY TEST
 * 
 * Purpose: Determine if shooting works at all in automated environment
 * Duration: ~20 seconds
 * 
 * This test checks if the core shooting mechanism works from the center
 * before we worry about edge cases. If this fails, the issue is broader
 * than just edge shooting.
 */

const GAME_URL = 'http://localhost:5500';
const SCREENSHOT_DIR = './tests/screenshots/basic-shooting';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('Basic Shooting Test', () => {
    
    test('Test if shooting works at all from center position', async ({ page }) => {
        test.setTimeout(30000);
        
        console.log('🔫 BASIC SHOOTING TEST');
        console.log('🎯 Testing core shooting functionality');
        
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto(GAME_URL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        
        // Activate audio context
        await page.click('canvas', { position: { x: 640, y: 360 } });
        await page.waitForTimeout(1000);
        
        // Take initial screenshot
        await page.screenshot({ 
            path: path.join(SCREENSHOT_DIR, '01-initial-state.png'),
            fullPage: false 
        });
        
        // Get initial game state
        const initialState = await page.evaluate(() => {
            return {
                playerExists: !!window.player,
                playerPosition: window.player ? { x: window.player.x, y: window.player.y } : null,
                hasShootMethod: window.player && typeof window.player.shoot === 'function',
                bulletsBefore: window.playerBullets ? window.playerBullets.length : 0,
                gameState: window.gameState,
                canShoot: window.player ? !window.player.isDead : false
            };
        });
        
        console.log('🎮 Initial state:', initialState);
        
        // Test multiple shooting methods
        const shootingMethods = [
            {
                name: 'Direct player.shoot()',
                test: async () => {
                    return await page.evaluate(() => {
                        const bulletsBefore = window.playerBullets ? window.playerBullets.length : 0;
                        if (window.player && window.player.shoot) {
                            window.player.shoot();
                        }
                        return new Promise(resolve => {
                            setTimeout(() => {
                                const bulletsAfter = window.playerBullets ? window.playerBullets.length : 0;
                                resolve({
                                    bulletsBefore,
                                    bulletsAfter,
                                    success: bulletsAfter > bulletsBefore
                                });
                            }, 100);
                        });
                    });
                }
            },
            {
                name: 'Mouse click simulation',
                test: async () => {
                    await page.click('canvas', { position: { x: 600, y: 300 } });
                    await page.waitForTimeout(100);
                    return await page.evaluate(() => {
                        return {
                            bulletsAfter: window.playerBullets ? window.playerBullets.length : 0,
                            success: window.playerBullets && window.playerBullets.length > 0
                        };
                    });
                }
            },
            {
                name: 'Mouse down/up simulation',
                test: async () => {
                    await page.mouse.move(640, 360);
                    await page.mouse.down();
                    await page.waitForTimeout(100);
                    await page.mouse.up();
                    await page.waitForTimeout(100);
                    return await page.evaluate(() => {
                        return {
                            bulletsAfter: window.playerBullets ? window.playerBullets.length : 0,
                            success: window.playerBullets && window.playerBullets.length > 0
                        };
                    });
                }
            }
        ];
        
        const results = [];
        
        for (let i = 0; i < shootingMethods.length; i++) {
            const method = shootingMethods[i];
            console.log(`\n🔫 Testing: ${method.name}`);
            
            try {
                const result = await method.test();
                console.log(`   Result:`, result.success ? '✅ SUCCESS' : '❌ FAILED', result);
                results.push({ method: method.name, ...result });
                
                // Screenshot after each test
                await page.screenshot({ 
                    path: path.join(SCREENSHOT_DIR, `0${i+2}-${method.name.replace(/[^a-zA-Z0-9]/g, '-')}.png`),
                    fullPage: false 
                });
                
            } catch (error) {
                console.log(`   Error:`, error.message);
                results.push({ method: method.name, success: false, error: error.message });
            }
            
            await page.waitForTimeout(500);
        }
        
        // Test the Cosmic Beat System timing
        console.log('\n🎵 Testing Cosmic Beat System shooting...');
        const beatTest = await page.evaluate(() => {
            if (!window.beatClock) {
                return { error: 'BeatClock not available' };
            }
            
            const bulletsBefore = window.playerBullets ? window.playerBullets.length : 0;
            
            // Try to shoot on beat
            if (window.player && window.player.shootOnBeat) {
                window.player.shootOnBeat();
            } else if (window.player && window.player.shoot) {
                window.player.shoot();
            }
            
            return new Promise(resolve => {
                setTimeout(() => {
                    const bulletsAfter = window.playerBullets ? window.playerBullets.length : 0;
                    resolve({
                        bulletsBefore,
                        bulletsAfter,
                        success: bulletsAfter > bulletsBefore,
                        currentBeat: window.beatClock.currentBeat,
                        isOnBeat: window.beatClock.isOnBeat ? window.beatClock.isOnBeat() : false
                    });
                }, 200);
            });
        });
        
        console.log('   Beat test:', beatTest.success ? '✅ SUCCESS' : '❌ FAILED', beatTest);
        
        // Final screenshot
        await page.screenshot({ 
            path: path.join(SCREENSHOT_DIR, '99-final-state.png'),
            fullPage: false 
        });
        
        // Analysis
        const successfulMethods = results.filter(r => r.success).length;
        const totalMethods = results.length;
        
        console.log('\n📊 SHOOTING TEST ANALYSIS');
        console.log('========================================');
        console.log(`✅ Successful methods: ${successfulMethods}/${totalMethods}`);
        console.log(`📍 Player position: (${initialState.playerPosition?.x}, ${initialState.playerPosition?.y})`);
        
        results.forEach(result => {
            const status = result.success ? '✅' : '❌';
            console.log(`${status} ${result.method}: ${result.success ? 'WORKS' : 'FAILED'}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });
        
        // Generate report
        const report = `
BASIC SHOOTING TEST REPORT
Generated: ${new Date().toISOString()}

SUMMARY:
- Successful shooting methods: ${successfulMethods}/${totalMethods}
- Player position: (${initialState.playerPosition?.x}, ${initialState.playerPosition?.y})
- Player has shoot method: ${initialState.hasShootMethod}

RESULTS:
${results.map(r => `- ${r.method}: ${r.success ? 'SUCCESS' : 'FAILED'}${r.error ? ` (${r.error})` : ''}`).join('\n')}

BEAT SYSTEM TEST:
- Current beat: ${beatTest.currentBeat || 'unknown'}
- Is on beat: ${beatTest.isOnBeat || 'unknown'}
- Beat shooting: ${beatTest.success ? 'SUCCESS' : 'FAILED'}

CONCLUSION:
${successfulMethods > 0 ? 
  '✅ Basic shooting works - edge shooting issue is position-specific' : 
  '❌ Basic shooting broken - fundamental shooting system issue'
}

RECOMMENDATIONS:
${successfulMethods === 0 ? 
  '🔧 Core shooting system broken. Check:\n' +
  '  - player.shoot() method implementation\n' +
  '  - Bullet creation in player.js\n' +
  '  - playerBullets array initialization\n' +
  '  - Cosmic Beat System timing restrictions' :
  successfulMethods < totalMethods ?
    '🔧 Some shooting methods work. Check:\n' +
    '  - Mouse event handling\n' +
    '  - Canvas click detection\n' +
    '  - Event coordinate conversion' :
    '✅ All shooting methods work from center position'
}
`;
        
        fs.writeFileSync(path.join(SCREENSHOT_DIR, 'basic-shooting-report.txt'), report);
        
        console.log('\n📂 Results saved to:', SCREENSHOT_DIR);
        console.log('📄 Report:', path.join(SCREENSHOT_DIR, 'basic-shooting-report.txt'));
        
        // This is a diagnostic test, so we'll be lenient with assertions
        expect(initialState.playerExists).toBe(true);
        expect(initialState.hasShootMethod).toBe(true);
        
        // If no shooting method works, we have a fundamental issue
        if (successfulMethods === 0) {
            console.log('\n❌ CRITICAL: No shooting methods work - fundamental system issue');
        } else {
            console.log(`\n✅ ${successfulMethods} shooting method(s) work`);
        }
    });
}); 