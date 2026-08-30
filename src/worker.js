// Bug Ledger worker: static site + a small check-log API backed by D1.
// Static assets (index.html, data*.js, bugs.json, AGENT.md, llms.txt, …) are served
// by the ASSETS binding. Only /api/* is handled here.

// Shared sanitizer engine (same rules as the /sanitize tool + scan.mjs). Every free-text
// field written to the append-only ledger is cleaned of hidden / AI-inserted / smuggled
// Unicode first, so the ledger itself never stores an invisible payload. The "safe" preset
// keeps emoji and multilingual text intact.
import Sanitize from "../public/sanitize.js";

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: JSON_HEADERS });

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
        return json({ ok: true, url, view: "https://bugledger.coconvo.workers.dev" + url });
      } catch (e) { return writeErr(e); }
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
        const rows = (results || []).map((r) => ({
          id: r.id, ts: r.ts, app: r.app, project: r.project, checkedBy: r.checked_by,
          scanned: r.scanned, checkedCount: r.checked_count, foundCount: r.found_count,
          securityStatus: r.security_status,
          notFound: safeParse(r.not_found, []), found: safeParse(r.found, []),
          securityChecked: safeParse(r.security_checked, []), securityFindings: safeParse(r.security_findings, []),
          notes: r.notes, scope: r.scope || "app",
          coverage: r.cov_total != null ? {
            total: r.cov_total, matched: r.cov_matched, scope: r.scope || "app",
            pct: r.cov_total ? Math.round((r.cov_matched / r.cov_total) * 100) : 100,
            complete: r.cov_total === r.cov_matched, missed: safeParse(r.cov_missed, []),
            verified: r.cov_verified != null ? r.cov_verified : null,
            verifiedPct: (r.cov_verified != null && r.cov_total) ? Math.round((r.cov_verified / r.cov_total) * 100) : null,
            evidence: safeParse(r.evidence, null),
          } : null,
        }));
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
          `INSERT INTO checks (id,ts,app,project,checked_by,scanned,checked_count,found_count,security_status,not_found,found,security_checked,security_findings,notes,cov_total,cov_matched,cov_missed,scope,cov_verified,evidence)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(rec.id, rec.ts, rec.app, rec.project, rec.checked_by, rec.scanned, rec.checked_count,
               rec.found_count, rec.security_status, rec.not_found, rec.found, rec.security_checked,
               rec.security_findings, rec.notes, covTotal, covMatched, JSON.stringify(missed), scope,
               covVerified, JSON.stringify(evidence)).run();
        const pct = covTotal ? Math.round((covMatched / covTotal) * 100) : 100;
        const verifiedPct = covTotal ? Math.round((covVerified / covTotal) * 100) : 0;
        return json({ ok: true, id, ts, app: rec.app, view: "https://bugledger.coconvo.workers.dev/#checks",
          coverage: { total: covTotal, matched: covMatched, pct, complete: missed.length === 0,
            verified: covVerified, verifiedPct, evidence, missed: missed.slice(0, 60) } });
      } catch (e) {
        return writeErr(e);
      }
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
      const tasks = arr(body.tasks, 60, (t) => ({
        text: str(t && t.text, 200),
        status: ["pending", "active", "done"].includes(t && t.status) ? t.status : "pending",
      }));
      const done = tasks.filter((t) => t.status === "done").length;
      const status = body.status === "done" ? "done" : "active";
      const prog = body.progress && Number.isFinite(+body.progress.total) && +body.progress.total > 0
        ? { done: num(body.progress.done), total: num(body.progress.total), label: str(body.progress.label, 40) } : null;
      try {
        const existing = await env.DB.prepare(
          "SELECT started,status,app,project,title,agent FROM sessions WHERE id = ?").bind(id).first();
        // a finished session is frozen — you can't rewrite history, only start a new one
        if (existing && existing.status === "done")
          return json({ ok: false, error: "session already finished — start a new one" }, 409);
        const started = existing ? existing.started : now;
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
        return json({ ok: true, id, url: "https://bugledger.coconvo.workers.dev/live", done, total: tasks.length });
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
          return { kind: "session", ts: m.updated, started: m.started, app: m.app, project: m.project,
            title: m.title, status: m.status, current: m.current, done: m.done, total: m.total,
            progress: m.progress, agent: m.agent, live: m.status === "active" && now - m.updated < 90_000 };
        });
        const checks = (c.results || []).map((r) => ({
          kind: "check", id: r.id, ts: r.ts, app: r.app, project: r.project, checkedBy: r.checked_by, scope: r.scope || "app",
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
          title: r.title, severity: r.severity, category: r.category, shots: safeParse(r.shots, []),
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
          shots: safeParse(r.shots, []),
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
          `INSERT INTO submitted (id,ts,app,project,kind,title,category,severity,symptom,fix,file,submitted_by,shots)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(id, ts, cleanStr(body.app, 80), cleanStr(body.project, 200), kind, cleanStr(body.title, 200),
               str(body.category || "other", 20), str(body.severity || "medium", 12),
               cleanStr(body.symptom, 500), cleanStr(body.fix, 500), cleanStr(body.file, 200), str(body.submittedBy || "claude-code", 60),
               shots.length ? JSON.stringify(shots) : null).run();
        return json({ ok: true, id, app: str(body.app, 80), title: str(body.title, 200), shots });
      } catch (e) { return writeErr(e); }
    }

    if (pathname.startsWith("/api/")) return json({ ok: false, error: "not found" }, 404);

    // everything else → static assets
    return env.ASSETS.fetch(request);
  },
};

function safeParse(s, dflt) { try { return JSON.parse(s); } catch { return dflt; } }

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
