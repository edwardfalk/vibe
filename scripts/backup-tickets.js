// backup-tickets.js (ESM)
// Zips the entire tests/bug-reports directory into backups/ with a timestamped filename
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { reportError } from '../packages/tooling/src/ErrorReporter.js';

const TICKETS_DIR = path.resolve(process.cwd(), 'tests/bug-reports');
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const zipName = `tickets-backup-${timestamp}.zip`;
const zipPath = path.join(BACKUP_DIR, zipName);

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

console.log(`📦 Backing up ${TICKETS_DIR} to ${zipPath}`);

try {
  // Use PowerShell Compress-Archive for Windows
  execSync(
    `powershell -NoLogo -NoProfile -Command "Compress-Archive -Path '${TICKETS_DIR}\\*' -DestinationPath '${zipPath}'"`,
    { stdio: 'inherit', shell: true }
  );
  console.log('✅ Backup complete:', zipPath);
} catch (e) {
  reportError('TICKET_BACKUP_FAILURE', 'Backup failed', { message: e.message });
}
