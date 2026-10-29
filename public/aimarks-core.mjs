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

/* C2PA soft-binding algorithm registry (c2pa-org/softbinding-algorithm-list, 57 entries, fetched 2026-10-29) */
export const SOFT_BINDINGS = {"com.digimarc.validate.1":["watermark","Digimarc Validate Digital Watermarking algorithm"],"org.atsc.a336":["watermark","ATSC watermarking (A/334, A/335, A/336)"],"io.iscc.v0":["fingerprint","ISO 24138 - International Standard Content Code (ISCC) V0 algorithm"],"com.adobe.trustmark.Q":["watermark","Adobe Trustmark variant Q"],"com.adobe.trustmark.C":["watermark","Adobe Trustmark variant C"],"com.adobe.icn.dense":["fingerprint","Adobe Image Comparator Network Dense Fingerprint"],"ai.steg.api":["watermark","Steg.AI invisible watermarking"],"ai.trufo.pawprint.watermark":["watermark","PawPrint neural watermarking for images, audio, and video. Imperceptib"],"ai.trufo.pawprint.fingerprint":["fingerprint","PawPrint neural fingerprinting for images, audio, and video. Generates"],"app.overlai.watermark.1":["watermark","Overlai Watermark version 1"],"tv.kinetiq.watercast.48.1":["watermark","Teletrax Watermarking algorithm"],"castLabs.watermark.1":["watermark","castLabs Single Frame Forensic Watermarking"],"com.adobe.trustmark.P":["watermark","Adobe Trustmark variant P"],"com.imatag.lamark.v1":["watermark","Imatag invisible watermarking for images"],"com.nagra.nexguard.watermark.1":["watermark","NAGRA NexGuard Watermarking with Single Frame Detection Capability"],"com.mentaport.watermark.1":["watermark","Mentaport Watermarking Engine"],"com.digicaps.fingerprint.1":["fingerprint","DigiCAP Fingerprint Engine"],"com.sonicorigin.watermark.1":["watermark","SonicOrigin Watermarking Engine"],"com.microsoft.invismark.1":["watermark","Microsoft Responsible AI InvisMark"],"com.microsoft.wavmark.1":["watermark","Microsoft Responsible AI WavMark"],"ai.contentlens.image.basewmk":["watermark","ContentLens Image Watermarking (Base)"],"ai.contentlens.image.ensemblewmk":["watermark","ContentLens Image Watermarking (Ensemble)"],"ai.contentlens.image.customwmk":["watermark","ContentLens Image Watermarking (Custom)"],"ai.contentlens.audio.mono":["watermark","ContentLens Audio Watermarking (Mono)"],"ai.contentlens.audio.stereo":["watermark","ContentLens Audio Watermarking (Stereo)"],"es.lumatrace":["watermark","Java-native Adaptive Spatial Watermarking using Blue-channel injection"],"com.markany.watermark.1":["watermark","MarkAny invisible watermarking with robustness against cropping, resiz"],"com.verimatrix.watermark.1":["watermark","Verimatrix watermarking algorithm: provides an essence-based forensic "],"com.writerslogic.zwc-watermark.1":["watermark","WritersLogic CPOP zero-width character (ZWC) watermark for text conten"],"com.aiwatermark.videoseal.1":["watermark","Neural video watermarking using Meta FAIR's VideoSeal model, providing"],"com.aiwatermark.pixelseal.1":["watermark","Neural image watermarking using Meta FAIR's PixelSeal model, providing"],"com.aiwatermark.audioseal.1":["watermark","Neural audio watermarking using Meta FAIR's AudioSeal model, providing"],"eu.sasha.softbinding.v1":["watermark","Invisible watermarking technology for image and video assets, enabling"],"ai.verda.watermark.image.1":["watermark","VerdaAI invisible image watermarking"],"ai.verda.watermark.video.1":["watermark","VerdaAI invisible video watermarking"],"ai.verda.watermark.audio.1":["watermark","VerdaAI invisible audio watermarking"],"com.evixar.eaw.1":["watermark","EAW (Evixar Audio Watermark) is an audible-range audio watermarking al"],"com.evixar.efp.type3.1":["fingerprint","EFP Type 3 (Evixar Finger Print Type 3) is an audio fingerprinting alg"],"com.cognitive-proof.vsrmark.1":["watermark","VSRMark hides a structured byte payload inside visible Unicode text by"],"me.deepmark.audio.vigil.128":["watermark","Vigil is a 128-bit-per-second neural audio watermarking algorithm deve"],"com.writerslogic.text-fingerprint.1":["fingerprint","WritersLogic CPoE robust text fingerprint. Computes a 256-bit SimHash "],"com.writerslogic.zwc-watermark.2":["watermark","Revision of com.writerslogic.zwc-watermark.1. Embeds an HMAC-SHA256 ro"],"com.writerslogic.text-structure.1":["fingerprint","WritersLogic CPoE structural text fingerprint. Computes a deterministi"],"com.writerslogic.text-minhash.1":["fingerprint","WritersLogic CPoE lexical MinHash text fingerprint for excerpt and quo"],"io.blockfact.audio.watermark.32":["watermark","BlockFact invisible watermarking for audio, image, and video provenanc"],"com.doverunner.watermark.1":["watermark","DoveRunner's forensic watermarking solution delivers invisible, tamper"],"com.writerslogic.text-watermark-semantic.1":["watermark","WritersLogic CPoE post-hoc semantic embedding watermark for paraphrase"],"com.joinmonolith.sha256":["fingerprint","Monolith SHA-256 content fingerprint for C2PA manifest recovery"],"com.museblossom.contentsdefence.1":["watermark","Contents Defence invisible image watermark, used to recover the associ"],"me.reconize.videoseal.1":["watermark","Reconize deployment of the VideoSeal invisible watermark (Meta AI open"],"io.diker.sigi.v1":["watermark","Sigi invisible watermarking engine by Okeanos B.V."],"com.adobe.hiermark.A":["watermark","Adobe Hierarchical Audio watermark (HierMark) variant A"],"com.adobe.flowmark.A":["watermark","Adobe FlowMark video watermarking variant A"],"be.immostory.videoseal.1":["watermark","ImmoStory AI deployment of Meta FAIR's Video Seal 1.0 invisible video "],"com.adobe.trustmark.F":["watermark","Adobe FiLMCAM Conditional Access Watermarking / Trustmark variant F"],"com.quatvision.quatmark.1":["watermark","QuatMark keyed invisible image watermark. The watermark carries a comp"],"studio.aidr.silentcipher.1":["watermark","AIDR Studio deployment of Sony Research's open SilentCipher 44.1 kHz a"]};
export const IPTC_DST = 'http://cv.iptc.org/newscodes/digitalsourcetype/';
export const DST_TERMS = ['trainedAlgorithmicMedia', 'compositeWithTrainedAlgorithmicMedia', 'trainedAlgorithmicData', 'algorithmicMedia',
  'compositeSynthetic', 'algorithmicallyEnhanced', 'digitalCapture', 'computationalCapture',
  'compositeCapture', 'screenCapture', 'virtualRecording', 'humanEdits', 'dataDrivenMedia'];
const AI_DST = /Algorithmic|Synthetic|dataDriven/;

/* Generator / model / vendor names that show which tools made a file (metadata context: matched as whole words). */
export const GENERATORS = ['OpenAI', 'DALL-E', 'DALL·E', 'ChatGPT', 'GPT-4o', 'gpt-image', 'Sora', 'Midjourney',
  'Stable Diffusion', 'StableDiffusion', 'SDXL', 'Stability AI', 'ComfyUI', 'AUTOMATIC1111', 'InvokeAI',
  'NovelAI', 'Fooocus', 'Forge', 'FLUX', 'Black Forest Labs', 'Imagen', 'Gemini', 'Google AI', 'Veo',
  'Nano Banana', 'SynthID', 'Firefly', 'Adobe Firefly', 'Leonardo', 'Ideogram', 'Runway', 'Pika', 'Kling',
  'Luma', 'Hailuo', 'MiniMax', 'Seedream', 'ByteDance', 'Grok', 'xAI', 'Aurora', 'Meta AI',
  'Imagine with Meta', 'Bing Image Creator', 'Microsoft Designer', 'Copilot', 'Canva', 'ElevenLabs',
  'Suno', 'Udio', 'Replicate', 'fal.ai', 'Together AI',
  'Recraft', 'HiDream', 'Qwen', 'Wan2', 'Hunyuan', 'Phoenix'];

/* Public-copy terms: well-known AI providers, models and AI hosting a visitor should not be told about (narrower
   than GENERATORS, so ordinary words like "Forge", "Aurora" or "Canva" in marketing copy don't flood the report).
   Deliberately generic: this file is public. A project's own private list is passed in as `extra` (aiscan.mjs reads
   it from ~/.bugledger-stack.json on the machine, never from the repo). */
export const STACK_TERMS = ['Black Forest Labs', 'FLUX.1', 'FLUX.2', 'flux-1', 'flux-2',
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

function scanText(s, where, out, inManifest = false) {
  if (!s) return;
  if (!inManifest) for (const t of DST_TERMS) if (s.includes(IPTC_DST + t) || new RegExp(`DigitalSourceType[^<>]{0,40}${t}`).test(s))
    out.push(finding('metadata', 'IPTC Digital Source Type', where, t, { disclosure: AI_DST.test(t) }));
  const hits = GEN_RE.filter(([, re]) => re.test(s)).map(([g]) => g);
  if (hits.length) out.push(finding('metadata', 'Generator / model name', where, [...new Set(hits)].join(', '), { leaksStack: true }));
  if (SD_PARAMS.test(s)) out.push(finding('metadata', 'Generation parameters (prompt, seed, sampler)', where, clip(s), { leaksStack: true }));
  else { /* the same parameters as JSON (Draw Things, Fooocus, InvokeAI…): two or more generation keys, one of them seed/steps/sampler */
    const keys = new Set([...s.matchAll(/"(seed|steps|sampler|sampler_name|cfg|cfg_scale|guidance_scale|scheduler|negative_prompt|denoising_strength)"\s*:/gi)].map(x => x[1].toLowerCase()));
    if (keys.size >= 2 && [...keys].some(k => /seed|steps|sampler/.test(k))) out.push(finding('metadata', 'Generation parameters (prompt, seed, sampler)', where, `JSON keys: ${[...keys].join(', ')}`, { leaksStack: true })); }
  if (/"class_type"\s*:/.test(s)) out.push(finding('metadata', 'ComfyUI workflow graph', where, 'node graph JSON', { leaksStack: true }));
  const fl = s.match(/AI generated;(txt2img|img2img)(?:;([\w.-]+))?/);   /* FLUX reference code: EXIF Software (black-forest-labs/flux util.py) */
  if (fl) out.push(finding('metadata', 'AI label in EXIF Software (FLUX reference code)', where, fl[0], { disclosure: true, leaksStack: true }));
  if (/sui_image_params/.test(s)) out.push(finding('metadata', 'SwarmUI generation parameters', where, 'sui_image_params JSON', { leaksStack: true }));
  if (/(?:^|[^A-Za-z])(?:prompt|workflow):\{"/.test(s)) out.push(finding('metadata', 'ComfyUI graph in EXIF (AVIF/WebP output)', where, 'prompt:/workflow: JSON', { leaksStack: true }));
  aigcLabels(s, where, out);
  if (/c2pa\.(created|edited|opened|actions|ingredient)|stds\.schema-org\.CreativeWork|c2pa\.claim/.test(s))
    out.push(finding('provenance', 'C2PA assertion text', where, clip([...new Set(s.match(/c2pa\.(?:actions(?:\.v2)?|claim(?:\.v2)?|created|edited|opened|ingredient|hash\.(?:data|bmff|boxes))/g) || [])].slice(0, 6).join(' ') || ''), { disclosure: true }));
  const rp = s.match(/dcterms:provenance[^>]{0,4}>?\s*["']?([^"'<\s]{6,200})/);
  if (rp) out.push(finding('provenance', 'Remote C2PA manifest pointer (dcterms:provenance)', where, rp[1], { disclosure: true, leaksStack: true }));
  const m = s.match(/(CreatorTool|Software|claim_generator|xmp:CreatorTool|photoshop:Credit)["'=>:\s]+([^"'<\n]{2,80})/);
  if (m) out.push(finding('metadata', 'Software / creator tool', where, `${m[1]} = ${m[2].trim()}`, { leaksStack: GEN_RE.some(([, re]) => re.test(m[2])) }));
}

/* China GB 45438-2025 implicit label: an "AIGC" JSON object (XMP namespace http://www.tc260.org.cn/ns/AIGC/1.0/,
   PNG chunk "AIGC", EXIF UserComment, container tags), sometimes base64 ("QUlHQz" = "AIGC"). Field names vary
   in vendor docs (ReserveCode1 / PropatorID), so keys are matched loosely. Label 1 = AI-generated, 2 = possibly, 3 = suspected. */
const AIGC_LABEL = { 1: 'AI-generated', 2: 'possibly AI-generated', 3: 'suspected AI-generated' };
function b64text(x) { try { const bin = atob(x.replace(/[^A-Za-z0-9+/=]/g, '')); let o = ''; for (let i = 0; i < bin.length; i++) o += bin[i]; return o; } catch { return ''; } }
function aigcLabels(s, where, out) {
  let text = s;
  for (const m of s.matchAll(/QUlHQz[A-Za-z0-9+/=]{10,4000}/g)) text += '\n' + b64text(m[0]);
  const seen = new Set();
  for (const m of text.matchAll(/AIGC["']?\s*[:=>]?\s*["']?\s*(\{)/g)) {   /* AIGC={…}, "AIGC":{…}, AIGC="{…}" or <x:AIGC>{…} */
    let depth = 0, end = -1; for (let i = m.index + m[0].length - 1; i < Math.min(text.length, m.index + 4000); i++) { const c = text[i]; if (c === '{') depth++; else if (c === '}' && --depth === 0) { end = i + 1; break; } }
    if (end < 0) continue;
    const raw = text.slice(m.index + m[0].length - 1, end).replace(/&quot;/g, '"');
    let j = null; try { j = JSON.parse(raw); } catch { continue; }
    if (j && j.AIGC && typeof j.AIGC === 'object') j = j.AIGC;
    const get = (re) => { for (const k of Object.keys(j || {})) if (re.test(k)) return String(j[k]); return ''; };
    const label = get(/^label$/i); if (!label && !get(/content\s*producer/i)) continue;
    const key = label + get(/produce\s*id/i); if (seen.has(key)) continue; seen.add(key);
    out.push(finding('provenance', 'China AIGC implicit label (GB 45438-2025)', where,
      [`Label ${label}${AIGC_LABEL[label] ? ' = ' + AIGC_LABEL[label] : ''}`, get(/content\s*producer/i) && `producer ${get(/content\s*producer/i)}`, get(/produce\s*id/i) && `id ${get(/produce\s*id/i).slice(0, 40)}`,
       get(/content\s*propagator/i) && `propagator ${get(/content\s*propagator/i)}`].filter(Boolean).join(' · '), { disclosure: true, leaksStack: !!get(/content\s*producer/i) }));
  }
  if (/www\.tc260\.org\.cn\/ns\/AIGC/.test(s) && !seen.size) out.push(finding('provenance', 'China AIGC implicit label (GB 45438-2025)', where, 'TC260 AIGC XMP namespace present', { disclosure: true }));
}

/* X.509 names in the COSE certificate chain: who signed the manifest (O= / CN=) */
function certNames(b) {
  const names = [];
  for (const oid of [[0x55, 0x04, 0x0A], [0x55, 0x04, 0x03]]) {
    let p = 0;
    while ((p = indexOf(b, Uint8Array.of(0x06, 0x03, ...oid), p)) >= 0) {
      const tag = b[p + 5], len = b[p + 6];
      if ([0x0C, 0x13, 0x14, 0x16, 0x1E].includes(tag) && len > 1 && len < 120) { const v = latin1(b, p + 7, p + 7 + len).replace(/[^ -~]/g, ''); if (v && !names.includes(v)) names.push(v); }
      p += 5;
    }
  }
  return names;
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
  const signers = certNames(buf).filter(n => !/^(Root|Intermediate|CA)$/i.test(n)).slice(0, 4);
  const sb = []; for (let i = txt.indexOf('c2pa.soft-binding'); i >= 0; i = txt.indexOf('c2pa.soft-binding', i + 1)) { const a = cbor('alg', i); if (a && !sb.includes(a)) sb.push(a); }
  const desc = cbor('description', txt.indexOf('c2pa.created') >= 0 ? txt.indexOf('c2pa.created') : 0);
  out.push(finding('provenance', 'C2PA manifest store (Content Credentials, JUMBF)', where,
    [gen && `claim generator: ${gen[1].replace(/[^ -~]/g, '').trim()}`, agent && `softwareAgent: ${agent}`,
     sdk && `signed with c2pa-rs ${sdk[1]}`, labels.length && `assertions: ${labels.join(' ')}`,
     dst && `digitalSourceType: ${dst}`, desc && /AI|generat/i.test(desc) && `action: ${desc}`, signers.length && `signed by: ${signers.join(' / ')}`].filter(Boolean).join(' · ') || 'manifest present',
    { disclosure: !!dst ? AI_DST.test(dst) : true, leaksStack: named(gen && gen[1]) || named(agent) }));
  if (dst && /Capture$/.test(dst)) out.push(finding('provenance', 'Camera capture provenance (C2PA)', where, `${dst}: says the picture was captured, not generated (forgeable on rooted phones; revocation is rarely checked)`));
  for (const a of sb) { const r = SOFT_BINDINGS[a]; out.push(finding('watermark', `Declared ${r ? r[0] : 'soft binding'} (C2PA soft binding)`, where, `${a}${r ? ' — ' + r[1] : ' (not in the C2PA registry)'}; declared in the manifest, not decoded here`, { disclosure: true, survives: true })); }
  if (signers.some(n => /Google|OpenAI|ElevenLabs|NVIDIA|Kakao/i.test(n))) out.push(finding('watermark', 'SynthID possible (cannot be checked locally)', where, `signed by ${signers.join(' / ')}: these makers also add SynthID, readable only at synthid.com or the maker's verify page; a missing result here proves nothing`));
  scanText(txt.replace(/[^\x20-\x7e\n]/g, ' '), where + ' (manifest text)', out, true); /* digitalSourceType there is part of the C2PA finding */
}

// ---------- containers ----------
const PNG_TOOLS = { parameters: 'A1111 / Forge', postprocessing: 'A1111 extras', prompt: 'ComfyUI', workflow: 'ComfyUI',
  invokeai_metadata: 'InvokeAI', invokeai_workflow: 'InvokeAI', invokeai_graph: 'InvokeAI', 'sd-metadata': 'InvokeAI (legacy)', Dream: 'InvokeAI (legacy)',
  fooocus_scheme: 'Fooocus', negative_prompt: 'Easy Diffusion', 'Negative Prompt': 'Easy Diffusion', AIGC: 'China AIGC label (GB 45438)' };
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
      const tool = PNG_TOOLS[key] || (key === 'Software' && /NovelAI/.test(val) ? 'NovelAI' : key === 'Comment' && /^\s*\{/.test(val) ? (/fooocus/i.test(val) ? 'Fooocus' : 'NovelAI / Fooocus') : null);
      out.push(finding('metadata', `PNG ${t} chunk${tool ? ' — ' + tool : ''}`, `PNG ${t} "${key}"`, clip(val), { leaksStack: !!tool || ['Comment', 'Software', 'Source'].includes(key) }));
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
/* C2PA 2.4 Annex A.8: U+FEFF, then bytes as variation selectors (0x00–0x0F → U+FE00–FE0F, 0x10–0xFF → U+E0100–E01EF):
   magic "C2PATXT\0", version 1, a big-endian u32 length, then the JUMBF manifest (wire format from dualeai/c2patxt) */
function decodeTextWrapper(w) {
  const bytes = []; for (const ch of [...w].slice(1)) { const c = ch.codePointAt(0); bytes.push(c <= 0xFE0F ? c - 0xFE00 : c - 0xE0100 + 16); }
  const b = Uint8Array.from(bytes), magic = latin1(b, 0, 8);
  if (magic !== 'C2PATXT\0') return null;
  const len = ((b[9] << 24) >>> 0) + (b[10] << 16) + (b[11] << 8) + b[12];
  return { version: b[8], length: len, jumbf: b.subarray(13, 13 + len) };
}
export function textFindings(s, where = 'text', out = []) {
  for (const w of s.match(C2PA_TEXT) || []) {
    const d = decodeTextWrapper(w);
    if (d) { const inner = []; scanC2PA(d.jumbf, where + ' (C2PA text wrapper)', inner);
      out.push(finding('provenance', 'C2PA text manifest (C2PA 2.4 Annex A.8)', where, `header C2PATXT v${d.version}, ${d.length}-byte manifest${inner[0] ? ' · ' + inner[0].detail : ''}`, { disclosure: true, survives: true }));
      out.push(...inner.slice(1)); }
    else out.push(finding('text', 'Long variation-selector run after U+FEFF (no C2PA header)', where, `${[...w].length - 1} selectors: could carry hidden data`, { survives: true }));
  }
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

export const MEDIA_EXT = /\.(png|jpe?g|webp|gif|avif|heic|heif|mp4|mov|m4v|m4a|mp3|wav|webm|pdf)$/i;
const TEXT_EXT = /\.(txt|md|html?|json|csv|rtf|srt|vtt)$/i;

/* PDF: Content Credentials for the PDF itself live in an embedded file of type application/c2pa (C2PA spec, PDF);
   a manifest inside an embedded JPEG belongs to that picture, not the document. XMP and the Info dictionary
   (Producer / Creator) can name the tool. */
function pdf(b, out) {
  const t = latin1(b);
  const docManifest = /\/Subtype\s*\/application#2Fc2pa|application\/c2pa|\/AFRelationship\s*\/C2PA_Manifest/.test(t);
  if (docManifest) { const i = indexOf(b, 'jumb'); scanC2PA(i >= 0 ? b.subarray(Math.max(0, i - 8)) : b, 'PDF embedded C2PA manifest (document)', out); }
  let imgs = 0; const ranges = [];
  for (let p = indexOf(b, Uint8Array.of(0xFF, 0xD8, 0xFF)); p >= 0 && imgs < 50; p = indexOf(b, Uint8Array.of(0xFF, 0xD8, 0xFF), p + 3)) {
    const end = indexOf(b, 'endstream', p); ranges.push([p, end < 0 ? b.length : end]);
    imgs++; const seg = b.subarray(p, Math.min(b.length, p + (1 << 20))), inner = [];
    jpeg(seg, inner);
    for (const f of inner) if (f.layer === 'provenance' || f.leaksStack || (f.term === 'IPTC Digital Source Type')) out.push({ ...f, where: `PDF embedded image ${imgs}: ${f.where}`, term: f.layer === 'provenance' ? f.term.replace('C2PA manifest store', 'C2PA manifest in an embedded image (not the PDF itself)') : f.term });
  }
  for (const m of t.matchAll(/<x:xmpmeta[\s\S]{0,20000}?<\/x:xmpmeta>/g)) { if (ranges.some(([a, z]) => m.index >= a && m.index < z)) continue; /* an embedded image's own XMP, counted above */ out.push(finding('metadata', 'XMP packet', 'PDF metadata stream', `${m[0].length} bytes`)); scanText(m[0], 'PDF XMP', out); }
  for (const m of t.matchAll(/\/(Producer|Creator)\s*\(([^)]{1,200})\)/g)) { out.push(finding('metadata', 'Software / creator tool', `PDF Info /${m[1]}`, m[2], { leaksStack: GEN_RE.some(([, re]) => re.test(m[2])) })); }
}

/* Some formats keep metadata where the box readers don't look (AVIF/HEIC EXIF items in mdat, MKV tags, odd
   chunks). A raw sweep looks ONLY for patterns that cannot occur by chance in compressed bytes — never bare names. */
function strongSweep(b, kind, out) {
  const span = b.length > (20 << 20) ? [latin1(b, 0, 16 << 20), latin1(b, b.length - (4 << 20))] : [latin1(b)];
  const have = (re) => out.some(f => re.test(f.term));
  for (const t of span) {
    const where = `${kind} (raw sweep)`;
    if (!have(/ComfyUI/) && /(?:^|[^A-Za-z])(?:prompt|workflow):\{"\d*"?/.test(t) && /"class_type"\s*:/.test(t)) out.push(finding('metadata', 'ComfyUI graph in EXIF (AVIF/WebP output)', where, 'prompt:/workflow: JSON with class_type nodes', { leaksStack: true }));
    if (!have(/SwarmUI/) && /sui_image_params/.test(t)) out.push(finding('metadata', 'SwarmUI generation parameters', where, 'sui_image_params JSON', { leaksStack: true }));
    if (!have(/AI label in EXIF Software/)) { const fl = t.match(/AI generated;(txt2img|img2img)(?:;[\w.-]+)?/); if (fl) out.push(finding('metadata', 'AI label in EXIF Software (FLUX reference code)', where, fl[0], { disclosure: true, leaksStack: true })); }
    if (!have(/China AIGC/) && /AIGC|QUlHQz/.test(t)) aigcLabels(t, where, out);   /* only reports a label that parses as JSON */
  }
}

export async function inspectBytes(u8, name = 'file', opts = {}) {
  const b = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8), out = [];
  let kind = 'unknown';
  if (b.length >= 12 && u32be(b, 0) === 0x89504E47) { kind = 'PNG'; await png(b, out); }
  else if (b[0] === 0xFF && b[1] === 0xD8) { kind = 'JPEG'; jpeg(b, out); }
  else if (latin1(b, 0, 4) === 'RIFF') { kind = latin1(b, 8, 12).trim(); riff(b, out); }
  else if (latin1(b, 4, 8) === 'ftyp') { kind = 'ISO BMFF (' + latin1(b, 8, 12).trim() + ')'; bmff(b, out); }
  else if (latin1(b, 0, 5) === '%PDF-') { kind = 'PDF'; pdf(b, out); }
  else if (latin1(b, 0, 3) === 'ID3') { kind = 'MP3'; scanText(latin1(b, 0, Math.min(b.length, 1 << 16)), 'ID3 tag', out); }
  else if (TEXT_EXT.test(name) || /\.svg$/i.test(name) || b.subarray(0, 4096).indexOf(0) < 0) {
    const t = utf8(b); kind = /<svg[\s>]/i.test(t.slice(0, 4000)) ? 'SVG' : 'text';
    if (kind === 'SVG') { for (const m of t.matchAll(/<c2pa:manifest[^>]*>([\s\S]*?)<\/c2pa:manifest>/gi)) { const bin = b64text(m[1]); scanC2PA(Uint8Array.from(bin, c => c.charCodeAt(0) & 255), 'SVG <c2pa:manifest>', out); }
      scanText(t, 'SVG metadata', out); }
    textFindings(t, 'text', out);
  }
  if (kind !== 'text' && !out.some(f => f.layer === 'provenance') && (indexOf(b, 'c2pa.claim') >= 0 || indexOf(b, 'c2pa.actions') >= 0)) scanC2PA(b, `${kind} (raw scan)`, out);
  if (kind !== 'text' && kind !== 'SVG') strongSweep(b, kind, out);
  if (opts.pixels && /^(PNG|JPEG|WEBP)/.test(kind)) {
    const { data, width, height } = opts.pixels;
    for (const m of imwmDetect(data, width, height)) if (m.agreement >= 0.9) out.push(finding('watermark', `Invisible watermark consistent with the ${m.name}`, 'pixels (U channel, Haar LL, 4×4 blocks)', `${Math.round(m.agreement * 100)}% of ${m.bits} bits agree (chance ≈ 50%)`, { disclosure: true, leaksStack: true, survives: false }));
    const st = await stealthDetect(data, width, height);
    if (st) { out.push(finding('metadata', `Stealth metadata in pixel low bits (${st.magic})`, `pixels (${st.mode} LSB)`, clip(st.payload || 'payload unreadable'), { leaksStack: true })); if (st.payload) scanText(st.payload, `stealth ${st.mode} payload`, out); }
  }
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

// ---------- Stable Diffusion / SDXL / FLUX invisible watermark (imwatermark dwtDct) ----------
// A line-for-line port of ShieldMnt/invisible-watermark maxDct.py decode(): OpenCV BGR→YUV, only the U channel
// (scales [0,36,36] with range(2)), Haar DWT LL band, 4×4 blocks; each block's largest non-DC |value| mod 36 > 18
// is a 1; bits repeat block by block and are averaged. Keyless. Measured with the reference library: reads
// untouched PNGs (93–100% on 2 of 3 photos), not JPEG q90 or resized copies — a miss proves nothing.
export const IMWM_MARKS = [
  { name: 'SDXL / diffusers reference watermark', bits: '101100111110110010010000011110111011000110011110' },
  { name: 'FLUX.1 reference watermark', bits: '1010101111111010000111100111001111010100101110' },
  { name: 'Stable Diffusion 1.x reference watermark', bits: Array.from('StableDiffusionV1', c => c.charCodeAt(0).toString(2).padStart(8, '0')).join('') },
];
function imwmBlocks(rgba, w, h) {
  const W = (w >> 2) << 2, H = (h >> 2) << 2, cw = W >> 1, ch = H >> 1;
  /* OpenCV's own 8-bit fixed-point BGR→YUV (coefficients × 2^14, round half up), so the U values match cv2 exactly */
  const u = (x, y) => { const i = (y * w + x) * 4, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], Y = (r * 4899 + g * 9617 + b * 1868 + 8192) >> 14;
    return Math.max(0, Math.min(255, ((b - Y) * 8061 + (128 << 14) + 8192) >> 14)); };
  const ll = new Float64Array(cw * ch);
  /* PyWavelets' Haar: filter √½ = 0.7071067811865476, rows (axis -2) first, then columns — in double precision, because
     √½·√½ = 0.5000000000000001 and flat areas land exactly on the mod-36 boundary, where that last bit decides */
  const hq = 0.7071067811865476;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const c0 = u(2 * x, 2 * y) * hq + u(2 * x, 2 * y + 1) * hq, c1 = u(2 * x + 1, 2 * y) * hq + u(2 * x + 1, 2 * y + 1) * hq;
    ll[y * cw + x] = c0 * hq + c1 * hq;
  }
  const scores = [];
  for (let by = 0; by < (ch >> 2); by++) for (let bx = 0; bx < (cw >> 2); bx++) {
    let best = -1, val = 0;
    for (let k = 1; k < 16; k++) { const v = ll[(by * 4 + (k >> 2)) * cw + bx * 4 + (k & 3)]; if (Math.abs(v) > best) { best = Math.abs(v); val = v; } }
    scores.push((Math.abs(val) % 36) > 18 ? 1 : 0);
  }
  return scores;
}
export function imwmDetect(rgba, w, h) {
  if (!rgba || w < 64 || h < 64) return [];
  const sc = imwmBlocks(rgba, w, h), out = [];
  for (const m of IMWM_MARKS) {
    const n = m.bits.length, sum = new Float64Array(n), cnt = new Float64Array(n);
    sc.forEach((v, i) => { sum[i % n] += v; cnt[i % n]++; });
    let agree = 0; for (let i = 0; i < n; i++) agree += ((sum[i] / (cnt[i] || 1)) * 255 > 127 ? '1' : '0') === m.bits[i] ? 1 : 0;
    out.push({ name: m.name, bits: n, agreement: agree / n });
  }
  return out;
}

// ---------- stealth pnginfo (NovelAI and the A1111 extension): metadata hidden in pixel low bits ----------
// Column-major (x outer, y inner), alpha LSBs or r,g,b LSBs; 15-byte magic, 32-bit bit length, then the payload
// (gzip for *comp). Order taken from ashen-sensored/sd_webui_stealth_pnginfo.
export async function stealthDetect(rgba, w, h) {
  if (!rgba || w * h < 160) return null;
  const read = (mode, nbits, skip = 0) => { const bits = []; let k = 0;
    for (let x = 0; x < w && bits.length < nbits; x++) for (let y = 0; y < h && bits.length < nbits; y++) { const i = (y * w + x) * 4;
      if (mode === 'alpha') { if (k++ >= skip) bits.push(rgba[i + 3] & 1); } else for (let c = 0; c < 3 && bits.length < nbits; c++) if (k++ >= skip) bits.push(rgba[i + c] & 1); }
    return bits; };
  const bytes = (bits) => { const o = new Uint8Array(bits.length >> 3); for (let i = 0; i < o.length; i++) for (let j = 0; j < 8; j++) o[i] = (o[i] << 1) | bits[i * 8 + j]; return o; };
  for (const mode of ['alpha', 'rgb']) {
    const magic = latin1(bytes(read(mode, 120)));
    if (!/^stealth_(png|rgb)(info|comp)$/.test(magic)) continue;
    const len = parseInt(read(mode, 32, 120).join(''), 2);
    let payload = '';
    if (len > 0 && len < 8e6) { const data = bytes(read(mode, len, 152));
      try { payload = /comp$/.test(magic) ? new TextDecoder().decode(new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())) : new TextDecoder().decode(data); } catch { payload = ''; } }
    return { magic, mode, payload };
  }
  return null;
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
