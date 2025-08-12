import { withWatchdog } from './_common.js';
import { promises as fs } from 'fs';
import path from 'path';
await withWatchdog(
  (async () => {
    console.log('hp3: scan rules');
    const root = process.cwd();
    const rulesDir = path.join(root, '.cursor', 'rules');
    const files = (await fs.readdir(rulesDir)).filter((f) =>
      f.endsWith('.mdc')
    );
    console.log('hp3: count', files.length);
  })(),
  'hp3-read-rules',
  3000
);
process.exit(0);
