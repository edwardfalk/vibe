# Review: 2026-09-24-play-test-fixes.md

Reviewed 2026-09-24 with the `review-plan` skill.

**Reviewers:**
- **A1** (purpose, reconstructed from the repo; this plan has no spec file);
- **A2** (alignment with that purpose);
- **B** (grounding: applied the whole plan to a scratch copy of main at 0057fe9, ran every named command, and mutation-probed the new tests);
- **C** (adversarial);
- **D** (scope, ponytail-review);
- **E** (Codex).

Edward answered four decisions during the review.

## Intent findings (lead)

1. **Nearest-beat windows would move every enemy about 100 ms ahead of the kick, and let grunts fire twice per beat.** Witnesses: A2 (Conflict 1), Codex (1), C (1).
   - Nearest-beat attribution opens the window about 100 ms before the beat.
   - The guard against firing twice per beat (`_lastGruntBeat`, `gruntFireBeat`) and the tank's charge bookkeeping use the floored `getTotalBeats()`, which changes mid-window. That allows a second shot.
   - **Fixed: approach changed.** Beat-gated checks open when the beat lands and stay open for `tolerance` ms after it, never before. `getTotalBeats()` can't change inside that window, so the existing guards and tank counters stay correct unchanged.
2. **The duck would dip the steady kick whenever anyone speaks.** Witness: A2 (Conflict 2).
   - **Decided by Edward:** *"letting the kick duck for speech isn't necessarily bad. It depends on the amount."*
   - **Resolved:** separate duck amounts, both on `?tune` sliders: effects `DUCK_SFX_DB = -6`, beat track `DUCK_BEAT_DB = -3`.
3. **The mix numbers moved the effects further under the kick,** the opposite of Edward's complaint. Witnesses: A2 (Gap 3), Codex (5), B (9).
   - SFX −6 dB against beat −4 dB means effects lose about 2 dB relative to the kick.
   - B measured the plan's own script: `alienShoot` 5.5–7.1 dB under the kick, `hit` 6.5–8 dB under.
   - **Fixed:** start at `SFX_VOLUME 0.7` (−3 dB) and `BEAT_TRACK_VOLUME 0.16` (−8 dB). The measurement becomes a **gate**: effects-minus-kick must rise by at least 4 dB from main to the branch, and the kick must stay within 6 dB of #60's −23 dB laptop-band level.
4. **Keyboard fire ignores the beat.** Witnesses: the firing investigation and A1's purpose statement (sustained fire is the "hi-hat" on eighth notes).
   - `player.js:244` resets the burst whenever the *mouse* isn't pressed, so Space/Shift fire at a flat 200 ms.
   - **Decided by Edward: snap keyboard fire too.** Added to Task 2.
5. **The stabber's window is centred on beat 4 (3.75–4.25), not the 3.5 off-beat the design names.** Witness: A2 (Gap 4).
   - **Decided by Edward: move it to 3.5 in this PR.** Added to Task 4: the window opens at 3.5 and lasts `tolerance`.
6. **The stabber chant rolls a chance on every frame of its window.** Witness: A2 (Gap 4). **Fixed:** once per window, via `onBeatOnce`.

## Run-time and correctness findings

7. **A restart can schedule the same kick twice.** Witnesses: C (2), Codex (3). Re-anchoring forgot notes already handed to Web Audio. **Fixed:**
   - Track `_lastNoteSec` and never schedule at or before it.
   - The unit test now shifts the origin by whole beats, as `reset()` really does.
   - The E2E test asserts no two kicks within half a beat, at least 2 kicks after a restart, and the accent on beat 1.
8. **Negative elapsed time after `reset()` snaps forward.** Witness: Codex (4). `%` gives negative phases, and `isOnBeat()` was true 200 ms early (Codex ran the real class). **Fixed:** `BeatClock.update()` normalises the remainder, with a test.
9. **The speech-duck counter mirrors engine state through events that can be lost or arrive late.** Witnesses: C (3), Codex (6), D.
   - Chrome can garbage-collect an utterance before `end` fires.
   - A cancelled utterance's late `end` can release a newer one's duck.
   - D noted that the queue is serial anyway.
   - **Fixed (less state, not more):** drop `SpeechDuck`. `Audio.syncDuck()` reads `speechSynthesis.speaking` every frame, from the top of the draw loop, before the non-playing return, so game-over speech can't leave it stuck.
10. **E2E could test the wrong checkout.** Witnesses: B (1), C (4), Codex (9). With `reuseExistingServer`, the server on :5500 (Edward's dev server in `.worktrees/pacing`) is reused whatever `cwd` says. **Fixed:** the scratch config uses port 5502, `reuseExistingServer: false` and a matching `baseURL`.
11. **Fire inputs (Task 2).**
    - D: one Set with `'mouse'` as a member, and no rewrite of the arrow cases.
    - C (5): re-sync Shift from `e.shiftKey`, since a lost Shift keyup is a known Windows quirk.
    - Codex: blur must also clear the arrow flags.
    - B (3): mouse+Shift was untested.
    - **Fixed:** all four adopted, plus tests for right Shift, mouse+Shift and reverse release. C's `mousemove` `e.buttons` re-sync was **not** adopted; blur plus mouseup cover the realistic cases.
12. **Short sounds (Task 5).**
    - D: `toneEnvelope.js` is unnecessary once `playerShoot.duration` is 0.04, since the shortest tone (0.036 s) then exceeds the 10 ms attack.
    - Codex: the helper test wouldn't prove `playTone` uses it.
    - **Fixed:** no new module. Name the attack `TONE_ATTACK_SEC`, and add a unit test that every `SOUND_CONFIG` duration × 0.9 is at least 3 × the attack. That pins the invariant that caused the silent shot.
13. **Task 8 details.**
    - B (10): trails add about 50–75 particles/s each, not 15, because they are also called from every draw frame.
    - Codex: also remove the trail timers, wrappers and imports, but keep the screen-effect calls in `EnemyUpdatePipeline`.
    - D: drop the "confirm the leak" step (the grep proves it).
    - A2: add why it belongs here (a slower frame loop delays enemies' first frame in their beat window).
    - **Fixed.**
14. **Task 3 details.**
    - D: reuse `createContextAccessor`, delete `setGlobalBPM` (no callers) and the `bpm` field.
    - B (12): the hidden-tab test passes on old code as well.
    - **Fixed.**
15. **Weak tests.** Witness: B (2, 4 and "tests that stay green").
    - `canTankShoot`/`canRusherExplode` weren't covered.
    - `onBeatOnce` without its `isOnBeat` check stayed green.
    - The restart E2E passed with no kicks at all.
    - `toggle()`'s duck reset was untested.
    - **Fixed:** assertions added. The `toggle()` item is moot now that the duck is polled.
16. **Factual corrections.** Witness: B.
    - Retreat chance is 0.3 (advance 0.25).
    - The tank's `speak()` is rate-limited by Audio's 2.5 s cooldown; only its `playSound` repeats.
    - The effective speech distance floor is 0.4, not 0.3.
    - The `?tune` JSON line must keep `PACING: pacing` (name shadowing).
    - The Step 9 script must be named `*.test.js`.
    - **Fixed.**
17. **Lint would fail as written** (Prettier). Witness: B (11). **Fixed:** each task formats its files before committing.
18. **The `?tune` apply callbacks are a mechanism for one call.** Witness: D. **Fixed:** the listeners call `window.audio?.applyMix?.()`.
19. **The limiter "safety net" claim isn't proven.** Witness: Codex (7). **Fixed:** the settings live in `CONFIG.MIX` and are checked in the Step 9 gate (no pumping at typical levels). Measure isolated sounds with ducking off and positions fixed, using the same filter and window on main and on the branch.
20. **The plan contradicted its own "tunables in config" rule.** Witness: Codex. **Fixed:** the Global Constraints now separate *mix/levels* (config plus sliders) from per-entity chances (named constants at the top of the file, allowed by CLAUDE.md's "no magic numbers").
21. **A polluted high score stays after the Task 7 fix.** Witness: C (6). **Fixed:** the PR body tells Edward how to clear it; no code wipes a possibly real score.
22. **Resuming after an interruption fails at `worktree add`.** Witness: C (7). **Fixed:** resume instructions added.

## Escalated and decided

- **Tank "CHARGING!" can never play.** Witness: Codex (2). It waits for beat 1 one beat after a beat-1 start. **Edward: leave it, note it** in the PR as an open issue.
- **A warning when the kick has no shared grid.** Witness: C (8). This adds a mechanism (a tick counter), so the null option wins: the PR notes the limitation (when BeatClock isn't on BeatTrack's AudioContext, the kick is silent) instead of adding code.
- **Use `KICK.VOLUME`/`SUB_PULSE.VOLUME` instead of a beat-track master.** Witness: D. **Rejected on the merits:** `KICK.VOLUME` feeds the tanh drive, which normalises its output. Cutting it from 0.6 to 0.24 lowers the kick only about 2.4 dB, not 8. A post-drive master is needed, so `MIX.BEAT_TRACK_VOLUME` stays.
- **Delete the Step 9 measurement.** Witness: D. **Rejected:** A2, B and Codex show the plan's own numbers were wrong. It becomes the gate.

## Other

- **No spec file** (A fallback path). The requirements are Edward's play-test notes, quoted per task. That's acceptable for a bug-fix plan, but the plan cannot be checked for fidelity to a written spec.
- **Unverifiable** (B): the exact earlier measurements (kick offsets, 48% silent, 2–18 copies). B reproduced a consistent 187 ms offset and confirmed the mechanisms.

**Reviewers:** A1 ran; A2 ran; B ran; C ran; D ran.

Codex: findings included normally (exit 0).

29 findings, 23 fixed, 6 escalated (4 decided by Edward, 2 resolved by the null option or on the merits), 5 reviewers run of 5.

---

# Re-review (the one permitted re-review, after the approach changed)

**Reviewers:**
- **A2** (reusing A1's purpose statement);
- **B** (applied Tasks 1–7 verbatim to a scratch copy of 0057fe9 and ran everything; with one correction, lint passes, 139 unit tests pass and 23 E2E tests pass);
- **C**;
- **D**.

Edward answered two more decisions.

## Fixed

1. **Moving the stabber's gate to 3.5 would put its *dash* on beat 4, the snare.** Witnesses: A2 (Conflict 1), C (6). The warning lasts half a beat after the gate opens. **Fixed, honouring Edward's "move to 3.5" decision:**
   - prepare→warning opens on beat 3 (`isOnBeat([3])`), so the dash lands on 3.5;
   - `canStabberAttack()` (the 3.5 window) still gates chant, recovery and speech;
   - the telegraph ring counts down to 3.5.
2. **The rusher explosion would land 85–100 ms after the beat.** Witness: A2 (Conflict 2). A 5-frame fuse runs after the gate opens, and the gate no longer opens early. **Fixed:** the fuse is 0 in the beat-gated branch.
3. **The mix numbers contradicted the gate.** Witnesses: A2 (Conflict 3), B (5).
   - Measured: the kick dropped 10.4 dB. The limiter change removed about 2.5 dB of make-up gain from everything.
   - **Fixed:** keep the limiter as it is (−6 dB/12:1; #60 calibrated through it), `SFX_VOLUME` 1.0 (unchanged), `BEAT_TRACK_VOLUME` 0.4 → 0.22 (−5.2 dB).
   - Nominally the effects gain about 5 dB on the kick, and the kick drops about 5 dB. That fits both gate conditions (rise ≥ 4 dB, kick drop ≤ 6 dB).
4. **Narrower gates would halve enemy chatter.** Witness: A2 (Conflict 4).
   - **Edward: keep today's rate.** The speech timer, once up, waits for its beat gate, then rolls once.
   - Per-attempt chances match today's effective rates: grunt 0.18, tank 0.025, rusher 0.03, stabber 0.05.
5. **A stalled speech engine could leave the game ducked for good.** Witness: C (4). **Edward: cap the duck at 5 s** (`DUCK_MAX_HOLD_MS`, measured from `lastSpeechTime`).
6. **The reset unit test couldn't pass.** Witnesses: B (1), C (3), D. The note at 10.484 is already past at 10.5, and it is eighth 1, not 0. **Fixed:** `currentTime = 10.45`, expecting `[[10.484, 1]]`.
7. **The enemy-timing E2E saw nothing and its bound was too tight.** Witnesses: B (2, 3), C (5).
   - `tankFire`/`rusherExplosion` don't exist, and grunts fire only within 300 px.
   - **Fixed:** record `alienShoot` with a grunt moved within range, assert that at least one shot was seen, and bound the offset by `tolerance + 20`.
   - Doubling after a restart is covered by the unit test (B4).
8. **The mix gate would have taken over the E2E config, and speech could skew it.** Witness: C (1, 2). **Fixed:**
   - a separate `mix.config.js`;
   - main measured from a detached worktree on its own port;
   - speech off during measurement.
9. **The duck E2E only checked a JS flag, and the mute part could not fail.** Witnesses: C (9), B. **Fixed:** assert the gains, and assert that muting mid-speech releases the duck.
10. **Simpler code (D), adopted:**
    - `reset()` snaps one bar earlier instead of into the future, so `update()` is unchanged (Codex's negative-elapsed finding, fixed at the source);
    - a single-rule scheduler (no re-anchor bookkeeping);
    - a `fireKey()` helper;
    - `beforeEach` fake timers;
    - drop the `dur` refactor;
    - delete the unused `Audio.setVolume()`;
    - `DUCK_ATTACK_SEC` as a file constant.
11. **The telegraph ring still counted to 3.75.** Witnesses: A2 (Gap 2), D. **Fixed** (see 1).
12. **A right-click can leave the gun firing** (the context menu eats the mouseup). Witness: C (10). **Fixed:** only the left button fires.
13. **Resuming over a half-applied task.** Witness: C (8). **Fixed:** commit WIP or restore, then redo the task.
14. **Task 8's timing rationale was wrong.** Witness: A2 (Drift). The leaked particles are never iterated. **Fixed:** it's a memory fix. B noted that `updateParticles()` also held the only bloom/chromatic fade-out, so on main those never fade. That's recorded as an open issue, not changed here.

## Recorded, not changed

- **A possible 0–30 ms flam between the kick (scheduled ahead) and gated sounds (played when the frame runs).** Witness: C (7). This is a listening-pass item. A fix would schedule gated sounds at the exact beat time, in a follow-up.
- **`syncDuck` pauses in a hidden tab.** Witness: C (11). Accepted and noted.
- **The tank's calm-down line (`Tank.js:91`) is single-frame gated,** so it becomes rarer. Minor; noted.
- **Bloom and chromatic aberration never fade on main** (their countdown lived in the never-called `updateParticles`). Open issue for a later PR.

**Reviewers:** A2 ran (A1 reused); B ran; C ran; D ran.

Codex: DID NOT RUN (session Codex budget spent, 2/2; its one remaining call went to the fresh plan-2 review).

20 findings, 18 fixed, 2 escalated (both decided by Edward), 4 reviewers run of 5.
