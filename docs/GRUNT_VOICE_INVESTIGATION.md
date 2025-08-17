# Grunt Voice Investigation Results

_Investigation Date: 2025-01-20_

## Issue Report

User reported that grunt voices "sometimes sound like a standard web browser voice" instead of the intended childish/robotic character voice.

## Root Cause Analysis

### Problem Identified

The voice selection system in `packages/core/src/Audio.js` uses a fallback mechanism that can result in inconsistent voice selection:

1. **Primary Selection**: System attempts to find "robotic" voices by searching for keywords like "robot", "computer", "synthetic", "monotone", "flat" in voice names.

2. **Fallback Issue**: When no matching voices are found (which is common on most systems), the system fell back to selecting a completely random voice from all available voices.

3. **Inconsistent Results**: This meant grunts could sometimes get a male voice, sometimes a female voice, sometimes a system default voice - leading to the "standard web browser voice" experience.

## Web Speech API Limitations

The Web Speech API has inherent limitations:

- **Voice availability varies by system**: Windows, macOS, Chrome, Firefox all have different available voices
- **Voice naming inconsistency**: Very few systems have voices explicitly named with terms like "robot" or "computer"
- **No standardized character voice types**: The API wasn't designed for game character voices

## Solution Implemented

### Enhanced Fallback Logic

1. **Consistent Fallback**: Instead of random selection, each enemy type now gets a consistent fallback voice index
2. **Better Grunt Fallback**: Added intermediate fallback to prefer male voices for grunts (more robotic-sounding than female voices)
3. **Predictable Behavior**: Grunts will now always use the same voice on a given system

### Code Changes in `Audio.js`:

```javascript
// Added better grunt fallback
const maleVoices = availableVoices.filter(v => {
  const name = v.name.toLowerCase();
  return name.includes('male') || name.includes('david') || name.includes('alex');
});

// Replaced random fallback with consistent selection
const fallbackIndex = voiceType === 'grunt' ? 0 :
                     voiceType === 'rusher' ? 1 % availableVoices.length :
                     // ... etc
```

## Assessment

### Is This Unavoidable?

**Partially unavoidable** - The Web Speech API's limitations mean we cannot guarantee specific character voices on all systems. However, the improvements made will provide:

- **More consistency**: Grunts will sound the same throughout a play session
- **Better fallbacks**: When no robotic voices exist, prefer male voices over random
- **Predictable behavior**: Same system = same voices

### Alternative Approaches (Future Consideration)

1. **Audio Files**: Pre-recorded character voices (larger download, but guaranteed consistency)
2. **Audio Processing**: Real-time voice modulation using Web Audio API
3. **Voice Synthesis Libraries**: Third-party libraries with more character voice options

## Current Status

✅ **Fixed**: Inconsistent voice selection
✅ **Improved**: Better fallback logic for grunt voices
⚠️ **Limitation Remains**: Still dependent on system-available voices, but now more predictable

## User Impact

Grunts should now have more consistent voices, and when robotic voices aren't available, they'll prefer male voices which tend to sound less like "standard web browser voice" than random selections.

The childish/whiny character of grunt voices is primarily achieved through the audio configuration:

- `rate: 0.6` (slower speech)
- `pitch: 1.6` (higher pitch, but not too high)
- `volume: 0.45` (recently increased for better audibility)

This combination creates the intended childish/confused character even with standard system voices.
