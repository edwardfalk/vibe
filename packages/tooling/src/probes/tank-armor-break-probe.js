// tank-armor-break-probe.js
// Probe: Tank armor break VFX (cracks and debris)
import { PI } from '@vibe/core';

async function waitForDrawStart(timeoutMs = 3500) {
  const start = performance?.now?.() ?? Date.now();
  return new Promise((resolve) => {
    function tick() {
      const now = performance?.now?.() ?? Date.now();
      const fc =
        (window.p5 && window.p5.instance && window.p5.instance.frameCount) ||
        (window.player && window.player.p && window.player.p.frameCount) ||
        0;
      if (fc > 0) return resolve(true);
      if (now - start >= timeoutMs) return resolve(false);
      (window.requestAnimationFrame || setTimeout)(tick, 16);
    }
    tick();
  });
}

async function waitForTank(timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const tank = (window.enemies || []).find(
      (e) => e.type === 'tank' && !e.markedForRemoval
    );
    if (tank) return tank;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

export default (async function () {
  await waitForDrawStart();
  const tank = await waitForTank();
  const result = {
    foundTank: !!tank,
    cracksVisible: false,
    debrisSpawned: false,
    armorHP: null,
    failure: null,
    warnings: [],
    timestamp: Date.now(),
  };

  if (!tank) {
    result.failure = 'No tank found in enemy list';
    return result;
  }

  // Repeated hits to front armor: use bulletAngle aligned with tank front
  // Tank front is impactAngle ~ 0 relative to aimAngle; pass bulletAngle = tank.aimAngle - PI
  // Because Tank.takeDamage uses normalizeAngle(bulletAngle - this.aimAngle + PI)
  const frontAngle = (tank.aimAngle ?? 0) - PI;
  for (let i = 0; i < 12; i++) {
    const currentTank = (window.enemies || []).find(
      (e) => e.type === 'tank' && !e.markedForRemoval
    );
    if (!currentTank) {
      result.failure = 'Tank disappeared during probe';
      break;
    }
    try {
      currentTank.takeDamage(15, frontAngle, 'bullet');
    } catch (e) {
      result.failure = 'takeDamage threw: ' + (e?.message || e);
      break;
    }
    await new Promise((r) => setTimeout(r, 25));

    if (currentTank.frontArmorHP < 120 && !currentTank.frontArmorDestroyed) {
      result.cracksVisible = true;
    }

    result.armorHP = currentTank.frontArmorHP;

    if (currentTank.frontArmorDestroyed) {
      // Prefer event-driven VFX. If particles exposed, check for debris type.
      const debris = (window.visualEffectsManager?.particles || []).filter(
        (p) => p.type === 'debris'
      );
      result.debrisSpawned = debris.length > 0;
      break;
    }
  }

  if (!result.cracksVisible) {
    result.failure = 'No cracks visible after armor damage';
  } else if (!result.debrisSpawned) {
    result.failure = 'No debris spawned after armor break';
  }

  return result;
})();
