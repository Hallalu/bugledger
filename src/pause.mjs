// Pause / play on a Now board card. Pressing pause on a board makes the agent working on it hold still before its next
// move: its PreToolUse hook (pause-gate.mjs in the owner's hooks) reads GET /api/session/pause and does not return until
// play. Kept in its own table so the append-only sessions table and its readers are untouched.
//   GET  /api/session/pause?id=   public, like the board: { paused, held, active } (an unseen id just says not paused)
//   POST /api/session/pause       { id, paused } owner, or the member whose board it is; same-site JSON only
//   POST /api/session/held        { id } the agent's hook, with its key: "I have really stopped"
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

let ready = false;
const ensure = async (env) => {
  if (ready) return;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS session_pause (id TEXT PRIMARY KEY, paused_at INTEGER NOT NULL, held_at INTEGER NOT NULL DEFAULT 0)").run();
  ready = true;
};

export async function handlePause(request, env, url, writer) {
  const p = url.pathname;
  if (p !== "/api/session/pause" && p !== "/api/session/held") return null;
  await ensure(env);
  const state = async (id) => {
    const [row, s] = await Promise.all([
      env.DB.prepare("SELECT paused_at, held_at FROM session_pause WHERE id = ?").bind(id).first(),
      env.DB.prepare("SELECT status FROM sessions WHERE id = ?").bind(id).first(),
    ]);
    const active = !!s && s.status !== "done";   // a finished board can't hold anyone
    return { paused: active && !!row, held: active && !!(row && row.held_at), active };
  };

  if (p === "/api/session/pause" && request.method === "GET") {
    const id = String(url.searchParams.get("id") || "").slice(0, 60);
    return id ? json(await state(id)) : json({ ok: false, error: "id required" }, 400);
  }
  if (request.method !== "POST") return json({ ok: false, error: "not found" }, 404);
  const o = request.headers.get("origin");
  if ((o && o !== url.origin) || !/application\/json/.test(request.headers.get("content-type") || "")) return json({ ok: false, error: "bad request" }, 400);
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "").slice(0, 60);
  if (!id) return json({ ok: false, error: "id required" }, 400);
  const by = writer(request, env);
  if (!by) return json({ ok: false, error: "sign in first" }, 401);
  const row = await env.DB.prepare("SELECT status, owner_id FROM sessions WHERE id = ?").bind(id).first();
  if (!row) return json({ ok: false, error: "not found" }, 404);
  if ((row.owner_id || null) !== (by.member || null)) return json({ ok: false, error: "not your board" }, 403);

  if (p === "/api/session/held") {
    await env.DB.prepare("UPDATE session_pause SET held_at = ? WHERE id = ?").bind(Date.now(), id).run();
    return json({ ok: true });
  }
  if (row.status === "done") return json({ ok: false, error: "finished" }, 409);
  if (body.paused) await env.DB.prepare("INSERT OR IGNORE INTO session_pause (id, paused_at, held_at) VALUES (?, ?, 0)").bind(id, Date.now()).run();
  else await env.DB.prepare("DELETE FROM session_pause WHERE id = ?").bind(id).run();
  return json(await state(id));
}

// the Now and Live pages get the button without carrying it in their own markup
export const withPauseButton = (res, focus) => new HTMLRewriter().on("head", {
  element(h) {
    if (focus) h.append(`<script>window.BOARD_PAUSE_ID=${JSON.stringify(focus)}</script>`, { html: true });
    h.append('<script src="/board-pause.js" data-api="/api/session/pause?id=:id" data-signin="/account" data-cards=".card-f" data-link="/now/" defer></script>', { html: true });
  },
}).transform(res);
