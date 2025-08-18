/*
 * Secret Scanner – blocks GitHub PATs, Google API keys, and generic 40-char hex/base62 tokens.
 *
 * Usage:
 *   bun --bun scripts/scan/secret-scan.js        # scans staged files (pre-commit)
 *   bun --bun scripts/scan/secret-scan.js --all   # scans entire repo (CI/CLI)
 *
 * Exit codes:
 *   0 – no secrets found
 *   1 – potential secret(s) detected
 */
import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const scanAll = process.argv.includes('--all');

function listTargetFiles() {
  if (scanAll) {
    // list all tracked files (respecting .gitignore automatically)
    return execSync('git ls-files', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  }
  // default: staged files only – including adds / modifies
  const diff = execSync('git diff --cached --name-only', { encoding: 'utf8' });
  return diff.split('\n').filter(Boolean);
}

const PATTERN_GH_PAT = /gh[psu]_[A-Za-z0-9]{36,}/g; // covers ghp_, ghs_, ghu_
const PATTERN_GOOGLE = /AIza[0-9A-Za-z-_]{35}/g;
const PATTERN_GENERIC40 = /[A-Za-z0-9]{40}/g; // fallback (less strict)
const MAX_FILE_SIZE = 1024 * 1024; // 1 MB safety limit

const offenders = [];
const IGNORED_FILES = ['bun.lock'];
for (const relPath of listTargetFiles()) {
  if (IGNORED_FILES.includes(relPath)) continue;
  const absPath = join(repoRoot, relPath);
  try {
    const { size } = statSync(absPath);
    if (size > MAX_FILE_SIZE) continue; // skip huge/binary assets
    const content = readFileSync(absPath, 'utf8');
    // quick skip for obvious non-matches
    if (!content.includes('gh') && !content.includes('AIza')) continue;

    const matches = [
      ...content.matchAll(PATTERN_GH_PAT),
      ...content.matchAll(PATTERN_GOOGLE),
    ];

    // Generic 40-char token heuristic (avoid too many false positives)
    for (const m of content.matchAll(PATTERN_GENERIC40)) {
      // Skip if already matched by PAT patterns (avoid duplicate)
      if (/^[A-Fa-f0-9]{40}$/.test(m[0])) continue; // likely SHA-1, ignore
      matches.push(m);
    }

    if (matches.length) {
      offenders.push({ path: relPath, matches });
    }
  } catch {
    /* ignore unreadable files */
  }
}

if (offenders.length) {
  console.error('\n🚨 Potential secret(s) detected:');
  for (const { path, matches } of offenders) {
    for (const match of matches) {
      const secret = match[0];
      const redacted = secret.slice(0, 6) + '…' + secret.slice(-4);
      console.error(`  – ${path}: ${redacted}`);
    }
  }
  console.error('\nCommit aborted. Remove or relocate these secrets.');
  process.exit(1);
}

process.exit(0);
