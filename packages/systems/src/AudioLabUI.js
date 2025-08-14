import { SOUND, min, max } from '@vibe/core';

/**
 * AudioLabUI – standalone UI component for testing SFX in-game.
 * Handles its own state, keyboard controls, and drawing.
 */
export class AudioLabUI {
  /**
   * @param {{ playSound:(id:string, opts?:any)=>void }} audio – audio facade
   * @param {{ x:number, y:number }} player – player reference for positional audio (optional)
   */
  constructor(audio, player) {
    this.audio = audio;
    this.player = player;
    this.active = false;
    this.soundIds = Object.keys(SOUND || (audio && audio.sounds) || {});
    this.selected = 0;
    this.lastPlay = 0;
  }

  toggle() {
    this.active = !this.active;
    if (this.active) {
      // refresh list – might have changed
      this.soundIds = Object.keys(
        SOUND || (this.audio && this.audio.sounds) || {}
      );
      this.selected = 0;
    }
  }

  /** Process a key event while UI is active */
  handleKey(key) {
    if (!this.active) return false;
    if (key === 'Escape') {
      this.toggle();
      return true;
    }
    if (key === 'ArrowUp') {
      this.selected =
        (this.selected - 1 + this.soundIds.length) % this.soundIds.length;
      return true;
    }
    if (key === 'ArrowDown') {
      this.selected = (this.selected + 1) % this.soundIds.length;
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      const id = this.soundIds[this.selected];
      if (this.audio && this.audio.playSound) {
        const x = (this.player && this.player.x) || 400;
        const y = (this.player && this.player.y) || 300;
        this.audio.playSound(SOUND[id], { x, y });
        this.lastPlay = Date.now();
      }
      return true;
    }
    return false;
  }

  /** Draw the Audio Lab overlay */
  draw(p) {
    if (!this.active) return;
    p.push();
    // Background
    p.fill(0, 0, 0, 220);
    p.rect(0, 0, p.width, p.height);
    // Title & instructions
    p.textAlign(p.CENTER, p.TOP);
    p.textSize(32);
    p.fill(255, 255, 100);
    p.text('AUDIO LAB', p.width / 2, 40);
    p.textSize(16);
    p.fill(200);
    p.text('Up/Down: Select  Enter/Space: Play  Esc: Exit', p.width / 2, 80);

    // Sound list
    const startY = 120;
    const lineH = 28;
    const visible = 16;
    const offset = max(0, this.selected - Math.floor(visible / 2));
    for (let i = 0; i < min(visible, this.soundIds.length); i++) {
      const idx = i + offset;
      if (idx >= this.soundIds.length) break;
      const y = startY + i * lineH;
      if (idx === this.selected) {
        p.fill(100, 255, 200);
        p.rect(p.width / 2 - 220, y - 4, 440, lineH + 4, 8);
        p.fill(0);
      } else {
        p.fill(255);
      }
      p.textAlign(p.LEFT, p.CENTER);
      p.textSize(20);
      p.text(this.soundIds[idx], p.width / 2 - 200, y + lineH / 2);
    }

    // Master VU meter if available
    if (this.audio && this.audio.getMasterLevel) {
      const level = this.audio.getMasterLevel();
      const meterWidth = 300;
      const meterHeight = 20;
      const meterX = p.width / 2 - meterWidth / 2;
      const meterY = 100;
      p.noStroke();
      p.fill(80);
      p.rect(meterX, meterY, meterWidth, meterHeight, 4);
      p.fill(100, 255, 100);
      p.rect(meterX, meterY, meterWidth * level, meterHeight, 4);
      p.fill(255);
      p.textAlign(p.CENTER, p.TOP);
      p.text('Master Level', p.width / 2, meterY + meterHeight + 4);
    }
    p.pop();
  }
}
