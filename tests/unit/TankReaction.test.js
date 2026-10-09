import { describe, it, expect, vi } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { Tank } from '../../js/entities/Tank.js';
import {
  drawTank,
  tankParts,
  tankRaisedParts,
} from '../../js/entities/TankRenderer.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { transformP5 } from './helpers/transformP5.js';

// A tank posed at a beat position, without updating it (as TankLook.test.js)
const tankAt = (beats, facing = 0) => {
  const clock = { getBeatPosition: () => beats, beatInterval: 500 };
  const context = { get: (k) => (k === 'beatClock' ? clock : undefined) };
  const t = new Tank(0, 0, 'tank', { context }, createMockP5(), null);
  t.isSpawning = false;
  t.facing = facing;
  t.turn = { from: facing, to: facing, at: null };
  t.poseBeats = beats;
  return t;
};
const S = 50 * CONFIG.TANK_LOOK.ART_SCALE;
const draw = (look, react) => {
  const r = transformP5();
  drawTank(r.p, S, look, react);
  return r;
};
const imagesOf = (shapes, part) =>
  shapes.filter((sh) => sh.kind === 'image' && sh.g === part.g);
const scaleOf = ([a, b]) => Math.hypot(a, b);
// What was drawn, with each sprite named by its part (each stand-in p5
// builds its own sprites)
const named = ({ p, shapes }) => {
  const names = new Map(
    [tankParts(p, S), tankRaisedParts(p, S)].flatMap((parts) =>
      Object.entries(parts).map(([name, part]) => [part.g, name])
    )
  );
  return shapes.map(({ g, ...rest }) => ({ ...rest, g: names.get(g) }));
};

describe("the tank's reaction (an 'uh oh', his death's first moments)", () => {
  it('with an empty reaction, or one at rest, draws exactly what his pose alone draws', () => {
    // A reaction at rest names each field's resting value, so a default that
    // isn't at rest shows (the replay compare shows he draws as before)
    const rest = { k: 1, shiver: 0, hands: 0, drop: 0, turn: 0 };
    for (const beats of [18, 18.6, 19.3]) {
      const look = tankAt(beats, 0.7).pose();
      const plain = draw(look);
      for (const react of [{}, rest]) {
        const drawn = draw(look, react);
        expect(named(drawn)).toEqual(named(plain));
        expect(drawn.calls).toEqual(plain.calls);
      }
    }
  });

  it('flings his hands off the cannon, up and out, open, and the cannon sags without his fists', () => {
    const look = tankAt(18).pose(); // facing +x
    const { p, shapes } = draw(look, { hands: 1, drop: 1 });
    const raised = tankRaisedParts(p, S);
    const hands = imagesOf(shapes, raised.hand).map((h) => [
      h.matrix[4],
      h.matrix[5],
    ]);
    expect(hands).toHaveLength(2);
    // One out to each side, ahead of his shoulders, past his shoulder domes
    const ys = hands.map(([, y]) => y).sort((a, b) => a - b);
    expect(ys[0]).toBeLessThan(-S * 1.2);
    expect(ys[1]).toBeGreaterThan(S * 1.2);
    for (const [x] of hands) expect(x).toBeGreaterThan(S * 0.5);
    // and back from where they held the cannon (at the least lift)
    const grip = draw(look, { hands: 1e-4, drop: 1 });
    const gripX = imagesOf(grip.shapes, tankRaisedParts(grip.p, S).hand)[0]
      .matrix[4];
    for (const [x] of hands) expect(x).toBeLessThan(gripX - S * 0.1);
    expect(imagesOf(shapes, raised.cannonBare)).toHaveLength(1);
    expect(imagesOf(shapes, tankParts(p, S).cannon)).toHaveLength(0);
  });

  it('keeps the heat off a cannon he has let go, even while charging (its sprites carry his fists)', () => {
    const t = tankAt(18);
    t.chargingShot = true;
    t.chargeStartBeat = 17;
    const { p, shapes } = draw(t.pose(), { hands: 1 });
    const parts = tankParts(p, S);
    expect(imagesOf(shapes, parts.cannonAmber)).toHaveLength(0);
    expect(imagesOf(shapes, parts.cannonHot)).toHaveLength(0);
  });

  it('makes all of him bigger by k, about his centre', () => {
    const look = tankAt(18).pose();
    const a = draw(look);
    const b = draw(look, { k: 1.1 });
    const slabA = imagesOf(a.shapes, tankParts(a.p, S).slab)[0];
    const slabB = imagesOf(b.shapes, tankParts(b.p, S).slab)[0];
    expect(scaleOf(slabB.matrix) / scaleOf(slabA.matrix)).toBeCloseTo(1.1);
  });

  it('draws the head he is given, turned further, and what is drawn on it in its frame', () => {
    const look = tankAt(18).pose();
    const { p, shapes } = draw(look);
    const own = imagesOf(shapes, tankParts(p, S).head)[0];
    const other = tankParts(p, S).scalp ?? tankParts(p, S).headFlush;
    const onHead = vi.fn();
    const r = draw(look, { head: other, turn: 1, onHead });
    const swapped = imagesOf(r.shapes, other);
    expect(swapped.length).toBeGreaterThan(0);
    expect(imagesOf(r.shapes, tankParts(r.p, S).head)).toHaveLength(0);
    const turned = Math.atan2(swapped[0].matrix[1], swapped[0].matrix[0]);
    const before = Math.atan2(own.matrix[1], own.matrix[0]);
    expect(turned - before).toBeCloseTo(1);
    expect(onHead).toHaveBeenCalledTimes(1);
    expect(onHead.mock.calls[0][0]).toBe(r.p);
    expect(onHead.mock.calls[0][1]).toBe(r.p.drawingContext);
  });

  it('leaves his chain or his cannon off, and draws on his back', () => {
    const look = tankAt(18).pose();
    const back = vi.fn();
    const { p, shapes } = draw(look, { chain: false, cannon: false, back });
    const parts = tankParts(p, S);
    expect(imagesOf(shapes, parts.chain)).toHaveLength(0);
    expect(imagesOf(shapes, parts.cannon)).toHaveLength(0);
    expect(back).toHaveBeenCalledTimes(1);
  });
});
