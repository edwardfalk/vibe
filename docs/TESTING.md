# Testing

## Suites

| Suite                | Command              | What it covers                                                                                                                                         |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit (Vitest)        | `pnpm run test:unit` | logic such as the beat clock, spawning and pacing, damage results, the bullet pool, beat-gated sounds, player fire                                     |
| Browser (Playwright) | `pnpm run test:e2e`  | the real game in headless Chromium: title screen, input, combat, scoring, game over, mute, restart, and that the kick and enemy shots land on the beat |
| Everything           | `pnpm run test`      | unit tests, then browser tests; CI runs lint, then these two, so the fast failures show first                                                          |

Useful variants:

- `pnpm run test:unit:watch` reruns unit tests as you edit.
- `pnpm run test:e2e:headed` shows the browser; `pnpm run test:e2e:debug` opens the Playwright inspector.
- `npx vitest run tests/unit/BeatClock.test.js` runs one unit file.

The browser tests start their own server on port 5500, or reuse a dev server that's already running there. The first time, install the browser with `npx playwright install chromium`.

## Dev tools

These run through Playwright too. They're for measuring and looking, so CI doesn't run them:

- `pnpm run playtest`: a bot plays and reports frame rate, the work per frame in ms (avg, p50, p95) and pacing. Fps is capped at 60, so compare the ms figures to see whether a change made frames cheaper.
- `pnpm run screenshot`: screenshots of a running game.
- `pnpm run test:beats`: records when enemies act and checks each lands on its beat.

## Proving a refactor changes nothing

`pnpm run compare` (or `node tests/replay/compare.js <ref>`, which compares against `main` by default) replays the game headless from that git ref and from your working tree. Both replays get the same seeded random numbers, clock and scripted input, and three runs climb to later levels. It compares a fingerprint of each frame: every shape drawn with its full style and position, plus every sound, speech line and game-state change. `same` on all three runs means nothing a player sees or hears changed. It takes about two minutes.

When a run differs, it names the first frame. Rerun with `DETAIL=<frame>-<frame>` to keep the two outputs with that frame written in full, and diff them. A change that is meant to show, such as a new enemy or a tuned number, will of course differ. The tool is for refactors.

The Playwright config has four projects (`e2e`, `playtest`, `screenshot`, `beats`). The scripts always pick one. A bare `npx playwright test` runs all four.

## Listing the tests

Rather than a copied list that goes stale:

```bash
npx playwright test --list --project=e2e
ls tests/unit
```

## Manual checklist

Before merging a larger change, also check by hand:

- [ ] `pnpm run test` passes.
- [ ] `pnpm run lint` passes.
- [ ] The game boots in a browser.
- [ ] Player input works: WASD, shooting, arrow-key aim.
- [ ] Enemies spawn, take damage, die and are cleaned up.
- [ ] Score and kill streak update on kills and when you take damage.
- [ ] Bombs and area damage still knock back and can end the game.
