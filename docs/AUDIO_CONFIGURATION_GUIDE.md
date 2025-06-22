# 🎛️ Vibe Game Audio Configuration Guide

> **Purpose:**  
> This guide explains how to configure and tune all audio parameters in Vibe.  
> For rules, see [.cursorrules](../.cursorrules).

## 📁 File Location

All audio configuration lives in `packages/core/src/Audio.js` (moved from `js/Audio.js` after 2025 modularisation).

**Sound ID Registry** – Every legal SFX identifier is defined once in `packages/core/src/audio/SoundIds.js` (`SOUND` enum). When adding a new sound:

1. Add a config block in `Audio.sounds`.
2. Add the same key to `SoundIds.js`.
3. Use it via `SOUND.myNewId` to avoid typos.

The build will throw if the registry and config diverge.

**Player Event Bus** – Audio spatialisation now tracks the live Player via the `playerChanged` global event. Any place that creates a new Player **must** dispatch:

```javascript
window.dispatchEvent(new CustomEvent('playerChanged', { detail: window.player }));
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

### Variant-Array Pattern (2025+)

Some SFX (e.g., hit sounds) now use a `variants` array in their config:

```js
stabberKnifeHit: {
  variants: [
    { frequency: 3200, waveform: 'sawtooth', volume: 0.55, duration: 0.07 },
    { frequency: 2800, waveform: 'triangle', volume: 0.5, duration: 0.09 },
    { frequency: 3500, waveform: 'square', volume: 0.6, duration: 0.06 },
  ]
}
```

Only one registry entry is needed in `SoundIds.js` (e.g., `stabberKnifeHit`). The SFXManager will pick a random variant at runtime.

### New SFX Stubs (2025)
- `uiConfirm`: UI confirm/accept sound
- `uiCancel`: UI cancel/back sound
- `bulletMetalHit`: Bullet hitting metal (impact feedback)
- `onBeatBonus`: On-beat bonus/feedback
- `cosmicWind`: Ambient cosmic wind layer

### Enemy/Combat SFX (2025 Roadmap)

The following SFX are now implemented and documented in `Audio.js` and `SoundIds.js`:

- `gruntPop`: Main grunt death pop (volume: 0.6)
- `gruntPopEcho`: Grunt death echo (volume: 0.3)
- `tankDeathThump`: Tank death sub-bass thump (volume: 0.7)
- `rusherDeathFizz`: Rusher death fizz (volume: 0.22)
- `stabberDeathClink`: Stabber death metallic clink (volume: 0.32)
- `enemyChargeUp`: Enemy/tank special attack charge-up (volume: 0.28)

#### SFX Volume Tuning
- Main death SFX (e.g., `gruntPop`, `tankDeathThump`) are set in the 0.6–0.7 range for strong feedback.
- Echo/fizz/secondary effects (e.g., `gruntPopEcho`, `rusherDeathFizz`) are set lower (0.2–0.3) for subtlety, but can be raised for more presence.
- All SFX volumes are relative to the master and category gain (see Audio.js for details).
- As of June 2025, `gruntPop` and `gruntPopEcho` have been increased for better audibility.

All SFX are now documented in `Audio.js` and `SoundIds.js`. This guide is current as of June 2025.

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
// Change this line:
const reverbIntensity = 0.4 + normalizedDistance * 0.5;
// To this for more reverb:
const reverbIntensity = 0.6 + normalizedDistance * 0.4;
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
this.volume = 0.7; // Master volume (0.0-1.0)
```

**Adjust overall game volume:**

- Quieter: `this.volume = 0.5;`
- Louder: `this.volume = 0.9;`

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

All sound-effect names are centralized in `packages/core/src/audio/SoundIds.js` and re-exported via `@vibe/core` as `SOUND`.  Game code must reference `SOUND.someId` instead of raw strings.  The Audio class validates that every registry key has a sound config and vice-versa at runtime – missing mappings will throw during startup.

Example:
```js
import { SOUND } from '@vibe/core';
window.audio.playSound(SOUND.gruntPop, x, y);
```

Old calls like `playSound('gruntPop', …)` should be migrated to the constant form (legacy helpers inside `Audio.js` are already updated).  This guarantees typo-safety and keeps the codebase refactor-ready.

## 🌌 Ambient & Atmospheric SFX

The following ambient/atmospheric SFX are implemented in `Audio.js` and are processed with distance-based effects (reverb, lowpass, distortion) for spatial immersion:

| Sound ID         | Frequency | Waveform   | Volume | Duration | Intended Effect                |
|------------------|-----------|------------|--------|----------|-------------------------------|
| enemyIdle        | 200       | sine       | 0.1    | 0.8      | Subtle enemy hum, background  |
| stabberChant     | 1800      | triangle   | 0.3    | 0.5      | Eerie, ritualistic chant      |
| gruntMalfunction | 180       | sawtooth   | 0.12   | 0.4      | Glitchy, robotic error        |
| gruntBeep        | 800       | triangle   | 0.08   | 0.15     | Short, robotic beep           |
| gruntWhir        | 300       | sine       | 0.1    | 0.6      | Mechanical whirring           |
| gruntError       | 220       | square     | 0.1    | 0.2      | Error/failure tone            |
| gruntGlitch      | 150       | sawtooth   | 0.09   | 0.25     | Glitchy, digital noise        |
| stabberStalk     | 1600      | triangle   | 0.25   | 0.4      | Tense stalking, suspense      |
| cosmicWind       | 60        | noise      | 0.08   | 3.0      | Cosmic wind, deep ambience    |

- **Subtle SFX**: `enemyIdle`, `gruntBeep`, `gruntWhir`, `gruntError`, `gruntGlitch`, `cosmicWind` (low volume, background texture)
- **Prominent SFX**: `stabberChant`, `stabberStalk`, `gruntMalfunction` (higher volume, foreground atmosphere)

### Distance-Based Effects
- All ambient SFX above are processed with reverb, lowpass filtering, and mild distortion based on distance from the player (see Audio.js, playTone method).
- Distant enemies sound more echoey, filtered, and mystical; close enemies are clearer and drier.
- These effects are tuned for subtlety (see code comments for reverbIntensity, lowpassFreq, distortionAmount).

**Reference:** See `Audio.js` for all config details and effect processing. This guide is current as of June 2025.
