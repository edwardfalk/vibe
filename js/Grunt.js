import { BaseEnemy } from './BaseEnemy.js';
import { floor, random, sqrt, atan2, min, max } from './mathUtils.js';
import { CONFIG } from './config.js';

/**
 * Grunt class - Tactical ranged combat AI
 * Maintains tactical distance, uses friendly fire avoidance, confused personality
 */
class Grunt extends BaseEnemy {
    constructor(x, y, p) {
        const config = {
            size: 26,
            health: 2,
            speed: 1.2,
            color: p.color(50, 205, 50) // Lime green
        };
        super(x, y, 'grunt', config, p);
        this.p = p;

        // --- Deferred-death state ---------------------------------
        this.pendingStabDeath      = false; // true while "ow" delay active
        this.pendingStabDeathTimer = 0;     // frames remaining
        this._pendingStabDeathParams = null;

        // Grunt-specific weird noise timer (more frequent than speech)
        this.gruntNoiseTimer = random(60, 240);
        if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(`[GRUNT DEBUG] Spawned Grunt at (${this.x.toFixed(1)},${this.y.toFixed(1)}) with health=${this.health}`);
        }
    }
    
    /**
     * Update specific grunt behavior - tactical ranged combat
     */
    updateSpecificBehavior(playerX, playerY) {
        if (typeof frameCount !== 'undefined' && frameCount % 30 === 0 && CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(`[GRUNT AI] updateSpecificBehavior called for Grunt at (${this.x.toFixed(1)},${this.y.toFixed(1)})`);
        }
        // Handle delayed death if stabbed
        if (this.pendingStabDeath) {
            this.pendingStabDeathTimer--;
            if (this.pendingStabDeathTimer <= 0) {
                this.pendingStabDeath = false;
                // Actually die now, call super.takeDamage() once
                if (this._pendingStabDeathParams) {
                    super.takeDamage(
                        this._pendingStabDeathParams.amount,
                        this._pendingStabDeathParams.bulletAngle,
                        this._pendingStabDeathParams.damageSource
                    );
                    this._pendingStabDeathParams = null;
                }
                if (window.collisionSystem) {
                    window.collisionSystem.handleEnemyDeath(this, this.type, this.x, this.y);
                }
                // Mark for removal instead of splicing the array
                this.markedForRemoval = true;
                this.velocity.x = 0; // Ensure Grunt stops moving during delayed death
                this.velocity.y = 0;
                return null;
            }
            // While pending death, do nothing else
            this.velocity.x = 0; // Ensure Grunt stops moving during delayed death
            this.velocity.y = 0;
            return null;
        }
        
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
        
        // After movement logic
        if (typeof frameCount !== 'undefined' && frameCount % 30 === 0 && CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(`[GRUNT AI] velocity after logic: x=${this.velocity.x} y=${this.velocity.y}`);
        }
        
        return null;
    }
    
    /**
     * Check if grunt should avoid friendly fire
     */
    shouldAvoidFriendlyFire() {
        if (!window.enemies) return false;
        // Defensive: If aimAngle is not set, skip friendly fire check to avoid NaN results
        if (!this.aimAngle && this.aimAngle !== 0) return false;
        
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
            const distanceToOther = sqrt(dx * dx + dy * dy);
            
            if (distanceToOther < bulletPath.range) {
                // Calculate angle to other enemy
                const angleToOther = atan2(dy, dx);
                // Minimal angular difference (handle wrap-around)
                const angleDifference = Math.abs(angleToOther - bulletPath.angle);
                const normalizedAngleDiff = Math.min(angleDifference, Math.PI * 2 - angleDifference);
                
                // If other enemy is within 15 degrees of aim angle, consider avoiding
                if (normalizedAngleDiff < Math.PI / 12) { // 15 degrees
                    // 70% chance to avoid shooting (grunts try to avoid but aren't perfect)
                    if (random() < 0.7) {
                        if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
                            console.log(`🎖️ Grunt avoiding friendly fire - ${otherEnemy.type} in line of fire`);
                        }
                        return true;
                    } else {
                        if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
                            console.log(`🎖️ Grunt shooting anyway - ${otherEnemy.type} in the way but mission priority!`);
                        }
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
                const randomSound = weirdSounds[floor(random() * weirdSounds.length)];
                window.audio.playSound(randomSound, this.x, this.y);
                if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
                    console.log(`🤖 Grunt making weird noise: ${randomSound}`);
                }
            }
        }
    }
    
    /**
     * Trigger ambient speech specific to grunts
     */
    triggerAmbientSpeech() {
        if (window.audio && this.speechCooldown <= 0) {
            let shouldSpeak = false;
            if (window.beatClock && window.beatClock.isOnBeat([2, 4])) {
                shouldSpeak = random() < 0.9;
            } else {
                shouldSpeak = random() < 0.3;
            }
            if (shouldSpeak) {
                const gruntLines = [
                    // Threatening but confused
                    "KILL HUMAN!", "DESTROY TARGET!", "ELIMINATE!", "ATTACK MODE!",
                    "HOSTILE DETECTED!", "ENGAGE ENEMY!", "FIRE WEAPONS!", "DEATH TO HUMANS!",
                    // Confused/stupid moments  
                    "WAIT WHAT?", "I FORGOT SOMETHING!", "WHERE AM I?", "HELP!",
                    "WRONG PLANET?", "NEED BACKUP!", "LOST AGAIN!", "OOPS!",
                    "MY HELMET IS TIGHT!", "WIFI PASSWORD?", "MOMMY?", "SCARED!",
                    "IS THAT MY TARGET?", "WHICH BUTTON?", "I'M CONFUSED!"
                ];
                const randomLine = gruntLines[floor(random() * gruntLines.length)];
                if (window.audio.speak(this, randomLine, 'grunt')) {
                    this.speechCooldown = this.maxSpeechCooldown;
                }
            }
        }
    }
    
    /**
     * Draw grunt-specific body shape with round, bumbling baby-like features
     */
    drawBody(s) {
        // Main round body (baby-like proportions)
        this.p.fill(this.bodyColor);
        this.p.noStroke();
        this.p.ellipse(0, 0, s, s * 0.9); // Rounder main body
        
        // Round baby-like head (larger and rounder)
        this.p.fill(this.bodyColor.levels[0] + 20, this.bodyColor.levels[1] + 20, this.bodyColor.levels[2] + 20);
        this.p.ellipse(0, -s * 0.4, s * 0.8, s * 0.8); // Big round head
        
        // Simple round helmet (baby helmet style)
        this.p.fill(120, 120, 150); // Gray helmet color
        this.p.arc(0, -s * 0.4, s * 0.85, s * 0.5, this.p.PI, this.p.TWO_PI);
        
        // Small gold triangle badge (looks official but cute)
        this.p.fill(255, 215, 0); // Gold
        this.p.triangle(0, -s * 0.6, -s * 0.06, -s * 0.5, s * 0.06, -s * 0.5);
        
        // BIG ROUND BUMBLING EYES (different sizes for silly look)
        this.p.fill(100, 255, 100); // Bright green eyes
        this.p.ellipse(-s * 0.15, -s * 0.35, s * 0.16); // Left eye (bigger and rounder)
        this.p.ellipse(s * 0.12, -s * 0.38, s * 0.12);  // Right eye (smaller, slightly offset)
        
        // Eye highlights (make them look innocent/bumbling)
        this.p.fill(255);
        this.p.ellipse(-s * 0.12, -s * 0.32, s * 0.06); // Left highlight (bigger)
        this.p.ellipse(s * 0.15, -s * 0.36, s * 0.04);  // Right highlight (smaller)
        
        // SHORT STUMPY ANTENNAE (baby-like proportions)
        this.p.stroke(this.bodyColor);
        this.p.strokeWeight(3); // Thicker for baby look
        this.p.line(-s * 0.15, -s * 0.7, -s * 0.18, -s * 0.85); // Left antenna (shorter)
        this.p.line(s * 0.15, -s * 0.7, s * 0.18, -s * 0.85);   // Right antenna (shorter)
        
        // Round antenna bobbles (bigger and more prominent)
        this.p.fill(100, 255, 100); // Matching eye color
        this.p.noStroke();
        this.p.ellipse(-s * 0.18, -s * 0.85, s * 0.12); // Left bobble (bigger)
        this.p.ellipse(s * 0.18, -s * 0.85, s * 0.12);  // Right bobble (bigger)
        
        // Chubby little arms
        this.p.fill(this.bodyColor.levels[0] + 10, this.bodyColor.levels[1] + 10, this.bodyColor.levels[2] + 10);
        this.p.ellipse(-s * 0.4, -s * 0.1, s * 0.2, s * 0.35); // Left arm (round)
        this.p.ellipse(s * 0.4, -s * 0.1, s * 0.2, s * 0.35);  // Right arm (round)
        
        // Little round hands
        this.p.fill(this.bodyColor);
        this.p.ellipse(-s * 0.45, s * 0.05, s * 0.12); // Left hand
        this.p.ellipse(s * 0.45, s * 0.05, s * 0.12);  // Right hand
        
        // Minimal tactical gear (just a belt so they look "official")
        this.p.fill(this.bodyColor.levels[0] + 30, this.bodyColor.levels[1] + 30, this.bodyColor.levels[2] + 30);
        this.p.rect(-s * 0.3, s * 0.1, s * 0.6, s * 0.08); // Simple belt
    }

    /**
     * Special deferred death logic for stabber melee:
     * If a Grunt is killed by a stabber melee attack, it plays an "ow" sound and delays actual death for a short period (e.g., 12 frames).
     * Only after the delay does it call super.takeDamage() to trigger death effects (explosion, score, removal).
     * This ensures all death effects are triggered exactly once, preventing double explosions or score increments.
     * This pattern is unique to Grunt and not used for other enemies unless they require similar dramatic or audio effects.
     */
    takeDamage(amount, bulletAngle = null, damageSource = null) {
        // Debug: Log all takeDamage events for Grunt only if collision debug is enabled
        if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(`[GRUNT DEBUG] takeDamage called: health(before)=${this.health}, amount=${amount}, markedForRemoval=${this.markedForRemoval}, damageSource=${damageSource}`);
        }
        if (damageSource === 'stabber_melee' && this.health > 0 && amount >= this.health) {
            // About to die from stabber: play 'ow', delay death
            if (window.audio) {
                const ttsSuccess = window.audio.speak(this, 'ow', 'grunt', true); // force = true
                if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
                    console.log('💬 Grunt stabbed: trying to say "ow" (TTS success:', ttsSuccess, ')');
                }
                if (!ttsSuccess && window.audio.playSound) {
                    window.audio.playSound('gruntOw', this.x, this.y);
                    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
                        console.log('🔊 Fallback gruntOw sound played.');
                    }
                }
            }
            // Set up delayed death, but don't call super.takeDamage() yet
            this.pendingStabDeath = true;
            this.pendingStabDeathTimer = 12; // ~200ms at 60fps
            this._pendingStabDeathParams = { amount, bulletAngle, damageSource };
            return 'pendingStabDeath';
        }
        const died = super.takeDamage(amount, bulletAngle, damageSource);
        if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(`[GRUNT DEBUG] takeDamage after super: health(after)=${this.health}, died=${died}, markedForRemoval=${this.markedForRemoval}`);
        }
        if (died && CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(`[GRUNT DEBUG] Grunt at (${this.x.toFixed(1)},${this.y.toFixed(1)}) died and should be removed.`);
        }
        if (damageSource === 'stabber_melee' && !died && window.audio && this.speechCooldown <= 0) {
            const ttsSuccess = window.audio.speak(this, 'ow', 'grunt', true); // force = true
            if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
                console.log('💬 Grunt stabbed (survived): trying to say "ow" (TTS success:', ttsSuccess, ')');
            }
            if (!ttsSuccess && window.audio.playSound) {
                window.audio.playSound('gruntOw', this.x, this.y);
                if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
                    console.log('🔊 Fallback gruntOw sound played.');
                }
            }
            this.speechCooldown = 60; // 1s cooldown to avoid spam
        }
        return died;
    }
}

export { Grunt }; 