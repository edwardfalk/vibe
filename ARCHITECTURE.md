# Architecture

A map of the code for someone opening it for the first time. For what the game is, see the [README](README.md); for the design behind the beat, see [docs/DESIGN.md](docs/DESIGN.md).

## Entry and game loop

[`index.html`](index.html) loads p5.js from a CDN and [`js/GameLoop.js`](js/GameLoop.js) as an ES module. p5 runs in instance mode: every drawing call goes through the `p` instance, never through globals.

- [`GameLoopSetup.js`](js/GameLoopSetup.js) creates the systems once.
- [`GameLoop.js`](js/GameLoop.js) runs each frame's update: the beat clock, the player and his fire, bullets, bombs, enemies, collisions, spawning, explosions and area damage. Input arrives through event handlers ([`InputHandlers.js`](js/core/InputHandlers.js)).
- [`GameLoopDraw.js`](js/GameLoopDraw.js) draws whichever state the game is in.

The states are `title → playing ⇄ paused → gameOver → playing`. The title screen is an HTML overlay in `index.html`. The first click or key press starts the game and unlocks audio (`startFromTitle` in `GameLoop.js`). After that, the HUD and all other screens are drawn on the canvas by [`UIRenderer`](js/systems/UIRenderer.js).

The hero's fatal hit ends the run at once: `gameOver` locks the score, the kills and the high score. For its first bar the screen still draws the world, held as it was, with his death scene on it (`GameState.startDeathScene`, [`DudeDeath.js`](js/entities/DudeDeath.js)); then GAME OVER comes up on an eighth note, with its sound (`updateScene`), and only then does R restart. `gameState.overlayUp()` answers "is GAME OVER up?"; `gameState === 'gameOver'` keeps meaning "the run is over".

## Folders

| Folder         | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `js/`          | the loop files above, [`config.js`](js/config.js) (every tunable number), [`Audio.js`](js/Audio.js) (sound effects and speech), `RhythmFX.js` (attack telegraphs), `mathUtils.js`                                                                                                                                                                                                                                                                                        |
| `js/core/`     | [`GameContext.js`](js/core/GameContext.js) (the shared-state container), `GameState.js` (score, level, state machine), `InputHandlers.js`                                                                                                                                                                                                                                                                                                                                |
| `js/audio/`    | [`BeatClock.js`](js/audio/BeatClock.js) (the one timing grid), [`Harmony.js`](js/audio/Harmony.js) (the pitch grid), [`BeatTrack.js`](js/audio/BeatTrack.js) (the kick, and the hum's timing), [`Hum.js`](js/audio/Hum.js) (the universe's hum), synths (the crash, the deaths, the stabber's strings), sound presets, dialogue and speech bubbles; `speech/` holds the speech pipeline: the worker, levels, effect chains and [`Voicebox`](js/audio/speech/Voicebox.js) |
| `js/entities/` | the player, `BaseEnemy` and the four enemy types, bullets, the grunt's and the Dude's deaths                                                                                                                                                                                                                                                                                                                                                                             |
| `js/systems/`  | spawning, camera, bombs, HUD and overlays; the sky (`background/`), collisions (`collision/`), deaths and contact (`combat/`), the enemy update pipeline (`gameplay/`)                                                                                                                                                                                                                                                                                                   |
| `js/effects/`  | explosions, blasts and hazard clouds (`explosions/`), floating text, bloom and glow, area damage                                                                                                                                                                                                                                                                                                                                                                         |
| `js/shared/`   | small cross-cutting pieces: the damage-result values and handler, the context accessor                                                                                                                                                                                                                                                                                                                                                                                   |
| `js/vendor/`   | the two vendored speech engines, SAM and espeak-ng, built by `scripts/vendor-speech.js`                                                                                                                                                                                                                                                                                                                                                                                  |
| `js/dev/`      | [`TunePanel.js`](js/dev/TunePanel.js), the `?tune` sliders; `VoicePlayground.js`, the voice playground                                                                                                                                                                                                                                                                                                                                                                   |
| `tests/`       | Playwright browser tests and dev tools; `tests/unit/` holds the Vitest tests                                                                                                                                                                                                                                                                                                                                                                                             |

## Shared state

`runSetup` creates each system (`player`, `enemies`, `beatClock`, `audio` and so on) once. It puts each on `window.*`, where the browser tests read them, and at the end fills a [`GameContext`](js/core/GameContext.js) with the same objects (all but `backgroundRenderer`, `enemyDeathHandler` and `uiRenderer`). Nothing is swapped out after setup, so the two never drift. Modules read the context through `getContextValue(key)`, made by [`createContextAccessor`](js/shared/ContextAccessor.js). Two values that change during play, `hitStopFrames` and `gruntFireBeat`, live only in the context.

When a module was given a `GameContext`, the accessor returns `context.get(key)` and does not fall back to `window`. Only a module without a context (or with a plain object that lacks the key) reads `window`.

## Beat system

[`BeatClock`](js/audio/BeatClock.js) is the only timing grid. It runs on `AudioContext.currentTime` once audio has started (on `Date.now()` before that), so it can't drift from the audio. `Audio.initialize` makes the switch with `beatClock.useAudioClock()`, which keeps the beat position across it.

- Enemies ask it before they act: `canGruntShoot()` (beats 2 and 4). The tank, the rusher and the stabber count beat positions instead. The tank acts on his first update in each bar, however late in it a hitstop or a slow frame puts it (`Tank.js`). The rusher boosts on each new beat and blows on the beat 1 or 3 he picked as he lit (`Rusher.js`). Each step of the stabber's phrase (wind up on 2, lock on 3, lunge on the "and" of 3) happens once, on his first update at or after its beat; a step a quarter beat late drops the phrase, so nothing he starts sounds off its beat (`Stabber.js`). `canStabberAttack()` (3.5) gates only his chatter.
- A beat's window opens when the beat lands, not before it, and each beat-gated sound plays at most once per beat.
- The player's held fire asks `isOnEighthNote()` and otherwise queues the shot for the next eighth note.
- [`BeatTrack`](js/audio/BeatTrack.js) schedules the kick a little ahead, on BeatClock's grid, with a look-ahead scheduler. It also keeps the hum's time: the hum dips on every beat it schedules and breathes over its bars, and each time the audio clock moves BeatTrack hands it the level and the enemy count (none on the game-over screen).

**Pitch.** [`Harmony`](js/audio/Harmony.js) is BeatClock's counterpart for pitch: BeatClock answers "when", Harmony answers "which note". `hz([degree, octave], t)` gives a note of natural minor on `CONFIG.HUM.ROOT` in pure ratios, including the root's slow analog drift at audio time `t`. A sound takes the drift at the moment it starts. The hum, the tuned kick, the grunt's and the Dude's death sounds and the stabber's strings play on it. It has no state of its own.

**The sky.** [`NebulaSky`](js/systems/background/NebulaSky.js) is the kick drum's body: on each kick the nebula's star cluster breathes and the dense gas lights up, and on beat 1 a front also rolls out through the gas. [`BackgroundRenderer`](js/systems/BackgroundRenderer.js) asks `heardKickOf()` in BeatTrack when the player hears each kick: BeatClock's grid, minus the audio latency (`baseLatency` + `outputLatency`) and `CONFIG.SKY.OFFSET_MS`, on the beats `kicksOn()` says the kick plays. The gas is a fragment shader on a 400×300 WebGL buffer. Without a hardware GPU, if the shader fails, or with `?sky=flat` in the URL, the sky is flat: stars and the pulsing cluster on dark.

## Audio graph

One `AudioContext`, shared by the effects and the beat track:

```
effects    -> masterGain (mute) -> duckGain     -> masterLimiter -> out
hum        -> masterGain
beat track -> its masterGain    -> beatDuckGain -> masterLimiter
speech     -> Voicebox: each line's gain and pan -> speech gain -> masterLimiter
```

**Speech.** `Audio.speak` hands each line to [`Voicebox`](js/audio/speech/Voicebox.js): rendered once in the speech worker (SAM or espeak-ng), run through the speaker's effect chain, levelled, cached, and started on BeatClock's grid (the bomb's count is rendered ahead). The worker starts on the title screen, so the engines have loaded by the first line. A line not ready within `MAX_WAIT_MS` is dropped then. Its bubble shows as it starts. Mute and restart drop lines still waiting; a pause holds one mid-word; if the worker fails, speech is off for the session and `speak` returns false. The speech gain carries `MIX.SPEECH_VOLUME` and mute; the duck never touches it, and `syncDuck()` dips the effects and the beat under a voice. The levels are in `CONFIG.MIX`.

The hum ([`Hum`](js/audio/Hum.js)) is built by `Audio.initialize` and feeds the effects' `masterGain`, so it mutes and ducks with them. Nothing in the hum can stop the kick: a hum that fails to build leaves the game playing without it, and BeatTrack logs the hum's first error and plays on.

Pausing suspends the `AudioContext` (`Audio.syncPause`, called when P is pressed and every frame). That stops BeatClock too, since it reads the context's clock, so everything resumes in step; the sky keeps its own clock and holds while the sound is held. Mute (M) uses gains instead, because the game keeps running while muted. `CONFIG.SOUND_WHILE_PAUSED`, which `?tune` turns on, keeps the sound playing through a pause.

## Damage flow

`enemy.takeDamage()` returns one of the [`DAMAGE_RESULT`](js/shared/DamageResult.js) values: `damaged`, `died` or `exploding` (any hit lights a rusher's fuse, so it returns `exploding`). Compare with `=== DAMAGE_RESULT.DIED`, never by truthiness: every value is a non-empty string. Then [`handleDamageResult()`](js/shared/DamageResultHandler.js) plays the explosions and sounds and adds the score. Bullet hits, the stabber's stab and area damage go through this one path. A rusher's own blast (`handleRusherExplosionResult` in [`EnemyUpdatePipeline.js`](js/systems/gameplay/EnemyUpdatePipeline.js)) and the bomb ([`BombSystem.js`](js/systems/BombSystem.js)) read the result themselves, and a tank's ball kills a smaller alien outright, skipping `takeDamage`.

- **Deaths.** [`EnemyDeathHandler`](js/systems/combat/EnemyDeathHandler.js) plays each death. A grunt's is its own ([`GruntDeath.js`](js/entities/GruntDeath.js)): it pops on the next eighth note at least 20 ms ahead (`popTime`, Voicebox's lead), and is drawn when the pop is heard, on the audio clock, so hitstop doesn't hold it and a pause does. Its whine lands on the hum's minor third, and grunts popping at one time strum a chord ([`DeathSounds.js`](js/audio/DeathSounds.js)). Its pieces fly the way the killing blow sent them: each kill path hands the blow (`{ dir, blast }`) to the death itself, never through `takeDamage`'s angle, which a tank reads (a null angle keeps a blast off his plates). The tank, the stabber, and a rusher killed by a tank's ball still burst into fragments (`EnemyFragmentExplosion`). An enemy killed this frame isn't drawn: it leaves the array at the next update, which hitstop and the Dude's death scene skip, and its death stands in for it.

- **Hit radius.** A bullet hits an enemy within `bullet.size / 2 + enemy.hitRadius`. The radius per type is in `CONFIG.HITBOX`, because sprites are wider than `size / 2`. The player keeps `size / 2`.
- **Blasts and area damage.** A rusher's blast and the hazard clouds (plasma and radioactive debris, one [`HazardCloud`](js/effects/explosions/HazardCloud.js) class with two configs) damage enemies through [`damageEnemiesInRadius()`](js/effects/AreaDamageHandler.js). An enemy counts when its hit radius reaches into the circle; enemies already killed this frame are skipped. Blasts land after the enemy loop has compacted the array, so an enemy is hit once and what they kill is gone before bullets run.
- **The player.** [`Player.takeDamage()`](js/entities/player.js) owns the shield, the wound sound and the kill-streak reset. The shield takes one real hit whole (contact ticks go through it), recharges in `CONFIG.PLAYER.SHIELD_RECHARGE_MS` and returns on the beat. Pushes go through `player.knockBack(fromX, fromY, force)`, which fades out over a few frames (`CONFIG.PLAYER.KNOCKBACK_*`). Once the run is over, `GameState` ignores further score and kills, so nothing that finishes in the same frame counts. Callers hurt the player with `player.hurt(amount, source)`, which also ends the run on a fatal hit and returns `true` if the player died. His look ([`PlayerRenderer.js`](js/entities/PlayerRenderer.js)) draws from `player.pose()`: update() keeps `poseBeats` (BeatClock's beat position), so pause and hitstop freeze him, and stamps his shot, a hit to his health and the shield's return in beat positions; `GameState.restart()` clears them with his other fields (the beat clock's reset can land near beat 4), and update() drops any stamp later than `poseBeats`. His shots leave the drawn gun (`heroMuzzle`), and he aims from his shoulder, so they pass through the cursor.

## Dev tools

- **`?tune`**: live sliders for every knob in `KNOBS` in [`TunePanel.js`](js/dev/TunePanel.js) (the kick, the hum, the sky, the mix, pacing, each character's numbers and look, the deaths, the chatter), plus Level +1 and "Sound while paused".
- **Voice playground** (`voices.html`): any phrase in any speaker's voice and effect chain, with render time, loudness and ceiling readouts; "Copy config" for `js/config.js`.
- The playtest, screenshots, the beat check and the replay compare are in [docs/TESTING.md](docs/TESTING.md).

## Known debt

- **`window.*` still has readers.** Game code should read the context, but `GameState` still reads 14 globals (`window.audio`, `window.player` and others) instead of being handed what it needs; `Audio` reaches `window.beatTrack`, `InputHandlers` reaches `window.uiRenderer`, and `player.js` reads the input flags that `InputHandlers` writes to `window`.
- **The game is frame-locked.** Enemies and the player move by frame time, but bullets move a fixed step per frame, so on a 120 Hz screen they run twice as fast.
- **Some files are long:** `PlayerRenderer.js` is about 1,200 lines, `TankRenderer.js` about 1,000, `RusherRenderer.js` and `StabberRenderer.js` about 900 each, `GruntRenderer.js` about 700 (each holds its character's palette, geometry and drawing), and `Audio.js` about 800.

## Adding an enemy-instrument

A new enemy touches these places:

1. A class extending [`BaseEnemy`](js/entities/BaseEnemy.js) in `js/entities/`. `takeDamage()` returns a `DAMAGE_RESULT` value. It draws itself by overriding `drawFigure` (BaseEnemy's draws nothing), as the grunt does with [`GruntRenderer.js`](js/entities/GruntRenderer.js), the tank with [`TankRenderer.js`](js/entities/TankRenderer.js), the rusher with [`RusherRenderer.js`](js/entities/RusherRenderer.js) and the stabber with [`StabberRenderer.js`](js/entities/StabberRenderer.js); all four cache their parts as sprites with [`spriteCache.js`](js/entities/spriteCache.js).
2. An entry in `ENEMY_CLASSES` and `ENEMY_INTRO_LEVEL` in [`SpawnSystem.js`](js/systems/SpawnSystem.js), and its weight in `getEnemyTypeForLevel()` there: the type lists are written out per level range, so a type missing from them spawns only as its preview.
3. What touching it does to the player, in the switch in [`PlayerContactHandlers.js`](js/systems/combat/PlayerContactHandlers.js). An unlisted type does nothing on contact.
4. Its beat timing: count beat positions from `beatClock.getBeatPosition()` and act once, on the first update at or after each beat, as the tank, rusher and stabber do; or, like the grunt, a `BeatClock` gate (`canGruntShoot()`) through `onBeatOnce()`.
5. Its sounds in [`SoundConfig.js`](js/audio/SoundConfig.js), including a `<type>Response` entry for the call-and-response on deaths, played with `audio.playSound(key, x, y)`.
6. Its numbers in `CONFIG` (and a `CONFIG.HITBOX` radius), with knobs in `KNOBS` in [`TunePanel.js`](js/dev/TunePanel.js) for anything to tune by ear.
7. Its glow colour in `GLOW_RGB` in [`BaseEnemyHelpers.js`](js/entities/BaseEnemyHelpers.js).
8. Its beats in `expectedBeats` in [`tests/beat-assertions.js`](tests/beat-assertions.js), and a unit test that a non-fatal hit returns `damaged` and plays its hit sound.

## Conventions

- New code goes in the domain folders above, not at the top of `js/`.
- Don't add new `window.*` globals where passing a context works.
- Import from the real module. Don't add re-export files.
- Numbers belong in `config.js` or a named constant, not inline.
