// Bug Ledger worker: static site + a small check-log API backed by D1.
// Static assets (index.html, data*.js, bugs.json, AGENT.md, llms.txt, …) are served
// by the ASSETS binding. Only /api/* is handled here.

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

// the app catalog (bug titles per app) — read from the static checklist.json, cached per isolate
let _catalog = null;
async function catalog(env, request) {
  if (_catalog) return _catalog;
  try {
    const res = await env.ASSETS.fetch(new Request(new URL("/checklist.json", request.url)));
    _catalog = await res.json();
  } catch { _catalog = { apps: {} }; }
  return _catalog;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: JSON_HEADERS });

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
          notes: r.notes,
          coverage: r.cov_total != null ? {
            total: r.cov_total, matched: r.cov_matched,
            pct: r.cov_total ? Math.round((r.cov_matched / r.cov_total) * 100) : 100,
            complete: r.cov_total === r.cov_matched, missed: safeParse(r.cov_missed, []),
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
      const rec = {
        id, ts,
        app: str(body.app, 80),
        project: str(body.project, 300),
        checked_by: str(body.checkedBy || "claude-code", 60),
        scanned: num(body.scanned),
        checked_count: num(body.checkedCount),
        found_count: num(body.foundCount),
        security_status: str(body.securityStatus || "n/a", 20),
        not_found: JSON.stringify(arr(body.notFound, 400, (x) => str(x, 200))),
        found: JSON.stringify(arr(body.found, 200, (x) => ({
          title: str(x && x.title, 200), file: str(x && x.file, 200), note: str(x && x.note, 400),
        }))),
        security_checked: JSON.stringify(arr(body.securityChecked, 100, (x) => str(x, 120))),
        security_findings: JSON.stringify(arr(body.securityFindings, 100, (x) => ({
          severity: str(x && x.severity, 12), title: str(x && x.title, 200), file: str(x && x.file, 200),
        }))),
        notes: str(body.notes, 2000),
      };
      // server-verified coverage: which of the app's known bugs did the agent actually address?
      const cat = await catalog(env, request);
      const appTitles = (cat.apps && cat.apps[rec.app]) ? cat.apps[rec.app].map((b) => b.title) : [];
      const reported = new Set([
        ...arr(body.notFound, 400, (x) => str(x, 200)),
        ...arr(body.found, 200, (x) => str(x && x.title, 200)),
      ].map(norm));
      const missed = appTitles.filter((t) => !reported.has(norm(t)));
      const covTotal = appTitles.length;
      const covMatched = covTotal - missed.length;
      try {
        await env.DB.prepare(
          `INSERT INTO checks (id,ts,app,project,checked_by,scanned,checked_count,found_count,security_status,not_found,found,security_checked,security_findings,notes,cov_total,cov_matched,cov_missed)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(rec.id, rec.ts, rec.app, rec.project, rec.checked_by, rec.scanned, rec.checked_count,
               rec.found_count, rec.security_status, rec.not_found, rec.found, rec.security_checked,
               rec.security_findings, rec.notes, covTotal, covMatched, JSON.stringify(missed)).run();
        const pct = covTotal ? Math.round((covMatched / covTotal) * 100) : 100;
        return json({ ok: true, id, ts, app: rec.app, view: "https://bugledger.coconvo.workers.dev/#checks",
          coverage: { total: covTotal, matched: covMatched, pct, complete: missed.length === 0, missed: missed.slice(0, 60) } });
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
      try {
        const existing = await env.DB.prepare(
          "SELECT started,status,app,project,title,agent FROM sessions WHERE id = ?").bind(id).first();
        // a finished session is frozen — you can't rewrite history, only start a new one
        if (existing && existing.status === "done")
          return json({ ok: false, error: "session already finished — start a new one" }, 409);
        const started = existing ? existing.started : now;
        // identity is set once at creation and never overwritten on update (append-only integrity)
        const app = existing ? existing.app : str(body.app, 80);
        const project = existing ? existing.project : str(body.project, 200);
        const title = existing ? existing.title : str(body.title, 200);
        const agent = existing ? existing.agent : str(body.agent || "claude-code", 60);
        await env.DB.prepare(
          `INSERT INTO sessions (id,started,updated,app,project,title,agent,status,current,tasks,done_count,total_count,note)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET updated=?,status=?,current=?,tasks=?,done_count=?,total_count=?,note=?`
        ).bind(
          id, started, now, app, project, title, agent, status, str(body.current, 300), JSON.stringify(tasks), done, tasks.length, str(body.note, 500),
          now, status, str(body.current, 300), JSON.stringify(tasks), done, tasks.length, str(body.note, 500)
        ).run();
        return json({ ok: true, id, url: "https://bugledger.coconvo.workers.dev/live", done, total: tasks.length });
      } catch (e) { return writeErr(e); }
    }

    // ---- GET /api/bugs : agent-submitted new bugs (proposals) ----
    if (pathname === "/api/bugs" && request.method === "GET") {
      const limit = Math.min(200, Math.max(1, num(url.searchParams.get("limit")) || 100));
      try {
        const { results } = await env.DB.prepare("SELECT * FROM submitted ORDER BY ts DESC LIMIT ?").bind(limit).all();
        const rows = (results || []).map((r) => ({
          id: r.id, ts: r.ts, app: r.app, project: r.project, kind: r.kind, title: r.title,
          category: r.category, severity: r.severity, symptom: r.symptom, fix: r.fix, file: r.file, submittedBy: r.submitted_by,
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
      const kind = body.kind === "security" ? "security" : "bug";
      try {
        await env.DB.prepare(
          `INSERT INTO submitted (id,ts,app,project,kind,title,category,severity,symptom,fix,file,submitted_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(id, ts, str(body.app, 80), str(body.project, 200), kind, str(body.title, 200),
               str(body.category || "other", 20), str(body.severity || "medium", 12),
               str(body.symptom, 500), str(body.fix, 500), str(body.file, 200), str(body.submittedBy || "claude-code", 60)).run();
        return json({ ok: true, id, app: str(body.app, 80), title: str(body.title, 200) });
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
  };
}
