/* eslint-disable @typescript-eslint/no-require-imports -- Exercise production TS using the existing Node test approach. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function fixture(events) {
  const calls = [];
  const compiledModule = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/api.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module: compiledModule, exports: compiledModule.exports, process: { env: {} }, TextDecoder, AbortController, console,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return new Response(events, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });
  return { api: compiledModule.exports.api, calls };
}
const exchange = {
  userMessage: { id: 'u', content: 'latest AI developments today', role: 'USER' },
  assistantMessage: { id: 'a', content: 'Current facts', role: 'ASSISTANT', citations: [{
    title: 'Source', url: 'https://example.com/news', domain: 'example.com',
    description: 'Retrieved facts', sourceDate: '2026-10-02', retrievedAt: '2026-10-02T10:00:00Z',
  }] },
  conversation: { id: 'chat' },
};
const successEvents = `event:chunk\ndata:Current facts\n\nevent:complete\ndata:${JSON.stringify(exchange)}\n\n`;

test('existing manual Web Search flag reaches the backend through real stream serialization', async () => {
  const { api, calls } = fixture(successEvents);
  const chunks = [];
  const result = await api.sendMessageStream('test-token', 'chat', 'Explain merge sort', c => chunks.push(c), undefined, { webSearchAllowed: true });
  assert.equal(JSON.parse(calls[0].options.body).webSearchAllowed, true);
  assert.match(calls[0].url, /conversations\/chat\/messages\/stream$/);
  assert.deepEqual(chunks, ['Current facts']);
  assert.equal(result.assistantMessage.citations[0].sourceDate, '2026-10-02');
  assert.equal(result.assistantMessage.citations[0].retrievedAt, '2026-10-02T10:00:00Z');
});
test('ordinary requests leave automatic freshness decisions to the backend', async () => {
  const { api, calls } = fixture(successEvents);
  await api.sendMessageStream('test-token', 'chat', 'latest AI developments today', () => {});
  const request = JSON.parse(calls[0].options.body);
  assert.equal(request.webSearchAllowed, false);
  assert.equal(request.content, 'latest AI developments today');
  assert.equal(request.executionStrategy, undefined);
});
test('search error SSE is surfaced and cannot become a fabricated successful answer', async () => {
  const { api } = fixture('event:error\ndata:{"message":"Current information could not be verified."}\n\n');
  const chunks = [];
  await assert.rejects(api.sendMessageStream('test-token', 'chat', 'latest news', c => chunks.push(c)), /could not be verified/);
  assert.deepEqual(chunks, []);
});
