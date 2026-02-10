import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, 'test-screenshots');

async function runTests() {
  console.log('=== Mobile Animation Test Suite ===');
  console.log('Viewport: 390x844 (iPhone-like)');
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  // Collect page errors
  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  const fs = await import('fs');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  try {
    // ============================================
    // TEST 1: CategoryList entrance animation on mobile
    // ============================================
    console.log('--- TEST 1: CategoryList entrance animation ---');
    await page.goto('http://localhost:5174/test2/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500); // Wait for entrance animations to complete
    await page.screenshot({ path: path.join(screenshotDir, '01-category-list-mobile.png'), fullPage: false });

    // Check if category items are visible
    const categoryItems = await page.locator('[class*="category"], [class*="Category"], li, [role="listitem"], [role="button"]').count();
    console.log(`  Category-like elements found: ${categoryItems}`);

    // Check for any visible text content
    const bodyText = await page.locator('body').innerText();
    const hasEarNoseThroat = bodyText.includes('EAR') || bodyText.includes('Ear') || bodyText.includes('ear');
    console.log(`  "EAR, NOSE, THROAT" category visible: ${hasEarNoseThroat}`);
    console.log(`  Page title/heading text (first 200 chars): ${bodyText.substring(0, 200).replace(/\n/g, ' | ')}`);
    console.log('  Screenshot saved: 01-category-list-mobile.png');
    console.log('');

    // ============================================
    // TEST 2: Mobile carousel panel transitions
    // ============================================
    console.log('--- TEST 2: Mobile carousel panel transitions ---');

    // Try to find and click the EAR, NOSE, THROAT category
    let clicked = false;
    const selectors = [
      'text=EAR, NOSE, THROAT',
      'text=EAR',
      'text=Ear, Nose, Throat',
      'text=Ear',
      ':text-matches("ear", "i")'
    ];

    for (const selector of selectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 1000 })) {
          await el.click();
          clicked = true;
          console.log(`  Clicked using selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!clicked) {
      console.log('  WARNING: Could not find EAR, NOSE, THROAT category. Trying first clickable item...');
      // Try clicking any list-like item
      const allButtons = await page.locator('button, [role="button"], li').all();
      for (const btn of allButtons) {
        const text = await btn.innerText().catch(() => '');
        if (text.length > 3 && text.length < 100) {
          await btn.click();
          console.log(`  Clicked fallback item: "${text.substring(0, 50)}"`);
          clicked = true;
          break;
        }
      }
    }

    await page.waitForTimeout(1000); // Wait for panel transition
    await page.screenshot({ path: path.join(screenshotDir, '02-subcategory-panel.png'), fullPage: false });

    const afterClickText = await page.locator('body').innerText();
    const hasSoreThroat = afterClickText.includes('Sore Throat') || afterClickText.includes('sore throat') || afterClickText.includes('A-1');
    console.log(`  Subcategory visible (Sore Throat/A-1): ${hasSoreThroat}`);
    console.log(`  Page text after click (first 300 chars): ${afterClickText.substring(0, 300).replace(/\n/g, ' | ')}`);
    console.log('  Screenshot saved: 02-subcategory-panel.png');
    console.log('');

    // ============================================
    // TEST 3: Column B transition (algorithm view)
    // ============================================
    console.log('--- TEST 3: Column B transition (algorithm view) ---');

    clicked = false;
    const algoSelectors = [
      'text=A-1: Sore Throat/Hoarseness',
      'text=A-1',
      'text=Sore Throat',
      ':text-matches("sore throat", "i")',
      ':text-matches("A-1", "i")'
    ];

    for (const selector of algoSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 1000 })) {
          await el.click();
          clicked = true;
          console.log(`  Clicked algorithm using selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!clicked) {
      console.log('  WARNING: Could not find A-1 algorithm. Trying first available link/button...');
      const items = await page.locator('a, button, [role="button"], li').all();
      for (const item of items) {
        const text = await item.innerText().catch(() => '');
        if (text.includes('A-') || text.includes('Algorithm') || (text.length > 3 && text.length < 80)) {
          await item.click();
          console.log(`  Clicked fallback: "${text.substring(0, 50)}"`);
          clicked = true;
          break;
        }
      }
    }

    await page.waitForTimeout(1000); // Wait for Column B transition
    await page.screenshot({ path: path.join(screenshotDir, '03-algorithm-column-b.png'), fullPage: false });

    const algoText = await page.locator('body').innerText();
    console.log(`  Algorithm view text (first 300 chars): ${algoText.substring(0, 300).replace(/\n/g, ' | ')}`);
    console.log('  Screenshot saved: 03-algorithm-column-b.png');
    console.log('');

    // ============================================
    // TEST 4: Mobile back navigation
    // ============================================
    console.log('--- TEST 4: Mobile back navigation ---');

    // Try to find back button
    const backSelectors = [
      '[aria-label*="back" i]',
      '[aria-label*="Back" i]',
      'button:has(svg[class*="chevron"])',
      'button:has(svg)',
      '[class*="back"]',
      '[class*="Back"]',
      'nav button:first-child',
      'header button:first-child'
    ];

    clicked = false;
    for (const selector of backSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 500 })) {
          await el.click();
          clicked = true;
          console.log(`  Back button clicked using: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next
      }
    }

    if (!clicked) {
      // Try browser back
      await page.goBack();
      console.log('  Used browser goBack()');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '04a-back-to-subcategory.png'), fullPage: false });
    console.log('  Screenshot saved: 04a-back-to-subcategory.png');

    // Click back again to return to main categories
    clicked = false;
    for (const selector of backSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 500 })) {
          await el.click();
          clicked = true;
          console.log(`  Second back clicked using: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next
      }
    }

    if (!clicked) {
      await page.goBack();
      console.log('  Used browser goBack() for second back');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '04b-back-to-categories.png'), fullPage: false });

    const backText = await page.locator('body').innerText();
    const categoriesBack = backText.includes('EAR') || backText.includes('Ear');
    console.log(`  Returned to categories (EAR visible): ${categoriesBack}`);
    console.log('  Screenshot saved: 04b-back-to-categories.png');
    console.log('');

    // ============================================
    // TEST 5: Mobile drawer animations
    // ============================================
    console.log('--- TEST 5: Mobile drawer animations ---');

    const drawerSelectors = [
      '[aria-label*="menu" i]',
      '[aria-label*="Menu" i]',
      '[aria-label*="settings" i]',
      '[aria-label*="Settings" i]',
      'button:has-text("Settings")',
      'button:has-text("Menu")',
      '[class*="hamburger"]',
      '[class*="menu-button"]',
      'text=Settings',
      'text=\u2630'
    ];

    clicked = false;
    for (const selector of drawerSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 500 })) {
          await el.click();
          clicked = true;
          console.log(`  Drawer trigger clicked using: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next
      }
    }

    if (!clicked) {
      // Try looking for SVG icons that might be hamburger menus
      const svgButtons = await page.locator('button:has(svg)').all();
      for (const btn of svgButtons) {
        const text = await btn.innerText().catch(() => '');
        const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
        if (text === '' || text.trim().length < 3) {
          await btn.click();
          console.log(`  Clicked SVG button (possible menu), aria-label: ${ariaLabel}`);
          clicked = true;
          break;
        }
      }
    }

    await page.waitForTimeout(800); // Wait for drawer animation
    await page.screenshot({ path: path.join(screenshotDir, '05a-drawer-open.png'), fullPage: false });
    console.log('  Screenshot saved: 05a-drawer-open.png');

    // Close the drawer - try clicking overlay/backdrop, close button, or pressing Escape
    const closeSelectors = [
      '[aria-label*="close" i]',
      '[class*="overlay"]',
      '[class*="backdrop"]',
      '[class*="scrim"]',
      'button:has-text("Close")'
    ];

    let closed = false;
    for (const selector of closeSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 500 })) {
          await el.click();
          closed = true;
          console.log(`  Drawer closed using: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next
      }
    }

    if (!closed) {
      await page.keyboard.press('Escape');
      console.log('  Pressed Escape to close drawer');
    }

    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotDir, '05b-drawer-closed.png'), fullPage: false });
    console.log('  Screenshot saved: 05b-drawer-closed.png');
    console.log('');

    // ============================================
    // TEST 6: Mobile search overlay
    // ============================================
    console.log('--- TEST 6: Mobile search overlay ---');

    const searchSelectors = [
      'input[type="search"]',
      'input[placeholder*="search" i]',
      'input[placeholder*="Search" i]',
      '[role="search"] input',
      'input[type="text"]',
      '[class*="search"] input',
      'input'
    ];

    let searchInput = null;
    for (const selector of searchSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 500 })) {
          searchInput = el;
          console.log(`  Search input found using: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next
      }
    }

    if (searchInput) {
      await searchInput.click();
      await page.waitForTimeout(500);
      await searchInput.fill('chest');
      await page.waitForTimeout(1000); // Wait for search results
      await page.screenshot({ path: path.join(screenshotDir, '06a-search-results.png'), fullPage: false });

      const searchText = await page.locator('body').innerText();
      const hasResults = searchText.toLowerCase().includes('chest') || searchText.toLowerCase().includes('result');
      console.log(`  Search results visible: ${hasResults}`);
      console.log(`  Search area text (first 300 chars): ${searchText.substring(0, 300).replace(/\n/g, ' | ')}`);
      console.log('  Screenshot saved: 06a-search-results.png');

      // Clear search
      await searchInput.fill('');
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(screenshotDir, '06b-search-cleared.png'), fullPage: false });
      console.log('  Screenshot saved: 06b-search-cleared.png');
    } else {
      console.log('  WARNING: No search input found on page');
      await page.screenshot({ path: path.join(screenshotDir, '06-no-search-found.png'), fullPage: false });
    }
    console.log('');

    // ============================================
    // TEST 7: Console messages check
    // ============================================
    console.log('--- TEST 7: Console messages ---');
    console.log(`  Total console messages: ${consoleMessages.length}`);

    const errors = consoleMessages.filter(m => m.type === 'error');
    const warnings = consoleMessages.filter(m => m.type === 'warning');

    console.log(`  Errors: ${errors.length}`);
    console.log(`  Warnings: ${warnings.length}`);

    if (errors.length > 0) {
      console.log('  Error details:');
      errors.forEach((e, i) => {
        console.log(`    [${i + 1}] ${e.text.substring(0, 200)}`);
      });
    }

    if (warnings.length > 0) {
      console.log('  Warning details:');
      warnings.forEach((w, i) => {
        console.log(`    [${i + 1}] ${w.text.substring(0, 200)}`);
      });
    }

    if (pageErrors.length > 0) {
      console.log(`  Page errors: ${pageErrors.length}`);
      pageErrors.forEach((e, i) => {
        console.log(`    [${i + 1}] ${e.substring(0, 200)}`);
      });
    }

    console.log('');
    console.log('=== Test Suite Complete ===');

  } catch (error) {
    console.error('Test error:', error.message);
    await page.screenshot({ path: path.join(screenshotDir, 'error-state.png'), fullPage: false }).catch(() => {});
  } finally {
    await browser.close();
  }
}

runTests().catch(console.error);
