// scripts/validate-sounds.js
// Imports Audio class and triggers its constructor to validate sound registry.
// Exit code 1 if validation fails.

import { Audio } from '../packages/core/src/Audio.js';
import p5 from 'p5';

try {
  // Minimal stubs for dependencies
  const dummyP = {};
  const dummyPlayer = { x: 0, y: 0 };
  new Audio(dummyP, dummyPlayer); // constructor runs validation
  console.log('✅ validate-sounds: all sound configs look good');
} catch (e) {
  console.error('❌ validate-sounds failed:', e.message);
  process.exit(1);
}
