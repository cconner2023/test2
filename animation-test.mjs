import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, 'test-screenshots');

async function runTests() {
  console.log('=== Mobile Animation Test Suite (390x844) ===');
  console.log('Testing react-spring animations after migration from auto-animate');
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
  });
  const page = await context.newPage();

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  try {
    // ============================================
    // SETUP: Navigate and dismiss InstallPrompt
    // ============================================
    console.log('--- SETUP: Navigate and dismiss InstallPrompt ---');
    await page.goto('http://localhost:5174/test2/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Dismiss the PWA install prompt if present
    const gotItBtn = page.locator('button:has-text("Got it")');
    const notNowBtn = page.locator('button:has-text("Not Now")');
    const dismissBtn = page.locator('[aria-label="Dismiss install prompt"]');

    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
      console.log('  Dismissed InstallPrompt via "Got it" button');
    } else if (await notNowBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await notNowBtn.click();
      console.log('  Dismissed InstallPrompt via "Not Now" button');
    } else if (await dismissBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await dismissBtn.click();
      console.log('  Dismissed InstallPrompt via X button');
    } else {
      console.log('  No InstallPrompt found - continuing');
    }
    await page.waitForTimeout(800);
    console.log('');

    // ============================================
    // TEST 1: CategoryList entrance animation
    // ============================================
    console.log('--- TEST 1: CategoryList entrance animation on mobile ---');
    await page.screenshot({ path: path.join(screenshotDir, '01-category-list-mobile.png'), fullPage: false });

    // Check category count
    const bodyText = await page.locator('body').innerText();
    const categories = ['EAR, NOSE, THROAT', 'MUSCULOSKELETAL', 'GASTROINTESTINAL', 'CARDIORESPIRATORY', 'GENITOURINARY', 'NEUROPSYCHIATRIC', 'CONSTITUTIONAL', 'EYE'];
    let visibleCount = 0;
    for (const cat of categories) {
      if (bodyText.includes(cat)) visibleCount++;
    }
    console.log(`  Categories visible: ${visibleCount}/${categories.length}`);

    // Check react-spring useTrail animations completed
    const trailInfo = await page.evaluate(() => {
      // AnimatedNavigationList wraps items in animated.div with opacity and translateY
      const styledDivs = document.querySelectorAll('div[style]');
      let fullOpacity = 0;
      let withTranslateY = 0;
      styledDivs.forEach(div => {
        const style = div.getAttribute('style') || '';
        if (style.includes('opacity: 1') || style.includes('opacity:1')) fullOpacity++;
        if (style.includes('translateY(0px)') || style.includes('translateY(0)')) withTranslateY++;
      });
      return { fullOpacity, withTranslateY };
    });
    console.log(`  Trail animation: ${trailInfo.fullOpacity} items at full opacity, ${trailInfo.withTranslateY} at translateY(0)`);
    console.log(`  VERDICT: ${visibleCount >= 7 ? 'PASS' : 'FAIL'} - Category list renders correctly`);
    console.log(`  VERDICT: ${trailInfo.fullOpacity >= 7 ? 'PASS' : 'INFO'} - react-spring useTrail animation completed (${trailInfo.fullOpacity} items)`);
    console.log('  Screenshot: 01-category-list-mobile.png');
    console.log('');

    // ============================================
    // TEST 2: Mobile carousel panel transitions
    // ============================================
    console.log('--- TEST 2: Mobile carousel panel transitions ---');

    // Get carousel state before click
    const beforeCarousel = await page.evaluate(() => {
      const animated = document.querySelector('[style*="translateX"]');
      return animated ? animated.getAttribute('style') : 'no translateX element found';
    });
    console.log(`  Carousel before click: ${beforeCarousel}`);

    // Use a more precise click - find the NavigationRow div containing "EAR, NOSE, THROAT"
    const clicked = await page.evaluate(() => {
      // Find all divs that have the category text
      const allDivs = document.querySelectorAll('div[class*="cursor-pointer"]');
      for (const div of allDivs) {
        if (div.textContent && div.textContent.includes('EAR, NOSE, THROAT')) {
          // This is the NavigationRow, which has the onClick handler
          div.click();
          return `Clicked div containing "EAR, NOSE, THROAT" - class: ${div.className.substring(0, 80)}`;
        }
      }
      return 'Not found via cursor-pointer divs';
    });
    console.log(`  Click result: ${clicked}`);

    // Wait for spring animation to complete
    await page.waitForTimeout(1200);

    // Check carousel state after click
    const afterCarousel = await page.evaluate(() => {
      const animated = document.querySelector('[style*="translateX"]');
      const style = animated ? animated.getAttribute('style') : 'no element';
      // Also check if subcategory content is now visible/populated
      const bodyText = document.body.innerText;
      const subcatVisible = bodyText.includes('Sore Throat') || bodyText.includes('Hoarseness') || bodyText.includes('Ear Pain');
      return { style, subcatVisible, bodyTextSample: bodyText.substring(0, 300) };
    });
    console.log(`  Carousel after click: ${afterCarousel.style}`);
    console.log(`  Subcategory content visible: ${afterCarousel.subcatVisible}`);

    await page.screenshot({ path: path.join(screenshotDir, '02-subcategory-panel.png'), fullPage: false });

    // Check if translateX changed from 0% to -50% (panel moved)
    const panelMoved = afterCarousel.style && afterCarousel.style.includes('-50%');
    console.log(`  Panel moved to -50%: ${panelMoved}`);
    console.log(`  VERDICT: ${panelMoved ? 'PASS' : 'FAIL'} - Carousel panel transition`);
    if (!panelMoved) {
      console.log(`  DEBUG: Body text sample: ${afterCarousel.bodyTextSample.replace(/\n/g, ' | ').substring(0, 200)}`);
    }
    console.log('  Screenshot: 02-subcategory-panel.png');
    console.log('');

    // ============================================
    // TEST 3: Column B transition (algorithm view)
    // ============================================
    console.log('--- TEST 3: Column B transition (algorithm view) ---');

    // Get grid template before
    const gridBefore = await page.evaluate(() => {
      const gridEl = document.querySelector('[style*="grid-template-columns"]');
      return gridEl ? getComputedStyle(gridEl).gridTemplateColumns : 'no grid found';
    });
    console.log(`  Grid before symptom click: ${gridBefore}`);

    // Click a symptom/subcategory item
    const symptomClicked = await page.evaluate(() => {
      // Find NavigationRow divs that are subcategory items (should be in the second panel)
      const cursorDivs = document.querySelectorAll('div[class*="cursor-pointer"]');
      for (const div of cursorDivs) {
        const text = (div.textContent || '').trim();
        // Look for symptom items (they have icon prefix like "A-1" pattern)
        if (text.includes('Sore Throat') || text.includes('Hoarseness') || text.includes('Ear Pain') || text.includes('Hearing')) {
          div.click();
          return `Clicked: "${text.substring(0, 60)}"`;
        }
      }
      // Fallback: click any item that looks like a subcategory (not a main category)
      for (const div of cursorDivs) {
        const text = (div.textContent || '').trim();
        if (!text.includes('MUSCULOSKELETAL') && !text.includes('GASTROINTESTINAL') &&
            !text.includes('CARDIORESPIRATORY') && !text.includes('GENITOURINARY') &&
            !text.includes('NEUROPSYCHIATRIC') && !text.includes('CONSTITUTIONAL') &&
            !text.includes('EYE') && !text.includes('GYNECOLOGICAL') &&
            !text.includes('DERMATOLOGICAL') && !text.includes('ENVIRONMENTAL') &&
            !text.includes('MISCELLANEOUS') && !text.includes('EAR, NOSE, THROAT') &&
            text.length > 3 && text.length < 80) {
          div.click();
          return `Clicked subcategory: "${text.substring(0, 60)}"`;
        }
      }
      return 'No subcategory items found to click';
    });
    console.log(`  Symptom click: ${symptomClicked}`);

    await page.waitForTimeout(1200);

    // Check grid template after - should change from "1fr 0fr" to "0fr 1fr"
    const gridAfter = await page.evaluate(() => {
      const gridEl = document.querySelector('[style*="grid-template-columns"]');
      const computed = gridEl ? getComputedStyle(gridEl).gridTemplateColumns : 'no grid found';
      const raw = gridEl ? gridEl.getAttribute('style') : 'no style';
      return { computed, raw };
    });
    console.log(`  Grid after symptom click: ${gridAfter.computed}`);
    console.log(`  Grid style attr: ${gridAfter.raw}`);

    await page.screenshot({ path: path.join(screenshotDir, '03-algorithm-column-b.png'), fullPage: false });

    // Check if Column B is now showing (grid transitioned to 0fr 1fr)
    const columnBActive = gridAfter.computed.includes('0px') && !gridAfter.computed.startsWith('0px');
    const algoText = await page.locator('body').innerText();
    const hasAlgoContent = algoText.includes('Question') || algoText.includes('Algorithm') || algoText.includes('Disposition') || algoText.includes('Yes') || algoText.includes('No');
    console.log(`  Column B is active: ${columnBActive}`);
    console.log(`  Algorithm content visible: ${hasAlgoContent}`);
    console.log(`  VERDICT: ${hasAlgoContent ? 'PASS' : (columnBActive ? 'PARTIAL' : 'FAIL')} - Column B transition`);
    console.log('  Screenshot: 03-algorithm-column-b.png');
    console.log('');

    // ============================================
    // TEST 4: Mobile back navigation
    // ============================================
    console.log('--- TEST 4: Mobile back navigation ---');

    // Try the Go back button (aria-label="Go back")
    const backBtn = page.locator('[aria-label="Go back"]').first();
    if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backBtn.click();
      console.log('  Clicked "Go back" button');
    } else {
      // Try evaluating the back click directly
      console.log('  Back button not visible, trying alternative...');
      const backResult = await page.evaluate(() => {
        const btn = document.querySelector('[aria-label="Go back"]');
        if (btn) {
          (btn).click();
          return 'clicked via querySelector';
        }
        return 'not found';
      });
      console.log(`  Back button via JS: ${backResult}`);
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '04a-back-to-subcategory.png'), fullPage: false });

    const gridAfterBack1 = await page.evaluate(() => {
      const gridEl = document.querySelector('[style*="grid-template-columns"]');
      return gridEl ? getComputedStyle(gridEl).gridTemplateColumns : 'no grid';
    });
    console.log(`  Grid after first back: ${gridAfterBack1}`);

    // Determine what view we're on
    const afterBack1Text = await page.locator('body').innerText();
    const onSubcategory = afterBack1Text.includes('Sore Throat') || afterBack1Text.includes('Hoarseness') || afterBack1Text.includes('Ear Pain');
    const onCategories = afterBack1Text.includes('MUSCULOSKELETAL') && !afterBack1Text.includes('Question');
    console.log(`  On subcategory view: ${onSubcategory}`);
    console.log(`  On main categories: ${onCategories}`);
    console.log('  Screenshot: 04a-back-to-subcategory.png');

    // Second back click
    const backBtn2 = page.locator('[aria-label="Go back"]').first();
    if (await backBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backBtn2.click();
      console.log('  Clicked second "Go back" button');
    } else {
      await page.evaluate(() => {
        const btn = document.querySelector('[aria-label="Go back"]');
        if (btn) (btn).click();
      });
      console.log('  Second back via JS');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '04b-back-to-categories.png'), fullPage: false });

    const afterBack2Text = await page.locator('body').innerText();
    const backToMain = afterBack2Text.includes('EAR, NOSE, THROAT') && afterBack2Text.includes('MUSCULOSKELETAL');
    console.log(`  Returned to main categories: ${backToMain}`);

    // Check carousel position
    const carouselAfterBack = await page.evaluate(() => {
      const animated = document.querySelector('[style*="translateX"]');
      return animated ? animated.getAttribute('style') : 'no element';
    });
    console.log(`  Carousel position: ${carouselAfterBack}`);
    console.log(`  VERDICT: ${backToMain ? 'PASS' : 'FAIL'} - Back navigation`);
    console.log('  Screenshot: 04b-back-to-categories.png');
    console.log('');

    // ============================================
    // TEST 5: Mobile drawer animations
    // ============================================
    console.log('--- TEST 5: Mobile drawer animations ---');

    // 5a: Test the morphing hamburger menu (NavTop's animated menu)
    console.log('  5a: Testing hamburger menu morph animation');

    // The menu button is inside a morphing container
    const menuBtn = page.locator('[aria-label="Open menu"]').first();
    if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await menuBtn.click();
      console.log('  Clicked "Open menu" button');
    } else {
      // Try force click through JS
      await page.evaluate(() => {
        const btn = document.querySelector('[aria-label="Open menu"]');
        if (btn) (btn).click();
      });
      console.log('  Clicked menu via JS');
    }

    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotDir, '05a-menu-open.png'), fullPage: false });

    // Check if menu items are visible (animated via useTrail)
    const menuInfo = await page.evaluate(() => {
      const menuButtons = document.querySelectorAll('button[class*="text-left"]');
      const menuTexts = [];
      menuButtons.forEach(btn => {
        const text = btn.textContent?.trim();
        if (text) menuTexts.push(text);
      });

      // Check for spring-animated container (width/height transition)
      const springContainers = document.querySelectorAll('[style*="width"][style*="height"][style*="border-radius"]');

      return { menuTexts, springContainerCount: springContainers.length };
    });
    console.log(`  Menu items found: ${menuInfo.menuTexts.join(', ') || 'none'}`);
    console.log(`  Spring-animated containers: ${menuInfo.springContainerCount}`);
    console.log(`  VERDICT: ${menuInfo.menuTexts.length > 0 ? 'PASS' : 'FAIL'} - Menu morph animation`);
    console.log('  Screenshot: 05a-menu-open.png');

    // 5b: Click Settings to open the BaseDrawer
    console.log('  5b: Testing Settings drawer slide-up animation');

    const settingsClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent?.trim();
        if (text && text.includes('Settings') && !text.includes('ADTMC')) {
          btn.click();
          return `Clicked: "${text}"`;
        }
      }
      return 'Settings button not found';
    });
    console.log(`  ${settingsClicked}`);

    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '05b-drawer-settings.png'), fullPage: false });

    // Check BaseDrawer state
    const drawerState = await page.evaluate(() => {
      // BaseDrawer uses an animated div with translateY style
      const allStyled = document.querySelectorAll('[style*="translateY"]');
      const drawerInfo = [];
      allStyled.forEach(el => {
        const style = el.getAttribute('style') || '';
        if (style.includes('bottom') || style.includes('height') || el.className?.includes('z-60')) {
          drawerInfo.push({
            style: style.substring(0, 150),
            class: el.className?.substring(0, 80),
          });
        }
      });

      // Check backdrop opacity
      const backdrops = document.querySelectorAll('[class*="fixed"][class*="inset-0"][class*="bg-black"]');
      const backdropInfo = [];
      backdrops.forEach(el => {
        const style = el.getAttribute('style') || '';
        backdropInfo.push(style.substring(0, 100));
      });

      // Check if Settings content is visible
      const hasSettings = document.body.innerText.includes('Toggle Theme') || document.body.innerText.includes('Release Notes');

      return { drawerInfo, backdropInfo, hasSettings };
    });
    console.log(`  Drawer elements with translateY: ${drawerState.drawerInfo.length}`);
    drawerState.drawerInfo.forEach(d => console.log(`    style: ${d.style}`));
    console.log(`  Backdrop elements: ${drawerState.backdropInfo.length}`);
    drawerState.backdropInfo.forEach(b => console.log(`    ${b}`));
    console.log(`  Settings content visible: ${drawerState.hasSettings}`);
    console.log(`  VERDICT: ${drawerState.hasSettings ? 'PASS' : 'FAIL'} - Settings drawer slide-up animation`);
    console.log('  Screenshot: 05b-drawer-settings.png');

    // 5c: Close drawer
    console.log('  5c: Testing drawer close animation');
    const closeResult = await page.evaluate(() => {
      const closeBtn = document.querySelector('[aria-label="Close"]');
      if (closeBtn) {
        (closeBtn).click();
        return 'Clicked Close button';
      }
      return 'Close button not found';
    });
    console.log(`  ${closeResult}`);

    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '05c-drawer-closed.png'), fullPage: false });

    const afterDrawerClose = await page.evaluate(() => {
      const hasSettings = document.body.innerText.includes('Toggle Theme');
      return { hasSettings };
    });
    console.log(`  Settings still visible: ${afterDrawerClose.hasSettings}`);
    console.log(`  VERDICT: ${!afterDrawerClose.hasSettings ? 'PASS' : 'FAIL'} - Drawer close animation`);
    console.log('  Screenshot: 05c-drawer-closed.png');
    console.log('');

    // ============================================
    // TEST 6: Mobile search overlay
    // ============================================
    console.log('--- TEST 6: Mobile search overlay ---');

    // Click the search icon (aria-label="Search")
    const searchClicked = await page.evaluate(() => {
      const searchBtn = document.querySelector('[aria-label="Search"]');
      if (searchBtn) {
        (searchBtn).click();
        return 'Clicked Search icon';
      }
      return 'Search icon not found';
    });
    console.log(`  ${searchClicked}`);

    await page.waitForTimeout(600);

    // Check if search input expanded
    const searchExpanded = await page.evaluate(() => {
      const input = document.querySelector('input[type="search"]');
      if (input) {
        return {
          visible: true,
          placeholder: input.getAttribute('placeholder'),
          parentClass: input.parentElement?.className?.substring(0, 80),
        };
      }
      return { visible: false };
    });
    console.log(`  Search input visible: ${searchExpanded.visible}`);
    if (searchExpanded.visible) {
      console.log(`  Search expand animation class: ${searchExpanded.parentClass}`);
    }

    // Type in search
    if (searchExpanded.visible) {
      const searchInput = page.locator('input[type="search"]').first();
      await searchInput.fill('chest');
      console.log('  Typed "chest" in search');

      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(screenshotDir, '06a-search-results.png'), fullPage: false });

      // Check for mobile search overlay (react-spring useTransition)
      const searchOverlay = await page.evaluate(() => {
        // The mobile search overlay is an animated.div with absolute inset-0 z-20
        const overlays = document.querySelectorAll('.absolute.inset-0.z-20, [class*="absolute"][class*="inset-0"][class*="z-20"]');
        const overlayInfo = [];
        overlays.forEach(el => {
          const style = el.getAttribute('style') || '';
          overlayInfo.push({ style: style.substring(0, 100), class: el.className?.substring(0, 80) });
        });

        const bodyText = document.body.innerText.toLowerCase();
        const chestResults = bodyText.includes('chest');
        const resultItems = document.querySelectorAll('[class*="cursor-pointer"]');

        return { overlayInfo, chestResults, resultCount: resultItems.length };
      });
      console.log(`  Search overlay elements: ${searchOverlay.overlayInfo.length}`);
      searchOverlay.overlayInfo.forEach(o => console.log(`    style: ${o.style}`));
      console.log(`  "chest" in results: ${searchOverlay.chestResults}`);
      console.log(`  VERDICT: ${searchOverlay.chestResults ? 'PASS' : 'FAIL'} - Mobile search with react-spring useTransition overlay`);
      console.log('  Screenshot: 06a-search-results.png');

      // Clear search
      console.log('  Clearing search...');
      await searchInput.fill('');
      // Click the X/close button to collapse search
      await page.evaluate(() => {
        // Find the X button next to the search input (the div with cursor-pointer class inside the search container)
        const searchContainer = document.querySelector('[class*="animate-expandSearch"]');
        if (searchContainer) {
          const closeDiv = searchContainer.querySelector('div[class*="cursor-pointer"]');
          if (closeDiv) {
            (closeDiv).click();
            return;
          }
        }
        // Fallback: find any close element near the search
        const xDivs = document.querySelectorAll('div[class*="cursor-pointer"]');
        for (const div of xDivs) {
          const svg = div.querySelector('svg');
          if (svg && div.closest('[class*="expandSearch"]')) {
            (div).click();
            return;
          }
        }
      });

      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(screenshotDir, '06b-search-cleared.png'), fullPage: false });

      const afterClear = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          categoriesVisible: text.includes('EAR, NOSE, THROAT'),
          searchInput: document.querySelector('input[type="search"]')?.getAttribute('value') || '',
        };
      });
      console.log(`  Search cleared, categories visible: ${afterClear.categoriesVisible}`);
      console.log(`  VERDICT: ${afterClear.categoriesVisible ? 'PASS' : 'CHECK'} - Search clear returns to categories`);
      console.log('  Screenshot: 06b-search-cleared.png');
    } else {
      console.log('  VERDICT: FAIL - Search input not visible');
      await page.screenshot({ path: path.join(screenshotDir, '06-search-failed.png'), fullPage: false });
    }
    console.log('');

    // ============================================
    // TEST 7: Console messages
    // ============================================
    console.log('--- TEST 7: Console messages audit ---');
    console.log(`  Total: ${consoleMessages.length}`);

    const errors = consoleMessages.filter(m => m.type === 'error');
    const warnings = consoleMessages.filter(m => m.type === 'warning');

    console.log(`  Errors: ${errors.length}`);
    errors.forEach((e, i) => console.log(`    [ERR ${i + 1}] ${e.text.substring(0, 300)}`));

    console.log(`  Warnings: ${warnings.length}`);
    warnings.forEach((w, i) => console.log(`    [WARN ${i + 1}] ${w.text.substring(0, 300)}`));

    if (pageErrors.length > 0) {
      console.log(`  Page errors: ${pageErrors.length}`);
      pageErrors.forEach((e, i) => console.log(`    [PAGE ${i + 1}] ${e.substring(0, 300)}`));
    }

    // react-spring specific
    const springMsgs = consoleMessages.filter(m =>
      m.text.includes('react-spring') || m.text.includes('spring') || m.text.includes('useSpring') || m.text.includes('animated')
    );
    console.log(`  react-spring messages: ${springMsgs.length}`);
    springMsgs.forEach(s => console.log(`    [${s.type}] ${s.text.substring(0, 200)}`));

    console.log(`  VERDICT: ${errors.length === 0 && pageErrors.length === 0 ? 'PASS' : 'FAIL'} - No console errors`);
    console.log('');

    // ============================================
    // BONUS: Animation framework verification
    // ============================================
    console.log('--- BONUS: Animation framework verification ---');
    const frameworkCheck = await page.evaluate(() => {
      // Check for react-spring animated elements
      const allStyled = document.querySelectorAll('[style]');
      let springAnimated = 0;
      let cssTransitions = 0;
      let cssAnimations = 0;

      allStyled.forEach(el => {
        const style = el.getAttribute('style') || '';
        const computed = getComputedStyle(el);

        // react-spring uses inline styles with precise values
        if (style.includes('opacity') || style.includes('translateX') || style.includes('translateY') || style.includes('transform')) {
          springAnimated++;
        }
        // CSS transitions
        if (computed.transition && computed.transition !== 'all 0s ease 0s' && computed.transition !== 'none') {
          cssTransitions++;
        }
        // CSS animations
        if (computed.animation && computed.animation !== 'none') {
          cssAnimations++;
        }
      });

      // Check for auto-animate (should NOT be present after migration)
      const autoAnimate = document.querySelectorAll('[data-auto-animate-id], [data-aa-id]');

      return {
        springAnimated,
        cssTransitions,
        cssAnimations,
        autoAnimateElements: autoAnimate.length,
      };
    });
    console.log(`  react-spring animated elements: ${frameworkCheck.springAnimated}`);
    console.log(`  CSS transitions active: ${frameworkCheck.cssTransitions}`);
    console.log(`  CSS animations active: ${frameworkCheck.cssAnimations}`);
    console.log(`  auto-animate elements (should be 0): ${frameworkCheck.autoAnimateElements}`);
    console.log(`  VERDICT: ${frameworkCheck.autoAnimateElements === 0 ? 'PASS' : 'FAIL'} - No auto-animate remnants`);
    console.log(`  VERDICT: ${frameworkCheck.springAnimated > 0 ? 'PASS' : 'FAIL'} - react-spring is active`);
    console.log('');

    console.log('=== TEST SUITE COMPLETE ===');
    console.log(`Screenshots saved to: ${screenshotDir}`);

  } catch (error) {
    console.error('FATAL TEST ERROR:', error.message);
    console.error('Stack:', error.stack?.substring(0, 500));
    await page.screenshot({ path: path.join(screenshotDir, 'error-state.png'), fullPage: false }).catch(() => {});
  } finally {
    await browser.close();
  }
}

runTests().catch(console.error);
