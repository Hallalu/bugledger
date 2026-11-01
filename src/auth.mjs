// Breadledger accounts — the very simple way in: type your email, type the 6-digit code from it, you're in.
// One flow for new and returning people (no passcode to invent, nothing to copy). The browser keeps an HttpOnly
// session cookie; sessions live in D1 so "sign out" really ends them on the server, and several accounts can be
// signed in on one browser (switch from the avatar menu). A member's coding agent connects with one copied line
// that carries an agent key (blk_…); its chats land on that member's private board.
//
// Tables are created here on first use, so a deploy needs no manual migration.
// Routes: POST /api/auth/start {email} · POST /api/auth/verify {email,code} · GET /api/auth/me · POST /api/auth/name {name}
//         POST /api/auth/signout {all?|id?} · POST /api/auth/switch {id} · GET /api/auth/devices · POST /api/auth/connect
//         GET /api/auth/keys · POST /api/auth/keys/revoke {id} · POST /api/auth/delete/start · POST /api/auth/delete {code}
//         GET /api/auth/export · POST /api/auth/owner {email} (owner token only: marks the owner's own email)

const CODE_MINUTES = 15, CODE_TRIES = 5, CODES_PER_EMAIL = 3, CODES_PER_IP = 12, WINDOW = 15 * 60_000;
const SESSION_DAYS = 90, MAX_ACCOUNTS = 5;
const EMAIL_RE = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,24}$/i;
const KEY_RE = /^blk_[a-f0-9]{40}$/;
const COOKIE = "__Host-bl_s", ALL = "__Host-bl_all";
const HEAD = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

const REQ = new WeakMap();   // request → { user, isOwner, viaKey }
export const who = (request) => REQ.get(request) || {};

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const sha = async (s) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const rand = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const code6 = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
const out = (obj, status = 200, cookies = []) => {
  const h = new Headers(HEAD); for (const c of cookies) h.append("set-cookie", c);
  return new Response(JSON.stringify(obj), { status, headers: h });
};
const cleanEmail = (e) => String(e || "").trim().toLowerCase().slice(0, 254);
const cleanName = (n) => String(n || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
const cookieOf = (request, name) => { const m = (request.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name.replace(/[-_]/g, "\\$&") + "=([^;]*)")); return m ? m[1] : ""; };
const setCookie = (name, val, days) => `${name}=${val}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${days ? Math.round(days * 86400) : 0}`;

let ready = null;
export function ensureAuth(env) {
  if (!env.DB) return Promise.resolve();
  if (!ready) ready = (async () => {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, role TEXT NOT NULL DEFAULT 'member', created INTEGER NOT NULL, deleted INTEGER)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_codes (id TEXT PRIMARY KEY, email TEXT NOT NULL, hash TEXT NOT NULL, purpose TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0, used INTEGER, ip TEXT)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes(email, created DESC)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created INTEGER NOT NULL, last_seen INTEGER NOT NULL, device TEXT, ended INTEGER)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS agent_keys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL, created INTEGER NOT NULL, last_used INTEGER, revoked INTEGER)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_log (ts INTEGER NOT NULL, user_id TEXT, kind TEXT NOT NULL, detail TEXT)`),
    ]);
    // a member's boards and chats belong to them (NULL = the owner's own, as before)
    try { await env.DB.prepare(`ALTER TABLE sessions ADD COLUMN owner_id TEXT`).run(); } catch {}
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

const log = (env, user_id, kind, detail = "") => env.DB.prepare(`INSERT INTO auth_log (ts,user_id,kind,detail) VALUES (?,?,?,?)`).bind(Date.now(), user_id || null, kind, String(detail).slice(0, 200)).run().catch(() => {});
const device = (request) => {
  const ua = request.headers.get("user-agent") || "";
  const os = /iPhone|iPad/.test(ua) ? "iPhone or iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "a device";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "a browser";
  const where = (request.cf && [request.cf.city, request.cf.country].filter(Boolean).join(", ")) || "";
  return `${br} on ${os}${where ? " · " + where : ""}`;
};

// ---- who is asking: a session cookie, or an agent key (blk_…) in x-ledger-key ----
export async function resolve(request, env) {
  const ctx = {};
  try {
    await ensureAuth(env);
    const tok = cookieOf(request, COOKIE);
    if (/^[a-f0-9]{64}$/.test(tok)) {
      const id = await sha(tok);
      const row = await env.DB.prepare(`SELECT s.id sid, s.last_seen, u.id, u.email, u.name, u.role FROM auth_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.ended IS NULL AND u.deleted IS NULL AND s.last_seen > ?`).bind(id, Date.now() - SESSION_DAYS * 864e5).first();
      if (row) {
        ctx.user = { id: row.id, email: row.email, name: row.name || "", role: row.role }; ctx.sid = row.sid; ctx.isOwner = row.role === "owner";
        if (Date.now() - row.last_seen > 3600_000) env.DB.prepare(`UPDATE auth_sessions SET last_seen = ? WHERE id = ?`).bind(Date.now(), id).run().catch(() => {});
      }
    }
    const key = request.headers.get("x-ledger-key") || "";
    if (!ctx.user && KEY_RE.test(key)) {
      const row = await env.DB.prepare(`SELECT k.id kid, k.last_used, u.id, u.email, u.name, u.role FROM agent_keys k JOIN users u ON u.id = k.user_id
        WHERE k.key_hash = ? AND k.revoked IS NULL AND u.deleted IS NULL`).bind(await sha(key)).first();
      if (row) {
        ctx.user = { id: row.id, email: row.email, name: row.name || "", role: row.role }; ctx.viaKey = row.kid; ctx.isOwner = row.role === "owner";
        if (!row.last_used || Date.now() - row.last_used > 600_000) env.DB.prepare(`UPDATE agent_keys SET last_used = ? WHERE id = ?`).bind(Date.now(), row.kid).run().catch(() => {});
      }
    }
  } catch (e) { console.log("auth resolve failed", e && e.message); }
  REQ.set(request, ctx);
  return ctx;
}

// ---- the code email (sent from Breadledger's own address so mail apps show its logo, not initials) ----
function mime(from, to, subject, text, html) {
  const b = "bl" + rand(10), id = `<${crypto.randomUUID()}@${from.split("@")[1]}>`;
  const enc = (s) => btoa(unescape(encodeURIComponent(s))).replace(/.{76}/g, "$&\r\n");
  return [`From: Breadledger <${from}>`, `To: ${to}`, `Subject: ${subject}`, `Date: ${new Date().toUTCString()}`, `Message-ID: ${id}`,
    "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${b}"`, "",
    `--${b}`, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", enc(text),
    `--${b}`, "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: base64", "", enc(html), `--${b}--`, ""].join("\r\n");
}
async function sendCode(env, to, code, purpose) {
  if (env.AUTH_DEV_ECHO === "1") { console.log(`[dev] code for ${to}: ${code}`); return; }
  const from = env.MAIL_FROM;
  if (!env.SEND || !from) throw new Error("no sending address");
  const del = purpose === "delete";
  const subject = del ? `${code} — confirm deleting your Breadledger account` : `${code} is your Breadledger code`;
  const lead = del ? "Type this code to confirm you want to delete your Breadledger account:" : "Type this code to sign in to Breadledger:";
  const text = `${lead}\n\n${code}\n\nIt works once, for ${CODE_MINUTES} minutes. If you didn't ask for it, ignore this email — nothing happens without the code.`;
  const html = `<div style="font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1b18;max-width:440px;margin:0 auto;padding:28px 20px">
<p style="margin:0 0 18px;font-weight:650;font-size:18px">Breadledger</p><p style="margin:0 0 14px">${lead}</p>
<p style="margin:0 0 18px;font:700 34px/1.2 ui-monospace,Menlo,monospace;letter-spacing:6px">${code}</p>
<p style="margin:0;color:#6b675e;font-size:14px">It works once, for ${CODE_MINUTES} minutes. If you didn't ask for it, ignore this email — nothing happens without the code.</p></div>`;
  const { EmailMessage } = await import("cloudflare:email");
  await env.SEND.send(new EmailMessage(from, to, mime(from, to, subject, text, html)));
}

async function issueCode(request, env, email, purpose) {
  const now = Date.now(), ip = await sha("ip:" + (request.headers.get("cf-connecting-ip") || "local"));
  const [byEmail, byIp] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) n FROM auth_codes WHERE email = ? AND created > ?`).bind(email, now - WINDOW).first(),
    env.DB.prepare(`SELECT COUNT(*) n FROM auth_codes WHERE ip = ? AND created > ?`).bind(ip, now - 4 * WINDOW).first(),
  ]);
  if ((byEmail && byEmail.n >= CODES_PER_EMAIL) || (byIp && byIp.n >= CODES_PER_IP)) return { wait: true };
  const code = code6(), id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO auth_codes (id,email,hash,purpose,created,expires,ip) VALUES (?,?,?,?,?,?,?)`)
    .bind(id, email, await sha(`${id}:${email}:${code}`), purpose, now, now + CODE_MINUTES * 60_000, ip).run();
  try { await sendCode(env, email, code, purpose); }
  catch (e) { await env.DB.prepare(`DELETE FROM auth_codes WHERE id = ?`).bind(id).run(); throw e; }   // a code nobody received must not count
  env.DB.prepare(`DELETE FROM auth_codes WHERE expires < ?`).bind(now - 864e5).run().catch(() => {});
  return { ok: true };
}
async function checkCode(env, email, code, purpose) {
  const now = Date.now();
  const row = await env.DB.prepare(`SELECT id, hash, tries FROM auth_codes WHERE email = ? AND purpose = ? AND used IS NULL AND expires > ? ORDER BY created DESC LIMIT 1`).bind(email, purpose, now).first();
  if (!row) return "expired";
  if (row.tries >= CODE_TRIES) return "locked";
  if (!/^\d{6}$/.test(code) || (await sha(`${row.id}:${email}:${code}`)) !== row.hash) {
    await env.DB.prepare(`UPDATE auth_codes SET tries = tries + 1 WHERE id = ?`).bind(row.id).run();
    return row.tries + 1 >= CODE_TRIES ? "locked" : "wrong";
  }
  await env.DB.prepare(`UPDATE auth_codes SET used = ? WHERE id = ?`).bind(now, row.id).run();
  return "ok";
}
const CODE_ERR = { expired: "That code has run out. Ask for a new one.", locked: "Too many tries with that code. Ask for a new one.", wrong: "That code isn't right. Check the email and try again." };

async function accounts(request, env, current) {
  const toks = cookieOf(request, ALL).split(".").filter((t) => /^[a-f0-9]{64}$/.test(t)).slice(0, MAX_ACCOUNTS);
  const list = [];
  for (const t of toks) {
    const r = await env.DB.prepare(`SELECT u.id, u.email, u.name FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.ended IS NULL AND u.deleted IS NULL`).bind(await sha(t)).first();
    if (r && !list.some((x) => x.id === r.id)) list.push({ id: r.id, email: r.email, name: r.name || "", current: !!current && r.id === current.id, tok: t });
  }
  return list;
}
const pub = (u) => u && { id: u.id, email: u.email, name: u.name || "", role: u.role === "owner" ? "owner" : "member" };
const connectLine = (origin, key) => `curl -fsSL ${origin}/connect.mjs -o /tmp/breadledger-connect.mjs && node /tmp/breadledger-connect.mjs ${key} ${origin}`;

export async function handleAuth(request, env, url) {
  const p = url.pathname;
  if (!p.startsWith("/api/auth/")) return null;
  const ctx = who(request), u = ctx.user, origin = url.origin;
  // cookie-carrying POSTs must come from this site as JSON (a cross-site form can do neither)
  if (request.method === "POST") {
    const o = request.headers.get("origin");
    if ((o && o !== origin) || !/application\/json/.test(request.headers.get("content-type") || "")) return out({ ok: false, error: "bad request" }, 400);
  }
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const signedIn = () => u && !ctx.viaKey;
  const need = () => out({ ok: false, error: "Sign in first." }, 401);

  try {
    if (p === "/api/auth/start" && request.method === "POST") {
      const email = cleanEmail(body.email);
      if (!EMAIL_RE.test(email)) return out({ ok: false, error: "That doesn't look like an email address." }, 400);
      const r = await issueCode(request, env, email, "signin");
      if (r.wait) return out({ ok: false, error: "We've sent a few codes already. Wait a few minutes, then ask again." }, 429);
      return out({ ok: true, minutes: CODE_MINUTES });
    }

    if (p === "/api/auth/verify" && request.method === "POST") {
      const email = cleanEmail(body.email), code = String(body.code || "").replace(/\D/g, "");
      const res = await checkCode(env, email, code, "signin");
      if (res !== "ok") return out({ ok: false, error: CODE_ERR[res] }, 400);
      const now = Date.now();
      let user = await env.DB.prepare(`SELECT id, email, name, role FROM users WHERE email = ? AND deleted IS NULL`).bind(email).first(), isNew = false;
      if (!user) {
        isNew = true; user = { id: crypto.randomUUID(), email, name: cleanName(email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())), role: "member" };
        await env.DB.prepare(`INSERT INTO users (id,email,name,role,created) VALUES (?,?,?,?,?)`).bind(user.id, email, user.name, "member", now).run();
      }
      const tok = rand(32);
      await env.DB.prepare(`INSERT INTO auth_sessions (id,user_id,created,last_seen,device) VALUES (?,?,?,?,?)`).bind(await sha(tok), user.id, now, now, device(request)).run();
      log(env, user.id, isNew ? "signup" : "signin", device(request));
      // keep the other accounts signed in on this browser too (switch from the avatar menu)
      const others = (await accounts(request, env, null)).filter((a) => a.id !== user.id).map((a) => a.tok);
      return out({ ok: true, isNew, user: pub(user) }, 200, [setCookie(COOKIE, tok, SESSION_DAYS), setCookie(ALL, [tok, ...others].slice(0, MAX_ACCOUNTS).join("."), SESSION_DAYS)]);
    }

    if (p === "/api/auth/me" && request.method === "GET") {
      if (!signedIn()) return out({ ok: true, user: null, accounts: (await accounts(request, env, null)).map(({ tok, ...a }) => a) });
      return out({ ok: true, user: pub(u), accounts: (await accounts(request, env, u)).map(({ tok, ...a }) => a) });
    }

    if (p === "/api/auth/name" && request.method === "POST") {
      if (!signedIn()) return need();
      const name = cleanName(body.name);
      if (!name) return out({ ok: false, error: "Type a name." }, 400);
      await env.DB.prepare(`UPDATE users SET name = ? WHERE id = ?`).bind(name, u.id).run();
      return out({ ok: true, user: { ...pub(u), name } });
    }

    if (p === "/api/auth/switch" && request.method === "POST") {
      const list = await accounts(request, env, u), to = list.find((a) => a.id === String(body.id || ""));
      if (!to) return out({ ok: false, error: "That account isn't signed in on this browser." }, 400);
      return out({ ok: true }, 200, [setCookie(COOKIE, to.tok, SESSION_DAYS)]);
    }

    if (p === "/api/auth/signout" && request.method === "POST") {
      if (!signedIn()) return out({ ok: true }, 200, [setCookie(COOKIE, "", 0)]);
      const now = Date.now();
      if (body.id) {   // sign out one other device from the devices list
        await env.DB.prepare(`UPDATE auth_sessions SET ended = ? WHERE id = ? AND user_id = ? AND ended IS NULL`).bind(now, String(body.id), u.id).run();
        log(env, u.id, "signout-device"); return out({ ok: true });
      }
      if (body.all) await env.DB.prepare(`UPDATE auth_sessions SET ended = ? WHERE user_id = ? AND ended IS NULL`).bind(now, u.id).run();
      else await env.DB.prepare(`UPDATE auth_sessions SET ended = ? WHERE id = ?`).bind(now, ctx.sid).run();
      log(env, u.id, body.all ? "signout-all" : "signout");
      // the next signed-in account on this browser (if any) becomes the current one
      const rest = (await accounts(request, env, u)).filter((a) => a.id !== u.id);
      return out({ ok: true, next: rest[0] ? rest[0].id : null }, 200, [
        setCookie(COOKIE, rest[0] ? rest[0].tok : "", rest[0] ? SESSION_DAYS : 0),
        setCookie(ALL, rest.map((a) => a.tok).join("."), rest.length ? SESSION_DAYS : 0)]);
    }

    if (p === "/api/auth/devices" && request.method === "GET") {
      if (!signedIn()) return need();
      const { results } = await env.DB.prepare(`SELECT id, created, last_seen, device FROM auth_sessions WHERE user_id = ? AND ended IS NULL AND last_seen > ? ORDER BY last_seen DESC LIMIT 30`).bind(u.id, Date.now() - SESSION_DAYS * 864e5).all();
      return out({ ok: true, devices: (results || []).map((d) => ({ ...d, current: d.id === ctx.sid })) });
    }

    if (p === "/api/auth/connect" && request.method === "POST") {
      if (!signedIn()) return need();
      const key = "blk_" + rand(20), id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO agent_keys (id,user_id,key_hash,prefix,created) VALUES (?,?,?,?,?)`).bind(id, u.id, await sha(key), key.slice(0, 10), Date.now()).run();
      log(env, u.id, "agent-key");
      return out({ ok: true, line: connectLine(origin, key) });
    }
    if (p === "/api/auth/keys" && request.method === "GET") {
      if (!signedIn()) return need();
      const { results } = await env.DB.prepare(`SELECT id, prefix, created, last_used FROM agent_keys WHERE user_id = ? AND revoked IS NULL ORDER BY created DESC`).bind(u.id).all();
      return out({ ok: true, keys: results || [] });
    }
    if (p === "/api/auth/keys/revoke" && request.method === "POST") {
      if (!signedIn()) return need();
      await env.DB.prepare(`UPDATE agent_keys SET revoked = ? WHERE id = ? AND user_id = ?`).bind(Date.now(), String(body.id || ""), u.id).run();
      log(env, u.id, "agent-key-revoke"); return out({ ok: true });
    }

    if (p === "/api/auth/export" && request.method === "GET") {
      if (!signedIn()) return need();
      const [s, k, d] = await Promise.all([
        env.DB.prepare(`SELECT id, started, updated, app, project, title, status, current, tasks FROM sessions WHERE owner_id = ? ORDER BY started`).bind(u.id).all(),
        env.DB.prepare(`SELECT prefix, created, last_used, revoked FROM agent_keys WHERE user_id = ?`).bind(u.id).all(),
        env.DB.prepare(`SELECT created, last_seen, device, ended FROM auth_sessions WHERE user_id = ?`).bind(u.id).all(),
      ]);
      const evs = (s.results || []).length ? (await env.DB.prepare(`SELECT session_id, ts, kind, title, detail FROM session_events WHERE session_id IN (SELECT id FROM sessions WHERE owner_id = ?) ORDER BY ts`).bind(u.id).all()).results : [];
      const file = { exported: new Date().toISOString(), account: pub(u), boards: s.results || [], events: evs || [], agentKeys: k.results || [], devices: d.results || [] };
      return new Response(JSON.stringify(file, null, 2), { headers: { ...HEAD, "content-disposition": `attachment; filename="breadledger-${new Date().toISOString().slice(0, 10)}.json"` } });
    }

    // delete = a fresh code first (re-authentication), then the account is gone: email released, devices signed out, keys revoked
    if (p === "/api/auth/delete/start" && request.method === "POST") {
      if (!signedIn()) return need();
      const r = await issueCode(request, env, u.email, "delete");
      if (r.wait) return out({ ok: false, error: "We've sent a few codes already. Wait a few minutes, then ask again." }, 429);
      return out({ ok: true, email: u.email });
    }
    if (p === "/api/auth/delete" && request.method === "POST") {
      if (!signedIn()) return need();
      const res = await checkCode(env, u.email, String(body.code || "").replace(/\D/g, ""), "delete");
      if (res !== "ok") return out({ ok: false, error: CODE_ERR[res] }, 400);
      if (u.role === "owner") return out({ ok: false, error: "The owner account can't be deleted here." }, 400);
      const now = Date.now();
      await env.DB.batch([
        env.DB.prepare(`UPDATE users SET deleted = ?, email = ?, name = '' WHERE id = ?`).bind(now, "deleted:" + u.id, u.id),
        env.DB.prepare(`UPDATE auth_sessions SET ended = ? WHERE user_id = ? AND ended IS NULL`).bind(now, u.id),
        env.DB.prepare(`UPDATE agent_keys SET revoked = ? WHERE user_id = ? AND revoked IS NULL`).bind(now, u.id),
      ]);
      log(env, u.id, "deleted");
      const rest = (await accounts(request, env, u)).filter((a) => a.id !== u.id);
      return out({ ok: true }, 200, [setCookie(COOKIE, rest[0] ? rest[0].tok : "", rest[0] ? SESSION_DAYS : 0), setCookie(ALL, rest.map((a) => a.tok).join("."), rest.length ? SESSION_DAYS : 0)]);
    }

    if (p === "/api/auth/owner" && request.method === "POST") {
      if (!env.LEDGER_WRITE_TOKEN || request.headers.get("x-ledger-key") !== env.LEDGER_WRITE_TOKEN) return out({ ok: false, error: "owner key only" }, 401);
      const email = cleanEmail(body.email);
      if (!EMAIL_RE.test(email)) return out({ ok: false, error: "email required" }, 400);
      const row = await env.DB.prepare(`SELECT id FROM users WHERE email = ? AND deleted IS NULL`).bind(email).first();
      if (row) await env.DB.prepare(`UPDATE users SET role = 'owner' WHERE id = ?`).bind(row.id).run();
      else await env.DB.prepare(`INSERT INTO users (id,email,name,role,created) VALUES (?,?,?,?,?)`).bind(crypto.randomUUID(), email, "", "owner", Date.now()).run();
      return out({ ok: true });
    }
  } catch (e) {
    console.log("auth error", p, e && e.message);
    return out({ ok: false, error: /sending address|send/i.test(String(e && e.message)) ? "We couldn't send the email just now. Try again in a minute." : "Something went wrong. Try again." }, 500);
  }
  return out({ ok: false, error: "not found" }, 404);
}
