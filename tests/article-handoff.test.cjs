/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compiled = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/news.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: compiled, exports: compiled.exports });
const { buildNewsChatPrompt } = compiled.exports;
test('each article handoff includes only the selected article and its source', () => {
  for (const id of ['A', 'B', 'A']) {
    const prompt = buildNewsChatPrompt({ id, title: `Story ${id}`, description: `Facts for ${id}`, sourceName: `Publisher ${id}`, publishedAt: '2026-10-05', articleUrl: `https://example.test/${id}` });
    for (const expected of [`Article ID: ${id}`, `Story ${id}`, `Facts for ${id}`, `Publisher ${id}`, `https://example.test/${id}`]) assert.ok(prompt.includes(expected));
    assert.ok(!prompt.includes(`Story ${id === 'A' ? 'B' : 'A'}`));
  }
});
test('missing optional metadata is explicit and excessive metadata fits the message contract', () => {
  const missing = buildNewsChatPrompt({ id: 'short', title: 'Short article' });
  assert.ok(missing.includes('Not provided by the publisher')); assert.ok(!/undefined|null/.test(missing));
  const long = buildNewsChatPrompt(Object.fromEntries(['id', 'title', 'description', 'sourceName', 'publishedAt', 'articleUrl'].map(k => [k, 'x'.repeat(50000)])));
  assert.ok(long.length <= 10000); assert.ok(long.includes('[truncated]')); assert.ok(long.includes('Original article:'));
});
