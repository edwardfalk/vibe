#!/usr/bin/env bun
/**
 * Simple doc/workflow drift guard.
 * Ensures critical command strings remain consistent across README, docs, and rules.
 * If any expected string is missing, exits with code 1 so CI fails.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const targets = [
  'README.md',
  join('docs', 'DEV_SERVER_WORKFLOW.md'),
  join('.cursor', 'rules', 'ar-dev-server-process-management.mdc'),
];

// Commands that must appear in all docs/rules
const requiredStrings = [
  'bun run dev:start',
  'bun run dev:stop',
  'bun run dev:status',
  'bun run dev:restart',
];

let ok = true;
for (const file of targets) {
  const content = readFileSync(file, 'utf8');
  for (const str of requiredStrings) {
    if (!content.includes(str)) {
      console.error(`❌ Drift detected: "${str}" missing in ${file}`);
      ok = false;
    }
  }
}
if (!ok) {
  console.error('Aborting due to documentation/workflow drift.');
  process.exit(1);
}
console.log('✅ Doc drift check passed.');
