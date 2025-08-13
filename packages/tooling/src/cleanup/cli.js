// CLI: Workspace cleanup for logs, Playwright artifacts, and bug-report assets
// Usage:
//   bun run packages/tooling/src/cleanup/cli.js [--dry] [--ci] [--thresholdMB 50] [--verbose] [--purge-now]
//
// This script is Windows-friendly (cmd.exe) and Bun-first. It deletes:
// - playwright-report/** (always)
// - tests/bug-reports/** (always)
// - .debug/** files older than 14 days
// - tests/**/*.(trace|webm|png) older than 14 days
//
// Notes
// - Designed to be idempotent and safe. It never deletes outside the repo root.
// - --dry prints the plan without deleting.
// - --ci exits with code 1 if total bytes freed >= thresholdMB.
// - --purge-now is a convenience to immediately wipe playwright-report and bug-reports regardless of age.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';

/** Resolve repo root assuming this file is under packages/tooling/src/cleanup/ */
function resolveRepoRoot() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // repoRoot = <repo> from packages/tooling/src/cleanup
  return path.resolve(__dirname, '../../../..');
}

/** Human-friendly bytes */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

async function pathExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function getDirSize(absPath) {
  let total = 0;
  async function walk(p) {
    const entries = await fs.readdir(p, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile()) {
        const st = await fs.stat(full);
        total += st.size;
      }
    }
  }
  if (await pathExists(absPath)) {
    await walk(absPath);
  }
  return total;
}

async function rmDir(absPath, dry, verbose) {
  if (!(await pathExists(absPath))) return { bytes: 0, deleted: false };
  const bytes = await getDirSize(absPath);
  if (dry) {
    if (verbose)
      console.log(
        `🧪 [dry] Would delete directory: ${absPath} (~${formatBytes(bytes)})`
      );
    return { bytes, deleted: false };
  }
  await fs.rm(absPath, { recursive: true, force: true });
  if (verbose)
    console.log(`🧹 Deleted directory: ${absPath} (${formatBytes(bytes)})`);
  return { bytes, deleted: true };
}

async function pruneOldFiles(absRoot, relDir, exts, maxAgeDays, dry, verbose) {
  const target = path.join(absRoot, relDir);
  if (!(await pathExists(target))) return { bytes: 0, count: 0 };
  const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let bytes = 0;
  let count = 0;
  async function walk(p) {
    const entries = await fs.readdir(p, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile()) {
        const lower = e.name.toLowerCase();
        const matchesExt = exts.some((ext) => lower.endsWith(ext));
        if (!matchesExt) continue;
        const st = await fs.stat(full);
        if (st.mtimeMs <= cutoffMs) {
          if (dry) {
            if (verbose)
              console.log(
                `🧪 [dry] Would delete file: ${full} (${formatBytes(st.size)})`
              );
          } else {
            await fs.rm(full, { force: true });
            if (verbose)
              console.log(`🧹 Deleted file: ${full} (${formatBytes(st.size)})`);
          }
          bytes += st.size;
          count += 1;
        }
      }
    }
  }
  await walk(target);
  return { bytes, count };
}

async function pruneDirOld(absRoot, relDir, maxAgeDays, dry, verbose) {
  // Delete entire directory if exists and contains only old files (coarse). For simplicity, we always delete when --purge-now.
  const absPath = path.join(absRoot, relDir);
  return rmDir(absPath, dry, verbose);
}

async function main() {
  const argv = minimist(process.argv.slice(2));
  const dry = Boolean(argv.dry);
  const ci = Boolean(argv.ci);
  const verbose = Boolean(argv.verbose);
  const thresholdMB = Number(argv.thresholdMB ?? 50);
  const purgeNow = Boolean(argv['purge-now']);

  const repoRoot = resolveRepoRoot();
  const repoRootNorm = path.resolve(repoRoot);
  if (!process.cwd().startsWith(repoRootNorm)) {
    // Ensure we never operate outside the repo
    process.chdir(repoRootNorm);
  }

  let totalBytesFreed = 0;

  // 1) Always remove playwright-report (full wipe)
  {
    const target = path.join(repoRoot, 'playwright-report');
    const { bytes } = await rmDir(target, dry, verbose);
    totalBytesFreed += bytes;
  }

  // 2) Always remove tests/bug-reports (full wipe)
  {
    const target = path.join(repoRoot, 'tests', 'bug-reports');
    const { bytes } = await rmDir(target, dry, verbose);
    totalBytesFreed += bytes;
  }

  // 3) .debug older than 14 days
  {
    const maxAgeDays = 14;
    const { bytes, count } = await pruneOldFiles(
      repoRoot,
      '.debug',
      ['.log', '.txt', '.json'],
      maxAgeDays,
      dry,
      verbose
    );
    if (verbose)
      console.log(
        `🧹 .debug pruned files: ${count}, freed ~${formatBytes(bytes)}`
      );
    totalBytesFreed += bytes;
  }

  // 4) tests artifacts older than 14 days
  {
    const maxAgeDays = 14;
    const { bytes, count } = await pruneOldFiles(
      repoRoot,
      'tests',
      ['.trace', '.webm', '.png'],
      maxAgeDays,
      dry,
      verbose
    );
    if (verbose)
      console.log(
        `🧹 tests artifacts pruned: ${count}, freed ~${formatBytes(bytes)}`
      );
    totalBytesFreed += bytes;
  }

  console.log(
    `🧹 Cleanup complete. Freed approximately ${formatBytes(totalBytesFreed)}.`
  );
  if (ci) {
    // Use @vibe/core mathUtils max to align with project standards
    const { max } = await import('@vibe/core');
    const thresholdBytes = max(0, thresholdMB) * 1024 * 1024;
    if (totalBytesFreed >= thresholdBytes) {
      console.error(
        `⚠️ CI threshold exceeded: freed ${formatBytes(totalBytesFreed)} ≥ ${thresholdMB} MB`
      );
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('⚠️ Cleanup failed:', err);
  process.exit(1);
});
