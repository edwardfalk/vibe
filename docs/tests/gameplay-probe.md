# Gameplay Playwright Probe Suite

This Playwright test file (`tests/gameplay-probe.test.js`) is the first-line health-check for the whole game.

## What it covers

### Existing file: gameplay-probe.test.js

1. **Liveness probe** – verifies that the game boots, the `<canvas>` element appears, and critical globals (`gameState`, `player`, `audio`) are present.
2. **Game-mechanics probe** – exercises basic movement / shooting behaviour by delegating to `window.testRunner` inside the page.
3. **Player-death probe** *(new)* – applies deterministic lethal damage to the player and asserts that:
   * the player’s health reaches `0`, **and**
   * `gameState.gameState` transitions to `"gameOver"`.

   This guards against the regression where the player’s health dropped to `0` but the game never entered the **Game Over** state.

## Why is there a backup?

The previous version of the test was archived to:
```
test-backups/gameplay-probe.test.bak.js
```
so we can always diff back or cherry-pick single probes without losing historical behaviour.

Keeping a snapshot also makes it easy to introduce alternate enemy-specific variants later (e.g. `rusher-death-probe`, `stabber-death-probe`) without risking accidental test regressions.

---
*Last updated: 2025-08-16*

### Hybrid file: grunt-shoot-and-death-probe.test.js

This variant runs natural ranged combat before finishing deterministically.

1. Spawns one grunt at a fixed offset (150 px to the right).
2. Waits up to 15 s for the first bullet impact – verified by `enemyBullets.length` growth and player-health drop.
3. Applies lethal damage to guarantee a quick finish.
4. Asserts the same `gameOver` state transition.

Approximate runtime 12–20 s (under the 60 s allowance).

### Bug-demo file: player-death-bug-demo.test.js

Illustrates the current defect – invoking `player.takeDamage()` to 0 HP **does not** set `gameState` to `gameOver`.
The test is flagged with `test.fail()` so CI passes while the bug is known.  Remove the flag once the fix lands: the same test will then turn green, demonstrating the repair.
