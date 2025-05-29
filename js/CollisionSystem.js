/**
 * CollisionSystem.js - Handles all collision detection between bullets, enemies, and player
 */

class CollisionSystem {
    constructor() {
        // Collision detection settings
        this.friendlyFireEnabled = true;
    }
    
    // Main collision detection function
    checkBulletCollisions() {
        this.checkPlayerBulletsVsEnemies();
        this.checkEnemyBulletsVsPlayer();
        this.checkEnemyBulletsVsEnemies();
    }
    
    // ADD: Check contact collisions between enemies and player
    checkContactCollisions() {
        if (!window.player || !window.enemies) return;
        
        for (let i = window.enemies.length - 1; i >= 0; i--) {
            const enemy = window.enemies[i];
            
            // Check if enemy is touching player
            if (enemy.checkCollision(window.player)) {
                let damage = 0;
                let shouldPlaceBomb = false;
                
                // Different contact damage rules based on enemy type
                switch (enemy.type) {
                    case 'grunt':
                        damage = 1; // Standard contact damage for grunts
                        break;
                    case 'tank':
                        // Tanks place bombs instead of dealing direct damage
                        shouldPlaceBomb = true;
                        break;
                    case 'rusher':
                        // Rushers don't deal contact damage - only explosion damage
                        break;
                    case 'stabber':
                        // Stabbers don't deal contact damage - only melee attack damage
                        break;
                }
                
                if (damage > 0) {
                    console.log(`💥 ${enemy.type} contact damage! Damage: ${damage}`);
                    
                    if (window.audio) {
                        window.audio.playPlayerHit();
                    }
                    
                    if (window.gameState) {
                        window.gameState.resetKillStreak(); // Reset kill streak on taking damage
                    }
                    
                    if (window.player.takeDamage(damage)) {
                        if (window.gameState) {
                            window.gameState.setGameState('gameOver');
                        }
                        console.log(`💀 PLAYER DIED from ${enemy.type} contact! Game state changed to gameOver.`);
                        return;
                    }
                } else if (shouldPlaceBomb) {
                    // Tank contact - place bomb
                    console.log(`💣 Tank contact - placing bomb!`);
                    if (window.activeBombs && window.activeBombs.length < 3) { // Limit bomb count
                        window.activeBombs.push({
                            x: enemy.x,
                            y: enemy.y,
                            timer: 180 // 3 seconds at 60fps
                        });
                        console.log(`💣 Tank placed bomb at (${Math.round(enemy.x)}, ${Math.round(enemy.y)})`);
                    }
                }
            }
        }
    }
    
    // Player bullets vs enemies
    checkPlayerBulletsVsEnemies() {
        if (!window.playerBullets || !window.enemies) return;
        
        for (let i = window.playerBullets.length - 1; i >= 0; i--) {
            const bullet = window.playerBullets[i];
            
            for (let j = window.enemies.length - 1; j >= 0; j--) {
                const enemy = window.enemies[j];
                
                if (bullet.checkCollision(enemy)) {
                    console.log(`🎯 Bullet hit ${enemy.type} enemy! Health: ${enemy.health}`);
                    
                    // Store enemy type for logging
                    const enemyType = enemy.type;
                    const wasExploding = enemy.exploding;
                    
                    // Damage enemy (pass bullet angle for knockback)
                    const damageResult = enemy.takeDamage(bullet.damage, bullet.angle);
                    
                    if (damageResult === 'exploding') {
                        // Rusher started exploding - create hit effect but don't remove enemy yet
                        if (window.explosionManager) {
                            window.explosionManager.addExplosion(bullet.x, bullet.y, 'hit');
                        }
                        if (window.audio) {
                            window.audio.playHit(bullet.x, bullet.y);
                        }
                        console.log(`💥 RUSHER SHOT! Starting explosion sequence! Was already exploding: ${wasExploding}`);
                    } else if (damageResult === true) {
                        // Enemy died - create beautiful fragment explosion
                        this.handleEnemyDeath(enemy, enemyType, bullet.x, bullet.y);
                        
                        window.enemies.splice(j, 1);
                        if (window.gameState) {
                            window.gameState.addKill();
                            
                            // Calculate score with multipliers
                            let points = 10;
                            if (window.gameState.killStreak >= 5) points *= 2; // Double points for 5+ streak
                            if (window.gameState.killStreak >= 10) points *= 1.5; // 3x total for 10+ streak
                            
                            window.gameState.addScore(points);
                        }
                        console.log(`💀 ${enemyType} killed by bullet!`);
                    } else {
                        // Enemy hit but not dead - smaller effect
                        if (window.explosionManager) {
                            window.explosionManager.addExplosion(bullet.x, bullet.y, 'hit');
                        }
                        if (window.audio) {
                            window.audio.playHit(bullet.x, bullet.y);
                        }
                        console.log(`🎯 ${enemyType} damaged, health now: ${enemy.health}`);
                    }
                    
                    // Remove bullet
                    window.playerBullets.splice(i, 1);
                    break; // Important: break to avoid hitting multiple enemies with same bullet
                }
            }
        }
    }
    
    // Enemy bullets vs player
    checkEnemyBulletsVsPlayer() {
        if (!window.enemyBullets || !window.player) return;
        
        for (let i = window.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = window.enemyBullets[i];
            
            // Check player collision
            if (bullet.checkCollision(window.player)) {
                if (window.audio) {
                    window.audio.playPlayerHit();
                }
                
                if (window.gameState) {
                    window.gameState.resetKillStreak(); // Reset kill streak on taking damage
                }
                
                if (window.player.takeDamage(bullet.damage)) {
                    if (window.gameState) {
                        window.gameState.setGameState('gameOver');
                    }
                    console.log(`💀 PLAYER DIED! Game state changed to gameOver. Test mode: ${window.testMode}`);
                    return;
                }
                window.enemyBullets.splice(i, 1);
                break; // Exit loop since bullet hit player
            }
        }
    }
    
    // Enemy bullets vs enemies (friendly fire)
    checkEnemyBulletsVsEnemies() {
        if (!this.friendlyFireEnabled || !window.enemyBullets || !window.enemies) return;
        
        for (let i = window.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = window.enemyBullets[i];
            
            for (let j = window.enemies.length - 1; j >= 0; j--) {
                const enemy = window.enemies[j];
                
                // Check if bullet hits enemy (but not the one that fired it)
                if (bullet.checkCollision(enemy) && bullet.ownerId !== enemy.id) {
                    console.log(`🔥 FRIENDLY FIRE! ${bullet.type || 'Enemy'} bullet hit ${enemy.type} enemy!`);
                    
                    // Handle different bullet types
                    if (bullet.type === 'tankEnergy' || bullet.owner === 'enemy-tank') {
                        this.handleTankEnergyBallHit(bullet, enemy, i, j);
                    } else {
                        this.handleRegularEnemyBulletHit(bullet, enemy, i, j);
                    }
                    break; // Exit inner loop since bullet hit an enemy
                }
            }
        }
    }
    
    // Handle tank energy ball hitting enemy
    handleTankEnergyBallHit(bullet, enemy, bulletIndex, enemyIndex) {
        if (window.audio) {
            window.audio.playTankEnergyBall(bullet.x, bullet.y);
        }
        
        // Calculate energy cost based on enemy's remaining health
        const energyCost = (enemy.health / enemy.maxHealth) * 30;
        
        // Kill the enemy and create explosion
        this.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y, true);
        
        if (window.audio) {
            window.audio.playEnemyFrying(enemy.x, enemy.y);
            window.audio.playExplosion(enemy.x, enemy.y);
        }
        
        window.enemies.splice(enemyIndex, 1);
        
        if (window.gameState) {
            window.gameState.addKill();
            
            // Energy ball kills get bonus points
            let points = 12;
            if (window.gameState.killStreak >= 5) points *= 2;
            if (window.gameState.killStreak >= 10) points *= 1.5;
            
            window.gameState.addScore(points);
        }
        
        // Reduce bullet energy proportionally
        if (bullet.energy) {
            bullet.energy -= energyCost;
            
            // If energy depleted, remove bullet
            if (bullet.energy <= 0) {
                window.enemyBullets.splice(bulletIndex, 1);
            }
        }
    }
    
    // Handle regular enemy bullet hitting enemy
    handleRegularEnemyBulletHit(bullet, enemy, bulletIndex, enemyIndex) {
        // Determine bullet source type for tank anger tracking
        let bulletSource = 'unknown';
        if (bullet.type === 'grunt' || bullet.owner === 'enemy-grunt') {
            bulletSource = 'grunt';
        } else if (bullet.type === 'stabber' || bullet.owner === 'enemy-stabber') {
            bulletSource = 'stabber';
        } else if (bullet.type === 'tankEnergy' || bullet.owner === 'enemy-tank') {
            bulletSource = 'tank';
        }
        
        const damageResult = enemy.takeDamage(bullet.damage, bullet.angle, bulletSource);
        
        if (damageResult === 'exploding') {
            // Rusher started exploding
            if (window.explosionManager) {
                window.explosionManager.addExplosion(bullet.x, bullet.y, 'hit');
            }
            if (window.audio) {
                window.audio.playHit(bullet.x, bullet.y);
            }
            console.log(`💥 FRIENDLY FIRE caused rusher to explode!`);
        } else if (damageResult === true) {
            // Enemy died from friendly fire
            this.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y);
            
            if (window.audio) {
                window.audio.playExplosion(enemy.x, enemy.y);
            }
            
            window.enemies.splice(enemyIndex, 1);
            
            if (window.gameState) {
                window.gameState.addKill();
                window.gameState.addScore(8); // Friendly fire kills get some points
            }
            
            console.log(`💀 ${enemy.type} killed by friendly fire from ${bulletSource}!`);
        } else {
            // Enemy damaged but not dead
            if (window.explosionManager) {
                window.explosionManager.addExplosion(bullet.x, bullet.y, 'hit');
            }
            if (window.audio) {
                window.audio.playHit(bullet.x, bullet.y);
            }
            console.log(`🎯 Friendly fire damaged ${enemy.type}, health now: ${enemy.health}`);
        }
        
        // Remove bullet after hit
        console.log(`➖ Removing enemy bullet (hit enemy): ${bullet.owner} hit ${enemy.type} - Remaining: ${window.enemyBullets.length - 1}`);
        window.enemyBullets.splice(bulletIndex, 1);
    }
    
    // Handle enemy death effects
    handleEnemyDeath(enemy, enemyType, x, y, isEnergyBall = false) {
        if (!window.explosionManager || !window.audio) return;
        
        if (enemyType === 'tank') {
            // Tanks get special plasma effects + fragments
            window.explosionManager.addFragmentExplosion(x, y, enemy);
            window.explosionManager.addPlasmaCloud(x, y);
            if (window.cameraSystem) {
                window.cameraSystem.addShake(8, 15);
            }
            window.audio.playTankOhNo(x, y);
            window.audio.playExplosion(x, y);
        } else {
            // All other enemies get beautiful fragment explosions
            window.explosionManager.addFragmentExplosion(x, y, enemy);
            
            // Type-specific kill sounds ONLY (remove generic explosion)
            if (enemyType === 'grunt') {
                window.audio.playGruntPop(x, y);
            } else if (enemyType === 'stabber') {
                window.audio.playStabberOhNo(x, y);
            } else if (enemyType === 'rusher') {
                window.audio.playRusherOhNo(x, y);
            } else {
                window.audio.playEnemyOhNo(x, y);
            }
        }
    }
    
    // Handle stabber attack collision
    handleStabberAttack(attack, stabber) {
        if (!window.player) return;
        
        console.log('🗡️ Stabber executing deadly stab attack!');
        
        // Check if player is still in stab range
        const distance = Math.sqrt((window.player.x - stabber.x) ** 2 + (window.player.y - stabber.y) ** 2);
        
        if (distance <= attack.range + 10) { // Small buffer for fairness
            console.log(`⚔️ STABBER HIT! Player took ${attack.damage} damage from stab attack`);
            
            if (window.audio) {
                window.audio.playPlayerHit();
                window.audio.playStabberAttack(stabber.x, stabber.y);
            }
            
            if (window.gameState) {
                window.gameState.resetKillStreak(); // Reset kill streak on taking damage
            }
            
            // Apply damage and knockback
            if (window.player.takeDamage(attack.damage)) {
                if (window.gameState) {
                    window.gameState.setGameState('gameOver');
                }
                console.log('💀 PLAYER KILLED BY STABBER ATTACK!');
                return;
            }
            
            // Apply knockback to player
            const knockbackAngle = Math.atan2(window.player.y - stabber.y, window.player.x - stabber.x);
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
        } else {
            console.log(`🗡️ Stabber attack missed! Player distance: ${distance.toFixed(1)}, range: ${attack.range}`);
        }
    }
    
    // Handle rusher explosion collision
    handleRusherExplosion(explosion, rusherIndex) {
        if (!window.player) return;
        
        const distance = Math.sqrt((window.player.x - explosion.x) ** 2 + (window.player.y - explosion.y) ** 2);
        
        if (distance <= explosion.radius) {
            console.log(`💥 RUSHER EXPLOSION HIT PLAYER! Distance: ${distance.toFixed(1)}, Radius: ${explosion.radius}`);
            
            if (window.audio) {
                window.audio.playPlayerHit();
                window.audio.playRusherExplosion(explosion.x, explosion.y);
            }
            
            if (window.gameState) {
                window.gameState.resetKillStreak(); // Reset kill streak on taking damage
            }
            
            // Apply damage
            if (window.player.takeDamage(explosion.damage)) {
                if (window.gameState) {
                    window.gameState.setGameState('gameOver');
                }
                console.log('💀 PLAYER KILLED BY RUSHER EXPLOSION!');
                return;
            }
            
            // Apply knockback
            const knockbackAngle = Math.atan2(window.player.y - explosion.y, window.player.x - explosion.x);
            const knockbackForce = 12;
            window.player.velocity.x += Math.cos(knockbackAngle) * knockbackForce;
            window.player.velocity.y += Math.sin(knockbackAngle) * knockbackForce;
            
            // Strong screen shake
            if (window.cameraSystem) {
                window.cameraSystem.addShake(15, 25);
            }
            
            // Create impact effect
            if (window.explosionManager) {
                window.explosionManager.addExplosion(window.player.x, window.player.y, 'hit');
            }
            
            // Remove the rusher that exploded
            if (window.enemies && rusherIndex >= 0 && rusherIndex < window.enemies.length) {
                console.log(`🗑️ Removing exploded rusher at index ${rusherIndex}`);
                window.enemies.splice(rusherIndex, 1);
            }
        }
    }
    
    // Check collision between two circular objects
    checkCircularCollision(obj1, obj2, radius1 = 10, radius2 = 10) {
        const distance = Math.sqrt((obj1.x - obj2.x) ** 2 + (obj1.y - obj2.y) ** 2);
        return distance <= (radius1 + radius2);
    }
    
    // Check collision between point and circle
    checkPointCircleCollision(point, circle, radius) {
        const distance = Math.sqrt((point.x - circle.x) ** 2 + (point.y - circle.y) ** 2);
        return distance <= radius;
    }
    
    // Enable/disable friendly fire
    setFriendlyFire(enabled) {
        this.friendlyFireEnabled = enabled;
        console.log(`🔥 Friendly fire ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    // Reset collision system
    reset() {
        this.friendlyFireEnabled = true;
    }
}

// Create global collision system instance
window.collisionSystem = new CollisionSystem(); 