/**
 * Plasma cloud system for tank death effects
 * Creates dangerous plasma zones that persist and deal area damage
 */
class PlasmaCloud {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 80; // Damage radius
        this.maxRadius = 120; // Visual radius
        this.active = true;
        this.timer = 0;
        this.maxTimer = 300; // 5 seconds at 60fps
        this.damageTimer = 0;
        this.damageInterval = 30; // Damage every 0.5 seconds
        this.damage = 15; // Damage per tick
        
        // Visual effects
        this.particles = [];
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                angle: random(TWO_PI),
                distance: random(20, this.maxRadius),
                speed: random(0.01, 0.03),
                size: random(3, 8),
                brightness: random(100, 255)
            });
        }
    }
    
    update() {
        this.timer++;
        this.damageTimer++;
        
        // Update particles
        for (const p of this.particles) {
            p.angle += p.speed;
            p.distance += sin(this.timer * 0.05 + p.angle) * 0.5;
            p.distance = constrain(p.distance, 20, this.maxRadius);
        }
        
        // Check if cloud is finished
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
        
        // Draw pulsing cosmic aurora danger zone
        const pulse = sin(this.timer * 0.1) * 0.3 + 0.7;
        const alpha = map(this.timer, 0, this.maxTimer, 150, 50);
        const colorShift = this.timer * 0.02;
        
        // Outer warning circle - deep pink aurora
        fill(255, 20, 147, alpha * 0.3);
        noStroke();
        ellipse(0, 0, this.maxRadius * 2 * pulse);
        
        // Middle aurora ring - blue violet
        fill(138, 43, 226, alpha * 0.4);
        ellipse(0, 0, this.maxRadius * 1.5 * pulse);
        
        // Inner damage zone - turquoise energy
        fill(64, 224, 208, alpha * 0.5);
        ellipse(0, 0, this.radius * 2 * pulse);
        
        // Cosmic aurora plasma particles
        for (const p of this.particles) {
            const x = cos(p.angle) * p.distance;
            const y = sin(p.angle) * p.distance;
            
            // Cycle through cosmic aurora colors
            const colorPhase = (p.angle + colorShift) % (TWO_PI * 2);
            let particleColor;
            if (colorPhase < TWO_PI * 0.5) {
                particleColor = color(138, 43, 226); // Blue violet
            } else if (colorPhase < TWO_PI) {
                particleColor = color(64, 224, 208); // Turquoise
            } else if (colorPhase < TWO_PI * 1.5) {
                particleColor = color(255, 20, 147); // Deep pink
            } else {
                particleColor = color(255, 215, 0); // Gold
            }
            
            fill(red(particleColor), green(particleColor), blue(particleColor), p.brightness * (alpha / 150));
            noStroke();
            ellipse(x, y, p.size);
            
            // Enhanced particle glow with aurora colors
            fill(red(particleColor) + 50, green(particleColor) + 50, blue(particleColor) + 50, p.brightness * 0.3 * (alpha / 150));
            ellipse(x, y, p.size * 2);
            
            // Add sparkle effect for bright particles
            if (p.brightness > 200) {
                fill(255, 255, 255, p.brightness * 0.4 * (alpha / 150));
                ellipse(x, y, p.size * 0.5);
            }
        }
        
        // Warning text
        if (this.timer < 120) { // Show warning for first 2 seconds
            fill(255, 255, 255, alpha);
            textAlign(CENTER, CENTER);
            textSize(12);
            text("PLASMA HAZARD", 0, -this.maxRadius - 20);
        }
        
        pop();
    }
    
    checkDamage(target) {
        const distance = dist(this.x, this.y, target.x, target.y);
        return distance < this.radius;
    }
} 