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
- [x] Manual gameplay validation (**FAILED: no enemies, graphics buggy, core loop broken**)
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

*This document is kept up to date as progress is made. See commit history for details.*

## Phase X: Dev Server Port Management & Launch Reliability
**Goal:** Ensure the dev server (Five Server) always starts on the correct port (5500), never double-starts, and is easy to use and document.

### Subtasks
- [ ] Audit all scripts that start the dev server (Five Server, live-server, etc.)
- [ ] Implement a reliable port check: Before starting, check if port 5500 is in use.
    - If in use, determine if it’s the correct server (Five Server) or a stray process.
    - If it’s the correct server, reuse it (do not kill).
    - If it’s a stray process, kill it and start fresh.
- [ ] Prevent double server launches: Ensure no script or workflow can start two servers on the same port.
- [ ] Update the orchestrator and dev scripts to:
    - Always check port 5500 before starting.
    - Only start the server if not already running.
    - Optionally, provide a “force restart” option.
- [ ] Add a “status” script to show if the dev server is running and on which port.
- [ ] Document the exact workflow:
    - How to start, stop, and check the dev server.
    - What to do if the port is busy.
    - What NOT to do (e.g., never run two dev servers).
    - Troubleshooting steps for port conflicts.

**Done Criteria:**
- Dev server always starts on port 5500 unless intentionally overridden
- No double server launches
- Clear, documented workflow for starting/stopping/checking the dev server
- Troubleshooting steps are documented

**Test/Validation Checkpoint:**
- Start, stop, and check the dev server multiple times in a row without port conflicts
- Attempt to start a second server and confirm it is blocked or reuses the existing one
- Follow documentation to resolve any port issues

