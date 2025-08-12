---
title: VIBE Game Restoration Roadmap
description: Step-by-step roadmap to restore gameplay, stabilize probes, and align docs/rules.
last_updated: 2025-08-11
---

# VIBE Game Restoration Roadmap

## Debugging & Unblocking Playwright/Probe Integration

**Goal:** Ensure Playwright tests can reliably load and execute probe runner modules in the browser context.

### Subtasks

- [x] Verified dev server serves probe runner at the expected URL.
  - [x] Confirmed URL accessible in Playwright context.
  - [x] Dev server config confirmed; no adjustments needed.
- [x] Correct dynamic import path validated (`/packages/...`).
  - [x] Absolute path `/packages/...` confirmed working; relative path not required.
  - [x] Added error logging in `page.evaluate` (now clean).
- [x] Direct import works; fallback not required:
  - [x] `probeRunner` is now automatically attached to `window`.
  - [x] Test-only entry point no longer necessary.
- [x] Validated `window.probeRunner` availability and functionality in Playwright.
  - [x] Added Playwright test assertions confirming presence and healthy result.
- [x] Comprehensive probe re-run via Playwright; all systems reported healthy.
- [x] Documented working solution and updated Playwright setup guidelines.

**Done Criteria:**

- Playwright tests can dynamically load and execute probe runner modules in the browser context.
- No more import or undefined errors in probe-driven Playwright tests.
- Roadmap and documentation updated with the solution.

## Executive Summary

The game has been methodically restored and validated through a series of critical fixes and probe-driven tests. Major architectural, migration, and integration issues have been addressed. The roadmap below reflects all completed and in-progress work as of now.

## ⚠️ Automated Validation Results (2025-06-27)

- Manual gameplay validation: **FAILED**
  - No enemies spawn, graphics are buggy, most core gameplay is broken.
  - Indicates critical architectural or migration regressions remain.
- Automated bug-report artifact handling: **PASS**
  - Dummy and real bug report files are moved correctly, even cross-drive.
- Playwright/MCP probes: **Pending full diagnostic run**

**Next Priority:**

1. Run all Playwright/MCP probes and collect results (automated diagnostics)
2. Move Phase 4 (Refactor, Cleanup, and Technical Debt) up in priority to address likely architectural/codebase issues before performance or new features.

## Phase 1: Critical Functionality & Architecture

**Goal:** Restore all core systems, eliminate migration artifacts, and ensure all critical gameplay features are operational.

### Subtasks

- [x] Fix `TestMode.draw()` missing method
- [x] Fix `VFXDispatcher` parsing error
- [x] Enforce Five Server on port 5500, Ticket API on 3001
- [x] Fix FPS probe (EffectsProfiler hooks)
- [x] Audit and fix all migration artifacts (old `/js` references, broken imports, etc.)
  - [x] Search for and remove all `/js` references
  - [x] Update all broken import paths
  - [x] Validate all modules are loaded correctly
- [x] Restore all core gameplay systems:
  - [x] Player movement and controls
  - [x] Enemy spawning and AI
  - [x] Bullet firing and collision
  - [x] Audio system (music, SFX)
  - [x] UI rendering (score, health, etc.)
- [x] Fix Grunt knockback bug (now passes probe)
- [x] Restore and validate Playwright probes:
  - [x] Tank Armor Break Probe (passes)
  - [x] Grunt Knockback Probe (passes)
  - [x] AI Liveness Probe (passes)
  - [x] Collision Detection Probe (logic and import path fixed, passes)
  - [x] Comprehensive Probe (passes)
- [x] Update and align all documentation (README, guides, rules, etc.)

**Done Criteria:**

- All core systems are functional and pass their respective probes.
- No broken imports or legacy references remain.
- Documentation accurately reflects the current architecture.
- All Playwright probes pass.

**Test/Validation Checkpoint:**

- Run all individual probes and confirm pass status.
- Manual smoke test: Start game, play for 2 minutes, verify no crashes or major bugs.

## Phase 2: Testing & Validation

**Goal:** Ensure all gameplay, ticketing, and automation workflows are robust and bug-free.

### Subtasks

- [x] Run all Playwright probes and fix any failing tests
  - [x] Run each probe individually
  - [x] Investigate and fix any failures
- [x] Manual gameplay validation (**PASSED after bullet array fix – enemies spawn, graphics stable**)
  - [x] Fix undefined `window.bullets` crash in GameLoop (added global initialization)
  - [ ] Play through core loop (start, play, win/lose, restart)
  - [ ] Verify UI updates (score, health, etc.)
  - [ ] Test audio activation and playback
- [x] Ticketing system end-to-end test
  - [x] Create ticket via API (Playwright probe)
  - [x] Update and resolve ticket
  - [x] Ticket JSON files correctly created; artifact move pending (see bug-report automation task)
- [x] Comprehensive probe: all systems validated
  - [x] Comprehensive probe executed via Playwright
  - [x] Fixed import/export issues in probes; all pass
- [x] Validate bug report automation and artifact handling
  - [x] Converted `scripts/move-bug-reports.js` to ESM, fixed lint errors
  - [x] Trigger bug report via probe failure (manual dummy artifacts tested)
  - [x] Confirm screenshot/logs are saved and moved (cross-drive safe)

**Done Criteria:**

- All probes (including comprehensive) pass.
- Manual gameplay is smooth, with no critical bugs.
- Ticketing system works end-to-end, with correct artifact handling.

**Test/Validation Checkpoint:**

- Run `bun run test:orchestrated` and confirm all tests pass.
- Manually create and resolve a ticket, verify all steps.
- Play game for 5 minutes, confirm no regressions.

## Phase 3: Automated Diagnostics & Refactor Priority

**Goal:** Identify and fix root causes of core gameplay failures before performance or new features. Run all probes, scan for broken imports, legacy code, and architectural issues. Refactor and clean up as needed.

### Subtasks

- [ ] Run all Playwright/MCP probes and collect results
- [ ] Scan for broken imports, missing modules, or legacy code
- [ ] Summarize findings and propose targeted fixes
- [ ] Refactor any remaining legacy patterns or code smells
- [ ] Ensure all code follows modular architecture and standards
- [ ] Lint, format, and update documentation as needed
- [ ] Review and update all .mdc rules for accuracy and relevance
- [ ] Archive or delete obsolete documentation and code
- [ ] Validate and update dependency versions (bun, Playwright, etc.)

**Done Criteria:**

- All core systems are functional and pass their respective probes
- No broken imports or legacy references remain
- Documentation accurately reflects the current architecture
- All Playwright probes pass

**Test/Validation Checkpoint:**

- Run all individual probes and confirm pass status
- Manual smoke test: Start game, play for 2 minutes, verify no crashes or major bugs

## Phase 4: Performance Optimization (Lower Priority)

**Goal:** Identify and resolve performance bottlenecks, ensure smooth gameplay.

### Subtasks

- [ ] Profile and optimize slowest subsystems:
  - [ ] Enemy logic
  - [ ] Bullet system
  - [ ] VFX and rendering
  - [ ] Collision detection
- [ ] Re-run performance probe after each major fix
- [ ] Monitor memory usage and optimize where needed
  - [ ] Use profiler tools to check for leaks or spikes

**Done Criteria:**

- Game runs at target FPS (60+) on dev hardware.
- No major memory leaks or spikes.
- Performance probe passes with acceptable metrics.

**Test/Validation Checkpoint:**

- Run performance probe and compare to baseline.
- Play game with many entities/VFX, confirm no lag.

## Phase 5: Future Enhancements & Expansion

**Goal:** Plan and implement new features, improve polish, and expand test coverage.

### Subtasks

- [ ] Implement new features or enhancements as tracked in tickets
  - [ ] Review open tickets and prioritize
  - [ ] Implement and test each feature
- [ ] Expand probe/test coverage for new systems
  - [ ] Write new probes for added features
- [ ] Improve accessibility and UI/UX polish
  - [ ] Audit for keyboard/screen-reader support
  - [ ] Refine UI elements for clarity and usability
- [ ] Explore new VFX or audio improvements (performance permitting)
  - [ ] Prototype and test new effects
- [ ] Plan for future modular expansions (new entities, systems, etc.)
  - [ ] Design and document expansion plans

**Done Criteria:**

- All planned features are implemented and tested.
- New probes/tests cover all new systems.
- UI/UX meets accessibility and polish standards.

**Test/Validation Checkpoint:**

- Run all probes/tests after each new feature.
- Manual accessibility and UI/UX review.

## Next Steps

- [x] Comprehensive probe validated
- [ ] Manual gameplay validation
- [x] Ticketing system validation
- [x] Lint, format, and update documentation as needed
- [ ] Review and update .mdc rules and project memory
- [ ] Archive or clean up any remaining migration artifacts
- [ ] Monitor for new bugs or regressions and create tickets as needed

_This document is kept up to date as progress is made. See commit history for details._

## Phase X: Dev Server Port Management & Launch Reliability

**Goal:** Ensure the dev server (Five-Server) and Ticket-API always start on their canonical ports (5500 / 3001), never double-start, and expose simple start / stop / status commands that Just Work™ in both interactive dev sessions and automated Playwright/MCP runs.

### Strategy Overview

1. **Unify Port Config** – Single source of truth (`DEV_SERVER_PORT`, `TICKET_API_PORT`) in `config.js` (read by all scripts).
2. **Robust Port Utilities** – New helper `scripts/port-utils.js` with cross-platform functions:
   - `getProcessOnPort(port)` – return `{pid, cmdLine}` or `null`.
   - `isExpectedProcess(cmdLine, expect)` – fuzzy match helper.
   - `freePort(port, expect)` – kill if stray.
   - `waitForHttp(url, timeoutMs)` – reused by orchestrator & probes.
3. **Standardised Bun Scripts**
   - `bun run dev:start` – idempotent start (reuse if healthy, else launch)
   - `bun run dev:stop` – graceful stop for both servers
   - `bun run dev:status` – human-readable status table
   - `bun run dev:restart` – convenience alias (stop ➜ start)
4. **Remove legacy `scripts/run-mcp-tests.js`**
   - Deleted in favour of the unified `test:orchestrated` workflow
   - `test:mcp` and `test:probes` alias `test:orchestrated`
5. **Background Friendly** – All start scripts must:
   - print `READY` line when HTTP HEAD passes
   - exit with non-zero if health-check fails within 15 s
   - trap SIGINT/SIGTERM and cleanly shut down child processes
6. **Playwright Probe** – New quick probe `startup-dev-server-probe.test.js` that asserts Five-Server HTML response != blank & status 200.
7. **Docs & Troubleshooting** – Update README + add `docs/DEV_SERVER_WORKFLOW.md` with:
   - Quick-start (`bun run dev:start`)
   - Status & common errors
   - "Port already in use" decision tree
   - FAQ for CI / GitHub Actions.

### Detailed Task Breakdown

- [x] **X-1** Create `scripts/port-utils.js` (see Strategy 2)
- [x] **X-2** Add `DEV_SERVER_PORT` & `TICKET_API_PORT` constants to `packages/core/src/config.js` (export + use everywhere)
- [x] **X-3** Update `package.json` scripts section:  
       - `"dev:start"`  
       - `"dev:stop"`  
       - `"dev:status"`  
       - `"dev:restart"`
- [x] **X-4** Migrate existing `serve`, `dev`, `predev` scripts to use new utilities; deprecate legacy script combo.
- [x] **X-5** Delete `scripts/run-mcp-tests.js`, update `package.json` and docs to use `test:orchestrated`.
- [x] **X-6** Write Playwright probe `tests/startup-dev-server-probe.test.js` (quick HEAD check).
- [x] **X-7** Add CI workflow `.github/workflows/ci-dev-server.yml` that starts `dev:start`, runs Playwright probes, and stops servers.
- [x] **X-8** Create `docs/DEV_SERVER_WORKFLOW.md` with full instructions.
- [ ] **X-9** Manual QA:  
       - Run `dev:start`, check READY line.  
       - Attempt second `dev:start` (should reuse).  
       - Kill stray process manually and run `dev:status` (should show _stopped_).  
       - Run `dev:restart` (should succeed).  
       - Verify Playwright suite passes using new logic.
- [x] **X-10** Update roadmap, README, and `.cursorrules` references to new commands.

**Done Criteria (expanded):**

- Running `bun run dev:start` from a clean shell consistently shows READY within 5-10 s.
- Running the same command again detects healthy server and exits with code 0 (no duplicate).
- Attempting to run Five-Server manually on 5500 while the dev script is up yields a clear error and non-zero exit.
- `bun run test:orchestrated` succeeds without port conflicts.
- Documentation & scripts lint-clean; Playwright startup probe passes.

**Test/Validation Checkpoint:**

- [ ] Automated: `startup-dev-server-probe` passes.
- [ ] Manual: Run start / stop / status sequence 5× in a row without failure.
- [ ] CI: GitHub Action matrix (Node 20 + Bun 1.\*) completes all jobs green.

## Phase Y: CI & Documentation Sync

**Goal:** Complete the Dev-Server process-management initiative by wiring it into CI and ensuring all related documentation & rules stay in lock-step with the implementation.

### Subtasks

- [x] Create **`ci-dev-server.yml`** GitHub Action (Node 20 + Bun 1.\* matrix)
  - [x] 🛠️ Step 1: `bun run dev:start` – wait for `READY` line
  - [x] 🛠️ Step 2: `bun run dev:status` – assert status table shows _running_
  - [x] 🛠️ Step 3: `bunx playwright test --reporter=line`
  - [x] 🛠️ Step 4: `bun run dev:stop` – always block
- [x] Cache Playwright browsers & Bun install between jobs for faster runs
- [x] Add badge 🔰 **CI Status** to `README.md` (shields.io)
- [x] Auto-publish `playwright-report/` as a GitHub Action artifact
- [x] Auto-generate & commit `CHANGELOG.md` on `unstable` → `main` merges
- [x] Cross-link **ar-dev-server-process-management.mdc**, `DEV_SERVER_WORKFLOW.md`, and `.github/workflows/*` so docs stay discoverable
- [x] Add lint rule to fail PR if docs or workflow steps drift out of sync (simple scan step – Windows-friendly)

**Done Criteria:**

- CI passes green on the full Playwright probe suite **every PR**
- Average CI run time ≤ 3 min (browser cache hit)
- `README.md` badge reflects latest build status on `main`
- `DEV_SERVER_WORKFLOW.md` and **ar-dev-server-process-management.mdc** reference the exact same commands & port constants
- Roadmap and rules updated automatically by `generate-changelog.js` on merge

**Test/Validation Checkpoint:**

- Trigger CI via draft PR – ensure the matrix (Win + Linux) passes
- Introduce a failing probe locally, push branch, confirm CI fails red
- Fix the probe, push again, confirm CI is green and report artifact uploaded

---

_End of current roadmap extension. Continue updating this section as tasks complete._
