# Screenshot Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Playwright-based screenshot tool invoked via `pnpm run screenshot` that captures the game visually for feedback on rendering/gameplay changes.

**Architecture:** Single Playwright test file (`tests/screenshot.js`) that boots the game using the same pattern as `tests/gameplay-probe.test.js`, optionally fast-forwards to a target level via score injection, simulates brief gameplay, and saves a screenshot to `tests/screenshots/game-screenshot.png`. CLI args parsed from `process.env` passed through Playwright config.

**Tech Stack:** Playwright (already installed), five-server (already configured)

---

### Task 1: Create the screenshot script

**Files:**
- Create: `tests/screenshot.js`

- [ ] **Step 1: Create `tests/screenshot.js` with full implementation**

```js
import { test } from '@playwright/test';

// Parse CLI args from environment (Playwright doesn't pass process.argv easily)
// Usage: LEVEL=3 WAIT=5000 npx playwright test tests/screenshot.js
const TARGET_LEVEL = parseInt(process.env.LEVEL) || 0;
const WAIT_MS = parseInt(process.env.WAIT) || 2000;
const OUTPUT_PATH = 'tests/screenshots/game-screenshot.png';

/**
 * Boot the game: navigate, unlock audio, wait for core systems.
 * Same pattern as gameplay-probe.test.js bootGame().
 */
const bootGame = async (page) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { state: 'attached' });
  await page.keyboard.press(' ');
  await page.waitForFunction(
    () =>
      window.gameState &&
      window.player &&
      window.collisionSystem &&
      Array.isArray(window.enemies) &&
      window.enemies.filter((e) => !e.markedForRemoval).length > 0 &&
      typeof window.frameCount === 'number' &&
      window.frameCount > 0
  );
};

/**
 * Fast-forward to target level by injecting score.
 * Level thresholds: L2=150, L3=450, L4=900, L5=1500, L6=2250
 */
const fastForwardToLevel = async (page, level) => {
  if (level < 2) return;

  // Compute score needed: sum of (n * 150) for n=1..level-1, plus a small buffer
  await page.evaluate((targetLevel) => {
    const gs = window.gameState;
    // Calculate exact threshold for target level
    let threshold = 0;
    for (let n = 1; n < targetLevel; n++) {
      threshold += n * 150;
    }
    gs.score = threshold + 10; // Small buffer past threshold
    gs.checkLevelProgression();
  }, level);

  // Verify level reached
  await page.waitForFunction(
    (target) => window.gameState.level >= target,
    level,
    { timeout: 5000 }
  );

  // Wait for new enemy types to spawn at this level
  await page.waitForTimeout(1500);
};

/**
 * Simulate brief gameplay: move and shoot so screenshot has action.
 */
const simulateGameplay = async (page) => {
  // Move right and shoot
  await page.keyboard.down('d');
  await page.keyboard.down(' ');
  await page.waitForTimeout(800);
  await page.keyboard.up('d');

  // Move up-left and keep shooting
  await page.keyboard.down('w');
  await page.keyboard.down('a');
  await page.waitForTimeout(700);
  await page.keyboard.up('w');
  await page.keyboard.up('a');
  await page.keyboard.up(' ');
};

test('capture game screenshot', async ({ page }) => {
  // Collect console errors
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await bootGame(page);

  if (TARGET_LEVEL > 1) {
    await fastForwardToLevel(page, TARGET_LEVEL);
  }

  await simulateGameplay(page);
  await page.waitForTimeout(WAIT_MS);

  // Capture game state info
  const info = await page.evaluate(() => ({
    level: window.gameState?.level,
    score: window.gameState?.score,
    enemyCount: window.enemies?.filter((e) => !e.markedForRemoval).length,
    playerHealth: window.player?.health,
    frameCount: window.frameCount,
  }));

  await page.screenshot({ path: OUTPUT_PATH, fullPage: true });

  // Print results for Claude to read
  console.log(`\n📸 Screenshot saved: ${OUTPUT_PATH}`);
  console.log(
    `   Level: ${info.level} | Score: ${info.score} | Enemies: ${info.enemyCount} | Health: ${info.playerHealth} | Frame: ${info.frameCount}`
  );
  if (errors.length > 0) {
    console.log(`   ⚠️ Console errors (${errors.length}):`);
    errors.forEach((e) => console.log(`     - ${e}`));
  }
});
```

- [ ] **Step 2: Run the script to verify it works**

Run: `pnpm run screenshot` (after adding the npm script in Task 2)

For now, test directly:
```bash
npx playwright test tests/screenshot.js --reporter=list
```

Expected: Test passes, screenshot saved to `tests/screenshots/game-screenshot.png`.

- [ ] **Step 3: Commit**

```bash
git add tests/screenshot.js
git commit -m "feat: add screenshot capture tool for visual feedback"
```

---

### Task 2: Add npm scripts

**Files:**
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Add screenshot scripts to package.json**

Add these scripts:
```json
"screenshot": "npx playwright test tests/screenshot.js --reporter=list",
"screenshot:level": "LEVEL=${LEVEL:-3} npx playwright test tests/screenshot.js --reporter=list"
```

- [ ] **Step 2: Verify basic invocation**

```bash
pnpm run screenshot
```

Expected: Screenshot saved to `tests/screenshots/game-screenshot.png`, test passes.

- [ ] **Step 3: Verify level flag**

```bash
LEVEL=3 pnpm run screenshot
```

Expected: Game fast-forwards to level 3, screenshot includes stabbers and rushers.

- [ ] **Step 4: Verify wait flag**

```bash
WAIT=4000 pnpm run screenshot
```

Expected: Script waits 4s before capturing (more action in frame).

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "feat: add screenshot npm scripts"
```

---

### Task 3: Exclude screenshot from test suite

**Files:**
- Modify: `playwright.config.js` (testIgnore)

- [ ] **Step 1: Add screenshot.js to testIgnore in playwright.config.js**

The current config has:
```js
testIgnore: '**/unit/**',
```

Change to:
```js
testIgnore: ['**/unit/**', '**/screenshot.js'],
```

This prevents `pnpm run test:e2e` from running the screenshot tool as a test.

- [ ] **Step 2: Verify screenshot is excluded from test suite**

```bash
npx playwright test --list
```

Expected: `screenshot.js` does NOT appear in the test list. `gameplay-probe.test.js` still appears.

- [ ] **Step 3: Verify screenshot still works directly**

```bash
pnpm run screenshot
```

Expected: Still works fine when invoked directly.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.js
git commit -m "fix: exclude screenshot tool from E2E test suite"
```

---

### Task 4: Ensure screenshots directory exists and is gitignored

**Files:**
- Check: `.gitignore` for `tests/screenshots/`

- [ ] **Step 1: Check if tests/screenshots/ is already gitignored**

```bash
grep -r "screenshots" .gitignore
```

If already present, skip to step 3. If not:

- [ ] **Step 2: Add to .gitignore if needed**

Add this line to `.gitignore`:
```
tests/screenshots/
```

- [ ] **Step 3: Create the directory if it doesn't exist**

```bash
mkdir -p tests/screenshots
```

- [ ] **Step 4: Commit if .gitignore was changed**

```bash
git add .gitignore
git commit -m "chore: gitignore screenshot output directory"
```

---

### Task 5: End-to-end verification

- [ ] **Step 1: Run the full test suite to make sure nothing broke**

```bash
pnpm run test:unit
```

Expected: All unit tests pass.

```bash
pnpm run test:e2e
```

Expected: All E2E tests pass, screenshot.js is NOT run.

- [ ] **Step 2: Run screenshot at multiple levels**

```bash
pnpm run screenshot
LEVEL=3 pnpm run screenshot
LEVEL=5 pnpm run screenshot
```

Expected: All three succeed. Level 5 screenshot should show tanks.

- [ ] **Step 3: Verify Claude can read the screenshot**

Use the Read tool on `tests/screenshots/game-screenshot.png` — it should display the game visually.
