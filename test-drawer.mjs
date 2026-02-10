// Track BaseDrawer console.log lifecycle
import { chromium } from 'playwright';

const MOBILE = { width: 390, height: 844 };
const APP_URL = 'http://localhost:5173/test2/';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: MOBILE, hasTouch: true });
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[BaseDrawer]')) {
      logs.push({ t: Date.now(), text });
    }
  });

  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await sleep(2000);

  console.log('Logs after page load:');
  logs.forEach(l => console.log('  ', l.text));
  logs.length = 0;

  // Open menu
  await page.locator('button').first().click();
  await sleep(500);

  console.log('\nLogs after menu open:');
  logs.forEach(l => console.log('  ', l.text));
  logs.length = 0;

  // Click Settings
  await page.getByText('Settings').click();
  await sleep(3000);

  console.log('\nLogs after Settings click (3s):');
  logs.forEach(l => console.log('  ', l.text));

  await browser.close();
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
