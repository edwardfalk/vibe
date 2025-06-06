/**
 * MCP Automated Test Runner for Vibe Game
 * 
 * This is the main automated testing system that uses MCP Playwright tools
 * to run comprehensive probe-driven tests on the Vibe game.
 * 
 * Features:
 * - Probe-driven testing approach
 * - Automated bug reporting via ticketing system
 * - Screenshot capture on failures
 * - Comprehensive test coverage
 * - MCP Playwright integration
 */

const fs = require('fs');
const path = require('path');

class MCPAutomatedTestRunner {
    constructor(mcpClient) {
        this.mcp = mcpClient;
        this.testResults = [];
        this.config = {
            gameUrl: 'http://localhost:5500',
            timeout: 30000,
            retryAttempts: 2,
            screenshotOnFailure: true,
            probeFiles: [
                'js/ai-liveness-probe.js',
                'js/enemy-ai-probe.js', 
                'js/audio-system-probe.js',
                'js/combat-collision-probe.js',
                'js/ui-score-probe.js'
            ]
        };
    }

    /**
     * Run the complete automated test suite
     */
    async runComprehensiveTests() {
        console.log('🚀 Starting MCP Automated Test Suite for Vibe Game');
        console.log('🎯 Using probe-driven testing approach with automated bug reporting');
        
        try {
            // Step 1: Navigate to game
            await this.navigateToGame();
            
            // Step 2: Initialize game state
            await this.initializeGameForTesting();
            
            // Step 3: Run all probe tests
            await this.runAllProbes();
            
            // Step 4: Run interactive gameplay tests
            await this.runInteractiveTests();
            
            // Step 5: Generate comprehensive report
            await this.generateTestReport();
            
            console.log('✅ MCP Automated Test Suite completed');
            return this.testResults;
            
        } catch (error) {
            console.error('❌ MCP Test Suite failed:', error);
            await this.captureFailureScreenshot('test-suite-failure');
            throw error;
        }
    }

    /**
     * Navigate to the game and verify it loads
     */
    async navigateToGame() {
        console.log('🌐 Navigating to Vibe game...');
        
        await this.mcp.navigate({
            url: this.config.gameUrl,
            timeout: this.config.timeout,
            waitUntil: 'networkidle'
        });
        
        // Wait for game to initialize
        await this.wait(2000);
        
        // Verify game loaded
        const gameLoaded = await this.mcp.evaluate({
            script: `
                // Check if essential game objects exist
                const gameLoaded = !!(window.gameState && window.player && window.audio);
                const canvasExists = !!document.querySelector('canvas');
                return { gameLoaded, canvasExists };
            `
        });
        
        if (!gameLoaded.gameLoaded || !gameLoaded.canvasExists) {
            throw new Error('Game failed to load properly');
        }
        
        console.log('✅ Game loaded successfully');
    }

    /**
     * Initialize game state for testing
     */
    async initializeGameForTesting() {
        console.log('🎮 Initializing game for testing...');
        
        // Click canvas to activate audio context
        await this.mcp.click({ selector: 'canvas' });
        await this.wait(500);
        
        // Ensure game is in playing state
        const gameState = await this.mcp.evaluate({
            script: `
                if (window.gameState && window.gameState.gameState === 'gameOver') {
                    if (typeof window.gameState.restartGame === 'function') {
                        window.gameState.restartGame();
                        return { restarted: true, state: 'playing' };
                    }
                }
                return { 
                    restarted: false, 
                    state: window.gameState ? window.gameState.gameState : 'unknown' 
                };
            `
        });
        
        console.log(`🎯 Game state: ${gameState.state}`);
        
        // Activate test mode if available
        await this.mcp.press_key({ key: 't' });
        await this.wait(500);
        
        console.log('✅ Game initialized for testing');
    }

    /**
     * Run all probe tests
     */
    async runAllProbes() {
        console.log('🔍 Running comprehensive probe tests...');
        
        for (const probeFile of this.config.probeFiles) {
            await this.runSingleProbe(probeFile);
        }
        
        console.log('✅ All probe tests completed');
    }

    /**
     * Run a single probe test
     */
    async runSingleProbe(probeFile) {
        const probeName = path.basename(probeFile, '.js');
        console.log(`🧪 Running probe: ${probeName}`);
        
        try {
            // Load probe script
            const probeScript = fs.readFileSync(probeFile, 'utf8');
            
            // Execute probe in browser context
            const probeResult = await this.mcp.evaluate({
                script: probeScript
            });
            
            // Process probe results
            const testResult = {
                probe: probeName,
                timestamp: new Date().toISOString(),
                success: !probeResult.failure,
                result: probeResult,
                warnings: probeResult.warnings || [],
                failure: probeResult.failure || null
            };
            
            this.testResults.push(testResult);
            
            if (probeResult.failure) {
                console.log(`❌ Probe ${probeName} failed: ${probeResult.failure}`);
                
                // Capture screenshot on failure
                if (this.config.screenshotOnFailure) {
                    await this.captureFailureScreenshot(`${probeName}-failure`);
                }
            } else {
                console.log(`✅ Probe ${probeName} passed`);
                if (probeResult.warnings && probeResult.warnings.length > 0) {
                    console.log(`⚠️  Warnings: ${probeResult.warnings.join(', ')}`);
                }
            }
            
        } catch (error) {
            console.error(`💥 Probe ${probeName} crashed:`, error);
            
            this.testResults.push({
                probe: probeName,
                timestamp: new Date().toISOString(),
                success: false,
                error: error.message,
                failure: `Probe execution failed: ${error.message}`
            });
            
            await this.captureFailureScreenshot(`${probeName}-crash`);
        }
    }

    /**
     * Run interactive gameplay tests
     */
    async runInteractiveTests() {
        console.log('🎮 Running interactive gameplay tests...');
        
        // Test movement
        await this.testMovement();
        
        // Test shooting
        await this.testShooting();
        
        // Test enemy interactions
        await this.testEnemyInteractions();
        
        console.log('✅ Interactive tests completed');
    }

    /**
     * Test player movement
     */
    async testMovement() {
        console.log('🚀 Testing player movement...');
        
        const movementResult = await this.mcp.evaluate({
            script: `
                const initialPos = window.player ? { x: window.player.x, y: window.player.y } : null;
                return { initialPos, playerExists: !!window.player };
            `
        });
        
        if (!movementResult.playerExists) {
            this.testResults.push({
                test: 'movement',
                success: false,
                failure: 'Player not found for movement testing'
            });
            return;
        }
        
        // Test WASD movement
        const movements = [
            { key: 'w', direction: 'up' },
            { key: 's', direction: 'down' },
            { key: 'a', direction: 'left' },
            { key: 'd', direction: 'right' }
        ];
        
        for (const movement of movements) {
            await this.mcp.press_key({ key: movement.key });
            await this.wait(200);
        }
        
        // Check if player moved
        const finalResult = await this.mcp.evaluate({
            script: `
                const finalPos = window.player ? { x: window.player.x, y: window.player.y } : null;
                const moved = finalPos && (
                    finalPos.x !== ${movementResult.initialPos.x} || 
                    finalPos.y !== ${movementResult.initialPos.y}
                );
                return { finalPos, moved };
            `
        });
        
        this.testResults.push({
            test: 'movement',
            success: finalResult.moved,
            details: {
                initial: movementResult.initialPos,
                final: finalResult.finalPos,
                moved: finalResult.moved
            }
        });
        
        console.log(`🚀 Movement test: ${finalResult.moved ? 'PASSED' : 'FAILED'}`);
    }

    /**
     * Test shooting mechanics
     */
    async testShooting() {
        console.log('🔫 Testing shooting mechanics...');
        
        const initialBullets = await this.mcp.evaluate({
            script: `
                return {
                    bulletCount: window.playerBullets ? window.playerBullets.length : 0,
                    bulletsExist: Array.isArray(window.playerBullets)
                };
            `
        });
        
        // Test spacebar shooting
        await this.mcp.press_key({ key: ' ' });
        await this.wait(200);
        
        const afterShooting = await this.mcp.evaluate({
            script: `
                return {
                    bulletCount: window.playerBullets ? window.playerBullets.length : 0,
                    bulletCreated: window.playerBullets && window.playerBullets.length > ${initialBullets.bulletCount}
                };
            `
        });
        
        this.testResults.push({
            test: 'shooting',
            success: afterShooting.bulletCreated,
            details: {
                initialBullets: initialBullets.bulletCount,
                finalBullets: afterShooting.bulletCount,
                bulletCreated: afterShooting.bulletCreated
            }
        });
        
        console.log(`🔫 Shooting test: ${afterShooting.bulletCreated ? 'PASSED' : 'FAILED'}`);
    }

    /**
     * Test enemy interactions
     */
    async testEnemyInteractions() {
        console.log('🤖 Testing enemy interactions...');
        
        const enemyResult = await this.mcp.evaluate({
            script: `
                const enemies = window.enemies || [];
                const activeEnemies = enemies.filter(e => !e.markedForRemoval);
                return {
                    totalEnemies: enemies.length,
                    activeEnemies: activeEnemies.length,
                    enemyTypes: activeEnemies.map(e => e.type || 'unknown')
                };
            `
        });
        
        this.testResults.push({
            test: 'enemy-interactions',
            success: enemyResult.activeEnemies > 0,
            details: enemyResult
        });
        
        console.log(`🤖 Enemy test: ${enemyResult.activeEnemies} active enemies found`);
    }

    /**
     * Capture screenshot on failure
     */
    async captureFailureScreenshot(name) {
        try {
            await this.mcp.screenshot({
                name: `failure-${name}-${Date.now()}`,
                fullPage: false,
                savePng: true
            });
            console.log(`📸 Failure screenshot captured: ${name}`);
        } catch (error) {
            console.error('📸 Failed to capture screenshot:', error);
        }
    }

    /**
     * Generate comprehensive test report
     */
    async generateTestReport() {
        console.log('📊 Generating comprehensive test report...');
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.testResults.length,
                passed: this.testResults.filter(r => r.success).length,
                failed: this.testResults.filter(r => !r.success).length,
                warnings: this.testResults.reduce((acc, r) => acc + (r.warnings ? r.warnings.length : 0), 0)
            },
            results: this.testResults,
            recommendations: this.generateRecommendations()
        };
        
        // Save report to file
        const reportsDir = 'test-results';
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir);
        }

        const reportPath = `${reportsDir}/mcp-automated-test-report-${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        // Display summary
        console.log('📊 Test Summary:');
        console.log(`   Total Tests: ${report.summary.totalTests}`);
        console.log(`   Passed: ${report.summary.passed}`);
        console.log(`   Failed: ${report.summary.failed}`);
        console.log(`   Warnings: ${report.summary.warnings}`);
        console.log(`   Report saved: ${reportPath}`);
        
        return report;
    }

    /**
     * Generate recommendations based on test results
     */
    generateRecommendations() {
        const recommendations = [];
        
        const failedTests = this.testResults.filter(r => !r.success);
        const warningTests = this.testResults.filter(r => r.warnings && r.warnings.length > 0);
        
        if (failedTests.length > 0) {
            recommendations.push({
                priority: 'high',
                category: 'critical-failures',
                message: `${failedTests.length} critical test failures need immediate attention`,
                tests: failedTests.map(t => t.probe || t.test)
            });
        }
        
        if (warningTests.length > 0) {
            recommendations.push({
                priority: 'medium',
                category: 'warnings',
                message: `${warningTests.length} tests have warnings that should be reviewed`,
                tests: warningTests.map(t => t.probe || t.test)
            });
        }
        
        // Check for specific patterns
        const audioFailures = this.testResults.filter(r => 
            (r.probe && r.probe.includes('audio')) || 
            (r.failure && r.failure.includes('audio'))
        );
        
        if (audioFailures.length > 0) {
            recommendations.push({
                priority: 'medium',
                category: 'audio-system',
                message: 'Audio system issues detected - check audio context activation',
                action: 'Ensure user interaction before audio tests'
            });
        }
        
        return recommendations;
    }

    /**
     * Utility: Wait for specified milliseconds
     */
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = MCPAutomatedTestRunner;