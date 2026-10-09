import { Explosion } from './Explosion.js';
import { RusherBlast } from './RusherBlast.js';
import { HazardCloud } from './HazardCloud.js';
import { BombSmoke } from './BombSmoke.js';
import { BombBlast } from './BombBlast.js';
import { EnemyFragmentExplosion } from './EnemyFragmentExplosion.js';
import { createContextAccessor } from '../../shared/ContextAccessor.js';
import { CONFIG } from '../../config.js';

const MS_PER_SEC = 1000;
const DEFAULT_BEAT_SEC = 0.5; // 120 BPM, with no beat clock (tests)

export class ExplosionManager {
  constructor(context = null) {
    this.context = context;
    this.explosions = [];
    this.plasmaClouds = [];
    this.radioactiveDebris = [];
    this.fragmentExplosions = [];
    this.smokes = []; // how the bombs' clouds look, with their sounds
    this.bangs = []; // the bombs' bangs: under and over everyone
  }

  getContextValue = createContextAccessor(() => this.context);

  /** A new run: every explosion, cloud and death of the last one goes */
  reset() {
    for (const smoke of this.smokes) smoke.end();
    this.smokes = [];
    this.bangs = [];
    this.explosions = [];
    this.plasmaClouds = [];
    this.radioactiveDebris = [];
    this.fragmentExplosions = [];
  }

  addExplosion(x, y, type, options = {}) {
    this.explosions.push(
      type === 'rusher-explosion'
        ? new RusherBlast(x, y, options)
        : new Explosion(x, y, type)
    );
  }

  /** The bang of the hero's bomb at (x, y); seed (0..1) is its own */
  addBombBlast(x, y, seed) {
    this.bangs.push(new BombBlast(x, y, seed));
  }

  /**
   * The cloud the hero's bomb leaves at (x, y): its damage, a PLASMA and a
   * DEBRIS HazardCloud, and how they look and sound together, one Smoke.
   * seed (0..1) is the cloud's own.
   */
  addBombCloud(x, y, seed) {
    this.plasmaClouds.push(new HazardCloud(x, y, 'PLASMA'));
    this.radioactiveDebris.push(new HazardCloud(x, y, 'DEBRIS'));
    const clock = this.getContextValue('beatClock');
    const audio = this.getContextValue('audio');
    this.smokes.push(
      new BombSmoke(x, y, {
        seed,
        beats: () => clock?.getBeatPosition?.() ?? 0,
        beatSec: clock ? clock.beatInterval / MS_PER_SEC : DEFAULT_BEAT_SEC,
        sound: audio?.playBombCloud?.(x, y, seed) ?? null,
      })
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
      });
    }

    this.fragmentExplosions.push(fragmentExplosion);
  }

  /**
   * The bombs' bangs age by a frame. Also in the hero's death scene, where
   * the world holds still: a bang that killed him plays out rather than
   * freezing over him
   */
  ageBangs(deltaTimeMs) {
    for (const bang of this.bangs) bang.update(deltaTimeMs);
    this.bangs = this.bangs.filter((bang) => bang.active);
  }

  update(deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS) {
    this.ageBangs(deltaTimeMs);
    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].update(deltaTimeMs);
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
    // Their pictures, a frame on with them; an ended one is gone
    for (const smoke of this.smokes) smoke.update();
    this.smokes = this.smokes.filter((smoke) => smoke.active);
    return damageEvents;
  }

  /** Under everyone, before the aliens: what lies on the ground */
  drawUnder(p) {
    for (const smoke of this.smokes) smoke.draw(p);
    for (const bang of this.bangs) bang.drawUnder(p);
  }

  /** Over everyone */
  draw(p) {
    // Draw all explosions
    for (const explosion of this.explosions) {
      explosion.draw(p);
    }
    // Draw all fragment explosions
    for (const fragmentExplosion of this.fragmentExplosions) {
      fragmentExplosion.draw(p);
    }
    // The bangs' fireballs and rings, over everything, a death included
    for (const bang of this.bangs) bang.draw(p);
  }
}
