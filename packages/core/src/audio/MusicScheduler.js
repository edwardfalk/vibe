import * as Tone from 'tone';

/**
 * MusicScheduler – schedules a repeating 1-bar (4 beats) drum loop using Tone.Part.
 * The triggerFn must synchronously play a sample when called with an id.
 */
export class MusicScheduler {
  /**
   * @param {(id: string) => void} triggerFn – Function that immediately triggers a sample
   * @param {number} [bpm=120] – Beats per minute of the loop
   */
  constructor(triggerFn, bpm = 120) {
    this._trigger = triggerFn;
    this.bpm = bpm;
    /** @type {Tone.Part | null} */
    this._part = null;
  }

  /** Start the part (idempotent). */
  start() {
    if (this._part) return;
    Tone.Transport.bpm.value = this.bpm;

    // Define a simple 4-beat drum groove
    const events = [
      ['0:0:0', 'musicKick'], // kick
      ['0:1:0', 'musicSnare'], // snare
      ['0:2:0', 'musicKick'],
      ['0:3:0', 'musicSnare'],
      // hi-hat every beat
      ['0:0:0', 'musicHihat'],
      ['0:1:0', 'musicHihat'],
      ['0:2:0', 'musicHihat'],
      ['0:3:0', 'musicHihat'],
    ];

    this._part = new Tone.Part((time, sampleId) => {
      this._trigger(sampleId);
    }, events).start(0);

    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }
  }

  /** Stop and dispose of the loop. */
  stop() {
    if (!this._part) return;
    this._part.stop();
    this._part.dispose();
    this._part = null;
  }
}
