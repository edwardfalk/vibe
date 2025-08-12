/**
 * Learning Orchestrator
 * Collects signals (consistency scans, sounds validation, Playwright probes, CodeRabbit actionable summary)
 * and appends standardized observations to `.ai/ledger/events-YYYYMM.jsonl`.
 */

import { spawn } from 'child_process';
import { mkdirSync, existsSync, appendFileSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const AI_DIR = join(ROOT, '.ai');
const LEDGER_DIR = join(AI_DIR, 'ledger');

function runCmd(command, args = []) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { shell: true, windowsHide: true, stdio: 'pipe' });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.stderr.on('data', (d) => (err += d.toString()));
    proc.on('close', (code) => resolve({ code, out, err }));
  });
}

function ensureDirs() {
  if (!existsSync(AI_DIR)) mkdirSync(AI_DIR);
  if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR);
}

function ledgerPath() {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return join(LEDGER_DIR, `events-${ym}.jsonl`);
}

function writeObservation(obs) {
  const line = JSON.stringify(obs);
  appendFileSync(ledgerPath(), line + '\n', 'utf8');
}

async function collect() {
  ensureDirs();

  const ts = new Date().toISOString();
  const observations = [];

  // 1) Consistency scan
  const scan = await runCmd('bun', ['run', 'scan:consistency']);
  observations.push({
    ts,
    source: 'scan:consistency',
    outcome: scan.code === 0 ? 'success' : 'fail',
    code: scan.code,
    out: scan.out.slice(-4000),
  });

  // 2) Validate sounds
  const sounds = await runCmd('bun', ['run', 'validate:sounds']);
  observations.push({
    ts,
    source: 'validate:sounds',
    outcome: sounds.code === 0 ? 'success' : 'fail',
    code: sounds.code,
    out: sounds.out.slice(-4000),
  });

  // 3) Playwright probes (orchestrated)
  const tests = await runCmd('bun', ['run', 'test:orchestrated']);
  observations.push({
    ts,
    source: 'test:orchestrated',
    outcome: tests.code === 0 ? 'success' : 'fail',
    code: tests.code,
    out: tests.out.slice(-4000),
  });

  // 4) CodeRabbit actionable summary (optional)
  try {
    const crPath = join(ROOT, 'coderabbit-reviews', 'actionable-summary.json');
    const raw = readFileSync(crPath, 'utf8');
    const parsed = JSON.parse(raw);
    observations.push({
      ts,
      source: 'coderabbit',
      outcome: 'success',
      summary: parsed,
    });
  } catch (e) {
    observations.push({
      ts,
      source: 'coderabbit',
      outcome: 'skip',
      error: String(e.message || e),
    });
  }

  // Write all observations
  for (const o of observations) writeObservation(o);

  const failed = observations.filter((o) => o.outcome === 'fail');
  if (failed.length) {
    console.log(`❌ Learning collect recorded ${failed.length} failures.`);
    process.exitCode = 1;
  } else {
    console.log(
      '✅ Learning collect completed with all green or skipped sources.'
    );
  }
}

if (import.meta.main) {
  collect();
}

export { collect };
