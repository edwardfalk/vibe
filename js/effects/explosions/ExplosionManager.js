import { Explosion } from './Explosion.js';
import { RadioactiveDebris } from './RadioactiveDebris.js';
import { PlasmaCloud } from './PlasmaCloud.js';
import {
  EnemyFragmentExplosion,
  getFragmentPoolStats,
} from './EnemyFragmentExplosion.js';
import { random, TWO_PI, cos, sin } from '../../mathUtils.js';

export class ExplosionManager {
  constructor(context = null) {
    this.context = context;
    this.explosions = [];
    this.plasmaClouds = [];
    this.radioactiveDebris = [];
    this.fragmentExplosions = [];
  }

  getContextValue(key) {
    if (this.context && typeof this.context.get === 'function') {
      return this.context.get(key);
    }
    return window[key];
  }

  addExplosion(x, y, type = 'enemy') {
    const beatClock = this.getContextValue('beatClock');
    const beatIntensity = beatClock ? beatClock.getBeatIntensity(6) : 0;
    const isDownbeat = beatClock ? beatClock.getCurrentBeat() === 0 : false;

    // Create explosion with beat-enhanced properties
    const explosion = new Explosion(x, y, type);

    // Enhance explosion on strong beats
    if (beatIntensity > 0.3) {
      explosion.beatBoost = beatIntensity;
      explosion.sizeMultiplier = isDownbeat ? 1.3 : 1.15;
      explosion.particleMultiplier = isDownbeat ? 1.5 : 1.2;
      explosion.glowMultiplier = isDownbeat ? 1.4 : 1.2;
    }

    this.explosions.push(explosion);
  }

  addPlasmaCloud(x, y) {
    this.plasmaClouds.push(new PlasmaCloud(x, y));
    const audio = this.getContextValue('audio');
    if (audio) audio.playPlasmaCloud(x, y);
  }

  addRadioactiveDebris(x, y) {
    this.radioactiveDebris.push(new RadioactiveDebris(x, y));
    const audio = this.getContextValue('audio');
    if (audio) audio.playPlasmaCloud(x, y);
  }

  // Create multiple radioactive debris clouds around a bomb explosion
  addBombDebrisField(centerX, centerY, count = 5) {
    for (let i = 0; i < count; i++) {
      // Scatter debris clouds around the explosion center
      const angle = (i / count) * TWO_PI + random(-0.5, 0.5);
      const distance = random(80, 150); // Spread debris around explosion
      const debrisX = centerX + cos(angle) * distance;
      const debrisY = centerY + sin(angle) * distance;
      this.addRadioactiveDebris(debrisX, debrisY);
    }
    console.log(
      `☢️ Created radioactive debris field with ${count} contamination zones`
    );
  }

  // Add kill effects for different enemy types and kill methods
  addKillEffect(x, y, enemyType, killMethod = 'bullet') {
    if (enemyType === 'grunt') {
      if (killMethod === 'bullet') {
        // Electrical malfunction - green sparks with white electrical discharge
        this.explosions.push(new Explosion(x, y, 'grunt-bullet-kill'));
      } else if (killMethod === 'plasma') {
        // Green energy meltdown - deeper greens with plasma burn
        this.explosions.push(new Explosion(x, y, 'grunt-plasma-kill'));
      } else {
        // Fallback to generic grunt death
        this.explosions.push(new Explosion(x, y, 'grunt-death'));
      }
    } else if (enemyType === 'rusher') {
      if (killMethod === 'bullet') {
        // Speed explosion - hot pink with momentum trails
        this.explosions.push(new Explosion(x, y, 'rusher-bullet-kill'));
      } else if (killMethod === 'plasma') {
        // Pink plasma burn - intense plasma overload
        this.explosions.push(new Explosion(x, y, 'rusher-plasma-kill'));
      } else {
        // Fallback - rushers already have their explosion system
        this.explosions.push(new Explosion(x, y, 'rusher-explosion'));
      }
    } else if (enemyType === 'tank') {
      if (killMethod === 'bullet') {
        // Armor fragments - blue violet metal debris
        this.explosions.push(new Explosion(x, y, 'tank-bullet-kill'));
      } else if (killMethod === 'plasma') {
        // Massive energy discharge - blue plasma chain reaction
        this.explosions.push(new Explosion(x, y, 'tank-plasma-kill'));
        // Tanks also create plasma clouds when killed by plasma
        this.addPlasmaCloud(x, y);
      } else {
        // Fallback to tank plasma explosion
        this.explosions.push(new Explosion(x, y, 'tank-plasma'));
        this.addPlasmaCloud(x, y);
      }
    } else if (enemyType === 'stabber') {
      if (killMethod === 'bullet') {
        // Blade fragments - golden precision cuts
        this.explosions.push(new Explosion(x, y, 'stabber-bullet-kill'));
      } else if (killMethod === 'plasma') {
        // Energy sword discharge - gold plasma blade effects
        this.explosions.push(new Explosion(x, y, 'stabber-plasma-kill'));
      } else {
        // Fallback to generic stabber death
        this.explosions.push(new Explosion(x, y, 'stabber-death'));
      }
    } else {
      // Generic enemy explosion for unknown types
      this.explosions.push(new Explosion(x, y, 'enemy'));
    }

    const effectName = `${enemyType}-${killMethod}-kill`;
    console.log(
      `💥 ${enemyType} killed by ${killMethod} - created ${effectName} effect`
    );
  }

  addFragmentExplosion(x, y, enemy) {
    const fragmentExplosion = new EnemyFragmentExplosion(x, y, enemy);
    const beatClock = this.getContextValue('beatClock');
    const beatIntensity = beatClock ? beatClock.getBeatIntensity(6) : 0;
    if (beatIntensity > 0.3) {
      // Boost fragment speeds on beat
      fragmentExplosion.fragments.forEach((f) => {
        f.vx *= 1 + beatIntensity * 0.3;
        f.vy *= 1 + beatIntensity * 0.3;
        f.glow += beatIntensity * 0.3;
      });
    }

    this.fragmentExplosions.push(fragmentExplosion);
    // console.log(`✨ Created beautiful fragment explosion for ${enemy.type} at (${x}, ${y})`);
  }

  update() {
    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].update();
      if (!this.explosions[i].active) {
        const lastIndex = this.explosions.length - 1;
        if (i !== lastIndex) {
          this.explosions[i] = this.explosions[lastIndex];
        }
        this.explosions.pop();
      }
    }
    // Update fragment explosions
    for (let i = this.fragmentExplosions.length - 1; i >= 0; i--) {
      this.fragmentExplosions[i].update();
      if (!this.fragmentExplosions[i].active) {
        const lastIndex = this.fragmentExplosions.length - 1;
        if (i !== lastIndex) {
          this.fragmentExplosions[i] = this.fragmentExplosions[lastIndex];
        }
        this.fragmentExplosions.pop();
      }
    }
    // Update plasma clouds and collect area damage events
    const damageEvents = [];
    for (let i = this.plasmaClouds.length - 1; i >= 0; i--) {
      const damageInfo = this.plasmaClouds[i].update();
      if (damageInfo) damageEvents.push(damageInfo);
      if (!this.plasmaClouds[i].active) {
        const lastIndex = this.plasmaClouds.length - 1;
        if (i !== lastIndex) {
          this.plasmaClouds[i] = this.plasmaClouds[lastIndex];
        }
        this.plasmaClouds.pop();
      }
    }
    // Update radioactive debris and collect area damage events
    for (let i = this.radioactiveDebris.length - 1; i >= 0; i--) {
      const damageInfo = this.radioactiveDebris[i].update();
      if (damageInfo) damageEvents.push(damageInfo);
      if (!this.radioactiveDebris[i].active) {
        const lastIndex = this.radioactiveDebris.length - 1;
        if (i !== lastIndex) {
          this.radioactiveDebris[i] = this.radioactiveDebris[lastIndex];
        }
        this.radioactiveDebris.pop();
      }
    }
    return damageEvents;
  }

  draw(p) {
    // Draw all explosions
    for (const explosion of this.explosions) {
      explosion.draw(p);
    }
    // Draw all fragment explosions
    for (const fragmentExplosion of this.fragmentExplosions) {
      fragmentExplosion.draw(p);
    }
    // Draw all plasma clouds
    for (const cloud of this.plasmaClouds) {
      cloud.draw(p);
    }
    // Draw all radioactive debris
    for (const debris of this.radioactiveDebris) {
      debris.draw(p);
    }
  }

  getPoolStats() {
    return getFragmentPoolStats();
  }
}
