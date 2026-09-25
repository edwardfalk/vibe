# Documentation Overhaul and Clean-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
1. Clear out what earlier AI-driven work left behind: dead code, debug spam, test hooks, duplicate tooling, and docs written for agents or describing code that no longer exists.
2. Rewrite the docs, so that:
   - an employer understands the project from the README;
   - a developer (human or agent) finds their way from ARCHITECTURE.md.

The result is a steady foundation to build on.

**Architecture:** Two parts, in order:
1. **Clean-up PR** (executable code): delete, never change behaviour. ESLint gains `no-unused-vars`, and `no-console` for game code, so the junk can't grow back.
2. **Docs** (prose and media): rewritten against the cleaned code.

This runs **after** `2026-09-24-play-test-fixes.md` has merged, and re-takes every line number from the merged code.

**Tech Stack:** p5.js 1.7 (CDN, instance mode), ES modules, Vitest, Playwright, ESLint 9 flat config, pnpm, GitHub Pages (legacy build from `main` root), ffmpeg.

**Spec:** No separate spec. The requirements are Edward's request of 2026-09-24:
> "plan a full overhaul of the documentation and a clean-up of junk from past mistakes so we can start building for real from a steady foundation"

…plus his portfolio goal (*"something to show potential employers"*), a repo audit the same day, and his decisions in `2026-09-24-docs-and-cleanup.review.md`.

## Global Constraints

- **The clean-up changes no behaviour a player can see or hear.** Deleting code that is unreachable, or that is never shown or heard, is fine. If a step changes behaviour, stop and ask Edward.
- **Must survive untouched** [review-added 2026-09-24]:
  - the steady kick and the sub-bass pulse;
  - eighth-note quantised player fire (`shoot()` → `queueShot()` → `queuedShot`, `BeatClock.isOnEighthNote` / `getTimeToNextEighthNote`);
  - `?tune`;
  - `practiceRun`.
- **Find every item by symbol name.** The audit's line numbers predate play-test-fixes and are hints only. Before deleting, `grep -rn "<name>" js tests index.html` must show no remaining live caller, including string lookups like `['addKillEffect']`. Dead code that only calls other dead code goes as one group, together with its dedicated tests. [review-added 2026-09-24]
- pnpm; ES modules; Prettier; no magic numbers. Run `npx prettier --write <touched files>` before each commit.
- **E2E locally uses a scratch config with its own port** [review-added 2026-09-24]: `webServer.command 'node_modules/.bin/five-server --port=5502 --open=false'`, `cwd` set to the worktree, `reuseExistingServer: false`, `use.baseURL 'http://localhost:5502'` and `channel: 'chrome'`. The bundled Chromium isn't installed on the laptop; CI uses it. Referred to below as `<e2e>`.
- Stage explicit paths; never `git commit -a`. Before removing any worktree, check no process has its cwd inside it.
- **Routes:**
  - Part 1 is a PR with a blind local review round.
  - Part 2 (docs and media) may go straight to `main` under Edward's prose rule, **but only after he has approved the README text and the media**. [review-added 2026-09-24]

## Decisions

Edward already decided three of these in the review:
- **README demo:** a GIF **and** a clip with sound.
- **Licence:** add an MIT `LICENSE`.
- **Drone:** delete it, or keep it unchanged. Activating it would be a separate change.

Ask him the rest when execution reaches them:
1. **Drone** (Task 3). **Delete** (recommended: it has never played; `startDrone()` runs before the AudioContext exists) **or keep unchanged.**
2. **Pre-commit hook** (Task 4). `.githooks/pre-commit` lints but always exits 0 (`|| true`), and CI lints anyway. **Delete** it, the `prepare` script and the local `core.hooksPath` (recommended), **or** make it a real gate that lints the *staged* files and exits non-zero.
3. **Remote branches and their 9 open PRs** (Task 11).
   - The PRs are #19 `unstable`, #21, #22, and #51–55 (`codex/*`, August 2025), plus #58 (Claude GitHub Actions, March 2026).
   - None of the 16 non-`main` branches is merged into `main`.
   - Deleting a head branch closes its PR, and some branches (`lastworking`, `stable`, `restore/working-from-tag`) look like restore points.
   - Edward chooses **per branch**: keep, or close the PR and delete.
4. **Repo metadata** (Task 11):
   - homepage `https://edwardfalk.github.io/vibe/`;
   - description (proposed): "Browser space shooter where every enemy is an instrument — the soundtrack is the fight";
   - topics: `game`, `p5js`, `web-audio`, `rhythm-game`, `javascript`.
   - He approves the exact wording.
5. **The README's "How this was built" wording** (Task 8). Honest and specific: AI-assisted from the start, with his direction, play-testing and review gates.
6. **`docs/superpowers/plans/`.** Keep it as the record of how the project is built (recommended), or move it out.

---

# Part 1: Clean-up PR

**Start** [review-added 2026-09-24]:

```bash
git -C /home/edward/projects/vibe fetch origin
git -C /home/edward/projects/vibe worktree add .worktrees/cleanup -b cleanup origin/main
pnpm -C /home/edward/projects/vibe/.worktrees/cleanup install --frozen-lockfile
# Prerequisite: play-test-fixes is merged
git -C /home/edward/projects/vibe/.worktrees/cleanup log --oneline origin/main | grep -q "play-test-fixes" || echo "STOP: play-test-fixes not merged"
```

**Resuming:** if `.worktrees/cleanup` exists, work there, and continue from the first task (or Task 3 row) whose commit isn't in `git log origin/main..HEAD`.

### Task 0: Baseline before anything changes

- [ ] **Step 1: Make the playtest measure something.** Upgrade `tests/playtest.js`: the bot aims at the nearest enemy and fires, instead of moving in random patterns. The random bot scored 20 points in 30 s, which measured nothing. [review-added 2026-09-24]
  - Every 50 ms: find the nearest live enemy, `cameraSystem.worldToScreen()` it, and move the mouse there, scaled by the canvas's bounding box (it's CSS-scaled).
  - Keep the mouse held.
  - Keep the existing movement patterns for dodging.
  - Log the time of each level-up and each enemy type's first appearance, next to the existing FPS summary.
- [ ] **Step 2: Record the baseline** on the untouched HEAD:
  - run `pnpm run playtest` 3 times;
  - run `LEVEL=1 pnpm run screenshot:level` and `LEVEL=3 pnpm run screenshot:level` (with `<e2e>`'s port settings);
  - copy the results and screenshots to the session scratchpad;
  - record the HEAD SHA.

  The timings are **smoke-test guidance**, not proof of unchanged behaviour: the runs are random.
- [ ] **Step 3:** Commit the playtest upgrade: `test: playtest bot aims at enemies so pacing numbers mean something`.

### Task 1: Lint rules that stop junk coming back

**Files:** `eslint.config.js`

- [ ] **Step 1: Add the rules** [review-added 2026-09-24]:
  - `'no-unused-vars': 'error'` in the existing rules object;
  - `no-console` in a **separate config object** scoped to game code (the scripts in `tests/` report through `console.log` on purpose);
  - `'.worktrees/**'` in `ignores`.

```js
  {
    files: ['js/**/*.js'],
    rules: { 'no-console': ['error', { allow: ['warn', 'error'] }] },
  },
```

Expect about 45 unused-var and 132 console findings (`npx eslint .`, read the summary). Tasks 2 and 3 bring these to zero. Don't commit yet.

### Task 2: Remove debug logging

The audit found 132 `console.log` calls in `js/`, about 96 unguarded. They fire on every spawn, hit, enemy bullet and speech line, and include `[DEBUG]` lines in `GameState.js`.

- [ ] **Step 1:** Delete every `console.log` in `js/`.
  - Where a log is the only thing inside an `if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS …)` or `PERF_DIAGNOSTICS` block, delete the whole block.
  - Keep `PerformanceDiagnostics.js`'s report behind its `PERF_DIAGNOSTICS` flag, with `// eslint-disable-next-line no-console -- opt-in: CONFIG.GAME_SETTINGS.PERF_DIAGNOSTICS`. Add a one-line comment on the flag in `config.js`, since it isn't documented anywhere else.
- [ ] **Step 2:** Delete the `if (CONFIG.DEBUG)` blocks in `StabberAttackHandler.js`. `CONFIG.DEBUG` doesn't exist.
- [ ] **Step 3:** `npx eslint js --rule '{"no-unused-vars":"off"}'` shows no console errors. `pnpm run test:unit` passes. Remove a `console.log` spy in a unit test only if that test no longer needs it.
- [ ] **Step 4:** Commit `chore: remove debug logging; no-console keeps it out of game code`.

### Task 3: Remove dead code

Work one row at a time, and commit each row: `chore: remove <what> (unreachable)`.
- After each row, run `pnpm run test:unit`.
- After the rows marked **(browser)**, also run `<e2e> --project=e2e`.
- A failing **retained** behaviour test means something was still live: `git revert` that row and note it.
- A test that only exercised the deleted code goes with it.

| Group | Symbols (find by name) |
|---|---|
| EnemyFactory unused API | `levelIntroduction`, `availableTypes`, `getAvailableTypesForLevel`, `getColor`, `createRandomEnemyForLevel`, `createEnemies`, `getConfig`, `getAllTypes`, `getTypeInfo`, `getAllTypeInfo`, `isValidType`, `getLevelProgression`, `isTypeAvailableAtLevel`, `createEnemyAtEdge`, `createRandomEnemyAtEdge`, `getDebugInfo`. **Keep** the class's closing brace and `export { EnemyFactory };` |
| Test-only key flags **(browser)** | `window.keys` (declared in `GameLoop.js`, checked in `player.js`) and `Player.handleInput`. **Keep** the class's closing brace |
| Unused BeatClock helpers | `canPlayerShoot`, `canPlayerShootQuarterBeat`, `getTimeToNextQuarterBeat`, `getBeatInfo`, and the unit tests that only test them. **Keep** `isOnEighthNote` and `getTimeToNextEighthNote` (player fire) |
| Unused methods and exports | `CollisionSystem.handleStabberAttack` + `PlayerContactHandlers.handleStabberAttackCollision` (`'stabber-legacy'`); `SpawnSystem.forceSpawn`; `Bullet.destroy`; `CameraSystem.isVisible`/`getBounds`; `GameContext.fromWindow`; `FloatingTextManager.addScorePopup`; `ExplosionManager.addBombDebrisField`; `VisualEffectsManager.drawEnhancedBackground`; `Audio.updateSpeechBubbles`/`drawSpeechBubbles`; `VoiceSelection.selectBasicVoice`. Un-export `checkStabHit`, `computeMediumStarVisual` and `initEnhancedCaches` if only their own file uses them. `ExplosionManager.addKillEffect` only if `grep -rn "addKillEffect\|'addKillEffect'\|\[\"addKillEffect\"\]" js tests` shows the definition alone |
| Unused config keys | `GOOGLE_CLOUD_TTS_API_KEY` (reads `process.env` in a browser), whatever is left of `TTS_SETTINGS`, `GAME_SETTINGS.DEBUG_MODE`, `SPEECH_FREQUENCY`, `STABBER.CHANT_MIN`/`CHANT_MAX`, and the "Set your API keys here" header |
| Dead globals and stray comments | `window.speechManager`; the comment "Add at the top, after global system references" in `GameLoop.js` |
| Effects barrel **(browser)** | `js/effects/index.js`: change its 2 importers to import directly, then delete it |
| Drone (Decision 1 = delete) **(browser)** | `Audio.startDrone`, `stopDrone`, `duckDrone`, `_droneFilterSweep`, the drone fields, the `startDrone()` call in `GameLoopSetup.js`, the guarded `duckDrone` call in `Tank.js`, and `tests/unit/AmbientDrone.test.js` |
| p5.sound **(browser)** | the `p5.sound.min.js` `<script>` (with its integrity attribute) in `index.html`, and the `getAudioContext` block in `startFromTitle` (`GameLoop.js`). Proof: `grep -rn "getAudioContext\|p5.sound\|loadSound" js index.html` |
| Remaining unused imports and variables | whatever `no-unused-vars` still reports, including 3 in `tests/unit/` (`AmbientDrone.test.js` is gone by now; `BeatClockTolerance.test.js`) |

- [ ] **Step 1:** Work down the table as above.
- [ ] **Step 2:** `pnpm run lint` passes. Commit `eslint.config.js` after running Prettier on it.
- [ ] **Step 3:** Run `<e2e> --project=e2e` in full. If it fails and the failing row isn't obvious: `git bisect start HEAD <commit before Task 3>` then `git bisect run <the same e2e command>`, and revert the row it names.

### Task 4: One Playwright config, one boot helper

The audit found:
- **Near-duplicate configs.** `playwright.{screenshot,playtest,beat-assertions}.config.js` differ from the main config in `testMatch`/`testIgnore`, timeout, reporter, `retries` (0 vs 1) and failure artifacts.
- **Four copies of `bootGame`.**
- **Old level thresholds.** `screenshot.js` and `beat-assertions.js` hardcode 150×n.
- **Leftover probe.** `js/testing/ai-liveness-probe.js` is used by one test and refers to a removed MCP harness.
- **Misplaced tasks file.** `tasks.json` is a VS Code file at the repo root, so it's inert, and it runs `bun`.

- [ ] **Step 1: Shared helpers.** Move `bootGame` **verbatim** from `tests/gameplay-probe.test.js` into `tests/helpers/boot.js` and export it. Add:

```js
// Jump to a level the way the ?tune panel does (a practice run: no high score)
export async function jumpToLevel(page, level) {
  await page.evaluate((target) => {
    const gs = window.gameState;
    if (!('practiceRun' in gs)) {
      throw new Error('practiceRun missing: is play-test-fixes merged?');
    }
    gs.practiceRun = true;
    for (let guard = 0; gs.level < target; guard++) {
      const before = gs.level;
      gs.addScore(gs.nextLevelThreshold - gs.score);
      if (gs.level === before || guard > 50) {
        throw new Error(`level stuck at ${gs.level} (state ${gs.gameState})`);
      }
    }
  }, level);
}
```

- [ ] **Step 2: Use them.**
  - Each file imports only the helpers it uses.
  - `screenshot.js` and `beat-assertions.js` use `jumpToLevel` instead of their threshold loops, and keep their post-jump readiness waits.
  - Delete the "Liveness probe passes" test ("Game loop advances with live entities" covers it), then delete `js/testing/` and its `vitest.config.js` coverage exclude.

- [ ] **Step 3: Projects.** In `playwright.config.js`:
  1. Remove the top-level `testMatch`/`testIgnore`.
  2. Set `reporter: 'list'` once.
  3. Add:

```js
  projects: [
    { name: 'e2e', testMatch: '*.test.js', testIgnore: ['**/unit/**', '**/helpers/**'] },
    { name: 'screenshot', testMatch: 'screenshot.js', retries: 0 },
    { name: 'playtest', testMatch: 'playtest.js', timeout: 120000, retries: 0 },
    { name: 'beats', testMatch: 'beat-assertions.js', retries: 0 },
  ],
```

  4. Verify each project selects its files: `pnpm exec playwright test --list --project=<each>`. Expect 19+ / 1 / 1 / 1 tests.

- [ ] **Step 4: Every script names a project** [review-added 2026-09-24]. In `package.json`:

```json
"test": "pnpm run test:e2e && pnpm run test:unit",
"test:e2e": "playwright test --project=e2e",
"test:e2e:headed": "playwright test --project=e2e --headed",
"test:e2e:debug": "playwright test --project=e2e --debug",
"screenshot": "playwright test --project=screenshot",
"screenshot:level": "LEVEL=${LEVEL:-3} playwright test --project=screenshot",
"playtest": "playwright test --project=playtest",
"test:beats": "playwright test --project=beats",
```

  Also delete `"main"`, and set `description` to the Decision 4 wording. Leave the other scripts as they are.
  Verify: `grep -n "playwright" package.json .github/workflows/*.yml` shows no bare `playwright test` and no `--config=`.

- [ ] **Step 5:** Delete the three extra configs and `tasks.json`.
  - **Decision 2 = delete:** remove `.githooks/` and the `prepare` script, then run `git -C /home/edward/projects/vibe config --unset core.hooksPath` (check the current value first).
  - **Decision 2 = keep:** make the hook lint the staged files (`git diff --cached --name-only --diff-filter=ACM -- '*.js'`) and `exit 1` on failure, with no `|| true`.
- [ ] **Step 6:** Run `pnpm run lint && pnpm run test:unit && <e2e> --project=e2e`, and `test:beats` once. Commit `chore: one Playwright config with projects, shared boot helper`.

### Task 5: Stale comments

- [ ] **Step 1:** Rewrite or delete the changelog-style comments:
  - "REDUCED from … Further reduced", "Was this.createDistortionCurve" in `Audio.js`;
  - "NEW:" in `BeatClock.js`, and "NEW:"/"FIXED:" in `player.js`;
  - `GameLoop.js`'s header, which says the player is a hi-hat "every beat". It's held fire on eighth notes.

  Replace the 50-line `Audio.js` header (a stale copy of the audio guide) with the **actual** graph. Verify it against the merged wiring first:

  ```
  effects → masterGain (mute) → duckGain → masterLimiter → out
  beat track → track masterGain (mute) → beatDuckGain → masterLimiter
  speech → speechSynthesis (outside Web Audio; syncDuck dips the two duck gains)
  ```

- [ ] **Step 2:** Tests and lint green. Commit `chore: comments say what the code does, not its history`.

### Task 6: Review, PR, and live check

- [ ] **Step 1: Blind local review.** Run `pr-review-toolkit:code-reviewer` and `pr-review-toolkit:silent-failure-hunter` in parallel on `git diff origin/main..HEAD`. The key question: *did any deletion change behaviour?* Verify findings, fix, commit.
- [ ] **Step 2: Compare with the Task 0 baseline.**
  - Run the playtest 3 times; the ranges should overlap the baseline's.
  - Take screenshots at levels 1 and 3, and compare.
  - The browser should log no errors: capture `console` errors **and** `pageerror`.
- [ ] **Step 3:** Push and open the PR. The body lists what was removed, with each proof command.
  - After review-fix commits, post `@codex review`. Silence isn't a pass.
  - Merge after CI, Codex, and Edward's OK.
- [ ] **Step 4: The live site** [review-added 2026-09-24].
  1. Poll `gh api repos/edwardfalk/vibe/pages/builds/latest --jq '{status,commit}'` until `commit` is the merge SHA and `status` is `built` (`errored` means the site is stale).
  2. Play 30 s at https://edwardfalk.github.io/vibe/ in desktop Chrome and Firefox with sound on. Kick, grunt shots and speech should all be there.
  3. If anything is broken: `git revert -m 1 <merge sha> && git push origin main`, then investigate on a branch.

---

# Part 2: Documentation

**Start:** `git fetch origin`, then `worktree add .worktrees/docs -b docs origin/main` and `pnpm install`. Check the Part 1 merge is in `origin/main`. Resuming works as in Part 1.

### Task 7: Delete docs that are wrong or were written for agents

- [ ] **Step 1: Keep the one useful checklist.** Append `docs/NO_REGRESSION_CHECKLIST.md`'s manual checklist (lines 158-169, "Mandatory Checks Per Refactor Wave") verbatim to `docs/TESTING.md` under `## Manual checklist`. In **the same commit**, `git rm`:
  - `docs/NO_REGRESSION_CHECKLIST.md` (a work log);
  - `docs/REMAINING_ROADMAP.md`: addressed "to the next stateless AI agent", and names files that no longer exist;
  - `docs/for-the-user/`: the audio guide's values and paths are wrong, and `?tune` replaces it.
- [ ] **Step 2:** The one useful thing in the roadmap is the list of debts. It moves to ARCHITECTURE.md's "Known debt" (Task 9).

### Task 8: README, media and licence

- [ ] **Step 1: LICENSE (decided).** Add a standard MIT `LICENSE` file: "Copyright (c) 2025–2026 Edward Falk".
- [ ] **Step 2: Media** (keep files uncommitted until Edward approves them; re-record over the same files). Size budget: GIF ≤ 8 MB, clip ≤ 10 MB.
  - **GIF (silent), the instant visual at the top.**
    - Record the Task 0 aim-bot playtest with `use: { video: 'on' }` in a scratch config at 1280×720.
    - Trim 15–20 s where enemies, a new-enemy preview and explosions show.
    - Convert: `ffmpeg -i in.webm -vf "fps=15,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" docs/media/demo.gif`.
  - **Clip with sound (decided), 20–30 s.**
    - Headless recording has no audio, so record a real Chrome window, with the game played by the aim-bot or by Edward.
    - Use screen plus system audio: `ffmpeg -f x11grab -framerate 30 -video_size 1280x720 -i :0.0+<x>,<y> -f pulse -i <default sink>.monitor -c:v libx264 -crf 28 -c:a aac -t 30 docs/media/demo-sound.mp4`. Find the monitor with `pactl get-default-sink`.
    - The file goes in the README by uploading it to GitHub, which gives a playable `user-attachments` URL. **Edward uploads it or approves the upload.**
  - Also add a still `docs/media/title.png`.
- [ ] **Step 3: README.md**, with every claim matching the code:
  1. **Title and pitch.** "Vibe: a space shooter where every enemy is an instrument."
  2. **Play it.** https://edwardfalk.github.io/vibe/ (desktop; keyboard, or keyboard and mouse; sound on). Then the GIF, and "Watch with sound" with the clip.
  3. **Controls,** exactly as on the title screen: WASD; mouse or arrows to aim; click, Space or Shift to fire; E dash; P pause; M mute.
  4. **How the music works** [review-added 2026-09-24]:
     - The beat table:
       - player: held fire on eighth notes (hi-hat; a burst's first shot is instant);
       - grunt: 2 & 4 (snare);
       - tank: 1;
       - stabber: 3.5 (off-beat);
       - rusher: 1 & 3 (crash).
     - One short line per enemy on its character: how it moves, and that it talks (voice lines through speech synthesis).
     - The timekeeper: a steady kick plus a sub-bass pulse, and why it's there.
     - `BeatClock` runs on `AudioContext.currentTime`, and the kick is scheduled ahead on that same grid.
     - Enemy types join with the levels, with a preview of each new one.
     - Keep it short, with file links.
  5. **Tuning.** `?tune` and what it controls; values live in `js/config.js`.
  6. **Tech.**
     - p5.js (instance mode), Web Audio, Speech Synthesis;
     - no build step, served as static files on GitHub Pages;
     - Vitest and Playwright; GitHub Actions CI.
  7. **Run it locally.** `pnpm install`, `pnpm run dev`, and the test commands.
  8. **How this was built.** Decision 5.
  9. **Licence.** MIT (link to `LICENSE`).
- [ ] **Step 4: Show Edward the rendered README and both media files.** Get his OK, then commit and record that commit's SHA as "approved".

### Task 9: ARCHITECTURE.md as a real map

- [ ] **Step 1:** Sections:
  - **Entry and game loop:** the state machine, title → playing ⇄ paused → gameOver → playing.
  - **Folders:** one line per folder saying what it owns, naming only the entry points a newcomer needs (`GameLoop.js`, `config.js`, `GameContext.js`, `BeatClock.js`, `BeatTrack.js`, `Audio.js`, `TunePanel.js`).
  - **Shared state:** window globals mirrored into GameContext. Say plainly that `ContextAccessor` returns `context.get(key)` whenever a context exists, with no fallback to `window`.
  - **Beat system:** BeatClock is the only grid; windows open when the beat lands.
  - **Audio graph:** as in Task 5.
  - **Damage flow.**
  - **Dev tools:** `?tune`, playtest, screenshot, beats.
  - **Known debt:**
    - the `window.*`/GameContext mirroring;
    - `GameState` reaching into globals;
    - setup monkey-patching `audio.initialize`;
    - the `DamageResult` normaliser shim;
    - long files;
    - the tank "CHARGING!" line that never plays.
  - **Conventions:** keep the useful rules from the old "Migration Rules", such as preferring domain folders and no new `window.*` where context injection works. Drop the history and the "forbidden legacy files" list.

### Task 10: DESIGN.md, TESTING.md, CLAUDE.md match the code

- [ ] **DESIGN.md:**
  - beat roles, as in the README table;
  - player fire: instant first shot, then held fire (mouse, Space or Shift) snaps to eighth notes via `queueShot()`;
  - level progression (`CONFIG.PACING`, previews);
  - the mix (`CONFIG.MIX`, speech on top, separate duck amounts for effects and beat);
  - delete the `.cursorrules` link and the tempo-change claim.
- [ ] **TESTING.md:**
  - every suite and its command, and how to run E2E locally with system Chrome on a separate port;
  - how to **list** tests, not a copied list: `pnpm exec playwright test --list --project=e2e` and `ls tests/unit`;
  - the manual checklist from Task 7.
- [ ] **CLAUDE.md:**
  - replace the whole Architecture section with "See ARCHITECTURE.md" [review-added 2026-09-24];
  - keep Commands, adding playtest, screenshot, beats and the local-E2E note;
  - keep Level Progression, Code Style and Worktrees.
- [ ] **Verify links and paths** (README, ARCHITECTURE.md, CLAUDE.md, `docs/*.md`, **not** `docs/superpowers/`, which is archive). For each maintained doc:
  1. Collect relative Markdown link targets (`grep -oE "\]\(([^)#]+)\)"`) and backticked `js/`, `tests/` and `docs/` paths.
  2. Resolve each relative to the doc's own folder.
  3. `ls` each one.

  Any miss is a finding.

### Task 11: Publish

- [ ] **Step 1: Push the docs.** First check that `git diff <approved sha> -- README.md` is empty. If it isn't, show Edward the diff and re-confirm. Then push straight to `main` (prose route), or open a PR if Edward prefers.
- [ ] **Step 2: Repo metadata (Decision 4).**
  1. Record the current values: `gh repo view edwardfalk/vibe --json description,homepageUrl,repositoryTopics`.
  2. Apply: `gh repo edit edwardfalk/vibe --homepage https://edwardfalk.github.io/vibe/ --description "<approved>" --add-topic game --add-topic p5js --add-topic web-audio --add-topic rhythm-game --add-topic javascript`.
- [ ] **Step 3: Branches (Decision 3).** Before anything is deleted:
  - List every remote branch with its tip SHA, last commit date, whether it's merged (`git merge-base --is-ancestor`), and its open PR (`gh pr list --state open --json number,headRefName`).
  - Save that list in a GitHub issue (or the docs commit message).
  - For each branch Edward says to delete: close its PR with a comment, then `git push origin --force-with-lease=<branch>:<recorded sha> --delete <branch>`.
  - Restore command, if ever needed: `git push origin <sha>:refs/heads/<branch>`.
- [ ] **Step 4: Check it's live.**
  - Poll the Pages build as in Task 6 until it is `built` for the pushed SHA.
  - Check the README renders on GitHub: GIF plays, clip plays with sound, links work.
