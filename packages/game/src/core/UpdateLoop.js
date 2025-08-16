// UpdateLoop.js – Extracted per-frame update/draw orchestration
import EffectsProfiler from '@vibe/fx/EffectsProfiler.js';
import AdaptiveLODManager from '@vibe/fx/AdaptiveLODManager.js';
import { coreUpdateGame } from './CoreUpdate.js';
import { coreDrawGame } from './CoreDraw.js';

export function updateFrame(p) {
  // Maintain frameCount for probes in instance mode
  window.frameCount = p.frameCount;

  // Determine current high-level game state (default to 'playing' if unavailable)
  const gs = window.gameState ? window.gameState.gameState : 'playing';

  switch (gs) {
    case 'playing':
      coreUpdateGame(p);
      break;

    case 'gameOver':
      // Death-transition limbo continues running at slowed time.
      if (window.deathTransitionSystem) {
        window.deathTransitionSystem.update(p.deltaTime || 16);
      }
      // Continue updating world so enemies keep shooting, but scaled by timeScale.
      if (window.timeScale && window.timeScale < 1) {
        p.deltaTime *= window.timeScale;
      }
      coreUpdateGame(p);
      break;

    // 'paused', 'menu', etc. – no world update required (UI handled elsewhere)
    default:
      break;
  }
}

export function drawFrame(p) {
  EffectsProfiler.startFrame();

  // Hard clear the frame to prevent paint accumulation/trails
  if (typeof p.background === 'function') {
    p.background(0);
  } else if (typeof p.clear === 'function') {
    p.clear();
  }

  // -------------------------------------------------------------------
  // Background + registered renderers via RenderPipeline
  // -------------------------------------------------------------------
  if (window.renderPipeline) {
    window.renderPipeline.draw(p, p.deltaTime || 16);
  }

  // Overlay & profiler
  EffectsProfiler.endFrame();
  if (window.profilerOverlay) {
    window.profilerOverlay.draw(p);
  }
  AdaptiveLODManager.update();

  // Reset blend mode for safety (prevents lingering additive dots)
  if (typeof p.BLEND !== 'undefined') {
    p.blendMode(p.BLEND);
  }

  // Draw death transition overlay last so it sits on top.
  if (window.deathTransitionSystem) {
    window.deathTransitionSystem.draw(p);
  }
}
