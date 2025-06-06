/**
 * Extended Gameplay Test System
 * Runs the game for several minutes with continuous player movement and shooting
 * Tests game stability, performance, and functionality under extended play
 * Based on MCP Playwright optimized testing patterns
 */
import { random } from './mathUtils.js';

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

                // Strategic action selection (survival-focused)
                const actionType = random();
                
                // Check if player is in danger (low health or enemies nearby)
                const playerInDanger = window.player && (
                    window.player.health < 50 || 
                    this.isEnemyNearby(100) // Enemy within 100 pixels
                );
                
                if (playerInDanger) {
                    // When in danger: prioritize movement and defensive shooting
                    if (actionType < 0.6) {
                        // 60% chance: Defensive movement
                        const randomDirection = movements[Math.floor(random() * movements.length)];
                        await this.performMovement(randomDirection);
                    } else {
                        // 40% chance: Defensive shooting while moving
                        await this.performCombinedAction(movements);
                    }
                } else {
                    // When safe: balanced combat approach
                    if (actionType < 0.5) {
                        // 50% chance: Shoot
                        await this.performShooting();
                    } else if (actionType < 0.8) {
                        // 30% chance: Move
                        const randomDirection = movements[Math.floor(random() * movements.length)];
                        await this.performMovement(randomDirection);
                    } else {
                        // 20% chance: Combined action (move + shoot)
                        await this.performCombinedAction(movements);
                    }
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
     * Perform strategic shooting action - target nearest enemy
     */
    async performShooting() {
        try {
            // Find nearest enemy for strategic targeting
            let targetEnemy = null;
            let minDistance = Infinity;
            
            if (window.enemies && window.player) {
                for (const enemy of window.enemies) {
                    const dx = enemy.x - window.player.x;
                    const dy = enemy.y - window.player.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        targetEnemy = enemy;
                    }
                }
            }
            
            if (targetEnemy && window.player) {
                // Calculate angle to target
                const dx = targetEnemy.x - window.player.x;
                const dy = targetEnemy.y - window.player.y;
                const angle = Math.atan2(dy, dx);
                
                // Simulate mouse position for targeting
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;
                    const targetX = centerX + Math.cos(angle) * 100;
                    const targetY = centerY + Math.sin(angle) * 100;
                    
                    await this.simulateMouseClick(targetX, targetY);
                }
            } else {
                // Fallback to spacebar shooting
                await this.simulateKeyPress(' ', 100);
            }
            
            this.stats.shotsFired++;
        } catch (error) {
            console.error('❌ Shooting error:', error.message);
        }
    }

    /**
     * Perform strategic movement action - avoid enemies and stay mobile
     */
    async performMovement(direction) {
        try {
            // Strategic movement: avoid enemies and stay near center
            let bestDirection = direction;
            
            if (window.player && window.enemies) {
                const playerX = window.player.x;
                const playerY = window.player.y;
                const centerX = 640; // Screen center
                const centerY = 360;
                
                // Find direction away from nearest enemy
                let nearestEnemy = null;
                let minDistance = Infinity;
                
                for (const enemy of window.enemies) {
                    const dx = enemy.x - playerX;
                    const dy = enemy.y - playerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestEnemy = enemy;
                    }
                }
                
                // If enemy is too close (< 150 pixels), move away
                if (nearestEnemy && minDistance < 150) {
                    const dx = playerX - nearestEnemy.x;
                    const dy = playerY - nearestEnemy.y;
                    
                    // Choose direction away from enemy
                    if (Math.abs(dx) > Math.abs(dy)) {
                        bestDirection = dx > 0 ? 'd' : 'a'; // Move right or left
                    } else {
                        bestDirection = dy > 0 ? 's' : 'w'; // Move down or up
                    }
                } else {
                    // Move towards center if too far from it
                    const distFromCenter = Math.sqrt((playerX - centerX) ** 2 + (playerY - centerY) ** 2);
                    if (distFromCenter > 200) {
                        if (Math.abs(playerX - centerX) > Math.abs(playerY - centerY)) {
                            bestDirection = playerX > centerX ? 'a' : 'd';
                        } else {
                            bestDirection = playerY > centerY ? 'w' : 's';
                        }
                    }
                }
            }
            
            const holdTime = 150 + random() * 100; // 150-250ms hold for better control
            await this.simulateKeyPress(bestDirection, holdTime);
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
            const direction = movements[Math.floor(random() * movements.length)];
            
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
     * Check if any enemy is within specified distance of player
     */
    isEnemyNearby(maxDistance) {
        if (!window.player || !window.enemies) return false;
        
        const playerX = window.player.x;
        const playerY = window.player.y;
        
        for (const enemy of window.enemies) {
            const dx = enemy.x - playerX;
            const dy = enemy.y - playerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= maxDistance) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Monitor game state for changes
     */
    async monitorGameState() {
        // Check if player died or game ended
        if ((window.player && window.player.health <= 0) || 
            (window.gameState && window.gameState.gameState === 'gameOver')) {
            
            this.stats.playerDeaths++;
            console.log('💀 Player death/game over detected during extended test');
            
            // Try multiple restart methods
            let restarted = false;
            
            // Method 1: Use gameState.restartGame if available
            if (window.gameState && typeof window.gameState.restartGame === 'function') {
                try {
                    window.gameState.restartGame();
                    await this.wait(1000);
                    restarted = true;
                    console.log('🔄 Game restarted using gameState.restartGame()');
                } catch (error) {
                    console.warn('⚠️ gameState.restartGame() failed:', error.message);
                }
            }
            
            // Method 2: Try pressing R key (common restart key)
            if (!restarted) {
                try {
                    await this.simulateKeyPress('r', 100);
                    await this.wait(1000);
                    console.log('🔄 Attempted restart using R key');
                } catch (error) {
                    console.warn('⚠️ R key restart failed:', error.message);
                }
            }
            
            // Method 3: Try clicking on screen to restart
            if (!restarted && window.gameState && window.gameState.gameState === 'gameOver') {
                try {
                    await this.simulateMouseClick(640, 360); // Click center screen
                    await this.wait(1000);
                    console.log('🔄 Attempted restart using mouse click');
                } catch (error) {
                    console.warn('⚠️ Mouse click restart failed:', error.message);
                }
            }
            
            // Wait for game to stabilize after restart
            await this.wait(500);
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
     * Simulate key press with proper timing - uses window.keys for movement
     */
    async simulateKeyPress(key, holdDuration = 100) {
        // For movement keys, use window.keys system
        if (['w', 'a', 's', 'd'].includes(key.toLowerCase())) {
            if (window.keys) {
                // Set both uppercase and lowercase versions
                window.keys[key.toUpperCase()] = true;
                window.keys[key.toLowerCase()] = true;
                console.log(`🎮 Setting movement key: ${key} for ${holdDuration}ms`);
                
                await this.wait(holdDuration);
                
                // Clear the keys
                window.keys[key.toUpperCase()] = false;
                window.keys[key.toLowerCase()] = false;
                console.log(`🎮 Cleared movement key: ${key}`);
            }
        } else {
            // For non-movement keys (like spacebar), use keyboard events
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
        }
        
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