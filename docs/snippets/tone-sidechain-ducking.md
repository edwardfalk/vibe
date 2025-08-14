---
libraryId: /tonejs/tone.js
topic: sidechain ducking
lastVerified: 2025-08-12
status: curated
---

# Tone.js – Sidechain/Ducking Pattern

- Route SFX through a compressor keyed by a short transient (kick/explosion) or by a control envelope.
- In Tone.js, emulate sidechain by feeding the same envelope into a `Gain` before music bus or by splitting to a `Compressor`.

## Simple: Music duck on SFX burst
```js
import * as Tone from 'tone';

const music = new Tone.Gain(1).toDestination();
const sfx = new Tone.Gain(1).toDestination();

// Global compressor on the master
const comp = new Tone.Compressor({ threshold: -24, ratio: 6, attack: 0.005, release: 0.15 });
Tone.Destination.chain(comp);

// When an SFX plays, briefly reduce music gain (manual sidechain)
export async function duckMusic(ms = 180, depth = 0.35) {
  const now = Tone.now();
  music.gain.cancelAndHoldAtTime(now);
  music.gain.linearRampToValueAtTime(1 - depth, now + 0.01);
  music.gain.linearRampToValueAtTime(1, now + ms / 1000);
}

// Example wiring
const playerMusic = new Tone.Player('/music/loop.mp3').connect(music);
const sfxPlayer = new Tone.Player('/sfx/explosion.mp3').connect(sfx);

await Tone.start();
playerMusic.autostart = true;

function playExplosion() {
  sfxPlayer.start();
  duckMusic(200, 0.4);
}
```
