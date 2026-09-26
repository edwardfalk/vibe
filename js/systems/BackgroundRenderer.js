// Requires p5.js for random(), sin(), cos(), TWO_PI, lerp(), etc.
/**
 * BackgroundRenderer.js - Handles all background drawing including parallax, cosmic effects, and space elements
 */

import { createParallaxLayers } from './background/BackgroundLayers.js';
import { drawCosmicAuroraBackgroundLayer } from './background/CosmicAuroraBackground.js';
import { drawInteractiveBackgroundEffectsLayer } from './background/BackgroundEffects.js';

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
    this.parallaxLayers = [];
  }

  // Generate the parallax layers' elements (once, at setup)
  createParallaxBackground(p = this.p) {
    this.parallaxLayers = createParallaxLayers(p);
  }

  drawParallaxBackground(p = this.p) {
    p.push();
    const cameraX = this.cameraSystem ? this.cameraSystem.x : 0;
    const cameraY = this.cameraSystem ? this.cameraSystem.y : 0;
    const beatClock = this.context?.get?.('beatClock') ?? window.beatClock;
    for (const layer of this.parallaxLayers) {
      p.push();
      const parallaxX = cameraX * layer.speed;
      const parallaxY = cameraY * layer.speed;
      p.translate(-parallaxX, -parallaxY);
      layer.draw(layer.elements, p, beatClock);
      p.pop();
    }
    p.pop();
  }

  drawCosmicAuroraBackground(p = this.p) {
    p.push();
    const beatClock = this.context?.get?.('beatClock') ?? window.beatClock;
    drawCosmicAuroraBackgroundLayer(p, beatClock);
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
      this.cameraSystem
    );
    p.pop();
  }
}
