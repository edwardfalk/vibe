/*
  sync-docs-site-rules.js
  -----------------------
  Mirrors `.cursor/rules/*.mdc` into `docs-site/rules/` so the Docsify site
  always reflects the latest rules. Keeps file names identical.

  Usage:
    bun run scripts/sync-docs-site-rules.js
*/

import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve('.');
const SRC_DIR = join(ROOT, '.cursor', 'rules');
const DEST_DIR = join(ROOT, 'docs-site', 'rules');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function cleanDest(dir) {
  // Remove previous .mdc files to avoid stale content; keep other assets.
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isFile() && name.name.endsWith('.mdc')) {
      rmSync(p);
    }
  }
}

function transform(content) {
  // Minimal noop transform. If we later need to rewrite links for the site, do it here.
  // Example (disabled): strip trailing spaces, normalize newlines
  return content;
}

function sync() {
  ensureDir(DEST_DIR);
  cleanDest(DEST_DIR);

  const entries = readdirSync(SRC_DIR, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.mdc')) continue;
    const src = join(SRC_DIR, entry.name);
    const dest = join(DEST_DIR, entry.name);
    const raw = readFileSync(src, 'utf8');
    const out = transform(raw);
    writeFileSync(dest, out, 'utf8');
    count++;
  }
  console.log(`✅ Synced ${count} rule file(s) to docs-site/rules/`);
}

if (import.meta.main) {
  sync();
}

export { sync };
