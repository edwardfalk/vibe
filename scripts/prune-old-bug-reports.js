// scripts/prune-old-bug-reports.js
// Deletes folders inside tests/bug-reports that are older than 90 days
// Usage: bun scripts/prune-old-bug-reports.js

import { readdirSync, statSync, rmSync } from 'fs';
import { join } from 'path';

const BUG_REPORT_DIR = join(process.cwd(), 'tests', 'bug-reports');
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

try {
  const now = Date.now();
  for (const entry of readdirSync(BUG_REPORT_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folderPath = join(BUG_REPORT_DIR, entry.name);
    const stats = statSync(folderPath);
    if (now - stats.mtimeMs > NINETY_DAYS_MS) {
      rmSync(folderPath, { recursive: true, force: true });
      console.log(`🗑️ Deleted old bug-report folder: ${entry.name}`);
    }
  }
  console.log('🧹 Bug-report folder cleanup complete');
} catch (e) {
  console.error('⚠️ Bug-report cleanup failed:', e.message);
}
