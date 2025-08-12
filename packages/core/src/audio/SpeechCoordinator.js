import * as Tone from 'tone';

/**
 * SpeechCoordinator – hooks into browser SpeechSynthesis to duck music/SFX
 * and optionally play a subtle background pad while speech is active.
 */
export class SpeechCoordinator {
  /**
   * @param {{ duck:(db:number)=>void, unduck:()=>void, playSound:(id:string)=>void }} audioFacade
   * @param {{ enabled?: boolean, padVolume?: number }} [opts]
   */
  constructor(audioFacade, opts = {}) {
    this.audio = audioFacade;
    this.enabled = opts.enabled ?? true;
    this.padVolume = opts.padVolume ?? 0.3;

    /** @type {Tone.PolySynth|null} */
    this._padSynth = null;
    this._active = false;

    if (this.enabled) {
      this._installInterceptor();
    }
  }

  _installInterceptor() {
    const synth = window.speechSynthesis;
    if (!synth || synth.__toneInterceptInstalled) return;

    const originalSpeak = synth.speak.bind(synth);
    synth.speak = (utterance) => {
      if (!utterance) return;
      // attach listeners once
      utterance.addEventListener('start', () => this._onSpeechStart());
      utterance.addEventListener('end', () => this._onSpeechEnd());
      originalSpeak(utterance);
    };
    synth.__toneInterceptInstalled = true;
    console.log('🗣️ SpeechCoordinator intercept installed');
  }

  _onSpeechStart() {
    if (this._active) return;
    this._active = true;
    this.audio.duck(-12);
    this._startPad();
  }

  _onSpeechEnd() {
    if (!this._active) return;
    this._active = false;
    this.audio.unduck();
    this._stopPad();
  }

  _startPad() {
    if (this._padSynth) return;
    this._padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.5, decay: 0.2, sustain: 0.4, release: 1 },
    }); // routing handled by facade when enabled
    const now = Tone.now();
    this._padSynth.triggerAttack(['C4', 'E4', 'G4'], now, this.padVolume);
  }

  _stopPad() {
    if (!this._padSynth) return;
    this._padSynth.triggerRelease(['C4', 'E4', 'G4'], Tone.now());
    setTimeout(() => {
      this._padSynth?.dispose();
      this._padSynth = null;
    }, 1500);
  }
}
