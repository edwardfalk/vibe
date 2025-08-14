import { withWatchdog } from './_common.js';
import { promises as fs } from 'fs';
await withWatchdog(
  (async () => {
    console.log('hp2: write/read');
    const p = 'docs-site/__hp2.txt';
    await fs.mkdir('docs-site', { recursive: true });
    await fs.writeFile(p, 'hello', 'utf8');
    const txt = await fs.readFile(p, 'utf8');
    console.log('hp2: read:', txt);
  })(),
  'hp2-import-fs',
  3000
);
process.exit(0);
