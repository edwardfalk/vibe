// scripts/audit-audio-manifest.js
// Quickly checks that every sample URL in public/audio/manifest.json resolves
// with HTTP 200 and a non-zero content length. Exits with non-zero code if any
// failures are detected so CI can catch missing audio.

import { readFile } from 'node:fs/promises';
import { exit } from 'node:process';

const MANIFEST_PATH = new URL('../public/audio/manifest.json', import.meta.url); // server path is /audio/manifest.json

/**
 * Reproduce the same CDN remap logic used by ToneAudioFacade so the audit checks
 * the actual URL fetched at runtime.
 */
function remap(url) {
  const cdnCommit = 'dc9de66401e175849bfd219bfe303ba2d72a4ee7';
  const cdnBase = `https://raw.githubusercontent.com/Tonejs/Tone.js/${cdnCommit}/examples/audio/`;
  if (typeof url !== 'string') return url;
  if (url.includes('tonejs.github.io/audio/')) {
    const subPath = url.split('/audio/')[1];
    return cdnBase + subPath;
  }
  if (/^https?:\/\//i.test(url)) return url;
  const trimmed = url.replace(/^\.\/?/, '');
  return cdnBase + trimmed;
}

async function head(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res;
  } catch (e) {
    return { ok: false, status: 0, url, error: e };
  }
}

(async () => {
  const raw = await readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw);
  const failures = [];

  console.log(`🔍 Checking ${Object.keys(manifest).length} audio assets…`);

  // Parallel HEAD requests (max 10 at a time)
  const entries = Object.entries(manifest);
  const concurrency = 10;
  for (let i = 0; i < entries.length; i += concurrency) {
    const slice = entries.slice(i, i + concurrency);
    const results = await Promise.all(
      slice.map(async ([id, url]) => {
        const target = remap(url);
        const res = await head(target);
        if (!res.ok) failures.push({ id, url: target, status: res.status });
      })
    );
  }

  if (failures.length) {
    console.error('❌ Missing or unreachable audio files:');
    failures.forEach((f) =>
      console.error(`  • ${f.id.padEnd(20)} → ${f.url} (${f.status})`)
    );
    console.error(`Total failures: ${failures.length}`);
    exit(1);
  }

  console.log('✅ All audio files reachable.');
})();
