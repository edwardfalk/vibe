import { Explosion } from './Explosion.js';
import { HazardCloud } from './HazardCloud.js';
import { EnemyFragmentExplosion } from './EnemyFragmentExplosion.js';
import { createContextAccessor } from '../../shared/ContextAccessor.js';

export class ExplosionManager {
  constructor(context = null) {
    this.context = context;
    this.explosions = [];
    this.plasmaClouds = [];
    this.radioactiveDebris = [];
    this.fragmentExplosions = [];
  }

  getContextValue = createContextAccessor(() => this.context);

  addExplosion(x, y, type) {
    this.explosions.push(new Explosion(x, y, type));
  }

  addPlasmaCloud(x, y) {
    this.plasmaClouds.push(new HazardCloud(x, y, 'PLASMA'));
    const audio = this.getContextValue('audio');
    if (audio) audio.playPlasmaCloud(x, y);
  }

  addRadioactiveDebris(x, y) {
    this.radioactiveDebris.push(new HazardCloud(x, y, 'DEBRIS'));
    const audio = this.getContextValue('audio');
    if (audio) audio.playPlasmaCloud(x, y);
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
      });
    }

    this.fragmentExplosions.push(fragmentExplosion);
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
}
