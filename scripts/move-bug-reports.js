// move-bug-reports.js
// Watches your Downloads folder and moves bug report files to tests/bug-reports/ (or de_bug/)
// Usage: bun move-bug-reports.js

import {
  readdirSync,
  renameSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  unlinkSync,
} from 'fs';
import { join, dirname } from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { DebugLogger } from '../packages/tooling/src/DebugLogger.js';

// __dirname replacement in ESM
const __dirname = dirname(fileURLToPath(import.meta.url));

// CONFIGURATION
const downloadsDir = join(os.homedir(), 'Downloads');
if (!existsSync(downloadsDir)) {
  mkdirSync(downloadsDir, { recursive: true });
}
const projectBugDir = join(__dirname, '..', 'tests', 'bug-reports'); // Change to 'de_bug' if you prefer
const bugFilePattern =
  /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_[^_]+).*\.(md|json|png)$/;

if (!existsSync(projectBugDir)) mkdirSync(projectBugDir, { recursive: true });

function moveBugFiles() {
  readdirSync(downloadsDir).forEach((file) => {
    const match = file.match(bugFilePattern);
    if (match) {
      // Use the full prefix (timestamp + desc) as the folder name
      const folderName = match[1];
      const destFolder = join(projectBugDir, folderName);
      if (!existsSync(destFolder)) mkdirSync(destFolder, { recursive: true });
      const src = join(downloadsDir, file);
      const dest = join(destFolder, file);
      try {
        renameSync(src, dest);
      } catch (renameErr) {
        if (renameErr.code === 'EXDEV') {
          // Cross-device move fallback for different drive letters
          copyFileSync(src, dest);
          unlinkSync(src);
        } else {
          throw renameErr;
        }
      }
      DebugLogger.log(`Moved bug report artifact: ${src} -> ${dest}`);
    }
  });
}

// Run every 10 seconds
setInterval(moveBugFiles, 10000);

console.log('Watching for bug report files in Downloads...');
