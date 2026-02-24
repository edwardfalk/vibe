/**
 * GameLoop.js - Core game loop and coordination between all systems
 *
 * Musical combat system where all actions sync to beats:
 * - Player = Hi-hat (every beat)
 * - Grunts = Snare (beats 2 & 4)
 * - Tanks = Bass drum (beat 1)
 * - Stabbers = Off-beat accent (beat 3.5)
 */

import { Player } from './player.js';
import { EnemyFactory } from './EnemyFactory.js';
import { ExplosionManager } from './explosions/ExplosionManager.js';
import { GameState } from './GameState.js';
import { CameraSystem } from './CameraSystem.js';
import { SpawnSystem } from './SpawnSystem.js';
import { BackgroundRenderer } from './BackgroundRenderer.js';
import { UIRenderer } from './UIRenderer.js';
import { CollisionSystem } from './CollisionSystem.js';
import { TestMode } from './TestMode.js';
import { Audio } from './Audio.js';
import { BeatClock } from './audio/BeatClock.js';
import { BeatTrack } from './audio/BeatTrack.js';
import { RhythmFX } from './RhythmFX.js';
import { GameContext, createWindowBackedContext } from './core/GameContext.js';
import { initializeInputHandlers } from './core/InputHandlers.js';
import { updateBombs as updateBombSystem } from './systems/BombSystem.js';
import { EnemyDeathHandler } from './systems/combat/EnemyDeathHandler.js';
import {
  DAMAGE_RESULT,
  normalizeDamageResult,
} from './shared/contracts/DamageResult.js';
import { Bullet } from './bullet.js';
import VisualEffectsManager from './visualEffects.js';
import { FloatingTextManager } from './effects.js';
import { handleAreaDamageEvents } from './effects/AreaDamageHandler.js';
import { CONFIG } from './config.js';
import {
  sqrt,
  max,
  min,
  floor,
  ceil,
  round,
  random,
  atan2,
  cos,
  sin,
} from './mathUtils.js';

const DEFAULT_PERF_LOG_INTERVAL_FRAMES = 300;

// Core game objects
let player;
const enemies = [];
const playerBullets = [];
const enemyBullets = [];
const activeBombs = [];

// Systems
let explosionManager;
let audio;
let gameContext;
let enemyDeathHandler;

// Global system references for easy access
window.player = null;
window.enemies = [];
window.playerBullets = playerBullets;
window.enemyBullets = enemyBullets;
window.activeBombs = activeBombs;
window.explosionManager = null;
window.audio = null;
window.speechManager = null;
window.performanceDiagnostics = null;

// Keys system for testing
window.keys = {
  W: false,
  w: false,
  A: false,
  a: false,
  S: false,
  s: false,
  D: false,
  d: false,
};

// Add at the top, after global system references
window.playerIsShooting = false;
window.arrowUpPressed = false;
window.arrowDownPressed = false;
window.arrowLeftPressed = false;
window.arrowRightPressed = false;

initializeInputHandlers();

function setup(p) {
  p.createCanvas(800, 600);
  if (!gameContext) {
    gameContext = createWindowBackedContext(new GameContext());
    window.gameContext = gameContext;
  }

  // Initialize player at center
  player = new Player(p, p.width / 2, p.height / 2, window.cameraSystem);
  window.player = player;

  // Initialize global arrays
  window.enemies = enemies;
  window.playerBullets = playerBullets;
  window.enemyBullets = enemyBullets;
  window.activeBombs = activeBombs;

  // Initialize systems
  explosionManager = new ExplosionManager();
  window.explosionManager = explosionManager;

  window.floatingText = new FloatingTextManager();
  window.hitStopFrames = 0;

  // Use one visual effects manager path to avoid split state.
  if (!window.visualEffectsManager) {
    window.visualEffectsManager = new VisualEffectsManager(
      window.backgroundLayers
    );
  }
  console.log('🎮 Visual effects manager initialized');

  // Initialize unified audio system
  if (!window.audio) {
    window.audio = new Audio(p, window.player, gameContext);
  }
  console.log('🎵 Unified audio system initialized');

  // Initialize modular systems
  if (!window.gameState) {
    window.gameState = new GameState();
  }
  window.gameState.activeBombs = activeBombs;

  if (!window.cameraSystem) {
    window.cameraSystem = new CameraSystem(p);
    if (player) {
      player.cameraSystem = window.cameraSystem; // Fix mouse aiming
    }
  }
  console.log('📷 Camera system initialized');

  if (!window.spawnSystem) {
    window.spawnSystem = new SpawnSystem();
  }
  console.log('👾 Spawn system initialized');

  // Now restart the game state (this calls spawnEnemies which needs camera)
  window.gameState.restart();
  console.log('🎮 GameState system initialized');

  if (!window.backgroundRenderer) {
    window.backgroundRenderer = new BackgroundRenderer(
      p,
      window.cameraSystem,
      window.player,
      window.gameState
    );
  }
  window.backgroundRenderer.createParallaxBackground(p);
  console.log('🌌 Background renderer initialized');

  if (!window.collisionSystem) {
    window.collisionSystem = new CollisionSystem(gameContext);
  }
  console.log('💥 Collision system initialized');

  if (!enemyDeathHandler) {
    enemyDeathHandler = new EnemyDeathHandler(gameContext);
  }

  if (!window.uiRenderer) {
    window.uiRenderer = new UIRenderer(
      window.gameState,
      window.player,
      window.audio,
      window.cameraSystem,
      window.testModeManager
    );
  }
  console.log('🖥️ UI renderer initialized');

  if (!window.testModeManager) {
    window.testModeManager = new TestMode(window.player);
  }
  console.log('🧪 Test mode manager initialized');

  // Initialize BeatClock for rhythm-locked gameplay
  if (!window.beatClock) {
    window.beatClock = new BeatClock(120);
    console.log('🎵 BeatClock initialized and assigned to window.beatClock');
  }

  // Initialize procedural beat track (starts on first user interaction)
  if (!window.beatTrack) {
    window.beatTrack = new BeatTrack(120);
  }

  // Initialize beat visualizer for UI feedback
  if (!window.rhythmFX) {
    window.rhythmFX = new RhythmFX();
    console.log('🎵 RhythmFX initialized');
  }

  // Initial enemy spawn
  if (window.spawnSystem) {
    window.spawnSystem.spawnEnemies(1);
  }

  gameContext.assign({
    player: window.player,
    enemies: window.enemies,
    playerBullets: window.playerBullets,
    enemyBullets: window.enemyBullets,
    activeBombs: window.activeBombs,
    audio: window.audio,
    gameState: window.gameState,
    cameraSystem: window.cameraSystem,
    collisionSystem: window.collisionSystem,
    explosionManager: window.explosionManager,
    floatingText: window.floatingText,
    beatClock: window.beatClock,
    rhythmFX: window.rhythmFX,
    visualEffectsManager: window.visualEffectsManager,
  });

  console.log('🎮 Game setup complete - all systems initialized');
}

function draw(p) {
  // Ensure global frameCount is updated for all modules and probes (p5 instance mode)
  window.frameCount = p.frameCount;

  // Log the current game state every frame - DISABLED to reduce console spam
  // if (window.DEBUG && window.gameState && window.gameState.gameState) {
  //     console.log('🎮 [STATE] gameState:', window.gameState.gameState);
  // }

  // Draw background using BackgroundRenderer
  if (window.backgroundRenderer) {
    window.backgroundRenderer.drawCosmicAuroraBackground(p);
    window.backgroundRenderer.drawEnhancedSpaceElements(p);
  }

  // Draw parallax background
  if (window.backgroundRenderer) {
    window.backgroundRenderer.drawParallaxBackground(p);

    if (window.gameState && window.gameState.gameState === 'playing') {
      window.backgroundRenderer.drawInteractiveBackgroundEffects(p);
    }
  }

  // Main game logic based on state
  if (window.gameState) {
    switch (window.gameState.gameState) {
      case 'playing':
        updateGame(p);
        drawGame(p);
        if (window.uiRenderer) {
          window.uiRenderer.updateUI(p);
        }
        break;

      case 'paused':
        drawGame(p); // Draw game in background
        break;

      case 'gameOver':
        // Auto-restart in test mode
        if (window.testModeManager && window.testModeManager.enabled) {
          window.gameState.gameOverTimer++;
          if (window.gameState.gameOverTimer >= 60) {
            window.gameState.restart();
            console.log('🔄 Auto-restarting game in test mode');
          }
        }
        break;
    }
  }

  // Draw UI overlay
  if (window.uiRenderer) {
    window.uiRenderer.drawUI(p);
  }

  // Draw beat visualizer effects (telegraphs, beat bar)
  if (window.rhythmFX) {
    window.rhythmFX.draw(p, window.cameraSystem);
  }
}

function updateGame(p) {
  if (gameContext) {
    gameContext.assign({
      player: window.player,
      enemies: window.enemies,
      playerBullets: window.playerBullets,
      enemyBullets: window.enemyBullets,
      activeBombs: window.activeBombs,
      audio: window.audio,
      gameState: window.gameState,
      cameraSystem: window.cameraSystem,
      collisionSystem: window.collisionSystem,
      explosionManager: window.explosionManager,
      floatingText: window.floatingText,
      beatClock: window.beatClock,
      rhythmFX: window.rhythmFX,
      visualEffectsManager: window.visualEffectsManager,
    });
  }

  // Hitstop: freeze game updates for a few frames on impactful kills
  if (window.hitStopFrames > 0) {
    window.hitStopFrames--;
    // Still update floating text during hitstop so they don't freeze
    if (window.floatingText) window.floatingText.update();

    // Apply chromatic aberration during hit-stop (decays as hitstop ends)
    if (window.visualEffectsManager && window.hitStopFrames > 0) {
      const hitStopProgress = window.hitStopFrames / 8; // Normalize to max expected frames
      const chromaIntensity = hitStopProgress * 0.6;
      window.visualEffectsManager.chromaticAberration = chromaIntensity;
    }

    return;
  }

  // Update BeatClock every frame for accurate rhythm timing
  if (window.beatClock && typeof window.beatClock.update === 'function') {
    window.beatClock.update();
  }

  // Update beat visualizer
  if (window.rhythmFX) {
    window.rhythmFX.update();
  }

  // Test mode - automated movement and shooting
  if (window.testModeManager && window.testModeManager.enabled) {
    window.testModeManager.update();
  }

  // Update player
  if (player) {
    player.update(p.deltaTime);
  }

  // Update camera for parallax effect
  if (window.cameraSystem) {
    if (typeof window.cameraSystem.update === 'function') {
      window.cameraSystem.update();
    } else {
      console.warn('⚠️ Camera update method not found');
    }
  }

  // Unified shooting logic
  if (window.playerIsShooting && player) {
    const bullet = player.shoot();
    if (bullet) {
      playerBullets.push(bullet);
      if (window.gameState) {
        window.gameState.addShotFired();
      }
      if (window.audio) {
        window.audio.playPlayerShoot(player.x, player.y);
      }
    }
  }

  // Update bullets
  updateBullets(p);

  // Immediately process bullet collisions to catch hits before enemies move
  if (window.collisionSystem) {
    window.collisionSystem.checkBulletCollisions();
  }

  // Update bombs (split into dedicated BombSystem module)
  updateBombSystem({
    activeBombs,
    enemies,
    player: window.player,
    explosionManager,
    audio: window.audio,
    cameraSystem: window.cameraSystem,
    gameState: window.gameState,
    collisionSystem: window.collisionSystem,
  });

  // Update enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    // CRITICAL FIX: Remove dead enemies before updating
    if (enemy.health <= 0 || enemy.markedForRemoval) {
      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(
          `🗑️ Removing dead enemy: ${enemy.type} at (${enemy.x.toFixed(1)}, ${enemy.y.toFixed(1)}) health=${enemy.health} marked=${enemy.markedForRemoval}`
        );
      }
      enemies.splice(i, 1);
      continue;
    }

    const result = enemy.update(
      player ? player.x : 400,
      player ? player.y : 300,
      p.deltaTime
    );

    // Handle enemy update results
    if (result) {
      if (result.type === 'rusher-explosion') {
        // Rusher exploding - handle explosion and effects
        if (window.collisionSystem) {
          window.collisionSystem.handleRusherExplosion(result, i);
        }

        // Add explosion effects
        if (window.explosionManager) {
          window.explosionManager.addExplosion(
            result.x,
            result.y,
            'rusher-explosion'
          );
        }

        // Add enhanced particle explosion
        if (window.visualEffectsManager) {
          try {
            window.visualEffectsManager.addExplosionParticles(
              result.x,
              result.y,
              'rusher-explosion'
            );
            window.visualEffectsManager.triggerChromaticAberration(0.8, 45);
            window.visualEffectsManager.triggerBloom(0.5, 30);
          } catch (error) {
            console.log('⚠️ Explosion effects error:', error);
          }
        }

        // Play explosion audio
        if (window.audio) {
          window.audio.playExplosion(result.x, result.y);
        }

        // Screen shake
        if (window.cameraSystem) {
          window.cameraSystem.addShake(18, 30);
        }

        console.log(`💥 RUSHER EXPLOSION at (${result.x}, ${result.y})!`);

        // CRITICAL FIX: Remove the rusher from enemies array after explosion
        enemies.splice(i, 1);
        continue;
      } else if (typeof result.checkCollision === 'function') {
        // Handle enemy bullets
        enemyBullets.push(result);
        console.log(
          `➕ Added enemy bullet to array: ${result.owner} at (${Math.round(result.x)}, ${Math.round(result.y)}) - Total: ${enemyBullets.length}`
        );
      } else if (
        result.type === 'stabber-melee' ||
        result.type === 'stabber-miss'
      ) {
        // Handle stabber attack objects - process damage immediately
        console.log(
          `🗡️ Stabber attack result: ${result.type} at (${Math.round(result.x)}, ${Math.round(result.y)})`
        );

        // Process stabber damage to player
        if (
          result.type === 'stabber-melee' &&
          result.playerHit &&
          window.player
        ) {
          console.log(
            `⚔️ STABBER HIT! Player took ${result.damage} damage from stab attack`
          );

          if (window.audio) {
            window.audio.playPlayerHit();
          }

          if (window.gameState) {
            window.gameState.resetKillStreak(); // Reset kill streak on taking damage
          }

          // Apply damage
          if (window.player.takeDamage(result.damage, 'stabber-melee')) {
            if (window.gameState) {
              window.gameState.setGameState('gameOver');
            }
            console.log('💀 PLAYER KILLED BY STABBER ATTACK!');
          } else {
            // Apply knockback to player
            const knockbackAngle = atan2(
              window.player.y - result.y,
              window.player.x - result.x
            );
            const knockbackForce = 8;
            window.player.velocity.x += cos(knockbackAngle) * knockbackForce;
            window.player.velocity.y += sin(knockbackAngle) * knockbackForce;

            // Screen shake for dramatic effect
            if (window.cameraSystem) {
              window.cameraSystem.addShake(10, 20);
            }

            // Create impact effect
            if (window.explosionManager) {
              window.explosionManager.addExplosion(
                window.player.x,
                window.player.y,
                'hit'
              );
            }
          }
        }

        // Process friendly fire damage to other enemies
        if (result.enemiesHit && result.enemiesHit.length > 0) {
          // Process hits in reverse order to avoid index issues when removing enemies
          for (let k = result.enemiesHit.length - 1; k >= 0; k--) {
            const hit = result.enemiesHit[k];
            const targetEnemy = hit.enemy;

            // Apply damage to enemy
            const damageResult = normalizeDamageResult(
              targetEnemy.takeDamage(hit.damage, hit.angle, 'stabber')
            );

            if (damageResult === DAMAGE_RESULT.DIED) {
              // Enemy killed by friendly fire
              console.log(
                `💀 ${targetEnemy.type} killed by stabber friendly fire!`
              );

              // Handle death effects
              if (window.collisionSystem) {
                window.collisionSystem.handleEnemyDeath(
                  targetEnemy,
                  targetEnemy.type,
                  targetEnemy.x,
                  targetEnemy.y
                );
              }

              // Remove from enemies array (find current index)
              const enemyIndex = enemies.indexOf(targetEnemy);
              if (enemyIndex !== -1) {
                enemies[enemyIndex].markedForRemoval = true;
              }

              // Award points and kills
              if (window.gameState) {
                window.gameState.addKill();
                window.gameState.addScore(15); // Bonus points for friendly fire
              }
            } else if (damageResult === DAMAGE_RESULT.EXPLODING) {
              // Rusher started exploding from friendly fire
              if (window.explosionManager) {
                window.explosionManager.addExplosion(
                  targetEnemy.x,
                  targetEnemy.y,
                  'hit'
                );
              }
              if (window.audio) {
                window.audio.playHit(targetEnemy.x, targetEnemy.y);
              }
              console.log(
                `💥 Stabber friendly fire caused ${targetEnemy.type} to explode!`
              );
            } else {
              // Enemy damaged but not killed
              if (window.explosionManager) {
                window.explosionManager.addExplosion(
                  targetEnemy.x,
                  targetEnemy.y,
                  'hit'
                );
              }
              if (window.audio) {
                window.audio.playHit(targetEnemy.x, targetEnemy.y);
              }
              console.log(
                `🗡️ ${targetEnemy.type} damaged by stabber friendly fire, health: ${targetEnemy.health}`
              );
            }
          }
        }
      } else {
        console.warn(`⚠️ Unknown object returned from enemy update:`, result);
      }
    }
  }

  // Remove enemies marked for removal after all updates
  window.enemies = window.enemies.filter((enemy) => !enemy.markedForRemoval);

  // Check collisions using CollisionSystem
  if (window.collisionSystem) {
    window.collisionSystem.checkBulletCollisions();
    window.collisionSystem.checkContactCollisions();
  }

  // Update spawn system
  if (window.spawnSystem) {
    window.spawnSystem.update();
  }

  // Update explosion manager and handle damage events
  if (explosionManager) {
    const damageEvents = explosionManager.update();

    // Process area damage events from plasma clouds and radioactive debris
    if (damageEvents && damageEvents.length > 0) {
      handleAreaDamageEvents(damageEvents, {
        player: gameContext ? gameContext.get('player') : window.player,
        enemies: gameContext ? gameContext.get('enemies') : enemies,
        audio: gameContext ? gameContext.get('audio') : window.audio,
        gameState: gameContext
          ? gameContext.get('gameState')
          : window.gameState,
        cameraSystem: gameContext
          ? gameContext.get('cameraSystem')
          : window.cameraSystem,
        collisionSystem: gameContext
          ? gameContext.get('collisionSystem')
          : window.collisionSystem,
        explosionManager: gameContext
          ? gameContext.get('explosionManager')
          : window.explosionManager,
        enemyDeathHandler,
      });
    }
  }

  // Update audio system
  if (window.audio) {
    window.audio.update();
  }

  // Update floating text
  if (window.floatingText) {
    window.floatingText.update();
  }

  updatePerformanceDiagnostics(p.frameCount);
}

function updatePerformanceDiagnostics(frameCount) {
  const gameSettings = CONFIG.GAME_SETTINGS || {};
  const perfEnabled = Boolean(gameSettings.PERF_DIAGNOSTICS);
  const interval =
    Number(gameSettings.PERF_LOG_INTERVAL_FRAMES) ||
    DEFAULT_PERF_LOG_INTERVAL_FRAMES;

  if (!perfEnabled || frameCount % interval !== 0) return;

  const collisionStats =
    window.collisionSystem &&
    typeof window.collisionSystem.getPerformanceSnapshot === 'function'
      ? window.collisionSystem.getPerformanceSnapshot()
      : null;
  const bulletPoolStats =
    typeof Bullet.getPoolStats === 'function' ? Bullet.getPoolStats() : null;
  const floatingTextPoolStats =
    window.floatingText &&
    window.floatingText.textPool &&
    typeof window.floatingText.textPool.getStats === 'function'
      ? window.floatingText.textPool.getStats()
      : null;
  const explosionPoolStats =
    window.explosionManager &&
    typeof window.explosionManager.getPoolStats === 'function'
      ? window.explosionManager.getPoolStats()
      : null;

  window.performanceDiagnostics = {
    frameCount,
    collision: collisionStats,
    pools: {
      bullets: bulletPoolStats,
      floatingText: floatingTextPoolStats,
      explosions: explosionPoolStats,
    },
  };

  console.log('🎮 PerfDiagnostics', {
    frameCount,
    collisionAverages: collisionStats?.averages,
    bulletPool: bulletPoolStats
      ? {
          inUse: bulletPoolStats.inUse,
          peakInUse: bulletPoolStats.peakInUse,
          poolSize: bulletPoolStats.poolSize,
          peakPoolSize: bulletPoolStats.peakPoolSize,
          created: bulletPoolStats.created,
          reused: bulletPoolStats.reused,
        }
      : null,
    floatingTextPool: floatingTextPoolStats
      ? {
          inUse: floatingTextPoolStats.inUse,
          peakInUse: floatingTextPoolStats.peakInUse,
          poolSize: floatingTextPoolStats.poolSize,
          peakPoolSize: floatingTextPoolStats.peakPoolSize,
        }
      : null,
    explosionPools: explosionPoolStats
      ? {
          fragmentPoolSize: explosionPoolStats.fragmentPoolSize,
          peakFragmentPoolSize: explosionPoolStats.peakFragmentPoolSize,
          centralPoolSize: explosionPoolStats.centralPoolSize,
          peakCentralPoolSize: explosionPoolStats.peakCentralPoolSize,
        }
      : null,
  });
}

function drawGame(p) {
  // Debug: Log camera position and enemy count every 30 frames
  if (typeof p.frameCount !== 'undefined' && p.frameCount % 30 === 0) {
    const cam = window.cameraSystem
      ? { x: window.cameraSystem.x, y: window.cameraSystem.y }
      : { x: 0, y: 0 };
    console.log(
      `🎮 [DRAW GAME] camera=(${cam.x},${cam.y}) enemies=${enemies.length}`
    );
  }

  // Apply screen effects (chromatic aberration, bloom) before camera transform
  if (window.visualEffectsManager) {
    window.visualEffectsManager.applyScreenEffects(p);
  }

  // Apply camera transform for world objects
  if (window.cameraSystem) {
    window.cameraSystem.applyTransform();
  }

  // Draw enemies
  for (const enemy of enemies) {
    enemy.draw(p);
  }

  // Draw player
  if (player) {
    player.draw(p);
  }

  // Draw bullets
  for (const bullet of playerBullets) {
    bullet.draw(p);
  }

  for (const bullet of enemyBullets) {
    bullet.draw(p);
  }

  // Draw explosions
  if (explosionManager) {
    explosionManager.draw(p);
  }

  // Draw floating damage/kill text (world space)
  if (window.floatingText) {
    window.floatingText.draw(p);
  }

  // Draw speech bubbles/text (world space - with camera transform)
  if (window.audio) {
    window.audio.drawTexts(p);
  }

  // Remove camera transform
  if (window.cameraSystem) {
    window.cameraSystem.removeTransform();
  }
}

function updateBullets(p) {
  // Update player bullets
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const bullet = playerBullets[i];
    bullet.update();

    if (bullet.isOffScreen()) {
      Bullet.release(bullet);
      playerBullets.splice(i, 1);
    }
  }

  // Update enemy bullets
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const bullet = enemyBullets[i];
    bullet.update();

    if (bullet.isOffScreen()) {
      console.log(
        `➖ Removing enemy bullet (off-screen): ${bullet.owner} at (${Math.round(bullet.x)}, ${Math.round(bullet.y)}) - Remaining: ${enemyBullets.length - 1}`
      );
      Bullet.release(bullet);
      enemyBullets.splice(i, 1);
    }
  }
}

function updateBombs() {
  // Kept as compatibility wrapper while call sites migrate.
  updateBombSystem({
    activeBombs,
    enemies,
    player: window.player,
    explosionManager,
    audio: window.audio,
    cameraSystem: window.cameraSystem,
    gameState: window.gameState,
    collisionSystem: window.collisionSystem,
  });
}

// --- p5.js instance mode initialization for ES module compatibility ---
// This ensures setup() and draw() are registered and the canvas is created.
new window.p5((p) => {
  p.setup = () => setup(p);
  p.draw = () => draw(p);
});

// --- Audio/Canvas Unlock Handler for Modern Browsers ---
function unlockAudioAndShowCanvas() {
  // Resume p5.js audio context if present
  if (typeof getAudioContext === 'function') {
    getAudioContext().resume();
  }
  // Resume your own audio context
  if (window.audio && typeof window.audio.ensureAudioContext === 'function') {
    window.audio.ensureAudioContext();
  }
  // Start the procedural beat track
  if (window.beatTrack && !window.beatTrack.isPlaying) {
    window.beatTrack.start();
  }
  // Try to show the canvas if hidden
  const canvas = document.querySelector('canvas');
  if (canvas && canvas.style.visibility === 'hidden') {
    canvas.style.visibility = 'visible';
    canvas.removeAttribute('data-hidden');
  }
  // Remove this handler after first use
  window.removeEventListener('pointerdown', unlockAudioAndShowCanvas);
  window.removeEventListener('keydown', unlockAudioAndShowCanvas);
}
window.addEventListener('pointerdown', unlockAudioAndShowCanvas);
window.addEventListener('keydown', unlockAudioAndShowCanvas);
