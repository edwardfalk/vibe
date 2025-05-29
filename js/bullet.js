class Bullet {
    constructor(x, y, angle, speed, owner) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.owner = owner; // 'player' or 'enemy'
        
        this.velocity = {
            x: cos(angle) * speed,
            y: sin(angle) * speed
        };
        
        // Size and damage based on owner type - increased for better visibility
        if (owner === 'player') {
            this.size = 8; // Increased from 6
            this.damage = 1;
        } else if (owner === 'enemy-rusher') {
            this.size = 5; // Increased from 3
            this.damage = 1;
        } else if (owner === 'enemy-tank') {
            this.size = 20; // Made bigger for more impact
            this.damage = 999; // Instant kill
            this.energy = 100; // Energy that decreases when killing enemies
            this.penetrating = true; // Can pass through enemies

        } else {
            this.size = 6; // Increased from 4
            this.damage = 1;
        }
        this.active = true;
        
        // Trail effect
        this.trail = [];
        this.maxTrailLength = 5;
    }
    
    update() {
        // Store position for trail
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }
        
        // Move bullet
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        
        // Check bounds
        if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
            this.active = false;
        }
    }
    
    draw() {
        if (!this.active) return;
        
        // Draw enhanced glow effect
        if (typeof drawGlow !== 'undefined') {
            try {
                if (this.owner === 'player') {
                    drawGlow(this.x, this.y, this.size * 2, color(255, 255, 100), 0.8);
                } else if (this.owner === 'enemy-tank') {
                    const energyPercent = this.energy ? this.energy / 100 : 1;
                    drawGlow(this.x, this.y, this.size * 3 * energyPercent, color(150, 100, 255), 1.2);

                } else {
                    drawGlow(this.x, this.y, this.size * 1.5, color(255, 100, 255), 0.5);
                }
            } catch (error) {
                console.log('⚠️ Bullet glow error:', error);
            }
        }
        
        // Draw trail
        this.drawTrail();
        
        // Draw bullet
        push();
        translate(this.x, this.y);
        rotate(this.angle);
        
        if (this.owner === 'player') {
            // Player bullet - cosmic turquoise energy
            fill(64, 224, 208);
            noStroke();
            ellipse(0, 0, this.size);
            
            // Bright core
            fill(255, 255, 255, 180);
            ellipse(0, 0, this.size * 0.6);
            
            // Outer glow
            fill(0, 255, 255, 80);
            ellipse(0, 0, this.size * 1.4);
            
        } else if (this.owner === 'enemy-rusher') {
            // Rusher bullet - small, fast, pink
            fill(255, 150, 200);
            noStroke();
            ellipse(0, 0, this.size);
            
            // Small glow
            fill(255, 200, 220, 120);
            ellipse(0, 0, this.size * 1.3);
            
        } else if (this.owner === 'enemy-tank') {
            // Tank bullet - massive, devastating energy ball with vibrating pulse
            const energyPercent = this.energy ? this.energy / 100 : 1;
            const vibration = sin(frameCount * 0.8) * 2; // Fast vibration
            const pulse = sin(frameCount * 0.5) * 0.4 + 0.6; // Slower pulse
            
            push();
            translate(vibration, vibration * 0.5); // Vibrating effect
            
            // Main energy ball - size based on remaining energy
            fill(150 * energyPercent, 100 * energyPercent, 255);
            noStroke();
            ellipse(0, 0, this.size * energyPercent);
            
            // Massive plasma glow
            fill(200 * energyPercent, 150 * energyPercent, 255, 120 * pulse);
            ellipse(0, 0, this.size * 2.2 * energyPercent);
            
            // Pulsing outer aura with vibration
            fill(255, 200 * energyPercent, 255, 60 * pulse * energyPercent);
            ellipse(0, 0, this.size * 3 * energyPercent);
            
            // Bright inner core
            fill(255, 255, 255, 200 * energyPercent);
            ellipse(0, 0, this.size * 0.4 * energyPercent);
            
            pop();
            
        } else {
            // Standard enemy bullet - purple/pink energy
            fill(255, 100, 255);
            noStroke();
            ellipse(0, 0, this.size);
            
            // Energy glow
            fill(255, 150, 255, 100);
            ellipse(0, 0, this.size * 1.5);
        }
        
        pop();
    }
    
    drawTrail() {
        if (this.trail.length < 2) return;
        
        for (let i = 0; i < this.trail.length - 1; i++) {
            const alpha = (i / this.trail.length) * 150;
            const size = (i / this.trail.length) * this.size * 0.5;
            
            if (this.owner === 'player') {
                fill(255, 255, 100, alpha);
            } else if (this.owner === 'enemy-rusher') {
                fill(255, 150, 200, alpha);
            } else if (this.owner === 'enemy-tank') {
                fill(150, 100, 255, alpha);
            } else {
                fill(255, 100, 255, alpha);
            }
            
            noStroke();
            ellipse(this.trail[i].x, this.trail[i].y, size);
        }
    }
    
    checkCollision(target) {
        if (!this.active) return false;
        
        const distance = dist(this.x, this.y, target.x, target.y);
        return distance < (this.size + target.size) * 0.75;
    }
    
    destroy() {
        this.active = false;
    }
    
    // Check if bullet is off screen
    isOffScreen() {
        const margin = 50;
        return this.x < -margin || this.x > width + margin || 
               this.y < -margin || this.y > height + margin;
    }
} 