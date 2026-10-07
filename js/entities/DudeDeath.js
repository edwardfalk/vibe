/**
 * How the Dude dies: he lies back, as if on a lilo. Ported from the
 * `lieback` variant of docs/superpowers/specs/2026-10-05-death-studies/
 * (deaths-dude.js, its parts in dude-death-parts.js; git-ignored); the spec
 * is docs/superpowers/specs/2026-10-07-deaths-design.md.
 *
 * The fatal hit knocks the blaster out of his hand and his White Russian out
 * of the other. He lowers himself flat onto his back, onto a carpet that
 * isn't there, arms flung out, and floats; his anger drains (the red, the
 * vein, one last big puff of steam) back to his calm smirk, while the glass
 * drifts off, pouring a beaded milky trail. The Dude abides.
 *
 * He is drawn from his renderer's own parts (PlayerRenderer.js), split at
 * the joints; only his flung-out arms with open hands are new art. Times are
 * seconds from the hit; angles are in his body's frame, facing right
 * (+ turns clockwise on screen); lengths are the prototype's px at size 32.
 */
import { CONFIG } from '../config.js';
import { smooth, clamp01 } from '../mathUtils.js';
import { drawGlow } from '../effects/glowUtils.js';
import { spriteParts } from './spriteCache.js';
import { hash01 } from './RusherRenderer.js';
import {
  HERO_COLORS as C,
  BAND,
  O,
  HIP_Y,
  HIPS,
  HAIR_PIVOT,
  OFF_SHOULDER,
  DRINK_ARM_RAD,
  FLINCH_PX,
  PROTO_SIZE,
  SHOULDER,
  FEET_Y,
  STEAM_SEC,
  ctx,
  fillC,
  strokeC,
  ell,
  rr,
  bx,
  leg,
  hairBack,
  glass,
  robe,
  sash,
  blaster,
  neck,
  headFrame,
  mouth,
  vein,
  steamPuffs,
  shadesOn,
  shadowAt,
  heroSprites,
  begin,
  stamp,
  stampSprite,
  heroHurt,
  heroFlash,
  heroTremble,
  heroRed,
} from './PlayerRenderer.js';

// ---- his lying back --------------------------------------------------------------
const KNOCK_SEC = 0.3; // the hit rocks him back a little
const KNOCK_K = 0.25;
const LIE_FROM = 0.12; // then he lowers himself the rest of the way
const LIE_SEC = 1.15;
const LIE_RAD = -1.45; // flat on his back, as on a lilo
const ARMS_FROM = 0.15;
const ARMS_SEC = 1.0;
// Flung out in a line across him: the near hand up over his chest, the far
// one down past his head
const ARMS_RAD = [0.25, 3.15];
const SWAY_RAD = 0.05; // then they sway slowly
const SWAY_RATE = 2.6; // rad/s
const LEGS_RAD = [-0.05, 0.12]; // legs out, the far one a touch up
const HEAD_RAD = 0.15; // his head on a slight cushion
const HAIR_RAD = 0.7; // his hair floats out
const CALM_SEC = 1.4; // his anger drains from the hit: red, vein, steam
const GLOW_SEC = 0.5; // the game's red glow goes faster
const GLOW_COLOR = C.angry;
const GLOW_SIZE = 2.1; // of his size
const GLOW_Y = -3;
const GLOW_ALPHA = [0.3, 0.4]; // and more on the kick
const VEIN_FROM = 0.2; // the vein fades between these angers
const VEIN_SPAN = 0.4;
const BOIL_FROM = 0.55; // steam puffs on the kick above this anger
const RELEASE_AT = 0.35; // one big puff of steam: he lets it go
const RELEASE_SEC = 1.3;
const RELEASE_BIG = 1.5;
const PUFF_MIN = 0.01; // a puff fainter than this isn't drawn
const RISE_FROM = 0.3; // he floats up, and back a little
const RISE_SEC = 1.7;
const RISE_PX = 6;
const BACK_PX = 3;
const BOB_PX = 0.8; // lying, he dips with each kick, as the hum does
const SETTLE_AT = 0.95; // the rug that isn't there takes his weight: a soft give
const SETTLE_SEC = 0.5;
const SETTLE_PX = 1.6;
const SHADOW = { BACK_PX: 2, W: 21, W_LYING: 16, A: 0.42, A_RISEN: 0.14 };
// The glass: knocked loose by the hit, it drifts on, turning and pouring
const GLASS_V = [19, -10]; // px/s, his frame
const GLASS_ARC = 3; // px/s²: its arc flattens
const GLASS_SPIN = 1.5; // rad/s, tipping forward
const GLASS_SPIN_GROW = 0.3; // /s
const GLASS_MOUTH_PX = 3.4;
const GLASS_SPRITE_DY = 0.4; // the glass sprite's centre, below its box's
const DROP_SEC = 0.05; // the milk's trail, sampled this often
const RIBBON_SEC = 0.35; // a stream this long, then it beads up into drops
const DROP_LIFE = 2.5; // seconds, times linger: they outlast the scene
const POUR_SEC = 1.7; // it stops pouring
const DROP_FADE_SEC = 0.4;
const DROP_DRIFT = 0.12; // a drop keeps this share of the glass's speed
const DROP_SPREAD_PX = 1.6;
const DROP_BEAD = { FROM: 0.6, SEC: 0.3 }; // of RIBBON_SEC: a drop beads up
const MILK_ALPHA = 0.95;
const MILK_W = [1.0, 1.8]; // the stream: thin along all of it, thicker near the glass
// The blaster: the hit knocks it out of his hand, spinning off behind him
const GRIP = [11.2, 0.4]; // its grip, in the gun arm's frame
const GUN_PX_S = 110;
const GUN_UP_PX_S = 20;
const GUN_SPIN = 7;
const GUN_FADE_SEC = 0.6;

const ease = (a, from, sec) => smooth(clamp01((a - from) / sec));
const outCubic = (k) => 1 - (1 - k) ** 3;

// ---- his parts for lying back ------------------------------------------------------
// His hand let go: a palm, four fingers spread and a thumb: [x, y, rx, ry, rad]
const HAND = [
  [10.6, 0, 2.2, 2.4, 0], // the palm
  ...[-0.42, -0.14, 0.14, 0.42].map((a) => [
    10.6 + 2.7 * Math.cos(a),
    2.7 * Math.sin(a),
    1.4,
    0.6,
    a,
  ]),
  [10.0, -2.4, 0.6, 1.3, -0.5], // the thumb
];
// On one ink copy of the lot
const openHand = (skin) => {
  for (const [c, grow] of [
    [C.ink, O / 2],
    [skin, 0],
  ]) {
    fillC(c);
    for (const [x, y, rx, ry, a] of HAND) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx + grow, ry + grow, a, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
};
// An arm flung out: his sleeve, cuff and forearm, but in no gravity the loose
// sleeve slides back toward the shoulder and bares more forearm
const armOut = (skin) => {
  bx(-2.8, -3.0, 7.2, 6.0, 3.0, C.robe);
  fillC(C.trim);
  rr(3.0, -3.0, 2.2, 6.0, 0.6);
  ctx.fill();
  BAND.forEach((c, i) => {
    fillC(c);
    ctx.fillRect(3.3 + i * 0.6, -3.0, 0.45, 6.0);
  });
  bx(5.0, -2.0, 6.0, 4.0, 1.6, skin);
  openHand(skin);
};
// [box, draw] in the prototype's px, as his renderer's parts
const DEATH_PARTS = heroSprites({
  offArm: [[-4.2, -4.6, 16, 4.6], () => armOut(C.skinFar)],
  nearArm: [[-4.2, -4.6, 16, 4.6], () => armOut(C.skin)],
  blaster: [
    [-4.6, -5, 13.8, 6],
    () => {
      ctx.translate(-GRIP[0], -GRIP[1]);
      blaster();
    },
  ],
  legNear: [[-4.4, -2.6, 7.2, 18], () => leg(C.skin)],
  legFar: [[-4.4, -2.6, 7.2, 18], () => leg(C.skinFar)],
  torso: [
    [-10.8, -11, 10.4, 13],
    () => {
      robe(0, 0);
      sash(0);
    },
  ],
  hairBack: [[-11, -25, 2, -6], hairBack],
  glass: [[-3.6, -4.2, 3.6, 3.4], glass],
});
const deathParts = (p, k) => spriteParts(p, DEATH_PARTS, k);

/** His death's sprites at his drawn size, built before the first run (setup) */
export function prepareDudeDeath(p, player) {
  deathParts(p, player.drawnSize() / PROTO_SIZE);
}

/**
 * Him, in his body's frame (facing right; the caller mirrors and scales),
 * from joint angles. F: {
 *   x, y: his offset, px; lie: his body's turn about the hip (rad, - = back)
 *   arms: [near, far] (rad; near from his gun shoulder, far the empty hand
 *     from the far shoulder); legs: [near, far] (rad, + forward)
 *   head: his head's tilt about his neck; hair: the hair down his back,
 *     swung out (rad); hurt: the hit, 0..1 (his head ducks it)
 *   red, vein, anger: 0..1; grit: teeth; kick: 0..1
 *   askew: his shades knocked crooked, 0..1; flash: his hit's brightening
 *   steam: puffs (steamPuffs); up: the screen's up in his head's frame (rad)
 * }
 */
function figure(F, SP) {
  const fl = F.flash;
  ctx.save();
  ctx.translate(F.x, F.y + HIP_Y);
  ctx.rotate(F.lie);
  ctx.translate(0, -HIP_Y);
  // The far arm, behind him
  ctx.save();
  ctx.translate(OFF_SHOULDER[0], OFF_SHOULDER[1]);
  ctx.rotate(F.arms[1]);
  stampSprite(SP.offArm, fl);
  ctx.restore();
  // The near arm, flung up off his chest, goes behind the robe too: the same
  // colour, its sleeve only drew a loop over him
  ctx.save();
  ctx.translate(SHOULDER[0], SHOULDER[1]);
  ctx.rotate(F.arms[0]);
  stampSprite(SP.nearArm, fl);
  ctx.restore();
  // Legs, far then near
  for (const [[hx, hy], a, sp] of [
    [HIPS[0], F.legs[1], SP.legFar],
    [HIPS[1], F.legs[0], SP.legNear],
  ]) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(-a);
    stampSprite(sp, fl);
    ctx.restore();
  }
  stampSprite(SP.torso, fl);
  ctx.save();
  headFrame(0, F.hurt, F.head);
  ctx.translate(HAIR_PIVOT[0], HAIR_PIVOT[1]);
  ctx.rotate(F.hair);
  ctx.translate(-HAIR_PIVOT[0], -HAIR_PIVOT[1]);
  stampSprite(SP.hairBack, fl);
  ctx.restore();
  neck();
  ctx.save();
  headFrame(0, F.hurt, F.head);
  stamp('head', fl);
  if (F.red > 0.02) {
    ctx.save();
    ctx.globalAlpha *= F.red;
    stamp('headAngry', fl);
    ctx.restore();
  }
  mouth(F);
  // Shades, knocked crooked and sliding back: they stay on, and no glint
  shadesOn({ downbeatKick: 0 }, F);
  if (F.vein > 0.02) vein(F.kick, F.anger, 1.6, -24.2, F.vein);
  steamPuffs(-4.6, -17.2, F.steam, F.up);
  ctx.restore();
  ctx.restore();
}

// Where the glass sits in his hand as he stands (its sprite's centre, body
// frame), as his renderer's body() puts it
const GLASS_AT = (() => {
  const [sx, sy] = OFF_SHOULDER;
  const a = DRINK_ARM_RAD;
  return [
    sx + 9.6 * Math.cos(a) + 0.6 * Math.sin(a),
    sy + 9.6 * Math.sin(a) - 0.6 * Math.cos(a) - 2.4 - GLASS_SPRITE_DY,
  ];
})();
// Where the glass is a seconds after the hit, and its mouth
function glassAt(a) {
  const x = GLASS_AT[0] + GLASS_V[0] * a;
  const y = GLASS_AT[1] + GLASS_V[1] * a + GLASS_ARC * a * a;
  const spin = GLASS_SPIN * a * (1 + GLASS_SPIN_GROW * a);
  return {
    x,
    y,
    spin,
    mx: x + GLASS_MOUTH_PX * Math.sin(spin),
    my: y - GLASS_MOUTH_PX * Math.cos(spin),
  };
}
function drawSprite(sp, x, y, spin, alpha = 1, dy = 0) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.translate(0, dy);
  stampSprite(sp, 0);
  ctx.restore();
}
// The milk: a stream from the glass that beads up into drops (milk balls up
// with no gravity), the drops outlasting the scene
function milk(a, linger) {
  const life = DROP_LIFE * linger;
  const ribbon = [];
  for (let i = Math.floor(Math.min(a, POUR_SEC) / DROP_SEC); i >= 1; i--) {
    const t = i * DROP_SEC;
    const age = a - t;
    if (age > life) break;
    const g = glassAt(t);
    const h = hash01(i * 3.7);
    const spread = DROP_SPREAD_PX * Math.min(1, age);
    const x = g.mx + GLASS_V[0] * DROP_DRIFT * age + (h - 0.5) * spread;
    const y =
      g.my + GLASS_V[1] * DROP_DRIFT * age + (hash01(i * 5.1) - 0.5) * spread;
    if (age < RIBBON_SEC) ribbon.push({ x, y });
    if (age > RIBBON_SEC * DROP_BEAD.FROM && i % 2 === 0) {
      const left = 1 - t / POUR_SEC;
      const ball = Math.min(
        1,
        (age - RIBBON_SEC * DROP_BEAD.FROM) / DROP_BEAD.SEC
      );
      const r =
        (0.5 + 0.5 * h) *
        (0.7 + 0.3 * left) *
        (0.7 + 0.5 * ball) *
        Math.min(1, (life - age) / DROP_FADE_SEC);
      fillC(C.drink, 1);
      ell(x, y, 2 * r, 2 * r);
      ctx.fill();
    }
  }
  if (ribbon.length < 2) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const n = ribbon.length;
  for (const [to, w] of [
    [n, MILK_W[0]],
    [Math.ceil(n / 2), MILK_W[1]],
  ]) {
    if (to < 2) continue;
    ctx.beginPath();
    ctx.moveTo(ribbon[0].x, ribbon[0].y);
    for (let i = 1; i < to; i++) ctx.lineTo(ribbon[i].x, ribbon[i].y);
    strokeC(C.drink, w, MILK_ALPHA);
    ctx.stroke();
  }
}

/**
 * The Dude's death, `a` seconds after the hit, at (x, y), from his look
 * (Player#pose, its kick fields on the live beat). Draws on p's canvas.
 */
export function drawDudeDeath(p, x, y, look, a, size) {
  const k = size / PROTO_SIZE;
  const side = look.side;
  begin(p, k);
  const SP = deathParts(p, k);
  const { hurt, askew, grit } = heroHurt(a);
  const lieK =
    KNOCK_K * outCubic(clamp01(a / KNOCK_SEC)) +
    (1 - KNOCK_K) * ease(a, LIE_FROM, LIE_SEC);
  const armK = ease(a, ARMS_FROM, ARMS_SEC);
  const anger = 1 - ease(a, 0, CALM_SEC);
  const kick = look.kick ?? 0;
  const sway = Math.sin(a * SWAY_RATE) * SWAY_RAD * armK;
  const rise = RISE_PX * ease(a, RISE_FROM, RISE_SEC);

  ctx.save();
  ctx.translate(x, y);
  ctx.translate(-side * FLINCH_PX * hurt * k, 0); // the hit's flinch
  // His shadow stretches as he lies down, and fades as he floats up
  shadowAt(
    -side * SHADOW.BACK_PX * lieK * k,
    FEET_Y * k,
    (SHADOW.W + SHADOW.W_LYING * lieK) * k,
    SHADOW.A - (SHADOW.A_RISEN * rise) / RISE_PX
  );
  // Past boiling he glows, throbbing on the kick: gone by GLOW_SEC
  const glow = 1 - ease(a, 0, GLOW_SEC);
  if (glow > 0) {
    drawGlow(
      p,
      0,
      GLOW_Y * k,
      PROTO_SIZE * GLOW_SIZE * k,
      GLOW_COLOR,
      glow * (GLOW_ALPHA[0] + GLOW_ALPHA[1] * kick)
    );
  }
  ctx.scale(k * side, k);

  const lie = LIE_RAD * lieK;
  const head = HEAD_RAD * lieK;
  // Steam: his puffs on the last two kicks while he still boils, and one big
  // one as he lets it all go
  const boil = clamp01((anger - BOIL_FROM) / (1 - BOIL_FROM));
  const steam = [
    { u: look.kickAge / STEAM_SEC, a: boil },
    { u: look.prevKickAge / STEAM_SEC, a: boil },
    { u: (a - RELEASE_AT) / RELEASE_SEC, a: 1, big: RELEASE_BIG },
  ].filter((q) => q.a > PUFF_MIN);
  // The blaster, knocked out of his hand behind him, spinning, fading
  if (a < GUN_FADE_SEC) {
    const aim = look.aimRel;
    const gx = SHOULDER[0] + GRIP[0] * Math.cos(aim) - GRIP[1] * Math.sin(aim);
    const gy = SHOULDER[1] + GRIP[0] * Math.sin(aim) + GRIP[1] * Math.cos(aim);
    drawSprite(
      SP.blaster,
      gx - GUN_PX_S * a,
      gy - GUN_UP_PX_S * a,
      aim - GUN_SPIN * a,
      1 - a / GUN_FADE_SEC
    );
  }
  figure(
    {
      x: heroTremble(anger, look.t) - BACK_PX * ease(a, RISE_FROM, RISE_SEC),
      y:
        -rise +
        BOB_PX * kick * lieK +
        SETTLE_PX * Math.sin(Math.PI * clamp01((a - SETTLE_AT) / SETTLE_SEC)),
      lie,
      arms: [
        look.aimRel + (ARMS_RAD[0] - look.aimRel) * armK + sway,
        DRINK_ARM_RAD + (ARMS_RAD[1] - DRINK_ARM_RAD) * armK - sway,
      ],
      legs: [LEGS_RAD[0] * lieK, LEGS_RAD[1] * lieK],
      head,
      hair: HAIR_RAD * lieK,
      hurt,
      red: heroRed(anger),
      vein: clamp01((anger - VEIN_FROM) / VEIN_SPAN),
      anger,
      grit,
      kick,
      askew,
      flash: heroFlash(hurt),
      steam,
      up: -(lie + head),
    },
    SP
  );
  milk(a, CONFIG.DEATHS.LINGER);
  const g = glassAt(a);
  drawSprite(SP.glass, g.x, g.y, g.spin, 1, GLASS_SPRITE_DY);
  ctx.restore();
}

// ---- his scene ----------------------------------------------------------------------
const EASE_BEATS = 2; // the camera eases in over the scene's first beats

/**
 * His death scene (GameState.startDeathScene), as the game draws it: him
 * lying back where he died, his look's kick fields on the live beat, so he
 * dips with each kick.
 */
export function drawDudeScene(p, player, scene, clock) {
  drawDudeDeath(
    p,
    player.x,
    player.y,
    player.poseAt(clock.getBeatPosition()),
    clock.nowSec() - scene.at,
    player.drawnSize()
  );
}

/**
 * The camera eases in on him: over the scene's first EASE_BEATS it zooms to
 * CONFIG.DEATHS.SCENE_ZOOM round him and brings him to the screen's centre,
 * then holds. Call inside the camera's transform. At zoom 1 it does nothing.
 */
export function easeCameraIn(p, camera, player, scene, clock) {
  const zoom = CONFIG.DEATHS.SCENE_ZOOM;
  if (!(zoom > 1)) return;
  const beatSec = clock.beatInterval / 1000;
  const z = smooth(
    clamp01((clock.nowSec() - scene.at) / (EASE_BEATS * beatSec))
  );
  const at = camera.worldToScreen(player.x, player.y);
  p.translate((p.width / 2 - at.x) * z, (p.height / 2 - at.y) * z);
  p.translate(player.x, player.y);
  p.scale(1 + (zoom - 1) * z);
  p.translate(-player.x, -player.y);
}
