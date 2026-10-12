# Testing

## Suites

| Suite                | Command              | What it covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (Vitest)        | `pnpm run test:unit` | logic: the beat clock, spawning and pacing, damage results, the bullet pool, beat-gated sounds, player fire; each enemy's and the hero's behaviour, look and sounds; the deaths and GAME OVER's wait; the bomb's bang, cloud and "uh oh"; the heard kick, the sky, the pitch grid and the hum; the speech engines, levels, effect chains, the pitch reader and Voicebox's tuning                                                                                                |
| Browser (Playwright) | `pnpm run test:e2e`  | the real game in headless Chromium: title screen, input, combat, scoring, a fight with every enemy type that fails on any console error, the Dude's death scene and game over, mute, restart; the kick and enemy shots on the beat; the hum under the kick, and a broken hum costing only itself; the sky in every state; the voice playground, the speech engines in a worker, every shipped line through its speaker's chain, and lines and the bomb's count on the beat grid |
| Everything           | `pnpm run test`      | unit tests, then browser tests; CI runs lint, then these two, so the fast failures show first                                                                                                                                                                                                                                                                                                                                                                                   |

Useful variants:

- `pnpm run test:unit:watch` reruns unit tests as you edit.
- `pnpm run test:e2e:headed` shows the browser; `pnpm run test:e2e:debug` opens the Playwright inspector.
- `npx vitest run tests/unit/BeatClock.test.js` runs one unit file.

The browser tests start their own server on port 5500, or reuse a dev server that's already running there. The first time, install the browser with `npx playwright install chromium`.

## Dev tools

These run through Playwright too. They're for measuring and looking, so CI doesn't run them:

- `pnpm run playtest`: a bot plays and reports frame rate, the work per frame in ms (avg, p50, p95) and pacing. Fps is capped at 60, so compare the ms figures to see whether a change made frames cheaper. It runs Chromium on the machine's real GPU, so the sky draws its shader; ms figures from before the sky (September 2026) don't compare. `LEVEL=8` starts it at level 8, and `DURATION` sets how long it plays in ms (30000 by default: pacing past level 2 needs `DURATION=90000`). It prints the sky's mode, and its numbers count only in `full`. It fails if the game logged a console error, after printing and saving its report.
- `pnpm run screenshot`: screenshots of a running game.
- `pnpm run test:beats`: records when enemies act and checks each lands on its beat.
- `pnpm run demo`: records the bot playing for the README's `docs/media/demo.webp`: a video in `test-results/`, 40 s (`DURATION`) from level 5 (`LEVEL`), on the GPU like the playtest. The bot walks into tanks' backs to bomb them. Pick 16 s and make the animation with `ffmpeg -ss 4 -t 16 -i test-results/demo.js-demo-demo/video.webm -vf fps=15 -c:v libwebp_anim -quality 75 -compression_level 6 -loop 0 docs/media/demo.webp`. WebP, not GIF: the nebula moves behind everything and needs more than 256 colours, so a GIF of the same 16 s came out at 9–21 MB with its colours cut, where the WebP is about 4 MB.

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

CI and the browser tests run Chromium without a GPU, so they draw the sky flat unless a test asks for `?sky=full`, as the sky tests do.

The Playwright config has five projects (`e2e`, `playtest`, `screenshot`, `beats`, `demo`). The scripts always pick one. A bare `npx playwright test` runs all five.

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
