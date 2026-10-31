// Bug Ledger worker: static site + a small check-log API backed by D1.
// Static assets (index.html, data*.js, bugs.json, AGENT.md, llms.txt, …) are served
// by the ASSETS binding. Only /api/* is handled here.

// Shared sanitizer engine (same rules as the /sanitize tool + scan.mjs). Every free-text
// field written to the append-only ledger is cleaned of hidden / AI-inserted / smuggled
// Unicode first, so the ledger itself never stores an invisible payload. The "safe" preset
// keeps emoji and multilingual text intact.
import Sanitize from "../public/sanitize.js";
import { redactPublic } from "./redact.mjs";
import { handleJournal } from "./journal.mjs";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-ledger-key",
  "cache-control": "no-store",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
// map the append-only DB triggers to a clean response instead of a raw 500
const appendOnly = (e) => /append-only|immutable|cannot be deleted/i.test(String(e));
const writeErr = (e) => appendOnly(e)
  ? json({ ok: false, error: "rejected — the ledger is append-only" }, 403)
  : json({ ok: false, error: String(e) }, 500);

const str = (v, max) => (typeof v === "string" ? v : v == null ? "" : String(v)).slice(0, max);
const num = (v) => (Number.isFinite(+v) ? Math.trunc(+v) : 0);
const arr = (v, max, mapper) => (Array.isArray(v) ? v.slice(0, max).map(mapper) : []);
const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
// like str(), but first strips hidden / AI-inserted / smuggled Unicode (safe preset keeps
// emoji + multilingual). Use for human/agent free-text so the append-only ledger stays clean.
const cleanStr = (v, max) => {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  try { return (Sanitize.hasSuspect(s) ? Sanitize.clean(s, { preset: "safe" }) : s).slice(0, max); }
  catch { return s.slice(0, max); }
};

// ---- evidence dimension: HOW was a check verified, not just whether it was listed ----
// Ranked strongest→weakest so a duplicate report keeps its best evidence. "verified" = the
// top three (a detector ran, code was read, or a test passed); reasoned/assumed are claims.
const EV_RANK = { detector: 5, test: 4, "code-read": 3, reasoned: 2, assumed: 1 };
const EV_KEYS = ["detector", "code-read", "test", "reasoned", "assumed"];
const EV_VERIFIED = new Set(["detector", "code-read", "test"]);
const normVer = (v) => {
  const s = String(v || "").toLowerCase().replace(/[\s_]+/g, "-");
  if (s === "detector" || s === "scan" || s === "scanner" || s === "static") return "detector";
  if (s === "code-read" || s === "code" || s === "read" || s === "coderead" || s === "source") return "code-read";
  if (s === "test" || s === "tested" || s === "e2e" || s === "unit") return "test";
  if (s === "assumed" || s === "assume" || s === "guess" || s === "guessed") return "assumed";
  return "reasoned"; // honest default — "listed but not inspected" is reasoned, never counted as verified
};

// ---- screenshots (R2) : let a finding carry before/after pictures ----
// Only known raster types (never SVG — it can carry script), served with nosniff.
const IMG_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
const MAX_SHOT_BYTES = 5 * 1024 * 1024; // 5MB per image
function b64ToBytes(b64) {
  const bin = atob(b64), len = bin.length, out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
  return out;
}
// Persist one image and return its /api/shot/<key> url. Accepts a data: URL (uploads to R2),
// an already-hosted /api/shot url or http(s) url (kept as-is). Returns a url string or null.
async function saveShot(env, input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^\/api\/shot\/[a-z0-9._-]+$/i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s.slice(0, 400);
  const m = /^data:(image\/[a-z0-9+.-]+);base64,([\s\S]+)$/i.exec(s);
  if (!m || !env.SHOTS) return null;
  const type = m[1].toLowerCase(), ext = IMG_EXT[type];
  if (!ext) return null;
  let bytes; try { bytes = b64ToBytes(m[2].replace(/\s+/g, "")); } catch { return null; }
  if (!bytes.length || bytes.length > MAX_SHOT_BYTES) return null;
  const key = crypto.randomUUID().replace(/-/g, "") + "." + ext;
  await env.SHOTS.put(key, bytes, { httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" } });
  return "/api/shot/" + key;
}
// Normalize a shots list: [{url|dataUrl, caption}] (or bare url strings) → [{url, caption}], max 6.
async function normShots(env, list) {
  const out = [];
  for (const it of (Array.isArray(list) ? list.slice(0, 6) : [])) {
    if (!it) continue;
    const src = typeof it === "string" ? it : (it.url || it.dataUrl || it.data);
    const url = await saveShot(env, src);
    if (url) out.push({ url, caption: str(typeof it === "string" ? "" : (it.caption || it.label || ""), 80) });
  }
  return out;
}

// the app catalog (bug titles per app) — read from the static checklist.json, cached per isolate
// (never cache a failure/empty, or one bad fetch would poison the isolate forever)
let _catalog = null;
async function catalog(env, request) {
  if (_catalog && _catalog.apps && Object.keys(_catalog.apps).length) return _catalog;
  try {
    const res = await env.ASSETS.fetch(new Request(new URL("/checklist.json", request.url)));
    const j = await res.json();
    if (j && j.apps && Object.keys(j.apps).length) { _catalog = j; return j; }
    return { apps: {} };
  } catch { return { apps: {} }; }
}

// ---- accounts: a front-page sign-up creates a workspace with its own write key ----
// Keys look like blk_<40 hex>; only the SHA-256 is stored, so a key is shown exactly once.
// Writes stay owner-only (LEDGER_WRITE_TOKEN): every write lands in the shared public ledger that
// agents read, so a workspace key unlocks nothing until private workspaces exist. Sign-ups are
// capped per hour so the form can't be used to flood the accounts table.
const KEY_RE = /^blk_[a-f0-9]{40}$/;
const PLANS = ["free", "pro", "max", "ultra", "team", "business"]; /* pro/max/ultra since 31 Oct 2026; team/business kept for existing sign-ups */
const SIGNUPS_PER_HOUR = 60;
async function sha256hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function account(request, env) {
  const key = request.headers.get("x-ledger-key") || "";
  if (!KEY_RE.test(key) || !env.DB) return null;
  try { return await env.DB.prepare("SELECT id, name, plan, ts FROM accounts WHERE key_hash = ?").bind(await sha256hex(key)).first(); }
  catch { return null; }
}

export default {
  /* public reads go out with the owner's confidential stack names replaced by categories (src/redact.mjs) */
  async fetch(request, env) { return redactPublic(request, env, await handle(request, env)); },
};

async function handle(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const siteOrigin = url.origin; // links handed back follow the host that served the request, so one build serves both bugledger and breadledger

    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: JSON_HEADERS });

    // ---- Prompt Journal (owner-only; src/journal.mjs): /journal, /api/journal, /api/journal/photo, /api/journal/refile, /api/journal/img/* ----
    const journalRes = await handleJournal(request, env, url);
    if (journalRes) return journalRes;

    // ---- GET/HEAD /api/shot/:key : serve a stored screenshot from R2 (public read) ----
    if (pathname.startsWith("/api/shot/") && (request.method === "GET" || request.method === "HEAD")) {
      const key = decodeURIComponent(pathname.slice("/api/shot/".length));
      if (!/^[a-z0-9._-]+$/i.test(key) || key.includes("..")) return json({ ok: false, error: "bad key" }, 400);
      if (!env.SHOTS) return json({ ok: false, error: "no store" }, 404);
      try {
        const obj = await env.SHOTS.get(key);
        if (!obj) return json({ ok: false, error: "not found" }, 404);
        const h = new Headers();
        h.set("content-type", (obj.httpMetadata && obj.httpMetadata.contentType) || "image/png");
        h.set("cache-control", "public, max-age=31536000, immutable");
        h.set("x-content-type-options", "nosniff");
        h.set("access-control-allow-origin", "*");
        if (obj.httpEtag) h.set("etag", obj.httpEtag);
        if (typeof obj.size === "number") h.set("content-length", String(obj.size));
        // HEAD gets headers only — link unfurlers and probes use it, and a body would be discarded
        return new Response(request.method === "HEAD" ? null : obj.body, { headers: h });
      } catch (e) { return json({ ok: false, error: String(e) }, 500); }
    }

    // ---- POST /api/shot : upload one screenshot → { url } (token-gated) ----
    // Body is either a raw image/* payload, or JSON { dataUrl }.
    if (pathname === "/api/shot" && request.method === "POST") {
      if (env.LEDGER_WRITE_TOKEN && request.headers.get("x-ledger-key") !== env.LEDGER_WRITE_TOKEN)
        return json({ ok: false, error: "unauthorized — missing or wrong x-ledger-key" }, 401);
      if (!env.SHOTS) return json({ ok: false, error: "no screenshot store configured" }, 500);
      try {
        const ct = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        let url = null;
        if (ct.startsWith("image/")) {
          const ext = IMG_EXT[ct];
          if (!ext) return json({ ok: false, error: "unsupported image type" }, 415);
          const buf = new Uint8Array(await request.arrayBuffer());
          if (!buf.length || buf.length > MAX_SHOT_BYTES) return json({ ok: false, error: "empty or too large (max 5MB)" }, 413);
          const key = crypto.randomUUID().replace(/-/g, "") + "." + ext;
          await env.SHOTS.put(key, buf, { httpMetadata: { contentType: ct, cacheControl: "public, max-age=31536000, immutable" } });
          url = "/api/shot/" + key;
        } else {
          const body = await request.json().catch(() => null);
          url = await saveShot(env, body && (body.dataUrl || body.url || body.data));
        }
        if (!url) return json({ ok: false, error: "no valid image (send an image/* body or JSON {dataUrl})" }, 400);
        return json({ ok: true, url, view: siteOrigin + url });
      } catch (e) { return writeErr(e); }
    }


    // ---- POST /api/signup : create a workspace → { key } (shown once; only its hash is kept) ----
    if (pathname === "/api/signup" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "invalid JSON" }, 400); }
      const email = str(body && body.email, 120).trim().toLowerCase();
      const name = cleanStr(body && body.name, 80).trim();
      const plan = PLANS.includes(body && body.plan) ? body.plan : "free";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "a valid email is required" }, 400);
      if (!name) return json({ ok: false, error: "a name is required" }, 400);
      if (!env.DB) return json({ ok: false, error: "sign-up is not available right now" }, 503);
      try {
        const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM accounts WHERE ts > ?").bind(Date.now() - 3600_000).first();
        if (r && r.n >= SIGNUPS_PER_HOUR) return json({ ok: false, error: "too many sign-ups right now — please try again in an hour" }, 429);
      } catch (e) { return writeErr(e); }
      const key = "blk_" + [...crypto.getRandomValues(new Uint8Array(20))].map((b) => b.toString(16).padStart(2, "0")).join("");
      const id = crypto.randomUUID(), ts = Date.now();
      try {
        await env.DB.prepare("INSERT INTO accounts (id, ts, email, name, plan, key_hash, key_prefix) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(id, ts, email, name, plan, await sha256hex(key), key.slice(0, 10)).run();
      } catch (e) {
        if (/UNIQUE/i.test(String(e))) return json({ ok: false, error: "that email already has a workspace — use the key you were given at sign-up" }, 409);
        return writeErr(e);
      }
      return json({ ok: true, id, name, plan, key });
    }
    // ---- GET /api/whoami : check a workspace key → { plan, name } ----
    if (pathname === "/api/whoami" && request.method === "GET") {
      const a = await account(request, env);
      if (!a) return json({ ok: false, error: "unknown key" }, 401);
      return json({ ok: true, name: a.name, plan: a.plan, since: a.ts });
    }

    // ---- /admin : the recurrence admin (static page; the API it calls is token-gated) ----
    if (pathname === "/admin" && (request.method === "GET" || request.method === "HEAD")) {
      const res = await env.ASSETS.fetch(new Request(new URL("/admin.html", request.url), { method: "GET" }));
      return new Response(request.method === "HEAD" ? null : res.body, { status: res.status, headers: res.headers });
    }

    // ---- Prompt ledgers: every prompt in a session with its status (add-only, x-ledger-key), shown at /prompts/:id ----
    if (pathname === "/api/prompts" && request.method === "POST") {
      if (env.LEDGER_WRITE_TOKEN && request.headers.get("x-ledger-key") !== env.LEDGER_WRITE_TOKEN) return json({ ok: false, error: "unauthorized — send x-ledger-key" }, 401);
      const d = await request.json().catch(() => ({})); const cl = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
      const ST = ["done", "built", "partial", "not", "waiting", "paused", "answered", "stopped"];
      const body = { kind: "ledger", title: cl(d.title, 200) || "Prompt ledger", summary: cl(d.summary, 2000), at: Date.now(),
        items: (Array.isArray(d.items) ? d.items : []).slice(0, 300).map((x, i) => ({ n: +(x && x.n) || i + 1, g: cl(x && x.g, 80), p: cl(x && x.p, 500), s: ST.includes(x && x.s) ? x.s : "not", d: cl(x && x.d, 600) })).filter(x => x.p),
        photos: Object.fromEntries(Object.entries(d.photos && typeof d.photos === "object" ? d.photos : {}).slice(0, 30).map(([k, v]) => [cl(k, 80), (Array.isArray(v) ? v : [v]).slice(0, 8).map(x => String(x || "")).filter(x => /^\/ledger\/img\/[a-z0-9.\-]+$/i.test(x))])) };
      const id = "pl" + crypto.randomUUID().replace(/-/g, "").slice(0, 18);
      await env.DB.prepare("INSERT INTO prompt_ledgers (id, project, title, body, at) VALUES (?, ?, ?, ?, ?)").bind(id, cl(d.project, 80), body.title, JSON.stringify(body), body.at).run();
      return json({ ok: true, id, url: new URL(request.url).origin + "/prompts/" + id });
    }
    if (pathname.startsWith("/prompts/") && (request.method === "GET" || request.method === "HEAD")) {
      const id = pathname.split("/")[2] || ""; const row = id ? await env.DB.prepare("SELECT project, title, body, at FROM prompt_ledgers WHERE id = ?").bind(id).first() : null;
      let d = null; if (row) { try { d = JSON.parse(row.body); } catch {} }
      if (!row || !d) return new Response("No such prompt ledger", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
      return new Response(request.method === "HEAD" ? null : ledgerPage(row, d), { headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } });
    }

    // ---- /story/:id : the itemised scan story (served by report.html, which reads the path) ----
    if (pathname.startsWith("/story/") && (request.method === "GET" || request.method === "HEAD")) {
      const res = await env.ASSETS.fetch(new Request(new URL("/report", request.url), { method: "GET" }));
      return new Response(request.method === "HEAD" ? null : res.body, { status: res.status, headers: res.headers });
    }

    // ---- POST /api/session/event : append narrative events to a live session's story ----
    // Body: { sessionId, events:[{kind,phase,severity,status,category,confidence,verifiedBy,title,detail,
    //         impact,fix,file,ref,before,after,meta,seq}] }  (or a single event with sessionId on it).
    // Append-only: every event is immutable once written; a later "fixed" event references the
    // earlier "found" event by id instead of editing it.
    if (pathname === "/api/session/event" && request.method === "POST") {
      if (env.LEDGER_WRITE_TOKEN && request.headers.get("x-ledger-key") !== env.LEDGER_WRITE_TOKEN)
        return json({ ok: false, error: "unauthorized" }, 401);
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "invalid JSON" }, 400); }
      const sessionId = str(body && body.sessionId, 60);
      if (!sessionId) return json({ ok: false, error: "sessionId required" }, 400);
      const list = Array.isArray(body.events) ? body.events.slice(0, 50) : [body];
      try {
        const sess = await env.DB.prepare("SELECT id FROM sessions WHERE id = ?").bind(sessionId).first();
        if (!sess) return json({ ok: false, error: "session not found — run worklog.mjs start first" }, 404);
        const now = Date.now(), ids = [];
        const stmts = [];
        list.forEach((e, i) => {
          if (!e) return;
          const kind = EVENT_KINDS.has(e.kind) ? e.kind : "say";
          const id = crypto.randomUUID(); ids.push(id);
          stmts.push(env.DB.prepare(
            `INSERT INTO session_events (id,session_id,ts,seq,kind,phase,severity,status,category,confidence,verified_by,title,detail,impact,fix,file,ref,before_v,after_v,meta)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          ).bind(id, sessionId, now + i, num(e.seq) || null, kind, cleanStr(e.phase, 120),
            normSev(e.severity), normStatus(e.status), str(e.category, 30) || null,
            e.confidence === "high" || e.confidence === "review" ? e.confidence : null,
            e.verifiedBy ? normVer(e.verifiedBy) : null,
            ...(() => { const t = cleanStr(e.title, 1200), d = cleanStr(e.detail, 1200);   // long headline: trim it, keep the whole text in detail
              return t.length > 200 ? [t.slice(0, 197).replace(/\s+\S*$/, "") + "…", d || t] : [t, d]; })(),
            cleanStr(e.impact, 600), cleanStr(e.fix, 800),
            str(e.file, 200), str(e.ref, 60) || null,
            e.before == null ? null : str(e.before, 60), e.after == null ? null : str(e.after, 60),
            e.meta && typeof e.meta === "object" ? JSON.stringify(e.meta).slice(0, 1000) : null));
        });
        if (!stmts.length) return json({ ok: false, error: "no events" }, 400);
        stmts.push(env.DB.prepare("UPDATE sessions SET updated = ? WHERE id = ? AND status = 'active'").bind(now, sessionId));   // any move keeps the card "working"
        await env.DB.batch(stmts);
        return json({ ok: true, ids, count: ids.length, story: siteOrigin + "/story/" + sessionId });
      } catch (e) { return writeErr(e); }
    }

    // ---- GET /api/story?id=<session> : the whole story — session + events + linked checks/additions + previous run ----
    if (pathname === "/api/story" && request.method === "GET") {
      const id = url.searchParams.get("id");
      if (!id) return json({ ok: false, error: "id required" }, 400);
      try {
        const row = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first();
        if (!row) return json({ ok: false, error: "not found" }, 404);
        const session = mapSession(row);
        const [ev, ck, sb] = await Promise.all([
          env.DB.prepare("SELECT * FROM session_events WHERE session_id = ? AND kind != 'act' ORDER BY ts ASC, seq ASC LIMIT 2000").bind(id).all(),
          env.DB.prepare("SELECT * FROM checks WHERE session_id = ? ORDER BY ts ASC LIMIT 100").bind(id).all(),
          env.DB.prepare("SELECT * FROM submitted WHERE session_id = ? ORDER BY ts ASC LIMIT 200").bind(id).all(),
        ]);
        const events = (ev.results || []).map(mapEvent);
        const checks = (ck.results || []).map(mapCheck);
        const additions = (sb.results || []).map(mapSubmitted);
        // Every earlier scan of the same app that narrated a story → the full lineage (history),
        // each summarised to a rollup. `previous` stays the immediately-preceding one for the
        // progress line. One events query for all of them, grouped in JS.
        let previous = null, history = [];
        try {
          const prevRows = await env.DB.prepare(
            `SELECT s.id, s.started, s.updated, s.title, s.status FROM sessions s
             WHERE s.app = ? AND s.started < ? AND s.id <> ?
               AND EXISTS (SELECT 1 FROM session_events e WHERE e.session_id = s.id AND e.kind IN ('found','metric','verdict','clean'))
             ORDER BY s.started DESC LIMIT 20`).bind(session.app, session.started, id).all();
          const rows = prevRows.results || [];
          if (rows.length) {
            const ph = rows.map(() => "?").join(",");
            const allEv = await env.DB.prepare(
              `SELECT * FROM session_events WHERE session_id IN (${ph}) AND kind != 'act' ORDER BY ts ASC, seq ASC LIMIT 12000`
            ).bind(...rows.map((r) => r.id)).all();
            const byS = new Map();
            for (const e of (allEv.results || [])) { if (!byS.has(e.session_id)) byS.set(e.session_id, []); byS.get(e.session_id).push(mapEvent(e)); }
            history = rows.map((r) => ({ id: r.id, started: r.started, updated: r.updated, title: r.title, status: r.status, rollup: rollup(byS.get(r.id) || []) }));
            previous = history[0] || null;
          }
        } catch {}
        return json({ ok: true, session, events, checks, additions, rollup: rollup(events), previous, history });
      } catch (e) { return json({ ok: false, error: String(e) }, 500); }
    }

    // ---- GET /api/admin/recurrence : every bug INSTANCE from every tier, for the admin recurrence view ----
    // Token-gated (same x-ledger-key). Returns raw instances; the page clusters them into bug classes
    // (detector id, then fuzzy title) so the same bug can be seen popping up across apps and analyses.
    if (pathname === "/api/admin/recurrence" && request.method === "GET") {
      if (env.LEDGER_WRITE_TOKEN && request.headers.get("x-ledger-key") !== env.LEDGER_WRITE_TOKEN)
        return json({ ok: false, error: "unauthorized — send x-ledger-key" }, 401);
      try {
        const asset = async (name) => { try { const r = await env.ASSETS.fetch(new Request(new URL(name, request.url))); return r.ok ? await r.json() : []; } catch { return []; } };
        const [bugs, harvested, scans, sub, chk, ev, sess] = await Promise.all([
          asset("/bugs.json"), asset("/harvested.json"), asset("/scan-findings.json"),
          env.DB.prepare("SELECT id,ts,app,project,kind,title,category,severity,file,session_id FROM submitted ORDER BY ts DESC LIMIT 10000").all(),
          env.DB.prepare("SELECT id,ts,app,project,scope,found,session_id FROM checks ORDER BY ts DESC LIMIT 5000").all(),
          env.DB.prepare("SELECT e.id,e.ts,e.title,e.severity,e.status,e.category,e.file,e.session_id,e.meta,s.app,s.project FROM session_events e JOIN sessions s ON s.id=e.session_id WHERE e.kind='found' ORDER BY e.ts DESC LIMIT 20000").all(),
          env.DB.prepare("SELECT id,started,updated,app,project,title,status FROM sessions ORDER BY started DESC LIMIT 5000").all(),
        ]);
        const inst = [];
        const dateTs = (d) => { const t = Date.parse(d || ""); return Number.isFinite(t) ? t : null; };
        for (const b of (Array.isArray(bugs) ? bugs : [])) inst.push({ source: "catalogue", app: b.app, title: b.title, category: b.category, severity: b.severity || null, file: null, ts: dateTs(b.date) , ref: null, refKind: null, note: b.symptom ? String(b.symptom).slice(0, 200) : null });
        for (const h of (Array.isArray(harvested) ? harvested : [])) inst.push({ source: "harvested", app: h.app, title: h.title, category: h.category, severity: h.severity || null, file: null, ts: dateTs(h.found), ref: null, refKind: null, note: h.symptom ? String(h.symptom).slice(0, 200) : null });
        for (const f of (Array.isArray(scans) ? scans : [])) inst.push({ source: "scanner", app: f.app, title: f.title, category: f.category, severity: f.severity || null, file: f.file ? f.file + ":" + f.line : null, ts: dateTs(f.found), ref: null, refKind: null, detector: f.detector, note: f.excerpt ? String(f.excerpt).slice(0, 160) : null });
        for (const r of (sub.results || [])) inst.push({ source: "submitted", app: r.app, title: r.title, category: r.category, severity: r.severity, file: r.file, ts: r.ts, ref: r.session_id ? "/story/" + r.session_id : null, refKind: r.session_id ? "story" : null, kind: r.kind });
        for (const r of (chk.results || [])) {
          let found = []; try { found = JSON.parse(r.found) || []; } catch {}
          for (const f of found) {
            const m = /^([A-Z][A-Z0-9-]{2,}):\s+(.+)$/.exec(String(f.title || ""));
            inst.push({ source: "check", app: r.app, title: m ? m[2] : f.title, detector: m ? m[1] : undefined, category: null, severity: null, file: f.file || null, ts: r.ts,
              ref: r.session_id ? "/story/" + r.session_id : "/report?id=" + r.id, refKind: r.session_id ? "story" : "report", analysis: r.id, scope: r.scope || "app", verifiedBy: f.verifiedBy || null, note: f.note ? String(f.note).slice(0, 160) : null });
          }
        }
        for (const r of (ev.results || [])) {
          let meta = null; try { meta = JSON.parse(r.meta); } catch {}
          inst.push({ source: "story", app: r.app, title: String(r.title || "").replace(/\s*×\d+$/, ""), detector: meta && meta.detector || undefined, category: r.category, severity: r.severity, status: r.status, file: r.file, ts: r.ts, ref: "/story/" + r.session_id, refKind: "story", analysis: r.session_id });
        }
        const analyses = [];
        for (const r of (chk.results || [])) analyses.push({ kind: "check", id: r.id, ts: r.ts, app: r.app, project: r.project, scope: r.scope || "app", sessionId: r.session_id || null, url: r.session_id ? "/story/" + r.session_id : "/report?id=" + r.id });
        for (const r of (sess.results || [])) analyses.push({ kind: "story", id: r.id, ts: r.started, app: r.app, project: r.project, title: r.title, status: r.status, url: "/story/" + r.id });
        return json({ ok: true, generated: Date.now(), counts: { catalogue: (bugs||[]).length, harvested: (harvested||[]).length, scanner: (scans||[]).length, submitted: (sub.results||[]).length, checks: (chk.results||[]).length, stories: (sess.results||[]).length, instances: inst.length }, instances: inst, analyses });
      } catch (e) { return json({ ok: false, error: String(e) }, 500); }
    }

    // ---- GET /api/checks?app=&limit= : recent agent check-logs ----
    if (pathname === "/api/checks" && request.method === "GET") {
      const app = url.searchParams.get("app");
      const limit = Math.min(200, Math.max(1, num(url.searchParams.get("limit")) || 50));
      try {
        const q = app
          ? env.DB.prepare("SELECT * FROM checks WHERE app = ? ORDER BY ts DESC LIMIT ?").bind(app, limit)
          : env.DB.prepare("SELECT * FROM checks ORDER BY ts DESC LIMIT ?").bind(limit);
        const { results } = await q.all();
        const rows = (results || []).map(mapCheck);
        return json({ ok: true, count: rows.length, checks: rows });
      } catch (e) {
        return json({ ok: false, error: String(e) }, 500);
      }
    }

    // ---- POST /api/checks : record one check-log ----
    if (pathname === "/api/checks" && request.method === "POST") {
      // optional shared-secret gate (set the LEDGER_WRITE_TOKEN secret to require it)
      if (env.LEDGER_WRITE_TOKEN && request.headers.get("x-ledger-key") !== env.LEDGER_WRITE_TOKEN)
        return json({ ok: false, error: "unauthorized — missing or wrong x-ledger-key" }, 401);

      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "invalid JSON body" }, 400); }
      if (!body || !body.app) return json({ ok: false, error: "field 'app' is required" }, 400);

      const id = crypto.randomUUID();
      const ts = Date.now();
      // reported items, each carrying HOW it was verified. notFound accepts a bare title string
      // (legacy → "reasoned") or {title, verifiedBy}; found accepts {title,file,note,verifiedBy}.
      const notFoundItems = arr(body.notFound, 4000, (x) =>
        typeof x === "string" ? { title: str(x, 200), ver: "reasoned" }
                              : { title: str(x && x.title, 200), ver: normVer(x && x.verifiedBy) });
      const foundItems = arr(body.found, 2000, (x) => ({
        title: str(x && x.title, 200), file: str(x && x.file, 200), note: str(x && x.note, 400),
        verifiedBy: normVer(x && x.verifiedBy),
      }));
      const rec = {
        id, ts,
        app: str(body.app, 80),
        project: str(body.project, 300),
        checked_by: str(body.checkedBy || "claude-code", 60),
        scanned: num(body.scanned),
        checked_count: num(body.checkedCount),
        found_count: num(body.foundCount),
        security_status: str(body.securityStatus || "n/a", 20),
        not_found: JSON.stringify(notFoundItems.map((it) => it.title)), // stored shape unchanged (titles)
        found: JSON.stringify(foundItems),                              // now also carries verifiedBy
        security_checked: JSON.stringify(arr(body.securityChecked, 100, (x) => str(x, 120))),
        security_findings: JSON.stringify(arr(body.securityFindings, 100, (x) => ({
          severity: str(x && x.severity, 12), title: str(x && x.title, 200), file: str(x && x.file, 200),
        }))),
        notes: cleanStr(body.notes, 2000),
        session_id: str(body.sessionId, 60) || null,
      };
      // server-verified coverage: match reported titles against the app catalog — or the WHOLE
      // catalog (all apps) when scope:"all", so a full scan is confirmed N/315. Beyond the three
      // macro scopes we also accept a per-FAMILY scope "category:<name>" (e.g. category:accessibility)
      // so quality families that used to be buried inside the bug scan each get their own N/N line.
      const rawScope = str(body.scope, 40);
      const catMatch = /^category:([a-z-]+)$/.exec(rawScope);
      const wantCat = catMatch && CATEGORY_SET.has(catMatch[1]) ? catMatch[1] : null;
      // "full" = the distinct union of every checkable item (bugs + audit findings + optimisers),
      // deduped — one grand-total scope so a deep scan can confirm a single N/N (e.g. 560/560) that
      // spans all phases at once, without the naive 428+67+117 double-count of security-category bugs.
      const scope = wantCat ? `category:${wantCat}`
        : ["all", "security", "optimisers", "full"].includes(rawScope) ? rawScope : "app";
      const cat = await catalog(env, request);
      const appTitles = wantCat ? categoryTitles(cat, wantCat)
        : scope === "all" ? allTitles(cat)
        : scope === "security" ? securityTitles(cat)
        : scope === "optimisers" ? optimiserTitles(cat)
        : scope === "full" ? fullTitles(cat)
        : ((cat.apps && cat.apps[rec.app]) ? cat.apps[rec.app].map((b) => b.title) : []);
      // map each reported title to its STRONGEST evidence, so we can weight coverage by inspection
      const repMap = new Map();
      const addRep = (title, ver) => { const k = norm(title); if (!k) return;
        const cur = repMap.get(k); if (!cur || EV_RANK[ver] > EV_RANK[cur]) repMap.set(k, ver); };
      for (const it of notFoundItems) addRep(it.title, it.ver);
      for (const it of foundItems) addRep(it.title, it.verifiedBy);
      const missed = appTitles.filter((t) => !repMap.has(norm(t)));
      const covTotal = appTitles.length;
      const covMatched = covTotal - missed.length;
      // evidence breakdown over the MATCHED catalog items: how much of the "covered" ground was
      // actually inspected (detector/code-read/test) vs merely reasoned/assumed.
      const evidence = { detector: 0, "code-read": 0, test: 0, reasoned: 0, assumed: 0 };
      for (const t of appTitles) { const v = repMap.get(norm(t)); if (v) evidence[v]++; }
      const covVerified = evidence.detector + evidence["code-read"] + evidence.test;
      try {
        await env.DB.prepare(
          `INSERT INTO checks (id,ts,app,project,checked_by,scanned,checked_count,found_count,security_status,not_found,found,security_checked,security_findings,notes,cov_total,cov_matched,cov_missed,scope,cov_verified,evidence,session_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(rec.id, rec.ts, rec.app, rec.project, rec.checked_by, rec.scanned, rec.checked_count,
               rec.found_count, rec.security_status, rec.not_found, rec.found, rec.security_checked,
               rec.security_findings, rec.notes, covTotal, covMatched, JSON.stringify(missed), scope,
               covVerified, JSON.stringify(evidence), rec.session_id).run();
        const pct = covTotal ? Math.round((covMatched / covTotal) * 100) : 100;
        const verifiedPct = covTotal ? Math.round((covVerified / covTotal) * 100) : 0;
        return json({ ok: true, id, ts, app: rec.app, view: siteOrigin + "/#checks",
          report: siteOrigin + "/report?id=" + id,
          story: rec.session_id ? siteOrigin + "/story/" + rec.session_id : null,
          coverage: { total: covTotal, matched: covMatched, pct, complete: missed.length === 0,
            verified: covVerified, verifiedPct, evidence, missed: missed.slice(0, 60) } });
      } catch (e) {
        return writeErr(e);
      }
    }

    // ---- /now and /now/:id : the "everything I'm doing" board (served by now.html, which reads the path) ----
    if ((pathname === "/now" || pathname.startsWith("/now/")) && (request.method === "GET" || request.method === "HEAD")) {
      const res = await env.ASSETS.fetch(new Request(new URL("/now", request.url), { method: "GET" }));
      return new Response(request.method === "HEAD" ? null : res.body, { status: res.status, headers: res.headers });
    }

    // ---- GET /api/now[?id=] : every session in progress (+ finished in the last 24 h), each with its
    // story tail, features and screenshots — one request feeds the whole Now board. ?id= narrows to one.
    if (pathname === "/api/now" && request.method === "GET") {
      const one = str(url.searchParams.get("id"), 60);
      const now = Date.now();
      try {
        const { results } = one
          ? await env.DB.prepare("SELECT * FROM sessions WHERE id = ?").bind(one).all()
          : await env.DB.prepare("SELECT * FROM sessions WHERE (status = 'active' AND updated > ?) OR (status = 'done' AND updated > ?) ORDER BY updated DESC LIMIT 40")
              .bind(now - 12 * 3600_000, now - 24 * 3600_000).all();
        const sessions = (results || []).map(mapSession);
        if (one && !sessions.length) return json({ ok: false, error: "not found" }, 404);
        const ids = sessions.map((x) => x.id);
        let evs = []; const actN = {};
        if (ids.length) {
          const ph = ids.map(() => "?").join(",");
          const [q, qa, qc] = await Promise.all([
            env.DB.prepare(`SELECT * FROM session_events WHERE session_id IN (${ph}) AND kind != 'act' ORDER BY ts DESC LIMIT ?`).bind(...ids, one ? 600 : 1500).all(),
            // the newest actions of EACH session, so one busy session never crowds the others off the board
            env.DB.prepare(`SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY ts DESC) AS rn FROM session_events WHERE kind = 'act' AND session_id IN (${ph})) WHERE rn <= ?`).bind(...ids, one ? 500 : 40).all(),
            env.DB.prepare(`SELECT session_id, COUNT(*) AS n FROM session_events WHERE kind = 'act' AND session_id IN (${ph}) GROUP BY session_id`).bind(...ids).all(),
          ]);
          evs = (q.results || []).concat((qa.results || []).sort((a, b) => b.ts - a.ts));
          for (const r of qc.results || []) actN[r.session_id] = r.n;
        }
        const by = {};
        for (const e of evs) (by[e.session_id] = by[e.session_id] || []).push(e);
        const out = sessions.map((x) => {
          const list = by[x.id] || [];
          const meta = (e) => safeParse(e.meta, {}) || {};
          const pick = (e) => ({ id: e.id, ts: e.ts, kind: e.kind, phase: e.phase, severity: e.severity, status: e.status,
            category: e.category, title: e.title, detail: e.detail, impact: e.impact, fix: e.fix, file: e.file,
            before: e.before_v, after: e.after_v, meta: meta(e) });
          const story = list.filter((e) => e.kind !== "shot" && e.kind !== "feature" && e.kind !== "act").slice(0, one ? 400 : 14).map(pick);
          // every action the agent took, newest first, each tagged with the step it happened in (phase)
          const acts = list.filter((e) => e.kind === "act").slice(0, one ? 500 : 40).map((e) => { const m = meta(e);
            return { id: e.id, ts: e.ts, text: e.title, step: e.phase || null, icon: m.icon || "act", ok: m.ok === false ? false : true }; });
          const actCount = actN[x.id] || 0;
          const features = list.filter((e) => e.kind === "feature").reverse().map((e) => ({ ts: e.ts, title: e.title, detail: e.detail, status: e.status || null }));
          const shots = list.filter((e) => e.kind === "shot").reverse().map((e) => { const m = meta(e);
            return { ts: e.ts, url: m.url || "", label: e.title || m.label || "", stage: m.stage || null, caption: e.detail || "" }; }).filter((x) => x.url);
          const findings = list.filter((e) => e.kind === "found").length;
          const state = x.status === "done" ? "done" : now - x.updated < 5 * 60_000 ? "working" : "quiet";
          return { ...x, state, story, acts, actCount, features, shots, findings };
        });
        return json({ ok: true, now, count: out.length, sessions: out });
      } catch (e) { return writeErr(e); }
    }

    // ---- GET /api/sessions?active=&limit= : live worklog sessions ----
    if (pathname === "/api/sessions" && request.method === "GET") {
      const limit = Math.min(50, Math.max(1, num(url.searchParams.get("limit")) || 12));
      const activeOnly = url.searchParams.get("active") === "1";
      try {
        const { results } = await env.DB
          .prepare("SELECT * FROM sessions ORDER BY updated DESC LIMIT ?").bind(limit).all();
        let rows = (results || []).map(mapSession);
        // "live" = active and touched within 90s; keep done sessions from the last hour for context
        const now = Date.now();
        rows = rows.map((s) => ({ ...s, live: s.status === "active" && now - s.updated < 90_000 }));
        if (activeOnly) rows = rows.filter((s) => s.live || (s.status === "active" && now - s.updated < 10 * 60_000));
        return json({ ok: true, now, count: rows.length, sessions: rows });
      } catch (e) { return writeErr(e); }
    }
    if (pathname === "/api/session" && request.method === "GET") {
      const id = url.searchParams.get("id");
      if (!id) return json({ ok: false, error: "id required" }, 400);
      try {
        const row = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first();
        return row ? json({ ok: true, session: mapSession(row) }) : json({ ok: false, error: "not found" }, 404);
      } catch (e) { return writeErr(e); }
    }

    // ---- POST /api/session : upsert a live worklog session ----
    if (pathname === "/api/session" && request.method === "POST") {
      if (env.LEDGER_WRITE_TOKEN && request.headers.get("x-ledger-key") !== env.LEDGER_WRITE_TOKEN)
        return json({ ok: false, error: "unauthorized" }, 401);
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "invalid JSON" }, 400); }
      const id = str(body.id, 60) || crypto.randomUUID();
      const now = Date.now();
      // a step carries its plain-English note (desc) and the wave it belongs to; the server stamps when
      // each step started and finished, so the board's timers come from the server, not the agent's clock
      let tasks = arr(body.tasks, 80, (t) => ({
        text: str(t && t.text, 200),
        status: ["pending", "active", "done"].includes(t && t.status) ? t.status : "pending",
        desc: cleanStr(t && t.desc, 600) || undefined,
        wave: cleanStr(t && t.wave, 80) || undefined,
      }));
      const done = tasks.filter((t) => t.status === "done").length;
      const status = body.status === "done" ? "done" : "active";
      const prog = body.progress && Number.isFinite(+body.progress.total) && +body.progress.total > 0
        ? { done: num(body.progress.done), total: num(body.progress.total), label: str(body.progress.label, 40) } : null;
      try {
        const existing = await env.DB.prepare(
          "SELECT started,status,app,project,title,agent,tasks FROM sessions WHERE id = ?").bind(id).first();
        // a finished session is frozen — you can't rewrite history, only start a new one
        if (existing && existing.status === "done")
          return json({ ok: false, error: "session already finished — start a new one" }, 409);
        const started = existing ? existing.started : now;
        tasks = stampTasks(existing ? safeParse(existing.tasks, []) : [], tasks, now);
        // identity is set once at creation and never overwritten on update (append-only integrity)
        const app = existing ? existing.app : cleanStr(body.app, 80);
        const project = existing ? existing.project : cleanStr(body.project, 200);
        const title = existing ? existing.title : cleanStr(body.title, 200);
        const agent = existing ? existing.agent : str(body.agent || "claude-code", 60);
        await env.DB.prepare(
          `INSERT INTO sessions (id,started,updated,app,project,title,agent,status,current,tasks,done_count,total_count,note,prog_done,prog_total,prog_label)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET updated=?,status=?,current=?,tasks=?,done_count=?,total_count=?,note=?,prog_done=?,prog_total=?,prog_label=?`
        ).bind(
          id, started, now, app, project, title, agent, status, cleanStr(body.current, 300), JSON.stringify(tasks), done, tasks.length, cleanStr(body.note, 500),
          prog ? prog.done : null, prog ? prog.total : null, prog ? prog.label : null,
          now, status, cleanStr(body.current, 300), JSON.stringify(tasks), done, tasks.length, cleanStr(body.note, 500),
          prog ? prog.done : null, prog ? prog.total : null, prog ? prog.label : null
        ).run();
        return json({ ok: true, id, url: siteOrigin + "/now/" + id, board: siteOrigin + "/now", done, total: tasks.length });
      } catch (e) { return writeErr(e); }
    }

    // ---- GET /api/activity : merged chronological feed (sessions + checks) for the timeline ----
    if (pathname === "/api/activity" && request.method === "GET") {
      const limit = Math.min(200, Math.max(1, num(url.searchParams.get("limit")) || 80));
      try {
        const [s, c, sub] = await Promise.all([
          env.DB.prepare("SELECT * FROM sessions ORDER BY updated DESC LIMIT ?").bind(limit).all(),
          env.DB.prepare("SELECT * FROM checks ORDER BY ts DESC LIMIT ?").bind(limit).all(),
          env.DB.prepare("SELECT * FROM submitted ORDER BY ts DESC LIMIT ?").bind(limit).all(),
        ]);
        const now = Date.now();
        const sessions = (s.results || []).map((r) => {
          const m = mapSession(r);
          return { kind: "session", id: m.id, ts: m.updated, started: m.started, app: m.app, project: m.project,
            title: m.title, status: m.status, current: m.current, done: m.done, total: m.total,
            progress: m.progress, agent: m.agent, live: m.status === "active" && now - m.updated < 90_000 };
        });
        const checks = (c.results || []).map((r) => ({
          kind: "check", id: r.id, ts: r.ts, app: r.app, project: r.project, checkedBy: r.checked_by, scope: r.scope || "app", sessionId: r.session_id || null,
          foundCount: r.found_count, securityStatus: r.security_status,
          coverage: r.cov_total != null ? { total: r.cov_total, matched: r.cov_matched,
            pct: r.cov_total ? Math.round((r.cov_matched / r.cov_total) * 100) : 100,
            complete: r.cov_total === r.cov_matched,
            verified: r.cov_verified != null ? r.cov_verified : null,
            verifiedPct: (r.cov_verified != null && r.cov_total) ? Math.round((r.cov_verified / r.cov_total) * 100) : null,
            evidence: safeParse(r.evidence, null) } : null,
        }));
        const additions = (sub.results || []).map((r) => ({
          kind: "addition", id: r.id, ts: r.ts, subkind: r.kind, app: r.app, project: r.project,
          title: r.title, severity: r.severity, category: r.category, shots: safeParse(r.shots, []), sessionId: r.session_id || null,
        }));
        const events = sessions.concat(checks).concat(additions).sort((a, b) => b.ts - a.ts).slice(0, limit);
        return json({ ok: true, now, count: events.length, events });
      } catch (e) { return json({ ok: false, error: String(e) }, 500); }
    }

    // ---- GET /api/bugs : agent-submitted new bugs (proposals) ----
    if (pathname === "/api/bugs" && request.method === "GET") {
      const limit = Math.min(200, Math.max(1, num(url.searchParams.get("limit")) || 100));
      try {
        const { results } = await env.DB.prepare("SELECT * FROM submitted ORDER BY ts DESC LIMIT ?").bind(limit).all();
        const rows = (results || []).map((r) => ({
          id: r.id, ts: r.ts, app: r.app, project: r.project, kind: r.kind, title: r.title,
          category: r.category, severity: r.severity, symptom: r.symptom, fix: r.fix, file: r.file, submittedBy: r.submitted_by,
          shots: safeParse(r.shots, []), sessionId: r.session_id || null,
        }));
        return json({ ok: true, count: rows.length, submitted: rows });
      } catch (e) { return json({ ok: false, error: String(e) }, 500); }
    }

    // ---- POST /api/bugs : append a NEW bug/security finding discovered during a scan ----
    if (pathname === "/api/bugs" && request.method === "POST") {
      if (env.LEDGER_WRITE_TOKEN && request.headers.get("x-ledger-key") !== env.LEDGER_WRITE_TOKEN)
        return json({ ok: false, error: "unauthorized" }, 401);
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "invalid JSON" }, 400); }
      if (!body || !body.title || !body.app) return json({ ok: false, error: "fields 'app' and 'title' are required" }, 400);
      const id = crypto.randomUUID(), ts = Date.now();
      const kind = ["security", "optimiser"].includes(body.kind) ? body.kind : "bug";
      // Screenshots: a `shots` list (before/after, captioned), or a single `shot`/`shotDataUrl`.
      // data: URLs are uploaded to R2 here so one POST can attach pictures inline.
      let shots = [];
      try {
        shots = await normShots(env, body.shots
          || ((body.shot || body.shotUrl || body.shotDataUrl)
              ? [{ url: body.shot || body.shotUrl, dataUrl: body.shotDataUrl, caption: body.shotCaption }]
              : []));
      } catch { shots = []; }
      try {
        await env.DB.prepare(
          `INSERT INTO submitted (id,ts,app,project,kind,title,category,severity,symptom,fix,file,submitted_by,shots,session_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(id, ts, cleanStr(body.app, 80), cleanStr(body.project, 200), kind, cleanStr(body.title, 200),
               str(body.category || "other", 20), str(body.severity || "medium", 12),
               cleanStr(body.symptom, 500), cleanStr(body.fix, 500), cleanStr(body.file, 200), str(body.submittedBy || "claude-code", 60),
               shots.length ? JSON.stringify(shots) : null, str(body.sessionId, 60) || null).run();
        return json({ ok: true, id, app: str(body.app, 80), title: str(body.title, 200), shots });
      } catch (e) { return writeErr(e); }
    }

    if (pathname.startsWith("/api/")) return json({ ok: false, error: "not found" }, 404);

    // everything else → static assets
    return env.ASSETS.fetch(request);
}

function safeParse(s, dflt) { try { return JSON.parse(s); } catch { return dflt; } }

// ---- scan story: event kinds, severities, statuses ----
const EVENT_KINDS = new Set(["phase", "say", "found", "fixed", "clean", "metric", "verdict", "caveat", "note", "feature", "shot", "act"]);   // act = one thing the agent did (read, edit, run…), posted by breadhook.mjs
// carry each step's start/finish times across updates (matched by position, then by text), and stamp new ones.
// A step that goes active gets startedAt; a step that goes done gets doneAt (and a startedAt if it skipped active).
function stampTasks(prev, next, now) {
  return next.map((t, i) => {
    const p = (prev[i] && prev[i].text === t.text) ? prev[i] : prev.find((x) => x && x.text === t.text) || null;
    const out = { ...t };
    if (p && p.startedAt) out.startedAt = p.startedAt;
    if (p && p.doneAt && t.status === "done") out.doneAt = p.doneAt;
    if (!out.desc && p && p.desc) out.desc = p.desc;
    if (!out.wave && p && p.wave) out.wave = p.wave;
    if ((t.status === "active" || t.status === "done") && !out.startedAt) out.startedAt = now;
    if (t.status === "done" && !out.doneAt) out.doneAt = now;
    if (t.status === "pending") { delete out.startedAt; delete out.doneAt; }
    return out;
  });
}
const SEVS = new Set(["critical", "high", "medium", "low", "info"]);
const STATUSES = new Set(["fixed", "open", "needs-call", "false-positive", "applied", "recommended", "wontfix", "clean"]);
const normSev = (v) => { const s = String(v || "").toLowerCase().trim(); if (SEVS.has(s)) return s;
  if (s === "crit") return "critical"; if (s === "med" || s === "moderate") return "medium"; if (s === "warn" || s === "warning") return "medium"; return null; };
const normStatus = (v) => { const s = String(v || "").toLowerCase().trim().replace(/[\s_]+/g, "-");
  if (STATUSES.has(s)) return s; if (s === "needs-your-call" || s === "your-call" || s === "needscall") return "needs-call";
  if (s === "fp" || s === "false-alarm" || s === "falsepositive") return "false-positive"; if (s === "done" || s === "resolved") return "fixed"; return null; };
function mapEvent(r) {
  return { id: r.id, sessionId: r.session_id, ts: r.ts, seq: r.seq, kind: r.kind, phase: r.phase, severity: r.severity,
    status: r.status, category: r.category, confidence: r.confidence, verifiedBy: r.verified_by, title: r.title,
    detail: r.detail, impact: r.impact, fix: r.fix, file: r.file, ref: r.ref, before: r.before_v, after: r.after_v,
    meta: safeParse(r.meta, null) };
}
function mapCheck(r) {
  return {
    id: r.id, ts: r.ts, app: r.app, project: r.project, checkedBy: r.checked_by,
    scanned: r.scanned, checkedCount: r.checked_count, foundCount: r.found_count,
    securityStatus: r.security_status,
    notFound: safeParse(r.not_found, []), found: safeParse(r.found, []),
    securityChecked: safeParse(r.security_checked, []), securityFindings: safeParse(r.security_findings, []),
    notes: r.notes, scope: r.scope || "app", sessionId: r.session_id || null,
    coverage: r.cov_total != null ? {
      total: r.cov_total, matched: r.cov_matched, scope: r.scope || "app",
      pct: r.cov_total ? Math.round((r.cov_matched / r.cov_total) * 100) : 100,
      complete: r.cov_total === r.cov_matched, missed: safeParse(r.cov_missed, []),
      verified: r.cov_verified != null ? r.cov_verified : null,
      verifiedPct: (r.cov_verified != null && r.cov_total) ? Math.round((r.cov_verified / r.cov_total) * 100) : null,
      evidence: safeParse(r.evidence, null),
    } : null,
  };
}
function mapSubmitted(r) {
  return { id: r.id, ts: r.ts, app: r.app, project: r.project, kind: r.kind, title: r.title, category: r.category,
    severity: r.severity, symptom: r.symptom, fix: r.fix, file: r.file, submittedBy: r.submitted_by,
    shots: safeParse(r.shots, []), sessionId: r.session_id || null };
}
// Resolve a story's findings: a later "fixed" event (ref → found id, or same title) updates the status
// of the earlier "found" WITHOUT editing it — the rollup is computed, the rows stay immutable.
function resolveFindings(events) {
  const finds = events.filter((e) => e.kind === "found");
  const byId = new Map(finds.map((f) => [f.id, { ...f }]));
  const byTitle = new Map(finds.map((f) => [norm(f.title), f.id]));
  for (const e of events) {
    if (e.kind !== "fixed") continue;
    const id = (e.ref && byId.has(e.ref)) ? e.ref : byTitle.get(norm(e.title));
    const f = id && byId.get(id); if (!f) continue;
    f.status = e.status || "fixed"; if (e.fix) f.fix = e.fix; if (e.file && !f.file) f.file = e.file; f.fixedAt = e.ts;
  }
  return [...byId.values()];
}
function rollup(events) {
  const finds = resolveFindings(events);
  const bySev = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byStatus = { fixed: 0, open: 0, "needs-call": 0, "false-positive": 0, applied: 0, recommended: 0, wontfix: 0 };
  for (const f of finds) { bySev[f.severity || "info"] = (bySev[f.severity || "info"] || 0) + 1; const st = f.status || "open"; byStatus[st] = (byStatus[st] || 0) + 1; }
  const real = finds.filter((f) => f.status !== "false-positive");
  const metrics = events.filter((e) => e.kind === "metric").map((e) => ({ label: e.title, before: e.before, after: e.after, phase: e.phase }));
  const verdict = [...events].reverse().find((e) => e.kind === "verdict");
  return { findings: finds.length, real: real.length, bySev, byStatus, metrics, phases: events.filter((e) => e.kind === "phase").length,
    verdict: verdict ? verdict.title || verdict.detail : null, caveats: events.filter((e) => e.kind === "caveat").length };
}

function mapSession(r) {
  return {
    id: r.id, started: r.started, updated: r.updated, app: r.app, project: r.project,
    title: r.title, agent: r.agent, status: r.status, current: r.current,
    tasks: safeParse(r.tasks, []), done: r.done_count, total: r.total_count, note: r.note,
    progress: r.prog_total ? { done: r.prog_done || 0, total: r.prog_total, label: r.prog_label || "" } : null,
  };
}
// the bug/quality families the ledger tracks — anything here can be scoped as "category:<name>"
// for its own server-verified N/N coverage line (a per-family view of the full catalog).
const CATEGORY_SET = new Set([
  "security", "data-loss", "crash", "auth", "sync", "race", "logic", "performance",
  "ui", "other", "privacy", "claims", "accessibility", "observability", "testing", "seo",
]);
// every distinct bug title in ONE family across all apps (deduped) — a family-scoped target
function categoryTitles(cat, category) {
  const m = new Map();
  for (const app of Object.keys(cat.apps || {}))
    for (const b of cat.apps[app]) if (b.category === category) { const k = norm(b.title); if (!m.has(k)) m.set(k, b.title); }
  return [...m.values()];
}
// every distinct bug title across ALL apps (deduped) — the full-catalog target
function allTitles(cat) {
  const m = new Map();
  for (const app of Object.keys(cat.apps || {}))
    for (const b of cat.apps[app]) { const k = norm(b.title); if (!m.has(k)) m.set(k, b.title); }
  return [...m.values()];
}
// every distinct SECURITY item across all apps: security-category bugs + the security-sweep findings
function securityTitles(cat) {
  const m = new Map();
  for (const app of Object.keys(cat.apps || {}))
    for (const b of cat.apps[app]) if (b.category === "security") { const k = norm(b.title); if (!m.has(k)) m.set(k, b.title); }
  for (const f of (cat.security || [])) { const k = norm(f.title); if (!m.has(k)) m.set(k, f.title); }
  return [...m.values()];
}
// every distinct OPTIMISER (reusable elevation) title
function optimiserTitles(cat) {
  const m = new Map();
  for (const o of (cat.optimisers || [])) { const k = norm(o.title); if (!m.has(k)) m.set(k, o.title); }
  return [...m.values()];
}
// the grand-total target: every distinct checkable item across bugs + security audit + optimisers,
// deduped into one list. This is the honest whole (no double-count) — a deep scan confirms N/N here.
function fullTitles(cat) {
  const m = new Map();
  for (const t of [...allTitles(cat), ...securityTitles(cat), ...optimiserTitles(cat)]) {
    const k = norm(t); if (!m.has(k)) m.set(k, t);
  }
  return [...m.values()];
}

/* ── Prompt ledger page: every prompt, its status, what is done and what is left — chapters with photos, a status ring, filters and search ── */
function ledgerPage(row, d) {
  const e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'), items = d.items || [], photos = d.photos || {};
  // label · badge class · colour token (ring, bars, chip dots) — the shared status vocabulary, never colour alone
  const ST = { done: ['Done · checked', 'ok', 'var(--ok)'], built: ['Built · not checked', 'warn', 'var(--warn)'], partial: ['Partly done', 'accent', 'var(--accent)'], not: ['Not started', 'danger', 'var(--danger)'],
    waiting: ['Waiting on you', 'info', 'var(--info)'], paused: ['Paused', '', 'var(--ink-3)'], answered: ['Answered', 'ok', 'var(--ok-ink)'], stopped: ['Stopped by you', '', 'var(--ink-2)'] };
  const order = ['done', 'built', 'partial', 'not', 'waiting', 'paused', 'answered', 'stopped'];
  const cnt = {}; items.forEach(x => { cnt[x.s] = (cnt[x.s] || 0) + 1; }); const tot = items.length || 1;
  items.forEach(x => { if (!ST[x.s]) x.s = 'not'; });   // an unknown status reads as "Not started" rather than breaking the page
  const badge = (k) => `<span class="badge ${ST[k][1]}">${ST[k][0]}</span>`;
  // the ring: one arc per status, drawn to scale
  const R = 62, C = 2 * Math.PI * R, GAP = 3; let off = 0;
  const arcs = order.filter(k => cnt[k]).map(k => { const len = C * cnt[k] / tot; const vis = Math.max(0.5, len - GAP); const a = `<circle r="${R}" cx="75" cy="75" fill="none" stroke="${ST[k][2]}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${vis.toFixed(2)} ${(C - vis).toFixed(2)}" stroke-dashoffset="${(-off - GAP / 2).toFixed(2)}" transform="rotate(-90 75 75)"><title>${ST[k][0]}: ${cnt[k]}</title></circle>`; off += len; return a; }).join('');
  const groups = []; items.forEach(x => { let g = groups.find(y => y.name === x.g); if (!g) groups.push(g = { name: x.g, items: [] }); g.items.push(x); });
  const bar = (list) => { const c = {}; list.forEach(x => { c[x.s] = (c[x.s] || 0) + 1; }); return order.filter(k => c[k]).map(k => `<i style="flex:${c[k]};background:${ST[k][2]}" title="${ST[k][0]}: ${c[k]}"></i>`).join(''); };
  const when = new Date(d.at || row.at || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const thumb = (g) => { const l = photos[g] || []; return l.find(u => !/\.png$/i.test(u)) || l[0] || ''; };
  const sheetOrder = ['not', 'partial', 'built', 'waiting', 'paused', 'stopped', 'answered', 'done'];
  const sheet = sheetOrder.filter(k => cnt[k]).map(k => `<section class="card sg" data-sg="${k}"><div class="card-h">${badge(k)}<span class="meta num">${cnt[k]}</span></div><div class="table-wrap"><table class="table sheet"><thead><tr><th class="c-ph" aria-label="Photo"></th><th class="c-n">#</th><th>Prompt</th><th class="c-g">Chapter</th><th>Done / left</th></tr></thead><tbody>${items.filter(x => x.s === k).map(x => `<tr class="srow" data-s="${x.s}" data-t="${e((x.p + ' ' + x.d + ' ' + x.g).toLowerCase())}"><td class="c-ph">${thumb(x.g) ? `<img src="${e(thumb(x.g))}" alt="" loading="lazy" data-framed>` : ''}</td><td class="c-n id">${x.n}</td><td class="c-p">${e(x.p)}</td><td class="c-g">${e(x.g)}</td><td class="c-d">${e(x.d)}</td></tr>`).join('')}</tbody></table></div></section>`).join('');
  // photos are rendered client-side with the shell's shot strip (lightbox, ←/→, Esc); the JSON block carries only /ledger/img/ paths
  const photoJson = JSON.stringify(photos).replace(/</g, '\\u003c');
  const chapters = groups.map(g => { const done = g.items.filter(x => x.s === 'done').length, pct = Math.round(100 * done / g.items.length);
    return `<section class="card ch"><div class="card-h"><div class="ch-t"><span class="meta">Chapter</span><h2>${e(g.name)}</h2></div><span class="meta num ch-m"><b>${pct}% complete</b> · ${done} of ${g.items.length} done</span></div>
<div class="card-b"><div class="sbar" role="img" aria-label="${e(g.items.length)} prompts by status">${bar(g.items)}</div><div class="ch-photos" data-photos="${e(g.name)}"></div>
<ol class="rows">${g.items.map(x => `<li class="row" data-s="${x.s}" data-t="${e((x.p + ' ' + x.d).toLowerCase())}"><span class="id n">${x.n}</span><div class="rt"><q>${e(x.p)}</q><p class="d">${e(x.d)}</p></div>${badge(x.s)}</li>`).join('')}</ol></div></section>`; }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${e(d.title || 'Prompt ledger')} · Breadledger</title>
<meta name="description" content="${e((d.summary || 'Every prompt of a session, its status, what is done and what is left.').slice(0, 160))}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/bread.css">
<script src="/bread-shell.js"></script>
<style>
/* page-only styles, tokens only: the status ring, chapter cards, prompt rows and the spreadsheet view */
.eyebrow{margin-bottom:6px}.eyebrow b{color:var(--ink-2);font-weight:600}
.hero{margin:0 0 16px}
.overview{display:grid;grid-template-columns:150px minmax(0,1fr);gap:24px;align-items:center;margin-bottom:16px}
.ring{position:relative;width:150px;height:150px;justify-self:center}.ring svg{width:150px;height:150px;display:block}
.ring .c{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:1px}
.ring .c b{font-size:32px;font-weight:650;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums}.ring .c b small{font-size:.5em;margin-left:1px;color:var(--ink-2)}
.ring .c span{font-size:12.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin-top:3px}
.ring .c em{font-style:normal;font-size:13px;color:var(--ink-2);font-variant-numeric:tabular-nums;white-space:nowrap}
.tools{display:grid;gap:12px;min-width:0}.tbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.tbar .search-wrap{flex:1 1 220px}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chip i{width:8px;height:8px;border-radius:50%;background:var(--c,var(--ink-3));flex:0 0 auto}.chip em{font-style:normal;color:var(--ink-3);font-variant-numeric:tabular-nums}.chip.on em{color:inherit}
#v-chapters,#v-sheet{display:grid;gap:14px}
.ch .card-h{align-items:flex-start;flex-wrap:wrap;row-gap:4px}.ch .ch-t{display:grid;gap:2px;min-width:0}.ch .ch-t .meta{margin-left:0}.ch .ch-t h2{font-size:17px}.ch .ch-m b{color:var(--ink);font-weight:600}
.sbar{display:flex;gap:2px;height:8px;border-radius:99px;overflow:hidden;max-width:420px;background:var(--bg-2)}.sbar i{display:block;height:100%}
.ch-photos{margin-top:12px}.ch-photos:empty{display:none}
.shots{grid-template-columns:repeat(auto-fill,104px);justify-content:start}   /* ledger photos are small cut-outs (≈220 px): tiles stay ≤ half their size so they are never soft on retina */
.shot img{height:96px}
.rows{list-style:none;margin:12px -16px -16px;padding:0;display:grid}
.row{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:12px;align-items:start;padding:12px 16px;border-top:1px solid var(--line);min-height:44px}
.row .n{padding-top:3px;font-size:13px}.row .rt{min-width:0}
.row q{display:block;font-size:15px;font-weight:550;line-height:1.4;quotes:"\\201C" "\\201D";overflow-wrap:anywhere}.row .d{color:var(--ink-2);font-size:14px;margin-top:4px;overflow-wrap:anywhere}
.row .badge{margin-top:2px}
.sg .table-wrap{border:0;border-top:1px solid var(--line);border-radius:0 0 var(--r-2) var(--r-2)}
.sheet .c-ph{width:56px}.sheet .c-ph img{width:40px;height:40px;object-fit:cover;border-radius:6px;display:block;border:1px solid var(--line)}
.sheet .c-n{width:44px}.sheet .c-p{font-weight:550;min-width:220px;line-height:1.4}.sheet .c-g{color:var(--ink-2);font-size:13.5px;white-space:nowrap}.sheet .c-d{color:var(--ink-2);font-size:13.5px;min-width:200px}
.sheet th{position:static}
.foot{text-align:center;margin-top:28px}
#none{margin-top:8px}
.row[hidden],.ch[hidden],.sg[hidden],.srow[hidden],#v-chapters[hidden],#v-sheet[hidden],#none[hidden]{display:none}
@media (max-width:640px){.overview{grid-template-columns:minmax(0,1fr);justify-items:stretch}.ring{justify-self:start}.row{grid-template-columns:30px minmax(0,1fr)}.row .badge{grid-column:2;justify-self:start}.rows{margin:12px -12px -12px}.row{padding:12px}}
</style></head><body>
<div class="bl-app" id="app">
  <aside class="bl-side" id="side" aria-label="Sidebar"></aside>
  <div class="bl-main">
    <header class="bl-top" id="top"></header>
    <main class="bl-content narrow" id="page" data-title="${e(d.title || 'Prompt ledger')}">
      <div class="page-h"><div><p class="meta eyebrow"><b>${e(row.project || 'Project')}</b> · ${e(when)} · Prompt ledger</p><h1>${e(d.title || 'Prompt ledger')}</h1><p class="lead">${e(d.summary || '')}</p></div></div>
      <div class="hero" data-photos="__hero"></div>
      <section class="card pad overview" aria-label="Status overview">
        <div class="ring"><svg viewBox="0 0 150 150" aria-hidden="true"><circle r="${R}" cx="75" cy="75" fill="none" stroke="var(--line)" stroke-width="12"/>${arcs}</svg><div class="c"><b>${Math.round(100 * (cnt.done || 0) / tot)}<small>%</small></b><span>complete</span><em>${cnt.done || 0} of ${items.length} done</em></div></div>
        <div class="tools">
          <div class="tbar"><div class="search-wrap">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>'}<input class="input" id="q" type="search" placeholder="Search prompts" aria-label="Search prompts" data-search autocomplete="off"></div>
            <div class="seg" role="tablist" aria-label="View"><button type="button" role="tab" data-v="chapters" class="on" aria-selected="true">Chapters</button><button type="button" role="tab" data-v="sheet" aria-selected="false">Spreadsheet</button></div></div>
          <div class="chips" role="group" aria-label="Filter by status"><button class="chip on" data-f="all" type="button" aria-pressed="true">All <em>${items.length}</em></button>${order.filter(k => cnt[k]).map(k => `<button class="chip" data-f="${k}" type="button" aria-pressed="false" style="--c:${ST[k][2]}"><i></i>${ST[k][0]} <em>${cnt[k]}</em></button>`).join('')}</div>
        </div>
      </section>
      <div id="v-chapters">${chapters}</div>
      <div id="v-sheet" hidden>${sheet}</div>
      <div class="empty" id="none" hidden>${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>'}<b>Nothing matches — try another word or status.</b></div>
      <p class="meta foot">Add-only record · posted by your agent · ${e(when)}</p>
    </main>
  </div>
</div>
<script type="application/json" id="bl-photos">${photoJson}</script>
<script>(function(){var f='all',q='';var rows=[].slice.call(document.querySelectorAll('.row,.srow')),chs=[].slice.call(document.querySelectorAll('.ch')),sgs=[].slice.call(document.querySelectorAll('.sg'));
function apply(){var any=0;rows.forEach(function(r){var ok=(f==='all'||r.dataset.s===f)&&(!q||r.dataset.t.indexOf(q)>-1);r.hidden=!ok;if(ok)any++;});chs.forEach(function(c){c.hidden=!c.querySelector('.row:not([hidden])');});sgs.forEach(function(c){c.hidden=!c.querySelector('.srow:not([hidden])');});document.getElementById('none').hidden=!!any;}
[].forEach.call(document.querySelectorAll('.chip'),function(b){b.onclick=function(){f=b.dataset.f;[].forEach.call(document.querySelectorAll('.chip'),function(x){var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on?'true':'false');});apply();};});
document.getElementById('q').oninput=function(ev){q=ev.target.value.trim().toLowerCase();apply();};
function view(v){document.getElementById('v-chapters').hidden=v!=='chapters';document.getElementById('v-sheet').hidden=v!=='sheet';[].forEach.call(document.querySelectorAll('.seg [data-v]'),function(b){var on=b.dataset.v===v;b.classList.toggle('on',on);b.setAttribute('aria-selected',on?'true':'false');});try{localStorage.setItem('bl_ledger_view',v)}catch(e){}}
[].forEach.call(document.querySelectorAll('.seg [data-v]'),function(b){b.onclick=function(){view(b.dataset.v);};});var sv=null;try{sv=localStorage.getItem('bl_ledger_view')}catch(e){}if(sv==='sheet')view('sheet');
var P={};try{P=JSON.parse(document.getElementById('bl-photos').textContent)||{}}catch(e){}var HERO=['Cover','Original','Reimagined'];
[].forEach.call(document.querySelectorAll('[data-photos]'),function(el){var key=el.getAttribute('data-photos'),l=P[key]||[];if(!l.length){el.remove();return;}el.innerHTML=Bread.shotStrip(l.map(function(u,i){return {url:u,caption:key==='__hero'?(HERO[i]||'Photo '+(i+1)):'Photo '+(i+1)};}));});
[].forEach.call(document.querySelectorAll('.shot img'),function(i){i.setAttribute('data-framed','');});
Bread.mount({active:'prompts',title:document.getElementById('page').getAttribute('data-title')||'Prompt ledger',crumbs:['Prompt ledger']});})();</script>
</body></html>`;
}

