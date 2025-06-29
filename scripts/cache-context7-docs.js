#!/usr/bin/env bun
/**
 * cache-context7-docs.js
 * --------------------------------------
 * Reads package.json dependencies and automatically fetches & caches
 * documentation/snippets from Context7 into .context7-cache/<pkg>.
 *
 * For now this script is BEST-EFFORT; if Context7 returns 404 or the
 * plugin is not active, we log a structured error but continue.
 */
import fs from 'node:fs';
import path from 'node:path';
import { reportError } from '../packages/tooling/src/ErrorReporter.js';

const CACHE_DIR = path.resolve(process.cwd(), '.context7-cache');
const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const deps = Object.keys({ ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) });

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Helper to write docs to cache
function saveDocs(pkgName, content) {
  const dest = path.join(CACHE_DIR, `${pkgName}.md`);
  fs.writeFileSync(dest, content, 'utf8');
  console.log(`📚 Cached docs for ${pkgName}`);
}

const CONTEXT7_BASE = process.env.CONTEXT7_URL || 'http://localhost:4333/context7';

async function httpJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchDocs(pkgName, force = false) {
  const cachePath = path.join(CACHE_DIR, `${pkgName}.md`);
  if (!force && fs.existsSync(cachePath)) {
    console.log(`ℹ️  Skipping ${pkgName} (cached)`);
    return;
  }

  try {
    // 1. Resolve ID
    const { id } = await httpJson(`${CONTEXT7_BASE}/resolve?name=${encodeURIComponent(pkgName)}`);
    if (!id) throw new Error('Missing id');

    // 2. Fetch docs (limit to 6000 tokens)
    const { docs } = await httpJson(
      `${CONTEXT7_BASE}/docs?id=${encodeURIComponent(id)}&tokens=6000`
    );

    if (!docs) throw new Error('Empty docs');

    saveDocs(pkgName, docs);
  } catch (err) {
    reportError('CONTEXT7_CACHE_FAILURE', `Failed to cache docs for ${pkgName}`, { message: err.message }, null);
    const placeholder = `# ${pkgName}\n\n> TODO: Context7 fetch failed. ${err.message}`;
    saveDocs(pkgName, placeholder);
  }
}

(async () => {
  const force = process.argv.includes('--refresh');
  for (const dep of deps) {
    await fetchDocs(dep, force);
  }
})(); 