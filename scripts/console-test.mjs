/**
 * Opens the app in headless browser, navigates and collects console messages.
 * Run: node scripts/console-test.mjs
 * Ensure dev server is running: npm run dev
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8081';
const CONSOLE_MSGS = [];

function run() {
  return new Promise(async (resolve, reject) => {
    let browser;
    try {
      try {
        browser = await chromium.launch({ headless: true });
      } catch {
        try {
          browser = await chromium.launch({ channel: 'msedge', headless: true });
        } catch {
          browser = await chromium.launch({ channel: 'chrome', headless: true });
        }
      }
      const context = await browser.newContext();
      const page = await context.newPage();

      page.on('console', (msg) => {
        const type = msg.type();
        const text = msg.text();
        CONSOLE_MSGS.push({ type, text });
      });

      // Page errors (e.g. uncaught exceptions)
      page.on('pageerror', (err) => {
        CONSOLE_MSGS.push({ type: 'pageerror', text: err.message });
      });

      console.log('Opening', BASE_URL, '...');
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);

      // Visit other routes to trigger any route-level console issues
      await page.goto(BASE_URL + '/students/test-id', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000);
      await page.goto(BASE_URL + '/nonexistent', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000);
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(2000);

      // Try to find sidebar / main content to detect which view we're on
      const hasLogin = await page.locator('text=Kirish').count() > 0;
      const hasDashboard = await page.locator('[data-state="active"]').count() > 0;
      console.log('Page loaded. Has login form:', hasLogin, 'Has dashboard:', hasDashboard);

      // If we see sidebar (dashboard), click each tab to load all sections
      const sidebarItems = [
        "Umumiy ko'rinish",
        "Guruhlar",
        "O'quvchilar",
        "Imtihonlar",
        "Reyting",
        "Arxiv",
        "Ma'lumotlar",
      ];
      for (const label of sidebarItems) {
        const btn = page.getByRole('button', { name: label }).or(page.locator(`a:has-text("${label}")`)).first();
        if (await btn.count() > 0) {
          await btn.click().catch(() => {});
          await page.waitForTimeout(800);
        }
      }

      await page.waitForTimeout(2000);
      await browser.close();

      const errors = CONSOLE_MSGS.filter((m) => m.type === 'error' || m.type === 'pageerror');
      const warnings = CONSOLE_MSGS.filter((m) => m.type === 'warning');

      console.log('\n--- Console summary ---');
      console.log('Total messages:', CONSOLE_MSGS.length);
      console.log('Errors:', errors.length);
      console.log('Warnings:', warnings.length);

      if (errors.length > 0) {
        console.log('\n--- Errors ---');
        errors.forEach((e) => console.log(' ', e.type, e.text));
      }
      if (warnings.length > 0) {
        console.log('\n--- Warnings ---');
        warnings.forEach((w) => console.log(' ', w.text));
      }

      if (CONSOLE_MSGS.length > 0 && CONSOLE_MSGS.length <= 20) {
        console.log('\n--- All console messages ---');
        CONSOLE_MSGS.forEach((m) => console.log(' ', m.type, m.text?.substring?.(0, 120) ?? m.text));
      }
      resolve({ errors, warnings, total: CONSOLE_MSGS.length });
    } catch (e) {
      console.error('Test failed:', e.message);
      if (browser) await browser.close().catch(() => {});
      reject(e);
    }
  });
}

run()
  .then((r) => process.exit(r.errors.length > 0 ? 1 : 0))
  .catch(() => process.exit(1));
