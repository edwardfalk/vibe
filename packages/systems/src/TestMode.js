/**
 * TestMode.js - Handles automated testing including player movement patterns, auto-shooting, and test enemy spawning
 */

// Requires p5.js for global utility functions: constrain(), random(), lerp(), etc.

import { Bullet } from '@vibe/entities/bullet.js';
import { SOUND } from '@vibe/core/audio/SoundIds.js';
import {
  sin,
  cos,
  min,
  floor,
  random,
  atan2,
  PI,
  TWO_PI,
  dist,
} from '@vibe/core/mathUtils.js';
import { max } from '@vibe/core';

/**
 * @param {Player} player - The player object (dependency injected for modularity)
 */
export class TestMode {
  constructor(player) {
    // Test mode state
    this.player = player;
    this.enabled = false;
    this.timer = 0;

    // Scenario name for deterministic test harness
    this.scenario = null; // e.g., 'audio-basic', 'enemies-basic'

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
      console.log(
        '🤖 Starting automated testing - watch the parallax and shooting!'
      );
    }
    if (enabled && this.scenario) {
      this.applyScenario(this.scenario);
    }
  }

  // Toggle test mode
  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  // Update test mode (call every frame)
  update() {
    if (!this.enabled || !this.player) return;

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
    const halfSize = this.player.size / 2;

    // Test pattern that specifically targets all four corners and edges
    const phase = (this.timer * this.moveSpeed) % (PI * 8); // Complete cycle every ~8 seconds

    if (phase < PI * 2) {
      // Phase 1: Test all four corners in sequence
      this.moveToCorners(phase, halfSize);
    } else if (phase < PI * 4) {
      // Phase 2: Test edge movement - left and right edges
      this.moveAlongVerticalEdges(phase - PI * 2, halfSize);
    } else if (phase < PI * 6) {
      // Phase 3: Test edge movement - top and bottom edges
      this.moveAlongHorizontalEdges(phase - PI * 4, halfSize);
    } else {
      // Phase 4: Center movement for comparison
      this.moveCenterPattern(phase, halfSize);
    }

    // Apply proper player constraints (same as in player.js)
    this.player.x = this.player.p.constrain(
      this.player.x,
      halfSize,
      this.player.p.width - halfSize
    );
    this.player.y = this.player.p.constrain(
      this.player.y,
      halfSize,
      this.player.p.height - halfSize
    );
  }

  // Move player to corners in sequence
  moveToCorners(phase, halfSize) {
    const cornerPhase = (phase / (PI * 2)) * 4;
    if (cornerPhase < 1) {
      // Top-left corner
      this.player.x = halfSize;
      this.player.y = halfSize;
    } else if (cornerPhase < 2) {
      // Top-right corner
      this.player.x = this.player.p.width - halfSize;
      this.player.y = halfSize;
    } else if (cornerPhase < 3) {
      // Bottom-right corner
      this.player.x = this.player.p.width - halfSize;
      this.player.y = this.player.p.height - halfSize;
    } else {
      // Bottom-left corner
      this.player.x = halfSize;
      this.player.y = this.player.p.height - halfSize;
    }
  }

  // Move along vertical edges (left and right)
  moveAlongVerticalEdges(phase, halfSize) {
    const edgePhase = phase / (PI * 2);
    this.player.x = edgePhase < 0.5 ? halfSize : this.player.p.width - halfSize; // Left then right edge
    this.player.y =
      halfSize +
      (this.player.p.height - this.player.size) * sin(edgePhase * PI * 4); // Move up/down along edge
  }

  // Move along horizontal edges (top and bottom)
  moveAlongHorizontalEdges(phase, halfSize) {
    const edgePhase = phase / (PI * 2);
    this.player.y =
      edgePhase < 0.5 ? halfSize : this.player.p.height - halfSize; // Top then bottom edge
    this.player.x =
      halfSize +
      (this.player.p.width - this.player.size) * sin(edgePhase * PI * 4); // Move left/right along edge
  }

  // Move in center pattern
  moveCenterPattern(phase, halfSize) {
    const centerX = this.player.p.width / 2;
    const centerY = this.player.p.height / 2;
    const radius = min(this.player.p.width, this.player.p.height) * 0.2;
    this.player.x = centerX + radius * cos(phase * 2);
    this.player.y = centerY + radius * cos(phase * 2);
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
      const distance = dist(this.player.x, this.player.y, enemy.x, enemy.y);
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
    const angle = atan2(enemy.y - this.player.y, enemy.x - this.player.x);
    const bulletDistance = this.player.size * 0.9;
    const bulletX = this.player.x + cos(angle) * bulletDistance;
    const bulletY = this.player.y + sin(angle) * bulletDistance;

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
      window.audio.playPlayerShoot(this.player.x, this.player.y);
    }
  }

  // Update test enemy spawning
  updateTestEnemySpawning() {
    if (this.timer - this.lastEnemySpawnFrame < this.enemySpawnInterval) return;

    // Spawn test enemy
    const testX = random(50, this.player.p.width - 50);
    const testY = random(50, this.player.p.height - 50);

    // Randomly choose enemy type for testing
    const enemyTypes = ['grunt', 'stabber', 'rusher', 'tank'];
    const randomType = enemyTypes[floor(random() * enemyTypes.length)];

    if (
      window.enemies &&
      window.spawnSystem &&
      window.spawnSystem.enemyFactory
    ) {
      const enemy = window.spawnSystem.enemyFactory.createEnemy(
        testX,
        testY,
        randomType
      );
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
      const visualX = this.player.x - cameraX;
      const visualY = this.player.y - cameraY;

      console.log(
        `🎯 Edge Test - World: (${this.player.x.toFixed(1)}, ${this.player.y.toFixed(1)}) Visual: (${visualX.toFixed(1)}, ${visualY.toFixed(1)}) Camera: (${cameraX.toFixed(1)}, ${cameraY.toFixed(1)})`
      );
      this.lastLogFrame = this.timer;
    }

    // Log test progress periodically
    if (this.timer % 120 === 0) {
      const enemyCount = window.enemies ? window.enemies.length : 0;
      const bulletCount = window.playerBullets
        ? window.playerBullets.length
        : 0;
      console.log(
        `🤖 Test running... Timer: ${this.timer}, Enemies: ${enemyCount}, Bullets: ${bulletCount}`
      );
    }
  }

  // Scenario application (deterministic harness)
  async applyScenario(name) {
    this.scenario = name;
    console.log(`🧪 Applying test scenario: ${name}`);
    if (name === 'audio-basic') {
      this.enableDeterminism();
      // Expose a stable audio runner for probes
      if (!window.testAudio) window.testAudio = {};
      window.testAudio.run = async () => {
        try {
          if (window.audio?.isMuted?.()) window.audio.toggle();
          await window.audio?.playSound?.(SOUND.playerShoot, { volume: 1 });
          await new Promise((r) => setTimeout(r, 200));
          await window.audio?.playSound?.(SOUND.explosion, { volume: 1 });
          const t0 = performance.now();
          let peak = -Infinity;
          while (performance.now() - t0 < 1200) {
            const db = window.audio?.getMasterLevel?.() ?? -Infinity;
            if (typeof db === 'number' && isFinite(db)) peak = Math.max(peak, db);
            await new Promise((r) => setTimeout(r, 25));
          }
          return {
            dbPeak: peak,
            meterFunctional: isFinite(peak),
            busLevels: window.audio?.getBusLevels?.() ?? null,
            masterGain: window.audio?._gains?.master?.gain?.value ?? null,
            ctxState: window.Tone?.context?.state ?? null,
          };
        } catch (e) {
          return { error: String(e) };
        }
      };
    }
    if (name === 'enemies-basic') {
      this.enableDeterminism();
      // Fixed enemy set near the player
      const px = this.player?.x ?? 400, py = this.player?.y ?? 300;
      this.forceSpawnEnemy('grunt', px + 150, py);
      this.forceSpawnEnemy('rusher', px - 150, py);
      this.forceSpawnEnemy('tank', px, py + 180);
      this.forceSpawnEnemy('stabber', px, py - 180);
    }
  }

  enableDeterminism() {
    try {
      // Standard seed for reproducibility
      import('/packages/core/src/index.js').then(({ setRandomSeed }) => setRandomSeed(1337));
    } catch {}
    // Disable periodic random spawns in test scenario
    this.enemySpawnInterval = 1e9;
  }

  // Set movement pattern
  setMovementPattern(pattern) {
    this.currentPattern = pattern;
    console.log(`🎯 Test movement pattern set to: ${pattern}`);
  }

  // Set auto-shoot interval
  setShootInterval(frames) {
    this.shootInterval = max(1, frames);
    console.log(`🎯 Auto-shoot interval set to: ${this.shootInterval} frames`);
  }

  // Set enemy spawn interval
  setEnemySpawnInterval(frames) {
    this.enemySpawnInterval = max(60, frames);
    console.log(
      `🎯 Enemy spawn interval set to: ${this.enemySpawnInterval} frames`
    );
  }

  // Force spawn specific enemy type
  forceSpawnEnemy(type, x = null, y = null) {
    if (!window.enemies) return;

    const spawnX = x !== null ? x : random(50, this.player.p.width - 50);
    const spawnY = y !== null ? y : random(50, this.player.p.height - 50);

    if (window.spawnSystem && window.spawnSystem.enemyFactory) {
      const enemy = window.spawnSystem.enemyFactory.createEnemy(
        spawnX,
        spawnY,
        type
      );
      window.enemies.push(enemy);
    }
    console.log(
      `🎯 Force spawned ${type} at (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)})`
    );
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
      bulletCount: window.playerBullets ? window.playerBullets.length : 0,
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

  // Minimal draw method for GameLoop.js
  draw(p) {
    if (!this.enabled) return;
    // Draw a simple overlay in the top-left corner
    p.push();
    p.noStroke();
    p.fill(255, 0, 0, 180);
    p.textSize(14);
    p.textAlign(p.LEFT, p.TOP);
    p.text('🧪 Test Mode ON', 10, 10);
    p.pop();
  }
}
