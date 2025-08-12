// env-diff.js
// Compares keys between .env.example and .env without printing values.
// Usage: bun run scripts/env-diff.js

import fs from 'fs';
import path from 'path';

function readEnvKeys(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return new Set(
      raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => l.split('=')[0])
        .filter(Boolean)
    );
  } catch {
    return null;
  }
}

const examplePath = path.resolve('.env.example');
const envPath = path.resolve('.env');

const exampleKeys = readEnvKeys(examplePath);
if (!exampleKeys) {
  console.error('❌ .env.example not found or unreadable.');
  process.exit(1);
}

const envKeys = readEnvKeys(envPath) || new Set();

const missingInEnv = [...exampleKeys].filter((k) => !envKeys.has(k));
const extraInEnv = [...envKeys].filter((k) => !exampleKeys.has(k));

console.log('🔧 .env keys check');
console.log(' - example file:', examplePath);
console.log(' - env file     :', fs.existsSync(envPath) ? envPath : '(missing)');
console.log('');

if (missingInEnv.length === 0) {
  console.log('✅ All expected keys from .env.example are present in .env');
} else {
  console.log('⚠️ Missing keys in .env:');
  missingInEnv.forEach((k) => console.log('   -', k));
}

if (extraInEnv.length > 0) {
  console.log('ℹ️ Extra keys in .env (not in .env.example):');
  extraInEnv.forEach((k) => console.log('   -', k));
}

// Exit code 0 even if missing, to avoid chat hangs; rely on message.
process.exit(0);
