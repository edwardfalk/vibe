/**
 * UIConstants - Layout, copy, and magic-number constants for UIRenderer.
 * Extracted from UIRenderer.js for file-size split (~500 line guideline).
 */

export const GAME_OVER_MESSAGES = [
  'GAME OVER',
  'YOU GOT VIBED',
  'ALIEN SUPERIORITY',
  'SPACE REKT',
  'COSMIC FAIL',
];

export const FUNNY_COMMENTS = [
  'The aliens are laughing at you!',
  'Maybe try not getting exploded?',
  'Space is hard, who knew?',
  'The rushers send their regards',
  'Better luck next time, earthling!',
];

/** Dash indicator position (CSS top/left) */
export const DASH_INDICATOR = {
  top: 120,
  left: 10,
};

/** Level progress bar layout */
export const LEVEL_PROGRESS = {
  barWidth: 200,
  barHeight: 8,
  marginRight: 20,
  marginTop: 20,
};

/** Health bar layout */
export const HEALTH_BAR = {
  barWidth: 150,
  barHeight: 12,
  marginLeft: 20,
  marginBottom: 40,
};

/** Kill streak indicator position (y from top) */
export const KILL_STREAK_Y = 80;

/** Bomb warning circle base size */
export const BOMB_WARNING_SIZE = 60;

/** Toast position and timing */
export const TOAST = {
  bottom: 32,
  durationMs: 2200,
};

/** Pulse/alpha for UI effects (Phase D constants) */
export const UI_PULSE_BASE = 50;
export const UI_ALPHA_MAX = 100;
