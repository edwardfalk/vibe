# espeak-ng for Vibe

This folder holds a build of [eSpeak NG](https://github.com/espeak-ng/espeak-ng), a speech synthesizer licensed under the GNU General Public License, version 3 or later (see `COPYING`). The rest of the game is MIT-licensed; see the repository's README.

## Where it comes from

- `espeak-ng.js` and `espeak-ng.data` come from the npm package [`@echogarden/espeak-ng-emscripten`](https://www.npmjs.com/package/@echogarden/espeak-ng-emscripten) 0.3.5 (GPL-3.0), integrity `sha512-Izbkm7NWccwb//RKgOp1/0k21StKN1DFIn+K7GU1XN7n6pmSi4bsk/0tYUsgQbysC4GVyrVompNmLInU/BFE+A==`.
- That package is built by https://github.com/echogarden-project/espeak-ng-emscripten. Its release commit is `ea36b43595facf07f1c5dc487b9f0de3340c1b5e` ("Increment version", 2025-08-19), and its build instructions compile the `fork` branch of https://github.com/echogarden-project/espeak-ng, a fork of eSpeak NG, with Emscripten.
- The build does not pin a commit of that branch. On the release date the branch's head was `ae87fc2ecc830593dc0cd62a6242cdf73c68b357` (2025-08-18), so that is the corresponding source as far as it can be identified.
- A copy of that source is kept at https://github.com/edwardfalk/espeak-ng, tagged `vibe-espeak-ng-0.3.5` at that commit.

## What Vibe changed

[`scripts/vendor-speech.js`](../../../scripts/vendor-speech.js) downloads the package, checks its integrity, and keeps only the English data files and the voice variants. It rewrites the file list inside `espeak-ng.js` to match the smaller `espeak-ng.data`. No compiled code is changed. Running the script reproduces these files exactly.
