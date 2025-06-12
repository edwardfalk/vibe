import { Explosion } from './Explosion.js';
import { RadioactiveDebris } from './RadioactiveDebris.js';
import { PlasmaCloud } from './PlasmaCloud.js';
import { random, TWO_PI, cos, sin } from '@vibe/core';

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
    const fragmentCount = 12; // Increased from 8 for more dramatic effect

    // Get enemy colors
    const bodyColor = this.enemy.bodyColor || [100, 150, 100];
    const skinColor = this.enemy.skinColor || [120, 180, 120];
    const helmetColor = this.enemy.helmetColor || [80, 80, 120];
    const weaponColor = this.enemy.weaponColor || [148, 0, 211];

    // Create different fragment types based on enemy parts
    for (let i = 0; i < fragmentCount; i++) {
      const angle = (i / fragmentCount) * TWO_PI + random(-0.5, 0.5);
      const speed = random(6, 15); // Increased from 4-12 for even more dramatic flying
      const fragmentSize = random(size * 0.4, size * 1.2); // Increased from 0.3-0.8 to 0.4-1.2 for much bigger fragments

      // Determine fragment type and color based on position
      let fragmentColor, fragmentType;
      if (i < 3) {
        // Head fragments
        fragmentColor = skinColor;
        fragmentType = 'head';
      } else if (i < 6) {
        // Helmet fragments
        fragmentColor = helmetColor;
        fragmentType = 'helmet';
      } else if (i < 9) {
        // Body fragments
        fragmentColor = bodyColor;
        fragmentType = 'body';
      } else {
        // Weapon/arm fragments
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
        life: random(80, 120), // Increased from 60-90 for much longer visibility
        maxLife: random(80, 120),
        gravity: 0.08, // Reduced gravity for more floating effect
        friction: 0.98, // Increased friction slightly for better control
      });
    }
  }

  createCentralExplosion() {
    // Create a much more dramatic explosion in the center using enemy colors
    const particleCount = 20; // Increased from 15 for even more impact

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
      const speed = random(3, 10); // Increased from 2-8 for more dramatic spread

      this.centralExplosion.particles.push({
        x: this.x,
        y: this.y,
        vx: cos(angle) * speed,
        vy: sin(angle) * speed,
        size: random(12, 30), // Increased from 8-20 to 12-30 for much more visibility
        color: primaryColor,
        life: random(40, 70), // Increased from 30-50 for longer visibility
        maxLife: random(40, 70),
        glow: random(0.7, 1.2), // Increased glow intensity even more
      });
    }
  }

  update() {
    this.timer++;

    // Update fragments
    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const fragment = this.fragments[i];

      // Move fragment
      fragment.x += fragment.vx;
      fragment.y += fragment.vy;

      // Apply physics
      fragment.vy += fragment.gravity;
      fragment.vx *= fragment.friction;
      fragment.vy *= fragment.friction;

      // Rotate
      fragment.rotation += fragment.rotationSpeed;

      // Reduce life
      fragment.life--;

      // Remove dead fragments
      if (fragment.life <= 0) {
        this.fragments.splice(i, 1);
      }
    }

    // Update central explosion
    this.centralExplosion.timer++;
    for (let i = this.centralExplosion.particles.length - 1; i >= 0; i--) {
      const particle = this.centralExplosion.particles[i];

      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.95;
      particle.vy *= 0.95;
      particle.life--;

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
    if (!this.active) return;

    // Draw central explosion first (behind fragments)
    for (const particle of this.centralExplosion.particles) {
      const alpha = map(particle.life, 0, particle.maxLife, 0, 255);

      push();
      translate(particle.x, particle.y);

      // Glow effect
      if (particle.glow > 0) {
        fill(
          red(particle.color),
          green(particle.color),
          blue(particle.color),
          alpha * particle.glow * 0.3
        );
        noStroke();
        ellipse(0, 0, particle.size * 3);
      }

      // Main particle
      fill(
        red(particle.color),
        green(particle.color),
        blue(particle.color),
        alpha
      );
      noStroke();
      ellipse(0, 0, particle.size);

      // Bright core
      fill(255, 255, 255, alpha * 0.6);
      ellipse(0, 0, particle.size * 0.4);

      pop();
    }

    // Draw fragments
    for (const fragment of this.fragments) {
      const alpha = map(fragment.life, 0, fragment.maxLife, 0, 255);

      push();
      translate(fragment.x, fragment.y);
      rotate(fragment.rotation);

      fill(
        red(fragment.color),
        green(fragment.color),
        blue(fragment.color),
        alpha
      );
      noStroke();

      // Draw different shapes based on fragment type
      if (fragment.type === 'head' || fragment.type === 'helmet') {
        // Rounded fragments for head/helmet
        ellipse(0, 0, fragment.size);
      } else if (fragment.type === 'body') {
        // Angular fragments for body
        beginShape();
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * TWO_PI;
          const radius = fragment.size * 0.5 * (0.8 + random(0.4));
          const x = cos(angle) * radius;
          const y = sin(angle) * radius;
          vertex(x, y);
        }
        endShape(CLOSE);
      } else if (fragment.type === 'weapon') {
        // Rectangular fragments for weapons
        rect(
          -fragment.size * 0.3,
          -fragment.size * 0.1,
          fragment.size * 0.6,
          fragment.size * 0.2
        );
      }

      // Add subtle highlight
      fill(255, 255, 255, alpha * 0.3);
      ellipse(fragment.size * 0.2, -fragment.size * 0.2, fragment.size * 0.2);

      pop();
    }
  }
}

export class ExplosionManager {
  constructor() {
    this.explosions = [];
    this.plasmaClouds = [];
    this.radioactiveDebris = []; // New array for radioactive debris
    this.fragmentExplosions = []; // New array for fragment explosions
  }

  addExplosion(x, y, type = 'enemy') {
    this.explosions.push(new Explosion(x, y, type));
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

    let effectName = `${enemyType}-${killMethod}-kill`;
    console.log(
      `💥 ${enemyType} killed by ${killMethod} - created ${effectName} effect`
    );
  }

  // Add beautiful fragment explosion that cuts enemy into pieces
  addFragmentExplosion(x, y, enemy) {
    this.fragmentExplosions.push(new EnemyFragmentExplosion(x, y, enemy));
    // console.log(`✨ Created beautiful fragment explosion for ${enemy.type} at (${x}, ${y})`);
  }

  update() {
    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].update();
      if (!this.explosions[i].active) {
        this.explosions.splice(i, 1);
      }
    }
    // Update fragment explosions
    for (let i = this.fragmentExplosions.length - 1; i >= 0; i--) {
      this.fragmentExplosions[i].update();
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
