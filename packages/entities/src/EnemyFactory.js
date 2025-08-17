import { Grunt } from './Grunt.js';
import { Rusher } from './Rusher.js';
import { Tank } from './Tank.js';
import { Stabber } from './Stabber.js';
import { random } from '@vibe/core';

/**
 * EnemyFactory class - Handles enemy creation and type management
 * Provides unified interface for spawning different enemy types
 */
class EnemyFactory {
  constructor() {
    // Enemy type configurations
    this.configs = {
      grunt: {
        size: 32, // Increased hitbox for better bullet collision
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

    // Available enemy types
    this.availableTypes = Object.keys(this.configs);

    // Level-based enemy introduction
    this.levelIntroduction = {
      1: ['grunt'],
      2: ['grunt', 'stabber'],
      3: ['grunt', 'stabber', 'rusher'],
      5: ['grunt', 'stabber', 'rusher', 'tank'],
    };
  }

  /**
   * Get color for enemy type (converts array to p5.js color when needed)
   */
  getColor(type, p) {
    const config = this.configs[type];
    if (!config || !config.colorValues) return p.color(255, 255, 255); // Default white

    const [r, g, b] = config.colorValues;
    return p.color(r, g, b);
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

    // Create the enemy using the appropriate class with correct constructor signature
    const enemy = new EnemyClass(x, y, type, config, p, audio || window.audio);

    console.log(
      `🏭 EnemyFactory created ${type} at (${x.toFixed(0)}, ${y.toFixed(0)})`
    );
    return enemy;
  }

  /**
   * Get available enemy types for current level
   */
  getAvailableTypesForLevel(level) {
    // Find the highest level threshold that this level meets
    let availableTypes = ['grunt']; // Default fallback

    for (const [threshold, types] of Object.entries(this.levelIntroduction)) {
      if (level >= parseInt(threshold)) {
        availableTypes = types;
      }
    }

    return availableTypes;
  }

  /**
   * Create a random enemy appropriate for the current level
   */
  createRandomEnemyForLevel(x, y, level, p, audio = null) {
    const availableTypes = this.getAvailableTypesForLevel(level);
    const randomType =
      availableTypes[Math.floor(random() * availableTypes.length)];

    return this.createEnemy(x, y, randomType, p, audio);
  }

  /**
   * Create multiple enemies for spawning
   */
  createEnemies(spawnData, p, audio = null) {
    const enemies = [];

    for (const spawn of spawnData) {
      const enemy = this.createEnemy(spawn.x, spawn.y, spawn.type, p, audio);
      if (enemy) {
        enemies.push(enemy);
      }
    }

    return enemies;
  }

  /**
   * Get enemy type configuration
   */
  getConfig(type) {
    return this.configs[type] || null;
  }

  /**
   * Get all available enemy types
   */
  getAllTypes() {
    return [...this.availableTypes];
  }

  /**
   * Get enemy type information for debugging/UI
   */
  getTypeInfo(type, p) {
    const config = this.configs[type];
    if (!config) return null;

    return {
      type: type,
      size: config.size,
      health: config.health,
      speed: config.speed,
      color: this.getColor(type, p),
      description: config.description,
    };
  }

  /**
   * Get all enemy type information
   */
  getAllTypeInfo(p) {
    return this.availableTypes.map((type) => this.getTypeInfo(type, p));
  }

  /**
   * Validate enemy type
   */
  isValidType(type) {
    return this.availableTypes.includes(type);
  }

  /**
   * Get level progression information
   */
  getLevelProgression() {
    return { ...this.levelIntroduction };
  }

  /**
   * Check if enemy type is available at level
   */
  isTypeAvailableAtLevel(type, level) {
    const availableTypes = this.getAvailableTypesForLevel(level);
    return availableTypes.includes(type);
  }

  /**
   * Get enemy count recommendations for level
   */
  getEnemyCountForLevel(level) {
    // Dynamic enemy count limiting - max 2-6 enemies on screen based on level
    if (level <= 2) return 2;
    if (level <= 4) return 3;
    if (level <= 6) return 4;
    if (level <= 8) return 5;
    return 6; // Maximum enemies on screen
  }

  /**
   * Get spawn rate for level (frames between spawns)
   */
  getSpawnRateForLevel(level) {
    // Start with slower spawning, gradually increase
    const baseRate = 180; // 3 seconds at 60fps
    const reduction = Math.min(level * 10, 60); // Max reduction of 60 frames
    return Math.max(baseRate - reduction, 120); // Minimum 2 seconds between spawns
  }

  /**
   * Create enemy at random edge position
   */
  createEnemyAtEdge(
    type,
    screenWidth,
    screenHeight,
    cameraOffsetX = 0,
    cameraOffsetY = 0,
    p,
    audio = null
  ) {
    const margin = 50;
    let x, y;

    // Choose random edge (0=top, 1=right, 2=bottom, 3=left)
    const edge = Math.floor(random() * 4);

    switch (edge) {
      case 0: // Top
        x = random() * screenWidth + cameraOffsetX;
        y = cameraOffsetY - margin;
        break;
      case 1: // Right
        x = screenWidth + cameraOffsetX + margin;
        y = random() * screenHeight + cameraOffsetY;
        break;
      case 2: // Bottom
        x = random() * screenWidth + cameraOffsetX;
        y = screenHeight + cameraOffsetY + margin;
        break;
      case 3: // Left
        x = cameraOffsetX - margin;
        y = random() * screenHeight + cameraOffsetY;
        break;
    }

    return this.createEnemy(x, y, type, p, audio);
  }

  /**
   * Create enemy at random edge position for current level
   */
  createRandomEnemyAtEdge(
    level,
    screenWidth,
    screenHeight,
    cameraOffsetX = 0,
    cameraOffsetY = 0,
    p,
    audio = null
  ) {
    const availableTypes = this.getAvailableTypesForLevel(level);
    const randomType =
      availableTypes[Math.floor(random() * availableTypes.length)];

    return this.createEnemyAtEdge(
      randomType,
      screenWidth,
      screenHeight,
      cameraOffsetX,
      cameraOffsetY,
      p,
      audio
    );
  }

  /**
   * Debug information
   */
  getDebugInfo() {
    return {
      totalTypes: this.availableTypes.length,
      types: this.availableTypes,
      levelProgression: this.levelIntroduction,
      configs: Object.keys(this.configs).reduce((acc, type) => {
        acc[type] = {
          health: this.configs[type].health,
          speed: this.configs[type].speed,
          size: this.configs[type].size,
        };
        return acc;
      }, {}),
    };
  }
}

export { EnemyFactory };
