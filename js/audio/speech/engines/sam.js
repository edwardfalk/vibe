/**
 * SAM, the Commodore 64's Software Automatic Mouth (js/vendor/sam; no
 * licence grant, shipped at the author's accepted risk). Plain ASCII only.
 */
import SamJs from '../../../vendor/sam/samjs.esm.min.js';

const SAMPLE_RATE = 22050;

// sing drops SAM's lift on stressed syllables. A sung vowel sits at about
// 6800 / pitch Hz (measured); sentence ends still fall, and some words wander
export async function render(text, { pitch, speed, mouth, throat, sing }) {
  // SAM crashes on text with nothing to pronounce
  if (!/[a-z0-9]/i.test(text)) throw new Error('SAM: nothing to say');
  const samples = new SamJs({
    pitch,
    speed,
    mouth,
    throat,
    singmode: sing === true,
  }).buf32(text);
  if (!samples) {
    throw new Error(`SAM can't read "${text}": it reads plain ASCII only`);
  }
  return { samples, sampleRate: SAMPLE_RATE };
}
