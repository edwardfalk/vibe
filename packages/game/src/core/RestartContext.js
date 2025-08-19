// RestartContext.js – Provides a runtime context for GameState.restart()
import { BeatClock } from '@vibe/core';
import { Player } from '@vibe/entities';
import { SpawnSystem, CollisionSystem } from '@vibe/systems';
import { ExplosionManager, EffectsManager } from '@vibe/fx';
import VisualEffectsManager from '@vibe/fx/visualEffects.js';

export function buildRestartContext() {
  return {
    gameSeed: window.gameSeed,

    // RNG
    setRandomSeed: null, // allow GameState to fallback to core setRandomSeed

    // Entity arrays assignment hook
    assignEntityArrays({ enemies, playerBullets, enemyBullets, activeBombs }) {
      if (window.gameState) {
        window.gameState.enemies = enemies;
        window.gameState.playerBullets = playerBullets;
        window.gameState.enemyBullets = enemyBullets;
        window.gameState.activeBombs = activeBombs;
      }
    },

    // p5 accessor
    getP5() {
      return window.player && window.player.p ? window.player.p : null;
    },

    // Player lifecycle
    createPlayer(p, x, y, cameraSystem) {
      return new Player(p, x, y, cameraSystem);
    },
    setPlayer(player) {
      window.player = player;
    },
    getPlayer() {
      return window.player || null;
    },
    dispatchPlayerChanged(player) {
      window.dispatchEvent(
        new CustomEvent('playerChanged', { detail: player })
      );
    },

    // Camera
    cameraSystem: window.cameraSystem || null,

    // Managers
    createExplosionManager() {
      return new ExplosionManager();
    },
    createEffectsManager() {
      return new EffectsManager();
    },
    visualEffectsManager: window.visualEffectsManager || null,
    getVisualEffectsBackgroundLayers() {
      // Prefer existing manager's layers; fallback to global if present
      if (
        window.visualEffectsManager &&
        window.visualEffectsManager.backgroundLayers
      ) {
        return window.visualEffectsManager.backgroundLayers;
      }
      return window.backgroundLayers || null;
    },
    createVisualEffectsManager(backgroundLayers) {
      return new VisualEffectsManager(backgroundLayers);
    },
    initVisualEffectsManager(manager, p) {
      manager.init(p);
    },
    setManagers({ explosionManager, effectsManager, visualEffectsManager }) {
      window.explosionManager = explosionManager;
      window.effectsManager = effectsManager;
      window.visualEffectsManager = visualEffectsManager;
    },

    // Systems
    createSpawnSystem() {
      return new SpawnSystem();
    },
    createCollisionSystem() {
      return new CollisionSystem();
    },
    createBeatClock(bpm) {
      const ctx = window.audio ? window.audio.audioContext : null;
      return new BeatClock(ctx, bpm);
    },
    setSystems({ spawnSystem, collisionSystem, beatClock }) {
      if (spawnSystem) window.spawnSystem = spawnSystem;
      if (collisionSystem) window.collisionSystem = collisionSystem;
      if (beatClock) window.beatClock = beatClock;
    },
    spawnEnemies(count) {
      if (
        window.spawnSystem &&
        typeof window.spawnSystem.spawnEnemies === 'function'
      ) {
        window.spawnSystem.spawnEnemies(count);
      }
    },

    // Locals sync
    updateGameLoopLocals: window.updateGameLoopLocals || null,

    // Audio
    speakPlayerLine(player, id) {
      if (window.audio && typeof window.audio.speakPlayerLine === 'function') {
        window.audio.speakPlayerLine(player, id);
      }
    },
  };
}
