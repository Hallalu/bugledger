#!/usr/bin/env node
/*
 Bug Ledger — live worklog. Stream what you're doing, in parallel, to the /live board
 so the user can watch tasks tick off in real time.

 Setup (once): ~/.bugledger.json = {"base":"https://bugledger.coconvo.workers.dev","token":"..."}

 Usage (run these between your real steps):
   node ~/BugLedger/worklog.mjs start --app "Aprizely" --project aprizely \
        --title "Fix the unlock keypad" --tasks "Center numbers|Tuck letters|Rename button|Verify"
   node ~/BugLedger/worklog.mjs step 0                       # start task 0 (marks earlier ones done)
   node ~/BugLedger/worklog.mjs current "grepping .key css"  # update the bold 'doing now' line
   node ~/BugLedger/worklog.mjs done 0                       # mark task 0 done
   node ~/BugLedger/worklog.mjs add "Also fix hairline border"
   node ~/BugLedger/worklog.mjs note "waiting on a browser reload"
   node ~/BugLedger/worklog.mjs finish                       # all done, session closes
   node ~/BugLedger/worklog.mjs shot ./after.png --caption "after"   # upload a screenshot → hosted /api/shot URL

 State for the current project lives in ./.worklog.json (git-ignore it).
*/
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const argv = process.argv.slice(2);
const cmd = argv[0];
const positional = argv.slice(1).filter((a) => !a.startsWith("--"));
const flag = (name, dflt = null) => { const i = argv.indexOf("--" + name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : dflt; };

const cfgPath = path.join(os.homedir(), ".bugledger.json");
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")); } catch {}
const BASE = process.env.BUGLEDGER_BASE || cfg.base || "https://bugledger.coconvo.workers.dev";
const TOKEN = process.env.BUGLEDGER_TOKEN || cfg.token || "";

const STATE = path.join(process.cwd(), ".worklog.json");
const loadState = () => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return null; } };
const saveState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2) + "\n");

async function post(s) {
  const body = { id: s.id, app: s.app, project: s.project, title: s.title, agent: s.agent,
    status: s.status, current: s.current, note: s.note, tasks: s.tasks, progress: s.progress || null };
  const res = await fetch(BASE + "/api/session", {
    method: "POST", headers: { "content-type": "application/json", "x-ledger-key": TOKEN },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!out.ok) { console.error("worklog: post failed —", res.status, out.error || "", TOKEN ? "" : "(no token in ~/.bugledger.json)"); process.exit(1); }
  return out;
}

function die(msg) { console.error("worklog: " + msg); process.exit(1); }

if (cmd === "start") {
  const project = flag("project") || path.basename(process.cwd());
  const tasks = (flag("tasks") || "").split("|").map((t) => t.trim()).filter(Boolean)
    .map((text, i) => ({ text, status: i === 0 ? "active" : "pending" }));
  const s = {
    id: (globalThis.crypto?.randomUUID?.() || (Date.now() + "-" + Math.round(Math.random() * 1e6))),
    app: flag("app") || project, project, title: flag("title") || "Working on " + project,
    agent: flag("agent") || "claude-code", status: "active",
    current: flag("current") || (tasks[0] ? tasks[0].text : "Getting started"),
    note: flag("note") || "", tasks,
  };
  const out = await post(s);
  s.id = out.id; saveState(s);
  console.log(`▶ live: ${BASE}/live   (session ${s.id.slice(0, 8)}, ${tasks.length} tasks)`);
} else if (["step", "done", "current", "add", "note", "finish", "status", "progress"].includes(cmd)) {
  const s = loadState();
  if (!s) die("no ./.worklog.json — run `worklog.mjs start` first.");
  if (cmd === "progress") {
    const d = parseInt(positional[0], 10), t = parseInt(positional[1], 10);
    if (Number.isNaN(d) || Number.isNaN(t)) die("progress <done> <total>  e.g. progress 100 315");
    s.progress = { done: d, total: t, label: flag("label") || (s.progress && s.progress.label) || "bugs" };
    if (flag("current")) s.current = flag("current");
  }
  if (cmd === "step") {
    const i = parseInt(positional[0], 10);
    if (Number.isNaN(i) || !s.tasks[i]) die("step <index> out of range");
    s.tasks = s.tasks.map((t, j) => ({ ...t, status: j < i ? "done" : j === i ? "active" : t.status === "done" ? "done" : "pending" }));
    s.current = flag("current") || s.tasks[i].text;
  } else if (cmd === "done") {
    const i = parseInt(positional[0], 10);
    if (Number.isNaN(i) || !s.tasks[i]) die("done <index> out of range");
    s.tasks[i].status = "done";
    if (flag("current")) s.current = flag("current");
    else { const nxt = s.tasks.find((t) => t.status !== "done"); if (nxt) { nxt.status = "active"; s.current = nxt.text; } }
  } else if (cmd === "current") {
    s.current = positional.join(" ") || flag("text") || s.current;
  } else if (cmd === "add") {
    const text = positional.join(" "); if (text) s.tasks.push({ text, status: "pending" });
  } else if (cmd === "note") {
    s.note = positional.join(" ");
  } else if (cmd === "finish") {
    s.tasks = s.tasks.map((t) => ({ ...t, status: "done" }));
    s.status = "done"; s.current = flag("current") || "Done ✓";
  } else if (cmd === "status") {
    console.log(JSON.stringify(s, null, 2)); process.exit(0);
  }
  await post(s); saveState(s);
  if (cmd === "finish") {                       // keep a permanent local record in the project too
    try { fs.appendFileSync(path.join(process.cwd(), ".worklog-history.jsonl"), JSON.stringify(s) + "\n"); } catch {}
  }
  const dn = s.tasks.filter((t) => t.status === "done").length;
  const prog = s.progress ? ` · ${s.progress.done}/${s.progress.total} ${s.progress.label}` : "";
  console.log(`✓ ${cmd} → ${dn}/${s.tasks.length} tasks${prog} · "${s.current}"`);
} else if (cmd === "shot") {
  // upload one screenshot → hosted /api/shot url, ready to attach to a POST /api/bugs `shots` list.
  // usage: worklog.mjs shot <image-file> [--caption "after"]   (no session needed)
  const file = positional[0];
  if (!file) die('shot <image-file> [--caption "…"]');
  const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif" };
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) die("unsupported image type (png/jpg/webp/gif/avif)");
  let bytes; try { bytes = fs.readFileSync(file); } catch { die("cannot read " + file); }
  const res = await fetch(BASE + "/api/shot", { method: "POST", headers: { "content-type": type, "x-ledger-key": TOKEN }, body: bytes });
  const out = await res.json().catch(() => ({}));
  if (!out.ok) die("upload failed — " + res.status + " " + (out.error || "") + (TOKEN ? "" : " (no token in ~/.bugledger.json)"));
  const caption = flag("caption") || "";
  console.log(out.view || BASE + out.url);
  console.log('shots entry: {"url":"' + out.url + '"' + (caption ? ',"caption":"' + caption + '"' : "") + "}");
} else {
  console.log("usage: worklog.mjs start|step <i>|done <i>|current \"…\"|add \"…\"|note \"…\"|finish|shot <img>   (see file header)");
  process.exit(cmd ? 1 : 0);
}
