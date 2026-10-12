# Roadmap

Everything still open, by area: work to build, and calls only Edward can make by ear or eye. Collected on 2026-10-10 from the merged PRs, the specs and the session notes, and checked against the code on `ed1fa21`. Engineering debt is in [ARCHITECTURE.md's "Known debt"](../ARCHITECTURE.md#known-debt).

**How to use it.** Add an item when a PR defers one, and delete the item in the PR that does it. An item's source names where its detail lives: a PR's description, or a spec in `docs/superpowers/specs/` (git-ignored, in the main checkout only).

**Marks:**

- **build:** work to do;
- **call:** Edward's ear, eye or decision first;
- **check:** may already be done or may not happen; look before building.

## Audio

The audio overhaul's next step:

- **call: a ghost snare in the silences?** Grunts now come in swarms, two at once from different sides, that play the snare as a section while one is in range, though not on every 2 and 4 (the playtest reports the share and the silences over a bar); once Edward has heard them, do the silences want one? It would play in the drums group.

Calls and smaller work:

- **check: the kick's level depends on where in a 128-frame render block it starts:** above 250 Hz it is 2.3 dB louder half a block in than on a block's start, smoothly, and the tank's shot 1.5 dB the same way; most tones don't move. In play each beat lands at a different place in a block, so the kick may swing up to ±1.2 dB from beat to beat. Cause not found; the window tests average over a block. (mix pass)
- **call: the hero's final shot sound** (softHat, metalHat, tick, ghostArp; tick is the default). Then the other three and the `HERO_SHOT.SOUND` knob go.
- **build: delete the grunt shot's zap option and its `BAND.GRUNT_SHOT` knob.** Edward kept the stab (#94); ask before deleting.
- **call: rushers set off in a chain crash together exactly in step,** +6 dB each doubling (the crash noise has a fixed seed). Fix only if it's heard as too loud: one crash per frame.
- **build, low: a rusher lit while he warps in misses that beat's fuse beep.** A fuse with no beeps at all needs `FUSE_MIN_BEATS` 1, which also skips his punchline (said with his last beep). Fix: beep on his first update when it falls within the clock's tolerance of a beat. (Codex on #94)
- **build: #94's deferred minors:**
  - `Tank.js`'s `lastBeat` comment says "for the shove", but it also drives the charge's pluck;
  - two tanks firing on one beat 1 come out about 2 dB loud;
  - a note with a fractional octave fails after its nodes exist;
  - no test for a late frame in the middle of a fuse;
  - no test that the `BAND` knobs show on `?tune`;
  - PresetNotes compares the tank's note as a literal.
- **build: the beat lead's deferred minors** (its review round, 2026-10-10):
  - the plate clang and the stabber's pluck are never tested just before an eighth, so an early window given to them would pass;
  - speech can be booked less than one render quantum ahead of the audio, so a line's reported start can be up to 3 ms early;
  - `Voicebox.startTime` doesn't check that the clock runs on its own context (it always does today);
  - "on the audio clock" comments in `TankDeath.js`, `GruntDeath.js`, `GameState.js` and `BaseEnemy.js` describe clock times, now one lead ahead of `currentTime`.
- **build: #84's deferred minors:**
  - the hum's log-once flag hides a later, different error;
  - a first bar that throws leaves the hum silent;
  - a NaN `DRIFT_CENTS` leaks a node;
  - a failed `Audio.initialize` leaves its context alive;
  - pasting a `?tune` JSON from before #84 crashes the `KICK.TUNED` knob.
- **build: a lead that adapts to the frame rate.** The game runs a fixed `CONFIG.BEAT_CLOCK.AHEAD_MS` ahead of what you hear; a 30 fps machine needs about 40 ms. It can't use the live slider's change, which moves the kick: it would apply at a restart, where the grid snaps anyway. (beat-lead spec)
- **check: a restart that moves beat 1 earlier doesn't restart the hum's breathing,** so its filter eases toward the old bar line for up to a breath. (Codex on #84; `Hum.js` accepts the bend in a comment)

## Characters

- **call: tune by eye on `?tune`, and put the values in `config.js`:** the grunt (`GRUNT_LOOK`, with his chatter's spin and stretch and his swarm's lean); the tank; the rusher (boost, turn, fuse, push, size, crash volume). No values have come back for any of them.
- **check: other sounds with no cause on screen?** Edward: "it should be visible what causes the sounds the player hears". The grunts' chatter and move calls show now; the other enemies' chatter, calls and speech were not checked.
- **call: the stabber's play-test** (#87). Points to judge:
  - does he read as a beetle or a crab from above, and how is the magenta, his frill now showing, his gaze at game size, his glow;
  - the strings' levels, alone and two or three at once (raised 1.4–4.7 dB by the mix pass);
  - ten shots to kill;
  - the gold flakes after a lunge.
- **call: the stabber's proposals not taken** (#87):
  - a glow knob;
  - his idle chant back as a pizzicato;
  - a beat-grid epoch, so a mid-run grid reset can't strand him.
- **call: the cast's beat moves run one lead ahead of their sounds.** The Dude's nod and steps, the grunts' crouch, the tank's lurch, the rusher's boost and the stabber's count ring read the game's clock, which runs `CONFIG.BEAT_CLOCK.AHEAD_MS` ahead of what you hear. If it shows, move them to the heard beat, as the sky and the Dude's kick pulse already are. (beat-lead spec)
- **call (deferred by Edward): the Dude's speech text sits on his health bar.** The fix is a text offset per speaker.
- **build: a bomb-planting pose for the Dude:** his drink hand is full. (#83's spec)
- **build: lines that fit the new cast.** Grunts still shout soldier lines ("KILL HUMAN!"), and the tank's anger and calm lines are robotic, not a vain bully's. The rusher's were redone on 2026-10-12.
- **build, ideas Edward liked:**
  - the tank can't reach the bomb on his back;
  - a bowling-ball bomb with "STRIKE!";
  - the White Russian as the Dude's health gauge;
  - family reactions between enemy types;
  - the carpet in play.
- **build: #83's minor:** the sprite cache never rebuilds after a lost graphics context (only the sky checks for one).
- **check: the grunts' drawing costs most of a frame's work in big swarms.** 25 grunts take about 5.7 ms a frame in headless Chromium (2026-10-12), up to 1.9 ms of it in the 18 colour changes each grunt makes (fill and stroke). Building his fixed colours once as p5.Colors saved nothing measurable: the cost is the canvas switching colour, so a cut needs fewer switches (more of him in his sprites). Time it on Edward's laptop before building. (The audit fixes.)
- **build: #82's rusher minors:**
  - a ring lit by a bomb flashes a ghost arc for about 0.15 s;
  - the arm sprite clips the hand;
  - the crash call has no try/catch;
  - three missing tests: the hit flash, `turnAt`'s easing and GameLoop's `update(dt)`.
- **check: #87's stabber minors:**
  - a dead `'stabber-miss'` route;
  - duplicated helpers;
  - the tremolo runs up to half a beat into a restart.

## Deaths and effects

- **call: the stabber's death, by eye and ear on `?tune`:** Gold shatter is the default (Edward's pick at the play test, for its sound), Empty shell the other `DEATHS.STABBER_STYLE`. Its level (`DEATHS.STABBER_VOLUME`; both styles sit about 2 dB over the kick, beside the tank's death). The port kept the studies page's small choices, each Edward's to change:
  - the shell's spike splits with the shell;
  - its glide falls almost an octave, onto the hum's fifth;
  - the shatter's spike turns and jabs at the hero before it crumbles (the designer's own idea);
  - the shatter's magenta bits among the gold plates.
- **call: a `?tune` knob for the stabber's frill** (0 hides it), if it is too much now that it shows. A proposal from the stabber death spec's review.
- **test: the Empty shell's eye turns to the hero.** Nothing would notice it glaring along his turn at the kill instead: the shell keeps no state for the eye, so a test has to read where it is drawn. From the stabber death's review round.
- **check: two stabber deaths at different `STABBER_LOOK.ART_SCALE`s** (the slider moved mid-fight) rebuild each other's sprites every frame until one ends: the sprite cache keeps one size a table.
- **check: every death keeps the time it is heard from the kill:** a change in the audio latency or the beat clock's lead mid-death doesn't move its picture. A proposal from the stabber death spec's review, for all the deaths at once.
- **build: a new look for a tank plate breaking.** Only its clang was redone (#92).
- **build: #92's follow-ups:**
  - the smoke cloud's sound follows its picture at low frame rates;
  - end a death whose clock jumps back;
  - time the tank's "UH, OH" from the end of the hero's "1";
  - hold his flinch if he's shot mid-flinch;
  - a cloud started while muted stays silent after unmuting.
- **call: should the tank's "UH, OH" stop ducking the bomb's bang?** And is the tank's air-out death too much when tanks die often? Its zip knob is there for it. (#92)
- **build: the hitstop flash's colour-split numbers on `?tune`** (`HITSTOP_CHROMA` and KillFeedback's).

## Sky

- **call: the nebula's detail** ("good enough to push, work more on the detail later").
- **call: should the sky keep pulsing while muted?** It does today.
- **call, then build: the beat track records the kicks it really plays,** so the sky and the Dude stop rebuilding them from the pattern. This fixes:
  - the phantom pulse on the first key press;
  - pulses on kicks a pattern change or a restart skipped;
  - the old bar's accent carried past a restart.
- **build, idea: curved space.** The world as a slice of curved space, bullets following the curve and the nebula bending round masses. The sky spec named it as the next spike.
- **build: drop a weak GPU to the flat sky by itself** when frames stay over 22 ms for 2 s. Today only a lost context or `?sky=flat` does.
- **build, idea:** where the kill-streak orbs sit near the score; the look of the health wash.
- **build: the sky's 13 deferred minors:**
  - dead BeatClock helpers;
  - the shader's fixed 800×600, its own lerp and 6.283;
  - `screenshot` capturing the flat sky;
  - test gaps.
    (The sky's ledger, `.superpowers/sdd/2026-09-28-kick-nebula-sky/`.)

## Speech

- **call: tune the hero's and the tank's voices.** They are still first guesses; the grunt's (#89) and the stabber's (#94) are tuned.
- **call: the rusher's voice.** He sings through SAM now (the singer from the 2026-10-12 voice studies); `?tune`'s `SPEAKERS.rusher` tries the studies' other voices in play. Once one is picked, put it in `config.js` and delete `RUSHER_VOICES` and its knob in `TunePanel.js`. A voice picked there renders the rusher's punchlines when first said, so they can start an eighth late.
- **call: enemies can talk over the bomb's countdown** (since #89). If it clutters, hold their gap through the count. Also set the chatter odds by ear.
- **check: a second bomb's "TIMEBOMB!" can land on the first bomb's count** (#90 doesn't cover it).
- **build, low: speech told the start of the sound it goes with,** so "FIRE!" starts with the tank's shot itself, not on the eighth found again when its render ends. (beat-lead spec)
- **build: speech minors:**
  - a failed line logs a warning, which no test sees;
  - worker errors carry no file or line;
  - a worker crash should also stop lines already scheduled;
  - no "Loading speech…" notice;
  - a `postMessage` that throws leaves its 60 s timer running.
- **build, idea: variation per line,** e.g. pitch jitter on aggressive lines, as a playground option.

## Gameplay

- **call: a time limit for a lit rusher.** He waits for his beat however long that takes. Options: none, or a backstop.
- **check: a tank with blockers on both sides can stall midway between them.** It's rare, and two simple fixes made it worse.

## Tests and tooling

- **build: the 2026-10-12 audit's smaller leftovers** (its fixes are #103):
  - an aggressive line's bubble shakes with `random()` while drawn, so it jitters through a pause and draws the replay's random numbers, as enemies' hit shakes did;
  - each enemy type calls `keepInWorld()` after `super.update()`; one call in `BaseEnemy.update` would do (keep the rusher's own while `Rusher.fuse.test.js` calls his behaviour step directly);
  - no test presses an arrow key into the aim flags or checks that a window blur clears them;
  - `Audio` keeps fields nothing reads (`p`, `volume`, the one-key `effects`), `update()` only calls `updateTexts()`, and `speechEnabled` always follows `enabled`;
  - about a dozen names are exported but only used in their own file.

- **check: the two flakes below may be gone.** Until #104 the E2E server reloaded the page under test whenever a file was written in the checkout, such as a failed test's files in `test-results/`, which matches both. Delete them if neither recurs.
- **check: a known flake under full-suite load:** "Held keyboard fire lands on eighth notes". (The kick-lock check, the other one, failed about 1 run in 10 on the grunts' random skips; it now plants a swarm held still with a clear line, and passed 30 runs out of 30 alone on the desktop, 2026-10-10 and 11.)
- **check: "The sky draws in every state" failed once under full-suite load** on the desktop (2026-10-12, #100), message lost; it then passed 6 runs out of 6 alone and the full suite again. It wants a sky frame within each 300 ms window, which a loaded runner can miss.

## The README

- **call: a gameplay clip with sound.** It needs Edward's screen and speakers; he said to skip it for now.
