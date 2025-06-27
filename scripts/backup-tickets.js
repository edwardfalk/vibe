// backup-tickets.js (CommonJS)
// Zips the entire tests/bug-reports directory into backups/ with a timestamped filename
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const TICKETS_DIR = path.resolve(process.cwd(), 'tests/bug-reports');
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const zipName = `tickets-backup-${timestamp}.zip`;
const zipPath = path.join(BACKUP_DIR, zipName);

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
}

console.log(`Backing up ${TICKETS_DIR} to ${zipPath}`);

try {
  // Use PowerShell Compress-Archive for Windows
  execSync(
    `powershell Compress-Archive -Path \"${TICKETS_DIR}\\*\" -DestinationPath \"${zipPath}\"`
  );
  console.log('✅ Backup complete:', zipPath);
} catch (e) {
  console.error('❌ Backup failed:', e.message);
  process.exit(1);
}
