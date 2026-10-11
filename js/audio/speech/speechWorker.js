/**
 * The speech worker: renders lines with SAM or espeak-ng off the main thread
 * and levels each one (level in), so every effect chain gets the same input
 * whichever engine made the line, and reads its pitch (f0, for tuning).
 * Talks to Voicebox by message.
 */
import * as espeak from './engines/espeak.js';
import * as sam from './engines/sam.js';
import { isUsable, matchLoudness } from './levels.js';
import { medianHz } from './pitch.js';

const ENGINES = { sam, espeak };

export async function renderRequest({ engine, text, voice, targetDb }) {
  const impl = ENGINES[engine];
  if (!impl) throw new Error(`No speech engine called "${engine}"`);
  const t0 = performance.now();
  const { samples, sampleRate } = await impl.render(text, voice);
  if (!isUsable(samples))
    throw new Error(`${engine} made no sound for "${text}"`);
  const levelled = matchLoudness(samples, sampleRate, targetDb);
  // The dry line's: the chain's ring mod, drive and filters would mislead it
  const f0 = medianHz(levelled, sampleRate);
  return {
    samples: levelled,
    sampleRate,
    renderMs: performance.now() - t0,
    f0,
  };
}

// An engine that crashed or failed to load marks its error fatal: it is
// dead for the rest of the session
const isFatal = (error) => error?.fatal === true;

async function handle(message) {
  if (message.type === 'variants') return { variants: await espeak.variants() };
  return renderRequest(message);
}

if (
  typeof WorkerGlobalScope !== 'undefined' &&
  self instanceof WorkerGlobalScope
) {
  self.onmessage = async ({ data }) => {
    try {
      const reply = await handle(data);
      const transfer = reply.samples ? [reply.samples.buffer] : [];
      self.postMessage({ id: data.id, ...reply }, transfer);
    } catch (error) {
      self.postMessage({
        id: data.id,
        error: String(error?.message ?? error),
        fatal: isFatal(error),
      });
    }
  };
}
