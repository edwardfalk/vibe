#!/usr/bin/env bun
/**
 * scan-no-tier3-globals.js – flags window.enemies etc. usage in new/edited code.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, 'packages');
const LEGACY_ALLOWLIST = [/GameLoop\.js$/, /tests\//];

const PATTERN =
  /window\.(enemies|playerBullets|enemyBullets|activeBombs|profilerOverlay)/;
const OFFENDERS = [];

function allowed(file) {
  return LEGACY_ALLOWLIST.some((rx) => rx.test(file));
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (entry.endsWith('.js')) scanFile(full);
  }
}

function scanFile(file) {
  if (allowed(file)) return;
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (PATTERN.test(line)) {
      OFFENDERS.push(`${file}:${idx + 1}: ${line.trim()}`);
    }
  });
}

walk(SRC_DIR);

if (OFFENDERS.length) {
  const strict = process.env.NO_TIER3_GLOBALS_STRICT === '1';
  const header = strict
    ? '\x1b[31mTier-3 globals scan violations (strict)\x1b[0m'
    : '\x1b[33mTier-3 globals scan warnings (advisory)\x1b[0m';
  console.error(header);
  OFFENDERS.forEach((m) => console.error('  ' + m));
  if (strict) process.exit(1);
  process.exit(0);
} else {
  console.log('✅ No Tier-3 global references found.');
}
