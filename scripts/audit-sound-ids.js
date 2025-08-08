#!/usr/bin/env bun
/**
 * audit-sound-ids.js – Utility to ensure SOUND registry and manifest.json stay in sync.
 *
 * Usage: bun run scripts/audit-sound-ids.js
 * Exits with code 1 if discrepancies found.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve project root based on current script location
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function loadSoundIds() {
  // Dynamically import the ES module to get the SOUND object
  const soundIdsPath = path.resolve(
    projectRoot,
    'packages/core/src/audio/SoundIds.js'
  );
  return import(`file://${soundIdsPath}`).then((mod) => Object.keys(mod.SOUND));
}

function loadManifestIds() {
  const manifestPath = path.resolve(projectRoot, 'public/audio/manifest.json');
  const json = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return Object.keys(json);
}

function diff(arrA, arrB) {
  return arrA.filter((x) => !arrB.includes(x));
}

const soundIds = await loadSoundIds();
const manifestIds = loadManifestIds();

const missingInManifest = diff(soundIds, manifestIds);
const missingInSoundIds = diff(manifestIds, soundIds);

if (missingInManifest.length === 0 && missingInSoundIds.length === 0) {
  console.log('✅ SOUND registry and manifest are in sync.');
  process.exit(0);
}

if (missingInManifest.length) {
  console.warn('⚠️ IDs present in SoundIds.js but missing in manifest.json:');
  missingInManifest.forEach((id) => console.warn('  -', id));
}

if (missingInSoundIds.length) {
  console.warn('⚠️ IDs present in manifest.json but missing in SoundIds.js:');
  missingInSoundIds.forEach((id) => console.warn('  -', id));
}

process.exit(1);
