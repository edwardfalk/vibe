function pickVoice(voices, randomFn, floorFn) {
  if (voices.length === 0) return null;
  return voices[floorFn(randomFn() * voices.length)];
}

function getUsPreferredVoices(englishVoices = []) {
  const usVoices = englishVoices.filter((voice) => voice.lang.includes('US'));
  return usVoices.length > 0 ? usVoices : englishVoices;
}

export function selectBasicVoice(
  englishVoices = [],
  voiceType = 'player',
  randomFn = Math.random,
  floorFn = Math.floor
) {
  if (englishVoices.length === 0) return null;
  const availableVoices = getUsPreferredVoices(englishVoices);

  if (voiceType === 'player') {
    const maleVoices = availableVoices.filter((voice) => {
      const name = voice.name.toLowerCase();
      return (
        name.includes('male') ||
        name.includes('david') ||
        name.includes('alex') ||
        name.includes('james') ||
        name.includes('john') ||
        name.includes('michael') ||
        name.includes('mark') ||
        name.includes('paul') ||
        name.includes('daniel') ||
        name.includes('deep') ||
        name.includes('bass') ||
        name.includes('rich')
      );
    });

    const deepVoices = maleVoices.filter((voice) => {
      const name = voice.name.toLowerCase();
      return (
        name.includes('deep') ||
        name.includes('bass') ||
        name.includes('rich') ||
        name.includes('low')
      );
    });

    if (deepVoices.length > 0) return deepVoices[0];
    if (maleVoices.length > 0) return maleVoices[0];
    return availableVoices[0];
  }

  return pickVoice(availableVoices, randomFn, floorFn);
}

export function selectVoiceWithEffects(
  englishVoices = [],
  voiceType = 'player',
  text = '',
  randomFn = Math.random,
  floorFn = Math.floor
) {
  // Reserved for future content-sensitive voice heuristics.
  void text;
  if (englishVoices.length === 0) return null;
  const availableVoices = getUsPreferredVoices(englishVoices);

  if (voiceType === 'player') {
    const maleVoices = availableVoices.filter((voice) => {
      const name = voice.name.toLowerCase();
      return (
        name.includes('male') ||
        name.includes('david') ||
        name.includes('alex') ||
        name.includes('james') ||
        name.includes('john') ||
        name.includes('michael') ||
        name.includes('mark') ||
        name.includes('paul') ||
        name.includes('daniel') ||
        name.includes('deep') ||
        name.includes('bass') ||
        name.includes('rich') ||
        name.includes('low') ||
        name.includes('tom') ||
        name.includes('sam')
      );
    });

    const deepVoices = maleVoices.filter((voice) => {
      const name = voice.name.toLowerCase();
      return (
        name.includes('deep') ||
        name.includes('bass') ||
        name.includes('rich') ||
        name.includes('low') ||
        name.includes('resonant')
      );
    });

    if (deepVoices.length > 0) return deepVoices[0];
    if (maleVoices.length > 0) return maleVoices[0];
    return availableVoices[0];
  }

  if (voiceType === 'grunt') {
    const roboticVoices = availableVoices.filter((voice) => {
      const name = voice.name.toLowerCase();
      return (
        name.includes('robot') ||
        name.includes('computer') ||
        name.includes('synthetic') ||
        name.includes('monotone') ||
        name.includes('flat')
      );
    });
    if (roboticVoices.length > 0) {
      return pickVoice(roboticVoices, randomFn, floorFn);
    }
  }

  if (voiceType === 'rusher') {
    const franticVoices = availableVoices.filter((voice) => {
      const name = voice.name.toLowerCase();
      return (
        name.includes('female') ||
        name.includes('high') ||
        name.includes('fast') ||
        name.includes('excited') ||
        name.includes('energetic')
      );
    });
    if (franticVoices.length > 0) {
      return pickVoice(franticVoices, randomFn, floorFn);
    }
  }

  if (voiceType === 'tank') {
    const deepVoices = availableVoices.filter((voice) => {
      const name = voice.name.toLowerCase();
      return (
        name.includes('deep') ||
        name.includes('bass') ||
        name.includes('low') ||
        name.includes('heavy') ||
        name.includes('strong') ||
        name.includes('male')
      );
    });
    if (deepVoices.length > 0) {
      return pickVoice(deepVoices, randomFn, floorFn);
    }
  }

  if (voiceType === 'stabber') {
    const preciseVoices = availableVoices.filter((voice) => {
      const name = voice.name.toLowerCase();
      return (
        name.includes('clear') ||
        name.includes('precise') ||
        name.includes('clinical') ||
        name.includes('sharp') ||
        name.includes('articulate')
      );
    });
    if (preciseVoices.length > 0) {
      return pickVoice(preciseVoices, randomFn, floorFn);
    }
  }

  return pickVoice(availableVoices, randomFn, floorFn);
}
