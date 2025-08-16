// Minimal in-page test runner API for probes
// Offers stable hooks without reaching into internal modules

window.testRunner = window.testRunner || {
  async testGameMechanics() {
    try {
      const result = {
        movement: false,
        shooting: false,
        enemies: false,
      };

      // Basic movement: simulate W key via window.keys (used by Player.update)
      if (window.player && window.keys) {
        const startY = window.player.y;
        window.keys.W = true;
        window.keys.w = true;
        await new Promise((r) => setTimeout(r, 120));
        window.keys.W = false;
        window.keys.w = false;
        const endY = window.player.y;
        result.movement = endY < startY; // moving up decreases y in our coords
      }

      // Shooting
      if (window.player) {
        const startBullets = window.gameState?.playerBullets?.length ?? 0;
        window.playerIsShooting = true;
        // Allow enough frames so BeatClock quarter-beat gating can trigger
        await new Promise((r) => setTimeout(r, 400));
        window.playerIsShooting = false;
        const endBullets = window.gameState?.playerBullets?.length ?? 0;
        result.shooting = endBullets > startBullets;
      }

      // Enemies present
      result.enemies =
        Array.isArray(window.gameState?.enemies) &&
        window.gameState.enemies.length > 0;
      return result;
    } catch (err) {
      return { error: err?.toString?.() || 'Unknown error' };
    }
  },
};

export {};
