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
| `js/shared/`   | small cross-cutting pieces: the damage-result contract, the context accessor, the object pool                                                                                     |
| `js/dev/`      | [`TunePanel.js`](js/dev/TunePanel.js), the `?tune` sliders                                                                                                                        |
| `tests/`       | Playwright browser tests and dev tools; `tests/unit/` holds the Vitest tests                                                                                                      |

## Shared state

Systems (`player`, `enemies`, `beatClock`, `audio` and so on) are put on `window.*` and mirrored into a `GameContext`. Modules read them through `getContextValue(key)`, made by [`createContextAccessor`](js/shared/ContextAccessor.js).

When a module was given a `GameContext`, the accessor returns `context.get(key)` and does not fall back to `window`. Only a module without a context (or with a plain object that lacks the key) reads `window`.

## Beat system

[`BeatClock`](js/audio/BeatClock.js) is the only timing grid. It runs on `AudioContext.currentTime` once audio has started (on `Date.now()` before that), so it can't drift from the audio.

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

`enemy.takeDamage()` returns a raw result. [`normalizeDamageResult()`](js/shared/DamageResult.js) turns it into one of `none`, `damaged`, `died` or `exploding`. Then [`handleDamageResult()`](js/shared/DamageResultHandler.js) plays the explosions and sounds and adds the score. Bullet hits, enemy updates (such as a rusher exploding) and area damage all go through this one path.

## Dev tools

| Tool       | Command                                                      | What it does                                                                   |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `?tune`    | open the game with `?tune`                                   | live sliders for the kick, mix, pacing, rushers and tank armour, plus Level +1 |
| Playtest   | `pnpm run playtest`                                          | a bot plays for a while (aiming at enemies) and reports frame rate and pacing  |
| Screenshot | `pnpm run screenshot` (`screenshot:level` for a later level) | saves screenshots of a running game                                            |
| Beat check | `pnpm run test:beats`                                        | records when enemies act and checks that each lands on its beat                |

## Known debt

- **State lives in two places.** Systems are on `window.*` and mirrored into `GameContext`. New code should use the context, but the mirroring stays until every reader has moved.
- **`GameState` reaches into globals** (`window.audio`, `window.player` and others) instead of being handed what it needs.
- **Setup monkey-patches `audio.initialize`** in `GameLoopSetup.js`, so that BeatClock switches from `Date.now()` to the audio clock once audio starts.
- **The `DamageResult` normaliser is a shim.** Enemy `takeDamage()` methods still return mixed types, and the normaliser papers over them.
- **Some files are long:** `Audio.js` is about 700 lines, and `Tank.js` and `BaseEnemy.js` are about 500 each.

## Conventions

- New code goes in the domain folders above, not at the top of `js/`.
- Don't add new `window.*` globals where passing a context works.
- Import from the real module. Don't add re-export files.
- Numbers belong in `config.js` or a named constant, not inline.
