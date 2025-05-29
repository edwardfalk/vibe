class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 24;
        this.health = 100;
        this.maxHealth = 100;
        this.speed = 3;
        
        // Movement
        this.velocity = { x: 0, y: 0 };
        this.isMoving = false;
        this.animFrame = 0;
        
        // Shooting
        this.aimAngle = 0;
        this.shootCooldown = 0;
        this.muzzleFlash = 0;
        this.queuedShot = null;
        this.wantsToContinueShooting = false;
        
        // NEW: Improved shooting system state
        this.isCurrentlyShooting = false;
        this.firstShotFired = false;
        
        // Dash ability
        this.isDashing = false;
        this.dashVelocity = { x: 0, y: 0 };
        this.dashTimer = 0;
        this.maxDashTime = 12; // frames
        this.dashSpeed = 8;
        this.dashCooldown = 0;
        this.maxDashCooldown = 180; // 3 seconds at 60fps
        
        // Visual colors with better contrast
        this.vestColor = color(70, 130, 180);    // Steel blue vest
        this.pantsColor = color(25, 25, 112);    // Midnight blue pants
        this.skinColor = color(255, 219, 172);   // Peach skin
        this.gunColor = color(169, 169, 169);    // Dark gray gun
        this.bandanaColor = color(139, 69, 19);  // Brown bandana

        // Speech is now handled by unified Audio system
    }
    
    update() {
        // Handle movement
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.isMoving = false;
        
        if (keyIsDown(87)) { // W
            this.velocity.y = -this.speed;
            this.isMoving = true;
        }
        if (keyIsDown(83)) { // S
            this.velocity.y = this.speed;
            this.isMoving = true;
        }
        if (keyIsDown(65)) { // A
            this.velocity.x = -this.speed;
            this.isMoving = true;
        }
        if (keyIsDown(68)) { // D
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
            // Apply dash movement
            this.x += this.dashVelocity.x;
            this.y += this.dashVelocity.y;
        } else {
            // Apply normal movement
            this.x += this.velocity.x;
            this.y += this.velocity.y;
        }
        
        // FIXED: Improved movement bounds using world coordinates instead of viewport bounds
        // Allow movement in full world space, not just viewport
        const halfSize = this.size / 2;
        const margin = 50; // Reduced margin for cleaner edge behavior
        
        // Define world bounds (larger than viewport to allow off-screen movement)
        const WORLD_WIDTH = 1280;
        const WORLD_HEIGHT = 720;
        
        // Get world bounds - use actual world dimensions, not camera viewport bounds
        const worldBounds = {
            left: -WORLD_WIDTH/2 + margin,
            right: WORLD_WIDTH/2 - margin,
            top: -WORLD_HEIGHT/2 + margin,
            bottom: WORLD_HEIGHT/2 - margin
        };
        
        // Constrain to world bounds instead of viewport bounds
        this.x = constrain(this.x, worldBounds.left + halfSize, worldBounds.right - halfSize);
        this.y = constrain(this.y, worldBounds.top + halfSize, worldBounds.bottom - halfSize);
        
        // FIXED: Update aim angle using proper coordinate conversion
        // Convert mouse screen coordinates to world coordinates for accurate aiming
        if (window.cameraSystem) {
            const worldMouse = window.cameraSystem.screenToWorld(mouseX, mouseY);
            this.aimAngle = atan2(worldMouse.y - this.y, worldMouse.x - this.x);
        } else {
            // Fallback for when camera system not available
            this.aimAngle = atan2(mouseY - this.y, mouseX - this.x);
        }
        
        // Update animation
        if (this.isMoving) {
            this.animFrame += 0.15;
        }
        
        // Handle dash
        if (this.isDashing) {
            this.dashTimer++;
            if (this.dashTimer >= this.maxDashTime) {
                this.isDashing = false;
                this.dashTimer = 0;
                console.log('💨 Dash completed!');
            }
            // Don't apply normal movement during dash
            return;
        }
        
        // Handle queued shots
        if (this.queuedShot) {
            this.queuedShot.timer--;
            
            if (this.queuedShot.timer <= 0) {
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
        if (wasShooting && !mouseIsPressed) {
            this.isCurrentlyShooting = false;
            this.firstShotFired = false;
        }
        
        // Update timers - ENSURE cooldown always decrements
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }
        if (this.muzzleFlash > 0) this.muzzleFlash--;
        if (this.dashCooldown > 0) this.dashCooldown--;
    }
    
    draw() {
        // Motion trail disabled for stability
        
        // Draw enhanced glow effect
        if (typeof drawGlow !== 'undefined') {
            try {
                const healthPercent = this.health / this.maxHealth;
                if (healthPercent > 0.7) {
                    drawGlow(this.x, this.y, this.size * 2, color(100, 200, 255), 0.6);
                } else if (healthPercent < 0.3) {
                    // Pulsing red glow when low health
                    const pulse = sin(frameCount * 0.3) * 0.5 + 0.5;
                    drawGlow(this.x, this.y, this.size * 2.5, color(255, 100, 100), pulse * 0.8);
                }
            } catch (error) {
                console.log('⚠️ Player glow error:', error);
            }
        }
        
        push();
        translate(this.x, this.y);
        rotate(this.aimAngle);
        
        const s = this.size;
        const walkBob = this.isMoving ? sin(this.animFrame) * 2 : 0;
        
        // Body bob
        translate(0, walkBob);
        
        // Draw legs (behind body)
        fill(this.pantsColor);
        noStroke();
        
        // Animated leg positions for walking
        const legOffset = this.isMoving ? sin(this.animFrame) * 3 : 0;
        rect(-s*0.25, s*0.1 - legOffset, s*0.15, s*0.35); // Left leg
        rect(s*0.1, s*0.1 + legOffset, s*0.15, s*0.35);   // Right leg
        
        // Draw main body with better visibility
        fill(this.vestColor);
        stroke(255, 255, 255, 100); // Light outline for clarity
        strokeWeight(1);
        rect(-s*0.3, -s*0.1, s*0.6, s*0.4);
        noStroke();
        
        // Draw arms
        fill(this.skinColor);
        
        // Left arm (animated)
        push();
        translate(-s*0.25, 0);
        rotate(this.isMoving ? sin(this.animFrame) * 0.3 : 0);
        rect(-s*0.06, 0, s*0.12, s*0.25);
        pop();
        
        // Right arm (gun arm - steady)
        rect(s*0.2, -s*0.02, s*0.12, s*0.25);
        
        // Draw gun
        fill(this.gunColor);
        rect(s*0.25, -s*0.04, s*0.4, s*0.08);
        
        // Gun barrel
        fill(60);
        rect(s*0.65, -s*0.025, s*0.12, s*0.05);
        
        // Enhanced muzzle flash with glow
        if (this.muzzleFlash > 0) {
            const flashSize = this.muzzleFlash * 0.4;
            const flashIntensity = this.muzzleFlash / 10;
            
            // Outer glow
            push();
            blendMode(ADD);
            fill(255, 255, 100, 100 * flashIntensity);
            noStroke();
            ellipse(s*0.8, 0, flashSize * 2);
            
            // Inner flash
            fill(255, 255, 200, 200 * flashIntensity);
            ellipse(s*0.8, 0, flashSize);
            
            // Core
            fill(255, 255, 255, 255 * flashIntensity);
            ellipse(s*0.8, 0, flashSize * 0.4);
            blendMode(BLEND);
            pop();
        }
        
        // Draw head
        fill(this.skinColor);
        ellipse(0, -s*0.25, s*0.3);
        
        // Draw bandana
        fill(this.bandanaColor);
        rect(-s*0.15, -s*0.35, s*0.3, s*0.08);
        
        // Bandana tails
        rect(-s*0.12, -s*0.27, s*0.04, s*0.15);
        rect(s*0.08, -s*0.25, s*0.04, s*0.12);
        
        // Add cosmic glow effect when healthy
        if (this.health > this.maxHealth * 0.7) {
            fill(64, 224, 208, 40); // Turquoise glow
            noStroke();
            ellipse(0, 0, s * 1.8);
        }
        
        // Add warning glow when low health
        if (this.health < this.maxHealth * 0.3) {
            const pulse = sin(frameCount * 0.3) * 0.5 + 0.5;
            fill(255, 20, 147, pulse * 60); // Deep pink warning
            noStroke();
            ellipse(0, 0, s * 2.2);
        }
        
        // Enhanced dash effect
        if (this.isDashing) {
            const dashProgress = this.dashTimer / this.maxDashTime;
            const dashIntensity = 1 - dashProgress; // Fade out over dash duration
            
            // Multiple layered dash trail effects
            // Outer glow
            fill(100, 200, 255, dashIntensity * 80); // Cyan outer glow
            noStroke();
            ellipse(0, 0, s * 4 * dashIntensity);
            
            // Middle trail
            fill(150, 220, 255, dashIntensity * 120); // Brighter cyan
            ellipse(0, 0, s * 2.5 * dashIntensity);
            
            // Inner core
            fill(200, 240, 255, dashIntensity * 160); // Almost white core
            ellipse(0, 0, s * 1.5 * dashIntensity);
            
            // Enhanced speed lines with multiple layers
            for (let layer = 0; layer < 3; layer++) {
                stroke(255, 255, 255, dashIntensity * (120 - layer * 30));
                strokeWeight(3 - layer);
                for (let i = 0; i < 8; i++) {
                    const lineLength = s * (1.5 + i * 0.4 + layer * 0.3);
                    const lineAngle = atan2(-this.dashVelocity.y, -this.dashVelocity.x) + random(-0.3, 0.3);
                    const startX = cos(lineAngle) * lineLength * (0.3 + layer * 0.2);
                    const startY = sin(lineAngle) * lineLength * (0.3 + layer * 0.2);
                    const endX = cos(lineAngle) * lineLength;
                    const endY = sin(lineAngle) * lineLength;
                    line(startX, startY, endX, endY);
                }
            }
            
            // Particle burst effect
            for (let i = 0; i < 12; i++) {
                const particleAngle = (i / 12) * TWO_PI;
                const particleDistance = s * 2 * dashIntensity;
                const particleX = cos(particleAngle) * particleDistance;
                const particleY = sin(particleAngle) * particleDistance;
                
                fill(100 + i * 10, 200, 255, dashIntensity * 100);
                noStroke();
                ellipse(particleX, particleY, 4 * dashIntensity, 4 * dashIntensity);
            }
            
            // Energy distortion rings
            for (let ring = 0; ring < 3; ring++) {
                const ringSize = s * (2 + ring * 0.8) * dashIntensity;
                const ringAlpha = dashIntensity * (60 - ring * 15);
                
                stroke(150, 220, 255, ringAlpha);
                strokeWeight(2);
                noFill();
                ellipse(0, 0, ringSize, ringSize);
            }
            
            noStroke();
        }
        
        // Health bar above player (drawn relative to player)
        this.drawHealthBar();
        
        pop();
        
        // Speech is now handled by the unified Audio system
    }
    
    drawHealthBar() {
        const barWidth = this.size * 1.2;
        const barHeight = 4;
        const yOffset = -this.size * 0.8;
        
        // Background
        fill(60);
        noStroke();
        rect(-barWidth/2, yOffset, barWidth, barHeight);
        
        // Health
        const healthPercent = this.health / this.maxHealth;
        fill(healthPercent > 0.5 ? color(100, 200, 100) : 
             healthPercent > 0.25 ? color(255, 255, 100) : 
             color(255, 100, 100));
        rect(-barWidth/2, yOffset, barWidth * healthPercent, barHeight);
    }
    
    shoot() {
        // IMPROVED SHOOTING SYSTEM: First shot immediate, continuous fire on beat
        this.wantsToContinueShooting = true; // Player wants to shoot
        
        // Check if this is the start of shooting (first shot)
        if (!this.isCurrentlyShooting) {
            this.isCurrentlyShooting = true;
            this.firstShotFired = false;
        }
        
        if (this.shootCooldown <= 0) {
            // First shot is always immediate for responsive feel
            if (!this.firstShotFired) {
                this.firstShotFired = true;
                return this.fireBullet();
            }
            
            // Subsequent shots follow beat timing for musical flow
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
                // No beat clock available, fire immediately (fallback)
                return this.fireBullet();
            }
        }
        return null;
    }
    
    fireBullet() {
        this.shootCooldown = 8; // Reduced from 30 to 8 frames for quarter-beat timing (8 frames = ~125ms at 60fps)
        this.muzzleFlash = 4;
        
        // Calculate bullet spawn position
        const bulletDistance = this.size * 0.8;
        const bulletX = this.x + cos(this.aimAngle) * bulletDistance;
        const bulletY = this.y + sin(this.aimAngle) * bulletDistance;
        
        return new Bullet(bulletX, bulletY, this.aimAngle, 8, 'player');
    }
    
    queueShot(timeToNextBeat) {
        // Queue shot for next beat - allow re-queuing if no shot is currently queued
        if (!this.queuedShot) {
            this.queuedShot = {
                timer: Math.ceil(timeToNextBeat / (1000/60)), // Convert ms to frames
                aimAngle: this.aimAngle // Store current aim angle
            };
            console.log(`🎵 Shot queued for next beat in ${this.queuedShot.timer} frames`);
        }
    }
    
    dash() {
        // Can only dash if not on cooldown and not already dashing
        if (this.dashCooldown > 0 || this.isDashing) {
            return false;
        }
        
        // Determine dash direction based on current movement
        let dashDirX = 0;
        let dashDirY = 0;
        
        if (keyIsDown(87)) dashDirY = -1; // W
        if (keyIsDown(83)) dashDirY = 1;  // S
        if (keyIsDown(65)) dashDirX = -1; // A
        if (keyIsDown(68)) dashDirX = 1;  // D
        
        // If no movement keys, dash away from mouse (emergency escape)
        if (dashDirX === 0 && dashDirY === 0) {
            const mouseAngle = atan2(mouseY - this.y, mouseX - this.x);
            dashDirX = -cos(mouseAngle); // Opposite direction from mouse
            dashDirY = -sin(mouseAngle);
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
        this.dashTimer = 0;
        this.dashCooldown = this.maxDashCooldown;
        
        console.log(`💨 Player dashed! Direction: (${dashDirX.toFixed(2)}, ${dashDirY.toFixed(2)})`);
        return true;
    }
    
    takeDamage(amount) {
        this.health -= amount;
        
        // Only trigger speech if game is still playing and audio system is available
        if (typeof gameState !== 'undefined' && gameState === 'playing' && window.audioManager) {
            const context = this.health <= 0 ? 'death' : 
                           this.health < this.maxHealth * 0.3 ? 'lowHealth' : 'damage';
            if (window.audioManager.speakPlayerLine(this, context)) {
                console.log(`🎤 Player damage reaction triggered`);
            }
        }
        
        if (this.health <= 0) {
            this.health = 0;
            return true; // Player died
        }
        return false;
    }
    
    checkCollision(other) {
        const distance = dist(this.x, this.y, other.x, other.y);
        return distance < (this.size + other.size) * 0.5;
    }
} 