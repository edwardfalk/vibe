# Bug Fixes, Performance & Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 bugs/perf issues and consolidate the background system, in one branch with batch-separated commits.

**Architecture:** Three batches — quick wins (Fixes 1-4), combat fixes (Fixes 5,7), performance & cleanup (Fixes 8-10). Each batch is one commit. All changes are in `js/` except one test file update.

**Tech Stack:** Vanilla JS (ES modules), p5.js instance mode, Vitest + Playwright for tests.

**Spec:** `docs/superpowers/specs/2026-03-28-bug-fixes-and-cleanup-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `js/GameLoop.js` | Remove duplicate collision call, fix chromatic aberration, pass enemyDeathHandler to BombSystem |
| Modify | `js/core/GameState.js` | Debounce localStorage writes |
| Modify | `js/systems/BackgroundRenderer.js` | Remove dead SubtleSpaceElements, update imports for consolidated files |
| Delete | `js/systems/background/SubtleSpaceElements.js` | Dead code |
| Modify | `js/systems/gameplay/EnemyUpdatePipeline.js` | Pass enemy ref instead of index |
| Modify | `js/systems/CollisionSystem.js` | Accept enemy ref instead of index |
| Modify | `js/systems/combat/PlayerContactHandlers.js` | Accept enemy ref instead of index |
| Modify | `tests/gameplay-probe.test.js` | Update test for new rusher explosion API |
| Modify | `js/systems/BombSystem.js` | Use enemyDeathHandler instead of collisionSystem |
| Modify | `js/effects/AreaDamageHandler.js` | Remove collisionSystem fallback |
| Modify | `js/effects/VisualEffectsManager.js` | Cache gradient, pool particles |
| Modify | `js/effects/EffectsManager.js` | Pool particles and trails |
| Create | `js/systems/background/BackgroundLayers.js` | Merged: config + factory + renderers + medium stars + near field + beat reactive |
| Create | `js/systems/background/BackgroundEffects.js` | Merged: beat pulse + interactive effects + aurora wisps |
| Modify | `js/systems/background/EnhancedSpaceElements.js` | Remove AuroraWisps re-export |
| Delete | `js/systems/background/ParallaxLayerConfig.js` | Merged into BackgroundLayers |
| Delete | `js/systems/background/ParallaxLayerFactory.js` | Merged into BackgroundLayers |
| Delete | `js/systems/background/ParallaxLayerRenderers.js` | Merged into BackgroundLayers |
| Delete | `js/systems/background/MediumStarRenderer.js` | Merged into BackgroundLayers |
| Delete | `js/systems/background/NearFieldParallax.js` | Merged into BackgroundLayers |
| Delete | `js/systems/background/BeatReactiveBackground.js` | Merged into BackgroundLayers |
| Delete | `js/systems/background/BeatPulseOverlay.js` | Merged into BackgroundEffects |
| Delete | `js/systems/background/InteractiveBackgroundEffects.js` | Merged into BackgroundEffects |
| Delete | `js/systems/background/AuroraWisps.js` | Merged into BackgroundEffects |

---

## Task 1: Remove duplicate `checkBulletCollisions()` call

**Files:**
- Modify: `js/GameLoop.js:200-203`

- [ ] **Step 1: Delete the pre-enemy-update collision call**

In `js/GameLoop.js`, delete lines 200-203:

```javascript
  // Immediately process bullet collisions to catch hits before enemies move
  if (window.collisionSystem) {
    window.collisionSystem.checkBulletCollisions();
  }
```

The post-enemy-update call at lines 232-235 remains (it includes `checkContactCollisions()` too).

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Manual verification**

Open `index.html` in browser. Shoot enemies. Verify:
- Bullets still kill enemies on hit
- Score increments once per kill (not doubled)
- No console errors

---

## Task 2: Delete dead `SubtleSpaceElements.js`

**Files:**
- Delete: `js/systems/background/SubtleSpaceElements.js`
- Modify: `js/systems/BackgroundRenderer.js:34-37, 149-154, 175`

- [ ] **Step 1: Remove import from BackgroundRenderer**

In `js/systems/BackgroundRenderer.js`, delete lines 34-37:

```javascript
import {
  drawSubtleSpaceElementsLayer,
  resetSubtleSpaceElementsCache,
} from './background/SubtleSpaceElements.js';
```

- [ ] **Step 2: Remove the dead method**

In `js/systems/BackgroundRenderer.js`, delete the `drawSubtleSpaceElements` method (lines 149-154):

```javascript
  // Draw subtle space elements
  drawSubtleSpaceElements(p = this.p) {
    p.push();
    drawSubtleSpaceElementsLayer(p);
    p.pop();
  }
```

- [ ] **Step 3: Remove cache reset call**

In `js/systems/BackgroundRenderer.js`, in the `reset()` method, delete:

```javascript
    resetSubtleSpaceElementsCache();
```

- [ ] **Step 4: Delete the file**

```bash
rm js/systems/background/SubtleSpaceElements.js
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

---

## Task 3: Fix chromatic aberration direction

**Files:**
- Modify: `js/GameLoop.js:142`

- [ ] **Step 1: Invert the progress calculation**

In `js/GameLoop.js`, change line 142 from:

```javascript
      const hitStopProgress = next / 8; // Normalize to max expected frames
```

to:

```javascript
      const hitStopProgress = (8 - next) / 8; // Intensity peaks at end of hitstop (impact moment)
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

---

## Task 4: Debounce localStorage high score writes

**Files:**
- Modify: `js/core/GameState.js`

- [ ] **Step 1: Add debounce fields to constructor**

In `js/core/GameState.js`, add at the end of the constructor (after `this.pauseStartTime = 0;`):

```javascript
    // High score write debounce
    this._highScoreDirty = false;
    this._highScoreDebounceTimer = null;
    this._boundFlush = () => this._flushHighScore();
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this._boundFlush);
    }
```

- [ ] **Step 2: Add `_flushHighScore` method**

Add after the `updateHighScore()` method:

```javascript
  _flushHighScore() {
    if (this._highScoreDirty) {
      localStorage.setItem('vibeHighScore', this.highScore.toString());
      this._highScoreDirty = false;
    }
    if (this._highScoreDebounceTimer) {
      clearTimeout(this._highScoreDebounceTimer);
      this._highScoreDebounceTimer = null;
    }
  }
```

- [ ] **Step 3: Replace `updateHighScore` with debounced version**

Replace the existing `updateHighScore()` method:

```javascript
  updateHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this._highScoreDirty = true;
      if (!this._highScoreDebounceTimer) {
        this._highScoreDebounceTimer = setTimeout(() => {
          this._highScoreDebounceTimer = null;
          this._flushHighScore();
        }, 5000);
      }
    }
  }
```

- [ ] **Step 4: Flush immediately on game over**

In `setGameState()`, inside the `newState === 'gameOver'` branch, replace the existing `this.updateHighScore();` call with:

```javascript
      this._flushHighScore();
```

- [ ] **Step 5: Clean up timer on restart**

In `restart()`, add after `this.pauseStartTime = 0;`:

```javascript
    this._flushHighScore();
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run`
Expected: All tests pass (GameState tests exist in `tests/unit/GameState.test.js`).

---

## Task 5: Commit Batch 1

- [ ] **Step 1: Commit**

```bash
git add js/GameLoop.js js/core/GameState.js js/systems/BackgroundRenderer.js
git add -u js/systems/background/SubtleSpaceElements.js
git commit -m "fix: remove duplicate collision check, dead code, chromatic aberration, localStorage debounce

- Remove duplicate checkBulletCollisions() call that ran twice per frame
- Delete never-called SubtleSpaceElements.js and its references
- Fix chromatic aberration to peak at end of hitstop (impact moment)
- Debounce localStorage high score writes to every 5s instead of every kill

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Fix rusher index invalidation — pass enemy reference

**Files:**
- Modify: `js/systems/gameplay/EnemyUpdatePipeline.js:7-49`
- Modify: `js/systems/CollisionSystem.js:472-483`
- Modify: `js/systems/combat/PlayerContactHandlers.js:106-148`
- Modify: `tests/gameplay-probe.test.js:173-181`

- [ ] **Step 1: Update EnemyUpdatePipeline to pass enemy reference**

In `js/systems/gameplay/EnemyUpdatePipeline.js`, change the `handleRusherExplosionResult` function signature and body. Replace:

```javascript
function handleRusherExplosionResult(result, enemyIndex, context) {
  const {
    enemies,
    collisionSystem,
    explosionManager,
    visualEffectsManager,
    audio,
    cameraSystem,
  } = context;

  if (collisionSystem) {
    collisionSystem.handleRusherExplosion(result, enemyIndex);
  }
```

with:

```javascript
function handleRusherExplosionResult(result, enemy, context) {
  const {
    collisionSystem,
    explosionManager,
    visualEffectsManager,
    audio,
    cameraSystem,
  } = context;

  if (collisionSystem) {
    collisionSystem.handleRusherExplosion(result, enemy);
  }
```

Also replace line 48-49:

```javascript
  const enemy = enemies[enemyIndex];
  if (enemy) enemy.markedForRemoval = true;
```

with:

```javascript
  if (enemy) enemy.markedForRemoval = true;
```

And update the call site at line 175. Replace:

```javascript
      handleRusherExplosionResult(result, i, context);
```

with:

```javascript
      handleRusherExplosionResult(result, enemy, context);
```

- [ ] **Step 2: Update CollisionSystem.handleRusherExplosion**

In `js/systems/CollisionSystem.js`, replace lines 471-483:

```javascript
  // Handle rusher explosion collision
  handleRusherExplosion(explosion, rusherIndex) {
    handleRusherExplosionCollision({
      explosion,
      rusherIndex,
      player: this.getContextValue('player'),
      audio: this.getContextValue('audio'),
      gameState: this.getContextValue('gameState'),
      cameraSystem: this.getContextValue('cameraSystem'),
      explosionManager: this.getContextValue('explosionManager'),
      enemies: this.getContextValue('enemies'),
    });
  }
```

with:

```javascript
  // Handle rusher explosion collision
  handleRusherExplosion(explosion, rusherEnemy) {
    handleRusherExplosionCollision({
      explosion,
      rusherEnemy,
      player: this.getContextValue('player'),
      audio: this.getContextValue('audio'),
      gameState: this.getContextValue('gameState'),
      cameraSystem: this.getContextValue('cameraSystem'),
      explosionManager: this.getContextValue('explosionManager'),
    });
  }
```

- [ ] **Step 3: Update PlayerContactHandlers**

In `js/systems/combat/PlayerContactHandlers.js`, replace the `handleRusherExplosionCollision` function (lines 106-148):

```javascript
export function handleRusherExplosionCollision({
  explosion,
  rusherEnemy,
  player,
  audio,
  gameState,
  cameraSystem,
  explosionManager,
}) {
  if (!player) return;

  const distance = sqrt(
    (player.x - explosion.x) ** 2 + (player.y - explosion.y) ** 2
  );
  if (distance > explosion.radius) return;

  logDebug(
    `💥 RUSHER EXPLOSION HIT PLAYER! Distance: ${distance.toFixed(1)}, Radius: ${explosion.radius}`
  );

  audio?.playPlayerHit?.();
  audio?.playRusherExplosion?.(explosion.x, explosion.y);
  gameState?.resetKillStreak?.();

  if (player.takeDamage(explosion.damage, 'rusher-explosion')) {
    gameState?.setGameState?.('gameOver');
    logDebug('💀 PLAYER KILLED BY RUSHER EXPLOSION!');
    return;
  }

  const knockbackAngle = atan2(player.y - explosion.y, player.x - explosion.x);
  const knockbackForce = 12;
  player.velocity.x += cos(knockbackAngle) * knockbackForce;
  player.velocity.y += sin(knockbackAngle) * knockbackForce;

  cameraSystem?.addShake?.(15, 25);
  explosionManager?.addExplosion?.(player.x, player.y, 'hit');

  if (rusherEnemy) {
    rusherEnemy.markedForRemoval = true;
  }
}
```

- [ ] **Step 4: Update the Playwright test**

In `tests/gameplay-probe.test.js`, replace lines 173-181:

```javascript
      window.collisionSystem.handleRusherExplosion(
        {
          x: window.player.x,
          y: window.player.y,
          radius: 999,
          damage: 50,
        },
        -1 // rusherIndex sentinel: no owner (handler treats negative as safe)
      );
```

with:

```javascript
      window.collisionSystem.handleRusherExplosion(
        {
          x: window.player.x,
          y: window.player.y,
          radius: 999,
          damage: 50,
        },
        null // no owning rusher enemy
      );
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run && npx playwright test`
Expected: All tests pass.

---

## Task 7: Standardize enemy death to one code path

**Files:**
- Modify: `js/systems/BombSystem.js:28-38, 136-139`
- Modify: `js/effects/AreaDamageHandler.js:7-17, 75-92`
- Modify: `js/GameLoop.js:206-215`

- [ ] **Step 1: Pass enemyDeathHandler to BombSystem**

In `js/GameLoop.js`, in the `updateBombSystem()` call (~line 206), add `enemyDeathHandler`:

```javascript
  updateBombSystem({
    activeBombs,
    enemies,
    player: window.player,
    explosionManager,
    audio: window.audio,
    cameraSystem: window.cameraSystem,
    gameState: window.gameState,
    collisionSystem: window.collisionSystem,
    enemyDeathHandler,
  });
```

- [ ] **Step 2: Update BombSystem to use enemyDeathHandler**

In `js/systems/BombSystem.js`, add `enemyDeathHandler` to the destructuring at line 28-38:

```javascript
export function updateBombs(context) {
  const {
    activeBombs,
    enemies,
    player,
    explosionManager,
    audio,
    cameraSystem,
    gameState,
    collisionSystem,
    enemyDeathHandler,
  } = context;
```

Then replace lines 137-139:

```javascript
        if (collisionSystem) {
          collisionSystem.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y);
        }
```

with:

```javascript
        if (enemyDeathHandler) {
          enemyDeathHandler.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y);
        } else if (collisionSystem) {
          collisionSystem.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y);
        }
```

- [ ] **Step 3: Simplify AreaDamageHandler fallback**

In `js/effects/AreaDamageHandler.js`, replace lines 78-92:

```javascript
          if (enemyDeathHandler) {
            enemyDeathHandler.handleEnemyDeath(
              enemy,
              enemy.type,
              enemy.x,
              enemy.y
            );
          } else if (collisionSystem) {
            collisionSystem.handleEnemyDeath(
              enemy,
              enemy.type,
              enemy.x,
              enemy.y
            );
          }
```

with:

```javascript
          if (enemyDeathHandler) {
            enemyDeathHandler.handleEnemyDeath(
              enemy,
              enemy.type,
              enemy.x,
              enemy.y
            );
          }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

---

## Task 8: Commit Batch 2

- [ ] **Step 1: Commit**

```bash
git add js/systems/gameplay/EnemyUpdatePipeline.js js/systems/CollisionSystem.js js/systems/combat/PlayerContactHandlers.js tests/gameplay-probe.test.js js/systems/BombSystem.js js/effects/AreaDamageHandler.js js/GameLoop.js
git commit -m "fix: rusher index safety and standardize enemy death path

- Pass enemy object reference instead of array index for rusher explosions
  to prevent wrong-enemy marking when array shifts during a frame
- Route BombSystem enemy deaths through EnemyDeathHandler for consistent
  death effects and audio
- Remove collisionSystem fallback from AreaDamageHandler

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Cache `drawSpaceGradient` to offscreen canvas

**Files:**
- Modify: `js/effects/VisualEffectsManager.js`

- [ ] **Step 1: Add cache field to constructor**

In `js/effects/VisualEffectsManager.js`, add in the constructor after `this.initFailed = false;`:

```javascript
    this._gradientCache = null;
    this._gradientW = 0;
    this._gradientH = 0;
```

- [ ] **Step 2: Replace `drawSpaceGradient` with cached version**

Replace the entire `drawSpaceGradient` method:

```javascript
  drawSpaceGradient(p) {
    if (
      this._gradientCache &&
      this._gradientW === p.width &&
      this._gradientH === p.height
    ) {
      p.image(this._gradientCache, 0, 0);
      return;
    }
    // Rebuild cache
    if (this._gradientCache) {
      this._gradientCache.remove();
    }
    this._gradientCache = p.createGraphics(p.width, p.height);
    this._gradientW = p.width;
    this._gradientH = p.height;

    const g = this._gradientCache;
    g.noFill();
    const c1 = g.color(15, 5, 35);
    const c2 = g.color(60, 30, 80);
    const c3 = g.color(25, 15, 45);
    for (let i = 0; i <= g.height; i += 2) {
      const inter = g.map(i, 0, g.height, 0, 1);
      let currentColor;
      if (inter < 0.5) {
        currentColor = g.lerpColor(c1, c3, inter * 2);
      } else {
        currentColor = g.lerpColor(c3, c2, (inter - 0.5) * 2);
      }
      g.stroke(currentColor);
      g.line(0, i, g.width, i);
    }
    p.image(this._gradientCache, 0, 0);
  }
```

- [ ] **Step 3: Run tests and manual check**

Run: `npx vitest run`
Open in browser — verify the purple/dark gradient background still appears correctly.

---

## Task 10: Pool particles in VisualEffectsManager

**Files:**
- Modify: `js/effects/VisualEffectsManager.js`

- [ ] **Step 1: Add module-level particle pool**

At the top of `js/effects/VisualEffectsManager.js`, after the import line, add:

```javascript
const PARTICLE_POOL_MAX = 200;
const particlePool = [];

function acquireParticle(props) {
  const p = particlePool.length > 0 ? particlePool.pop() : {};
  // Reset all keys from previous use
  p.x = props.x;
  p.y = props.y;
  p.vx = props.vx;
  p.vy = props.vy;
  p.size = props.size;
  p.life = props.life;
  p.maxLife = props.maxLife;
  p.color = props.color;
  p.type = props.type;
  p.gravity = props.gravity || 0;
  p.fade = props.fade || 0;
  return p;
}

function releaseParticle(p) {
  if (particlePool.length < PARTICLE_POOL_MAX) {
    particlePool.push(p);
  }
}
```

- [ ] **Step 2: Replace `this.particles.push({...})` calls with `acquireParticle`**

In `addExplosion()` (line 238), replace:

```javascript
      this.particles.push({
        x,
        y,
        vx: random(-8, 8),
        vy: random(-8, 8),
        size: random(3, 8),
        life: 60,
        maxLife: 60,
        color: random(colors),
        type: 'explosion',
        gravity: 0.1,
        fade: random(0.02, 0.05),
      });
```

with:

```javascript
      this.particles.push(acquireParticle({
        x,
        y,
        vx: random(-8, 8),
        vy: random(-8, 8),
        size: random(3, 8),
        life: 60,
        maxLife: 60,
        color: random(colors),
        type: 'explosion',
        gravity: 0.1,
        fade: random(0.02, 0.05),
      }));
```

Do the same for all other `this.particles.push({...})` calls in `addExplosionParticles()` and `addMotionTrail()` — replace the object literal with `acquireParticle({...})`.

- [ ] **Step 3: Replace splice with swap-and-pop in `updateParticles`**

Replace the `updateParticles` method:

```javascript
  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];

      part.x += part.vx;
      part.y += part.vy;

      if (part.type === 'explosion') {
        part.vy += part.gravity;
        part.vx *= 0.98;
      }

      part.life -= part.fade * 60;

      if (part.life <= 0) {
        releaseParticle(part);
        // Swap with last element and pop (O(1) removal)
        const last = this.particles.length - 1;
        if (i < last) {
          this.particles[i] = this.particles[last];
        }
        this.particles.pop();
      }
    }

    this.timeOffset++;
  }
```

- [ ] **Step 4: Run tests and manual check**

Run: `npx vitest run`
Open in browser — shoot enemies, verify explosion particles still render and fade correctly.

---

## Task 11: Pool particles and trails in EffectsManager

**Files:**
- Modify: `js/effects/EffectsManager.js`

- [ ] **Step 1: Add reset methods to Particle and Trail classes**

In `js/effects/EffectsManager.js`, add a `reset` method to the `Particle` class (after `isDead()` at line 233):

```javascript
  reset(x, y, angle, speed, size, color, life) {
    this.x = x;
    this.y = y;
    this.vx = cos(angle) * speed;
    this.vy = sin(angle) * speed;
    this.size = size;
    this.maxSize = size;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.rotation = random(TWO_PI);
    this.rotationSpeed = random(-0.2, 0.2);
  }
```

Add a `reset` method to the `Trail` class (after `isDead()` at line 277):

```javascript
  reset(x, y, angle, color, segments) {
    this.points.length = 0;
    this.color = color;
    this.maxSegments = segments;
    for (let i = 0; i < segments; i++) {
      this.points.push({
        x: x - cos(angle) * i * 3,
        y: y - sin(angle) * i * 3,
        life: segments - i,
      });
    }
  }
```

- [ ] **Step 2: Add module-level pools**

At the top of the file, after the imports, add:

```javascript
const PARTICLE_POOL_MAX = 100;
const TRAIL_POOL_MAX = 50;
const particlePool = [];
const trailPool = [];
```

- [ ] **Step 3: Update `addExplosionParticles` to use pool**

Replace the `this.particles.push(new Particle(...))` call in `addExplosionParticles` (line 157):

```javascript
      const particle = particlePool.length > 0
        ? particlePool.pop()
        : new Particle(x, y, angle, speed, size, color, 60);
      if (particlePool.length >= 0) {
        particle.reset(x, y, angle, speed, size, color, 60);
      }
      this.particles.push(particle);
```

Simplify to:

```javascript
      let particle;
      if (particlePool.length > 0) {
        particle = particlePool.pop();
        particle.reset(x, y, angle, speed, size, color, 60);
      } else {
        particle = new Particle(x, y, angle, speed, size, color, 60);
      }
      this.particles.push(particle);
```

- [ ] **Step 4: Update `addBulletTrail` to use pool**

Replace the `this.trails.push(new Trail(...))` call in `addBulletTrail` (line 163):

```javascript
    let trail;
    if (trailPool.length > 0) {
      trail = trailPool.pop();
      trail.reset(x, y, angle, color, 15);
    } else {
      trail = new Trail(x, y, angle, color, 15);
    }
    this.trails.push(trail);
```

- [ ] **Step 5: Replace splice with swap-and-pop in `update()`**

Replace the particle and trail removal loops in `update()` (lines 69-85):

```javascript
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.update();

      if (particle.isDead()) {
        if (particlePool.length < PARTICLE_POOL_MAX) {
          particlePool.push(particle);
        }
        const last = this.particles.length - 1;
        if (i < last) {
          this.particles[i] = this.particles[last];
        }
        this.particles.pop();
      }
    }

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      trail.update();

      if (trail.isDead()) {
        if (trailPool.length < TRAIL_POOL_MAX) {
          trailPool.push(trail);
        }
        const last = this.trails.length - 1;
        if (i < last) {
          this.trails[i] = this.trails[last];
        }
        this.trails.pop();
      }
    }
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

---

## Task 12: Consolidate background — create `BackgroundLayers.js`

**Files:**
- Create: `js/systems/background/BackgroundLayers.js`
- Delete: `ParallaxLayerConfig.js`, `ParallaxLayerFactory.js`, `ParallaxLayerRenderers.js`, `MediumStarRenderer.js`, `NearFieldParallax.js`, `BeatReactiveBackground.js`

- [ ] **Step 1: Create `BackgroundLayers.js`**

Create `js/systems/background/BackgroundLayers.js` by concatenating the 6 source files. The file should contain:

```javascript
/**
 * BackgroundLayers.js — Consolidated parallax layer config, generation, and rendering.
 * Merged from: ParallaxLayerConfig, ParallaxLayerFactory, ParallaxLayerRenderers,
 *   MediumStarRenderer, NearFieldParallax, BeatReactiveBackground
 */

import { floor, random, randomRange } from '../../mathUtils.js';

// === Layer Config ===

export function createParallaxLayerConfig() {
  return [
    { name: 'distant_galaxies', elements: [], speed: 0.05, depth: 0.95 },
    { name: 'distant_stars', elements: [], speed: 0.1, depth: 0.9 },
    { name: 'nebula_streams', elements: [], speed: 0.2, depth: 0.8 },
    { name: 'aurora_wisps', elements: [], speed: 0.25, depth: 0.75 },
    { name: 'nebula_clouds', elements: [], speed: 0.3, depth: 0.7 },
    { name: 'enhanced_sparkles', elements: [], speed: 0.4, depth: 0.6 },
    { name: 'medium_stars', elements: [], speed: 0.5, depth: 0.5 },
    { name: 'shooting_stars', elements: [], speed: 0.6, depth: 0.4 },
    { name: 'close_debris', elements: [], speed: 0.8, depth: 0.3 },
    { name: 'foreground_sparks', elements: [], speed: 1.2, depth: 0.1 },
  ];
}

// === Layer Factory ===

const DISTANT_STAR_COUNT = 50;
const NEBULA_CLOUD_COUNT = 8;
const MEDIUM_STAR_COUNT = 30;
const CLOSE_DEBRIS_COUNT = 15;
const FOREGROUND_SPARK_COUNT = 60;
const DISTANT_GALAXY_COUNT = 6;
const NEBULA_STREAM_COUNT = 15;
const AURORA_WISP_COUNT = 12;
const ENHANCED_SPARKLE_COUNT = 40;
const SHOOTING_STAR_COUNT = 5;
const MEDIUM_STAR_COLORS = ['white', 'cyan', 'magenta'];
const DEBRIS_SHAPES = ['triangle', 'square', 'diamond'];

export function generateParallaxLayerElements(parallaxLayers, p) {
  const findLayer = (name) => parallaxLayers.find((l) => l.name === name);

  const distantGalaxies = findLayer('distant_galaxies');
  if (distantGalaxies) {
    for (let i = 0; i < DISTANT_GALAXY_COUNT; i++) {
      distantGalaxies.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        phase: randomRange(0, p.TWO_PI),
      });
    }
  }

  const distantStars = findLayer('distant_stars');
  if (distantStars) {
    for (let i = 0; i < DISTANT_STAR_COUNT; i++) {
      distantStars.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(1, 3),
        brightness: randomRange(0.3, 1),
        twinkleSpeed: randomRange(0.01, 0.03),
      });
    }
  }

  const nebulaStreams = findLayer('nebula_streams');
  if (nebulaStreams) {
    for (let i = 0; i < NEBULA_STREAM_COUNT; i++) {
      nebulaStreams.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        phase: randomRange(0, p.TWO_PI),
      });
    }
  }

  const auroraWisps = findLayer('aurora_wisps');
  if (auroraWisps) {
    for (let i = 0; i < AURORA_WISP_COUNT; i++) {
      auroraWisps.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        phase: randomRange(0, p.TWO_PI),
      });
    }
  }

  const nebulaClouds = findLayer('nebula_clouds');
  if (nebulaClouds) {
    for (let i = 0; i < NEBULA_CLOUD_COUNT; i++) {
      nebulaClouds.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(100, 300),
        color: {
          r: randomRange(11, 46),
          g: randomRange(0, 11),
          b: randomRange(26, 70),
        },
        alpha: randomRange(0.05, 0.15),
        driftSpeed: randomRange(0.1, 0.3),
      });
    }
  }

  const enhancedSparkles = findLayer('enhanced_sparkles');
  if (enhancedSparkles) {
    for (let i = 0; i < ENHANCED_SPARKLE_COUNT; i++) {
      enhancedSparkles.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        phase: randomRange(0, p.TWO_PI),
      });
    }
  }

  const mediumStars = findLayer('medium_stars');
  if (mediumStars) {
    for (let i = 0; i < MEDIUM_STAR_COUNT; i++) {
      mediumStars.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(2, 5),
        brightness: randomRange(0.5, 1),
        color: MEDIUM_STAR_COLORS[floor(random() * MEDIUM_STAR_COLORS.length)],
      });
    }
  }

  const shootingStars = findLayer('shooting_stars');
  if (shootingStars) {
    for (let i = 0; i < SHOOTING_STAR_COUNT; i++) {
      shootingStars.elements.push({
        startX: randomRange(-p.width, p.width * 2),
        startY: randomRange(-p.height, p.height * 2),
        endXOffset: randomRange(200, 500),
        endYOffset: randomRange(-500, -200),
        phaseOffset: randomRange(0, 600),
      });
    }
  }

  const closeDebris = findLayer('close_debris');
  if (closeDebris) {
    for (let i = 0; i < CLOSE_DEBRIS_COUNT; i++) {
      closeDebris.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(3, 8),
        rotation: randomRange(0, p.TWO_PI),
        rotationSpeed: randomRange(-0.02, 0.02),
        shape: DEBRIS_SHAPES[floor(random() * DEBRIS_SHAPES.length)],
      });
    }
  }

  const foregroundSparks = findLayer('foreground_sparks');
  if (foregroundSparks) {
    for (let i = 0; i < FOREGROUND_SPARK_COUNT; i++) {
      foregroundSparks.elements.push({
        x: randomRange(-p.width, p.width * 2),
        y: randomRange(-p.height, p.height * 2),
        size: randomRange(2, 4),
        alpha: randomRange(150 / 255, 1),
        flickerSpeed: randomRange(0.05, 0.15),
      });
    }
  }
}

// === Beat Reactive Values ===

export function getBeatReactiveValues() {
  const beatClock = window.beatClock;
  if (!beatClock) {
    return { beatPulse: 0, measurePhase: 0, downbeatIntensity: 0, beatIntensity: 0 };
  }
  return {
    beatPulse: beatClock.getBeatIntensity(8),
    measurePhase: beatClock.getMeasurePhase(),
    downbeatIntensity: beatClock.getDownbeatIntensity(3),
    beatIntensity: beatClock.getBeatIntensity(4),
  };
}

export function computeMediumStarVisual(star, starIndex, frameCount, twoPi, beatPulse, measurePhase, sinFn) {
  const starPhase = (star.x * 0.01 + star.y * 0.01) % twoPi;
  const twinkleSpeed = 0.05 + star.size * 0.01;
  const timeTwinkle = sinFn(frameCount * twinkleSpeed + starPhase) * 0.5 + 0.5;
  const beatTwinkle = (sinFn(measurePhase * twoPi + starPhase) * 0.5 + 0.5) * beatPulse;
  const combinedBrightness = star.brightness * (0.7 + timeTwinkle * 0.3 + beatTwinkle * 0.3);
  const alpha = Math.min(255, combinedBrightness * 255);
  const sizePulse = 1 + beatPulse * 0.2 * ((starIndex % 3) / 3);
  const finalSize = star.size * sizePulse;
  return { alpha, finalSize, combinedBrightness, beatPulse };
}

// === Layer Renderers ===

export function drawDistantStarsLayer(stars, p, beatClock = null) {
  const beatBoost = beatClock ? beatClock.getBeatIntensity(10) * 80 : 0;
  const beatPulse = beatClock ? beatClock.getBeatIntensity(6) : 0;
  const STAR_BEAT_MULTIPLIER = 10;

  p.noStroke();
  p.drawingContext.shadowBlur = 5 + beatPulse * 10;
  p.drawingContext.shadowColor = '#FFFFFF';
  for (const star of stars) {
    const twinkle = p.sin(p.frameCount * star.twinkleSpeed) * 0.5 + 0.5;
    const alpha = Math.min(255, star.brightness * twinkle * 255 + beatBoost);
    p.fill(255, 255, 255, alpha);
    p.ellipse(star.x, star.y, star.size + beatPulse * STAR_BEAT_MULTIPLIER, star.size + beatPulse * STAR_BEAT_MULTIPLIER);
  }
  p.drawingContext.shadowBlur = 0;
  p.drawingContext.shadowColor = 'transparent';
}

export function drawNebulaCloudLayer(clouds, p, beatClock = null) {
  const beatPulse = beatClock ? beatClock.getBeatIntensity(6) : 0;
  p.noStroke();
  for (const cloud of clouds) {
    const drift = p.sin(p.frameCount * cloud.driftSpeed) * 20;
    const boost = beatPulse * 0.7;
    const r = Math.min(255, cloud.color.r + boost * 60);
    const g = Math.min(255, cloud.color.g + boost * 30);
    const b = Math.min(255, cloud.color.b + boost * 80);
    const alpha = Math.min(255, cloud.alpha * 255 * (1 + boost * 2.5));
    p.drawingContext.shadowBlur = 40 + beatPulse * 40;
    p.drawingContext.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha / 255})`;
    p.fill(r, g, b, alpha);
    p.ellipse(cloud.x + drift, cloud.y, cloud.size + beatPulse * 10, (cloud.size + beatPulse * 10) * 0.6);
  }
  p.drawingContext.shadowBlur = 0;
  p.drawingContext.shadowColor = 'transparent';
}

export function drawMediumStarsLayer(stars, p) {
  const { beatPulse, measurePhase } = getBeatReactiveValues();
  p.noStroke();
  let starIndex = 0;
  for (const star of stars) {
    const { alpha, finalSize } = computeMediumStarVisual(
      star, starIndex, p.frameCount, p.TWO_PI, beatPulse, measurePhase, p.sin.bind(p)
    );
    switch (star.color) {
      case 'cyan':
        p.fill(0, 243, 255, alpha);
        p.drawingContext.shadowColor = '#00F3FF';
        break;
      case 'magenta':
        p.fill(255, 0, 200, alpha);
        p.drawingContext.shadowColor = '#FF00C8';
        break;
      default: {
        const modAlpha = p.constrain(alpha + beatPulse * 40, 0, 255);
        p.fill(255, 255, 255, modAlpha);
        p.drawingContext.shadowColor = '#FFFFFF';
      }
    }
    const shadowBlurCandidate = 5 + beatPulse * 20;
    p.drawingContext.shadowBlur = Math.max(0, shadowBlurCandidate);
    const currentSize = Math.max(1, finalSize + beatPulse * 2);
    p.ellipse(star.x, star.y, currentSize, currentSize);
    starIndex++;
  }
  p.drawingContext.shadowBlur = 0;
  p.drawingContext.shadowColor = 'transparent';
}

export function drawCloseDebrisLayer(debris, p) {
  p.stroke(255, 0, 200, 150);
  p.strokeWeight(2);
  p.noFill();
  p.drawingContext.shadowBlur = 10;
  p.drawingContext.shadowColor = '#FF00C8';
  for (const piece of debris) {
    p.push();
    p.translate(piece.x, piece.y);
    p.rotate(piece.rotation);
    piece.rotation += piece.rotationSpeed;
    switch (piece.shape) {
      case 'triangle':
        p.triangle(-piece.size / 2, piece.size / 2, piece.size / 2, piece.size / 2, 0, -piece.size / 2);
        break;
      case 'square':
        p.rect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
        break;
      case 'diamond':
        p.quad(0, -piece.size / 2, piece.size / 2, 0, 0, piece.size / 2, -piece.size / 2, 0);
        break;
    }
    p.pop();
  }
  p.drawingContext.shadowBlur = 0;
  p.drawingContext.shadowColor = 'transparent';
}

export function drawForegroundSparksLayer(sparks, p) {
  p.noFill();
  p.strokeWeight(2);
  p.drawingContext.shadowBlur = 15;
  p.drawingContext.shadowColor = '#00F3FF';
  for (const spark of sparks) {
    const flicker = p.sin(p.frameCount * spark.flickerSpeed) * 0.5 + 0.5;
    const alpha = spark.alpha * 255 * flicker;
    p.stroke(0, 243, 255, alpha);
    const length = spark.size * 5;
    p.line(spark.x, spark.y, spark.x - length * 0.8, spark.y + length * 0.6);
  }
  p.drawingContext.shadowBlur = 0;
  p.drawingContext.shadowColor = 'transparent';
}
```

- [ ] **Step 2: Delete the 6 source files**

```bash
rm js/systems/background/ParallaxLayerConfig.js
rm js/systems/background/ParallaxLayerFactory.js
rm js/systems/background/ParallaxLayerRenderers.js
rm js/systems/background/MediumStarRenderer.js
rm js/systems/background/NearFieldParallax.js
rm js/systems/background/BeatReactiveBackground.js
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: Tests pass (BackgroundRenderer imports are updated in Task 14).

---

## Task 13: Consolidate background — create `BackgroundEffects.js`

**Files:**
- Create: `js/systems/background/BackgroundEffects.js`
- Delete: `BeatPulseOverlay.js`, `InteractiveBackgroundEffects.js`, `AuroraWisps.js`

- [ ] **Step 1: Create `BackgroundEffects.js`**

Create `js/systems/background/BackgroundEffects.js`:

```javascript
/**
 * BackgroundEffects.js — Consolidated beat pulse, interactive effects, and aurora wisps.
 * Merged from: BeatPulseOverlay, InteractiveBackgroundEffects, AuroraWisps
 */

// === Beat Pulse Overlay ===

let cachedVignette = null;

export function resetBeatPulseCache() {
  if (cachedVignette) {
    cachedVignette.remove();
    cachedVignette = null;
  }
}

function drawBeatPulseOverlay(p, beatClock, healthOverlayColor) {
  if (!beatClock) return;

  const phase = beatClock.getBeatPhase();
  const intensity = beatClock.getBeatIntensity(8);
  const currentBeat = beatClock.getCurrentBeat();
  const isDownbeat = currentBeat === 0;

  let flashR = 0, flashG = 0, flashB = 0, flashA = 0;
  const rawFlashAlpha = isDownbeat ? intensity * 15 : intensity * 5;
  if (rawFlashAlpha > 1) {
    if (isDownbeat) { flashR = 200; flashG = 180; flashB = 255; }
    else { flashR = 138; flashG = 43; flashB = 226; }
    flashA = rawFlashAlpha;
  }

  if (healthOverlayColor || flashA > 0) {
    let finalR = flashR, finalG = flashG, finalB = flashB, finalA = flashA;
    if (healthOverlayColor) {
      finalR = p.constrain(finalR + healthOverlayColor.r, 0, 255);
      finalG = p.constrain(finalG + healthOverlayColor.g, 0, 255);
      finalB = p.constrain(finalB + healthOverlayColor.b, 0, 255);
      finalA = p.constrain(finalA + healthOverlayColor.a, 0, 255);
    }
    if (finalA > 0) {
      p.fill(finalR, finalG, finalB, finalA);
      p.noStroke();
      p.rect(0, 0, p.width, p.height);
    }
  }

  if (phase < 0.6) {
    const ringProgress = phase / 0.6;
    const ringRadius = 40 + ringProgress * 350;
    const ringAlpha = (1 - ringProgress) * (isDownbeat ? 70 : 30);
    const ringWeight = (1 - ringProgress) * 2.5 + 0.5;
    p.noFill();
    p.stroke(180, 140, 255, ringAlpha);
    p.strokeWeight(ringWeight);
    p.ellipse(p.width / 2, p.height / 2, ringRadius * 2, ringRadius * 2);
  }

  const vigAlpha = intensity * 0.12;
  if (vigAlpha > 0.005) {
    if (!cachedVignette || cachedVignette.width !== p.width || cachedVignette.height !== p.height) {
      if (cachedVignette) cachedVignette.remove();
      cachedVignette = p.createGraphics(p.width, p.height);
      const ctx2d = cachedVignette.drawingContext;
      const grad = ctx2d.createRadialGradient(
        p.width / 2, p.height / 2, p.width * 0.25,
        p.width / 2, p.height / 2, p.width * 0.72
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(20,10,40,1)');
      ctx2d.fillStyle = grad;
      ctx2d.fillRect(0, 0, p.width, p.height);
    }
    p.push();
    p.tint(255, vigAlpha * 255);
    p.imageMode(p.CORNER);
    p.image(cachedVignette, 0, 0);
    p.pop();
  }
}

// === Aurora Wisps ===

const AURORA_WISP_BASE_SIZE = 100;
const AURORA_WISP_MODULATION = 35;
const AURORA_PHASE_SPEED = 0.006;

export function drawAuroraWispsLayer(wisps, p, beatClock = null) {
  if (!wisps || !Array.isArray(wisps) || wisps.length === 0) return;
  p.push();
  p.noStroke();
  const auroraBeatPulse = beatClock ? beatClock.getBeatIntensity(6) * 20 : 0;

  for (let i = 0; i < wisps.length; i++) {
    const wisp = wisps[i];
    const wispX = wisp.x;
    const wispY = wisp.y;
    const beatModulation = p.sin(p.frameCount * 0.1 + wisp.phase) * auroraBeatPulse;
    const wispSize =
      AURORA_WISP_BASE_SIZE +
      p.cos(p.frameCount * AURORA_PHASE_SPEED + wisp.phase) * AURORA_WISP_MODULATION +
      beatModulation;
    const colorPhase = p.frameCount * 0.01 + wisp.phase;

    const r = 138 + p.sin(colorPhase) * 50 + auroraBeatPulse * 0.5;
    const g = 43 + p.cos(colorPhase * 1.3) * 40 + auroraBeatPulse * 0.3;
    const b = 226 + p.sin(colorPhase * 0.7) * 30 + auroraBeatPulse * 0.8;

    const baseAlpha = 15 + auroraBeatPulse * 0.4;
    p.fill(r, g, b, baseAlpha);
    p.ellipse(wispX, wispY, wispSize, wispSize * 0.4);

    p.fill(r * 0.8, g * 0.8, b * 0.8, baseAlpha * 0.5);
    p.ellipse(wispX - 20, wispY, wispSize * 0.7, wispSize * 0.3);
  }
  p.pop();
}

// === Interactive Background Effects ===

export function drawInteractiveBackgroundEffectsLayer(p, player, gameState, beatClock, randomRangeFn) {
  p.push();

  let healthOverlayColor = null;

  if (player) {
    const healthPercent = player.maxHealth > 0
      ? Math.max(0, Math.min(1, player.health / player.maxHealth))
      : 0;
    if (healthPercent < 0.3) {
      const dangerPulse = p.sin(p.frameCount * 0.2) * 0.5 + 0.5;
      healthOverlayColor = { r: 255, g: 0, b: 0, a: dangerPulse * 15 * (1 - healthPercent) };
    } else if (healthPercent > 0.9) {
      healthOverlayColor = { r: 0, g: 150, b: 255, a: 8 };
    }
  }

  drawBeatPulseOverlay(p, beatClock, healthOverlayColor);

  if (player && player.isMoving) {
    const rippleIntensity = p.map(player.speed, 0, 5, 0, 1);
    for (let i = 0; i < 3; i++) {
      const rippleRadius = (p.frameCount * 2 + i * 20) % 100;
      const rippleAlpha = p.map(rippleRadius, 0, 100, 30 * rippleIntensity, 0);
      p.stroke(64, 224, 208, rippleAlpha);
      p.strokeWeight(2);
      p.noFill();
      p.ellipse(player.x, player.y, rippleRadius, rippleRadius);
    }
  }

  if (gameState && gameState.score > 0) {
    const energyLevel = p.min(gameState.score / 1000, 1);
    for (let i = 0; i < 5; i++) {
      const energyX = randomRangeFn(p.width);
      const energyY = randomRangeFn(p.height);
      const energySize = randomRangeFn(10, 30) * energyLevel;
      const energyAlpha = randomRangeFn(5, 15) * energyLevel;
      p.fill(255, 215, 0, energyAlpha);
      p.noStroke();
      p.ellipse(energyX, energyY, energySize, energySize);
    }
  }

  if (gameState && gameState.killStreak >= 5) {
    const streakIntensity = p.min(gameState.killStreak / 10, 1);
    const borderPulse = p.sin(p.frameCount * 0.3) * 0.5 + 0.5;
    p.stroke(255, 100, 255, borderPulse * 100 * streakIntensity);
    p.strokeWeight(4);
    p.noFill();
    p.rect(5, 5, p.width - 10, p.height - 10);

    for (let i = 0; i < gameState.killStreak && i < 15; i++) {
      const orbX = 50 + (i % 5) * 40;
      const orbY = 50 + p.floor(i / 5) * 30;
      const orbPulse = p.sin(p.frameCount * 0.1 + i) * 0.5 + 0.5;
      p.fill(255, 100, 255, orbPulse * 150);
      p.noStroke();
      p.ellipse(orbX, orbY, 8 + orbPulse * 4, 8 + orbPulse * 4);
    }
  }
  p.pop();
}
```

- [ ] **Step 2: Delete the 3 source files**

```bash
rm js/systems/background/BeatPulseOverlay.js
rm js/systems/background/InteractiveBackgroundEffects.js
rm js/systems/background/AuroraWisps.js
```

---

## Task 14: Update BackgroundRenderer and EnhancedSpaceElements imports

**Files:**
- Modify: `js/systems/BackgroundRenderer.js`
- Modify: `js/systems/background/EnhancedSpaceElements.js`

- [ ] **Step 1: Update BackgroundRenderer imports**

Replace the entire import block (lines 6-37) of `js/systems/BackgroundRenderer.js` with:

```javascript
import { randomRange } from '../mathUtils.js';
import {
  drawDistantStarsLayer,
  drawNebulaCloudLayer,
  drawMediumStarsLayer,
  drawCloseDebrisLayer,
  drawForegroundSparksLayer,
  createParallaxLayerConfig,
  generateParallaxLayerElements,
} from './background/BackgroundLayers.js';
import {
  drawCosmicAuroraBackgroundLayer,
  resetCosmicAuroraCache,
} from './background/CosmicAuroraBackground.js';
import {
  drawAuroraWispsLayer,
  drawInteractiveBackgroundEffectsLayer,
  resetBeatPulseCache,
} from './background/BackgroundEffects.js';
import {
  drawDistantGalaxiesLayer,
  drawFlowingNebulaStreamsLayer,
  drawShootingStarsLayer,
  drawEnhancedSparklesLayer,
  resetEnhancedSpaceElementsCache,
} from './background/EnhancedSpaceElements.js';
```

- [ ] **Step 2: Remove AuroraWisps re-export from EnhancedSpaceElements**

In `js/systems/background/EnhancedSpaceElements.js`, delete the import line at the top:

```javascript
import { drawAuroraWispsLayer } from './AuroraWisps.js';
```

And delete the re-export at the bottom:

```javascript
export { drawAuroraWispsLayer };
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Manual verification**

Open in browser. Verify:
- Background renders with all parallax layers (stars, galaxies, nebulae, wisps, debris, sparks)
- Beat pulse overlay works (enable sound, observe pulse)
- Aurora gradient visible
- No console errors

---

## Task 15: Commit Batch 3

- [ ] **Step 1: Commit**

```bash
git add js/effects/VisualEffectsManager.js js/effects/EffectsManager.js
git add js/systems/background/BackgroundLayers.js js/systems/background/BackgroundEffects.js
git add js/systems/BackgroundRenderer.js js/systems/background/EnhancedSpaceElements.js
git add -u js/systems/background/ParallaxLayerConfig.js js/systems/background/ParallaxLayerFactory.js js/systems/background/ParallaxLayerRenderers.js js/systems/background/MediumStarRenderer.js js/systems/background/NearFieldParallax.js js/systems/background/BeatReactiveBackground.js js/systems/background/BeatPulseOverlay.js js/systems/background/InteractiveBackgroundEffects.js js/systems/background/AuroraWisps.js
git commit -m "perf: cache gradient, pool particles, consolidate background system

- Cache drawSpaceGradient to offscreen canvas (was redrawing ~360 lines/frame)
- Pool particles in VisualEffectsManager and EffectsManager with swap-and-pop
- Consolidate background from 13 files to 6: BackgroundLayers.js (config +
  factory + renderers), BackgroundEffects.js (pulse + interactive + wisps)
- Delete 9 redundant background source files

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run && npx playwright test
```

Expected: All tests pass.

- [ ] **Step 2: Manual play-test checklist**

Open `index.html` in browser and verify:
- [ ] WASD movement works
- [ ] Shooting kills enemies, score increments correctly (not doubled)
- [ ] Spawn each enemy type with keys 1-4
- [ ] Kill a rusher — explosion hits player, correct damage
- [ ] Kill enemies with bomb (wait for tank bomb to detonate) — death effects play
- [ ] Background parallax layers all visible and scrolling
- [ ] Beat pulse overlay works with sound enabled
- [ ] Chromatic aberration effect visible on kill (peaks at impact)
- [ ] No console errors during gameplay
