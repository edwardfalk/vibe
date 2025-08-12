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
  PI,
  TWO_PI,
} from '@vibe/core';

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
  }

  // Initialize parallax background layers
  createParallaxBackground(p = this.p) {
    if (this.parallaxInitialized) return;

    console.log('🌌 Creating parallax background layers...');

    this.parallaxLayers = [
      {
        name: 'distant_galaxies',
        elements: [],
        speed: 0.05,
        depth: 0.95,
      },
      {
        name: 'far_stars',
        elements: [],
        speed: 0.12,
        depth: 0.85,
      },
      {
        name: 'nebula_clouds',
        elements: [],
        speed: 0.25,
        depth: 0.75,
      },
      {
        name: 'cosmic_dust',
        elements: [],
        speed: 0.4,
        depth: 0.6,
      },
      {
        name: 'medium_stars',
        elements: [],
        speed: 0.6,
        depth: 0.45,
      },
      {
        name: 'close_debris',
        elements: [],
        speed: 0.85,
        depth: 0.3,
      },
      {
        name: 'foreground_particles',
        elements: [],
        speed: 1.1,
        depth: 0.15,
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
    // Distant galaxies layer (deepest, slowest)
    const distantGalaxies = this.parallaxLayers.find(
      (l) => l.name === 'distant_galaxies'
    );
    for (let i = 0; i < 6; i++) {
      distantGalaxies.elements.push({
        x: randomRange(-p.width * 2, p.width * 3),
        y: randomRange(-p.height * 2, p.height * 3),
        size: randomRange(80, 150),
        rotation: randomRange(0, TWO_PI),
        rotationSpeed: randomRange(-0.001, 0.001),
        arms: randomRange(2, 4),
        color: {
          r: randomRange(80, 120),
          g: randomRange(60, 100),
          b: randomRange(140, 200),
        },
        alpha: randomRange(0.03, 0.08),
      });
    }

    // Far stars layer
    const farStars = this.parallaxLayers.find((l) => l.name === 'far_stars');
    for (let i = 0; i < 80; i++) {
      farStars.elements.push({
        x: randomRange(-p.width * 2, p.width * 3),
        y: randomRange(-p.height * 2, p.height * 3),
        size: randomRange(1, 2),
        brightness: randomRange(0.4, 0.8),
        twinkleSpeed: randomRange(0.008, 0.02),
        color: ['white', 'lightblue', 'yellow'][floor(random() * 3)],
      });
    }

    // Nebula clouds layer
    const nebulaClouds = this.parallaxLayers.find(
      (l) => l.name === 'nebula_clouds'
    );
    for (let i = 0; i < 12; i++) {
      nebulaClouds.elements.push({
        x: randomRange(-p.width * 1.5, p.width * 2.5),
        y: randomRange(-p.height * 1.5, p.height * 2.5),
        size: randomRange(120, 400),
        color: {
          r: randomRange(30, 90),
          g: randomRange(15, 70),
          b: randomRange(80, 140),
        },
        alpha: randomRange(0.06, 0.18),
        driftSpeed: randomRange(0.05, 0.2),
        noiseSeed: randomRange(0, 10000),
        pulseSpeed: randomRange(0.01, 0.03),
      });
    }

    // Cosmic dust layer
    const cosmicDust = this.parallaxLayers.find(
      (l) => l.name === 'cosmic_dust'
    );
    for (let i = 0; i < 100; i++) {
      cosmicDust.elements.push({
        x: randomRange(-p.width * 1.5, p.width * 2.5),
        y: randomRange(-p.height * 1.5, p.height * 2.5),
        size: randomRange(0.5, 1.5),
        brightness: randomRange(0.3, 0.7),
        driftSpeed: randomRange(0.02, 0.08),
        angle: randomRange(0, TWO_PI),
        color: {
          r: randomRange(120, 180),
          g: randomRange(100, 160),
          b: randomRange(140, 220),
        },
      });
    }

    // Medium stars layer
    const mediumStars = this.parallaxLayers.find(
      (l) => l.name === 'medium_stars'
    );
    for (let i = 0; i < 45; i++) {
      mediumStars.elements.push({
        x: randomRange(-p.width * 1.2, p.width * 2.2),
        y: randomRange(-p.height * 1.2, p.height * 2.2),
        size: randomRange(2, 4),
        brightness: randomRange(0.6, 1),
        twinkleSpeed: randomRange(0.015, 0.04),
        color: ['white', 'blue', 'yellow', 'orange', 'lightcyan'][
          floor(random() * 5)
        ],
      });
    }

    // Close debris layer
    const closeDebris = this.parallaxLayers.find(
      (l) => l.name === 'close_debris'
    );
    for (let i = 0; i < 20; i++) {
      closeDebris.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(3, 10),
        rotation: randomRange(0, TWO_PI),
        rotationSpeed: randomRange(-0.03, 0.03),
        shape: ['triangle', 'square', 'diamond', 'cross'][floor(random() * 4)],
        alpha: randomRange(0.4, 0.8),
      });
    }

    // Foreground particles layer
    const foregroundParticles = this.parallaxLayers.find(
      (l) => l.name === 'foreground_particles'
    );
    for (let i = 0; i < 85; i++) {
      foregroundParticles.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(1.5, 3.5),
        alpha: randomRange(120, 200),
        flickerSpeed: randomRange(0.08, 0.25),
        driftSpeed: randomRange(0.1, 0.3),
        color: {
          r: randomRange(180, 255),
          g: randomRange(180, 255),
          b: randomRange(200, 255),
        },
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
      case 'distant_galaxies':
        this.drawDistantGalaxies(layer.elements, p);
        break;
      case 'far_stars':
        this.drawFarStars(layer.elements, p);
        break;
      case 'nebula_clouds':
        this.drawNebulaClouds(layer.elements, p);
        break;
      case 'cosmic_dust':
        this.drawCosmicDust(layer.elements, p);
        break;
      case 'medium_stars':
        this.drawMediumStars(layer.elements, p);
        break;
      case 'close_debris':
        this.drawCloseDebris(layer.elements, p);
        break;
      case 'foreground_particles':
        this.drawForegroundParticles(layer.elements, p);
        break;
    }

    p.pop();
  }

  // Draw distant galaxies (deepest background layer)
  drawDistantGalaxies(galaxies, p = this.p) {
    p.noStroke();
    for (const galaxy of galaxies) {
      p.push();
      p.translate(galaxy.x, galaxy.y);
      p.rotate(galaxy.rotation);
      galaxy.rotation += galaxy.rotationSpeed;

      // Draw spiral arms
      for (let arm = 0; arm < galaxy.arms; arm++) {
        p.push();
        p.rotate((arm * TWO_PI) / galaxy.arms);

        for (let r = 5; r < galaxy.size; r += 8) {
          const armAngle = r * 0.08;
          const armX = cos(armAngle) * r;
          const armY = sin(armAngle) * r * 0.3; // Flattened spiral
          const alpha = galaxy.alpha * 255 * (1 - r / galaxy.size);

          p.fill(galaxy.color.r, galaxy.color.g, galaxy.color.b, alpha);
          p.ellipse(armX, armY, 2, 1);
        }
        p.pop();
      }

      // Galaxy core
      const coreAlpha = galaxy.alpha * 255 * 1.5;
      p.fill(
        galaxy.color.r + 30,
        galaxy.color.g + 20,
        galaxy.color.b + 40,
        coreAlpha
      );
      p.ellipse(0, 0, galaxy.size * 0.15, galaxy.size * 0.1);

      p.pop();
    }
  }

  // Draw far stars with subtle twinkling
  drawFarStars(stars, p = this.p) {
    p.noStroke();
    for (const star of stars) {
      const twinkle = sin(p.frameCount * star.twinkleSpeed) * 0.4 + 0.6;
      const alpha = star.brightness * twinkle * 180;

      // Set color based on star type
      switch (star.color) {
        case 'lightblue':
          p.fill(173, 216, 230, alpha);
          break;
        case 'yellow':
          p.fill(255, 255, 224, alpha);
          break;
        default:
          p.fill(255, 255, 255, alpha);
      }

      p.ellipse(star.x, star.y, star.size * twinkle, star.size * twinkle);
    }
  }

  // Draw nebula clouds with pulsing
  drawNebulaClouds(clouds, p = this.p) {
    p.noStroke();
    for (const cloud of clouds) {
      const noiseInput =
        (cloud.x + p.frameCount * cloud.driftSpeed) * 0.002 +
        (cloud.noiseSeed || 0);
      const drift = p.noise(noiseInput) * 50 - 25;
      const pulse = sin(p.frameCount * cloud.pulseSpeed) * 0.3 + 0.7;
      const alpha = cloud.alpha * 255 * pulse;

      // Draw multiple overlapping ellipses for more realistic nebula effect
      p.fill(cloud.color.r, cloud.color.g, cloud.color.b, alpha * 0.6);
      p.ellipse(
        cloud.x + drift,
        cloud.y,
        cloud.size * pulse,
        cloud.size * 0.4 * pulse
      );

      p.fill(
        cloud.color.r + 20,
        cloud.color.g + 10,
        cloud.color.b + 30,
        alpha * 0.4
      );
      p.ellipse(
        cloud.x + drift * 0.7,
        cloud.y + drift * 0.3,
        cloud.size * 0.8 * pulse,
        cloud.size * 0.5 * pulse
      );

      p.fill(
        cloud.color.r + 40,
        cloud.color.g + 30,
        cloud.color.b + 50,
        alpha * 0.2
      );
      p.ellipse(
        cloud.x + drift * 0.4,
        cloud.y - drift * 0.2,
        cloud.size * 0.6 * pulse,
        cloud.size * 0.3 * pulse
      );
    }
  }

  // Draw cosmic dust particles
  drawCosmicDust(dust, p = this.p) {
    p.noStroke();
    for (const particle of dust) {
      // Animate particle movement
      particle.x += cos(particle.angle) * particle.driftSpeed;
      particle.y += sin(particle.angle) * particle.driftSpeed;

      // Wrap particles around screen
      if (particle.x > p.width + 50) particle.x = -50;
      if (particle.x < -50) particle.x = p.width + 50;
      if (particle.y > p.height + 50) particle.y = -50;
      if (particle.y < -50) particle.y = p.height + 50;

      const alpha = particle.brightness * 120;
      p.fill(particle.color.r, particle.color.g, particle.color.b, alpha);
      p.ellipse(particle.x, particle.y, particle.size, particle.size);
    }
  }

  // Draw noise-driven parallax wave
  drawNoiseWave(elements, p = this.p) {
    p.noStroke();
    p.fill(60, 80, 180, 60);
    p.beginShape();
    for (let x = 0; x <= p.width; x += 10) {
      const n = p.noise(elements[0].seed + x * 0.01, p.frameCount * 0.003);
      const y = p.height * 0.3 + n * 60;
      p.vertex(x, y);
    }
    p.vertex(p.width, p.height);
    p.vertex(0, p.height);
    p.endShape(p.CLOSE);
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

  // Draw close debris with enhanced shapes and transparency
  drawCloseDebris(debris, p = this.p) {
    for (const piece of debris) {
      p.push();
      p.translate(piece.x, piece.y);
      p.rotate(piece.rotation);
      piece.rotation += piece.rotationSpeed;

      const alpha = piece.alpha * 255;
      p.stroke(120, 120, 140, alpha);
      p.strokeWeight(1.5);
      p.fill(80, 90, 120, alpha * 0.3);

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
        case 'cross':
          const halfSize = piece.size / 2;
          const thickness = piece.size / 6;
          // Horizontal bar
          p.rect(-halfSize, -thickness, piece.size, thickness * 2);
          // Vertical bar
          p.rect(-thickness, -halfSize, thickness * 2, piece.size);
          break;
      }
      p.pop();
    }
  }

  // Draw foreground particles with drift and flicker
  drawForegroundParticles(particles, p = this.p) {
    p.noStroke();
    for (const particle of particles) {
      // Animate particle movement
      particle.x +=
        cos(p.frameCount * 0.01 + particle.x * 0.001) * particle.driftSpeed;
      particle.y +=
        sin(p.frameCount * 0.008 + particle.y * 0.001) * particle.driftSpeed;

      // Wrap particles around screen
      if (particle.x > p.width + 20) particle.x = -20;
      if (particle.x < -20) particle.x = p.width + 20;
      if (particle.y > p.height + 20) particle.y = -20;
      if (particle.y < -20) particle.y = p.height + 20;

      const flicker = sin(p.frameCount * particle.flickerSpeed) * 0.4 + 0.6;
      const alpha = particle.alpha * flicker;

      p.fill(particle.color.r, particle.color.g, particle.color.b, alpha);
      p.ellipse(
        particle.x,
        particle.y,
        particle.size * flicker,
        particle.size * flicker
      );

      // Add small glow effect for brighter particles
      if (alpha > 150) {
        p.fill(
          particle.color.r,
          particle.color.g,
          particle.color.b,
          alpha * 0.3
        );
        p.ellipse(
          particle.x,
          particle.y,
          particle.size * flicker * 2,
          particle.size * flicker * 2
        );
      }
    }
  }

  // Draw cosmic aurora background
  drawCosmicAuroraBackground(p = this.p) {
    p.push();

    // Create a clean gradient using rectangles
    const gradientSteps = 8;
    const stepHeight = p.height / gradientSteps;

    for (let i = 0; i < gradientSteps; i++) {
      const inter = i / (gradientSteps - 1);

      // Cosmic aurora gradient colors
      let r, g, b;
      if (inter < 0.3) {
        // Deep space black to purple
        const t = p.map(inter, 0, 0.3, 0, 1);
        r = p.lerp(8, 25, t);
        g = p.lerp(5, 15, t);
        b = p.lerp(20, 45, t);
      } else if (inter < 0.7) {
        // Purple to cosmic blue
        const t = p.map(inter, 0.3, 0.7, 0, 1);
        r = p.lerp(25, 20, t);
        g = p.lerp(15, 30, t);
        b = p.lerp(45, 65, t);
      } else {
        // Cosmic blue to deep purple
        const t = p.map(inter, 0.7, 1, 0, 1);
        r = p.lerp(20, 30, t);
        g = p.lerp(30, 20, t);
        b = p.lerp(65, 50, t);
      }

      // Subtle time-based variation
      const timeShift = p.sin(p.frameCount * 0.005 + inter) * 8;
      r += timeShift * 0.5;
      g += timeShift * 0.3;
      b += timeShift * 0.8;

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

    // Enhanced distant sparkles
    for (let i = 0; i < 20; i++) {
      const sparkleX = (i * 67) % p.width;
      const sparkleY = (i * 103) % p.height;
      const twinkle = p.sin(p.frameCount * 0.02 + i * 2) * 0.5 + 0.5;
      const colorPhase = p.frameCount * 0.008 + i;

      const sparkleColors = [
        [255, 215, 0], // Gold
        [255, 182, 193], // Light pink
        [173, 216, 230], // Light blue
        [221, 160, 221], // Plum
        [255, 255, 224], // Light yellow
      ];

      const colorIndex = p.floor(colorPhase) % sparkleColors.length;
      const currentColor = sparkleColors[colorIndex];
      const alpha = 30 + twinkle * 40;

      p.fill(currentColor[0], currentColor[1], currentColor[2], alpha);
      p.noStroke();
      p.ellipse(sparkleX, sparkleY, 2 + twinkle, 2 + twinkle);

      // Add cross sparkle for brighter ones
      if (twinkle > 0.7) {
        p.stroke(
          currentColor[0],
          currentColor[1],
          currentColor[2],
          alpha * 0.8
        );
        p.strokeWeight(1);
        const sparkleSize = 4 + twinkle * 2;
        p.line(
          sparkleX - sparkleSize,
          sparkleY,
          sparkleX + sparkleSize,
          sparkleY
        );
        p.line(
          sparkleX,
          sparkleY - sparkleSize,
          sparkleX,
          sparkleY + sparkleSize
        );
        p.noStroke();
      }
    }

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
        p.rotate((arm * TWO_PI) / 3);

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

  // Draw subtle space elements
  drawSubtleSpaceElements(p = this.p) {
    p.push();
    p.noStroke();

    // Subtle nebula hints
    p.fill(60, 40, 80, 15);
    p.ellipse(p.width * 0.2, p.height * 0.3, 200, 150);

    p.fill(50, 60, 90, 12);
    p.ellipse(p.width * 0.8, p.height * 0.7, 180, 120);

    // Static distant stars
    p.fill(200, 200, 255, 40);
    for (let i = 0; i < 6; i++) {
      const x = (i * p.width) / 6 + p.width / 12;
      const y = p.height * 0.15 + (i % 2) * p.height * 0.1;
      p.ellipse(x, y, 1, 1);
    }

    p.pop();
  }

  // Draw interactive background effects that respond to gameplay
  drawInteractiveBackgroundEffects(p = this.p) {
    p.push();
    // Use injected player and gameState for robust, modular background effects (do not use global or p.*)
    if (this.player && this.player.isMoving) {
      const rippleIntensity = p.map(this.player.speed, 0, 5, 0, 1);
      for (let i = 0; i < 3; i++) {
        const rippleRadius = (p.frameCount * 2 + i * 20) % 100;
        const rippleAlpha = p.map(
          rippleRadius,
          0,
          100,
          30 * rippleIntensity,
          0
        );
        p.stroke(64, 224, 208, rippleAlpha);
        p.strokeWeight(2);
        p.noFill();
        p.ellipse(this.player.x, this.player.y, rippleRadius, rippleRadius);
      }
    }
    // Health-based background tint
    if (this.player) {
      const healthPercent = this.player.health / this.player.maxHealth;
      if (healthPercent < 0.3) {
        // Red danger tint when low health
        const dangerPulse = p.sin(p.frameCount * 0.2) * 0.5 + 0.5;
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
      const borderPulse = p.sin(p.frameCount * 0.3) * 0.5 + 0.5;
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

  /**
   * Primary entry expected by GameLoop.js – wraps all internal background drawing calls.
   * @param {p5} p - p5 instance (optional; falls back to constructor p)
   * @param {CameraSystem} cameraSystem - camera (optional; uses this.cameraSystem by default)
   */
  draw(p = this.p, cameraSystem = this.cameraSystem) {
    // Update injected camera reference if supplied
    if (cameraSystem) this.cameraSystem = cameraSystem;

    // Core parallax layers and space elements
    this.drawParallaxBackground(p);
    this.drawEnhancedSpaceElements(p);
    // Optional aurora / interactive effects
    this.drawCosmicAuroraBackground(p);
    this.drawInteractiveBackgroundEffects(p);
  }
}
