import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Script: validate-sounds.js
// Compare SOUND registry (source of truth) with audio manifest.
// Usage: bun run validate-sounds

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const SOUND_PATH = path.join(projectRoot, 'packages/core/src/audio/SoundIds.js');
const MANIFEST_PATH = path.join(projectRoot, 'public/audio/manifest.json');

async function getSoundIds() {
  const mod = await import(pathToFileURL(SOUND_PATH).href);
  return Object.keys(mod.SOUND);
}

function getManifestIds() {
  const manifestRaw = readFileSync(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  return Object.keys(manifest);
}

async function main() {
  const soundIds = await getSoundIds();
  const manifestIds = getManifestIds();

  const missingInManifest = soundIds.filter((id) => !manifestIds.includes(id));
  const extraInManifest = manifestIds.filter((id) => !soundIds.includes(id));

  if (!missingInManifest.length && !extraInManifest.length) {
    console.log('✅ Sound registry and manifest are aligned');
    process.exit(0);
  }

  if (missingInManifest.length) {
    console.error('❌ Missing in manifest:', missingInManifest.join(', '));
  }
  if (extraInManifest.length) {
    console.error('❌ Extra ids in manifest:', extraInManifest.join(', '));
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('❌ validate-sounds failed:', err);
  process.exit(1);
});
