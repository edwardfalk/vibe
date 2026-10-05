import { test, expect } from '@playwright/test';
import { bootGame } from './helpers/boot.js';

// The gas buffer's luminance spread in the fixed resting level-8 frame must
// stay above this: a black or NaN shader leaves a flat buffer
const SKY_GAS_STD_FLOOR = 0.025; // real 0.0498, black shader 0

test.describe('Gameplay Probes', () => {
  test('The sky draws in every state and its shader links', async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/');
    await page.waitForFunction(() => window.backgroundRenderer?.sky);
    // Count the sky's draws per game state
    await page.evaluate(() => {
      const r = window.backgroundRenderer;
      const draw = r.drawSky.bind(r);
      window.__skyDraws = {};
      r.drawSky = (p) => {
        const state = window.gameState.gameState;
        window.__skyDraws[state] = (window.__skyDraws[state] ?? 0) + 1;
        draw(p);
      };
    });
    const drawsIn = async (state) => {
      const count = () =>
        page.evaluate((s) => window.__skyDraws[s] ?? 0, state);
      const before = await count();
      await page.waitForTimeout(300);
      return (await count()) - before;
    };
    const sky = await page.evaluate(() => ({
      mode: window.backgroundRenderer.sky.mode,
      linked: window.backgroundRenderer.sky.shaderLinked,
    }));
    expect(['full', 'flat']).toContain(sky.mode);
    expect(sky.linked).toBe(true);
    expect(await drawsIn('title')).toBeGreaterThan(0);
    await page.keyboard.press(' ');
    await page.waitForFunction(() => window.gameState?.gameState === 'playing');
    expect(await drawsIn('playing')).toBeGreaterThan(0);
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.gameState?.gameState === 'paused');
    expect(await drawsIn('paused')).toBeGreaterThan(0);
    await page.evaluate(() => window.gameState.setGameState('gameOver'));
    expect(await drawsIn('gameOver')).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('The sky paints over the whole canvas, full or flat', async ({
    page,
  }) => {
    // The sky is what clears the canvas each frame
    for (const mode of ['full', 'flat']) {
      await page.goto(`/?sky=${mode}`);
      await page.waitForFunction(
        (m) => window.backgroundRenderer?.sky?.mode === m,
        mode
      );
      const uncovered = await page.evaluate(async () => {
        const { REST_FRAME } =
          await import('/js/systems/background/NebulaSky.js');
        const r = window.backgroundRenderer;
        r.p.background(255, 0, 255); // the sky must paint over this
        r.sky.draw(r.p, { ...REST_FRAME, t: 8, flow: 3, level: 8 });
        const c = document.querySelector('canvas');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] > 200 && d[i + 1] < 80 && d[i + 2] > 200) n++;
        }
        return n;
      });
      expect(uncovered, mode).toBe(0);
    }
  });

  test('The resting level-8 sky leaves the gameplay colours to the game', async ({
    page,
  }) => {
    await page.goto('/?sky=full');
    await page.waitForFunction(
      () => window.backgroundRenderer?.sky?.mode === 'full'
    );
    const stats = await page.evaluate(async () => {
      const { REST_FRAME } =
        await import('/js/systems/background/NebulaSky.js');
      const r = window.backgroundRenderer;
      r.sky.draw(r.p, { ...REST_FRAME, t: 8, flow: 3, level: 8 });
      const c = document.querySelector('canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const gas = document.createElement('canvas');
      gas.width = 400;
      gas.height = 300;
      const g2 = gas.getContext('2d');
      g2.drawImage(r.sky.g.elt, 0, 0);
      const gd = g2.getImageData(0, 0, 400, 300).data;
      const lum = (a, i) =>
        (0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]) / 255;
      // The gameplay hues (deg): green, orange, pink, purple, cyan, magenta,
      // and the grunt's coral (helmet and shots)
      const HUES = [120, 40, 340, 260, 180, 325, 11];
      let bright = 0;
      let clash = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (lum(d, i) > 0.2) bright++;
        const r8 = d[i] / 255;
        const g8 = d[i + 1] / 255;
        const b8 = d[i + 2] / 255;
        const mx = Math.max(r8, g8, b8);
        const mn = Math.min(r8, g8, b8);
        if (mx > 0.35 && (mx - mn) / mx > 0.45) {
          let h;
          if (mx === r8) h = 60 * (((g8 - b8) / (mx - mn)) % 6);
          else if (mx === g8) h = 60 * ((b8 - r8) / (mx - mn) + 2);
          else h = 60 * ((r8 - g8) / (mx - mn) + 4);
          h = (h + 360) % 360;
          const near = (q) =>
            Math.min(Math.abs(h - q), 360 - Math.abs(h - q)) < 15;
          if (HUES.some(near)) clash++;
        }
      }
      let sum = 0;
      let sq = 0;
      for (let i = 0; i < gd.length; i += 4) {
        const l = lum(gd, i);
        sum += l;
        sq += l * l;
      }
      const n = d.length / 4;
      const gn = gd.length / 4;
      const mean = sum / gn;
      return {
        brightFrac: bright / n,
        clashFrac: clash / n,
        gasStd: Math.sqrt(sq / gn - mean * mean),
      };
    });
    console.log('resting L8 sky', stats);
    expect(stats.clashFrac).toBeLessThanOrEqual(0.005);
    expect(stats.brightFrac).toBeLessThanOrEqual(0.12);
    expect(stats.gasStd).toBeGreaterThan(SKY_GAS_STD_FLOOR);
  });

  test('Game loop advances with live entities', async ({ page }) => {
    await bootGame(page);

    const before = await page.evaluate(() => ({
      frameCount: window.frameCount ?? 0,
      enemyCount: Array.isArray(window.enemies)
        ? window.enemies.filter((enemy) => !enemy.markedForRemoval).length
        : 0,
      playerAlive: !!window.player && !window.player.markedForRemoval,
    }));

    await page.waitForTimeout(500);

    const after = await page.evaluate(() => ({
      frameCount: window.frameCount ?? 0,
      enemyCount: Array.isArray(window.enemies)
        ? window.enemies.filter((enemy) => !enemy.markedForRemoval).length
        : 0,
      playerAlive: !!window.player && !window.player.markedForRemoval,
    }));

    expect(after.frameCount).toBeGreaterThan(before.frameCount);
    expect(after.enemyCount).toBeGreaterThan(0);
    expect(after.playerAlive).toBe(true);
  });

  test('Screen flashes fade out in the running game', async ({ page }) => {
    await bootGame(page);
    await page.evaluate(() => {
      window.visualEffectsManager.triggerBloom(0.4, 10);
      window.visualEffectsManager.triggerChromaticAberration(0.6, 10);
    });
    await page.waitForFunction(
      () =>
        window.visualEffectsManager.bloomIntensity === 0 &&
        window.visualEffectsManager.chromaticAberration === 0,
      null,
      { timeout: 3000 }
    );
  });

  test('Title screen waits for input, then starts the run', async ({
    page,
  }) => {
    // Window shorter than 4:3 so the canvas is CSS-scaled (not 800x600)
    await page.setViewportSize({ width: 1400, height: 700 });
    await page.goto('/');
    await page.waitForFunction(
      () => window.gameState?.gameState === 'title' && window.frameCount > 0
    );
    await expect(page.locator('#title')).toBeVisible();
    await page.waitForTimeout(700);
    // Modifier and function keys (Alt+Tab, Shift, F11) don't start the run
    await page.keyboard.press('Alt');
    await page.keyboard.press('Shift');
    await page.keyboard.press('F2');
    expect(await page.evaluate(() => window.gameState.gameState)).toBe('title');

    // The starting key only starts the game: M must not also mute
    await page.keyboard.press('m');
    await page.waitForFunction(() => window.gameState.gameState === 'playing');
    await expect(page.locator('#title')).toHaveCount(0);
    expect(await page.evaluate(() => window.audio.enabled)).toBe(true);

    // Mouse aim maps back to canvas pixels on the scaled canvas
    const box = await page.locator('#defaultCanvas0').boundingBox();
    expect(box.width).toBeGreaterThan(900);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 4);
    const mouse = await page.evaluate(() => ({
      x: window.player.p.mouseX,
      y: window.player.p.mouseY,
    }));
    expect(mouse.x).toBeCloseTo(400, -1);
    expect(mouse.y).toBeCloseTo(150, -1);
  });

  test('M mutes sound effects and music, and says so', async ({ page }) => {
    // Record every Web Audio connection, so the hum's route can be checked
    await page.addInitScript(() => {
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (destination, ...rest) {
        (this.__to ??= []).push(destination);
        return connect.call(this, destination, ...rest);
      };
    });
    await bootGame(page);
    await page.waitForFunction(() => window.beatTrack?.masterGain);
    // The hum plays through the effects' masterGain, so M (and the speech
    // duck after it) takes it too
    expect(
      await page.evaluate(() =>
        window.audio.hum.levelGain.__to.includes(window.audio.masterGain)
      )
    ).toBe(true);
    const gains = () =>
      page.evaluate(() => [
        window.audio.masterGain.gain.value,
        window.beatTrack.masterGain.gain.value,
      ]);
    const [sfxOn, musicOn] = await gains();
    expect(sfxOn).toBeGreaterThan(0);
    expect(musicOn).toBeGreaterThan(0);

    await page.keyboard.press('m');
    await expect(page.locator('#statusToast')).toBeVisible();
    await expect(page.locator('#statusToast')).toHaveText('Sound off');
    await expect.poll(gains).toEqual([0, 0]);

    await page.keyboard.press('m');
    await expect(page.locator('#statusToast')).toHaveText('Sound on');
    await expect.poll(gains).toEqual([sfxOn, musicOn]);
  });

  test('Named keys like arrows and Escape start the run', async ({ page }) => {
    for (const key of ['ArrowUp', 'Escape']) {
      await page.goto('/');
      await page.waitForFunction(() => window.gameState?.gameState === 'title');
      await page.keyboard.press(key);
      await page.waitForFunction(
        () => window.gameState.gameState === 'playing'
      );
    }
  });

  test('Clicking to start does not also fire a shot', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.gameState?.gameState === 'title');
    const box = await page.locator('#defaultCanvas0').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // Hold the button across several frames, like a real click
    await page.mouse.down();
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => ({
      state: window.gameState.gameState,
      shots: window.gameState.shotsFired,
    }));
    await page.mouse.up();
    expect(after).toEqual({ state: 'playing', shots: 0 });
  });

  test('Kick plays on every beat in a real AudioContext', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const humErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && /hum/i.test(m.text()))
        humErrors.push(m.text());
    });
    await bootGame(page);
    await page.waitForFunction(() => window.beatTrack?.isPlaying);
    await page.evaluate(() => {
      const track = window.beatTrack;
      const play = track._playKick.bind(track);
      window.kickCount = 0;
      track._playKick = (time) => {
        window.kickCount++;
        play(time);
      };
    });
    // 120 BPM = 2 beats per second, four on the floor = 2 kicks per second
    await page.waitForTimeout(2000);
    const kicks = await page.evaluate(() => window.kickCount);
    expect(kicks).toBeGreaterThanOrEqual(3);
    expect(kicks).toBeLessThanOrEqual(5);
    expect(errors).toEqual([]);
    // The hum: Audio built it, BeatTrack keeps its time, and it has faded in
    // (from the first beat 1, over 0.4 s)
    expect(
      await page.evaluate(
        () => !!window.audio.hum && window.beatTrack.hum === window.audio.hum
      )
    ).toBe(true);
    await expect
      .poll(() => page.evaluate(() => window.audio.hum.fade.gain.value))
      .toBeGreaterThan(0.99);
    expect(humErrors).toEqual([]);
  });

  test('?tune panel loads and clicking it does not start the game', async ({
    page,
  }) => {
    await page.goto('/?tune');
    await page.waitForFunction(() => window.gameState?.gameState === 'title');
    // A real click (pointer events) on a slider, then a dropdown change
    await page.locator('#tunePanel input[type=range]').first().click();
    // The kick pattern is the first dropdown
    await page.locator('#tunePanel select').first().selectOption('oneThree');
    expect(await page.evaluate(() => window.gameState.gameState)).toBe('title');
    await expect(page.locator('#tunePanel pre')).toContainText(
      '"PATTERN": "oneThree"'
    );
  });

  test('?tune voice dropdowns list the voices and a pick is heard', async ({
    page,
  }) => {
    await page.goto('/?tune');
    await page.waitForFunction(() => window.gameState?.gameState === 'title');
    await page.keyboard.press('Enter'); // start a run: audio is running
    await page.waitForFunction(() => window.gameState.gameState === 'playing');
    // Headless Chromium has no voices: hand it two, as Chrome does a moment
    // after load. Chrome only accepts its own voice objects on a real
    // utterance, so use a plain one, and record what would be said.
    await page.evaluate(() => {
      const synth = window.speechSynthesis;
      const voices = [
        { name: 'Test Voice A', lang: 'en-US' },
        { name: 'Test Voice B', lang: 'en-GB' },
      ];
      synth.getVoices = () => voices;
      window.SpeechSynthesisUtterance = class {
        constructor(text) {
          this.text = text;
        }
      };
      window.__said = [];
      synth.speak = (u) => window.__said.push([u.text, u.voice?.name]);
      synth.dispatchEvent(new Event('voiceschanged'));
    });
    const tank = page
      .locator('#tunePanel label', { hasText: 'VOICES.tank' })
      .locator('select');
    await expect(tank.locator('option')).toHaveText([
      'auto',
      'Test Voice A',
      'Test Voice B',
    ]);
    await tank.selectOption('Test Voice B');
    // The sample line went through the game's own speech, in that voice
    expect(await page.evaluate(() => window.__said)).toContainEqual([
      'Targeting traitors!',
      'Test Voice B',
    ]);
    await expect(page.locator('#tunePanel pre')).toContainText(
      '"tank": "Test Voice B"'
    );
  });

  test('?tune panel clicks during play do not shoot or keep focus', async ({
    page,
  }) => {
    await page.goto('/?tune');
    await page.waitForFunction(() => window.gameState?.gameState === 'title');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.gameState.gameState === 'playing');
    const slider = page.locator('#tunePanel input[type=range]').first();
    await slider.click();
    expect(
      await page.evaluate(() => ({
        shooting: window.playerIsShooting,
        shots: window.gameState.shotsFired,
      }))
    ).toEqual({ shooting: false, shots: 0 });
    // Released slider gives the keyboard back to the game
    await expect(slider).not.toBeFocused();
  });

  test('Either Shift fires; releasing one fire input keeps the others firing', async ({
    page,
  }) => {
    await bootGame(page);
    const shots = () => page.evaluate(() => window.gameState.shotsFired);
    const stillFiring = async () => {
      const before = await shots();
      await page.waitForTimeout(600);
      return (await shots()) > before;
    };

    await page.keyboard.down('ShiftRight');
    expect(await stillFiring()).toBe(true);

    // mouse + Shift: let go of the mouse first
    const box = await page.locator('#defaultCanvas0').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 4);
    await page.mouse.down();
    await page.mouse.up();
    expect(await stillFiring()).toBe(true);

    // Space + Shift, released in the other order
    await page.keyboard.down('Space');
    await page.keyboard.up('ShiftRight');
    expect(await stillFiring()).toBe(true);
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.up('Space');
    expect(await stillFiring()).toBe(true);

    await page.keyboard.up('ShiftLeft');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.playerIsShooting)).toBe(false);

    // A right-click never starts firing
    await page.mouse.down({ button: 'right' });
    expect(await page.evaluate(() => window.playerIsShooting)).toBe(false);
    await page.mouse.up({ button: 'right' });
  });

  test('A lost Shift keyup or a window blur never leaves the gun firing', async ({
    page,
  }) => {
    await bootGame(page);
    const after = (evs) =>
      page.evaluate((evs) => {
        for (const [type, init] of evs) {
          if (type === 'blur') window.dispatchEvent(new Event('blur'));
          else window.dispatchEvent(new KeyboardEvent(type, init));
        }
        return window.playerIsShooting;
      }, evs);
    const shiftDown = ['keydown', { code: 'ShiftLeft', shiftKey: true }];
    expect(await after([shiftDown])).toBe(true);
    expect(await after([['blur', {}]])).toBe(false);
    // Shift's keyup is lost; the next key event reports Shift up
    await after([shiftDown]);
    expect(await after([['keydown', { code: 'KeyW', shiftKey: false }]])).toBe(
      false
    );
    await after([['keyup', { code: 'KeyW', shiftKey: false }]]);
  });

  test("Space's first shot is a real bullet", async ({ page }) => {
    await bootGame(page);
    await page.evaluate(() => (window.playerBullets.length = 0));
    await page.keyboard.down('Space');
    // Well inside the 200 ms cooldown a swallowed first shot would start
    await page.waitForTimeout(100);
    const bullets = await page.evaluate(() => window.playerBullets.length);
    await page.keyboard.up('Space');
    expect(bullets).toBeGreaterThanOrEqual(1);
  });

  test('Held keyboard fire lands on eighth notes', async ({ page }) => {
    await bootGame(page);
    const offsets = await page.evaluate(async () => {
      const p = window.player;
      const clock = window.beatClock;
      const fire = p.fireBullet.bind(p);
      const out = [];
      p.fireBullet = (...a) => {
        const eighth = clock.beatInterval / 2;
        const t = clock._now() - clock.startTime;
        out.push(Math.min(t % eighth, eighth - (t % eighth)));
        return fire(...a);
      };
      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'ShiftLeft', shiftKey: true })
      );
      await new Promise((r) => setTimeout(r, 2000));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }));
      p.fireBullet = fire;
      return out;
    });
    // The first shot is immediate; every later one is on an eighth note
    const sustained = offsets.slice(1);
    expect(sustained.length).toBeGreaterThanOrEqual(4);
    const tol = await page.evaluate(() => window.beatClock.eighthNoteTolerance);
    for (const o of sustained) expect(o).toBeLessThanOrEqual(tol + 17); // + one frame
  });

  test("Kick locks to the enemies' beat, including after a restart", async ({
    page,
  }) => {
    await bootGame(page);
    await page.waitForFunction(() => window.beatTrack?.isPlaying);
    const record = () =>
      page.evaluate(async () => {
        const track = window.beatTrack;
        const clock = window.beatClock;
        const audio = window.audio;
        // Bring a grunt within firing range (grunts fire only within 300 px)
        const grunt = window.enemies.find((e) => e.type === 'grunt');
        if (grunt) {
          grunt.x = window.player.x + 200;
          grunt.y = window.player.y;
        }
        const schedule = track._scheduleNote.bind(track);
        const playSound = audio.playSound.bind(audio);
        const kicks = [];
        const shotOffsets = [];
        track._scheduleNote = (time, eighth) => {
          if (eighth % 2 === 0) {
            const rel = time * 1000 - clock.startTime;
            const beat = Math.round(rel / clock.beatInterval);
            kicks.push({
              off: Math.abs(rel - beat * clock.beatInterval),
              beatInMeasure: ((beat % 4) + 4) % 4,
              eighth,
            });
          }
          schedule(time, eighth);
        };
        audio.playSound = (name, ...rest) => {
          if (name === 'alienShoot') {
            const t = clock._now() - clock.startTime;
            shotOffsets.push(
              t - Math.floor(t / clock.beatInterval) * clock.beatInterval
            );
          }
          return playSound(name, ...rest);
        };
        await new Promise((r) => setTimeout(r, 3000));
        track._scheduleNote = schedule;
        audio.playSound = playSound;
        return { kicks, shotOffsets, tolerance: clock.tolerance };
      });
    const check = ({ kicks, shotOffsets, tolerance }) => {
      expect(kicks.length).toBeGreaterThanOrEqual(3);
      for (const k of kicks) {
        expect(k.off).toBeLessThan(2); // on BeatClock's beat
        expect(k.eighth / 2).toBe(k.beatInMeasure); // accent on the clock's beat 1
      }
      // Grunt shots come after their beat lands; a pre-beat shot would read
      // as ~400-500 ms (the end of the previous beat)
      expect(shotOffsets.length).toBeGreaterThan(0);
      for (const o of shotOffsets)
        expect(o).toBeLessThanOrEqual(tolerance + 20);
    };
    check(await record());
    await page.evaluate(() => window.gameState.setGameState('gameOver'));
    await page.keyboard.press('r');
    await page.waitForFunction(() => window.gameState.gameState === 'playing');
    check(await record());
  });

  test('Pausing stops the sound and the beat; unpausing picks them up again', async ({
    page,
  }) => {
    await bootGame(page);
    await page.waitForFunction(() => window.beatTrack?.isPlaying);
    const beats = () =>
      page.evaluate(
        () => window.beatClock.getTotalBeats() + window.beatClock.getBeatPhase()
      );
    await page.keyboard.press('p');
    await page.waitForFunction(
      () => window.audio.audioContext.state === 'suspended'
    );
    const held = await beats();
    await page.waitForTimeout(300);
    expect(await beats()).toBe(held);
    await page.keyboard.press('p');
    await page.waitForFunction(
      () => window.audio.audioContext.state === 'running'
    );
    await page.waitForTimeout(100);
    expect(await beats()).toBeGreaterThan(held);
  });

  test('With ?tune the sound plays on while paused, and its box turns that off and on', async ({
    page,
  }) => {
    await bootGame(page, '/?tune');
    const state = () => page.evaluate(() => window.audio.audioContext.state);
    const box = page.getByLabel('Sound while paused');
    await page.keyboard.press('p');
    await page.waitForTimeout(200);
    expect(await state()).toBe('running');
    await box.uncheck();
    await page.waitForFunction(
      () => window.audio.audioContext.state === 'suspended'
    );
    await box.check();
    await page.waitForFunction(
      () => window.audio.audioContext.state === 'running'
    );
    // The box handed the keyboard back: P still unpauses
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.gameState.gameState === 'playing');
    // Never saved: the panel's JSON for config.js leaves it out
    expect(await page.locator('#tunePanel pre').textContent()).not.toContain(
      'SOUND_WHILE_PAUSED'
    );
  });

  test('Game dips while speech plays and always recovers', async ({ page }) => {
    await bootGame(page);
    await page.waitForFunction(() => window.audio?.duckGain);
    // Stand in for the voicebox's clock: speaking or not, and nothing else
    await page.evaluate(() => {
      window.__speaking = false;
      window.audio.voicebox.isSpeaking = () => window.__speaking;
    });
    const speak = (on) => page.evaluate((v) => (window.__speaking = v), on);
    const ducked = () =>
      page.waitForFunction(
        () =>
          window.audio._ducked &&
          window.audio.duckGain.gain.value < 0.6 &&
          window.audio.beatDuckGain.gain.value < 0.8
      );
    // Well under the 5 s cap, so a release that only comes from the cap fails
    const released = () =>
      page.waitForFunction(
        () =>
          !window.audio._ducked &&
          window.audio.duckGain.gain.value > 0.95 &&
          window.audio.beatDuckGain.gain.value > 0.95,
        null,
        { timeout: 2000 }
      );

    await speak(true);
    await ducked();
    await speak(false);
    await released();

    await speak(true); // muting mid-speech releases the duck
    await ducked();
    await page.keyboard.press('m');
    await released();
    await page.keyboard.press('m');
  });

  test('R after game over restarts straight into play', async ({ page }) => {
    await bootGame(page);
    await page.evaluate(() => window.gameState.setGameState('gameOver'));
    await page.keyboard.press('r');
    await page.waitForFunction(() => window.gameState.gameState === 'playing');
    await expect(page.locator('#title')).toHaveCount(0);
  });

  test('Player input affects position', async ({ page }) => {
    await bootGame(page);

    const before = await page.evaluate(() =>
      window.player && typeof window.frameCount === 'number'
        ? { x: window.player.x, y: window.player.y, frame: window.frameCount }
        : null
    );
    expect(before).not.toBeNull();

    await page.keyboard.down('w');
    // Wait for player movement; y decreases when moving up (canvas coords)
    await page.waitForFunction(
      ([startY, startFrame]) => {
        if (!window.player) return false;
        const moved = window.player.y < startY - 5;
        if (moved) return true;
        const framesAdvanced =
          typeof window.frameCount === 'number' &&
          window.frameCount >= startFrame + 60;
        if (framesAdvanced) {
          throw new Error(
            `Player did not move after 60 frames (startY=${startY}, currentY=${window.player.y})`
          );
        }
        return false;
      },
      [before.y, before.frame],
      { timeout: 3000 }
    );
    await page.keyboard.up('w');

    const after = await page.evaluate(() =>
      window.player ? { x: window.player.x, y: window.player.y } : null
    );
    expect(after).not.toBeNull();
    expect(after.y).toBeLessThan(before.y);
  });

  test('Enemy lifecycle cleanup removes marked enemies', async ({ page }) => {
    await bootGame(page);

    const { marked, targetId, countBefore } = await page.evaluate(() => {
      const enemies = Array.isArray(window.enemies) ? window.enemies : [];
      const countBefore = enemies.filter((e) => !e.markedForRemoval).length;
      const enemy = enemies.find((c) => !c.markedForRemoval);
      if (enemy) {
        enemy.markedForRemoval = true;
        return { marked: true, targetId: enemy.id, countBefore };
      }
      return { marked: false, targetId: null, countBefore };
    });

    expect(marked).toBe(true);
    expect(countBefore).toBeGreaterThan(0);

    await page.waitForFunction(
      (id) => {
        if (!Array.isArray(window.enemies)) return false;
        return !window.enemies.some((e) => e.id === id);
      },
      targetId,
      { timeout: 3000 }
    );
  });

  test('Rusher explosion damage can drive game over state', async ({
    page,
  }) => {
    await bootGame(page);

    const ok = await page.evaluate(() => {
      if (!window.player || !window.collisionSystem || !window.gameState) {
        return false;
      }
      window.player.health = 1;
      window.player.shieldUp = false; // this test is about unshielded damage
      window.collisionSystem.handleRusherExplosion(
        {
          x: window.player.x,
          y: window.player.y,
          radius: 999,
          damage: 50,
        },
        null // rusherEnemy sentinel: no owner enemy reference
      );
      return true;
    });
    expect(ok).toBe(true);

    await page.waitForFunction(
      () =>
        window.gameState?.gameState === 'gameOver' &&
        window.player?.health <= 0,
      { timeout: 2000 }
    );
  });

  test('All enemy types can be spawned, damaged, and killed', async ({
    page,
  }) => {
    await bootGame(page);

    const results = await page.evaluate(() => {
      const p = window.player.p;
      const spawnSystem = window.spawnSystem;
      const out = {};

      for (const type of ['grunt', 'rusher', 'tank', 'stabber']) {
        try {
          const enemy = spawnSystem.createEnemy(
            window.player.x + 150,
            window.player.y + 150,
            type,
            p
          );
          if (!enemy) {
            out[type] = { error: 'null enemy' };
            continue;
          }
          window.enemies.push(enemy);

          enemy.health = 1;
          // No bullet angle, so the tank's armour plates can't absorb it
          out[type] = { ok: true, dmgResult: enemy.takeDamage(10) };
        } catch (e) {
          out[type] = { error: e.message };
        }
      }
      return out;
    });

    // A rusher never dies outright: any hit lights its fuse
    expect(results).toEqual({
      grunt: { ok: true, dmgResult: 'died' },
      rusher: { ok: true, dmgResult: 'exploding' },
      tank: { ok: true, dmgResult: 'died' },
      stabber: { ok: true, dmgResult: 'died' },
    });

    // Verify draw loop still running after enemy deaths
    const fc1 = await page.evaluate(() => window.frameCount);
    await page.waitForTimeout(500);
    const fc2 = await page.evaluate(() => window.frameCount);
    expect(fc2).toBeGreaterThan(fc1);
  });

  test('Bullet collision kills enemy and awards score', async ({ page }) => {
    await bootGame(page);

    const result = await page.evaluate(() => {
      const p = window.player.p;
      const spawnSystem = window.spawnSystem;
      const gs = window.gameState;

      const scoreBefore = gs.score;
      const killsBefore = gs.totalKills;

      const grunt = spawnSystem.createEnemy(
        window.player.x + 30,
        window.player.y,
        'grunt',
        p
      );
      grunt.health = 1;
      window.enemies.push(grunt);

      window.collisionSystem.resolveBulletEnemyHit(
        {
          x: grunt.x,
          y: grunt.y,
          damage: 10,
          angle: 0,
          owner: 'player',
          checkCollision: () => true,
        },
        0,
        grunt
      );

      return {
        scoreIncreased: gs.score > scoreBefore,
        killsIncreased: gs.totalKills > killsBefore,
        markedForRemoval: grunt.markedForRemoval,
      };
    });

    expect(result.scoreIncreased).toBe(true);
    expect(result.killsIncreased).toBe(true);
    expect(result.markedForRemoval).toBe(true);
  });

  test('Stabber attack handler runs without error', async ({ page }) => {
    await bootGame(page);

    const result = await page.evaluate(() => {
      const p = window.player.p;
      const spawnSystem = window.spawnSystem;

      const stabber = spawnSystem.createEnemy(
        window.player.x + 250,
        window.player.y,
        'stabber',
        p
      );
      window.enemies.push(stabber);

      // Run several update cycles
      for (let i = 0; i < 30; i++) {
        stabber.update(window.player.x, window.player.y, 16.67);
      }

      return {
        ok: true,
        x: stabber.x,
        y: stabber.y,
        health: stabber.health,
      };
    });

    expect(result.ok).toBe(true);
    expect(result.health).toBeGreaterThan(0);
  });
});
