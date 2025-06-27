# Modular Migration & Fix Roadmap

**[2025-06-27] STATUS: MIGRATION COMPLETE**

All modular migration steps, import map fixes, and Playwright/browser probes now pass. No missing module, duplicate declaration, or fatal runtime errors remain. The game and all systems load and run in the browser, with all core mechanics and liveness checks passing. Remaining actionable info will be moved to permanent documentation.

---

## 0. Automated Playwright Browser Console Log Capture (**COMPLETE**)
- All Playwright test runs now robustly capture browser console errors/warnings to `test-results/playwright-browser-console-errors.log` (overwritten each run). Full logs available with `VERBOSE_CONSOLE_LOGS=1`.
- [2025-06-27] **Patch applied:**
  - Playwright probe attaches all event listeners before navigation, checks DOM for error messages, logs page HTML if an error is detected, and always writes a log file (even if empty).
  - This guarantees robust and reliable browser console logging for all test runs, and ensures that missing module errors or code errors are always captured.

---

## 1. Fix Static Serving/Import Map for Probes (**COMPLETE**)
- Import map and static serving for all probe files is now correct. Playwright and browser can import probes from `@vibe/tooling/src/probes/`.

---

## 2. Debug Game Initialization/Module Import Failures (**COMPLETE**)

### **Recent Findings and Actions:**
- All missing module specifiers in the browser have been resolved via the import map in `test-minimal.html`.
- The Playwright minimal import probe, liveness probe, and gameplay probe all pass with no missing module or duplicate declaration errors.
- The original fatal error (`soundName` duplicate declaration) has not reappeared.

### **Current Iterative Import Map Fix Workflow:**
- [x] Minimal import of `@vibe/game` in `test-minimal.html` succeeds ("Module imported!" appears, no syntax error in logs).
- [x] Playwright tests can start and see the canvas.
- [x] Game loads and runs in the browser.
- [x] No missing module or duplicate declaration errors in browser console/logs.

---

## 3. Continue with Remaining Roadmap Steps (**COMPLETE**)
- All import map issues are fixed and the minimal import test passes. Migration and repair workflow is complete.
- Any new findings or blockers will be documented in permanent docs.

---

**Current Status:**
- All modular migration, import map, and probe test steps are complete as of 2025-06-27.
- Next: Move actionable info to permanent docs, archive this roadmap, and proceed to new feature work as needed.

---

## 2A. Diagnose and Fix Fatal Duplicate Declaration Error (`soundName`) (**NOT NEEDED, NO LONGER OCCURS**)

### Problem:
- If, after all import map issues are resolved, the original fatal error (`soundName` duplicate declaration) reappears, follow the steps below.
- (No longer needed; error has not reappeared.)

---

## 2B. Resume Modular Migration After Fix (**COMPLETE**)
- Migration and repair workflow is complete. Proceed to new feature work as needed.

---

## [2025-06-27] Milestone: Import Map & Probe Tests Fully Passing (**ACHIEVED**)
- All missing module specifiers have been resolved in the import map (`test-minimal.html`).
- Minimal import probe, liveness probe, and game mechanics probe all pass in Playwright.
- No more 404s, missing modules, or duplicate declaration errors.
- The game and all systems load and run in the browser, with all core mechanics and liveness checks passing.
- Next: Review for any remaining migration/cleanup tasks, update docs, and proceed to new feature work as needed.

---

