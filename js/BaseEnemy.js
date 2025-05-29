/**
 * BaseEnemy class - Contains shared functionality for all enemy types
 * Handles position, health, basic movement, common rendering, and speech systems
 */
class BaseEnemy {
    constructor(x, y, type, config) {
        // Core properties
        this.x = x;
        this.y = y;
        this.type = type;
        this.id = Math.random().toString(36).substr(2, 9); // Unique ID for each enemy
        
        // Configuration from type-specific configs
        this.size = config.size;
        this.health = config.health;
        this.maxHealth = config.health;
        this.speed = config.speed;
        this.bodyColor = config.color;
        
        // Movement and animation
        this.velocity = { x: 0, y: 0 };
        this.aimAngle = 0;
        this.animFrame = random(0, TWO_PI);
        
        // Combat
        this.shootCooldown = 0;
        this.muzzleFlash = 0;
        this.hitFlash = 0;
        
        // Speech bubble system
        this.speechText = '';
        this.speechTimer = 0;
        this.maxSpeechTime = 180; // 3 seconds - better sync with TTS
        
        // Speech cooldowns for different enemy types
        this.speechCooldown = 0;
        this.maxSpeechCooldown = 600; // 10 seconds between speeches
        
        // Random speech timer for ambient chatter
        this.ambientSpeechTimer = random(120, 600); // 2-10 seconds for first speech
        
        // Initialize type-specific colors
        this.initializeColors();
    }
    
    /**
     * Initialize cosmic aurora colors for each enemy type
     */
    initializeColors() {
        if (this.type === 'rusher') {
            this.skinColor = color(255, 105, 180);   // Hot pink skin
            this.helmetColor = color(139, 0, 139);   // Dark magenta helmet
            this.weaponColor = color(255, 20, 147);  // Deep pink claws
            this.eyeColor = color(255, 215, 0);      // Gold eyes (feral)
        } else if (this.type === 'tank') {
            this.skinColor = color(123, 104, 238);   // Medium slate blue skin
            this.helmetColor = color(72, 61, 139);   // Dark slate blue helmet
            this.weaponColor = color(138, 43, 226);  // Blue violet weapon
            this.eyeColor = color(0, 191, 255);      // Deep sky blue eyes (tech)
        } else if (this.type === 'stabber') {
            this.skinColor = color(255, 215, 0);     // Gold skin - stunning against cosmic background
            this.helmetColor = color(218, 165, 32);  // Goldenrod helmet  
            this.weaponColor = color(255, 255, 224); // Light yellow laser knife
            this.eyeColor = color(255, 69, 0);       // Red orange eyes (deadly)
        } else {
            // Grunt colors - lime green theme
            this.skinColor = color(50, 205, 50);     // Lime green skin
            this.helmetColor = color(34, 139, 34);   // Forest green helmet
            this.weaponColor = color(0, 255, 127);   // Spring green weapon
            this.eyeColor = color(255, 20, 147);     // Deep pink eyes (contrast)
        }
    }
    
    /**
     * Basic movement update - should be overridden by subclasses for specific AI
     */
    update(playerX, playerY) {
        // Update animation frame
        this.animFrame += 0.1;
        
        // Decrease cooldowns
        if (this.shootCooldown > 0) this.shootCooldown--;
        if (this.hitFlash > 0) this.hitFlash--;
        if (this.speechTimer > 0) this.speechTimer--;
        if (this.speechCooldown > 0) this.speechCooldown--;
        
        // Calculate basic aim angle (subclasses can override targeting)
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        if (dx !== 0 || dy !== 0) {
            this.aimAngle = atan2(dy, dx);
        }
        
        // Apply velocity
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        
        // Handle ambient speech timing
        this.updateAmbientSpeech();
        
        // Subclasses should override this method for specific behavior
        return this.updateSpecificBehavior(playerX, playerY);
    }
    
    /**
     * Handle ambient speech timing - shared across all enemy types
     */
    updateAmbientSpeech() {
        // Handle ambient speech
        if (this.ambientSpeechTimer > 0) {
            this.ambientSpeechTimer--;
        }
        
        if (this.ambientSpeechTimer <= 0 && this.speechCooldown <= 0) {
            // Trigger ambient speech
            this.triggerAmbientSpeech();
            
            // Reset timer for next speech
            this.ambientSpeechTimer = random(600, 1200); // 10-20 seconds between ambient speeches
        }
    }
    
    /**
     * Trigger ambient speech - should be overridden by subclasses
     */
    triggerAmbientSpeech() {
        // Base implementation - subclasses should override
        console.log(`${this.type} making ambient noise`);
    }
    
    /**
     * Update specific behavior - must be implemented by subclasses
     */
    updateSpecificBehavior(playerX, playerY) {
        // Must be implemented by subclasses
        return null;
    }
    
    /**
     * Enhanced glow effects with speech indicators
     */
    drawGlow() {
        if (typeof drawGlow !== 'undefined') {
            try {
                // Check if currently speaking (has active speech timer)
                const isSpeaking = this.speechTimer > 0;
                const speechGlowIntensity = isSpeaking ? 0.8 : 0.3;
                const speechGlowSize = isSpeaking ? 1.3 : 1.0;
                
                // Get type-specific glow color
                const glowColor = this.getGlowColor(isSpeaking);
                const glowSize = this.getGlowSize() * speechGlowSize;
                
                drawGlow(this.x, this.y, glowSize, glowColor, speechGlowIntensity);
                
                // Add extra pulsing glow for aggressive speech
                if (isSpeaking && window.audioManager) {
                    const activeTexts = window.audioManager.activeTexts || [];
                    const myText = activeTexts.find(text => text.entity === this);
                    if (myText && myText.isAggressive) {
                        const aggressivePulse = sin(frameCount * 0.8) * 0.3 + 0.5;
                        drawGlow(this.x, this.y, this.size * 2, color(255, 0, 0), aggressivePulse * 0.6);
                    }
                }
            } catch (error) {
                console.log('⚠️ Enemy glow error:', error);
            }
        }
    }
    
    /**
     * Get glow color for this enemy type - can be overridden by subclasses
     */
    getGlowColor(isSpeaking) {
        if (this.type === 'tank') {
            return isSpeaking ? color(150, 100, 255) : color(100, 50, 200);
        } else if (this.type === 'rusher') {
            return isSpeaking ? color(255, 150, 200) : color(255, 100, 150);
        } else if (this.type === 'stabber') {
            return isSpeaking ? color(255, 200, 50) : color(255, 140, 0);
        } else {
            // Grunt default
            return isSpeaking ? color(100, 255, 100) : color(50, 200, 50);
        }
    }
    
    /**
     * Get glow size for this enemy type
     */
    getGlowSize() {
        if (this.type === 'tank') {
            return this.size * 1.5;
        } else if (this.type === 'rusher' || this.type === 'stabber') {
            return this.size * 1.2;
        } else {
            return this.size * 1.1;
        }
    }
    
    /**
     * Draw method - handles common rendering and calls specific draw methods
     */
    draw() {
        // Draw glow effects first
        this.drawGlow();
        
        // Add motion trail for fast enemies (can be overridden)
        this.drawMotionTrail();
        
        push();
        translate(this.x, this.y);
        rotate(this.aimAngle);
        
        const s = this.size;
        let bobble = sin(this.animFrame) * 2;
        let waddle = cos(this.animFrame * 0.8) * 1.5;
        
        // Allow subclasses to modify animation
        const animationMods = this.getAnimationModifications();
        bobble += animationMods.bobble;
        waddle += animationMods.waddle;
        
        // Apply animation offsets
        translate(waddle, bobble);
        
        // Hit flash effect
        if (this.hitFlash > 0) {
            tint(255, 255, 255, 100);
            const hitIntensity = this.hitFlash / 8;
            const shakeX = random(-hitIntensity * 4, hitIntensity * 4);
            const shakeY = random(-hitIntensity * 3, hitIntensity * 3);
            translate(shakeX, shakeY);
            
            // Comical size distortion when hit
            const distortion = 1 + sin(frameCount * 2) * hitIntensity * 0.1;
            scale(distortion, 1 / distortion);
        }
        
        // Draw main body (subclasses implement specific shapes)
        this.drawBody(s);
        
        // Draw common elements
        this.drawHead(s);
        this.drawArms(s);
        this.drawWeapon(s);
        
        pop();
        
        // Draw UI elements
        this.drawHealthBar();
        this.drawSpeechBubble();
        
        // Draw type-specific indicators
        this.drawSpecificIndicators();
        
        noTint();
    }
    
    /**
     * Get animation modifications - can be overridden by subclasses
     */
    getAnimationModifications() {
        return { bobble: 0, waddle: 0 };
    }
    
    /**
     * Draw motion trail - can be overridden by subclasses
     */
    drawMotionTrail() {
        // Base implementation does nothing - subclasses can override
    }
    
    /**
     * Draw main body - must be implemented by subclasses
     */
    drawBody(s) {
        // Default body shape
        fill(this.bodyColor);
        noStroke();
        ellipse(0, 0, s, s * 0.8);
    }
    
    /**
     * Draw head
     */
    drawHead(s) {
        // Head
        fill(this.skinColor);
        ellipse(s * 0.1, -s * 0.3, s * 0.6, s * 0.5);
        
        // Helmet
        fill(this.helmetColor);
        arc(s * 0.1, -s * 0.35, s * 0.65, s * 0.4, PI, TWO_PI);
        
        // Eyes
        fill(this.eyeColor);
        ellipse(s * 0.25, -s * 0.35, s * 0.12, s * 0.08);
        ellipse(s * 0.05, -s * 0.35, s * 0.12, s * 0.08);
        
        // Eye glow
        fill(255, 255, 255, 120);
        ellipse(s * 0.27, -s * 0.36, s * 0.06, s * 0.04);
        ellipse(s * 0.07, -s * 0.36, s * 0.06, s * 0.04);
    }
    
    /**
     * Draw arms
     */
    drawArms(s) {
        // Left arm
        fill(this.skinColor);
        ellipse(-s * 0.25, s * 0.1, s * 0.2, s * 0.4);
        
        // Right arm
        ellipse(s * 0.45, s * 0.1, s * 0.2, s * 0.4);
    }
    
    /**
     * Draw weapon - can be overridden by subclasses
     */
    drawWeapon(s) {
        // Basic weapon
        fill(this.weaponColor);
        rect(s * 0.4, -s * 0.05, s * 0.3, s * 0.1);
        
        // Muzzle flash
        if (this.muzzleFlash > 0) {
            fill(255, 255, 100, this.muzzleFlash * 30);
            ellipse(s * 0.7, 0, s * 0.2, s * 0.1);
            this.muzzleFlash--;
        }
    }
    
    /**
     * Draw health bar
     */
    drawHealthBar() {
        if (this.health < this.maxHealth) {
            const barWidth = this.size * 1.2;
            const barHeight = 4;
            const barY = this.y - this.size * 0.8;
            
            // Background bar
            fill(100, 100, 100);
            rect(this.x - barWidth / 2, barY, barWidth, barHeight);
            
            // Health bar
            const healthPercent = this.health / this.maxHealth;
            const healthColor = healthPercent > 0.5 ? color(0, 255, 0) : 
                               healthPercent > 0.25 ? color(255, 255, 0) : color(255, 0, 0);
            fill(healthColor);
            rect(this.x - barWidth / 2, barY, barWidth * healthPercent, barHeight);
        }
    }
    
    /**
     * Draw speech bubble
     */
    drawSpeechBubble() {
        if (!this.speechText) return;
        
        // Simple text above head - smaller and closer
        fill(255, 255, 255);
        stroke(0, 0, 0);
        strokeWeight(1);
        textAlign(CENTER, CENTER);
        textSize(10);
        text(this.speechText, this.x, this.y - this.size - 15);
        noStroke();
    }
    
    /**
     * Draw type-specific indicators - should be overridden by subclasses
     */
    drawSpecificIndicators() {
        // Base implementation does nothing
    }
    
    /**
     * Create bullet - should be overridden by subclasses
     */
    createBullet() {
        const bulletDistance = this.size * 0.9;
        const bulletX = this.x + cos(this.aimAngle) * bulletDistance;
        const bulletY = this.y + sin(this.aimAngle) * bulletDistance;
        
        // Create bullet with enemy type information
        const bullet = new Bullet(bulletX, bulletY, this.aimAngle, 4, `enemy-${this.type}`);
        bullet.ownerId = this.id; // Use unique enemy ID to prevent self-shooting
        
        // Play alien shooting sound
        if (window.audio) {
            window.audio.playAlienShoot(this.x, this.y);
        }
        
        // DEBUG: Log bullet creation
        console.log(`🔫 ${this.type} created bullet at (${Math.round(bulletX)}, ${Math.round(bulletY)}) angle=${Math.round(this.aimAngle * 180 / Math.PI)}° owner="${bullet.owner}" ownerId="${bullet.ownerId}"`);
        
        return bullet;
    }
    
    /**
     * Take damage - handles basic damage logic
     */
    takeDamage(amount, bulletAngle = null, damageSource = null) {
        this.health -= amount;
        this.hitFlash = 8;
        
        if (this.health <= 0) {
            return true; // Enemy died
        }
        return false;
    }
    
    /**
     * Check collision with another object
     */
    checkCollision(other) {
        const distance = dist(this.x, this.y, other.x, other.y);
        return distance < (this.size + other.size) * 0.85;
    }
} 