/**
 * Stabber class - Melee assassin with armor system
 * Features three-phase attack system: approach → prepare → dash attack
 */
class Stabber extends BaseEnemy {
    constructor(x, y) {
        const config = {
            size: 28,
            health: 10,
            speed: 1.5,
            color: color(255, 215, 0) // Gold - heavily armored melee fighter
        };
        
        super(x, y, 'stabber', config);
        
        // Stabber melee system - heavily armored close combat specialist
        this.stabDistance = 180; // Start preparing attack further away
        this.stabCooldown = 0;
        this.stabPreparing = false; // New preparing phase - almost immediate stop
        this.stabPreparingTime = 0;
        this.maxStabPreparingTime = 30; // 0.5 second preparation - gradual slow to stop
        this.stabWarning = false;
        this.stabWarningTime = 0;
        this.maxStabWarningTime = 20; // 0.33 second warning phase - stopped and signaling
        this.hasYelledStab = false;
        
        // Atmospheric TTS system
        this.stabChantTimer = random(60, 180); // Random delay between chants
        this.isStabbing = false;
        this.stabAnimationTime = 0;
        this.maxStabAnimationTime = 40; // 0.67 second faster stab animation
        this.stabRecovering = false; // New recovery phase - stuck after attack
        this.stabRecoveryTime = 0;
        this.maxStabRecoveryTime = 120; // 2 seconds stuck after attack
        
        // Knockback system for armored stabbers
        this.knockbackVelocity = { x: 0, y: 0 };
        this.knockbackDecay = 0.85; // How quickly knockback fades
        
        // Attack direction locking
        this.stabDirection = null; // Direction locked during stab attack
        
        // Armor properties
        this.armor = 2; // Reduces incoming damage
        this.meleeReach = 150; // Maximum knife reach for devastating strikes
    }
    
    /**
     * Update specific stabber behavior - melee assassination
     */
    updateSpecificBehavior(playerX, playerY) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distance = sqrt(dx * dx + dy * dy);
        
        // Update stabber timers
        if (this.stabCooldown > 0) this.stabCooldown--;
        if (this.stabChantTimer > 0) this.stabChantTimer--;
        
        // Handle atmospheric chanting
        if (this.stabChantTimer <= 0 && this.speechCooldown <= 0) {
            this.stabChantTimer = random(180, 360); // 3-6 seconds between chants
            
            // Stabber atmospheric chanting on off-beat 3.5 with 30% chance
            if (window.audio && window.beatClock) {
                if (window.beatClock.isOnBeat([3.5]) && random() < 0.3) {
                    window.audio.playSound('stabberChant', this.x, this.y);
                    console.log(`🎭 Stabber atmospheric chanting`);
                }
            }
        }
        
        // Apply knockback velocity and decay
        this.x += this.knockbackVelocity.x;
        this.y += this.knockbackVelocity.y;
        this.knockbackVelocity.x *= this.knockbackDecay;
        this.knockbackVelocity.y *= this.knockbackDecay;
        
        // Recovery phase - stuck after attack
        if (this.stabRecovering) {
            this.stabRecoveryTime++;
            
            // Cannot move during recovery
            this.velocity.x = 0;
            this.velocity.y = 0;
            
            if (this.stabRecoveryTime >= this.maxStabRecoveryTime) {
                this.stabRecovering = false;
                this.stabRecoveryTime = 0;
                console.log(`⚡ Stabber recovered from attack`);
            }
            
            return null;
        }
        
        // Stabbing phase - explosive dash forward
        if (this.isStabbing) {
            this.stabAnimationTime++;
            
            // Dash forward at 700% speed in locked direction
            if (this.stabDirection !== null) {
                this.velocity.x = cos(this.stabDirection) * this.speed * 7.0; // 700% speed
                this.velocity.y = sin(this.stabDirection) * this.speed * 7.0;
            }
            
            if (this.stabAnimationTime >= this.maxStabAnimationTime) {
                // End stab attack and enter recovery
                this.isStabbing = false;
                this.stabAnimationTime = 0;
                this.stabRecovering = true;
                this.stabRecoveryTime = 0;
                this.stabCooldown = 180; // 3 second cooldown
                this.stabDirection = null; // Clear direction lock
                
                console.log(`🗡️ Stabber attack ended, entering recovery phase`);
                
                // Check for hits during dash
                return this.checkStabHit(playerX, playerY);
            }
            
            return null;
        }
        
        // Warning phase - stopped and signaling
        if (this.stabWarning) {
            this.stabWarningTime++;
            
            // Completely stopped during warning
            this.velocity.x = 0;
            this.velocity.y = 0;
            
            // Play warning sounds
            if (this.stabWarningTime === 1 && window.audio) {
                window.audio.playSound('stabberStalk', this.x, this.y);
                window.audio.playSound('stabberKnife', this.x, this.y);
                
                const stabWarnings = ["STAB TIME!", "SLICE AND DICE!", "ACUPUNCTURE TIME!", "STABBY MCSTABFACE!"];
                const warning = stabWarnings[Math.floor(Math.random() * stabWarnings.length)];
                window.audio.speak(this, warning, 'stabber');
            }
            
            if (this.stabWarningTime >= this.maxStabWarningTime) {
                // Start explosive dash attack
                this.stabWarning = false;
                this.stabWarningTime = 0;
                this.isStabbing = true;
                this.stabAnimationTime = 0;
                
                // Play explosive dash sound
                if (window.audio) {
                    window.audio.playSound('stabberDash', this.x, this.y);
                }
                
                console.log(`🚀 Stabber starting explosive dash attack!`);
            }
            
            return null;
        }
        
        // Preparing phase - gradual slow to stop
        if (this.stabPreparing) {
            this.stabPreparingTime++;
            
            // Gradually slow down from normal speed to 0 over preparation time
            const slowFactor = 1.0 - (this.stabPreparingTime / this.maxStabPreparingTime);
            const currentSpeed = Math.max(0, this.speed * 1.6 * slowFactor); // From 160% to 0%
            
            if (distance > 0) {
                const unitX = dx / distance;
                const unitY = dy / distance;
                this.velocity.x = unitX * currentSpeed;
                this.velocity.y = unitY * currentSpeed;
            }
            
            if (this.stabPreparingTime >= this.maxStabPreparingTime) {
                // Enter warning phase
                this.stabPreparing = false;
                this.stabPreparingTime = 0;
                this.stabWarning = true;
                this.stabWarningTime = 0;
                
                // Lock attack direction
                this.stabDirection = this.aimAngle;
                
                console.log(`⚠️ Stabber entering warning phase, direction locked at ${(this.stabDirection * 180 / PI).toFixed(1)}°`);
            }
            
            return null;
        }
        
        // Normal movement and attack initiation
        this.velocity.x = 0;
        this.velocity.y = 0;
        
        if (distance > 0 && this.stabCooldown <= 0) {
            const unitX = dx / distance;
            const unitY = dy / distance;
            
            if (distance <= this.stabDistance) {
                // Start attack sequence
                this.stabPreparing = true;
                this.stabPreparingTime = 0;
                console.log(`🎯 Stabber starting attack sequence at distance: ${distance.toFixed(0)}px`);
            } else {
                // Normal approach at 160% speed
                this.velocity.x = unitX * this.speed * 1.6;
                this.velocity.y = unitY * this.speed * 1.6;
            }
        }
        
        return null;
    }
    
    /**
     * Check if stab hit player during dash
     */
    checkStabHit(playerX, playerY) {
        const distance = sqrt((playerX - this.x) ** 2 + (playerY - this.y) ** 2);
        const stabReach = this.meleeReach;
        
        // Calculate if player is in the locked stab direction (cone-shaped attack)
        const playerAngle = atan2(playerY - this.y, playerX - this.x);
        const angleDifference = abs(this.stabDirection - playerAngle);
        const maxStabAngle = PI / 6; // 30 degree cone for stab attack
        
        const inStabDirection = angleDifference <= maxStabAngle || angleDifference >= TWO_PI - maxStabAngle;
        
        if (distance <= stabReach && inStabDirection) {
            console.log(`🗡️ STABBER HIT! Player caught in 700% speed dash attack! Distance: ${distance.toFixed(0)}px, Reach: ${stabReach}px`);
            return { 
                type: 'stabber-melee', 
                x: this.x, 
                y: this.y, 
                damage: 25, // High melee damage
                reach: stabReach,
                stabAngle: this.stabDirection, // Use locked direction
                hitType: 'player' // Indicate what was hit
            };
        } else {
            if (distance > stabReach) {
                console.log(`🗡️ STABBER MISSED! Player escaped - out of reach! Distance: ${distance.toFixed(0)}px > Reach: ${stabReach}px`);
            } else {
                console.log(`🗡️ STABBER MISSED! Player dodged perpendicular to stab direction! Distance: ${distance.toFixed(0)}px, Angle difference: ${(angleDifference * 180 / PI).toFixed(1)}°`);
            }
            
            // Create explosion effect for missed attack
            if (typeof visualEffectsManager !== 'undefined' && visualEffectsManager) {
                try {
                    visualEffectsManager.addExplosion(this.x, this.y, 15, [255, 215, 0], 0.8);
                } catch (error) {
                    console.log('⚠️ Stabber miss explosion error:', error);
                }
            }
            
            return { 
                type: 'stabber-miss', 
                x: this.x, 
                y: this.y,
                reason: distance > stabReach ? 'out_of_reach' : 'wrong_direction',
                distance: distance,
                reach: stabReach
            };
        }
    }
    
    /**
     * Trigger ambient speech specific to stabbers
     */
    triggerAmbientSpeech() {
        if (window.audio && this.speechCooldown <= 0) {
            // Stabber ambient speech on off-beat 3.5 with 20% chance
            if (window.beatClock && window.beatClock.isOnBeat([3.5]) && random() < 0.2) {
                const stabberLines = [
                    "STAB!", "SLICE!", "CUT!", "POKE!", "ACUPUNCTURE!", "LITTLE PRICK!",
                    "STABBY MCSTABFACE!", "NEEDLE THERAPY!", "I COLLECT BELLY BUTTONS!"
                ];
                const randomLine = stabberLines[Math.floor(Math.random() * stabberLines.length)];
                window.audio.speak(this, randomLine, 'stabber');
                this.speechCooldown = this.maxSpeechCooldown;
            }
        }
    }
    
    /**
     * Get animation modifications for attack phases
     */
    getAnimationModifications() {
        // No rotation during attack phases
        if (this.stabPreparing || this.stabWarning || this.isStabbing || this.stabRecovering) {
            // Additional animation modifications could go here
            return { bobble: 0, waddle: 0 };
        }
        
        return { bobble: 0, waddle: 0 };
    }
    
    /**
     * Draw motion trail for stabbers
     */
    drawMotionTrail() {
        if (frameCount % 4 === 0 && typeof visualEffectsManager !== 'undefined' && visualEffectsManager) {
            try {
                const trailColor = [255, 140, 0];
                visualEffectsManager.addMotionTrail(this.x, this.y, trailColor, 3);
            } catch (error) {
                console.log('⚠️ Stabber trail error:', error);
            }
        }
    }
    
    /**
     * Override aim angle update to lock during attack phases
     */
    update(playerX, playerY) {
        // Call parent update but override aim angle locking
        const result = super.update(playerX, playerY);
        
        // Lock rotation during attack phases
        if (this.stabPreparing || this.stabWarning || this.isStabbing || this.stabRecovering) {
            // Don't update aim angle during these phases
        } else {
            // Normal aim angle update
            const dx = playerX - this.x;
            const dy = playerY - this.y;
            if (dx !== 0 || dy !== 0) {
                this.aimAngle = atan2(dy, dx);
            }
        }
        
        return result;
    }
    
    /**
     * Draw stabber-specific body shape
     */
    drawBody(s) {
        // Compact, armored body for stabber
        fill(this.bodyColor);
        noStroke();
        ellipse(0, 0, s, s * 0.9);
        
        // Armor plating details
        fill(this.bodyColor.levels[0] + 20, this.bodyColor.levels[1] + 20, this.bodyColor.levels[2] + 20);
        ellipse(0, -s * 0.2, s * 0.6, s * 0.3); // Chest armor
        ellipse(-s * 0.25, s * 0.1, s * 0.3, s * 0.4); // Left armor plate
        ellipse(s * 0.25, s * 0.1, s * 0.3, s * 0.4); // Right armor plate
    }
    
    /**
     * Override weapon drawing for stabber's giant laser knife
     */
    drawWeapon(s) {
        // Giant laser knife - much larger than normal weapons
        const knifeLength = s * 0.6; // 60% longer
        const knifeWidth = s * 0.2; // 100% wider
        
        fill(this.weaponColor);
        
        // Main blade
        beginShape();
        vertex(s * 0.3, -knifeWidth / 2);
        vertex(s * 0.3 + knifeLength, -knifeWidth / 4);
        vertex(s * 0.3 + knifeLength, knifeWidth / 4);
        vertex(s * 0.3, knifeWidth / 2);
        endShape(CLOSE);
        
        // Knife handle with armor plating
        fill(this.weaponColor.levels[0] - 30, this.weaponColor.levels[1] - 30, this.weaponColor.levels[2] - 30);
        rect(s * 0.2, -knifeWidth / 3, s * 0.2, knifeWidth * 0.67);
        
        // Laser edge glow
        if (this.stabWarning || this.isStabbing) {
            fill(255, 255, 255, 150);
            beginShape();
            vertex(s * 0.3, -knifeWidth / 3);
            vertex(s * 0.3 + knifeLength * 0.9, -knifeWidth / 6);
            vertex(s * 0.3 + knifeLength * 0.9, knifeWidth / 6);
            vertex(s * 0.3, knifeWidth / 3);
            endShape(CLOSE);
        }
        
        // Enhanced trail effects during stab
        if (this.isStabbing) {
            for (let i = 0; i < 3; i++) {
                fill(255, 215, 0, 100 - i * 30);
                const trailOffset = i * 10;
                beginShape();
                vertex(s * 0.3 - trailOffset, -knifeWidth / 2);
                vertex(s * 0.3 + knifeLength - trailOffset, -knifeWidth / 4);
                vertex(s * 0.3 + knifeLength - trailOffset, knifeWidth / 4);
                vertex(s * 0.3 - trailOffset, knifeWidth / 2);
                endShape(CLOSE);
            }
        }
    }
    
    /**
     * Draw type-specific indicators
     */
    drawSpecificIndicators() {
        if (this.stabWarning) {
            this.drawStabWarning();
        } else if (this.stabRecovering) {
            this.drawStabRecovery();
        }
    }
    
    /**
     * Draw stab warning indicator
     */
    drawStabWarning() {
        const stabPercent = this.stabWarningTime / this.maxStabWarningTime;
        
        // Dramatic charging animation with building energy
        const pulse = sin(frameCount * 3.0) * 0.5 + 0.5;
        const chargePulse = sin(frameCount * 1.5) * 0.3 + 0.7;
        const warningRadius = this.size * (1.2 + stabPercent * 0.8); // Growing energy field
        
        // Building energy circle - intensifying over time
        fill(255, 150, 0, 40 + stabPercent * 60 + pulse * 40);
        noStroke();
        ellipse(this.x, this.y, warningRadius * 2);
        
        // Inner charging core - pulsing faster as charge builds
        fill(255, 200, 0, 60 + stabPercent * 80 + chargePulse * 60);
        ellipse(this.x, this.y, warningRadius);
        
        // Charging sparks around the stabber
        if (frameCount % 3 === 0) {
            for (let i = 0; i < 6; i++) {
                const sparkAngle = (frameCount * 0.1 + i * PI / 3) % TWO_PI;
                const sparkDist = this.size * (0.8 + stabPercent * 0.4);
                const sparkX = this.x + cos(sparkAngle) * sparkDist;
                const sparkY = this.y + sin(sparkAngle) * sparkDist;
                
                fill(255, 255, 0, 120 + stabPercent * 100);
                ellipse(sparkX, sparkY, 3 + stabPercent * 3);
            }
        }
        
        // Energy buildup text
        if (stabPercent > 0.5) {
            fill(255, 255, 255, 150 + stabPercent * 100);
            textAlign(CENTER, CENTER);
            textSize(8 + stabPercent * 4);
            text("CHARGING", this.x, this.y - this.size - 25);
        }
    }
    
    /**
     * Draw stab recovery indicator
     */
    drawStabRecovery() {
        const recoveryPercent = this.stabRecoveryTime / this.maxStabRecoveryTime;
        
        // Exhausted/stuck indicator - fading red glow
        const pulse = sin(frameCount * 1.0) * 0.3 + 0.7;
        const recoveryRadius = this.size * (1.5 - recoveryPercent * 0.5); // Shrinking as recovery progresses
        
        // Exhausted red glow - fading over time
        fill(255, 0, 0, (60 - recoveryPercent * 40) + pulse * 20);
        noStroke();
        ellipse(this.x, this.y, recoveryRadius * 1.5);
        
        // Inner exhaustion core
        fill(200, 0, 0, (40 - recoveryPercent * 30) + pulse * 15);
        ellipse(this.x, this.y, recoveryRadius);
        
        // Recovery progress text
        if (recoveryPercent < 0.8) {
            fill(255, 255, 255, 200 - recoveryPercent * 100);
            textAlign(CENTER, CENTER);
            textSize(8);
            text("STUCK", this.x, this.y - this.size - 20);
            
            // Countdown
            const countdown = Math.ceil((this.maxStabRecoveryTime - this.stabRecoveryTime) / 60);
            textSize(6);
            text(countdown + "s", this.x, this.y - this.size - 10);
        }
    }
    
    /**
     * Override takeDamage to handle armor system
     */
    takeDamage(amount, bulletAngle = null, damageSource = null) {
        // Apply armor damage reduction
        let actualDamage = amount;
        if (this.armor) {
            actualDamage = Math.max(1, amount - this.armor); // Minimum 1 damage
            console.log(`🛡️ Stabber armor reduced damage: ${amount} -> ${actualDamage}`);
        }
        
        // Apply knockback when hit
        if (bulletAngle !== null) {
            const knockbackForce = 8; // Strong knockback for armored stabbers
            this.knockbackVelocity.x += cos(bulletAngle) * knockbackForce;
            this.knockbackVelocity.y += sin(bulletAngle) * knockbackForce;
            console.log(`⚡ Stabber knocked back! Knockback: ${knockbackForce}`);
        }
        
        // Apply damage using actual damage amount
        this.health -= actualDamage;
        this.hitFlash = 8;
        
        if (this.health <= 0) {
            return true; // Enemy died
        }
        return false;
    }
    
    /**
     * Stabbers don't shoot projectiles - they use melee attacks
     */
    createBullet() {
        return null;
    }
} 