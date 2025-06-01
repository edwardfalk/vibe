/**
 * Basic explosion effects system
 * Handles particle-based explosions for various game events
 */
export class Explosion {
    constructor(x, y, type = 'enemy') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.particles = [];
        this.active = true;
        this.timer = 0;
        this.maxTimer = 30; // frames
        
        // TONED DOWN: Reduced screen shake and flash effects
        this.screenShake = 0; // Removed - game.js handles screen shake
        this.flashIntensity = 0; // Removed flash effects for less overwhelming experience
        this.sparkles = []; // For magical/energy effects (only for special enemies)
        this.trails = []; // For particle trails (only for special enemies)
        
        // Create particles based on explosion type - DRASTICALLY REDUCED FOR LESS OVERWHELMING EXPERIENCE
        let particleCount;
        if (type === 'tank-plasma') {
            particleCount = 15; // Keep for rare tanks
            this.flashIntensity = 0.3;
        } else if (type === 'rusher-explosion') {
            particleCount = 25; // Increased from 12 for much more dramatic explosion
            this.flashIntensity = 0.4; // Increased from 0.2 for more dramatic flash
        } else if (type === 'grunt-bullet-kill') {
            particleCount = 3; // Drastically reduced from 6 - grunts are too common
            this.flashIntensity = 0; // No flash for basic enemies
        } else if (type === 'grunt-plasma-kill') {
            particleCount = 4; // Reduced from 8
            this.flashIntensity = 0; // No flash
        } else if (type === 'rusher-bullet-kill') {
            particleCount = 6; // Reduced from 10
            this.flashIntensity = 0; // No flash for common enemy
        } else if (type === 'rusher-plasma-kill') {
            particleCount = 8; // Reduced from 12
            this.flashIntensity = 0.1; // Minimal flash
        } else if (type === 'tank-bullet-kill') {
            particleCount = 18; // Keep for rare tanks
            this.flashIntensity = 0.4;
            this.createArmorFragments(); // Keep special effects for tanks
        } else if (type === 'tank-plasma-kill') {
            particleCount = 20; // Keep for rare tanks
            this.flashIntensity = 0.5;
            this.createEnergyRings(); // Keep special effects for tanks
        } else if (type === 'stabber-bullet-kill') {
            particleCount = 4; // Reduced from 8
            this.flashIntensity = 0; // No flash
        } else if (type === 'stabber-plasma-kill') {
            particleCount = 6; // Reduced from 10
            this.flashIntensity = 0; // No flash
        } else if (type === 'enemy') {
            particleCount = 4; // Reduced from 8
            this.flashIntensity = 0; // No flash for basic explosions
        } else {
            particleCount = 3; // Reduced from 6
            this.flashIntensity = 0; // No flash for basic hits
        }
        
        // REMOVED: Screen shake application - game.js handles this better
        
        // Much shorter explosion durations - less overwhelming for frequent kills
        if (type === 'tank-plasma') {
            this.maxTimer = 50; // Reduced from 60
        } else if (type === 'rusher-explosion') {
            this.maxTimer = 50; // Increased from 30 for longer dramatic effect
        } else if (type.includes('plasma-kill')) {
            this.maxTimer = 25; // Reduced from 45
        } else if (type.includes('bullet-kill')) {
            this.maxTimer = 20; // Reduced from 30
        }
        
        // Keep shockwave only for major explosions
        this.hasShockwave = (type === 'rusher-explosion' || type === 'tank-plasma' || type === 'tank-plasma-kill');
        this.shockwaveRadius = 0;
        this.maxShockwaveRadius = type === 'rusher-explosion' ? 120 : 60; // Increased rusher radius from 80 to 120
        
        // SIMPLIFIED: Only keep special effects for tanks
        this.hasElectricalArcs = false; // Removed from grunts
        this.hasSpeedTrails = false; // Removed from rushers
        this.hasArmorFragments = (type === 'tank-bullet-kill');
        this.hasBladeFragments = false; // Removed from stabbers
        this.hasEnergyDischarge = (type.includes('tank') && type.includes('plasma-kill'));
        this.hasEnergyRings = (type === 'tank-plasma-kill');
        this.hasEnergyBlades = false; // Removed from stabbers
        
        for (let i = 0; i < particleCount; i++) {
            // Simplified particle properties - less dramatic
            let vxRange, vyRange, sizeRange, lifeRange;
            
            if (type === 'tank-plasma') {
                vxRange = [-2, 2]; vyRange = [-2, 2]; // Reduced from [-3, 3]
                sizeRange = [4, 10]; lifeRange = [50, 70]; // Reduced size and life
            } else if (type === 'rusher-explosion') {
                vxRange = [-8, 8]; vyRange = [-8, 8]; // Increased from [-5, 5] for more dramatic spread
                sizeRange = [6, 18]; lifeRange = [40, 80]; // Increased size and life for much more visibility
            } else if (type === 'grunt-bullet-kill') {
                vxRange = [-3, 3]; vyRange = [-3, 3]; // Reduced from [-5, 5]
                sizeRange = [2, 5]; lifeRange = [20, 35]; // Much smaller and shorter
            } else if (type === 'grunt-plasma-kill') {
                vxRange = [-3, 3]; vyRange = [-3, 3]; // Reduced from [-4, 4]
                sizeRange = [3, 6]; lifeRange = [30, 45]; // Reduced
            } else if (type === 'rusher-bullet-kill') {
                vxRange = [-4, 4]; vyRange = [-4, 4]; // Reduced from [-9, 9], [-6, 6]
                sizeRange = [3, 8]; lifeRange = [20, 35]; // Reduced
            } else if (type === 'rusher-plasma-kill') {
                vxRange = [-4, 4]; vyRange = [-4, 4]; // Reduced from [-6, 6]
                sizeRange = [3, 8]; lifeRange = [25, 40]; // Reduced
            } else if (type === 'tank-bullet-kill') {
                vxRange = [-3, 3]; vyRange = [-3, 3]; // Reduced from [-4, 4], [-3, 5]
                sizeRange = [4, 10]; lifeRange = [40, 60]; // Reduced
            } else if (type === 'tank-plasma-kill') {
                vxRange = [-4, 4]; vyRange = [-4, 4]; // Reduced from [-5, 5]
                sizeRange = [5, 12]; lifeRange = [45, 70]; // Reduced
            } else if (type === 'stabber-bullet-kill') {
                vxRange = [-3, 3]; vyRange = [-3, 3]; // Reduced from [-6, 6], [-4, 4]
                sizeRange = [2, 6]; lifeRange = [25, 40]; // Reduced
            } else if (type === 'stabber-plasma-kill') {
                vxRange = [-3, 3]; vyRange = [-3, 3]; // Reduced from [-5, 5]
                sizeRange = [3, 7]; lifeRange = [30, 45]; // Reduced
            } else if (type === 'grunt-death') {
                vxRange = [-3, 3]; vyRange = [-3, 3]; // Reduced from [-4, 4]
                sizeRange = [3, 6]; lifeRange = [20, 35]; // Reduced
            } else if (type === 'stabber-death') {
                vxRange = [-3, 3]; vyRange = [-3, 3]; // Reduced from [-5, 5]
                sizeRange = [2, 6]; lifeRange = [25, 40]; // Reduced
            } else if (type === 'tank-death') {
                vxRange = [-3, 3]; vyRange = [-3, 3]; // Reduced from [-4, 4]
                sizeRange = [4, 8]; lifeRange = [35, 50]; // Reduced
            } else if (type === 'enemy') {
                vxRange = [-3, 3]; vyRange = [-3, 3]; // Reduced from [-5, 5]
                sizeRange = [3, 6]; lifeRange = [20, 35]; // Reduced
            } else {
                vxRange = [-2, 2]; vyRange = [-2, 2]; // Reduced from [-4, 4]
                sizeRange = [2, 5]; lifeRange = [15, 25]; // Reduced
            }
            
            this.particles.push({
                x: x + random(-3, 3), // Reduced spawn variation
                y: y + random(-3, 3),
                vx: random(vxRange[0], vxRange[1]),
                vy: random(vyRange[0], vyRange[1]),
                size: random(sizeRange[0], sizeRange[1]),
                color: this.getParticleColor(type, p),
                life: random(lifeRange[0], lifeRange[1]),
                maxLife: random(lifeRange[0], lifeRange[1]),
                rotation: random(TWO_PI),
                rotationSpeed: random(-0.2, 0.2), // Reduced rotation speed
                // Simplified physics
                trail: [],
                gravity: random(0.01, 0.05), // Reduced gravity
                friction: random(0.99, 0.998), // Reduced friction
                glow: random(0.2, 0.5), // Reduced glow intensity
                sparkle: random() < 0.1, // Reduced sparkle chance from 30% to 10%
                isArmor: false
            });
        }
    }
    
    // ENHANCED: Create armor fragments for tank kills
    createArmorFragments() {
        for (let i = 0; i < 5; i++) {
            this.particles.push({
                x: this.x + random(-10, 10),
                y: this.y + random(-10, 10),
                vx: random(-3, 3),
                vy: random(-2, 4), // Bias downward for falling debris
                size: random(8, 16),
                color: color(100, 100, 120), // Metallic gray
                life: random(60, 90),
                maxLife: random(60, 90),
                rotation: random(TWO_PI),
                rotationSpeed: random(-0.2, 0.2),
                trail: [],
                gravity: 0.15, // Heavy gravity for armor
                friction: 0.95,
                glow: 0.2,
                sparkle: false,
                isArmor: true // Special flag for armor rendering
            });
        }
    }
    
    // ENHANCED: Create energy rings for massive tank plasma kills
    createEnergyRings() {
        for (let i = 0; i < 3; i++) {
            this.sparkles.push({
                x: this.x,
                y: this.y,
                radius: 10 + i * 15,
                maxRadius: 80 + i * 20,
                life: random(40, 60),
                maxLife: random(40, 60),
                intensity: random(0.6, 0.9),
                type: 'energyRing',
                ringIndex: i
            });
        }
    }
    
    getParticleColor(type, p) {
        if (type === 'tank-plasma') {
            const colors = [
                p.color(138, 43, 226),
                p.color(64, 224, 208),
                p.color(255, 20, 147),
                p.color(255, 255, 255),
                p.color(0, 191, 255),
                p.color(255, 215, 0)
            ];
            return random(colors);
        } else if (type === 'rusher-explosion') {
            const colors = [
                p.color(255, 20, 147),
                p.color(255, 69, 0),
                p.color(255, 215, 0),
                p.color(255, 255, 255),
                p.color(255, 140, 0),
                p.color(255, 182, 193),
                p.color(255, 255, 0)
            ];
            return random(colors);
        } else if (type === 'grunt-death') {
            const colors = [
                p.color(50, 205, 50),
                p.color(0, 255, 127),
                p.color(34, 139, 34),
                p.color(255, 255, 255),
                p.color(144, 238, 144),
                p.color(0, 255, 0)
            ];
            return random(colors);
        } else if (type === 'stabber-death') {
            const colors = [
                p.color(255, 215, 0),
                p.color(255, 255, 0),
                p.color(255, 140, 0),
                p.color(255, 255, 255),
                p.color(218, 165, 32),
                p.color(255, 248, 220)
            ];
            return random(colors);
        } else if (type === 'tank-death') {
            const colors = [
                p.color(138, 43, 226),
                p.color(123, 104, 238),
                p.color(72, 61, 139),
                p.color(255, 255, 255),
                p.color(0, 191, 255),
                p.color(147, 112, 219)
            ];
            return random(colors);
        } else if (type.includes('bullet-kill') || type.includes('plasma-kill')) {
            if (type.includes('grunt')) {
                return this.getParticleColor('grunt-death', p);
            } else if (type.includes('stabber')) {
                return this.getParticleColor('stabber-death', p);
            } else if (type.includes('tank')) {
                return this.getParticleColor('tank-death', p);
            } else if (type.includes('rusher')) {
                return this.getParticleColor('rusher-explosion', p);
            }
        }
        const colors = [
            p.color(255, 69, 0),
            p.color(255, 140, 0),
            p.color(255, 215, 0),
            p.color(255, 255, 255),
            p.color(255, 20, 147),
            p.color(138, 43, 226)
        ];
        return random(colors);
    }
    
    update() {
        this.timer++;
        
        // Update shockwave with safety bounds
        if (this.hasShockwave && this.shockwaveRadius < this.maxShockwaveRadius) {
            this.shockwaveRadius += this.maxShockwaveRadius / 20; // Expand over 20 frames
            
            // Safety check: ensure shockwave doesn't exceed maximum
            if (this.shockwaveRadius >= this.maxShockwaveRadius) {
                this.shockwaveRadius = this.maxShockwaveRadius;
            }
        }
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Apply physics
            p.vx *= p.friction;
            p.vy *= p.friction;
            p.vy += p.gravity;
            
            // Update position
            p.x += p.vx;
            p.y += p.vy;
            
            // Update rotation
            p.rotation += p.rotationSpeed;
            
            // Update life
            p.life--;
            
            // Update trail
            if (p.trail.length > 5) {
                p.trail.shift();
            }
            p.trail.push({ x: p.x, y: p.y, alpha: p.life / p.maxLife });
            
            // Remove dead particles
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // Update sparkles (energy rings)
        for (let i = this.sparkles.length - 1; i >= 0; i--) {
            const s = this.sparkles[i];
            s.life--;
            
            if (s.type === 'energyRing') {
                s.radius += (s.maxRadius - s.radius) * 0.1;
                
                // Safety check: ensure energy rings don't exceed maximum
                if (s.radius >= s.maxRadius) {
                    s.radius = s.maxRadius;
                }
            }
            
            if (s.life <= 0) {
                this.sparkles.splice(i, 1);
            }
        }
        
        // Enhanced termination check: explosion is finished when timer expires OR all effects are done
        const shockwaveFinished = !this.hasShockwave || this.shockwaveRadius >= this.maxShockwaveRadius;
        const timerExpired = this.timer >= this.maxTimer;
        const noParticles = this.particles.length === 0;
        const noSparkles = this.sparkles.length === 0;
        
        if ((timerExpired && noParticles && noSparkles) || (shockwaveFinished && noParticles && noSparkles && this.timer > 20)) {
            this.active = false;
        }
    }
    
    draw(p) {
        p.push();
        
        // Draw shockwave
        if (this.hasShockwave && this.shockwaveRadius > 0) {
            p.stroke(255, 255, 255, 100 * (1 - this.shockwaveRadius / this.maxShockwaveRadius));
            p.strokeWeight(3);
            p.noFill();
            p.ellipse(this.x, this.y, this.shockwaveRadius * 2);
        }
        
        // Draw energy rings
        for (const s of this.sparkles) {
            if (s.type === 'energyRing') {
                const alpha = (s.life / s.maxLife) * s.intensity * 255;
                p.stroke(138, 43, 226, alpha); // Blue violet energy
                p.strokeWeight(2 + s.ringIndex);
                p.noFill();
                p.ellipse(s.x, s.y, s.radius * 2);
            }
        }
        
        // Draw particles
        for (const particle of this.particles) {
            const alpha = (particle.life / particle.maxLife) * 255;
            
            // Draw glow effect
            if (particle.glow > 0) {
                p.fill(p.red(particle.color), p.green(particle.color), p.blue(particle.color), alpha * particle.glow * 0.3);
                p.noStroke();
                p.ellipse(particle.x, particle.y, particle.size * 2);
            }
            
            // Draw main particle
            p.fill(p.red(particle.color), p.green(particle.color), p.blue(particle.color), alpha);
            p.noStroke();
            
            if (particle.isArmor) {
                // Draw armor fragments as rectangles
                p.push();
                p.translate(particle.x, particle.y);
                p.rotate(particle.rotation);
                p.rect(-particle.size/2, -particle.size/2, particle.size, particle.size);
                p.pop();
            } else if (particle.sparkle) {
                // Draw sparkle particles as stars
                p.push();
                p.translate(particle.x, particle.y);
                p.rotate(particle.rotation);
                for (let i = 0; i < 4; i++) {
                    p.rotate(PI/2);
                    p.line(0, 0, particle.size, 0);
                }
                p.pop();
            } else {
                // Draw normal particles as circles
                p.ellipse(particle.x, particle.y, particle.size);
            }
            
            // Draw particle trail
            if (particle.trail.length > 1) {
                p.stroke(p.red(particle.color), p.green(particle.color), p.blue(particle.color), alpha * 0.5);
                p.strokeWeight(1);
                p.noFill();
                p.beginShape();
                for (const t of particle.trail) {
                    p.vertex(t.x, t.y);
                }
                p.endShape();
            }
        }
        
        p.pop();
    }
} 