/**
 * @vibe/game entry barrel
 * Side-effect: boots the game loop.
 * Currently re-uses legacy /js/GameLoop.js while migration is in progress.
 */
import './GameLoop.js';
// Install VFX dispatcher to decouple game logic from effect managers
import { installVFXDispatcher } from '@vibe/fx/VFXDispatcher.js';
installVFXDispatcher();

// Export nothing – this module exists for its side-effect.
export {};
