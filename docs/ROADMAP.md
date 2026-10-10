# Roadmap

Everything still open, by area: work to build, and calls only Edward can make by ear or eye. Collected on 2026-10-10 from the merged PRs, the specs and the session notes, and checked against the code on `ed1fa21`. Engineering debt is in [ARCHITECTURE.md's "Known debt"](../ARCHITECTURE.md#known-debt).

**How to use it.** Add an item when a PR defers one, and delete the item in the PR that does it. An item's source names where its detail lives: a PR's description, or a spec in `docs/superpowers/specs/` (git-ignored, in the main checkout only).

**Marks:**

- **build:** work to do;
- **call:** Edward's ear, eye or decision first;
- **check:** may already be done or may not happen; look before building.

## Audio

The audio overhaul's four next steps; Edward picks the order:

- **build: enemy sounds ahead of their beats.** Every enemy sound starts on the frame its creature sees the beat, 8–13 ms after the kick: a slight flam. Booking them ahead, as the hero's shot is, puts them on it. (audio evaluation 2026-10-09; #94 "Outside")
- **build: a mix pass by group** (drums, band, feedback). #93 and #94 levelled sounds one by one; the evaluation found 37 of 50 sounds louder than the kick.
- **build: a ghost snare on the grunts' 2 and 4,** so the backbeat is heard when grunts hold their fire.
- **build: the level-up sound on the bar line.** Today it plays the moment the score crosses (`GameState.js`).

Calls and smaller work:

- **call: the hero's final shot sound** (softHat, metalHat, tick, ghostArp; tick is the default). Then the other three and the `HERO_SHOT.SOUND` knob go.
- **build: delete the grunt shot's zap option and its `BAND.GRUNT_SHOT` knob.** Edward kept the stab (#94); ask before deleting.
- **build: tune the speech voices to the hum's scale,** and give the voice playground the hum. (universe-hum spec)
- **call: rushers set off in a chain crash together exactly in step,** +6 dB each doubling (the crash noise has a fixed seed). Fix only if it's heard as too loud: one crash per frame.
- **build, low: a rusher lit while he warps in misses that beat's fuse beep.** A fuse with no beeps at all needs `FUSE_MIN_BEATS` 1. Fix: beep on his first update when it falls within the clock's tolerance of a beat. (Codex on #94)
- **build: #94's deferred minors:**
  - `Tank.js`'s `lastBeat` comment says "for the shove", but it also drives the charge's pluck;
  - `drive()` rebuilds its curve on every tank shot;
  - two tanks firing on one beat 1 come out about 2 dB loud;
  - a note with a fractional octave fails after its nodes exist;
  - no test for a late frame in the middle of a fuse;
  - no test that the `BAND` knobs show on `?tune`;
  - PresetNotes compares the tank's note as a literal.
- **build: #84's deferred minors:**
  - the hum's log-once flag hides a later, different error;
  - a first bar that throws leaves the hum silent;
  - a NaN `DRIFT_CENTS` leaks a node;
  - a failed `Audio.initialize` leaves its context alive;
  - pasting a `?tune` JSON from before #84 crashes the `KICK.TUNED` knob.
- **check: a restart that moves beat 1 earlier doesn't restart the hum's breathing,** so its filter eases toward the old bar line for up to a breath. (Codex on #84; `Hum.js` accepts the bend in a comment)
- **build, trivial:** `config.js`'s HUM comment still says "Provisional … (PR 2)"; PR 2 is merged and the hum is settled.

## Characters

- **call: tune by eye on `?tune`, and put the values in `config.js`:** the grunt (`GRUNT_LOOK`); the tank; the rusher (boost, turn, fuse, push, size, crash volume). No values have come back for any of them.
- **call: the stabber's play-test** (#87). Points to judge:
  - does he read as a beetle or a crab from above, and how is the magenta, his gaze at game size, his glow;
  - the strings' levels, alone and two or three at once;
  - ten shots to kill;
  - the gold flakes after a lunge.
- **call: the stabber's proposals not taken** (#87):
  - a glow knob;
  - his idle chant back as a pizzicato;
  - a beat-grid epoch, so a mid-run grid reset can't strand him.
- **call (deferred by Edward): the Dude's speech text sits on his health bar.** The fix is a text offset per speaker.
- **build: a bomb-planting pose for the Dude:** his drink hand is full. (#83's spec)
- **build: lines that fit the new cast.** Grunts still shout soldier lines ("KILL HUMAN!"), and the tank's anger and calm lines are robotic, not a vain bully's. The rusher's were redone in #82.
- **build, ideas Edward liked:**
  - the tank can't reach the bomb on his back;
  - a bowling-ball bomb with "STRIKE!";
  - the White Russian as the Dude's health gauge;
  - family reactions between enemy types;
  - the carpet in play.
- **build: #83's minors:**
  - the sprite cache never rebuilds after a lost graphics context (only the sky checks for one);
  - a restart doesn't clear the Dude's queued shot.
- **build: #82's rusher minors:**
  - a ring lit by a bomb flashes a ghost arc for about 0.15 s;
  - `pose()` is built twice a frame while he's lit;
  - the arm sprite clips the hand;
  - the crash call has no try/catch;
  - four missing tests.
- **check: #87's stabber minors:**
  - a dead `'stabber-miss'` route;
  - duplicated helpers;
  - the tremolo runs up to half a beat into a restart.

## Deaths and effects

- **build: the stabber's own death.** He still bursts into the generic recoloured chunks.
- **build, after it: delete `EnemyFragmentExplosion`.** Only the stabber, and a rusher dying without his crash, still use it.
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

- **call: tune the hero's, the rusher's and the tank's voices.** They are still first guesses; the grunt's (#89) and the stabber's (#94) are tuned.
- **call: enemies can talk over the bomb's countdown** (since #89). If it clutters, hold their gap through the count. Also set the chatter odds by ear.
- **check: a second bomb's "TIMEBOMB!" can land on the first bomb's count** (#90 doesn't cover it).
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

- **build: fail on console errors during real play.** `playtest.js` only counts them, so a sound that breaks in play leaves every suite green. (#94)
- **build: one shared fake-audio helper for the unit tests.** Nine test files each define their own.
- **check: known flakes under full-suite load:** "Kick locks to the enemies' beat" (about 1 in 10), and "Held keyboard fire lands on eighth notes".

## The README

- **build: re-record `docs/media/demo.gif`.** It dates from 2026-09-25, before the sky, the five character overhauls, the deaths and the explosions.
- **call: a gameplay clip with sound.** It needs Edward's screen and speakers; he said to skip it for now.
