/**
 * Synthesize Rule
 * Reads recent observations and drafts .mdc rule suggestions when the same
 * failure pattern recurs. For now, focuses on math-utils and instance-mode.
 */

import {
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const AI_LEDGER = join(ROOT, '.ai', 'ledger');
const RULES_DIR = join(ROOT, '.cursor', 'rules');

function readObservations() {
  if (!existsSync(AI_LEDGER)) return [];
  const files = readdirSync(AI_LEDGER).filter((f) => f.startsWith('events-'));
  const rows = [];
  for (const f of files) {
    const raw = readFileSync(join(AI_LEDGER, f), 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line));
      } catch {}
    }
  }
  return rows;
}

function cluster(observations) {
  const counts = new Map();
  for (const o of observations) {
    if (o.source !== 'scan:consistency' || o.outcome !== 'fail') continue;
    const key = 'consistency-fail';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function draftRule(slug, content) {
  if (!existsSync(RULES_DIR)) mkdirSync(RULES_DIR, { recursive: true });
  const now = new Date();
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const file = join(RULES_DIR, `i-${slug}-${d}-01.mdc`);
  const body = `---\nalwaysApply: false\n---\n\nID: DRAFT-${d}-01\nTitle: Draft: ${slug}\nContext: Auto-generated draft based on repeated observations.\nPolicy:\n  - Address repeated consistency failures.\n  - Convert offenders to imports from @vibe/core and enforce instance-mode.\nEnforcement: Extend scanners and create targeted autofixes.\nScope: packages/**\nRationale: Reduce recurring review noise and regressions.\nStatus: Draft\nAdded: ${now.toISOString().slice(0, 10)}\n`;
  writeFileSync(file, body, 'utf8');
  return file;
}

function main() {
  const obs = readObservations();
  const clusters = cluster(obs);
  const count = clusters.get('consistency-fail') || 0;
  if (count >= 3) {
    const f = draftRule('consistency-recurring', {});
    console.log('✍️  Drafted rule:', f);
  } else {
    console.log('ℹ️  Not enough signal to draft rules today.');
  }
}

if (import.meta.main) main();

export { main as synthesizeRule };
