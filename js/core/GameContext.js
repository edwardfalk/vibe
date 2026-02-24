const WINDOW_CONTEXT_KEYS = [
  'player',
  'enemies',
  'playerBullets',
  'enemyBullets',
  'activeBombs',
  'audio',
  'gameState',
  'cameraSystem',
  'collisionSystem',
  'spawnSystem',
  'explosionManager',
  'floatingText',
  'beatClock',
  'rhythmFX',
  'visualEffectsManager',
  'hitStopFrames',
  'testModeManager',
];

export class GameContext {
  constructor(initial = {}) {
    this.state = { ...initial };
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.state[key] = value;
    return value;
  }

  assign(values) {
    Object.assign(this.state, values);
  }

  toObject() {
    return { ...this.state };
  }

  static fromWindow() {
    const initial = {};
    for (const key of WINDOW_CONTEXT_KEYS) {
      if (typeof window !== 'undefined' && window[key] !== undefined) {
        initial[key] = window[key];
      }
    }
    return new GameContext(initial);
  }
}

export function createWindowBackedContext(baseContext = new GameContext()) {
  for (const key of WINDOW_CONTEXT_KEYS) {
    if (window[key] !== undefined && baseContext.get(key) === undefined) {
      baseContext.set(key, window[key]);
    }
  }
  return baseContext;
}
