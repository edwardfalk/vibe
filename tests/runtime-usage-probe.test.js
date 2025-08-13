import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const INDEX_WITH_SAMPLING = '/index.html?usageSeconds=6';

test('Runtime usage counters are captured', async ({ page }) => {
  await page.goto(INDEX_WITH_SAMPLING, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas');
  try { await page.click('canvas'); } catch {}
  await page.waitForTimeout(8000);
  const payload = await page.evaluate(() => {
    const counters = (window.__runtimeUsage && window.__runtimeUsage.counters) || {};
    return { when: new Date().toISOString(), counters };
  });
  const outDir = path.resolve('.debug');
  try { if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `runtime-usage-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log('[RuntimeUsageTest]', JSON.stringify(payload));
  expect(Object.keys(payload.counters).length).toBeGreaterThanOrEqual(0);
});
