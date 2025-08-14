// scripts/prune-archive-docs.js
// Deletes files in docs/archive/ that are older than 180 days.
// Usage: bun scripts/prune-archive-docs.js

import { readdirSync, statSync, rmSync } from 'fs';
import { join } from 'path';

const ARCHIVE_DIR = join(process.cwd(), 'docs', 'archive');
const ONE_HUNDRED_EIGHTY_DAYS = 180 * 24 * 60 * 60 * 1000;

try {
  const now = Date.now();
  for (const entry of readdirSync(ARCHIVE_DIR, { withFileTypes: true })) {
    const filePath = join(ARCHIVE_DIR, entry.name);
    const stats = statSync(filePath);
    if (now - stats.mtimeMs > ONE_HUNDRED_EIGHTY_DAYS) {
      rmSync(filePath, { recursive: true, force: true });
      console.log(`🗑️ Deleted old archived doc: ${entry.name}`);
    }
  }
  console.log('🧹 docs/archive cleanup complete');
} catch (e) {
  console.error('⚠️ docs/archive cleanup failed:', e.message);
}
