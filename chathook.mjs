#!/usr/bin/env node
/*
 Breadledger — every chat on the Now board. Each Claude chat on this Mac gets its own private card at /now: what you
 asked, what it is doing this second, every step of its plan with ticks and a %, its helper agents, and whether it is
 working, waiting for your reply, needs your OK, or closed. No prompt to remember: the chat's own transcript is the
 source, so a chat shows up the moment it does anything.

 Runs three ways (one code path):
   hook   Claude Code hooks call it on UserPromptSubmit, PostToolUse (*), Stop, Notification and SessionEnd.
          Install once in ~/.claude/settings.json (async, never slows a chat):
            { "hooks": [{ "type": "command", "command": "node ~/BugLedger/chathook.mjs", "async": true, "timeout": 15 }] }
   scan   node ~/BugLedger/chathook.mjs scan [--mins 120] [--dry]   register every chat active in the last N minutes
   watch  node ~/BugLedger/chathook.mjs watch [--every 10]           keep every chat current, hooks or not

 Where the plan comes from, best first: the chat's Aprizely board (waves + notes), the app's task list
 (update_plan / wrap_up), the CLI's TodoWrite list. % = steps done ÷ steps.

 Private by design: chat cards are ids "chat-<session>", and the server shows them only with the owner's key.
 Nothing leaves the Mac except short descriptions ("Editing now.html", "Running the tests"), a file's base name, a
 web host, and your own prompt text (scrubbed of anything that looks like a key). State: ~/.breadboard/chats/.
*/
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const PROJ = path.join(HOME, ".claude", "projects");
const DIR = process.env.CHATS_STATE || path.join(HOME, ".breadboard", "chats");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const DRY = argv.includes("--dry");
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(HOME, ".bugledger.json"), "utf8")); } catch {}
const BASE = (process.env.CHATS_BASE || process.env.BUGLEDGER_BASE || cfg.base || "https://breadledger.coconvo.workers.dev").replace(/\/$/, "");
const TOKEN = process.env.CHATS_TOKEN || process.env.BUGLEDGER_TOKEN || cfg.token || "";
fs.mkdirSync(DIR, { recursive: true });

// ---------- small helpers ----------
const clip = (t, n = 140) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t; };
const base = (p) => path.basename(String(p || "")) || "a file";
const host = (u) => { try { return new URL(/^https?:/.test(u) ? u : "https://" + u).host; } catch { return "a page"; } };
// nothing that looks like a local path or a secret leaves the machine
const scrub = (t) => String(t || "")
  .replace(/(?:~|\/(?:Users|home|private|var|tmp|opt|Volumes))\/[^\s"'`)]+/g, (m) => path.basename(m))
  .replace(/\b(?:sk|pk|rk|blk|ghp|gho|ghs|xox[bp]|AKIA|eyJ)[-_A-Za-z0-9.]{12,}\b/g, "[key]")
  .replace(/\b[A-Fa-f0-9]{32,}\b/g, "[id]");
// a human prompt, cleaned for a card: pasted blocks and reminders folded away
const cleanPrompt = (t) => scrub(String(t || "")
  .replace(/<pasted_content[^>]*>[\s\S]*?<\/pasted_content>/g, " [pasted text] ")
  .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, " ")
  .replace(/<[a-z-]+>[\s\S]*?<\/[a-z-]+>/g, " "))
  .replace(/\s+/g, " ").trim();
const SKIP_TOP = new Set(["Library", "Desktop", "Downloads", "Documents", "Pictures", "Movies", "Music", "Applications", "Public", "node_modules"]);
// folders that hold projects rather than being one: the project is the folder inside
const CONTAINERS = new Set(["Projects", "projects", "code", "Code", "dev", "Developer", "src", "repos", "work", "Sites", "GitHub", "github", "apps"]);
const pretty = (f) => !f ? "" : /[A-Z]/.test(f) ? f : f.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };

// ---------- what a tool call means, in plain words (same grammar as breadhook.mjs) ----------
const BROWSER = { navigate: ["Opening a page in the browser", "browser"], screenshot: ["Looking at the page", "eye"], read_page: ["Reading the page", "eye"],
  get_page_text: ["Reading the page", "eye"], find: ["Looking for something on the page", "eye"], javascript_tool: ["Checking the page in the browser", "browser"],
  resize_window: ["Checking the page at another size", "browser"], read_console_messages: ["Checking the browser console for errors", "browser"],
  read_network_requests: ["Checking the page's network calls", "browser"], preview_start: ["Starting a local preview", "run"], form_input: ["Filling in a form field", "browser"],
  browser_batch: ["Working through the page in the browser", "browser"], tabs_create: ["Opening a browser tab", "browser"] };
function describe(t, ti) {
  ti = ti || {};
  if (t === "Read") return [`Reading ${base(ti.file_path)}`, "read"];
  if (t === "Edit" || t === "MultiEdit") return [`Editing ${base(ti.file_path)}`, "edit"];
  if (t === "Write") return [`Writing ${base(ti.file_path)}`, "edit"];
  if (t === "NotebookEdit") return [`Editing ${base(ti.notebook_path)}`, "edit"];
  if (t === "Grep") return [`Searching the code for “${clip(ti.pattern, 40)}”`, "search"];
  if (t === "Glob") return [`Finding files (${clip(ti.pattern, 40)})`, "search"];
  if (t === "Bash") {
    const c = String(ti.command || "");
    if (/apz\.mjs/.test(c)) return ["Updating its Aprizely board", "act"];
    if (/worklog\.mjs/.test(c)) return ["Updating its Breadledger board", "act"];
    // the test-tube icon only for a command that really runs tests, not one that mentions a "test server"
    const runsTests = /node --test|npm (run )?test|npx (vitest|jest|playwright test)|pytest|\btest\/[\w.-]+\.(m?js|ts)\b/.test(c);
    if (ti.description) return [clip(ti.description), runsTests ? "test" : /git (commit|push)|wrangler deploy/.test(c) ? "ship" : "run"];
    return [/node --test|npm (run )?test/.test(c) ? "Running the tests" : /git commit/.test(c) ? "Committing the change" : /git push/.test(c) ? "Pushing to git" : "Running a command", "run"];
  }
  if (t === "WebSearch") return [`Searching the web: ${clip(ti.query, 80)}`, "search"];
  if (t === "WebFetch") return [`Reading a page on ${host(ti.url)}`, "read"];
  if (t === "Agent" || t === "Task") return [`Asking a helper agent: ${clip(ti.description || "a sub-task", 80)}`, "agent"];
  if (t === "SendMessage") return ["Messaging a helper agent", "agent"];
  if (t === "Skill") return [`Using the ${clip(ti.skill, 40)} skill`, "agent"];
  if (t === "Artifact") return ["Publishing a page", "ship"];
  if (t === "SendUserFile") return ["Sending you a file", "ship"];
  if (t === "AskUserQuestion") return ["Asking you a question", "act"];
  if (/^(TodoWrite|ToolSearch|TaskCreate|TaskUpdate|TaskList|TaskGet|TaskStop|ListAgents|ReadNotifications|ScheduleWakeup)$/.test(t)) return null;
  const m = /^mcp__(.+?)__(.+)$/.exec(t);
  if (m) {
    const srv = m[1], name = m[2];
    if (/^ccd_(turn|view|session|sidebar|window|settings)|^visualize$/.test(srv)) return null;
    if (/Browser|chrome/i.test(srv)) {
      // a batch of browser steps says what it does: its first two different steps
      if (name === "browser_batch" && Array.isArray(ti.actions)) {
        const parts = [...new Set(ti.actions.map((a) => { const d = a && describe("mcp__" + srv + "__" + a.name, a.input || {}); return d && d[0]; }).filter(Boolean))];
        if (parts.length) return [clip(parts.slice(0, 2).map((p, i) => i ? p.charAt(0).toLowerCase() + p.slice(1) : p).join(", then ") + (parts.length > 2 ? " …" : ""), 120), "browser"];
      }
      if (name === "computer") { const a = ti.action || ""; if (a === "screenshot" || a === "zoom") return BROWSER.screenshot; if (a === "wait") return null;
        if (ti.action_summary) return [clip(ti.action_summary, 100), "browser"]; return [a === "scroll" ? "Scrolling the page" : a === "type" ? "Typing on the page" : "Clicking on the page", "browser"]; }
      if (name === "navigate") return [`Opening ${ti.url === "back" ? "the previous page" : host(ti.url)}`, "browser"];
      return BROWSER[name] || ["Using the browser", "browser"];
    }
    // remote code tools (GitBagel and other connectors): say "on GitBagel" only when the connector is named so
    const gp = ti.path || ti.file || ti.file_path || ti.filePath || "", on = /gitbagel/i.test(srv) ? " on GitBagel" : "";
    if (/^(read_file|grep|list_files|log|diff)$/.test(name)) return [`Reading code${on}${gp ? ": " + base(gp) : ""}`, "read"];
    if (/^(write_file|edit_file|apply_patch|commit|delete_file)$/.test(name)) return [`Changing code${on}${gp ? ": " + base(gp) : ""}`, "edit"];
    return [`Using ${name.replace(/_/g, " ")}`, "act"];
  }
  return [`Using ${t}`, "act"];
}

// ---------- one chat's state ----------
const stFile = (sid) => path.join(DIR, sid.replace(/[^\w-]/g, "") + ".json");
function fresh(sid, file) {
  return { sid, id: "chat-" + sid, file, off: 0, started: null, last: 0, cwd: "", appTitle: "", asks: [], askN: 0, waves: [],
    acts: [], queue: [], turnOpen: false, endAt: 0, wrap: null, need: null, ended: 0, tops: [], helpers: {}, subOff: {}, posted: "", postedAt: 0 };
}
const STATUS = { in_progress: "active", active: "active", doing: "active", completed: "done", done: "done", pending: "pending", todo: "pending" };

function currentWave(st, ts) {
  let w = st.waves[st.waves.length - 1];
  if (!w || w.ask !== st.askN) {
    const ask = st.asks[st.asks.length - 1];
    w = { ask: st.askN, name: st.askN ? `Ask ${st.askN} — ${clip(ask ? ask.text : "", 46)}` : "Steps", steps: [], ts };
    st.waves.push(w); if (st.waves.length > 6) st.waves.splice(0, st.waves.length - 6);
  }
  return w;
}
function setStatus(step, status, ts) {
  if (step.status === status) return;
  step.status = status;
  if ((status === "active" || status === "done") && !step.startedAt) step.startedAt = ts;
  if (status === "done") step.doneAt = step.doneAt || ts;
  if (status === "pending") { delete step.startedAt; delete step.doneAt; }
}
function planFromItems(w, items, ts, textKey) {
  const prev = w.steps;
  w.steps = items.slice(0, 40).map((it, i) => {
    const text = clip(it[textKey] || it.content || it.subject || "", 200);
    const old = (prev[i] && prev[i].text === text) ? prev[i] : prev.find((p) => p.text === text);
    const step = { text, status: "pending", ...(old && old.startedAt ? { startedAt: old.startedAt } : {}), ...(old && old.doneAt ? { doneAt: old.doneAt } : {}) };
    if (old) step.status = old.status;
    setStatus(step, STATUS[it.status] || "pending", ts);
    if (it.activeForm) step.doing = clip(it.activeForm, 140);
    return step;
  });
}
function applyPlanTool(st, name, ti, ts) {
  if (/__update_plan$/.test(name)) {
    const w = currentWave(st, ts);
    if (Array.isArray(ti.items)) planFromItems(w, ti.items, ts, "content");
    if (ti.advance) { const i = w.steps.findIndex((s) => s.status === "active"); if (i >= 0) setStatus(w.steps[i], "done", ts);
      const n = w.steps.findIndex((s, j) => j > i && s.status === "pending"); if (n >= 0) setStatus(w.steps[n], "active", ts); }
    if (Array.isArray(ti.done)) ti.done.forEach((k) => { const s = w.steps[k - 1]; if (s) setStatus(s, "done", ts); });
    if (Number.isFinite(+ti.start) && w.steps[ti.start - 1]) { w.steps.forEach((s) => { if (s.status === "active") setStatus(s, "done", ts); }); setStatus(w.steps[ti.start - 1], "active", ts); }
    return true;
  }
  if (/__wrap_up$/.test(name)) {
    st.wrap = { ts, recap: clip(ti.recap, 400), ask: ti.ask ? clip(ti.ask, 160) : "" };
    const w = st.waves[st.waves.length - 1]; if (w && w.ask === st.askN) w.steps.forEach((s) => setStatus(s, "done", ts));   // wrap_up checks the list off
    st.queue.push({ kind: "note", title: clip(ti.recap, 200), detail: clip(ti.recap, 1200), at: ts, meta: { recap: true, ask: ti.ask ? clip(ti.ask, 160) : undefined } });
    return true;
  }
  if (name === "TodoWrite" && Array.isArray(ti.todos)) { planFromItems(currentWave(st, ts), ti.todos, ts, "content"); return true; }
  if (name === "TaskCreate" && (ti.subject || ti.description)) { const w = currentWave(st, ts); w.steps.push({ text: clip(ti.subject || ti.description, 200), status: "pending", doing: ti.activeForm ? clip(ti.activeForm, 140) : undefined }); return true; }
  if (name === "TaskUpdate" && ti.status) { const w = currentWave(st, ts), s = w.steps[(+ti.taskId || 0) - 1]; if (s) setStatus(s, STATUS[ti.status] || s.status, ts); return true; }
  return false;
}
function noteTop(st, ti) {
  const seen = [];
  const add = (p) => {
    const m = /^(?:\/(?:Users|home)\/[^/]+|~)\/([^/\s"'`]+)(?:\/([^/\s"'`]+))?/.exec(p); if (!m) return;
    const name = CONTAINERS.has(m[1]) && m[2] ? m[2] : m[1];
    if (/^[\w][\w.-]*$/.test(name) && !SKIP_TOP.has(name) && !CONTAINERS.has(name)) seen.push(name);   // real folder names only, never a pattern like Post*
  };
  [ti.file_path, ti.path, ti.notebook_path, ti.cwd].forEach((p) => p && add(String(p)));
  if (ti.command) for (const m of String(ti.command).matchAll(/(?:\/(?:Users|home)\/[^/\s]+|~)\/[^\s"'`;|&)]+/g)) add(m[0]);
  for (const t of seen.slice(0, 3)) st.tops.push(t);
  if (st.tops.length > 80) st.tops.splice(0, st.tops.length - 80);
}
function newAsk(st, text, ts) {
  const t = cleanPrompt(text); if (!t) return;
  st.askN++; st.asks.push({ n: st.askN, ts, text: clip(t, 1200) }); if (st.asks.length > 12) st.asks.splice(0, st.asks.length - 12);
  st.turnOpen = true; st.wrap = null; st.need = null; st.ended = 0;
  if (st.pre && st.pre.text === clip(t, 1200)) { st.pre = null; return; }   // the prompt hook already put it on the card
  st.queue.push({ kind: "say", title: clip(t, 200), detail: clip(t, 1200), at: ts, meta: { you: true, n: st.askN } });
}
function onEntry(st, e) {
  const ts = Date.parse(e.timestamp || "") || 0;
  if (ts) { if (!st.started) st.started = ts; st.last = Math.max(st.last, ts); }
  if (e.isSidechain) return;
  if (e.cwd) st.cwd = e.cwd;
  if (e.type === "custom-title" && e.customTitle) { st.appTitle = clip(e.customTitle, 120); return; }
  if (e.type === "agent-name" && e.agentName && !st.appTitle) { st.appTitle = clip(e.agentName, 120); return; }
  if (e.type === "system" && e.subtype === "stop_hook_summary") { st.turnOpen = false; st.endAt = ts || st.endAt; return; }
  if (e.type === "attachment" && e.attachment && e.attachment.type === "queued_command") {
    const a = e.attachment, p = typeof a.prompt === "string" ? a.prompt : "";
    if ((a.origin && a.origin.kind === "human") || (a.humanTurn && !p.startsWith("<"))) newAsk(st, p, ts);
    return;
  }
  const msg = e.message || {};
  if (e.type === "user") {
    const c = msg.content;
    if (Array.isArray(c)) for (const b of c) if (b && b.type === "tool_result" && b.is_error) {
      const a = st.acts.find((x) => x.tid === b.tool_use_id); if (a) a.ok = false;
      const q = st.queue.find((x) => x.tid === b.tool_use_id); if (q) q.meta.ok = false;
    }
    const text = typeof c === "string" ? c : Array.isArray(c) && !c.some((b) => b && b.type === "tool_result") ? c.filter((b) => b && b.type === "text").map((b) => b.text).join(" ") : "";
    if (!text) return;
    if (/^\[Request interrupted by user/.test(text)) { st.turnOpen = false; st.endAt = ts; return; }
    const human = e.origin ? e.origin.kind === "human" : (!e.isMeta && !e.isCompactSummary && !/^\s*</.test(text) && !/^This session is being continued/.test(text));
    if (human) newAsk(st, text, ts);
    return;
  }
  if (e.type === "assistant") {
    st.turnOpen = msg.stop_reason !== "end_turn"; if (!st.turnOpen) st.endAt = ts;
    for (const b of msg.content || []) {
      if (!b || b.type !== "tool_use") continue;
      const ti = b.input || {};
      noteTop(st, ti);
      applyPlanTool(st, b.name, ti, ts);
      const d = describe(b.name, ti); if (!d) continue;
      const a = { ts, text: scrub(d[0]), icon: d[1], tid: b.id };
      st.acts.push(a); if (st.acts.length > 30) st.acts.splice(0, st.acts.length - 30);
      st.queue.push({ kind: "act", title: a.text, at: ts, meta: { icon: a.icon }, tid: b.id });
    }
  }
}
// helper agents: the app writes <session>/subagents/agent-*.meta.json next to the transcript, with a finished flag
function helpers(st, file) {
  const dir = path.join(path.dirname(file), st.sid, "subagents"), out = [];
  let names = []; try { names = fs.readdirSync(dir).filter((f) => f.endsWith(".meta.json")); } catch { return out; }
  for (const f of names) {
    const m = readJSON(path.join(dir, f)); if (!m) continue;
    // started = when its meta file was made; quiet for 30 min = treat as done (a helper that died never says so)
    let born = 0, mt = 0; try { const x = fs.statSync(path.join(dir, f)); born = x.birthtimeMs || x.mtimeMs; } catch {}
    try { mt = fs.statSync(path.join(dir, f.replace(/\.meta\.json$/, ".jsonl"))).mtimeMs; } catch { mt = born; }
    const done = !!m.finished || Date.now() - mt > 30 * 60_000;
    out.push({ d: clip(m.description || m.agentType || "Helper", 90), done, ts: Math.round(born), log: path.join(dir, f.replace(/\.meta\.json$/, ".jsonl")) });
  }
  return out.sort((a, b) => b.ts - a.ts).slice(0, 8);
}
// a running helper's own moves, prefixed with its name, so the card shows what every agent is doing
function helperActs(st, h) {
  let size = 0; try { size = fs.statSync(h.log).size; } catch { return; }
  const key = path.basename(h.log), from = st.subOff[key];
  if (from == null) { st.subOff[key] = size; return; }   // first sight: start from now, not its whole history
  if (size <= from) return;
  const buf = Buffer.alloc(Math.min(size - from, 4 << 20)); const fd = fs.openSync(h.log, "r");
  try { fs.readSync(fd, buf, 0, buf.length, from); } finally { fs.closeSync(fd); }
  const text = buf.toString("utf8"), cut = text.lastIndexOf("\n"); if (cut < 0) return;
  st.subOff[key] = from + Buffer.byteLength(text.slice(0, cut + 1));
  for (const line of text.slice(0, cut).split("\n")) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.type !== "assistant") continue;
    const ts = Date.parse(e.timestamp || "") || Date.now();
    for (const b of (e.message && e.message.content) || []) {
      if (!b || b.type !== "tool_use") continue;
      const d = describe(b.name, b.input || {}); if (!d) continue;
      st.queue.push({ kind: "act", title: scrub(`${clip(h.d, 40)}: ${d[0]}`), at: ts, meta: { icon: d[1], helper: true } });
    }
  }
}
// the richest plan this chat has: its Aprizely board, else the app's own task list
function aprizely(sid) {
  const reg = readJSON(path.join(HOME, ".aprizely", "sessions", sid.replace(/[^\w-]/g, "") + ".json"));
  if (!reg || !reg.dir) return null;
  const f = path.join(reg.dir, ".aprizely.worklog.json"), s = readJSON(f);
  if (!s || !Array.isArray(s.tasks) || !s.tasks.length || (reg.id && s.id && reg.id !== s.id)) return null;
  let mt = 0; try { mt = fs.statSync(f).mtimeMs; } catch {}
  if (Date.now() - mt > 36 * 3600_000 && s.status !== "active") return null;
  return { id: s.id, app: s.app || s.project || "", title: s.title || "", status: s.status,
    tasks: s.tasks.slice(-80).map((t) => ({ text: clip(t.text, 200), status: STATUS[t.status] || "pending", wave: t.wave ? clip(t.wave, 80) : undefined,
      desc: t.note || t.desc ? clip(scrub(t.note || t.desc), 600) : undefined, ...(t.startedAt ? { startedAt: t.startedAt } : {}), ...(t.doneAt ? { doneAt: t.doneAt } : {}) })) };
}
// a Breadledger worklog this chat drives (bound by breadhook.mjs) — the card links to it instead of repeating it
function worklogFor(sid) {
  try { for (const f of fs.readdirSync(path.join(HOME, ".breadboard"))) { if (!f.endsWith(".json")) continue;
    const s = readJSON(path.join(HOME, ".breadboard", f)); if (s && s.claude === sid && s.status !== "done") return s.id; } } catch {}
  return "";
}

// ---------- the card ----------
function card(st) {
  const apz = aprizely(st.sid);
  const tasks = apz ? apz.tasks : st.waves.flatMap((w) => w.steps.map((s) => ({ text: s.text, status: s.status, wave: st.waves.length > 1 || w.ask ? w.name : undefined,
    ...(s.startedAt ? { startedAt: s.startedAt } : {}), ...(s.doneAt ? { doneAt: s.doneAt } : {}) }))).slice(-80);
  const counts = {}; for (const t of st.tops) counts[t] = (counts[t] || 0) + 1;
  const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || "";
  // the chat's folder when it is a real project; otherwise the folder its tools work in most
  const parts = st.cwd && st.cwd !== HOME ? path.relative(HOME, st.cwd).split(path.sep) : [];
  const cwdTop = CONTAINERS.has(parts[0]) ? parts[1] || "" : parts[0] || "";
  const folder = cwdTop && /^[\w][\w.-]*$/.test(cwdTop) && !SKIP_TOP.has(cwdTop) ? cwdTop : top;
  const app = (apz && apz.app) || pretty(folder) || "Home folder";
  const hs = helpers(st, st.file);
  const now = Date.now();
  const f = st.ended ? "ended" : st.need ? "needs" : !st.turnOpen && st.endAt ? "waiting" : "working";
  const active = tasks.find((t) => t.status === "active");
  const lastAct = st.acts[st.acts.length - 1];
  const ask = st.asks[st.asks.length - 1];
  const current = f === "ended" ? "Chat closed" : f === "needs" ? (st.need.msg || "Needs your OK to go on") : f === "waiting" ? (st.wrap && st.wrap.ask ? st.wrap.ask : "Finished its reply — waiting for you")
    : lastAct ? lastAct.text : active ? active.text : "Thinking about your message";
  const note = { f, turns: st.askN, askAt: ask ? ask.ts : null, endAt: f === "waiting" ? st.endAt : null,
    recap: st.wrap ? st.wrap.recap : "", ask: st.wrap ? st.wrap.ask : "", need: f === "needs" ? clip(st.need.msg, 160) : "",
    helpers: hs.map((h) => ({ d: h.d, done: h.done, ts: h.ts })).slice(0, 6), plan: apz ? "aprizely" : tasks.length ? "app" : "",
    live: apz && apz.id ? "https://aprizely.coconvo.workers.dev/live/" + apz.id : "", board: worklogFor(st.sid), folder: folder || "" };
  return { id: st.id, app, project: folder || "home", title: st.appTitle || (st.asks[0] ? clip(st.asks[0].text, 110) : "New chat"), agent: "claude-code",
    status: "active", current: clip(current, 300), tasks, note: JSON.stringify(note), started: st.started || now, _hs: hs };
}

// never post a chat to a server that would show it publicly: only a build that keeps chats owner-only answers
// ?probe=1 with chats:true (asked at most every 10 minutes, the answer cached next to the state)
async function serverKeepsChatsPrivate() {
  const f = path.join(DIR, ".probe.json"), c = readJSON(f);
  if (c && c.base === BASE && Date.now() - c.at < (c.ok ? 10 : 2) * 60_000) return c.ok;
  let ok = false;
  try { const r = await fetch(BASE + "/api/now?probe=1", { signal: AbortSignal.timeout(5000), headers: { "x-ledger-key": TOKEN } }); const j = await r.json(); ok = j && j.chats === true && j.owner === true; } catch {}
  try { fs.writeFileSync(f, JSON.stringify({ base: BASE, at: Date.now(), ok })); } catch {}
  return ok;
}
async function post(pathname, body) {
  if (DRY) { console.log("DRY", pathname, JSON.stringify(body).slice(0, 400)); return { ok: true }; }
  if (!(await serverKeepsChatsPrivate())) throw new Error("server does not keep chats private yet — nothing sent");
  const r = await fetch(BASE + pathname, { method: "POST", signal: AbortSignal.timeout(6000),
    headers: { "content-type": "application/json", "x-ledger-key": TOKEN }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(pathname + " " + r.status + " " + (j.error || ""));
  return j;
}

// ---------- read what is new in a transcript, update the card ----------
function lock(sid) {
  const l = stFile(sid) + ".lock";
  for (let i = 0; i < 40; i++) {
    try { fs.mkdirSync(l); return () => { try { fs.rmdirSync(l); } catch {} }; }
    catch { try { if (Date.now() - fs.statSync(l).mtimeMs > 15000) fs.rmdirSync(l); } catch {} }
    const until = Date.now() + 50; while (Date.now() < until) {}
  }
  return null;
}
async function sync(file, sid, ev = {}) {
  const unlock = lock(sid); if (!unlock) return;
  try {
    let st = readJSON(stFile(sid)); if (!st || st.file !== file) st = fresh(sid, file);
    let size = 0; try { size = fs.statSync(file).size; } catch { return; }
    if (size < st.off) st = fresh(sid, file);
    const first = st.off === 0, moved = size > st.off;
    if (size > st.off) {
      const fd = fs.openSync(file, "r"), CH = 8 << 20; let pos = st.off, rest = "";
      try {
        while (pos < size) {
          const buf = Buffer.alloc(Math.min(CH, size - pos)); fs.readSync(fd, buf, 0, buf.length, pos); pos += buf.length;
          const text = rest + buf.toString("utf8"), cut = text.lastIndexOf("\n");
          if (cut < 0) { rest = text; continue; }
          rest = text.slice(cut + 1);
          for (const line of text.slice(0, cut).split("\n")) { if (!line) continue; let e; try { e = JSON.parse(line); } catch { continue; } onEntry(st, e); }
        }
      } finally { fs.closeSync(fd); }
      st.off = size - Buffer.byteLength(rest);
    }
    // what the hook itself knows that the transcript does not: a permission prompt, the turn's end, the chat closing
    const now = Date.now();
    if (ev.hook_event_name === "Notification" && /permission|approv|allow/i.test(String(ev.message || "") + " " + String(ev.notification_type || ""))) st.need = { ts: now, msg: clip(ev.message || "Needs your OK to go on", 160) };
    // a permission prompt holds until the chat writes anything new (you answered) or its turn ends
    if (st.need && moved && ev.hook_event_name !== "Notification") st.need = null;
    if (ev.hook_event_name === "Stop") { st.need = null; st.turnOpen = false; st.endAt = st.endAt && st.endAt > now - 120000 ? st.endAt : now; }
    if (ev.hook_event_name === "SessionEnd") st.ended = now;
    if (ev.hook_event_name === "UserPromptSubmit") {
      st.need = null; st.ended = 0; st.turnOpen = true;
      // the prompt lands on the card at once; the transcript line that follows is recognised and not posted twice
      const t = clip(cleanPrompt(ev.prompt || ""), 1200), lastAsk = st.asks[st.asks.length - 1];
      if (t && !(lastAsk && lastAsk.text === t && now - lastAsk.ts < 300000)) { st.pre = { text: t, ts: now };
        st.queue.push({ kind: "say", title: clip(t, 200), detail: t, at: now, meta: { you: true, n: st.askN + 1 } }); }
    }
    if (first) {   // a chat seen for the first time: its latest moves only, never its whole history
      const acts = st.queue.filter((q) => q.kind === "act").slice(-8), says = st.queue.filter((q) => q.kind === "say").slice(-3), notes = st.queue.filter((q) => q.kind === "note").slice(-1);
      st.queue = says.concat(notes, acts).sort((a, b) => a.at - b.at);
    }
    if (st.queue.length > 60) st.queue.splice(0, st.queue.length - 60);
    const c = card(st); const hs = c._hs; delete c._hs;
    for (const h of hs) if (!h.done) helperActs(st, h);
    if (!st.started && !st.last) return;                     // an empty transcript: nothing to show yet
    // while it works, the "Now" line is its newest action (sent as an event), so the card itself only changes with the plan
    const sig = JSON.stringify([c.app, c.title, JSON.parse(c.note).f === "working" ? "" : c.current, c.tasks, c.note, c.project]);
    try {
      if (sig !== st.posted || st.queue.length || now - st.postedAt > 60000) {
        if (sig !== st.posted || !st.postedAt) { await post("/api/session", c); st.posted = sig; st.postedAt = now; }
        const active = c.tasks.find((t) => t.status === "active");
        while (st.queue.length) {
          const batch = st.queue.slice(0, 50).map(({ tid, ...q }) => ({ ...q, phase: q.kind === "act" && active ? active.text : undefined }));
          await post("/api/session/event", { sessionId: c.id, events: batch });
          st.queue.splice(0, batch.length);
        }
      }
    } catch (e) { if (process.env.CHATS_DEBUG) console.error(String(e.message || e)); }
    if (!DRY) fs.writeFileSync(stFile(sid), JSON.stringify(st));   // a dry run leaves no trace
    return c;
  } finally { unlock(); }
}

// ---------- every chat active lately ----------
function recentTranscripts(mins) {
  const out = [], since = Date.now() - mins * 60_000;
  let dirs = []; try { dirs = fs.readdirSync(PROJ); } catch { return out; }
  for (const d of dirs) {
    let files = []; try { files = fs.readdirSync(path.join(PROJ, d)); } catch { continue; }
    for (const f of files) {
      if (!/^[0-9a-f-]{36}\.jsonl$/.test(f)) continue;
      const p = path.join(PROJ, d, f); let st; try { st = fs.statSync(p); } catch { continue; }
      if (st.mtimeMs >= since) out.push({ file: p, sid: f.slice(0, -6), mtime: st.mtimeMs, size: st.size });
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

const mode = argv[0];
if (mode === "scan" || mode === "watch") {
  const once = async (mins) => {
    const list = recentTranscripts(mins), done = [];
    for (const t of list) {
      const st = readJSON(stFile(t.sid));
      if (mode === "watch" && st && st.off === t.size && Date.now() - (st.postedAt || 0) < 60000) continue;
      const c = await sync(t.file, t.sid).catch((e) => { console.error(t.sid, e.message); return null; });
      if (c) done.push(c);
    }
    return done;
  };
  if (mode === "scan") {
    const done = await once(+flag("mins", 120));
    for (const c of done) { const n = JSON.parse(c.note), d = c.tasks.filter((t) => t.status === "done").length;
      console.log(`${n.f.padEnd(8)} ${c.app.padEnd(22).slice(0, 22)} ${String(c.tasks.length ? Math.round(d / c.tasks.length * 100) + "%" : "–").padStart(4)}  ${clip(c.title, 60)}  ·  ${clip(c.current, 50)}`); }
    const ok = DRY || await serverKeepsChatsPrivate();
    console.log(ok ? `${done.length} chat${done.length === 1 ? "" : "s"} on ${BASE}/now${DRY ? " (dry run, nothing sent)" : ""}` : `Nothing sent: ${BASE} does not keep chats private yet. Deploy the new build first.`);
  } else {
    const every = Math.max(3, +flag("every", 10)) * 1000;
    console.log(`watching every chat → ${BASE}/now (every ${every / 1000}s)`);
    let mins = +flag("mins", 120);   // first pass: every chat of the last two hours; then whatever moved lately
    for (;;) { await once(mins).catch(() => {}); mins = 20; await new Promise((r) => setTimeout(r, every)); }
  }
} else {
  // hook mode: Claude Code passes the event on stdin
  let input = {}; try { input = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch { process.exit(0); }
  let tp = String(input.transcript_path || ""), sid = String(input.session_id || "");
  const sub = /^(.*)\/([0-9a-f-]{36})\/subagents\/[^/]+\.jsonl$/.exec(tp);
  if (sub) { tp = sub[1] + "/" + sub[2] + ".jsonl"; sid = sub[2]; }   // a helper's event moves its parent chat's card
  if (!sid || !tp || !fs.existsSync(tp)) process.exit(0);
  try { await sync(tp, sid, input); } catch {}
  process.exit(0);
}
