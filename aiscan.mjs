#!/usr/bin/env node
/*
 Bug Ledger — AI-footprint scanner + site scraper.
 Finds the traces generative AI leaves in what a project ships, and the places it gives away the stack:
 C2PA Content Credentials, IPTC Digital Source Type, generator chunks (A1111 prompts, ComfyUI graphs),
 creator-tool and encoder tags, GPS, hidden Unicode, Pixelbake's invisible watermark, and AI providers /
 models / hosting named in public copy. Same engine as the /aiscan web page (public/aimarks-core.mjs).

 Usage:
   node ~/BugLedger/aiscan.mjs [dir]                   scan a repo (default: current directory)
   node ~/BugLedger/aiscan.mjs --url https://site      scrape a live site: its pages, every image, its scripts
        [--pages 8] [--max 80]                         pages to follow (same origin) · media files to fetch
        [--paths /app.js,/AGENTS.md]                   also fetch these files directly (served to anyone who asks)
   options: --app "Name"  --json  --log (append new findings to the ledger)  --story (narrate on the live session)

 Detectors (each lands in the ledger once per project, file list included):
   AI-MEDIA-STACK          security   shipped media names a generator/model/provider, or carries its prompt/seed/workflow
   AI-MEDIA-NO-DISCLOSURE  optimiser  media with generator evidence but no machine-readable AI flag (EU AI Act Art 50)
   MEDIA-PRIVACY-GPS       security   shipped media carries GPS location
   AI-COPY-STACK           security   public copy names AI providers, models or hosting (confidentiality rule)
   AI-COPY-HIDDEN-CHARS    security   invisible / tag / bidi characters in public copy (C2PA text manifests excepted)

 Polite by design: one request at a time, a real User-Agent, page and file caps, and it stops on 403/429.
 Reads only — never edits the project. Findings are leads to verify, like scan.mjs.
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { inspectBytes, stackTerms, textFindings, addTerms, MEDIA_EXT, WM_N } from './public/aimarks-core.mjs';

/* Private stack terms (the models, providers and hosting YOUR apps use) live on this machine only, in
   ~/.bugledger-stack.json = {"terms":["…"]} — never in this repo (it is public) or the public engine. */
try { addTerms(JSON.parse(fs.readFileSync(path.join(os.homedir(), '.bugledger-stack.json'), 'utf8')).terms || []); } catch {}

const LEDGER = path.dirname(fileURLToPath(import.meta.url));
const UA = 'BugLedger-aiscan/1.0 (+https://bugledger.coconvo.workers.dev/aiscan)';
const SKIP_DIR = /(^|\/)(node_modules|\.git|\.wrangler|\.next|\.cache|\.venv|venv|__pycache__|\.bake|coverage)(\/|$)/;
const SHIPPED_DIR = /(^|\/)(public|dist|build|static|www|site|out|assets|docs)(\/|$)/;
const PUBLIC_TEXT = /\.(html?|md|txt|js|mjs|json|svg|xml|webmanifest)$/i;
const MAX_FILE = 40 << 20;

export const AI_DETECTORS = {
  'AI-MEDIA-STACK': { sev: 'high', cat: 'security', kind: 'security', bug: 'Shipped media names the AI generator, model or provider (or carries its prompt/seed/workflow)',
    advice: 'Re-export the file without that metadata (keep an AI flag: IPTC DigitalSourceType or your own signed C2PA manifest). Backend and model names are confidential.' },
  'AI-MEDIA-NO-DISCLOSURE': { sev: 'medium', cat: 'integrity', kind: 'optimiser', bug: 'AI-made media without a machine-readable AI disclosure',
    advice: 'Add IPTC Iptc4xmpExt:DigitalSourceType = trainedAlgorithmicMedia (and ideally a signed C2PA manifest + watermark). EU AI Act Art 50(2) applies from 2 Aug 2026; Google Merchant requires the IPTC tag.' },
  'MEDIA-PRIVACY-GPS': { sev: 'medium', cat: 'security', kind: 'security', bug: 'Shipped media carries GPS location in EXIF',
    advice: 'Strip EXIF GPS before shipping (re-encode or exiftool -gps:all=).' },
  'AI-COPY-STACK': { sev: 'medium', cat: 'security', kind: 'security', bug: 'Public copy names AI providers, models or hosting',
    advice: 'Describe what the product does, not which models or hosting power it. Move model ids server-side; keep attribution out of visitor-facing text.' },
  'AI-COPY-HIDDEN-CHARS': { sev: 'low', cat: 'security', kind: 'security', bug: 'Invisible / tag / bidi characters in public copy',
    advice: 'Strip with the Bug Ledger sanitizer (/sanitize). Tag and bidi characters can smuggle hidden instructions; C2PA text manifests are kept.' },
};

// ---------- helpers ----------
let FF; const hasFfmpeg = () => FF ?? (FF = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })());
function grayOf(file) {
  if (!hasFfmpeg()) return null;
  try { const g = new Uint8Array(execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-i', file, '-vf', `scale=${WM_N}:${WM_N}:flags=area,format=gray`, '-frames:v', '1', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 21, stdio: ['ignore', 'pipe', 'ignore'] })); return g.length === WM_N * WM_N ? g : null; } catch { return null; }
}
/* full-resolution RGBA for the pixel rules (SD/SDXL/FLUX watermark, stealth pnginfo); capped at 16 MP */
function pixelsOf(file) {
  if (!hasFfmpeg()) return null;
  try { const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split(',').map(Number);
    if (!(w * h) || w * h > 16e6) return null;
    const data = new Uint8Array(execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: w * h * 4 + 1024, stdio: ['ignore', 'pipe', 'ignore'] }));
    return data.length === w * h * 4 ? { width: w, height: h, data } : null; } catch { return null; }
}
const stillImage = (name) => /\.(png|jpe?g|webp)$/i.test(name) || /^(PNG|JPEG|WEBP)/.test(name);
function walk(dir, out = []) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.test(p + '/') && !e.name.startsWith('.')) walk(p, out); }
    else if (e.isFile()) out.push(p);
  }
  return out;
}
const visibleText = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<(meta|img)\b[^>]*\b(content|alt|title)=["']([^"']*)["'][^>]*>/gi, ' $3 ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

/* Turn one inspected media file into detector hits. */
function mediaHits(where, res, shipped) {
  const hits = [], f = res.findings, s = res.summary;
  const stack = f.filter(x => x.leaksStack);
  if (stack.length) hits.push({ id: 'AI-MEDIA-STACK', where, detail: stack.map(x => `${x.term}: ${x.detail}`).join(' | ').slice(0, 300), conf: shipped ? 'high' : 'review' });
  if (s.generatorEvidence && !s.disclosure) hits.push({ id: 'AI-MEDIA-NO-DISCLOSURE', where, detail: 'generator evidence, no IPTC AI tag / C2PA / watermark', conf: shipped ? 'high' : 'review' });
  if (s.privacy && shipped) hits.push({ id: 'MEDIA-PRIVACY-GPS', where, detail: 'EXIF GPS IFD present', conf: 'high' });
  return hits;
}
function copyHits(where, text, confidence) {
  const hits = [], terms = stackTerms(text);
  if (terms.length) hits.push({ id: 'AI-COPY-STACK', where, detail: terms.map(t => `${t.term}×${t.count}`).join(', '), conf: confidence });
  const hidden = textFindings(text, where).filter(x => x.layer === 'text' && /Invisible/.test(x.term));
  if (hidden.length) hits.push({ id: 'AI-COPY-HIDDEN-CHARS', where, detail: hidden.map(x => x.detail).join(', '), conf: confidence });
  return hits;
}

// ---------- repo scan ----------
export async function aiScanDir(dir, opts = {}) {
  const files = walk(dir), hits = [], stats = { media: 0, withDisclosure: 0, namingStack: 0, publicText: 0, watermarked: 0 };
  for (const fp of files) {
    const rel = path.relative(dir, fp), shipped = SHIPPED_DIR.test(rel);
    let size; try { size = fs.statSync(fp).size; } catch { continue; }
    if (size > MAX_FILE || size === 0) continue;
    if (MEDIA_EXT.test(fp)) {
      stats.media++;
      const still = opts.watermark !== false && stillImage(fp) && size < (30 << 20);
      const res = await inspectBytes(fs.readFileSync(fp), rel, { gray: still ? grayOf(fp) : null, pixels: still ? pixelsOf(fp) : null });
      if (res.summary.disclosure) stats.withDisclosure++; if (res.summary.leaksStack) stats.namingStack++; if (res.findings.some(x => /Pixelbake invisible watermark/.test(x.term))) stats.watermarked++; if (res.findings.some(x => /Invisible watermark consistent|Declared watermark|Stealth metadata/.test(x.term))) stats.otherMarks = (stats.otherMarks || 0) + 1;
      hits.push(...mediaHits(rel, res, shipped));
    } else if ((shipped && PUBLIC_TEXT.test(fp)) || /^(README|readme)\.md$|^llms\.txt$/.test(rel)) {
      const repoDoc = !shipped; /* a root README is read on the forge, not on the site: a lead, not a finding */
      if (size > (2 << 20)) continue;
      const raw = fs.readFileSync(fp, 'utf8'); if (raw.includes('\0')) continue;
      if (/\.min\.js$|(^|\/)(vendor|chunk)[.-]/.test(rel)) continue;
      stats.publicText++;
      const isCode = /\.(m?js|json)$/i.test(fp);
      hits.push(...copyHits(rel, /\.html?$/i.test(fp) ? visibleText(raw) : raw, isCode || repoDoc ? 'review' : 'high'));
    }
  }
  return { target: dir, files: files.length, stats, hits };
}

// ---------- live site scrape ----------
export async function aiScanUrl(start, opts = {}) {
  const pagesMax = opts.pages ?? 8, mediaMax = opts.max ?? 80, origin = new URL(start).origin;
  const hits = [], stats = { pages: 0, media: 0, withDisclosure: 0, namingStack: 0, watermarked: 0, scripts: 0, stopped: null };
  const queue = [start], seenPage = new Set(), seenMedia = new Set(), scripts = new Set(), extra = (opts.paths || []).map(p => new URL(p, origin).href);
  /* media URLs written anywhere (inline JSON, JS-built pages, CSS url()) — sites that draw their pictures with
     JavaScript have few <img> tags in the HTML */
  const MEDIA_URL = /(?:https?:)?\/\/[^\s"'()<>]+?\.(?:png|jpe?g|webp|gif|avif|mp4|webm)(?:\?[^\s"'()<>]*)?|(?<=["'(])\/[^\s"'()<>]+?\.(?:png|jpe?g|webp|gif|avif|mp4|webm)(?:\?[^\s"'()<>]*)?/gi;
  const harvest = (text, base) => { for (const m of text.matchAll(MEDIA_URL)) { try { const x = new URL(m[0].startsWith('//') ? 'https:' + m[0] : m[0], base); if (/^https?:$/.test(x.protocol)) seenMedia.add(x.href); } catch {} } };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiscan-'));
  const get = async (url) => {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000);
    try { return await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow', signal: ctl.signal }); } finally { clearTimeout(t); }
  };
  try {
    while (queue.length && stats.pages < pagesMax && !stats.stopped) {
      const url = queue.shift(); if (seenPage.has(url)) continue; seenPage.add(url);
      let r; try { r = await get(url); } catch { continue; }
      if (r.status === 429 || r.status === 403) { stats.stopped = `${r.status} at ${url}`; break; }
      if (!r.ok || !/text\/html/.test(r.headers.get('content-type') || '')) continue;
      const html = await r.text(); stats.pages++;
      const page = new URL(r.url);
      const xp = r.headers.get('x-powered-by'); if (xp) hits.push(...copyHits(`${page.pathname} (x-powered-by header)`, xp, 'high'));
      const gen = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i); if (gen) hits.push(...copyHits(`${page.pathname} (meta generator)`, gen[1], 'high'));
      hits.push(...copyHits(page.pathname + ' (visible text)', visibleText(html), 'high'));
      const abs = (u) => { try { const x = new URL(u.replace(/&amp;/g, '&'), page); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
      for (const m of html.matchAll(/<(?:img|source)\b[^>]*?\b(?:src|data-src)=["']([^"']+)["']/gi)) { const u = abs(m[1]); if (u) seenMedia.add(u); }
      for (const m of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) { const best = m[1].split(',').map(s => s.trim().split(/\s+/)).sort((a, b) => parseFloat(b[1] || 0) - parseFloat(a[1] || 0))[0]; const u = best && abs(best[0]); if (u) seenMedia.add(u); }
      for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)/gi)) { const u = abs(m[1]); if (u) seenMedia.add(u); }
      for (const m of html.matchAll(/<video\b[^>]*\bposter=["']([^"']+)["']/gi)) { const u = abs(m[1]); if (u) seenMedia.add(u); }
      for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) { const u = abs(m[1]); if (u && new URL(u).origin === origin) scripts.add(u); }
      harvest(html, page);
      for (const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"'#]+)/gi)) { const u = abs(m[1]); if (u && new URL(u).origin === origin && !MEDIA_EXT.test(new URL(u).pathname) && !seenPage.has(u)) queue.push(u.split('#')[0]); }
    }
    for (const u of new Set([...[...scripts].slice(0, 12), ...extra])) {
      if (stats.stopped) break;
      let r; try { r = await get(u); } catch { continue; } if (r.status === 429 || r.status === 403) { stats.stopped = `${r.status} at ${u}`; break; } if (!r.ok) continue;
      const ct = r.headers.get('content-type') || '', body = await r.text(); if (body.length > (4 << 20)) continue;
      const asked = extra.includes(u), isScript = /javascript|ecmascript/.test(ct) || /\.m?js(\?|$)/.test(u);
      if (isScript) { stats.scripts++; harvest(body, u); }
      else stats.files = (stats.files || 0) + 1;
      /* a script is code (a lead); a page or document a visitor can open directly is copy (a finding) */
      hits.push(...copyHits(new URL(u).pathname + (isScript ? ' (script)' : ' (public file)'), /html/.test(ct) ? visibleText(body) : body, isScript ? 'review' : 'high'));
    }
    let n = 0;
    for (const u of seenMedia) {
      if (stats.stopped || n >= mediaMax) break;
      if (/^data:/.test(u)) continue;
      let r; try { r = await get(u); } catch { continue; } if (r.status === 429 || r.status === 403) { stats.stopped = `${r.status} at ${u}`; break; } if (!r.ok) continue;
      const len = Number(r.headers.get('content-length') || 0); if (len > MAX_FILE) continue;
      const buf = new Uint8Array(await r.arrayBuffer()); if (buf.length < 200) continue; n++; stats.media++;
      const name = new URL(u).pathname.split('/').pop() || 'file', tf = path.join(tmp, `m${n}-${name.replace(/[^\w.-]/g, '_').slice(-60)}`);
      fs.writeFileSync(tf, buf);
      const still = opts.watermark !== false && (stillImage(name) || /image\/(png|jpeg|webp)/.test(r.headers.get('content-type') || ''));
      const res = await inspectBytes(buf, name, { gray: still ? grayOf(tf) : null, pixels: still ? pixelsOf(tf) : null });
      if (res.summary.disclosure) stats.withDisclosure++; if (res.summary.leaksStack) stats.namingStack++; if (res.findings.some(x => /Pixelbake invisible watermark/.test(x.term))) stats.watermarked++; if (res.findings.some(x => /Invisible watermark consistent|Declared watermark|Stealth metadata/.test(x.term))) stats.otherMarks = (stats.otherMarks || 0) + 1;
      hits.push(...mediaHits(u, res, true));
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  return { target: start, stats, hits };
}

/* scan.mjs integration: the same hits in scan.mjs's finding shape */
export function asScanFindings(hits) {
  return hits.map(h => { const d = AI_DETECTORS[h.id]; return { detector: h.id, severity: d.sev, category: d.cat === 'integrity' ? 'logic' : d.cat, bug: d.bug, advice: d.advice, confidence: h.conf, file: h.where, line: 0, excerpt: h.detail.slice(0, 160) }; });
}

// ---------- ledger + story ----------
function grouped(hits) { const g = {}; for (const h of hits) (g[h.id] = g[h.id] || []).push(h); return g; }
export async function logToLedger(app, project, hits) {
  let cfg; try { cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.bugledger.json'), 'utf8')); } catch { cfg = { base: 'https://bugledger.coconvo.workers.dev', token: '' }; } /* no config: posts go unauthenticated and the ledger refuses them */
  let existing = new Set();
  try { const c = await (await fetch(`${cfg.base}/checklist.json`)).json(); for (const k in c.apps || {}) for (const b of c.apps[k]) existing.add(`${k}|${b.title}`.toLowerCase()); } catch {}
  const posted = [];
  for (const [id, hs] of Object.entries(grouped(hits))) {
    const d = AI_DETECTORS[id], high = hs.filter(h => h.conf === 'high'); if (!high.length) continue;   /* review-only leads stay out of the ledger until read */
    const title = `AI footprint: ${d.bug}`;
    if (existing.has(`${app}|${title}`.toLowerCase())) { posted.push({ id, status: 'already in ledger' }); continue; }
    /* the ledger is public: never repeat the provider / model / tool names a finding is about — counts and paths only */
    const safe = (h) => (id === 'AI-COPY-STACK' ? `${h.detail.split(', ').length} provider/model/hosting term(s)` : id === 'AI-MEDIA-STACK' ? 'metadata names the generator or carries its prompt/seed' : h.detail);
    const body = { app, project, kind: d.kind, title, category: d.cat, severity: d.sev,
      symptom: `${high.length} place(s): ` + high.slice(0, 8).map(h => `${h.where} — ${safe(h)}`).join(' · ').slice(0, 1500),
      fix: d.advice, file: high.slice(0, 5).map(h => h.where).join(', ').slice(0, 300) };
    const r = await fetch(`${cfg.base}/api/bugs`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ledger-key': cfg.token }, body: JSON.stringify(body) });
    posted.push({ id, status: r.ok ? 'logged' : `error ${r.status}` });
  }
  return posted;
}
function narrate(hits) {
  const W = path.join(LEDGER, 'worklog.mjs'), run = (a) => { try { execFileSync('node', [W, ...a], { stdio: 'ignore' }); } catch {} };
  run(['phase', 'AI footprint pass — media metadata, provenance, watermark, public copy']);
  for (const [id, hs] of Object.entries(grouped(hits))) {
    const d = AI_DETECTORS[id], high = hs.filter(h => h.conf === 'high');
    const safe = (h) => (id === 'AI-COPY-STACK' ? `${h.detail.split(', ').length} provider/model/hosting term(s)` : id === 'AI-MEDIA-STACK' ? 'metadata names the generator or carries its prompt/seed' : h.detail);
    run(['found', `${d.bug} ×${hs.length}`, '--sev', d.sev, '--cat', d.cat, '--file', hs[0].where.slice(0, 200), '--why', hs.slice(0, 4).map(h => `${h.where}: ${safe(h)}`).join(' · ').slice(0, 600), '--fix', d.advice, '--confidence', high.length ? 'high' : 'review', '--status', 'open']);
  }
}

// ---------- CLI ----------
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const argv = process.argv.slice(2), flag = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; }, has = (k) => argv.includes('--' + k);
  const valued = new Set(['url', 'pages', 'max', 'app', 'paths'].map(k => argv.indexOf('--' + k)).filter(i => i >= 0).map(i => argv[i + 1]));
  const dir = path.resolve(argv.find(a => !a.startsWith('--') && !valued.has(a)) || process.cwd());
  const url = flag('url');
  const res = url ? await aiScanUrl(url, { pages: +flag('pages') || 8, max: +flag('max') || 80, paths: (flag('paths') || '').split(',').filter(Boolean) }) : await aiScanDir(dir);
  const app = flag('app') || (url ? new URL(url).hostname.split('.')[0] : path.basename(dir)), project = url ? new URL(url).hostname : path.basename(dir);
  if (has('json')) { console.log(JSON.stringify({ app, ...res }, null, 2)); }
  else {
    const s = res.stats, g = grouped(res.hits);
    console.log(`\nAI footprint scan — ${res.target}`);
    console.log(url ? `pages ${s.pages} · scripts ${s.scripts} · files ${s.files || 0} · media ${s.media}` : `files ${res.files} · media ${s.media} · public text ${s.publicText}`);
    console.log(`media with an AI disclosure ${s.withDisclosure} · naming tools/stack ${s.namingStack} · Pixelbake watermark ${s.watermarked} · other invisible marks ${s.otherMarks || 0}${s.stopped ? `\n⚠ stopped politely: ${s.stopped}` : ''}`);
    if (!res.hits.length) console.log('\n✓ no AI-footprint findings');
    for (const [id, hs] of Object.entries(g)) {
      const d = AI_DETECTORS[id];
      console.log(`\n[${d.sev.toUpperCase()}] ${id} — ${d.bug}  (${hs.length}: ${hs.filter(h => h.conf === 'high').length} high, ${hs.filter(h => h.conf !== 'high').length} review)`);
      for (const h of hs.slice(0, 12)) console.log(`   ${h.conf === 'high' ? '•' : '?'} ${h.where}\n       ${h.detail}`);
      if (hs.length > 12) console.log(`   … ${hs.length - 12} more`);
      console.log(`   fix: ${d.advice}`);
    }
    console.log('\nLatent marks other than Pixelbake\'s (SynthID, Video Seal, TrustMark) need their vendor\'s detector; a clean scan never proves "no AI".');
  }
  if (has('story') && res.hits.length) narrate(res.hits);
  if (has('log')) { const p = await logToLedger(app, project, res.hits); console.log('\nledger:', p.length ? p.map(x => `${x.id} ${x.status}`).join(' · ') : 'nothing high-confidence to log'); }
}
