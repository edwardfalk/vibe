import { withWatchdog } from './_common.js';
console.log('hp5: dynamic import @vibe/core index');
await withWatchdog(
  import('../..//packages/core/src/index.js'),
  'hp5-import-core',
  5000
);
console.log('hp5: imported');
process.exit(0);
