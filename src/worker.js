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

const str = (v, max) => (typeof v === "string" ? v : v == null ? "" : String(v)).slice(0, max);
const num = (v) => (Number.isFinite(+v) ? Math.trunc(+v) : 0);
const arr = (v, max, mapper) => (Array.isArray(v) ? v.slice(0, max).map(mapper) : []);

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
      try {
        await env.DB.prepare(
          `INSERT INTO checks (id,ts,app,project,checked_by,scanned,checked_count,found_count,security_status,not_found,found,security_checked,security_findings,notes)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(rec.id, rec.ts, rec.app, rec.project, rec.checked_by, rec.scanned, rec.checked_count,
               rec.found_count, rec.security_status, rec.not_found, rec.found, rec.security_checked,
               rec.security_findings, rec.notes).run();
        return json({ ok: true, id, ts, app: rec.app, view: "https://bugledger.coconvo.workers.dev/#checks" });
      } catch (e) {
        return json({ ok: false, error: String(e) }, 500);
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
      } catch (e) { return json({ ok: false, error: String(e) }, 500); }
    }
    if (pathname === "/api/session" && request.method === "GET") {
      const id = url.searchParams.get("id");
      if (!id) return json({ ok: false, error: "id required" }, 400);
      try {
        const row = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first();
        return row ? json({ ok: true, session: mapSession(row) }) : json({ ok: false, error: "not found" }, 404);
      } catch (e) { return json({ ok: false, error: String(e) }, 500); }
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
        const existing = await env.DB.prepare("SELECT started FROM sessions WHERE id = ?").bind(id).first();
        const started = existing ? existing.started : now;
        await env.DB.prepare(
          `INSERT INTO sessions (id,started,updated,app,project,title,agent,status,current,tasks,done_count,total_count,note)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET updated=?,app=?,project=?,title=?,agent=?,status=?,current=?,tasks=?,done_count=?,total_count=?,note=?`
        ).bind(
          id, started, now, str(body.app, 80), str(body.project, 200), str(body.title, 200), str(body.agent || "claude-code", 60),
          status, str(body.current, 300), JSON.stringify(tasks), done, tasks.length, str(body.note, 500),
          now, str(body.app, 80), str(body.project, 200), str(body.title, 200), str(body.agent || "claude-code", 60),
          status, str(body.current, 300), JSON.stringify(tasks), done, tasks.length, str(body.note, 500)
        ).run();
        return json({ ok: true, id, url: "https://bugledger.coconvo.workers.dev/live", done, total: tasks.length });
      } catch (e) { return json({ ok: false, error: String(e) }, 500); }
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
