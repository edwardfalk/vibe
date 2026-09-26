/**
 * Proves a refactor changes nothing the game draws or plays: replays it from
 * a git ref and from the working tree with the same seeds and input, and
 * compares their per-frame fingerprints (see replay.js, and docs/TESTING.md
 * for what it can't see).
 *
 * Usage: node tests/replay/compare.js [ref]   (ref defaults to main)
 * Exits 1 if any frame differs, and names the first one. To see what
 * differs, rerun with DETAIL=<frame>-<frame>: the replays then write those
 * frames in full, and the output files are kept for you to diff.
 */
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ref = process.argv[2] ?? 'main';
const here = new URL('.', import.meta.url).pathname;
const tree = join(here, '../..');
const replay = join(here, 'replay.js');

// [frames, seed, mode]: a normal run, and two that climb to later levels
const RUNS = [
  [6000, 987654, 'normal'],
  [8000, 4242, 'tough'],
  [5000, 777, 'tough'],
];

const tmp = mkdtempSync(join(tmpdir(), 'vibe-replay-'));
const base = join(tmp, 'base');
const archive = join(tmp, 'base.tar');
// If one replay fails, stop the others instead of leaving them running
const abort = new AbortController();
const results = [];
try {
  execFileSync('git', ['archive', '-o', archive, ref, 'js', 'package.json'], {
    cwd: tree,
  });
  mkdirSync(base);
  execFileSync('tar', ['-x', '-f', archive, '-C', base]);

  // All six replays at once; each is single-threaded
  await Promise.all(
    RUNS.flatMap(([frames, seed, mode], r) =>
      [base, tree].map((root, i) => {
        const out = join(tmp, `${r}-${i}.txt`);
        const args = [replay, root, out, frames, seed, mode];
        return run('node', args, { signal: abort.signal }).then(
          () => ((results[r] ??= [])[i] = readFileSync(out, 'utf8').split('\n'))
        );
      })
    )
  ).catch((err) => {
    abort.abort();
    throw err;
  });
} finally {
  if (!process.env.DETAIL) rmSync(tmp, { recursive: true, force: true });
}

let same = true;
RUNS.forEach(([frames, seed, mode], r) => {
  const [a, b] = results[r];
  // Compare up to the longer file, so a replay that stopped early differs
  const at = [...Array(Math.max(a.length, b.length)).keys()].find(
    (i) => a[i] !== b[i]
  );
  const label = `${frames} frames, seed ${seed}, ${mode}`;
  if (at === undefined) {
    console.log(`same     ${label}`);
    return;
  }
  same = false;
  const frame = Number((a[at] ?? b[at]).match(/^F(\d+)/)?.[1] ?? at);
  console.log(`DIFFERS  ${label}: first at frame ${frame}`);
  const files = [0, 1].map((i) => join(tmp, `${r}-${i}.txt`));
  console.log(
    process.env.DETAIL
      ? `  diff ${files.join(' ')}`
      : `  To see it: DETAIL=${frame}-${frame} node tests/replay/compare.js ${ref}`
  );
});
process.exit(same ? 0 : 1);
