#!/usr/bin/env bun
/**
 * scan-doc-frontmatter.js
 * --------------------------------------
 * Scans every Markdown file in the docs/ directory.
 * 1. Parses YAML front-matter using gray-matter.
 * 2. Verifies required fields: title, description, last_updated.
 * 3. Prints a summary table and exits non-zero if any doc is missing metadata.
 *
 * Usage (from project root):
 *   bun run scripts/scan-doc-frontmatter.js
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { reportError } from '../packages/tooling/src/ErrorReporter.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DOC_ROOT = join(__dirname, '..', 'docs');
const REQUIRED_FIELDS = ['title', 'description', 'last_updated'];

function walkDir(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      walkDir(full, files);
    } else if (info.isFile() && extname(full) === '.md') {
      files.push(full);
    }
  }
  return files;
}

let hasErrors = false;

for (const filePath of walkDir(DOC_ROOT)) {
  const raw = readFileSync(filePath, 'utf8');
  const { data } = matter(raw);

  if (!data || Object.keys(data).length === 0) {
    reportError(
      'DOC_MISSING_FRONTMATTER',
      `${filePath} has no YAML front-matter`,
      { file: filePath },
      null
    );
    hasErrors = true;
    continue;
  }

  const missing = REQUIRED_FIELDS.filter((key) => !(key in data));
  if (missing.length) {
    reportError(
      'DOC_INVALID_FRONTMATTER',
      `${filePath} missing field(s): ${missing.join(', ')}`,
      { file: filePath, missing },
      null
    );
    hasErrors = true;
  } else {
    console.log(
      `[OK] ${filePath}: ${data.title} (updated ${data.last_updated})`
    );
  }
}

if (hasErrors) {
  process.exit(1);
}
