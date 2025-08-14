/**
 * Gameplay/Balance Tuner (whitelisted keys)
 * Runs small grid search or epsilon-greedy bandit over allowed config keys
 * and evaluates via orchestrated probes. Produces a JSON report.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

const ROOT = process.cwd();
const REPORT_PATH = join(ROOT, '.ai', 'metrics', 'tuning-report.json');

const WHITELIST = new Set([
  'packages/fx/src/effectsConfig.js:global.lodMultiplier',
  'packages/fx/src/effectsConfig.js:stabber.burst.count',
  'packages/fx/src/effectsConfig.js:grunt.burst.count',
  'packages/core/src/fxConfig.js:explosionFX.particleMultiplier',
]);

async function runCmd(command, args = []) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      shell: true,
      windowsHide: true,
      stdio: 'pipe',
    });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.stderr.on('data', (d) => (err += d.toString()));
    proc.on('close', (code) => resolve({ code, out, err }));
  });
}

function patchFileNumber(path, matcher, value) {
  const src = readFileSync(path, 'utf8');
  const next = src.replace(
    matcher,
    (m, pfx, num, sfx) => `${pfx}${value}${sfx}`
  );
  if (src === next) return false;
  writeFileSync(path, next, 'utf8');
  return true;
}

function getPlan(key) {
  // Define simple 3-step grids per key
  switch (key) {
    case 'packages/fx/src/effectsConfig.js:global.lodMultiplier':
      return {
        file: 'packages/fx/src/effectsConfig.js',
        matcher: /(lodMultiplier:\s*)([0-9.]+)(,)/,
        candidates: [0.8, 1.0, 1.2],
      };
    case 'packages/fx/src/effectsConfig.js:stabber.burst.count':
      return {
        file: 'packages/fx/src/effectsConfig.js',
        matcher: /(stabber:[\s\S]*?burst:[\s\S]*?count:\s*)([0-9]+)(,)/,
        candidates: [10, 14, 18],
      };
    case 'packages/fx/src/effectsConfig.js:grunt.burst.count':
      return {
        file: 'packages/fx/src/effectsConfig.js',
        matcher: /(grunt:[\s\S]*?burst:[\s\S]*?count:\s*)([0-9]+)(,)/,
        candidates: [10, 14, 18],
      };
    case 'packages/core/src/fxConfig.js:explosionFX.particleMultiplier':
      return {
        file: 'packages/core/src/fxConfig.js',
        matcher: /(particleMultiplier:\s*)([0-9.]+)(,)/,
        candidates: [1.0, 1.2, 1.4],
      };
    default:
      return null;
  }
}

async function evaluateVariant() {
  // Use orchestrated tests; return 1 for success, 0 for fail
  const res = await runCmd('bun', ['run', 'test:orchestrated']);
  return res.code === 0 ? 1 : 0;
}

async function main() {
  const key = process.argv[2];
  if (!WHITELIST.has(key)) {
    console.error('Key not whitelisted:', key);
    process.exit(2);
  }
  const plan = getPlan(key);
  if (!plan) {
    console.error('No plan for key:', key);
    process.exit(2);
  }

  const original = readFileSync(plan.file, 'utf8');
  const report = { key, variants: [] };

  for (const val of plan.candidates) {
    // Patch
    const ok = patchFileNumber(plan.file, plan.matcher, val);
    if (!ok) {
      // If regex failed, abort cleanly
      console.error('Patch failed for', key, 'value', val);
      break;
    }
    // Evaluate
    const reward = await evaluateVariant();
    report.variants.push({ value: val, reward });
  }

  // Restore original file
  writeFileSync(plan.file, original, 'utf8');

  // Persist report
  const dir = join(ROOT, '.ai', 'metrics');
  try {
    await Bun.$`mkdir -p ${dir}`;
  } catch {}
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log('📈 Tuning report written to', REPORT_PATH);
}

if (import.meta.main) main();

export { main as tune };
