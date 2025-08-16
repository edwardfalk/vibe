// SetupPhases.js – Incremental extraction of initialization from GameLoop.js
import { GameState, Audio, BeatClock, MusicManager, CONFIG } from '@vibe/core';
import {
  CameraSystem,
  SpawnSystem,
  BackgroundRenderer,
  UIRenderer,
  CollisionSystem,
  TestMode,
  RenderPipeline,
  LAYERS,
  StarFieldRenderer,
  ParallaxBackgroundRenderer,
  WorldRenderer,
  HudRenderer,
} from '@vibe/systems';
import { ExplosionManager, EffectsManager } from '@vibe/fx';
import { buildRestartContext } from './RestartContext.js';
import VisualEffectsManager from '@vibe/fx/visualEffects.js';
import { ScreenEffectsRenderer } from '@vibe/systems/ScreenEffectsRenderer.js';
import DeathTransitionSystem from './DeathTransitionSystem.js';

export function initializeSystems(p) {
  // Effects & explosions
  if (!window.explosionManager) {
    window.explosionManager = new ExplosionManager();
  }
  if (!window.effectsManager) {
    window.effectsManager = new EffectsManager();
  }
  if (!window.visualEffectsManager) {
    window.visualEffectsManager = new VisualEffectsManager(
      window.backgroundLayers
    );
    window.visualEffectsManager.init(p);
  }
  if (!window.deathTransitionSystem) {
    window.deathTransitionSystem = new DeathTransitionSystem({
      p,
      gameState: window.gameState,
      beatClock: window.beatClock,
      renderPipeline: window.renderPipeline,
      audio: window.audio,
    });
  }

  // Core state & camera
  if (!window.gameState) {
    window.gameState = new GameState();
    // Initialize restart context and perform initial restart only on first creation
    if (
      typeof window.gameState.setRestartContext === 'function' &&
      typeof window.gameState.restart === 'function'
    ) {
      window.gameState.setRestartContext(buildRestartContext());
      window.gameState.restart();
    }
  }
  if (!window.cameraSystem) {
    window.cameraSystem = new CameraSystem(p);
    if (window.player) {
      window.player.cameraSystem = window.cameraSystem; // Fix mouse aiming
    }
  }

  // Spawning & collisions
  if (!window.spawnSystem) {
    window.spawnSystem = new SpawnSystem();
  }
  if (!window.collisionSystem) {
    window.collisionSystem = new CollisionSystem();
  }

  // Audio
  if (!window.audio) {
    window.audio = new Audio(p, window.player);
  } else {
    window.audio.player = window.player;
  }

  // Beat clock + music
  if (!window.beatClock) {
    window.beatClock = new BeatClock(CONFIG.GAME_SETTINGS.BPM);
  }
  if (!window.musicManager) {
    window.musicManager = new MusicManager(window.audio, window.beatClock);
  }

  // Renderers & UI
  if (!window.renderPipeline) {
    window.renderPipeline = new RenderPipeline();
  }

  if (!window.backgroundRenderer) {
    window.backgroundRenderer = new BackgroundRenderer(
      p,
      window.cameraSystem,
      window.player,
      window.gameState
    );
  }
  window.backgroundRenderer.createParallaxBackground(p);

  // Register specialised background renderers once
  if (!window.starFieldRenderer) {
    window.starFieldRenderer = new StarFieldRenderer(window.backgroundRenderer);
    window.renderPipeline.addRenderer(window.starFieldRenderer);
  }
  if (!window.parallaxRenderer) {
    window.parallaxRenderer = new ParallaxBackgroundRenderer(
      window.backgroundRenderer,
      window.gameState
    );
    window.renderPipeline.addRenderer(window.parallaxRenderer);
  }

  // Register world renderer once
  if (!window.worldRenderer) {
    window.worldRenderer = new WorldRenderer();
    window.renderPipeline.addRenderer(window.worldRenderer);
  }

  // Register HudRenderer once
  if (!window.hudRenderer) {
    window.hudRenderer = new HudRenderer(window.gameState, window.player);
    window.renderPipeline.addRenderer(window.hudRenderer);
  }

  // Test mode
  if (!window.testModeManager) {
    window.testModeManager = new TestMode(window.player);
  }

  // UI Renderer (after TestModeManager is ready)
  if (!window.uiRenderer) {
    window.uiRenderer = new UIRenderer(
      window.gameState,
      window.player,
      window.audio,
      window.cameraSystem,
      window.testModeManager
    );
  } else if (!window.uiRenderer.testModeManager) {
    // Patch existing instance to ensure wiring is correct
    window.uiRenderer.testModeManager = window.testModeManager;
  }

  // VisualEffectsManager (singleton for screen-wide effects)
  if (!window.visualEffectsManager) {
    window.visualEffectsManager = new VisualEffectsManager();
  }

  // Register ScreenEffectsRenderer once (overlay layer)
  if (!window.screenEffectsRenderer) {
    window.screenEffectsRenderer = new ScreenEffectsRenderer(
      window.visualEffectsManager
    );
    window.renderPipeline.addRenderer(window.screenEffectsRenderer);
  }

  // Finalize: keep restart context in sync without forcing a restart
  if (
    window.gameState &&
    typeof window.gameState.setRestartContext === 'function'
  ) {
    window.gameState.setRestartContext(buildRestartContext());
  }

  // Tier-3 globals permanently removed (2025-08-16 Stage-4).
}
