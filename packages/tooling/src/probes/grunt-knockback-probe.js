// grunt-knockback-probe.js
// Probe: Grunt knock-back VFX
import { sqrt, cos, sin } from '@vibe/core';

async function waitForDrawStart(timeoutMs = 3500) {
  const start = performance?.now?.() ?? Date.now();
  return new Promise((resolve) => {
    function tick() {
      const now = performance?.now?.() ?? Date.now();
      const fc = (window.p5 && window.p5.instance && window.p5.instance.frameCount) || (window.player && window.player.p && window.player.p.frameCount) || 0;
      if (fc > 0) return resolve(true);
      if (now - start >= timeoutMs) return resolve(false);
      (window.requestAnimationFrame || setTimeout)(tick, 16);
    }
    tick();
  });
}

async function waitForGrunt(timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const grunt = (window.enemies || []).find((e) => e.type === 'grunt' && !e.markedForRemoval);
    if (grunt) return grunt;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

export default (async function () {
  await waitForDrawStart();
  const grunt = await waitForGrunt();
  const result = {
    foundGrunt: !!grunt,
    initialX: null,
    initialY: null,
    afterHitX: null,
    afterHitY: null,
    knockbackDelta: null,
    failure: null,
    warnings: [],
    timestamp: Date.now(),
  };

  if (!grunt) {
    result.failure = 'No grunt found in enemy list';
    return result;
  }

  // Snapshot before
  result.initialX = grunt.x;
  result.initialY = grunt.y;

  // Fire a bullet-like hit from angle = grunt.aimAngle (front-on) to avoid sideways constraints
  const angle = grunt.aimAngle ?? 0;
  try {
    grunt.takeDamage(5, angle, 'bullet');
  } catch (e) {
    result.failure = 'takeDamage threw: ' + (e?.message || e);
    return result;
  }

  // Wait a few frames for knock-back decay to be noticeable
  await new Promise((r) => setTimeout(r, 80));

  result.afterHitX = grunt.x;
  result.afterHitY = grunt.y;
  const dx = result.afterHitX - result.initialX;
  const dy = result.afterHitY - result.initialY;
  result.knockbackDelta = sqrt(dx * dx + dy * dy);

  if (result.knockbackDelta < 0.5) {
    result.failure = 'Grunt knock-back below threshold';
  }

  return result;
})();
