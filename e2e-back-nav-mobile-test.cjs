/**
 * End-to-end back navigation verification - MOBILE viewport
 * Verifies title/header updates and mobile-specific behavior
 */
const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:5173/test2/';
const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 14 size

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const consoleErrors = [];

async function runMobileTests() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport(MOBILE_VIEWPORT);

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(`[PageError] ${err.message}`);
    });

    const results = {};

    // ============================
    // MOBILE TEST 1: Title updates and back button visibility
    // ============================
    console.log('\n=== MOBILE: Title & Back Button Visibility ===');
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await wait(1500);

    // Main view - check title shows app name, no back button
    const mainState = await page.evaluate(() => {
      const backBtn = document.querySelector('button[aria-label="Go back"]');
      const backVisible = backBtn !== null && backBtn.offsetParent !== null;
      // Check for title text
      const allSpans = document.querySelectorAll('span');
      let titleText = '';
      for (const span of allSpans) {
        if (span.textContent?.includes('ADTMC')) {
          titleText = span.textContent.trim();
          break;
        }
      }
      // Check for menu button
      const menuBtn = document.querySelector('button[aria-label="Open menu"]');
      const menuVisible = menuBtn !== null && menuBtn.offsetParent !== null;
      return { backVisible, titleText, menuVisible };
    });
    console.log(`  Main: back=${mainState.backVisible}, title="${mainState.titleText}", menu=${mainState.menuVisible}`);
    results.mainView = {
      backHidden: !mainState.backVisible,
      titleCorrect: mainState.titleText.includes('ADTMC'),
      menuShown: mainState.menuVisible,
    };

    // Navigate to category
    await page.evaluate(() => {
      const allDivs = document.querySelectorAll('[class*="cursor-pointer"]');
      for (const div of allDivs) {
        if (div.textContent?.includes('EAR, NOSE, THROAT')) {
          div.click();
          return;
        }
      }
    });
    await wait(1000);

    const categoryState = await page.evaluate(() => {
      const backBtn = document.querySelector('button[aria-label="Go back"]');
      const backVisible = backBtn !== null && backBtn.offsetParent !== null;
      const allSpans = document.querySelectorAll('span');
      let titleText = '';
      for (const span of allSpans) {
        if (span.textContent?.includes('EAR, NOSE, THROAT')) {
          titleText = span.textContent.trim();
          break;
        }
      }
      const menuBtn = document.querySelector('button[aria-label="Open menu"]');
      const menuVisible = menuBtn !== null && menuBtn.offsetParent !== null;
      return { backVisible, titleText, menuVisible };
    });
    console.log(`  Category: back=${categoryState.backVisible}, title="${categoryState.titleText}", menu=${categoryState.menuVisible}`);
    results.categoryView = {
      backShown: categoryState.backVisible,
      titleCorrect: categoryState.titleText.includes('EAR, NOSE, THROAT'),
      menuHidden: !categoryState.menuVisible,
    };

    // Navigate to symptom
    await page.evaluate(() => {
      const allDivs = document.querySelectorAll('[class*="cursor-pointer"]');
      for (const div of allDivs) {
        if (div.textContent?.includes('Sore Throat')) {
          div.click();
          return;
        }
      }
    });
    await wait(1200);

    const symptomState = await page.evaluate(() => {
      const backBtn = document.querySelector('button[aria-label="Go back"]');
      const backVisible = backBtn !== null && backBtn.offsetParent !== null;
      const allSpans = document.querySelectorAll('span');
      let titleText = '';
      for (const span of allSpans) {
        const text = span.textContent?.trim();
        if (text && text.includes('Sore Throat') && text.length < 50) {
          titleText = text;
          break;
        }
      }
      return { backVisible, titleText };
    });
    console.log(`  Symptom: back=${symptomState.backVisible}, title="${symptomState.titleText}"`);
    results.symptomView = {
      backShown: symptomState.backVisible,
      titleCorrect: symptomState.titleText.includes('Sore Throat'),
    };

    // ============================
    // MOBILE TEST 2: Full chain back navigation
    // ============================
    console.log('\n=== MOBILE: Full Chain Back Navigation ===');

    // Back from symptom -> category
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Go back"]');
      if (btn) btn.click();
    });
    await wait(1000);

    const afterBack1 = await page.evaluate(() => {
      const allText = document.body.innerText;
      const allSpans = document.querySelectorAll('span');
      let titleText = '';
      for (const span of allSpans) {
        if (span.textContent?.includes('EAR, NOSE, THROAT') && span.className.includes('text-primary')) {
          titleText = span.textContent.trim();
          break;
        }
      }
      return {
        hasSoreThroat: allText.includes('Sore Throat'),
        hasEarPain: allText.includes('Ear Pain'),
        titleText,
      };
    });
    console.log(`  After back 1 (symptom->cat): subcats=${afterBack1.hasSoreThroat}, title="${afterBack1.titleText}"`);

    // Back from category -> main
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Go back"]');
      if (btn) btn.click();
    });
    await wait(1000);

    const afterBack2 = await page.evaluate(() => {
      const allText = document.body.innerText;
      const backBtn = document.querySelector('button[aria-label="Go back"]');
      const backVisible = backBtn !== null && backBtn.offsetParent !== null;
      const menuBtn = document.querySelector('button[aria-label="Open menu"]');
      const menuVisible = menuBtn !== null && menuBtn.offsetParent !== null;
      let titleText = '';
      const allSpans = document.querySelectorAll('span');
      for (const span of allSpans) {
        if (span.textContent?.includes('ADTMC')) {
          titleText = span.textContent.trim();
          break;
        }
      }
      return {
        hasCategories: allText.includes('EAR, NOSE, THROAT'),
        backVisible,
        menuVisible,
        titleText,
      };
    });
    console.log(`  After back 2 (cat->main): categories=${afterBack2.hasCategories}, back=${afterBack2.backVisible}, menu=${afterBack2.menuVisible}, title="${afterBack2.titleText}"`);

    // ============================
    // MOBILE TEST 3: Rapid back on mobile
    // ============================
    console.log('\n=== MOBILE: Rapid Back Navigation ===');

    // Navigate deep again
    await page.evaluate(() => {
      const allDivs = document.querySelectorAll('[class*="cursor-pointer"]');
      for (const div of allDivs) {
        if (div.textContent?.includes('EAR, NOSE, THROAT')) { div.click(); return; }
      }
    });
    await wait(800);
    await page.evaluate(() => {
      const allDivs = document.querySelectorAll('[class*="cursor-pointer"]');
      for (const div of allDivs) {
        if (div.textContent?.includes('Cold Symptoms')) { div.click(); return; }
      }
    });
    await wait(1000);

    // Rapid back
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Go back"]');
        if (btn) btn.click();
      });
      await wait(50); // Very rapid
    }
    await wait(1500);

    const afterRapidMobile = await page.evaluate(() => {
      const allText = document.body.innerText;
      return {
        hasContent: allText.length > 50,
        hasCategories: allText.includes('EAR, NOSE, THROAT'),
        noErrors: !allText.includes('Cannot read') && !allText.includes('TypeError'),
      };
    });
    console.log(`  After rapid mobile back: content=${afterRapidMobile.hasContent}, categories=${afterRapidMobile.hasCategories}, clean=${afterRapidMobile.noErrors}`);

    // ============================
    // SUMMARY
    // ============================
    const criticalErrors = consoleErrors.filter(e =>
      e.includes('TypeError') || e.includes('Cannot read') || e.includes('Uncaught')
    );

    console.log('\n========================================');
    console.log('     MOBILE BACK NAV TEST RESULTS       ');
    console.log('========================================\n');

    // Main view checks
    const mainPass = results.mainView.backHidden && results.mainView.menuShown;
    console.log(`  ${mainPass ? 'PASS' : 'FAIL'} - Main view: back hidden=${results.mainView.backHidden}, title=${results.mainView.titleCorrect}, menu=${results.mainView.menuShown}`);

    // Category view checks
    const catPass = results.categoryView.backShown && results.categoryView.titleCorrect && results.categoryView.menuHidden;
    console.log(`  ${catPass ? 'PASS' : 'FAIL'} - Category view: back shown=${results.categoryView.backShown}, title="${categoryState.titleText}", menu hidden=${results.categoryView.menuHidden}`);

    // Symptom view checks
    const symPass = results.symptomView.backShown && results.symptomView.titleCorrect;
    console.log(`  ${symPass ? 'PASS' : 'FAIL'} - Symptom view: back shown=${results.symptomView.backShown}, title="${symptomState.titleText}"`);

    // Back chain
    const chainPass = afterBack1.hasSoreThroat && afterBack2.hasCategories && !afterBack2.backVisible;
    console.log(`  ${chainPass ? 'PASS' : 'FAIL'} - Back chain: symptom->cat ok=${afterBack1.hasSoreThroat}, cat->main ok=${afterBack2.hasCategories}, back hidden at main=${!afterBack2.backVisible}`);

    // Rapid back
    const rapidPass = afterRapidMobile.hasContent && afterRapidMobile.noErrors;
    console.log(`  ${rapidPass ? 'PASS' : 'FAIL'} - Rapid back: stable=${afterRapidMobile.hasContent}, no errors=${afterRapidMobile.noErrors}`);

    // Console errors
    const errorPass = criticalErrors.length === 0;
    console.log(`  ${errorPass ? 'PASS' : 'FAIL'} - Console errors: ${consoleErrors.length} total, ${criticalErrors.length} critical`);

    const allPass = mainPass && catPass && symPass && chainPass && rapidPass && errorPass;
    console.log(`\n  OVERALL MOBILE VERDICT: ${allPass ? 'PASS' : 'FAIL'}`);
    console.log('========================================');

    if (consoleErrors.length > 0) {
      console.log(`\n  Console errors (${consoleErrors.length}):`);
      const unique = [...new Set(consoleErrors)];
      unique.forEach(e => console.log(`    - ${e}`));
    }

    await browser.close();
    process.exit(allPass ? 0 : 1);
  } catch (err) {
    console.error('Fatal error:', err);
    if (browser) await browser.close();
    process.exit(1);
  }
}

runMobileTests();
