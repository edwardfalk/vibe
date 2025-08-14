// VFXDispatcher – central listener that maps gameplay events to VFX systems
// Event names are simple strings here; can be elevated to a constants module later.

// Expected globals (Tier‑1 OK): window.effectsManager, window.visualEffectsManager

const VFX_EVENTS = {
  ENEMY_KILLED: 'vfx:enemy-killed', // detail: { x, y, type, killMethod }
  RUSHER_EXPLODED: 'vfx:rusher-explosion', // detail: { x, y }
  ENEMY_HIT: 'vfx:enemy-hit', // optional future use
};

function installVFXDispatcher() {
  if (typeof window === 'undefined') return;
  if (window.__vfxDispatcherInstalled) return;
  window.__vfxDispatcherInstalled = true;

  // Enemy killed → color-cohesive particles + subtle flash
  window.addEventListener(VFX_EVENTS.ENEMY_KILLED, (ev) => {
    try {
      const { x, y, type } = ev.detail || {};
      if (window.visualEffectsManager?.addExplosionParticles) {
        window.visualEffectsManager.addExplosionParticles(x, y, type);
      }
      if (window.effectsManager?.addScreenFlash) {
        const primary =
          type === 'grunt'
            ? [50, 205, 50]
            : type === 'rusher'
            ? [255, 20, 147]
            : type === 'tank'
            ? [138, 43, 226]
            : type === 'stabber'
            ? [255, 215, 0]
            : [255, 255, 255];
        window.effectsManager.addScreenFlash(primary, 4);
      }
    } catch (_) {}
  });

  // Rusher explosion (self-detonation) → big shake + pink particles
  window.addEventListener(VFX_EVENTS.RUSHER_EXPLODED, (ev) => {
    try {
      const { x, y } = ev.detail || {};
      if (window.explosionManager?.addExplosion) {
        window.explosionManager.addExplosion(x, y, 'rusher-explosion');
      }
      if (window.visualEffectsManager?.addExplosionParticles) {
        window.visualEffectsManager.addExplosionParticles(x, y, 'rusher');
      }
      window.cameraSystem?.addShake?.(18, 30);
    } catch (_) {}
  });
}

export { VFX_EVENTS, installVFXDispatcher };


