/**
 * @vibe/game entry barrel
 * Side-effect: boots the game loop.
 * Currently re-uses legacy /js/GameLoop.js while migration is in progress.
 */
// Old behaviour: import './GameLoop.js';
// New: light orchestrator using split modules
import './bootstrap/InputBootstrap.js';
import './bootstrap/AudioCanvasUnlock.js';
import { installVFXDispatcher } from '@vibe/fx/VFXDispatcher.js';
import { startGame } from './core/GameLoopCore.js';
import './dev/DevShortcuts.js';
import './dev/TestRunner.js';

// Activate dispatcher before the game boots so kill/hit events never miss listeners
installVFXDispatcher();
startGame();

// Export nothing – this module exists for its side-effect.
export {};
