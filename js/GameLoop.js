/**
 * GameLoop.js - Core game loop and coordination between all systems
 * 
 * Musical combat system where all actions sync to beats:
 * - Player = Hi-hat (every beat)
 * - Grunts = Snare (beats 2 & 4) 
 * - Tanks = Bass drum (beat 1)
 * - Stabbers = Off-beat accent (beat 3.5)
 */

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
window.playerBullets = [];
window.enemyBullets = [];
window.activeBombs = [];
window.explosionManager = null;
window.audio = null;
window.audioManager = null;
window.speechManager = null;

function setup() {
    createCanvas(800, 600);
    
    // Initialize player at center
    player = new Player(width/2, height/2);
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
    audio = new Audio();
    window.audio = audio;
    window.audioManager = audio;
    window.speechManager = audio; // Backward compatibility
    console.log('🎵 Unified audio system initialized');
    
    // Initialize modular systems
    if (!window.gameState) {
        window.gameState = new GameState();
    }
    
    if (!window.cameraSystem) {
        window.cameraSystem = new CameraSystem();
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
        window.backgroundRenderer = new BackgroundRenderer();
    }
    window.backgroundRenderer.createParallaxBackground();
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
    
    // Initial enemy spawn
    if (window.spawnSystem) {
        window.spawnSystem.spawnEnemies(1);
    }
    
    console.log('🎮 Game setup complete - all systems initialized');
}

function draw() {
    // Draw background using BackgroundRenderer
    if (window.backgroundRenderer) {
        window.backgroundRenderer.drawCosmicAuroraBackground();
        window.backgroundRenderer.drawEnhancedSpaceElements();
    }
    
    // Draw parallax background
    if (window.backgroundRenderer) {
        window.backgroundRenderer.drawParallaxBackground();
        
        if (window.gameState && window.gameState.gameState === 'playing') {
            window.backgroundRenderer.drawInteractiveBackgroundEffects();
        }
    }
    
    // Main game logic based on state
    if (window.gameState) {
        switch (window.gameState.gameState) {
            case 'playing':
                updateGame();
                drawGame();
                if (window.uiRenderer) {
                    window.uiRenderer.updateUI();
                }
                break;
                
            case 'paused':
                drawGame(); // Draw game in background
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
        window.uiRenderer.drawUI();
    }
}

function updateGame() {
    // Test mode - automated movement and shooting
    if (window.testModeManager && window.testModeManager.enabled) {
        window.testModeManager.update();
    }
    
    // Update player
    if (player) {
        player.update();
    }
    
    // Update camera for parallax effect
    if (window.cameraSystem) {
        if (typeof window.cameraSystem.update === 'function') {
            window.cameraSystem.update();
        } else {
            console.warn('⚠️ Camera update method not found');
        }
    }
    
    // Handle shooting with beat quantization
    if (mouseIsPressed && player) {
        const bullet = player.shoot();
        if (bullet) {
            // Immediate shot (on or near beat)
            playerBullets.push(bullet);
            
            if (window.gameState) {
                window.gameState.addShotFired();
            }
            
            // Play shooting sound with spatial audio
            if (window.audio) {
                window.audio.playPlayerShoot(player.x, player.y);
            }
        }
    }
    
    // Update bullets
    updateBullets();
    
    // Update bombs
    updateBombs();
    
    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const bulletFromEnemy = enemy.update(player ? player.x : 400, player ? player.y : 300);
        
        // Handle enemy bullets
        if (bulletFromEnemy) {
            // Check if it's a proper bullet (has checkCollision method)
            if (typeof bulletFromEnemy.checkCollision === 'function') {
                enemyBullets.push(bulletFromEnemy);
                console.log(`➕ Added enemy bullet to array: ${bulletFromEnemy.owner} at (${Math.round(bulletFromEnemy.x)}, ${Math.round(bulletFromEnemy.y)}) - Total: ${enemyBullets.length}`);
            } else if (bulletFromEnemy.type === 'stabber-melee' || bulletFromEnemy.type === 'stabber-miss') {
                // Handle stabber attack objects separately
                console.log(`🗡️ Stabber attack result: ${bulletFromEnemy.type} at (${Math.round(bulletFromEnemy.x)}, ${Math.round(bulletFromEnemy.y)})`);
                // These are handled by CollisionSystem.handleStabberAttack, not as bullets
            } else {
                console.warn(`⚠️ Unknown object returned from enemy update:`, bulletFromEnemy);
            }
        }
        
        // Handle rusher explosions
        if (enemy.type === 'rusher' && enemy.exploding && enemy.explosionRadius >= enemy.maxExplosionRadius) {
            if (window.collisionSystem) {
                window.collisionSystem.handleRusherExplosion(enemy, i);
            }
        }
        
        // Handle stabber attacks
        if (enemy.type === 'stabber' && enemy.isAttacking && enemy.attackCooldown === 1) {
            if (window.collisionSystem) {
                window.collisionSystem.handleStabberAttack(enemy.currentAttack, enemy);
            }
        }
    }
    
    // Check collisions using CollisionSystem
    if (window.collisionSystem) {
        window.collisionSystem.checkBulletCollisions();
        window.collisionSystem.checkContactCollisions();
    }
    
    // Update spawn system
    if (window.spawnSystem) {
        window.spawnSystem.update();
    }
    
    // Update explosion manager
    if (explosionManager) {
        explosionManager.update();
    }
    
    // Update audio system
    if (window.audio) {
        window.audio.update();
    }
}

function drawGame() {
    // Apply camera transform for world objects
    if (window.cameraSystem) {
        window.cameraSystem.applyTransform();
    }
    
    // Draw enemies
    for (const enemy of enemies) {
        enemy.draw();
    }
    
    // Draw player
    if (player) {
        player.draw();
    }
    
    // Draw bullets
    for (const bullet of playerBullets) {
        bullet.draw();
    }
    
    for (const bullet of enemyBullets) {
        bullet.draw();
    }
    
    // Draw explosions
    if (explosionManager) {
        explosionManager.draw();
    }
    
    // Remove camera transform
    if (window.cameraSystem) {
        window.cameraSystem.removeTransform();
    }
}

function updateBullets() {
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

function updateBombs() {
    for (let i = activeBombs.length - 1; i >= 0; i--) {
        const bomb = activeBombs[i];
        bomb.timer--;
        
        if (bomb.timer <= 0) {
            // Bomb explodes
            if (explosionManager) {
                explosionManager.addRadioactiveDebris(bomb.x, bomb.y);
            }
            
            if (window.audio) {
                window.audio.playBombExplosion(bomb.x, bomb.y);
            }
            
            if (window.cameraSystem) {
                window.cameraSystem.addShake(12, 30);
            }
            
            console.log('💣 BOMB EXPLODED! Radioactive debris scattered!');
            activeBombs.splice(i, 1);
        }
    }
}

function keyPressed() {
    // Let UI renderer handle key presses first
    if (window.uiRenderer && window.uiRenderer.handleKeyPress(key)) {
        return; // UI handled the key press
    }
    
    // Handle other game-specific keys here if needed
}

// Global functions for backward compatibility
window.setup = setup;
window.draw = draw;
window.keyPressed = keyPressed; 