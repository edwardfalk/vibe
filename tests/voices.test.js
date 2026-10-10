import { test, expect } from '@playwright/test';

// SPEECH_BASE runs these under a subpath, as on GitHub Pages
const PAGE = `${process.env.SPEECH_BASE ?? ''}/voices.html`;

async function open(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(PAGE);
  await expect(page.locator('#speaker option')).toHaveCount(5);
  return errors;
}

async function sayWith(page, speaker, text, button = '#play-now') {
  await page.selectOption('#speaker', speaker);
  await page.fill('#phrase', text);
  await page.click(button);
}

test('the playground renders a typed phrase and shows the readout', async ({
  page,
}) => {
  const errors = await open(page);
  // No word in it is respelled (CONFIG.SPEECH.RESPELL), so the engine hears it as typed
  await sayWith(page, 'tank', 'Siege mode!');
  const readout = page.locator('#readout');
  await expect(readout).toContainText('engine hears: Siege mode!');
  await expect(readout).toContainText(/render [\d.]+ ms \+ chain [\d.]+ ms/);
  await expect(readout).toContainText('ceiling cost');
  expect(errors).toEqual([]);
});

test('a respelling changes only what the engine hears', async ({ page }) => {
  await open(page);
  await page.selectOption('#speaker', 'tank');
  await page.fill('#phrase', 'Death to humans!');
  await expect(page.locator('#hears')).toContainText(
    'sam hears: deth to humans!'
  );
  await expect(page.locator('#hears')).toContainText(
    'bubble shows: DEATH TO HUMANS!'
  );
});

test("text an engine can't speak is named, and the page keeps working", async ({
  page,
}) => {
  await open(page);
  await sayWith(page, 'stabber', 'Ñandú');
  await expect(page.locator('#readout')).toContainText("Couldn't render");
  await sayWith(page, 'stabber', '?!');
  await expect(page.locator('#readout')).toContainText('nothing to say');
  await sayWith(page, 'stabber', 'Stab time!');
  await expect(page.locator('#readout')).toContainText(
    'engine hears: Stab time!'
  );
});

test('a failed engine download says speech is off instead of hanging', async ({
  page,
}) => {
  await page.route('**/espeak-ng.data', (route) => route.abort());
  await open(page);
  await sayWith(page, 'player', 'Dance death!');
  await expect(page.locator('#readout')).toContainText('Speech is off', {
    timeout: 10000,
  });
});

test('stale saved edits are dropped with a notice naming them', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'vibe.voices.v1',
      JSON.stringify({
        speakers: {
          player: {
            base: { engine: 'sam' },
            edit: { engine: 'sam', voice: {}, chain: [] },
          },
        },
        respell: {},
      })
    )
  );
  await open(page);
  await expect(page.locator('#notice')).toContainText('player');
  await expect(page.locator('#notice')).toContainText('older config.js');
  await sayWith(page, 'tank', 'Heavy artillery!');
  await expect(page.locator('#readout')).toContainText('engine hears');
});

test('saved edits that no longer fit the page are dropped', async ({
  page,
}) => {
  await open(page);
  await page.selectOption('#speaker', 'tank');
  await page.click('#stage-add');
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('vibe.voices.v1'));
    stored.speakers.tank.edit.chain = [{ type: 'flange' }];
    localStorage.setItem('vibe.voices.v1', JSON.stringify(stored));
  });
  const errors = await open(page);
  await expect(page.locator('#notice')).toContainText('tank');
  await sayWith(page, 'tank', 'Heavy artillery!');
  await expect(page.locator('#readout')).toContainText('engine hears');
  expect(errors).toEqual([]);
});

test('the page works with storage blocked', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('storage blocked');
      },
    })
  );
  const errors = await open(page);
  await page.click('#stage-add'); // an edit, so save() runs
  await sayWith(page, 'tank', 'Heavy artillery!');
  await expect(page.locator('#readout')).toContainText('engine hears');
  expect(errors).toEqual([]);
});
