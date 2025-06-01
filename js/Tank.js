import { BaseEnemy } from './BaseEnemy.js';
import { Bullet }    from './bullet.js';
import { floor, random, sqrt, sin, cos, PI, TWO_PI, normalizeAngle } from './mathUtils.js';
import { CONFIG } from './config.js';

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
        
        // Destructible Armor Pieces
        this.frontArmorHP = 120;
        this.frontArmorDestroyed = false;
        this.leftArmorHP = 80;
        this.rightArmorHP = 80;
        this.leftArmorDestroyed = false;
        this.rightArmorDestroyed = false;
        
        console.log('Tank created with charging system, anger tracking, and multi-part armor initialized');
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
                    const calmLine = calmLines[floor(random() * calmLines.length)];
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
                    const dist = sqrt((enemy.x - this.x) ** 2 + (enemy.y - this.y) ** 2);
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
            if (window.beatClock && window.beatClock.isOnBeat([1]) && random() < 0.25) {
                const tankLines = [
                    "HEAVY ARTILLERY!", "SIEGE MODE!", "CRUSH!", "PULVERIZE!", "DEVASTATE!",
                    "DO YOU LIFT BRO?", "SIZE MATTERS!", "BIG MUSCLES!", "ALPHA MALE!"
                ];
                const randomLine = tankLines[floor(random() * tankLines.length)];
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
        rect(-s * 0.5, -s * 0.6, s, s * 1.2); // Main chassis (center part)
        
        // Decorative plating on main chassis (these are not the destructible armor)
        fill(this.bodyColor.levels[0] + 20, this.bodyColor.levels[1] + 20, this.bodyColor.levels[2] + 20);
        rect(-s * 0.45, -s * 0.5, s * 0.9, s * 0.2); // Top plate on chassis
        rect(-s * 0.45, -s * 0.1, s * 0.9, s * 0.2); // Middle plate on chassis
        rect(-s * 0.45, s * 0.3, s * 0.9, s * 0.2);  // Bottom plate on chassis
        
        // Tank treads (visual only)
        fill(this.bodyColor.levels[0] - 30, this.bodyColor.levels[1] - 30, this.bodyColor.levels[2] - 30);
        rect(-s * 0.55, -s * 0.7, s * 1.1, s * 0.15); // Top of treads
        rect(-s * 0.55, s * 0.55, s * 1.1, s * 0.15); // Bottom of treads

        // Draw Destructible Armor Pieces (these are drawn relative to the tank's center after rotation)
        this.drawArmorPlates(s);
    }
    
    drawArmorPlates(s) {
        // We are in the Tank's local coordinate system, centered and rotated.
        // Main chassis' local Y extents are roughly -s*0.6 to +s*0.6.
        // Main chassis' local X extents are roughly -s*0.5 to +s*0.5.

        const armorPlateThickness = s * 0.2; // Thickness of the side armor plates
        const armorPlateLength = s * 1.0;   // Length of the side armor plates
        const chassisSideY = s * 0.6;      // Y-coordinate of the edge of the main chassis' side.
        const chassisFrontX = s * 0.5;     // X-coordinate of the front of the main chassis.

        // Front Armor (Tank's local +X side - its nose)
        push();
        if (!this.frontArmorDestroyed) {
            fill(120, 120, 140); stroke(60, 60, 70); strokeWeight(2);
            // rect(x_top_left, y_top_left, width, height)
            // x_top_left is chassisFrontX (places it on the front edge of the chassis)
            // y_top_left is -armorPlateLength / 2 + s * 0.1 (to align with cannon visually, slightly narrower than side armor)
            // width is armorPlateThickness (it extends along X-axis)
            // height is armorPlateLength * 0.8 (making it slightly shorter than side plates for visual distinction)
            rect(chassisFrontX, -armorPlateLength * 0.4, armorPlateThickness * 1.5, armorPlateLength * 0.8);
        } else {
            fill(50, 50, 50, 150); noStroke();
            rect(chassisFrontX, -armorPlateLength * 0.4, armorPlateThickness * 1.5, armorPlateLength * 0.8);
        }
        pop();

        // Left Armor (Tank's local -Y side)
        push();
        if (!this.leftArmorDestroyed) {
            fill(100, 100, 120); stroke(50, 50, 60); strokeWeight(2);
            // rect(x_top_left, y_top_left, width, height)
            // x_top_left is -armorPlateLength / 2 to center it along the tank's X-axis.
            // y_top_left is -chassisSideY - armorPlateThickness (places it outside the chassis on the -Y side).
            rect(-armorPlateLength / 2, -chassisSideY - armorPlateThickness, armorPlateLength, armorPlateThickness);
        } else {
            fill(50, 50, 50, 150); noStroke();
            rect(-armorPlateLength / 2, -chassisSideY - armorPlateThickness, armorPlateLength, armorPlateThickness);
        }
        pop();

        // Right Armor (Tank's local +Y side)
        push();
        if (!this.rightArmorDestroyed) {
            fill(100, 100, 120); stroke(50, 50, 60); strokeWeight(2);
            // x_top_left is -armorPlateLength / 2.
            // y_top_left is +chassisSideY (places it outside the chassis on the +Y side).
            rect(-armorPlateLength / 2, chassisSideY, armorPlateLength, armorPlateThickness);
        } else {
            fill(50, 50, 50, 150); noStroke();
            rect(-armorPlateLength / 2, chassisSideY, armorPlateLength, armorPlateThickness);
        }
        pop();
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
        if (window.activeBombs && window.activeBombs.some(bomb => bomb.tankId === this.id)) {
            push();
            fill(255, 0, 0);
            textAlign(CENTER, CENTER);
            textSize(16);
            stroke(0, 0, 0);
            strokeWeight(3);
            text('TIME BOMB!', this.x, this.y - this.size - 50);
            pop();
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
        text(`${floor(chargePercent * 100)}%`, this.x, this.y - this.size - 25);
        
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
     * Override takeDamage to handle armor and anger system
     */
    takeDamage(amount, bulletAngle = null, damageSource = null) {
        // Calculate angle of attack relative to tank's facing direction
        if (bulletAngle === null) {
            // No angle: bypass armor, apply damage directly to main body
            console.log('🎯 Tank Main Body Hit (no angle info)!');
            const died = super.takeDamage(amount, bulletAngle, damageSource);
            if (died) {
                console.log("💀 Tank Died (main health depleted).");
                // Death effects handled in BaseEnemy or CollisionSystem
            }
            return died;
        }
        let impactAngle = normalizeAngle(bulletAngle - this.aimAngle + PI);
        const PI_4 = PI / 4; // 45 degrees
        const THREE_PI_4 = 3 * PI / 4; // 135 degrees

        // Check Front Armor Hit (impactAngle between -PI/4 and PI/4)
        if (!this.frontArmorDestroyed && (impactAngle >= -PI_4 && impactAngle <= PI_4)) {
            // Calculate overflow damage if incoming damage exceeds armor HP
            const prevHP = this.frontArmorHP;
            this.frontArmorHP -= amount;
            if (window.audio) window.audio.playSound('hit', this.x, this.y);
            if (this.frontArmorHP <= 0) {
                // Armor destroyed, propagate leftover damage to main body
                const leftover = -this.frontArmorHP; // positive overflow
                this.frontArmorDestroyed = true;
                this.frontArmorHP = 0;
                console.log("💥 Tank Front Armor Destroyed!");
                if (window.audio) window.audio.playSound('explosion', this.x, this.y);
                // TODO: Add visual effect for front armor breaking
                this.hitFlash = 8;
                if (leftover > 0) {
                    // Pass overflow damage to main body
                    return super.takeDamage(leftover, bulletAngle, damageSource);
                }
                return false; // No overflow, armor absorbed
            }
            this.hitFlash = 8;
            return false; // Armor absorbed
        }
        // Check Left Armor Hit (impactAngle between PI/4 and 3PI/4)
        else if (!this.leftArmorDestroyed && impactAngle > PI_4 && impactAngle < THREE_PI_4) {
            // Calculate overflow damage if incoming damage exceeds armor HP
            const prevHP = this.leftArmorHP;
            this.leftArmorHP -= amount;
            if (window.audio) window.audio.playSound('hit', this.x, this.y);
            if (this.leftArmorHP <= 0) {
                // Armor destroyed, propagate leftover damage to main body
                const leftover = -this.leftArmorHP; // positive overflow
                this.leftArmorDestroyed = true;
                this.leftArmorHP = 0;
                console.log("💥 Tank Left Armor Destroyed!");
                if (window.audio) window.audio.playSound('explosion', this.x, this.y);
                // TODO: Add visual effect for armor breaking
                this.hitFlash = 8;
                if (leftover > 0) {
                    // Pass overflow damage to main body
                    return super.takeDamage(leftover, bulletAngle, damageSource);
                }
                return false; // No overflow, armor absorbed
            }
            this.hitFlash = 8;
            return false; // Armor absorbed
        }
        // Check Right Armor Hit (impactAngle between -3PI/4 and -PI/4)
        else if (!this.rightArmorDestroyed && impactAngle < -PI_4 && impactAngle > -THREE_PI_4) {
            // Calculate overflow damage if incoming damage exceeds armor HP
            const prevHP = this.rightArmorHP;
            this.rightArmorHP -= amount;
            if (window.audio) window.audio.playSound('hit', this.x, this.y);
            if (this.rightArmorHP <= 0) {
                // Armor destroyed, propagate leftover damage to main body
                const leftover = -this.rightArmorHP; // positive overflow
                this.rightArmorDestroyed = true;
                this.rightArmorHP = 0;
                console.log("💥 Tank Right Armor Destroyed!");
                if (window.audio) window.audio.playSound('explosion', this.x, this.y);
                // TODO: Add visual effect for armor breaking
                this.hitFlash = 8;
                if (leftover > 0) {
                    // Pass overflow damage to main body
                    return super.takeDamage(leftover, bulletAngle, damageSource);
                }
                return false; // No overflow, armor absorbed
            }
            this.hitFlash = 8;
            return false; // Armor absorbed
        }

        // Hit main body (front/rear, or side if armor is gone)
        console.log(`🎯 Tank Main Body Hit!`);

        // Tank anger system - track damage sources (only if main body is hit by non-player)
        if (damageSource && damageSource !== 'player') {
            const currentCount = this.damageTracker.get(damageSource) || 0;
            this.damageTracker.set(damageSource, currentCount + 1);
            console.log(`💢 Tank hit by ${damageSource}! Count: ${currentCount + 1}. AngerTarget: ${this.angerTarget}`);
            if (currentCount + 1 >= this.angerThreshold && !this.isAngry) {
                this.isAngry = true;
                this.angerTarget = damageSource; // Target the type of enemy that angered it
                this.angerCooldown = this.maxAngerCooldown;
                console.log(`😡 TANK IS ANGRY! Targeting ${this.angerTarget} enemies!`);
                if (window.audio) {
                    const angerLines = [
                        "ENOUGH! YOU DIE FIRST!", "TARGETING TRAITORS!",
                        "FRIENDLY FIRE? NOT ANYMORE!", "YOU MADE ME MAD!", "TURNING GUNS ON YOU!"
                    ];
                    window.audio.speak(this, angerLines[floor(random() * angerLines.length)], 'tank');
                }
            }
        }
        // Apply damage to main health
        const died = super.takeDamage(amount, bulletAngle, damageSource);
        if (died) {
            console.log("💀 Tank Died (main health depleted).");
            // Death effects handled in BaseEnemy or CollisionSystem
        }
        return died;
    }
}

export { Tank };