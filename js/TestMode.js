/**
 * TestMode.js - Handles automated testing including player movement patterns, auto-shooting, and test enemy spawning
 */

// Requires p5.js for global utility functions: constrain(), random(), lerp(), etc.

import { Bullet } from './bullet.js';
import { sin, cos, min, floor, random, atan2 } from './mathUtils.js';

export class TestMode {
    constructor() {
        // Test mode state
        this.enabled = false;
        this.timer = 0;
        
        // Movement patterns
        this.moveSpeed = 0.008; // Slower for better observation
        this.currentPattern = 'corners'; // 'corners', 'edges', 'center', 'random'
        
        // Auto-shooting settings
        this.shootInterval = 10; // frames between shots
        this.lastShotFrame = 0;
        
        // Test enemy spawning
        this.enemySpawnInterval = 180; // frames between test enemy spawns
        this.lastEnemySpawnFrame = 0;
        
        // Logging
        this.logInterval = 60; // frames between position logs
        this.lastLogFrame = 0;
    }
    
    // Enable/disable test mode
    setEnabled(enabled) {
        this.enabled = enabled;
        this.timer = 0;
        console.log('🧪 Test mode:', enabled ? 'ON' : 'OFF');
        if (enabled) {
            console.log('🤖 Starting automated testing - watch the parallax and shooting!');
        }
    }
    
    // Toggle test mode
    toggle() {
        this.setEnabled(!this.enabled);
        return this.enabled;
    }
    
    // Update test mode (call every frame)
    update() {
        if (!this.enabled || !window.player) return;
        
        this.timer++;
        
        // Update player movement pattern
        this.updatePlayerMovement();
        
        // Auto-shooting
        this.updateAutoShooting();
        
        // Spawn test enemies
        this.updateTestEnemySpawning();
        
        // Logging
        this.updateLogging();
    }
    
    // Update player movement patterns
    updatePlayerMovement() {
        const halfSize = window.player.size / 2;
        
        // Test pattern that specifically targets all four corners and edges
        const phase = (this.timer * this.moveSpeed) % (Math.PI * 8); // Complete cycle every ~8 seconds
        
        if (phase < Math.PI * 2) {
            // Phase 1: Test all four corners in sequence
            this.moveToCorners(phase, halfSize);
        } else if (phase < Math.PI * 4) {
            // Phase 2: Test edge movement - left and right edges
            this.moveAlongVerticalEdges(phase - Math.PI * 2, halfSize);
        } else if (phase < Math.PI * 6) {
            // Phase 3: Test edge movement - top and bottom edges
            this.moveAlongHorizontalEdges(phase - Math.PI * 4, halfSize);
        } else {
            // Phase 4: Center movement for comparison
            this.moveCenterPattern(phase, halfSize);
        }
        
        // Apply proper player constraints (same as in player.js)
        window.player.x = constrain(window.player.x, halfSize, width - halfSize);
        window.player.y = constrain(window.player.y, halfSize, height - halfSize);
    }
    
    // Move player to corners in sequence
    moveToCorners(phase, halfSize) {
        const cornerPhase = (phase / (Math.PI * 2)) * 4;
        if (cornerPhase < 1) {
            // Top-left corner
            window.player.x = halfSize;
            window.player.y = halfSize;
        } else if (cornerPhase < 2) {
            // Top-right corner
            window.player.x = width - halfSize;
            window.player.y = halfSize;
        } else if (cornerPhase < 3) {
            // Bottom-right corner
            window.player.x = width - halfSize;
            window.player.y = height - halfSize;
        } else {
            // Bottom-left corner
            window.player.x = halfSize;
            window.player.y = height - halfSize;
        }
    }
    
    // Move along vertical edges (left and right)
    moveAlongVerticalEdges(phase, halfSize) {
        const edgePhase = phase / (Math.PI * 2);
        window.player.x = edgePhase < 0.5 ? halfSize : width - halfSize; // Left then right edge
        window.player.y = halfSize + (height - window.player.size) * sin(edgePhase * Math.PI * 4); // Move up/down along edge
    }
    
    // Move along horizontal edges (top and bottom)
    moveAlongHorizontalEdges(phase, halfSize) {
        const edgePhase = phase / (Math.PI * 2);
        window.player.y = edgePhase < 0.5 ? halfSize : height - halfSize; // Top then bottom edge
        window.player.x = halfSize + (width - window.player.size) * sin(edgePhase * Math.PI * 4); // Move left/right along edge
    }
    
    // Move in center pattern
    moveCenterPattern(phase, halfSize) {
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.2;
        window.player.x = centerX + radius * cos(phase * 2);
        window.player.y = centerY + radius * cos(phase * 2);
    }
    
    // Update auto-shooting
    updateAutoShooting() {
        if (this.timer - this.lastShotFrame < this.shootInterval) return;
        
        // Find nearest enemy to aim at
        const nearestEnemy = this.findNearestEnemy();
        
        if (nearestEnemy) {
            this.shootAtEnemy(nearestEnemy);
            this.lastShotFrame = this.timer;
        }
    }
    
    // Find nearest enemy to player
    findNearestEnemy() {
        if (!window.enemies || window.enemies.length === 0) return null;
        
        let nearestEnemy = null;
        let nearestDistance = Infinity;
        
        for (const enemy of window.enemies) {
            const distance = dist(window.player.x, window.player.y, enemy.x, enemy.y);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = enemy;
            }
        }
        
        return nearestEnemy;
    }
    
    // Shoot at specific enemy
    shootAtEnemy(enemy) {
        // Aim at enemy
        const angle = atan2(enemy.y - window.player.y, enemy.x - window.player.x);
        const bulletDistance = window.player.size * 0.9;
        const bulletX = window.player.x + cos(angle) * bulletDistance;
        const bulletY = window.player.y + sin(angle) * bulletDistance;
        
        const bullet = new Bullet(bulletX, bulletY, angle, 6, 'player');
        if (window.playerBullets) {
            window.playerBullets.push(bullet);
        }
        
        console.log(`🎯 Auto-shot at ${enemy.type} enemy!`);
        
        // Track shots fired
        if (window.gameState) {
            window.gameState.addShotFired();
        }
        
        // Play shoot sound
        if (window.audio) {
            window.audio.playPlayerShoot(window.player.x, window.player.y);
        }
    }
    
    // Update test enemy spawning
    updateTestEnemySpawning() {
        if (this.timer - this.lastEnemySpawnFrame < this.enemySpawnInterval) return;
        
        // Spawn test enemy
        const testX = random(50, width - 50);
        const testY = random(50, height - 50);
        
        // Randomly choose enemy type for testing
        const enemyTypes = ['grunt', 'stabber', 'rusher', 'tank'];
        const randomType = enemyTypes[floor(random() * enemyTypes.length)];
        
        if (window.enemies && window.spawnSystem && window.spawnSystem.enemyFactory) {
            const enemy = window.spawnSystem.enemyFactory.createEnemy(testX, testY, randomType);
            window.enemies.push(enemy);
        }
        
        console.log(`🧪 Spawned test ${randomType} for shooting practice`);
        this.lastEnemySpawnFrame = this.timer;
    }
    
    // Update logging
    updateLogging() {
        // Log detailed position info for debugging
        if (this.timer - this.lastLogFrame >= this.logInterval) {
            const cameraX = window.cameraSystem ? window.cameraSystem.x : 0;
            const cameraY = window.cameraSystem ? window.cameraSystem.y : 0;
            const visualX = window.player.x - cameraX;
            const visualY = window.player.y - cameraY;
            
            console.log(`🎯 Edge Test - World: (${window.player.x.toFixed(1)}, ${window.player.y.toFixed(1)}) Visual: (${visualX.toFixed(1)}, ${visualY.toFixed(1)}) Camera: (${cameraX.toFixed(1)}, ${cameraY.toFixed(1)})`);
            this.lastLogFrame = this.timer;
        }
        
        // Log test progress periodically
        if (this.timer % 120 === 0) {
            const enemyCount = window.enemies ? window.enemies.length : 0;
            const bulletCount = window.playerBullets ? window.playerBullets.length : 0;
            console.log(`🤖 Test running... Timer: ${this.timer}, Enemies: ${enemyCount}, Bullets: ${bulletCount}`);
        }
    }
    
    // Set movement pattern
    setMovementPattern(pattern) {
        this.currentPattern = pattern;
        console.log(`🎯 Test movement pattern set to: ${pattern}`);
    }
    
    // Set auto-shoot interval
    setShootInterval(frames) {
        this.shootInterval = Math.max(1, frames);
        console.log(`🎯 Auto-shoot interval set to: ${this.shootInterval} frames`);
    }
    
    // Set enemy spawn interval
    setEnemySpawnInterval(frames) {
        this.enemySpawnInterval = Math.max(60, frames);
        console.log(`🎯 Enemy spawn interval set to: ${this.enemySpawnInterval} frames`);
    }
    
    // Force spawn specific enemy type
    forceSpawnEnemy(type, x = null, y = null) {
        if (!window.enemies) return;
        
        const spawnX = x !== null ? x : random(50, width - 50);
        const spawnY = y !== null ? y : random(50, height - 50);
        
        if (window.spawnSystem && window.spawnSystem.enemyFactory) {
            const enemy = window.spawnSystem.enemyFactory.createEnemy(spawnX, spawnY, type);
            window.enemies.push(enemy);
        }
        console.log(`🎯 Force spawned ${type} at (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)})`);
    }
    
    // Get test statistics
    getStats() {
        return {
            enabled: this.enabled,
            timer: this.timer,
            pattern: this.currentPattern,
            shootInterval: this.shootInterval,
            enemySpawnInterval: this.enemySpawnInterval,
            enemyCount: window.enemies ? window.enemies.length : 0,
            bulletCount: window.playerBullets ? window.playerBullets.length : 0
        };
    }
    
    // Reset test mode
    reset() {
        this.timer = 0;
        this.lastShotFrame = 0;
        this.lastEnemySpawnFrame = 0;
        this.lastLogFrame = 0;
        console.log('🔄 Test mode reset');
    }
    
    // Run comprehensive test suite
    runTestSuite() {
        console.log('🧪 Starting comprehensive test suite...');
        
        // Test different movement patterns
        const patterns = ['corners', 'edges', 'center', 'random'];
        let patternIndex = 0;
        
        const testInterval = setInterval(() => {
            if (patternIndex < patterns.length) {
                this.setMovementPattern(patterns[patternIndex]);
                patternIndex++;
            } else {
                clearInterval(testInterval);
                console.log('✅ Test suite completed');
            }
        }, 5000); // Change pattern every 5 seconds
    }
}

// Create global test mode instance
window.testMode = false; // Keep backward compatibility
window.testModeManager = new TestMode();

// Backward compatibility function
window.runTestMode = function() {
    if (window.testModeManager) {
        window.testModeManager.update();
    }
}; 