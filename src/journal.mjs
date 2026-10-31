// Prompt Journal — every prompt the owner sends to a coding agent, verbatim, time-stamped, filed per project,
// with photos. Owner-only: prompts hold product plans, so reads need the ledger key and photos are served
// only through signed, expiring links. Append-only like the rest of the ledger (see schema-journal.sql).
//
//   POST /api/journal            add one prompt  { text, at, project, app, sessionId, seq, agent, source, arrival, uuid, cwd, meta, photos:[{dataUrl,caption,kind}] }
//   POST /api/journal/photo      attach a picture to a prompt  { promptId | sessionId (latest), dataUrl, caption, kind } or a raw image body (?prompt=&caption=&kind=)
//   POST /api/journal/refile     file a prompt under a (different) project/app  { promptId, project, app }
//   GET  /api/journal            list  ?project=&session=&from=&to=&q=&photos=1&arrival=&source=&limit=&before=&order=
//   GET  /api/journal/img/<key>  a photo, only with a valid ?e=<expiry>&s=<signature>
//   GET  /journal                the page (public/journal.html; it asks for the key)

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-ledger-key",
  "cache-control": "no-store",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
const appendOnly = (e) => /append-only|immutable|cannot be deleted/i.test(String(e));
const writeErr = (e) => appendOnly(e) ? json({ ok: false, error: "rejected — the journal is append-only" }, 403) : json({ ok: false, error: String(e) }, 500);
const str = (v, max) => (typeof v === "string" ? v : v == null ? "" : String(v)).slice(0, max);
const num = (v) => (Number.isFinite(+v) ? Math.trunc(+v) : 0);
const IMG_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_TEXT = 500_000;          // characters; a prompt beyond this is kept to the cap and flagged truncated
const PAIR_WINDOW_MS = 180_000;    // the live hook and the transcript sweep see the same prompt within this window
const SIGN_TTL_MS = 30 * 24 * 3600_000;
const ARRIVALS = new Set(["typed", "mid-turn", "command", "api"]);
const SOURCES = new Set(["hook", "transcript", "cli", "api"]);
const KINDS = new Set(["pasted", "before", "after", "shot"]);

// ---- secrets never enter the journal: narrow, well-known shapes only, each replacement counted ----
// (the owner's own words stay exact otherwise — the count is shown so a touched prompt is never passed off as untouched)
const SECRET_RES = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g, /sk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{16,}/g, /github_pat_[A-Za-z0-9_]{20,}/g,
  /AIza[0-9A-Za-z_-]{35}/g, /[rs]k_(?:live|test)_[A-Za-z0-9]{16,}/g, /whsec_[A-Za-z0-9]{16,}/g,
  /AKIA[0-9A-Z]{16}/g, /xox[baprs]-[A-Za-z0-9-]{10,}/g, /blk_[a-f0-9]{40}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];
// "password: hunter2!x9" style — keep the label, remove the value (≥16 chars, or ≥8 with both letters and digits)
const LABELLED = /\b(api[_-]?key|secret|token|password|passcode|passwd)\b(\s*[:=]\s*)(["']?)([^\s"'<>]{8,})\3/gi;
export function scrubSecrets(s) {
  let n = 0, out = String(s);
  for (const re of SECRET_RES) out = out.replace(re, () => { n++; return "[secret removed]"; });
  out = out.replace(LABELLED, (m, label, sep, q, val) => {
    if (!(val.length >= 16 || (/[A-Za-z]/.test(val) && /\d/.test(val)))) return m;
    n++; return label + sep + q + "[secret removed]" + q;
  });
  return { text: out, n };
}

const enc = new TextEncoder();
async function sha256hex(s) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
let _hmacKey = null, _hmacFor = null;
async function sign(secret, key, exp) {
  if (!_hmacKey || _hmacFor !== secret) { _hmacKey = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); _hmacFor = secret; }
  const sig = await crypto.subtle.sign("HMAC", _hmacKey, enc.encode(key + "|" + exp));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}
const words = (t) => { const m = t.match(/\S+/g); return m ? m.length : 0; };
const owner = (request, env) => !env.LEDGER_WRITE_TOKEN || request.headers.get("x-ledger-key") === env.LEDGER_WRITE_TOKEN;
const newId = (p) => p + crypto.randomUUID().replace(/-/g, "").slice(0, 18);
const parseWhen = (v) => { if (v == null || v === "") return null; if (Number.isFinite(+v) && +v > 1e11) return Math.trunc(+v); const t = Date.parse(String(v)); return Number.isFinite(t) ? t : null; };
const b64ToBytes = (b64) => { const bin = atob(b64), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };

// store one picture under the private prefix; returns {key,type,bytes} or null
async function putPhoto(env, input) {
  if (!env.SHOTS || !input) return null;
  let type, bytes;
  if (input instanceof Uint8Array) { type = input.type; bytes = input; }
  else {
    const m = /^data:(image\/[a-z0-9+.-]+);base64,([\s\S]+)$/i.exec(String(input).trim());
    if (!m) return null; type = m[1].toLowerCase();
    try { bytes = b64ToBytes(m[2].replace(/\s+/g, "")); } catch { return null; }
  }
  const ext = IMG_EXT[type]; if (!ext || !bytes.length || bytes.length > MAX_PHOTO_BYTES) return null;
  const key = "pj/" + crypto.randomUUID().replace(/-/g, "") + "." + ext;
  await env.SHOTS.put(key, bytes, { httpMetadata: { contentType: type, cacheControl: "private, max-age=86400" } });
  return { key, type, bytes: bytes.length };
}
async function photoUrl(env, origin, key) {
  const exp = Date.now() + SIGN_TTL_MS;
  const s = env.LEDGER_WRITE_TOKEN ? await sign(env.LEDGER_WRITE_TOKEN, key, exp) : "open";
  return origin + "/api/journal/img/" + key + "?e=" + exp + "&s=" + s;
}
const mapPhoto = async (env, origin, r) => ({ id: r.id, promptId: r.prompt_id, ts: r.ts, kind: r.kind, caption: r.caption, width: r.width, height: r.height, bytes: r.bytes, type: r.type, by: r.by, url: await photoUrl(env, origin, r.key) });
const safe = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const mapPrompt = (r) => ({
  id: r.id, ts: r.ts, received: r.received,
  project: r.r_project || r.project, app: r.r_app || r.app, filedAs: r.r_project || r.r_app ? "refiled" : "original",
  sessionId: r.session_id, seq: r.seq, agent: r.agent, source: r.source, arrival: r.arrival,
  text: r.text, sha: r.sha, chars: r.chars, words: r.words, redactions: r.redactions, truncated: !!r.truncated,
  uuid: r.uuid, cwd: r.cwd, meta: safe(r.meta, null), photos: [],
});
// latest filing wins: LEFT JOIN the newest refile row per prompt
const FROM = `FROM journal j LEFT JOIN journal_refile r ON r.id = (SELECT id FROM journal_refile WHERE prompt_id = j.id ORDER BY ts DESC LIMIT 1)`;

async function insertPrompt(env, origin, body, by) {
  let text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) return json({ ok: false, error: "text is required — the prompt itself, exactly as sent" }, 400);
  let truncated = 0; if (text.length > MAX_TEXT) { text = text.slice(0, MAX_TEXT); truncated = 1; }
  const sc = scrubSecrets(text); text = sc.text;
  const redactions = sc.n + Math.max(0, num(body.redactions));
  const [sha, keySha] = await Promise.all([sha256hex(text), sha256hex(text.trim())]);
  const ts = parseWhen(body.at ?? body.ts) || Date.now(), now = Date.now();
  const sessionId = str(body.sessionId || body.session, 80) || null;
  const uuid = str(body.uuid, 80) || null;
  // idempotent — never lossy. A transcript row (it carries the message uuid) is a duplicate only of (1) the same uuid, (2) the row it was
  // already paired with, or (3) a not-yet-paired live-hook row (no uuid) with the same words in the same session within the window; that
  // pairing is written to journal_pairs, so a second identical prompt ("continue", "kindly pause") always gets its own row. A hook row
  // never pairs — every fire of the hook is a real prompt. Other uuid-less posts (CLI/API) pair within the window, which absorbs a retry.
  const dup = (d) => json({ ok: true, id: d.id, sha: d.sha, duplicate: true, project: d.project, app: d.app, url: origin + "/journal#id=" + d.id });
  const source = SOURCES.has(body.source) ? body.source : "api";
  try {
    if (uuid) {
      let d = await env.DB.prepare("SELECT id, sha, project, app FROM journal WHERE uuid = ?").bind(uuid).first(); if (d) return dup(d);
      d = await env.DB.prepare("SELECT j.id, j.sha, j.project, j.app FROM journal_pairs q JOIN journal j ON j.id = q.prompt_id WHERE q.uuid = ?").bind(uuid).first(); if (d) return dup(d);
      if (sessionId) {
        d = await env.DB.prepare(`SELECT j.id, j.sha, j.project, j.app FROM journal j WHERE j.session_id = ? AND j.key_sha = ? AND j.uuid IS NULL AND abs(j.ts - ?) < ?
          AND NOT EXISTS (SELECT 1 FROM journal_pairs q WHERE q.prompt_id = j.id) ORDER BY abs(j.ts - ?) LIMIT 1`).bind(sessionId, keySha, ts, PAIR_WINDOW_MS, ts).first();
        if (d) { await env.DB.prepare("INSERT INTO journal_pairs (uuid, prompt_id, ts) VALUES (?,?,?)").bind(uuid, d.id, now).run(); return dup(d); }
      }
    } else if (sessionId && source !== "hook") {
      const d = await env.DB.prepare("SELECT id, sha, project, app FROM journal WHERE session_id = ? AND key_sha = ? AND abs(ts - ?) < ? ORDER BY abs(ts - ?) LIMIT 1").bind(sessionId, keySha, ts, PAIR_WINDOW_MS, ts).first();
      if (d) return dup(d);
    }
  } catch (e) { return writeErr(e); }
  const id = newId("jr");
  const rec = {
    id, ts, received: now,
    project: str(body.project, 120) || null, app: str(body.app, 120) || null, session_id: sessionId,
    seq: body.seq == null ? null : num(body.seq), agent: str(body.agent || "claude-code", 40),
    source, arrival: ARRIVALS.has(body.arrival) ? body.arrival : "api",
    text, sha, key_sha: keySha, chars: text.length, words: words(text), redactions, truncated, uuid,
    cwd: str(body.cwd, 300) || null, meta: body.meta && typeof body.meta === "object" ? JSON.stringify(body.meta).slice(0, 4000) : null,
  };
  try {
    await env.DB.prepare(`INSERT INTO journal (id,ts,received,project,app,session_id,seq,agent,source,arrival,text,sha,key_sha,chars,words,redactions,truncated,uuid,cwd,meta)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(rec.id, rec.ts, rec.received, rec.project, rec.app, rec.session_id, rec.seq, rec.agent, rec.source, rec.arrival, rec.text, rec.sha, rec.key_sha, rec.chars, rec.words, rec.redactions, rec.truncated, rec.uuid, rec.cwd, rec.meta).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e)) && uuid) { const d = await env.DB.prepare("SELECT id, sha, project, app FROM journal WHERE uuid = ?").bind(uuid).first(); if (d) return json({ ok: true, id: d.id, sha: d.sha, duplicate: true, project: d.project, app: d.app, url: origin + "/journal#id=" + d.id }); }
    return writeErr(e);
  }
  const photos = [];
  for (const p of (Array.isArray(body.photos) ? body.photos : [])) {   /* every pasted picture; each is capped at MAX_PHOTO_BYTES, the request by the platform */
    if (!p) continue;
    const put = await putPhoto(env, typeof p === "string" ? p : (p.dataUrl || p.data)).catch(() => null);
    if (!put) continue;
    const pid = newId("jp");
    try {
      await env.DB.prepare("INSERT INTO journal_photos (id,prompt_id,ts,key,kind,caption,width,height,bytes,type,by) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(pid, id, now, put.key, KINDS.has(p.kind) ? p.kind : "pasted", str(p.caption, 160) || null, num(p.width) || null, num(p.height) || null, put.bytes, put.type, by).run();
      photos.push({ id: pid, kind: KINDS.has(p.kind) ? p.kind : "pasted", url: await photoUrl(env, origin, put.key) });
    } catch {}
  }
  return json({ ok: true, id, ts, sha, chars: rec.chars, words: rec.words, redactions, truncated: !!truncated, project: rec.project, app: rec.app, photos, url: origin + "/journal#id=" + id });
}

export async function handleJournal(request, env, url) {
  const { pathname } = url, origin = url.origin, method = request.method;
  if (!pathname.startsWith("/api/journal") && pathname !== "/journal") return null;

  if (pathname === "/journal" && (method === "GET" || method === "HEAD")) {
    const res = await env.ASSETS.fetch(new Request(new URL("/journal.html", request.url), { method: "GET" }));
    const h = new Headers(res.headers); h.set("x-robots-tag", "noindex, nofollow"); h.set("cache-control", "no-store");
    return new Response(method === "HEAD" ? null : res.body, { status: res.status, headers: h });
  }

  // a photo, only with a valid signature (links come from GET /api/journal and expire)
  if (pathname.startsWith("/api/journal/img/") && (method === "GET" || method === "HEAD")) {
    const key = decodeURIComponent(pathname.slice("/api/journal/img/".length));
    if (!/^pj\/[a-f0-9]{32}\.(png|jpg|webp|gif|avif)$/.test(key)) return json({ ok: false, error: "bad key" }, 400);
    const exp = num(url.searchParams.get("e")), s = url.searchParams.get("s") || "";
    if (env.LEDGER_WRITE_TOKEN) {
      if (!exp || exp < Date.now()) return json({ ok: false, error: "link expired — reload the journal" }, 401);
      if (s !== await sign(env.LEDGER_WRITE_TOKEN, key, exp)) return json({ ok: false, error: "bad signature" }, 401);
    }
    if (!env.SHOTS) return json({ ok: false, error: "no store" }, 404);
    const obj = await env.SHOTS.get(key); if (!obj) return json({ ok: false, error: "not found" }, 404);
    const h = new Headers({ "content-type": (obj.httpMetadata && obj.httpMetadata.contentType) || "image/png", "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff", "x-robots-tag": "noindex" });
    if (typeof obj.size === "number") h.set("content-length", String(obj.size));
    return new Response(method === "HEAD" ? null : obj.body, { headers: h });
  }

  if (!owner(request, env)) return json({ ok: false, error: "unauthorized — the prompt journal is private; send x-ledger-key" }, 401);
  if (!env.DB) return json({ ok: false, error: "no database" }, 503);

  if (pathname === "/api/journal" && method === "POST") {
    let body; try { body = await request.json(); } catch { return json({ ok: false, error: "invalid JSON" }, 400); }
    if (Array.isArray(body)) {           // a batch (the sweep) — each item answered in order
      const out = []; for (const b of body.slice(0, 100)) out.push(await (await insertPrompt(env, origin, b || {}, str(b && b.by || "sweep", 40))).json());
      return json({ ok: true, results: out });
    }
    return insertPrompt(env, origin, body || {}, str(body && body.by || body && body.agent || "api", 40));
  }

  if (pathname === "/api/journal/photo" && method === "POST") {
    const ct = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    let promptId, sessionId, caption, kind, width, height, input, by;
    if (ct.startsWith("image/")) {
      const buf = new Uint8Array(await request.arrayBuffer()); buf.type = ct; input = buf;
      promptId = url.searchParams.get("prompt"); sessionId = url.searchParams.get("session"); caption = url.searchParams.get("caption"); kind = url.searchParams.get("kind"); by = url.searchParams.get("by");
    } else {
      let b; try { b = await request.json(); } catch { return json({ ok: false, error: "invalid JSON" }, 400); }
      ({ promptId, sessionId, caption, kind, width, height, by } = b || {}); input = b && (b.dataUrl || b.data);
    }
    try {
      let pid = str(promptId, 40);
      if (!pid && sessionId) { const r = await env.DB.prepare("SELECT id FROM journal WHERE session_id = ? ORDER BY ts DESC LIMIT 1").bind(str(sessionId, 80)).first(); pid = r && r.id; }
      if (!pid) return json({ ok: false, error: "promptId (or sessionId for its latest prompt) is required" }, 400);
      const row = await env.DB.prepare("SELECT id FROM journal WHERE id = ?").bind(pid).first();
      if (!row) return json({ ok: false, error: "no such prompt" }, 404);
      const size = input instanceof Uint8Array ? input.length : null;
      if (size) { const dup = await env.DB.prepare("SELECT id, key FROM journal_photos WHERE prompt_id = ? AND bytes = ? AND type = ?").bind(pid, size, input.type).first();
        if (dup) return json({ ok: true, id: dup.id, promptId: pid, duplicate: true, url: await photoUrl(env, origin, dup.key), view: origin + "/journal#id=" + pid }); }
      const put = await putPhoto(env, input);
      if (!put) return json({ ok: false, error: "no valid image (png/jpg/webp/gif/avif, max 5MB)" }, 400);
      if (!size) { const dup = await env.DB.prepare("SELECT id, key FROM journal_photos WHERE prompt_id = ? AND bytes = ? AND type = ?").bind(pid, put.bytes, put.type).first();
        if (dup) return json({ ok: true, id: dup.id, promptId: pid, duplicate: true, url: await photoUrl(env, origin, dup.key), view: origin + "/journal#id=" + pid }); }
      const id = newId("jp"), now = Date.now();
      await env.DB.prepare("INSERT INTO journal_photos (id,prompt_id,ts,key,kind,caption,width,height,bytes,type,by) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id, pid, now, put.key, KINDS.has(kind) ? kind : "shot", str(caption, 160) || null, num(width) || null, num(height) || null, put.bytes, put.type, str(by || "agent", 40)).run();
      return json({ ok: true, id, promptId: pid, url: await photoUrl(env, origin, put.key), view: origin + "/journal#id=" + pid });
    } catch (e) { return writeErr(e); }
  }

  if (pathname === "/api/journal/refile" && method === "POST") {
    let b; try { b = await request.json(); } catch { return json({ ok: false, error: "invalid JSON" }, 400); }
    const pid = str(b && b.promptId, 40), project = str(b && b.project, 120) || null, app = str(b && b.app, 120) || null;
    if (!pid || (!project && !app)) return json({ ok: false, error: "promptId and a project or app are required" }, 400);
    try {
      const row = await env.DB.prepare("SELECT id FROM journal WHERE id = ?").bind(pid).first();
      if (!row) return json({ ok: false, error: "no such prompt" }, 404);
      const id = newId("jf");
      await env.DB.prepare("INSERT INTO journal_refile (id,prompt_id,ts,project,app,by) VALUES (?,?,?,?,?,?)").bind(id, pid, Date.now(), project, app, str(b.by || "agent", 40)).run();
      return json({ ok: true, id, promptId: pid, project, app });
    } catch (e) { return writeErr(e); }
  }

  if (pathname === "/api/journal" && method === "GET") {
    const q = url.searchParams, where = [], bind = [];
    const project = q.get("project"); if (project) { where.push("(COALESCE(r.project, j.project) = ? OR COALESCE(r.app, j.app) = ?)"); bind.push(project, project); }
    const session = q.get("session"); if (session) { where.push("j.session_id = ?"); bind.push(session); }
    const from = parseWhen(q.get("from")); if (from) { where.push("j.ts >= ?"); bind.push(from); }
    const to = parseWhen(q.get("to")); if (to) { where.push("j.ts <= ?"); bind.push(/^\d{4}-\d{2}-\d{2}$/.test(q.get("to") || "") ? to + 86_399_999 : to); }
    const text = (q.get("q") || "").trim().toLowerCase(); if (text) { where.push("instr(lower(j.text), ?) > 0"); bind.push(text); }
    if (q.get("photos") === "1") where.push("EXISTS (SELECT 1 FROM journal_photos p WHERE p.prompt_id = j.id)");
    const arrival = q.get("arrival"); if (arrival && ARRIVALS.has(arrival)) { where.push("j.arrival = ?"); bind.push(arrival); }
    const source = q.get("source"); if (source && SOURCES.has(source)) { where.push("j.source = ?"); bind.push(source); }
    const id = q.get("id"); if (id) { where.push("j.id = ?"); bind.push(id); }
    const before = parseWhen(q.get("before")); if (before) { where.push("j.ts < ?"); bind.push(before); }
    const W = where.length ? " WHERE " + where.join(" AND ") : "";
    const limit = Math.min(1000, Math.max(1, num(q.get("limit")) || 300));
    const order = q.get("order") === "asc" ? "ASC" : "DESC";
    try {
      const [rows, total, projects, summary] = await Promise.all([
        env.DB.prepare(`SELECT j.*, r.project AS r_project, r.app AS r_app ${FROM}${W} ORDER BY j.ts ${order} LIMIT ?`).bind(...bind, limit + 1).all(),
        env.DB.prepare(`SELECT COUNT(*) AS n ${FROM}${W}`).bind(...bind).first(),
        env.DB.prepare(`SELECT COALESCE(r.app, j.app, r.project, j.project, 'unfiled') AS k, MAX(COALESCE(r.app, j.app)) AS app, MAX(COALESCE(r.project, j.project)) AS project,
            COUNT(*) AS n, MIN(j.ts) AS first, MAX(j.ts) AS last, SUM(j.words) AS words,
            SUM(EXISTS (SELECT 1 FROM journal_photos p WHERE p.prompt_id = j.id)) AS with_photos ${FROM} GROUP BY k ORDER BY last DESC`).all(),
        env.DB.prepare(`SELECT (SELECT COUNT(*) FROM journal) AS prompts, (SELECT COUNT(*) FROM journal_photos) AS photos, (SELECT COUNT(DISTINCT session_id) FROM journal) AS sessions,
            (SELECT COALESCE(SUM(words),0) FROM journal) AS words, (SELECT COUNT(*) FROM journal WHERE ts >= ?) AS today, (SELECT COUNT(*) FROM journal WHERE ts >= ?) AS week,
            (SELECT COUNT(*) FROM journal WHERE redactions > 0) AS redacted, (SELECT MIN(ts) FROM journal) AS first, (SELECT MAX(ts) FROM journal) AS last`)
          .bind(parseWhen(q.get("dayStart")) || Date.now() - 86_400_000, Date.now() - 7 * 86_400_000).first(),
      ]);
      let list = (rows.results || []);
      const more = list.length > limit; if (more) list = list.slice(0, limit);
      const prompts = list.map(mapPrompt);
      if (prompts.length) {
        const ids = prompts.map((p) => p.id), byId = new Map(prompts.map((p) => [p.id, p]));
        for (let i = 0; i < ids.length; i += 90) {          // D1 binds are capped; page through the ids
          const chunk = ids.slice(i, i + 90);
          const ph = await env.DB.prepare(`SELECT * FROM journal_photos WHERE prompt_id IN (${chunk.map(() => "?").join(",")}) ORDER BY ts`).bind(...chunk).all();
          for (const r of (ph.results || [])) byId.get(r.prompt_id).photos.push(await mapPhoto(env, origin, r));
        }
      }
      return json({ ok: true, now: Date.now(), count: prompts.length, total: total ? total.n : prompts.length, more, nextBefore: more ? prompts[prompts.length - 1].ts : null,
        prompts, projects: (projects.results || []).map((p) => ({ key: p.k, app: p.app, project: p.project, count: p.n, first: p.first, last: p.last, words: p.words, withPhotos: p.with_photos })),
        summary: summary || null });
    } catch (e) { return json({ ok: false, error: String(e) }, 500); }
  }

  if (pathname.startsWith("/api/journal")) return json({ ok: false, error: "not found" }, 404);
  return null;
}
