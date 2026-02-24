// Requires p5.js for random(), sin(), cos(), TWO_PI, lerp(), etc.
/**
 * BackgroundRenderer.js - Handles all background drawing including parallax, cosmic effects, and space elements
 */

import { randomRange } from '../mathUtils.js';
import {
  drawDistantStarsLayer,
  drawNebulaCloudLayer,
} from './background/ParallaxLayerRenderers.js';
import { drawCosmicAuroraBackgroundLayer } from './background/CosmicAuroraBackground.js';
import { drawEnhancedSpaceElementsLayer } from './background/EnhancedSpaceElements.js';
import { drawInteractiveBackgroundEffectsLayer } from './background/InteractiveBackgroundEffects.js';
import { drawMediumStarsLayer } from './background/MediumStarRenderer.js';
import {
  drawCloseDebrisLayer,
  drawForegroundSparksLayer,
} from './background/NearFieldParallax.js';
import { createParallaxLayerConfig } from './background/ParallaxLayerConfig.js';
import { generateParallaxLayerElements } from './background/ParallaxLayerFactory.js';
import { drawSubtleSpaceElementsLayer } from './background/SubtleSpaceElements.js';

/**
 * @param {p5} p - The p5 instance
 * @param {CameraSystem} cameraSystem - The camera system controlling parallax (dependency injected for modularity)
 * @param {Player} player - The player object (dependency injected for modularity)
 * @param {GameState} gameState - The game state object (dependency injected for modularity)
 */
export class BackgroundRenderer {
  constructor(p, cameraSystem, player, gameState, context = null) {
    this.p = p;
    this.cameraSystem = cameraSystem;
    this.player = player;
    this.gameState = gameState;
    this.context = context;
    // Parallax background layers
    this.parallaxLayers = [];
    this.parallaxInitialized = false;
  }

  // Initialize parallax background layers
  createParallaxBackground(p = this.p) {
    if (this.parallaxInitialized) return;

    console.log('🌌 Creating parallax background layers...');

    this.parallaxLayers = createParallaxLayerConfig();

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
    generateParallaxLayerElements(this.parallaxLayers, p);
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

    const beatClock = this.context?.get?.('beatClock') ?? window.beatClock;
    switch (layer.name) {
      case 'distant_stars':
        drawDistantStarsLayer(layer.elements, p, beatClock);
        break;
      case 'nebula_clouds':
        drawNebulaCloudLayer(layer.elements, p, beatClock);
        break;
      case 'medium_stars':
        drawMediumStarsLayer(layer.elements, p);
        break;
      case 'close_debris':
        drawCloseDebrisLayer(layer.elements, p);
        break;
      case 'foreground_sparks':
        drawForegroundSparksLayer(layer.elements, p);
        break;
    }

    p.pop();
  }

  drawCosmicAuroraBackground(p = this.p) {
    p.push();
    const beatClock = this.context?.get?.('beatClock') ?? window.beatClock;
    drawCosmicAuroraBackgroundLayer(p, beatClock);
    p.pop();
  }

  drawEnhancedSpaceElements(p = this.p) {
    p.push();
    const beatClock = this.context?.get?.('beatClock') ?? window.beatClock;
    drawEnhancedSpaceElementsLayer(p, beatClock);
    p.pop();
  }

  // Draw subtle space elements
  drawSubtleSpaceElements(p = this.p) {
    p.push();
    drawSubtleSpaceElementsLayer(p);
    p.pop();
  }

  drawInteractiveBackgroundEffects(p = this.p) {
    p.push();
    const beatClock = this.context?.get?.('beatClock') ?? window.beatClock;
    drawInteractiveBackgroundEffectsLayer(
      p,
      this.player,
      this.gameState,
      beatClock,
      randomRange
    );
    p.pop();
  }

  // Reset background renderer
  reset() {
    this.parallaxLayers = [];
    this.parallaxInitialized = false;
  }
}
