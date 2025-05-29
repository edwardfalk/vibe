/**
 * Grunt class - Tactical ranged combat AI
 * Maintains tactical distance, uses friendly fire avoidance, confused personality
 */
class Grunt extends BaseEnemy {
    constructor(x, y) {
        const config = {
            size: 26,
            health: 2,
            speed: 1.2,
            color: color(50, 205, 50) // Lime green
        };
        
        super(x, y, 'grunt', config);
        
        // Grunt-specific weird noise timer (more frequent than speech)
        this.gruntNoiseTimer = random(60, 240); // 1-4 seconds for weird noises
    }
    
    /**
     * Update specific grunt behavior - tactical ranged combat
     */
    updateSpecificBehavior(playerX, playerY) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distance = sqrt(dx * dx + dy * dy);
        
        // Handle grunt weird noise timer (separate from speech)
        if (this.gruntNoiseTimer > 0) {
            this.gruntNoiseTimer--;
        }
        
        if (this.gruntNoiseTimer <= 0) {
            this.makeGruntWeirdNoise();
            this.gruntNoiseTimer = random(120, 360); // 2-6 seconds between weird noises
        }
        
        // Grunts maintain tactical distance (150-250 pixels)
        const idealDistance = 200;
        const tooClose = 150;
        const tooFar = 250;
        
        this.velocity.x = 0;
        this.velocity.y = 0;
        
        if (distance > 0) {
            const unitX = dx / distance;
            const unitY = dy / distance;
            
            if (distance < tooClose) {
                // Too close - retreat while maintaining line of sight
                this.velocity.x = -unitX * this.speed * 0.8;
                this.velocity.y = -unitY * this.speed * 0.8;
                
                // Tactical side-step 40% of the time
                if (random() < 0.4) {
                    this.velocity.x += random(-0.5, 0.5);
                    this.velocity.y += random(-0.5, 0.5);
                }
                
                // Play grunt retreat sound if beatClock available
                if (window.beatClock && window.beatClock.isOnBeat([2, 4]) && window.audio) {
                    if (random() < 0.3) { // 30% chance on beats 2&4
                        window.audio.playSound('gruntRetreat', this.x, this.y);
                    }
                }
            } else if (distance > tooFar) {
                // Too far - advance but maintain tactical spacing
                this.velocity.x = unitX * this.speed * 0.6;
                this.velocity.y = unitY * this.speed * 0.6;
                
                // Play grunt advance sound if beatClock available
                if (window.beatClock && window.beatClock.isOnBeat([2, 4]) && window.audio) {
                    if (random() < 0.25) { // 25% chance on beats 2&4
                        window.audio.playSound('gruntAdvance', this.x, this.y);
                    }
                }
            } else {
                // At ideal distance - maintain position with small movements
                this.velocity.x = random(-0.3, 0.3);
                this.velocity.y = random(-0.3, 0.3);
            }
        }
        
        // RHYTHMIC GRUNT SHOOTING: Check if grunt can shoot
        if (distance < 300 && this.shootCooldown <= 0) {
            if (window.beatClock && window.beatClock.canGruntShoot()) {
                // Check for friendly fire avoidance
                if (!this.shouldAvoidFriendlyFire()) {
                    this.shootCooldown = 45 + random(30); // Faster shooting for ranged combat
                    this.muzzleFlash = 4;
                    return this.createBullet();
                }
            }
        }
        
        return null;
    }
    
    /**
     * Check if grunt should avoid friendly fire
     */
    shouldAvoidFriendlyFire() {
        if (!window.enemies) return false;
        
        const bulletPath = {
            startX: this.x,
            startY: this.y,
            angle: this.aimAngle,
            range: 400 // Check 400 pixels ahead
        };
        
        for (const otherEnemy of window.enemies) {
            if (otherEnemy === this) continue; // Skip self
            
            // Calculate if other enemy is in the line of fire
            const dx = otherEnemy.x - this.x;
            const dy = otherEnemy.y - this.y;
            const distanceToOther = Math.sqrt(dx * dx + dy * dy);
            
            if (distanceToOther < bulletPath.range) {
                // Calculate angle to other enemy
                const angleToOther = Math.atan2(dy, dx);
                const angleDifference = Math.abs(this.aimAngle - angleToOther);
                const normalizedAngleDiff = Math.min(angleDifference, Math.PI * 2 - angleDifference);
                
                // If other enemy is within 15 degrees of aim angle, consider avoiding
                if (normalizedAngleDiff < Math.PI / 12) { // 15 degrees
                    // 70% chance to avoid shooting (grunts try to avoid but aren't perfect)
                    if (Math.random() < 0.7) {
                        console.log(`🎖️ Grunt avoiding friendly fire - ${otherEnemy.type} in line of fire`);
                        return true;
                    } else {
                        console.log(`🎖️ Grunt shooting anyway - ${otherEnemy.type} in the way but mission priority!`);
                        return false;
                    }
                }
            }
        }
        
        return false;
    }
    
    /**
     * Make weird grunt noises (separate from speech)
     */
    makeGruntWeirdNoise() {
        if (window.audio && window.beatClock) {
            // Grunt weird noises sync to beats 2&4 with 40% chance
            if (window.beatClock.isOnBeat([2, 4]) && random() < 0.4) {
                const weirdSounds = ['gruntMalfunction', 'gruntBeep', 'gruntWhir', 'gruntError', 'gruntGlitch'];
                const randomSound = weirdSounds[Math.floor(Math.random() * weirdSounds.length)];
                window.audio.playSound(randomSound, this.x, this.y);
                console.log(`🤖 Grunt making weird noise: ${randomSound}`);
            }
        }
    }
    
    /**
     * Trigger ambient speech specific to grunts
     */
    triggerAmbientSpeech() {
        if (window.audio && this.speechCooldown <= 0) {
            // Grunt ambient speech also includes 70% chance during ambient cycles
            if (window.beatClock && window.beatClock.isOnBeat([2, 4]) && random() < 0.7) {
                const gruntLines = [
                    "KILL HUMAN!", "DESTROY!", "ELIMINATE!", "ATTACK!",
                    "WAIT WHAT?", "OOPS!", "LOST!", "CONFUSED!",
                    "WIFI PASSWORD?", "MY HELMET IS TIGHT!", "I FORGOT MY LUNCH MONEY!"
                ];
                const randomLine = gruntLines[Math.floor(Math.random() * gruntLines.length)];
                window.audio.speak(this, randomLine, 'grunt');
                this.speechCooldown = this.maxSpeechCooldown;
            }
        }
    }
    
    /**
     * Draw grunt-specific body shape
     */
    drawBody(s) {
        // Standard circular body for grunts (back to original appearance)
        fill(this.bodyColor);
        noStroke();
        ellipse(0, 0, s, s * 0.8);
        
        // Add some tactical gear details
        fill(this.bodyColor.levels[0] + 30, this.bodyColor.levels[1] + 30, this.bodyColor.levels[2] + 30);
        rect(-s * 0.35, -s * 0.2, s * 0.7, s * 0.1); // Belt
        ellipse(-s * 0.225, -s * 0.225, s * 0.15, s * 0.15); // Left shoulder pad (circular)
        ellipse(s * 0.225, -s * 0.225, s * 0.15, s * 0.15); // Right shoulder pad (circular)
    }
} 