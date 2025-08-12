#!/usr/bin/env bun
/**
 * instrument-runtime-usage.js (browser-safe)
 * Instruments selected modules with lightweight hit counters and logs
 * a JSON summary after N seconds to the browser console.
 */

// Read seconds from URL (?usageSeconds=10) or fallback to 20
function getDumpSeconds() {
  try {
    const url = new URL(window.location.href);
    const v = Number(url.searchParams.get('usageSeconds'));
    if (Number.isFinite(v) && v > 0) return v;
  } catch {}
  return 20;
}

// Registry of counters keyed by module:function
const counters = {};
function inc(key) {
  counters[key] = (counters[key] || 0) + 1;
}

function attach() {
  if (typeof window === 'undefined') return;
  window.__runtimeUsage = { counters };

  // CameraSystem
  try {
    const cam = window.cameraSystem;
    if (cam && typeof cam.update === 'function' && !cam.__wrapped) {
      const orig = cam.update.bind(cam);
      cam.update = (...args) => {
        inc('CameraSystem.update');
        return orig(...args);
      };
      cam.__wrapped = true;
    }
  } catch {}

  // CollisionSystem
  try {
    const cs = window.collisionSystem;
    if (cs && typeof cs.checkCollisions === 'function' && !cs.__wrapped) {
      const orig = cs.checkCollisions.bind(cs);
      cs.checkCollisions = (...args) => {
        inc('CollisionSystem.checkCollisions');
        return orig(...args);
      };
      cs.__wrapped = true;
    }
  } catch {}

  // SpawnSystem
  try {
    const ss = window.spawnSystem;
    if (ss && typeof ss.update === 'function' && !ss.__wrapped) {
      const orig = ss.update.bind(ss);
      ss.update = (...args) => {
        inc('SpawnSystem.update');
        return orig(...args);
      };
      ss.__wrapped = true;
    }
  } catch {}

  // Player
  try {
    const pl = window.player;
    if (pl && typeof pl.update === 'function' && !pl.__wrapped) {
      const orig = pl.update.bind(pl);
      pl.update = (...args) => {
        inc('Player.update');
        return orig(...args);
      };
      pl.__wrapped = true;
    }
  } catch {}

  // Enemies (wrap existing set; newly spawned will be wrapped on demand elsewhere)
  try {
    if (Array.isArray(window.enemies)) {
      for (const e of window.enemies) {
        if (e && typeof e.update === 'function' && !e.__wrapped) {
          const orig = e.update.bind(e);
          e.update = (...args) => {
            inc(`${e.type || 'Enemy'}.update`);
            return orig(...args);
          };
          e.__wrapped = true;
        }
      }
    }
  } catch {}

  // Periodically wrap any newly spawned enemies during the sampling window
  const wrapNewEnemies = () => {
    try {
      if (!Array.isArray(window.enemies)) return;
      for (const e of window.enemies) {
        if (e && typeof e.update === 'function' && !e.__wrapped) {
          const orig = e.update.bind(e);
          e.update = (...args) => {
            inc(`${e.type || 'Enemy'}.update`);
            return orig(...args);
          };
          e.__wrapped = true;
        }
      }
    } catch {}
  };

  // Dump after timeout (console only)
  const secs = getDumpSeconds();
  const intervalId = setInterval(wrapNewEnemies, 500);
  setTimeout(() => {
    try {
      const payload = { when: new Date().toISOString(), counters };
      console.log('[RuntimeUsage]', JSON.stringify(payload));
    } catch (e) {
      console.warn('RuntimeUsage dump failed:', e?.message || e);
    }
    clearInterval(intervalId);
  }, secs * 1000);
}

attach();
