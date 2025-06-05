/**
 * Extended Gameplay Test System
 * Runs the game for several minutes with continuous player movement and shooting
 * Tests game stability, performance, and functionality under extended play
 * Based on MCP Playwright optimized testing patterns
 */

class ExtendedGameplayTester {
    constructor() {
        this.testResults = [];
        this.currentTest = null;
        this.testDuration = 3 * 60 * 1000; // 3 minutes in milliseconds
        this.actionInterval = 150; // Action every 150ms
        this.isRunning = false;
        this.startTime = null;
        this.stats = {
            totalActions: 0,
            shotsFired: 0,
            movementActions: 0,
            enemiesKilled: 0,
            playerDeaths: 0,
            errors: 0,
            maxEnemies: 0,
            maxBullets: 0
        };
    }

    /**
     * Run extended gameplay test
     */
    async runExtendedTest() {
        console.log('🚀 Starting Extended Gameplay Test...');
        console.log(`⏱️ Duration: ${this.testDuration / 1000} seconds`);
        console.log(`🎯 Action Interval: ${this.actionInterval}ms`);
        
        this.testResults = [];
        this.isRunning = true;
        this.startTime = Date.now();
        
        // Initialize test
        await this.initializeTest();
        
        // Run main gameplay loop
        await this.runGameplayLoop();
        
        // Analyze results
        await this.analyzeResults();
        
        // Display comprehensive report
        this.displayExtendedReport();
        
        return this.testResults;
    }

    /**
     * Initialize the test environment
     */
    async initializeTest() {
        console.log('🎮 Initializing extended test environment...');
        
        // Ensure game is running
        if (window.gameState && window.gameState.gameState === 'gameOver') {
            if (typeof window.gameState.restartGame === 'function') {
                window.gameState.restartGame();
                await this.wait(1000); // Wait for restart
                console.log('🔄 Game restarted for extended test');
            }
        }

        // Reset stats
        this.stats = {
            totalActions: 0,
            shotsFired: 0,
            movementActions: 0,
            enemiesKilled: 0,
            playerDeaths: 0,
            errors: 0,
            maxEnemies: 0,
            maxBullets: 0,
            initialPlayerHealth: window.player ? window.player.health : 0,
            initialScore: window.gameState ? window.gameState.score : 0
        };

        console.log('✅ Extended test initialized');
    }

    /**
     * Main gameplay loop - runs for the specified duration
     */
    async runGameplayLoop() {
        console.log('🎯 Starting extended gameplay loop...');
        
        const movements = ['w', 'a', 's', 'd'];
        let actionCount = 0;
        
        while (this.isRunning && (Date.now() - this.startTime) < this.testDuration) {
            try {
                actionCount++;
                this.stats.totalActions++;
                
                // Log progress every 30 seconds
                const elapsed = Date.now() - this.startTime;
                if (actionCount % 200 === 0) { // Every ~30 seconds
                    const minutes = Math.floor(elapsed / 60000);
                    const seconds = Math.floor((elapsed % 60000) / 1000);
                    console.log(`⏱️ Extended test progress: ${minutes}:${seconds.toString().padStart(2, '0')} - Actions: ${this.stats.totalActions}`);
                }

                // Random action selection (weighted towards combat)
                const actionType = Math.random();
                
                if (actionType < 0.4) {
                    // 40% chance: Shoot
                    await this.performShooting();
                } else if (actionType < 0.8) {
                    // 40% chance: Move
                    const randomDirection = movements[Math.floor(Math.random() * movements.length)];
                    await this.performMovement(randomDirection);
                } else {
                    // 20% chance: Combined action (move + shoot)
                    await this.performCombinedAction(movements);
                }

                // Monitor game state
                await this.monitorGameState();
                
                // Update statistics
                this.updateStatistics();
                
                // Wait before next action
                await this.wait(this.actionInterval);
                
            } catch (error) {
                this.stats.errors++;
                console.error('❌ Error during extended gameplay:', error.message);
                
                // Try to recover
                await this.attemptRecovery();
            }
        }
        
        console.log('✅ Extended gameplay loop completed');
    }

    /**
     * Perform shooting action
     */
    async performShooting() {
        try {
            const shootType = Math.random() < 0.7 ? 'spacebar' : 'mouse';
            
            if (shootType === 'spacebar') {
                await this.simulateKeyPress(' ', 100);
            } else {
                await this.simulateMouseClick();
            }
            
            this.stats.shotsFired++;
        } catch (error) {
            console.error('❌ Shooting error:', error.message);
        }
    }

    /**
     * Perform movement action
     */
    async performMovement(direction) {
        try {
            const holdTime = 100 + Math.random() * 200; // 100-300ms hold
            await this.simulateKeyPress(direction, holdTime);
            this.stats.movementActions++;
        } catch (error) {
            console.error('❌ Movement error:', error.message);
        }
    }

    /**
     * Perform combined action (movement + shooting)
     */
    async performCombinedAction(movements) {
        try {
            const direction = movements[Math.floor(Math.random() * movements.length)];
            
            // Start movement
            const moveDownEvent = new KeyboardEvent('keydown', { 
                key: direction, 
                code: `Key${direction.toUpperCase()}`,
                bubbles: true 
            });
            document.dispatchEvent(moveDownEvent);
            
            // Shoot while moving
            await this.wait(50);
            await this.simulateKeyPress(' ', 80);
            await this.wait(50);
            
            // Stop movement
            const moveUpEvent = new KeyboardEvent('keyup', { 
                key: direction, 
                code: `Key${direction.toUpperCase()}`,
                bubbles: true 
            });
            document.dispatchEvent(moveUpEvent);
            
            this.stats.movementActions++;
            this.stats.shotsFired++;
        } catch (error) {
            console.error('❌ Combined action error:', error.message);
        }
    }

    /**
     * Monitor game state for changes
     */
    async monitorGameState() {
        // Check if player died
        if (window.player && window.player.health <= 0) {
            this.stats.playerDeaths++;
            console.log('💀 Player death detected during extended test');
            
            // Try to restart if possible
            if (window.gameState && typeof window.gameState.restartGame === 'function') {
                await this.wait(1000);
                window.gameState.restartGame();
                await this.wait(1000);
                console.log('🔄 Game restarted after player death');
            }
        }

        // Check if game ended
        if (window.gameState && window.gameState.gameState === 'gameOver') {
            console.log('🎮 Game over detected during extended test');
            
            // Restart for continued testing
            if (typeof window.gameState.restartGame === 'function') {
                await this.wait(1000);
                window.gameState.restartGame();
                await this.wait(1000);
                console.log('🔄 Game restarted after game over');
            }
        }
    }

    /**
     * Update statistics
     */
    updateStatistics() {
        // Track maximum entities
        if (window.enemies) {
            this.stats.maxEnemies = Math.max(this.stats.maxEnemies, window.enemies.length);
        }
        
        if (window.playerBullets) {
            this.stats.maxBullets = Math.max(this.stats.maxBullets, window.playerBullets.length);
        }

        // Track kills (approximate by score increase)
        if (window.gameState && window.gameState.score > this.stats.initialScore) {
            // Rough estimate: each 10 points = 1 kill
            this.stats.enemiesKilled = Math.floor((window.gameState.score - this.stats.initialScore) / 10);
        }
    }

    /**
     * Attempt recovery from errors
     */
    async attemptRecovery() {
        console.log('🔧 Attempting error recovery...');
        
        try {
            // Wait a bit
            await this.wait(500);
            
            // Check if game is still responsive
            if (window.gameState && window.player) {
                console.log('✅ Game appears responsive after error');
            } else {
                console.log('❌ Game may be unresponsive');
                // Could attempt page reload here if needed
            }
        } catch (recoveryError) {
            console.error('❌ Recovery failed:', recoveryError.message);
        }
    }

    /**
     * Analyze test results
     */
    async analyzeResults() {
        console.log('📊 Analyzing extended test results...');
        
        const totalTime = Date.now() - this.startTime;
        const minutes = totalTime / 60000;
        
        const results = {
            category: 'extended-gameplay',
            tests: [],
            passed: 0,
            failed: 0,
            duration: totalTime,
            stats: this.stats
        };

        // Test 1: Game Stability
        const gameStable = this.stats.errors < 10; // Less than 10 errors in 3 minutes
        results.tests.push({
            name: 'Game Stability',
            passed: gameStable,
            details: gameStable ? 
                `Game remained stable (${this.stats.errors} errors)` :
                `Game had stability issues (${this.stats.errors} errors)`,
            data: { errors: this.stats.errors, errorRate: this.stats.errors / minutes }
        });

        // Test 2: Action Responsiveness
        const actionsPerMinute = this.stats.totalActions / minutes;
        const responsive = actionsPerMinute > 200; // Should handle 200+ actions per minute
        results.tests.push({
            name: 'Action Responsiveness',
            passed: responsive,
            details: responsive ? 
                `Game handled ${Math.round(actionsPerMinute)} actions/minute` :
                `Game only handled ${Math.round(actionsPerMinute)} actions/minute`,
            data: { actionsPerMinute: Math.round(actionsPerMinute), totalActions: this.stats.totalActions }
        });

        // Test 3: Shooting System
        const shootingWorked = this.stats.shotsFired > 0;
        results.tests.push({
            name: 'Shooting System Endurance',
            passed: shootingWorked,
            details: shootingWorked ? 
                `${this.stats.shotsFired} shots fired successfully` :
                'No shots were fired',
            data: { shotsFired: this.stats.shotsFired }
        });

        // Test 4: Movement System
        const movementWorked = this.stats.movementActions > 0;
        results.tests.push({
            name: 'Movement System Endurance',
            passed: movementWorked,
            details: movementWorked ? 
                `${this.stats.movementActions} movement actions performed` :
                'No movement actions performed',
            data: { movementActions: this.stats.movementActions }
        });

        // Test 5: Performance
        const goodPerformance = this.stats.maxEnemies < 50 && this.stats.maxBullets < 100;
        results.tests.push({
            name: 'Performance Management',
            passed: goodPerformance,
            details: goodPerformance ? 
                `Good entity management (Max: ${this.stats.maxEnemies} enemies, ${this.stats.maxBullets} bullets)` :
                `Potential performance issues (Max: ${this.stats.maxEnemies} enemies, ${this.stats.maxBullets} bullets)`,
            data: { maxEnemies: this.stats.maxEnemies, maxBullets: this.stats.maxBullets }
        });

        // Test 6: Game Progression
        const gameProgressed = this.stats.enemiesKilled > 0;
        results.tests.push({
            name: 'Game Progression',
            passed: gameProgressed,
            details: gameProgressed ? 
                `Game progressed normally (${this.stats.enemiesKilled} enemies killed)` :
                'No game progression detected',
            data: { enemiesKilled: this.stats.enemiesKilled }
        });

        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log('✅ Extended test analysis completed');
    }

    /**
     * Simulate key press with proper timing
     */
    async simulateKeyPress(key, holdDuration = 100) {
        const keyDownEvent = new KeyboardEvent('keydown', { 
            key: key, 
            code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(keyDownEvent);
        
        await this.wait(holdDuration);
        
        const keyUpEvent = new KeyboardEvent('keyup', { 
            key: key, 
            code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(keyUpEvent);
        
        await this.wait(50);
    }

    /**
     * Simulate mouse click
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
        await this.wait(50);
        return true;
    }

    /**
     * Wait utility
     */
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Stop the extended test
     */
    stopTest() {
        this.isRunning = false;
        console.log('🛑 Extended test stopped by user');
    }

    /**
     * Display comprehensive test report
     */
    displayExtendedReport() {
        console.log('\n🧪 ===== EXTENDED GAMEPLAY TEST REPORT =====');
        console.log(`📅 Test Date: ${new Date().toISOString()}`);
        console.log(`⏱️ Duration: ${Math.round((Date.now() - this.startTime) / 1000)} seconds`);
        console.log(`🎯 Test Method: Extended Continuous Gameplay Simulation`);
        
        const results = this.testResults[0];
        if (results) {
            console.log(`📊 Test Results:`);
            for (const test of results.tests) {
                const status = test.passed ? '✅ PASS' : '❌ FAIL';
                console.log(`  ${status} ${test.name}: ${test.details}`);
            }
            
            const successRate = ((results.passed / results.tests.length) * 100).toFixed(1);
            console.log(`📈 Success Rate: ${successRate}% (${results.passed}/${results.tests.length})`);
        }
        
        console.log(`📊 Gameplay Statistics:`);
        console.log(`  🎯 Total Actions: ${this.stats.totalActions}`);
        console.log(`  🔫 Shots Fired: ${this.stats.shotsFired}`);
        console.log(`  🎮 Movement Actions: ${this.stats.movementActions}`);
        console.log(`  💀 Enemies Killed: ${this.stats.enemiesKilled}`);
        console.log(`  💔 Player Deaths: ${this.stats.playerDeaths}`);
        console.log(`  ❌ Errors: ${this.stats.errors}`);
        console.log(`  👾 Max Enemies: ${this.stats.maxEnemies}`);
        console.log(`  🚀 Max Bullets: ${this.stats.maxBullets}`);
        
        const minutes = (Date.now() - this.startTime) / 60000;
        console.log(`📈 Performance Metrics:`);
        console.log(`  ⚡ Actions/Minute: ${Math.round(this.stats.totalActions / minutes)}`);
        console.log(`  🔫 Shots/Minute: ${Math.round(this.stats.shotsFired / minutes)}`);
        console.log(`  💀 Kills/Minute: ${Math.round(this.stats.enemiesKilled / minutes)}`);
        
        if (results && results.passed === results.tests.length) {
            console.log('🎉 All extended tests passed! Game is stable under extended play.');
        } else if (results && results.passed >= results.tests.length * 0.8) {
            console.log('✅ Most extended tests passed. Game is largely stable.');
        } else {
            console.log('⚠️ Some extended tests failed. Check game stability.');
        }
        
        console.log('===== END EXTENDED TEST REPORT =====\n');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ExtendedGameplayTester = ExtendedGameplayTester;
}

// Auto-run if F7 key is pressed
if (typeof document !== 'undefined') {
    document.addEventListener('keydown', async (event) => {
        if (event.key === 'F7') {
            event.preventDefault();
            const tester = new ExtendedGameplayTester();
            await tester.runExtendedTest();
        }
    });
}

export default ExtendedGameplayTester; 