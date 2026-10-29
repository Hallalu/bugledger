import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { inspectBytes, stackTerms, textFindings, wmDetect } from '../public/aimarks-core.mjs';
import { aiScanDir, asScanFindings } from '../aiscan.mjs';

const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
/* a real 2×2 PNG, optionally with text chunks */
function png(extra = []) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.from([0, 255, 0, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 255]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), ...extra, chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('A1111 prompt + seed in a PNG is found and flagged as naming the stack', async () => {
  const r = await inspectBytes(png([chunk('tEXt', Buffer.from('parameters\0a cat\nSteps: 20, Sampler: Euler a, Seed: 7, Model: sd_xl_base', 'latin1'))]), 'a.png');
  assert.ok(r.findings.some(f => /Generation parameters/.test(f.term)));
  assert.equal(r.summary.leaksStack, true);
  assert.equal(r.summary.disclosure, false);
});

test('compressed zTXt and ComfyUI graph are decoded', async () => {
  const z = Buffer.concat([Buffer.from('prompt\0\0', 'latin1'), zlib.deflateSync(Buffer.from('{"3":{"class_type":"KSampler"}}'))]);
  const r = await inspectBytes(png([chunk('zTXt', z)]), 'b.png');
  assert.ok(r.findings.some(f => f.term === 'ComfyUI workflow graph'));
});

test('IPTC trainedAlgorithmicMedia counts as an AI disclosure', async () => {
  const xmp = '<x:xmpmeta><Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia</Iptc4xmpExt:DigitalSourceType></x:xmpmeta>';
  const r = await inspectBytes(png([chunk('iTXt', Buffer.concat([Buffer.from('XML:com.adobe.xmp\0\0\0\0\0', 'latin1'), Buffer.from(xmp)]))]), 'c.png');
  assert.equal(r.summary.disclosure, true);
});

test('a clean PNG has no findings', async () => {
  const r = await inspectBytes(png(), 'clean.png');
  assert.equal(r.findings.length, 0);
});

test('whole-word matching: "Studio" is not "Udio", "Illuminate" is not "Luma"', async () => {
  const r = await inspectBytes(png([chunk('tEXt', Buffer.from('Title\0Mockup Studio, Illuminate your day', 'latin1'))]), 'd.png');
  assert.ok(!r.findings.some(f => f.term === 'Generator / model name'));
});

test('copy: stack names counted, competitor-free copy is clean', () => {
  assert.deepEqual(stackTerms('Runs FLUX.2 on Workers AI. Workers AI is fast.').map(t => t.term + t.count).sort(), ['FLUX.21', 'Workers AI2']);
  assert.equal(stackTerms('Beautiful pictures for your shop, made in seconds.').length, 0);
});

test('hidden characters flagged; C2PA text manifest kept as provenance; emoji selector ignored', () => {
  const vs = Array.from({ length: 10 }, (_, i) => String.fromCodePoint(0xE0100 + i)).join('');
  const f = textFindings('Hi​ there ❤️' + '﻿' + vs);
  assert.ok(f.some(x => x.term.startsWith('Invisible') && /ZERO WIDTH SPACE/.test(x.detail)));
  assert.ok(f.some(x => x.layer === 'provenance'));
  assert.ok(!f.some(x => /VARIATION SELECTOR/.test(x.detail)));
});

test('watermark detector finds nothing in plain noise (no false positive)', () => {
  let s = 12345; const g = new Uint8Array(256 * 256).map(() => { s = (s * 1103515245 + 12345) >>> 0; return 60 + (s >>> 24) % 120; });
  assert.equal(wmDetect(g).found, false);
});

test('repo scan: shipped AI image with a prompt → AI-MEDIA-STACK high; unshipped → review', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiscan-t-'));
  fs.mkdirSync(path.join(dir, 'public')); fs.mkdirSync(path.join(dir, 'fixtures'));
  const img = png([chunk('tEXt', Buffer.from('parameters\0a cat\nSteps: 20, Seed: 7', 'latin1'))]);
  fs.writeFileSync(path.join(dir, 'public', 'hero.png'), img); fs.writeFileSync(path.join(dir, 'fixtures', 'x.png'), img);
  fs.writeFileSync(path.join(dir, 'public', 'index.html'), '<p>Powered by Workers AI and FLUX.2</p>');
  const r = await aiScanDir(dir, { watermark: false });
  const by = (id, where) => r.hits.find(h => h.id === id && h.where === where);
  assert.equal(by('AI-MEDIA-STACK', 'public/hero.png').conf, 'high');
  assert.equal(by('AI-MEDIA-STACK', 'fixtures/x.png').conf, 'review');
  assert.equal(by('AI-MEDIA-NO-DISCLOSURE', 'public/hero.png').conf, 'high');
  assert.equal(by('AI-COPY-STACK', 'public/index.html').conf, 'high');
  assert.ok(asScanFindings(r.hits).every(f => f.detector && f.severity && f.bug && f.advice));
  fs.rmSync(dir, { recursive: true, force: true });
});
