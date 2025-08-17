import { sin, cos, random, PI, TWO_PI } from '@vibe/core/mathUtils.js';

/**
 * Psychedelic Space Effects - Dark, Colorful, Funny, Trippy
 * Using p5.js for maximum visual impact
 */
export class PsychedelicEffects {
  constructor() {
    this.cosmicTime = 0;
    this.warpIntensity = 0;
    this.colorShift = 0;
    this.tripLevel = 0;
    
    // Muted palette based on game's explosion colors
    this.tripPalette = [
      [138, 43, 126],  // Muted blue violet (from tank)
      [155, 20, 97],   // Muted deep pink (from rusher)  
      [100, 155, 100], // Muted green (from grunt)
      [200, 160, 50],  // Muted gold (from stabber)
      [120, 80, 150],  // Muted purple
      [90, 130, 90],   // Muted forest green
      [150, 100, 120], // Muted mauve
      [110, 90, 140],  // Muted lavender
    ];
    
    this.cosmicPalette = [
      [138, 43, 226],  // Blue violet
      [255, 20, 147],  // Deep pink
      [0, 191, 255],   // Deep sky blue
      [148, 0, 211],   // Dark violet
      [255, 105, 180], // Hot pink
      [64, 224, 208],  // Turquoise
    ];
    
    // Wormhole particles
    this.wormholeParticles = [];
    for (let i = 0; i < 50; i++) {
      this.wormholeParticles.push({
        angle: random(TWO_PI),
        radius: random(20, 300),
        speed: random(0.002, 0.008), // 10x slower wormhole particles
        size: random(2, 8),
        colorIndex: Math.floor(random(this.tripPalette.length)),
        life: random(100, 200),
        maxLife: random(100, 200)
      });
    }
  }
  
  update(deltaTimeMs = 16.6667) {
    const dt = deltaTimeMs / 16.6667;
    this.cosmicTime += dt * 0.002; // 10x slower cosmic time
    this.colorShift += dt * 0.003; // 10x slower color shifting
    
    // Update wormhole particles
    this.wormholeParticles.forEach(particle => {
      particle.angle += particle.speed;
      particle.radius += sin(this.cosmicTime + particle.angle) * 2;
      particle.life -= dt;
      
      if (particle.life <= 0) {
        particle.angle = random(TWO_PI);
        particle.radius = random(20, 300);
        particle.life = particle.maxLife;
      }
    });
  }
  
  /**
   * Draw psychedelic space wormhole effect
   */
  drawCosmicWormhole(p, centerX, centerY, intensity = 1.0) {
    p.push();
    p.translate(centerX, centerY);
    
    // Draw wormhole tunnel
    for (let r = 300; r > 10; r -= 15) {
      const colorPhase = this.cosmicTime + r * 0.01;
      const colorIndex = Math.floor((colorPhase * 2) % this.tripPalette.length);
      const color = this.tripPalette[colorIndex];
      
      const alpha = (300 - r) / 300 * 60 * intensity;
      p.fill(color[0], color[1], color[2], alpha);
      p.noStroke();
      
      // Warped circle
      const segments = 20;
      p.beginShape();
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * TWO_PI;
        const warp = sin(colorPhase + angle * 3) * 10;
        const radius = r + warp;
        const x = cos(angle) * radius;
        const y = sin(angle) * radius;
        p.vertex(x, y);
      }
      p.endShape(p.CLOSE);
    }
    
    // Draw wormhole particles
    this.wormholeParticles.forEach(particle => {
      const x = cos(particle.angle) * particle.radius;
      const y = sin(particle.angle) * particle.radius;
      const color = this.tripPalette[particle.colorIndex];
      const alpha = (particle.life / particle.maxLife) * 150;
      
      p.fill(color[0], color[1], color[2], alpha);
      p.noStroke();
      p.ellipse(x, y, particle.size, particle.size);
      
      // Trailing glow
      p.fill(color[0], color[1], color[2], alpha * 0.3);
      p.ellipse(x, y, particle.size * 2, particle.size * 2);
    });
    
    p.pop();
  }
  
  /**
   * Draw subtle background waves that blend into space
   */
  drawBackgroundWaves(p) {
    p.push();
    p.noFill();
    p.strokeWeight(1); // Much thinner for subtlety
    
    for (let wave = 0; wave < 3; wave++) {
      p.beginShape();
      p.noFill();
      
      for (let x = 0; x <= p.width; x += 20) { // Fewer points for smoother look
        const y = p.height * 0.7 + // Move to lower part of screen
                 sin(x * 0.008 + this.cosmicTime * 0.3 + wave * 0.8) * 15 + // Smaller amplitude
                 sin(x * 0.004 + this.cosmicTime * 0.2 + wave * 0.5) * 10;  // Slower movement
        
        const colorPhase = x * 0.005 + this.colorShift * 0.5 + wave * 0.5;
        const colorIndex = Math.floor((colorPhase * 2) % this.cosmicPalette.length);
        const color = this.cosmicPalette[colorIndex]; // Use cosmic palette for background
        
        p.stroke(color[0], color[1], color[2], 15 + wave * 5); // Much more transparent
        p.vertex(x, y);
      }
      p.endShape();
    }
    
    p.pop();
  }
  
  /**
   * Draw cosmic kaleidoscope patterns
   */
  drawKaleidoscope(p, centerX, centerY, size = 100) {
    p.push();
    p.translate(centerX, centerY);
    
    const segments = 8;
    for (let seg = 0; seg < segments; seg++) {
      p.push();
      p.rotate((seg / segments) * TWO_PI);
      
      // Create triangular clip mask effect
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * PI / segments;
        const radius = i * 5 + sin(this.cosmicTime + i * 0.1) * 20;
        
        const colorPhase = this.cosmicTime + i * 0.2 + seg * 0.1;
        const colorIndex = Math.floor((colorPhase * 4) % this.cosmicPalette.length);
        const color = this.cosmicPalette[colorIndex];
        
        p.fill(color[0], color[1], color[2], 80);
        p.noStroke();
        
        const x = cos(angle) * radius;
        const y = sin(angle) * radius;
        p.ellipse(x, y, 8, 8);
      }
      
      p.pop();
    }
    
    p.pop();
  }
  
  /**
   * Draw trippy cosmic dust with color cycling
   */
  drawPsychedelicDust(p, count = 30) {
    p.push();
    
    for (let i = 0; i < count; i++) {
      const x = random(p.width);
      const y = random(p.height);
      const phase = this.cosmicTime + i * 0.1;
      
      const colorIndex = Math.floor((phase * 5) % this.tripPalette.length);
      const color = this.tripPalette[colorIndex];
      
      const pulse = sin(phase * 3) * 0.5 + 0.5;
      const size = 2 + pulse * 4;
      const alpha = 50 + pulse * 100;
      
      p.fill(color[0], color[1], color[2], alpha);
      p.noStroke();
      p.ellipse(x, y, size, size);
      
      // Add sparkle effect
      if (pulse > 0.8) {
        p.fill(255, 255, 255, alpha * 0.5);
        p.ellipse(x, y, size * 0.5, size * 0.5);
      }
    }
    
    p.pop();
  }
  
  /**
   * Draw chromatic aberration effect
   */
  drawChromaticShift(p, intensity = 0.5) {
    if (intensity <= 0) return;
    
    p.push();
    
    // Subtle RGB channel shift for trippy effect
    const shift = intensity * 3;
    
    // This is a simplified version - real chromatic aberration would need shaders
    p.tint(255, 0, 0, 30);
    p.translate(shift, 0);
    // Here you'd redraw key elements with red tint
    
    p.tint(0, 255, 0, 30);
    p.translate(-shift, 0);
    // Here you'd redraw key elements with green tint
    
    p.tint(0, 0, 255, 30);
    p.translate(-shift, 0);
    // Here you'd redraw key elements with blue tint
    
    p.noTint();
    p.pop();
  }
  
  /**
   * Trigger cosmic explosion effect
   */
  triggerCosmicBlast(x, y, intensity = 1.0) {
    this.warpIntensity = Math.max(this.warpIntensity, intensity);
    this.tripLevel = Math.max(this.tripLevel, intensity * 0.5);
    
    // Add extra wormhole particles
    for (let i = 0; i < 10; i++) {
      this.wormholeParticles.push({
        angle: random(TWO_PI),
        radius: random(10, 50),
        speed: random(0.05, 0.15),
        size: random(3, 12),
        colorIndex: Math.floor(random(this.tripPalette.length)),
        life: random(50, 100),
        maxLife: random(50, 100)
      });
    }
  }
}