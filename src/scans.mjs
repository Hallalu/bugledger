// Breadledger scan results — what happens after a scan. scan.mjs --share uploads its findings here; the person
// opens /results/<id> and decides, one calm screen at a time, what to fix. Their choices are kept, and one line
// hands the "yes" ones to Claude Code. A scan belongs to whoever uploaded it (owner key → the owner's; a member's
// agent key → that member's) and only they can open it.
//
// Routes: POST /api/scans {app, files, findings[], qa11[]} → {id, url}
//         GET  /api/scans → my recent scans · GET /api/scans/<id> → the scan, grouped into decisions
//         POST /api/scans/<id>/decide {key, choice: "fix"|"later"|"undo"} · GET /api/scans/<id>/todo → the "fix" list (for the agent)
import { who } from "./auth.mjs";

const HEAD = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: HEAD });
const str = (v, n) => String(v == null ? "" : v).slice(0, n);
const SEV = { critical: 0, high: 1, medium: 2, low: 3 };

// Safe to fix without asking: mechanical repairs that don't change what the app says, how it looks or what it does
// for people (beyond working as intended). Everything else waits for the person's yes.
const AUTO = new Set(["SYNTAX-JS", "SYNTAX-JSON", "SYNTAX-INLINE-SCRIPT", "LOGIC-NAN-COMPARE", "LOGIC-TYPEOF-TYPO", "LOGIC-ASYNC-FOREACH",
  "BOUND-LE-LENGTH", "BOUND-ARRAY-LAST", "FIND-DEREF", "ARGUMENTS-CALLEE", "LITERAL-TEMPLATE", "FUNC-UNDEFINED-HANDLER", "FUNC-MISSING-ID",
  "INTEG-NO-RES-OK", "PERF-SYNC-XHR", "PERF-AWAIT-IN-LOOP", "PERF-TIGHT-INTERVAL", "PERF-HUGE-ASSET", "COMPAT-100VH", "COMPAT-BACKDROP-NO-WEBKIT",
  "SEO-NO-VIEWPORT", "A11Y-NO-LANG", "A11Y-INPUT-NOLABEL", "A11Y-EMPTY-CONTROL", "A11Y-FOCUS-KILLED", "A11Y-POSITIVE-TABINDEX",
  "A11Y-CLICK-NONINTERACTIVE", "DUP-DOM-ID", "ESC-QUOTES", "XSS-INNERHTML", "OBS-EMPTY-CATCH", "OBS-UNHANDLED-PROMISE", "TEST-ONLY",
  "INVIS-SMUGGLE", "INVIS-BIDI", "INVIS-HIDDEN", "INVIS-HOMOGLYPH", "INVIS-EXOTIC-SPACE", "DATE-TOISO", "LOCALSTORAGE-GLOBAL",
  "AUTH-NO-SEC-HEADERS", "NO-CSP", "PRIV-PII-LOG", "SW-CACHE-FIRST", "LOGIC-ASSIGN-IN-IF"]);

let ready = null;
function ensure(env) {
  if (!ready) ready = env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS scans (id TEXT PRIMARY KEY, owner_id TEXT, owner_key INTEGER NOT NULL DEFAULT 0, ts INTEGER NOT NULL, app TEXT, files INTEGER, body TEXT NOT NULL)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_scans_owner ON scans(owner_id, ts DESC)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS scan_choices (scan_id TEXT NOT NULL, key TEXT NOT NULL, choice TEXT NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (scan_id, key))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS scan_prefs (who TEXT PRIMARY KEY, autofix INTEGER NOT NULL DEFAULT 1)`),
  ]).then(() => env.DB.prepare(`ALTER TABLE scans ADD COLUMN follows TEXT`).run().catch(() => {})).catch((e) => { ready = null; throw e; });
  return ready;
}

// lines with the same problem are one decision: 47 hits of one check are "1 thing", with the places listed under it
function group(findings) {
  const by = new Map();
  for (const f of findings) {
    const k = f.detector || "OTHER";
    const g = by.get(k) || { key: k, detector: k, auto: AUTO.has(k), severity: f.severity || "low", category: f.category || "other", confidence: f.confidence || "review", bug: f.bug || "", advice: f.advice || "", places: [] };
    if ((SEV[f.severity] ?? 9) < (SEV[g.severity] ?? 9)) g.severity = f.severity;
    if (f.confidence === "high") g.confidence = "high";
    if (g.places.length < 40) g.places.push({ file: str(f.file, 200), line: +f.line || 1, excerpt: str(f.excerpt, 160) });
    g.count = (g.count || 0) + 1;
    by.set(k, g);
  }
  // surest and most serious first, so the person's first decisions are the ones that matter most
  return [...by.values()].sort((a, b) => (a.confidence === "high" ? 0 : 1) - (b.confidence === "high" ? 0 : 1) || (SEV[a.severity] ?? 9) - (SEV[b.severity] ?? 9) || b.count - a.count);
}

const prefKey = (isOwner, w) => isOwner ? "owner" : "u:" + w.user.id;
async function autofixOn(env, k) { const r = await env.DB.prepare(`SELECT autofix FROM scan_prefs WHERE who = ?`).bind(k).first(); return r ? !!r.autofix : true; }

export async function handleScans(request, env, url, ownerOK) {
  const p = url.pathname;
  if (!p.startsWith("/api/scans")) return null;
  await ensure(env);
  const w = who(request), isOwner = ownerOK(request, env);

  if (p === "/api/scans" && request.method === "POST") {
    if (!isOwner && !w.user) return out({ ok: false, error: "Sign in or connect Claude Code first." }, 401);
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.findings)) return out({ ok: false, error: "findings required" }, 400);
    const findings = body.findings.slice(0, 2000).map((f) => ({ detector: str(f.detector, 60), severity: str(f.severity, 12), category: str(f.category, 30),
      confidence: f.confidence === "high" ? "high" : "review", bug: str(f.bug, 300), advice: str(f.advice, 500), file: str(f.file, 200), line: +f.line || 1, excerpt: str(f.excerpt, 160) }));
    const qa11 = Array.isArray(body.qa11) ? body.qa11.slice(0, 11).map((q) => ({ type: str(q.type, 40), checks: +q.checks || 0, findings: +q.findings || 0, high: +q.high || 0, hands: str(q.hands, 200) })) : [];
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const ownerId = isOwner ? null : w.user.id;
    // a re-scan after fixing: whatever the last scan found and this one doesn't is FIXED — proven by the scan, not claimed
    let fixed = [], follows = null;
    if (/^[a-f0-9]{16}$/.test(String(body.after || ""))) {
      const prev = await env.DB.prepare(`SELECT * FROM scans WHERE id = ?`).bind(body.after).first();
      if (prev && (prev.owner_id ? prev.owner_id === ownerId : isOwner && !ownerId)) {
        follows = prev.id;
        const pb = JSON.parse(prev.body), now = new Set(findings.map((f) => f.detector));
        fixed = (pb.fixed || []).concat(group(pb.findings).filter((g) => !now.has(g.key)).map((g) => ({ ...g, places: g.places.slice(0, 8), fixedAt: Date.now() })));
        await env.DB.prepare(`INSERT INTO scan_choices (scan_id, key, choice, ts) SELECT ?, key, choice, ts FROM scan_choices WHERE scan_id = ?`).bind(id, prev.id).run();
      }
    }
    await env.DB.prepare(`INSERT INTO scans (id, owner_id, owner_key, ts, app, files, body, follows) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(id, ownerId, isOwner ? 1 : 0, Date.now(), str(body.app, 80), +body.files || 0, JSON.stringify({ findings, qa11, fixed }), follows).run();
    const groups = group(findings), autofix = await autofixOn(env, prefKey(isOwner, w));
    return out({ ok: true, id, url: url.origin + "/results/" + id, autofix, fixed: fixed.length, auto: groups.filter((g) => g.auto).length, ask: groups.filter((g) => !g.auto).length });
  }

  if (p === "/api/scans" && request.method === "GET") {
    if (!isOwner && !w.user) return out({ ok: false, error: "Sign in first." }, 401);
    const { results } = isOwner
      ? await env.DB.prepare(`SELECT id, ts, app, files FROM scans WHERE owner_key = 1 ORDER BY ts DESC LIMIT 30`).all()
      : await env.DB.prepare(`SELECT id, ts, app, files FROM scans WHERE owner_id = ? ORDER BY ts DESC LIMIT 30`).bind(w.user.id).all();
    return out({ ok: true, scans: results || [] });
  }

  // the autofix switch (on unless the person turns it off): safe fixes go straight to Claude Code
  if (p === "/api/scans/prefs") {
    if (!isOwner && !w.user) return out({ ok: false, error: "Sign in first." }, 401);
    const k = prefKey(isOwner, w);
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      await env.DB.prepare(`INSERT INTO scan_prefs (who, autofix) VALUES (?, ?) ON CONFLICT(who) DO UPDATE SET autofix = excluded.autofix`).bind(k, b.autofix ? 1 : 0).run();
    }
    return out({ ok: true, autofix: await autofixOn(env, k) });
  }

  const m = p.match(/^\/api\/scans\/([a-f0-9]{16})(\/decide|\/todo)?$/);
  if (!m) return out({ ok: false, error: "not found" }, 404);
  const row = await env.DB.prepare(`SELECT * FROM scans WHERE id = ?`).bind(m[1]).first();
  if (!row) return out({ ok: false, error: "We couldn't find that scan." }, 404);
  if (!(row.owner_id ? (w.user && w.user.id === row.owner_id) : isOwner)) return out({ ok: false, error: "This scan is private. Sign in to see it." }, 401);
  const body = JSON.parse(row.body);
  const groups = group(body.findings);
  const { results: ch } = await env.DB.prepare(`SELECT key, choice, ts FROM scan_choices WHERE scan_id = ?`).bind(row.id).all();
  const choices = Object.fromEntries((ch || []).map((c) => [c.key, c.choice]));

  if (m[2] === "/decide" && request.method === "POST") {
    const o = request.headers.get("origin");
    if (o && o !== url.origin) return out({ ok: false, error: "bad request" }, 400);
    const b = await request.json().catch(() => ({}));
    const key = str(b.key, 60);
    if (!groups.some((g) => g.key === key)) return out({ ok: false, error: "unknown item" }, 400);
    if (b.choice === "undo") await env.DB.prepare(`DELETE FROM scan_choices WHERE scan_id = ? AND key = ?`).bind(row.id, key).run();
    else if (b.choice === "fix" || b.choice === "later")
      await env.DB.prepare(`INSERT INTO scan_choices (scan_id, key, choice, ts) VALUES (?,?,?,?) ON CONFLICT(scan_id, key) DO UPDATE SET choice = excluded.choice, ts = excluded.ts`).bind(row.id, key, b.choice, Date.now()).run();
    else return out({ ok: false, error: "choice must be fix, later or undo" }, 400);
    return out({ ok: true });
  }

  if (m[2] === "/todo") {
    // what Claude Code reads: only the things the person said yes to, each with its places and the fix
    const af = await autofixOn(env, row.owner_id ? "u:" + row.owner_id : "owner");
    const todo = groups.filter((g) => choices[g.key] !== "later" && ((af && g.auto) || choices[g.key] === "fix"))
      .map((g) => ({ check: g.detector, why: g.auto && choices[g.key] !== "fix" ? "autofix" : "approved", checkFirst: g.confidence !== "high", problem: g.bug, fix: g.advice, places: g.places }));
    return out({ ok: true, app: row.app, scan: row.id, autofix: af, todo,
      instructions: "Fix each item at every place listed with the smallest change and keep everything else as it is. Items marked CHECK FIRST are leads: read each place and change it only if it really is the problem (leave false alarms alone). Run the tests, then run the scan again with --after " + row.id + " so the fixes are proven." });
  }

  const fixed = body.fixed || [], af = await autofixOn(env, row.owner_id ? "u:" + row.owner_id : "owner");
  // everything caught = what was fixed since the first scan + what this scan still finds (places counted, not just kinds)
  const caught = fixed.reduce((n, g) => n + (g.count || 1), 0) + body.findings.length;
  return out({ ok: true, id: row.id, ts: row.ts, app: row.app, files: row.files, follows: row.follows || null, qa11: body.qa11, autofix: af,
    caught, caughtKinds: fixed.length + groups.length, total: body.findings.length, fixed, groups, choices });
}
