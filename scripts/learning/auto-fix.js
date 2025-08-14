/**
 * Auto-Fix Engine (conservative)
 * Applies safe transforms mapped to known rules:
 *  - Replace Math.PI → PI and 2*Math.PI → TWO_PI and ensure import from @vibe/core
 *  - Flag dist( with missing import and optionally add import
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const PKG_DIR = join(ROOT, 'packages');

function walk(dir) {
  const out = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) {
      if (d.name === 'node_modules' || d.name === '.git') continue;
      out.push(...walk(p));
    } else if (d.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function ensureImport(src, spec, fromPath) {
  // Accept either barrel '@vibe/core' or direct '@vibe/core/mathUtils.js'
  const candidates = [fromPath, '@vibe/core/mathUtils.js'];
  for (const p of candidates) {
    const importRegex = new RegExp(
      `import\\s+\\{[^}]*\\b${spec}\\b[^}]*\\}\\s+from\\s+["']${p}["']`
    );
    if (importRegex.test(src)) return src;
  }
  const firstImportIdx = src.indexOf('import ');
  const insertion = `import { ${spec} } from '${fromPath}';\n`;
  if (firstImportIdx >= 0) {
    return src.slice(0, firstImportIdx) + insertion + src.slice(firstImportIdx);
  }
  return insertion + src;
}

function transformFile(path) {
  let src = readFileSync(path, 'utf8');
  let changed = false;

  // Math.PI → PI; 2*Math.PI → TWO_PI
  if (/Math\.PI/.test(src)) {
    src = src.replace(/2\s*\*\s*Math\.PI/g, 'TWO_PI');
    src = src.replace(/Math\.PI/g, 'PI');
    src = ensureImport(src, 'PI', '@vibe/core');
    src = ensureImport(src, 'TWO_PI', '@vibe/core');
    changed = true;
  }

  // dist( without import → add import
  if (
    /[^\w\.]dist\s*\(/.test(src) &&
    !/\bdist\b/.test(
      src
        .split('\n')
        .filter((l) => l.startsWith('import '))
        .join('\n')
    )
  ) {
    src = ensureImport(src, 'dist', '@vibe/core');
    changed = true;
  }

  if (changed) writeFileSync(path, src, 'utf8');
  return changed;
}

function main() {
  const files = walk(PKG_DIR);
  let edits = 0;
  for (const f of files) {
    const changed = transformFile(f);
    if (changed) edits++;
  }
  console.log(`🛠️  Auto-fix complete. Files changed: ${edits}`);
}

if (import.meta.main) main();

export { main as runAutoFix };
