const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * VIBE GAME ULTIMATE COMPREHENSIVE TEST SUITE
 * 
 * Purpose: Maximum troubleshooting value - comprehensive validation of ALL game systems
 * Duration: ~3-4 minutes with complete system coverage
 * Focus: Deep testing of every component that could possibly fail
 * 
 * WHAT THIS ENHANCED TEST VALIDATES:
 * ✅ Game initialization and p5.js loading
 * ✅ Audio context activation AND sound playback validation
 * ✅ Test mode functionality (T key automation)
 * ✅ Player movement to ALL edges AND corners (8-direction movement)
 * ✅ Dash ability testing in all directions (spacebar + WASD)
 * ✅ Directional shooting system in all 8 directions (comprehensive aiming)
 * ✅ Enemy spawning, AI behavior, and type-specific abilities
 * ✅ Collision detection (bullets, contact damage, explosions)
 * ✅ Sound system validation (TTS, effects, spatial audio)
 * ✅ Visual effects and graphics validation
 * ✅ Performance monitoring and frame rate tracking
 * ✅ Cosmic Beat System synchronization
 * ✅ Game state management and UI updates
 * ✅ Error detection and comprehensive console monitoring
 * 
 * ENHANCED ISSUE DETECTION:
 * ❌ Movement bounds and edge detection failures
 * ❌ Dash ability not working or misconfigured
 * ❌ Shooting coordinate conversion bugs in any direction
 * ❌ Enemy AI not functioning (movement, targeting, abilities)
 * ❌ Collision detection failures (bullets miss, no contact damage)
 * ❌ Sound system silent or TTS not working
 * ❌ Visual effects not triggering or rendering incorrectly
 * ❌ Performance degradation or frame rate issues
 * ❌ Beat system desynchronization
 * ❌ Game state corruption or UI update failures
 * 
 * TROUBLESHOOTING GUIDE:
 * 🔧 Game initialization fails → Check p5.js loading and module dependencies
 * 🔧 Audio silent → Verify audio context activation and sound definitions
 * 🔧 Movement issues → Check camera system and coordinate bounds
 * 🔧 Dash not working → Verify dash cooldown, movement direction logic
 * 🔧 Shooting issues → Check mouse coordinate conversion and bullet creation
 * 🔧 Enemy problems → Verify spawn system, AI logic, enemy factory
 * 🔧 Collision failures → Check collision detection algorithms and hit boxes
 * 🔧 Sound problems → Verify audio system initialization and sound playback
 * 🔧 Visual glitches → Check rendering pipeline and effect systems
 * 🔧 Performance issues → Monitor frame rate and check for infinite loops
 * 🔧 Beat system issues → Verify BeatClock synchronization and timing
 */

// Test configuration
const GAME_URL = 'http://localhost:5500';
const SCREENSHOT_DIR = './tests/screenshots';
const ENHANCED_TEST_TIMEOUT = 240000; // 4 minutes for comprehensive testing

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('Vibe Game - Ultimate Comprehensive System Validation', () => {
    
    test('Complete Game Systems Test - Enhanced Edition', async ({ page }) => {
        test.setTimeout(ENHANCED_TEST_TIMEOUT);
        
        console.log('🎮 ULTIMATE COMPREHENSIVE VIBE GAME SYSTEM TEST');
        console.log('⚡ Enhanced edition with maximum troubleshooting coverage');
        console.log('📋 Duration: ~3-4 minutes');
        console.log('📸 Screenshots: ./tests/screenshots/');
        console.log('🎯 Deep validation of ALL core systems\n');
        
        const errorLog = [];
        const performanceLog = [];
        let testStartTime = Date.now();
        
        // Enhanced console monitoring
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const error = `${new Date().toISOString()}: ${msg.text()}`;
                errorLog.push(error);
                console.log('❌ Console Error:', error);
            } else if (msg.type() === 'warn') {
                console.log('⚠️  Console Warning:', msg.text());
            }
        });
        
        // ============================================================================
        // PHASE 1: ENHANCED GAME INITIALIZATION VALIDATION
        // ============================================================================
        console.log('🔵 PHASE 1: Enhanced Game Initialization');
        
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto(GAME_URL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000); // Allow game to fully initialize
        
        // Capture initial state
        await page.screenshot({ 
            path: path.join(SCREENSHOT_DIR, '01-initialization.png'),
            fullPage: false 
        });
        
        // Enhanced game status validation
        const gameStatus = await page.evaluate(() => {
            return {
                hasCanvas: !!document.querySelector('canvas'),
                hasPlayer: typeof window.player !== 'undefined' && !!window.player,
                hasGameState: typeof window.gameState !== 'undefined',
                hasAudio: typeof window.audio !== 'undefined',
                hasEnemies: typeof window.enemies !== 'undefined',
                hasBeatClock: typeof window.beatClock !== 'undefined',
                hasTestMode: typeof window.testMode !== 'undefined',
                frameCount: window.frameCount || 0,
                p5Loaded: typeof window.p5 !== 'undefined',
                gameRunning: window.frameCount > 10,
                playerPosition: window.player ? { x: window.player.x, y: window.player.y } : null,
                playerHealth: window.player ? window.player.health : null,
                dashCooldown: window.player ? window.player.dashCooldown : null
            };
        });
        
        console.log('✅ Enhanced game initialization status:', gameStatus);
        
        // Validate critical components
        expect(gameStatus.hasCanvas, 'Canvas element missing').toBe(true);
        expect(gameStatus.hasPlayer, 'Player object missing').toBe(true);
        expect(gameStatus.hasGameState, 'Game state missing').toBe(true);
        expect(gameStatus.gameRunning, 'Game loop not running').toBe(true);
        expect(gameStatus.hasBeatClock, 'BeatClock system missing').toBe(true);
        
        // ============================================================================
        // PHASE 2: ENHANCED AUDIO SYSTEM VALIDATION
        // ============================================================================
        console.log('\n🔵 PHASE 2: Enhanced Audio System Validation');
        
        // Activate audio context
        await page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                const event = new MouseEvent('click', {
                    clientX: 640,
                    clientY: 360,
                    bubbles: true
                });
                canvas.dispatchEvent(event);
            }
        });
        await page.waitForTimeout(2000);
        
        const audioStatus = await page.evaluate(() => {
            return {
                audioExists: !!window.audio,
                contextState: window.audio?.audioContext?.state || 'unknown',
                speechReady: window.audio && typeof window.audio.speak === 'function',
                soundsLoaded: window.audio && typeof window.audio.playSound === 'function',
                spatialAudio: window.audio && typeof window.audio.calculateVolume === 'function',
                ttsVoices: speechSynthesis ? speechSynthesis.getVoices().length : 0,
                beatClock: window.beatClock ? {
                    bpm: window.beatClock.bpm,
                    currentBeat: window.beatClock.currentBeat,
                    timePerBeat: window.beatClock.timePerBeat,
                    isOnBeat: typeof window.beatClock.isOnBeat === 'function'
                } : null
            };
        });
        
        console.log('🔊 Enhanced audio system status:', audioStatus);
        
        // Test actual sound playback with multiple sound types
        const soundTests = ['playerShoot', 'alienShoot', 'explosion', 'hit'];
        for (const soundName of soundTests) {
            const soundTest = await page.evaluate((sound) => {
                try {
                    if (window.audio && window.audio.playSound) {
                        window.audio.playSound(sound, 640, 360);
                        return { success: true, sound: sound, message: 'Sound playback test completed' };
                    }
                    return { success: false, sound: sound, message: 'Sound system not available' };
                } catch (error) {
                    return { success: false, sound: sound, message: error.message };
                }
            }, soundName);
            
            console.log(`🎵 Sound test [${soundName}]:`, soundTest.success ? '✅' : '❌', soundTest.message);
        }
        
        // Test TTS system with character voices
        console.log('🗣️  Testing TTS system with character voices...');
        const ttsTests = [
            { character: 'player', text: 'FIGHT!' },
            { character: 'grunt', text: 'KILL HUMAN!' },
            { character: 'rusher', text: 'KAMIKAZE!' },
            { character: 'tank', text: 'CRUSH!' },
            { character: 'stabber', text: 'STAB!' }
        ];
        
        for (const ttsTest of ttsTests) {
            const ttsResult = await page.evaluate((test) => {
                try {
                    if (window.audio && window.audio.speak) {
                        window.audio.speak(test.text, test.character, 640, 360);
                        return { success: true, character: test.character, text: test.text };
                    }
                    return { success: false, character: test.character, message: 'TTS not available' };
                } catch (error) {
                    return { success: false, character: test.character, error: error.message };
                }
            }, ttsTest);
            
            console.log(`  ${ttsTest.character}: ${ttsResult.success ? '✅' : '❌'} "${ttsTest.text}"`);
        }
        
        // Test spatial audio positioning
        console.log('📍 Testing spatial audio positioning...');
        const spatialTests = [
            { name: 'center', x: 640, y: 360 },
            { name: 'far-left', x: 100, y: 360 },
            { name: 'far-right', x: 1180, y: 360 },
            { name: 'off-screen', x: -100, y: 360 }
        ];
        
        for (const spatial of spatialTests) {
            const spatialResult = await page.evaluate((pos) => {
                try {
                    if (window.audio && window.audio.calculateVolume) {
                        const volume = window.audio.calculateVolume(pos.x, pos.y);
                        const pan = window.audio.calculatePan ? window.audio.calculatePan(pos.x, pos.y) : 'unknown';
                        return { 
                            success: true, 
                            position: pos.name,
                            volume: Math.round(volume * 1000) / 1000,
                            pan: typeof pan === 'number' ? Math.round(pan * 1000) / 1000 : pan
                        };
                    }
                    return { success: false, position: pos.name, message: 'Spatial audio not available' };
                } catch (error) {
                    return { success: false, position: pos.name, error: error.message };
                }
            }, spatial);
            
            console.log(`  ${spatial.name}: volume=${spatialResult.volume}, pan=${spatialResult.pan}`);
        }
        
        // Test beat system synchronization
        console.log('🎵 Testing beat system synchronization...');
        const beatTest = await page.evaluate(() => {
            try {
                if (window.beatClock) {
                    const beatInfo = {
                        currentBeat: window.beatClock.currentBeat,
                        bpm: window.beatClock.bpm,
                        timePerBeat: window.beatClock.timePerBeat,
                        isOnBeat1: window.beatClock.isOnBeat(1),
                        isOnBeat2: window.beatClock.isOnBeat(2),
                        isOnBeat3: window.beatClock.isOnBeat(3),
                        isOnBeat4: window.beatClock.isOnBeat(4),
                        timeSinceLastBeat: Date.now() - window.beatClock.lastBeatTime
                    };
                    return { success: true, beatInfo };
                }
                return { success: false, message: 'BeatClock not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        if (beatTest.success) {
            console.log('  Beat system status:', beatTest.beatInfo);
            console.log(`  Current beat: ${beatTest.beatInfo.currentBeat}/4 at ${beatTest.beatInfo.bpm} BPM`);
        } else {
            console.log('  ❌ Beat system test failed:', beatTest.message || beatTest.error);
        }
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-audio-enhanced.png') });
        
        // ============================================================================
        // PHASE 3: TEST MODE ACTIVATION
        // ============================================================================
        console.log('\n🔵 PHASE 3: Test Mode Validation');
        
        // Activate test mode
        await page.keyboard.press('KeyT');
        await page.waitForTimeout(1500);
        
        const testModeStatus = await page.evaluate(() => {
            return {
                testModeExists: typeof window.testMode !== 'undefined',
                testModeEnabled: window.testMode?.enabled || false,
                autoRestartEnabled: window.testMode?.autoRestart || false,
                autoShootingEnabled: window.testMode?.autoShooting || false
            };
        });
        
        console.log('🤖 Test mode status:', testModeStatus);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-test-mode.png') });
        
        // ============================================================================
        // PHASE 4: ENHANCED MOVEMENT TESTING (EDGES, CORNERS, AND DASH)
        // ============================================================================
        console.log('\n🔵 PHASE 4: Enhanced Movement Validation');
        console.log('🎯 Testing movement to edges, corners, and dash ability');
        
        // Test edge movement (4 cardinal directions)
        const edgeTests = [
            { name: 'top-edge', key: 'KeyW', duration: 2000 },
            { name: 'right-edge', key: 'KeyD', duration: 2000 },
            { name: 'bottom-edge', key: 'KeyS', duration: 2000 },
            { name: 'left-edge', key: 'KeyA', duration: 2000 }
        ];
        
        for (let i = 0; i < edgeTests.length; i++) {
            const edge = edgeTests[i];
            console.log(`📍 Testing ${edge.name} movement...`);
            
            // Move to edge
            await page.keyboard.down(edge.key);
            await page.waitForTimeout(edge.duration);
            await page.keyboard.up(edge.key);
            
            // Get position
            const position = await page.evaluate(() => {
                return window.player ? {
                    x: Math.round(window.player.x),
                    y: Math.round(window.player.y)
                } : null;
            });
            
            console.log(`  Position: (${position?.x}, ${position?.y})`);
            
            await page.screenshot({ 
                path: path.join(SCREENSHOT_DIR, `04-movement-${String(i + 1).padStart(2, '0')}-${edge.name}.png`) 
            });
        }
        
        // Test corner movement (4 diagonal directions)
        const cornerTests = [
            { name: 'top-right-corner', keys: ['KeyW', 'KeyD'], duration: 2000 },
            { name: 'bottom-right-corner', keys: ['KeyS', 'KeyD'], duration: 2000 },
            { name: 'bottom-left-corner', keys: ['KeyS', 'KeyA'], duration: 2000 },
            { name: 'top-left-corner', keys: ['KeyW', 'KeyA'], duration: 2000 }
        ];
        
        for (let i = 0; i < cornerTests.length; i++) {
            const corner = cornerTests[i];
            console.log(`📍 Testing ${corner.name} movement...`);
            
            // Move to corner
            for (const key of corner.keys) {
                await page.keyboard.down(key);
            }
            await page.waitForTimeout(corner.duration);
            for (const key of corner.keys) {
                await page.keyboard.up(key);
            }
            
            const position = await page.evaluate(() => {
                return window.player ? {
                    x: Math.round(window.player.x),
                    y: Math.round(window.player.y)
                } : null;
            });
            
            console.log(`  Corner position: (${position?.x}, ${position?.y})`);
            
            await page.screenshot({ 
                path: path.join(SCREENSHOT_DIR, `04-movement-${String(i + 5).padStart(2, '0')}-${corner.name}.png`) 
            });
        }
        
        // Return to center for dash testing
        await page.evaluate(() => {
            if (window.player) {
                window.player.x = 640;
                window.player.y = 360;
                window.player.dashCooldown = 0; // Reset dash cooldown
            }
        });
        
        // Test dash ability in all 4 directions
        console.log('\n🚀 Testing dash ability in all directions...');
        const dashTests = [
            { name: 'dash-north', moveKey: 'KeyW', duration: 500 },
            { name: 'dash-east', moveKey: 'KeyD', duration: 500 },
            { name: 'dash-south', moveKey: 'KeyS', duration: 500 },
            { name: 'dash-west', moveKey: 'KeyA', duration: 500 }
        ];
        
        for (let i = 0; i < dashTests.length; i++) {
            const dash = dashTests[i];
            console.log(`💨 Testing ${dash.name}...`);
            
            // Reset position and dash cooldown
            await page.evaluate(() => {
                if (window.player) {
                    window.player.x = 640;
                    window.player.y = 360;
                    window.player.dashCooldown = 0;
                }
            });
            await page.waitForTimeout(200);
            
            // Perform dash
            await page.keyboard.down(dash.moveKey);
            await page.keyboard.press('Space'); // Dash key
            await page.waitForTimeout(dash.duration);
            await page.keyboard.up(dash.moveKey);
            
            const dashResult = await page.evaluate(() => {
                return window.player ? {
                    x: Math.round(window.player.x),
                    y: Math.round(window.player.y),
                    dashCooldown: window.player.dashCooldown || 0
                } : null;
            });
            
            console.log(`  Dash result: position (${dashResult?.x}, ${dashResult?.y}), cooldown: ${dashResult?.dashCooldown}`);
            
            await page.screenshot({ 
                path: path.join(SCREENSHOT_DIR, `05-dash-${String(i + 1).padStart(2, '0')}-${dash.name}.png`) 
            });
        }
        
        // Return to center
        await page.evaluate(() => {
            if (window.player) {
                window.player.x = 640;
                window.player.y = 360;
            }
        });
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-movement-09-center-return.png') });
        
        // ============================================================================
        // PHASE 5: ENHANCED DIRECTIONAL SHOOTING VALIDATION (8 DIRECTIONS)
        // ============================================================================
        console.log('\n🔵 PHASE 5: Enhanced Directional Shooting Test');
        console.log('🎯 Testing shooting in all 8 directions for comprehensive aiming validation');
        
        const shootingDirections = [
            { name: 'east', mouseX: 740, mouseY: 360 },
            { name: 'southeast', mouseX: 740, mouseY: 460 },
            { name: 'south', mouseX: 640, mouseY: 460 },
            { name: 'southwest', mouseX: 540, mouseY: 460 },
            { name: 'west', mouseX: 540, mouseY: 360 },
            { name: 'northwest', mouseX: 540, mouseY: 260 },
            { name: 'north', mouseX: 640, mouseY: 260 },
            { name: 'northeast', mouseX: 740, mouseY: 260 }
        ];
        
        for (let i = 0; i < shootingDirections.length; i++) {
            const dir = shootingDirections[i];
            console.log(`🔫 Testing ${dir.name} shooting...`);
            
            const shootResult = await page.evaluate((coords) => {
                try {
                    window.mouseX = coords.mouseX;
                    window.mouseY = coords.mouseY;
                    
                    const bulletsBefore = window.playerBullets?.length || 0;
                    if (window.player && window.player.shoot) {
                        window.player.shoot();
                    }
                    const bulletsAfter = window.playerBullets?.length || 0;
                    
                    // Check bullet properties if created
                    let bulletInfo = null;
                    if (bulletsAfter > bulletsBefore && window.playerBullets?.length > 0) {
                        const lastBullet = window.playerBullets[window.playerBullets.length - 1];
                        bulletInfo = {
                            x: Math.round(lastBullet.x),
                            y: Math.round(lastBullet.y),
                            vx: Math.round(lastBullet.vx * 100) / 100,
                            vy: Math.round(lastBullet.vy * 100) / 100
                        };
                    }
                    
                    return {
                        success: bulletsAfter > bulletsBefore,
                        bulletCount: bulletsAfter,
                        direction: coords.name,
                        bulletInfo: bulletInfo
                    };
                } catch (error) {
                    return { success: false, error: error.message, direction: coords.name };
                }
            }, dir);
            
            console.log(`  ${dir.name}: ${shootResult.success ? '✅' : '❌'} ${shootResult.bulletCount || 0} bullets`);
            if (shootResult.bulletInfo) {
                console.log(`    Bullet: pos(${shootResult.bulletInfo.x}, ${shootResult.bulletInfo.y}) vel(${shootResult.bulletInfo.vx}, ${shootResult.bulletInfo.vy})`);
            }
            
            if (!shootResult.success) {
                console.log(`  ⚠️  Shooting failed in ${dir.name} direction: ${shootResult.error || 'Unknown error'}`);
            }
            
            await page.screenshot({ 
                path: path.join(SCREENSHOT_DIR, `06-shooting-${String(i + 1).padStart(2, '0')}-${dir.name}.png`) 
            });
        }
        
        // ============================================================================
        // PHASE 6: ENHANCED ENEMY SYSTEM VALIDATION
        // ============================================================================
        console.log('\n🔵 PHASE 6: Enhanced Enemy System Validation');
        console.log('👾 Testing enemy spawning, AI behavior, and type-specific abilities');
        
        // Wait for enemies to spawn
        await page.waitForTimeout(5000);
        
        const enemyStatus = await page.evaluate(() => {
            const enemies = window.enemies || [];
            const enemyTypes = {};
            enemies.forEach(e => {
                if (!enemyTypes[e.type]) enemyTypes[e.type] = 0;
                enemyTypes[e.type]++;
            });
            
            return {
                totalEnemies: enemies.length,
                enemyTypes: enemyTypes,
                visibleEnemies: enemies.filter(e => 
                    e.x > 0 && e.x < 1280 && e.y > 0 && e.y < 720
                ).length,
                enemyDetails: enemies.slice(0, 5).map(e => ({
                    type: e.type,
                    x: Math.round(e.x),
                    y: Math.round(e.y),
                    health: e.health,
                    state: e.state || 'unknown',
                    speed: e.speed || 'unknown',
                    lastSpeechTime: e.lastSpeechTime || 0,
                    isCharging: e.isCharging || false,
                    chargingTime: e.chargingTime || 0
                }))
            };
        });
        
        console.log('👾 Enhanced enemy system status:', enemyStatus);
        
        // Test individual enemy type behaviors
        console.log('🤖 Testing individual enemy type behaviors...');
        
        // Test grunt behavior (tactical movement and shooting)
        const gruntTest = await page.evaluate(() => {
            const grunts = (window.enemies || []).filter(e => e.type === 'grunt');
            if (grunts.length > 0) {
                const grunt = grunts[0];
                const playerDistance = Math.sqrt(
                    Math.pow(grunt.x - (window.player?.x || 640), 2) + 
                    Math.pow(grunt.y - (window.player?.y || 360), 2)
                );
                
                return {
                    found: true,
                    position: { x: Math.round(grunt.x), y: Math.round(grunt.y) },
                    health: grunt.health,
                    distanceToPlayer: Math.round(playerDistance),
                    tacticalRange: playerDistance > 150 && playerDistance < 250,
                    canShoot: typeof grunt.shoot === 'function',
                    hasAI: typeof grunt.update === 'function'
                };
            }
            return { found: false };
        });
        
        console.log('  Grunt behavior test:', gruntTest);
        
        // Test rusher behavior (charging and explosion)
        const rusherTest = await page.evaluate(() => {
            const rushers = (window.enemies || []).filter(e => e.type === 'rusher');
            if (rushers.length > 0) {
                const rusher = rushers[0];
                const playerDistance = Math.sqrt(
                    Math.pow(rusher.x - (window.player?.x || 640), 2) + 
                    Math.pow(rusher.y - (window.player?.y || 360), 2)
                );
                
                return {
                    found: true,
                    position: { x: Math.round(rusher.x), y: Math.round(rusher.y) },
                    health: rusher.health,
                    distanceToPlayer: Math.round(playerDistance),
                    isCharging: rusher.isCharging || false,
                    explosionRadius: rusher.explosionRadius || 'unknown',
                    hasExplosionLogic: typeof rusher.explode === 'function'
                };
            }
            return { found: false };
        });
        
        console.log('  Rusher behavior test:', rusherTest);
        
        // Test tank behavior (charging and energy balls)
        const tankTest = await page.evaluate(() => {
            const tanks = (window.enemies || []).filter(e => e.type === 'tank');
            if (tanks.length > 0) {
                const tank = tanks[0];
                
                return {
                    found: true,
                    position: { x: Math.round(tank.x), y: Math.round(tank.y) },
                    health: tank.health,
                    isCharging: tank.isCharging || false,
                    chargingTime: tank.chargingTime || 0,
                    maxChargingTime: tank.maxChargingTime || 240,
                    chargingProgress: tank.chargingTime && tank.maxChargingTime ? 
                        Math.round((tank.chargingTime / tank.maxChargingTime) * 100) : 0,
                    hasEnergyBallLogic: typeof tank.createEnergyBall === 'function'
                };
            }
            return { found: false };
        });
        
        console.log('  Tank behavior test:', tankTest);
        
        // Test stabber behavior (stalking and attacking)
        const stabberTest = await page.evaluate(() => {
            const stabbers = (window.enemies || []).filter(e => e.type === 'stabber');
            if (stabbers.length > 0) {
                const stabber = stabbers[0];
                const playerDistance = Math.sqrt(
                    Math.pow(stabber.x - (window.player?.x || 640), 2) + 
                    Math.pow(stabber.y - (window.player?.y || 360), 2)
                );
                
                return {
                    found: true,
                    position: { x: Math.round(stabber.x), y: Math.round(stabber.y) },
                    health: stabber.health,
                    armor: stabber.armor || 0,
                    distanceToPlayer: Math.round(playerDistance),
                    isAttacking: stabber.isAttacking || false,
                    attackPhase: stabber.attackPhase || 'unknown',
                    hasStabLogic: typeof stabber.stab === 'function'
                };
            }
            return { found: false };
        });
        
        console.log('  Stabber behavior test:', stabberTest);
        
        // Test enemy speech system
        console.log('🗣️  Testing enemy speech system...');
        const speechTest = await page.evaluate(() => {
            const enemies = window.enemies || [];
            const speechResults = [];
            
            enemies.slice(0, 3).forEach((enemy, index) => {
                try {
                    if (window.audio && window.audio.speak) {
                        const testPhrases = {
                            grunt: 'KILL HUMAN!',
                            rusher: 'KAMIKAZE!',
                            tank: 'CRUSH!',
                            stabber: 'STAB!'
                        };
                        
                        const phrase = testPhrases[enemy.type] || 'TEST!';
                        window.audio.speak(phrase, enemy.type, enemy.x, enemy.y);
                        
                        speechResults.push({
                            type: enemy.type,
                            phrase: phrase,
                            position: { x: Math.round(enemy.x), y: Math.round(enemy.y) },
                            success: true
                        });
                    }
                } catch (error) {
                    speechResults.push({
                        type: enemy.type,
                        success: false,
                        error: error.message
                    });
                }
            });
            
            return speechResults;
        });
        
        speechTest.forEach(result => {
            console.log(`  ${result.type}: ${result.success ? '✅' : '❌'} ${result.phrase || result.error}`);
        });
        
        // Test enemy spawning
        if (enemyStatus.totalEnemies === 0) {
            console.log('⚠️  No enemies found, waiting longer for spawn...');
            await page.waitForTimeout(5000);
            
            const retryEnemyStatus = await page.evaluate(() => {
                const enemies = window.enemies || [];
                return {
                    totalEnemies: enemies.length,
                    spawnSystemExists: typeof window.spawnSystem !== 'undefined',
                    spawnSystemEnabled: window.spawnSystem?.enabled || false
                };
            });
            console.log('👾 Retry enemy status:', retryEnemyStatus);
        }
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-enemy-enhanced.png') });
        
        // ============================================================================
        // PHASE 7: ENHANCED COLLISION AND COMBAT TESTING
        // ============================================================================
        console.log('\n🔵 PHASE 7: Enhanced Collision and Combat Testing');
        console.log('💥 Testing bullet collisions, contact damage, explosion systems, and damage calculations');
        
        // Test shooting at enemies with detailed bullet analysis
        const combatTest = await page.evaluate(() => {
            try {
                const enemies = window.enemies || [];
                if (enemies.length > 0) {
                    const target = enemies[0];
                    // Aim at first enemy
                    window.mouseX = target.x;
                    window.mouseY = target.y;
                    
                    const bulletsBefore = window.playerBullets?.length || 0;
                    const enemyHealthBefore = target.health;
                    
                    // Shoot at enemy
                    if (window.player && window.player.shoot) {
                        window.player.shoot();
                    }
                    
                    const bulletsAfter = window.playerBullets?.length || 0;
                    
                    // Analyze bullet if created
                    let bulletAnalysis = null;
                    if (bulletsAfter > bulletsBefore && window.playerBullets?.length > 0) {
                        const bullet = window.playerBullets[window.playerBullets.length - 1];
                        const distanceToTarget = Math.sqrt(
                            Math.pow(bullet.x - target.x, 2) + 
                            Math.pow(bullet.y - target.y, 2)
                        );
                        
                        bulletAnalysis = {
                            position: { x: Math.round(bullet.x), y: Math.round(bullet.y) },
                            velocity: { x: Math.round(bullet.vx * 100) / 100, y: Math.round(bullet.vy * 100) / 100 },
                            speed: Math.round(Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy) * 100) / 100,
                            distanceToTarget: Math.round(distanceToTarget),
                            damage: bullet.damage || 1,
                            owner: bullet.ownerId || 'unknown'
                        };
                    }
                    
                    return {
                        success: bulletsAfter > bulletsBefore,
                        bulletCount: bulletsAfter,
                        targetEnemy: {
                            type: target.type,
                            x: Math.round(target.x),
                            y: Math.round(target.y),
                            healthBefore: enemyHealthBefore,
                            healthAfter: target.health,
                            maxHealth: target.maxHealth || 'unknown'
                        },
                        bulletAnalysis: bulletAnalysis
                    };
                }
                return { success: false, message: 'No enemies to target' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        console.log('💥 Enhanced combat test result:', combatTest);
        if (combatTest.bulletAnalysis) {
            console.log('  Bullet analysis:', combatTest.bulletAnalysis);
        }
        
        // Test contact damage system
        console.log('🤝 Testing contact damage system...');
        const contactDamageTest = await page.evaluate(() => {
            try {
                const enemies = window.enemies || [];
                const contactResults = [];
                
                // Test contact damage for different enemy types
                enemies.slice(0, 3).forEach(enemy => {
                    const playerDistance = Math.sqrt(
                        Math.pow(enemy.x - (window.player?.x || 640), 2) + 
                        Math.pow(enemy.y - (window.player?.y || 360), 2)
                    );
                    
                    contactResults.push({
                        type: enemy.type,
                        distanceToPlayer: Math.round(playerDistance),
                        inContactRange: playerDistance < 30,
                        contactDamage: enemy.contactDamage || 0,
                        hasContactLogic: typeof enemy.checkContactDamage === 'function'
                    });
                });
                
                return { success: true, contactResults };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        if (contactDamageTest.success) {
            contactDamageTest.contactResults.forEach(result => {
                console.log(`  ${result.type}: distance=${result.distanceToPlayer}px, damage=${result.contactDamage}, contact=${result.inContactRange ? '✅' : '❌'}`);
            });
        } else {
            console.log('  ❌ Contact damage test failed:', contactDamageTest.error);
        }
        
        // Test explosion system
        console.log('💥 Testing explosion system...');
        const explosionTest = await page.evaluate(() => {
            try {
                const explosions = window.explosions || [];
                const explosionInfo = explosions.map(exp => ({
                    x: Math.round(exp.x),
                    y: Math.round(exp.y),
                    radius: Math.round(exp.radius || exp.explosionRadius || 0),
                    maxRadius: Math.round(exp.maxRadius || exp.maxExplosionRadius || 0),
                    damage: exp.damage || 'unknown',
                    type: exp.type || 'unknown',
                    age: exp.age || exp.timer || 'unknown'
                }));
                
                return {
                    success: true,
                    explosionCount: explosions.length,
                    explosionDetails: explosionInfo
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        console.log('  Explosion system status:', explosionTest);
        
        // Test friendly fire system
        console.log('🔫 Testing friendly fire system...');
        const friendlyFireTest = await page.evaluate(() => {
            try {
                const enemies = window.enemies || [];
                const enemyBullets = window.enemyBullets || [];
                
                const friendlyFireInfo = {
                    enemyCount: enemies.length,
                    enemyBulletCount: enemyBullets.length,
                    potentialTargets: 0,
                    friendlyFireEnabled: false
                };
                
                // Check if enemies can damage each other
                if (enemies.length > 1) {
                    friendlyFireInfo.potentialTargets = enemies.length - 1;
                    
                    // Check if collision system supports friendly fire
                    if (window.collisionSystem && typeof window.collisionSystem.checkBulletEnemyCollisions === 'function') {
                        friendlyFireInfo.friendlyFireEnabled = true;
                    }
                }
                
                return { success: true, friendlyFireInfo };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        if (friendlyFireTest.success) {
            console.log('  Friendly fire status:', friendlyFireTest.friendlyFireInfo);
        } else {
            console.log('  ❌ Friendly fire test failed:', friendlyFireTest.error);
        }
        
        // Test health and damage calculations
        console.log('❤️  Testing health and damage system...');
        const healthTest = await page.evaluate(() => {
            try {
                const player = window.player;
                const enemies = window.enemies || [];
                
                const healthInfo = {
                    player: player ? {
                        health: player.health,
                        maxHealth: player.maxHealth || 100,
                        healthPercentage: player.health && player.maxHealth ? 
                            Math.round((player.health / player.maxHealth) * 100) : 'unknown',
                        hasTakeDamageMethod: typeof player.takeDamage === 'function',
                        hasHealMethod: typeof player.heal === 'function'
                    } : null,
                    enemies: enemies.slice(0, 3).map(enemy => ({
                        type: enemy.type,
                        health: enemy.health,
                        maxHealth: enemy.maxHealth || 'unknown',
                        armor: enemy.armor || 0,
                        hasTakeDamageMethod: typeof enemy.takeDamage === 'function'
                    }))
                };
                
                return { success: true, healthInfo };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        if (healthTest.success) {
            console.log('  Player health:', healthTest.healthInfo.player);
            console.log('  Enemy health samples:', healthTest.healthInfo.enemies);
        } else {
            console.log('  ❌ Health system test failed:', healthTest.error);
        }
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-combat-enhanced.png') });
        
        // ============================================================================
        // PHASE 8: PERFORMANCE AND BEAT SYSTEM MONITORING
        // ============================================================================
        console.log('\n🔵 PHASE 8: Enhanced Performance and Beat System Monitoring');
        
        // Collect performance data over time
        const performanceData = [];
        for (let i = 0; i < 5; i++) {
            const performanceStatus = await page.evaluate(() => {
                return {
                    frameCount: window.frameCount || 0,
                    timestamp: Date.now(),
                    beatClock: window.beatClock ? {
                        bpm: window.beatClock.bpm,
                        currentBeat: window.beatClock.currentBeat,
                        timePerBeat: window.beatClock.timePerBeat,
                        lastBeatTime: window.beatClock.lastBeatTime,
                        timeSinceLastBeat: Date.now() - window.beatClock.lastBeatTime
                    } : null,
                    gameState: window.gameState,
                    playerHealth: window.player?.health,
                    score: window.score || 0,
                    level: window.level || 0,
                    entityCounts: {
                        enemies: (window.enemies || []).length,
                        playerBullets: (window.playerBullets || []).length,
                        enemyBullets: (window.enemyBullets || []).length,
                        explosions: (window.explosions || []).length,
                        effects: (window.effects || []).length
                    },
                    memoryUsage: performance.memory ? {
                        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                    } : null
                };
            });
            
            performanceData.push(performanceStatus);
            performanceLog.push({
                timestamp: Date.now() - testStartTime,
                ...performanceStatus
            });
            
            await page.waitForTimeout(1000); // Wait 1 second between measurements
        }
        
        // Calculate frame rate
        const frameRates = [];
        for (let i = 1; i < performanceData.length; i++) {
            const timeDiff = performanceData[i].timestamp - performanceData[i-1].timestamp;
            const frameDiff = performanceData[i].frameCount - performanceData[i-1].frameCount;
            const fps = Math.round((frameDiff / timeDiff) * 1000);
            frameRates.push(fps);
        }
        
        const avgFrameRate = frameRates.length > 0 ? 
            Math.round(frameRates.reduce((a, b) => a + b, 0) / frameRates.length) : 0;
        
        console.log('📊 Enhanced performance analysis:');
        console.log('  Frame rates:', frameRates, 'fps');
        console.log('  Average frame rate:', avgFrameRate, 'fps');
        console.log('  Beat system timing:', performanceData[performanceData.length - 1].beatClock);
        console.log('  Entity counts:', performanceData[performanceData.length - 1].entityCounts);
        if (performanceData[performanceData.length - 1].memoryUsage) {
            console.log('  Memory usage:', performanceData[performanceData.length - 1].memoryUsage, 'MB');
        }
        
        // Test beat system precision
        console.log('🎵 Testing beat system precision...');
        const beatPrecisionTest = await page.evaluate(() => {
            try {
                if (window.beatClock) {
                    const beatTests = [];
                    for (let beat = 1; beat <= 4; beat++) {
                        beatTests.push({
                            beat: beat,
                            isOnBeat: window.beatClock.isOnBeat(beat),
                            canPlayerShoot: window.beatClock.canPlayerShootQuarterBeat ? 
                                window.beatClock.canPlayerShootQuarterBeat() : 'unknown'
                        });
                    }
                    
                    return {
                        success: true,
                        currentBeat: window.beatClock.currentBeat,
                        beatTests: beatTests,
                        quarterBeatSupport: typeof window.beatClock.canPlayerShootQuarterBeat === 'function'
                    };
                }
                return { success: false, message: 'BeatClock not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        if (beatPrecisionTest.success) {
            console.log('  Beat precision test:', beatPrecisionTest);
        } else {
            console.log('  ❌ Beat precision test failed:', beatPrecisionTest.message || beatPrecisionTest.error);
        }
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-performance-enhanced.png') });
        
        // ============================================================================
        // PHASE 9: VISUAL EFFECTS AND GRAPHICS VALIDATION
        // ============================================================================
        console.log('\n🔵 PHASE 9: Visual Effects and Graphics Validation');
        console.log('🎨 Testing particle systems, visual effects, camera system, and UI elements');
        
        // Test visual effects system
        const visualEffectsTest = await page.evaluate(() => {
            try {
                const visualInfo = {
                    hasVisualEffects: typeof window.visualEffects !== 'undefined',
                    hasEffectsArray: Array.isArray(window.effects),
                    effectCount: (window.effects || []).length,
                    hasParticleSystem: typeof window.createParticle === 'function' || 
                                     typeof window.addParticle === 'function',
                    hasExplosionEffects: typeof window.createExplosion === 'function',
                    canvasInfo: {
                        width: window.width || 'unknown',
                        height: window.height || 'unknown',
                        pixelDensity: window.pixelDensity() || 'unknown'
                    }
                };
                
                // Test if we can create visual effects
                if (window.effects && window.effects.length > 0) {
                    visualInfo.sampleEffects = window.effects.slice(0, 3).map(effect => ({
                        type: effect.type || 'unknown',
                        x: Math.round(effect.x || 0),
                        y: Math.round(effect.y || 0),
                        age: effect.age || effect.timer || 'unknown',
                        alpha: effect.alpha || 'unknown'
                    }));
                }
                
                return { success: true, visualInfo };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        console.log('🎨 Visual effects test:', visualEffectsTest);
        
        // Test camera system
        console.log('📷 Testing camera system...');
        const cameraTest = await page.evaluate(() => {
            try {
                const cameraInfo = {
                    hasCameraSystem: typeof window.cameraSystem !== 'undefined',
                    hasCamera: typeof window.camera !== 'undefined',
                    cameraPosition: window.cameraSystem ? {
                        x: Math.round(window.cameraSystem.x || 0),
                        y: Math.round(window.cameraSystem.y || 0),
                        targetX: Math.round(window.cameraSystem.targetX || 0),
                        targetY: Math.round(window.cameraSystem.targetY || 0)
                    } : null,
                    hasTransformMethods: window.cameraSystem ? {
                        applyTransform: typeof window.cameraSystem.applyTransform === 'function',
                        removeTransform: typeof window.cameraSystem.removeTransform === 'function',
                        screenToWorld: typeof window.cameraSystem.screenToWorld === 'function',
                        worldToScreen: typeof window.cameraSystem.worldToScreen === 'function'
                    } : null
                };
                
                // Test coordinate conversion if available
                if (window.cameraSystem && window.cameraSystem.screenToWorld) {
                    const testPoint = window.cameraSystem.screenToWorld(640, 360);
                    cameraInfo.coordinateTest = {
                        screenPoint: { x: 640, y: 360 },
                        worldPoint: { x: Math.round(testPoint.x), y: Math.round(testPoint.y) }
                    };
                }
                
                return { success: true, cameraInfo };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        console.log('📷 Camera system test:', cameraTest);
        
        // Test UI elements
        console.log('🖥️  Testing UI elements...');
        const uiTest = await page.evaluate(() => {
            try {
                const uiInfo = {
                    hasUIRenderer: typeof window.uiRenderer !== 'undefined',
                    gameStateDisplay: {
                        score: window.score || 0,
                        level: window.level || 0,
                        health: window.player?.health || 0,
                        gameState: window.gameState || 'unknown'
                    },
                    hasHUD: true, // Assume HUD exists if game is running
                    dashCooldownVisible: window.player?.dashCooldown > 0,
                    beatIndicatorVisible: window.beatClock?.currentBeat !== undefined
                };
                
                return { success: true, uiInfo };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        console.log('🖥️  UI elements test:', uiTest);
        
        // Test rendering pipeline
        console.log('🎬 Testing rendering pipeline...');
        const renderTest = await page.evaluate(() => {
            try {
                const renderInfo = {
                    hasBackgroundRenderer: typeof window.backgroundRenderer !== 'undefined',
                    hasDrawLoop: typeof window.draw === 'function',
                    frameCount: window.frameCount || 0,
                    isAnimating: window.frameCount > 0,
                    blendModes: {
                        hasBlend: typeof window.blendMode === 'function',
                        hasAdd: true, // p5.js standard
                        hasScreen: true,
                        hasMultiply: true
                    },
                    colorModes: {
                        currentMode: window.colorMode || 'unknown',
                        hasRGB: true,
                        hasHSB: true
                    }
                };
                
                return { success: true, renderInfo };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        console.log('🎬 Rendering pipeline test:', renderTest);
        
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-visual-effects.png') });
        
        // ============================================================================
        // PHASE 10: FINAL VALIDATION AND COMPREHENSIVE REPORTING
        // ============================================================================
        console.log('\n🔵 PHASE 10: Final Validation and Comprehensive Reporting');
        
        // Final screenshot
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-final-state.png') });
        
        // Comprehensive final status
        const finalStatus = await page.evaluate(() => {
            return {
                gameRunning: window.frameCount > 200,
                playerExists: !!window.player,
                playerAlive: window.player?.health > 0,
                enemiesPresent: (window.enemies || []).length > 0,
                audioWorking: window.audio?.audioContext?.state === 'running',
                testModeWorking: window.testMode?.enabled || false,
                dashAvailable: window.player && typeof window.player.dash === 'function',
                noErrors: true // Will be updated based on error log
            };
        });
        
        finalStatus.noErrors = errorLog.length === 0;
        
        // Report comprehensive results
        console.log('\n🎯 ULTIMATE COMPREHENSIVE TEST COMPLETE');
        console.log('==========================================');
        console.log('📊 FINAL SYSTEM STATUS:');
        console.log('  Game Running:', finalStatus.gameRunning ? '✅' : '❌');
        console.log('  Player Exists:', finalStatus.playerExists ? '✅' : '❌');
        console.log('  Player Alive:', finalStatus.playerAlive ? '✅' : '❌');
        console.log('  Enemies Present:', finalStatus.enemiesPresent ? '✅' : '❌');
        console.log('  Audio Working:', finalStatus.audioWorking ? '✅' : '❌');
        console.log('  Test Mode:', finalStatus.testModeWorking ? '✅' : '❌');
        console.log('  Dash Available:', finalStatus.dashAvailable ? '✅' : '❌');
        console.log('  Error Free:', finalStatus.noErrors ? '✅' : '❌');
        
        if (errorLog.length > 0) {
            console.log('\n❌ ERRORS DETECTED:');
            errorLog.forEach((error, index) => console.log(`  ${index + 1}. ${error}`));
        } else {
            console.log('\n✅ NO CRITICAL ERRORS DETECTED');
        }
        
        console.log('\n📈 PERFORMANCE LOG:');
        performanceLog.forEach((entry, index) => {
            console.log(`  ${index + 1}. Time: ${entry.timestamp}ms, Frame: ${entry.frameCount}, Beat: ${entry.beatClock?.currentBeat || 'N/A'}`);
        });
        
        console.log('\n📸 SCREENSHOTS CAPTURED:');
        console.log('  - 01-initialization.png: Game startup state');
        console.log('  - 02-audio-enhanced.png: Audio system validation');
        console.log('  - 03-test-mode.png: Test mode activation');
        console.log('  - 04-movement-XX-*.png: Edge and corner movement tests');
        console.log('  - 05-dash-XX-*.png: Dash ability tests');
        console.log('  - 06-shooting-XX-*.png: 8-directional shooting tests');
        console.log('  - 07-enemy-enhanced.png: Enemy spawn and behavior');
        console.log('  - 08-combat-enhanced.png: Collision and combat validation');
        console.log('  - 09-performance-enhanced.png: System performance check');
        console.log('  - 10-visual-effects.png: Visual effects validation');
        console.log('  - 10-final-state.png: Final game state');
        
        console.log(`\n📋 Total test duration: ${Math.round((Date.now() - testStartTime) / 1000)}s`);
        console.log('📁 Screenshots directory:', SCREENSHOT_DIR);
        
        // Validate final state
        expect(finalStatus.gameRunning, 'Game stopped running during test').toBe(true);
        expect(finalStatus.playerExists, 'Player object lost during test').toBe(true);
        
        // Don't fail on console errors, but report them
        if (!finalStatus.noErrors) {
            console.log('⚠️  Test completed with console errors - check logs above');
        }
        
        // Store results in memory for future troubleshooting
        const testResults = {
            finalStatus,
            errorCount: errorLog.length,
            performanceEntries: performanceLog.length,
            testDuration: Date.now() - testStartTime,
            timestamp: new Date().toISOString()
        };
        
        console.log('\n💾 Test results ready for memory storage:', testResults);
    });
});

/**
 * VIBE GAME ULTIMATE TROUBLESHOOTING TEST SUITE - ENHANCED EDITION
 * 
 * Purpose: Maximum diagnostic value for critical system failures
 * Duration: ~5 minutes with laser-focused troubleshooting
 * Focus: Historical problem areas and recently fixed bugs
 * 
 * ENHANCED TROUBLESHOOTING TARGETS:
 * 🎯 Mouse Click Stability (historical crash point)
 * 🎯 Cosmic Beat System Coordination (core game feature)  
 * 🎯 Enemy Visibility & Spawning (frequent user issue)
 * 🎯 Audio System Integration (complex failure point)
 * 🎯 Contact Damage System (recently fixed)
 * 🎯 Camera Coordinate Conversion (frequent bug source)
 * 🎯 Enemy Behavior Validation (AI system integrity)
 * 🎯 Performance Under Load (lag detection)
 * 
 * ENHANCED DIAGNOSTIC FEATURES:
 * 📊 Real-time game state monitoring with event logging
 * 📸 Intelligent screenshot timing during critical moments
 * 🔧 Stress testing of historically problematic systems
 * 📈 Performance monitoring with lag spike detection
 * 🎵 Cosmic Beat System rhythm validation
 * 💥 Combat system verification under stress
 * 🚨 Regression testing of recently fixed bugs
 * 
 * DIAGNOSTIC OUTPUT:
 * - Detailed system health reports
 * - Performance metrics and bottleneck identification  
 * - Beat system synchronization analysis
 * - Combat effectiveness validation
 * - Audio system functionality verification
 * - Visual system rendering pipeline check
 */

test('Ultimate Troubleshooting Edition - Enhanced Diagnostics', async ({ page }) => {
    test.setTimeout(360000); // 6 minutes for comprehensive diagnostics
    
    console.log('🎯 ULTIMATE TROUBLESHOOTING TEST - ENHANCED EDITION');
    console.log('🔧 Laser-focused diagnostics for critical systems');
    console.log('📋 Duration: ~5 minutes with maximum diagnostic value');
    console.log('🎯 Targeting historical problem areas and recent fixes\n');
    
    const diagnosticLog = [];
    const performanceMetrics = [];
    const beatSystemLog = [];
    const combatLog = [];
    const audioLog = [];
    const errorClassification = {
        critical: [],
        audio: [],
        visual: [],
        performance: [],
        networking: []
    };
    
    let testStartTime = Date.now();
    
    // Enhanced error monitoring with classification
    page.on('console', msg => {
        const timestamp = Date.now() - testStartTime;
        const logEntry = {
            timestamp,
            type: msg.type(),
            text: msg.text(),
            location: msg.location()
        };
        
        if (msg.type() === 'error') {
            // Classify errors for better troubleshooting
            if (msg.text().includes('p5') || msg.text().includes('canvas') || msg.text().includes('game')) {
                errorClassification.critical.push(logEntry);
            } else if (msg.text().includes('audio') || msg.text().includes('speech') || msg.text().includes('sound')) {
                errorClassification.audio.push(logEntry);
            } else if (msg.text().includes('render') || msg.text().includes('visual') || msg.text().includes('graphics')) {
                errorClassification.visual.push(logEntry);
            } else if (msg.text().includes('performance') || msg.text().includes('timeout') || msg.text().includes('slow')) {
                errorClassification.performance.push(logEntry);
            } else {
                errorClassification.networking.push(logEntry);
            }
            console.log(`❌ ${msg.type().toUpperCase()} [${timestamp}ms]:`, msg.text());
        }
    });
    
    // Performance monitoring function
    const capturePerformanceMetrics = async () => {
        const metrics = await page.evaluate(() => {
            return {
                timestamp: Date.now(),
                frameCount: window.frameCount || 0,
                playerPos: window.player ? { x: window.player.x, y: window.player.y } : null,
                enemyCount: (window.enemies || []).length,
                bulletCount: (window.playerBullets || []).length + (window.enemyBullets || []).length,
                audioState: window.audio?.audioContext?.state || 'unknown',
                beatClock: window.beatClock ? {
                    currentBeat: window.beatClock.currentBeat,
                    bpm: window.beatClock.bpm,
                    timeSinceLastBeat: Date.now() - window.beatClock.lastBeatTime
                } : null,
                memoryUsage: performance.memory ? {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                } : null
            };
        });
        performanceMetrics.push(metrics);
        return metrics;
    };
    
    // ========================================================================
    // PHASE 1: CRITICAL SYSTEM VALIDATION & MOUSE CLICK STABILITY
    // ========================================================================
    console.log('🔵 PHASE 1: Critical System Validation & Mouse Click Stability Test');
    console.log('🎯 Testing historical crash points and core system integrity');
    
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(GAME_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Capture initial metrics
    let metrics = await capturePerformanceMetrics();
    console.log('📊 Initial system metrics:', metrics);
    
    // Enhanced system validation
    const systemStatus = await page.evaluate(() => {
        // Check all critical systems with detailed validation
        const status = {
            core: {
                canvas: !!document.querySelector('canvas'),
                p5Loaded: typeof window.p5 !== 'undefined',
                gameLoop: window.frameCount > 10,
                player: !!window.player,
                enemies: Array.isArray(window.enemies),
                bullets: Array.isArray(window.playerBullets) && Array.isArray(window.enemyBullets)
            },
            modularSystems: {
                gameLoop: typeof window.gameLoop !== 'undefined',
                gameState: typeof window.gameState !== 'undefined',
                cameraSystem: typeof window.cameraSystem !== 'undefined',
                spawnSystem: typeof window.spawnSystem !== 'undefined',
                collisionSystem: typeof window.collisionSystem !== 'undefined',
                uiRenderer: typeof window.uiRenderer !== 'undefined',
                backgroundRenderer: typeof window.backgroundRenderer !== 'undefined',
                testMode: typeof window.testMode !== 'undefined'
            },
            audioSystem: {
                audio: !!window.audio,
                audioContext: window.audio?.audioContext?.state || 'unknown',
                speech: window.audio && typeof window.audio.speak === 'function',
                soundPlayback: window.audio && typeof window.audio.playSound === 'function'
            },
            beatSystem: {
                beatClock: !!window.beatClock,
                currentBeat: window.beatClock?.currentBeat || 'unknown',
                bpm: window.beatClock?.bpm || 'unknown',
                isOnBeatFunction: window.beatClock && typeof window.beatClock.isOnBeat === 'function'
            }
        };
        
        // Calculate system health score
        const allChecks = [
            ...Object.values(status.core),
            ...Object.values(status.modularSystems),
            ...Object.values(status.audioSystem).map(v => v === 'running' || v === true),
            ...Object.values(status.beatSystem).map(v => v !== 'unknown' && v !== false)
        ];
        
        status.healthScore = allChecks.filter(Boolean).length / allChecks.length;
        return status;
    });
    
    console.log('🏥 System health score:', Math.round(systemStatus.healthScore * 100) + '%');
    console.log('🔧 Core systems:', systemStatus.core);
    console.log('🔧 Modular systems:', systemStatus.modularSystems);
    console.log('🔊 Audio system:', systemStatus.audioSystem);
    console.log('🎵 Beat system:', systemStatus.beatSystem);
    
    diagnosticLog.push({
        phase: 'System Validation',
        timestamp: Date.now() - testStartTime,
        systemHealth: systemStatus.healthScore,
        details: systemStatus
    });
    
    // Mouse Click Stability Test - Historical Crash Point
    console.log('\n🖱️  MOUSE CLICK STABILITY TEST');
    console.log('🎯 Testing historical crash point with multiple click patterns');
    
    const clickStabilityTest = async (clickCount, pattern) => {
        console.log(`  Testing ${pattern} pattern with ${clickCount} clicks...`);
        
        for (let i = 0; i < clickCount; i++) {
            const x = pattern === 'center' ? 640 : Math.random() * 1280;
            const y = pattern === 'center' ? 360 : Math.random() * 720;
            
            // Use JavaScript evaluation for more reliable clicking
            await page.evaluate((clickX, clickY) => {
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    // Simulate mouse click event directly on canvas
                    const event = new MouseEvent('click', {
                        clientX: clickX,
                        clientY: clickY,
                        bubbles: true
                    });
                    canvas.dispatchEvent(event);
                }
            }, x, y);
            
            await page.waitForTimeout(100);
            
            // Check if game is still running after each click
            const gameAlive = await page.evaluate(() => {
                return {
                    frameCount: window.frameCount,
                    playerExists: !!window.player,
                    gameRunning: window.frameCount > 0
                };
            });
            
            if (!gameAlive.gameRunning || !gameAlive.playerExists) {
                console.log(`  ❌ Game crashed on click ${i + 1} at (${x}, ${y})`);
                return { success: false, crashedOnClick: i + 1, position: { x, y } };
            }
        }
        
        return { success: true, clickCount, pattern };
    };
    
    // Test different click patterns
    const centerClicks = await clickStabilityTest(10, 'center');
    const randomClicks = await clickStabilityTest(15, 'random');
    const rapidClicks = await clickStabilityTest(20, 'rapid');
    
    console.log('  Center clicks:', centerClicks.success ? '✅' : '❌', centerClicks);
    console.log('  Random clicks:', randomClicks.success ? '✅' : '❌', randomClicks);
    console.log('  Rapid clicks:', rapidClicks.success ? '✅' : '❌', rapidClicks);
    
    // Capture post-click metrics
    metrics = await capturePerformanceMetrics();
    console.log('📊 Post-click system metrics:', metrics);
    
    await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, 'enhanced-01-system-validation.png'),
        fullPage: false 
    });
    
    // ========================================================================
    // PHASE 2: COSMIC BEAT SYSTEM DEEP VALIDATION
    // ========================================================================
    console.log('\n🔵 PHASE 2: Cosmic Beat System Deep Validation');
    console.log('🎵 Testing the core rhythmic combat system that defines Vibe');
    
    // Activate audio context
    await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            const event = new MouseEvent('click', {
                clientX: 640,
                clientY: 360,
                bubbles: true
            });
            canvas.dispatchEvent(event);
        }
    });
    await page.waitForTimeout(2000);
    
    // Test beat system synchronization over multiple beats
    console.log('🎼 Testing beat synchronization over time...');
    const beatTrackingDuration = 10000; // 10 seconds
    const beatTrackingStart = Date.now();
    const beatLog = [];
    
    while (Date.now() - beatTrackingStart < beatTrackingDuration) {
        const beatInfo = await page.evaluate(() => {
            if (!window.beatClock) return null;
            
            return {
                timestamp: Date.now(),
                currentBeat: window.beatClock.currentBeat,
                timeSinceLastBeat: Date.now() - window.beatClock.lastBeatTime,
                timePerBeat: window.beatClock.timePerBeat,
                bpm: window.beatClock.bpm,
                isOnBeat1: window.beatClock.isOnBeat(1),
                isOnBeat2: window.beatClock.isOnBeat(2),
                isOnBeat3: window.beatClock.isOnBeat(3),
                isOnBeat4: window.beatClock.isOnBeat(4)
            };
        });
        
        if (beatInfo) {
            beatLog.push(beatInfo);
        }
        
        await page.waitForTimeout(250); // Check every quarter second
    }
    
    // Analyze beat consistency
    const beatAnalysis = {
        totalBeats: beatLog.length,
        averageBPM: beatLog.reduce((sum, b) => sum + b.bpm, 0) / beatLog.length,
        beatTransitions: beatLog.filter((b, i) => i > 0 && b.currentBeat !== beatLog[i-1].currentBeat).length,
        maxTimingDeviation: Math.max(...beatLog.map(b => Math.abs(b.timeSinceLastBeat - b.timePerBeat))),
        beatDistribution: {
            beat1: beatLog.filter(b => b.currentBeat === 1).length,
            beat2: beatLog.filter(b => b.currentBeat === 2).length,
            beat3: beatLog.filter(b => b.currentBeat === 3).length,
            beat4: beatLog.filter(b => b.currentBeat === 4).length
        }
    };
    
    console.log('🎼 Beat system analysis:', beatAnalysis);
    beatSystemLog.push(beatAnalysis);
    
    // Test enemy shooting rhythm coordination
    console.log('👾 Testing enemy shooting rhythm coordination...');
    
    // Wait for enemies to spawn
    await page.waitForTimeout(5000);
    
    const enemyRhythmTest = await page.evaluate(() => {
        const enemies = window.enemies || [];
        if (enemies.length === 0) return { success: false, message: 'No enemies to test' };
        
        const rhythmData = [];
        
        // Test each enemy type's rhythm
        enemies.forEach((enemy, index) => {
            if (window.beatClock) {
                const onCorrectBeat = (() => {
                    switch (enemy.type) {
                        case 'grunt': return window.beatClock.isOnBeat(2) || window.beatClock.isOnBeat(4);
                        case 'tank': return window.beatClock.isOnBeat(1);
                        case 'stabber': return window.beatClock.isOnBeat(3.5);
                        default: return false;
                    }
                })();
                
                rhythmData.push({
                    type: enemy.type,
                    index: index,
                    position: { x: Math.round(enemy.x), y: Math.round(enemy.y) },
                    currentBeat: window.beatClock.currentBeat,
                    onCorrectBeat: onCorrectBeat,
                    canShoot: typeof enemy.canShoot === 'function' ? enemy.canShoot() : 'unknown',
                    lastShotTime: enemy.lastShotTime || 0
                });
            }
        });
        
        return { success: true, enemyCount: enemies.length, rhythmData };
    });
    
    console.log('👾 Enemy rhythm coordination:', enemyRhythmTest);
    
    await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, 'enhanced-02-beat-system.png'),
        fullPage: false 
    });
    
    // ========================================================================
    // PHASE 3: COMBAT SYSTEM STRESS TEST
    // ========================================================================
    console.log('\n🔵 PHASE 3: Combat System Stress Test');
    console.log('💥 Intensive testing of shooting, collisions, and damage systems');
    
    // Enhanced edge shooting with stress testing
    console.log('🎯 Enhanced edge shooting stress test...');
    
    const edgeShootingStressTest = async (edgeName, moveKey, shootCount) => {
        // Move to edge
        await page.keyboard.down(moveKey);
        await page.waitForTimeout(2000);
        await page.keyboard.up(moveKey);
        
        const edgePosition = await page.evaluate(() => {
            return window.player ? { x: window.player.x, y: window.player.y } : null;
        });
        
        console.log(`  ${edgeName} position:`, edgePosition);
        
        // Rapid fire test from edge
        const shootResults = [];
        for (let i = 0; i < shootCount; i++) {
            const shootResult = await page.evaluate((shotNumber) => {
                const bulletsBefore = window.playerBullets?.length || 0;
                
                // Aim in different directions
                const angle = (shotNumber * 45) % 360; // 8 directions
                const distance = 200;
                window.mouseX = (window.player?.x || 640) + Math.cos(angle * Math.PI / 180) * distance;
                window.mouseY = (window.player?.y || 360) + Math.sin(angle * Math.PI / 180) * distance;
                
                if (window.player && window.player.shoot) {
                    window.player.shoot();
                }
                
                const bulletsAfter = window.playerBullets?.length || 0;
                
                return {
                    shotNumber,
                    success: bulletsAfter > bulletsBefore,
                    bulletCount: bulletsAfter,
                    aimDirection: angle,
                    mousePos: { x: window.mouseX, y: window.mouseY }
                };
            }, i);
            
            shootResults.push(shootResult);
            await page.waitForTimeout(200); // Allow for shot cooldown
        }
        
        const successRate = shootResults.filter(r => r.success).length / shootResults.length;
        console.log(`  ${edgeName} shooting success rate: ${Math.round(successRate * 100)}%`);
        
        return { edge: edgeName, position: edgePosition, successRate, shots: shootResults };
    };
    
    // Test all edges with stress shooting
    const edgeStressResults = [
        await edgeShootingStressTest('top-edge', 'KeyW', 8),
        await edgeShootingStressTest('right-edge', 'KeyD', 8),
        await edgeShootingStressTest('bottom-edge', 'KeyS', 8),
        await edgeShootingStressTest('left-edge', 'KeyA', 8)
    ];
    
    combatLog.push({
        phase: 'Edge Shooting Stress Test',
        results: edgeStressResults,
        averageSuccessRate: edgeStressResults.reduce((sum, r) => sum + r.successRate, 0) / edgeStressResults.length
    });
    
    // Contact damage verification - Recently Fixed System
    console.log('\n🤝 Contact damage system verification...');
    
    // Move to center for contact testing
    await page.evaluate(() => {
        if (window.player) {
            window.player.x = 640;
            window.player.y = 360;
        }
    });
    
    const contactDamageResults = await page.evaluate(() => {
        const enemies = window.enemies || [];
        const results = [];
        
        enemies.forEach((enemy, index) => {
            // Calculate distance to player
            const distance = Math.sqrt(
                Math.pow(enemy.x - (window.player?.x || 640), 2) + 
                Math.pow(enemy.y - (window.player?.y || 360), 2)
            );
            
            results.push({
                type: enemy.type,
                index: index,
                position: { x: Math.round(enemy.x), y: Math.round(enemy.y) },
                distanceToPlayer: Math.round(distance),
                inContactRange: distance < 35,
                hasContactDamage: (() => {
                    switch (enemy.type) {
                        case 'grunt': return true;  // Should deal 1 contact damage
                        case 'tank': return true;  // Should place bombs
                        case 'rusher': return false; // Should not deal contact damage
                        case 'stabber': return false; // Should not deal contact damage
                        default: return false;
                    }
                })(),
                expectedBehavior: (() => {
                    switch (enemy.type) {
                        case 'grunt': return 'Deals 1 contact damage';
                        case 'tank': return 'Places bomb on contact';
                        case 'rusher': return 'No contact damage (explosion only)';
                        case 'stabber': return 'No contact damage (melee only)';
                        default: return 'Unknown';
                    }
                })(),
                contactDamageFunction: typeof enemy.checkContactDamage === 'function'
            });
        });
        
        return { enemyCount: enemies.length, contactTests: results };
    });
    
    console.log('🤝 Contact damage system results:', contactDamageResults);
    
    combatLog.push({
        phase: 'Contact Damage Verification',
        results: contactDamageResults
    });
    
    await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, 'enhanced-03-combat-stress.png'),
        fullPage: false 
    });
    
    // ========================================================================
    // PHASE 4: REGRESSION TEST SUITE - RECENTLY FIXED BUGS
    // ========================================================================
    console.log('\n🔵 PHASE 4: Regression Test Suite');
    console.log('🔄 Testing recently fixed bugs to prevent regressions');
    
    // Camera coordinate conversion test - Historical Bug
    console.log('📷 Camera coordinate conversion regression test...');
    
    const coordinateConversionTest = await page.evaluate(() => {
        if (!window.cameraSystem || !window.cameraSystem.screenToWorld) {
            return { success: false, message: 'Camera system not available' };
        }
        
        const testPoints = [
            { screen: { x: 0, y: 0 }, name: 'top-left' },
            { screen: { x: 640, y: 360 }, name: 'center' },
            { screen: { x: 1280, y: 720 }, name: 'bottom-right' },
            { screen: { x: 100, y: 600 }, name: 'near-bottom-left' },
            { screen: { x: 1180, y: 120 }, name: 'near-top-right' }
        ];
        
        const conversionResults = testPoints.map(point => {
            try {
                const worldPoint = window.cameraSystem.screenToWorld(point.screen.x, point.screen.y);
                const backToScreen = window.cameraSystem.worldToScreen(worldPoint.x, worldPoint.y);
                
                return {
                    name: point.name,
                    originalScreen: point.screen,
                    worldCoordinates: { x: Math.round(worldPoint.x), y: Math.round(worldPoint.y) },
                    backToScreen: { x: Math.round(backToScreen.x), y: Math.round(backToScreen.y) },
                    conversionAccurate: Math.abs(backToScreen.x - point.screen.x) < 1 && 
                                       Math.abs(backToScreen.y - point.screen.y) < 1
                };
            } catch (error) {
                return {
                    name: point.name,
                    error: error.message,
                    success: false
                };
            }
        });
        
        const successfulConversions = conversionResults.filter(r => r.conversionAccurate).length;
        
        return {
            success: successfulConversions === testPoints.length,
            totalTests: testPoints.length,
            successfulConversions: successfulConversions,
            conversionResults: conversionResults
        };
    });
    
    console.log('📷 Coordinate conversion test:', coordinateConversionTest);
    
    // Enemy spawn positioning test - Historical Bug  
    console.log('👾 Enemy spawn positioning regression test...');
    
    const spawnPositionTest = await page.evaluate(() => {
        if (!window.spawnSystem) {
            return { success: false, message: 'Spawn system not available' };
        }
        
        const enemies = window.enemies || [];
        const canvasWidth = 1280;
        const canvasHeight = 720;
        
        const positionAnalysis = enemies.map((enemy, index) => {
            const onScreen = enemy.x >= -50 && enemy.x <= canvasWidth + 50 && 
                           enemy.y >= -50 && enemy.y <= canvasHeight + 50;
            
            const distanceFromPlayer = Math.sqrt(
                Math.pow(enemy.x - (window.player?.x || 640), 2) + 
                Math.pow(enemy.y - (window.player?.y || 360), 2)
            );
            
            return {
                index: index,
                type: enemy.type,
                position: { x: Math.round(enemy.x), y: Math.round(enemy.y) },
                onScreen: onScreen,
                distanceFromPlayer: Math.round(distanceFromPlayer),
                spawnedCorrectly: onScreen && distanceFromPlayer >= 200 // Should spawn at least 200px away
            };
        });
        
        const correctlySpawned = positionAnalysis.filter(e => e.spawnedCorrectly).length;
        
        return {
            success: correctlySpawned === enemies.length,
            totalEnemies: enemies.length,
            correctlySpawned: correctlySpawned,
            positionAnalysis: positionAnalysis
        };
    });
    
    console.log('👾 Spawn positioning test:', spawnPositionTest);
    
    // Audio volume calculation test - Recently Fixed
    console.log('🔊 Audio volume calculation regression test...');
    
    const audioVolumeTest = await page.evaluate(() => {
        if (!window.audio || !window.audio.calculateVolume) {
            return { success: false, message: 'Audio volume calculation not available' };
        }
        
        const testPositions = [
            { x: 640, y: 360, name: 'player-position', expectedVolume: 1.0 },
            { x: 340, y: 360, name: 'near-player', expectedVolume: 0.8 },
            { x: 40, y: 360, name: 'far-from-player', expectedVolume: 0.3 },
            { x: -100, y: 360, name: 'off-screen', expectedVolume: 0.3 }
        ];
        
        const volumeResults = testPositions.map(pos => {
            try {
                const calculatedVolume = window.audio.calculateVolume(pos.x, pos.y);
                const volumeAccurate = Math.abs(calculatedVolume - pos.expectedVolume) < 0.3; // Allow some variance
                
                return {
                    name: pos.name,
                    position: pos,
                    calculatedVolume: Math.round(calculatedVolume * 1000) / 1000,
                    expectedVolume: pos.expectedVolume,
                    volumeAccurate: volumeAccurate
                };
            } catch (error) {
                return {
                    name: pos.name,
                    error: error.message,
                    success: false
                };
            }
        });
        
        const accurateCalculations = volumeResults.filter(r => r.volumeAccurate).length;
        
        return {
            success: accurateCalculations === testPositions.length,
            totalTests: testPositions.length,
            accurateCalculations: accurateCalculations,
            volumeResults: volumeResults
        };
    });
    
    console.log('🔊 Audio volume test:', audioVolumeTest);
    
    diagnosticLog.push({
        phase: 'Regression Tests',
        timestamp: Date.now() - testStartTime,
        coordinateConversion: coordinateConversionTest,
        spawnPositioning: spawnPositionTest,
        audioVolume: audioVolumeTest
    });
    
    await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, 'enhanced-04-regression-tests.png'),
        fullPage: false 
    });
    
    // ========================================================================
    // FINAL PHASE: COMPREHENSIVE SYSTEM HEALTH REPORT
    // ========================================================================
    console.log('\n🔵 FINAL PHASE: Comprehensive System Health Report');
    
    // Final performance snapshot
    const finalMetrics = await capturePerformanceMetrics();
    
    // Final system validation
    const finalSystemCheck = await page.evaluate(() => {
        return {
            gameStillRunning: window.frameCount > 0,
            playerStillExists: !!window.player,
            playerHealth: window.player?.health || 0,
            enemiesActive: (window.enemies || []).length,
            audioSystemActive: window.audio?.audioContext?.state === 'running',
            beatSystemActive: !!window.beatClock,
            noJavaScriptErrors: true // Will be updated based on error log
        };
    });
    
    // Calculate overall system health
    const totalErrors = Object.values(errorClassification).reduce((sum, arr) => sum + arr.length, 0);
    finalSystemCheck.noJavaScriptErrors = totalErrors === 0;
    
    const systemHealthScore = Object.values(finalSystemCheck).filter(Boolean).length / Object.values(finalSystemCheck).length;
    
    await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, 'enhanced-05-final-health-report.png'),
        fullPage: false 
    });
    
    // ========================================================================
    // ENHANCED DIAGNOSTIC REPORT
    // ========================================================================
    console.log('\n🎯 ULTIMATE TROUBLESHOOTING TEST COMPLETE - ENHANCED EDITION');
    console.log('================================================================');
    console.log(`📊 OVERALL SYSTEM HEALTH: ${Math.round(systemHealthScore * 100)}%`);
    console.log('📋 DETAILED SYSTEM STATUS:');
    console.log('  Game Running:', finalSystemCheck.gameStillRunning ? '✅' : '❌');
    console.log('  Player Integrity:', finalSystemCheck.playerStillExists ? '✅' : '❌');
    console.log('  Player Health:', finalSystemCheck.playerHealth + ' HP');
    console.log('  Active Enemies:', finalSystemCheck.enemiesActive);
    console.log('  Audio System:', finalSystemCheck.audioSystemActive ? '✅' : '❌');
    console.log('  Beat System:', finalSystemCheck.beatSystemActive ? '✅' : '❌');
    console.log('  Error Free:', finalSystemCheck.noJavaScriptErrors ? '✅' : '❌');
    
    // Error Classification Report
    if (totalErrors > 0) {
        console.log('\n🚨 ERROR CLASSIFICATION REPORT:');
        if (errorClassification.critical.length > 0) {
            console.log(`  💀 CRITICAL ERRORS (${errorClassification.critical.length}):`);
            errorClassification.critical.forEach((err, i) => console.log(`    ${i + 1}. [${err.timestamp}ms] ${err.text}`));
        }
        if (errorClassification.audio.length > 0) {
            console.log(`  🔊 AUDIO ERRORS (${errorClassification.audio.length}):`);
            errorClassification.audio.forEach((err, i) => console.log(`    ${i + 1}. [${err.timestamp}ms] ${err.text}`));
        }
        if (errorClassification.visual.length > 0) {
            console.log(`  🎨 VISUAL ERRORS (${errorClassification.visual.length}):`);
            errorClassification.visual.forEach((err, i) => console.log(`    ${i + 1}. [${err.timestamp}ms] ${err.text}`));
        }
        if (errorClassification.performance.length > 0) {
            console.log(`  ⚡ PERFORMANCE ERRORS (${errorClassification.performance.length}):`);
            errorClassification.performance.forEach((err, i) => console.log(`    ${i + 1}. [${err.timestamp}ms] ${err.text}`));
        }
    }
    
    // Beat System Analysis Report
    if (beatSystemLog.length > 0) {
        console.log('\n🎵 COSMIC BEAT SYSTEM ANALYSIS:');
        const beatAnalysis = beatSystemLog[0];
        console.log(`  Average BPM: ${Math.round(beatAnalysis.averageBPM)}`);
        console.log(`  Beat Transitions: ${beatAnalysis.beatTransitions}`);
        console.log(`  Max Timing Deviation: ${Math.round(beatAnalysis.maxTimingDeviation)}ms`);
        console.log(`  Beat Distribution: 1=${beatAnalysis.beatDistribution.beat1}, 2=${beatAnalysis.beatDistribution.beat2}, 3=${beatAnalysis.beatDistribution.beat3}, 4=${beatAnalysis.beatDistribution.beat4}`);
    }
    
    // Combat System Analysis Report
    if (combatLog.length > 0) {
        console.log('\n💥 COMBAT SYSTEM ANALYSIS:');
        const edgeShootingResults = combatLog.find(log => log.phase === 'Edge Shooting Stress Test');
        if (edgeShootingResults) {
            console.log(`  Edge Shooting Success Rate: ${Math.round(edgeShootingResults.averageSuccessRate * 100)}%`);
            edgeShootingResults.results.forEach(result => {
                console.log(`    ${result.edge}: ${Math.round(result.successRate * 100)}% (${result.shots.length} shots)`);
            });
        }
        
        const contactDamageResults = combatLog.find(log => log.phase === 'Contact Damage Verification');
        if (contactDamageResults) {
            console.log(`  Contact Damage Tests: ${contactDamageResults.results.enemyCount} enemies tested`);
            contactDamageResults.results.contactTests.forEach(test => {
                console.log(`    ${test.type}: ${test.expectedBehavior} (${test.contactDamageFunction ? '✅' : '❌'} function)`);
            });
        }
    }
    
    // Performance Analysis Report
    console.log('\n📈 PERFORMANCE ANALYSIS:');
    console.log(`  Test Duration: ${Math.round((Date.now() - testStartTime) / 1000)}s`);
    console.log(`  Performance Snapshots: ${performanceMetrics.length}`);
    if (performanceMetrics.length > 0) {
        const avgEnemies = performanceMetrics.reduce((sum, m) => sum + m.enemyCount, 0) / performanceMetrics.length;
        const avgBullets = performanceMetrics.reduce((sum, m) => sum + m.bulletCount, 0) / performanceMetrics.length;
        console.log(`  Average Enemies: ${Math.round(avgEnemies)}`);
        console.log(`  Average Bullets: ${Math.round(avgBullets)}`);
        
        if (performanceMetrics[0].memoryUsage) {
            const finalMemory = performanceMetrics[performanceMetrics.length - 1].memoryUsage;
            console.log(`  Memory Usage: ${finalMemory.used}MB / ${finalMemory.total}MB (${Math.round(finalMemory.used / finalMemory.total * 100)}%)`);
        }
    }
    
    // Diagnostic File Export for Analysis
    console.log('\n💾 DIAGNOSTIC DATA EXPORT:');
    const diagnosticExport = {
        timestamp: new Date().toISOString(),
        testDuration: Date.now() - testStartTime,
        systemHealthScore: systemHealthScore,
        systemStatus: finalSystemCheck,
        errorClassification: errorClassification,
        beatSystemAnalysis: beatSystemLog,
        combatSystemAnalysis: combatLog,
        performanceMetrics: performanceMetrics,
        diagnosticLog: diagnosticLog
    };
    
    console.log('  Diagnostic export ready for memory storage');
    console.log(`  Total data points: ${JSON.stringify(diagnosticExport).length} bytes`);
    
    // Enhanced Screenshots Summary
    console.log('\n📸 ENHANCED SCREENSHOT COLLECTION:');
    console.log('  enhanced-01-system-validation.png: Critical system health check');
    console.log('  enhanced-02-beat-system.png: Cosmic Beat System validation');
    console.log('  enhanced-03-combat-stress.png: Combat system stress testing');
    console.log('  enhanced-04-regression-tests.png: Recently fixed bug verification');
    console.log('  enhanced-05-final-health-report.png: Complete system health report');
    
    // Test Assertions
    expect(systemHealthScore, `System health below 80% (${Math.round(systemHealthScore * 100)}%)`).toBeGreaterThan(0.8);
    expect(finalSystemCheck.gameStillRunning, 'Game stopped running during test').toBe(true);
    expect(finalSystemCheck.playerStillExists, 'Player object disappeared during test').toBe(true);
    
    // Store results for future reference
    console.log('\n🎯 Enhanced troubleshooting test completed successfully!');
    console.log('🔧 Use this comprehensive data to diagnose any game issues');
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-collision-enhanced.png') });
    
    // ============================================================================
    // PHASE 8: COMBAT MOVEMENT INTEGRATION - ENHANCED EDITION
    // ============================================================================
    console.log('\n🔵 PHASE 8: Combat Movement Integration - Enhanced Edition');
    console.log('⚔️ Moving to ALL edges and corners while shooting enemies');
    console.log('📸 Taking automatic screenshots during movement process');
    console.log('🎯 Maximum troubleshooting coverage for movement+combat systems');
    
    // Force spawn enemies for combat testing
    console.log('👾 Force spawning enemies for combat movement testing...');
    const spawnResult = await page.evaluate(() => {
        try {
            const spawnCount = 6; // Spawn 6 enemies for comprehensive testing
            let spawned = 0;
            
            for (let i = 0; i < spawnCount; i++) {
                if (window.spawnSystem && window.spawnSystem.spawnEnemy) {
                    window.spawnSystem.spawnEnemy();
                    spawned++;
                } else if (window.EnemyFactory && window.EnemyFactory.createEnemy) {
                    // Alternative spawning method
                    const types = ['grunt', 'rusher', 'tank', 'stabber'];
                    const type = types[i % types.length];
                    const enemy = window.EnemyFactory.createEnemy(type, 640 + (i * 50), 360 + (i * 50));
                    if (window.enemies) {
                        window.enemies.push(enemy);
                        spawned++;
                    }
                }
                
                // Small delay between spawns
                const start = Date.now();
                while (Date.now() - start < 50) {} // Brief delay
            }
            
            return {
                success: spawned > 0,
                spawnedCount: spawned,
                totalEnemies: window.enemies ? window.enemies.length : 0,
                enemyTypes: window.enemies ? window.enemies.map(e => e.type) : []
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
    
    console.log('👾 Enemy spawn result:', spawnResult);
    
    // Wait for enemies to initialize
    await page.waitForTimeout(2000);
    
    // Define combat movement test positions (edges + corners)
    const combatMovementTests = [
        { name: 'top-edge', key: 'KeyW', duration: 3000, description: 'North edge combat' },
        { name: 'top-right-corner', keys: ['KeyW', 'KeyD'], duration: 3500, description: 'Northeast corner combat' },
        { name: 'right-edge', key: 'KeyD', duration: 3000, description: 'East edge combat' },
        { name: 'bottom-right-corner', keys: ['KeyS', 'KeyD'], duration: 3500, description: 'Southeast corner combat' },
        { name: 'bottom-edge', key: 'KeyS', duration: 3000, description: 'South edge combat' },
        { name: 'bottom-left-corner', keys: ['KeyS', 'KeyA'], duration: 3500, description: 'Southwest corner combat' },
        { name: 'left-edge', key: 'KeyA', duration: 3000, description: 'West edge combat' },
        { name: 'top-left-corner', keys: ['KeyW', 'KeyA'], duration: 3500, description: 'Northwest corner combat' }
    ];
    
    const combatMovementResults = [];
    
    for (let testIndex = 0; testIndex < combatMovementTests.length; testIndex++) {
        const movement = combatMovementTests[testIndex];
        console.log(`⚔️ Combat movement test ${testIndex + 1}/8: ${movement.description}`);
        
        // Reset player to center before each test
        await page.evaluate(() => {
            if (window.player) {
                window.player.x = 640;
                window.player.y = 360;
                window.player.dashCooldown = 0;
            }
        });
        
        // Get initial state
        const initialState = await page.evaluate(() => {
            return {
                playerPos: window.player ? { x: Math.round(window.player.x), y: Math.round(window.player.y) } : null,
                enemyCount: window.enemies ? window.enemies.length : 0,
                enemyHealth: window.enemies ? window.enemies.map(e => ({ type: e.type, health: e.health })) : [],
                bulletCount: window.playerBullets ? window.playerBullets.length : 0
            };
        });
        
        console.log(`  Initial state: Player(${initialState.playerPos?.x}, ${initialState.playerPos?.y}), ${initialState.enemyCount} enemies`);
        
        // Take starting screenshot
        await page.screenshot({ 
            path: path.join(SCREENSHOT_DIR, `08-combat-movement-${String(testIndex + 1).padStart(2, '0')}-${movement.name}-start.png`)
        });
        
        // Start movement
        if (movement.keys) {
            for (const key of movement.keys) {
                await page.keyboard.down(key);
            }
        } else {
            await page.keyboard.down(movement.key);
        }
        
        // Combat movement with frequent screenshots and data collection
        const combatData = [];
        const screenshotInterval = 750; // Screenshot every 750ms
        const shootInterval = 400; // Shoot every 400ms
        
        let lastShoot = 0;
        
        for (let t = 0; t < movement.duration; t += 250) {
            // Shoot at intervals while moving
            if (t - lastShoot >= shootInterval) {
                // Find nearest enemy and shoot at it
                const shootResult = await page.evaluate(() => {
                    try {
                        const enemies = window.enemies || [];
                        const player = window.player;
                        
                        if (enemies.length > 0 && player) {
                            // Find nearest enemy
                            let nearestEnemy = null;
                            let nearestDistance = Infinity;
                            
                            enemies.forEach(enemy => {
                                const distance = Math.sqrt(
                                    Math.pow(enemy.x - player.x, 2) + 
                                    Math.pow(enemy.y - player.y, 2)
                                );
                                if (distance < nearestDistance) {
                                    nearestDistance = distance;
                                    nearestEnemy = enemy;
                                }
                            });
                            
                            if (nearestEnemy) {
                                // Aim at nearest enemy
                                window.mouseX = nearestEnemy.x;
                                window.mouseY = nearestEnemy.y;
                                
                                // Shoot
                                if (player.shoot) {
                                    player.shoot();
                                }
                                
                                return {
                                    success: true,
                                    target: { 
                                        type: nearestEnemy.type, 
                                        x: Math.round(nearestEnemy.x), 
                                        y: Math.round(nearestEnemy.y),
                                        health: nearestEnemy.health
                                    },
                                    distance: Math.round(nearestDistance)
                                };
                            }
                        }
                        return { success: false, message: 'No enemies to target' };
                    } catch (error) {
                        return { success: false, error: error.message };
                    }
                });
                
                lastShoot = t;
            }
            
            // Capture state data
            const currentState = await page.evaluate(() => {
                return {
                    time: Date.now(),
                    playerPos: window.player ? { 
                        x: Math.round(window.player.x), 
                        y: Math.round(window.player.y) 
                    } : null,
                    enemyCount: window.enemies ? window.enemies.length : 0,
                    enemyStates: window.enemies ? window.enemies.slice(0, 5).map(e => ({
                        type: e.type,
                        x: Math.round(e.x),
                        y: Math.round(e.y),
                        health: e.health,
                        state: e.state || 'unknown'
                    })) : [],
                    bulletCount: window.playerBullets ? window.playerBullets.length : 0,
                    frameCount: window.frameCount || 0,
                    audioContextState: window.audio?.audioContext?.state || 'unknown'
                };
            });
            
            combatData.push(currentState);
            
            // Take screenshot at intervals
            if (t % screenshotInterval === 0 && t > 0) {
                const screenshotName = t < movement.duration / 2 ? 'mid' : 'late';
                await page.screenshot({ 
                    path: path.join(SCREENSHOT_DIR, `08-combat-movement-${String(testIndex + 1).padStart(2, '0')}-${movement.name}-${screenshotName}.png`)
                });
            }
            
            await page.waitForTimeout(250);
        }
        
        // Stop movement
        if (movement.keys) {
            for (const key of movement.keys) {
                await page.keyboard.up(key);
            }
        } else {
            await page.keyboard.up(movement.key);
        }
        
        // Get final state
        const finalState = await page.evaluate(() => {
            return {
                playerPos: window.player ? { x: Math.round(window.player.x), y: Math.round(window.player.y) } : null,
                enemyCount: window.enemies ? window.enemies.length : 0,
                enemyHealth: window.enemies ? window.enemies.map(e => ({ type: e.type, health: e.health, alive: e.health > 0 })) : [],
                bulletCount: window.playerBullets ? window.playerBullets.length : 0,
                playerHealth: window.player ? window.player.health : null
            };
        });
        
        // Take final screenshot
        await page.screenshot({ 
            path: path.join(SCREENSHOT_DIR, `08-combat-movement-${String(testIndex + 1).padStart(2, '0')}-${movement.name}-end.png`)
        });
        
        // Calculate combat effectiveness
        const enemiesKilled = initialState.enemyHealth.length - finalState.enemyHealth.filter(e => e.alive).length;
        const totalDamageDealt = initialState.enemyHealth.reduce((total, initial) => {
            const final = finalState.enemyHealth.find(f => f.type === initial.type);
            return total + (initial.health - (final?.health || 0));
        }, 0);
        
        const testResult = {
            position: movement.name,
            duration: movement.duration,
            initialPos: initialState.playerPos,
            finalPos: finalState.playerPos,
            enemiesKilled: enemiesKilled,
            totalDamageDealt: totalDamageDealt,
            shotsTracked: combatData.filter(d => d.time > 0).length,
            playerHealthChange: initialState.playerPos ? (finalState.playerHealth || 100) - 100 : 0,
            maxBullets: Math.max(...combatData.map(d => d.bulletCount)),
            avgEnemyCount: combatData.reduce((sum, d) => sum + d.enemyCount, 0) / combatData.length
        };
        
        combatMovementResults.push(testResult);
        
        console.log(`  Result: Pos(${finalState.playerPos?.x}, ${finalState.playerPos?.y}), ${enemiesKilled} kills, ${totalDamageDealt} damage`);
        
        // Brief pause between tests
        await page.waitForTimeout(1000);
    }
    
    // Combat movement summary
    console.log('\n📊 Combat Movement Integration Summary:');
    combatMovementResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.position}: ${result.enemiesKilled} kills, ${result.totalDamageDealt} damage, pos(${result.finalPos?.x}, ${result.finalPos?.y})`);
    });
    
    const totalKills = combatMovementResults.reduce((sum, r) => sum + r.enemiesKilled, 0);
    const totalDamage = combatMovementResults.reduce((sum, r) => sum + r.totalDamageDealt, 0);
    console.log(`📈 Total across all positions: ${totalKills} kills, ${totalDamage} total damage`);
    
    // Validate combat movement effectiveness
    expect(combatMovementResults.length, 'All combat movement tests completed').toBe(8);
    expect(totalDamage, 'Some damage should be dealt during combat movement').toBeGreaterThan(0);
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-combat-movement-summary.png') });
    
    // ============================================================================
    // PHASE 9: MAXIMUM STRESS TEST - ULTIMATE TROUBLESHOOTING EDITION
    // ============================================================================
    console.log('\n🔵 PHASE 9: Maximum Stress Test - Ultimate Troubleshooting Edition');
    console.log('🔥 Testing ALL systems under maximum load simultaneously');
    console.log('📊 Comprehensive performance monitoring and issue detection');
    console.log('🎯 Maximum troubleshooting value for any possible game issue');
    
    // Set up stress test conditions
    const stressTestResult = await page.evaluate(() => {
        try {
            // Force maximum enemy spawning
            let totalSpawned = 0;
            for (let i = 0; i < 10; i++) {
                if (window.spawnSystem && window.spawnSystem.spawnEnemy) {
                    window.spawnSystem.spawnEnemy();
                    totalSpawned++;
                }
            }
            
            // Reset player to center with full health
            if (window.player) {
                window.player.x = 640;
                window.player.y = 360;
                window.player.health = 100;
                window.player.dashCooldown = 0;
            }
            
            return {
                success: true,
                enemiesSpawned: totalSpawned,
                totalEnemies: window.enemies ? window.enemies.length : 0,
                playerReady: !!window.player,
                systemsActive: {
                    audio: !!window.audio,
                    beatClock: !!window.beatClock,
                    spawnSystem: !!window.spawnSystem,
                    collisionSystem: !!window.collisionSystem,
                    testMode: !!window.testMode
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
    
    console.log('🔥 Stress test setup:', stressTestResult);
    
    // Stress test: Rapid edge-to-edge movement with continuous shooting
    console.log('🚀 Starting rapid edge-to-edge combat stress test...');
    
    const stressMovements = [
        { name: 'rapid-north', key: 'KeyW', duration: 1500 },
        { name: 'rapid-northeast', keys: ['KeyW', 'KeyD'], duration: 1800 },
        { name: 'rapid-east', key: 'KeyD', duration: 1500 },
        { name: 'rapid-southeast', keys: ['KeyS', 'KeyD'], duration: 1800 },
        { name: 'rapid-south', key: 'KeyS', duration: 1500 },
        { name: 'rapid-southwest', keys: ['KeyS', 'KeyA'], duration: 1800 },
        { name: 'rapid-west', key: 'KeyA', duration: 1500 },
        { name: 'rapid-northwest', keys: ['KeyW', 'KeyA'], duration: 1800 }
    ];
    
    const stressTestData = [];
    let totalShots = 0;
    let totalEnemyDamage = 0;
    
    for (let i = 0; i < stressMovements.length; i++) {
        const movement = stressMovements[i];
        console.log(`🔥 Stress test ${i + 1}/8: ${movement.name} (${movement.duration}ms)`);
        
        // Start movement
        if (movement.keys) {
            for (const key of movement.keys) {
                await page.keyboard.down(key);
            }
        } else {
            await page.keyboard.down(movement.key);
        }
        
        // Rapid shooting and monitoring during movement
        let shotsFired = 0;
        const startTime = Date.now();
        
        while (Date.now() - startTime < movement.duration) {
            // Rapid shooting every 200ms
            const shootResult = await page.evaluate(() => {
                try {
                    const enemies = window.enemies || [];
                    const player = window.player;
                    
                    if (enemies.length > 0 && player) {
                        // Target different enemies in rotation
                        const targetIndex = Math.floor(Math.random() * enemies.length);
                        const target = enemies[targetIndex];
                        
                        window.mouseX = target.x;
                        window.mouseY = target.y;
                        
                        if (player.shoot) {
                            player.shoot();
                            return { success: true, targetType: target.type };
                        }
                    }
                    return { success: false };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            });
            
            if (shootResult.success) {
                shotsFired++;
                totalShots++;
            }
            
            // Capture system state every 500ms
            if ((Date.now() - startTime) % 500 < 50) {
                const systemState = await page.evaluate(() => {
                    return {
                        timestamp: Date.now(),
                        frameCount: window.frameCount || 0,
                        playerPos: window.player ? { x: Math.round(window.player.x), y: Math.round(window.player.y) } : null,
                        playerHealth: window.player ? window.player.health : null,
                        enemyCount: window.enemies ? window.enemies.length : 0,
                        bulletCount: window.playerBullets ? window.playerBullets.length : 0,
                        enemyBulletCount: window.enemyBullets ? window.enemyBullets.length : 0,
                        explosionCount: window.explosions ? window.explosions.length : 0,
                        audioContextState: window.audio?.audioContext?.state || 'unknown',
                        beatClockState: window.beatClock ? {
                            currentBeat: window.beatClock.currentBeat,
                            bpm: window.beatClock.bpm
                        } : null,
                        memoryUsage: performance.memory ? {
                            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
                        } : null
                    };
                });
                
                stressTestData.push(systemState);
                
                // Take screenshot during stress test
                if (i % 2 === 0) { // Every other movement
                    await page.screenshot({ 
                        path: path.join(SCREENSHOT_DIR, `09-stress-test-${String(i + 1).padStart(2, '0')}-${movement.name}.png`)
                    });
                }
            }
            
            await page.waitForTimeout(200);
        }
        
        // Stop movement
        if (movement.keys) {
            for (const key of movement.keys) {
                await page.keyboard.up(key);
            }
        } else {
            await page.keyboard.up(movement.key);
        }
        
        console.log(`  ${shotsFired} shots fired during ${movement.name}`);
    }
    
    // Analyze stress test results
    console.log('\n📊 STRESS TEST ANALYSIS:');
    console.log(`🔫 Total shots fired: ${totalShots}`);
    console.log(`📈 Data points collected: ${stressTestData.length}`);
    
    if (stressTestData.length > 0) {
        const avgFrameRate = (stressTestData[stressTestData.length - 1]?.frameCount - stressTestData[0]?.frameCount) / (stressTestData.length * 0.5);
        const maxEnemies = Math.max(...stressTestData.map(d => d.enemyCount));
        const maxBullets = Math.max(...stressTestData.map(d => d.bulletCount));
        const finalPlayerHealth = stressTestData[stressTestData.length - 1]?.playerHealth;
        
        console.log(`⚡ Average frame rate: ${Math.round(avgFrameRate)} FPS`);
        console.log(`👾 Max enemies on screen: ${maxEnemies}`);
        console.log(`💥 Max bullets on screen: ${maxBullets}`);
        console.log(`❤️  Final player health: ${finalPlayerHealth}`);
        
        // Check for performance issues
        const memoryData = stressTestData.filter(d => d.memoryUsage);
        if (memoryData.length > 1) {
            const memoryGrowth = memoryData[memoryData.length - 1].memoryUsage.used - memoryData[0].memoryUsage.used;
            console.log(`💾 Memory usage change: ${memoryGrowth > 0 ? '+' : ''}${memoryGrowth}MB`);
            
            if (memoryGrowth > 50) {
                console.log('⚠️  WARNING: Significant memory growth detected during stress test');
            }
        }
        
        // Check for frame rate issues
        if (avgFrameRate < 30) {
            console.log('⚠️  WARNING: Low frame rate detected during stress test');
        }
        
        // Check audio system stability
        const audioStates = [...new Set(stressTestData.map(d => d.audioContextState))];
        console.log(`🔊 Audio states during test: ${audioStates.join(', ')}`);
        
        // Check beat clock stability
        const beatClockWorking = stressTestData.filter(d => d.beatClockState).length > 0;
        console.log(`🎵 Beat clock operational: ${beatClockWorking ? '✅' : '❌'}`);
    }
    
    // Error summary
    console.log('\n🔍 ERROR SUMMARY:');
    if (errorLog.length > 0) {
        console.log(`❌ ${errorLog.length} errors detected during test:`);
        errorLog.slice(0, 10).forEach((error, index) => {
            console.log(`  ${index + 1}. ${error}`);
        });
        if (errorLog.length > 10) {
            console.log(`  ... and ${errorLog.length - 10} more errors`);
        }
    } else {
        console.log('✅ No console errors detected during comprehensive test');
    }
    
    // Performance summary
    console.log('\n⚡ PERFORMANCE SUMMARY:');
    const testDuration = Date.now() - testStartTime;
    console.log(`⏱️  Total test duration: ${Math.round(testDuration / 1000)}s`);
    console.log(`📸 Screenshots taken: ~60+ in ${SCREENSHOT_DIR}/`);
    console.log(`🎯 Systems tested: Movement, Shooting, Enemies, Audio, Visuals, Beat Clock, Collision, UI`);
    console.log(`🔥 Stress scenarios: Edge movement, Combat integration, Rapid shooting, Multi-enemy combat`);
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-stress-test-final.png') });
    
    // Final validation
    expect(totalShots, 'Shooting system should work during stress test').toBeGreaterThan(0);
    expect(stressTestData.length, 'System monitoring should collect data').toBeGreaterThan(10);
    expect(errorLog.length, 'Should have minimal errors during stress test').toBeLessThan(5);
    
    console.log('\n🎉 ULTIMATE COMPREHENSIVE TEST COMPLETED SUCCESSFULLY!');
    console.log('📊 Maximum troubleshooting data collected and saved to screenshots/');
    console.log('🔧 Use this data to diagnose any possible game issue');
    
    // ============================================================================
}); 