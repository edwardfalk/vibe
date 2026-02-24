import {
  isAggressiveText,
  isConfusedText,
  isScreamingText,
} from './TextSemantics.js';

export function applyVoiceEffects(
  utterance,
  voiceType,
  text,
  voiceConfig,
  randomRange
) {
  const baseConfig = voiceConfig[voiceType] || voiceConfig.player || {};
  const isAggressive = isAggressiveText(text);
  const isConfused = isConfusedText(text);
  const isScreaming = isScreamingText(text);

  if (voiceType === 'player') {
    if (isAggressive) {
      utterance.rate = Math.max(0.8, baseConfig.rate - 0.1);
      utterance.pitch = Math.max(0.3, baseConfig.pitch - 0.1);
    }
  } else if (voiceType === 'grunt') {
    if (isConfused) {
      utterance.rate = Math.max(0.4, baseConfig.rate - 0.2);
      utterance.pitch = baseConfig.pitch + randomRange(-0.1, 0.1);
    }
    if (isAggressive) {
      utterance.rate = Math.min(1.0, baseConfig.rate + 0.2);
      utterance.pitch = Math.min(1.0, baseConfig.pitch + 0.2);
    }
  } else if (voiceType === 'rusher') {
    if (isScreaming || isAggressive) {
      utterance.rate = Math.min(2.0, baseConfig.rate + 0.3);
      utterance.pitch = Math.min(2.0, baseConfig.pitch + 0.2);
    }
  } else if (voiceType === 'tank') {
    if (isAggressive) {
      utterance.rate = Math.max(0.3, baseConfig.rate - 0.2);
      utterance.pitch = Math.max(0.1, baseConfig.pitch - 0.1);
    }
  } else if (voiceType === 'stabber' && isAggressive) {
    utterance.rate = Math.max(0.7, baseConfig.rate - 0.2);
    utterance.pitch = baseConfig.pitch + randomRange(-0.05, 0.05);
  }

  utterance.rate += randomRange(-0.05, 0.05);
  utterance.pitch += randomRange(-0.03, 0.03);
  utterance.rate = Math.max(0.1, Math.min(2.0, utterance.rate));
  utterance.pitch = Math.max(0.1, Math.min(2.0, utterance.pitch));
}
