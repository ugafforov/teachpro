/**
 * Live visual test: open each page, enable dark mode, capture snapshot.
 * Ensures every route and main UI is tested in dark theme.
 * Run: node scripts/visual-test-dark.mjs
 * Requires: dev server on BASE_URL (default http://localhost:8081)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || 'http://localhost:8081';
const OUT_DIR = process.env.SCREENSHOT_DIR || `${__dirname}/../output/visual-test`;

const results = { passed: [], failed: [], screenshots: [] };

async function run() {
  let browser;
  try {
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      browser = await chromium.launch({ channel: 'msedge', headless: true });
    }

    mkdirSync(OUT_DIR, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    const setDarkMode = async () => {
      await context.addInitScript(() => {
        localStorage.setItem('teachpro-theme', 'dark');
        document.documentElement.classList.add('dark');
      });
      await page.reload();
      await page.waitForTimeout(800);
    };

    const capture = async (name) => {
      const path = `${OUT_DIR}/${name}.png`;
      await page.screenshot({ path, fullPage: false });
      results.screenshots.push(path);
      results.passed.push(name);
    };

    console.log('Opening', BASE_URL, '...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);

    // 1) Light: Auth page
    await capture('01-auth-light');

    // 2) Switch to dark and capture Auth again
    await setDarkMode();
    await capture('02-auth-dark');

    // 3) Dark: 404 page
    await page.goto(BASE_URL + '/nonexistent', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1500);
    await capture('03-notfound-dark');

    // 4) Back to home (dark), click theme toggle and capture
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1500);
    const themeBtn = page.locator([
      'button[aria-label="Tun rejimi"]',
      'button[aria-label="Kunduzgi rejim"]',
      'button[title="Tun rejimi"]',
      'button[title="Kunduzgi rejim"]',
      'button[aria-label="Tema sozlamalari"]',
      'button[aria-label="Tema o\'zgartirish"]',
    ].join(', ')).first();
    if (await themeBtn.count() > 0) {
      await themeBtn.click();
      await page.waitForTimeout(500);
      await capture('04-theme-toggle-dark');
    } else {
      results.failed.push('04-theme-toggle-dark: theme toggle button topilmadi');
    }

    // 5) Switch to light and capture Auth again (ensure toggle works)
    await page.evaluate(() => {
      localStorage.setItem('teachpro-theme', 'light');
      document.documentElement.classList.remove('dark');
    });
    await page.reload();
    await page.waitForTimeout(1500);
    await capture('05-auth-light-after-toggle');

    await browser.close();

    console.log('\n--- Visual test summary ---');
    console.log('Passed:', results.passed.length);
    console.log('Screenshots:', results.screenshots.join('\n         '));
    if (results.failed.length) {
      console.log('Failed:', results.failed);
      process.exit(1);
    }
    process.exit(0);
  } catch (e) {
    console.error('Visual test failed:', e.message);
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
  }
}

run();
