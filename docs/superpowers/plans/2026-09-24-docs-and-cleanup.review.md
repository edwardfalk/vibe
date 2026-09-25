# Review: 2026-09-24-docs-and-cleanup.md

Reviewed 2026-09-24/25 with the `review-plan` skill.

**Reviewers:**
- **A** (alignment). This plan has no spec file, so the A1 → A2 fallback path applies. A1's purpose statement from the sibling plan's review earlier in the same session was reused: same repo, written with no knowledge of any plan. A2 ran on this plan.
- **B** (grounding): applied the ESLint rules, ran the proof greps, and listed each Playwright project against a scratch copy of main at 0057fe9.
- **C** (adversarial).
- **D** (scope, ponytail-review).
- **E** (Codex).

Edward answered two decisions during the review.

## Intent findings (lead)

1. **The "queued-shot block" isn't dead. It's the hi-hat.** Witnesses: A2 (Conflict 1), B (1), Codex (4).
   - `shoot()` → `queueShot()` (`player.js:294-296, 321-329`) holds off-grid sustained shots until the next eighth note.
   - The play-test-fixes plan routes keyboard fire through this path.
   - **Fixed:** the row is removed, and the Global Constraints now protect eighth-note fire.
2. **`no-console` across `**/*.js` would force deleting the tools' report output.** Witnesses: A2 (2), B (5), C (2), Codex (3).
   - `tests/playtest.js`, `screenshot.js` and `beat-assertions.js` report through `console.log`.
   - **Fixed:** `no-console` is scoped to `js/**/*.js`, and `.worktrees/**` is ignored.
3. **The README's music section left out the player (hi-hat) and the sub pulse, and the enemies' character.** Witness: A2 (3, 5). **Fixed.**
4. **A silent GIF for a sound-first game.** Witness: A2 (4).
   - **Decided by Edward:** GIF plus a 20–30 s clip with sound (screen + system audio via ffmpeg), under "Watch with sound".
   - Edward approves the clip before it's committed.
5. **No LICENSE file, though `package.json` and the README say MIT.** Witness: B (unverifiable list). **Decided by Edward:** add an MIT `LICENSE`.

## Will break during execution

6. **Playwright projects.** Witnesses: B (6, 7, 8), C (1), Codex (1, 2), D.
   - The top-level `testIgnore` excludes the tool suites, so three projects find no tests.
   - Once that's fixed, a bare `playwright test` (CI's `pnpm run test`, plus headed/debug) runs all four projects.
   - `screenshot:level` still points at a deleted config.
   - The old configs also differ in `retries` and artifacts.
   - **Fixed:**
     - suite selection moves into the projects;
     - every script names a project;
     - `test` composes `test:e2e` and `test:unit`;
     - the tool projects get `retries: 0`;
     - verify with `--list` for all four;
     - check with `grep` that no bare `playwright test` or `--config=` remains.
7. **ESLint 9 has no `unix` formatter,** so `-f unix | wc -l` prints 0. Witnesses: B (4), Codex (3). **Fixed:** the counting step is dropped (D). The real counts are 45 unused-var and 132 console findings.
8. **Worktree prerequisites.** Witness: C (3, 4, 5).
   - It branched from a possibly stale local `main`.
   - Nothing checked that play-test-fixes had merged.
   - No `pnpm install`, and no resume path.
   - **Fixed:** branch from `origin/main` after a fetch, check the prerequisite merge, `pnpm install --frozen-lockfile`, and add Resuming clauses.
9. **Deleting unused code: the proof rule was too coarse.** Witnesses: Codex (5), B (smaller).
   - Dead methods call other dead methods (e.g. `getAllTypeInfo` → `getTypeInfo`).
   - `duckDrone` has a guarded caller (`Tank.js:199-201`).
   - The drone row missed `stopDrone` and `AmbientDrone.test.js`.
   - "A failing test means restore" contradicts removing a deleted API's own tests.
   - **Fixed:** delete whole unreachable groups together with their callers and dedicated tests. A failing *retained* behaviour test is the regression signal. `addKillEffect` stays until its string dispatch is ruled out by grep.
10. **Line numbers predate play-test-fixes; ranges ran into class closing braces.** Witness: B (2, 3, 12, invalidated list). **Fixed:**
    - every row is found by symbol, with line numbers as hints only;
    - the EnemyFactory range is corrected (keep the closing brace and the export, and add `getAvailableTypesForLevel`);
    - rows play-test-fixes already removes are dropped (`setGlobalBPM`, `TTS_VOLUME`).
11. **E2E ran only once, after about 10 row commits.** Witness: C (7). **Fixed:** E2E also runs after each browser-only row (p5.sound, drone, `window.keys`, effects barrel), with `git bisect run` if a later run fails.
12. **Baselines lived in this session's scratchpad** (aim-bot, audit scripts, screenshots), measured on pre-fix code. Witnesses: C (8), B (unverifiable), D, A2 (6). **Fixed:**
    - `tests/playtest.js` is upgraded to aim at the nearest enemy (the aim-bot logic), because the random bot scored 20 points in 30 s and measured nothing;
    - baselines are taken on the untouched worktree HEAD before Task 1;
    - the timing ranges are smoke-test guidance, not proof;
    - the scratchpad audit scripts are no longer referenced (D).
13. **The audio-graph header would be wrong on arrival.** Witnesses: Codex (6), B. Play-test-fixes adds a separate `beatDuckGain`. **Fixed.**
14. **The drone decision's "fix it" option breaks the clean-up boundary.** Witness: Codex (9). **Fixed:** the choice is now delete or keep unchanged; activating the drone would be a separate change.
15. **`jumpToLevel` could loop forever, and depends on `practiceRun`.** Witnesses: C (10), D. **Fixed:** bounded loop, throws if the level doesn't advance, asserts `practiceRun` exists.

## Outward actions

16. **Remote branches.** Witnesses: C (14), B (9).
    - There are 16 besides `main` and none is merged.
    - **Nine open PRs** (#19, #21, #22, #51–55, #58) have their head branches in the pool, and deleting a branch closes its PR.
    - Some branches look like restore points.
    - **Fixed:** record each branch's tip SHA, date and open PR before touching anything. Delete with `--force-with-lease=<branch>:<sha>`, per Edward's choice for each branch/PR. The restore command is written down.
17. **The live site after merges.** Witness: C (12, 13).
    - The Pages build lags the push; a failed build leaves the old site up.
    - Headless tests don't prove audio.
    - **Fixed:** poll `pages/builds/latest` for the pushed SHA with status `built`, then listen on the live site in a real browser. Revert command documented.
18. **Approvals and history.** Witnesses: C (11, 15, 16), Codex (10).
    - A README approval could go stale before the push.
    - Repo metadata was overwritten without a record.
    - GIF re-records would bloat history.
    - "Prose only" didn't cover media.
    - **Fixed:**
      - push only if README matches the approved commit;
      - record the metadata before editing;
      - media stays uncommitted until approved, with a size budget;
      - docs/media go by the docs route once Edward has approved them.
19. **Hook removal leaves `core.hooksPath`.** Witnesses: C, Codex. **Fixed:** unset it.
20. **Codex silence isn't a pass.** Witness: C. **Fixed:** post `@codex review` after fix commits.

## Scope (D)

21. **Adopted:**
    - move `bootGame` verbatim instead of rewriting it;
    - drop its unused `path` parameter;
    - delete the liveness test rather than inline it (the "Game loop advances" test covers it);
    - no one-line-per-file tree in ARCHITECTURE.md (one line per folder plus entry points);
    - test lists come from `playwright test --list` and `ls tests/unit`, not hand-copied;
    - CLAUDE.md's Architecture section becomes a pointer to ARCHITECTURE.md;
    - one link and path check;
    - leave the other `package.json` scripts alone (also A2 Drift 8).
22. **Not adopted:**
    - dropping `jumpToLevel`'s `practiceRun`: it costs nothing and protects a real session;
    - using `pnpm run playtest` unchanged as the baseline: it measures nothing (see 12).

## Other corrections (B)

- The roadmap never mentions MCP; that's in the checklist.
- The checklist to keep is at lines 158-169, not 185-195.
- `Audio.js:528`, not 527.
- `GameLoop.js:5`, not 4.
- `PERF_DIAGNOSTICS` isn't documented anywhere.
- All fixed.

**Reviewers:** A1 reused (same repo, same session, written with no knowledge of any plan); A2 ran; B ran; C ran; D ran.

Codex: findings included normally (exit 0).

22 findings, 20 fixed, 2 escalated (both decided by Edward), 5 reviewers run of 5.
