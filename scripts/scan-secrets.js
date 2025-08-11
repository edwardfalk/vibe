/* scan-secrets.js
   Scans workspace for potential secret leaks (40+ char hex strings, common token keywords).
   Usage: bun run scripts/scan-secrets.js
*/
import { walk } from 'https://deno.land/std@0.210.0/fs/walk.ts';
import { extname } from 'path';

const ignoreDirs = ['node_modules', '.git', '.debug', 'playwright-report'];
const suspectRegex = /([A-Za-z0-9]{40,})|(token=|apikey=|api_key=)/i;
let issues = [];

for await (const entry of walk('.', { includeDirs: false })) {
  if (ignoreDirs.some((d) => entry.path.includes(d))) continue;
  const ext = extname(entry.path);
  if (['.png', '.jpg', '.jpeg', '.gif', '.lock'].includes(ext)) continue;
  const text = await Deno.readTextFile(entry.path).catch(() => '');
  if (suspectRegex.test(text)) {
    issues.push(entry.path);
  }
}

if (issues.length === 0) {
  console.log('✅ No potential secrets found.');
  Deno.exit(0);
}
console.log('⚠️ Potential secrets detected in:');
issues.forEach((f) => console.log(' - ' + f));
Deno.exit(1); 