/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest } = require('next/server');
function fixture(fetch) {
  const compiled = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/app/api/auth/[action]/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module: compiled, exports: compiled.exports, require, fetch, AbortSignal,
    process: { env: { NODE_ENV: 'production', NEXT_PUBLIC_API_BASE_URL: 'https://api.example/api/v1' } } });
  return (action, body = {}, origin = 'https://app.example', cookie = '') => compiled.exports.POST(
    new NextRequest(`https://app.example/api/auth/${action}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ action }) });
}
test('login keeps refresh token only in a secure HttpOnly same-site cookie', async () => {
  const post = fixture(async () => Response.json({ accessToken: 'access', tokenType: 'Bearer', expiresInSeconds: 900,
    refreshToken: 'secret-refresh', refreshExpiresInSeconds: 2592000 }));
  const response = await post('login', { email: 'test@example.com', password: 'test', rememberMe: true });
  assert.equal(response.status, 200); assert.equal((await response.json()).refreshToken, undefined);
  const cookie = response.headers.get('set-cookie');
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=lax', 'Path=/api/auth', 'Max-Age=2592000']) assert.ok(cookie.includes(flag));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const temporary = await post('login', { rememberMe: false });
  assert.ok(!temporary.headers.get('set-cookie').includes('Max-Age'));
});
test('refresh forwards only the cookie credential, not a caller-supplied token', async () => {
  let sent;
  const post = fixture(async (_, options) => { sent = JSON.parse(options.body); return Response.json({ accessToken: 'new', expiresInSeconds: 900 }); });
  const response = await post('refresh', { refreshToken: 'injected' }, undefined, 'abhiai.refresh-session=cookie-token');
  assert.equal(response.status, 200); assert.equal(sent.refreshToken, 'cookie-token');
});
test('cross-origin and missing-cookie requests never reach the backend', async () => {
  let calls = 0;
  const post = fixture(async () => { calls++; return Response.json({}); });
  assert.equal((await post('login', {}, 'https://evil.example')).status, 403);
  assert.equal((await post('refresh')).status, 401); assert.equal(calls, 0);
});
test('invalid refresh clears the cookie; transient failure preserves it', async () => {
  let status = 401;
  const post = fixture(async () => Response.json({}, { status }));
  const expired = await post('refresh', {}, undefined, 'abhiai.refresh-session=token');
  assert.match(expired.headers.get('set-cookie'), /Max-Age=0/);
  status = 503;
  assert.equal((await post('refresh', {}, undefined, 'abhiai.refresh-session=token')).headers.get('set-cookie'), null);
});
test('logout revokes server-side before removing the cookie', async () => {
  let sent;
  const post = fixture(async (url, options) => { sent = { url, ...JSON.parse(options.body) }; return new Response(null, { status: 204 }); });
  const response = await post('logout', {}, undefined, 'abhiai.refresh-session=token');
  assert.match(sent.url, /auth\/logout$/); assert.equal(sent.refreshToken, 'token');
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});
