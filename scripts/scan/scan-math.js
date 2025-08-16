#!/usr/bin/env bun
/**
 * scan-math.js – CI helper that flags raw Math.PI / p5 globals misuse
 * Reports files/line numbers and exits with code 1 on violations.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, 'packages');
const BASELINE_PATH = join(ROOT, 'scripts', 'scan', 'math-baseline.json');

// Allow-list: files that intentionally use Math.PI (definitions, audio math, etc.)
const ALLOW_PATHS = [/mathUtils\.js$/, /Audio\.js$/];
const OFFENDERS = [];
const FILE_PATTERN = /\.js$/;

const baseRegexes = [
  /(?<![\.\w])Math\.PI/, // Math.PI not preceded by p.
  /\b2\s*\*\s*Math\.PI\b/,
];

const randomRegex = /(?<![\.\w])random\(/;
const distRegex = /(?<![\.\w])dist\(/;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (FILE_PATTERN.test(entry)) scanFile(full);
  }
}

function scanFile(file) {
  if (ALLOW_PATHS.some((rx) => rx.test(file))) return;
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);

  const importLine = lines.find((l) =>
    /import\s+\{[^}]*\brandom\b[^}]*}|import\s+\{[^}]*\bdist\b[^}]*}/.test(l)
  );
  const importsRandom = importLine?.includes('random');
  const importsDist = importLine?.includes('dist');

  lines.forEach((line, idx) => {
    // always check base regexes (Math.PI, 2*Math.PI)
    for (const rx of baseRegexes) {
      if (rx.test(line)) {
        OFFENDERS.push(`${file}:${idx + 1}: ${line.trim()}`);
        break;
      }
    }

    if (!importsRandom && randomRegex.test(line)) {
      OFFENDERS.push(`${file}:${idx + 1}: ${line.trim()}`);
    }
    if (!importsDist && distRegex.test(line)) {
      OFFENDERS.push(`${file}:${idx + 1}: ${line.trim()}`);
    }
  });
}

walk(SRC_DIR);

// ---------------------------------------------------------------------------
// Baseline comparison (only in strict mode)
// ---------------------------------------------------------------------------

const argsStrict = process.argv.includes('--strict');
const strict = argsStrict || process.env.MATH_SCAN_STRICT === '1';

let newViolations = OFFENDERS;
if (strict) {
  let baseline = [];
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch (_) {
    // No baseline yet – treat as empty, will create later.
  }

  // Diff: violations not present in baseline
  newViolations = OFFENDERS.filter((v) => !baseline.includes(v));

  // Auto-update baseline when CI passes intentionally – devs must run
  if (process.argv.includes('--update-baseline')) {
    Bun.write(BASELINE_PATH, JSON.stringify(OFFENDERS, null, 2));
    console.log('📄 Baseline updated:', BASELINE_PATH);
    process.exit(0);
  }
}

if (OFFENDERS.length) {
  const header = strict
    ? '\x1b[31mMath-consistency violations (strict)\x1b[0m'
    : '\x1b[33mMath-consistency warnings (advisory)\x1b[0m';
  console.error(header);
  (strict ? newViolations : OFFENDERS).forEach((m) => console.error('  ' + m));

  if (strict && newViolations.length) process.exit(1);
  console.error(
    'Advisory mode: exiting 0. Use --strict or MATH_SCAN_STRICT=1 to fail.'
  );
  process.exit(0);
} else {
  console.log('✅ Math scan passed – no raw Math.PI or p5 globals.');
}
