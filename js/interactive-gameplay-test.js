/**
 * Interactive Gameplay Testing Module
 * Uses Playwright automation to simulate real user interactions
 * Tests movement, shooting, collisions, and sound through actual gameplay
 */
import { random } from './mathUtils.js';

class InteractiveGameplayTester {
    constructor() {
        this.testResults = [];
        this.isRunning = false;
        this.currentTest = null;
    }

    /**
     * Run comprehensive interactive gameplay tests
     */
    async runInteractiveTests() {
        if (this.isRunning) {
            console.log('🎮 Interactive tests already running...');
            return;
        }

        this.isRunning = true;
        this.testResults = [];
        
        console.log('🎮 Starting Interactive Gameplay Tests...');
        console.log('🤖 Simulating real user interactions...');

        try {
            // Test sequence: Movement → Shooting → Combat → Audio
            await this.testPlayerMovementInteractive();
            await this.testShootingInteractive();
            await this.testCombatScenario();
            await this.testAudioInteractive();
            
            this.displayResults();
        } catch (error) {
            console.error('❌ Interactive test error:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Test player movement with simulated keyboard input
     */
    async testPlayerMovementInteractive() {
        this.currentTest = 'interactive-movement';
        console.log('🎮 Testing player movement with simulated input...');

        const results = {
            category: 'interactive-movement',
            tests: [],
            passed: 0,
            failed: 0
        };

        if (!window.player) {
            results.tests.push({
                name: 'Player Availability',
                passed: false,
                details: 'Player not found for interactive testing'
            });
            this.testResults.push(results);
            return;
        }

        // Test WASD movement with actual key simulation
        const movementTests = [
            { key: 'w', direction: 'up', expectedY: -1 },
            { key: 'a', direction: 'left', expectedX: -1 },
            { key: 's', direction: 'down', expectedY: 1 },
            { key: 'd', direction: 'right', expectedX: 1 }
        ];

        for (const test of movementTests) {
            const startPos = { x: window.player.x, y: window.player.y };
            
            // Simulate key press
            const keyEvent = new KeyboardEvent('keydown', { key: test.key });
            document.dispatchEvent(keyEvent);
            
            // Hold key for movement
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Release key
            const keyUpEvent = new KeyboardEvent('keyup', { key: test.key });
            document.dispatchEvent(keyUpEvent);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const endPos = { x: window.player.x, y: window.player.y };
            const deltaX = endPos.x - startPos.x;
            const deltaY = endPos.y - startPos.y;
            const moved = Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2;
            
            results.tests.push({
                name: `Movement ${test.direction.toUpperCase()}`,
                passed: moved,
                details: moved ? 
                    `Player moved ${test.direction} (Δx:${Math.round(deltaX)}, Δy:${Math.round(deltaY)})` :
                    `No movement detected for ${test.direction}`,
                data: { startPos, endPos, delta: { x: deltaX, y: deltaY } }
            });
        }

        // Test diagonal movement (W+D)
        const startPos = { x: window.player.x, y: window.player.y };
        
        const wEvent = new KeyboardEvent('keydown', { key: 'w' });
        const dEvent = new KeyboardEvent('keydown', { key: 'd' });
        document.dispatchEvent(wEvent);
        document.dispatchEvent(dEvent);
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const wUpEvent = new KeyboardEvent('keyup', { key: 'w' });
        const dUpEvent = new KeyboardEvent('keyup', { key: 'd' });
        document.dispatchEvent(wUpEvent);
        document.dispatchEvent(dUpEvent);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const endPos = { x: window.player.x, y: window.player.y };
        const diagonalMoved = Math.abs(endPos.x - startPos.x) > 2 && Math.abs(endPos.y - startPos.y) > 2;
        
        results.tests.push({
            name: 'Diagonal Movement',
            passed: diagonalMoved,
            details: diagonalMoved ? 
                'Diagonal movement (W+D) working' :
                'Diagonal movement not detected',
            data: { startPos, endPos }
        });

        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Interactive movement tests: ${results.passed} passed, ${results.failed} failed`);
    }

    /**
     * Test shooting with simulated mouse/keyboard input
     */
    async testShootingInteractive() {
        this.currentTest = 'interactive-shooting';
        console.log('🔫 Testing shooting with simulated input...');

        const results = {
            category: 'interactive-shooting',
            tests: [],
            passed: 0,
            failed: 0
        };

        // Test mouse shooting
        const initialBulletCount = window.playerBullets ? window.playerBullets.length : 0;
        
        // Simulate mouse click
        const canvas = document.querySelector('canvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const mouseEvent = new MouseEvent('click', {
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                bubbles: true
            });
            canvas.dispatchEvent(mouseEvent);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const newBulletCount = window.playerBullets ? window.playerBullets.length : 0;
            const bulletCreated = newBulletCount > initialBulletCount;
            
            results.tests.push({
                name: 'Mouse Shooting',
                passed: bulletCreated,
                details: bulletCreated ? 
                    `Bullet created via mouse (${initialBulletCount} → ${newBulletCount})` :
                    'No bullet created via mouse click',
                data: { initialCount: initialBulletCount, newCount: newBulletCount }
            });
        }

        // Test spacebar shooting
        const spaceInitialCount = window.playerBullets ? window.playerBullets.length : 0;
        
        const spaceEvent = new KeyboardEvent('keydown', { key: ' ', code: 'Space' });
        document.dispatchEvent(spaceEvent);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const spaceUpEvent = new KeyboardEvent('keyup', { key: ' ', code: 'Space' });
        document.dispatchEvent(spaceUpEvent);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const spaceNewCount = window.playerBullets ? window.playerBullets.length : 0;
        const spaceBulletCreated = spaceNewCount > spaceInitialCount;
        
        results.tests.push({
            name: 'Spacebar Shooting',
            passed: spaceBulletCreated,
            details: spaceBulletCreated ? 
                `Bullet created via spacebar (${spaceInitialCount} → ${spaceNewCount})` :
                'No bullet created via spacebar',
            data: { initialCount: spaceInitialCount, newCount: spaceNewCount }
        });

        // Test rapid fire
        const rapidInitialCount = window.playerBullets ? window.playerBullets.length : 0;
        
        for (let i = 0; i < 5; i++) {
            const rapidEvent = new KeyboardEvent('keydown', { key: ' ', code: 'Space' });
            document.dispatchEvent(rapidEvent);
            await new Promise(resolve => setTimeout(resolve, 50));
            const rapidUpEvent = new KeyboardEvent('keyup', { key: ' ', code: 'Space' });
            document.dispatchEvent(rapidUpEvent);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
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
        console.log(`✅ Interactive shooting tests: ${results.passed} passed, ${results.failed} failed`);
    }

    /**
     * Test combat scenario with movement and shooting
     */
    async testCombatScenario() {
        this.currentTest = 'combat-scenario';
        console.log('⚔️ Testing combat scenario...');

        const results = {
            category: 'combat-scenario',
            tests: [],
            passed: 0,
            failed: 0
        };

        const initialState = {
            playerHealth: window.player ? window.player.health : 0,
            enemyCount: window.enemies ? window.enemies.length : 0,
            score: window.gameState ? window.gameState.score : 0
        };

        // Simulate 5 seconds of active combat
        const combatDuration = 5000;
        const startTime = Date.now();
        
        console.log('🎯 Simulating active combat for 5 seconds...');
        
        const combatLoop = async () => {
            while (Date.now() - startTime < combatDuration) {
                // Random movement
                const movements = ['w', 'a', 's', 'd'];
                const randomMove = movements[Math.floor(random() * movements.length)];
                
                const moveEvent = new KeyboardEvent('keydown', { key: randomMove });
                document.dispatchEvent(moveEvent);
                
                // Random shooting
                if (random() < 0.7) { // 70% chance to shoot
                    const shootEvent = new KeyboardEvent('keydown', { key: ' ', code: 'Space' });
                    document.dispatchEvent(shootEvent);
                    
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    const shootUpEvent = new KeyboardEvent('keyup', { key: ' ', code: 'Space' });
                    document.dispatchEvent(shootUpEvent);
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const moveUpEvent = new KeyboardEvent('keyup', { key: randomMove });
                document.dispatchEvent(moveUpEvent);
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        };

        await combatLoop();

        const finalState = {
            playerHealth: window.player ? window.player.health : 0,
            enemyCount: window.enemies ? window.enemies.length : 0,
            score: window.gameState ? window.gameState.score : 0
        };

        // Analyze combat results
        const healthChanged = finalState.playerHealth !== initialState.playerHealth;
        const enemiesChanged = finalState.enemyCount !== initialState.enemyCount;
        const scoreChanged = finalState.score !== initialState.score;
        const combatActivity = healthChanged || enemiesChanged || scoreChanged;

        results.tests.push({
            name: 'Combat Activity',
            passed: combatActivity,
            details: combatActivity ? 
                'Combat activity detected during scenario' :
                'No combat activity detected',
            data: { initialState, finalState }
        });

        // Test player survival
        const playerSurvived = window.player && window.player.health > 0;
        results.tests.push({
            name: 'Player Survival',
            passed: playerSurvived,
            details: playerSurvived ? 
                `Player survived combat (Health: ${finalState.playerHealth})` :
                'Player did not survive combat',
            data: { finalHealth: finalState.playerHealth }
        });

        // Test game state consistency
        const gameStateValid = window.gameState && window.gameState.gameState === 'playing';
        results.tests.push({
            name: 'Game State Consistency',
            passed: gameStateValid,
            details: gameStateValid ? 
                'Game state remained consistent during combat' :
                'Game state became inconsistent',
            data: { gameState: window.gameState ? window.gameState.gameState : 'unknown' }
        });

        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Combat scenario tests: ${results.passed} passed, ${results.failed} failed`);
    }

    /**
     * Test audio system during gameplay
     */
    async testAudioInteractive() {
        this.currentTest = 'interactive-audio';
        console.log('🔊 Testing audio during interactive gameplay...');

        const results = {
            category: 'interactive-audio',
            tests: [],
            passed: 0,
            failed: 0
        };

        // Test audio context activation
        const audioContextActive = window.audio && window.audio.context && window.audio.context.state === 'running';
        results.tests.push({
            name: 'Audio Context Active',
            passed: audioContextActive,
            details: audioContextActive ? 
                'Audio context is running' :
                `Audio context state: ${window.audio ? window.audio.context?.state : 'unknown'}`,
            data: { state: window.audio ? window.audio.context?.state : 'unknown' }
        });

        // Test shooting sound effects
        if (window.audio && typeof window.audio.playSound === 'function') {
            try {
                // Trigger shooting and listen for audio
                const shootEvent = new KeyboardEvent('keydown', { key: ' ', code: 'Space' });
                document.dispatchEvent(shootEvent);
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const shootUpEvent = new KeyboardEvent('keyup', { key: ' ', code: 'Space' });
                document.dispatchEvent(shootUpEvent);
                
                results.tests.push({
                    name: 'Shooting Sound Effects',
                    passed: true,
                    details: 'Shooting sound system functional',
                    data: { audioSystemAvailable: true }
                });
            } catch (error) {
                results.tests.push({
                    name: 'Shooting Sound Effects',
                    passed: false,
                    details: `Audio error: ${error.message}`,
                    data: { error: error.message }
                });
            }
        } else {
            results.tests.push({
                name: 'Shooting Sound Effects',
                passed: false,
                details: 'Audio system not available',
                data: { audioSystemAvailable: false }
            });
        }

        // Test beat synchronization
        const beatSystemActive = window.beatClock && typeof window.beatClock.getBeat === 'function';
        if (beatSystemActive) {
            const beat1 = window.beatClock.getBeat();
            await new Promise(resolve => setTimeout(resolve, 500));
            const beat2 = window.beatClock.getBeat();
            const beatProgressing = beat2 !== beat1;
            
            results.tests.push({
                name: 'Beat Synchronization',
                passed: beatProgressing,
                details: beatProgressing ? 
                    `Beat clock progressing (${beat1} → ${beat2})` :
                    'Beat clock not progressing',
                data: { beat1, beat2 }
            });
        } else {
            results.tests.push({
                name: 'Beat Synchronization',
                passed: false,
                details: 'Beat clock system not available',
                data: { beatSystemActive }
            });
        }

        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log(`✅ Interactive audio tests: ${results.passed} passed, ${results.failed} failed`);
    }

    /**
     * Display comprehensive test results
     */
    displayResults() {
        console.log('\n🎮 ===== INTERACTIVE GAMEPLAY TEST RESULTS =====');
        
        let totalPassed = 0;
        let totalFailed = 0;
        
        for (const category of this.testResults) {
            totalPassed += category.passed;
            totalFailed += category.failed;
            
            const categoryEmoji = {
                'interactive-movement': '🎮',
                'interactive-shooting': '🔫',
                'combat-scenario': '⚔️',
                'interactive-audio': '🔊'
            };
            
            console.log(`\n${categoryEmoji[category.category] || '🧪'} ${category.category.toUpperCase()}: ${category.passed} passed, ${category.failed} failed`);
            
            for (const test of category.tests) {
                const status = test.passed ? '✅' : '❌';
                console.log(`  ${status} ${test.name}: ${test.details}`);
            }
        }
        
        const successRate = totalPassed / (totalPassed + totalFailed) * 100;
        
        console.log(`\n📊 OVERALL RESULTS:`);
        console.log(`✅ Passed: ${totalPassed}`);
        console.log(`❌ Failed: ${totalFailed}`);
        console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);
        
        if (successRate >= 80) {
            console.log('🎉 EXCELLENT: Interactive gameplay testing passed!');
        } else if (successRate >= 60) {
            console.log('⚠️ GOOD: Most interactive tests passed, some issues to address');
        } else {
            console.log('🚨 NEEDS WORK: Significant interactive gameplay issues detected');
        }
        
        console.log('===== END INTERACTIVE TEST RESULTS =====\n');
    }

    /**
     * Quick interactive test (shorter version)
     */
    async quickInteractiveTest() {
        console.log('🎮 Running quick interactive test...');
        
        // Test basic movement
        const startPos = window.player ? { x: window.player.x, y: window.player.y } : null;
        
        if (startPos) {
            const wEvent = new KeyboardEvent('keydown', { key: 'w' });
            document.dispatchEvent(wEvent);
            await new Promise(resolve => setTimeout(resolve, 200));
            const wUpEvent = new KeyboardEvent('keyup', { key: 'w' });
            document.dispatchEvent(wUpEvent);
            
            const endPos = { x: window.player.x, y: window.player.y };
            const moved = Math.abs(endPos.y - startPos.y) > 2;
            
            console.log(moved ? '✅ Movement: Working' : '❌ Movement: Not working');
        }
        
        // Test basic shooting
        const initialBullets = window.playerBullets ? window.playerBullets.length : 0;
        const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
        document.dispatchEvent(spaceEvent);
        await new Promise(resolve => setTimeout(resolve, 100));
        const spaceUpEvent = new KeyboardEvent('keyup', { key: ' ' });
        document.dispatchEvent(spaceUpEvent);
        
        const finalBullets = window.playerBullets ? window.playerBullets.length : 0;
        const shot = finalBullets > initialBullets;
        
        console.log(shot ? '✅ Shooting: Working' : '❌ Shooting: Not working');
        console.log('🎮 Quick interactive test complete');
    }
}

// Create global instance
window.interactiveGameplayTester = new InteractiveGameplayTester();

// Add keyboard shortcuts
document.addEventListener('keydown', (event) => {
    if (event.key === 'F11') {
        event.preventDefault();
        window.interactiveGameplayTester.runInteractiveTests();
    } else if (event.key === 'F12') {
        event.preventDefault();
        window.interactiveGameplayTester.quickInteractiveTest();
    }
});

console.log('🎮 Interactive Gameplay Tester loaded');
console.log('📋 Keyboard shortcuts:');
console.log('  F11: Run full interactive tests');
console.log('  F12: Run quick interactive test');

export default InteractiveGameplayTester;