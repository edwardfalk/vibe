// ANSI escape sequence scanner (Windows-friendly, Bun/Node ESM)
// Scans staged files (pre-commit) or the full repo when --all is passed.
// Exits with code 1 if any offending files are found.

import { execSync } from 'node:child_process';
import { readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.ico',
  '.zip',
  '.gz',
  '.7z',
  '.rar',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.mp3',
  '.wav',
  '.ogg',
  '.mp4',
  '.webm',
  '.pdf',
  '.docx',
  '.xlsx',
  '.bin',
  '.lockb',
]);

const IGNORE_DIR_PREFIXES = [
  'node_modules' + path.sep,
  '.git' + path.sep,
  '.debug' + path.sep,
  'playwright-report' + path.sep,
  path.join('tests', 'bug-reports') + path.sep,
  path.join('docs', 'archive') + path.sep,
];

// Rough ANSI CSI sequence detector: ESC [ ... final
// Matches most SGR/color codes and many CSI controls without false positives in normal text.
const ANSI_REGEX = /\x1B\[[0-?]*[ -\/]*[@-~]/;

function isIgnored(filePath) {
  const normalized = filePath.replace(/[\\/]+/g, path.sep);
  for (const prefix of IGNORE_DIR_PREFIXES) {
    if (normalized.startsWith(prefix)) return true;
  }
  return false;
}

function isBinaryByExt(filePath) {
  return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function getCandidateFiles() {
  const args = process.argv.slice(2);
  let files = [];
  try {
    if (args.includes('--all')) {
      const out = execSync('git ls-files -z', {
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      files = out.toString('utf8').split('\u0000').filter(Boolean);
    } else {
      // Prefer staged files; fallback to cached+worktree changes, else all tracked
      let out = execSync('git diff --cached --name-only -z', {
        stdio: ['ignore', 'pipe', 'ignore'],
      }).toString('utf8');
      files = out.split('\u0000').filter(Boolean);
      if (files.length === 0) {
        out = execSync('git diff --name-only -z', {
          stdio: ['ignore', 'pipe', 'ignore'],
        }).toString('utf8');
        files = out.split('\u0000').filter(Boolean);
      }
      if (files.length === 0) {
        out = execSync('git ls-files -z', {
          stdio: ['ignore', 'pipe', 'ignore'],
        }).toString('utf8');
        files = out.split('\u0000').filter(Boolean);
      }
    }
  } catch (_) {
    // As a last resort, scan tracked files
    try {
      const out = execSync('git ls-files -z', {
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      files = out.toString('utf8').split('\u0000').filter(Boolean);
    } catch {
      files = [];
    }
  }
  // Filter existing, non-ignored files only
  return files.filter(
    (f) => existsSync(path.join(repoRoot, f)) && !isIgnored(f)
  );
}

function containsAnsiSequences(filePath) {
  try {
    if (isBinaryByExt(filePath)) return false;
    const abs = path.join(repoRoot, filePath);
    const st = statSync(abs);
    if (st.size === 0) return false;
    // Size guard: skip very large files (>5MB) unless explicitly asked with --all
    if (st.size > 5 * 1024 * 1024 && !process.argv.includes('--all'))
      return false;
    const buf = readFileSync(abs);
    // Quick binary sniff
    for (let i = 0; i < Math.min(buf.length, 1024); i++) {
      if (buf[i] === 0) return false;
    }
    const text = buf.toString('utf8');
    return ANSI_REGEX.test(text);
  } catch (_) {
    return false;
  }
}

function showMatches(filePath) {
  try {
    const text = readFileSync(path.join(repoRoot, filePath), 'utf8');
    const lines = text.split(/\r?\n/);
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
      if (ANSI_REGEX.test(lines[i])) {
        hits.push({
          line: i + 1,
          preview: lines[i].replace(/\x1B\[[0-?]*[ -\/]*[@-~]/g, '[ANSI]'),
        });
        if (hits.length >= 3) break;
      }
    }
    return hits;
  } catch {
    return [];
  }
}

const candidates = getCandidateFiles();
const offenders = [];

for (const f of candidates) {
  if (containsAnsiSequences(f)) {
    offenders.push({ file: f, samples: showMatches(f) });
  }
}

if (offenders.length > 0) {
  console.error('\nANSI escape sequences detected in the following files:');
  for (const o of offenders) {
    console.error(` - ${o.file}`);
    for (const s of o.samples) {
      console.error(`   L${s.line}: ${s.preview}`);
    }
  }
  console.error(`\nTotal offending files: ${offenders.length}.`);
  process.exit(1);
} else {
  console.log('No ANSI escape sequences detected.');
}
