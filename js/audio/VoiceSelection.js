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
    // Whiny big-baby voice - prefer high/child-like voices
    const whinyVoices = availableVoices.filter((voice) => {
      const name = voice.name.toLowerCase();
      return (
        name.includes('high') ||
        name.includes('child') ||
        name.includes('junior') ||
        name.includes('squeaky') ||
        name.includes('zira') ||
        name.includes('flo') ||
        name.includes('grandma')
      );
    });
    if (whinyVoices.length > 0) {
      return pickVoice(whinyVoices, randomFn, floorFn);
    }
    // Fallback: pick the last voice (typically higher-pitched on most systems)
    return availableVoices[availableVoices.length - 1];
  }

  if (voiceType === 'rusher') {
    const franticVoices = availableVoices.filter((voice) => {
      const name = voice.name.toLowerCase();
      return (
        name.includes('female') ||
        name.includes('high') ||
        name.includes('fast') ||
        name.includes('excited') ||
        name.includes('energetic') ||
        name.includes('zira') ||
        name.includes('samantha') ||
        name.includes('karen') ||
        name.includes('moira')
      );
    });
    if (franticVoices.length > 0) {
      return pickVoice(franticVoices, randomFn, floorFn);
    }
    // Fallback: pick from the upper half of voices (tend to be higher pitched)
    const upperHalf = availableVoices.slice(
      floorFn(availableVoices.length / 2)
    );
    return pickVoice(
      upperHalf.length > 0 ? upperHalf : availableVoices,
      randomFn,
      floorFn
    );
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
        name.includes('male') ||
        name.includes('david') ||
        name.includes('daniel') ||
        name.includes('alex')
      );
    });
    if (deepVoices.length > 0) {
      return pickVoice(deepVoices, randomFn, floorFn);
    }
    // Fallback: pick the first voice (typically lower-pitched on most systems)
    return availableVoices[0];
  }

  if (voiceType === 'stabber') {
    const preciseVoices = availableVoices.filter((voice) => {
      const name = voice.name.toLowerCase();
      return (
        name.includes('clear') ||
        name.includes('precise') ||
        name.includes('clinical') ||
        name.includes('sharp') ||
        name.includes('articulate') ||
        name.includes('google') ||
        name.includes('reed') ||
        name.includes('compact')
      );
    });
    if (preciseVoices.length > 0) {
      return pickVoice(preciseVoices, randomFn, floorFn);
    }
    // Fallback: pick from the middle of the list (neutral/precise-sounding)
    const midIdx = floorFn(availableVoices.length / 2);
    return availableVoices[midIdx];
  }

  return pickVoice(availableVoices, randomFn, floorFn);
}
