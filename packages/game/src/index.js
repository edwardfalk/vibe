/**
 * @vibe/game entry barrel
 * Side-effect: boots the game loop.
 * Now uses modular GameLoop.js from this package.
 */
import './GameLoop.js';

// TEMP: Minimal import test for module loading
console.log('🟢 [DEBUG] @vibe/game index.js: minimal import test');

// Export nothing – this module exists for its side-effect.
export {};
