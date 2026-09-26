import { random } from '../mathUtils.js';
import {
  isAggressiveText,
  isConfusedText,
  isScreamingText,
} from './TextSemantics.js';

// SpeechSynthesisUtterance's valid ranges
const MIN_PITCH = 0;
const MAX_PITCH = 2;
const MIN_RATE = 0.1;
const MAX_RATE = 10;

export function applyVoiceEffects(utterance, voiceType, text, voiceConfig) {
  const raw = voiceConfig[voiceType] || voiceConfig.player;
  const baseConfig = {
    rate: raw?.rate ?? 1.0,
    pitch: raw?.pitch ?? 1.0,
  };
  const isAggressive = isAggressiveText(text);
  const isConfused = isConfusedText(text);
  const isScreaming = isScreamingText(text);

  if (voiceType === 'player') {
    if (isAggressive) {
      utterance.rate = Math.max(0.8, baseConfig.rate - 0.1);
      utterance.pitch = baseConfig.pitch - 0.1;
    }
  } else if (voiceType === 'grunt') {
    if (isConfused) {
      utterance.rate = Math.max(0.4, baseConfig.rate - 0.2);
      utterance.pitch = baseConfig.pitch + random(-0.1, 0.1);
    }
    if (isAggressive) {
      utterance.rate = Math.min(1.0, baseConfig.rate + 0.2);
      utterance.pitch = baseConfig.pitch + 0.2;
    }
  } else if (voiceType === 'rusher') {
    if (isScreaming || isAggressive) {
      utterance.rate = Math.min(2.0, baseConfig.rate + 0.3);
      utterance.pitch = baseConfig.pitch + 0.2;
    }
  } else if (voiceType === 'tank') {
    if (isAggressive) {
      utterance.rate = Math.max(0.3, baseConfig.rate - 0.2);
      utterance.pitch = baseConfig.pitch - 0.1;
    }
  } else if (voiceType === 'stabber' && isAggressive) {
    utterance.rate = Math.max(0.7, baseConfig.rate - 0.2);
    utterance.pitch = baseConfig.pitch + random(-0.05, 0.05);
  }

  utterance.rate += random(-0.05, 0.05);
  utterance.pitch += random(-0.03, 0.03);
  // The only pitch limit is the range the Web Speech API accepts
  utterance.rate = Math.max(MIN_RATE, Math.min(MAX_RATE, utterance.rate));
  utterance.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, utterance.pitch));
}
