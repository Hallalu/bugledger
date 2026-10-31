#!/usr/bin/env node
/*
 Breadledger — follow-along hook. A Claude Code PostToolUse hook that turns every tool call into one plain sentence
 ("Editing now.html", "Running the tests", "Opening the page in the browser") and posts it to the running Now-board
 session, under the step the agent is on. The agent never has to remember to report; you see every move.

 Install (once) in ~/.claude/settings.json → hooks.PostToolUse:
   { "matcher": "*", "hooks": [{ "type": "command", "command": "node ~/BugLedger/breadhook.mjs", "async": true, "timeout": 5 }] }

 Quiet by design: with no running session for this folder it exits at once, with no network call. It never posts
 command text, file contents or full paths — only a short description, a file's base name, or a web host.
 Sessions are the worklog states in ~/.breadboard/*.json and ./.worklog.json; the first action after `start`
 binds that state to this Claude session, so two sessions in one folder each narrate their own card.
*/
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
let input = {};
try { input = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch { process.exit(0); }
const { session_id: sid = "", cwd = process.cwd(), tool_name: tool = "", tool_input: ti = {} } = input;

// ---------- which board? ----------
const MAX_AGE = 3 * 3600_000;
const candidates = [];
try { for (const f of fs.readdirSync(path.join(HOME, ".breadboard"))) if (f.endsWith(".json")) candidates.push(path.join(HOME, ".breadboard", f)); } catch {}
candidates.push(path.join(cwd, ".worklog.json"));
const states = [];
for (const file of candidates) {
  try {
    const st = fs.statSync(file); if (Date.now() - st.mtimeMs > MAX_AGE) continue;
    const s = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!s || !s.id || s.status === "done") continue;
    const home = s.cwd || path.dirname(file);
    const near = cwd === home || cwd.startsWith(home + path.sep) || home.startsWith(cwd + path.sep);
    if (s.claude ? s.claude === sid : near) states.push({ file, s, mtime: st.mtimeMs });
  } catch {}
}
if (!states.length) process.exit(0);
states.sort((a, b) => (b.s.claude === sid) - (a.s.claude === sid) || b.mtime - a.mtime);
const { file, s } = states[0];
if (!s.claude && sid) { try { const fresh = JSON.parse(fs.readFileSync(file, "utf8")); fresh.claude = sid; fs.writeFileSync(file, JSON.stringify(fresh, null, 2) + "\n"); } catch {} }

// ---------- what did it just do, in plain words? ----------
const base = (p) => path.basename(String(p || "")) || "a file";
const host = (u) => { try { return new URL(/^https?:/.test(u) ? u : "https://" + u).host; } catch { return "a page"; } };
const clip = (t, n = 140) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
// strip anything that looks like a local path or a secret before it leaves the machine
const scrub = (t) => String(t || "")
  .replace(/(?:~|\/(?:Users|home|private|var|tmp|opt|Volumes))\/[^\s"'`)]+/g, (m) => path.basename(m))
  .replace(/\b(?:sk|pk|rk|blk|ghp|gho|xox[bp]|AKIA)[-_A-Za-z0-9]{12,}\b/g, "[key]")
  .replace(/\b[A-Fa-f0-9]{32,}\b/g, "[id]");
const BROWSER = { navigate: ["Opening a page in the browser", "browser"], screenshot: ["Looking at the page", "eye"], read_page: ["Reading the page", "eye"],
  get_page_text: ["Reading the page", "eye"], find: ["Looking for something on the page", "eye"], javascript_tool: ["Checking the page in the browser", "browser"],
  resize_window: ["Checking the page at another size", "browser"], read_console_messages: ["Checking the browser console for errors", "browser"],
  read_network_requests: ["Checking the page's network calls", "browser"], preview_start: ["Starting a local preview", "run"], form_input: ["Filling in a form field", "browser"] };

function describe() {
  const t = tool;
  if (t === "Read") return [`Reading ${base(ti.file_path)}`, "read"];
  if (t === "Edit" || t === "MultiEdit") return [`Editing ${base(ti.file_path)}`, "edit"];
  if (t === "Write") return [`Writing ${base(ti.file_path)}`, "edit"];
  if (t === "NotebookEdit") return [`Editing ${base(ti.notebook_path)}`, "edit"];
  if (t === "Grep") return [`Searching the code for “${clip(ti.pattern, 40)}”`, "search"];
  if (t === "Glob") return [`Finding files (${clip(ti.pattern, 40)})`, "search"];
  if (t === "Bash") {
    const c = String(ti.command || "");
    if (/worklog\.mjs|apz\.mjs|breadhook|keep\.mjs/.test(c)) return null;          // board updates narrate themselves
    if (ti.description) return [clip(ti.description), /test/i.test(c + ti.description) ? "test" : /git (commit|push)/.test(c) ? "ship" : "run"];
    return [/\b(npm|node --)test\b|node --test/.test(c) ? "Running the tests" : /git commit/.test(c) ? "Committing the change" : /git push/.test(c) ? "Pushing to git" : "Running a command", "run"];
  }
  if (t === "WebSearch") return [`Searching the web: ${clip(ti.query, 80)}`, "search"];
  if (t === "WebFetch") return [`Reading a page on ${host(ti.url)}`, "read"];
  if (t === "Agent" || t === "Task") return [`Asking a helper agent: ${clip(ti.description || "a sub-task", 80)}`, "agent"];
  if (t === "Skill") return [`Using the ${clip(ti.skill, 40)} skill`, "agent"];
  if (t === "Artifact") return ["Publishing a page", "ship"];
  if (/^(TodoWrite|ToolSearch|TaskCreate|TaskUpdate|TaskList|TaskGet)$/.test(t) || /ccd_turn|ccd_view|ccd_session|visualize__read_me/.test(t)) return null;
  const m = /^mcp__(.+?)__(.+)$/.exec(t);
  if (m) {
    const name = m[2];
    if (/Browser|chrome/i.test(m[1])) {
      if (name === "computer") { const a = ti.action || ""; if (a === "screenshot" || a === "zoom") return BROWSER.screenshot;
        if (ti.action_summary) return [clip(ti.action_summary, 100), "browser"]; return [a === "scroll" ? "Scrolling the page" : a === "type" ? "Typing on the page" : "Clicking on the page", "browser"]; }
      if (name === "navigate") return [`Opening ${ti.url === "back" ? "the previous page" : host(ti.url)}`, "browser"];
      if (name === "browser_batch") return ["Working through the page in the browser", "browser"];
      return BROWSER[name] || ["Using the browser", "browser"];
    }
    if (/^(read_file|grep|list_files|log|diff)$/.test(name)) return [`Reading code on GitBagel${ti.path ? ": " + base(ti.path) : ""}`, "read"];
    if (/^(write_file|edit_file|apply_patch|commit)$/.test(name)) return [`Changing code on GitBagel${ti.path ? ": " + base(ti.path) : ""}`, "edit"];
    return [`Using ${name.replace(/_/g, " ")}`, "act"];
  }
  return [`Using ${t}`, "act"];
}
const d = describe();
if (!d) process.exit(0);
const active = (s.tasks || []).find((t) => t.status === "active");
const ok = !(input.tool_response && (input.tool_response.is_error || input.tool_response.interrupted));

// ---------- post it (never blocks the agent: the hook runs async with a short timeout) ----------
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(HOME, ".bugledger.json"), "utf8")); } catch {}
const BASE = s.base || process.env.BUGLEDGER_BASE || cfg.base || "https://breadledger.coconvo.workers.dev";
const TOKEN = process.env.BUGLEDGER_TOKEN || cfg.token || "";
try {
  await fetch(BASE + "/api/session/event", { method: "POST", signal: AbortSignal.timeout(3000),
    headers: { "content-type": "application/json", "x-ledger-key": s.base && /localhost/.test(s.base) ? (s.token || TOKEN) : TOKEN },
    body: JSON.stringify({ sessionId: s.id, events: [{ kind: "act", title: scrub(d[0]), phase: active ? active.text : undefined, meta: { icon: d[1], ...(ok ? {} : { ok: false }) } }] }) });
} catch {}
