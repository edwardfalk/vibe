# Architecture

This file is the source of truth for module layout and runtime wiring.

## Runtime Model

- Rendering/runtime: `p5.js` instance mode.
- Entry point: `js/GameLoop.js`.
- Primary runtime container: `GameContext` (`js/core/GameContext.js`).
- Temporary migration mode: modules can still read `window.*` while context migration is in progress.

## Domain Structure

- `js/core/`
  - `GameContext.js` - dependency container and window-backed bridge.
  - `InputHandlers.js` - keyboard/mouse input listener wiring.
- `js/systems/`
  - `BombSystem.js` - bomb placement + bomb explosion damage updates.
  - `collision/CollisionMetrics.js` - frame and rolling collision metrics helpers.
  - `collision/CollisionSpatialGrid.js` - spatial grid build/query helpers.
  - `background/BeatReactiveBackground.js` - beat-reactive background helper logic.
  - `background/BeatPulseOverlay.js` - beat pulse overlay rendering helper.
  - `combat/EnemyDeathHandler.js` - centralized enemy death effects/audio handling.
- `js/audio/`
  - `BeatClock.js` - rhythm timing and beat phase/intensity helpers.
  - `BeatTrack.js` - procedural beat backing track scheduler.
  - `AmbientSoundProfile.js` - ambient sound tags and source-position helpers.
- `js/shared/`
  - `contracts/DamageResult.js` - normalized damage/death result contract.

## Legacy Modules Still Active (Pre-Migration Paths)

The canonical gameplay modules are still active while import migration rolls forward:

- Core: `js/GameLoop.js`, `js/GameState.js`, `js/CameraSystem.js`, `js/SpawnSystem.js`, `js/CollisionSystem.js`, `js/UIRenderer.js`, `js/BackgroundRenderer.js`, `js/TestMode.js`
- Entities: `js/player.js`, `js/BaseEnemy.js`, `js/Grunt.js`, `js/Rusher.js`, `js/Tank.js`, `js/Stabber.js`, `js/EnemyFactory.js`, `js/bullet.js`
- Audio/support: `js/Audio.js`, `js/audio/BeatClock.js`, `js/audio/BeatTrack.js`, `js/RhythmFX.js`, `js/config.js`, `js/mathUtils.js`
- Effects: `js/visualEffects.js`, `js/effects.js`, `js/effects/AreaDamageHandler.js`, `js/explosions/*`

## Combat Contracts

- Enemy `takeDamage` remains backward-compatible (legacy mixed return types).
- New normalization layer: `normalizeDamageResult(...)` in `js/shared/contracts/DamageResult.js`.
- Standardized result values:
  - `none`
  - `damaged`
  - `died`
  - `exploding`

## Migration Rules

- New code should prefer domain paths (`js/core`, `js/systems`, `js/entities`, `js/audio`, `js/effects`, `js/shared`, `js/testing`).
- Existing gameplay modules currently remain at canonical root paths under `js/` while feature-specific extracted modules live in domain folders.
- Do not reintroduce temporary re-export shim files; migrate by updating real imports directly.

## Removed/Forbidden Legacy Files

- `js/game.js`
- `js/enemy.js`
- `js/explosion.js`
