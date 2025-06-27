# Modular Migration & Fix Roadmap

This document tracks the final steps to complete the Vibe modular migration and restore full functionality. Each section is split into actionable subtasks and includes clear tests to verify completion.

Keep careful track of all changes made and all updates to tests and improved logging so that we can convert this document into pure information in the correct places when done. 

---

## 0. Automated Playwright Browser Console Log Capture (**IMPROVED**)
- All Playwright test runs automatically capture browser console errors/warnings to `test-results/playwright-browser-console-errors.log` (overwritten each run). Full logs available with `VERBOSE_CONSOLE_LOGS=1`.
- [2025-06-26] **Patch applied:** Playwright setup now ensures the `test-results/` directory exists before writing logs, and adds error handling for log file writes. Any issues writing logs are now printed to the terminal. This guarantees robust and reliable browser console logging for all test runs.

---

## 1. Fix Static Serving/Import Map for Probes (**DONE**)
- Import map and static serving for all probe files is now correct. Playwright and browser can import probes from `@vibe/tooling/src/probes/`.

---

## 2. Debug Game Initialization/Module Import Failures (**IN PROGRESS**)

### **Recent Findings and Actions:**
- Fatal error: `Uncaught SyntaxError: Identifier 'soundName' has already been declared` in the browser prevents all module imports, even for a minimal import of `@vibe/game`.
- This error is present in `.debug/YYYY-MM-DD.log` and blocks all game and test startup.
- The error is not in the entry file, but in a dependency of `@vibe/game` (likely a duplicate variable declaration or import in the audio system).
- All code in `@vibe/game/index.js` was commented out except a single `console.log` to isolate the error. The error persists, confirming it is in a dependency.

### **Next Steps:**
1. Search the entire codebase for all `let`, `const`, or `var soundName` declarations.
2. Check for duplicate imports or re-exports of a module that defines `soundName`.
3. Fix the duplicate declaration so that `soundName` is only declared once per scope/module.
4. Re-run the minimal import test to confirm the syntax error is gone.
5. Once fixed, restore the real game code in `@vibe/game/index.js` and continue with the next roadmap steps.

**Tests to Prove It’s Fixed:**
- [ ] Minimal import of `@vibe/game` in `test-minimal.html` succeeds ("Module imported!" appears, no syntax error in logs).
- [ ] Playwright tests can start and see the canvas.
- [ ] Game loads and runs in the browser.

---

## 3. Continue with Remaining Roadmap Steps
- Once the fatal syntax error is fixed, resume the migration and repair workflow as planned.
- Document any new findings or blockers in this file for seamless handoff and future reference.

---

**Current Status:**
- Blocked by fatal duplicate variable declaration (`soundName`).
- Next chat should begin with a codebase-wide search and fix for this error, then re-test module imports.

---

*This document is up to date as of the last session. Continue from here for a smooth workflow.*
---

## 2A. Diagnose and Fix Fatal Duplicate Declaration Error (`soundName`)

### Problem:
- Importing `@vibe/game` in the browser triggers `Uncaught SyntaxError: Identifier 'soundName' has already been declared`.
- This blocks all module imports and game startup, even for minimal imports.
- No duplicate `let`, `const`, or `var soundName` found in codebase.
- Likely causes: circular import, module loaded twice (e.g., via different paths/casing), or import map/config issue.

### Tasks:
1. **Audit all imports of `Audio.js` and `SFXManager.js`**
   - List every import, noting path and casing.
   - Check for any import map or alias issues.
2. **Check for circular dependencies**
   - Map dependency graph for `Audio.js` and `SFXManager.js`.
   - Identify any cycles.
3. **Check for path/case mismatches**
   - Ensure all imports use the same path/casing.
   - Fix any mismatches.
4. **Check for duplicate function parameter names**
   - Review all function signatures for accidental duplicate parameters.
5. **Test for duplicate variable declarations in block scopes**
   - Review all blocks for accidental redeclaration.
6. **Test minimal import in browser**
   - Confirm error is gone.
   - If not, use browser stack trace to pinpoint file/line.
7. **Document findings and fixes**
   - Summarize root cause and solution in this roadmap.

### Tests to Prove It’s Fixed:
- [ ] Minimal import of `@vibe/game` in `test-minimal.html` succeeds ("Module imported!" appears, no syntax error in logs).
- [ ] Playwright tests can start and see the canvas.
- [ ] Game loads and runs in the browser.
- [ ] No duplicate declaration errors in browser console.

---

## 2B. Resume Modular Migration After Fix
- Once the fatal error is fixed, continue with the next steps in the migration and repair workflow.
- Document any new findings or blockers in this file for seamless handoff and future reference.

---

*This section added automatically by the AI migration assistant on 2024-06-26. Continue from here for a smooth workflow.*

