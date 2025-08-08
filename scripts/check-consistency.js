/*
  check-consistency.js
  ---------------------
  Static guardrails for Vibe codebase.

  Checks:
  1) p5 instance-mode: flags unprefixed p5 calls (fill, ellipse, push, etc.)
  2) Math trig: flags direct Math.(cos|sin|atan2|sqrt) usage in packages/**.js

  Usage:
    bun run scripts/check-consistency.js            # run all checks
    bun run scripts/check-consistency.js instance   # instance-mode only
    bun run scripts/check-consistency.js math       # math only
*/

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const TARGET_DIR = join(ROOT, 'packages');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function runChecks(filter = 'all') {
  const files = walk(TARGET_DIR);
  const violations = [];

  const p5Regex =
    /(^|[^\.\w])(fill|stroke|ellipse|rect|line|text(?!Width|Ascent|Descent)|image|noFill|noStroke|push|pop|translate|rotate|beginShape|endShape|vertex)\(/gm;
  const mathRegex = /Math\.(cos|sin|atan2|sqrt|min|max)\(/gm;

  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    // Strip block and line comments to avoid false positives in comments
    const content = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    if (filter === 'all' || filter === 'instance') {
      let m;
      while ((m = p5Regex.exec(content))) {
        const idx = m.index;
        const line = content.slice(0, idx).split('\n').length;
        violations.push({
          file,
          line,
          rule: 'instance-mode',
          msg: `Unprefixed p5 call '${m[2]}('`,
        });
      }
    }
    if (filter === 'all' || filter === 'math') {
      let m;
      while ((m = mathRegex.exec(content))) {
        const idx = m.index;
        const line = content.slice(0, idx).split('\n').length;
        violations.push({
          file,
          line,
          rule: 'math-utils',
          msg: `Use @vibe/core '${m[1]}' instead of Math.${m[1]}()`,
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log('✅ Consistency checks passed.');
    return 0;
  }

  console.log('❌ Consistency violations found:');
  for (const v of violations) {
    console.log(` - [${v.rule}] ${v.file}:${v.line} → ${v.msg}`);
  }
  return 1;
}

if (import.meta.main) {
  const arg = process.argv[2];
  let filter = 'all';
  if (arg === 'instance') filter = 'instance';
  if (arg === 'math') filter = 'math';
  const code = runChecks(filter);
  process.exit(code);
}

export { runChecks };
