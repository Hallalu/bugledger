// Sell feed — every verified fact worth selling with (a fine, a law, a competitor move, a research number) lands here
// from any session; a scheduled run turns each new one into a content pack with /sell and marks it done.
// Owner only (the owner's key or signed-in owner account). Facts are deduplicated by their wording.
//
// Routes: POST /api/sellfeed {app, kind, fact, source, verified, date, angle} → {id, dup}
//         GET  /api/sellfeed?status=new|done|all&app= → items · POST /api/sellfeed/<id>/done {pack, links[]}
const HEAD = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: HEAD });
const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const KINDS = new Set(["fine", "law", "competitor", "stat", "news", "customer", "feature"]);

let ready = null;
const ensure = (env) => ready || (ready = env.DB.batch([
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS sell_feed (id TEXT PRIMARY KEY, ts INTEGER NOT NULL, app TEXT NOT NULL, kind TEXT NOT NULL, fact TEXT NOT NULL,
    source TEXT, verified INTEGER NOT NULL DEFAULT 0, date TEXT, angle TEXT, hash TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'new', done_ts INTEGER, pack TEXT, links TEXT)`),
  env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sell_feed_status ON sell_feed(status, ts)`),
]).catch((e) => { ready = null; throw e; }));

async function sha(s) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join(""); }

export async function handleSellFeed(request, env, url, ownerOK) {
  const p = url.pathname;
  if (!p.startsWith("/api/sellfeed")) return null;
  if (!ownerOK(request, env)) return out({ ok: false, error: "owner only" }, 401);
  await ensure(env);

  if (p === "/api/sellfeed" && request.method === "POST") {
    const b = await request.json().catch(() => ({}));
    const fact = str(b.fact, 1200), app = str(b.app, 80) || "Breadledger";
    if (fact.length < 12) return out({ ok: false, error: "fact required (a full sentence)" }, 400);
    const hash = await sha(app.toLowerCase() + "|" + fact.toLowerCase().replace(/[^a-z0-9£$€%.]+/g, ""));
    const dup = await env.DB.prepare(`SELECT id FROM sell_feed WHERE hash = ?`).bind(hash).first();
    if (dup) return out({ ok: true, id: dup.id, dup: true });
    const id = crypto.randomUUID().slice(0, 13);
    await env.DB.prepare(`INSERT INTO sell_feed (id, ts, app, kind, fact, source, verified, date, angle, hash) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, Date.now(), app, KINDS.has(b.kind) ? b.kind : "news", fact, str(b.source, 500), b.verified ? 1 : 0, str(b.date, 30), str(b.angle, 400), hash).run();
    return out({ ok: true, id, dup: false });
  }

  if (p === "/api/sellfeed" && request.method === "GET") {
    const st = url.searchParams.get("status") || "new", app = url.searchParams.get("app");
    const where = [st === "all" ? "1=1" : "status = ?"].concat(app ? ["app = ?"] : []).join(" AND ");
    const binds = (st === "all" ? [] : [st]).concat(app ? [app] : []);
    const { results } = await env.DB.prepare(`SELECT id, ts, app, kind, fact, source, verified, date, angle, status, done_ts, links FROM sell_feed WHERE ${where} ORDER BY ts LIMIT 100`).bind(...binds).all();
    return out({ ok: true, items: (results || []).map((r) => ({ ...r, verified: !!r.verified, links: r.links ? JSON.parse(r.links) : [] })) });
  }

  const m = p.match(/^\/api\/sellfeed\/([a-f0-9-]{13})\/done$/);
  if (m && request.method === "POST") {
    const b = await request.json().catch(() => ({}));
    const r = await env.DB.prepare(`UPDATE sell_feed SET status = 'done', done_ts = ?, pack = ?, links = ? WHERE id = ?`)
      .bind(Date.now(), String(b.pack || "").slice(0, 20000), JSON.stringify((b.links || []).slice(0, 20).map((x) => str(x, 500))), m[1]).run();
    return out({ ok: !!(r.meta && r.meta.changes) });
  }
  return out({ ok: false, error: "not found" }, 404);
}
