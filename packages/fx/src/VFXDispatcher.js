// VFXDispatcher – central listener that maps gameplay events to VFX systems
// Event names are simple strings here; can be elevated to a constants module later.

// Expected globals (Tier‑1 OK): window.effectsManager, window.visualEffectsManager

const VFX_EVENTS = {
  ENEMY_KILLED: 'vfx:enemy-killed', // detail: { x, y, type, killMethod }
  RUSHER_EXPLODED: 'vfx:rusher-explosion', // detail: { x, y }
  ENEMY_HIT: 'vfx:enemy-hit', // optional future use
};

const ENEMY_ALERT_COLORS = {
  grunt: [50, 205, 50],
  stabber: [255, 215, 0],
  rusher: [255, 40, 60],
};

function getPriorityEnemyType(enemies) {
  if (!Array.isArray(enemies)) return null;
  if (enemies.some((e) => e.type === 'rusher')) return 'rusher';
  if (enemies.some((e) => e.type === 'stabber')) return 'stabber';
  if (enemies.some((e) => e.type === 'grunt')) return 'grunt';
  return null;
}

function installVFXDispatcher() {
  if (typeof window === 'undefined') return;
  if (window.__vfxDispatcherInstalled) return;
  window.__vfxDispatcherInstalled = true;

  // Enemy killed → color-cohesive particles + subtle flash
  window.addEventListener(VFX_EVENTS.ENEMY_KILLED, (ev) => {
    try {
      const { x, y, type, enemyType } = ev.detail || {};
      const resolvedType = type || enemyType;
      const enemyKey = resolvedType;
      const paletteKey =
        enemyKey === 'rusher' ? 'rusher-explosion' : `${enemyKey}-death`;
      if (window.visualEffectsManager?.addExplosionParticles) {
        window.visualEffectsManager.addExplosionParticles(x, y, {
          enemyKey,
          paletteKey,
        });
        // Subtle ambient shift to restore slow reddish movement
        window.visualEffectsManager.triggerChromaticAberration?.(0.3, 60);
      }
      if (window.effectsManager?.addScreenFlash) {
        const primary =
          enemyKey === 'grunt'
            ? [50, 205, 50]
            : enemyKey === 'rusher'
              ? [255, 20, 147]
              : enemyKey === 'tank'
                ? [138, 43, 226]
                : enemyKey === 'stabber'
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
      if (window.visualEffectsManager?.addExplosionParticles) {
        window.visualEffectsManager.addExplosionParticles(x, y, {
          enemyKey: 'rusher',
          paletteKey: 'rusher-explosion',
        });
        window.visualEffectsManager.triggerChromaticAberration?.(0.6, 75);
      }
      window.cameraSystem?.addShake?.(18, 30);
    } catch (_) {}
  });

  // Generic enemy hit (non-lethal) – tiny sparks in enemy color
  window.addEventListener(VFX_EVENTS.ENEMY_HIT, (ev) => {
    try {
      const { x, y, type, enemyType } = ev.detail || {};
      const resolvedType = type || enemyType;
      const enemyKey = resolvedType;
      const paletteKey =
        enemyKey === 'rusher' ? 'rusher-explosion' : `${enemyKey}-death`;
      if (window.visualEffectsManager?.addExplosionParticles) {
        window.visualEffectsManager.addExplosionParticles(x, y, {
          enemyKey,
          paletteKey,
        });
      }
    } catch (_) {}
  });

  // Enemy spawn/composition change → subtle chromatic aberration warning
  let lastComposition = '';
  const monitorEnemyComposition = () => {
    try {
      const enemies = window.gameState?.enemies || [];
      const current = enemies.map((e) => e.type).sort().join(',');
      if (current !== lastComposition) {
        lastComposition = current;
        const priority = getPriorityEnemyType(enemies);
        const color = priority && ENEMY_ALERT_COLORS[priority];
        if (color && window.visualEffectsManager?.triggerChromaticAberration) {
          window.visualEffectsManager.triggerChromaticAberration(0.15, 45, color);
        }
      }
    } catch (_) {}
    window.requestAnimationFrame(monitorEnemyComposition);
  };
  window.requestAnimationFrame(monitorEnemyComposition);
}

export { VFX_EVENTS, installVFXDispatcher };
