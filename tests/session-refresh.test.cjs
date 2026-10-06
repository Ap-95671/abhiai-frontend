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

test('logout is single-flight and immediately blocks renewal and stale authenticated requests', async () => {
  let release, logouts = 0, refreshes = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture(async url => {
    if (url === '/api/auth/logout') { logouts++; await gate; return json({}); }
    if (url === '/api/auth/refresh') refreshes++;
    return json({}, 401);
  });
  await f.restoreSession();
  const first = f.api.logout(), second = f.api.logout();
  assert.equal(first, second);
  await assert.rejects(f.api.getCurrentProfile('old-token'), e => e.status === 409);
  release(); await first;
  await assert.rejects(f.api.getCurrentProfile('old-token'), e => e.status === 401);
  assert.equal(await f.restoreSession(), null);
  assert.equal(logouts, 1); assert.equal(refreshes, 0);
});

test('logout does not wait for a pending refresh and the late token cannot restore auth', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture(async url => {
    if (url === '/api/auth/refresh') { await gate; return json({ accessToken: 'late-token' }); }
    return json({}, url === '/api/auth/logout' ? 200 : 401);
  });
  await f.restoreSession();
  const pending = f.api.getCurrentProfile('old-token');
  await tick(); await f.api.logout(); release();
  await assert.rejects(pending, e => e.status === 409);
  assert.equal(f.sessionAccessToken(), null);
  assert.equal(f.window.localStorage.getItem(f.TOKEN_STORAGE_KEY), null);
});

test('failed server revocation signs out locally, persists revocation intent, and permits retry', async () => {
  let unavailable = true;
  const f = fixture(async url => json({}, url === '/api/auth/logout' && unavailable ? 503 : 200));
  await f.restoreSession();
  await assert.rejects(f.api.logout(), e => e.status === 503);
  assert.equal(f.sessionAccessToken(), null);
  assert.equal(f.window.localStorage.getItem(f.LOGOUT_PENDING_STORAGE_KEY), 'true');
  unavailable = false; await f.api.logout(); assert.equal(f.sessionAccessToken(), null);
  assert.equal(f.window.localStorage.getItem(f.LOGOUT_PENDING_STORAGE_KEY), null);
});

test('login after logout creates a fresh session and repeated cycles clear both stores and user handoffs', async () => {
  const f = fixture(async url => json(url === '/api/auth/login' ? { accessToken: 'fresh-token' } : {}));
  await f.restoreSession();
  for (const remember of [true, false, true]) {
    await f.api.logout(); await f.api.login('qa@example.test', 'test-password', remember);
    assert.equal(f.sessionAccessToken(), 'fresh-token');
    f.window.localStorage.setItem('abhiai.active-conversation-id', 'private-chat');
    f.window.sessionStorage.setItem('abhiai.pending-news-prompt', 'old article');
    await f.api.logout();
    assert.equal(f.window.localStorage.getItem(f.TOKEN_STORAGE_KEY), null);
    assert.equal(f.window.sessionStorage.getItem(f.SESSION_TOKEN_STORAGE_KEY), null);
    assert.equal(f.window.localStorage.getItem('abhiai.active-conversation-id'), null);
    assert.equal(f.window.sessionStorage.getItem('abhiai.pending-news-prompt'), null);
  }
});

test('logout in another tab invalidates the in-memory token and prevents refresh', async () => {
  let calls = 0;
  const f = fixture(async () => { calls++; return json({ accessToken: 'unexpected' }); });
  await f.restoreSession(); f.window.localStorage.removeItem(f.TOKEN_STORAGE_KEY); f.syncStoredSession();
  assert.equal(f.sessionAccessToken(), null);
  await assert.rejects(f.api.getCurrentProfile('old-token'), e => e.status === 401);
  assert.equal(calls, 0);
});

test('reloading after failed logout retries revocation and never restores the remaining cookie', async () => {
  const actions = [];
  const f = fixture(async url => { actions.push(url); return json({}, 503); });
  f.window.localStorage.setItem(f.LOGOUT_PENDING_STORAGE_KEY, 'true');
  await assert.rejects(f.restoreSession(), e => e.status === 503);
  assert.deepEqual(actions, ['/api/auth/logout']);
  assert.equal(f.sessionAccessToken(), null);
  assert.equal(f.window.localStorage.getItem(f.TOKEN_STORAGE_KEY), null);
});
