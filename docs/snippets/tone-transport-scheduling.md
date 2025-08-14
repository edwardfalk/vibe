---
libraryId: /tonejs/tone.js
topic: transport scheduling
lastVerified: 2025-08-12
status: curated
---

# Tone.js – Transport Scheduling (loops and time-accurate triggers)

## Loops on the Transport (quarter/off-quarter)
```js
import * as Tone from 'tone';

const synthA = new Tone.FMSynth().toDestination();
const synthB = new Tone.AMSynth().toDestination();

// every quarter-note
const loopA = new Tone.Loop((time) => {
  synthA.triggerAttackRelease('C2', '8n', time);
}, '4n').start(0);

// off the quarters (start at eighth-note offset)
const loopB = new Tone.Loop((time) => {
  synthB.triggerAttackRelease('C4', '8n', time);
}, '4n').start('8n');

await Tone.start();
Tone.getTransport().bpm.value = 120;
Tone.getTransport().start();
```

## Time-accurate one-shots (use Tone.now())
```js
import * as Tone from 'tone';

const synth = new Tone.Synth().toDestination();
const now = Tone.now();

synth.triggerAttackRelease('C4', '8n', now);
synth.triggerAttackRelease('E4', '8n', now + 0.5);
synth.triggerAttackRelease('G4', '8n', now + 1);
```

## Vibe pattern – schedule on quarter-beats
```js
import * as Tone from 'tone';

export function scheduleQuarterBeat(fn) {
  // Executes fn at each Transport quarter boundary
  const id = Tone.getTransport().scheduleRepeat((time) => fn(time), '4n', 0);
  return () => Tone.getTransport().clear(id);
}
```
