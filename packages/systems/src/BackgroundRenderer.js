// Requires p5.js for random(), sin(), cos(), TWO_PI, lerp(), etc.
/**
 * BackgroundRenderer.js - Handles all background drawing including parallax, cosmic effects, and space elements
 */

import {
  max,
  min,
  floor,
  ceil,
  round,
  sin,
  cos,
  sqrt,
  random,
  randomRange,
} from '@vibe/core';

import { PsychedelicEffects } from '@vibe/fx/PsychedelicEffects.js';
import { BACKGROUND_CONFIG } from './backgroundConfig.js';

/**
 * @param {p5} p - The p5 instance
 * @param {CameraSystem} cameraSystem - The camera system controlling parallax (dependency injected for modularity)
 * @param {Player} player - The player object (dependency injected for modularity)
 * @param {GameState} gameState - The game state object (dependency injected for modularity)
 */
export class BackgroundRenderer {
  constructor(p, cameraSystem, player, gameState) {
    this.p = p;
    this.cameraSystem = cameraSystem;
    this.player = player;
    this.gameState = gameState;
    // Parallax background layers
    this.parallaxLayers = [];
    this.parallaxInitialized = false;

    // Psychedelic effects system
    this.psychedelicEffects = new PsychedelicEffects();
    // Smooth wormhole appearance based on enemy count
    this.wormholeIntensity = 0;
  }

  // Initialize parallax background layers
  createParallaxBackground(p = this.p) {
    if (this.parallaxInitialized) return;

    console.log('🌌 Creating parallax background layers...');

    this.parallaxLayers = [
      {
        name: 'distant_stars',
        elements: [],
        speed: 0.1,
        depth: 0.9,
      },
      {
        name: 'nebula_clouds',
        elements: [],
        speed: 0.3,
        depth: 0.7,
      },
      {
        name: 'medium_stars',
        elements: [],
        speed: 0.5,
        depth: 0.5,
      },
      {
        name: 'close_debris',
        elements: [],
        speed: 0.8,
        depth: 0.3,
      },
      {
        name: 'foreground_sparks',
        elements: [],
        speed: 1.2,
        depth: 0.1,
      },
    ];

    // Generate elements for each layer
    this.generateLayerElements(p);
    this.parallaxInitialized = true;

    console.log(
      '✅ Parallax background created with',
      this.parallaxLayers.length,
      'layers'
    );
  }

  // Generate elements for parallax layers
  generateLayerElements(p = this.p) {
    // Distant stars layer
    const distantStars = this.parallaxLayers[0];
    for (let i = 0; i < 50; i++) {
      distantStars.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(1, 3),
        brightness: randomRange(0.3, 1),
        twinkleSpeed: randomRange(0.01, 0.03), // Restored original twinkling speed
      });
    }

    // Nebula clouds layer
    const nebulaClouds = this.parallaxLayers[1];
    for (let i = 0; i < 8; i++) {
      nebulaClouds.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(100, 300),
        color: {
          r: randomRange(40, 80),
          g: randomRange(20, 60),
          b: randomRange(60, 120),
        },
        alpha: randomRange(0.05, 0.15),
        driftSpeed: randomRange(0.1, 0.3), // Restored original drift speed
      });
    }

    // Medium stars layer
    const mediumStars = this.parallaxLayers[2];
    for (let i = 0; i < 30; i++) {
      mediumStars.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(2, 5),
        brightness: randomRange(0.5, 1),
        color: ['white', 'blue', 'yellow', 'orange'][floor(random() * 4)],
      });
    }

    // Close debris layer
    const closeDebris = this.parallaxLayers[3];
    for (let i = 0; i < 15; i++) {
      closeDebris.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(3, 8),
        rotation: randomRange(0, p.TWO_PI),
        rotationSpeed: randomRange(-0.02, 0.02),
        shape: ['triangle', 'square', 'diamond'][floor(random() * 3)],
      });
    }

    // Foreground sparks layer
    const foregroundSparks = this.parallaxLayers[4];
    for (let i = 0; i < 60; i++) {
      foregroundSparks.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(2, 4),
        alpha: randomRange(150, 255),
        flickerSpeed: randomRange(0.05, 0.15), // Restored original flicker speed
      });
    }
  }

  // Draw parallax background
  drawParallaxBackground(p = this.p) {
    if (!this.parallaxInitialized) {
      this.createParallaxBackground(p);
    }
    p.push();
    // Use injected cameraSystem for robust, modular parallax offset (do not use global or p.cameraSystem)
    const cameraX = this.cameraSystem ? this.cameraSystem.x : 0;
    const cameraY = this.cameraSystem ? this.cameraSystem.y : 0;
    for (const layer of this.parallaxLayers) {
      this.drawParallaxLayer(layer, cameraX, cameraY, p);
    }
    p.pop();
  }

  // Draw individual parallax layer
  drawParallaxLayer(layer, cameraX, cameraY, p = this.p) {
    p.push();

    // Apply parallax offset
    const parallaxX = cameraX * layer.speed;
    const parallaxY = cameraY * layer.speed;
    p.translate(-parallaxX, -parallaxY);

    // Draw layer elements based on type
    switch (layer.name) {
      case 'distant_stars':
        this.drawDistantStars(layer.elements, p);
        break;
      case 'nebula_clouds':
        this.drawNebulaClouds(layer.elements, p);
        break;
      case 'medium_stars':
        this.drawMediumStars(layer.elements, p);
        break;
      case 'close_debris':
        this.drawCloseDebris(layer.elements, p);
        break;
      case 'foreground_sparks':
        this.drawForegroundSparks(layer.elements, p);
        break;
    }

    p.pop();
  }

  // Draw distant stars with twinkling
  drawDistantStars(stars, p = this.p) {
    p.noStroke();
    for (const star of stars) {
      const twinkle = p.sin(p.frameCount * star.twinkleSpeed) * 0.5 + 0.5;
      const alpha = star.brightness * twinkle * 255;

      p.fill(255, 255, 255, alpha);
      p.ellipse(star.x, star.y, star.size, star.size);
    }
  }

  // Draw nebula clouds
  drawNebulaClouds(clouds, p = this.p) {
    p.noStroke();
    for (const cloud of clouds) {
      const drift = p.sin(p.frameCount * cloud.driftSpeed) * 20;
      const alpha = cloud.alpha * 255;

      p.fill(cloud.color.r, cloud.color.g, cloud.color.b, alpha);
      p.ellipse(cloud.x + drift, cloud.y, cloud.size, cloud.size * 0.6);
    }
  }

  // Draw medium stars
  drawMediumStars(stars, p = this.p) {
    p.noStroke();
    for (const star of stars) {
      switch (star.color) {
        case 'blue':
          p.fill(173, 216, 230, star.brightness * 255);
          break;
        case 'yellow':
          p.fill(255, 255, 224, star.brightness * 255);
          break;
        case 'orange':
          p.fill(255, 165, 0, star.brightness * 255);
          break;
        default:
          p.fill(255, 255, 255, star.brightness * 255);
      }
      p.ellipse(star.x, star.y, star.size, star.size);
    }
  }

  // Draw close debris
  drawCloseDebris(debris, p = this.p) {
    p.stroke(100, 100, 100, 150);
    p.strokeWeight(1);
    p.noFill();

    for (const piece of debris) {
      p.push();
      p.translate(piece.x, piece.y);
      p.rotate(piece.rotation);

      switch (piece.shape) {
        case 'triangle':
          p.triangle(
            -piece.size / 2,
            piece.size / 2,
            piece.size / 2,
            piece.size / 2,
            0,
            -piece.size / 2
          );
          break;
        case 'square':
          p.rect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
          break;
        case 'diamond':
          p.quad(
            0,
            -piece.size / 2,
            piece.size / 2,
            0,
            0,
            piece.size / 2,
            -piece.size / 2,
            0
          );
          break;
      }
      p.pop();
    }
  }

  // Update parallax elements' state (separate from draw)
  updateParallaxElements(deltaTime = 1) {
    if (!this.parallaxInitialized || !Array.isArray(this.parallaxLayers))
      return;
    // Find close debris layer robustly; fallback to index 3 if naming changed
    let closeDebrisLayer = this.parallaxLayers.find(
      (layer) => layer && layer.name === 'close_debris'
    );
    if (!closeDebrisLayer && this.parallaxLayers[3]) {
      closeDebrisLayer = this.parallaxLayers[3];
    }
    if (!closeDebrisLayer || !Array.isArray(closeDebrisLayer.elements)) return;
    const elements = closeDebrisLayer.elements;
    for (let i = 0; i < elements.length; i++) {
      const piece = elements[i];
      // Advance rotation using delta time scaling
      piece.rotation += (piece.rotationSpeed || 0) * deltaTime;
    }
  }

  // Draw foreground sparks
  drawForegroundSparks(sparks, p = this.p) {
    p.noStroke();
    for (const spark of sparks) {
      const flicker = p.sin(p.frameCount * spark.flickerSpeed) * 0.5 + 0.5;
      p.fill(255, 255, 255, spark.alpha * flicker);
      p.ellipse(spark.x, spark.y, spark.size, spark.size);
    }
  }

  // Draw cosmic aurora background
  drawCosmicAuroraBackground(p = this.p) {
    p.push();

    // Create smooth gradient using many small steps to eliminate stripes
    const gradientSteps = 120; // Much higher resolution for smooth gradient
    const stepHeight = p.height / gradientSteps;

    for (let i = 0; i < gradientSteps; i++) {
      const inter = i / (gradientSteps - 1);

      // Darker cosmic gradient colors (inspired by user preference for black background)
      let r, g, b;
      if (inter < 0.4) {
        // Very deep space black to dark purple
        const t = p.map(inter, 0, 0.4, 0, 1);
        r = p.lerp(2, 12, t); // Much darker starting point
        g = p.lerp(0, 8, t); // Very dark
        b = p.lerp(8, 25, t); // Subtle deep blue-purple
      } else if (inter < 0.8) {
        // Dark purple to subtle cosmic blue
        const t = p.map(inter, 0.4, 0.8, 0, 1);
        r = p.lerp(12, 8, t); // Darker throughout
        g = p.lerp(8, 15, t); // Less bright
        b = p.lerp(25, 35, t); // Darker blue
      } else {
        // Subtle cosmic blue to very dark purple
        const t = p.map(inter, 0.8, 1, 0, 1);
        r = p.lerp(8, 15, t); // Keep dark
        g = p.lerp(15, 5, t); // Fade to darkness
        b = p.lerp(35, 20, t); // Dark finish
      }

      // Very subtle time-based variation for darker, more mysterious feel
      const timeShift = p.sin(p.frameCount * 0.003 + inter) * 2; // Restored original speed
      r += timeShift * 0.2;
      g += timeShift * 0.1;
      b += timeShift * 0.3;

      p.fill(r, g, b);
      p.noStroke();
      p.rect(0, i * stepHeight, p.width, stepHeight + 1);
    }

    p.pop();
  }

  // Draw enhanced space elements
  drawEnhancedSpaceElements(p = this.p) {
    p.push();

    // Flowing nebula streams
    p.fill(64, 224, 208, 12);
    p.noStroke();
    for (let i = 0; i < 12; i++) {
      const streamX = ((i * 97 + p.frameCount * 0.15) % (p.width + 150)) - 75;
      const streamY = (i * 143) % p.height;
      const streamSize = 80 + p.sin(p.frameCount * 0.008 + i) * 30;
      const streamFlow = p.sin(p.frameCount * 0.01 + i * 0.5) * 20;

      // Create flowing stream effect
      for (let j = 0; j < 5; j++) {
        const segmentX = streamX + j * 15 + streamFlow;
        const segmentY = streamY + p.sin(p.frameCount * 0.006 + i + j) * 10;
        const segmentAlpha = 12 - j * 2;
        p.fill(64 + j * 10, 224 - j * 5, 208 + j * 8, segmentAlpha);
        p.ellipse(
          segmentX,
          segmentY,
          streamSize - j * 10,
          (streamSize - j * 10) * 0.6
        );
      }
    }

    // Enhanced aurora wisps
    for (let i = 0; i < 8; i++) {
      const wispX = ((i * 127 + p.frameCount * 0.08) % (p.width + 100)) - 50;
      const wispY = (i * 179) % p.height;
      const wispSize = 100 + p.cos(p.frameCount * 0.006 + i) * 35;
      const colorPhase = p.frameCount * 0.01 + i;

      const r = 138 + p.sin(colorPhase) * 50;
      const g = 43 + p.cos(colorPhase * 1.3) * 40;
      const b = 226 + p.sin(colorPhase * 0.7) * 30;

      p.fill(r, g, b, 15);
      p.ellipse(wispX, wispY, wispSize, wispSize * 0.4);

      p.fill(r * 0.8, g * 0.8, b * 0.8, 8);
      p.ellipse(wispX - 20, wispY, wispSize * 0.7, wispSize * 0.3);
    }

    // Shooting stars
    for (let i = 0; i < 3; i++) {
      const starLife = (p.frameCount + i * 200) % 600;
      if (starLife < 120) {
        const progress = starLife / 120;
        const startX = -50 + i * 300;
        const startY = 50 + i * 150;
        const endX = p.width + 100;
        const endY = p.height - 100 - i * 100;

        const starX = p.lerp(startX, endX, progress);
        const starY = p.lerp(startY, endY, progress);

        // Shooting star trail
        p.stroke(255, 215, 0, 150 * (1 - progress));
        p.strokeWeight(3);
        p.line(starX, starY, starX - 30, starY + 15);

        // Shooting star core
        p.fill(255, 255, 255, 200 * (1 - progress));
        p.noStroke();
        p.ellipse(starX, starY, 4, 4);

        // Sparkle trail
        for (let j = 1; j <= 5; j++) {
          const trailX = starX - j * 8;
          const trailY = starY + j * 4;
          const trailAlpha = (150 * (1 - progress)) / j;
          p.fill(255, 215 - j * 20, 0, trailAlpha);
          p.ellipse(trailX, trailY, 3 - j * 0.4, 3 - j * 0.4);
        }
      }
    }

    // Removed annoying fast-flickering sparkles as requested

    // Distant galaxies
    for (let i = 0; i < 4; i++) {
      const galaxyX = (i * 200 + 100) % p.width;
      const galaxyY = (i * 150 + 80) % p.height;
      const rotation = p.frameCount * 0.002 + i;
      const galaxySize = 60 + p.sin(p.frameCount * 0.005 + i) * 15;

      p.push();
      p.translate(galaxyX, galaxyY);
      p.rotate(rotation);

      // Galaxy spiral arms
      for (let arm = 0; arm < 3; arm++) {
        p.push();
        p.rotate((arm * p.TWO_PI) / 3);

        for (let r = 0; r < galaxySize; r += 3) {
          const armAngle = r * 0.1;
          const armX = p.cos(armAngle) * r;
          const armY = p.sin(armAngle) * r;
          const armAlpha = p.map(r, 0, galaxySize, 20, 2);

          p.fill(200, 150, 255, armAlpha);
          p.ellipse(armX, armY, 3, 1);
        }
        p.pop();
      }

      // Galaxy core
      p.fill(255, 200, 255, 40);
      p.ellipse(0, 0, galaxySize * 0.3, galaxySize * 0.3);

      p.pop();
    }

    p.pop();
  }

  // Draw subtle space elements with psychedelic enhancements
  drawSubtleSpaceElements(p = this.p) {
    // Update psychedelic effects
    this.psychedelicEffects.update();
    
    p.push();
    p.noStroke();

    // Removed annoying flickering psychedelic dust

    // Subtle nebula hints with trippy colors
    const time = p.frameCount * 0.01;
    const nebula1Color = [
      60 + sin(time) * 20,
      40 + cos(time * 1.3) * 30,
      80 + sin(time * 0.7) * 40
    ];
    const nebula2Color = [
      50 + cos(time * 1.1) * 25,
      60 + sin(time * 1.5) * 35,
      90 + cos(time * 0.9) * 50
    ];
    
    p.fill(nebula1Color[0], nebula1Color[1], nebula1Color[2], 20);
    p.ellipse(p.width * 0.2, p.height * 0.3, 200, 150);

    p.fill(nebula2Color[0], nebula2Color[1], nebula2Color[2], 15);
    p.ellipse(p.width * 0.8, p.height * 0.7, 180, 120);

    // Subtle background waves that blend into space
    this.psychedelicEffects.drawBackgroundWaves(p);

    // Gentle twinkling stars (much reduced)
    for (let i = 0; i < 3; i++) { // Only 3 stars instead of 12
      const x = (i * p.width) / 4 + p.width / 8;
      const y = p.height * 0.15 + (i % 2) * p.height * 0.2;
      const twinkle = sin(p.frameCount * 0.003 + i * 2) * 0.5 + 0.5; // Much slower twinkling
      
      // Subtle white/blue stars instead of psychedelic colors
      p.fill(200 + twinkle * 55, 200 + twinkle * 55, 255, 20 + twinkle * 30);
      p.ellipse(x, y, 1 + twinkle * 0.5, 1 + twinkle * 0.5); // Smaller size variation
    }

    p.pop();
  }

  // Draw interactive background effects that respond to gameplay
  drawInteractiveBackgroundEffects(p = this.p) {
    p.push();
    
    // Cosmic wormhole effect in center during intense action (slower, more subtle)
    const enemyCount = this.gameState?.enemies?.length || 0;
    const targetIntensity = enemyCount > 3 ? Math.min(enemyCount / 15, 0.8) : 0;
    // Gradually interpolate towards target for smooth fade in/out
    this.wormholeIntensity = p.lerp(
      this.wormholeIntensity,
      targetIntensity,
      0.05
    );
    if (this.wormholeIntensity > 0.01) {
      this.psychedelicEffects.drawCosmicWormhole(
        p,
        p.width / 2,
        p.height / 2,
        this.wormholeIntensity * 0.15
      ); // Even more subtle
    }
    
    // Kaleidoscope patterns around player when moving
    if (this.player && this.player.isMoving) {
      const rippleIntensity = p.map(this.player.speed, 0, 5, 0, 1);
      
      // Psychedelic ripples with color cycling
      for (let i = 0; i < 5; i++) {
        const rippleRadius = (p.frameCount * 3 + i * 30) % 150;
        const rippleAlpha = p.map(rippleRadius, 0, 150, 40 * rippleIntensity, 0);
        
        const colorPhase = p.frameCount * 0.02 + i * 0.5;
        const colorIndex = Math.floor((colorPhase * 3) % this.psychedelicEffects.tripPalette.length);
        const color = this.psychedelicEffects.tripPalette[colorIndex];
        
        p.stroke(color[0], color[1], color[2], rippleAlpha);
        p.strokeWeight(3);
        p.noFill();
        p.ellipse(this.player.x, this.player.y, rippleRadius, rippleRadius);
      }
      
      // Removed kaleidoscope effect - didn't look good
    }
    // Health-based background tint
    if (this.player) {
      const healthPercent = this.player.health / this.player.maxHealth;
      if (healthPercent < 0.3) {
        // Red danger tint when low health
        const dangerPulse = p.sin(p.frameCount * 0.2) * 0.5 + 0.5; // Restored original danger pulse
        p.fill(255, 0, 0, dangerPulse * 15 * (1 - healthPercent));
        p.noStroke();
        p.rect(0, 0, p.width, p.height);
      } else if (healthPercent > 0.9) {
        // Subtle blue healing glow when healthy
        p.fill(0, 150, 255, 8);
        p.noStroke();
        p.rect(0, 0, p.width, p.height);
      }
    }
    // Score-based cosmic energy
    if (this.gameState && this.gameState.score > 0) {
      const energyLevel = p.min(this.gameState.score / 1000, 1);
      for (let i = 0; i < 5; i++) {
        const energyX = randomRange(p.width);
        const energyY = randomRange(p.height);
        const energySize = randomRange(10, 30) * energyLevel;
        const energyAlpha = randomRange(5, 15) * energyLevel;
        p.fill(255, 215, 0, energyAlpha);
        p.noStroke();
        p.ellipse(energyX, energyY, energySize, energySize);
      }
    }
    // Kill streak effects
    if (this.gameState && this.gameState.killStreak >= 5) {
      const streakIntensity = p.min(this.gameState.killStreak / 10, 1);
      // Pulsing border effect
      const borderPulse = p.sin(p.frameCount * 0.3) * 0.5 + 0.5; // Restored original kill streak pulse
      p.stroke(255, 100, 255, borderPulse * 100 * streakIntensity);
      p.strokeWeight(4);
      p.noFill();
      p.rect(5, 5, p.width - 10, p.height - 10);
      // Floating energy orbs
      for (let i = 0; i < this.gameState.killStreak && i < 15; i++) {
        const orbX = 50 + (i % 5) * 40;
        const orbY = 50 + p.floor(i / 5) * 30;
        const orbPulse = p.sin(p.frameCount * 0.1 + i) * 0.5 + 0.5;
        p.fill(255, 100, 255, orbPulse * 150);
        p.noStroke();
        p.ellipse(orbX, orbY, 8 + orbPulse * 4, 8 + orbPulse * 4);
      }
    }
    p.pop();
  }

  // Reset background renderer
  reset() {
    this.parallaxLayers = [];
    this.parallaxInitialized = false;
  }
}
