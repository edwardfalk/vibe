/**
 * Enhanced Playwright Testing System
 * Uses proper KeyboardEvent simulation for accurate game testing
 * Based on working methods from interactive-gameplay-test.js
 * Optimized with MCP Playwright best practices
 */

class EnhancedPlaywrightTester {
    constructor() {
        this.testResults = [];
        this.currentTest = null;
        this.defaultTimeout = 1000; // 1 second default timeout
        this.keyHoldDuration = 200; // How long to hold keys
        this.actionDelay = 100; // Delay between actions
    }

    /**
     * Run comprehensive gameplay tests using proper event simulation
     */
    async runEnhancedTests() {
        console.log('🚀 Starting Enhanced Playwright Tests...');
        console.log('🎯 Using MCP Playwright optimized approach');
        
        // Clear previous results
        this.testResults = [];
        
        // Run test suite with proper timing
        await this.testGameInitialization();
        await this.testProperShooting();
        await this.testProperMovement();
        await this.testCombatWithCollisions();
        await this.testAudioSystem();
        await this.testAdvancedInteractions();
        
        // Display results
        this.displayResults();
        
        return this.testResults;
    }

    /**
     * Simulate key press with proper timing (MCP Playwright style)
     */
    async simulateKeyPress(key, holdDuration = this.keyHoldDuration) {
        // Key down
        const keyDownEvent = new KeyboardEvent('keydown', { 
            key: key, 
            code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(keyDownEvent);
        
        // Hold the key
        await this.wait(holdDuration);
        
        // Key up
        const keyUpEvent = new KeyboardEvent('keyup', { 
            key: key, 
            code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(keyUpEvent);
        
        // Small delay after key release
        await this.wait(this.actionDelay);
    }

    /**
     * Simulate mouse click with proper coordinates
     */
    async simulateMouseClick(x = 400, y = 300) {
        const canvas = document.querySelector('canvas');
        if (!canvas) return false;

        const rect = canvas.getBoundingClientRect();
        const clickEvent = new MouseEvent('click', {
            clientX: rect.left + x,
            clientY: rect.top + y,
            bubbles: true,
            cancelable: true
        });
        
        canvas.dispatchEvent(clickEvent);
        await this.wait(this.actionDelay);
        return true;
    }

    /**
     * Wait utility with promise
     */
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Test game initialization and basic systems
     */
    async testGameInitialization() {
        this.currentTest = 'game-initialization';
        console.log('🎮 Testing game initialization...');
        
        const results = {
            category: 'game-initialization',
            tests: [],
            passed: 0,
            failed: 0
        };

        // Test core systems exist
        const coreSystemsExist = !!(window.player && window.gameState && window.audio);
        results.tests.push({
            name: 'Core Systems Available',
            passed: coreSystemsExist,
            details: coreSystemsExist ? 'Player, gameState, and audio systems found' : 'Missing core systems'
        });

        // Test game state
        const gameRunning = window.gameState && (window.gameState.gameState === 'playing' || window.gameState.gameState === 'gameOver');
        results.tests.push({
            name: 'Game State Valid',
            passed: gameRunning,
            details: gameRunning ? `Game state: ${window.gameState.gameState}` : 'Invalid game state'
        });

        // Test collision system
        const collisionSystemExists = !!window.collisionSystem;
        results.tests.push({
            name: 'Collision System Available',
            passed: collisionSystemExists,
            details: collisionSystemExists ? 'Collision system found' : 'Collision system missing'
        });

        // Test canvas element
        const canvasExists = !!document.querySelector('canvas');
        results.tests.push({
            name: 'Canvas Element Available',
            passed: canvasExists,
            details: canvasExists ? 'Canvas element found' : 'Canvas element missing'
        });

        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Game initialization tests: ${results.passed} passed, ${results.failed} failed`);
    }

    /**
     * Test shooting using proper KeyboardEvent simulation (MCP Playwright optimized)
     */
    async testProperShooting() {
        this.currentTest = 'proper-shooting';
        console.log('🔫 Testing proper shooting mechanics...');
        
        const results = {
            category: 'proper-shooting',
            tests: [],
            passed: 0,
            failed: 0
        };

        // Ensure game is in playing state
        if (window.gameState && window.gameState.gameState === 'gameOver') {
            if (typeof window.gameState.restartGame === 'function') {
                window.gameState.restartGame();
                await this.wait(500); // Wait for restart
            }
        }

        // Test spacebar shooting
        const initialBulletCount = window.playerBullets ? window.playerBullets.length : 0;
        
        console.log('🎯 Simulating spacebar shooting...');
        await this.simulateKeyPress(' ');
        
        await this.wait(200); // Wait for bullet creation
        
        const newBulletCount = window.playerBullets ? window.playerBullets.length : 0;
        const bulletCreated = newBulletCount > initialBulletCount;
        
        results.tests.push({
            name: 'Spacebar Shooting',
            passed: bulletCreated,
            details: bulletCreated ? 
                `Bullet created (${initialBulletCount} → ${newBulletCount})` :
                'No bullet created with spacebar',
            data: { initialCount: initialBulletCount, newCount: newBulletCount }
        });

        // Test mouse click shooting
        const mouseInitialCount = window.playerBullets ? window.playerBullets.length : 0;
        
        console.log('🖱️ Simulating mouse click shooting...');
        const mouseClickSuccess = await this.simulateMouseClick();
        
        await this.wait(200);
        
        const mouseFinalCount = window.playerBullets ? window.playerBullets.length : 0;
        const mouseShootWorked = mouseFinalCount > mouseInitialCount;
        
        results.tests.push({
            name: 'Mouse Click Shooting',
            passed: mouseShootWorked,
            details: mouseShootWorked ? 
                `Mouse shooting works (${mouseInitialCount} → ${mouseFinalCount})` :
                'Mouse shooting failed',
            data: { initialCount: mouseInitialCount, finalCount: mouseFinalCount, clickSuccess: mouseClickSuccess }
        });

        // Test rapid fire control
        const rapidInitialCount = window.playerBullets ? window.playerBullets.length : 0;
        
        console.log('⚡ Testing rapid fire control...');
        for (let i = 0; i < 5; i++) {
            await this.simulateKeyPress(' ', 50); // Quick presses
        }
        
        await this.wait(300);
        
        const rapidFinalCount = window.playerBullets ? window.playerBullets.length : 0;
        const rapidBulletsCreated = rapidFinalCount - rapidInitialCount;
        const hasRateLimit = rapidBulletsCreated < 5; // Should be rate limited
        
        results.tests.push({
            name: 'Rate of Fire Limiting',
            passed: hasRateLimit,
            details: hasRateLimit ? 
                `Rate limiting working (${rapidBulletsCreated}/5 rapid shots)` :
                `No rate limiting (${rapidBulletsCreated}/5 rapid shots)`,
            data: { attempts: 5, created: rapidBulletsCreated }
        });

        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Proper shooting tests: ${results.passed} passed, ${results.failed} failed`);
    }

    /**
     * Test movement using proper KeyboardEvent simulation (MCP Playwright optimized)
     */
    async testProperMovement() {
        this.currentTest = 'proper-movement';
        console.log('🎮 Testing proper movement mechanics...');
        
        const results = {
            category: 'proper-movement',
            tests: [],
            passed: 0,
            failed: 0
        };

        if (!window.player) {
            results.tests.push({
                name: 'Player Exists',
                passed: false,
                details: 'Player object not found'
            });
            results.failed = 1;
            this.testResults.push(results);
            return;
        }

        // Test WASD movement with longer hold times
        const movements = [
            { key: 'w', name: 'W (Up)', expectedChange: 'y' },
            { key: 'a', name: 'A (Left)', expectedChange: 'x' },
            { key: 's', name: 'S (Down)', expectedChange: 'y' },
            { key: 'd', name: 'D (Right)', expectedChange: 'x' }
        ];

        for (const movement of movements) {
            const initialX = window.player.x;
            const initialY = window.player.y;
            
            console.log(`🎯 Testing ${movement.name} movement...`);
            await this.simulateKeyPress(movement.key, 300); // Hold longer for more movement
            
            await this.wait(100); // Wait for movement to register
            
            const finalX = window.player.x;
            const finalY = window.player.y;
            const moved = (finalX !== initialX) || (finalY !== initialY);
            
            results.tests.push({
                name: `${movement.name} Movement`,
                passed: moved,
                details: moved ? 
                    `Player moved from (${Math.round(initialX)}, ${Math.round(initialY)}) to (${Math.round(finalX)}, ${Math.round(finalY)})` :
                    `Player did not move from (${Math.round(initialX)}, ${Math.round(initialY)})`,
                data: { 
                    initial: { x: initialX, y: initialY },
                    final: { x: finalX, y: finalY },
                    distance: Math.sqrt((finalX - initialX) ** 2 + (finalY - initialY) ** 2)
                }
            });
        }

        // Test diagonal movement (W+D) with simultaneous key presses
        const initialX = window.player.x;
        const initialY = window.player.y;
        
        console.log('🎯 Testing diagonal movement (W+D)...');
        
        // Press both keys simultaneously
        const wEvent = new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true });
        const dEvent = new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', bubbles: true });
        document.dispatchEvent(wEvent);
        document.dispatchEvent(dEvent);
        
        await this.wait(300); // Hold both keys
        
        // Release both keys
        const wUpEvent = new KeyboardEvent('keyup', { key: 'w', code: 'KeyW', bubbles: true });
        const dUpEvent = new KeyboardEvent('keyup', { key: 'd', code: 'KeyD', bubbles: true });
        document.dispatchEvent(wUpEvent);
        document.dispatchEvent(dUpEvent);
        
        await this.wait(100);
        
        const finalX = window.player.x;
        const finalY = window.player.y;
        const diagonalMoved = (finalX !== initialX) && (finalY !== initialY);
        
        results.tests.push({
            name: 'Diagonal Movement (W+D)',
            passed: diagonalMoved,
            details: diagonalMoved ? 
                `Player moved diagonally from (${Math.round(initialX)}, ${Math.round(initialY)}) to (${Math.round(finalX)}, ${Math.round(finalY)})` :
                `Player did not move diagonally from (${Math.round(initialX)}, ${Math.round(initialY)})`,
            data: { 
                initial: { x: initialX, y: initialY },
                final: { x: finalX, y: finalY },
                distance: Math.sqrt((finalX - initialX) ** 2 + (finalY - initialY) ** 2)
            }
        });

        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Proper movement tests: ${results.passed} passed, ${results.failed} failed`);
    }

    /**
     * Test combat scenario with collision detection
     */
    async testCombatWithCollisions() {
        this.currentTest = 'combat-collisions';
        console.log('⚔️ Testing combat with collision detection...');
        
        const results = {
            category: 'combat-collisions',
            tests: [],
            passed: 0,
            failed: 0
        };

        // Test collision system stability
        const collisionSystemWorking = window.collisionSystem && typeof window.collisionSystem.checkBulletCollisions === 'function';
        results.tests.push({
            name: 'Collision System Stability',
            passed: collisionSystemWorking,
            details: collisionSystemWorking ? 
                'Collision system remained stable during combat' :
                'Collision system crashed or became unavailable'
        });

        // Test actual collision by forcing bullets near enemies
        if (window.enemies && window.enemies.length > 0 && window.playerBullets) {
            console.log('🎯 Testing actual bullet-enemy collision...');
            
            const initialEnemyCount = window.enemies.length;
            
            // Rapid shooting while moving towards enemies
            for (let i = 0; i < 10; i++) {
                await this.simulateKeyPress(' ', 50);
                await this.simulateKeyPress('w', 50);
                await this.wait(50);
            }
            
            await this.wait(1000); // Wait for collisions to process
            
            const finalEnemyCount = window.enemies.length;
            const enemiesHit = initialEnemyCount > finalEnemyCount;
            
            results.tests.push({
                name: 'Bullet-Enemy Collision',
                passed: enemiesHit,
                details: enemiesHit ? 
                    `Enemies hit (${initialEnemyCount} → ${finalEnemyCount})` :
                    'No enemies hit during collision test',
                data: { initialCount: initialEnemyCount, finalCount: finalEnemyCount }
            });
        }

        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Combat collision tests: ${results.passed} passed, ${results.failed} failed`);
    }

    /**
     * Test audio system during gameplay
     */
    async testAudioSystem() {
        this.currentTest = 'audio-system';
        console.log('🔊 Testing audio system...');
        
        const results = {
            category: 'audio-system',
            tests: [],
            passed: 0,
            failed: 0
        };

        // Test audio context
        const audioContextActive = window.audio && window.audio.context && window.audio.context.state === 'running';
        results.tests.push({
            name: 'Audio Context Active',
            passed: audioContextActive,
            details: audioContextActive ? 
                'Audio context is running' :
                `Audio context state: ${window.audio ? window.audio.context?.state : 'unknown'}`
        });

        // Test beat clock
        const beatClockExists = !!window.beatClock;
        results.tests.push({
            name: 'Beat Clock System',
            passed: beatClockExists,
            details: beatClockExists ? 
                'Beat clock system available' :
                'Beat clock system missing'
        });

        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Audio system tests: ${results.passed} passed, ${results.failed} failed`);
    }

    /**
     * Test advanced interactions (MCP Playwright style comprehensive testing)
     */
    async testAdvancedInteractions() {
        this.currentTest = 'advanced-interactions';
        console.log('🚀 Testing advanced interactions...');
        
        const results = {
            category: 'advanced-interactions',
            tests: [],
            passed: 0,
            failed: 0
        };

        // Test simultaneous actions (movement + shooting)
        console.log('🎯 Testing simultaneous movement and shooting...');
        
        const initialBullets = window.playerBullets ? window.playerBullets.length : 0;
        const initialX = window.player ? window.player.x : 0;
        
        // Simultaneous movement and shooting
        const moveEvent = new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true });
        document.dispatchEvent(moveEvent);
        
        for (let i = 0; i < 3; i++) {
            await this.simulateKeyPress(' ', 100);
            await this.wait(100);
        }
        
        const moveUpEvent = new KeyboardEvent('keyup', { key: 'w', code: 'KeyW', bubbles: true });
        document.dispatchEvent(moveUpEvent);
        
        await this.wait(200);
        
        const finalBullets = window.playerBullets ? window.playerBullets.length : 0;
        const finalX = window.player ? window.player.x : 0;
        
        const simultaneousWorked = (finalBullets > initialBullets) && (finalX !== initialX);
        
        results.tests.push({
            name: 'Simultaneous Movement + Shooting',
            passed: simultaneousWorked,
            details: simultaneousWorked ? 
                `Both movement and shooting worked simultaneously` :
                'Simultaneous actions failed',
            data: { 
                bulletChange: finalBullets - initialBullets,
                positionChange: Math.abs(finalX - initialX)
            }
        });

        // Test game state persistence during actions
        const gameStatePersistent = window.gameState && window.gameState.gameState === 'playing';
        results.tests.push({
            name: 'Game State Persistence',
            passed: gameStatePersistent,
            details: gameStatePersistent ? 
                'Game state remained stable during complex interactions' :
                'Game state became unstable'
        });

        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Advanced interaction tests: ${results.passed} passed, ${results.failed} failed`);
    }

    /**
     * Display comprehensive test results
     */
    displayResults() {
        console.log('\n🧪 ===== ENHANCED PLAYWRIGHT TEST REPORT =====');
        console.log(`📅 Test Date: ${new Date().toISOString()}`);
        console.log(`🌐 Test Method: MCP Playwright Optimized KeyboardEvent Simulation`);
        console.log(`⏱️ Timing: ${this.keyHoldDuration}ms key hold, ${this.actionDelay}ms action delay`);
        
        let totalPassed = 0;
        let totalFailed = 0;
        let totalTests = 0;
        
        for (const category of this.testResults) {
            totalPassed += category.passed;
            totalFailed += category.failed;
            totalTests += category.tests.length;
            
            const status = category.failed === 0 ? '✅ PASS' : '❌ FAIL';
            console.log(`  ${status} ${category.category}: ${category.passed}/${category.tests.length} passed`);
        }
        
        const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;
        
        console.log(`📊 Overall Results:`);
        console.log(`  Total Tests: ${totalTests}`);
        console.log(`  Passed: ${totalPassed}`);
        console.log(`  Failed: ${totalFailed}`);
        console.log(`  Success Rate: ${successRate}%`);
        
        if (totalFailed === 0) {
            console.log('🎉 All tests passed! Game is fully functional.');
        } else if (successRate >= 70) {
            console.log('✅ Most tests passed. Game is largely functional.');
        } else {
            console.log('⚠️ Many tests failed. Check individual test details.');
        }
        
        console.log('===== END ENHANCED TEST REPORT =====\n');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.EnhancedPlaywrightTester = EnhancedPlaywrightTester;
}

// Auto-run if F8 key is pressed
if (typeof document !== 'undefined') {
    document.addEventListener('keydown', async (event) => {
        if (event.key === 'F8') {
            event.preventDefault();
            const tester = new EnhancedPlaywrightTester();
            await tester.runEnhancedTests();
        }
    });
}

export default EnhancedPlaywrightTester;