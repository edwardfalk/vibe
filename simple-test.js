// Simple test to verify our fixes
console.log('Testing fixed components...');

// Test 1: Check if audio manifest has all required sounds
fetch('/public/audio/manifest.json')
  .then((response) => response.json())
  .then((manifest) => {
    console.log('✅ Audio manifest loaded');
    console.log('🔊 Available sounds:', Object.keys(manifest).length);

    // Check if we have the key sounds
    const keySounds = [
      'playerShoot',
      'alienShoot',
      'tankEnergy',
      'explosion',
      'hit',
    ];
    const missing = keySounds.filter((sound) => !manifest[sound]);

    if (missing.length === 0) {
      console.log('✅ All key sounds available');
    } else {
      console.log('❌ Missing sounds:', missing);
    }
  })
  .catch((err) => {
    console.error('❌ Failed to load audio manifest:', err);
  });

// Test 2: Check if modules can be imported
async function testImports() {
  try {
    const core = await import('@vibe/core');
    console.log('✅ Core module imported');

    const systems = await import('@vibe/systems');
    console.log('✅ Systems module imported');

    const entities = await import('@vibe/entities');
    console.log('✅ Entities module imported');

    const fx = await import('@vibe/fx');
    console.log('✅ FX module imported');

    const game = await import('@vibe/game');
    console.log('✅ Game module imported');

    console.log('✅ All modules imported successfully');
  } catch (error) {
    console.error('❌ Module import failed:', error);
  }
}

// Test 3: Check if window globals are set up properly
function testWindowGlobals() {
  setTimeout(() => {
    console.log('🔍 Checking window globals...');

    const globals = ['player', 'enemies', 'audio', 'gameState', 'cameraSystem'];
    globals.forEach((global) => {
      if (window[global] !== undefined) {
        console.log(`✅ window.${global} exists`);
      } else {
        console.log(`❌ window.${global} missing`);
      }
    });
  }, 3000);
}

// Run tests
testImports();
testWindowGlobals();
