// simple-bullet-collision-test.js
// Simple test to shoot bullets directly at enemies and check collision logs

export async function runSimpleBulletCollisionTest(mcpClient) {
    console.log('🎯 Starting Simple Bullet Collision Test...');
    
    try {
        // Navigate to the game
        await mcpClient.request({
            method: 'playwright_navigate',
            params: {
                url: 'http://localhost:5500',
                headless: false,
                width: 1280,
                height: 720
            }
        });
        
        // Wait for game to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Click to activate audio context
        await mcpClient.request({
            method: 'playwright_click',
            params: {
                selector: 'canvas'
            }
        });
        
        // Wait a bit more for game initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Enable debug collision logging
        await mcpClient.request({
            method: 'playwright_evaluate',
            params: {
                script: `
                    // Enable collision debugging
                    if (window.CONFIG && window.CONFIG.GAME_SETTINGS) {
                        window.CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS = true;
                        console.log('🔧 Enabled DEBUG_COLLISIONS');
                    } else {
                        console.log('⚠️ CONFIG.GAME_SETTINGS not found');
                    }
                    
                    // Check if game systems are loaded
                    console.log('🎮 Game systems check:');
                    console.log('- player:', !!window.player);
                    console.log('- enemies:', Array.isArray(window.enemies) ? window.enemies.length : 'not found');
                    console.log('- playerBullets:', Array.isArray(window.playerBullets) ? window.playerBullets.length : 'not found');
                    console.log('- collisionSystem:', !!window.collisionSystem);
                `
            }
        });
        
        // Wait for enemies to spawn
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get enemy positions and shoot directly at them
        const testResult = await mcpClient.request({
            method: 'playwright_evaluate',
            params: {
                script: `
                    (function() {
                        const results = {
                            enemiesFound: 0,
                            bulletsShot: 0,
                            playerPosition: null,
                            enemyPositions: [],
                            errors: []
                        };
                        
                        try {
                            // Check if player exists
                            if (!window.player) {
                                results.errors.push('Player not found');
                                return results;
                            }
                            
                            results.playerPosition = { x: window.player.x, y: window.player.y };
                            console.log('🎮 Player position:', results.playerPosition);
                            
                            // Check if enemies exist
                            if (!Array.isArray(window.enemies)) {
                                results.errors.push('Enemies array not found');
                                return results;
                            }
                            
                            const activeEnemies = window.enemies.filter(e => !e.markedForRemoval);
                            results.enemiesFound = activeEnemies.length;
                            console.log('👾 Active enemies found:', results.enemiesFound);
                            
                            if (activeEnemies.length === 0) {
                                results.errors.push('No active enemies found');
                                return results;
                            }
                            
                            // Store enemy positions
                            activeEnemies.forEach((enemy, index) => {
                                results.enemyPositions.push({
                                    index: index,
                                    type: enemy.type,
                                    x: enemy.x,
                                    y: enemy.y,
                                    health: enemy.health
                                });
                                console.log(\`👾 Enemy \${index}: \${enemy.type} at (\${enemy.x.toFixed(1)}, \${enemy.y.toFixed(1)}) health=\${enemy.health}\`);
                            });
                            
                            // Shoot bullets directly at each enemy
                            activeEnemies.forEach((enemy, index) => {
                                try {
                                    // Calculate angle from player to enemy
                                    const dx = enemy.x - window.player.x;
                                    const dy = enemy.y - window.player.y;
                                    const angle = Math.atan2(dy, dx);
                                    
                                    console.log(\`🎯 Shooting at enemy \${index} (\${enemy.type}): angle=\${angle.toFixed(3)} radians\`);
                                    
                                    // Create bullet directly at enemy position for testing
                                    if (window.playerBullets && window.Bullet) {
                                        const bullet = new window.Bullet(
                                            window.player.x,
                                            window.player.y,
                                            angle,
                                            10, // speed
                                            'player'
                                        );
                                        
                                        // Move bullet very close to enemy for guaranteed collision
                                        bullet.x = enemy.x - Math.cos(angle) * 5;
                                        bullet.y = enemy.y - Math.sin(angle) * 5;
                                        
                                        window.playerBullets.push(bullet);
                                        results.bulletsShot++;
                                        
                                        console.log(\`🚀 Created bullet \${results.bulletsShot} at (\${bullet.x.toFixed(1)}, \${bullet.y.toFixed(1)}) targeting enemy at (\${enemy.x.toFixed(1)}, \${enemy.y.toFixed(1)})\`);
                                    } else {
                                        results.errors.push('Bullet system not available');
                                    }
                                } catch (error) {
                                    results.errors.push(\`Error shooting at enemy \${index}: \${error.message}\`);
                                    console.error('🚨 Shooting error:', error);
                                }
                            });
                            
                        } catch (error) {
                            results.errors.push(\`Test error: \${error.message}\`);
                            console.error('🚨 Test error:', error);
                        }
                        
                        return results;
                    })();
                `
            }
        });
        
        console.log('🎯 Test setup results:', testResult.result);
        
        // Wait for collision detection to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Capture console logs to see what happened
        const logs = await mcpClient.request({
            method: 'playwright_console_logs',
            params: {
                type: 'all',
                limit: 50,
                search: 'DEBUG'
            }
        });
        
        console.log('📋 Console logs captured:');
        if (logs.result && logs.result.logs) {
            logs.result.logs.forEach(log => {
                console.log(`  ${log.type}: ${log.text}`);
            });
        }
        
        // Check final game state
        const finalState = await mcpClient.request({
            method: 'playwright_evaluate',
            params: {
                script: `
                    ({
                        playerBullets: window.playerBullets ? window.playerBullets.length : 'not found',
                        enemies: window.enemies ? window.enemies.filter(e => !e.markedForRemoval).length : 'not found',
                        collisionSystemExists: !!window.collisionSystem,
                        gameState: window.gameState ? window.gameState.gameState : 'not found'
                    });
                `
            }
        });
        
        console.log('🎮 Final game state:', finalState.result);
        
        // Take a screenshot for visual confirmation
        await mcpClient.request({
            method: 'playwright_screenshot',
            params: {
                name: 'bullet-collision-test',
                fullPage: false,
                savePng: true
            }
        });
        
        return {
            success: true,
            testResult: testResult.result,
            logs: logs.result,
            finalState: finalState.result
        };
        
    } catch (error) {
        console.error('🚨 Test failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Auto-run if this file is executed directly
if (typeof window !== 'undefined' && window.mcpClient) {
    runSimpleBulletCollisionTest(window.mcpClient);
} 