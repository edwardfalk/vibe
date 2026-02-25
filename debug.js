import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (error) => {
    console.error(`Page Error:`, error.message);
    console.error(`Stack:`, error.stack);
  });
  page.on('console', (msg) => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });
  await page.goto('http://localhost:5500');
  await page.waitForTimeout(1500);
  await browser.close();
})();
