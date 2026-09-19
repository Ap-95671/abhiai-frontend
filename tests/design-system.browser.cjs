/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing optional browser-test runtime. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { setup, open } = require('./assistant.browser.cjs');
const origin = process.env.ASSISTANT_TEST_URL || 'http://localhost:3100';
const output = process.env.DESIGN_QA_DIR || '/tmp/abhiai-design-qa';
fs.mkdirSync(output, { recursive: true });
const css = (locator, property) => locator.evaluate((node, property) => getComputedStyle(node)[property], property);
async function navigation(page, width) {
  if (width < 900) {
    const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
    if (await toggle.isVisible()) await toggle.click();
  }
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const results = [];
  try {
    for (const width of [1440, 768, 390]) for (const theme of ['dark', 'light']) {
      const f = await setup(browser, { width, height: 1000 });
      const { page, context } = f;
      await navigation(page, width);
      if (theme === 'light') {
        await page.getByLabel('Open account menu', { exact: true }).click();
        await page.getByRole('menuitem', { name: 'Switch to light mode' }).click();
        await page.keyboard.press('Escape');
        await navigation(page, width);
      }
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      const avatar = page.locator('.user-avatar-fallback').first();
      assert(await avatar.getAttribute('data-tone'));
      assert.equal(await css(page.getByRole('button', { name: 'New conversation', exact: true }), 'borderRadius'), '6px');
      const close = page.getByRole('button', { name: 'Close navigation', exact: true });
      if (await close.count()) await close.first().click();
      assert.equal(await css(page.locator('form.composer'), 'borderRadius'), '12px');
      const trigger = page.getByRole('button', { name: 'Open AI tools', exact: true });
      await trigger.focus(); await page.keyboard.press('ArrowDown');
      const first = page.getByRole('menuitem', { name: /Upload image/ });
      assert(await first.evaluate(el => el === document.activeElement));
      await page.keyboard.press('ArrowUp');
      assert(await page.getByRole('menuitem', { name: /Generate image/ }).evaluate(el => el === document.activeElement), 'disabled item skipped and navigation wraps');
      await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown');
      assert(await page.getByRole('menuitem', { name: /Upload PDF/ }).evaluate(el => el === document.activeElement));
      const menu = page.getByRole('menu', { name: 'AI tools', exact: true });
      assert.equal(await css(menu, 'borderRadius'), '12px');
      const rect = await menu.boundingBox(); assert(rect.x >= 0 && rect.x + rect.width <= width, 'menu fits viewport');
      await page.screenshot({ path: `${output}/chat-${width}-${theme}.png` });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open AI tools');
      await trigger.press('ArrowUp'); await page.keyboard.press('Tab');
      assert.equal(await menu.count(), 0);
      assert(!(await trigger.evaluate(el => el === document.activeElement)), 'Tab exits menu');
      await open(page);
      await page.getByRole('button', { name: 'Assistant settings and memory' }).click();
      let enabled = false;
      // Existing memory endpoint is overridden only for this UI test.
      await context.route('**/api/v1/memory', route => {
        if (route.request().method() === 'PATCH') enabled = route.request().postDataJSON().enabled;
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled, memories: [] }) });
      });
      const toggle = page.getByRole('switch', { name: 'Use saved memories in AI chats' });
      await toggle.waitFor(); await toggle.focus(); await page.keyboard.press('Space');
      await page.waitForFunction(() => document.querySelector('[role="switch"][aria-label="Use saved memories in AI chats"]')?.getAttribute('aria-checked') === 'true');
      assert.equal(enabled, true);
      await page.screenshot({ path: `${output}/settings-${width}-${theme}.png` });
      assert(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await page.getByRole('button', { name: 'Minimize assistant and stop microphone' }).click();
      await page.goto(origin + '/social');
      await page.getByLabel('Create a social post', { exact: true }).waitFor();
      assert.equal(await css(page.locator('.post-composer'), 'borderRadius'), '12px');
      assert.equal(await css(page.locator('.post-composer'), 'boxShadow'), 'none');
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme, 'theme persists across navigation');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: `${output}/social-${width}-${theme}.png` });
      assert.deepEqual(f.errors, []); await context.close();
      const auth = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      await auth.addInitScript(theme => localStorage.setItem('abhiai.theme', theme), theme);
      const login = await auth.newPage(); await login.goto(origin + '/login');
      const email = login.getByLabel('Email address', { exact: true }); await email.waitFor(); await email.focus();
      assert.equal(await css(email, 'borderRadius'), '6px');
      assert.equal(await css(email, 'height'), '44px');
      assert.notEqual(await css(email, 'outlineStyle'), 'none');
      assert.equal(await css(login.getByRole('button', { name: 'Log in', exact: true }), 'height'), '44px');
      await login.getByLabel('Password', { exact: true }).fill('example-password');
      await login.getByRole('button', { name: 'Show password' }).click();
      assert.equal(await login.getByLabel('Password', { exact: true }).getAttribute('type'), 'text');
      await login.getByRole('button', { name: 'Sign up', exact: true }).click();
      await login.getByLabel('Full name').waitFor();
      assert.equal(new URL(login.url()).pathname, '/login', 'signup remains in the combined route');
      if (width > 600) {
        await login.locator('[data-character="orange"]').waitFor({ state: 'attached' });
        assert.equal(await login.locator('[data-character]').count(), 4, 'all existing mascots retained');
      } else assert.equal(await login.locator('[data-character]').count(), 0, 'existing mobile illustration behavior preserved');
      assert(await login.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await login.screenshot({ path: `${output}/auth-${width}-${theme}.png`, fullPage: true });
      await auth.close(); results.push({ width, theme, passed: true });
      console.log(`Passed ${width}px ${theme}`);
    }
    fs.writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ passed: true, results, screenshots: output }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
