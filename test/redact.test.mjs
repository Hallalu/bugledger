import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRedactor, redactPublic } from '../src/redact.mjs';

const r = makeRedactor(['Pruna', 'Inworld', 'MakeHuman']);

test('models, providers and infrastructure become category placeholders', () => {
  assert.equal(r('Upscale runs on Workers AI with FLUX.2 klein and bills via AI Gateway'),
    'Upscale runs on [AI platform] with [image model] and bills via [billing gateway]');
  assert.equal(r('Swap uses Pruna P-Video; voices from Inworld'), 'Swap uses [model provider] [video model]; voices from [speech model]');
  assert.equal(r('rows live in D1, files in R2'), 'rows live in [database], files in [file storage]');
  assert.equal(r('the MakeHuman body'), 'the [3D body library] body');
});

test('model ids and links that name the stack are removed', () => {
  assert.equal(r('call @cf/black-forest-labs/flux-2-dev now'), 'call [model id] now');
  assert.equal(r('pinned claude-haiku-5-5 and gpt-4o-mini'), 'pinned [model id] and [model id]');
  assert.equal(r('see https://developers.cloudflare.com/workers-ai/models/ for limits'), 'see [link removed] for limits');
});

test('leaves ordinary words, the coding assistant and unrelated links alone', () => {
  const keep = 'Claude Code fixed the Studio page; submittedBy claude-code; R2D2 and ID r2-cache stay; https://example.com/guide';
  assert.equal(r(keep), keep);
  assert.equal(r('Illuminate the forge in a gemini-free way'), 'Illuminate the forge in a gemini-free way'.replace('gemini-free', '[model id]'));
});

test('JSON stays valid after redaction', () => {
  const j = JSON.stringify([{ title: 'Whisper on Workers AI drops words', fix: 'use @cf/openai/whisper-large-v3-turbo', file: 'src/a.js:3' }]);
  const out = JSON.parse(r(j));
  assert.equal(out[0].title, '[speech model] on [AI platform] drops words');
  assert.equal(out[0].fix, 'use [model id]');
});

test('Worker: public reads are rewritten, owner routes and writes are not', async () => {
  const env = { STACK_TERMS: '["Pruna"]' };
  const res = () => new Response(JSON.stringify({ t: 'Pruna on Workers AI' }), { headers: { 'content-type': 'application/json' } });
  const get = (p, m = 'GET') => new Request('https://x.dev' + p, { method: m });
  assert.match(await (await redactPublic(get('/api/bugs'), env, res())).text(), /\[model provider\] on \[AI platform\]/);
  assert.match(await (await redactPublic(get('/story/abc'), env, res())).text(), /\[AI platform\]/);
  assert.match(await (await redactPublic(get('/api/admin/recurrence'), env, res())).text(), /Pruna on Workers AI/);
  assert.match(await (await redactPublic(get('/api/bugs', 'POST'), env, res())).text(), /Pruna on Workers AI/);
  const img = new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } });
  assert.equal((await redactPublic(get('/api/shot/k'), env, img)).headers.get('content-type'), 'image/png');
});

test('provider names inside env var names are caught', () => {
  assert.equal(r('stored as ANTHROPIC_API_KEY with a space; GEMINI_MODEL overrode it'), 'stored as [model provider]_API_KEY with a space; [language model]_MODEL overrode it');
});

test('Claude Code config paths are kept', () => {
  assert.equal(r('read the home ~/.claude/launch.json, not .claude/settings.json'), 'read the home ~/.claude/launch.json, not .claude/settings.json');
});
