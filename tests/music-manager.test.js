import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicManager } from '../packages/core/src/audio/MusicManager.js';
import { SOUND } from '../packages/core/src/audio/SoundIds.js';

function makeAudioStub() {
  return {
    played: [],
    playSound(id) {
      this.played.push(id);
    },
    ensureAudioContext() {
      return true;
    },
  };
}

test('plays open hi-hat when three or more stabbers are active', () => {
  const audio = makeAudioStub();
  const beatClock = { getTotalBeats: () => 0, beatsPerMeasure: 4 };
  const gameState = { enemies: [{ type: 'stabber' }, { type: 'stabber' }, { type: 'stabber' }] };
  const mm = new MusicManager(audio, beatClock, gameState);
  mm.triggerBeat(1);
  assert.ok(audio.played.includes(SOUND.openHihat));
});

test('removes open hi-hat when stabbers drop below threshold', () => {
  const audio = makeAudioStub();
  const beatClock = { getTotalBeats: () => 0, beatsPerMeasure: 4 };
  const gameState = { enemies: [{ type: 'stabber' }, { type: 'stabber' }] };
  const mm = new MusicManager(audio, beatClock, gameState);
  mm.triggerBeat(1);
  assert.ok(!audio.played.includes(SOUND.openHihat));
});

test('plays tom when any rusher is active', () => {
  const audio = makeAudioStub();
  const beatClock = { getTotalBeats: () => 0, beatsPerMeasure: 4 };
  const gameState = { enemies: [{ type: 'rusher' }] };
  const mm = new MusicManager(audio, beatClock, gameState);
  mm.triggerBeat(1);
  assert.ok(audio.played.includes(SOUND.tom));
});

test('removes tom when no rushers remain', () => {
  const audio = makeAudioStub();
  const beatClock = { getTotalBeats: () => 0, beatsPerMeasure: 4 };
  const gameState = { enemies: [] };
  const mm = new MusicManager(audio, beatClock, gameState);
  mm.triggerBeat(1);
  assert.ok(!audio.played.includes(SOUND.tom));
});
