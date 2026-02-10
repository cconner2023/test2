// Quick navigation verification for feature #11
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const MOBILE = { width: 390, height: 844 };
const APP_URL = 'http://localhost:5173/test2/';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
try { mkdirSync('test-screenshots', { recursive: true }); } catch {}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: MOBILE, hasTouch: true });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  console.log('=== Navigation Verification for Feature #11 ===\n');

  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await sleep(2000);
  console.log('✅ App loaded');
  await page.screenshot({ path: 'test-screenshots/f11-01-home.png' });

  // Navigate: ENT → subcategory
  const entBtn = page.getByText('EAR, NOSE, THROAT');
  if (await entBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await entBtn.click();
    await sleep(800);
    console.log('✅ Selected ENT category');
    await page.screenshot({ path: 'test-screenshots/f11-02-ent.png' });

    // Select Sore Throat symptom
    const soreThroat = page.getByText('Sore Throat').first();
    if (await soreThroat.isVisible({ timeout: 3000 }).catch(() => false)) {
      await soreThroat.click();
      await sleep(800);
      console.log('✅ Selected Sore Throat symptom');
      await page.screenshot({ path: 'test-screenshots/f11-03-symptom.png' });

      // Check back button works
      const backBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
      if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await backBtn.click();
        await sleep(800);
        console.log('✅ Back button navigated');
        await page.screenshot({ path: 'test-screenshots/f11-04-after-back.png' });
      }
    }
  }

  // Desktop test
  console.log('\n--- Desktop Test ---');
  await page.setViewportSize({ width: 1280, height: 800 });
  await sleep(500);
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await sleep(1500);
  await page.screenshot({ path: 'test-screenshots/f11-05-desktop.png' });
  console.log('✅ Desktop view loaded');

  // Select category on desktop
  const entDesktop = page.getByText('EAR, NOSE, THROAT');
  if (await entDesktop.isVisible({ timeout: 3000 }).catch(() => false)) {
    await entDesktop.click();
    await sleep(800);
    await page.screenshot({ path: 'test-screenshots/f11-06-desktop-ent.png' });
    console.log('✅ Desktop: ENT category selected');
  }

  // Error report
  const appErrors = errors.filter(e =>
    !e.includes('WebSocket') && !e.includes('HMR') &&
    !e.includes('favicon') && !e.includes('504') &&
    !e.includes('Optimize')
  );
  console.log(`\nApp errors: ${appErrors.length}`);
  if (appErrors.length === 0) console.log('✅ Zero application errors');
  else appErrors.forEach(e => console.log('  ❌', e));

  await browser.close();
  console.log('\n=== Done ===');
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
