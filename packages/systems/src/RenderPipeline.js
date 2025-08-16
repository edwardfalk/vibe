// RenderPipeline.js – Ordered draw plugin pipeline for p5 instance-mode
// Each renderer must expose `layer` (number) and `draw(p, dt)` (function).
// Lower layer values are drawn first – treat as z-depth.

export const LAYERS = {
  BACKGROUND_FAR: 100,
  BACKGROUND_MID: 200,
  WORLD: 500,
  HUD: 900,
  OVERLAY: 950,
};

export class RenderPipeline {
  constructor() {
    /** @type {import('./types').IRenderer[]} */
    this.renderers = [];
    this._sorted = false;
  }

  /**
   * Add a renderer instance to the pipeline.
   * Call before first `draw`.
   * @param {{layer:number, draw:function}} renderer
   */
  addRenderer(renderer) {
    this.renderers.push(renderer);
    this._sorted = false;
  }

  /** Sort by layer (ascending). */
  _ensureSorted() {
    if (!this._sorted) {
      this.renderers.sort((a, b) => a.layer - b.layer);
      this._sorted = true;
    }
  }

  /**
   * Draw all registered renderers in order.
   * @param {p5} p
   * @param {number} [dt] – deltaTime ms (optional convenience)
   */
  draw(p, dt = 16) {
    this._ensureSorted();
    for (const r of this.renderers) {
      try {
        r.draw?.(p, dt);
      } catch (err) {
        console.error(
          '⚠️ RenderPipeline renderer failed',
          r.constructor?.name,
          err
        );
      }
    }
    // Global safety reset – prevent lingering additive/screen modes
    if (typeof p?.BLEND !== 'undefined') {
      p.blendMode(p.BLEND);
    }
  }
}
