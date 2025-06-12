#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, dirname } from 'path';

const WORKSPACE = process.cwd();
const PACKAGES_DIR = join(WORKSPACE, 'packages');

/** Recursively walk directory and collect files */
function walk(dir, ext = '.js', files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, ext, files);
    } else if (full.endsWith(ext)) {
      files.push(full);
    }
  }
  return files;
}

const replacements = [
  { find: '../../core/src/', replace: '@vibe/core/' },
  { find: '../../entities/src/', replace: '@vibe/entities/' },
  { find: '../../fx/src/', replace: '@vibe/fx/' },
];

const jsFiles = walk(PACKAGES_DIR);
let changed = 0;
for (const file of jsFiles) {
  let content = readFileSync(file, 'utf8');
  let modified = content;
  for (const { find, replace } of replacements) {
    modified = modified.split(find).join(replace);
  }
  if (modified !== content) {
    writeFileSync(file, modified, 'utf8');
    changed++;
  }
}
console.log(`Updated ${changed} files.`); 