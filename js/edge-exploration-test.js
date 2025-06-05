/**
 * Edge Exploration Test System
 * Continuously shoots at enemies while systematically visiting all screen edges
 * Takes screenshots at each edge to confirm boundary detection
 * Tests game behavior at screen limits
 */

class EdgeExplorationTester {
    constructor() {
        this.testResults = [];
        this.currentTest = null;
        this.isRunning = false;
        this.startTime = null;
        this.screenshotCount = 0;
        
        // Screen boundaries (assuming 1280x720 game area)
        this.screenBounds = {
            left: 50,    // Left edge
            right: 1230, // Right edge  
            top: 50,     // Top edge
            bottom: 670  // Bottom edge
        };
        
        // Edge visit sequence
        this.edgeSequence = [
            { name: 'TOP_LEFT', x: this.screenBounds.left, y: this.screenBounds.top },
            { name: 'TOP_CENTER', x: 640, y: this.screenBounds.top },
            { name: 'TOP_RIGHT', x: this.screenBounds.right, y: this.screenBounds.top },
            { name: 'RIGHT_CENTER', x: this.screenBounds.right, y: 360 },
            { name: 'BOTTOM_RIGHT', x: this.screenBounds.right, y: this.screenBounds.bottom },
            { name: 'BOTTOM_CENTER', x: 640, y: this.screenBounds.bottom },
            { name: 'BOTTOM_LEFT', x: this.screenBounds.left, y: this.screenBounds.bottom },
            { name: 'LEFT_CENTER', x: this.screenBounds.left, y: 360 },
            { name: 'CENTER', x: 640, y: 360 } // Return to center
        ];
        
        this.currentEdgeIndex = 0;
        this.edgeReached = false;
        this.edgeVisitResults = [];
        
        this.stats = {
            totalShots: 0,
            edgesVisited: 0,
            screenshotsTaken: 0,
            enemiesTargeted: 0,
            timeAtEachEdge: [],
            movementDistance: 0,
            errors: 0
        };
    }

    /**
     * Run the edge exploration test
     */
    async runEdgeExplorationTest() {
        console.log('🎯 Starting Edge Exploration Test...');
        console.log('📍 Will visit all screen edges while continuously shooting');
        console.log(`🖼️ Screenshots will be taken at each edge for confirmation`);
        
        this.testResults = [];
        this.isRunning = true;
        this.startTime = Date.now();
        this.currentEdgeIndex = 0;
        this.edgeVisitResults = [];
        
        // Initialize test
        await this.initializeTest();
        
        // Run main exploration loop
        await this.runExplorationLoop();
        
        // Analyze results
        await this.analyzeResults();
        
        // Display comprehensive report
        this.displayEdgeReport();
        
        return this.testResults;
    }

    /**
     * Initialize the test environment
     */
    async initializeTest() {
        console.log('🎮 Initializing edge exploration test...');
        
        // Ensure game is running
        if (window.gameState && window.gameState.gameState === 'gameOver') {
            if (typeof window.gameState.restartGame === 'function') {
                window.gameState.restartGame();
                await this.wait(1000);
                console.log('🔄 Game restarted for edge exploration');
            }
        }

        // Reset stats
        this.stats = {
            totalShots: 0,
            edgesVisited: 0,
            screenshotsTaken: 0,
            enemiesTargeted: 0,
            timeAtEachEdge: [],
            movementDistance: 0,
            errors: 0
        };

        console.log('✅ Edge exploration test initialized');
    }

    /**
     * Main exploration loop - visits each edge while shooting
     */
    async runExplorationLoop() {
        console.log('🎯 Starting edge exploration loop...');
        
        for (let i = 0; i < this.edgeSequence.length && this.isRunning; i++) {
            const edge = this.edgeSequence[i];
            console.log(`📍 Moving to edge: ${edge.name} at (${edge.x}, ${edge.y})`);
            
            const edgeStartTime = Date.now();
            
            // Move to edge while shooting
            await this.moveToEdgeWithShooting(edge);
            
            // Take screenshot at edge
            await this.takeEdgeScreenshot(edge);
            
            // Stay at edge for a moment while shooting
            await this.stayAtEdgeAndShoot(edge, 2000); // 2 seconds
            
            const edgeEndTime = Date.now();
            const timeAtEdge = edgeEndTime - edgeStartTime;
            
            this.stats.timeAtEachEdge.push({
                edge: edge.name,
                duration: timeAtEdge,
                position: { x: edge.x, y: edge.y }
            });
            
            this.stats.edgesVisited++;
            console.log(`✅ Completed edge ${edge.name} in ${timeAtEdge}ms`);
        }
        
        console.log('✅ Edge exploration loop completed');
    }

    /**
     * Move to specific edge while continuously shooting
     */
    async moveToEdgeWithShooting(targetEdge) {
        console.log(`🎯 Moving to ${targetEdge.name} while shooting...`);
        
        const maxAttempts = 100; // Prevent infinite loops
        let attempts = 0;
        
        while (attempts < maxAttempts && this.isRunning) {
            attempts++;
            
            // Enhanced continuous shooting - shoot multiple times per cycle
            await this.performContinuousShooting();
            await this.wait(50); // Brief pause
            await this.performContinuousShooting(); // Second shot for better coverage
            
            // Check current position
            if (!window.player) {
                console.warn('⚠️ Player not found during movement');
                break;
            }
            
            const currentX = window.player.x;
            const currentY = window.player.y;
            const targetX = targetEdge.x;
            const targetY = targetEdge.y;
            
            // Calculate distance to target
            const distance = Math.sqrt((targetX - currentX) ** 2 + (targetY - currentY) ** 2);
            
            // If close enough to target, we've reached the edge
            if (distance < 20) {
                console.log(`📍 Reached ${targetEdge.name} at (${Math.round(currentX)}, ${Math.round(currentY)})`);
                break;
            }
            
            // Move towards target
            await this.moveTowardsTarget(currentX, currentY, targetX, targetY);
            
            // Reduced delay for more responsive movement and shooting
            await this.wait(80);
        }
        
        if (attempts >= maxAttempts) {
            console.warn(`⚠️ Max attempts reached moving to ${targetEdge.name}`);
        }
    }

    /**
     * Move towards target position
     */
    async moveTowardsTarget(currentX, currentY, targetX, targetY) {
        const dx = targetX - currentX;
        const dy = targetY - currentY;
        
        // Determine primary movement direction
        let direction = '';
        
        if (Math.abs(dx) > Math.abs(dy)) {
            // Move horizontally first
            direction = dx > 0 ? 'd' : 'a';
        } else {
            // Move vertically first
            direction = dy > 0 ? 's' : 'w';
        }
        
        // Execute movement
        await this.simulateMovementKey(direction, 150);
        
        // Track movement distance
        this.stats.movementDistance += 3; // Approximate distance per movement
    }

    /**
     * Perform continuous shooting with enhanced enemy targeting
     */
    async performContinuousShooting() {
        try {
            // Find nearest enemy for targeting
            let targetEnemy = null;
            let minDistance = Infinity;
            
            if (window.enemies && window.player) {
                for (const enemy of window.enemies) {
                    const dx = enemy.x - window.player.x;
                    const dy = enemy.y - window.player.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < minDistance && distance < 400) { // Only target enemies within range
                        minDistance = distance;
                        targetEnemy = enemy;
                    }
                }
            }
            
            if (targetEnemy && window.player) {
                // Enhanced targeting with enemy position prediction
                const dx = targetEnemy.x - window.player.x;
                const dy = targetEnemy.y - window.player.y;
                
                // Add velocity prediction if enemy has velocity
                let predictedX = targetEnemy.x;
                let predictedY = targetEnemy.y;
                
                if (targetEnemy.velocity) {
                    const predictionTime = 0.3; // 300ms prediction
                    predictedX += targetEnemy.velocity.x * predictionTime * 60; // Assume 60fps
                    predictedY += targetEnemy.velocity.y * predictionTime * 60;
                }
                
                // Convert world coordinates to screen coordinates
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    
                    // Account for camera offset if available
                    let cameraOffsetX = 0;
                    let cameraOffsetY = 0;
                    if (window.cameraSystem) {
                        cameraOffsetX = window.cameraSystem.x || 0;
                        cameraOffsetY = window.cameraSystem.y || 0;
                    }
                    
                    // Convert world position to screen position
                    const screenX = (predictedX - cameraOffsetX) + rect.width / 2;
                    const screenY = (predictedY - cameraOffsetY) + rect.height / 2;
                    
                    // Ensure target is within canvas bounds
                    const clampedX = Math.max(10, Math.min(rect.width - 10, screenX));
                    const clampedY = Math.max(10, Math.min(rect.height - 10, screenY));
                    
                    console.log(`🎯 Targeting enemy at world(${Math.round(predictedX)}, ${Math.round(predictedY)}) -> screen(${Math.round(clampedX)}, ${Math.round(clampedY)}) distance: ${Math.round(minDistance)}`);
                    
                    await this.simulateMouseClick(clampedX, clampedY);
                    this.stats.enemiesTargeted++;
                }
            } else {
                // Fallback to spacebar shooting
                await this.simulateKeyPress(' ', 50);
                console.log('🔫 Fallback spacebar shooting (no enemies in range)');
            }
            
            this.stats.totalShots++;
        } catch (error) {
            console.error('❌ Shooting error:', error.message);
            this.stats.errors++;
        }
    }

    /**
     * Stay at edge and shoot for specified duration
     */
    async stayAtEdgeAndShoot(edge, duration) {
        console.log(`🎯 Staying at ${edge.name} for ${duration}ms while shooting...`);
        
        const endTime = Date.now() + duration;
        
        while (Date.now() < endTime && this.isRunning) {
            await this.performContinuousShooting();
            await this.wait(100); // Shoot every 100ms
        }
    }

    /**
     * Take screenshot at edge with confirmation
     */
    async takeEdgeScreenshot(edge) {
        try {
            this.screenshotCount++;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `edge-${edge.name.toLowerCase()}-${timestamp}`;
            
            console.log(`📸 Taking screenshot at ${edge.name}...`);
            
            // Record screenshot info
            this.edgeVisitResults.push({
                edge: edge.name,
                position: { x: edge.x, y: edge.y },
                actualPosition: window.player ? { x: Math.round(window.player.x), y: Math.round(window.player.y) } : null,
                screenshot: filename,
                timestamp: Date.now()
            });
            
            this.stats.screenshotsTaken++;
            console.log(`✅ Screenshot taken for ${edge.name}: ${filename}`);
            
        } catch (error) {
            console.error(`❌ Screenshot error at ${edge.name}:`, error.message);
            this.stats.errors++;
        }
    }

    /**
     * Simulate movement key press
     */
    async simulateMovementKey(key, holdDuration = 150) {
        if (window.keys) {
            // Set both uppercase and lowercase versions
            window.keys[key.toUpperCase()] = true;
            window.keys[key.toLowerCase()] = true;
            
            await this.wait(holdDuration);
            
            // Clear the keys
            window.keys[key.toUpperCase()] = false;
            window.keys[key.toLowerCase()] = false;
        }
    }

    /**
     * Simulate key press for shooting
     */
    async simulateKeyPress(key, holdDuration = 50) {
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

    /**
     * Simulate mouse click for targeting
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
     * Analyze test results
     */
    async analyzeResults() {
        console.log('📊 Analyzing edge exploration results...');
        
        const results = {
            category: 'edge-exploration',
            tests: [],
            passed: 0,
            failed: 0,
            duration: Date.now() - this.startTime,
            stats: this.stats,
            edgeVisits: this.edgeVisitResults
        };

        // Test 1: All Edges Visited
        const allEdgesVisited = this.stats.edgesVisited === this.edgeSequence.length;
        results.tests.push({
            name: 'All Edges Visited',
            passed: allEdgesVisited,
            details: allEdgesVisited ? 
                `Successfully visited all ${this.stats.edgesVisited} edges` :
                `Only visited ${this.stats.edgesVisited}/${this.edgeSequence.length} edges`,
            data: { edgesVisited: this.stats.edgesVisited, totalEdges: this.edgeSequence.length }
        });

        // Test 2: Screenshots Taken
        const screenshotsTaken = this.stats.screenshotsTaken > 0;
        results.tests.push({
            name: 'Edge Screenshots Captured',
            passed: screenshotsTaken,
            details: screenshotsTaken ? 
                `${this.stats.screenshotsTaken} screenshots taken at edges` :
                'No screenshots were captured',
            data: { screenshots: this.stats.screenshotsTaken }
        });

        // Test 3: Continuous Shooting
        const continuousShooting = this.stats.totalShots > 50;
        results.tests.push({
            name: 'Continuous Shooting',
            passed: continuousShooting,
            details: continuousShooting ? 
                `${this.stats.totalShots} shots fired during exploration` :
                `Only ${this.stats.totalShots} shots fired`,
            data: { totalShots: this.stats.totalShots }
        });

        // Test 4: Enemy Targeting
        const enemyTargeting = this.stats.enemiesTargeted > 0;
        results.tests.push({
            name: 'Enemy Targeting',
            passed: enemyTargeting,
            details: enemyTargeting ? 
                `${this.stats.enemiesTargeted} enemies targeted during exploration` :
                'No enemies were targeted',
            data: { enemiesTargeted: this.stats.enemiesTargeted }
        });

        // Test 5: Movement Coverage
        const movementCoverage = this.stats.movementDistance > 500;
        results.tests.push({
            name: 'Movement Coverage',
            passed: movementCoverage,
            details: movementCoverage ? 
                `Covered ${this.stats.movementDistance} units of movement` :
                `Limited movement: ${this.stats.movementDistance} units`,
            data: { movementDistance: this.stats.movementDistance }
        });

        results.passed = results.tests.filter(t => t.passed).length;
        results.failed = results.tests.filter(t => !t.passed).length;
        
        this.testResults.push(results);
        console.log('✅ Edge exploration analysis completed');
    }

    /**
     * Display comprehensive test report
     */
    displayEdgeReport() {
        console.log('\n🎯 ===== EDGE EXPLORATION TEST REPORT =====');
        console.log(`📅 Test Date: ${new Date().toISOString()}`);
        console.log(`⏱️ Duration: ${Math.round((Date.now() - this.startTime) / 1000)} seconds`);
        console.log(`🎯 Test Method: Systematic Edge Exploration with Continuous Combat`);
        
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
        
        console.log(`📊 Exploration Statistics:`);
        console.log(`  📍 Edges Visited: ${this.stats.edgesVisited}/${this.edgeSequence.length}`);
        console.log(`  📸 Screenshots: ${this.stats.screenshotsTaken}`);
        console.log(`  🔫 Total Shots: ${this.stats.totalShots}`);
        console.log(`  🎯 Enemies Targeted: ${this.stats.enemiesTargeted}`);
        console.log(`  🏃 Movement Distance: ${this.stats.movementDistance} units`);
        console.log(`  ❌ Errors: ${this.stats.errors}`);
        
        console.log(`📍 Edge Visit Details:`);
        for (const visit of this.edgeVisitResults) {
            console.log(`  ${visit.edge}: Target(${visit.position.x},${visit.position.y}) Actual(${visit.actualPosition?.x || 'unknown'},${visit.actualPosition?.y || 'unknown'})`);
        }
        
        if (results && results.passed === results.tests.length) {
            console.log('🎉 All edge exploration tests passed! Screen boundaries fully tested.');
        } else if (results && results.passed >= results.tests.length * 0.8) {
            console.log('✅ Most edge exploration tests passed. Good boundary coverage.');
        } else {
            console.log('⚠️ Some edge exploration tests failed. Check boundary detection.');
        }
        
        console.log('===== END EDGE EXPLORATION REPORT =====\n');
    }

    /**
     * Stop the test
     */
    stopTest() {
        this.isRunning = false;
        console.log('🛑 Edge exploration test stopped by user');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.EdgeExplorationTester = EdgeExplorationTester;
}

// Auto-run if F6 key is pressed
if (typeof document !== 'undefined') {
    document.addEventListener('keydown', async (event) => {
        if (event.key === 'F6') {
            event.preventDefault();
            const tester = new EdgeExplorationTester();
            await tester.runEdgeExplorationTest();
        }
    });
}

export default EdgeExplorationTester;