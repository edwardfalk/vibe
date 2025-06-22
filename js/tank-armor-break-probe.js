// tank-armor-break-probe.js
// Probe: Tank armor break VFX (cracks and debris)

(async function () {
  // Helper: Find a tank enemy
  const tank = (window.enemies || []).find(e => e.type === 'tank');
  const result = {
    foundTank: !!tank,
    cracksVisible: false,
    debrisSpawned: false,
    armorHP: null,
    failure: null,
    timestamp: Date.now(),
  };

  if (!tank) {
    result.failure = 'No tank found in enemy list';
    return result;
  }

  // Simulate repeated hits to front armor
  for (let i = 0; i < 10; i++) {
    tank.takeDamage(15, 0, 'bullet'); // 0 angle = front
    await new Promise(r => setTimeout(r, 20));
    if (tank.frontArmorHP < 120) {
      result.armorHP = tank.frontArmorHP;
      // Check for cracks: cracksVisible if HP < max
      result.cracksVisible = tank.frontArmorHP < 120 && !tank.frontArmorDestroyed;
    }
    if (tank.frontArmorDestroyed) {
      // Debris should be spawned in visualEffectsManager.particles
      const debris = (window.visualEffectsManager?.particles || []).filter(p => p.type === 'debris');
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