/**
 * @vibe/game entry barrel
 * Side-effect: boots the game loop.
 * Currently re-uses legacy /js/GameLoop.js while migration is in progress.
 */
// Old behaviour: import './GameLoop.js';
// New: light orchestrator using split modules
import './bootstrap/InputBootstrap.js';
import './bootstrap/AudioCanvasUnlock.js';
import { startGame } from './core/GameLoopCore.js';
import './dev/DevShortcuts.js';
import './dev/TestRunner.js';
startGame();

// Install VFX dispatcher to decouple game logic from effect managers
import { installVFXDispatcher } from '@vibe/fx/VFXDispatcher.js';
installVFXDispatcher();

// Export nothing – this module exists for its side-effect.
export {};
