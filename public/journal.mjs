#!/usr/bin/env node
/* Bug Ledger · Prompt Journal — CLI + Claude Code hook.
 *
 * Every prompt you send to a coding agent, stored in the ledger word-for-word (never a paraphrase, never the
 * agent's notes), time-stamped, filed under its project, with the photos that go with it. Append-only.
 *
 *   node journal.mjs install                          copy this file to ~/.claude/hooks and register the hooks (safe to re-run)
 *   node journal.mjs hook                             (used by the hooks) reads the hook event on stdin:
 *                                                       UserPromptSubmit → posts the prompt the moment it is sent
 *                                                       Stop             → sweeps the transcript: mid-turn prompts, pasted images, anything missed
 *   node journal.mjs sweep <session.jsonl>            journal every prompt in one transcript (idempotent)
 *   node journal.mjs backfill [--since YYYY-MM-DD] [--no-images] [--dry] [--parallel 4]   every transcript on this Mac
 *   node journal.mjs add "the prompt" [--project P --app A --at ISO --session S --agent codex]   (or add --file f.txt | add -)
 *   node journal.mjs shot <image…> [--prompt <id> | --latest] [--caption "…"] [--kind before|after|shot]
 *   node journal.mjs refile <id> --project P [--app A]
 *   node journal.mjs list [--project P] [--q words] [--limit 50]
 *   node journal.mjs verify <session.jsonl> [--lenient] [--tamper]   prove every stored prompt is byte-identical to the transcript (exit 1 if not;
 *                                                     --lenient tolerates leading/trailing whitespace differences; --tamper injects a known fault to prove the checker)
 *
 * Token: ~/.bugledger.json {base, token}; override with BUGLEDGER_BASE / BUGLEDGER_KEY. The hook never blocks a prompt:
 * every error is swallowed, logged to ~/.bugledger-journal/journal.log, and the process exits 0.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

const HOME = os.homedir();
const STATE_DIR = path.join(HOME, '.bugledger-journal');
const LOG = path.join(STATE_DIR, 'journal.log');
const HOOK_DST = path.join(HOME, '.claude', 'hooks', 'bugledger-journal.mjs');
const SETTINGS = path.join(HOME, '.claude', 'settings.json');
const readJSON = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
export function config() {
  const c = readJSON(path.join(HOME, '.bugledger.json'), {}) || {};
  return { base: (process.env.BUGLEDGER_BASE || c.base || 'https://bugledger.coconvo.workers.dev').replace(/\/$/, ''), token: process.env.BUGLEDGER_KEY || c.token || '' };
}
const log = (line) => { try { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.appendFileSync(LOG, new Date().toISOString() + ' ' + line + '\n'); } catch {} };
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

/* ---- secrets never leave this Mac: the same narrow shapes the server removes, counted ---- */
const SECRET_RES = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g, /sk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{16,}/g, /github_pat_[A-Za-z0-9_]{20,}/g,
  /AIza[0-9A-Za-z_-]{35}/g, /[rs]k_(?:live|test)_[A-Za-z0-9]{16,}/g, /whsec_[A-Za-z0-9]{16,}/g,
  /AKIA[0-9A-Z]{16}/g, /xox[baprs]-[A-Za-z0-9-]{10,}/g, /blk_[a-f0-9]{40}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];
const LABELLED = /\b(api[_-]?key|secret|token|password|passcode|passwd)\b(\s*[:=]\s*)(["']?)([^\s"'<>]{8,})\3/gi;
export function scrubSecrets(s) {
  let n = 0, out = String(s);
  for (const re of SECRET_RES) out = out.replace(re, () => { n++; return '[secret removed]'; });
  out = out.replace(LABELLED, (m, label, sep, q, val) => { if (!(val.length >= 16 || (/[A-Za-z]/.test(val) && /\d/.test(val)))) return m; n++; return label + sep + q + '[secret removed]' + q; });
  return { text: out, n };
}

/* ---- what counts as a prompt (mirrors ~/.claude/skills/promptlog/extract.py, minus its lossy dedupe) ---- */
/* not the owner's words: compaction summaries, interruptions, and the brief another agent session wrote when it started this one */
const SKIP = ['This session is being continued from a previous conversation', 'Your response above was cut off mid-stream', '[Request interrupted by user', 'Task (from the session that started this one)'];
/* notices the harness relays as if typed (<pasted_content> is NOT here: that is text the owner pasted themselves) */
const SYSTEM = ['<agent-message', '<task-notification', '<side-sessions-event', '<ci-monitor-event', '<cross-session-message', '<system-reminder', '<command-message', '<artifact-view-context', '<local-command-stdout', '<local-command-caveat', '<local-command-stderr', '[SYSTEM NOTIFICATION'];
const BUILTIN = new Set(['/model', '/clear', '/compact', '/config', '/cost', '/help', '/login', '/logout', '/status', '/permissions', '/hooks', '/memory', '/resume', '/fast', '/effort', '/mcp', '/doctor', '/exit', '/context', '/usage']);
export const isRelayed = (t) => SYSTEM.some((p) => t.startsWith(p)) || SKIP.some((p) => t.startsWith(p));
export const isBuiltin = (t) => { const m = /^(\/[\w-]+)/.exec(t.trim()); return !!m && BUILTIN.has(m[1]) && t.trim() === m[1]; };
const CMD = /<command-name>(\/?[\w-]+)<\/command-name>/, ARGS = /<command-args>([\s\S]*?)<\/command-args>/;
/* a raw user turn → exactly what the user typed (slash commands are unwrapped; harness reminders are not the user's words) */
export function userText(content) {
  const parts = Array.isArray(content) ? content : [{ type: 'text', text: typeof content === 'string' ? content : '' }];
  const texts = [], images = [];
  for (const p of parts) {
    if (!p || typeof p !== 'object') continue;
    if (p.type === 'text') texts.push(p.text || '');
    else if (p.type === 'image' && p.source && p.source.type === 'base64' && p.source.data) images.push({ type: p.source.media_type || 'image/png', data: p.source.data });
  }
  let text = texts.join('\n'), kind = 'typed';
  const m = CMD.exec(text);
  if (m) { const a = ARGS.exec(text); text = m[1] + (a && a[1].trim() ? ' ' + a[1].trim() : ''); kind = 'command'; }
  else { const t2 = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, ''); if (t2 !== text) text = t2.trim(); }
  return { text, kind, images };
}
/* every prompt in a transcript, in order: top-level turns, mid-turn (queued) messages, pasted images folded in */
export async function extractPrompts(file, { images = true } = {}) {
  const out = []; let pending = [], meta = { cwd: null, sessionId: null, branch: null, dominantCwd: null }; const cwds = new Map();
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue; let d; try { d = JSON.parse(line); } catch { continue; }
    if (d.cwd) { if (!meta.cwd) meta.cwd = d.cwd; if (d.cwd !== HOME && !d.cwd.startsWith(HOME + '/.')) cwds.set(d.cwd, (cwds.get(d.cwd) || 0) + 1); } if (!meta.sessionId && d.sessionId) meta.sessionId = d.sessionId; if (!meta.branch && d.gitBranch) meta.branch = d.gitBranch;
    if (d.isSidechain) continue;
    if (d.type === 'user' && !d.isMeta) {
      const c = d.message && d.message.content;
      if (Array.isArray(c) && c.some((p) => p && p.type === 'tool_result')) continue;
      const u = userText(c);
      if (!u.text.trim()) { if (u.images.length) pending.push(...u.images); continue; }
      if (isRelayed(u.text) || isBuiltin(u.text)) continue;
      out.push({ uuid: d.uuid, time: d.timestamp, kind: u.kind, text: u.text, cwd: d.cwd || null, images: images ? pending.concat(u.images) : [], imageCount: pending.length + u.images.length }); pending = [];
    } else if (d.type === 'attachment') {
      const a = d.attachment || {};
      if (a.type !== 'queued_command' || !a.prompt) continue;
      if (a.origin && a.origin.kind && a.origin.kind !== 'human') continue;
      const u = userText(a.prompt);
      if (!u.text.trim()) { if (u.images.length) pending.push(...u.images); continue; }
      if (isRelayed(u.text) || isBuiltin(u.text)) continue;
      out.push({ uuid: d.uuid, time: a.timestamp || d.timestamp, kind: 'mid-turn', text: u.text, cwd: d.cwd || null, images: images ? pending.concat(u.images) : [], imageCount: pending.length + u.images.length }); pending = [];
    }
  }
  out.sort((x, y) => String(x.time).localeCompare(String(y.time)));
  out.forEach((p, i) => { p.n = i + 1; });
  meta.dominantCwd = [...cwds.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0])[0] || null;   /* where the session mostly worked */
  return { prompts: out, meta };
}

/* ---- which project is this? the session's Aprizely board knows best; else the folder the prompt was typed in ---- */
const PROJECTS = () => readJSON(path.join(STATE_DIR, 'projects.json'), {}) || {};
/* a folder → its project: the longest matching rule in ~/.bugledger-journal/projects.json ({"pixelbake":{"app":"Pixelbake"},
   "coconvo/public/companion":{"app":"Coconvo Companion"}}), else the top folder's own Aprizely board, else the top folder's name */
export function folderProject(dir, map = PROJECTS()) {
  if (!dir || dir === HOME || !dir.startsWith(HOME + '/') || dir.startsWith(HOME + '/.')) return null;
  const rel = dir.slice(HOME.length + 1), root = rel.split('/')[0];
  const rule = Object.keys(map).filter((k) => !k.startsWith('_') && (rel === k || rel.startsWith(k + '/'))).sort((a, b) => b.length - a.length)[0];
  if (rule) return { project: map[rule].project || root, app: map[rule].app || null, via: 'folder-map' };
  const w = readJSON(path.join(HOME, root, '.aprizely.worklog.json'));
  if (w && (w.app || w.project)) return { project: w.project || root, app: w.app || null, via: 'folder-board' };
  return { project: root, app: null, via: 'cwd' };
}
export function resolveProject(sessionId, cwd, { lineCwd = null, dominantCwd = null } = {}) {
  const reg = sessionId ? readJSON(path.join(HOME, '.aprizely', 'sessions', String(sessionId).replace(/[^\w-]/g, '') + '.json')) : null;
  /* a board file in the home folder belongs to some other run, not to every session started from ~ */
  for (const dir of [reg && reg.dir, cwd && cwd !== HOME ? cwd : null].filter(Boolean)) {
    const w = readJSON(path.join(dir, '.aprizely.worklog.json'));
    if (w && (w.app || w.project)) return { project: w.project || path.basename(dir), app: w.app || null, via: 'board' };
  }
  /* no board of its own: the folder this prompt was typed in, else where the session mostly worked, else where it started */
  for (const dir of [lineCwd, dominantCwd, cwd]) { const f = folderProject(dir); if (f) return f; }
  return { project: 'home', app: null, via: 'cwd' };
}

/* ---- talking to the ledger ---- */
async function api(method, route, body, { timeout = 20000, raw = null } = {}) {
  const { base, token } = config();
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const headers = { 'x-ledger-key': token }; let payload;
    if (raw) { headers['content-type'] = raw.type; payload = raw.bytes; } else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    const r = await fetch(base + route, { method, headers, body: payload, signal: ctrl.signal });
    const j = await r.json().catch(() => ({ ok: false, error: 'bad response ' + r.status }));
    if (r.status === 401) j.error = j.error || 'unauthorized'; return j;
  } finally { clearTimeout(t); }
}
/* state is kept per ledger host, so a local test server never marks prompts as posted for the live ledger */
const stateFile = (sid) => path.join(STATE_DIR, 'sessions', config().base.replace(/^https?:\/\//, '').replace(/[^\w.-]/g, '_'), String(sid || 'none').replace(/[^\w-]/g, '') + '.json');
const loadState = (sid) => readJSON(stateFile(sid), { posted: {}, hooked: [] }) || { posted: {}, hooked: [] };
const saveState = (sid, s) => { try { fs.mkdirSync(path.dirname(stateFile(sid)), { recursive: true }); fs.writeFileSync(stateFile(sid), JSON.stringify(s) + '\n'); } catch {} };
const toDataUrl = (img) => 'data:' + img.type + ';base64,' + img.data;

/* UserPromptSubmit: post the prompt now, exactly as typed, and tell the agent its journal id */
async function onPrompt(ev) {
  const text = typeof ev.prompt === 'string' ? ev.prompt : typeof ev.prompt_text === 'string' ? ev.prompt_text : '';
  if (!text.trim() || isRelayed(text) || isBuiltin(text)) return;
  const sid = ev.session_id || null, { project, app, via } = resolveProject(sid, ev.cwd);
  const sc = scrubSecrets(text);
  const body = { text: sc.text, redactions: sc.n, at: Date.now(), sessionId: sid, project, app, source: 'hook', arrival: /^\/[\w-]+/.test(text.trim()) ? 'command' : 'typed',
    cwd: ev.cwd || null, agent: 'claude-code', by: 'hook', meta: { via, transcript: ev.transcript_path ? path.basename(ev.transcript_path) : undefined } };
  const res = await api('POST', '/api/journal', body, { timeout: 7000 });
  if (!res || !res.ok) { log('hook post failed: ' + (res && res.error)); return; }
  const st = loadState(sid); st.hooked.push({ t: body.at, k: sha256(sc.text.trim()), id: res.id, via }); st.hooked = st.hooked.slice(-500); st.project = project; st.app = app; saveState(sid, st);
  const ctx = `[Prompt Journal] This prompt is saved word-for-word as ${res.id} (${app || project}). To attach a screenshot to it: node ~/.claude/hooks/bugledger-journal.mjs shot <file.png> --prompt ${res.id} --caption "…" --kind after`;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: ctx } }));
}

/* Stop / sweep / backfill: everything in the transcript, idempotent; pasted images ride along as photos */
export async function sweep(file, { sessionId, cwd, images = true, dry = false, quiet = false, by = 'sweep' } = {}) {
  if (!file || !fs.existsSync(file)) return { ok: false, error: 'no transcript at ' + file };
  const { prompts, meta } = await extractPrompts(file, { images });
  const sid = sessionId || meta.sessionId || path.basename(file, '.jsonl');
  const st = loadState(sid); let added = 0, dup = 0, photos = 0, failed = 0; const filed = new Map();
  for (const p of prompts) {
    if (st.posted[p.uuid]) continue;
    /* each prompt is filed under the folder it was typed in (a session's own board outranks that) */
    const { project, app, via } = resolveProject(sid, cwd || meta.cwd, { lineCwd: p.cwd, dominantCwd: meta.dominantCwd });
    filed.set(app || project, (filed.get(app || project) || 0) + 1);
    const sc = scrubSecrets(p.text);
    const body = { text: sc.text, redactions: sc.n, at: p.time, sessionId: sid, seq: p.n, uuid: p.uuid, project, app, source: 'transcript', arrival: p.kind, cwd: p.cwd || cwd || meta.cwd || null,
      agent: 'claude-code', by, meta: { via, branch: meta.branch || undefined, images: p.imageCount || undefined },
      photos: p.images.map((im) => ({ dataUrl: toDataUrl(im), kind: 'pasted', caption: 'Pasted with the prompt' })) };
    if (dry) { added++; if (!quiet) console.log(`  would add #${p.n} ${p.kind} ${p.time} ${p.imageCount ? p.imageCount + ' image(s) ' : ''}${JSON.stringify(p.text.slice(0, 70))} → ${app || project}`); continue; }
    let res; try { res = await api('POST', '/api/journal', body, { timeout: 60000 }); } catch (e) { res = { ok: false, error: String(e) }; }
    if (!res || !res.ok) { failed++; log(`sweep: post failed for ${p.uuid}: ${res && res.error}`); continue; }
    st.posted[p.uuid] = res.id;
    if (res.duplicate) {
      dup++;
      /* the live hook got the words first — give its row the pictures, and its proper project if the hook only knew the folder */
      for (const im of p.images) { try { const r = await api('POST', '/api/journal/photo', { promptId: res.id, dataUrl: toDataUrl(im), kind: 'pasted', caption: 'Pasted with the prompt', by }); if (r && r.ok && !r.duplicate) photos++; } catch {} }
      if (via === 'board' && (res.project !== project || (app && res.app !== app))) { try { await api('POST', '/api/journal/refile', { promptId: res.id, project, app, by }); } catch {} }
    } else { added++; photos += (res.photos || []).length; }
    saveState(sid, st);
  }
  const top = [...filed.entries()].sort((a, b) => b[1] - a[1]);
  const where = top.length ? top[0][0] + (top.length > 1 ? ` (+${top.length - 1} more)` : '') : 'nothing new';
  if (!dry) { st.filed = Object.fromEntries(top); st.sweptAt = Date.now(); saveState(sid, st); }   /* a dry run leaves no trace */
  const summary = { ok: true, file: path.basename(file), session: sid, filed: Object.fromEntries(top), project: top[0] ? top[0][0] : null, prompts: prompts.length, added, duplicates: dup, photos, failed };
  if (!quiet) console.log(`${dry ? '(dry) ' : ''}${path.basename(file)} → ${prompts.length} prompts · ${added} added · ${dup} already there · ${photos} photos · ${failed} failed · ${where}`);
  return summary;
}
async function backfill(args) {
  const since = opt(args, 'since') ? Date.parse(opt(args, 'since')) : 0, images = !has(args, 'no-images'), dry = has(args, 'dry'), par = Math.max(1, +(opt(args, 'parallel') || (dry ? 1 : 4)));
  const files = fs.readdirSync(path.join(HOME, '.claude', 'projects'), { withFileTypes: true }).filter((d) => d.isDirectory())
    .flatMap((d) => fs.readdirSync(path.join(HOME, '.claude', 'projects', d.name)).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(HOME, '.claude', 'projects', d.name, f)))
    .map((f) => ({ f, m: fs.statSync(f).mtimeMs })).filter((x) => x.m >= since).sort((a, b) => a.m - b.m);
  console.log(`${files.length} transcripts${since ? ' since ' + opt(args, 'since') : ''}${dry ? ' (dry run)' : ''}`);
  let tot = { prompts: 0, added: 0, duplicates: 0, photos: 0, failed: 0 }, i = 0;
  /* a few transcripts at a time (each one in order, so a session's prompts arrive in sequence) */
  const lane = async () => { while (i < files.length) { const { f } = files[i++]; const r = await sweep(f, { images, dry }); if (r.ok) for (const k of Object.keys(tot)) tot[k] += r[k] || 0; } };
  await Promise.all(Array.from({ length: Math.min(par, files.length) }, lane));
  console.log(`total: ${tot.prompts} prompts · ${tot.added} added · ${tot.duplicates} already there · ${tot.photos} photos · ${tot.failed} failed`);
}

/* ---- hand-added prompts, photos, refiles, listing ---- */
async function add(args) {
  let text; if (has(args, 'file')) text = fs.readFileSync(opt(args, 'file'), 'utf8'); else if (args[0] === '-') text = fs.readFileSync(0, 'utf8'); else text = args.filter((a) => !a.startsWith('--'))[0];
  if (!text || !text.trim()) die('add: give the prompt as an argument, --file <path>, or - for stdin');
  const sc = scrubSecrets(text), { project, app } = resolveProject(opt(args, 'session'), process.cwd());
  const body = { text: sc.text, redactions: sc.n, at: opt(args, 'at') || Date.now(), project: opt(args, 'project') || project, app: opt(args, 'app') || app, sessionId: opt(args, 'session') || null,
    agent: opt(args, 'agent') || 'agent', source: 'cli', arrival: opt(args, 'arrival') || 'api', cwd: process.cwd(), by: opt(args, 'agent') || 'cli' };
  const r = await api('POST', '/api/journal', body); if (!r.ok) die('add failed: ' + r.error);
  console.log(`${r.duplicate ? 'already journaled' : 'journaled'} ${r.id} · ${r.sha === sha256(sc.text) ? 'verbatim ✓' : 'sha differs ✗'}${sc.n ? ' · ' + sc.n + ' secret(s) removed' : ''}\n${r.url}`);
}
async function shot(args) {
  const files = args.filter((a) => !a.startsWith('--') && fs.existsSync(a)); if (!files.length) die('shot: give at least one image file');
  let promptId = opt(args, 'prompt');
  if (!promptId) { const latest = latestPromptId(); if (!latest) die('shot: --prompt <id> (or run it in a session the hook has journaled)'); promptId = latest; }
  for (const f of files) {
    const ext = path.extname(f).toLowerCase(), type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif' }[ext];
    if (!type) { console.log('skip (not an image): ' + f); continue; }
    const q = new URLSearchParams({ prompt: promptId, caption: opt(args, 'caption') || path.basename(f, ext), kind: opt(args, 'kind') || 'shot', by: opt(args, 'by') || 'agent' });
    const r = await api('POST', '/api/journal/photo?' + q, undefined, { raw: { type, bytes: fs.readFileSync(f) } });
    console.log(r.ok ? `${r.duplicate ? 'already attached' : 'attached'} ${path.basename(f)} → ${promptId}\n${r.view}` : `failed ${f}: ${r.error}`);
  }
}
function latestPromptId() {
  const dir = path.join(STATE_DIR, 'sessions'); if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).map((f) => path.join(dir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  for (const f of files) { const s = readJSON(f); const h = s && s.hooked && s.hooked[s.hooked.length - 1]; if (h && h.id) return h.id; const ids = s && s.posted ? Object.values(s.posted) : []; if (ids.length) return ids[ids.length - 1]; }
  return null;
}
async function refile(args) {
  const id = args.find((a) => !a.startsWith('--')); if (!id || !opt(args, 'project') && !opt(args, 'app')) die('refile <id> --project P [--app A]');
  const r = await api('POST', '/api/journal/refile', { promptId: id, project: opt(args, 'project'), app: opt(args, 'app'), by: 'cli' }); console.log(r.ok ? `refiled ${id} → ${r.app || r.project}` : 'failed: ' + r.error);
}
async function list(args) {
  const q = new URLSearchParams(); if (opt(args, 'project')) q.set('project', opt(args, 'project')); if (opt(args, 'q')) q.set('q', opt(args, 'q')); q.set('limit', opt(args, 'limit') || '50');
  const r = await api('GET', '/api/journal?' + q); if (!r.ok) die('list failed: ' + r.error);
  console.log(`${r.total} prompts · ${r.projects.length} projects · showing ${r.count}`);
  for (const p of r.prompts) console.log(`${new Date(p.ts).toISOString().replace('T', ' ').slice(0, 19)}  ${(p.app || p.project || '').padEnd(18)} ${p.id}  ${p.photos.length ? '📷' + p.photos.length + ' ' : ''}${JSON.stringify(p.text.length > 90 ? p.text.slice(0, 90) + '…' : p.text)}`);
}
/* the verbatim checker: every transcript prompt vs the stored row — byte-identical or it fails */
async function verify(args) {
  const file = args.find((a) => !a.startsWith('--')); if (!file) die('verify <session.jsonl> [--tamper]');
  const { prompts, meta } = await extractPrompts(file, { images: false }); const sid = meta.sessionId || path.basename(file, '.jsonl');
  const r = await api('GET', '/api/journal?session=' + encodeURIComponent(sid) + '&limit=1000&order=asc'); if (!r.ok) die('verify: ' + r.error);
  const byUuid = new Map(r.prompts.filter((p) => p.uuid).map((p) => [p.uuid, p])), byKey = new Map(r.prompts.map((p) => [sha256(p.text.trim()), p]));
  let exact = 0, ws = 0, bad = 0, missing = 0, secrets = 0;
  for (const p of prompts) {
    let local = scrubSecrets(p.text).text; if (has(args, 'tamper')) local = local.replace(/\s+$/, '') + ' '; /* a known fault: one trailing space */
    const row = byUuid.get(p.uuid) || byKey.get(sha256(local.trim()));
    if (!row) { missing++; console.log(`  MISSING  #${p.n} ${p.time} ${JSON.stringify(p.text.slice(0, 60))}`); continue; }
    if (row.redactions) secrets++;
    if (sha256(local) === row.sha) { exact++; continue; }
    if (local.trim() === row.text.trim()) { ws++; console.log(`  ${has(args, 'lenient') ? 'whitespace-only difference' : 'WHITESPACE DIFFERS'} #${p.n} ${row.id} (leading/trailing whitespace; the words are the same)`); continue; }
    bad++; const i = [...local].findIndex((ch, k) => ch !== row.text[k]); console.log(`  MISMATCH #${p.n} ${row.id} at char ${i}: transcript ${JSON.stringify(local.slice(Math.max(0, i - 20), i + 20))} vs stored ${JSON.stringify(row.text.slice(Math.max(0, i - 20), i + 20))}`);
  }
  console.log(`${prompts.length} prompts in the transcript · ${exact} byte-identical · ${ws} whitespace-only · ${bad} mismatched · ${missing} missing · ${secrets} with secrets removed`);
  process.exit(bad || missing || (ws && !has(args, 'lenient')) ? 1 : 0);   /* strict by default: "exact" means every byte */
}

/* ---- install: this file → ~/.claude/hooks, two hook entries in settings.json (idempotent, with a backup) ---- */
function install() {
  const self = fs.readFileSync(new URL(import.meta.url), 'utf8');
  fs.mkdirSync(path.dirname(HOOK_DST), { recursive: true }); fs.writeFileSync(HOOK_DST, self); fs.chmodSync(HOOK_DST, 0o755);
  const s = readJSON(SETTINGS, {}) || {}; s.hooks = s.hooks || {};
  const cmd = 'node ~/.claude/hooks/bugledger-journal.mjs hook';
  const ensure = (event, entry) => {
    const list = Array.isArray(s.hooks[event]) ? s.hooks[event] : (s.hooks[event] = []);
    if (list.some((g) => (g.hooks || []).some((h) => h.command === cmd))) return false;
    list.push({ hooks: [entry] }); return true;
  };
  const a = ensure('UserPromptSubmit', { type: 'command', command: cmd, timeout: 10 });
  const b = ensure('Stop', { type: 'command', command: cmd, timeout: 120, async: true });
  if (a || b) { try { fs.copyFileSync(SETTINGS, SETTINGS + '.bak-' + new Date().toISOString().slice(0, 10)); } catch {} fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2) + '\n'); }
  console.log(`hook script: ${HOOK_DST}\nsettings.json: UserPromptSubmit ${a ? 'added' : 'already there'} · Stop ${b ? 'added' : 'already there'}\nEvery prompt from the next session on is journaled at ${config().base}/journal`);
}

/* ---- plumbing ---- */
const has = (args, k) => args.includes('--' + k);
const opt = (args, k) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] !== undefined && !String(args[i + 1]).startsWith('--') ? args[i + 1] : (i >= 0 ? '' : undefined); };
const die = (m) => { console.error(m); process.exit(1); };
export async function main(argv = process.argv.slice(2)) {
  const [cmd, ...args] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 20).join('\n').replace(/^ \*\s?/gm, '')); return; }
  if (cmd === 'hook') {
    try {
      let input = ''; try { input = fs.readFileSync(0, 'utf8'); } catch {}
      const ev = JSON.parse(input || '{}');
      if (ev.hook_event_name === 'UserPromptSubmit') await onPrompt(ev);
      else if (ev.hook_event_name === 'Stop') await sweep(ev.transcript_path, { sessionId: ev.session_id, cwd: ev.cwd, quiet: true, by: 'stop-hook' });
    } catch (e) { log('hook error: ' + (e && e.message || e)); }
    return;   /* a hook never fails a prompt */
  }
  if (cmd === 'sweep') { const f = args.find((a) => !a.startsWith('--')); const r = await sweep(f, { images: !has(args, 'no-images'), dry: has(args, 'dry') }); if (!r.ok) die(r.error); return; }
  if (cmd === 'backfill') return backfill(args);
  if (cmd === 'add') return add(args);
  if (cmd === 'shot') return shot(args);
  if (cmd === 'refile') return refile(args);
  if (cmd === 'list') return list(args);
  if (cmd === 'verify') return verify(args);
  if (cmd === 'install') return install();
  if (cmd === 'whoami') { const { base, token } = config(); const r = await api('GET', '/api/journal?limit=1'); console.log(base, token ? 'key present' : 'NO KEY', r.ok ? `· ${r.total} prompts · ${r.projects.length} projects` : '· ' + r.error); return; }
  die('unknown command: ' + cmd + ' (try: journal.mjs help)');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { if (process.argv[2] === 'hook') { log('hook crash: ' + e); process.exit(0); } console.error(e && e.message || e); process.exit(1); });
