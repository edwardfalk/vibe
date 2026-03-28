# Bug Fixes, Performance & Cleanup — Design Spec

Date: 2026-03-28
Scope: 9 fixes across 3 batches in a single branch with batch-separated commits.

## Batch 1 — Quick Wins

### Fix 1: Remove duplicate `checkBulletCollisions()`

**Problem:** `GameLoop.js` calls `collisionSystem.checkBulletCollisions()` twice per frame — once at line 202 (before enemy updates) and again at line 233 (after enemy updates). This rebuilds the spatial grid twice and can double-process bullet hits.

**Fix:** Delete lines 200-203 (the pre-enemy-update call). Keep the post-enemy-update call at lines 232-235, which is the correct placement — enemies need to be in their updated positions before collision checks.

**Files:** `js/GameLoop.js`

---

### Fix 2: Delete dead `SubtleSpaceElements.js`

**Problem:** `BackgroundRenderer` imports `drawSubtleSpaceElementsLayer` and `resetSubtleSpaceElementsCache` from `SubtleSpaceElements.js`, and defines a `drawSubtleSpaceElements()` method — but that method is never called from anywhere. The entire file is dead code.

**Fix:**
- Delete `js/systems/background/SubtleSpaceElements.js`
- Remove import at `BackgroundRenderer.js:35-37`
- Remove `drawSubtleSpaceElements()` method at `BackgroundRenderer.js:150-154`
- Remove `resetSubtleSpaceElementsCache()` call from `reset()` method

**Files:** `js/systems/background/SubtleSpaceElements.js`, `js/systems/BackgroundRenderer.js`

---

### Fix 3: Fix chromatic aberration direction

**Problem:** `GameLoop.js:142` computes `hitStopProgress = next / 8`, which means max intensity at the START of hitstop, fading toward the end. The effect should peak at the END (the impact moment).

**Fix:** Change `next / 8` to `(8 - next) / 8`.

**Files:** `js/GameLoop.js`

---

### Fix 4: Debounce localStorage high score writes

**Problem:** `GameState.updateHighScore()` calls `localStorage.setItem()` on every `addScore()` call. `localStorage.setItem` is a synchronous blocking write. During intense combat with rapid kills, this causes micro-stutter.

**Fix:**
- Add a `_highScoreDebounceTimer` field to `GameState`
- In `updateHighScore()`: update `this.highScore` in memory immediately, but debounce the `localStorage.setItem` write to fire at most once every 5 seconds
- Flush immediately in `setGameState('gameOver')`
- Add a `beforeunload` listener in the constructor to flush on page close
- Add a `_flushHighScore()` private method for the actual write

**Files:** `js/core/GameState.js`

---

## Batch 2 — Combat Fixes

### Fix 5: Fix rusher index invalidation

**Problem:** `EnemyUpdatePipeline.js:18` passes `enemyIndex` (the loop iteration index) to `collisionSystem.handleRusherExplosion()`. If other enemies are removed from the array during the same frame, this index can point to the wrong enemy or crash on out-of-bounds access.

**Fix:** Pass the enemy object reference instead of the array index through the entire call chain:
1. `EnemyUpdatePipeline.js:18` — pass `enemy` instead of `enemyIndex`
2. `CollisionSystem.handleRusherExplosion(explosion, rusherIndex)` — rename param to `(explosion, rusherEnemy)`, pass through
3. `PlayerContactHandlers.handleRusherExplosionCollision({...rusherIndex...})` — rename to `rusherEnemy`, replace `enemies[rusherIndex].markedForRemoval = true` with `rusherEnemy.markedForRemoval = true`. Remove `enemies` param (no longer needed for this purpose)
4. `tests/gameplay-probe.test.js:173` — update test call to pass an enemy object instead of index

**Files:** `js/systems/gameplay/EnemyUpdatePipeline.js`, `js/systems/CollisionSystem.js`, `js/systems/combat/PlayerContactHandlers.js`, `tests/gameplay-probe.test.js`

---

### Fix 7: Standardize enemy death to one code path

**Problem:** Three different code paths handle enemy death with slightly different behavior:
1. `CollisionSystem` -> `EnemyDeathHandler.handleEnemyDeath()`
2. `BombSystem` -> `collisionSystem.handleEnemyDeath()`
3. `AreaDamageHandler` -> `enemyDeathHandler.handleEnemyDeath()` OR `collisionSystem.handleEnemyDeath()`

**Fix:** Route all death handling through `EnemyDeathHandler` directly:
1. `BombSystem.js`: Accept `enemyDeathHandler` in the context param. Call `enemyDeathHandler.handleEnemyDeath()` instead of `collisionSystem.handleEnemyDeath()`
2. `AreaDamageHandler.js`: Remove the `collisionSystem` fallback path. Require `enemyDeathHandler` in context
3. `GameLoop.js:206-215`: Add `enemyDeathHandler` to the `updateBombSystem()` call (it's already a module-level variable at line 36, just not passed here)

**Files:** `js/systems/BombSystem.js`, `js/effects/AreaDamageHandler.js`, `js/GameLoop.js`

---

## Batch 3 — Performance & Cleanup

### Fix 8: Cache `drawSpaceGradient` to offscreen canvas

**Problem:** `VisualEffectsManager.js:100-118` draws ~360 lerped color lines every frame for a completely static gradient. Expensive and wasteful.

**Fix:**
- Add a `_gradientCache` field (null initially)
- On first call to `drawSpaceGradient()`, render to `p.createGraphics(p.width, p.height)`
- On subsequent calls, `p.image(this._gradientCache, 0, 0)`
- Invalidate if `p.width` or `p.height` changes (check dimensions before drawing)
- Clean up old graphics buffer before creating new one on resize

**Files:** `js/effects/VisualEffectsManager.js`

---

### Fix 9: Pool particles in VisualEffectsManager and EffectsManager

**Problem:** `VisualEffectsManager` and `EffectsManager` create particle objects freely and remove them with `splice(i, 1)` (O(n) per removal). No pooling. During intense combat this creates GC pressure and frame drops.

**Fix for VisualEffectsManager:**
- Add module-level `const particlePool = []`
- `acquireParticle(props)`: pop from pool or create new `{}`, assign props via `Object.assign`
- `releaseParticle(p)`: push to pool (cap at 200)
- In `updateParticles()`: replace backward-iteration + `splice` with swap-and-pop: swap dead particle with last element, pop, decrement index
- In all `add*Particles()` methods: use `acquireParticle()` instead of object literal

**Fix for EffectsManager:**
- Add `reset(props)` method to `Particle` class (lines 180-235) that reinitializes all fields
- Add module-level `const particlePool = []` and `const trailPool = []`
- Same acquire/release/swap-and-pop pattern
- Add `reset()` to `Trail` class as well

**Files:** `js/effects/VisualEffectsManager.js`, `js/effects/EffectsManager.js`

---

### Fix 10: Consolidate background system from 13 to 6 files

**Problem:** 13 files for background rendering is excessive fragmentation. Many are under 65 lines and have a single consumer (`BackgroundRenderer`).

**Target structure:**

| New File | Merges In |
|----------|-----------|
| `BackgroundRenderer.js` | Update imports only |
| `background/BackgroundLayers.js` | `ParallaxLayerConfig.js` + `ParallaxLayerFactory.js` + `ParallaxLayerRenderers.js` + `MediumStarRenderer.js` + `NearFieldParallax.js` + `BeatReactiveBackground.js` |
| `background/BackgroundEffects.js` | `BeatPulseOverlay.js` + `InteractiveBackgroundEffects.js` + `AuroraWisps.js` |
| `background/CosmicAuroraBackground.js` | Keep as-is |
| `background/EnhancedSpaceElements.js` | Keep as-is, remove AuroraWisps re-export (it moves to BackgroundEffects) |
| DELETE `SubtleSpaceElements.js` | Already done in Fix 2 |

**Merge strategy:**
- Concatenate source files, keeping all exported functions with same signatures
- Update `BackgroundRenderer.js` imports to point to new locations
- No other files import from these background modules (verified)
- Delete the 7 emptied source files: `ParallaxLayerConfig.js`, `ParallaxLayerRenderers.js`, `MediumStarRenderer.js`, `NearFieldParallax.js`, `BeatReactiveBackground.js`, `BeatPulseOverlay.js`, `AuroraWisps.js`
- Rename `ParallaxLayerFactory.js` to `BackgroundLayers.js` and merge the other 5 files into it

**Files:** All 13 files in `js/systems/background/` and `js/systems/BackgroundRenderer.js`

---

## Out of Scope

- **Stabber hit detection (original Fix 6):** Re-analysis confirmed `checkStabHit` runs every frame during the dash. No bug.
- **Global state migration (window.*):** Architectural debt but too large for this plan.
- **Unit test additions:** Separate effort.
- **Magic number extraction:** Separate effort.

## Verification

Each batch commit should be verified by:
1. `npm run lint` (if configured) or manual ESLint check
2. `npx vitest run` for unit tests
3. Manual play-test: spawn each enemy type, kill with bullets and bombs, verify explosions/effects/score
4. Background visual inspection: parallax layers render correctly, no missing elements
