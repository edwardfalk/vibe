/**
 * SAM, the Commodore 64's Software Automatic Mouth (js/vendor/sam; no
 * licence grant, shipped at the author's accepted risk). Plain ASCII only.
 */
import SamJs from '../../../vendor/sam/samjs.esm.min.js';

const SAMPLE_RATE = 22050;

export async function render(text, { pitch, speed, mouth, throat }) {
  // SAM crashes on text with nothing to pronounce
  if (!/[a-z0-9]/i.test(text)) throw new Error('SAM: nothing to say');
  const samples = new SamJs({ pitch, speed, mouth, throat }).buf32(text);
  if (!samples) {
    throw new Error(`SAM can't read "${text}": it reads plain ASCII only`);
  }
  return { samples, sampleRate: SAMPLE_RATE };
}
