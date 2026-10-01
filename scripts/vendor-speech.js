// Vendors the two speech engines into js/vendor/ from their pinned npm
// tarballs: espeak-ng (its data trimmed to English and the voice variants)
// and SAM. Run from the repo root: node scripts/vendor-speech.js
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PACKAGES = {
  espeak: {
    url: 'https://registry.npmjs.org/@echogarden/espeak-ng-emscripten/-/espeak-ng-emscripten-0.3.5.tgz',
    integrity:
      'sha512-Izbkm7NWccwb//RKgOp1/0k21StKN1DFIn+K7GU1XN7n6pmSi4bsk/0tYUsgQbysC4GVyrVompNmLInU/BFE+A==',
  },
  sam: {
    url: 'https://registry.npmjs.org/sam-js/-/sam-js-0.3.1.tgz',
    integrity:
      'sha512-X4GUr8Q/T8RgtjnPOssSwYDknxot69PgEAVvwsJ4kB8Lz8wytuHB6n1JqsXLmpdKGD8YR9tqKptm07jmw83eWQ==',
  },
};
const ESPEAK_OUT = 'js/vendor/espeak-ng';
const SAM_OUT = 'js/vendor/sam';

// The espeak-ng data the game needs: the English dictionary, the phoneme and
// intonation tables, the English language entries and every voice variant
const DATA_PREFIX = '/usr/share/espeak-ng-data/';
const KEEP = [
  /^en_dict$/,
  /^phondata$/,
  /^phonindex$/,
  /^phontab$/,
  /^intonations$/,
  /^lang\/gmw\/en(-.*)?$/,
  /^voices\/!v\//,
];
const REQUIRED = ['en_dict', 'phontab', 'phondata', 'phonindex'];
const MANIFEST =
  /loadPackage\(\{files:\[(.*?)\],remote_package_size:(\d+)\}\)/s;
const ENTRY = /\{filename:"([^"]+)",start:(\d+),end:(\d+)\}/g;

const ESPEAK_SOURCE = `# espeak-ng for Vibe

This folder holds a build of [eSpeak NG](https://github.com/espeak-ng/espeak-ng), a speech synthesizer licensed under the GNU General Public License, version 3 or later (see \`COPYING\`). The rest of the game is MIT-licensed; see the repository's README.

## Where it comes from

- \`espeak-ng.js\` and \`espeak-ng.data\` come from the npm package [\`@echogarden/espeak-ng-emscripten\`](https://www.npmjs.com/package/@echogarden/espeak-ng-emscripten) 0.3.5 (GPL-3.0), integrity \`${PACKAGES.espeak.integrity}\`.
- That package is built by https://github.com/echogarden-project/espeak-ng-emscripten. Its release commit is \`ea36b43595facf07f1c5dc487b9f0de3340c1b5e\` ("Increment version", 2025-08-19), and its build instructions compile the \`fork\` branch of https://github.com/echogarden-project/espeak-ng, a fork of eSpeak NG, with Emscripten.
- The build does not pin a commit of that branch. On the release date the branch's head was \`ae87fc2ecc830593dc0cd62a6242cdf73c68b357\` (2025-08-18), so that is the corresponding source as far as it can be identified.
- A copy of that source is kept at https://github.com/edwardfalk/espeak-ng, tagged \`vibe-espeak-ng-0.3.5\` at that commit.

## What Vibe changed

[\`scripts/vendor-speech.js\`](../../../scripts/vendor-speech.js) downloads the package, checks its integrity, and keeps only the English data files and the voice variants. It rewrites the file list inside \`espeak-ng.js\` to match the smaller \`espeak-ng.data\`. No compiled code is changed. Running the script reproduces these files exactly.
`;

async function unpack(name, { url, integrity }, into) {
  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  const digest =
    'sha512-' + createHash('sha512').update(bytes).digest('base64');
  if (digest !== integrity)
    throw new Error(`${name}: integrity mismatch for ${url}`);
  const tgz = join(into, `${name}.tgz`);
  const dir = join(into, name);
  writeFileSync(tgz, bytes);
  mkdirSync(dir);
  execFileSync('tar', ['-xzf', tgz, '-C', dir]);
  return join(dir, 'package');
}

// Work out the trimmed files completely before anything is written
function trimEspeak(pkg) {
  const js = readFileSync(join(pkg, 'espeak-ng.js'), 'utf8');
  const data = readFileSync(join(pkg, 'espeak-ng.data'));
  const manifest = js.match(MANIFEST);
  if (!manifest || Number(manifest[2]) !== data.length) {
    throw new Error(
      'espeak-ng.js: data manifest not found, or its size does not match espeak-ng.data'
    );
  }
  const entries = [...manifest[1].matchAll(ENTRY)];
  const listed = (manifest[1].match(/\{filename:/g) ?? []).length;
  if (entries.length !== listed) {
    throw new Error(
      `espeak-ng.js: parsed ${entries.length} of ${listed} data entries`
    );
  }
  const kept = [];
  const names = [];
  const parts = [];
  let offset = 0;
  for (const [, filename, start, end] of entries) {
    const name = filename.slice(DATA_PREFIX.length);
    if (!KEEP.some((re) => re.test(name))) continue;
    const bytes = data.subarray(Number(start), Number(end));
    kept.push(
      `{filename:${JSON.stringify(filename)},start:${offset},end:${offset + bytes.length}}`
    );
    names.push(name);
    parts.push(bytes);
    offset += bytes.length;
  }
  const missing = REQUIRED.filter((name) => !names.includes(name));
  if (missing.length)
    throw new Error(`espeak-ng: trimmed data lacks ${missing.join(', ')}`);
  return {
    js: js.replace(
      MANIFEST,
      () =>
        `loadPackage({files:[${kept.join(',')}],remote_package_size:${offset}})`
    ),
    data: Buffer.concat(parts),
    files: kept.length,
  };
}

const tmp = mkdtempSync(join(tmpdir(), 'vendor-speech-'));
try {
  // Download and verify both packages before writing anything
  const espeakPkg = await unpack('espeak', PACKAGES.espeak, tmp);
  const samPkg = await unpack('sam', PACKAGES.sam, tmp);
  const trimmed = trimEspeak(espeakPkg);

  mkdirSync(ESPEAK_OUT, { recursive: true });
  writeFileSync(join(ESPEAK_OUT, 'espeak-ng.js'), trimmed.js);
  writeFileSync(join(ESPEAK_OUT, 'espeak-ng.data'), trimmed.data);
  copyFileSync(join(espeakPkg, 'COPYING'), join(ESPEAK_OUT, 'COPYING'));
  writeFileSync(join(ESPEAK_OUT, 'SOURCE.md'), ESPEAK_SOURCE);
  mkdirSync(SAM_OUT, { recursive: true });
  copyFileSync(
    join(samPkg, 'dist/samjs.esm.min.js'),
    join(SAM_OUT, 'samjs.esm.min.js')
  );
  console.log(
    `espeak-ng: kept ${trimmed.files} data files, ${trimmed.data.length} bytes`
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
