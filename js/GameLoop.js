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
import { BeatClock } from './BeatClock.js';
import { Bullet } from './bullet.js';
import { EffectsManager } from './effects.js';
import { CONFIG } from './config.js';
import { sqrt, max, min, floor, ceil, round, random, atan2, cos, sin } from './mathUtils.js';

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

// Global system references for easy access
window.player = null;
window.enemies = [];
window.playerBullets = playerBullets;
window.enemyBullets = enemyBullets;
window.activeBombs = activeBombs;
window.explosionManager = null;
window.audio = null;
window.speechManager = null;

// Add at the top, after global system references
window.playerIsShooting = false;
window.arrowUpPressed = false;
window.arrowDownPressed = false;
window.arrowLeftPressed = false;
window.arrowRightPressed = false;

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

// Only add listeners once
if (!window.inputListenersAdded) {
  window.addEventListener('mousedown', () => { window.playerIsShooting = true; });
  window.addEventListener('mouseup', () => { window.playerIsShooting = false; });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.inputListenersAdded = true;
}

if (!window.uiKeyListenersAdded) {
  // Prevent rapid-fire for single-action UI keys (R, P, M, T, E, Space)
  window.addEventListener('keydown', (event) => {
    // Only handle on initial keydown, not auto-repeat
    if (!event.repeat) {
      const singleActionKeys = ['r', 'R', 'p', 'P', 'm', 'M', 't', 'T', 'e', 'E', ' '];
      if (singleActionKeys.includes(event.key) && window.uiRenderer) {
        window.uiRenderer.handleKeyPress(event.key);
      }
    }
  });
  window.uiKeyListenersAdded = true;
}

function setup(p) {
    p.createCanvas(800, 600);
    
    // Initialize player at center
    player = new Player(p, p.width/2, p.height/2);
    window.player = player;
    
    // Initialize global arrays
    window.enemies = enemies;
    window.playerBullets = playerBullets;
    window.enemyBullets = enemyBullets;
    window.activeBombs = activeBombs;
    
    // Initialize systems
    explosionManager = new ExplosionManager();
    window.explosionManager = explosionManager;
    
    // Disable visual effects for stability
    effectsManager = null;
    visualEffectsManager = null;
    console.log('🎮 Visual effects disabled - using stable rendering');
    
    // Initialize unified audio system
    audio = new Audio(p);
    window.audio = audio;
    console.log('🎵 Unified audio system initialized');
    
    // Initialize modular systems
    if (!window.gameState) {
        window.gameState = new GameState();
    }
    
    if (!window.cameraSystem) {
        window.cameraSystem = new CameraSystem(p);
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
        window.backgroundRenderer = new BackgroundRenderer(p);
    }
    window.backgroundRenderer.createParallaxBackground(p);
    console.log('🌌 Background renderer initialized');
    
    if (!window.collisionSystem) {
        window.collisionSystem = new CollisionSystem();
    }
    console.log('💥 Collision system initialized');
    
    if (!window.uiRenderer) {
        window.uiRenderer = new UIRenderer();
    }
    console.log('🖥️ UI renderer initialized');
    
    if (!window.testModeManager) {
        window.testModeManager = new TestMode();
    }
    console.log('🧪 Test mode manager initialized');
    
    // Initialize BeatClock for rhythm-locked gameplay
    if (!window.beatClock) {
        window.beatClock = new BeatClock(120); // 120 BPM default, adjust as needed
        console.log('🎵 BeatClock initialized and assigned to window.beatClock');
    }
    
    // Initial enemy spawn
    if (window.spawnSystem) {
        window.spawnSystem.spawnEnemies(1);
    }
    
    console.log('🎮 Game setup complete - all systems initialized');
}

function draw(p) {
    // Ensure global frameCount is updated for all modules and probes (p5 instance mode)
    window.frameCount = p.frameCount;
    
    // Log the current game state every frame
    if (window.DEBUG && window.gameState && window.gameState.gameState) {
        console.log('[STATE] gameState:', window.gameState.gameState);
    }
    
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
}

function updateGame(p) {
    // Update BeatClock every frame for accurate rhythm timing
    if (window.beatClock && typeof window.beatClock.update === 'function') {
        window.beatClock.update();
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
    
    // Update bombs
    updateBombs(p);
    
    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const result = enemy.update(player ? player.x : 400, player ? player.y : 300);
        
        // Handle enemy update results
        if (result) {
            if (result.type === 'rusher-explosion') {
                // Rusher exploding - handle explosion and effects
                if (window.collisionSystem) {
                    window.collisionSystem.handleRusherExplosion(result, i);
                }
                
                // Add explosion effects
                if (window.explosionManager) {
                    window.explosionManager.addExplosion(result.x, result.y, 'rusher-explosion');
                }
                
                // Add enhanced particle explosion
                if (typeof visualEffectsManager !== 'undefined' && visualEffectsManager) {
                    try {
                        visualEffectsManager.addExplosionParticles(result.x, result.y, 'rusher-explosion');
                        visualEffectsManager.triggerChromaticAberration(0.8, 45);
                        visualEffectsManager.triggerBloom(0.5, 30);
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
                console.log(`➕ Added enemy bullet to array: ${result.owner} at (${Math.round(result.x)}, ${Math.round(result.y)}) - Total: ${enemyBullets.length}`);
            } else if (result.type === 'stabber-melee' || result.type === 'stabber-miss') {
                // Handle stabber attack objects - process damage immediately
                console.log(`🗡️ Stabber attack result: ${result.type} at (${Math.round(result.x)}, ${Math.round(result.y)})`);
                
                // Process stabber damage to player
                if (result.type === 'stabber-melee' && result.playerHit && window.player) {
                    console.log(`⚔️ STABBER HIT! Player took ${result.damage} damage from stab attack`);
                    
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
                        const knockbackAngle = atan2(window.player.y - result.y, window.player.x - result.x);
                        const knockbackForce = 8;
                        window.player.velocity.x += Math.cos(knockbackAngle) * knockbackForce;
                        window.player.velocity.y += Math.sin(knockbackAngle) * knockbackForce;
                        
                        // Screen shake for dramatic effect
                        if (window.cameraSystem) {
                            window.cameraSystem.addShake(10, 20);
                        }
                        
                        // Create impact effect
                        if (window.explosionManager) {
                            window.explosionManager.addExplosion(window.player.x, window.player.y, 'hit');
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
                        const damageResult = targetEnemy.takeDamage(hit.damage, hit.angle, 'stabber');
                        
                        if (damageResult === true) {
                            // Enemy killed by friendly fire
                            console.log(`💀 ${targetEnemy.type} killed by stabber friendly fire!`);
                            
                            // Handle death effects
                            if (window.collisionSystem) {
                                window.collisionSystem.handleEnemyDeath(targetEnemy, targetEnemy.type, targetEnemy.x, targetEnemy.y);
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
                            if (window.explosionManager) {
                                window.explosionManager.addExplosion(targetEnemy.x, targetEnemy.y, 'hit');
                            }
                            if (window.audio) {
                                window.audio.playHit(targetEnemy.x, targetEnemy.y);
                            }
                            console.log(`💥 Stabber friendly fire caused ${targetEnemy.type} to explode!`);
                        } else {
                            // Enemy damaged but not killed
                            if (window.explosionManager) {
                                window.explosionManager.addExplosion(targetEnemy.x, targetEnemy.y, 'hit');
                            }
                            if (window.audio) {
                                window.audio.playHit(targetEnemy.x, targetEnemy.y);
                            }
                            console.log(`🗡️ ${targetEnemy.type} damaged by stabber friendly fire, health: ${targetEnemy.health}`);
                        }
                    }
                }
            } else {
                console.warn(`⚠️ Unknown object returned from enemy update:`, result);
            }
        }
    }
    
    // Remove enemies marked for removal after all updates
    window.enemies = window.enemies.filter(enemy => !enemy.markedForRemoval);
    
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
            handleAreaDamageEvents(damageEvents);
        }
    }
    
    // Update audio system
    if (window.audio) {
        window.audio.update();
    }
}

function drawGame(p) {
    // Debug: Log camera position and enemy count every 30 frames
    if (typeof p.frameCount !== 'undefined' && p.frameCount % 30 === 0) {
        const cam = window.cameraSystem ? { x: window.cameraSystem.x, y: window.cameraSystem.y } : { x: 0, y: 0 };
        console.log(`[DRAW GAME] camera=(${cam.x},${cam.y}) enemies=${enemies.length}`);
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
    
    // Draw speech bubbles/text (world space - with camera transform)
    if (window.audio) {
        window.audio.drawTexts(p);
    }
    
    // Remove camera transform
    if (window.cameraSystem) {
        window.cameraSystem.removeTransform();
    }
}

function handleAreaDamageEvents(damageEvents) {
    for (const event of damageEvents) {
        // Check player damage
        if (window.player) {
            const dx = event.x - window.player.x;
            const dy = event.y - window.player.y;
            const playerDistSq = dx * dx + dy * dy;
            const radiusSq = event.radius * event.radius;
            if (playerDistSq < radiusSq) {
                console.log(`☢️ Player took ${event.damage} damage from area effect at (${event.x}, ${event.y})`);
                
                if (window.audio) {
                    window.audio.playPlayerHit();
                }
                
                if (window.gameState) {
                    window.gameState.resetKillStreak(); // Reset kill streak on taking damage
                }
                
                // Apply damage
                if (window.player.takeDamage(event.damage, 'area-effect')) {
                    if (window.gameState) {
                        window.gameState.setGameState('gameOver');
                    }
                    console.log('💀 PLAYER KILLED BY AREA DAMAGE!');
                    continue;
                }
                
                // Apply knockback
                const knockbackAngle = atan2(window.player.y - event.y, window.player.x - event.x);
                const knockbackForce = 6;
                window.player.velocity.x += Math.cos(knockbackAngle) * knockbackForce;
                window.player.velocity.y += Math.sin(knockbackAngle) * knockbackForce;
                
                // Screen shake
                if (window.cameraSystem) {
                    window.cameraSystem.addShake(8, 15);
                }
            }
        }
        
        // Check enemy damage
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            const dx = event.x - enemy.x;
            const dy = event.y - enemy.y;
            const enemyDistSq = dx * dx + dy * dy;
            const radiusSq = event.radius * event.radius;
            if (enemyDistSq < radiusSq) {
                console.log(`☢️ ${enemy.type} took ${event.damage} damage from area effect`);
                
                const damageResult = enemy.takeDamage(event.damage, null, 'area');
                
                if (damageResult === true) {
                    // Enemy died from area damage
                    console.log(`💀 ${enemy.type} killed by area damage!`);
                    
                    if (window.collisionSystem) {
                        window.collisionSystem.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y);
                    }
                    
                    enemy.markedForRemoval = true;
                    
                    if (window.gameState) {
                        window.gameState.addKill();
                        window.gameState.addScore(10); // Area effect kills
                    }
                } else if (damageResult === 'exploding') {
                    // Rusher started exploding from area damage
                    if (window.explosionManager) {
                        window.explosionManager.addExplosion(enemy.x, enemy.y, 'hit');
                    }
                    if (window.audio) {
                        window.audio.playHit(enemy.x, enemy.y);
                    }
                    console.log(`💥 Area damage caused ${enemy.type} to explode!`);
                } else {
                    // Enemy damaged but not dead
                    if (window.explosionManager) {
                        window.explosionManager.addExplosion(enemy.x, enemy.y, 'hit');
                    }
                    if (window.audio) {
                        window.audio.playHit(enemy.x, enemy.y);
                    }
                }
            }
        }
    }
}

function updateBullets(p) {
    // Update player bullets
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i];
        bullet.update();
        
        if (bullet.isOffScreen()) {
            playerBullets.splice(i, 1);
        }
    }
    
    // Update enemy bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.update();
        
        if (bullet.isOffScreen()) {
            console.log(`➖ Removing enemy bullet (off-screen): ${bullet.owner} at (${Math.round(bullet.x)}, ${Math.round(bullet.y)}) - Remaining: ${enemyBullets.length - 1}`);
            enemyBullets.splice(i, 1);
        }
    }
}

function updateBombs(p) {
    for (let i = activeBombs.length - 1; i >= 0; i--) {
        const bomb = activeBombs[i];
        bomb.timer--;
        
        // Find the tank that placed this bomb to update its position
        const tank = enemies.find(e => e.id === bomb.tankId);
        if (tank) {
            bomb.x = tank.x;
            bomb.y = tank.y;
        }
        
        // Show countdown warnings
        const secondsLeft = Math.ceil(bomb.timer / 60);
        if (secondsLeft <= 3 && secondsLeft > 0 && bomb.timer % 60 === 0) {
            if (window.audio && window.audio.speak && tank) {
                window.audio.speak(tank, secondsLeft.toString(), 'player');
                console.log(`⏰ TIME BOMB COUNTDOWN: ${secondsLeft} (Tank ID: ${tank.id}) - Voice: Player`);
            }
        }
        
        if (bomb.timer <= 0) {
            // BOMB EXPLODES!
            console.log(`💥 TANK TIME BOMB EXPLODED! Massive damage at (${bomb.x}, ${bomb.y})`);
            
            // Create massive explosion effects
            if (explosionManager) {
                explosionManager.addExplosion(bomb.x, bomb.y, 'tank-plasma');
                explosionManager.addRadioactiveDebris(bomb.x, bomb.y);
                explosionManager.addPlasmaCloud(bomb.x, bomb.y);
            }
            
            if (window.audio) {
                window.audio.playBombExplosion(bomb.x, bomb.y);
            }
            
            if (window.cameraSystem) {
                window.cameraSystem.addShake(20, 40); // Massive screen shake
            }
            
            // Apply massive damage to everything in explosion radius
            const explosionRadius = 250; // Large damage radius
            const explosionRadiusSq = explosionRadius * explosionRadius;
            
            // Damage player if in range
            if (window.player) {
                const dx = bomb.x - window.player.x;
                const dy = bomb.y - window.player.y;
                const playerDistSq = dx * dx + dy * dy;
                if (playerDistSq < explosionRadiusSq) {
                    const playerDistance = Math.sqrt(playerDistSq); // Only for proportional damage
                    const damage = Math.max(10, Math.floor(40 * (1 - playerDistance / explosionRadius)));
                    console.log(`💥 Player took ${damage} bomb damage! Distance: ${playerDistance.toFixed(1)}`);
                    
                    if (window.audio) {
                        window.audio.playPlayerHit();
                    }
                    
                    if (window.gameState) {
                        window.gameState.resetKillStreak();
                    }
                    
                    if (window.player.takeDamage(damage, 'tank-bomb')) {
                        if (window.gameState) {
                            window.gameState.setGameState('gameOver');
                        }
                        console.log('💀 PLAYER KILLED BY TANK BOMB!');
                    } else {
                        // Apply massive knockback
                        const knockbackAngle = atan2(window.player.y - bomb.y, window.player.x - bomb.x);
                        const knockbackForce = 15;
                        window.player.velocity.x += Math.cos(knockbackAngle) * knockbackForce;
                        window.player.velocity.y += Math.sin(knockbackAngle) * knockbackForce;
                    }
                }
            }
            
            // Damage enemies in range (including the tank that placed the bomb)
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                const dx = bomb.x - enemy.x;
                const dy = bomb.y - enemy.y;
                const enemyDistSq = dx * dx + dy * dy;
                if (enemyDistSq < explosionRadiusSq) {
                    const enemyDistance = Math.sqrt(enemyDistSq); // Only for proportional damage
                    const damage = Math.max(5, Math.floor(30 * (1 - enemyDistance / explosionRadius)));
                    const damageResult = enemy.takeDamage(damage, null, 'bomb');
                    
                    if (damageResult === true) {
                        // Enemy killed by bomb
                        console.log(`💥 ${enemy.type} destroyed by tank bomb explosion!`);
                        
                        // Special message if the tank destroyed itself
                        if (enemy.id === bomb.tankId) {
                            console.log(`💀 TANK DESTROYED BY TIME BOMB! Self-destruction!`);
                        }
                        
                        if (window.collisionSystem) {
                            window.collisionSystem.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y);
                        }
                        
                        enemies.splice(j, 1);
                        
                        if (window.gameState) {
                            window.gameState.addKill();
                            window.gameState.addScore(20); // Bomb kills worth more points
                        }
                    } else if (damageResult === 'exploding') {
                        // Rusher started exploding from bomb
                        if (window.explosionManager) {
                            window.explosionManager.addExplosion(enemy.x, enemy.y, 'hit');
                        }
                        console.log(`💥 Stabber friendly fire caused ${enemy.type} to explode!`);
                    }
                }
            }
        }
    }
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