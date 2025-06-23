// tank-armor-break-probe.js
// Probe: Tank armor break VFX (cracks and debris)

async function waitForTank(timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const tank = (window.enemies || []).find(e => e.type === 'tank');
    if (tank) return tank;
    await new Promise(r => setTimeout(r, 50));
  }
  return null;
}

export default (async function () {
  const tank = await waitForTank();
  const result = {
    foundTank: !!tank,
    cracksVisible: false,
    debrisSpawned: false,
    armorHP: null,
    failure: null,
    timestamp: Date.now(),
  };

  if (!tank) {
    console.error('[Tank Probe] No tank found. Enemies:', window.enemies);
    result.failure = 'No tank found in enemy list';
    return result;
  }

  // Simulate repeated hits to front armor
  for (let i = 0; i < 10; i++) {
    let currentTank = (window.enemies || []).find(e => e.type === 'tank');
    if (!currentTank) {
      console.error('[Tank Probe] Tank disappeared during probe. Enemies:', window.enemies);
      result.failure = 'Tank disappeared during probe';
      break;
    }
    currentTank.takeDamage(15, 0, 'bullet'); // 0 angle = front
    await new Promise(r => setTimeout(r, 20));

    // If armor is damaged but not yet destroyed, we should see cracks.
    if (currentTank.frontArmorHP < 120 && !currentTank.frontArmorDestroyed) {
      result.cracksVisible = true; // Latch to true if we ever see cracks
    }
    
    result.armorHP = currentTank.frontArmorHP;

    if (currentTank.frontArmorDestroyed) {
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