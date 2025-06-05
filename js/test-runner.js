/**
 * test-runner.js - Simple test runner for browser console execution
 * 
 * This script provides easy-to-use functions for running tests and checking game health
 */

// Wait for game to be ready
function waitForGameReady() {
    return new Promise((resolve) => {
        const checkReady = () => {
            if (window.gameState && window.player && window.audio) {
                resolve();
            } else {
                setTimeout(checkReady, 100);
            }
        };
        checkReady();
    });
}

// Run quick health check
async function quickCheck() {
    console.log('🏥 Running quick health check...');
    
    await waitForGameReady();
    
    if (window.comprehensiveTestSuite) {
        return window.comprehensiveTestSuite.quickHealthCheck();
    } else {
        console.error('❌ Test suite not available');
        return { healthy: false, issues: ['Test suite not loaded'] };
    }
}

// Run full test suite
async function runFullTests() {
    console.log('🧪 Running full test suite...');
    
    await waitForGameReady();
    
    if (window.comprehensiveTestSuite) {
        return await window.comprehensiveTestSuite.runAllTests();
    } else {
        console.error('❌ Test suite not available');
        return null;
    }
}

// Run liveness probe
async function runLivenessProbe() {
    console.log('🔍 Running liveness probe...');
    
    try {
        // Import and run the liveness probe
        const probeModule = await import('./ai-liveness-probe.js');
        return await probeModule.default;
    } catch (error) {
        console.error('❌ Liveness probe failed:', error);
        return { failure: 'Probe execution failed', error: error.message };
    }
}

// Check for specific bug patterns
async function checkBugPatterns() {
    console.log('🐛 Checking for common bug patterns...');
    
    const bugs = [];
    
    // Check for missing core systems
    const requiredSystems = ['gameState', 'player', 'audio', 'beatClock'];
    for (const system of requiredSystems) {
        if (!window[system]) {
            bugs.push(`Missing system: ${system}`);
        }
    }
    
    // Check for player issues
    if (window.player) {
        if (window.player.markedForRemoval) {
            bugs.push('Player marked for removal');
        }
        if (typeof window.player.x !== 'number' || typeof window.player.y !== 'number') {
            bugs.push('Player position invalid');
        }
    }
    
    // Check for frame rate issues
    if (typeof frameRate !== 'undefined' && frameRate < 30) {
        bugs.push(`Low frame rate: ${frameRate.toFixed(1)} FPS`);
    }
    
    console.log(bugs.length === 0 ? '✅ No bug patterns detected' : `⚠️ Found ${bugs.length} potential issues:`);
    bugs.forEach(bug => console.log(`  - ${bug}`));
    
    return { bugCount: bugs.length, bugs };
}

// Test specific game mechanics
async function testGameMechanics() {
    console.log('⚙️ Testing game mechanics...');
    
    const results = {
        movement: false,
        shooting: false,
        enemies: false,
        collision: false,
        audio: false
    };
    
    // Test player movement
    if (window.player) {
        const initialX = window.player.x;
        const initialY = window.player.y;
        
        // Simulate movement for a short time
        await new Promise(resolve => setTimeout(resolve, 500));
        
        results.movement = Math.abs(window.player.x - initialX) > 1 || Math.abs(window.player.y - initialY) > 1;
    }
    
    // Test shooting
    if (window.playerBullets) {
        const initialBulletCount = window.playerBullets.length;
        
        // Try to trigger shooting
        if (window.testMode) {
            window.testMode.setEnabled(true);
            await new Promise(resolve => setTimeout(resolve, 200));
            window.testMode.setEnabled(false);
        }
        
        results.shooting = window.playerBullets.length > initialBulletCount;
    }
    
    // Test enemies
    results.enemies = window.enemies && window.enemies.length > 0;
    
    // Test collision system
    results.collision = window.collisionSystem && typeof window.collisionSystem.checkCollision === 'function';
    
    // Test audio
    results.audio = window.audio && window.audio.audioContext && window.audio.audioContext.state === 'running';
    
    console.log('🎮 Game mechanics test results:');
    Object.entries(results).forEach(([mechanic, working]) => {
        console.log(`  ${working ? '✅' : '❌'} ${mechanic}: ${working ? 'Working' : 'Not working'}`);
    });
    
    return results;
}

// Performance monitoring
function startPerformanceMonitoring(duration = 10000) {
    console.log(`📊 Starting performance monitoring for ${duration/1000} seconds...`);
    
    const startTime = Date.now();
    const frameRates = [];
    const memoryUsage = [];
    
    const monitor = setInterval(() => {
        if (typeof frameRate !== 'undefined') {
            frameRates.push(frameRate);
        }
        
        if (performance.memory) {
            memoryUsage.push(performance.memory.usedJSHeapSize / 1024 / 1024);
        }
        
        if (Date.now() - startTime >= duration) {
            clearInterval(monitor);
            
            const avgFPS = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;
            const minFPS = Math.min(...frameRates);
            const maxFPS = Math.max(...frameRates);
            
            console.log('📈 Performance monitoring results:');
            console.log(`  🎯 Average FPS: ${avgFPS.toFixed(1)}`);
            console.log(`  📉 Min FPS: ${minFPS.toFixed(1)}`);
            console.log(`  📈 Max FPS: ${maxFPS.toFixed(1)}`);
            
            if (memoryUsage.length > 0) {
                const avgMemory = memoryUsage.reduce((a, b) => a + b, 0) / memoryUsage.length;
                const memoryIncrease = memoryUsage[memoryUsage.length - 1] - memoryUsage[0];
                console.log(`  🧠 Average Memory: ${avgMemory.toFixed(1)} MB`);
                console.log(`  📊 Memory Change: ${memoryIncrease > 0 ? '+' : ''}${memoryIncrease.toFixed(1)} MB`);
            }
            
            // Check for performance issues
            if (avgFPS < 45) {
                console.log('⚠️ Performance warning: Low average FPS');
            }
            if (minFPS < 30) {
                console.log('⚠️ Performance warning: Frame drops detected');
            }
            if (memoryUsage.length > 0 && memoryUsage[memoryUsage.length - 1] - memoryUsage[0] > 10) {
                console.log('⚠️ Performance warning: Potential memory leak');
            }
        }
    }, 100);
    
    return monitor;
}

// Export functions for global access
if (typeof window !== 'undefined') {
    window.testRunner = {
        quickCheck,
        runFullTests,
        runLivenessProbe,
        checkBugPatterns,
        testGameMechanics,
        startPerformanceMonitoring
    };
    
    console.log('🧪 Test Runner loaded! Available functions:');
    console.log('  - testRunner.quickCheck() - Quick health check');
    console.log('  - testRunner.runFullTests() - Full test suite');
    console.log('  - testRunner.runLivenessProbe() - Liveness probe');
    console.log('  - testRunner.checkBugPatterns() - Check for common bugs');
    console.log('  - testRunner.testGameMechanics() - Test game mechanics');
    console.log('  - testRunner.startPerformanceMonitoring() - Monitor performance');
    console.log('');
    console.log('🎮 Quick shortcuts:');
    console.log('  - F9: Full test suite');
    console.log('  - F10: Quick health check');
    console.log('  - testRunner.quickCheck() in console');
} 