#!/usr/bin/env node
/*
 Bug Ledger — live worklog + scan story. Stream what you're doing, in parallel, to the /live board
 (tasks ticking off in real time) AND narrate the scan as a permanent, itemised story the user
 reads at /story/<session> — what was found, how bad, what was done, how the app is better now.

 Setup (once): ~/.bugledger.json = {"base":"https://bugledger.coconvo.workers.dev","token":"..."}

 Board (tasks + bold "doing now" line):
   node ~/BugLedger/worklog.mjs start --app "Aprizely" --project aprizely \
        --title "Fix the unlock keypad" --tasks "Center numbers|Tuck letters|Rename button|Verify"
   node ~/BugLedger/worklog.mjs step 0                       # start task 0 (marks earlier ones done)
   node ~/BugLedger/worklog.mjs current "grepping .key css"  # update the bold 'doing now' line
   node ~/BugLedger/worklog.mjs done 0                       # mark task 0 done
   node ~/BugLedger/worklog.mjs add "Also fix hairline border"
   node ~/BugLedger/worklog.mjs note "waiting on a browser reload"
   node ~/BugLedger/worklog.mjs progress 120 560 --label checked   # the N/total counter
   node ~/BugLedger/worklog.mjs finish                       # all done, session closes (frozen)
   node ~/BugLedger/worklog.mjs shot ./after.png --caption "after"   # upload a screenshot → hosted /api/shot URL

 Story (the narrative the user reads — every line is append-only):
   node ~/BugLedger/worklog.mjs phase "Phase 1 — Automated pass, all 47 detectors"
   node ~/BugLedger/worklog.mjs say "Triaging the 55 high-confidence hits — reading the code, not trusting the detector"
   node ~/BugLedger/worklog.mjs found "Forms that only looked labelled" --sev medium --cat accessibility \
        --file "_book.html:51" --why "Every field had a <label> above it but no for=, so a screen reader announces 'edit text, blank'" \
        --impact "A blind visitor cannot complete the public booking page" \
        --fix "for= where a label shows; aria-label where the design is label-free. Zero visual change." \
        --status fixed --verified code-read --confidence high
   node ~/BugLedger/worklog.mjs found "NO-CSP ×10" --sev low --status false-positive --why "CSP is served as a real HTTP header; the detector only reads HTML"
   node ~/BugLedger/worklog.mjs fixed "Focus that you can't see" --fix "Real :focus-visible rings added"   # resolves an earlier found
   node ~/BugLedger/worklog.mjs clean "accessibility" --n 11 --verified code-read     # a family checked and clean
   node ~/BugLedger/worklog.mjs metric "Detector findings" --before 387 --after 353
   node ~/BugLedger/worklog.mjs metric "High-confidence findings" --before 55 --after 23
   node ~/BugLedger/worklog.mjs caveat "_book.html is fetched internally by the worker; fixes verified in deployed source, not via a live booking URL"
   node ~/BugLedger/worklog.mjs verdict "8 fixed, 3 left for your call, 3 new items added to the ledger"
   node ~/BugLedger/worklog.mjs story                        # print the story link
   node ~/BugLedger/worklog.mjs id                           # print the session id (pass as sessionId on /api/checks + /api/bugs)

 step / current / done / progress --current / add / note also write themselves into the story, so a
 sweep that only uses the board still gets a readable timeline. Severity: critical | high | medium |
 low | info. Status: fixed | open | needs-call | false-positive | applied | recommended | wontfix.
 Evidence (--verified): detector | code-read | test | reasoned | assumed.

 State for the current project lives in ./.worklog.json (git-ignore it).
*/
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const argv = process.argv.slice(2);
const cmd = argv[0];
const FLAGS_WITH_VALUE = new Set(["app","project","title","tasks","agent","current","note","label","caption","text",
  "sev","severity","cat","category","file","why","detail","impact","fix","status","verified","verifiedBy","confidence",
  "phase","n","before","after","ref","tag","tags"]);
const positional = (() => { const out = []; for (let i = 1; i < argv.length; i++) { const a = argv[i];
  if (a.startsWith("--")) { if (FLAGS_WITH_VALUE.has(a.slice(2)) && argv[i+1] !== undefined && !argv[i+1].startsWith("--")) i++; continue; }
  out.push(a); } return out; })();
const flag = (name, dflt = null) => { const i = argv.indexOf("--" + name); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") ? argv[i + 1] : dflt; };
const has = (name) => argv.includes("--" + name);

const cfgPath = path.join(os.homedir(), ".bugledger.json");
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")); } catch {}
const BASE = process.env.BUGLEDGER_BASE || cfg.base || "https://bugledger.coconvo.workers.dev";
const TOKEN = process.env.BUGLEDGER_TOKEN || cfg.token || "";

const STATE = path.join(process.cwd(), ".worklog.json");
const loadState = () => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return null; } };
const saveState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2) + "\n");
const storyUrl = (id) => `${BASE}/story/${id}`;

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
// append one or more story events (never throws — the story must never block the real work)
async function emit(s, events, { quiet = false } = {}) {
  const list = (Array.isArray(events) ? events : [events]).filter(Boolean).map((e) => ({ ...e, phase: e.phase || s.phase || undefined, seq: ++s.seq }));
  if (!list.length) return null;
  try {
    const res = await fetch(BASE + "/api/session/event", { method: "POST",
      headers: { "content-type": "application/json", "x-ledger-key": TOKEN },
      body: JSON.stringify({ sessionId: s.id, events: list }) });
    const out = await res.json().catch(() => ({}));
    if (!out.ok) { if (!quiet) console.error("worklog: story event failed —", res.status, out.error || ""); return null; }
    return out;
  } catch (e) { if (!quiet) console.error("worklog: story event failed —", e.message); return null; }
}

function die(msg) { console.error("worklog: " + msg); process.exit(1); }
// the server caps title at 200 chars — a long line keeps its full text in detail and a trimmed headline in title
const longText = (text, extra) => text.length > 180 ? { title: text.slice(0, 177).replace(/\s+\S*$/, "") + "…", detail: text, ...(extra || {}) } : { title: text, ...(extra || {}) };
const SEV_ICON = { critical: "🟣", high: "🔴", medium: "🟠", low: "🟡", info: "⚪" };

if (cmd === "start") {
  const project = flag("project") || path.basename(process.cwd());
  const tasks = (flag("tasks") || "").split("|").map((t) => t.trim()).filter(Boolean)
    .map((text, i) => ({ text, status: i === 0 ? "active" : "pending" }));
  const s = {
    id: (globalThis.crypto?.randomUUID?.() || (Date.now() + "-" + Math.round(Math.random() * 1e6))),
    app: flag("app") || project, project, title: flag("title") || "Working on " + project,
    agent: flag("agent") || "claude-code", status: "active",
    current: flag("current") || (tasks[0] ? tasks[0].text : "Getting started"),
    note: flag("note") || "", tasks, seq: 0, phase: null, findings: [],
  };
  const out = await post(s);
  s.id = out.id; saveState(s);
  await emit(s, { kind: "note", title: "Session started", detail: s.title }, { quiet: true });
  console.log(`▶ live: ${BASE}/live   (session ${s.id.slice(0, 8)}, ${tasks.length} tasks)`);
  console.log(`📖 story: ${storyUrl(s.id)}`);
} else if (["step", "done", "current", "add", "note", "finish", "status", "progress"].includes(cmd)) {
  const s = loadState();
  if (!s) die("no ./.worklog.json — run `worklog.mjs start` first.");
  s.seq = s.seq || 0;
  const ev = [];
  if (cmd === "progress") {
    const d = parseInt(positional[0], 10), t = parseInt(positional[1], 10);
    if (Number.isNaN(d) || Number.isNaN(t)) die("progress <done> <total>  e.g. progress 100 315");
    s.progress = { done: d, total: t, label: flag("label") || (s.progress && s.progress.label) || "bugs" };
    if (flag("current") && flag("current") !== s.current) { s.current = flag("current"); ev.push({ kind: "say", title: s.current, meta: { progress: s.progress } }); }
  }
  if (cmd === "step") {
    const i = parseInt(positional[0], 10);
    if (Number.isNaN(i) || !s.tasks[i]) die("step <index> out of range");
    s.tasks = s.tasks.map((t, j) => ({ ...t, status: j < i ? "done" : j === i ? "active" : t.status === "done" ? "done" : "pending" }));
    s.current = flag("current") || s.tasks[i].text;
    s.phase = s.tasks[i].text;                        // a board task doubles as a story phase
    ev.push({ kind: "phase", title: s.tasks[i].text, phase: s.tasks[i].text });
    if (flag("current")) ev.push({ kind: "say", title: flag("current") });
  } else if (cmd === "done") {
    const i = parseInt(positional[0], 10);
    if (Number.isNaN(i) || !s.tasks[i]) die("done <index> out of range");
    s.tasks[i].status = "done";
    ev.push({ kind: "note", title: "✓ " + s.tasks[i].text, detail: flag("current") || "", meta: { task: i, done: true } });
    if (flag("current")) s.current = flag("current");
    else { const nxt = s.tasks.find((t) => t.status !== "done"); if (nxt) { nxt.status = "active"; s.current = nxt.text; } }
  } else if (cmd === "current") {
    const txt = positional.join(" ") || flag("text") || s.current;
    if (txt !== s.current) ev.push({ kind: "say", title: txt });
    s.current = txt;
  } else if (cmd === "add") {
    const text = positional.join(" "); if (text) { s.tasks.push({ text, status: "pending" }); ev.push({ kind: "note", title: "＋ " + text, meta: { added: true } }); }
  } else if (cmd === "note") {
    s.note = positional.join(" "); if (s.note) ev.push({ kind: "note", title: s.note });
  } else if (cmd === "finish") {
    s.tasks = s.tasks.map((t) => ({ ...t, status: "done" }));
    s.status = "done"; s.current = flag("current") || "Done ✓";
    ev.push({ kind: "note", title: "Session finished", detail: s.current, meta: { finished: true } });
  } else if (cmd === "status") {
    console.log(JSON.stringify(s, null, 2)); process.exit(0);
  }
  if (ev.length) await emit(s, ev, { quiet: true });   // story first, so a finish never races its own last line
  await post(s); saveState(s);
  if (cmd === "finish") {                       // keep a permanent local record in the project too
    try { fs.appendFileSync(path.join(process.cwd(), ".worklog-history.jsonl"), JSON.stringify(s) + "\n"); } catch {}
  }
  const dn = s.tasks.filter((t) => t.status === "done").length;
  const prog = s.progress ? ` · ${s.progress.done}/${s.progress.total} ${s.progress.label}` : "";
  console.log(`✓ ${cmd} → ${dn}/${s.tasks.length} tasks${prog} · "${s.current}"`);
  if (cmd === "finish") console.log(`📖 story: ${storyUrl(s.id)}`);
} else if (["phase", "say", "found", "fixed", "clean", "metric", "verdict", "caveat", "story", "id", "events"].includes(cmd)) {
  // ---------------- the story commands ----------------
  const s = loadState();
  if (!s) die("no ./.worklog.json — run `worklog.mjs start` first.");
  s.seq = s.seq || 0; s.findings = s.findings || [];
  const text = positional.join(" ");
  if (cmd === "id") { console.log(s.id); process.exit(0); }
  if (cmd === "story") { console.log(storyUrl(s.id)); process.exit(0); }
  if (cmd === "events") {
    const r = await fetch(`${BASE}/api/story?id=${s.id}`).then((r) => r.json()).catch(() => null);
    if (!r || !r.ok) die("could not load the story");
    const hms = (t) => { const d = new Date(t), p = (x) => String(x).padStart(2, "0"); return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()); }; // local time
    for (const e of r.events) console.log(`${hms(e.ts)}  ${e.kind.padEnd(7)} ${e.severity ? (SEV_ICON[e.severity] || "") + " " : ""}${e.title || ""}${e.status ? "  [" + e.status + "]" : ""}${e.file ? "  " + e.file : ""}`);
    process.exit(0);
  }
  if (cmd === "phase") {
    if (!text) die('phase "Phase 1 — …"');
    s.phase = text; s.current = flag("current") || text;
    await emit(s, { kind: "phase", title: text, phase: text, detail: flag("why") || flag("detail") || "" });
    await post(s).catch(() => {}); saveState(s);
    console.log(`▶ ${text}`);
  } else if (cmd === "say") {
    if (!text) die('say "what you are doing / reasoning, in plain words"');
    s.current = text;
    await emit(s, { kind: "say", ...longText(text) });
    await post(s).catch(() => {}); saveState(s);
    console.log(`💬 ${text}`);
  } else if (cmd === "found") {
    if (!text) die('found "short headline" --sev high --cat security --file path:line --why "…" --impact "…" --fix "…" --status fixed|open|needs-call|false-positive --verified code-read');
    const sev = (flag("sev") || flag("severity") || "medium").toLowerCase();
    const status = flag("status") || (has("fixed") ? "fixed" : "open");
    const e = { kind: "found", title: text, severity: sev, status, category: flag("cat") || flag("category") || undefined,
      file: flag("file") || undefined, detail: flag("why") || flag("detail") || undefined, impact: flag("impact") || undefined,
      fix: flag("fix") || undefined, verifiedBy: flag("verified") || flag("verifiedBy") || undefined,
      confidence: flag("confidence") || undefined, phase: flag("phase") || undefined,
      meta: flag("tags") || flag("tag") ? { tags: String(flag("tags") || flag("tag")).split(",").map((t) => t.trim()).filter(Boolean) } : undefined };
    const out = await emit(s, e);
    const id = out && out.ids && out.ids[0];
    s.findings.push({ id, title: text, severity: sev, status, file: e.file || "" });
    saveState(s);
    const n = s.findings.length;
    console.log(`${SEV_ICON[sev] || "•"} #${n} ${text}${e.file ? "  " + e.file : ""}  [${status}]`);
  } else if (cmd === "fixed") {
    if (!text) die('fixed "<headline of an earlier found, or #n>" --fix "what you changed"');
    let target = null;
    const m = /^#(\d+)$/.exec(text.trim());
    if (m) target = s.findings[parseInt(m[1], 10) - 1];
    else { const k = text.toLowerCase().replace(/[^a-z0-9]+/g, ""); target = s.findings.find((f) => f.title.toLowerCase().replace(/[^a-z0-9]+/g, "") === k); }
    const status = flag("status") || "fixed";
    const e = { kind: "fixed", title: target ? target.title : text, ref: target && target.id || undefined, status,
      fix: flag("fix") || flag("why") || undefined, file: flag("file") || undefined, verifiedBy: flag("verified") || undefined };
    await emit(s, e);
    if (target) target.status = status;
    saveState(s);
    console.log(`✓ ${status}: ${e.title}`);
  } else if (cmd === "clean") {
    if (!text) die('clean "<family or area>" --n <items checked> --verified code-read');
    await emit(s, { kind: "clean", title: text, severity: "info", status: "clean", category: flag("cat") || flag("category") || text.toLowerCase(),
      verifiedBy: flag("verified") || undefined, detail: flag("why") || flag("detail") || undefined, meta: flag("n") ? { checked: parseInt(flag("n"), 10) } : undefined });
    console.log(`✅ clean: ${text}${flag("n") ? " (" + flag("n") + " checked)" : ""}`);
  } else if (cmd === "metric") {
    if (!text || flag("before") == null || flag("after") == null) die('metric "Detector findings" --before 387 --after 353');
    await emit(s, { kind: "metric", title: text, before: flag("before"), after: flag("after"), detail: flag("why") || undefined });
    console.log(`📈 ${text}: ${flag("before")} → ${flag("after")}`);
  } else if (cmd === "verdict") {
    if (!text) die('verdict "one honest sentence"');
    await emit(s, { kind: "verdict", ...longText(text), ...(flag("why") || flag("detail") ? { detail: (text.length > 180 ? text + "\n\n" : "") + (flag("why") || flag("detail")) } : {}) });
    console.log(`🏁 ${text}`);
    console.log(`📖 story: ${storyUrl(s.id)}`);
  } else if (cmd === "caveat") {
    if (!text) die('caveat "what you could not verify, and why"');
    await emit(s, { kind: "caveat", ...longText(text), severity: "info" });
    console.log(`⚠ caveat: ${text}`);
  }
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
  console.log("usage: worklog.mjs start|step <i>|done <i>|current \"…\"|add \"…\"|note \"…\"|progress <n> <t>|finish|shot <img>\n" +
              "       story: phase \"…\"|say \"…\"|found \"…\" --sev --file --why --impact --fix --status|fixed \"…\"|clean \"…\"|metric \"…\" --before --after|caveat \"…\"|verdict \"…\"|story|id|events   (see file header)");
  process.exit(cmd ? 1 : 0);
}
