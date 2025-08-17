import { Explosion } from './Explosion.js';
import { RadioactiveDebris } from './RadioactiveDebris.js';
import { PlasmaCloud } from './PlasmaCloud.js';
import { randomRange as random, TWO_PI, cos, sin } from '@vibe/core';

/**
 * Explosion management system
 * Coordinates all explosion types and effects in the game
 */

class EnemyFragmentExplosion {
  constructor(x, y, enemy) {
    this.x = x;
    this.y = y;
    this.enemy = enemy; // Store enemy reference to get colors and type
    this.fragments = [];
    this.active = true;
    this.timer = 0;
    this.maxTimer = 60; // 1 second

    // Create fragments based on enemy type and appearance
    this.createEnemyFragments();

    // Central explosion using enemy colors
    this.centralExplosion = {
      particles: [],
      timer: 0,
      maxTimer: 30,
    };
    this.createCentralExplosion();
  }

  createEnemyFragments() {
    const size = this.enemy.size;
    // More fragments for grunts to make them really explode into pieces
    const fragmentCount = this.enemy.type === 'grunt' ? 24 : 15; // More fragments for fuller explosions

    // Get enemy colors
    const bodyColor = this.enemy.bodyColor || [100, 150, 100];
    const skinColor = this.enemy.skinColor || [120, 180, 120];
    const helmetColor = this.enemy.helmetColor || [80, 80, 120];
    const weaponColor = this.enemy.weaponColor || [148, 0, 211];

    // Create different fragment types based on enemy parts
    for (let i = 0; i < fragmentCount; i++) {
      const angle = (i / fragmentCount) * TWO_PI + random(-0.5, 0.5);
      // Extra dramatic speed for grunts to make them really explode
      const speed =
        this.enemy.type === 'grunt'
          ? random(4, 12) // Slower but bigger for grunts
          : random(3, 10); // Slower fragments for better visibility
      const fragmentSize = random(size * 1.0, size * 2.5); // MASSIVE fragments for maximum visual impact

      // Determine fragment type and color; for grunt use green palette exclusively
      let fragmentColor, fragmentType;
      if (this.enemy.type === 'grunt') {
        // Force grunt-death palette for all fragments
        const greens = [
          [50, 205, 50],
          [60, 220, 60],
          [40, 180, 40],
          [30, 150, 30],
          [80, 240, 80],
        ];
        fragmentColor = greens[Math.floor(Math.random() * greens.length)];

        // More varied fragment types for grunts to look like real body parts
        if (i < 2) {
          fragmentType = 'head';
        } else if (i < 4) {
          fragmentType = 'helmet';
        } else if (i < 8) {
          fragmentType = 'body';
        } else if (i < 12) {
          fragmentType = 'limb';
        } else {
          fragmentType = 'weapon';
        }
      } else if (i < 3) {
        fragmentColor = skinColor;
        fragmentType = 'head';
      } else if (i < 6) {
        fragmentColor = helmetColor;
        fragmentType = 'helmet';
      } else if (i < 9) {
        fragmentColor = bodyColor;
        fragmentType = 'body';
      } else {
        fragmentColor = weaponColor;
        fragmentType = 'weapon';
      }

      this.fragments.push({
        x: this.x + random(-size * 0.3, size * 0.3),
        y: this.y + random(-size * 0.3, size * 0.3),
        vx: cos(angle) * speed,
        vy: sin(angle) * speed,
        size: fragmentSize,
        color: fragmentColor,
        type: fragmentType,
        rotation: random(TWO_PI),
        rotationSpeed: random(-0.4, 0.4), // Increased rotation speed for more dramatic spinning
        life: random(20, 40), // Fade quickly for probe compliance
        maxLife: random(20, 40),
        gravity: 0.08, // Reduced gravity for more floating effect
        friction: 0.98, // Increased friction slightly for better control
      });
    }
  }

  createCentralExplosion() {
    // Create a much more dramatic explosion in the center using enemy colors
    // Extra particles for grunts to make them really satisfying to kill
    const particleCount = this.enemy.type === 'grunt' ? 40 : 25; // More particles for fuller central explosions

    // Get primary enemy color for explosion
    let primaryColor;
    if (this.enemy.type === 'grunt') {
      primaryColor = [50, 205, 50]; // Green
    } else if (this.enemy.type === 'stabber') {
      primaryColor = [255, 215, 0]; // Gold
    } else if (this.enemy.type === 'rusher') {
      primaryColor = [255, 20, 147]; // Pink
    } else if (this.enemy.type === 'tank') {
      primaryColor = [138, 43, 226]; // Blue violet
    } else {
      primaryColor = [255, 255, 255]; // White
    }

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * TWO_PI + random(-0.3, 0.3);
      const speed = random(2, 7); // Slower particles for more dramatic, visible explosion

      this.centralExplosion.particles.push({
        x: this.x,
        y: this.y,
        vx: cos(angle) * speed,
        vy: sin(angle) * speed,
        size: random(25, 60), // HUGE particles for incredible visual impact
        color: primaryColor,
        life: random(20, 40), // Shorter lifespan to ensure fade-out before probe
        maxLife: random(20, 40),
        glow: random(0.7, 1.2), // Increased glow intensity even more
      });
    }
  }

  update(deltaTimeMs) {
    const dtFactor = (deltaTimeMs || 16.6667) / 16.6667;

    this.timer += dtFactor;

    // Update fragments
    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const fragment = this.fragments[i];

      // Move fragment
      fragment.x += fragment.vx * dtFactor;
      fragment.y += fragment.vy * dtFactor;

      // Apply physics
      fragment.vy += fragment.gravity * dtFactor;
      fragment.vx *= Math.pow(fragment.friction, dtFactor);
      fragment.vy *= Math.pow(fragment.friction, dtFactor);

      // Rotate
      fragment.rotation += fragment.rotationSpeed * dtFactor;

      // Reduce life
      fragment.life -= dtFactor;

      // Remove dead fragments
      if (fragment.life <= 0) {
        this.fragments.splice(i, 1);
      }
    }

    // Safety timeout – hard cleanup to avoid lingering dots
    if (this.timer > this.maxTimer + 30) {
      this.fragments.length = 0;
      this.centralExplosion.particles.length = 0;
    }

    // Update central explosion
    this.centralExplosion.timer += dtFactor;
    for (let i = this.centralExplosion.particles.length - 1; i >= 0; i--) {
      const particle = this.centralExplosion.particles[i];

      particle.x += particle.vx * dtFactor;
      particle.y += particle.vy * dtFactor;
      const frictionFactor = Math.pow(0.95, dtFactor);
      particle.vx *= frictionFactor;
      particle.vy *= frictionFactor;
      particle.life -= dtFactor;

      if (particle.life <= 0) {
        this.centralExplosion.particles.splice(i, 1);
      }
    }

    // Check if explosion is finished
    if (
      this.timer >= this.maxTimer &&
      this.fragments.length === 0 &&
      this.centralExplosion.particles.length === 0
    ) {
      this.active = false;
    }
  }

  draw(p) {
    // Instance-mode compliant: every p5 call prefixed with `p.`; no local wrappers

    if (!this.active) return;

    // Ensure normal blend mode to prevent additive accumulation of explosion particles
    p.push();
    p.blendMode(p.BLEND);

    // Draw central explosion first (behind fragments)
    for (const particle of this.centralExplosion.particles) {
      const alpha = p.map(particle.life, 0, particle.maxLife, 0, 255);
      if (alpha < 30 || particle.size < 4) continue;

      p.push();
      p.translate(particle.x, particle.y);

      // Glow effect
      if (particle.glow > 0) {
        p.fill(
          p.red(particle.color),
          p.green(particle.color),
          p.blue(particle.color),
          alpha * particle.glow * 0.3
        );
        p.noStroke();
        p.ellipse(0, 0, particle.size * 3);
      }

      // Main particle
      p.fill(
        p.red(particle.color),
        p.green(particle.color),
        p.blue(particle.color),
        alpha
      );
      p.noStroke();
      p.ellipse(0, 0, particle.size);

      // Bright core (skip for grunt to keep explosion green)
      if (this.enemy.type !== 'grunt') {
        p.fill(255, 255, 255, alpha * 0.6);
        p.ellipse(0, 0, particle.size * 0.4);
      }

      p.pop();
    }

    p.pop(); // Restore previous blend mode

    // Draw fragments
    for (const fragment of this.fragments) {
      const alpha = p.map(fragment.life, 0, fragment.maxLife, 0, 255);
      if (alpha < 30 || fragment.size < 4) continue;

      p.push();
      p.translate(fragment.x, fragment.y);
      p.rotate(fragment.rotation);

      p.fill(
        p.red(fragment.color),
        p.green(fragment.color),
        p.blue(fragment.color),
        alpha
      );
      p.noStroke();

      // Draw different shapes based on fragment type
      if (fragment.type === 'head' || fragment.type === 'helmet') {
        // Rounded fragments for head/helmet
        p.ellipse(0, 0, fragment.size);
      } else if (fragment.type === 'body') {
        // Angular fragments for body
        p.beginShape();
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * TWO_PI;
          const radius = fragment.size * 0.5 * (0.8 + random(0.4));
          const x = cos(angle) * radius;
          const y = sin(angle) * radius;
          p.vertex(x, y);
        }
        p.endShape(p.CLOSE);
      } else if (fragment.type === 'limb') {
        // Elongated fragments for limbs (arms/legs)
        p.rect(
          -fragment.size * 0.15,
          -fragment.size * 0.4,
          fragment.size * 0.3,
          fragment.size * 0.8
        );
      } else if (fragment.type === 'weapon') {
        // Rectangular fragments for weapons
        p.rect(
          -fragment.size * 0.3,
          -fragment.size * 0.1,
          fragment.size * 0.6,
          fragment.size * 0.2
        );
      }

      // Add subtle highlight (skip for grunt)
      if (this.enemy.type !== 'grunt') {
        p.fill(255, 255, 255, alpha * 0.3);
        p.ellipse(
          fragment.size * 0.2,
          -fragment.size * 0.2,
          fragment.size * 0.2
        );
      }

      p.pop();
    }
  }
}

export class ExplosionManager {
  constructor() {
    // Debug frame counter for lingering dot investigation
    this._debugFrame = 0;
    this.explosions = [];
    this.plasmaClouds = [];
    this.radioactiveDebris = []; // New array for radioactive debris
    this.fragmentExplosions = []; // New array for fragment explosions
  }

  addExplosion(x, y, type = 'enemy') {
    if (window.DEBUG_VFX) {
      console.log('💥 addExplosion', type, x, y);
    }
    const exp = new Explosion(x, y, type);
    if (window.DEBUG_VFX && exp.particles?.[0]) {
      const c = exp.particles[0].color;
      console.log('   first particle rgb=', c);
    }
    this.explosions.push(exp);
  }

  addPlasmaCloud(x, y) {
    this.plasmaClouds.push(new PlasmaCloud(x, y));
    // Play ominous plasma formation sound
    if (window.audio) {
      window.audio.playPlasmaCloud(x, y);
    }
  }

  // Add radioactive debris clouds from tank bomb explosions
  addRadioactiveDebris(x, y) {
    this.radioactiveDebris.push(new RadioactiveDebris(x, y));
    // Play radioactive debris sound (reuse plasma sound for now)
    if (window.audio) {
      window.audio.playPlasmaCloud(x, y);
    }
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
    if (window.DEBUG_VFX) {
      console.log('⚔️ addKillEffect', enemyType, killMethod, x, y);
    }
    
    // Trigger psychedelic cosmic blast effect
    if (window.backgroundRenderer?.psychedelicEffects) {
      const intensity = enemyType === 'tank' ? 1.5 : enemyType === 'stabber' ? 1.2 : 0.8;
      window.backgroundRenderer.psychedelicEffects.triggerCosmicBlast(x, y, intensity);
    }
    // Trigger VFX burst & chromatic shift via VisualEffectsManager
    // Skip external VFX burst for grunt to avoid additive residue
    if (
      typeof window !== 'undefined' &&
      window.visualEffectsManager &&
      enemyType !== 'grunt'
    ) {
      window.visualEffectsManager.addExplosionParticles(x, y, {
        enemyKey: enemyType,
        paletteKey:
          enemyType === 'rusher' ? 'rusher-explosion' : `${enemyType}-death`,
      });
    }
    // Derive a primary color for flashes based on enemy type
    const primaryFlashColor =
      enemyType === 'grunt'
        ? [50, 205, 50]
        : enemyType === 'rusher'
          ? [255, 20, 147]
          : enemyType === 'tank'
            ? [138, 43, 226]
            : enemyType === 'stabber'
              ? [255, 215, 0]
              : [255, 255, 255];
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
        // Armor fragments - blue violet metal debris and resulting plasma cloud
        this.explosions.push(new Explosion(x, y, 'tank-bullet-kill'));
        // Tanks now always spawn a plasma cloud on bullet death for visual consistency
        this.addPlasmaCloud(x, y);
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

    // Particle burst + screen flash are now handled exclusively by VFXDispatcher
  }

  // Add beautiful fragment explosion that cuts enemy into pieces
  addFragmentExplosion(x, y, enemy) {
    this.fragmentExplosions.push(new EnemyFragmentExplosion(x, y, enemy));
    // console.log(`✨ Created beautiful fragment explosion for ${enemy.type} at (${x}, ${y})`);
  }

  /**
   * Update all explosion-related FX.
   * @param {number} deltaTimeMs - Frame time in milliseconds (defaults to baseline 16.67)
   */
  update(deltaTimeMs = 16.6667) {
    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].update(deltaTimeMs);
      if (!this.explosions[i].active) {
        this.explosions.splice(i, 1);
      }
    }
    // Update fragment explosions
    for (let i = this.fragmentExplosions.length - 1; i >= 0; i--) {
      this.fragmentExplosions[i].update(deltaTimeMs);
      if (!this.fragmentExplosions[i].active) {
        this.fragmentExplosions.splice(i, 1);
      }
    }
    // Update plasma clouds and collect area damage events
    const damageEvents = [];
    for (let i = this.plasmaClouds.length - 1; i >= 0; i--) {
      const damageInfo = this.plasmaClouds[i].update();
      if (damageInfo) damageEvents.push(damageInfo);
      if (!this.plasmaClouds[i].active) {
        this.plasmaClouds.splice(i, 1);
      }
    }
    // Update radioactive debris and collect area damage events
    for (let i = this.radioactiveDebris.length - 1; i >= 0; i--) {
      const damageInfo = this.radioactiveDebris[i].update();
      if (damageInfo) damageEvents.push(damageInfo);
      if (!this.radioactiveDebris[i].active) {
        this.radioactiveDebris.splice(i, 1);
      }
    }
    // --- DEBUG lingering dots ---------------------------------------------
    if (window.DEBUG_DOTS) {
      this._debugFrame++;
      if (this._debugFrame % 30 === 0) {
        const central =
          this.explosions.reduce(
            (sum, e) => sum + (e.particles?.length || 0),
            0
          ) +
          this.fragmentExplosions.reduce(
            (sum, fe) => sum + fe.centralExplosion.particles.length,
            0
          );
        const fragments = this.fragmentExplosions.reduce(
          (sum, fe) => sum + fe.fragments.length,
          0
        );
        console.log(
          `⚪ dots debug – central:${central} fragments:${fragments} ` +
            `exp:${this.explosions.length} fragExp:${this.fragmentExplosions.length}`
        );
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
