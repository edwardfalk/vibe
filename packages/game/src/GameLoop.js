/**
 * GameLoop.js - Core game loop and coordination between all systems
 *
 * Musical combat system where all actions sync to beats:
 * - Player = Hi-hat (every beat)
 * - Grunts = Snare (beats 2 & 4)
 * - Tanks = Bass drum (beat 1)
 * - Stabbers = Off-beat accent (beat 3.5)
 */

import { Player, EnemyFactory, Bullet } from '@vibe/entities';
import { ExplosionManager, EffectsManager } from '@vibe/fx';
import VisualEffectsManager from '@vibe/fx/visualEffects.js';
import {
  GameState,
  Audio,
  BeatClock,
  MusicManager,
  CONFIG,
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
  setRandomSeed,
} from '@vibe/core';
import {
  CameraSystem,
  SpawnSystem,
  BackgroundRenderer,
  UIRenderer,
  CollisionSystem,
  TestMode,
  BulletSystem,
  BombSystem,
  InputSystem,
} from '@vibe/systems';
// Remote console logging is dev-only; guard import for localhost
// Remote console logging removed – no ticket server in this codebase
import EffectsProfiler from '@vibe/fx/EffectsProfiler.js';
import ProfilerOverlay from '@vibe/fx/ProfilerOverlay.js';
import AdaptiveLODManager from '@vibe/fx/AdaptiveLODManager.js';

// Core game objects
let player;
let enemies = [];
let playerBullets = [];
let enemyBullets = [];
let activeBombs = [];

// Systems
let explosionManager;
let effectsManager;
let visualEffectsManager;
let audio;

// Sync local variables to window globals after restart
window.updateGameLoopLocals = function () {
  player = window.player;
  enemies = window.enemies;
  playerBullets = window.playerBullets;
  enemyBullets = window.enemyBullets;
  activeBombs = window.activeBombs;
  explosionManager = window.explosionManager;
  effectsManager = window.effectsManager;
  visualEffectsManager = window.visualEffectsManager;
  audio = window.audio;
};

// Global system references for easy access
window.player = null;
window.enemies = [];
window.playerBullets = playerBullets;
window.enemyBullets = enemyBullets;
window.activeBombs = activeBombs;
window.explosionManager = null;
window.audio = null;
// Removed unused speechManager global (was legacy TTS helper)

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

// Attach profiler overlay for global access
window.profilerOverlay = ProfilerOverlay;

// Input event handler helpers
function onKeyDown(e) {
  switch (e.code) {
    case 'Space':
      window.playerIsShooting = true;
      e.preventDefault();
      break;
    case 'ArrowUp':
      window.arrowUpPressed = true;
      e.preventDefault();
      break;
    case 'ArrowDown':
      window.arrowDownPressed = true;
      e.preventDefault();
      break;
    case 'ArrowLeft':
      window.arrowLeftPressed = true;
      e.preventDefault();
      break;
    case 'ArrowRight':
      window.arrowRightPressed = true;
      e.preventDefault();
      break;
  }
}

function onKeyUp(e) {
  switch (e.code) {
    case 'Space':
      window.playerIsShooting = false;
      e.preventDefault();
      break;
    case 'ArrowUp':
      window.arrowUpPressed = false;
      e.preventDefault();
      break;
    case 'ArrowDown':
      window.arrowDownPressed = false;
      e.preventDefault();
      break;
    case 'ArrowLeft':
      window.arrowLeftPressed = false;
      e.preventDefault();
      break;
    case 'ArrowRight':
      window.arrowRightPressed = false;
      e.preventDefault();
      break;
  }
}

// Input listeners moved to InputSystem.initialize() via InputBootstrap.js

// UI single-action key routing moved to DevShortcuts.js

// Profiler overlay toggle moved to DevShortcuts.js

export function setup(p) {
  p = p || this;
  p.createCanvas(800, 600);
  // Ensure browser TTS is initialized ASAP; Chrome sometimes requires an early call
  try {
    if (window.audio && typeof window.audio.loadVoices === 'function') {
      window.audio.loadVoices();
    } else if (window.speechSynthesis) {
      // Trigger voice enumeration
      window.speechSynthesis.getVoices();
    }
  } catch (_) {}
  // Apply deterministic seed to p5 random as well
  if (typeof p.randomSeed === 'function') {
    p.randomSeed(window.gameSeed);
  }

  // Initialize player at world origin (0,0) – camera centers world to screen
  player = new Player(p, 0, 0, window.cameraSystem);
  window.player = player;
  // Inform all systems that player reference changed (event-bus pattern)
  window.dispatchEvent(
    new CustomEvent('playerChanged', { detail: window.player })
  );

  // Initialize global arrays
  window.enemies = enemies;
  window.playerBullets = playerBullets;
  window.enemyBullets = enemyBullets;
  window.activeBombs = activeBombs;

  // Initialize systems
  explosionManager = new ExplosionManager();
  window.explosionManager = explosionManager;

  // Initialize effects systems
  effectsManager = new EffectsManager();
  window.effectsManager = effectsManager;

  if (!window.visualEffectsManager) {
    window.visualEffectsManager = new VisualEffectsManager(
      window.backgroundLayers
    );
    // Ensure visual effects system is fully initialized once p5 is ready
    window.visualEffectsManager.init(p);
  }
  console.log('✨ Visual effects enabled - full rendering active');

  // Initialize unified audio system
  if (!window.audio) {
    window.audio = new Audio(p, window.player);
  } else {
    window.audio.player = window.player;
  }
  console.log('🎵 Unified audio system initialized');

  // Initialize modular systems
  if (!window.gameState) {
    window.gameState = new GameState();
  }

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
    window.collisionSystem = new CollisionSystem();
  }
  console.log('💥 Collision system initialized');

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
    window.beatClock = new BeatClock(120); // 120 BPM default, adjust as needed
    console.log('🎵 BeatClock initialized and assigned to window.beatClock');
  }

  // Background music (kick/snare/hat) synced to BeatClock
  if (!window.musicManager) {
    window.musicManager = new MusicManager(window.audio, window.beatClock);
    console.log('🎶 Music manager initialised');
  }

  // Initial enemy spawn
  if (window.spawnSystem) {
    window.spawnSystem.spawnEnemies(1);
  }

  console.log('🎮 Game setup complete - all systems initialized');
}

export function draw(p) {
  p = p || this;
  window.draw = draw;
  // Begin profiler frame timing
  EffectsProfiler.startFrame();

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

  // ------------------ Profiler overlay (after UI) ------------------
  EffectsProfiler.endFrame();
  if (window.profilerOverlay) {
    window.profilerOverlay.draw(p);
  }

  // Adaptive LOD adjustment
  AdaptiveLODManager.update();
}

export function updateGame(p) {
  // Resync local references to globals at the start of the frame
  // so update/draw use the current live objects/arrays even if reassigned.
  player = window.player;
  enemies = window.enemies;
  playerBullets = window.playerBullets;
  enemyBullets = window.enemyBullets;

  // Update BeatClock every frame for accurate rhythm timing
  if (window.beatClock && typeof window.beatClock.update === 'function') {
    window.beatClock.update();
  }

  // Music update (beat-sync)
  if (window.musicManager) {
    window.musicManager.update();
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

  // Update bullets via modular system
  updateBullets();

  // Immediately process bullet collisions to catch hits before enemies move
  if (window.collisionSystem) {
    window.collisionSystem.checkBulletCollisions();
  }

  // Update bombs via modular system
  updateBombs();

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
        if (window.collisionSystem) {
          window.collisionSystem.handleRusherExplosion(result, i);
        }
        try {
          window.dispatchEvent(
            new CustomEvent('vfx:rusher-explosion', {
              detail: { x: result.x, y: result.y },
            })
          );
        } catch (_) {}
        if (window.audio) {
          window.audio.playExplosion(result.x, result.y);
        }
        console.log(`💥 RUSHER EXPLOSION at (${result.x}, ${result.y})!`);
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

            // Create impact effect via event bus
            try {
              window.dispatchEvent(
                new CustomEvent('vfx:enemy-hit', {
                  detail: {
                    x: window.player.x,
                    y: window.player.y,
                    type: 'stabber',
                  },
                })
              );
            } catch (_) {}
          }
        }

        // Process friendly fire damage to other enemies
        if (result.enemiesHit && result.enemiesHit.length > 0) {
          // Process hits in reverse order to avoid index issues when removing enemies
          for (let k = result.enemiesHit.length - 1; k >= 0; k--) {
            const hit = result.enemiesHit[k];
            const targetEnemy = hit.enemy;

            // Apply damage to enemy
            const damageResult = targetEnemy.takeDamage(
              hit.damage,
              hit.angle,
              'stabber'
            );

            if (damageResult === true) {
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
            } else if (damageResult === 'exploding') {
              // Rusher started exploding from friendly fire
              try {
                window.dispatchEvent(
                  new CustomEvent('vfx:enemy-hit', {
                    detail: {
                      x: targetEnemy.x,
                      y: targetEnemy.y,
                      type: targetEnemy.type,
                    },
                  })
                );
              } catch (_) {}

              if (window.audio) {
                window.audio.playHit(targetEnemy.x, targetEnemy.y);
              }
              console.log(
                `💥 Stabber friendly fire caused ${targetEnemy.type} to explode!`
              );
            } else {
              // Enemy damaged but not killed
              try {
                window.dispatchEvent(
                  new CustomEvent('vfx:enemy-hit', {
                    detail: {
                      x: targetEnemy.x,
                      y: targetEnemy.y,
                      type: targetEnemy.type,
                    },
                  })
                );
              } catch (_) {}

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

  // Explosion updates moved to core/UpdateLoop.js

  // Update effects manager
  if (effectsManager) {
    effectsManager.update();
  }

  // Update visual effects manager
  if (window.visualEffectsManager) {
    window.visualEffectsManager.updateParticles();
  }

  // Update audio system
  if (window.audio) {
    window.audio.update();
  }

  // Keep legacy local references (player/enemies/bullets/managers) in sync
  // with globals even if arrays/objects were reassigned during updates.
  if (typeof window.updateGameLoopLocals === 'function') {
    window.updateGameLoopLocals();
  }
}

export function drawGame(p) {
  // Debug: Log camera position and enemy count every 30 frames
  if (typeof p.frameCount !== 'undefined' && p.frameCount % 30 === 0) {
    const cam = window.cameraSystem
      ? { x: window.cameraSystem.x, y: window.cameraSystem.y }
      : { x: 0, y: 0 };
    console.log(
      `🎮 [DRAW GAME] camera=(${cam.x},${cam.y}) enemies=${enemies.length}`
    );
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

  // Draw effects particles (world space - with camera transform)
  if (effectsManager) {
    effectsManager.drawParticles(p);
  }

  // Draw visual effects particles (world space - with camera transform)
  if (window.visualEffectsManager) {
    window.visualEffectsManager.drawParticles(p);
  }

  // Draw speech bubbles/text (world space - with camera transform)
  if (window.audio) {
    window.audio.drawTexts(p);
  }

  // Remove camera transform
  if (window.cameraSystem) {
    window.cameraSystem.removeTransform();
  }

  // Draw screen effects (after camera transform removed)
  if (effectsManager) {
    effectsManager.drawScreenEffects(p);
  }

  if (window.visualEffectsManager) {
    window.visualEffectsManager.applyScreenEffects(p);
  }
}

// Area damage handling moved to core/EnemyOps.js

// Combat ops moved to core/CombatOps.js

// --- p5.js instance mode initialization for ES module compatibility ---
// This ensures setup() and draw() are registered and the canvas is created.
// --- Deterministic RNG Seed -----------------------------------------------
// Already set by GameLoopCore; guard to avoid double-initialization
if (typeof window.gameSeed === 'undefined') {
  const searchParams = new URLSearchParams(window.location.search);
  const _urlSeed = Number(searchParams.get('seed'));
  window.gameSeed = Number.isFinite(_urlSeed) ? _urlSeed : 1337;
  setRandomSeed(window.gameSeed);
}

// Audio/canvas unlock moved to bootstrap/AudioCanvasUnlock.js

// -----------------------------------------------------------------------------
// Activate browser-side remote logging as early as possible. This captures all
// console output (log/info/warn/error) and POSTs it to the Ticket API running
// on port 3001 where it is persisted to `.debug/` for later troubleshooting.
// -----------------------------------------------------------------------------

// Expose Player class as global for robust restart logic
window.Player = Player;

// Initialise input system once at module load
InputSystem.initialize();

// Bridge modular classes to legacy global namespace for backward compatibility (temporary during migration)
if (typeof window !== 'undefined') {
  window.ExplosionManager = ExplosionManager; // Needed by GameState.restart()
  window.EffectsManager = EffectsManager; // Needed by GameState.restart()
  window.VisualEffectsManager = VisualEffectsManager; // Needed by GameState.restart()
  // Game systems & entities referenced inside GameState.restart()
  window.Player = Player;
  window.SpawnSystem = SpawnSystem;
  window.CollisionSystem = CollisionSystem;
  window.BeatClock = BeatClock;
}

// Expose setup/draw globally only if not provided via p5 wrapper (migration guard)
if (typeof window !== 'undefined' && !window.setup && !window.draw) {
  window.setup = setup;
  window.draw = draw;
}
