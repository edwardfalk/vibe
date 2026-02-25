/**
 * Speech wrapper config - maps convenience methods to dialogue getters.
 * Used by Audio.bindConvenienceSpeechMethods() to avoid duplicated method bodies.
 */

import {
  getPlayerDialogueLine,
  getEnemyDialogueLine,
} from './DialogueLines.js';
import { random, floor } from '../mathUtils.js';

/** Config: methodName -> { getLine(entity, context?), voiceType } */
export const SPEECH_WRAPPER_CONFIG = {
  speakPlayerLine: {
    getLine: (entity, context) => getPlayerDialogueLine(context, random, floor),
    voiceType: 'player',
  },
  speakGruntLine: {
    getLine: () => getEnemyDialogueLine('grunt', random, floor),
    voiceType: 'grunt',
  },
  speakRusherLine: {
    getLine: () => getEnemyDialogueLine('rusher', random, floor),
    voiceType: 'rusher',
  },
  speakTankLine: {
    getLine: () => getEnemyDialogueLine('tank', random, floor),
    voiceType: 'tank',
  },
  speakStabberLine: {
    getLine: () => getEnemyDialogueLine('stabber', random, floor),
    voiceType: 'stabber',
  },
};
