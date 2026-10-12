import { describe, it, expect, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { bassistWorld } from './helpers/bassistWorld.js';

// How he moves and what he is drawn from: he holds his facing, turns to
// the hero on let 3, recoils from his slap, is knocked by shots, and his
// pose() is the look the studied versions draw (the studies page's L)
const DEFAULTS = { ...CONFIG.BASSIST };
const letMs = (n) => (n + CONFIG.SWING.AND_AT) * 500;

afterEach(() => {
  Object.assign(CONFIG.BASSIST, DEFAULTS);
});

describe('his facing', () => {
  it('holds between turns, though the hero moves', () => {
    const w = bassistWorld({ ms0: 1990, hero: { x: 300, y: 0 } });
    w.run(2000, 2200);
    const held = w.b.aimAngle;
    w.hero.y = 300;
    w.run(2216, 2600); // lets 1 and 2 pass: no turn
    expect(w.b.aimAngle).toBe(held);
  });

  it('turns to the hero on let 3, over TURN_SEC, and holds it to the slap', () => {
    const w = bassistWorld({ ms0: 1990, hero: { x: 0, y: 300 } });
    w.b.aim = 0; // facing away from him, along +x
    w.run(2000, letMs(6) - 10);
    expect(w.b.aimAngle).toBe(0);
    w.step(letMs(6) + 5);
    const toHero = w.b.toHero;
    w.run(letMs(6) + 21, letMs(6) + 1000 * CONFIG.BASSIST.TURN_SEC + 40);
    expect(w.b.aimAngle).toBeCloseTo(toHero, 6);
  });
});

describe('his kicks', () => {
  it('the slap kicks him back off his aim', () => {
    const w = bassistWorld({ ms0: 1990 });
    w.run(2000, letMs(7) - 10);
    const aim = w.b.aimAngle;
    w.step(letMs(7) + 5);
    const back = -(w.b.push.x * Math.cos(aim) + w.b.push.y * Math.sin(aim));
    expect(back).toBeGreaterThan(CONFIG.BASSIST.RECOIL_PX_S * 0.8);
  });

  it('a shot knocks him along its line, capped', () => {
    const { b } = bassistWorld();
    b.takeDamage(1, Math.PI / 2);
    expect(b.knock.y).toBeCloseTo(CONFIG.BASSIST.KNOCK_PX_S, 6);
    for (let i = 0; i < 6; i++) b.takeDamage(1, Math.PI / 2);
    expect(Math.hypot(b.knock.x, b.knock.y)).toBeCloseTo(
      CONFIG.BASSIST.KNOCK_MAX_PX_S,
      6
    );
  });
});

describe('his pose', () => {
  it('counts the telegraph from the bar, played or not: a notch a let, amber from let 3, white-hot before the slap', () => {
    const w = bassistWorld({ ms0: 1990 });
    w.b.health = 3; // one string: no plucks at all
    const tell = (ms) => {
      w.step(ms);
      return w.b.pose().tell;
    };
    expect(tell(letMs(4) + 10)).toMatchObject({
      notch: 1,
      amber: false,
      hot: false,
    });
    expect(tell(letMs(5) + 10)).toMatchObject({ notch: 2, amber: false });
    expect(tell(letMs(6) + 10)).toMatchObject({
      notch: 3,
      amber: true,
      hot: false,
    });
    // 0.4 beat before the slap: not yet; 0.2 beat before: white-hot
    expect(tell(letMs(7) - 200)).toMatchObject({ amber: true, hot: false });
    expect(tell(letMs(7) - 100)).toMatchObject({ amber: true, hot: true });
    expect(tell(letMs(7) + 10)).toMatchObject({
      notch: 0,
      amber: false,
      hot: false,
    });
  });

  it('keeps each sinew: when it was last played, and when it snapped', () => {
    const w = bassistWorld({ ms0: 1990 });
    w.run(2000, letMs(4) - 10);
    w.step(letMs(4) + 5); // let 1: its sinew plucked
    w.step(letMs(4) + 20);
    w.b.takeDamage(3); // and snapped
    w.step(letMs(4) + 120);
    const { sinews, strings, plays } = w.b.pose();
    expect(strings).toBe(3);
    expect(plays).toEqual([false, true, true, true]);
    expect(sinews[0].snapped).toBeCloseTo(0.1, 6);
    expect(sinews[0].pluck).toBeCloseTo(0.115, 6);
    expect(sinews[1].snapped).toBe(-1);
    expect(sinews[1].pluck).toBe(Infinity);
  });

  it('says which let comes next, and when', () => {
    const w = bassistWorld({ ms0: 1990 });
    w.step(4.2 * 500);
    const { letK, letIn, andAt, beat } = w.b.pose();
    expect(letK).toBe(0);
    expect(letIn).toBeCloseTo((4 + 2 / 3 - 4.2) * 0.5, 6);
    expect(andAt).toBe(CONFIG.SWING.AND_AT);
    expect(beat).toBe(0);
  });
});
