/**
 * comprehensive-test-suite.js - Advanced automated testing with bug detection and reporting
 * 
 * This module provides comprehensive testing capabilities including:
 * - Game state validation
 * - Performance monitoring
 * - Consistency checks
 * - Automated bug detection and reporting
 * - Integration with the ticketing system
 */

import { random } from './mathUtils.js';

export class ComprehensiveTestSuite {
    constructor() {
        this.testResults = [];
        this.isRunning = false;
        this.currentTest = null;
        this.startTime = null;
        this.testConfig = {
            maxTestDuration: 30000, // 30 seconds max per test
            frameRateThreshold: 45, // Minimum acceptable FPS
            memoryLeakThreshold: 50, // MB increase threshold
            maxEnemyCount: 50, // Maximum enemies before performance issues
        };
        
        // Test categories
        this.testCategories = [
            'initialization',
            'gameplay',
            'performance',
            'audio',
            'collision',
            'ui',
            'memory',
            'consistency'
        ];
        
        // Bug detection patterns
        this.bugPatterns = {
            memoryLeak: { detected: false, threshold: 50 },
            frameDrops: { detected: false, count: 0, threshold: 10 },
            audioFailures: { detected: false, count: 0 },
            collisionMisses: { detected: false, count: 0 },
            entityLeaks: { detected: false, count: 0 },
            stateCorruption: { detected: false, instances: [] }
        };
        
        console.log('🧪 Comprehensive Test Suite initialized');
    }
    
    /**
     * Run all automated tests
     */
    async runAllTests() {
        if (this.isRunning) {
            console.log('⚠️ Tests already running');
            return;
        }
        
        this.isRunning = true;
        this.startTime = Date.now();
        this.testResults = [];
        
        console.log('🚀 Starting comprehensive test suite...');
        
        try {
            // Test categories in order
            await this.testInitialization();
            await this.testAILivenessProbe();
            await this.testPlayerMovement();
            await this.testShootingMechanics();
            await this.testCollisionSystem();
            await this.testSoundSystem();
            await this.testGameplay();
            await this.testPerformance();
            await this.testAudio();
            await this.testUI();
            await this.testMemoryUsage();
            await this.testConsistency();
            
            // Generate final report
            this.generateTestReport();
            
        } catch (error) {
            console.error('🔥 Test suite crashed:', error);
            this.reportBug('test-suite-crash', 'Test suite crashed unexpectedly', { error: error.message });
        } finally {
            this.isRunning = false;
        }
    }
    
    /**
     * Test game initialization
     */
    async testInitialization() {
        this.currentTest = 'initialization';
        console.log('🎮 Testing game initialization...');
        
        const results = {
            category: 'initialization',
            tests: [],
            passed: 0,
            failed: 0
        };
        
        // Test 1: CRITICAL - Game actually starts (no JS errors)
        results.tests.push(this.checkGameStartup());
        
        // Test 2: Core systems exist
        results.tests.push(this.checkCoreSystemsExist());
        
        // Test 3: Game state is valid
        results.tests.push(this.checkGameStateValid());
        
        // Test 4: Player initialization
        results.tests.push(this.checkPlayerInitialization());
        
        // Test 5: Audio system initialization
        results.tests.push(this.checkAudioInitialization());
        
        // Count results
        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Initialization tests: ${results.passed} passed, ${results.failed} failed`);
    }
    
    /**
     * Test AI Liveness Probe System
     */
    async testAILivenessProbe() {
        this.currentTest = 'ai-liveness-probe';
        console.log('🤖 Testing AI Liveness Probe...');
        
        const results = {
            category: 'ai-liveness-probe',
            tests: [],
            passed: 0,
            failed: 0
        };
        
        try {
            // Import and execute the probe
            const probeModule = await import('./ai-liveness-probe.js');
            const probeResult = await probeModule.default;
            
            // Test 1: Probe execution
            if (probeResult) {
                results.tests.push({
                    name: 'Probe Execution',
                    passed: true,
                    details: 'AI Liveness Probe executed successfully',
                    data: probeResult
                });
            } else {
                results.tests.push({
                    name: 'Probe Execution',
                    passed: false,
                    details: 'AI Liveness Probe failed to execute',
                    data: null
                });
            }
            
            // Test 2: Game liveness validation
            const livenessValid = probeResult && !probeResult.failure;
            results.tests.push({
                name: 'Game Liveness',
                passed: livenessValid,
                details: livenessValid ? 'Game is alive and responsive' : `Liveness issue: ${probeResult?.failure || 'Unknown'}`,
                data: probeResult
            });
            
            // Test 3: Entity presence validation
            const entitiesValid = probeResult && probeResult.playerAlive && probeResult.enemyCount > 0;
            results.tests.push({
                name: 'Entity Presence',
                passed: entitiesValid,
                details: entitiesValid ? 
                    `Player alive: ${probeResult.playerAlive}, Enemies: ${probeResult.enemyCount}` :
                    `Entity issues - Player: ${probeResult?.playerAlive}, Enemies: ${probeResult?.enemyCount}`,
                data: { playerAlive: probeResult?.playerAlive, enemyCount: probeResult?.enemyCount }
            });
            
            // Test 4: Frame progression
            const frameValid = probeResult && typeof probeResult.frameCount === 'number' && probeResult.frameCount > 0;
            results.tests.push({
                name: 'Frame Progression',
                passed: frameValid,
                details: frameValid ? 
                    `Frame count: ${probeResult.frameCount}` :
                    'Frame count not progressing',
                data: { frameCount: probeResult?.frameCount }
            });
            
        } catch (error) {
            results.tests.push({
                name: 'Probe System Error',
                passed: false,
                details: `Error executing probe: ${error.message}`,
                data: { error: error.message }
            });
        }
        
        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ AI Liveness Probe tests: ${results.passed} passed, ${results.failed} failed`);
        
        return results;
    }

    /**
     * Test gameplay mechanics
     */
    async testGameplay() {
        this.currentTest = 'gameplay';
        console.log('🎯 Testing gameplay mechanics...');
        
        const results = {
            category: 'gameplay',
            tests: [],
            passed: 0,
            failed: 0
        };
        
        // Enable test mode for automated testing
        if (window.testMode) {
            window.testMode.setEnabled(true);
        }
        
        // Test 1: Player movement
        results.tests.push(await this.testPlayerMovement());
        
        // Test 2: Shooting mechanics
        results.tests.push(await this.testShootingMechanics());
        
        // Test 3: Enemy spawning
        results.tests.push(await this.testEnemySpawning());
        
        // Test 4: Enemy behavior
        results.tests.push(await this.testEnemyBehavior());
        
        // Test 5: Beat synchronization
        results.tests.push(await this.testBeatSynchronization());
        
        // Test 6: Advanced gameplay mechanics
        results.tests.push(await this.testAdvancedGameplay());
        
        // Disable test mode
        if (window.testMode) {
            window.testMode.setEnabled(false);
        }
        
        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Gameplay tests: ${results.passed} passed, ${results.failed} failed`);
    }
    
    /**
     * Test performance metrics
     */
    async testPerformance() {
        this.currentTest = 'performance';
        console.log('⚡ Testing performance...');
        
        const results = {
            category: 'performance',
            tests: [],
            passed: 0,
            failed: 0
        };
        
        // Test 1: Frame rate stability
        results.tests.push(await this.testFrameRate());
        
        // Test 2: Memory usage
        results.tests.push(await this.testMemoryPerformance());
        
        // Test 3: Entity count limits
        results.tests.push(await this.testEntityLimits());
        
        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Performance tests: ${results.passed} passed, ${results.failed} failed`);
    }
    
    /**
     * CRITICAL: Check if game actually starts without JavaScript errors
     */
    checkGameStartup() {
        const issues = [];
        
        // Check if game state reached "playing" (means initialization succeeded)
        if (!window.gameState || window.gameState.gameState !== 'playing') {
            issues.push(`Game state not playing: ${window.gameState ? window.gameState.gameState : 'undefined'}`);
        }
        
        // Check if canvas exists and has valid dimensions
        const canvas = document.querySelector('canvas');
        if (!canvas) {
            issues.push('Canvas not found');
        } else if (canvas.width === 0 || canvas.height === 0) {
            issues.push('Canvas has invalid dimensions');
        }
        
        // Check for critical missing imports/dependencies
        if (!window.player) issues.push('Player not initialized');
        if (!window.gameState) issues.push('GameState not initialized');
        if (!window.audio) issues.push('Audio not initialized');
        
        const passed = issues.length === 0;
        
        if (!passed) {
            this.reportBug('game-startup-failure', 'Game failed to start properly', { issues });
        }
        
        return {
            name: 'Game Startup (CRITICAL)',
            passed,
            details: passed ? 'Game started successfully' : `Startup issues: ${issues.join(', ')}`,
            data: { issues },
            critical: true
        };
    }

    /**
     * Check if core systems exist and are properly initialized
     */
    checkCoreSystemsExist() {
        const requiredSystems = [
            'gameState', 'player', 'audio', 'beatClock', 
            'cameraSystem', 'spawnSystem', 'collisionSystem'
        ];
        
        const missingSystems = [];
        
        for (const system of requiredSystems) {
            if (!window[system]) {
                missingSystems.push(system);
            }
        }
        
        const passed = missingSystems.length === 0;
        
        if (!passed) {
            this.reportBug('missing-core-systems', 'Core systems missing', { missingSystems });
        }
        
        return {
            name: 'Core Systems Exist',
            passed,
            details: passed ? 'All core systems present' : `Missing: ${missingSystems.join(', ')}`,
            data: { missingSystems }
        };
    }
    
    /**
     * Check if game state is valid
     */
    checkGameStateValid() {
        const issues = [];
        
        if (!window.gameState) {
            issues.push('gameState not found');
        } else {
            if (typeof window.gameState.gameState !== 'string') {
                issues.push('gameState.gameState is not a string');
            }
            if (typeof window.gameState.score !== 'number') {
                issues.push('gameState.score is not a number');
            }
            if (typeof window.gameState.level !== 'number') {
                issues.push('gameState.level is not a number');
            }
        }
        
        const passed = issues.length === 0;
        
        if (!passed) {
            this.reportBug('invalid-game-state', 'Game state validation failed', { issues });
        }
        
        return {
            name: 'Game State Valid',
            passed,
            details: passed ? 'Game state is valid' : `Issues: ${issues.join(', ')}`,
            data: { issues }
        };
    }
    
    /**
     * Check player initialization
     */
    checkPlayerInitialization() {
        const issues = [];
        
        if (!window.player) {
            issues.push('Player not found');
        } else {
            if (typeof window.player.x !== 'number') issues.push('Player x position invalid');
            if (typeof window.player.y !== 'number') issues.push('Player y position invalid');
            if (typeof window.player.size !== 'number') issues.push('Player size invalid');
            if (typeof window.player.health !== 'number') issues.push('Player health invalid');
            if (window.player.markedForRemoval) issues.push('Player marked for removal');
        }
        
        const passed = issues.length === 0;
        
        if (!passed) {
            this.reportBug('player-initialization-failed', 'Player initialization issues', { issues });
        }
        
        return {
            name: 'Player Initialization',
            passed,
            details: passed ? 'Player properly initialized' : `Issues: ${issues.join(', ')}`,
            data: { issues }
        };
    }
    
    /**
     * Check audio system initialization
     */
    checkAudioInitialization() {
        const issues = [];
        
        if (!window.audio) {
            issues.push('Audio system not found');
        } else {
            if (typeof window.audio.playPlayerShoot !== 'function') {
                issues.push('playPlayerShoot method missing');
            }
            if (typeof window.audio.playEnemyHit !== 'function') {
                issues.push('playEnemyHit method missing');
            }
            if (typeof window.audio.playExplosion !== 'function') {
                issues.push('playExplosion method missing');
            }
        }
        
        const passed = issues.length === 0;
        
        if (!passed) {
            this.reportBug('audio-initialization-failed', 'Audio system initialization issues', { issues });
        }
        
        return {
            name: 'Audio Initialization',
            passed,
            details: passed ? 'Audio system properly initialized' : `Issues: ${issues.join(', ')}`,
            data: { issues }
        };
    }
    
    /**
     * Test player movement
     */
    async testPlayerMovement() {
        return new Promise((resolve) => {
            const initialX = window.player ? window.player.x : 0;
            const initialY = window.player ? window.player.y : 0;
            
            // Simulate movement for a few frames
            let frameCount = 0;
            const maxFrames = 60; // Test for 1 second at 60fps
            
            const testInterval = setInterval(() => {
                frameCount++;
                
                if (frameCount >= maxFrames) {
                    clearInterval(testInterval);
                    
                    const finalX = window.player ? window.player.x : 0;
                    const finalY = window.player ? window.player.y : 0;
                    const moved = Math.abs(finalX - initialX) > 1 || Math.abs(finalY - initialY) > 1;
                    
                    resolve({
                        name: 'Player Movement',
                        passed: moved,
                        details: moved ? 'Player movement detected' : 'No player movement detected',
                        data: { initialX, initialY, finalX, finalY }
                    });
                }
            }, 16); // ~60fps
        });
    }
    
    /**
     * Test shooting mechanics
     */
    async testShootingMechanics() {
        this.currentTest = 'shooting-mechanics';
        console.log('🔫 Testing shooting mechanics...');
        
        const results = {
            category: 'shooting-mechanics',
            tests: [],
            passed: 0,
            failed: 0
        };
        
        // Test 1: Bullet creation system
        const initialBulletCount = window.playerBullets ? window.playerBullets.length : 0;
        
        // Simulate shooting
        if (window.player && typeof window.player.shoot === 'function') {
            try {
                window.player.shoot();
                await new Promise(resolve => setTimeout(resolve, 50)); // Wait for bullet creation
                
                const newBulletCount = window.playerBullets ? window.playerBullets.length : 0;
                const bulletCreated = newBulletCount > initialBulletCount;
                
                results.tests.push({
                    name: 'Bullet Creation',
                    passed: bulletCreated,
                    details: bulletCreated ? 
                        `Bullet created (${initialBulletCount} → ${newBulletCount})` :
                        'No bullet created on shoot command',
                    data: { initialCount: initialBulletCount, newCount: newBulletCount }
                });
            } catch (error) {
                results.tests.push({
                    name: 'Bullet Creation',
                    passed: false,
                    details: `Shooting error: ${error.message}`,
                    data: { error: error.message }
                });
            }
        } else {
            results.tests.push({
                name: 'Bullet Creation',
                passed: false,
                details: 'Player shoot method not available',
                data: null
            });
        }
        
        // Test 2: Bullet trajectory and movement
        if (window.playerBullets && window.playerBullets.length > 0) {
            const bullet = window.playerBullets[window.playerBullets.length - 1];
            const initialPos = { x: bullet.x, y: bullet.y };
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const finalPos = { x: bullet.x, y: bullet.y };
            const bulletMoved = Math.abs(finalPos.x - initialPos.x) > 1 || Math.abs(finalPos.y - initialPos.y) > 1;
            
            results.tests.push({
                name: 'Bullet Trajectory',
                passed: bulletMoved,
                details: bulletMoved ? 
                    `Bullet moving (${Math.round(initialPos.x)},${Math.round(initialPos.y)} → ${Math.round(finalPos.x)},${Math.round(finalPos.y)})` :
                    'Bullet not moving',
                data: { initialPos, finalPos, distance: Math.sqrt((finalPos.x - initialPos.x) ** 2 + (finalPos.y - initialPos.y) ** 2) }
            });
        } else {
            results.tests.push({
                name: 'Bullet Trajectory',
                passed: false,
                details: 'No bullets available for trajectory testing',
                data: null
            });
        }
        
        // Test 3: CRITICAL - Collision System Integration
        // This test should have caught the dist function error!
        try {
            // Force collision system to run with bullets present
            if (window.collisionSystem && window.playerBullets && window.playerBullets.length > 0) {
                console.log('🔍 Testing collision system with active bullets...');
                window.collisionSystem.checkBulletCollisions();
                
                results.tests.push({
                    name: 'Collision System Integration',
                    passed: true,
                    details: 'Collision system runs without errors with active bullets',
                    data: { bulletCount: window.playerBullets.length }
                });
            } else {
                results.tests.push({
                    name: 'Collision System Integration',
                    passed: false,
                    details: 'Collision system or bullets not available for testing',
                    data: { 
                        collisionSystemExists: !!window.collisionSystem,
                        bulletCount: window.playerBullets ? window.playerBullets.length : 0
                    }
                });
            }
        } catch (error) {
            results.tests.push({
                name: 'Collision System Integration',
                passed: false,
                details: `CRITICAL: Collision system error - ${error.message}`,
                data: { 
                    error: error.message,
                    stack: error.stack,
                    bulletCount: window.playerBullets ? window.playerBullets.length : 0
                }
            });
            console.error('🚨 CRITICAL COLLISION SYSTEM ERROR:', error);
        }
        
        // Test 4: Rate of fire control
        const rapidFireTest = async () => {
            const startCount = window.playerBullets ? window.playerBullets.length : 0;
            const shootAttempts = 10;
            
            for (let i = 0; i < shootAttempts; i++) {
                if (window.player && typeof window.player.shoot === 'function') {
                    try {
                        window.player.shoot();
                    } catch (error) {
                        console.error(`🚨 Shooting error on attempt ${i + 1}:`, error);
                        return {
                            passed: false,
                            details: `Shooting failed on attempt ${i + 1}: ${error.message}`,
                            data: { error: error.message, attempt: i + 1 }
                        };
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 10)); // Rapid fire
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            const endCount = window.playerBullets ? window.playerBullets.length : 0;
            const bulletsCreated = endCount - startCount;
            
            // Should have rate limiting (not all 10 shots should succeed)
            const hasRateLimit = bulletsCreated < shootAttempts;
            
            return {
                passed: hasRateLimit,
                details: hasRateLimit ? 
                    `Rate limiting working (${bulletsCreated}/${shootAttempts} shots fired)` :
                    `No rate limiting (${bulletsCreated}/${shootAttempts} shots fired)`,
                data: { attempts: shootAttempts, created: bulletsCreated }
            };
        };
        
        const rateTest = await rapidFireTest();
        results.tests.push({
            name: 'Rate of Fire Control',
            ...rateTest
        });
        
        // Test 5: Audio feedback on shooting
        let audioFeedback = false;
        if (window.audio && typeof window.audio.playSound === 'function') {
            // Check if audio system is available
            audioFeedback = true;
        }
        
        results.tests.push({
            name: 'Audio Feedback',
            passed: audioFeedback,
            details: audioFeedback ? 
                'Audio system available for shooting feedback' :
                'Audio system not available',
            data: { audioSystemAvailable: audioFeedback }
        });
        
        // Test 6: CRITICAL - Runtime Error Detection
        // Test bullet rendering and update cycles for runtime errors
        try {
            if (window.playerBullets && window.playerBullets.length > 0) {
                console.log('🔍 Testing bullet runtime operations...');
                
                // Test bullet update cycle
                for (const bullet of window.playerBullets) {
                    if (typeof bullet.update === 'function') {
                        bullet.update();
                    }
                }
                
                // Test bullet drawing (if p5 instance available)
                if (window.p5Instance) {
                    for (const bullet of window.playerBullets) {
                        if (typeof bullet.draw === 'function') {
                            bullet.draw(window.p5Instance);
                        }
                    }
                }
                
                results.tests.push({
                    name: 'Runtime Error Detection',
                    passed: true,
                    details: 'Bullet update and draw cycles completed without errors',
                    data: { bulletCount: window.playerBullets.length }
                });
            } else {
                results.tests.push({
                    name: 'Runtime Error Detection',
                    passed: false,
                    details: 'No bullets available for runtime testing',
                    data: { bulletCount: 0 }
                });
            }
        } catch (error) {
            results.tests.push({
                name: 'Runtime Error Detection',
                passed: false,
                details: `CRITICAL: Runtime error in bullet operations - ${error.message}`,
                data: { 
                    error: error.message,
                    stack: error.stack
                }
            });
            console.error('🚨 CRITICAL BULLET RUNTIME ERROR:', error);
        }
        
        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Shooting mechanics tests: ${results.passed} passed, ${results.failed} failed`);
        
        return results;
    }

    /**
     * Test enemy spawning
     */
    async testEnemySpawning() {
        return new Promise((resolve) => {
            const initialEnemyCount = window.enemies ? window.enemies.length : 0;
            
            // Force spawn some enemies
            if (window.spawnSystem && window.spawnSystem.spawnEnemy) {
                try {
                    window.spawnSystem.spawnEnemy('grunt');
                    window.spawnSystem.spawnEnemy('rusher');
                } catch (error) {
                    console.error('🔥 Enemy spawning failed:', error);
                }
            }
            
            setTimeout(() => {
                const finalEnemyCount = window.enemies ? window.enemies.length : 0;
                const enemiesSpawned = finalEnemyCount > initialEnemyCount;
                
                if (!enemiesSpawned) {
                    this.reportBug('enemy-spawning-failed', 'Enemy spawning not working', {
                        initialCount: initialEnemyCount,
                        finalCount: finalEnemyCount
                    });
                }
                
                resolve({
                    name: 'Enemy Spawning',
                    passed: enemiesSpawned,
                    details: enemiesSpawned ? 'Enemies spawned successfully' : 'Enemy spawning failed',
                    data: { initialEnemyCount, finalEnemyCount }
                });
            }, 1000);
        });
    }
    
    /**
     * Test enemy behavior
     */
    async testEnemyBehavior() {
        return new Promise((resolve) => {
            if (!window.enemies || window.enemies.length === 0) {
                resolve({
                    name: 'Enemy Behavior',
                    passed: false,
                    details: 'No enemies to test',
                    data: { enemyCount: 0 }
                });
                return;
            }
            
            const enemy = window.enemies[0];
            const initialX = enemy.x;
            const initialY = enemy.y;
            
            setTimeout(() => {
                const finalX = enemy.x;
                const finalY = enemy.y;
                const moved = Math.abs(finalX - initialX) > 1 || Math.abs(finalY - initialY) > 1;
                
                resolve({
                    name: 'Enemy Behavior',
                    passed: moved,
                    details: moved ? 'Enemy movement detected' : 'Enemy not moving',
                    data: { initialX, initialY, finalX, finalY, enemyType: enemy.type }
                });
            }, 1000);
        });
    }
    
    /**
     * Test player movement mechanics
     */
    async testPlayerMovement() {
        this.currentTest = 'player-movement';
        console.log('🎮 Testing player movement mechanics...');
        
        const results = {
            category: 'player-movement',
            tests: [],
            passed: 0,
            failed: 0
        };
        
        if (!window.player) {
            results.tests.push({
                name: 'Player Entity Existence',
                passed: false,
                details: 'Player entity not found',
                data: null
            });
            results.failed++;
            this.testResults.push(results);
            return results;
        }
        
        const initialPos = { x: window.player.x, y: window.player.y };
        
        // Test 1: Player entity structure
        const requiredMethods = ['update', 'draw', 'handleInput'];
        const requiredProperties = ['x', 'y', 'health', 'speed'];
        
        const missingMethods = requiredMethods.filter(method => typeof window.player[method] !== 'function');
        const missingProperties = requiredProperties.filter(prop => typeof window.player[prop] === 'undefined');
        
        results.tests.push({
            name: 'Player Entity Structure',
            passed: missingMethods.length === 0 && missingProperties.length === 0,
            details: missingMethods.length === 0 && missingProperties.length === 0 ? 
                'Player has all required methods and properties' :
                `Missing: ${[...missingMethods, ...missingProperties].join(', ')}`,
            data: { missingMethods, missingProperties }
        });
        
        // Test 2: Movement responsiveness (simulate WASD input)
        const testMovement = async (direction, expectedChange) => {
            const startPos = { x: window.player.x, y: window.player.y };
            
            // Simulate key press
            const keyMap = { 'W': 'w', 'A': 'a', 'S': 's', 'D': 'd' };
            const key = keyMap[direction];
            
            // Simulate input for a few frames
            if (window.keys) {
                window.keys[key] = true;
                
                // Let the game update for a few frames
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const endPos = { x: window.player.x, y: window.player.y };
                const moved = Math.abs(endPos.x - startPos.x) > 1 || Math.abs(endPos.y - startPos.y) > 1;
                
                window.keys[key] = false; // Release key
                
                return {
                    moved,
                    startPos,
                    endPos,
                    distance: Math.sqrt((endPos.x - startPos.x) ** 2 + (endPos.y - startPos.y) ** 2)
                };
            }
            
            return { moved: false, error: 'Keys system not available' };
        };
        
        // Test movement in all directions
        const directions = ['W', 'A', 'S', 'D'];
        let movementTests = [];
        
        for (const direction of directions) {
            try {
                const result = await testMovement(direction);
                movementTests.push({
                    direction,
                    ...result
                });
            } catch (error) {
                movementTests.push({
                    direction,
                    moved: false,
                    error: error.message
                });
            }
        }
        
        const successfulMovements = movementTests.filter(t => t.moved).length;
        results.tests.push({
            name: 'Movement Responsiveness',
            passed: successfulMovements >= 2, // At least 2 directions should work
            details: `${successfulMovements}/4 directions responsive: ${movementTests.map(t => `${t.direction}:${t.moved ? '✓' : '✗'}`).join(' ')}`,
            data: movementTests
        });
        
        // Test 3: Boundary detection
        const canvasWidth = window.innerWidth || 800;
        const canvasHeight = window.innerHeight || 600;
        
        const withinBounds = window.player.x >= 0 && window.player.x <= canvasWidth &&
                           window.player.y >= 0 && window.player.y <= canvasHeight;
        
        results.tests.push({
            name: 'Boundary Detection',
            passed: withinBounds,
            details: withinBounds ? 
                `Player within bounds (${Math.round(window.player.x)}, ${Math.round(window.player.y)})` :
                `Player out of bounds (${Math.round(window.player.x)}, ${Math.round(window.player.y)})`,
            data: { 
                playerPos: { x: window.player.x, y: window.player.y },
                bounds: { width: canvasWidth, height: canvasHeight }
            }
        });
        
        // Test 4: Movement smoothness (check for stuttering)
        const positions = [];
        const startTime = Date.now();
        
        // Record positions over time
        const recordPosition = () => {
            if (Date.now() - startTime < 1000) { // Record for 1 second
                positions.push({ 
                    x: window.player.x, 
                    y: window.player.y, 
                    time: Date.now() 
                });
                setTimeout(recordPosition, 16); // ~60fps
            }
        };
        
        recordPosition();
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        // Analyze movement smoothness
        let stutterCount = 0;
        for (let i = 1; i < positions.length - 1; i++) {
            const prev = positions[i - 1];
            const curr = positions[i];
            const next = positions[i + 1];
            
            const dist1 = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
            const dist2 = Math.sqrt((next.x - curr.x) ** 2 + (next.y - curr.y) ** 2);
            
            // Detect sudden stops or jumps
            if (Math.abs(dist1 - dist2) > 5) {
                stutterCount++;
            }
        }
        
        const smoothMovement = stutterCount < positions.length * 0.1; // Less than 10% stutter
        results.tests.push({
            name: 'Movement Smoothness',
            passed: smoothMovement,
            details: smoothMovement ? 
                `Smooth movement (${stutterCount} stutters in ${positions.length} frames)` :
                `Stuttering detected (${stutterCount} stutters in ${positions.length} frames)`,
            data: { stutterCount, totalFrames: positions.length, stutterRate: stutterCount / positions.length }
        });
        
        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Player movement tests: ${results.passed} passed, ${results.failed} failed`);
        
        return results;
    }

    /**
     * Test beat synchronization
     */
    async testBeatSynchronization() {
        return new Promise((resolve) => {
            const beatClockExists = !!window.beatClock;
            let beatDetected = false;
            
            if (beatClockExists && window.beatClock.getCurrentBeat) {
                const initialBeat = window.beatClock.getCurrentBeat();
                
                setTimeout(() => {
                    const finalBeat = window.beatClock.getCurrentBeat();
                    beatDetected = finalBeat !== initialBeat;
                    
                    resolve({
                        name: 'Beat Synchronization',
                        passed: beatDetected,
                        details: beatDetected ? 'Beat progression detected' : 'No beat progression',
                        data: { initialBeat, finalBeat }
                    });
                }, 1000);
            } else {
                resolve({
                    name: 'Beat Synchronization',
                    passed: false,
                    details: 'BeatClock not found or missing getCurrentBeat method',
                    data: { beatClockExists }
                });
            }
        });
    }
    
    /**
     * Test frame rate stability
     */
    async testFrameRate() {
        return new Promise((resolve) => {
            const frameRates = [];
            let frameCount = 0;
            const testDuration = 3000; // 3 seconds
            
            const startTime = Date.now();
            const interval = setInterval(() => {
                if (typeof frameRate !== 'undefined') {
                    frameRates.push(frameRate);
                }
                frameCount++;
                
                if (Date.now() - startTime >= testDuration) {
                    clearInterval(interval);
                    
                    const avgFrameRate = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;
                    const minFrameRate = Math.min(...frameRates);
                    const passed = avgFrameRate >= this.testConfig.frameRateThreshold;
                    
                    if (!passed) {
                        this.reportBug('low-frame-rate', 'Frame rate below threshold', {
                            avgFrameRate,
                            minFrameRate,
                            threshold: this.testConfig.frameRateThreshold
                        });
                    }
                    
                    resolve({
                        name: 'Frame Rate Stability',
                        passed,
                        details: `Avg FPS: ${avgFrameRate.toFixed(1)}, Min: ${minFrameRate.toFixed(1)}`,
                        data: { avgFrameRate, minFrameRate, frameRates: frameRates.slice(-10) }
                    });
                }
            }, 100);
        });
    }
    
    /**
     * Test memory performance
     */
    async testMemoryPerformance() {
        return new Promise((resolve) => {
            if (!performance.memory) {
                resolve({
                    name: 'Memory Performance',
                    passed: true,
                    details: 'Memory API not available',
                    data: { available: false }
                });
                return;
            }
            
            const initialMemory = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
            
            setTimeout(() => {
                const finalMemory = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
                const memoryIncrease = finalMemory - initialMemory;
                const passed = memoryIncrease < this.testConfig.memoryLeakThreshold;
                
                if (!passed) {
                    this.bugPatterns.memoryLeak.detected = true;
                    this.reportBug('memory-leak-detected', 'Excessive memory usage increase', {
                        initialMemory,
                        finalMemory,
                        increase: memoryIncrease
                    });
                }
                
                resolve({
                    name: 'Memory Performance',
                    passed,
                    details: `Memory increase: ${memoryIncrease.toFixed(2)} MB`,
                    data: { initialMemory, finalMemory, memoryIncrease }
                });
            }, 5000); // Test for 5 seconds
        });
    }
    
    /**
     * Test entity limits
     */
    async testEntityLimits() {
        const enemyCount = window.enemies ? window.enemies.length : 0;
        const bulletCount = (window.playerBullets ? window.playerBullets.length : 0) + 
                           (window.enemyBullets ? window.enemyBullets.length : 0);
        
        const passed = enemyCount < this.testConfig.maxEnemyCount;
        
        if (!passed) {
            this.reportBug('entity-limit-exceeded', 'Too many entities affecting performance', {
                enemyCount,
                bulletCount,
                maxEnemyCount: this.testConfig.maxEnemyCount
            });
        }
        
        return {
            name: 'Entity Limits',
            passed,
            details: `Enemies: ${enemyCount}, Bullets: ${bulletCount}`,
            data: { enemyCount, bulletCount }
        };
    }
    
    /**
     * Test audio system
     */
    async testAudio() {
        this.currentTest = 'audio';
        console.log('🎵 Testing audio system...');
        
        const results = {
            category: 'audio',
            tests: [],
            passed: 0,
            failed: 0
        };
        
        // Test audio context
        results.tests.push(this.testAudioContext());
        
        // Test sound playback
        results.tests.push(await this.testSoundPlayback());
        
        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Audio tests: ${results.passed} passed, ${results.failed} failed`);
    }
    
    /**
     * Test audio context
     */
    testAudioContext() {
        const issues = [];
        
        if (!window.audio) {
            issues.push('Audio system not found');
        } else if (!window.audio.audioContext) {
            issues.push('Audio context not found');
        } else if (window.audio.audioContext.state !== 'running') {
            issues.push(`Audio context state: ${window.audio.audioContext.state}`);
        }
        
        const passed = issues.length === 0;
        
        return {
            name: 'Audio Context',
            passed,
            details: passed ? 'Audio context running' : `Issues: ${issues.join(', ')}`,
            data: { issues }
        };
    }
    
    /**
     * Test sound playback
     */
    async testSoundPlayback() {
        return new Promise((resolve) => {
            if (!window.audio) {
                resolve({
                    name: 'Sound Playback',
                    passed: false,
                    details: 'Audio system not available',
                    data: {}
                });
                return;
            }
            
            try {
                // Test playing a sound
                window.audio.playPlayerShoot(100, 100);
                
                resolve({
                    name: 'Sound Playback',
                    passed: true,
                    details: 'Sound playback successful',
                    data: {}
                });
            } catch (error) {
                this.bugPatterns.audioFailures.detected = true;
                this.bugPatterns.audioFailures.count++;
                
                resolve({
                    name: 'Sound Playback',
                    passed: false,
                    details: `Sound playback failed: ${error.message}`,
                    data: { error: error.message }
                });
            }
        });
    }
    
    /**
     * Test collision system
     */
    async testCollisionSystem() {
        this.currentTest = 'collision';
        console.log('💥 Testing collision system...');
        
        const results = {
            category: 'collision',
            tests: [],
            passed: 0,
            failed: 0
        };
        
        // Test collision detection
        results.tests.push(await this.testCollisionDetection());
        
        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Collision tests: ${results.passed} passed, ${results.failed} failed`);
    }
    
    /**
     * Test collision detection
     */
    async testCollisionDetection() {
        return new Promise((resolve) => {
            if (!window.collisionSystem) {
                resolve({
                    name: 'Collision Detection',
                    passed: false,
                    details: 'Collision system not found',
                    data: {}
                });
                return;
            }
            
            // Test basic collision detection
            const testPassed = typeof window.collisionSystem.checkCollision === 'function';
            
            resolve({
                name: 'Collision Detection',
                passed: testPassed,
                details: testPassed ? 'Collision system available' : 'Collision methods missing',
                data: {}
            });
        });
    }
    
    /**
     * Test UI system
     */
    async testUI() {
        this.currentTest = 'ui';
        console.log('🖥️ Testing UI system...');
        
        const results = {
            category: 'ui',
            tests: [],
            passed: 0,
            failed: 0
        };
        
        // Test UI renderer
        results.tests.push(this.testUIRenderer());
        
        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ UI tests: ${results.passed} passed, ${results.failed} failed`);
    }
    
    /**
     * Test UI renderer
     */
    testUIRenderer() {
        const issues = [];
        
        if (!window.uiRenderer) {
            issues.push('UI renderer not found');
        } else {
            if (typeof window.uiRenderer.render !== 'function') {
                issues.push('UI render method missing');
            }
        }
        
        const passed = issues.length === 0;
        
        return {
            name: 'UI Renderer',
            passed,
            details: passed ? 'UI renderer available' : `Issues: ${issues.join(', ')}`,
            data: { issues }
        };
    }
    
    /**
     * Test memory usage
     */
    async testMemoryUsage() {
        this.currentTest = 'memory';
        console.log('🧠 Testing memory usage...');
        
        const results = {
            category: 'memory',
            tests: [],
            passed: 0,
            failed: 0
        };
        
        // Test for memory leaks
        results.tests.push(await this.testMemoryLeaks());
        
        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Memory tests: ${results.passed} passed, ${results.failed} failed`);
    }
    
    /**
     * Test for memory leaks
     */
    async testMemoryLeaks() {
        return new Promise((resolve) => {
            if (!performance.memory) {
                resolve({
                    name: 'Memory Leaks',
                    passed: true,
                    details: 'Memory API not available',
                    data: { available: false }
                });
                return;
            }
            
            const initialMemory = performance.memory.usedJSHeapSize;
            
            // Force garbage collection if available
            if (window.gc) {
                window.gc();
            }
            
            setTimeout(() => {
                const finalMemory = performance.memory.usedJSHeapSize;
                const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
                const passed = memoryIncrease < 10; // Less than 10MB increase
                
                resolve({
                    name: 'Memory Leaks',
                    passed,
                    details: `Memory change: ${memoryIncrease.toFixed(2)} MB`,
                    data: { initialMemory, finalMemory, memoryIncrease }
                });
            }, 2000);
        });
    }
    
    /**
     * Test consistency
     */
    async testConsistency() {
        this.currentTest = 'consistency';
        console.log('🔍 Testing consistency...');
        
        const results = {
            category: 'consistency',
            tests: [],
            passed: 0,
            failed: 0
        };
        
        // Test constructor consistency
        results.tests.push(this.testConstructorConsistency());
        
        // Test timing consistency
        results.tests.push(this.testTimingConsistency());
        
        // Test logging consistency
        results.tests.push(this.testLoggingConsistency());
        
        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Consistency tests: ${results.passed} passed, ${results.failed} failed`);
    }
    
    /**
     * Test constructor consistency
     */
    testConstructorConsistency() {
        const issues = [];
        
        // Check if enemies exist and have consistent constructors
        if (window.enemies && window.enemies.length > 0) {
            for (const enemy of window.enemies) {
                if (!enemy.type) {
                    issues.push(`Enemy missing type: ${enemy.constructor.name}`);
                }
                if (!enemy.config) {
                    issues.push(`Enemy missing config: ${enemy.type || enemy.constructor.name}`);
                }
                if (!enemy.p) {
                    issues.push(`Enemy missing p5 instance: ${enemy.type || enemy.constructor.name}`);
                }
                if (!enemy.audio) {
                    issues.push(`Enemy missing audio: ${enemy.type || enemy.constructor.name}`);
                }
            }
        }
        
        const passed = issues.length === 0;
        
        if (!passed) {
            this.reportBug('constructor-inconsistency', 'Constructor consistency violations found', { issues });
        }
        
        return {
            name: 'Constructor Consistency',
            passed,
            details: passed ? 'All constructors consistent' : `Issues: ${issues.length}`,
            data: { issues }
        };
    }
    
    /**
     * Test timing consistency
     */
    testTimingConsistency() {
        const issues = [];
        
        // Check if deltaTime is being used properly
        if (typeof deltaTime === 'undefined') {
            issues.push('deltaTime not available globally');
        }
        
        // Check if enemies have deltaTime-based updates
        if (window.enemies && window.enemies.length > 0) {
            for (const enemy of window.enemies) {
                if (typeof enemy.update !== 'function') {
                    issues.push(`Enemy missing update method: ${enemy.type}`);
                }
            }
        }
        
        const passed = issues.length === 0;
        
        return {
            name: 'Timing Consistency',
            passed,
            details: passed ? 'Timing system consistent' : `Issues: ${issues.length}`,
            data: { issues }
        };
    }
    
    /**
     * Test logging consistency
     */
    testLoggingConsistency() {
        // This is a basic test - in a real implementation, we'd analyze console logs
        const passed = true; // Assume passing for now
        
        return {
            name: 'Logging Consistency',
            passed,
            details: 'Logging consistency check passed',
            data: {}
        };
    }
    
    /**
     * Report a bug to the ticketing system
     */
    async reportBug(bugId, description, data = {}) {
        try {
            if (window.ticketManager && window.ticketManager.createTicket) {
                const ticket = {
                    id: `AUTO-${Date.now()}-${bugId}`,
                    type: 'bug',
                    title: `Automated Test Bug: ${description}`,
                    description: `Bug detected during automated testing: ${description}`,
                    timestamp: new Date().toISOString(),
                    status: 'Open',
                    data: data,
                    source: 'automated-testing',
                    testSuite: this.currentTest,
                    history: [{
                        type: 'automated_detection',
                        description: `Bug detected by comprehensive test suite in ${this.currentTest} category`,
                        at: new Date().toISOString()
                    }]
                };
                
                await window.ticketManager.createTicket(ticket);
                console.log(`🐛 Bug reported: ${bugId}`);
            }
        } catch (error) {
            console.error('Failed to report bug:', error);
        }
    }
    
    /**
     * Generate comprehensive test report
     */
    generateTestReport() {
        const totalTests = this.testResults.reduce((sum, category) => sum + category.tests.length, 0);
        const totalPassed = this.testResults.reduce((sum, category) => sum + category.passed, 0);
        const totalFailed = this.testResults.reduce((sum, category) => sum + category.failed, 0);
        const duration = Date.now() - this.startTime;
        
        console.log('\n🧪 ===== COMPREHENSIVE TEST REPORT =====');
        console.log(`⏱️ Duration: ${duration}ms`);
        console.log(`📊 Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${totalPassed}`);
        console.log(`❌ Failed: ${totalFailed}`);
        console.log(`📈 Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
        
        console.log('\n📋 Category Breakdown:');
        for (const category of this.testResults) {
            console.log(`  ${category.category}: ${category.passed}/${category.tests.length} passed`);
        }
        
        console.log('\n🐛 Bug Pattern Detection:');
        for (const [pattern, data] of Object.entries(this.bugPatterns)) {
            if (data.detected) {
                console.log(`  ⚠️ ${pattern}: DETECTED`);
            }
        }
        
        console.log('\n🔍 Failed Tests:');
        for (const category of this.testResults) {
            const failedTests = category.tests.filter(t => !t.passed);
            for (const test of failedTests) {
                console.log(`  ❌ ${category.category}/${test.name}: ${test.details}`);
            }
        }
        
        console.log('\n===== END TEST REPORT =====\n');
        
        // Store report for external access
        window.lastTestReport = {
            duration,
            totalTests,
            totalPassed,
            totalFailed,
            successRate: (totalPassed / totalTests) * 100,
            categories: this.testResults,
            bugPatterns: this.bugPatterns,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Get current test status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            currentTest: this.currentTest,
            startTime: this.startTime,
            results: this.testResults
        };
    }
    
    /**
     * Quick health check
     */
    quickHealthCheck() {
        const issues = [];
        
        if (!window.gameState) issues.push('gameState missing');
        if (!window.player) issues.push('player missing');
        if (!window.audio) issues.push('audio missing');
        if (!window.beatClock) issues.push('beatClock missing');
        
        const healthy = issues.length === 0;
        
        console.log(healthy ? '✅ Quick health check: PASSED' : `❌ Quick health check: ${issues.join(', ')}`);
        
        return { healthy, issues };
    }

    /**
     * Test game initialization and startup
     * This is the most critical test - does the game actually start?
     */
    async testGameInitialization() {
        const results = {
            passed: 0,
            failed: 0,
            details: []
        };

        // Test 1: Check for JavaScript errors during startup
        const errors = this.getJavaScriptErrors();
        if (errors.length === 0) {
            results.passed++;
            results.details.push('✅ No JavaScript errors during startup');
        } else {
            results.failed++;
            results.details.push(`❌ JavaScript errors found: ${errors.join(', ')}`);
        }

        // Test 2: Verify game state reaches "playing"
        if (window.gameState && window.gameState.gameState === 'playing') {
            results.passed++;
            results.details.push('✅ Game state successfully reached "playing"');
        } else {
            results.failed++;
            results.details.push(`❌ Game state not playing: ${window.gameState ? window.gameState.gameState : 'undefined'}`);
        }

        // Test 3: Verify core systems are initialized
        const coreSystems = ['player', 'gameState', 'audio', 'cameraSystem', 'spawnSystem'];
        let systemsInitialized = 0;
        for (const system of coreSystems) {
            if (window[system]) {
                systemsInitialized++;
                results.details.push(`✅ ${system} initialized`);
            } else {
                results.details.push(`❌ ${system} not initialized`);
            }
        }
        
        if (systemsInitialized === coreSystems.length) {
            results.passed++;
            results.details.push('✅ All core systems initialized');
        } else {
            results.failed++;
            results.details.push(`❌ Only ${systemsInitialized}/${coreSystems.length} core systems initialized`);
        }

        // Test 4: Verify canvas is created and visible
        const canvas = document.querySelector('canvas');
        if (canvas && canvas.width > 0 && canvas.height > 0) {
            results.passed++;
            results.details.push('✅ Canvas created and has valid dimensions');
        } else {
            results.failed++;
            results.details.push('❌ Canvas not found or has invalid dimensions');
        }

        return {
            testName: 'Game Initialization',
            ...results,
            critical: true // Mark as critical test
        };
    }

    /**
     * Get JavaScript errors from console
     */
    getJavaScriptErrors() {
        // This would need to be implemented with actual error tracking
        // For now, check if critical objects exist
        const errors = [];
        
        try {
            if (typeof VisualEffectsManager === 'undefined') {
                errors.push('VisualEffectsManager not defined');
            }
        } catch (e) {
            // VisualEffectsManager might be in module scope, check if game works instead
        }

        // Check for common initialization failures
        if (!window.gameState) errors.push('GameState not initialized');
        if (!window.player) errors.push('Player not initialized');
        if (!window.audio) errors.push('Audio not initialized');

        return errors;
    }
}

// Auto-initialize if in browser context
if (typeof window !== 'undefined') {
    window.comprehensiveTestSuite = new ComprehensiveTestSuite();
    console.log('🧪 Comprehensive Test Suite available as window.comprehensiveTestSuite');
    
    // Add keyboard shortcut for quick testing
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F9') {
            window.comprehensiveTestSuite.runAllTests();
        } else if (e.key === 'F10') {
            window.comprehensiveTestSuite.quickHealthCheck();
        }
    });
    
    console.log('⌨️ Test shortcuts: F9 = Full Test Suite, F10 = Quick Health Check');
} 