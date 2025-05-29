/**
 * Tank class - Heavy artillery with charging system
 * Features anger system that targets other enemies when friendly fire occurs
 */
class Tank extends BaseEnemy {
    constructor(x, y) {
        const config = {
            size: 50,
            health: 60,
            speed: 0.3,
            color: color(138, 43, 226) // Blue violet - massive
        };
        
        super(x, y, 'tank', config);
        
        // Tank special charging system
        this.chargingShot = false;
        this.chargeTime = 0;
        this.maxChargeTime = 240; // 4 seconds at 60fps - long, dramatic charge
        
        // Tank anger system - tracks who damages it
        this.damageTracker = new Map(); // Track damage sources: enemyType -> count
        this.angerThreshold = 3; // Get angry after 3 hits from same enemy type
        this.isAngry = false;
        this.angerTarget = null; // Which enemy type to target when angry
        this.angerCooldown = 0; // Cooldown before returning to normal behavior
        this.maxAngerCooldown = 600; // 10 seconds of anger
        
        console.log('Tank created with charging system and anger tracking initialized');
    }
    
    /**
     * Update specific tank behavior - heavy artillery
     */
    updateSpecificBehavior(playerX, playerY) {
        // Tank anger system - update anger cooldown and targeting
        if (this.isAngry) {
            this.angerCooldown--;
            if (this.angerCooldown <= 0) {
                this.isAngry = false;
                this.angerTarget = null;
                console.log(`😌 Tank calmed down, returning to normal behavior`);
                
                // Tank speaks about calming down
                if (window.audio) {
                    const calmLines = [
                        "BACK TO NORMAL TARGETS",
                        "ANGER SUBSIDING",
                        "RETURNING TO MISSION",
                        "FOCUS ON HUMAN AGAIN"
                    ];
                    const calmLine = calmLines[Math.floor(Math.random() * calmLines.length)];
                    window.audio.speak(this, calmLine, 'tank');
                }
            }
        }
        
        // Calculate movement towards target (player or angry target)
        let targetX = playerX;
        let targetY = playerY;
        
        // Tank anger targeting - find nearest enemy of angry target type
        if (this.isAngry && this.angerTarget && window.enemies) {
            let nearestAngryTarget = null;
            let nearestDistance = Infinity;
            
            for (const enemy of window.enemies) {
                if (enemy.type === this.angerTarget && enemy !== this) {
                    const dist = Math.sqrt((enemy.x - this.x) ** 2 + (enemy.y - this.y) ** 2);
                    if (dist < nearestDistance) {
                        nearestDistance = dist;
                        nearestAngryTarget = enemy;
                    }
                }
            }
            
            if (nearestAngryTarget) {
                targetX = nearestAngryTarget.x;
                targetY = nearestAngryTarget.y;
                console.log(`😡 Tank targeting angry enemy: ${this.angerTarget} at distance ${nearestDistance.toFixed(0)}`);
            }
        }
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = sqrt(dx * dx + dy * dy);
        
        // Tank movement - very slow and steady
        this.velocity.x = 0;
        this.velocity.y = 0;
        
        if (distance > 0) {
            const unitX = dx / distance;
            const unitY = dy / distance;
            
            // Tanks move very slowly but relentlessly
            this.velocity.x = unitX * this.speed;
            this.velocity.y = unitY * this.speed;
        }
        
        // Handle charging shot system
        if (this.chargingShot) {
            this.chargeTime++;
            
            // Tank power sound at different charge stages
            if (window.audio && window.beatClock) {
                // Tank power sounds play on beat 1 with 25% chance
                if (window.beatClock.isOnBeat([1]) && random() < 0.25) {
                    window.audio.playSound('tankPower', this.x, this.y);
                }
            }
            
            // Different charging sounds at different stages
            if (this.chargeTime === 1 && window.audio) {
                console.log('🔋 Tank starting to charge!');
                window.audio.speak(this, "CHARGING!", 'tank');
                window.audio.playSound('tankCharging', this.x, this.y);
            } else if (this.chargeTime === this.maxChargeTime / 2 && window.audio) {
                console.log('⚡ Tank 50% charged!');
                window.audio.speak(this, "POWER UP!", 'tank');
                window.audio.playSound('tankPowerUp', this.x, this.y);
            }
            
            if (this.chargeTime >= this.maxChargeTime) {
                // Fire the charged shot
                this.chargingShot = false;
                this.chargeTime = 0;
                this.shootCooldown = 180; // 3 second cooldown after firing
                
                console.log('💥 Tank firing charged shot!');
                if (window.audio) {
                    window.audio.speak(this, "FIRE!", 'tank');
                }
                
                return this.createBullet();
            }
        } else if (distance < 400 && this.shootCooldown <= 0) {
            // RHYTHMIC TANK SHOOTING: Tanks can only shoot on beat 1 (bass drum pattern)
            if (window.beatClock && window.beatClock.canTankShoot()) {
                // Start charging
                this.chargingShot = true;
                this.chargeTime = 0;
                console.log('🎯 Tank starting charge sequence!');
            }
        }
        
        return null;
    }
    
    /**
     * Trigger ambient speech specific to tanks
     */
    triggerAmbientSpeech() {
        if (window.audio && this.speechCooldown <= 0) {
            // Tank ambient speech on beat 1 with 25% chance
            if (window.beatClock && window.beatClock.isOnBeat([1]) && random() < 0.25) {
                const tankLines = [
                    "HEAVY ARTILLERY!", "SIEGE MODE!", "CRUSH!", "PULVERIZE!", "DEVASTATE!",
                    "DO YOU LIFT BRO?", "SIZE MATTERS!", "BIG MUSCLES!", "ALPHA MALE!"
                ];
                const randomLine = tankLines[Math.floor(Math.random() * tankLines.length)];
                window.audio.speak(this, randomLine, 'tank');
                this.speechCooldown = this.maxSpeechCooldown;
            }
        }
    }
    
    /**
     * Draw tank-specific body shape
     */
    drawBody(s) {
        // Massive, blocky body
        fill(this.bodyColor);
        noStroke();
        rect(-s * 0.5, -s * 0.6, s, s * 1.2);
        
        // Add armor plating
        fill(this.bodyColor.levels[0] + 20, this.bodyColor.levels[1] + 20, this.bodyColor.levels[2] + 20);
        rect(-s * 0.45, -s * 0.5, s * 0.9, s * 0.2);
        rect(-s * 0.45, -s * 0.1, s * 0.9, s * 0.2);
        rect(-s * 0.45, s * 0.3, s * 0.9, s * 0.2);
        
        // Tank treads
        fill(this.bodyColor.levels[0] - 30, this.bodyColor.levels[1] - 30, this.bodyColor.levels[2] - 30);
        rect(-s * 0.55, -s * 0.7, s * 1.1, s * 0.15);
        rect(-s * 0.55, s * 0.55, s * 1.1, s * 0.15);
    }
    
    /**
     * Override weapon drawing for tank's heavy weapon
     */
    drawWeapon(s) {
        // Massive tank cannon
        fill(this.weaponColor);
        rect(s * 0.3, -s * 0.1, s * 0.8, s * 0.2);
        
        // Cannon details
        fill(this.weaponColor.levels[0] + 30, this.weaponColor.levels[1] + 30, this.weaponColor.levels[2] + 30);
        rect(s * 0.35, -s * 0.08, s * 0.7, s * 0.06);
        rect(s * 0.35, s * 0.02, s * 0.7, s * 0.06);
        
        // Muzzle flash (larger for tank)
        if (this.muzzleFlash > 0) {
            fill(255, 255, 100, this.muzzleFlash * 30);
            ellipse(s * 1.1, 0, s * 0.4, s * 0.2);
            this.muzzleFlash--;
        }
    }
    
    /**
     * Draw type-specific indicators
     */
    drawSpecificIndicators() {
        if (this.chargingShot) {
            this.drawChargingIndicator();
        }
    }
    
    /**
     * Draw charging indicator
     */
    drawChargingIndicator() {
        const chargePercent = this.chargeTime / this.maxChargeTime;
        
        // Charging circle around tank
        const pulse = sin(frameCount * 2.0) * 0.3 + 0.7;
        const chargeRadius = this.size * (0.8 + chargePercent * 0.4);
        
        // Outer charge field
        fill(100, 200, 255, 30 + chargePercent * 50 + pulse * 30);
        noStroke();
        ellipse(this.x, this.y, chargeRadius * 2.5);
        
        // Inner energy core
        fill(150, 220, 255, 60 + chargePercent * 80 + pulse * 40);
        ellipse(this.x, this.y, chargeRadius * 1.5);
        
        // Charge percentage text
        fill(255, 255, 255);
        textAlign(CENTER, CENTER);
        textSize(10);
        text(`${Math.floor(chargePercent * 100)}%`, this.x, this.y - this.size - 25);
        
        // "CHARGING" text
        if (chargePercent > 0.3) {
            textSize(12);
            text("CHARGING", this.x, this.y - this.size - 40);
        }
    }
    
    /**
     * Create tank's devastating energy ball
     */
    createBullet() {
        const bulletDistance = this.size * 0.9;
        const bulletX = this.x + cos(this.aimAngle) * bulletDistance;
        const bulletY = this.y + sin(this.aimAngle) * bulletDistance;
        
        // Devastating slow energy ball with owner ID
        const bullet = new Bullet(bulletX, bulletY, this.aimAngle, 2, 'enemy-tank');
        bullet.ownerId = this.id; // Track which tank fired this
        return bullet;
    }
    
    /**
     * Override takeDamage to handle anger system
     */
    takeDamage(amount, bulletAngle = null, damageSource = null) {
        // Tank anger system - track damage sources
        if (damageSource && damageSource !== 'player') {
            // Track damage from this source
            const currentCount = this.damageTracker.get(damageSource) || 0;
            this.damageTracker.set(damageSource, currentCount + 1);
            
            console.log(`🎯 Tank hit by ${damageSource}! Count: ${currentCount + 1}`);
            
            // Check if we should get angry
            if (currentCount + 1 >= this.angerThreshold && !this.isAngry) {
                this.isAngry = true;
                this.angerTarget = damageSource;
                this.angerCooldown = this.maxAngerCooldown;
                
                console.log(`😡 TANK IS ANGRY! Targeting ${damageSource} enemies!`);
                
                // Tank speaks angrily
                if (window.audio) {
                    const angerLines = [
                        "ENOUGH! YOU DIE FIRST!",
                        "TARGETING TRAITORS!",
                        "FRIENDLY FIRE? NOT ANYMORE!",
                        "YOU MADE ME MAD!",
                        "TURNING GUNS ON YOU!"
                    ];
                    const angerLine = angerLines[Math.floor(Math.random() * angerLines.length)];
                    window.audio.speak(this, angerLine, 'tank');
                }
            }
        }
        
        // Apply normal damage
        return super.takeDamage(amount, bulletAngle, damageSource);
    }
} 