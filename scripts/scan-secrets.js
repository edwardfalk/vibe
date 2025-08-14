/* scan-secrets.js (Node version)
   Scans workspace for potential secret leaks (40+ char mixed-alnum strings, common token keywords).
   Usage: bun run scripts/scan-secrets.js
*/
import fs from 'fs/promises';
import path from 'path';

const ignoreDirs = new Set([
  'node_modules',
  '.git',
  '.debug',
  'playwright-report',
  'test-results',
  '.cursor',
  'docs',
  'docs-site',
  'coderabbit-reviews',
]);
const ignoreFiles = new Set(['.env', '.env.example', 'scan-secrets.js']);
const ignoreExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.lock', '.webm']);
const suspectRegex = /([A-Za-z0-9]{40,})|(token=|apikey=|api_key=)/i;

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name)) {
        yield* walk(fullPath);
      }
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

const issues = [];

for await (const file of walk('.')) {
  const ext = path.extname(file).toLowerCase();
  if (ignoreExts.has(ext)) continue;
  try {
    const base = path.basename(file);
    if (ignoreFiles.has(base)) continue;
    const text = await fs.readFile(file, 'utf8');
    const lines = text.split(/\r?\n/);
    let flagged = false;
    for (const line of lines) {
      const t = line.trim();
      if (!suspectRegex.test(t)) continue;
      // Ignore comments
      if (
        t.startsWith('//') ||
        t.startsWith('/*') ||
        t.startsWith('*') ||
        t.endsWith('*/')
      )
        continue;
      // Ignore URLs and known safe long strings (e.g., Tone.js raw GitHub commit URLs)
      if (/https?:\/\//i.test(t)) continue;
      if (/raw\.githubusercontent\.com/i.test(t)) continue;
      if (/tonejs/i.test(t)) continue;
      flagged = true;
      break;
    }
    if (flagged) issues.push(file);
  } catch {
    // skip unreadable files
  }
}

if (issues.length === 0) {
  console.log('✅ No potential secrets found.');
  process.exit(0);
}
console.log('⚠️ Potential secrets detected in:');
for (const f of issues) console.log(' - ' + f);
process.exit(1);
