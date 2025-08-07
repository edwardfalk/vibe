// AudioDiagnosticsOverlay.js – quick debugging overlay for audio health metrics
// Toggle via 'O' key (like ProfilerOverlay uses 'P')

class AudioDiagnosticsOverlay {
  constructor() {
    this.visible = false;
  }

  toggle() {
    this.visible = !this.visible;
  }

  draw(p) {
    if (!this.visible || !window.audio || !window.audio.getDiagnostics) return;
    const diag = window.audio.getDiagnostics();
    if (!diag) return;

    p.push();
    p.textFont('monospace');
    p.textAlign(p.LEFT, p.TOP);
    p.textSize(12);

    const pad = 6;
    const lineH = 14;
    const boxW = 200;
    const boxH = lineH * 6;

    p.noStroke();
    p.fill(0, 0, 0, 140);
    p.rect(p.width - boxW - pad, pad, boxW, boxH, 4);

    p.fill(0, 200, 255);
    let y = pad + 4;
    const startX = p.width - boxW - pad + 4;
    p.text(`Audio Diagnostics`, startX, y);
    y += lineH;
    p.text(`BPM        : ${diag.bpm.toFixed(1)}`, startX, y);
    y += lineH;
    p.text(`Master LVL : ${(diag.masterLevel * 100).toFixed(1)}%`, startX, y);
    y += lineH;
    p.text(`Players    : ${diag.players}`, startX, y);
    y += lineH;
    p.text(`Fallback   : ${diag.fallbackSynths}`, startX, y);
    y += lineH;
    p.pop();
  }
}

const audioOverlay = new AudioDiagnosticsOverlay();
export default audioOverlay; 