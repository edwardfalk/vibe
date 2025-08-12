#!/usr/bin/env bun
/**
 * instrument-runtime-usage.js
 * Instruments selected modules with lightweight hit counters and dumps
 * a summary after N seconds to .debug/runtime-usage-YYYYMMDD-HHMMSS.json
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('.debug');
const DUMP_SECONDS = Number(process.env.RUNTIME_USAGE_SECONDS || 20);

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

// Registry of counters keyed by module:function
const counters = {};
function inc(key) { counters[key] = (counters[key] || 0) + 1; }

// Patches applied at runtime via window hooks
function attach() {
  if (typeof window === 'undefined') return;
  window.__runtimeUsage = { counters };

  // CameraSystem
  try {
    const cam = window.cameraSystem;
    if (cam && typeof cam.update === 'function') {
      const orig = cam.update.bind(cam);
      cam.update = (...args) => { inc('CameraSystem.update'); return orig(...args); };
    }
  } catch {}

  // CollisionSystem
  try {
    const cs = window.collisionSystem;
    if (cs && typeof cs.checkCollisions === 'function') {
      const orig = cs.checkCollisions.bind(cs);
      cs.checkCollisions = (...args) => { inc('CollisionSystem.checkCollisions'); return orig(...args); };
    }
  } catch {}

  // SpawnSystem
  try {
    const ss = window.spawnSystem;
    if (ss && typeof ss.update === 'function') {
      const orig = ss.update.bind(ss);
      ss.update = (...args) => { inc('SpawnSystem.update'); return orig(...args); };
    }
  } catch {}

  // Player
  try {
    const pl = window.player;
    if (pl && typeof pl.update === 'function') {
      const orig = pl.update.bind(pl);
      pl.update = (...args) => { inc('Player.update'); return orig(...args); };
    }
  } catch {}

  // Enemies
  try {
    if (Array.isArray(window.enemies)) {
      for (const e of window.enemies) {
        if (e && typeof e.update === 'function' && !e.__wrapped) {
          const orig = e.update.bind(e);
          e.update = (...args) => { inc(`${e.type||'Enemy'}.update`); return orig(...args); };
          e.__wrapped = true;
        }
      }
    }
  } catch {}

  // Dump after timeout
  setTimeout(() => {
    try {
      ensureDir(OUT_DIR);
      const stamp = new Date().toISOString().replace(/[:.]/g,'-');
      const file = path.join(OUT_DIR, `runtime-usage-${stamp}.json`);
      fs.writeFileSync(file, JSON.stringify({ when: new Date().toISOString(), counters }, null, 2));
      console.log(`[RuntimeUsage] Wrote ${file}`);
    } catch (e) {
      console.warn('RuntimeUsage dump failed:', e?.message || e);
    }
  }, DUMP_SECONDS * 1000);
}

attach();
