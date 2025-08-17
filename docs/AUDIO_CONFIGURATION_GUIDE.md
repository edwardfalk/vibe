# 🎛️ Vibe Game Audio Configuration Guide

> **Purpose:**  
> This guide explains how to configure and tune all audio parameters in Vibe.  
> For standards, see in-repo rules under `.cursor/rules/`.

## 📁 File Location

All audio configuration lives in `packages/core/src/Audio.js` (moved from `js/Audio.js` after 2025 modularisation).

**Sound ID Registry** – Every legal SFX identifier is defined once in `packages/core/src/audio/SoundIds.js` (`SOUND` enum). When adding a new sound:

1. Add a config block in `Audio.sounds`.
2. Add the same key to `SoundIds.js`.
3. Use it via `SOUND.myNewId` to avoid typos.

The build will throw if the registry and config diverge.

**Player Event Bus** – Audio spatialisation now tracks the live Player via the `playerChanged` global event. Any place that creates a new Player **must** dispatch:

```javascript
window.dispatchEvent(
  new CustomEvent('playerChanged', { detail: window.player })
);
```

Failure to emit the event will break distance-based volume/panning.

## 🔊 Sound Effects Configuration

### Location: Lines ~70-100 in `packages/core/src/Audio.js`

Each sound effect has these properties:

```javascript
soundName: {
    frequency: 80,        // Pitch in Hz (20-20000, lower = deeper)
    waveform: 'sine',     // Wave type: 'sine', 'sawtooth', 'square', 'triangle'
    volume: 0.6,          // Loudness (0.0-1.0, relative to master volume)
    duration: 4.0         // Length in seconds
}
```

### 🎯 Plasma Ball Example

```javascript
plasmaCloud: {
    frequency: 80,        // Deep bass rumble
    waveform: 'sine',     // Smooth, ominous tone
    volume: 0.6,          // Loud and prominent
    duration: 4.0         // 4 second duration
}
```

**Quick Adjustments:**

- **Louder plasma ball**: Change `volume: 0.6` to `volume: 0.8`
- **Deeper plasma ball**: Change `frequency: 80` to `frequency: 60`
- **Harsher plasma ball**: Change `waveform: 'sine'` to `waveform: 'sawtooth'`
- **Shorter plasma ball**: Change `duration: 4.0` to `duration: 2.0`

### 🎵 Waveform Guide

- **sine**: Smooth, pure tone (good for bass, ambient)
- **sawtooth**: Harsh, buzzy (good for aggressive sounds)
- **square**: Hollow, robotic (good for mechanical sounds)
- **triangle**: Soft, flute-like (good for ethereal sounds)

## 🎤 Speech Configuration

### Location: Lines ~105-111 in `packages/core/src/Audio.js`

Each character voice has these properties:

```javascript
voiceType: {
    rate: 0.8,      // Speech speed (0.1-2.0, 1.0 = normal)
    pitch: 0.1,     // Voice pitch (0.0-2.0, 1.0 = normal)
    volume: 0.4     // Speech volume (0.0-1.0) - NOW REDUCED for background effect
}
```

### 🎭 Character Voices

```javascript
player: { rate: 0.8, pitch: 0.1, volume: 0.4 },   // Deep, confident hero
grunt: { rate: 0.6, pitch: 0.3, volume: 0.3 },    // Slow, confused robot
rusher: { rate: 1.4, pitch: 1.5, volume: 0.35 },  // Fast, frantic
tank: { rate: 0.5, pitch: 0.2, volume: 0.4 },     // Slow, intimidating
stabber: { rate: 0.9, pitch: 1.9, volume: 0.3 }   // Sharp, precise
```

**Quick Adjustments:**

- **Quieter speech overall**: Reduce all `volume` values by 0.1
- **Faster grunt speech**: Increase grunt `rate` from 0.6 to 0.8
- **Deeper tank voice**: Decrease tank `pitch` from 0.2 to 0.1

## 🌊 Distance-Based Atmospheric Effects

### Location: Lines ~285-350 in `packages/core/src/Audio.js`

Ambient enemy sounds get enhanced effects based on distance:

### 🎚️ Effect Parameters

```javascript
// Distance calculation (0 = close, 1 = far)
const normalizedDistance = Math.min(distance / 600, 1);

// Reverb intensity: close = 0.4, far = 0.9
const reverbIntensity = 0.4 + normalizedDistance * 0.5;

// Lowpass filtering: close = 1800Hz, far = 600Hz
const lowpassFreq = 1800 - normalizedDistance * 1200;

// Distortion: close = 15, far = 40
const distortionAmount = 15 + normalizedDistance * 25;

// Delay time: close = 0.15s, far = 0.4s
const delayTime = 0.15 + normalizedDistance * 0.25;
```

### 🔧 Quick Adjustments

**More reverb on distant enemies:**

```javascript
// Current setting (reduced for less intrusion):
const reverbIntensity = 0.1 + normalizedDistance * 0.1;
// To increase reverb:
const reverbIntensity = 0.15 + normalizedDistance * 0.15;
```

**More distortion on distant enemies:**

```javascript
// Change this line:
const distortionAmount = 15 + normalizedDistance * 25;
// To this for more distortion:
const distortionAmount = 20 + normalizedDistance * 35;
```

**Longer mystical delays:**

```javascript
// Change this line:
const delayTime = 0.15 + normalizedDistance * 0.25;
// To this for longer delays:
const delayTime = 0.2 + normalizedDistance * 0.4;
```

## 🎯 Common Adjustments

### Make Speech Even Quieter

In the `voiceConfig` section, reduce all volume values:

```javascript
player: { rate: 0.8, pitch: 0.1, volume: 0.3 },   // Reduced from 0.4
grunt: { rate: 0.6, pitch: 0.3, volume: 0.2 },    // Reduced from 0.3
// etc...
```

### Make Sound Effects Louder

In the `sounds` section, increase volume values:

```javascript
playerShoot: { frequency: 150, waveform: 'sawtooth', volume: 0.3, duration: 0.1 }, // Increased from 0.2
explosion: { frequency: 120, waveform: 'sawtooth', volume: 0.7, duration: 0.4 },   // Increased from 0.5
```

### Enhance Atmospheric Effects

For more dramatic distant enemy effects:

```javascript
// More reverb range
const reverbIntensity = 0.5 + normalizedDistance * 0.5;

// More aggressive filtering
const lowpassFreq = 2000 - normalizedDistance * 1500;

// Stronger distortion
const distortionAmount = 20 + normalizedDistance * 40;
```

## 🎵 Master Volume Control

### Location: Line ~25 in `packages/core/src/Audio.js`

```javascript
this.volume = 1.0; // Master volume (0.0-1.0) - Updated to current setting
```

**Adjust overall game volume:**

- Quieter: `this.volume = 0.7;`
- Louder: `this.volume = 1.0;` (current setting)

## 🔄 Testing Changes

1. Save the `packages/core/src/Audio.js` file
2. Refresh the game in your browser
3. Listen to the changes during gameplay
4. Adjust parameters as needed
5. Repeat until satisfied

## 📝 Notes

- All volume values are relative to the master volume
- Distance effects only apply to ambient enemy sounds
- Speech volumes are now reduced to be background to sound effects
- Distant enemies get more reverb, distortion, and mystical delays
- Player sounds always play at full volume regardless of position

## Sound ID Registry

All sound-effect names are centralized in `packages/core/src/audio/SoundIds.js` and re-exported via `@vibe/core` as `SOUND`. Game code must reference `SOUND.someId` instead of raw strings. The Audio class validates that every registry key has a sound config and vice-versa at runtime – missing mappings will throw during startup.

Example:

```js
import { SOUND } from '@vibe/core';
window.audio.playSound(SOUND.gruntPop, x, y);
```

Old calls like `playSound('gruntPop', …)` should be migrated to the constant form (legacy helpers inside `Audio.js` are already updated). This guarantees typo-safety and keeps the codebase refactor-ready.
