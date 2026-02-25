/**
 * EnemyFragmentExplosion - Enemy death fragment particle effect.
 * Extracted from ExplosionManager.js for file-size split (~500 line guideline).
 */

import { random, TWO_PI, cos, sin } from '../../mathUtils.js';

const MAX_FRAGMENT_POOL_SIZE = 600;
const MAX_CENTRAL_PARTICLE_POOL_SIZE = 600;
const fragmentPool = [];
const centralParticlePool = [];
const poolStats = {
  fragmentAcquired: 0,
  fragmentReleased: 0,
  centralAcquired: 0,
  centralReleased: 0,
  peakFragmentPoolSize: 0,
  peakCentralPoolSize: 0,
};

function acquireFragment() {
  poolStats.fragmentAcquired++;
  return fragmentPool.pop() || {};
}

function releaseFragment(fragment) {
  if (!fragment || fragmentPool.length >= MAX_FRAGMENT_POOL_SIZE) return;
  fragmentPool.push(fragment);
  poolStats.fragmentReleased++;
  poolStats.peakFragmentPoolSize = Math.max(
    poolStats.peakFragmentPoolSize,
    fragmentPool.length
  );
}

function acquireCentralParticle() {
  poolStats.centralAcquired++;
  return centralParticlePool.pop() || {};
}

function releaseCentralParticle(particle) {
  if (!particle || centralParticlePool.length >= MAX_CENTRAL_PARTICLE_POOL_SIZE)
    return;
  centralParticlePool.push(particle);
  poolStats.centralReleased++;
  poolStats.peakCentralPoolSize = Math.max(
    poolStats.peakCentralPoolSize,
    centralParticlePool.length
  );
}

export function getFragmentPoolStats() {
  return {
    ...poolStats,
    fragmentPoolSize: fragmentPool.length,
    centralPoolSize: centralParticlePool.length,
    maxFragmentPoolSize: MAX_FRAGMENT_POOL_SIZE,
    maxCentralPoolSize: MAX_CENTRAL_PARTICLE_POOL_SIZE,
  };
}

export class EnemyFragmentExplosion {
  constructor(x, y, enemy) {
    this.x = x;
    this.y = y;
    this.enemy = enemy;
    this.fragments = [];
    this.active = true;
    this.timer = 0;
    this.maxTimer = 60;

    this.createEnemyFragments();

    this.centralExplosion = {
      particles: [],
      timer: 0,
      maxTimer: 30,
    };
    this.createCentralExplosion();
  }

  createEnemyFragments() {
    const size = this.enemy.size;
    const fragmentCount = 12;

    const bodyColor = this.enemy.bodyColor || [100, 150, 100];
    const skinColor = this.enemy.skinColor || [120, 180, 120];
    const helmetColor = this.enemy.helmetColor || [80, 80, 120];
    const weaponColor = this.enemy.weaponColor || [148, 0, 211];

    for (let i = 0; i < fragmentCount; i++) {
      const angle = (i / fragmentCount) * TWO_PI + random(-0.5, 0.5);
      const speed = random(6, 15);
      const fragmentSize = random(size * 0.4, size * 1.2);

      let fragmentColor, fragmentType;
      if (i < 3) {
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

      const fragment = acquireFragment();
      fragment.x = this.x + random(-size * 0.3, size * 0.3);
      fragment.y = this.y + random(-size * 0.3, size * 0.3);
      fragment.vx = cos(angle) * speed;
      fragment.vy = sin(angle) * speed;
      fragment.size = fragmentSize;
      fragment.color = fragmentColor;
      fragment.type = fragmentType;
      fragment.rotation = random(TWO_PI);
      fragment.rotationSpeed = random(-0.4, 0.4);
      const lifespan = random(80, 120);
      fragment.life = lifespan;
      fragment.maxLife = lifespan;
      fragment.gravity = 0.08;
      fragment.friction = 0.98;
      if (fragmentType === 'body') {
        fragment.bodyOffsets = fragment.bodyOffsets || [0, 0, 0, 0, 0, 0];
        for (let j = 0; j < fragment.bodyOffsets.length; j++) {
          fragment.bodyOffsets[j] = random(0.4);
        }
      } else {
        fragment.bodyOffsets = null;
      }
      this.fragments.push(fragment);
    }
  }

  createCentralExplosion() {
    const particleCount = 20;

    let primaryColor;
    if (this.enemy.type === 'grunt') primaryColor = [50, 205, 50];
    else if (this.enemy.type === 'stabber') primaryColor = [255, 215, 0];
    else if (this.enemy.type === 'rusher') primaryColor = [255, 20, 147];
    else if (this.enemy.type === 'tank') primaryColor = [138, 43, 226];
    else primaryColor = [255, 255, 255];

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * TWO_PI + random(-0.3, 0.3);
      const speed = random(3, 10);

      const particle = acquireCentralParticle();
      particle.x = this.x;
      particle.y = this.y;
      particle.vx = cos(angle) * speed;
      particle.vy = sin(angle) * speed;
      particle.size = random(12, 30);
      particle.color = primaryColor;
      const lifespan = random(40, 70);
      particle.life = lifespan;
      particle.maxLife = lifespan;
      particle.glow = random(0.7, 1.2);
      this.centralExplosion.particles.push(particle);
    }
  }

  update() {
    this.timer++;

    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const fragment = this.fragments[i];
      fragment.x += fragment.vx;
      fragment.y += fragment.vy;
      fragment.vy += fragment.gravity;
      fragment.vx *= fragment.friction;
      fragment.vy *= fragment.friction;
      fragment.rotation += fragment.rotationSpeed;
      fragment.life--;

      if (fragment.life <= 0) {
        const lastIndex = this.fragments.length - 1;
        releaseFragment(fragment);
        if (i !== lastIndex) this.fragments[i] = this.fragments[lastIndex];
        this.fragments.pop();
      }
    }

    this.centralExplosion.timer++;
    for (let i = this.centralExplosion.particles.length - 1; i >= 0; i--) {
      const particle = this.centralExplosion.particles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.95;
      particle.vy *= 0.95;
      particle.life--;

      if (particle.life <= 0) {
        const lastIndex = this.centralExplosion.particles.length - 1;
        releaseCentralParticle(particle);
        if (i !== lastIndex) {
          this.centralExplosion.particles[i] =
            this.centralExplosion.particles[lastIndex];
        }
        this.centralExplosion.particles.pop();
      }
    }

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

    for (const particle of this.centralExplosion.particles) {
      const alpha = p.map(particle.life, 0, particle.maxLife, 0, 255);
      p.push();
      p.translate(particle.x, particle.y);
      if (particle.glow > 0) {
        p.fill(
          particle.color[0],
          particle.color[1],
          particle.color[2],
          alpha * particle.glow * 0.3
        );
        p.noStroke();
        p.ellipse(0, 0, particle.size * 3);
      }
      p.fill(particle.color[0], particle.color[1], particle.color[2], alpha);
      p.noStroke();
      p.ellipse(0, 0, particle.size);
      p.fill(255, 255, 255, alpha * 0.6);
      p.ellipse(0, 0, particle.size * 0.4);
      p.pop();
    }

    for (const fragment of this.fragments) {
      const alpha = p.map(fragment.life, 0, fragment.maxLife, 0, 255);
      p.push();
      p.translate(fragment.x, fragment.y);
      p.rotate(fragment.rotation);
      p.fill(fragment.color[0], fragment.color[1], fragment.color[2], alpha);
      p.noStroke();

      if (fragment.type === 'head' || fragment.type === 'helmet') {
        p.ellipse(0, 0, fragment.size);
      } else if (fragment.type === 'body') {
        p.beginShape();
        const offsets = fragment.bodyOffsets || [0.4, 0.4, 0.4, 0.4, 0.4, 0.4];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TWO_PI;
          const radius = fragment.size * 0.5 * (0.8 + offsets[i]);
          p.vertex(cos(a) * radius, sin(a) * radius);
        }
        p.endShape(p.CLOSE);
      } else if (fragment.type === 'weapon') {
        p.rect(
          -fragment.size * 0.3,
          -fragment.size * 0.1,
          fragment.size * 0.6,
          fragment.size * 0.2
        );
      }

      p.fill(255, 255, 255, alpha * 0.3);
      p.ellipse(fragment.size * 0.2, -fragment.size * 0.2, fragment.size * 0.2);
      p.pop();
    }
  }
}
