# Play-Test Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix what Edward heard and felt in his 2026-09-24 play-test:
- shots vanishing after a hit;
- no Shift to fire, and keyboard fire off the beat;
- the kick sitting off the enemies' beat;
- smeared, detuned and clicking effects;
- the stabber landing on the snare instead of the off-beat;
- a mix where the kick drowns the effects and the speech.

It also closes two small bugs: `?tune`'s "Level +1" overwriting the high score, and a never-drawn particle list that grows all run.

**Architecture:**
- **One beat grid.** `BeatClock` is the only beat grid; `BeatTrack` computes its note times from it on every scheduler tick.
- **Beat-gated checks open when the beat lands** and stay open `tolerance` ms, never before it. So no enemy acts ahead of the kick, and `getTotalBeats()` is a stable once-per-beat label inside a window. [review-added 2026-09-24]
- **Mix.** Levels live in `CONFIG.MIX`. Two duck gains (effects −6 dB, beat track −3 dB) follow `speechSynthesis.speaking`, polled every frame and capped at 5 s. [review-added 2026-09-24]

**Tech Stack:** p5.js 1.7 (CDN, instance mode), Web Audio, `speechSynthesis`, Vitest, Playwright, pnpm.

**Spec:** No separate spec. The requirements come from:
- Edward's play-test notes, quoted per task;
- his decisions in the review, recorded in `2026-09-24-play-test-fixes.review.md` (both rounds);
- three investigations on 2026-09-24 (code reading plus measurements in Chrome).

## Global Constraints

- pnpm. Commands: `pnpm run lint`, `pnpm run test:unit`. Before each commit, run `npx prettier --write <touched files>` on every touched file.
- **E2E locally uses a scratch config with its own port.** [review-added 2026-09-24] Port 5500 may be Edward's dev server from another checkout, and `reuseExistingServer` would silently test that. Put the config in the session scratchpad:

  ```js
  import base from '<worktree>/playwright.config.js';
  export default {
    ...base,
    testDir: '<worktree>/tests',
    webServer: {
      ...base.webServer,
      command: 'node_modules/.bin/five-server --port=5502 --open=false',
      port: 5502,
      cwd: '<worktree>',
      reuseExistingServer: false,
    },
    use: { ...base.use, baseURL: 'http://localhost:5502', channel: 'chrome' },
  };
  ```

  Why `channel: 'chrome'`: the bundled Chromium isn't installed on the laptop (CI uses it). Referred to below as `<e2e>`: `npx playwright test --config=<that file>`. Never change its `testDir`.
- ES modules; Prettier (single quotes, trailing commas); ESLint prefer-const / no-var; p5 instance mode only.
- **Where tunables go** [review-added 2026-09-24]:
  - mix and level tunables with a live effect: `CONFIG.MIX` plus a `?tune` slider;
  - per-entity chances, and constants nobody tunes live: named constants at the top of their file. CLAUDE.md's "no magic numbers" is satisfied that way.
- **Keep the steady four-on-the-floor kick.** Edward confirmed it's what makes enemies audibly part of the beat. His ruling on ducking: the kick may **dip a little** for speech, with the amount set by ear (`DUCK_BEAT_DB`).
- **Worktree:** `git -C /home/edward/projects/vibe fetch origin && git -C /home/edward/projects/vibe worktree add .worktrees/play-test-fixes -b play-test-fixes origin/main && pnpm -C /home/edward/projects/vibe/.worktrees/play-test-fixes install --frozen-lockfile`.
- **Resuming** [review-added 2026-09-24]: if the worktree exists, work there. If `git status --porcelain` is non-empty, commit the WIP to a temporary commit or `git restore` it, then redo the first task whose commit isn't in `git log origin/main..HEAD` from Step 1. Never use a bare `git stash`: the stash stack is shared across worktrees.
- Before removing any worktree, check no process has its cwd inside it. Stage explicit paths; never `git commit -a`.

## Review Focus

1. **Restart after game over:** kicks keep coming, stay on the enemies' beat with the accent on beat 1, and nothing is doubled. The unit test in Task 3 covers doubling; the E2E test covers grid and accent.
2. **A sound gated on beats 2 and 4 in the ~100 ms before beat 3 or beat 1:** it must not fire, and no gated enemy action happens before its beat. Covered by Task 4's unit tests and Task 3's E2E grunt-shot timing.
3. **Two fire inputs held, one released** (Space+Shift, mouse+Shift, either order): firing continues while any is held. A right-click never starts firing. Covered by Task 2's E2E test.
4. **Speech that ends without an `end` event, a cancel by mute, or a stalled engine:** the duck releases. Covered by Task 6's E2E test, which stubs `speechSynthesis`.
5. **The tab hidden, then shown:** no burst of missed kicks. Covered by Task 3's unit test. That test passes on the old code too; it guards the new scheduler.

---

### Task 1: Shots fired after a hit are thrown away

Edward: *"it seems like he stops firing for a while after a hit … at least when firing with space."*

**Root cause (reproduced in Node).**
1. On a hit, a bullet goes back to the pool **and** is marked `_remove = true` (`js/systems/collision/BulletCollisionResolvers.js:91-92, 138-143, 201-202`, `js/systems/CollisionSystem.js:203-204`).
2. `Bullet.reset()` (`js/entities/bullet.js:97-135`) never clears `_remove`.
3. The pool returns the last released bullet first, so the next shot comes out pre-marked.
4. Compaction (`CollisionSystem.js:36`) drops it the same frame.

**Files:**
- Modify: `js/entities/bullet.js` (`reset()`)
- Create: `tests/unit/BulletPool.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/BulletPool.test.js
import { describe, it, expect } from 'vitest';
import { Bullet } from '../../js/entities/bullet.js';

describe('Bullet pool', () => {
  it('a recycled bullet is not still marked for removal', () => {
    const first = Bullet.acquire(0, 0, 0, 5, 'player');
    first._remove = true; // what the collision code does on a hit
    Bullet.release(first);
    const next = Bullet.acquire(0, 0, 0, 5, 'player');
    expect(next).toBe(first); // the pool reuses it
    expect(next._remove).toBe(false);
  });
});
```

- [ ] **Step 2: Confirm it fails.** Run `npx vitest run tests/unit/BulletPool.test.js`. Expected: FAIL, `expected true to be false`.
- [ ] **Step 3: Fix.** In `Bullet.reset()`, directly after `this._inPool = false;`, add:

```js
    this._remove = false; // a hit marks it; a recycled bullet starts clean
```

- [ ] **Step 4:** Run `npx vitest run tests/unit/BulletPool.test.js && pnpm run test:unit`. Expected: PASS.
- [ ] **Step 5: Format and commit**

```bash
npx prettier --write js/entities/bullet.js tests/unit/BulletPool.test.js
git add js/entities/bullet.js tests/unit/BulletPool.test.js
git commit -m "fix: shots fired after a hit were dropped before being drawn

Bullet.reset() never cleared _remove, which collisions set on a hit, so the
pool handed the next shot out pre-marked and compaction removed it the same
frame. Sound played, no bullet."
```

---

### Task 2: Fire with either Shift; held inputs don't cancel each other; keyboard fire on the beat

Edward: *"I'd like to be able to fire with shift too … there's one shift key both by the arrows and by the wasd keys."* His decision in review: Space/Shift fire snaps to eighth notes like the mouse. [review-added 2026-09-24]

**Today.**
- **Shared flag.** Space and the mouse both write `window.playerIsShooting` (`js/core/InputHandlers.js:4, 29, 54, 57`). Releasing one stops firing while the other is held.
- **Keyboard ignores the beat.** `player.js:244` ends the burst whenever the *mouse* isn't pressed, so keyboard fire never reaches the eighth-note quantising (`player.js:286-298`, via `queueShot()`).
- **Shift is safe elsewhere.** `event.code` tells the two Shifts apart. Shift+WASD moves normally (verified in E2E). The title screen ignores Shift.

**Files:**
- Modify: `js/core/InputHandlers.js`, `js/entities/player.js:243-247`, `index.html`
- Test: `tests/gameplay-probe.test.js`

**Interfaces:**
- Produces: `window.playerIsShooting === held.size > 0`, where `held` contains the fire key codes and `'mouse'`. Readers are unchanged.

- [ ] **Step 1: Write the failing E2E tests** (inside `test.describe('Gameplay Probes', …)`)

```js
  test('Either Shift fires; releasing one fire input keeps the others firing', async ({
    page,
  }) => {
    await bootGame(page);
    const shots = () => page.evaluate(() => window.gameState.shotsFired);
    const stillFiring = async () => {
      const before = await shots();
      await page.waitForTimeout(600);
      return (await shots()) > before;
    };

    await page.keyboard.down('ShiftRight');
    expect(await stillFiring()).toBe(true);

    // mouse + Shift: let go of the mouse first
    const box = await page.locator('#defaultCanvas0').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 4);
    await page.mouse.down();
    await page.mouse.up();
    expect(await stillFiring()).toBe(true);

    // Space + Shift, released in the other order
    await page.keyboard.down('Space');
    await page.keyboard.up('ShiftRight');
    expect(await stillFiring()).toBe(true);
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.up('Space');
    expect(await stillFiring()).toBe(true);

    await page.keyboard.up('ShiftLeft');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.playerIsShooting)).toBe(false);

    // A right-click never starts firing
    await page.mouse.down({ button: 'right' });
    expect(await page.evaluate(() => window.playerIsShooting)).toBe(false);
    await page.mouse.up({ button: 'right' });
  });

  test('Held keyboard fire lands on eighth notes', async ({ page }) => {
    await bootGame(page);
    const offsets = await page.evaluate(async () => {
      const p = window.player;
      const clock = window.beatClock;
      const fire = p.fireBullet.bind(p);
      const out = [];
      p.fireBullet = (...a) => {
        const eighth = clock.beatInterval / 2;
        const t = clock._now() - clock.startTime;
        out.push(Math.min(t % eighth, eighth - (t % eighth)));
        return fire(...a);
      };
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', shiftKey: true }));
      await new Promise((r) => setTimeout(r, 2000));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }));
      p.fireBullet = fire;
      return out;
    });
    // The first shot is immediate; every later one is on an eighth note
    const sustained = offsets.slice(1);
    expect(sustained.length).toBeGreaterThanOrEqual(4);
    const tol = await page.evaluate(() => window.beatClock.eighthNoteTolerance);
    for (const o of sustained) expect(o).toBeLessThanOrEqual(tol + 17); // + one frame
  });
```

- [ ] **Step 2: Confirm they fail.** Run `<e2e> -g "Either Shift|eighth notes"`. Expected: FAIL. Shift does nothing, so the first test sees no shots and the second sees fewer than 4.

- [ ] **Step 3: Rewrite the fire-input handling** in `js/core/InputHandlers.js`. At the top:

```js
// Everything currently holding the trigger: fire key codes and 'mouse'.
// Firing continues while any of them is held.
const FIRE_KEYS = ['Space', 'ShiftLeft', 'ShiftRight'];
const held = new Set();
const syncShooting = () => {
  window.playerIsShooting = held.size > 0;
};

// Returns true if the event was a fire key. A lost Shift keyup (a known OS
// quirk) is repaired by any later key event.
function fireKey(e, down) {
  if (!e.shiftKey) {
    held.delete('ShiftLeft');
    held.delete('ShiftRight');
  }
  if (!FIRE_KEYS.includes(e.code)) return false;
  if (down) held.add(e.code);
  else held.delete(e.code);
  syncShooting();
  e.preventDefault();
  return true;
}
```

- In `onKeyDown`, delete the `case 'Space':` block and put `if (fireKey(e, true)) return;` before the `switch`.
- In `onKeyUp`, do the same with `if (fireKey(e, false)) return;`.
- Leave the arrow cases unchanged.

In `initializeInputHandlers()`, replace the two mouse listeners, and add blur:

```js
    // Only the left button fires (a right-click's menu can swallow mouseup)
    window.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      held.add('mouse');
      syncShooting();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      held.delete('mouse');
      syncShooting();
    });
    // Keyups that happen while the window is unfocused never arrive
    window.addEventListener('blur', () => {
      held.clear();
      syncShooting();
      window.arrowUpPressed = false;
      window.arrowDownPressed = false;
      window.arrowLeftPressed = false;
      window.arrowRightPressed = false;
    });
```

- [ ] **Step 4: Keyboard fire on the beat.** In `js/entities/player.js` replace

```js
    // If mouse is not pressed and player was shooting, reset shooting state
    if (wasShooting && !this.p.mouseIsPressed) {
```

with

```js
    // The burst ends when no fire input is held (mouse or keys), so held
    // keyboard fire is quantised to eighth notes like the mouse
    if (wasShooting && !window.playerIsShooting) {
```

- [ ] **Step 5:** In `index.html`, change `<dt>Click / Space</dt>` to `<dt>Click / Space / Shift</dt>`.
- [ ] **Step 6:** Run `<e2e>` in full. Expected: all PASS.
- [ ] **Step 7: Format and commit**

```bash
npx prettier --write js/core/InputHandlers.js js/entities/player.js index.html tests/gameplay-probe.test.js
git add js/core/InputHandlers.js js/entities/player.js index.html tests/gameplay-probe.test.js
git commit -m "feat: fire with either Shift; held inputs don't cancel; keyboard fire on the beat"
```

---

### Task 3: The kick follows the enemies' beat grid

Edward: *"it sounded like the effects got a bit out of sync after a while."*

**Root cause (measured).**
- `BeatTrack.start()` makes its own grid at `ctx.currentTime + 0.05`, while `BeatClock`'s grid dates from page load (`js/GameLoopSetup.js:117-135`). So the kick sits a random 0–500 ms after the enemies' beat: measured 142, 145, 215 and 187 ms, each constant within its session.
- `start()` runs inside `Audio.initialize()`, before BeatClock moves to the AudioContext. So the track reads the clock's grid on every tick, and schedules nothing until the clock is on the same context.
- `BeatClock.reset()` moves the grid by whole beats. Notes already queued up to 75 ms ahead must not be scheduled again.
- A forward-snapping `reset()` also puts `startTime` in the future. Elapsed time then goes negative, and `isOnBeat()` reported true 200 ms early (verified on the real class). [review-added 2026-09-24]

**Files:**
- Modify: `js/audio/BeatTrack.js`:
  - use `createContextAccessor`;
  - `start()`;
  - `_scheduler()`;
  - delete `setBPM()` and `_getAudio()`.
- Modify: `js/audio/BeatClock.js`: delete `setGlobalBPM` (no callers); in `reset()`, snap forward one bar early.
- Create: `tests/unit/BeatTrackGrid.test.js`
- Modify: `tests/unit/BeatClock.test.js`
- Test: `tests/gameplay-probe.test.js`

**Interfaces:**
- Consumes: `beatClock.audioContext`, `beatClock.startTime` (ms on the AudioContext clock), `beatClock.beatInterval` (ms).
- Produces: `BeatTrack._scheduleNote(timeSec, eighthInMeasure)` keeps its signature. Eighth 0 is BeatClock's beat 1.
- Removed: `BeatTrack.setBPM` and `setGlobalBPM`.

- [ ] **Step 1: Write the failing unit tests**

```js
// tests/unit/BeatTrackGrid.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BeatTrack } from '../../js/audio/BeatTrack.js';

// A BeatTrack whose scheduler reads a fake BeatClock on a fake AudioContext
function setup({ now, clockStartMs, beatMs = 500 }) {
  const ctx = { currentTime: now };
  const clock = {
    audioContext: ctx,
    startTime: clockStartMs,
    beatInterval: beatMs,
  };
  const track = new BeatTrack(120, {
    get: (k) => (k === 'beatClock' ? clock : undefined),
  });
  track.ctx = ctx;
  track.masterGain = {};
  track.isPlaying = true;
  const notes = [];
  vi.spyOn(track, '_scheduleNote').mockImplementation((t, eighth) =>
    notes.push([Number(t.toFixed(4)), eighth])
  );
  return { ctx, clock, track, notes };
}

describe('BeatTrack grid', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('schedules on the BeatClock grid, eighth 0 = beat 1', () => {
    const { track, notes } = setup({ now: 10.2, clockStartMs: 1234 });
    track._scheduler();
    // origin 1.234 s; eighth 36 = 10.234 s; 36 % 8 = 4 (beat 3)
    expect(notes).toEqual([[10.234, 4]]);
  });

  it('after a reset (grid moved by whole beats) renumbers the bar and never re-schedules a queued note', () => {
    const { track, clock, notes } = setup({ now: 10.2, clockStartMs: 1234 });
    track._scheduler(); // queues 10.234
    clock.startTime += 2 * 500; // what reset() does: same times, bar renumbered
    notes.length = 0;
    track._scheduler(); // still at 10.2
    expect(notes).toEqual([]); // 10.234 is already queued
    track.ctx.currentTime = 10.45;
    track._scheduler();
    // next eighth; on the moved grid 10.234 is eighth 0, so 10.484 is eighth 1
    expect(notes).toEqual([[10.484, 1]]);
  });

  it('skips missed notes after a hidden tab instead of bursting', () => {
    const { track, ctx, notes } = setup({ now: 10.2, clockStartMs: 1234 });
    track._scheduler();
    ctx.currentTime = 60.2;
    notes.length = 0;
    track._scheduler();
    expect(notes.length).toBeLessThanOrEqual(1);
  });

  it('schedules nothing until BeatClock runs on the same AudioContext', () => {
    const { track, clock, notes } = setup({ now: 10.2, clockStartMs: 1234 });
    clock.audioContext = null;
    track._scheduler();
    expect(notes).toEqual([]);
  });
});
```

Add to `tests/unit/BeatClock.test.js`, importing `BeatClock` if the file doesn't already:

```js
  it('a reset that snaps forward does not report the next beat early', () => {
    const ctx = { currentTime: 0 };
    const clock = new BeatClock(120, ctx);
    ctx.currentTime = 0.3; // 300 ms in: the next beat is 200 ms away
    clock.reset();
    expect(clock.getTimeToNextBeat()).toBeCloseTo(200, 0);
    expect(clock.isOnBeat()).toBe(false); // 200 ms early is outside ±100 ms
    expect(clock.getCurrentBeat()).toBeGreaterThanOrEqual(0);
  });
```

- [ ] **Step 2: Confirm the failures.** Run `npx vitest run tests/unit/BeatTrackGrid.test.js tests/unit/BeatClock.test.js`. Expected: FAIL for the grid, reset, no-grid and BeatClock-reset tests. The hidden-tab test also passes on the old code.

- [ ] **Step 3: BeatTrack.**
  1. Import: `import { createContextAccessor } from '../shared/ContextAccessor.js';`.
  2. Constructor: add `this.getContextValue = createContextAccessor(context);`, and delete the fields `bpm`, `beatDuration`, `eighthDuration`, `nextNoteTime` and `currentEighth`.
  3. Delete `_getAudio()` and `setBPM()`. In `start()`, replace `this._getAudio()` with `this.getContextValue('audio')`, and delete the four lines setting `nextNoteTime`, `_startTime`, `_totalEighths` and `currentEighth`.
  4. Replace `_scheduler()`:

```js
  _scheduler() {
    if (!this.isPlaying || !this.ctx) return;

    const clock = this.getContextValue('beatClock');
    // Silent until BeatClock runs on this AudioContext (the first moments
    // after start); from then on the kick uses the enemies' grid exactly
    if (clock?.audioContext === this.ctx) {
      const now = this.ctx.currentTime;
      const origin = clock.startTime / 1000;
      const eighth = clock.beatInterval / 2000;
      const n8 = EIGHTH_NOTES_PER_MEASURE;
      // From now (skips missed notes after a hidden tab), and never at or
      // before a note already handed to Web Audio (a restart moves the grid)
      const from = Math.max(now, (this._lastNoteSec ?? -Infinity) + eighth / 2);
      for (
        let n = Math.ceil((from - origin) / eighth);
        origin + n * eighth < now + SCHEDULE_AHEAD_SEC;
        n++
      ) {
        this._lastNoteSec = origin + n * eighth;
        this._scheduleNote(this._lastNoteSec, ((n % n8) + n8) % n8);
      }
    }

    this.schedulerTimer = setTimeout(
      () => this._scheduler(),
      SCHEDULER_INTERVAL_MS
    );
  }
```

- [ ] **Step 4: BeatClock.**
  - Delete `setGlobalBPM`; grep shows only its definition.
  - In `reset()`, replace the snap-forward line `this.startTime = now + (this.beatInterval - remainder);` with:

```js
      // Same grid and bar numbering, one bar earlier, so elapsed time is
      // never negative (a future origin made isOnBeat() fire 200 ms early)
      this.startTime =
        now +
        (this.beatInterval - remainder) -
        this.beatInterval * this.beatsPerMeasure;
```

  - Run `grep -rn "setBPM\|setGlobalBPM\|nextNoteTime\|_totalEighths\|currentEighth\|eighthDuration\|_getAudio" js tests` and update any hits. Delete a unit test that only exercised `BeatTrack.setBPM`.

- [ ] **Step 5:** Run `npx vitest run tests/unit/BeatTrackGrid.test.js tests/unit/BeatClock.test.js && pnpm run test:unit`. Expected: PASS.

- [ ] **Step 6: E2E test.** It checks that the kick is on the grid with its accent and survives a restart, and that grunt shots land after their beat, not before it.

```js
  test("Kick locks to the enemies' beat, including after a restart", async ({
    page,
  }) => {
    await bootGame(page);
    await page.waitForFunction(() => window.beatTrack?.isPlaying);
    const record = () =>
      page.evaluate(async () => {
        const track = window.beatTrack;
        const clock = window.beatClock;
        const audio = window.audio;
        // Bring a grunt within firing range (grunts fire only within 300 px)
        const grunt = window.enemies.find((e) => e.type === 'grunt');
        if (grunt) {
          grunt.x = window.player.x + 200;
          grunt.y = window.player.y;
        }
        const schedule = track._scheduleNote.bind(track);
        const playSound = audio.playSound.bind(audio);
        const kicks = [];
        const shotOffsets = [];
        track._scheduleNote = (time, eighth) => {
          if (eighth % 2 === 0) {
            const rel = time * 1000 - clock.startTime;
            const beat = Math.round(rel / clock.beatInterval);
            kicks.push({
              off: Math.abs(rel - beat * clock.beatInterval),
              beatInMeasure: ((beat % 4) + 4) % 4,
              eighth,
            });
          }
          schedule(time, eighth);
        };
        audio.playSound = (name, ...rest) => {
          if (name === 'alienShoot') {
            const t = clock._now() - clock.startTime;
            shotOffsets.push(
              t - Math.floor(t / clock.beatInterval) * clock.beatInterval
            );
          }
          return playSound(name, ...rest);
        };
        await new Promise((r) => setTimeout(r, 3000));
        track._scheduleNote = schedule;
        audio.playSound = playSound;
        return { kicks, shotOffsets, tolerance: clock.tolerance };
      });
    const check = ({ kicks, shotOffsets, tolerance }) => {
      expect(kicks.length).toBeGreaterThanOrEqual(3);
      for (const k of kicks) {
        expect(k.off).toBeLessThan(2); // on BeatClock's beat
        expect(k.eighth / 2).toBe(k.beatInMeasure); // accent on the clock's beat 1
      }
      // Grunt shots come after their beat lands; a pre-beat shot would read
      // as ~400-500 ms (the end of the previous beat)
      expect(shotOffsets.length).toBeGreaterThan(0);
      for (const o of shotOffsets) expect(o).toBeLessThanOrEqual(tolerance + 20);
    };
    check(await record());
    await page.evaluate(() => window.gameState.setGameState('gameOver'));
    await page.keyboard.press('r');
    await page.waitForFunction(() => window.gameState.gameState === 'playing');
    check(await record());
  });
```

Run `<e2e> -g "Kick locks"`. Expected: PASS. A doubled kick after a restart is covered by the unit test in Step 1.

- [ ] **Step 7: Format and commit**

```bash
npx prettier --write js/audio/BeatTrack.js js/audio/BeatClock.js tests/unit/BeatTrackGrid.test.js tests/unit/BeatClock.test.js tests/gameplay-probe.test.js
git add js/audio/BeatTrack.js js/audio/BeatClock.js tests/unit/BeatTrackGrid.test.js tests/unit/BeatClock.test.js tests/gameplay-probe.test.js
git commit -m "fix: kick follows BeatClock's grid, not its own

BeatTrack started its own grid when audio started; enemies use BeatClock's,
anchored at page load, so the kick sat a random 0-500 ms off the enemies'
beat each session (measured 142-215 ms). BeatTrack now computes note times
from BeatClock on every tick, never re-schedules a queued note after a
restart, and skips missed notes after a hidden tab. BeatClock.reset() no
longer puts the origin in the future. Removes unused setBPM/setGlobalBPM."
```

---

### Task 4: Beat-window sounds play once, when the beat lands; the stabber on 3.5

Edward: *"they got a bit distorted … it sounded more like something was a bit wrong than just a cool effect."*

**Measured and read:**
- **Stacked per-frame rolls.** The on-beat window is ±100 ms. `gruntAdvance` rolls `random() < 0.25` and `gruntRetreat` rolls `< 0.3` on **every frame** in it (`js/entities/Grunt.js:147-162`). That stacked 2–18 detuned square waves per beat.
  - The tank's charge sounds (`Tank.js:163, 176, 185`) and the stabber chant (`StabberAttackHandler.js:38-50`) do the same.
  - The tank's `speak()` is held back by Audio's 2.5 s cooldown; its `playSound` isn't.
- **The pre-beat half fires early.** In the ~100 ms before a beat, `isOnBeat(beats)` reports the previous beat, so "beats 2 and 4" sounds also fire just before beats 3 and 1.
- **The stabber lands on the snare.** Its gate opens across 3.75–4.25, and the dash follows half a beat later (`handleWarningPhase`), at about 4.25.
  - **Edward's decision:** put it on the off-beat 3.5. [review-added 2026-09-24]
  - Because the warning lasts half a beat, the prepare→warning step moves to **beat 3**, so the dash lands on **3.5**. The 3.5 window (`canStabberAttack`) gates chant, recovery and speech.
- **The rusher's fuse lands late under the new gate.** It starts a 5-frame fuse when `canRusherExplode()` opens (`Rusher.js:94`). With the window no longer opening early, that would land 85–100 ms after the beat, so the fuse becomes 0. [review-added 2026-09-24]
- **Ambient speech would halve.** It tries its beat gate on a single frame when its timer expires, so narrower gates would halve enemy chatter.
  - **Edward: keep today's rate.** An expired timer waits for its gate, then rolls once.
  - Per-attempt chances equal today's effective rates. [review-added 2026-09-24]

**Design:**
- Gates with a beats list open when the beat lands and last `tolerance` ms.
- `isOnBeat()` with **no** list (spawns, the on-beat kill bonus) keeps its symmetric window, because it judges the player fairly.
- Inside a post-beat window, `getTotalBeats()` can't change, so the grunt `_lastGruntBeat`/`gruntFireBeat` guards and the tank's charge bookkeeping stay correct unchanged.

**Files:**
- Modify: `js/audio/BeatClock.js`:
  - `isOnBeat`;
  - `canGruntShoot`/`canTankShoot`/`canRusherExplode` become one-liners;
  - `canStabberAttack`.
- Modify: `js/entities/BaseEnemy.js`: add `onBeatOnce()`; change `updateAmbientSpeech`/`triggerAmbientSpeech`.
- Modify: `js/entities/Grunt.js`, `Tank.js`, `Rusher.js` and `Stabber.js`: gated sounds; the `getAmbientSpeechConfig` shape.
- Modify: `js/entities/StabberAttackHandler.js`:
  - the chant;
  - the prepare→warning gate;
  - the telegraph countdown.
- Create: `tests/unit/BeatOnce.test.js`

**Interfaces:**
- Produces:
  - `BaseEnemy.onBeatOnce(beatClock, key: string, open: boolean) → boolean`;
  - `getAmbientSpeechConfig() → { lines: string[], gate: (beatClock) => boolean, chance: number } | null`, replacing `shouldSpeak`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/BeatOnce.test.js
import { describe, it, expect, vi } from 'vitest';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { BaseEnemy } from '../../js/entities/BaseEnemy.js';

vi.spyOn(console, 'log').mockImplementation(() => {});

// A BeatClock on a fake audio clock, `ms` after its start (500 ms beats)
function clockAt(ms) {
  const ctx = { currentTime: 0 };
  const clock = new BeatClock(120, ctx);
  ctx.currentTime = ms / 1000;
  clock.update(true);
  return { clock, ctx };
}

describe('Beat windows open when the beat lands', () => {
  it('nothing fires in the ~100 ms before a beat', () => {
    const { clock } = clockAt(1450); // 50 ms before beat 4
    for (const b of [1, 2, 3, 4]) expect(clock.isOnBeat([b])).toBe(false);
    expect(clock.canGruntShoot()).toBe(false);
  });

  it('each gate opens just after its own beat', () => {
    expect(clockAt(1510).clock.canGruntShoot()).toBe(true); // beat 4
    expect(clockAt(510).clock.canGruntShoot()).toBe(true); // beat 2
    expect(clockAt(10).clock.canTankShoot()).toBe(true); // beat 1
    expect(clockAt(1010).clock.canTankShoot()).toBe(false); // beat 3
    expect(clockAt(1010).clock.canRusherExplode()).toBe(true); // beat 3
    expect(clockAt(510).clock.canRusherExplode()).toBe(false); // beat 2
  });

  it('the stabber window is the off-beat 3.5, not beat 4', () => {
    expect(clockAt(1260).clock.canStabberAttack()).toBe(true); // 3.5 + 10 ms
    expect(clockAt(1240).clock.canStabberAttack()).toBe(false); // before 3.5
    expect(clockAt(1510).clock.canStabberAttack()).toBe(false); // beat 4
  });

  it('onBeatOnce: once per beat per key, only while open', () => {
    const { clock, ctx } = clockAt(1005); // beat 3 just landed
    const enemy = Object.create(BaseEnemy.prototype);
    expect(enemy.onBeatOnce(clock, 'x', false)).toBe(false); // closed gate
    expect(enemy.onBeatOnce(clock, 'x', true)).toBe(true);
    ctx.currentTime = 1.03; // same window, a frame later
    clock.update(true);
    expect(enemy.onBeatOnce(clock, 'x', true)).toBe(false);
    expect(enemy.onBeatOnce(clock, 'y', true)).toBe(true); // other key
    ctx.currentTime = 1.51; // next beat
    clock.update(true);
    expect(enemy.onBeatOnce(clock, 'x', true)).toBe(true);
  });

  it('ambient speech waits for its gate instead of skipping its turn', () => {
    const enemy = Object.create(BaseEnemy.prototype);
    let gateOpen = false;
    const spoken = [];
    Object.assign(enemy, {
      type: 'grunt',
      ambientSpeechTimer: 0,
      speechCooldown: 0,
      maxSpeechCooldown: 0,
      getAmbientSpeechConfig: () => ({
        lines: ['HI'],
        gate: () => gateOpen,
        chance: 1,
      }),
      getContextValue: (k) =>
        k === 'audio' ? { speak: (_, l) => spoken.push(l) || true } : {},
    });
    enemy.updateAmbientSpeech(16); // timer up, gate closed: wait
    expect(spoken).toEqual([]);
    expect(enemy.ambientSpeechTimer).toBeLessThanOrEqual(0); // still waiting
    gateOpen = true;
    enemy.updateAmbientSpeech(16); // gate opens: one roll
    expect(spoken).toEqual(['HI']);
    expect(enemy.ambientSpeechTimer).toBeGreaterThan(0); // re-armed
  });
});
```

(`Object.create(BaseEnemy.prototype)` skips the constructor; `Grunt.deferred-death.test.js` already imports the entities under Vitest.)

- [ ] **Step 2: Confirm they fail.** Run `npx vitest run tests/unit/BeatOnce.test.js`. Expected: FAIL on the pre-beat, stabber, `onBeatOnce` and speech tests.

- [ ] **Step 3: BeatClock.** In `isOnBeat(beats)`, replace

```js
    // If specific beats requested, check if current beat is in the array
    if (!onBeat) return false;

    const currentBeat = this.getCurrentBeat() + 1; // Convert to 1-indexed for comparison
    return beats.includes(currentBeat);
```

with

```js
    // Specific beats: the window opens when that beat lands and lasts
    // `tolerance` ms, never before it, so no enemy acts ahead of the kick and
    // getTotalBeats() can't change inside a window
    const sinceBeat = this.beatInterval - this.getTimeToNextBeat();
    if (sinceBeat > this.tolerance) return false;
    return beats.includes(this.getCurrentBeat() + 1); // 1-indexed
```

Replace the three bodies:

```js
  canGruntShoot() {
    return this.isOnBeat([2, 4]);
  }

  canTankShoot() {
    return this.isOnBeat([1]);
  }

  canRusherExplode() {
    return this.isOnBeat([1, 3]);
  }
```

Replace `canStabberAttack()`'s body:

```js
  // STABBER: the off-beat 3.5. Opens halfway through beat 3 and lasts
  // `tolerance`, like the other gates.
  canStabberAttack() {
    this.update();
    if (this.cache.currentBeat !== 2) return false; // beat 3 (0-indexed)
    const sinceHalf =
      this.beatInterval - this.cache.timeToNextBeat - this.beatInterval / 2;
    return sinceHalf >= 0 && sinceHalf <= this.tolerance;
  }
```

- [ ] **Step 4: BaseEnemy.** Add:

```js
  /**
   * True the first time `open` is true within a beat (per key), then false
   * until the next beat. Beat-gated sounds use it so they play once per beat
   * instead of on every frame of the window.
   */
  onBeatOnce(beatClock, key, open) {
    if (!open || !beatClock) return false;
    const beat = beatClock.getTotalBeats();
    this._beatOnce ??= {};
    if (this._beatOnce[key] === beat) return false;
    this._beatOnce[key] = beat;
    return true;
  }
```

In `updateAmbientSpeech`, replace the trigger block with:

```js
    if (this.ambientSpeechTimer <= 0 && this.speechCooldown <= 0) {
      // Wait for this enemy's beat gate, then roll once. Trying on a single
      // frame would skip most turns now that gates are narrow.
      const config = this.getAmbientSpeechConfig();
      const beatClock = this.getContextValue('beatClock');
      if (config && !config.gate(beatClock)) return;
      if (config && random() < config.chance) this.triggerAmbientSpeech();

      // Reset timer for next speech using config
      const speechConfig =
        CONFIG.SPEECH_SETTINGS[this.type.toUpperCase()] ||
        CONFIG.SPEECH_SETTINGS.DEFAULT;
      this.ambientSpeechTimer = randomRange(
        speechConfig.AMBIENT_MIN * 60,
        speechConfig.AMBIENT_MAX * 60
      ); // seconds to frames
    }
```

In `triggerAmbientSpeech`, delete the two lines `const beatClock = …` and `if (!config.shouldSpeak(beatClock)) return;`. The caller now gates and rolls. Update the `getAmbientSpeechConfig` JSDoc to `{ lines, gate, chance }`.

In each subclass's `getAmbientSpeechConfig`, replace `shouldSpeak` with a gate plus a named per-attempt chance equal to today's effective rate (the time the gate is open × the old chance):

| File | New config | Constant |
|---|---|---|
| `Grunt.js` | `gate: (bc) => !!bc?.isOnBeat([2, 4]), chance: GRUNT_SPEECH_CHANCE` | `const GRUNT_SPEECH_CHANCE = 0.18;` |
| `Tank.js` | `gate: (bc) => !!bc?.isOnBeat([1]), chance: TANK_SPEECH_CHANCE` | `const TANK_SPEECH_CHANCE = 0.025;` |
| `Rusher.js` | `gate: (bc) => !!bc?.canRusherExplode(), chance: RUSHER_SPEECH_CHANCE` | `const RUSHER_SPEECH_CHANCE = 0.03;` |
| `Stabber.js` | `gate: (bc) => !!bc?.canStabberAttack(), chance: STABBER_SPEECH_CHANCE` | `const STABBER_SPEECH_CHANCE = 0.05;` |

- [ ] **Step 5:** Run `npx vitest run tests/unit/BeatOnce.test.js && pnpm run test:unit`. Expected: PASS. An existing BeatClock test that asserts the old pre-beat attribution or the old stabber window encodes the old behaviour: update it and name it in the commit message.

- [ ] **Step 6: Apply to the entities** (named per-beat chances at the top of each file).

`js/entities/Grunt.js`:

```js
// Per-beat chances for beat-gated grunt sounds (rolled once per beat)
const GRUNT_WEIRD_NOISE_CHANCE = 0.2;
const GRUNT_MOVE_SOUND_CHANCE = 0.5;
```

- Line 117: `if (this.onBeatOnce(beatClock, 'weirdNoise', beatClock?.isOnBeat([2, 4])) && random() < GRUNT_WEIRD_NOISE_CHANCE) {`
- Retreat (147-151): replace the nested ifs with `if (audio && this.onBeatOnce(beatClock, 'moveSound', beatClock?.isOnBeat([2, 4])) && random() < GRUNT_MOVE_SOUND_CHANCE) {`. Keep the single `audio.playSound('gruntRetreat', …)` inside.
- Advance (158-162): the same, with `'gruntAdvance'`.

`js/entities/Tank.js`:

```js
const TANK_POWER_SOUND_CHANCE = 0.5; // per beat 1 while charging
```

- Line 163: `if (this.onBeatOnce(beatClock, 'powerSound', beatClock.isOnBeat([1])) && random() < TANK_POWER_SOUND_CHANCE) {`
- Charge milestones (168-186): in both conditions, replace `beatClock.isOnBeat([1])` with `this.onBeatOnce(beatClock, 'chargeMilestone', beatClock.isOnBeat([1]))`.
- Known and left as is (Edward's decision): "CHARGING!" (`beatsSinceCharge >= 1 && < 2`) can't coincide with a beat 1, so it never plays. It's noted in the PR.

`js/entities/Rusher.js:94`, in the beat-gated branch: `this.maxExplosionTime = 0; // explode on the frame after the beat, not 5 frames later`. Leave the safety fuse further down unchanged.

`js/entities/StabberAttackHandler.js`:

```js
const STABBER_CHANT_CHANCE = 0.35; // per off-beat window
```

- **Chant (38-50):** replace `beatClock.canStabberAttack() && … && random() < 0.03` with `stabber.onBeatOnce(beatClock, 'chant', beatClock.canStabberAttack()) && … && random() < STABBER_CHANT_CHANCE`, keeping the other conditions.
- **Prepare → warning (`handlePreparingPhase`, the `beatClock.canStabberAttack()` in the transition):** replace it with `beatClock.isOnBeat([3])`, and update its comment to "Warn on beat 3; the dash follows half a beat later, on 3.5".
- **Telegraph countdown (`handleNormalMovement`, the `beatsUntilStab` block):** replace the two branches with:

```js
      // Beats until the next dash at 3.5 (beat index 2, halfway)
      let beatsUntilStab = 2.5 - (currentBeat + beatPhase);
      if (beatsUntilStab <= 0) beatsUntilStab += 4;
```

(Keep the existing `beatsUntilStab < 1.5 && rhythmFX` condition that follows.)

- [ ] **Step 7:** Run `pnpm run test:unit && <e2e>`. Expected: all PASS, including Task 3's grunt-shot timing.
- [ ] **Step 8: Format and commit**

```bash
npx prettier --write js/audio/BeatClock.js js/entities/BaseEnemy.js js/entities/Grunt.js js/entities/Tank.js js/entities/Rusher.js js/entities/Stabber.js js/entities/StabberAttackHandler.js tests/unit/BeatOnce.test.js
git add js/audio/BeatClock.js js/entities/BaseEnemy.js js/entities/Grunt.js js/entities/Tank.js js/entities/Rusher.js js/entities/Stabber.js js/entities/StabberAttackHandler.js tests/unit/BeatOnce.test.js
git commit -m "fix: beat-gated sounds once, when the beat lands; stabber dash on 3.5

Grunt move sounds, tank charge sounds and the stabber chant rolled a chance
on every frame of the ±100 ms window, stacking 2-18 detuned copies per beat.
The pre-beat half of a window counted as the previous beat, so beats-2-and-4
sounds also fired before beats 3 and 1. Beat-list gates now open when the
beat lands; gated sounds use onBeatOnce. The stabber warns on beat 3 and
dashes on the off-beat 3.5 (was ~4.25, on the snare); the rusher explodes on
the frame after its beat. Ambient speech waits for its gate so enemy
chatter keeps today's rate."
```

---

### Task 5: Short sounds are audible and don't click

**Measured.**
- **Silent player shot.** Its duration is 0.01 s ±10%, the same as `playTone`'s 10 ms fade-in, so the decay's end falls before the attack's. 48% of renders were silent, and the review measured the old shot at −57 to −60 dB. The rest click.
- **Detuned grunt shots.** `alienShoot` detunes ±12.5% (`frequencyVariationRange: 0.25`), so grunts firing together sound like a broken chord.
- **Quiet hits.** `hit` measured about 11 dB under the kick.

**Files:**
- Modify: `js/audio/SoundConfig.js`, `js/Audio.js` (`playTone`)
- Create: `tests/unit/SoundConfig.test.js`

- [ ] **Step 1: Write the failing test** (it pins the invariant behind the silent shot)

```js
// tests/unit/SoundConfig.test.js
import { describe, it, expect } from 'vitest';
import { SOUND_CONFIG, TONE_ATTACK_SEC } from '../../js/audio/SoundConfig.js';

describe('SOUND_CONFIG', () => {
  it('every tone is long enough for its attack plus a decay', () => {
    // playTone varies duration by ±10%
    for (const [name, cfg] of Object.entries(SOUND_CONFIG)) {
      expect(cfg.duration * 0.9, name).toBeGreaterThanOrEqual(
        3 * TONE_ATTACK_SEC
      );
    }
  });
});
```

- [ ] **Step 2: Confirm it fails.** Run `npx vitest run tests/unit/SoundConfig.test.js`.
- [ ] **Step 3: Implement.** In `js/audio/SoundConfig.js`:

```js
// playTone's fade-in. Every tone must be comfortably longer than this, or the
// decay's end lands before the attack's and the tone is silent or clicks.
export const TONE_ATTACK_SEC = 0.01;
```

Also change:
- `playerShoot.duration` 0.01 → 0.04;
- `alienShoot.frequencyVariationRange` 0.25 → 0.06;
- `hit.volume` 0.2 → 0.4.

In `js/Audio.js`, import `TONE_ATTACK_SEC`, and in `playTone()` replace `this.audioContext.currentTime + 0.01` with `this.audioContext.currentTime + TONE_ATTACK_SEC`.

- [ ] **Step 4:** Run `pnpm run test:unit && <e2e>`. Expected: PASS.
- [ ] **Step 5: Format and commit**

```bash
npx prettier --write js/audio/SoundConfig.js js/Audio.js tests/unit/SoundConfig.test.js
git add js/audio/SoundConfig.js js/Audio.js tests/unit/SoundConfig.test.js
git commit -m "fix: short sounds are audible and click-free; grunt shots less detuned"
```

---

### Task 6: Mix — speech on top, effects above the kick, tunable

Edward: *"The volume levels are wrong though. The speech is difficult to hear and everything is low compared to the kick drum beat."*

**Measured.**
- **Before the change:** effects sit 2–3 dB under the kick in the laptop band (the review's gate script on main: `alienShoot − kick` −2.5 to −2.7 dB, `gruntAdvance − kick` −1.6 to −2.0 dB).
- **Speech volume** is voice × distance × SFX master, 0.3–0.5 × 0.4–1.0 × 1, which measured 0.19–0.5. The cap is 1, and speech runs outside Web Audio.
- **The limiter** (−6 dB, 12:1) adds about 2.5 dB of make-up gain to the whole game. Changing it would move everything, so it stays. [review-added 2026-09-24]

**Approach** [review-added 2026-09-24]:
1. **Voices up:** raise them to near 1, with a distance floor of 0.7.
2. **Effects over the kick:** lower the beat track only. Its post-drive master goes 0.4 → 0.22 (−5.2 dB), so effects gain about 5 dB on the kick, and the kick drops about 5 dB (still audible on laptops; checked in Step 8). Effects stay at 1.0.
   - The beat-track master stays its own knob. `KICK.VOLUME` feeds the tanh drive, which normalises its output, so cutting it barely changes loudness.
3. **Duck for speech:** while `speechSynthesis.speaking`, polled every frame, the game dips: effects `DUCK_SFX_DB` −6, beat `DUCK_BEAT_DB` −3 (Edward: a small kick dip is fine).
   - Two duck gains sit in front of the limiter, so mute (on the existing gains) and ducking never fight.
   - The dip is capped at `DUCK_MAX_HOLD_MS` (5 s) from the last line, in case the speech engine stalls (Edward's decision).

**Files:**
- Modify: `js/config.js`: add `MIX`; raise the `VOICE_CONFIG` volumes; delete `TTS_SETTINGS.TTS_VOLUME`.
- Modify: `js/Audio.js`:
  - `initialize()` (the duck gains);
  - `applyMix()`, `syncDuck()`;
  - `speak()` volume;
  - delete the unused `setVolume()`.
- Modify: `js/audio/BeatTrack.js`: volume from `CONFIG.MIX`; connect to `audio.beatDuckGain`.
- Modify: `js/GameLoopDraw.js`: call `syncDuck()` every frame.
- Modify: `js/dev/TunePanel.js`: add the `MIX` knobs; listeners call `applyMix`.
- Test: `tests/gameplay-probe.test.js`

**Interfaces:**
- `CONFIG.MIX = { SFX_VOLUME, BEAT_TRACK_VOLUME, SPEECH_VOLUME, SPEECH_DISTANCE_FLOOR, DUCK_SFX_DB, DUCK_BEAT_DB, DUCK_RELEASE_SEC, DUCK_MAX_HOLD_MS }`
- `Audio.applyMix()`, `Audio.syncDuck()`
- `audio.duckGain`, `audio.beatDuckGain`, `audio._ducked`

- [ ] **Step 1: Write the failing E2E test**

```js
  test('Game dips while speech plays and always recovers', async ({ page }) => {
    await bootGame(page);
    await page.waitForFunction(() => window.audio?.duckGain);
    // Stand in for the speech engine: `speaking` with no events at all
    await page.evaluate(() => {
      window.__speaking = false;
      Object.defineProperty(window.audio, 'speechSynthesis', {
        value: {
          get speaking() {
            return window.__speaking;
          },
          speak() {},
          cancel() {},
          getVoices: () => [],
        },
        configurable: true,
      });
    });
    const speak = (on) =>
      page.evaluate((v) => {
        window.__speaking = v;
        if (v) window.audio.lastSpeechTime = Date.now();
      }, on);
    const ducked = () =>
      page.waitForFunction(
        () =>
          window.audio._ducked &&
          window.audio.duckGain.gain.value < 0.6 &&
          window.audio.beatDuckGain.gain.value < 0.8
      );
    const released = () =>
      page.waitForFunction(
        () =>
          !window.audio._ducked &&
          window.audio.duckGain.gain.value > 0.95 &&
          window.audio.beatDuckGain.gain.value > 0.95
      );

    await speak(true);
    await ducked();
    await speak(false); // ends with no event
    await released();

    await speak(true); // muting mid-speech releases the duck
    await ducked();
    await page.keyboard.press('m');
    await released();
    await page.keyboard.press('m');

    // A stalled engine (`speaking` stuck true) is released after the cap
    await page.evaluate(() => {
      window.__speaking = true;
      window.audio.lastSpeechTime = Date.now() - 6000;
    });
    await released();
  });
```

(Chrome reports `gain.value` late when no audio flows through a node, which a live game has. If `released`/`ducked` time out on `.value` alone while `_ducked` is right, see the vault note *chrome-audioparam-value-stale* and assign `.value` instead of `setTargetAtTime` in `syncDuck`.)

Run `<e2e> -g "Game dips"`. Expected: FAIL (no `duckGain`).

- [ ] **Step 2: Config.** In `js/config.js`, next to `BEAT_TRACK`:

```js
  // Mix. Speech runs outside Web Audio and can't go above full volume, so it
  // sits on top by keeping the beat lower and dipping the game while anyone
  // speaks. Tune live with ?tune.
  MIX: {
    SFX_VOLUME: 1, // game sound effects master
    BEAT_TRACK_VOLUME: 0.22, // kick + sub pulse, after the drive (was 0.4)
    SPEECH_VOLUME: 1, // multiplies every voice's volume
    SPEECH_DISTANCE_FLOOR: 0.7, // far-off enemies still this loud (was 0.4)
    DUCK_SFX_DB: -6, // effects dip while someone speaks
    DUCK_BEAT_DB: -3, // the kick dips less: it keeps time
    DUCK_RELEASE_SEC: 0.3,
    DUCK_MAX_HOLD_MS: 5000, // never stay ducked longer than this after a line starts
  },
```

`VOICE_CONFIG` volumes: player 0.5 → 1, grunt 0.3 → 0.8, rusher 0.35 → 0.8, tank 0.4 → 0.9, stabber 0.4 → 0.8. Delete `TTS_SETTINGS.TTS_VOLUME` (no readers).

- [ ] **Step 3: Audio.** At the top of `js/Audio.js`: `const DUCK_ATTACK_SEC = 0.05;`.

In `initialize()`, after the limiter is created:

```js
      // Duck gains in front of the limiter: effects and beat dip separately
      // while speech plays (see syncDuck). Mute stays on the gains before these.
      this.duckGain = this.audioContext.createGain();
      this.duckGain.connect(this.masterLimiter);
      this.beatDuckGain = this.audioContext.createGain();
      this.beatDuckGain.connect(this.masterLimiter);
      this._ducked = false;
```

- Replace `this.masterGain.connect(this.masterLimiter);` with `this.masterGain.connect(this.duckGain);`.
- Replace the initial `this.masterGain.gain.setValueAtTime(this.volume, …)` with `this.applyMix();`.
- Delete `setVolume()`: grep shows no callers, and `applyMix()` replaces it and respects mute.

Add:

```js
  // Apply CONFIG.MIX levels (at init and from the ?tune sliders)
  applyMix() {
    this.volume = CONFIG.MIX.SFX_VOLUME;
    if (this.masterGain) {
      this.masterGain.gain.value = this.enabled ? this.volume : 0;
    }
    window.beatTrack?.setVolume(CONFIG.MIX.BEAT_TRACK_VOLUME);
  }

  // Dip the game while the speech engine speaks. Reads the engine's own state
  // every frame, so a lost or late end event can't leave it ducked; capped in
  // case the engine stalls and reports speaking forever.
  syncDuck() {
    if (!this.duckGain) return;
    const { MIX } = CONFIG;
    const speaking =
      this.enabled &&
      !!this.speechSynthesis?.speaking &&
      Date.now() - this.lastSpeechTime < MIX.DUCK_MAX_HOLD_MS;
    if (speaking === this._ducked) return;
    this._ducked = speaking;
    const t = this.audioContext.currentTime;
    const timeConstant = (speaking ? DUCK_ATTACK_SEC : MIX.DUCK_RELEASE_SEC) / 3;
    for (const [node, db] of [
      [this.duckGain, MIX.DUCK_SFX_DB],
      [this.beatDuckGain, MIX.DUCK_BEAT_DB],
    ]) {
      node.gain.cancelScheduledValues(t);
      node.gain.setTargetAtTime(speaking ? 10 ** (db / 20) : 1, t, timeConstant);
    }
  }
```

In `speak()`, replace the `utterance.volume = Math.min(…)` block with:

```js
    // Speech is outside Web Audio and capped at 1: keep it near full and let
    // syncDuck dip the game while it plays
    const distance = Math.max(
      CONFIG.MIX.SPEECH_DISTANCE_FLOOR,
      calculateVolumeForPosition(ex, ey, playerX, playerY)
    );
    utterance.volume = Math.min(
      1,
      config.volume * distance * CONFIG.MIX.SPEECH_VOLUME
    );
```

(`lastSpeechTime` is already set in `speak()` for the cooldown; `syncDuck` reuses it.)

- [ ] **Step 4: BeatTrack.** In the constructor, change `this.volume = 0.4;` to `this.volume = CONFIG.MIX.BEAT_TRACK_VOLUME;`. In `start()`, replace the limiter lookup with:

```js
    // The beat's own duck gain (→ limiter): speech dips it by DUCK_BEAT_DB
    const bus =
      audio?.audioContext === this.ctx
        ? (audio.beatDuckGain ?? audio.masterLimiter)
        : null;
    this.masterGain.connect(bus ?? this.ctx.destination);
```

- [ ] **Step 5: Every frame.** In `js/GameLoopDraw.js`'s `runDraw`, directly after `window.frameCount = p.frameCount;`:

```js
  // Before the state switch, so speech on the game-over screen can't stick.
  // (Pauses in a hidden tab with the draw loop; the 5 s cap still applies.)
  window.audio?.syncDuck?.();
```

- [ ] **Step 6: `?tune`.** In `js/dev/TunePanel.js`, add `const MIX = 'MIX';` next to the other path constants, then these knobs:

```js
  [MIX, 'SFX_VOLUME', [0, 1, 0.01]],
  [MIX, 'BEAT_TRACK_VOLUME', [0, 1, 0.01]],
  [MIX, 'SPEECH_VOLUME', [0, 1, 0.05]],
  [MIX, 'SPEECH_DISTANCE_FLOOR', [0, 1, 0.05]],
  [MIX, 'DUCK_SFX_DB', [-24, 0, 1]],
  [MIX, 'DUCK_BEAT_DB', [-24, 0, 1]],
  [MIX, 'DUCK_RELEASE_SEC', [0.05, 1.5, 0.05]],
```

In both the `input` and `change` listeners, after `showJson();`, add `window.audio?.applyMix?.();`. The JSON line keeps its rename, because the module-level `PACING` constant shadows the name:

```js
    const { BEAT_TRACK, PACING: pacing, MIX: mix } = CONFIG;
    json.textContent = JSON.stringify(
      { BEAT_TRACK, PACING: pacing, MIX: mix },
      null,
      2
    );
```

- [ ] **Step 7:** Run `pnpm run lint && pnpm run test:unit && <e2e>`. Expected: all PASS. The existing mute test reads `audio.masterGain` and `beatTrack.masterGain`, where mute still acts. Update it if it compared against old full-volume numbers.

- [ ] **Step 8: The balance gate** [review-added 2026-09-24]. Measure **main, then the branch**, with a **separate** config, so `<e2e>` is untouched.

1. In the scratchpad, make `mix/mix.test.js` (below), plus `mix.config.js`: a copy of the `<e2e>` config with `testDir` set to the `mix/` folder.
2. **For main:**
   - `git -C /home/edward/projects/vibe worktree add --detach .worktrees/mix-main origin/main`, then `pnpm -C … install --frozen-lockfile`;
   - point a copy of `mix.config.js` at it (cwd plus port 5503);
   - run it;
   - `git worktree remove .worktrees/mix-main`.
3. **For the branch:** run `mix.config.js` on the worktree.
4. Never check out main inside `.worktrees/play-test-fixes`.

```js
import { test } from '@playwright/test';
test('mix levels', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.gameState?.gameState === 'title');
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => window.beatTrack?.isPlaying && window.audio?.masterLimiter
  );
  const r = await page.evaluate(async () => {
    const dB = (x) => Number((20 * Math.log10(Math.max(x, 1e-9))).toFixed(1));
    const { CONFIG } = await import('/js/config.js');
    const audio = window.audio;
    // No speech, so no ducking skews the numbers (works on main too)
    audio.speechEnabled = false;
    window.speechSynthesis.cancel();
    await new Promise((res) => setTimeout(res, 800));
    window.enemies.length = 0;
    window.spawnSystem.update = () => {};
    const ctx = audio.audioContext;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 250; // laptop-speaker band, as in PR #60
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    audio.masterLimiter.connect(hp);
    hp.connect(an);
    const buf = new Float32Array(an.fftSize);
    async function loudest(ms) {
      let best = 0;
      const end = performance.now() + ms;
      while (performance.now() < end) {
        an.getFloatTimeDomainData(buf);
        let s = 0;
        for (const v of buf) s += v * v;
        best = Math.max(best, Math.sqrt(s / buf.length));
        await new Promise((res) => setTimeout(res, 15));
      }
      return dB(best);
    }
    CONFIG.BEAT_TRACK.SUB_PULSE.ENABLED = false;
    const sfx = audio.masterGain.gain;
    const vol = sfx.value;
    sfx.value = 0;
    const kick = await loudest(1500);
    sfx.value = vol;
    CONFIG.BEAT_TRACK.KICK.ENABLED = false;
    const out = { kick };
    const { x, y } = window.player;
    for (const name of ['alienShoot', 'gruntAdvance', 'playerShoot', 'hit', 'explosion']) {
      const vals = [];
      for (let i = 0; i < 5; i++) {
        await new Promise((res) => setTimeout(res, 300));
        const p = loudest(300);
        audio.playSound(name, x, y);
        vals.push(await p);
      }
      vals.sort((a, b) => a - b);
      out[name] = vals[2]; // median of 5
    }
    CONFIG.BEAT_TRACK.KICK.ENABLED = true;
    return out;
  });
  console.log(JSON.stringify(r));
});
```

**Gate:**
- `alienShoot − kick` and `gruntAdvance − kick` each rise by at least 4 dB from main to the branch.
- The branch's kick is within 6 dB of main's.
- Nothing reads below −45 dB.

If it fails, adjust `BEAT_TRACK_VOLUME` and re-measure. Put both runs' numbers in the PR body.

- [ ] **Step 9: Format and commit**

```bash
npx prettier --write js/config.js js/Audio.js js/audio/BeatTrack.js js/GameLoopDraw.js js/dev/TunePanel.js tests/gameplay-probe.test.js
git add js/config.js js/Audio.js js/audio/BeatTrack.js js/GameLoopDraw.js js/dev/TunePanel.js tests/gameplay-probe.test.js
git commit -m "feat: mix with speech on top and effects above the kick

Voices near full with a 0.7 distance floor; the beat track -5 dB so effects
gain ~5 dB on the kick; while the speech engine is speaking (polled every
frame, capped at 5 s) effects dip 6 dB and the beat 3 dB. All in CONFIG.MIX
with ?tune sliders. Removes unused Audio.setVolume. Measured before/after:
<numbers from Step 8>."
```

---

### Task 7: "Level +1" in `?tune` doesn't touch the high score

Codex on PR #61: the button feeds fake points through `addScore()`, which saves them as a high score.

**Files:** `js/core/GameState.js`, `js/dev/TunePanel.js`, `tests/unit/GameState.test.js`

- [ ] **Step 1: Write the failing test**

```js
  it('a practice run (tune panel jumps) never sets a high score', () => {
    gs.practiceRun = true;
    gs.addScore(100000);
    expect(gs.highScore).toBe(0);
    gs.restart();
    expect(gs.practiceRun).toBe(false);
  });
```

- [ ] **Step 2: Confirm it fails.** Run `npx vitest run tests/unit/GameState.test.js -t "practice run"`.
- [ ] **Step 3: Implement.**
  - In `GameState`: add `this.practiceRun = false;` to the constructor and to `restart()`, and put `if (this.practiceRun) return;` as the first line of `updateHighScore()`.
  - In `TunePanel.js`'s Level +1 handler, set `gs.practiceRun = true;` before `gs.addScore(...)`.
- [ ] **Step 4:** Run `pnpm run test:unit`. Expected: PASS.
- [ ] **Step 5: Format and commit.** Run Prettier on the three files, then commit: `fix: ?tune Level +1 marks the run as practice so it can't set a high score`.
- [ ] **Step 6: PR note.** "If your saved high score came from Level +1, clear it in the browser console: `localStorage.removeItem('vibeHighScore')`." Don't wipe it in code; it may be a real score.

---

### Task 8: Remove the particle system that was never drawn (a memory leak)

**The leak.**
- `VisualEffectsManager` pushes particles in `addExplosion`, `addExplosionParticles`, `addMuzzleFlashParticles` and `addMotionTrail`.
- `updateParticles()` and `drawParticles()` have **never** been called on main.
- Rusher and stabber trails are also called from every draw frame. The list grew by about 1,600 in 5 s in the review's measurement, and nothing is ever shown.
- It belongs here as a small correctness fix (unbounded memory), not a timing one: the list is never iterated. [review-added 2026-09-24]

**Note for later** (not changed here): `updateParticles()` also held the only countdown that fades bloom and chromatic aberration, plus `_background.incrementTimeOffset()`. Because it was never called, those screen effects never fade on main. Record this as an open issue in the PR.

**Files:**
- Modify: `js/effects/VisualEffectsManager.js`: delete `this.particles`, the four `add*` particle methods, `updateParticles` and `drawParticles`, plus any particle pool, helpers and imports only they use.
- Remove the calls:
  - `js/systems/gameplay/EnemyUpdatePipeline.js` (`addExplosionParticles`). **Keep** the screen-effect calls beside it.
  - `js/entities/Rusher.js` and `js/entities/Stabber.js` (`addMotionTrail`), together with trail timers or `drawMotionTrail` wrappers that then do nothing.
  - `js/entities/StabberAttackHandler.js` (the six `visualEffectsManager.addExplosion` calls; find them by name, since Task 4 moved the lines).
- Remove an `if (visualEffectsManager)` block that then does nothing, and any lookup that's no longer used.
- Don't touch `explosionManager.addExplosion` (a different class, and drawn).

- [ ] **Step 1:** Remove the methods, fields and call sites.
- [ ] **Step 2:** Run `grep -rn "addExplosionParticles\|addMuzzleFlashParticles\|addMotionTrail\|updateParticles\|drawParticles\|visualEffectsManager.addExplosion\|drawMotionTrail" js tests`. Expected: no hits in `js/`.
- [ ] **Step 3:** Run `pnpm run lint && pnpm run test:unit && <e2e>`. Expected: all PASS.
- [ ] **Step 4: Format and commit** the changed files (explicit paths; add `js/entities/BaseEnemy.js` only if Step 1 changed it):

```bash
git commit -m "fix: remove never-drawn particle system that grew for the whole run

VisualEffectsManager's updateParticles/drawParticles were never called on
main, so every explosion and motion-trail particle was kept forever and never
shown. No visible change."
```

---

### Task 9: Wrap-up — verify, review, PR, listening pass

- [ ] **Step 1:** Run `pnpm run lint && pnpm run test:unit && <e2e>`. All green.
- [ ] **Step 2: Blind review round** (Edward's standing gate).
  - Run `pr-review-toolkit:code-reviewer` and `pr-review-toolkit:pr-test-analyzer` in parallel, read-only, on `git diff origin/main..HEAD`, telling neither what the other found.
  - Verify each finding against the code, fix, commit.
- [ ] **Step 3: Push and open the PR against `main`.** The body covers:
  - each commit's fix, with numbers;
  - the Step 8 before/after table;
  - the Task 7 high-score note;
  - open issues:
    - the tank's "CHARGING!" line never plays;
    - the tank's calm-down line (single-frame gated) is now rarer;
    - bloom and chromatic aberration never fade (pre-existing);
    - the kick is silent if BeatClock is ever on a different AudioContext than BeatTrack (nothing is logged).
  - Afterwards, post `@codex review`.
- [ ] **Step 4: Edward's listening pass is the gate.**
  1. Check nothing holds port 5500 (`ss -ltnp | grep 5500`).
  2. Start the server from the worktree: `pnpm --dir .worktrees/play-test-fixes run dev`.
  3. Edward plays at `http://localhost:5500/?tune`, on laptop speakers and with headphones.
  4. Things to listen for:
     - the stabber's dash on the off-beat;
     - whether the kick and grunt shots flam (0–30 ms apart). A flam would be fixed in a follow-up by scheduling gated sounds at the exact beat time.
     - the duck amounts;
     - the overall balance.
  5. Adjust `CONFIG.MIX`/`BEAT_TRACK` from his notes or his pasted JSON before merging.
