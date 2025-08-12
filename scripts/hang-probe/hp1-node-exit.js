import { withWatchdog } from './_common.js';
await withWatchdog(
  (async () => {
    console.log('hp1: start');
    console.log('hp1: ok');
  })(),
  'hp1-node-exit',
  3000
);
process.exit(0);
