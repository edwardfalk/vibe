# Testing

## Suites

| Suite                | Command              | What it covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit (Vitest)        | `pnpm run test:unit` | logic such as the beat clock, spawning and pacing, damage results, the bullet pool, beat-gated sounds, player fire, the heard kick and the sky, the pitch grid and the hum, the speech engines, levels, effect chains and Voicebox, and the deaths: when a grunt pops and which chord tone it takes, the blow from every kind of kill, the Dude's death scene and GAME OVER's wait, and their sounds' pitches                                                                                                                                                                                                                        |
| Browser (Playwright) | `pnpm run test:e2e`  | the real game in headless Chromium: title screen, input, combat, scoring, game over and the Dude's death scene before it, mute, restart, that the kick and enemy shots land on the beat, that the hum plays, sits under the kick (quiet and on a full screen) and that a broken hum costs only itself, and that the sky draws in every state, its shader links, and the resting sky leaves the gameplay colours alone; the voice playground, the speech engines in a browser worker, every shipped line through its speaker's chain, and that in a running game every line starts on the beat grid and the bomb's count on its beats |
| Everything           | `pnpm run test`      | unit tests, then browser tests; CI runs lint, then these two, so the fast failures show first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Useful variants:

- `pnpm run test:unit:watch` reruns unit tests as you edit.
- `pnpm run test:e2e:headed` shows the browser; `pnpm run test:e2e:debug` opens the Playwright inspector.
- `npx vitest run tests/unit/BeatClock.test.js` runs one unit file.

The browser tests start their own server on port 5500, or reuse a dev server that's already running there. The first time, install the browser with `npx playwright install chromium`.

## Dev tools

These run through Playwright too. They're for measuring and looking, so CI doesn't run them:

- `pnpm run playtest`: a bot plays and reports frame rate, the work per frame in ms (avg, p50, p95) and pacing. Fps is capped at 60, so compare the ms figures to see whether a change made frames cheaper. It runs Chromium on the machine's real GPU, so the sky draws its shader; ms figures from before the sky (September 2026) don't compare. `LEVEL=8` starts it at level 8. It prints the sky's mode, and its numbers count only in `full`.
- `pnpm run screenshot`: screenshots of a running game.
- `pnpm run test:beats`: records when enemies act and checks each lands on its beat.

## Proving a refactor changes nothing

`pnpm run compare` replays the game headless from a git ref and from your working tree. Run it as `node tests/replay/compare.js <ref>`; the ref defaults to your local `main`. It takes about two minutes.

**What it records.** Each frame is reduced to a fingerprint of what the game did:

- every shape drawn, with its full style and position;
- every Web Audio node, connection and parameter change, including buffer contents and scheduled starts and stops;
- every speech line with its speaker, gain and pan (Node has no Worker, so a stand-in Voicebox logs each line);
- every game-state change.

Both replays get the same seeded random numbers, clock and scripted input. The run starts the way a player starts it, with a key on the title screen. There are three runs: one normal, and two that climb to later levels.

**Reading the result.** `same` on all three runs means the game drew and played exactly the same things. When a run differs, it names the first frame that differs. Rerun with `DETAIL=<frame>-<frame>` to keep the two outputs with that frame written in full, then diff them. A change that is meant to show, such as a new enemy or a tuned number, will of course differ. The tool is for refactors.

**What it doesn't see:**

- the HTML parts of the page (`index.html`, the title overlay, the toast);
- code outside `js/`;
- speech itself and its ducking: the stand-in Voicebox renders nothing and never reports that anyone is speaking. It logs a line as the game asks for it, so a respelling (Voicebox's, unit-tested) doesn't show;
- a Web Audio node that is never connected. It makes no sound, so it is left out on purpose;
- the sky's shader: Node has no WebGL, so the replay records the flat sky (its buffers show up as `UNKNOWN.pixelDensity` in a `DETAIL` dump).

CI and the browser tests run Chromium without a GPU, so they draw the sky flat; the readability test forces `?sky=full` for its one fixed frame.

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
- [ ] A grunt pops on the beat, and the Dude's death scene plays before GAME OVER.
