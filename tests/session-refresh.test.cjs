/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function fixture(fetch, token = 'old-token') {
  const storage = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k) }; };
  const window = Object.assign(new EventTarget(), { localStorage: storage(), sessionStorage: storage() });
  if (token) window.localStorage.setItem('abhiai.access-token', token);
  const compiled = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/api.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module: compiled, exports: compiled.exports, process: { env: {} }, window, fetch,
    Headers, Response, Event, AbortSignal, AbortController, TextDecoder, FormData, console });
  return { ...compiled.exports, window };
}
const json = (body, status = 200) => Response.json(body, { status });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('simultaneous 401s share one renewal and every request retries with the new token', async () => {
  let refreshes = 0, retries = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture(async (url, options) => {
    if (url === '/api/auth/refresh') { refreshes++; await gate; return json({ accessToken: 'new-token' }); }
    if (options.headers.get('Authorization') === 'Bearer old-token') return json({}, 401);
    retries++; return json({ id: 'user' });
  });
  await f.restoreSession();
  const pending = Array.from({ length: 5 }, () => f.api.getCurrentProfile('old-token'));
  await tick(); assert.equal(refreshes, 1); release();
  await Promise.all(pending);
  assert.equal(retries, 5);
  assert.equal(f.window.localStorage.getItem(f.TOKEN_STORAGE_KEY), 'new-token');
});
test('a late old-token 401 reuses the completed renewal', async () => {
  let release, calls = 0, refreshes = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture(async (url, options) => {
    if (url === '/api/auth/refresh') { refreshes++; return json({ accessToken: 'new-token' }); }
    if (options.headers.get('Authorization') === 'Bearer old-token') {
      if (++calls === 2) await gate;
      return json({}, 401);
    }
    return json({ id: 'user' });
  });
  await f.restoreSession();
  const first = f.api.getCurrentProfile('old-token'), second = f.api.getCurrentProfile('old-token');
  await first; release(); await second; assert.equal(refreshes, 1);
});
test('invalid refresh credentials clear the session', async () => {
  const f = fixture(async () => json({}, 401));
  await f.restoreSession();
  await assert.rejects(f.api.getCurrentProfile('old-token'), e => e.status === 401);
  assert.equal(f.sessionAccessToken(), null);
  assert.equal(f.window.localStorage.getItem(f.TOKEN_STORAGE_KEY), null);
});
test('temporary refresh failure preserves credentials and later recovers', async () => {
  let unavailable = true;
  const f = fixture(async (url, options) => {
    if (url === '/api/auth/refresh') return unavailable ? json({}, 503) : json({ accessToken: 'new-token' });
    return options.headers.get('Authorization') === 'Bearer new-token' ? json({}) : json({}, 401);
  });
  await f.restoreSession();
  await assert.rejects(f.api.getCurrentProfile('old-token'), e => e.status === 503);
  assert.equal(f.window.localStorage.getItem(f.TOKEN_STORAGE_KEY), 'old-token');
  unavailable = false; await f.api.getCurrentProfile('old-token');
  assert.equal(f.sessionAccessToken(), 'new-token');
});
test('manual reload restores the cookie session without a stored access token', async () => {
  const f = fixture(async () => json({ accessToken: 'restored-token' }), null);
  assert.equal(await f.restoreSession(), 'restored-token');
  assert.equal(f.window.sessionStorage.getItem(f.SESSION_TOKEN_STORAGE_KEY), 'restored-token');
});
test('cancelled request does not retry after shared renewal', async () => {
  const controller = new AbortController(); let calls = 0;
  const f = fixture(async url => {
    if (url === '/api/auth/refresh') { controller.abort(); return json({ accessToken: 'new-token' }); }
    calls++; return json({}, 401);
  });
  await f.restoreSession();
  await assert.rejects(f.api.sendMessageStream('old-token', 'chat', 'hi', () => {}, controller.signal), e => e.name === 'AbortError');
  assert.equal(calls, 1); assert.equal(f.sessionAccessToken(), 'new-token');
});
test('multipart retry preserves the body and content type negotiation', async () => {
  const requests = [];
  const f = fixture(async (url, options) => {
    if (url === '/api/auth/refresh') return json({ accessToken: 'new-token' });
    requests.push(options); return json({ id: 'media' }, requests.length === 1 ? 401 : 200);
  });
  await f.restoreSession(); await f.api.uploadAttachment('old-token', new Blob(['hello']));
  assert.equal(requests.length, 2); assert.equal(requests[0].body, requests[1].body);
  assert.equal(requests[1].headers.has('Content-Type'), false);
});
test('session cleared during renewal cannot be resurrected', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const f = fixture(async url => {
    if (url === '/api/auth/refresh') { await gate; return json({ accessToken: 'new-token' }); }
    return json({}, 401);
  });
  await f.restoreSession(); const pending = f.api.getCurrentProfile('old-token');
  await tick(); f.clearSession(); release();
  await assert.rejects(pending, e => e.status === 409); assert.equal(f.sessionAccessToken(), null);
});
test('unauthorized retry terminates without a refresh loop', async () => {
  let refreshes = 0;
  const f = fixture(async url => {
    if (url === '/api/auth/refresh') { refreshes++; return json({ accessToken: 'new-token' }); }
    return json({}, 401);
  });
  await f.restoreSession(); await assert.rejects(f.api.getCurrentProfile('old-token'), e => e.status === 401);
  assert.equal(refreshes, 1); assert.equal(f.sessionAccessToken(), null);
});
