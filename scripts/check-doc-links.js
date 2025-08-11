/*
  check-doc-links.js
  ------------------
  Scans all Markdown/Rule files for internal links pointing to files that do not exist.
  Usage:  bun run scripts/check-doc-links.js
*/

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';

const ROOT = resolve('.');
const markdownExtensions = ['.md', '.mdc'];

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name.startsWith('.git') ||
      entry.name === '.cursor' ||
      entry.name === 'docs-site' ||
      entry.name === 'archive'
    )
      continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function isMarkdown(file) {
  return markdownExtensions.some((ext) => file.endsWith(ext));
}

function extractLinks(markdown) {
  // Matches [text](path) but ignores images ![alt](path)
  const linkRegex = /(?<!\\)!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const links = [];
  let match;
  while ((match = linkRegex.exec(markdown))) {
    const target = match[1];
    // skip if absolute url (http, https) or anchor (#) or mailto
    if (/^(https?:|#|mailto:)/.test(target)) continue;
    links.push(target);
  }
  return links;
}

function checkLinks() {
  const allFiles = walk(ROOT).filter(isMarkdown);
  const missing = [];

  for (const file of allFiles) {
    const content = readFileSync(file, 'utf8');
    const links = extractLinks(content);
    const fileDir = dirname(file);
    for (const link of links) {
      // Handle mdc: special prefix – treat it as project-root absolute
      const fixed = link.startsWith('mdc:') ? link.slice(4) : link;
      const base =
        link.startsWith('mdc:') || link.startsWith('/') ? ROOT : fileDir;
      const resolved = resolve(join(base, fixed));
      if (!existsSync(resolved)) {
        missing.push({ file, link });
      }
    }
  }

  if (missing.length === 0) {
    console.log('✅ No missing internal links found.');
    return 0;
  }

  console.log('⚠️  Missing internal links detected:');
  for (const { file, link } of missing) {
    console.log(` - ${file}: ${link}`);
  }
  return 1;
}

if (import.meta.main) {
  const code = checkLinks();
  process.exit(code);
}

export { checkLinks };
