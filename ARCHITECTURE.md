# Architecture

A map of the code for someone opening it for the first time. For what the game is, see the [README](README.md); for the design behind the beat, see [docs/DESIGN.md](docs/DESIGN.md).

## Entry and game loop

[`index.html`](index.html) loads p5.js from a CDN and [`js/GameLoop.js`](js/GameLoop.js) as an ES module. p5 runs in instance mode: every drawing call goes through the `p` instance, never through globals.

- [`GameLoopSetup.js`](js/GameLoopSetup.js) creates the systems once.
- [`GameLoop.js`](js/GameLoop.js) runs each frame's update: input, player, enemies, bullets, collisions, spawning.
- [`GameLoopDraw.js`](js/GameLoopDraw.js) draws whichever state the game is in.

The states are `title → playing ⇄ paused → gameOver → playing`. The title screen is an HTML overlay in `index.html`. The first click or key press starts the game and unlocks audio (`startFromTitle` in `GameLoop.js`). After that, the HUD and all other screens are drawn on the canvas by [`UIRenderer`](js/systems/UIRenderer.js).

## Folders

| Folder         | Owns                                                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `js/`          | the loop files above, [`config.js`](js/config.js) (every tunable number), [`Audio.js`](js/Audio.js) (sound effects and speech), `RhythmFX.js` (attack telegraphs and beat pulses) |
| `js/core/`     | [`GameContext.js`](js/core/GameContext.js) (the shared-state container), `GameState.js` (score, level, state machine), `InputHandlers.js`                                         |
| `js/audio/`    | [`BeatClock.js`](js/audio/BeatClock.js) (the one timing grid), [`BeatTrack.js`](js/audio/BeatTrack.js) (kick and sub pulse), sound presets, voices and dialogue                   |
| `js/entities/` | the player, `BaseEnemy` and the four enemy types, `EnemyFactory`, bullets                                                                                                         |
| `js/systems/`  | spawning, collisions, camera, bombs, HUD, background, and the per-frame pipelines                                                                                                 |
| `js/effects/`  | explosions, floating text, dash and glow effects, area damage                                                                                                                     |
| `js/shared/`   | small cross-cutting pieces: the damage-result values and handler, the context accessor                                                                                            |
| `js/dev/`      | [`TunePanel.js`](js/dev/TunePanel.js), the `?tune` sliders                                                                                                                        |
| `tests/`       | Playwright browser tests and dev tools; `tests/unit/` holds the Vitest tests                                                                                                      |

## Shared state

`runSetup` creates each system (`player`, `enemies`, `beatClock`, `audio` and so on) once. It puts each on `window.*`, where the browser tests read them, and at the end fills a [`GameContext`](js/core/GameContext.js) with the same objects. Nothing is swapped out after setup, so the two never drift. Modules read the context through `getContextValue(key)`, made by [`createContextAccessor`](js/shared/ContextAccessor.js). The one value that changes every frame, `hitStopFrames`, lives only in the context.

When a module was given a `GameContext`, the accessor returns `context.get(key)` and does not fall back to `window`. Only a module without a context (or with a plain object that lacks the key) reads `window`.

## Beat system

[`BeatClock`](js/audio/BeatClock.js) is the only timing grid. It runs on `AudioContext.currentTime` once audio has started (on `Date.now()` before that), so it can't drift from the audio. `Audio.initialize` makes the switch with `beatClock.useAudioClock()`, which keeps the beat position across it.

- Enemies ask it before they act: `canGruntShoot()` (beats 2 and 4), `canTankShoot()` (1), `canStabberAttack()` (3.5), `canRusherExplode()` (1 and 3).
- A beat's window opens when the beat lands, not before it, and each beat-gated sound plays at most once per beat.
- The player's held fire asks `isOnEighthNote()` and otherwise queues the shot for the next eighth note.
- [`BeatTrack`](js/audio/BeatTrack.js) schedules the kick and sub pulse a little ahead, on BeatClock's grid, with a look-ahead scheduler.

## Audio graph

One `AudioContext`, shared by the effects and the beat track:

```
effects    -> masterGain (mute) -> duckGain     -> masterLimiter -> out
beat track -> its masterGain    -> beatDuckGain -> masterLimiter
speech     -> speechSynthesis (outside Web Audio); while a line plays,
              syncDuck() dips the two duck gains
```

Speech can't be routed through Web Audio or raised above full volume, so it stays on top by the mix keeping the beat lower and dipping the game while anyone speaks. The levels are in `CONFIG.MIX`.

## Damage flow

`enemy.takeDamage()` returns one of the [`DAMAGE_RESULT`](js/shared/DamageResult.js) values: `damaged`, `died` or `exploding` (any hit lights a rusher's fuse, so it returns `exploding`). Compare with `=== DAMAGE_RESULT.DIED`, never by truthiness: every value is a non-empty string. Then [`handleDamageResult()`](js/shared/DamageResultHandler.js) plays the explosions and sounds and adds the score. Bullet hits, enemy updates (such as a rusher exploding) and area damage all go through this one path.

- **Hit radius.** A bullet hits an enemy within `bullet.size / 2 + enemy.hitRadius`. The radius per type is in `CONFIG.HITBOX`, because sprites are wider than `size / 2`. The player keeps `size / 2`.
- **Blasts and area damage.** A rusher's blast and the hazard clouds (plasma and radioactive debris, one [`HazardCloud`](js/effects/explosions/HazardCloud.js) class with two configs) damage enemies through [`damageEnemiesInRadius()`](js/effects/AreaDamageHandler.js). An enemy counts when its hit radius reaches into the circle; enemies already killed this frame are skipped. Blasts land after the enemy loop has compacted the array, so an enemy is hit once and what they kill is gone before bullets run.
- **The player.** [`Player.takeDamage()`](js/entities/player.js) owns the shield, the wound sound and the kill-streak reset. The shield takes one real hit whole (contact ticks go through it), recharges in `CONFIG.PLAYER.SHIELD_RECHARGE_MS` and returns on the beat. Callers hurt the player with `player.hurt(amount, source)`, which also ends the run on a fatal hit and returns `true` if the player died.

## Dev tools

| Tool       | Command                                                      | What it does                                                                                                                                 |
| ---------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `?tune`    | open the game with `?tune`                                   | live sliders for the kick, mix, pacing, rushers, tank armour, hit radii, stabber knockback, and the hero's shield and healing, plus Level +1 |
| Playtest   | `pnpm run playtest`                                          | a bot plays for a while (aiming at enemies) and reports frame rate and pacing                                                                |
| Screenshot | `pnpm run screenshot` (`screenshot:level` for a later level) | saves screenshots of a running game                                                                                                          |
| Beat check | `pnpm run test:beats`                                        | records when enemies act and checks that each lands on its beat                                                                              |

## Known debt

- **`window.*` still has readers.** Game code should read the context, but `GameState` still reads about 48 globals (`window.audio`, `window.player` and others) instead of being handed what it needs; `Audio` reaches `window.beatTrack`, and `player.js` reads the input flags that `InputHandlers` writes to `window`.
- **The game is frame-locked.** Enemies and the player move by frame time, but bullets move a fixed step per frame and bomb fuses count frames, so on a 120 Hz screen those run twice as fast.
- **Some files are long:** `Audio.js` is about 650 lines, and `Tank.js` and `BaseEnemy.js` are about 500 each.

## Adding an enemy-instrument

A new enemy touches these places:

1. A class extending [`BaseEnemy`](js/entities/BaseEnemy.js) in `js/entities/`. `takeDamage()` returns a `DAMAGE_RESULT` value.
2. An entry in `ENEMY_CLASSES` and `ENEMY_INTRO_LEVEL` in [`SpawnSystem.js`](js/systems/SpawnSystem.js).
3. A beat gate in `BeatClock` (like `canGruntShoot()`), used through `onBeatOnce()` so the action fires once per beat.
4. Its sounds in [`SoundConfig.js`](js/audio/SoundConfig.js), including a `<type>Response` entry for the call-and-response on deaths, played with `audio.playSound(key, x, y)`.
5. Its numbers in `CONFIG` (and a `CONFIG.HITBOX` radius), with knobs in `KNOBS` in [`TunePanel.js`](js/dev/TunePanel.js) for anything to tune by ear.
6. Its glow colour in `GLOW_RGB` in [`BaseEnemyHelpers.js`](js/entities/BaseEnemyHelpers.js).
7. Its beats in `expectedBeats` in [`tests/beat-assertions.js`](tests/beat-assertions.js), and a unit test that a non-fatal hit returns `damaged` and plays its hit sound.

## Conventions

- New code goes in the domain folders above, not at the top of `js/`.
- Don't add new `window.*` globals where passing a context works.
- Import from the real module. Don't add re-export files.
- Numbers belong in `config.js` or a named constant, not inline.
