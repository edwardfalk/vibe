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
} from './mathUtils.js';

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
        twinkleSpeed: randomRange(0.01, 0.03),
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
        driftSpeed: randomRange(0.1, 0.3),
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
        x: p.random(-p.width, p.width * 2),
        y: p.random(-p.height, p.height * 2),
        size: p.random(2, 4),
        alpha: p.random(150, 255),
        flickerSpeed: p.random(0.05, 0.15),
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

  // Draw distant stars with twinkling + beat-reactive brightness
  drawDistantStars(stars, p = this.p) {
    const beatBoost = window.beatClock
      ? window.beatClock.getBeatIntensity(10) * 80
      : 0;

    p.noStroke();
    for (const star of stars) {
      const twinkle = p.sin(p.frameCount * star.twinkleSpeed) * 0.5 + 0.5;
      const alpha = Math.min(255, star.brightness * twinkle * 255 + beatBoost);

      p.fill(255, 255, 255, alpha);
      p.ellipse(star.x, star.y, star.size, star.size);
    }
  }

  // Draw nebula clouds — beat-reactive: brighter and more saturated on beat
  drawNebulaClouds(clouds, p = this.p) {
    const beatPulse = window.beatClock
      ? window.beatClock.getBeatIntensity(6)
      : 0;

    p.noStroke();
    for (const cloud of clouds) {
      const drift = p.sin(p.frameCount * cloud.driftSpeed) * 20;
      const boost = beatPulse * 0.7;
      const r = Math.min(255, cloud.color.r + boost * 60);
      const g = Math.min(255, cloud.color.g + boost * 30);
      const b = Math.min(255, cloud.color.b + boost * 80);
      const alpha = Math.min(255, cloud.alpha * 255 * (1 + boost * 2.5));

      p.fill(r, g, b, alpha);
      p.ellipse(cloud.x + drift, cloud.y, cloud.size, cloud.size * 0.6);
    }
  }

  // Draw medium stars with beat-synchronized twinkling
  drawMediumStars(stars, p = this.p) {
    // Get beat intensity for synchronized twinkling
    const beatPulse = window.beatClock
      ? window.beatClock.getBeatIntensity(8)
      : 0;
    const measurePhase = window.beatClock
      ? window.beatClock.getMeasurePhase()
      : 0;

    p.noStroke();
    let starIndex = 0;
    for (const star of stars) {
      // Create a unique twinkle phase for each star based on its position
      const starPhase = (star.x * 0.01 + star.y * 0.01) % p.TWO_PI;
      // Twinkle speed varies by star
      const twinkleSpeed = 0.05 + star.size * 0.01;

      // Combine time-based and beat-based twinkling
      const timeTwinkle = p.sin(p.frameCount * twinkleSpeed + starPhase) * 0.5 + 0.5;
      // Beat-synchronized: stars pulse together on beats, offset by star's "phase" in the measure
      const beatTwinkle = (p.sin(measurePhase * p.TWO_PI + starPhase) * 0.5 + 0.5) * beatPulse;

      // Combined brightness: base + time twinkle + beat pulse
      const combinedBrightness = star.brightness * (0.7 + timeTwinkle * 0.3 + beatTwinkle * 0.3);
      const alpha = min(255, combinedBrightness * 255);

      // Size also pulses slightly with beat
      const sizePulse = 1 + beatPulse * 0.2 * ((starIndex % 3) / 3);
      const finalSize = star.size * sizePulse;

      switch (star.color) {
        case 'blue':
          p.fill(173, 216, 230, alpha);
          break;
        case 'yellow':
          // Yellow stars get warmer on beat
          p.fill(255, 255, 150 + beatPulse * 50, alpha);
          break;
        case 'orange':
          p.fill(255, 165 + beatPulse * 20, 0, alpha);
          break;
        default:
          // White stars get subtle blue tint on beat
          p.fill(255, 255, 255 + beatPulse * 20, alpha);
      }
      p.ellipse(star.x, star.y, finalSize, finalSize);

      // Add sparkle cross on bright beats for brighter stars
      if (combinedBrightness > 0.85 && beatPulse > 0.3) {
        const sparkleAlpha = (combinedBrightness - 0.85) * beatPulse * 255;
        p.stroke(255, 255, 255, sparkleAlpha);
        p.strokeWeight(1);
        const sparkleSize = finalSize * 1.5;
        p.line(star.x - sparkleSize, star.y, star.x + sparkleSize, star.y);
        p.line(star.x, star.y - sparkleSize, star.x, star.y + sparkleSize);
        p.noStroke();
      }

      starIndex++;
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
      piece.rotation += piece.rotationSpeed;

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

  // Draw foreground sparks
  drawForegroundSparks(sparks, p = this.p) {
    p.noStroke();
    for (const spark of sparks) {
      const flicker = p.sin(p.frameCount * spark.flickerSpeed) * 0.5 + 0.5;
      p.fill(255, 255, 255, spark.alpha * flicker);
      p.ellipse(spark.x, spark.y, spark.size, spark.size);
    }
  }

  // Draw cosmic aurora background with beat-reactive color shifts
  drawCosmicAuroraBackground(p = this.p) {
    p.push();

    // Deep space black to purple background
    p.background(5, 2, 15);

    // Get beat intensity for color modulation
    const beatIntensity = window.beatClock
      ? window.beatClock.getBeatIntensity(4)
      : 0;
    const downbeatIntensity = window.beatClock
      ? window.beatClock.getDownbeatIntensity(3)
      : 0;

    // Horizon line position
    const horizonY = p.height * 0.45;

    // Draw sky gradient
    const skySteps = 20;
    const skyStepHeight = horizonY / skySteps;

    p.noStroke();
    for (let i = 0; i < skySteps; i++) {
      const inter = i / (skySteps - 1);
      
      // Synthwave sunset gradient (deep blue/purple to hot pink/orange at horizon)
      // Top of sky
      const topColor = { r: 10, g: 5, b: 30 };
      // Horizon color
      const horizonColor = { 
        r: 255 - beatIntensity * 20, 
        g: 20 + beatIntensity * 40, 
        b: 147 + downbeatIntensity * 50 
      };

      // Exponential interpolation for more intense color near horizon
      const easeInter = p.pow(inter, 2.5);

      const r = p.lerp(topColor.r, horizonColor.r, easeInter);
      const g = p.lerp(topColor.g, horizonColor.g, easeInter);
      const b = p.lerp(topColor.b, horizonColor.b, easeInter);

      p.fill(r, g, b);
      p.rect(0, i * skyStepHeight, p.width, skyStepHeight + 1);
    }

    // Synthwave Sun
    const sunRadius = 150 + beatIntensity * 5;
    const sunX = p.width / 2;
    const sunY = horizonY - 20;

    // Sun glow
    p.blendMode(p.ADD);
    for (let i = 0; i < 3; i++) {
      const glowRadius = sunRadius * (1.2 + i * 0.2);
      p.fill(255, 100, 0, 30 - i * 10);
      p.ellipse(sunX, sunY, glowRadius, glowRadius);
    }
    p.blendMode(p.BLEND);

    // Draw the sun with retro stripes
    p.fill(255, 200, 0); // Yellow-orange top
    p.arc(sunX, sunY, sunRadius, sunRadius, p.PI, p.TWO_PI); // Top half
    
    // Bottom half with stripes
    const stripeCount = 6;
    for (let i = 0; i < stripeCount; i++) {
      const yOffset = i * (sunRadius / 2 / stripeCount);
      const stripeHeight = (sunRadius / 2 / stripeCount) * 0.6; // Gap gets larger towards bottom
      
      // Calculate width of sun at this y position using circle equation x^2 + y^2 = r^2
      const chordHalfWidth = p.sqrt(p.sq(sunRadius/2) - p.sq(yOffset));
      
      p.fill(255, 50 + i * 20, 0); // Gradient down to deep orange/red
      p.arc(
        sunX, 
        sunY, 
        sunRadius, 
        sunRadius, 
        p.asin(yOffset / (sunRadius/2)), 
        p.PI - p.asin(yOffset / (sunRadius/2)),
        p.CHORD
      );
      // We overwrite the gaps with background color to make the stripes
      p.fill(5, 2, 15);
      p.rect(sunX - sunRadius/2, sunY + yOffset + stripeHeight, sunRadius, (sunRadius / 2 / stripeCount) - stripeHeight);
    }

    // Synthwave Perspective Grid
    const gridYStart = horizonY;
    const gridHeight = p.height - horizonY;
    
    // Grid movement based on frame count (simulating forward motion)
    const speed = 2 + beatIntensity * 2;
    const gridOffset = (p.frameCount * speed) % 40;

    // Draw grid background
    p.fill(10, 0, 20);
    p.rect(0, gridYStart, p.width, gridHeight);

    p.stroke(0, 255, 255, 150 + beatIntensity * 55); // Cyan lines
    p.strokeWeight(2);

    // Horizontal lines (perspective)
    const numHorizontalLines = 15;
    for (let i = 0; i < numHorizontalLines; i++) {
      // Exponential distribution for perspective
      let yProgress = p.pow((i / numHorizontalLines), 2);
      
      // Apply movement offset to the progress
      let shiftedProgress = yProgress + (gridOffset / gridHeight) * p.pow(((i+1) / numHorizontalLines), 1.5);
      if (shiftedProgress > 1) continue; // Skip lines that moved off screen

      const y = gridYStart + shiftedProgress * gridHeight;
      
      // Fade out lines near the horizon
      const alpha = p.map(shiftedProgress, 0, 0.1, 0, 255, true);
      p.stroke(0, 255, 255, alpha);
      
      // Thicker lines closer to bottom
      p.strokeWeight(1 + shiftedProgress * 3);
      
      p.line(0, y, p.width, y);
    }

    // Vertical/Perspective lines
    const numVerticalLines = 21; // Odd number so there's a center line
    const vanishingPointX = p.width / 2;
    const vanishingPointY = horizonY;

    for (let i = 0; i < numVerticalLines; i++) {
      // Calculate x position at the bottom of the screen
      // Spread wider than screen width to maintain perspective at edges
      const bottomX = p.map(i, 0, numVerticalLines - 1, -p.width, p.width * 2);
      
      // Calculate x position at horizon (slightly spread to avoid crowding)
      const topX = p.map(i, 0, numVerticalLines - 1, vanishingPointX - 100, vanishingPointX + 100);

      // Create a gradient for the vertical lines fading into the horizon
      const ctx2d = p.drawingContext;
      const grad = ctx2d.createLinearGradient(0, gridYStart, 0, p.height);
      grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
      grad.addColorStop(0.1, 'rgba(0, 255, 255, 0.1)');
      grad.addColorStop(1, `rgba(0, 255, 255, ${0.5 + beatIntensity * 0.5})`);
      
      ctx2d.strokeStyle = grad;
      ctx2d.lineWidth = 2;
      ctx2d.beginPath();
      ctx2d.moveTo(topX, gridYStart);
      ctx2d.lineTo(bottomX, p.height);
      ctx2d.stroke();
    }

    // Horizon glow line
    p.blendMode(p.ADD);
    p.stroke(255, 20, 147, 200 + downbeatIntensity * 55); // Hot pink horizon
    p.strokeWeight(4 + beatIntensity * 4);
    p.line(0, horizonY, p.width, horizonY);
    
    p.stroke(255, 255, 255, 100);
    p.strokeWeight(1);
    p.line(0, horizonY, p.width, horizonY);
    p.blendMode(p.BLEND);

    p.pop();
  }

  // Draw enhanced space elements (modified for synthwave)
  drawEnhancedSpaceElements(p = this.p) {
    p.push();

    // Keep the shooting stars but make them bright cyan/pink
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

        // Shooting star trail (cyan)
        p.stroke(0, 255, 255, 150 * (1 - progress));
        p.strokeWeight(3);
        p.line(starX, starY, starX - 30, starY + 15);

        // Shooting star core
        p.fill(255, 255, 255, 200 * (1 - progress));
        p.noStroke();
        p.ellipse(starX, starY, 4, 4);

        // Sparkle trail (pink)
        for (let j = 1; j <= 5; j++) {
          const trailX = starX - j * 8;
          const trailY = starY + j * 4;
          const trailAlpha = (150 * (1 - progress)) / j;
          p.fill(255, 20, 147, trailAlpha);
          p.ellipse(trailX, trailY, 3 - j * 0.4, 3 - j * 0.4);
        }
      }
    }

    // Enhanced distant sparkles (stars stretched horizontally for speed effect)
    for (let i = 0; i < 40; i++) {
      const sparkleX = (i * 67) % p.width;
      const sparkleY = (i * 103) % (p.height * 0.45); // Only in sky area
      const twinkle = p.sin(p.frameCount * 0.02 + i * 2) * 0.5 + 0.5;

      const sparkleColors = [
        [0, 255, 255],   // Cyan
        [255, 20, 147],  // Hot pink
        [148, 0, 211],   // Violet
        [255, 255, 255], // White
      ];

      const colorIndex = i % sparkleColors.length;
      const currentColor = sparkleColors[colorIndex];
      const alpha = 30 + twinkle * 80;

      p.fill(currentColor[0], currentColor[1], currentColor[2], alpha);
      p.noStroke();
      
      // Horizontal stretch for speed effect
      const stretch = 1 + twinkle * 3;
      p.ellipse(sparkleX, sparkleY, 2 * stretch, 2);

      // Add cross sparkle for brighter ones
      if (twinkle > 0.8) {
        p.stroke(
          currentColor[0],
          currentColor[1],
          currentColor[2],
          alpha * 0.8
        );
        p.strokeWeight(1);
        const sparkleSize = 4 + twinkle * 2;
        p.line(
          sparkleX - sparkleSize * 2,
          sparkleY,
          sparkleX + sparkleSize * 2,
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

    // Beat-reactive pulse system
    if (window.beatClock) {
      const phase = window.beatClock.getBeatPhase();
      const intensity = window.beatClock.getBeatIntensity(8);
      const currentBeat = window.beatClock.getCurrentBeat();
      const isDownbeat = currentBeat === 0;

      // 1. Screen flash overlay — warm white on downbeat, purple on others
      const flashAlpha = isDownbeat ? intensity * 45 : intensity * 18;
      if (flashAlpha > 1) {
        if (isDownbeat) {
          p.fill(200, 180, 255, flashAlpha);
        } else {
          p.fill(138, 43, 226, flashAlpha);
        }
        p.noStroke();
        p.rect(0, 0, p.width, p.height);
      }

      // 2. Beat ring — expanding circle from screen center
      if (phase < 0.6) {
        const ringProgress = phase / 0.6;
        const ringRadius = 40 + ringProgress * 350;
        const ringAlpha = (1 - ringProgress) * (isDownbeat ? 70 : 30);
        const ringWeight = (1 - ringProgress) * 2.5 + 0.5;

        p.noFill();
        p.stroke(180, 140, 255, ringAlpha);
        p.strokeWeight(ringWeight);
        p.ellipse(p.width / 2, p.height / 2, ringRadius * 2, ringRadius * 2);
      }

      // 3. Vignette pulse — edges darken briefly on beat for "breathing" feel
      const vigAlpha = intensity * 0.12;
      if (vigAlpha > 0.005) {
        const ctx2d = p.drawingContext;
        ctx2d.save();
        const grad = ctx2d.createRadialGradient(
          p.width / 2, p.height / 2, p.width * 0.25,
          p.width / 2, p.height / 2, p.width * 0.72
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(20,10,40,${vigAlpha})`);
        ctx2d.fillStyle = grad;
        ctx2d.fillRect(0, 0, p.width, p.height);
        ctx2d.restore();
      }
    }

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
}
