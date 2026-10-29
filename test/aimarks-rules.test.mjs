import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectBytes, textFindings, stealthDetect, imwmDetect, IMWM_MARKS, SOFT_BINDINGS } from '../public/aimarks-core.mjs';

const enc = (s) => new TextEncoder().encode(s);
const terms = async (bytes, name) => (await inspectBytes(bytes, name)).findings.map(f => `${f.term} | ${f.detail}`).join('\n');
/* labels live inside files: wrap a payload in a real (minimal) JPEG comment segment */
const jpegWith = (payload) => { const p = enc(payload), n = p.length + 2; return Uint8Array.from([0xFF, 0xD8, 0xFF, 0xFE, n >> 8, n & 255, ...p, 0xFF, 0xD9]); };
const AIGC = { AIGC: { Label: '1', ContentProducer: 'ACME', ProduceID: 'p-1', ReservedCode1: 'x', ContentPropagator: '', PropagateID: '', ReservedCode2: '' } };

test('China AIGC label: XMP element, XMP attribute, base64 and a bare chunk value', async () => {
  const el = `<rdf:Description xmlns:TC260="http://www.tc260.org.cn/ns/AIGC/1.0/"><TC260:AIGC>${JSON.stringify(AIGC)}</TC260:AIGC></rdf:Description>`;
  const at = `<rdf:Description xmlns:TC260="http://www.tc260.org.cn/ns/AIGC/1.0/" TC260:AIGC="${JSON.stringify(AIGC).replace(/"/g, '&quot;')}"/>`;
  const b64 = 'UserComment ' + Buffer.from('AIGC:' + JSON.stringify(AIGC.AIGC)).toString('base64');
  for (const s of [el, at, b64]) assert.match(await terms(jpegWith(s), 'x.jpg'), /China AIGC implicit label[^\n]*Label 1 = AI-generated/);
});

test('FLUX reference EXIF label and JSON generation parameters', async () => {
  assert.match(await terms(jpegWith('AI generated;img2img;flux'), 'a.jpg'), /AI label in EXIF Software/);
  assert.match(await terms(jpegWith('{"c":"a fox","seed":7,"sampler":"Euler","steps":20}'), 'b.jpg'), /Generation parameters/);
  assert.doesNotMatch(await terms(jpegWith('{"seed":7,"title":"a fox"}'), 'c.jpg'), /Generation parameters/);   /* one key is not enough */
});

test('C2PA text wrapper: only a real C2PATXT header counts as provenance', () => {
  const vs = (bytes) => '﻿' + [...bytes].map(x => String.fromCodePoint(x < 16 ? 0xFE00 + x : 0xE0100 + x - 16)).join('');
  const junk = textFindings('hi' + vs(new Uint8Array(40).fill(7)));
  assert.ok(junk.some(f => /no C2PA header/.test(f.term)) && !junk.some(f => f.layer === 'provenance'));
  const hdr = new Uint8Array([...enc('C2PATXT\0'), 1, 0, 0, 0, 4, 1, 2, 3, 4]);
  assert.ok(textFindings('hi' + vs(hdr)).some(f => /Annex A\.8/.test(f.term)));
});

test('stealth pnginfo is read from alpha low bits in column order', async () => {
  const w = 40, h = 40, rgba = new Uint8Array(w * h * 4).fill(200), payload = enc('{"prompt":"a croissant","steps":28}');
  const bits = [...enc('stealth_pnginfo')].flatMap(b => [...b.toString(2).padStart(8, '0')].map(Number))
    .concat([...(payload.length * 8).toString(2).padStart(32, '0')].map(Number)).concat([...payload].flatMap(b => [...b.toString(2).padStart(8, '0')].map(Number)));
  let i = 0; for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { if (i >= bits.length) break; const p = (y * w + x) * 4 + 3; rgba[p] = (rgba[p] & 0xFE) | bits[i++]; }
  const st = await stealthDetect(rgba, w, h);
  assert.equal(st.magic, 'stealth_pnginfo'); assert.match(st.payload, /croissant/);
  assert.equal(await stealthDetect(new Uint8Array(w * h * 4).fill(200), w, h), null);
});

test('SD / SDXL / FLUX watermark: random noise never reaches the 90% bar', () => {
  let s = 99; const w = 512, h = 512, rgba = new Uint8Array(w * h * 4).map(() => { s = (s * 1103515245 + 12345) >>> 0; return s >>> 24; });
  const r = imwmDetect(rgba, w, h);
  assert.deepEqual(r.map(x => x.bits), [48, 46, 136]);
  assert.ok(r.every(x => x.agreement < 0.9));
  assert.equal(IMWM_MARKS[1].bits.length, 46);   /* FLUX: bin() drops two leading zeros */
});

test('soft-binding registry is embedded', () => {
  assert.ok(Object.keys(SOFT_BINDINGS).length >= 57);
  assert.equal(SOFT_BINDINGS['com.adobe.trustmark.Q'][0], 'watermark');
});

test('controls stay clean: emoji selectors, narrow spaces, ordinary titles', async () => {
  const t = await inspectBytes(enc('Love it ❤️ see you at 10 am. Mockup Studio, Illuminate your day.'), 'note.txt');
  assert.ok(!t.findings.some(f => f.disclosure || f.leaksStack || f.layer === 'provenance' || /Invisible character/.test(f.term)));
});
