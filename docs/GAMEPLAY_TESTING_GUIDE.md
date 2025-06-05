# Vibe Game - Comprehensive Gameplay Testing Guide

*Version: 2.0 | Updated: 2025-06-05*

## Overview

This guide covers advanced gameplay testing for the Vibe cosmic beat space shooter, including automated probe systems, real-time testing, and comprehensive gameplay validation.

## Table of Contents

1. [AI Liveness Probe System](#ai-liveness-probe-system)
2. [Gameplay Testing Layers](#gameplay-testing-layers)
3. [Automated Testing Infrastructure](#automated-testing-infrastructure)
4. [Manual Testing Procedures](#manual-testing-procedures)
5. [Performance Testing](#performance-testing)
6. [Bug Detection & Reporting](#bug-detection--reporting)
7. [Testing Workflows](#testing-workflows)

---

## AI Liveness Probe System

### Overview
The AI Liveness Probe (`js/ai-liveness-probe.js`) is an intelligent monitoring system that continuously validates game state and automatically reports issues.

### What It Tests
```javascript
// Core liveness checks
✅ Frame count progression (game loop running)
✅ Player entity existence and health
✅ Enemy presence and activity
✅ Game state validity
✅ System responsiveness
```

### Automated Features
- **Real-time monitoring**: Runs continuously during gameplay
- **Screenshot capture**: Automatically captures failure states
- **Bug ticket creation**: Integrates with ticketing system
- **State logging**: Detailed diagnostic information
- **Failure classification**: Categorizes different types of issues

### Usage
```javascript
// Manual probe execution
const probeResult = await import('./js/ai-liveness-probe.js');
console.log('Probe result:', probeResult);

// Automated integration (runs automatically)
// Check console for probe failure reports
```

### Probe Result Structure
```javascript
{
  frameCount: 12345,           // Current frame number
  gameState: "playing",        // Current game state
  playerAlive: true,           // Player entity status
  enemyCount: 3,              // Active enemy count
  timestamp: 1638360000000,    // Test timestamp
  failure: null               // Failure description (if any)
}
```

---

## Gameplay Testing Layers

### Layer 1: Critical Functionality (MUST PASS)
```javascript
// Game Initialization
✅ Game starts without errors
✅ Canvas renders properly
✅ Core systems initialize
✅ Audio context activates

// Basic Gameplay
✅ Player spawns and responds to input
✅ Enemies spawn and behave correctly
✅ Collision detection works
✅ Game state transitions properly
```

### Layer 2: Core Mechanics (SHOULD PASS)
```javascript
// Combat System
✅ Player shooting mechanics
✅ Enemy AI behavior patterns
✅ Damage calculation accuracy
✅ Death/respawn cycles

// Physics & Movement
✅ Player movement responsiveness
✅ Enemy movement patterns
✅ Bullet trajectories
✅ Collision boundaries
```

### Layer 3: Advanced Features (NICE TO PASS)
```javascript
// Audio System
✅ Beat synchronization
✅ Sound effect timing
✅ Audio context management
✅ Volume controls

// Visual Effects
✅ Particle systems
✅ Explosion effects
✅ UI animations
✅ Background rendering
```

### Layer 4: Performance & Polish (OPTIMIZATION)
```javascript
// Performance Metrics
✅ Stable 60 FPS
✅ Memory usage optimization
✅ Smooth animations
✅ Responsive controls
```

---

## Automated Testing Infrastructure

### Browser-Based Testing Suite
**File**: `js/comprehensive-test-suite.js`

```javascript
// Quick health check (F10)
window.comprehensiveTestSuite.quickHealthCheck();

// Full test suite (F9)
window.comprehensiveTestSuite.runAllTests();

// Specific gameplay tests
window.comprehensiveTestSuite.testGameplay();
```

### Node.js Automated Testing
**File**: `automated-game-test.js`

```bash
# Run full automated test suite
npm test

# Or directly
node automated-game-test.js
```

### Console Test Runner
**File**: `js/test-runner.js`

```javascript
// Available in browser console
testRunner.quickCheck();           // Quick health check
testRunner.runFullTests();         // Complete test suite
testRunner.testGameMechanics();    // Gameplay-specific tests
testRunner.checkBugPatterns();     // Bug pattern detection
```

### Extended Gameplay Testing
**File**: `js/extended-gameplay-test.js`

```javascript
// 3-minute stress test with continuous gameplay simulation
// Press F7 key or run manually:
const tester = new ExtendedGameplayTester();
await tester.runExtendedTest();

// Features:
✅ Continuous player movement (WASD)
✅ Regular shooting (Space/Mouse)
✅ Combined actions (move + shoot)
✅ Game state monitoring
✅ Performance tracking
✅ Error recovery
✅ Comprehensive statistics
```

### Testing Interface Summary
```
F7  - Extended Gameplay Test (3-minute stress test)
F9  - Full Comprehensive Test Suite
F10 - Quick Health Check
F11 - Full Interactive Gameplay Tests
F12 - Quick Interactive Test
T   - Toggle Test Mode (auto-movement & shooting)
```

---

## Manual Testing Procedures

### Pre-Game Testing Checklist
```
□ Server running on localhost:5500
□ No console errors on page load
□ Canvas renders with correct dimensions
□ UI elements display properly
□ Audio context ready (click to activate)
```

### Core Gameplay Testing
```
□ Player Movement (WASD)
  - Smooth movement in all directions
  - No stuttering or lag
  - Proper boundary detection

□ Player Shooting (Mouse/Space)
  - Bullets fire in correct direction
  - Proper bullet speed and trajectory
  - Audio feedback on shooting

□ Enemy Behavior
  - Enemies spawn at appropriate intervals
  - AI behavior matches enemy type
  - Proper collision detection

□ Game State Management
  - Pause/resume functionality (P key)
  - Game over detection
  - Score tracking accuracy
```

### Advanced Feature Testing
```
□ Test Mode (T key)
  - Automated movement works
  - Automated shooting works
  - Can toggle on/off properly

□ Audio System (M key)
  - Sound effects play correctly
  - Beat synchronization works
  - Volume controls functional

□ Visual Effects
  - Explosions render properly
  - Particle effects perform well
  - No visual glitches
```

---

## Performance Testing

### FPS Monitoring
```javascript
// Real-time FPS monitoring
window.comprehensiveTestSuite.startPerformanceMonitoring();

// Check current FPS
console.log('Current FPS:', window.frameRate || 'Unknown');
```

### Memory Usage Testing
```javascript
// Memory usage check
const memoryInfo = performance.memory;
console.log('Memory usage:', {
  used: Math.round(memoryInfo.usedJSHeapSize / 1048576) + ' MB',
  total: Math.round(memoryInfo.totalJSHeapSize / 1048576) + ' MB',
  limit: Math.round(memoryInfo.jsHeapSizeLimit / 1048576) + ' MB'
});
```

### Stress Testing
```javascript
// Spawn multiple enemies for stress testing
for (let i = 0; i < 10; i++) {
  window.spawnSystem.spawnEnemies(1);
}

// Monitor performance under load
window.comprehensiveTestSuite.testEntityLimits();
```

---

## Bug Detection & Reporting

### Automated Bug Detection
The system automatically detects common bug patterns:

```javascript
// Common bug patterns monitored
- Null reference errors
- Infinite loops
- Memory leaks
- Performance degradation
- State inconsistencies
- Audio context issues
- Collision detection failures
```

### Bug Reporting Integration
```javascript
// Automatic bug ticket creation
{
  id: "auto-generated-id",
  title: "probe-failure",
  description: "Player missing or marked for removal",
  timestamp: "2025-06-05T11:30:00.000Z",
  artifacts: ["screenshot-base64-data"],
  status: "Open",
  type: "bug"
}
```

### Manual Bug Reporting
```javascript
// Create manual bug report
window.comprehensiveTestSuite.reportBug(
  'custom-bug-id',
  'Description of the issue',
  { additionalData: 'context' }
);
```

---

## Testing Workflows

### Development Workflow
```bash
1. Start development server: npm run dev
2. Run automated tests: node automated-game-test.js
3. Open browser: http://localhost:5500
4. Run quick health check: F10
5. Perform manual testing
6. Run full test suite: F9
7. Review test results and fix issues
```

### CI/CD Integration
```bash
# Automated testing in CI pipeline
npm test                    # Exit code 0 = pass, 1 = fail
npm run test:gameplay      # Gameplay-specific tests
npm run test:performance   # Performance benchmarks
```

### Bug Investigation Workflow
```bash
1. Reproduce the issue
2. Check console for errors
3. Run AI liveness probe
4. Capture screenshots/logs
5. Create detailed bug ticket
6. Implement fix
7. Verify fix with tests
8. Update test suite if needed
```

### Release Testing Checklist
```
□ All automated tests pass
□ Manual gameplay testing complete
□ Performance benchmarks met
□ No console errors
□ Audio system functional
□ Cross-browser compatibility verified
□ Mobile responsiveness checked
□ Accessibility standards met
```

---

## Advanced Testing Techniques

### Probe-Driven Development
```javascript
// Use probes to validate assumptions
const validateGameState = async () => {
  const probe = await import('./js/ai-liveness-probe.js');
  if (probe.failure) {
    console.error('Game state invalid:', probe.failure);
    return false;
  }
  return true;
};
```

### Real-Time Monitoring
```javascript
// Continuous monitoring during development
setInterval(async () => {
  const probe = await import('./js/ai-liveness-probe.js');
  if (probe.failure) {
    console.warn('⚠️ Probe detected issue:', probe.failure);
  }
}, 5000); // Check every 5 seconds
```

### Automated Regression Testing
```javascript
// Test suite runs automatically on file changes
// See package.json scripts for configuration
npm run test:watch        // Watch mode for continuous testing
npm run test:regression   // Full regression test suite
```

---

## Troubleshooting Common Issues

### Game Won't Start
```javascript
// Check critical initialization
1. Verify all imports are correct
2. Check for JavaScript errors in console
3. Ensure all required files exist
4. Run: window.comprehensiveTestSuite.checkGameStartup()
```

### Performance Issues
```javascript
// Performance debugging
1. Monitor FPS: window.frameRate
2. Check memory usage: performance.memory
3. Profile with browser dev tools
4. Run: window.comprehensiveTestSuite.testPerformance()
```

### Audio Problems
```javascript
// Audio troubleshooting
1. Check audio context state
2. Verify user interaction occurred
3. Test with: window.audio.testAudioSystem()
4. Check browser audio permissions
```

---

## Best Practices

### Testing Philosophy
1. **Test reality first** - Does the game actually work?
2. **Fail fast** - Catch critical issues immediately
3. **Automate everything** - Reduce manual testing burden
4. **Document failures** - Learn from every bug
5. **Test continuously** - Don't wait for release

### Code Quality
1. **Write testable code** - Favor pure functions
2. **Use dependency injection** - Make testing easier
3. **Handle errors gracefully** - Fail safely
4. **Log meaningfully** - Use emoji prefixes for categorization
5. **Monitor performance** - Track metrics continuously

### Team Collaboration
1. **Share test results** - Keep everyone informed
2. **Document test procedures** - Make testing repeatable
3. **Review test coverage** - Ensure comprehensive testing
4. **Update tests regularly** - Keep pace with development
5. **Celebrate quality** - Recognize good testing practices

---

## Conclusion

The Vibe game testing infrastructure provides comprehensive coverage from basic functionality to advanced performance monitoring. The AI Liveness Probe system ensures continuous quality validation, while the multi-layered testing approach catches issues at every level.

**Key Benefits:**
- ✅ **Automated issue detection** with intelligent probes
- ✅ **Comprehensive test coverage** across all game systems
- ✅ **Real-time monitoring** during development
- ✅ **Integrated bug reporting** with automatic ticket creation
- ✅ **Performance optimization** through continuous monitoring
- ✅ **Developer-friendly** tools and workflows

This testing system ensures the Vibe game maintains production-ready quality while enabling rapid development and iteration.

---

*For additional testing resources, see:*
- [MCP Playwright Testing Guide](./MCP_PLAYWRIGHT_TESTING_GUIDE.md)
- [Ticketing System Guide](./TICKETING_SYSTEM_GUIDE.md)
- [Testing Report](../TESTING_REPORT.md)