#!/usr/bin/env bun
/**
 * scan-sound-usage.js
 * Fails if any raw string sound IDs are used with playSound('...') in packages/**.
 * Enforce: use SOUND.* constants instead.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const START_DIR = join(ROOT, 'packages');
const IGNORE_FILES = new Set([
  // allow SOUND and internal mappings here
  join(ROOT, 'packages/core/src/audio/ToneAudioFacade.js').replace(/\\/g, '/'),
]);

const RAW_PATTERN = /\bplaySound\(\s*['"]/g; // e.g., playSound('explosion')

/** @type {{file:string, line:number, text:string}[]} */
const hits = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (extname(full) !== '.js') continue;
    const norm = full.replace(/\\/g, '/');
    if (IGNORE_FILES.has(norm)) continue;
    const src = readFileSync(full, 'utf8');
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (RAW_PATTERN.test(line)) {
        hits.push({ file: norm, line: i + 1, text: line.trim() });
      }
    }
  }
}

walk(START_DIR);

if (hits.length) {
  console.error('❌ Found raw playSound(\'...\') usages. Use SOUND.* instead:');
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}: ${h.text}`);
  }
  process.exit(1);
}

console.log('✅ No raw playSound string usages found.');
