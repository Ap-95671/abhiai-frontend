/* eslint-disable @typescript-eslint/no-require-imports -- Existing browser acceptance runtime. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const { setup } = require('./assistant.browser.cjs');
const origin = process.env.ASSISTANT_TEST_URL || 'http://localhost:3100';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const { context, page, errors } = await setup(browser, { width: 1440, height: 900 }, true);
    const sibling = await context.newPage();
    sibling.on('pageerror', error => errors.push(error.message));
    await sibling.goto(origin + '/chat');
    await sibling.getByRole('button', { name: 'Talk to AbhiAI', exact: true }).waitFor();
    // Both tabs retain their own non-remembered token, so removing a shared
    // access-token key alone cannot sign them out.
    for (const tab of [page, sibling]) {
      await tab.evaluate(() => sessionStorage.setItem('abhiai.session-access-token', 'mock-jwt'));
    }
    await page.evaluate(() => localStorage.removeItem('abhiai.access-token'));
    // Model a completed logout while the sibling was busy: the event must be
    // honored even though its marker is already gone when the handler runs.
    await page.evaluate(() => {
      localStorage.setItem('abhiai.logout-pending', 'true');
      localStorage.removeItem('abhiai.logout-pending');
    });
    await sibling.getByRole('button', { name: 'Log in', exact: true }).waitFor();
    assert.equal(await sibling.evaluate(() => sessionStorage.getItem('abhiai.session-access-token')), null);
    assert.equal(await sibling.getByRole('button', { name: 'Open account menu', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks: ['non-remembered sibling session cleared after transient logout marker'] }));
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
