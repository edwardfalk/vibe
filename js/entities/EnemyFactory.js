import { Grunt } from './Grunt.js';
import { Rusher } from './Rusher.js';
import { Tank } from './Tank.js';
import { Stabber } from './Stabber.js';

/**
 * EnemyFactory class - Handles enemy creation and type management
 * Provides unified interface for spawning different enemy types
 */
class EnemyFactory {
  constructor(context = null) {
    this.context = context;
    // Enemy type configurations
    this.configs = {
      grunt: {
        size: 26,
        health: 2,
        speed: 1.2,
        colorValues: [50, 205, 50], // Store as array, convert to color when needed
        class: Grunt,
        description:
          'Tactical ranged combat, confused personality, friendly fire avoidance',
      },
      rusher: {
        size: 22,
        health: 1,
        speed: 2.8,
        colorValues: [255, 20, 147], // Store as array, convert to color when needed
        class: Rusher,
        description: 'Suicide bomber, explosive personality, battle cries',
      },
      tank: {
        size: 50,
        health: 60,
        speed: 0.3,
        colorValues: [138, 43, 226], // Store as array, convert to color when needed
        class: Tank,
        description: 'Heavy artillery, charging system, anger mechanics',
      },
      stabber: {
        size: 28,
        health: 10,
        speed: 1.5,
        colorValues: [255, 215, 0], // Store as array, convert to color when needed
        class: Stabber,
        description: 'Melee assassin, armored, three-phase attack system',
      },
    };
  }

  /**
   * Create an enemy of the specified type
   */
  createEnemy(x, y, type = 'grunt', p, audio = null) {
    if (!this.configs[type]) {
      console.warn(`⚠️ Unknown enemy type: ${type}, defaulting to grunt`);
      type = 'grunt';
    }

    const config = this.configs[type];
    const EnemyClass = config.class;

    if (!EnemyClass) {
      console.error(`⚠️ Enemy class not found for type: ${type}`);
      return null;
    }

    const resolvedAudio =
      audio ??
      this.context?.get?.('audio') ??
      (typeof window !== 'undefined' ? window.audio : null);
    const { class: _class, colorValues, ...rest } = config;
    const enrichedConfig = {
      ...rest,
      context: this.context,
      colorValues: colorValues ? [...colorValues] : undefined,
    };
    const enemy = new EnemyClass(x, y, type, enrichedConfig, p, resolvedAudio);

    return enemy;
  }
}

export { EnemyFactory };
