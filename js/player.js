// Requires p5.js for global utility functions: constrain(), random(), lerp(), etc.
// Requires p5.js in instance mode: all p5 functions/vars must use the 'p' parameter (e.g., p.ellipse, p.fill)
import { CONFIG } from './config.js';
import { Bullet } from './bullet.js';
import { max, atan2 } from './mathUtils.js';

const WORLD_WIDTH = CONFIG.GAME_SETTINGS.WORLD_WIDTH;
const WORLD_HEIGHT = CONFIG.GAME_SETTINGS.WORLD_HEIGHT;

export class Player {
    constructor(p, x, y) {
        this.p = p;
        this.x = x;
        this.y = y;
        this.size = 32;
        this.health = 100;
        this.maxHealth = 100;
        this.speed = 3;
        
        // Movement
        this.velocity = { x: 0, y: 0 };
        this.isMoving = false;
        this.animFrame = 0;
        
        // Shooting
        this.aimAngle = 0;
        this.shootCooldownMs = 0;
        this.muzzleFlash = 0;
        this.queuedShot = null;
        this.wantsToContinueShooting = false;
        
        // NEW: Improved shooting system state
        this.isCurrentlyShooting = false;
        this.firstShotFired = false;
        
        // Dash ability
        this.isDashing = false;
        this.dashVelocity = { x: 0, y: 0 };
        this.dashTimerMs = 0; // ms
        this.maxDashTimeMs = 300; // ms (was 12 frames)
        this.dashSpeed = 8;
        this.dashCooldownMs = 0; // ms
        this.maxDashCooldownMs = 3000; // ms (was 180 frames)
        
        // Visual colors with better contrast
        this.vestColor = this.p.color(70, 130, 180);    // Steel blue vest
        this.pantsColor = this.p.color(25, 25, 112);    // Midnight blue pants
        this.skinColor = this.p.color(255, 219, 172);   // Peach skin
        this.gunColor = this.p.color(169, 169, 169);    // Dark gray gun
        this.bandanaColor = this.p.color(139, 69, 19);  // Brown bandana

        // Speech is now handled by unified Audio system
    }
    
    update(deltaTimeMs) {
        // Log the current game state for debugging
        if (window.gameState && window.gameState.gameState) {
            console.log('[STATE] gameState:', window.gameState.gameState);
        }
        
        // Handle movement
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.isMoving = false;
        
        if (this.p.keyIsDown(87)) { // W
            this.velocity.y = -this.speed;
            this.isMoving = true;
        }
        if (this.p.keyIsDown(83)) { // S
            this.velocity.y = this.speed;
            this.isMoving = true;
        }
        if (this.p.keyIsDown(65)) { // A
            this.velocity.x = -this.speed;
            this.isMoving = true;
        }
        if (this.p.keyIsDown(68)) { // D
            this.velocity.x = this.speed;
            this.isMoving = true;
        }
        
        // Normalize diagonal movement
        if (this.velocity.x !== 0 && this.velocity.y !== 0) {
            this.velocity.x *= 0.707;
            this.velocity.y *= 0.707;
        }
        
        // Apply movement (normal or dash)
        if (this.isDashing) {
            // Apply dash movement scaled by elapsed time (same baseline as walking)
            const dt = deltaTimeMs / 16.6667; // 60 FPS baseline
            this.x += this.dashVelocity.x * dt;
            this.y += this.dashVelocity.y * dt;
        } else {
            // Apply normal movement
    const dt = deltaTimeMs / 16.6667;   // 60 fps baseline
    this.x += this.velocity.x * dt;
    this.y += this.velocity.y * dt;
        }
        
        // Use world bounds consistent with CameraSystem.js and bullet.js
        const halfSize = this.size / 2;
        const margin = 5;
        const worldBounds = {
            left: -WORLD_WIDTH/2 + margin,
            right: WORLD_WIDTH/2 - margin,
            top: -WORLD_HEIGHT/2 + margin,
            bottom: WORLD_HEIGHT/2 - margin
        };
        this.x = this.p.constrain(this.x, worldBounds.left + halfSize, worldBounds.right - halfSize);
        this.y = this.p.constrain(this.y, worldBounds.top + halfSize, worldBounds.bottom - halfSize);
        
        // Use arrow keys for aim if any are pressed
        if (window.arrowUpPressed || window.arrowDownPressed || window.arrowLeftPressed || window.arrowRightPressed) {
            let dx = 0, dy = 0;
            if (window.arrowUpPressed) dy -= 1;
            if (window.arrowDownPressed) dy += 1;
            if (window.arrowLeftPressed) dx -= 1;
            if (window.arrowRightPressed) dx += 1;
            if (dx !== 0 || dy !== 0) {
                this.aimAngle = atan2(dy, dx);
                console.log('[AIM] Arrow keys: dx=' + dx + ', dy=' + dy + ', angle=' + (this.aimAngle * 180 / Math.PI).toFixed(1));
            }
        } else if (window.cameraSystem) {
            const worldMouse = window.cameraSystem.screenToWorld(this.p.mouseX, this.p.mouseY);
            this.aimAngle = atan2(worldMouse.y - this.y, worldMouse.x - this.x);
        } else {
            this.aimAngle = atan2(this.p.mouseY - this.y, this.p.mouseX - this.x);
        }
        
        // Update animation
        if (this.isMoving) {
            this.animFrame += 0.15;
        }
        
        // Handle dash
        if (this.isDashing) {
            this.dashTimerMs += deltaTimeMs;
            if (this.dashTimerMs >= this.maxDashTimeMs) {
                this.isDashing = false;
                this.dashTimerMs = 0;
                console.log('💨 Dash completed!');
            }
            // Skip walking animation, BUT still update combat timers below
        }
        
        // Handle queued shots
        if (this.queuedShot) {
            if (deltaTimeMs > 0) {
                this.queuedShot.timerMs -= deltaTimeMs;
            }
            
            if (this.queuedShot.timerMs <= 0) {
                // Time to fire the queued shot
                const bullet = this.fireBullet();
                if (bullet && window.playerBullets) {
                    window.playerBullets.push(bullet);
                    
                    if (window.gameState) {
                        window.gameState.addShotFired();
                    }
                    
                    // Play shooting sound with spatial audio
                    if (window.audio) {
                        window.audio.playPlayerShoot(this.x, this.y);
                    }
                    
                    console.log('🎵 Queued shot fired on beat!');
                }
                
                this.queuedShot = null; // Clear the queue
                
                // Don't immediately re-queue - let the regular shoot() call handle it
            }
        }
        
        // Reset continuous shooting flag (will be set again if mouse still pressed)
        const wasShooting = this.isCurrentlyShooting;
        this.wantsToContinueShooting = false;
        
        // If mouse is not pressed and player was shooting, reset shooting state  
        if (wasShooting && !this.p.mouseIsPressed) {
            this.isCurrentlyShooting = false;
            this.firstShotFired = false;
        }
        
        // Update timers - ENSURE cooldown always decrements
        if (this.shootCooldownMs > 0) {
            if (deltaTimeMs > 0) {
                this.shootCooldownMs -= deltaTimeMs;
                this.shootCooldownMs = max(0, this.shootCooldownMs);
            }
        }
        if (this.muzzleFlash > 0) this.muzzleFlash--;
        if (this.dashCooldownMs > 0) {
            this.dashCooldownMs -= deltaTimeMs;
            this.dashCooldownMs = max(0, this.dashCooldownMs);
        }
    }
    
    draw(p) {
        // Motion trail disabled for stability
        
        // Draw enhanced glow effect
        if (typeof drawGlow !== 'undefined') {
            try {
                const healthPercent = this.health / this.maxHealth;
                if (healthPercent > 0.7) {
                    drawGlow(p, this.x, this.y, this.size * 2, p.color(100, 200, 255), 0.6);
                } else if (healthPercent < 0.3) {
                    // Pulsing red glow when low health
                    const pulse = p.sin(p.frameCount * 0.3) * 0.5 + 0.5;
                    drawGlow(p, this.x, this.y, this.size * 2.5, p.color(255, 100, 100), pulse * 0.8);
                }
            } catch (error) {
                console.log('⚠️ Player glow error:', error);
            }
        }
        
        p.push();
        p.translate(this.x, this.y);
        p.rotate(this.aimAngle);
        
        const s = this.size;
        const walkBob = this.isMoving ? p.sin(this.animFrame) * 2 : 0;
        
        // Body bob
        p.translate(0, walkBob);
        
        // Draw legs (behind body) - ensure they're always visible
        p.fill(this.pantsColor);
        p.noStroke();
        
        // Reset any potential rendering state issues that might hide legs
        p.blendMode(p.BLEND);
        
        // Animated leg positions for walking
        const legOffset = this.isMoving ? p.sin(this.animFrame) * 3 : 0;
        // Ensure leg dimensions are always positive and visible
        const legWidth = max(s*0.15, 2);  // Minimum width of 2 pixels
        const legHeight = max(s*0.35, 8); // Minimum height of 8 pixels
        
        p.rect(-s*0.25, s*0.1 - legOffset, legWidth, legHeight); // Left leg
        p.rect(s*0.1, s*0.1 + legOffset, legWidth, legHeight);   // Right leg
        
        // Draw main body with better visibility
        p.fill(this.vestColor);
        p.stroke(255, 255, 255, 100); // Light outline for clarity
        p.strokeWeight(1);
        p.rect(-s*0.3, -s*0.1, s*0.6, s*0.4);
        p.noStroke();
        
        // Draw arms
        p.fill(this.skinColor);
        
        // Left arm (animated)
        p.push();
        p.translate(-s*0.25, 0);
        p.rotate(this.isMoving ? p.sin(this.animFrame) * 0.3 : 0);
        p.rect(-s*0.06, 0, s*0.12, s*0.25);
        p.pop();
        
        // Right arm (gun arm - steady)
        p.rect(s*0.2, -s*0.02, s*0.12, s*0.25);
        
        // Draw gun
        p.fill(this.gunColor);
        p.rect(s*0.25, -s*0.04, s*0.4, s*0.08);
        
        // Gun barrel
        p.fill(60);
        p.rect(s*0.65, -s*0.025, s*0.12, s*0.05);
        
        // Enhanced muzzle flash with glow
        if (this.muzzleFlash > 0) {
            const flashSize = this.muzzleFlash * 0.4;
            const flashIntensity = this.muzzleFlash / 10;
            
            // Outer glow
            p.push();
            p.blendMode(p.ADD);
            p.fill(255, 255, 100, 100 * flashIntensity);
            p.noStroke();
            p.ellipse(s*0.8, 0, flashSize * 2);
            
            // Inner flash
            p.fill(255, 255, 200, 200 * flashIntensity);
            p.ellipse(s*0.8, 0, flashSize);
            
            // Core
            p.fill(255, 255, 255, 255 * flashIntensity);
            p.ellipse(s*0.8, 0, flashSize * 0.4);
            p.blendMode(p.BLEND);
            p.pop();
        }
        
        // Draw head
        p.fill(this.skinColor);
        p.ellipse(0, -s*0.25, s*0.3);
        
        // Draw bandana
        p.fill(this.bandanaColor);
        p.rect(-s*0.15, -s*0.35, s*0.3, s*0.08);
        
        // Bandana tails
        p.rect(-s*0.12, -s*0.27, s*0.04, s*0.15);
        p.rect(s*0.08, -s*0.25, s*0.04, s*0.12);
        
        // Add cosmic glow effect when healthy
        if (this.health > this.maxHealth * 0.7) {
            p.fill(64, 224, 208, 40); // Turquoise glow
            p.noStroke();
            p.ellipse(0, 0, s * 1.8);
        }
        
        // Add warning glow when low health
        if (this.health < this.maxHealth * 0.3) {
            const pulse = p.sin(p.frameCount * 0.3) * 0.5 + 0.5;
            p.fill(255, 20, 147, pulse * 60); // Deep pink warning
            p.noStroke();
            p.ellipse(0, 0, s * 2.2);
        }
        
        // Enhanced dash effect
        if (this.isDashing) {
            const dashProgress = this.dashTimerMs / this.maxDashTimeMs;
            const dashIntensity = 1 - dashProgress; // Fade out over dash duration
            
            // Multiple layered dash trail effects
            // Outer glow
            p.fill(100, 200, 255, dashIntensity * 80); // Cyan outer glow
            p.noStroke();
            p.ellipse(0, 0, s * 4 * dashIntensity);
            
            // Middle trail
            p.fill(150, 220, 255, dashIntensity * 120); // Brighter cyan
            p.ellipse(0, 0, s * 2.5 * dashIntensity);
            
            // Inner core
            p.fill(200, 240, 255, dashIntensity * 160); // Almost white core
            p.ellipse(0, 0, s * 1.5 * dashIntensity);
            
            // Enhanced speed lines with multiple layers
            for (let layer = 0; layer < 3; layer++) {
                p.stroke(255, 255, 255, dashIntensity * (120 - layer * 30));
                p.strokeWeight(3 - layer);
                for (let i = 0; i < 8; i++) {
                    const lineLength = s * (1.5 + i * 0.4 + layer * 0.3);
                    const lineAngle = atan2(-this.dashVelocity.y, -this.dashVelocity.x) + p.random(-0.3, 0.3);
                    const startX = p.cos(lineAngle) * lineLength * (0.3 + layer * 0.2);
                    const startY = p.sin(lineAngle) * lineLength * (0.3 + layer * 0.2);
                    const endX = p.cos(lineAngle) * lineLength;
                    const endY = p.sin(lineAngle) * lineLength;
                    p.line(startX, startY, endX, endY);
                }
            }
            
            // Particle burst effect
            for (let i = 0; i < 12; i++) {
                const particleAngle = (i / 12) * TWO_PI;
                const particleDistance = s * 2 * dashIntensity;
                const particleX = p.cos(particleAngle) * particleDistance;
                const particleY = p.sin(particleAngle) * particleDistance;
                
                p.fill(100 + i * 10, 200, 255, dashIntensity * 100);
                p.noStroke();
                p.ellipse(particleX, particleY, 4 * dashIntensity, 4 * dashIntensity);
            }
            
            // Energy distortion rings
            for (let ring = 0; ring < 3; ring++) {
                const ringSize = s * (2 + ring * 0.8) * dashIntensity;
                const ringAlpha = dashIntensity * (60 - ring * 15);
                
                p.stroke(150, 220, 255, ringAlpha);
                p.strokeWeight(2);
                p.noFill();
                p.ellipse(0, 0, ringSize, ringSize);
            }
            
            p.noStroke();
        }
        
        // Health bar above player (drawn relative to player)
        this.drawHealthBar(p);
        
        p.pop();
        
        // Speech is now handled by the unified Audio system
    }
    
    drawHealthBar(p) {
        const barWidth = this.size * 1.2;
        const barHeight = 4;
        const yOffset = -this.size * 0.8;
        
        // Background
        p.fill(60);
        p.noStroke();
        p.rect(-barWidth/2, yOffset, barWidth, barHeight);
        
        // Health
        const healthPercent = this.health / this.maxHealth;
        p.fill(healthPercent > 0.5 ? this.p.color(100, 200, 100) : 
             healthPercent > 0.25 ? this.p.color(255, 255, 100) : 
             this.p.color(255, 100, 100));
        p.rect(-barWidth/2, yOffset, barWidth * healthPercent, barHeight);
    }
    
    shoot() {
        // IMPROVED SHOOTING SYSTEM: First shot immediate, continuous fire on quarter-beats
        this.wantsToContinueShooting = true; // Player wants to shoot
        
        // Check if this is the start of shooting (first shot)
        if (!this.isCurrentlyShooting) {
            this.isCurrentlyShooting = true;
            this.firstShotFired = false;
        }
        
        if (this.shootCooldownMs <= 0) {
            // First shot is always immediate for responsive feel
            if (!this.firstShotFired) {
                this.firstShotFired = true;
                return this.fireBullet();
            }
            
            // Subsequent shots follow quarter-beat timing for musical flow
            if (window.beatClock) {
                // Check for quarter-beat timing (4x faster than full beats)
                if (window.beatClock.canPlayerShootQuarterBeat()) {
                    return this.fireBullet();
                } else if (!this.queuedShot) {
                    // Queue shot for next quarter-beat if not already queued
                    const timeToNext = window.beatClock.getTimeToNextQuarterBeat();
                    this.queueShot(timeToNext);
                    return null;
                }
            } else {
                // No beat clock available, fire with normal cooldown (fallback)
                return this.fireBullet();
            }
        }
        return null;
    }
    
    fireBullet() {
        this.shootCooldownMs = 17; // At least one frame at 60fps (was 5)
        this.muzzleFlash = 4;
        
        // Calculate bullet spawn position
        const bulletDistance = this.size * 0.8;
        const bulletX = this.x + this.p.cos(this.aimAngle) * bulletDistance;
        const bulletY = this.y + this.p.sin(this.aimAngle) * bulletDistance;
        
        return new Bullet(bulletX, bulletY, this.aimAngle, 8, 'player');
    }
    
    queueShot(timeToNextBeat) {
        // Queue shot for next beat - allow re-queuing if no shot is currently queued
        if (!this.queuedShot) {
            this.queuedShot = {
                timerMs: timeToNextBeat, // Store milliseconds directly
                aimAngle: this.aimAngle // Store current aim angle
            };
            console.log(`🎵 Shot queued for next beat in ${this.queuedShot.timerMs.toFixed(2)} ms`);
        }
    }
    
    dash() {
        // Can only dash if not on cooldown and not already dashing
        if (this.dashCooldownMs > 0 || this.isDashing) {
            return false;
        }
        
        // Determine dash direction based on current movement
        let dashDirX = 0;
        let dashDirY = 0;
        
        if (this.p.keyIsDown(87)) dashDirY = -1; // W
        if (this.p.keyIsDown(83)) dashDirY = 1;  // S
        if (this.p.keyIsDown(65)) dashDirX = -1; // A
        if (this.p.keyIsDown(68)) dashDirX = 1;  // D
        
        // If no movement keys, dash away from mouse (emergency escape)
        if (dashDirX === 0 && dashDirY === 0) {
            const mouseAngle = atan2(this.p.mouseY - this.y, this.p.mouseX - this.x);
            dashDirX = -this.p.cos(mouseAngle); // Opposite direction from mouse
            dashDirY = -this.p.sin(mouseAngle);
        }
        
        // Normalize diagonal dashes
        if (dashDirX !== 0 && dashDirY !== 0) {
            dashDirX *= 0.707;
            dashDirY *= 0.707;
        }
        
        // Set dash velocity
        this.dashVelocity = {
            x: dashDirX * this.dashSpeed,
            y: dashDirY * this.dashSpeed
        };
        
        // Start dash
        this.isDashing = true;
        this.dashTimerMs = 0;
        this.dashCooldownMs = this.maxDashCooldownMs;
        
        console.log(`💨 Player dashed! Direction: (${dashDirX.toFixed(2)}, ${dashDirY.toFixed(2)})`);
        return true;
    }
    
    takeDamage(amount, damageSource = 'unknown') {
        console.log(`🩸 PLAYER DAMAGE: ${amount} HP from ${damageSource} (Health: ${this.health} → ${this.health - amount})`);
        
        this.health -= amount;
        
        // Only trigger speech if game is still playing and audio system is available
        if (window.gameState && window.gameState.gameState === 'playing' && window.audio) {
            const context = this.health <= 0 ? 'death' : 
                           this.health < this.maxHealth * 0.3 ? 'lowHealth' : 'damage';
            if (window.audio.speakPlayerLine(this, context)) {
                console.log(`🎤 Player damage reaction triggered`);
            }
        }
        
        if (this.health <= 0) {
            this.health = 0;
            console.log(`💀 PLAYER KILLED by ${damageSource}!`);
            return true; // Player died
        }
        return false;
    }
    
    checkCollision(other) {
        const distance = this.p.dist(this.x, this.y, other.x, other.y);
        return distance < (this.size + other.size) * 0.5;
    }
} 