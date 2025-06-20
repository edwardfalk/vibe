// scripts/cleanup-debug.js
// Deletes .debug log files older than 7 days

import { readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

const DEBUG_DIR = join(process.cwd(), '.debug');
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

try {
  const now = Date.now();
  for (const file of readdirSync(DEBUG_DIR)) {
    const filePath = join(DEBUG_DIR, file);
    const stats = statSync(filePath);
    if (now - stats.mtimeMs > SEVEN_DAYS_MS) {
      unlinkSync(filePath);
    }
  }
  console.log('🧹 .debug cleanup complete');
} catch (e) {
  console.log('⚠️ .debug cleanup failed:', e);
}
