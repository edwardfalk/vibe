// grunt-knockback-probe.js
// Probe: Grunt knock-back VFX

async function waitForGrunt(timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const grunt = (window.enemies || []).find((e) => e.type === 'grunt');
    if (grunt) return grunt;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

export default (async function () {
  const grunt = await waitForGrunt();
  const result = {
    foundGrunt: !!grunt,
    initialX: null,
    initialY: null,
    afterHitX: null,
    afterHitY: null,
    knockbackDelta: null,
    failure: null,
    timestamp: Date.now(),
  };

  if (!grunt) {
    result.failure = 'No grunt found in enemy list';
    return result;
  }

  result.initialX = grunt.x;
  result.initialY = grunt.y;

  // Simulate a bullet hit from the left (angle = 0).
  // The game's VFXDispatcher should handle applying the impulse.
  grunt.takeDamage(5, 0, 'bullet');

  await new Promise((r) => setTimeout(r, 50));

  result.afterHitX = grunt.x;
  result.afterHitY = grunt.y;
  result.knockbackDelta = Math.sqrt(
    Math.pow(result.afterHitX - result.initialX, 2) +
      Math.pow(result.afterHitY - result.initialY, 2)
  );

  if (result.knockbackDelta < 5) {
    result.failure = 'Grunt did not move enough after knock-back';
  }

  return result;
})();
