// move-bug-reports.js
// Watches your Downloads folder and moves bug report files to tests/bug-reports/ (or de_bug/)
// Usage: bun move-bug-reports.js

const fs = require('fs');
const path = require('path');
const os = require('os');
const { DebugLogger } = require('../js/DebugLogger.js');

// CONFIGURATION
const downloadsDir = path.join(os.homedir(), 'Downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}
const projectBugDir = path.join(__dirname, 'tests', 'bug-reports'); // Change to 'de_bug' if you prefer
const bugFilePattern =
  /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_[^_]+).*\.(md|json|png)$/;

if (!fs.existsSync(projectBugDir))
  fs.mkdirSync(projectBugDir, { recursive: true });

function moveBugFiles() {
  fs.readdirSync(downloadsDir).forEach((file) => {
    const match = file.match(bugFilePattern);
    if (match) {
      // Use the full prefix (timestamp + desc) as the folder name
      const folderName = match[1];
      const destFolder = path.join(projectBugDir, folderName);
      if (!fs.existsSync(destFolder))
        fs.mkdirSync(destFolder, { recursive: true });
      const src = path.join(downloadsDir, file);
      const dest = path.join(destFolder, file);
      try {
        fs.renameSync(src, dest);
        DebugLogger.log(`Moved bug report artifact: ${src} -> ${dest}`);
      } catch (err) {
        DebugLogger.log(`Failed to move bug report artifact: ${src} -> ${dest}`, err);
        throw err;
      }
    }
  });
}

// Run every 10 seconds
setInterval(moveBugFiles, 10000);

console.log('Watching for bug report files in Downloads...');
