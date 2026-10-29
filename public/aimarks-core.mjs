/* aimarks-core — the AI-footprint engine shared by the Bug Ledger scanner (aiscan.mjs, scan.mjs) and the
   /aiscan web page, so the command line and the browser always agree (the same arrangement as sanitize.js).

   inspectBytes(u8, name, { gray }) → { name, kind, bytes, findings[] }
     Reads the traces generative AI leaves in a file: C2PA Content Credentials (JPEG APP11, PNG caBX, MP4/MOV/HEIC
     uuid box, WebP/WAV RIFF, sidecars), IPTC Digital Source Type, generator chunks (A1111 "parameters", ComfyUI
     graphs, NovelAI, EXIF UserComment), creator-tool fields, GPS, encoder/vendor tags, and hidden Unicode in text
     (incl. the C2PA 2.3 variation-selector text manifest, which is provenance, not junk).
     Pass `gray` (256×256 brightness, area-downscaled) to also read Pixelbake's invisible watermark (PBWM v1).
   stackTerms(text) → AI providers / models / hosting named in public copy (the confidentiality rule).

   Plain ES module, byte arrays only — no Node Buffer, no dependencies. Latent watermarks other than Pixelbake's
   (SynthID, Video Seal, TrustMark, SD DWT-DCT) live in pixels or samples and need their vendor's detector. */

export const IPTC_DST = 'http://cv.iptc.org/newscodes/digitalsourcetype/';
export const DST_TERMS = ['trainedAlgorithmicMedia', 'compositeWithTrainedAlgorithmicMedia', 'algorithmicMedia',
  'compositeSynthetic', 'algorithmicallyEnhanced', 'digitalCapture', 'computationalCapture',
  'compositeCapture', 'screenCapture', 'virtualRecording', 'humanEdits', 'dataDrivenMedia'];
const AI_DST = /Algorithmic|Synthetic|dataDriven/;

/* Generator / model / vendor names that show which tools made a file (metadata context: matched as whole words). */
export const GENERATORS = ['OpenAI', 'DALL-E', 'DALL·E', 'ChatGPT', 'GPT-4o', 'gpt-image', 'Sora', 'Midjourney',
  'Stable Diffusion', 'StableDiffusion', 'SDXL', 'Stability AI', 'ComfyUI', 'AUTOMATIC1111', 'InvokeAI',
  'NovelAI', 'Fooocus', 'Forge', 'FLUX', 'Black Forest Labs', 'Imagen', 'Gemini', 'Google AI', 'Veo',
  'Nano Banana', 'SynthID', 'Firefly', 'Adobe Firefly', 'Leonardo', 'Ideogram', 'Runway', 'Pika', 'Kling',
  'Luma', 'Hailuo', 'MiniMax', 'Seedance', 'Seedream', 'ByteDance', 'Grok', 'xAI', 'Aurora', 'Meta AI',
  'Imagine with Meta', 'Bing Image Creator', 'Microsoft Designer', 'Copilot', 'Canva', 'ElevenLabs',
  'Suno', 'Udio', 'Workers AI', 'Cloudflare', '@cf/', 'Replicate', 'fal.ai', 'Together AI',
  'Recraft', 'HiDream', 'Qwen', 'Wan2', 'Hunyuan', 'Phoenix'];

/* Public-copy terms: well-known AI providers, models and AI hosting a visitor should not be told about (narrower
   than GENERATORS, so ordinary words like "Forge", "Aurora" or "Canva" in marketing copy don't flood the report).
   Deliberately generic: this file is public. A project's own private list is passed in as `extra` (aiscan.mjs reads
   it from ~/.bugledger-stack.json on the machine, never from the repo). */
export const STACK_TERMS = ['Workers AI', '@cf/', 'AI Gateway', 'Black Forest Labs', 'FLUX.1', 'FLUX.2', 'flux-1', 'flux-2',
  'Stability AI', 'Stable Diffusion', 'SDXL', 'Leonardo.Ai', 'ByteDance', 'Seedream', 'MiniMax', 'Hailuo', 'Kling', 'Runway',
  'ElevenLabs', 'OpenAI', 'gpt-image', 'GPT-4', 'GPT-5', 'Anthropic', 'Claude Opus', 'Claude Sonnet', 'Claude Haiku',
  'Llama', 'Gemini', 'Qwen', 'Mistral', 'Grok', 'xAI', 'Replicate', 'fal.ai', 'Together AI', 'Midjourney'];
const SD_PARAMS = /\b(Steps|Sampler|CFG scale|Seed|Model hash|Negative prompt|denoising|scheduler)\s*:/i;

/* Invisible / look-alike Unicode. Flagged, never assumed to be a watermark. */
const HIDDEN = {
  0x200B: 'ZERO WIDTH SPACE', 0x200C: 'ZERO WIDTH NON-JOINER', 0x200D: 'ZERO WIDTH JOINER',
  0x2060: 'WORD JOINER', 0xFEFF: 'ZERO WIDTH NO-BREAK SPACE / BOM', 0x00AD: 'SOFT HYPHEN',
  0x202F: 'NARROW NO-BREAK SPACE', 0x00A0: 'NO-BREAK SPACE', 0x2007: 'FIGURE SPACE', 0x2009: 'THIN SPACE',
  0x200A: 'HAIR SPACE', 0x2061: 'FUNCTION APPLICATION', 0x2062: 'INVISIBLE TIMES', 0x2063: 'INVISIBLE SEPARATOR',
  0x2064: 'INVISIBLE PLUS', 0x180E: 'MONGOLIAN VOWEL SEPARATOR', 0x034F: 'COMBINING GRAPHEME JOINER',
  0x200E: 'LEFT-TO-RIGHT MARK', 0x200F: 'RIGHT-TO-LEFT MARK', 0x202A: 'LRE', 0x202B: 'RLE', 0x202C: 'PDF',
  0x202D: 'LRO', 0x202E: 'RLO', 0x2066: 'LRI', 0x2067: 'RLI', 0x2068: 'FSI', 0x2069: 'PDI',
};
const isTag = cp => cp >= 0xE0000 && cp <= 0xE007F;
const isVariation = cp => (cp >= 0xFE00 && cp <= 0xFE0F) || (cp >= 0xE0100 && cp <= 0xE01EF);

// ---------- bytes ----------
const u32be = (b, o) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const u16be = (b, o) => (b[o] << 8) | b[o + 1];
const u32le = (b, o) => b[o] + (b[o + 1] << 8) + (b[o + 2] << 16) + ((b[o + 3] << 24) >>> 0);
function latin1(b, a = 0, z = b.length) { let s = ''; for (let i = a; i < z; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, Math.min(z, i + 8192))); return s; }
const utf8 = (b, a = 0, z = b.length) => new TextDecoder('utf-8').decode(b.subarray(a, z));
function indexOf(b, needle, from = 0) {
  const n = typeof needle === 'string' ? Uint8Array.from(needle, c => c.charCodeAt(0) & 255) : needle;
  outer: for (let i = Math.max(0, from); i <= b.length - n.length; i++) { if (b[i] !== n[0]) continue; for (let j = 1; j < n.length; j++) if (b[i + j] !== n[j]) continue outer; return i; }
  return -1;
}
async function inflate(u8) { const ds = new DecompressionStream('deflate'); const w = ds.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(ds.readable).arrayBuffer()); }

// ---------- findings ----------
function finding(layer, term, where, detail, opts = {}) {
  return { layer, term, where, detail, leaksStack: !!opts.leaksStack, disclosure: !!opts.disclosure, privacy: !!opts.privacy, survivesReencode: opts.survives ?? false };
}
const clip = s => (s.length > 140 ? s.slice(0, 140) + '…' : s).replace(/\s+/g, ' ');
const esc = (g) => g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (g) => new RegExp(`(^|[^A-Za-z0-9])${esc(g)}($|[^A-Za-z0-9])`, 'i');
let GEN_RE = GENERATORS.map(g => [g, wordRe(g)]);
let STACK_RE = STACK_TERMS.map(g => [g, wordRe(g)]);
/* Add a project's private terms (models, providers, hosting it uses) to both lists, for this process only. */
export function addTerms(extra = []) {
  const clean = [...new Set(extra.map(String).filter(t => t.length > 1))];
  GEN_RE = [...GEN_RE, ...clean.filter(t => !GEN_RE.some(([g]) => g === t)).map(g => [g, wordRe(g)])];
  STACK_RE = [...STACK_RE, ...clean.filter(t => !STACK_RE.some(([g]) => g === t)).map(g => [g, wordRe(g)])];
}

/* Names of AI providers / models / hosting found in a piece of public copy, with counts. */
export function stackTerms(text) {
  const out = [];
  for (const [g, re] of STACK_RE) { const all = new RegExp(re.source, 'gi'); const n = (String(text).match(all) || []).length; if (n) out.push({ term: g, count: n }); }
  return out;
}

function scanText(s, where, out) {
  if (!s) return;
  for (const t of DST_TERMS) if (s.includes(IPTC_DST + t) || new RegExp(`DigitalSourceType[^<>]{0,40}${t}`).test(s))
    out.push(finding('metadata', 'IPTC Digital Source Type', where, t, { disclosure: AI_DST.test(t) }));
  const hits = GEN_RE.filter(([, re]) => re.test(s)).map(([g]) => g);
  if (hits.length) out.push(finding('metadata', 'Generator / model name', where, [...new Set(hits)].join(', '), { leaksStack: true }));
  if (SD_PARAMS.test(s)) out.push(finding('metadata', 'Generation parameters (prompt, seed, sampler)', where, clip(s), { leaksStack: true }));
  if (/"class_type"\s*:/.test(s)) out.push(finding('metadata', 'ComfyUI workflow graph', where, 'node graph JSON', { leaksStack: true }));
  if (/c2pa\.(created|edited|opened|actions|ingredient)|stds\.schema-org\.CreativeWork|c2pa\.claim/.test(s))
    out.push(finding('provenance', 'C2PA assertion text', where, clip([...new Set(s.match(/c2pa\.(?:actions(?:\.v2)?|claim(?:\.v2)?|created|edited|opened|ingredient|hash\.(?:data|bmff|boxes))/g) || [])].slice(0, 6).join(' ') || ''), { disclosure: true }));
  const rp = s.match(/dcterms:provenance[^>]{0,4}>?\s*["']?([^"'<\s]{6,200})/);
  if (rp) out.push(finding('provenance', 'Remote C2PA manifest pointer (dcterms:provenance)', where, rp[1], { disclosure: true, leaksStack: true }));
  const m = s.match(/(CreatorTool|Software|claim_generator|xmp:CreatorTool|photoshop:Credit)["'=>:\s]+([^"'<\n]{2,80})/);
  if (m) out.push(finding('metadata', 'Software / creator tool', where, `${m[1]} = ${m[2].trim()}`, { leaksStack: GEN_RE.some(([, re]) => re.test(m[2])) }));
}

function exifComment(d) {        /* EXIF UserComment with the UNICODE prefix is UTF-16 (A1111 writes prompts here) */
  const i = indexOf(d, 'UNICODE\0'); if (i < 0) return '';
  const raw = d.subarray(i + 8, Math.min(d.length, i + 8 + 65536)), n = raw.length & ~1, le = raw[0] !== 0 && raw[1] === 0;
  let s = ''; for (let k = 0; k < n; k += 2) { const c = le ? raw[k] | (raw[k + 1] << 8) : (raw[k] << 8) | raw[k + 1]; if (!c) break; s += String.fromCharCode(c); }
  return s;
}

function scanC2PA(buf, where, out) {
  if (indexOf(buf, 'c2pa') < 0 && indexOf(buf, 'jumb') < 0) return;
  const txt = latin1(buf);
  /* C2PA 2.x stores claims as CBOR: a key is followed by a text-string header byte (0x60+len, or 0x78 len) */
  const cbor = (key, from = 0) => { const k = txt.indexOf(key, from); if (k < 0) return null; let p = k + key.length;
    const h = txt.charCodeAt(p); let n = h - 0x60; p++; if (h === 0x78) { n = txt.charCodeAt(p); p++; }
    return n > 0 && n < 200 ? txt.slice(p, p + n) : null; };
  const cgi = txt.indexOf('claim_generator_info');
  const genName = cgi >= 0 ? cbor('name', cgi) : null;
  const gen = genName ? [null, genName] : txt.match(/claim_generator[^A-Za-z]{0,8}([ -~]{3,80})/);
  const sa = txt.indexOf('softwareAgent'), agent = sa < 0 ? null : (txt.charCodeAt(sa + 13) & 0xe0) === 0xa0 ? cbor('name', sa) : cbor('softwareAgent');
  const sdk = txt.match(/org\.contentauth\.c2pa_rs.?([0-9.]+)/);
  const C2PA_LABELS = /c2pa\.(?:actions(?:\.v2)?|hash\.(?:bmff(?:\.v[23])?|data|boxes|collection\.data)|claim(?:\.v2)?|signature|ingredient(?:\.v[23])?|thumbnail\.(?:claim|ingredient)(?:\.[a-z]+)?|soft-binding|cloud-data|training-mining|metadata|created|edited|opened|placed|converted|transcoded|published|watermarked|color_adjustments|cropped|resized|creative_work|asset-ref)/g;
  const labels = [...new Set(txt.match(C2PA_LABELS) || [])].slice(0, 12);
  const dst = DST_TERMS.find(t => txt.includes(t));
  const named = (s) => !!s && GEN_RE.some(([, re]) => re.test(s));
  out.push(finding('provenance', 'C2PA manifest store (Content Credentials, JUMBF)', where,
    [gen && `claim generator: ${gen[1].replace(/[^ -~]/g, '').trim()}`, agent && `softwareAgent: ${agent}`,
     sdk && `signed with c2pa-rs ${sdk[1]}`, labels.length && `assertions: ${labels.join(' ')}`,
     dst && `digitalSourceType: ${dst}`].filter(Boolean).join(' · ') || 'manifest present',
    { disclosure: !!dst ? AI_DST.test(dst) : true, leaksStack: named(gen && gen[1]) || named(agent) }));
  scanText(txt.replace(/[^\x20-\x7e\n]/g, ' '), where + ' (manifest text)', out);
}

// ---------- containers ----------
async function png(b, out) {
  let o = 8;
  while (o + 8 <= b.length) {
    const n = u32be(b, o), t = latin1(b, o + 4, o + 8), d = b.subarray(o + 8, o + 8 + n);
    if (t === 'tEXt' || t === 'zTXt' || t === 'iTXt') {
      const k = d.indexOf(0), key = latin1(d, 0, k);
      let val = '';
      try {
        if (t === 'tEXt') val = latin1(d, k + 1);
        else if (t === 'zTXt') val = latin1(await inflate(d.subarray(k + 2)));
        else { const comp = d[k + 1]; let p = k + 3; p = d.indexOf(0, p) + 1; p = d.indexOf(0, p) + 1; val = comp ? utf8(await inflate(d.subarray(p))) : utf8(d, p); }
      } catch { val = ''; }
      out.push(finding('metadata', `PNG ${t} chunk`, `PNG ${t} "${key}"`, clip(val), { leaksStack: ['parameters', 'prompt', 'workflow', 'Comment', 'Software', 'Source'].includes(key) }));
      scanText(val, `PNG ${t} "${key}"`, out);
    } else if (t === 'caBX') scanC2PA(d, 'PNG caBX chunk', out);
    else if (t === 'eXIf') { out.push(finding('metadata', 'EXIF block', 'PNG eXIf chunk', `${n} bytes`)); scanText(latin1(d), 'PNG eXIf', out); }
    else if (t === 'tIME') out.push(finding('metadata', 'Last-modified time', 'PNG tIME chunk', `${u16be(d, 0)}-${d[2]}-${d[3]} ${d[4]}:${d[5]}`));
    else if (t === 'iCCP') out.push(finding('metadata', 'ICC colour profile name', 'PNG iCCP chunk', latin1(d, 0, d.indexOf(0))));
    o += 12 + n;
    if (t === 'IEND') break;
  }
}
function jpeg(b, out) {
  let o = 2;
  while (o + 4 <= b.length && b[o] === 0xFF) {
    const m = b[o + 1];
    if (m === 0xD9 || m === 0xDA) break;
    const n = u16be(b, o + 2), d = b.subarray(o + 4, o + 2 + n), head = latin1(d, 0, Math.min(40, d.length));
    if (m === 0xE1 && head.startsWith('Exif')) {
      out.push(finding('metadata', 'EXIF block', 'JPEG APP1 Exif', `${n} bytes`)); scanText(latin1(d), 'JPEG APP1 Exif', out);
      const uc = exifComment(d); if (uc) { out.push(finding('metadata', 'EXIF UserComment', 'JPEG APP1 Exif', clip(uc))); scanText(uc, 'EXIF UserComment', out); }
      if (indexOf(d, Uint8Array.of(0x88, 0x25)) > 0 || indexOf(d, Uint8Array.of(0x25, 0x88)) > 0) out.push(finding('metadata', 'GPS IFD (location)', 'JPEG APP1 Exif', 'GPS tag present', { privacy: true }));
    }
    else if (m === 0xE1 && head.startsWith('http://ns.adobe.com/xap')) { out.push(finding('metadata', 'XMP packet', 'JPEG APP1 XMP', `${n} bytes`)); scanText(utf8(d), 'JPEG APP1 XMP', out); }
    else if (m === 0xEB) scanC2PA(d, 'JPEG APP11 (JUMBF)', out);
    else if (m === 0xED) { out.push(finding('metadata', 'IPTC-IIM / Photoshop IRB', 'JPEG APP13', `${n} bytes`)); scanText(latin1(d), 'JPEG APP13', out); }
    else if (m === 0xFE) { const c = latin1(d); out.push(finding('metadata', 'JPEG comment', 'JPEG COM', clip(c))); scanText(c, 'JPEG COM', out); }
    else if (m === 0xE2 && head.startsWith('ICC_PROFILE')) out.push(finding('metadata', 'ICC colour profile', 'JPEG APP2', `${n} bytes`));
    o += 2 + n;
  }
}
function riff(b, out) {
  let o = 12;
  while (o + 8 <= b.length) {
    const t = latin1(b, o, o + 4), n = u32le(b, o + 4), d = b.subarray(o + 8, o + 8 + n);
    if (t === 'EXIF') { out.push(finding('metadata', 'EXIF block', 'RIFF EXIF chunk', `${n} bytes`)); scanText(latin1(d), 'RIFF EXIF', out); const uc = exifComment(d); if (uc) scanText(uc, 'EXIF UserComment', out); }
    else if (t === 'XMP ') { out.push(finding('metadata', 'XMP packet', 'RIFF XMP chunk', `${n} bytes`)); scanText(utf8(d), 'RIFF XMP', out); }
    else if (t === 'C2PA') scanC2PA(d, 'RIFF C2PA chunk', out);
    else if (t === 'LIST' || t === 'id3 ' || t === 'ID3 ') scanText(latin1(d), `RIFF ${t}`, out);
    o += 8 + n + (n & 1);
  }
}
function bmff(b, out, base = 0, end = b.length, depth = 0) {
  const CONTAINERS = new Set(['moov', 'udta', 'meta', 'trak', 'mdia', 'minf', 'ilst', 'iprp', 'ipco']);
  let o = base;
  while (o + 8 <= end) {
    let n = u32be(b, o); const t = latin1(b, o + 4, o + 8); let h = 8;
    if (n === 1) { n = u32be(b, o + 8) * 4294967296 + u32be(b, o + 12); h = 16; } else if (n === 0) n = end - o;
    if (n < h || o + n > end) break;
    const d = b.subarray(o + h, o + n);
    if (t === 'uuid' && indexOf(d, 'c2pa') >= 0 && indexOf(d, 'c2pa') < 64) scanC2PA(d, 'BMFF uuid box (C2PA)', out);
    else if (t === 'jumb') scanC2PA(d, 'BMFF jumb box', out);
    else if (t === 'uuid' || t === 'XMP_' || t === 'Xtra') scanText(latin1(d, 0, Math.min(d.length, 1 << 16)), `BMFF ${t} box`, out);
    else if (/^(\xa9too|\xa9swr|\xa9cmt|\xa9nam|\xa9ART|\xa9des|desc|ldes|keys|\xa9enc)$/.test(t) || (t === 'data' && depth > 2)) {
      const v = latin1(d, 0, Math.min(d.length, 4096)).replace(/[^\x20-\x7e]/g, '').replace(/^data/, '');
      if (v.length > 2) { out.push(finding('metadata', /^Signature:/.test(v) ? 'Vendor signature tag (outside C2PA)' : /^Lavf/.test(v) ? 'Encoder (FFmpeg libavformat)' : 'Media tag', `BMFF ${t.replace('\xa9', '©')} box`, clip(v), { leaksStack: /^Signature:/.test(v) })); scanText(v, `BMFF ${t.replace('\xa9', '©')}`, out); }
    }
    if (CONTAINERS.has(t)) bmff(b, out, o + h + (t === 'meta' && latin1(b, o + h + 4, o + h + 8) !== 'hdlr' ? 4 : 0), o + n, depth + 1);
    o += n;
  }
}

const C2PA_TEXT = /\uFEFF(?:[\uFE00-\uFE0F]|\uDB40[\uDD00-\uDDEF]){8,}/g;   /* C2PA 2.3 C2PATextManifestWrapper */
export function textFindings(s, where = 'text', out = []) {
  for (const w of s.match(C2PA_TEXT) || []) out.push(finding('provenance', 'C2PA text manifest (variation-selector wrapper, C2PA 2.3)', where,
    `${[...w].length - 1} selectors after U+FEFF: a signed provenance manifest, not stray characters`, { disclosure: true, survives: true }));
  s = s.replace(C2PA_TEXT, '');
  const counts = new Map(); let prev = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0), after = prev; prev = cp;
    if ((cp === 0xFE0F || cp === 0xFE0E) && after > 0x2000) continue;
    const name = HIDDEN[cp] || (isTag(cp) && 'UNICODE TAG CHARACTER') || (isVariation(cp) && 'VARIATION SELECTOR');
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  for (const [name, c] of counts) {
    const covert = /TAG|VARIATION|ZERO WIDTH|WORD JOINER|INVISIBLE|R?L[OE]|PD[FI]|[LRF]SI/.test(name);
    out.push(finding('text', covert ? 'Invisible character (can carry hidden data)' : 'Typographic space (formatting, not a watermark)', where, `${name} × ${c}`, { survives: true }));
  }
  return out;
}

export const MEDIA_EXT = /\.(png|jpe?g|webp|gif|avif|heic|heif|mp4|mov|m4v|m4a|mp3|wav|webm)$/i;
const TEXT_EXT = /\.(txt|md|html?|json|csv|rtf|srt|vtt)$/i;

export async function inspectBytes(u8, name = 'file', opts = {}) {
  const b = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8), out = [];
  let kind = 'unknown';
  if (b.length >= 12 && u32be(b, 0) === 0x89504E47) { kind = 'PNG'; await png(b, out); }
  else if (b[0] === 0xFF && b[1] === 0xD8) { kind = 'JPEG'; jpeg(b, out); }
  else if (latin1(b, 0, 4) === 'RIFF') { kind = latin1(b, 8, 12).trim(); riff(b, out); }
  else if (latin1(b, 4, 8) === 'ftyp') { kind = 'ISO BMFF (' + latin1(b, 8, 12).trim() + ')'; bmff(b, out); }
  else if (latin1(b, 0, 3) === 'ID3') { kind = 'MP3'; scanText(latin1(b, 0, Math.min(b.length, 1 << 16)), 'ID3 tag', out); }
  else if (TEXT_EXT.test(name) || b.subarray(0, 4096).indexOf(0) < 0) { kind = 'text'; textFindings(utf8(b), 'text', out); }
  if (kind !== 'text' && !out.some(f => f.layer === 'provenance') && (indexOf(b, 'c2pa.claim') >= 0 || indexOf(b, 'c2pa.actions') >= 0)) scanC2PA(b, `${kind} (raw scan)`, out);
  if (opts.gray && /^(PNG|JPEG|WEBP)/.test(kind)) {
    const r = wmDetect(opts.gray);
    if (r.found) out.push(finding('watermark', 'Pixelbake invisible watermark (PBWM v1)', 'pixels', `${WM_LABEL[r.type] || r.type} · id hash ${r.idHash} · strength ${r.strength}`, { disclosure: true, survives: true }));
  }
  if (opts.sidecar) scanC2PA(opts.sidecar instanceof Uint8Array ? opts.sidecar : new Uint8Array(opts.sidecar), 'sidecar .c2pa file', out);
  const seen = new Set(); const findings = out.filter(f => { const k = f.term + f.where + f.detail; return !seen.has(k) && seen.add(k); });
  return { name, kind, bytes: b.length, findings, summary: summarise(findings) };
}
export function summarise(f) {
  return { disclosure: f.some(x => x.disclosure), leaksStack: f.some(x => x.leaksStack), privacy: f.some(x => x.privacy),
    generatorEvidence: f.some(x => x.leaksStack || /Generation parameters|ComfyUI|Generator/.test(x.term)) };
}

// ---------- Pixelbake invisible watermark (PBWM v1) — same maths as Pixelbake src/provenance.js ----------
export const WM_N = 256;
const WM_BITS = 48, WM_LABEL = { created: 'Created with AI', composite: 'Edited with AI', enhanced: 'Enhanced by an algorithm' };
let WM_P = null;
function wmPatterns() { if (WM_P) return WM_P; WM_P = new Int8Array(WM_BITS * WM_N * WM_N); let s = 0x9e3779b9 ^ 0x50425731; for (let i = 0; i < WM_P.length; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; WM_P[i] = (s >>> 0) & 1 ? 1 : -1; } return WM_P; }
function crc16(bits) { let c = 0xffff; for (const b of bits) { const top = (c >> 15) & 1; c = (c << 1) & 0xffff; if (top ^ b) c ^= 0x1021; } return c; }
export function wmDetect(gray) {
  const N = WM_N, NN = N * N, P = wmPatterns(), r = new Float32Array(NN), a = new Float32Array(NN);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0, k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy < 0 || xx < 0 || yy >= N || xx >= N) continue; s += gray[yy * N + xx]; k++; } r[y * N + x] = gray[y * N + x] - s / k; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0, k = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xx = x + dx; if (yy < 0 || xx < 0 || yy >= N || xx >= N) continue; s += r[yy * N + xx] ** 2; k++; } a[y * N + x] = r[y * N + x] / (Math.sqrt(s / k) + 0.5); }
  let m = 0; for (const v of a) m += v; m /= NN; let sd = 0; for (let i = 0; i < NN; i++) { a[i] -= m; sd += a[i] * a[i]; } sd = Math.sqrt(sd / NN) || 1;
  const z = new Float32Array(WM_BITS); for (let b = 0; b < WM_BITS; b++) { let s = 0; const o = b * NN; for (let i = 0; i < NN; i++) s += a[i] * P[o + i]; z[b] = s / (sd * Math.sqrt(NN)); }
  const strength = z.reduce((t, v) => t + Math.abs(v), 0) / WM_BITS, hard = Array.from(z, v => (v > 0 ? 1 : 0));
  const weak = Array.from(z.keys()).sort((i, j) => Math.abs(z[i]) - Math.abs(z[j])).slice(0, 6), valOf = (bs, o, n) => bs.slice(o, o + n).reduce((v, b) => (v << 1) | b, 0) >>> 0;
  const ok = (bs) => valOf(bs, 0, 4) === 0xb && crc16(bs.slice(0, 32)) === valOf(bs, 32, 16);
  let bits = ok(hard) ? hard : null;
  if (!bits && strength >= 1.4) outer: for (let i = 0; i < 6; i++) { const t = hard.slice(); t[weak[i]] ^= 1; if (ok(t)) { bits = t; break; } for (let j = i + 1; j < 6; j++) { const u = t.slice(); u[weak[j]] ^= 1; if (ok(u)) { bits = u; break outer; } } }
  const found = !!bits && strength >= 1.4;
  return { found, type: found ? ['', 'created', 'composite', 'enhanced'][valOf(bits, 4, 2)] || 'unknown' : null, idHash: found ? valOf(bits, 6, 26).toString(16).padStart(7, '0') : null, strength: +strength.toFixed(2) };
}
