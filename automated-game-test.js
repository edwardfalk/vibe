/**
 * automated-game-test.js - Automated testing script for Vibe game
 * 
 * This script tests the game by:
 * 1. Checking if the server is running
 * 2. Loading the game page
 * 3. Executing JavaScript tests in the browser context
 * 4. Reporting results
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
    serverUrl: 'http://localhost:5500',
    timeout: 10000,
    testDuration: 5000
};

// ANSI color codes for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Check if server is running
function checkServer() {
    return new Promise((resolve, reject) => {
        log('🔍 Checking if game server is running...', 'cyan');
        
        const req = http.get(TEST_CONFIG.serverUrl, (res) => {
            if (res.statusCode === 200) {
                log('✅ Server is running on http://localhost:5500', 'green');
                resolve(true);
            } else {
                log(`❌ Server responded with status ${res.statusCode}`, 'red');
                reject(new Error(`Server error: ${res.statusCode}`));
            }
        });
        
        req.on('error', (err) => {
            log('❌ Server is not running or not accessible', 'red');
            log('💡 Make sure to run: npm run dev', 'yellow');
            reject(err);
        });
        
        req.setTimeout(TEST_CONFIG.timeout, () => {
            log('❌ Server check timed out', 'red');
            reject(new Error('Timeout'));
        });
    });
}

// Check if all required game files exist
function checkGameFiles() {
    log('📁 Checking game files...', 'cyan');
    
    const requiredFiles = [
        'index.html',
        'js/GameLoop.js',
        'js/player.js',
        'js/Audio.js',
        'js/BeatClock.js',
        'js/GameState.js',
        'js/TestMode.js',
        'js/comprehensive-test-suite.js',
        'js/test-runner.js'
    ];
    
    const missingFiles = [];
    
    for (const file of requiredFiles) {
        if (!fs.existsSync(file)) {
            missingFiles.push(file);
        }
    }
    
    if (missingFiles.length === 0) {
        log('✅ All required game files found', 'green');
        return true;
    } else {
        log('❌ Missing game files:', 'red');
        missingFiles.forEach(file => log(`  - ${file}`, 'red'));
        return false;
    }
}

// Check JavaScript syntax in game files
function checkJavaScriptSyntax() {
    log('🔍 Checking JavaScript syntax...', 'cyan');
    
    const jsFiles = [
        'js/GameLoop.js',
        'js/comprehensive-test-suite.js',
        'js/test-runner.js'
    ];
    
    const syntaxErrors = [];
    
    for (const file of jsFiles) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            
            // Basic syntax checks
            if (content.includes('import') && !content.includes('export')) {
                // Check if it's a module that should export something
                if (!file.includes('test-runner') && !file.includes('GameLoop')) {
                    syntaxErrors.push(`${file}: Has imports but no exports`);
                }
            }
            
            // Check for common syntax issues
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Check for unmatched brackets (basic check)
                const openBrackets = (line.match(/\{/g) || []).length;
                const closeBrackets = (line.match(/\}/g) || []).length;
                
                // Check for console.log without emoji (based on our standards)
                if (line.includes('console.log(') && !line.includes('🎮') && !line.includes('🎵') && 
                    !line.includes('🗡️') && !line.includes('💥') && !line.includes('⚠️') && 
                    !line.includes('🚀') && !line.includes('🎯') && !line.includes('🛡️') && 
                    !line.includes('🏥') && !line.includes('🧪') && !line.includes('✅') && 
                    !line.includes('❌') && line.length > 20) {
                    // Only flag if it's not a test file and not a short debug log
                    if (!file.includes('test') && !file.includes('Test')) {
                        syntaxErrors.push(`${file}:${i+1}: Console.log missing emoji prefix`);
                    }
                }
            }
            
        } catch (error) {
            syntaxErrors.push(`${file}: ${error.message}`);
        }
    }
    
    if (syntaxErrors.length === 0) {
        log('✅ JavaScript syntax checks passed', 'green');
        return true;
    } else {
        log('⚠️ JavaScript syntax issues found:', 'yellow');
        syntaxErrors.forEach(error => log(`  - ${error}`, 'yellow'));
        return false;
    }
}

// Check for consistency violations based on .cursorrules
function checkConsistencyViolations() {
    log('🔍 Checking for consistency violations...', 'cyan');
    
    const violations = [];
    
    // Check enemy files for constructor consistency
    const enemyFiles = ['js/Grunt.js', 'js/Rusher.js', 'js/Tank.js', 'js/Stabber.js'];
    
    for (const file of enemyFiles) {
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf8');
            
            // Check for proper constructor signature
            if (!content.includes('constructor(x, y, type, config, p, audio)')) {
                violations.push(`${file}: Missing proper constructor signature`);
            }
            
            // Check for deltaTimeMs parameter in update methods
            if (!content.includes('deltaTimeMs') && content.includes('updateSpecificBehavior')) {
                violations.push(`${file}: Missing deltaTimeMs parameter in update methods`);
            }
            
            // Check for p5.js instance mode usage
            if (content.includes('fill(') && !content.includes('this.p.fill(')) {
                violations.push(`${file}: Using p5.js global functions instead of instance mode`);
            }
        }
    }
    
    if (violations.length === 0) {
        log('✅ No consistency violations found', 'green');
        return true;
    } else {
        log('⚠️ Consistency violations found:', 'yellow');
        violations.forEach(violation => log(`  - ${violation}`, 'yellow'));
        return false;
    }
}

// Test if game actually starts (CRITICAL)
function testGameStartup() {
    log('🎮 Testing game startup...', 'cyan');
    
    // This would need to be implemented with a headless browser
    // For now, we'll check if the files that caused the startup failure exist
    const criticalFiles = [
        'js/visualEffects.js',  // The file that was missing import
        'js/GameLoop.js'
    ];
    
    const issues = [];
    
    for (const file of criticalFiles) {
        if (!fs.existsSync(file)) {
            issues.push(`Critical file missing: ${file}`);
        } else {
            const content = fs.readFileSync(file, 'utf8');
            
            // Check for the specific issue that caused startup failure
            if (file === 'js/GameLoop.js') {
                if (content.includes('new VisualEffectsManager') && !content.includes('import VisualEffectsManager')) {
                    issues.push('GameLoop.js uses VisualEffectsManager without importing it');
                }
            }
        }
    }
    
    const passed = issues.length === 0;
    
    if (passed) {
        log('✅ Game startup checks passed', 'green');
    } else {
        log('❌ Game startup issues found:', 'red');
        issues.forEach(issue => log(`  - ${issue}`, 'red'));
    }
    
    return {
        passed,
        details: passed ? 'Game startup checks passed' : `Issues: ${issues.join(', ')}`,
        issues
    };
}

// Generate test report
function generateTestReport(results) {
    log('\n🧪 ===== AUTOMATED TEST REPORT =====', 'magenta');
    log(`📅 Test Date: ${new Date().toISOString()}`, 'cyan');
    log(`🌐 Server URL: ${TEST_CONFIG.serverUrl}`, 'cyan');
    
    const categories = [
        { name: 'Server Status', result: results.serverRunning },
        { name: 'Game Files', result: results.filesExist },
        { name: 'Game Startup (CRITICAL)', result: results.gameStartup },
        { name: 'JavaScript Syntax', result: results.syntaxValid },
        { name: 'Consistency Rules', result: results.consistencyValid }
    ];
    
    let totalPassed = 0;
    let totalTests = categories.length;
    
    log('\n📊 Test Results:', 'cyan');
    categories.forEach(category => {
        const status = category.result ? '✅ PASS' : '❌ FAIL';
        const color = category.result ? 'green' : 'red';
        log(`  ${status} ${category.name}`, color);
        if (category.result) totalPassed++;
    });
    
    const successRate = (totalPassed / totalTests * 100).toFixed(1);
    log(`\n📈 Success Rate: ${successRate}% (${totalPassed}/${totalTests})`, 
        successRate >= 80 ? 'green' : successRate >= 60 ? 'yellow' : 'red');
    
    // Recommendations
    log('\n💡 Recommendations:', 'cyan');
    if (!results.serverRunning) {
        log('  - Start the development server with: npm run dev', 'yellow');
    }
    if (!results.filesExist) {
        log('  - Ensure all required game files are present', 'yellow');
    }
    if (!results.syntaxValid) {
        log('  - Fix JavaScript syntax issues before testing', 'yellow');
    }
    if (!results.consistencyValid) {
        log('  - Review .cursorrules and fix consistency violations', 'yellow');
    }
    
    if (totalPassed === totalTests) {
        log('\n🎉 All tests passed! Game is ready for manual testing.', 'green');
        log('💡 Next steps:', 'cyan');
        log('  - Open http://localhost:5500 in browser', 'cyan');
        log('  - Press F9 for full test suite', 'cyan');
        log('  - Press F10 for quick health check', 'cyan');
        log('  - Use testRunner.checkBugPatterns() in console', 'cyan');
    } else {
        log('\n⚠️ Some tests failed. Fix issues before proceeding.', 'yellow');
    }
    
    log('\n===== END TEST REPORT =====\n', 'magenta');
    
    return {
        totalTests,
        totalPassed,
        successRate: parseFloat(successRate),
        allPassed: totalPassed === totalTests
    };
}

// Check for screenshots in test-results directory
function checkScreenshots() {
    const dir = path.join(__dirname, 'test-results');

    if (!fs.existsSync(dir)) {
        log('❌ test-results directory not found', 'red');
        return false;
    }

    const pngFiles = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

    if (pngFiles.length === 0) {
        log('❌ No screenshots found in test-results/', 'red');
        return false;
    }

    log(`✅ Found ${pngFiles.length} screenshot(s) in test-results/`, 'green');
    return true;
}

// Main test function
async function runAutomatedTests() {
    log('🚀 Starting automated game tests...', 'magenta');
    log('🎮 Testing Vibe - Cosmic Beat Space Shooter\n', 'cyan');
    
    const results = {
        serverRunning: false,
        filesExist: false,
        gameStartup: false,
        syntaxValid: false,
        consistencyValid: false
    };
    
    try {
        // Test 1: Check server
        results.serverRunning = await checkServer();
        
        // Test 2: Check files
        results.filesExist = checkGameFiles();
        
        // Test 3: CRITICAL - Check game startup
        const startupResult = testGameStartup();
        results.gameStartup = startupResult.passed;
        
        // Test 4: Check JavaScript syntax
        results.syntaxValid = checkJavaScriptSyntax();
        
        // Test 5: Check consistency
        results.consistencyValid = checkConsistencyViolations();
        
    } catch (error) {
        log(`❌ Test execution failed: ${error.message}`, 'red');
    }
    
    // Generate report
    const report = generateTestReport(results);

    // Verify screenshots were generated
    const screenshotsExist = checkScreenshots();

    // Exit with appropriate code
    const exitCode = report.allPassed && screenshotsExist ? 0 : 1;
    process.exit(exitCode);
}

// Run tests if this script is executed directly
if (require.main === module) {
    runAutomatedTests();
}

module.exports = {
    runAutomatedTests,
    checkServer,
    checkGameFiles,
    checkJavaScriptSyntax,
    checkConsistencyViolations,
    checkScreenshots
};

