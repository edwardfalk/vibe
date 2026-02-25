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
  - `GameState.js` - score/level/state transitions and restart flow.
  - `InputHandlers.js` - keyboard/mouse input listener wiring.
- `js/systems/`
  - `CameraSystem.js` - camera follow and shake system.
  - `SpawnSystem.js` - enemy spawning schedule and level scaling.
  - `UIRenderer.js` - HUD and game state overlays.
  - `UIConstants.js` - UI layout, copy, and magic-number constants.
  - `BackgroundRenderer.js` - top-level background orchestrator.
  - `CollisionSystem.js` - bullet/contact collision coordination and outcomes.
  - `TestMode.js` - automated movement/shooting runtime mode.
  - `BombSystem.js` - bomb placement + bomb explosion damage updates.
  - `collision/CollisionMetrics.js` - frame and rolling collision metrics helpers.
  - `collision/CollisionSpatialGrid.js` - spatial grid build/query helpers.
  - `gameplay/EnemyUpdatePipeline.js` - enemy update-result handling extracted from GameLoop.
  - `gameplay/BulletUpdatePipeline.js` - player/enemy bullet update and off-screen cleanup.
  - `gameplay/RenderPipeline.js` - world render pipeline extracted from GameLoop.
  - `gameplay/PerformanceDiagnostics.js` - periodic pool/collision diagnostics logging.
  - `background/BeatReactiveBackground.js` - beat-reactive background helper logic.
  - `background/BeatPulseOverlay.js` - beat pulse overlay rendering helper.
  - `background/ParallaxLayerRenderers.js` - distant star + nebula layer render helpers.
  - `background/MediumStarRenderer.js` - beat-synced medium-star rendering helper.
  - `background/ParallaxLayerConfig.js` - canonical parallax layer configuration helper.
  - `background/ParallaxLayerFactory.js` - parallax layer element generation helper.
  - `background/CosmicAuroraBackground.js` - aurora gradient renderer helper.
  - `background/AuroraWisps.js` - beat-reactive aurora wisp renderer helper.
  - `background/EnhancedSpaceElements.js` - streams/shooting-stars/sparkles/galaxies renderer helper.
  - `background/InteractiveBackgroundEffects.js` - gameplay-reactive overlays (pulse/ripple/health/score/streak).
  - `background/NearFieldParallax.js` - close debris + foreground spark layer render helpers.
  - `background/SubtleSpaceElements.js` - static subtle-space nebula/stars layer helper.
  - `combat/EnemyDeathHandler.js` - centralized enemy death effects/audio handling.
  - `combat/PlayerContactHandlers.js` - tank bomb placement, rusher explosion contact handling.
  - `combat/KillFeedback.js` - hit-stop and kill feedback application.
- `js/audio/`
  - `SoundConfig.js` - centralized sound maps and configuration presets.
  - `VoiceConfig.js` - centralized voice rate/pitch/volume presets.
  - `BeatClock.js` - rhythm timing and beat phase/intensity helpers.
  - `BeatTrack.js` - procedural beat backing track scheduler.
  - `AmbientSoundProfile.js` - ambient sound tags and source-position helpers.
  - `SpatialAudio.js` - pan/volume helper math for player-relative spatialization.
  - `BeatTremolo.js` - beat-synced tremolo DSP helper.
  - `TextDisplay.js` - speech-text update/draw helpers.
  - `TextSemantics.js` - aggressive/confused/screaming text classifiers.
  - `DialogueLines.js` - centralized player/enemy dialogue line pools + random selection helpers.
  - `VoiceSelection.js` - voice profile selection heuristics by role.
  - `VoiceEffects.js` - runtime pitch/rate modulation rules per role.
  - `SpeechWrappers.js` - map-based speech convenience method config (speakPlayerLine, speakGruntLine, etc.).
- `js/entities/`
  - `player.js` - player movement/combat/shooting logic.
  - `PlayerDash.js` - player dash ability (updateDash, tryStartDash).
  - `BaseEnemy.js`, `Grunt.js`, `Rusher.js`, `Tank.js`, `Stabber.js` - enemy classes.
  - `BaseEnemyHelpers.js` - shared color, glow, health bar, speech bubble helpers.
  - `StabberAttackHandler.js` - Stabber melee attack logic (prepare/warning/dash phases, hit check).
  - `TankArmorHandler.js` - tank armor hit processing, anger tracking, armor break effects.
  - `EnemyFactory.js` - enemy creation and type config.
  - `bullet.js` - projectile model/pool behavior.
- `js/effects/explosions/`
  - `ExplosionManager.js` - explosion coordination and kill effects.
  - `Explosion.js` - base explosion particles.
  - `ExplosionConfig.js` - particle/shockwave/color config by explosion type.
  - `EnemyFragmentExplosion.js` - enemy death fragment effect (extracted sub-handler).
  - `RadioactiveDebris.js`, `PlasmaCloud.js` - area damage effects.
- `js/shared/`
  - `contracts/DamageResult.js` - normalized damage/death result contract.
- `js/testing/`
  - `ai-liveness-probe.js` - browser-side liveness probe for gameplay smoke tests.
  - Probe tests and test utilities (see `tests/`).

## Active Canonical Paths

- Entry: `js/GameLoop.js`
- Core: `js/core/GameContext.js`, `js/core/GameState.js`, `js/core/InputHandlers.js`
- Entities: `js/entities/*`
- Systems: `js/systems/*`
- Audio: `js/audio/`
- Shared contracts: `js/shared/`
- Testing: `js/testing/`
- Audio/support still rooted by design: `js/Audio.js`, `js/RhythmFX.js`, `js/config.js`, `js/mathUtils.js`
- Effects: `js/effects/` — FloatingTextPool, FloatingTextManager, EffectsManager, EnhancedExplosionManager (visual rings/particles), VisualEffectsManager, glowUtils, AreaDamageHandler, DashEffect.
- Explosions: `js/effects/explosions/` — ExplosionManager, Explosion, ExplosionConfig, EnemyFragmentExplosion, RadioactiveDebris, PlasmaCloud.

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
- Canonical gameplay modules should remain in domain paths; avoid adding new root-level gameplay modules.
- Do not reintroduce temporary re-export shim files; migrate by updating real imports directly.

## Removed/Forbidden Legacy Files

- `js/game.js`
- `js/enemy.js`
- `js/explosion.js`
