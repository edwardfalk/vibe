// Requires p5.js for global utility functions: constrain(), random(), lerp(), etc.

/**
 * Radioactive debris system for bomb explosion effects
 * Creates long-lasting contamination zones with lower damage than plasma clouds
 */
export class RadioactiveDebris {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 60; // Damage radius - smaller than plasma clouds
        this.maxRadius = 90; // Visual radius
        this.active = true;
        this.timer = 0;
        this.maxTimer = 900; // 15 seconds at 60fps - longer than plasma clouds
        this.damageTimer = 0;
        this.damageInterval = 45; // Damage every 0.75 seconds - slower than plasma
        this.damage = 8; // Lower damage per tick than plasma
        
        // Visual effects - radioactive particles
        this.particles = [];
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                angle: random(TWO_PI),
                distance: random(15, this.maxRadius),
                speed: random(0.005, 0.015), // Slower than plasma
                size: random(2, 6),
                brightness: random(80, 200),
                glowPhase: random(TWO_PI) // For pulsing glow effect
            });
        }
    }
    
    update() {
        this.timer++;
        this.damageTimer++;
        
        // Update particles with radioactive drift
        for (const p of this.particles) {
            p.angle += p.speed;
            p.glowPhase += 0.08; // Pulsing glow
            // Radioactive particles drift outward slowly
            p.distance += sin(this.timer * 0.02 + p.angle) * 0.3;
            p.distance = constrain(p.distance, 15, this.maxRadius);
        }
        
        // Check if debris is finished
        if (this.timer >= this.maxTimer) {
            this.active = false;
        }
        
        // Return damage info if it's time to damage
        if (this.damageTimer >= this.damageInterval) {
            this.damageTimer = 0;
            return {
                x: this.x,
                y: this.y,
                radius: this.radius,
                damage: this.damage
            };
        }
        
        return null;
    }
    
    draw() {
        if (!this.active) return;
        
        push();
        translate(this.x, this.y);
        
        // Radioactive pulsing effect
        const pulse = sin(this.timer * 0.15) * 0.2 + 0.8;
        const alpha = map(this.timer, 0, this.maxTimer, 120, 30); // Fades slower than plasma
        const radioactiveShift = this.timer * 0.03;
        
        // Outer radioactive warning zone - sickly green
        fill(50, 205, 50, alpha * 0.25);
        noStroke();
        ellipse(0, 0, this.maxRadius * 2 * pulse);
        
        // Middle contamination ring - yellow-green
        fill(154, 205, 50, alpha * 0.35);
        ellipse(0, 0, this.maxRadius * 1.4 * pulse);
        
        // Inner damage zone - bright toxic yellow
        fill(255, 255, 0, alpha * 0.4);
        ellipse(0, 0, this.radius * 2 * pulse);
        
        // Radioactive debris particles
        for (const p of this.particles) {
            const x = cos(p.angle) * p.distance;
            const y = sin(p.angle) * p.distance;
            
            // Cycle through radioactive colors (green/yellow spectrum)
            const colorPhase = (p.angle + radioactiveShift) % (TWO_PI);
            let particleColor;
            if (colorPhase < TWO_PI * 0.33) {
                particleColor = color(50, 205, 50); // Lime green
            } else if (colorPhase < TWO_PI * 0.66) {
                particleColor = color(255, 255, 0); // Yellow
            } else {
                particleColor = color(154, 205, 50); // Yellow-green
            }
            
            // Pulsing glow effect
            const glowIntensity = sin(p.glowPhase) * 0.3 + 0.7;
            
            fill(red(particleColor), green(particleColor), blue(particleColor), p.brightness * glowIntensity * (alpha / 120));
            noStroke();
            ellipse(x, y, p.size);
            
            // Radioactive glow
            fill(red(particleColor) + 30, green(particleColor) + 30, blue(particleColor) + 30, p.brightness * 0.4 * glowIntensity * (alpha / 120));
            ellipse(x, y, p.size * 1.8);
            
            // Bright radioactive core for intense particles
            if (p.brightness > 150) {
                fill(255, 255, 255, p.brightness * 0.5 * glowIntensity * (alpha / 120));
                ellipse(x, y, p.size * 0.4);
            }
        }
        
        // Warning text with radioactive symbol
        if (this.timer < 180) { // Show warning for first 3 seconds
            fill(255, 255, 0, alpha);
            textAlign(CENTER, CENTER);
            textSize(10);
            text("☢ RADIOACTIVE DEBRIS ☢", 0, -this.maxRadius - 15);
        }
        
        pop();
    }
    
    checkDamage(target) {
        const distance = dist(this.x, this.y, target.x, target.y);
        return distance < this.radius;
    }
} 