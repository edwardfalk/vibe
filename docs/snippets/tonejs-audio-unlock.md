---
libraryId: /tonejs/tone.js
topic: audio unlock pattern
lastVerified: 2025-08-12
status: curated
---

# Tone.js – Audio Unlock Pattern

- Most browsers require user gesture to start audio.
- Trigger from a canvas click, then resume the AudioContext.

## Example
```js
import * as Tone from 'tone';

async function unlockAudio() {
  if (Tone.context.state !== 'running') {
    await Tone.start();
  }
}

canvas.addEventListener('click', () => unlockAudio());
```
