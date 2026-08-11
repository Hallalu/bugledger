#!/usr/bin/env node
// Regenerate all derived files from bugs.json (+ security.json).
// Usage: node gen.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const p = (...a) => path.join(DIR, ...a);
const GEN = "2026-08-10";

const CATLABEL = { crash:"crash","data-loss":"data-loss",logic:"logic",ui:"ui",security:"security",
  performance:"perf",race:"race",sync:"sync",auth:"auth",other:"other" };
const SEV = { security:0,"data-loss":1,crash:2,auth:3,sync:4,race:5,logic:6,performance:7,ui:8,other:9 };
const CAT2SEV = { "data-loss":"critical",security:"high",crash:"high",auth:"high",sync:"high",race:"medium",logic:"medium",performance:"low",ui:"low",other:"low" };
const sevOf = b => b.severity || CAT2SEV[b.category] || "low";

// cross-app recurring classes + scanner detectors (kept in sync with scan.mjs) — for agents
const RECURRING = [
  "Stale service-worker cache pinning users to an old build (bump cache name / network-first HTML).",
  "Cross-account data leak: localStorage/IndexedDB not scoped to the signed-in owner; wipe on switch.",
  "Deletions resurrect after sync (missing tombstones / stale-device overwrite).",
  "toISOString() date off-by-one for calendar Y-M-D.",
  "esc()/innerHTML not escaping quotes -> attribute-injection XSS.",
  "Template ${...} placeholder rendered literally inside a quoted string.",
  "Duplicate DOM ids after a redesign wiring events to the wrong element.",
  "API key/secret saved with a trailing space silently breaking AI calls.",
  "Vault/PIN low-entropy + publicly-addressable ciphertext (see Security Sweep).",
];
const DETECTORS = [
  "XSS-INNERHTML (HTML sinks built with interpolation/concat)",
  "ESC-QUOTES (esc() that does not escape \" or ')",
  "SECRET (committed api keys / private keys)",
  "PBKDF2-WEAK (<600k iterations)",
  "STATIC-SALT (constant KDF salt)",
  "SSRF-GOTO (unvalidated page.goto/fetch target)",
  "NATIVE-DIALOG (prompt/alert used for UX)",
  "LOCALSTORAGE-GLOBAL (unscoped localStorage key -> cross-account leak)",
  "DATE-TOISO (toISOString timezone off-by-one)",
  "ARGUMENTS-CALLEE (breaks in ES modules/strict)",
  "FIND-DEREF (deref of a maybe-undefined find()/match())",
  "SW-CACHE-FIRST (stale-build service worker)",
  "DUP-DOM-ID (duplicate DOM ids)",
  "NO-CSP (no Content-Security-Policy on served HTML)",
];

const bugs = JSON.parse(fs.readFileSync(p("bugs.json"), "utf8"));

// app order by count desc
const count = {};
for (const b of bugs) count[b.app] = (count[b.app]||0)+1;
const appOrder = Object.keys(count).sort((a,b)=>count[b]-count[a] || a.localeCompare(b));

// ---- public/data.js ----
fs.writeFileSync(p("public","data.js"),
  `window.GENERATED=${JSON.stringify(GEN)};\nwindow.BUGS=${JSON.stringify(bugs)};\n`);

// ---- public/data-sec.js (if security.json present) ----
if (fs.existsSync(p("security.json"))) {
  const sec = JSON.parse(fs.readFileSync(p("security.json"),"utf8"));
  fs.writeFileSync(p("public","data-sec.js"),
    `window.SECURITY=${JSON.stringify(sec)};\n`);
}

// ---- BUGS.md (grouped, detailed) ----
const byApp = {};
for (const b of bugs) (byApp[b.app] ||= []).push(b);
const catCount = {};
for (const b of bugs) catCount[b.category]=(catCount[b.category]||0)+1;
const sec = fs.existsSync(p("security.json")) ? JSON.parse(fs.readFileSync(p("security.json"),"utf8")) : null;

let L = [];
L.push("# 🐞 Bug Ledger — Master Checklist\n");
L.push(`**${bugs.length} bugs fixed** across **${appOrder.length} apps**, mined from the full AI-assisted build history. Live: **https://bugledger.coconvo.workers.dev**\n`);
L.push("| Metric | Count |","|---|---|",
  `| Total bugs fixed | ${bugs.length} |`,
  `| Apps | ${appOrder.length} |`,
  `| Security fixes | ${catCount.security||0} |`,
  `| Data-loss / sync fixes | ${(catCount["data-loss"]||0)+(catCount.sync||0)} |`,
  `| Crashes fixed | ${catCount.crash||0} |`);
if (sec) L.push(`| Security-audit findings | ${sec.findings.length} (${sec.findings.filter(f=>f.status==="open").length} open) |`);
L.push("");
L.push("### By category\n");
L.push(Object.entries(catCount).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`\`${CATLABEL[c]}: ${n}\``).join(" "));
L.push("");
if (sec) {
  L.push("---\n","## 🔒 Security Sweep — "+sec.title+"\n");
  L.push(`_${sec.method}_  ·  Full report: [SECURITY-AUDIT.md](./SECURITY-AUDIT.md)\n`);
  const order={critical:0,high:1,medium:2,low:3};
  for (const f of sec.findings.slice().sort((a,b)=>order[a.severity]-order[b.severity]||a.id.localeCompare(b.id))) {
    L.push(`- [ ] **${f.id} · ${f.title}** \`${f.severity}\` · _${f.status}_ · ${f.app}`);
    if (f.detail) L.push(`  ${f.detail}`);
    if (f.fix) L.push(`  <br>*Fix:* ${f.fix}`);
  }
  L.push("");
}
L.push("---\n");
for (const app of appOrder) {
  const items = byApp[app].slice().sort((a,b)=>(SEV[a.category]-SEV[b.category])||a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
  L.push(`## ${app}  ·  ${items.length} fixed\n`);
  for (const r of items) {
    L.push(`- [ ] **${r.title}** \`${CATLABEL[r.category]}\``);
    const d=[];
    if (r.symptom) d.push(`*Symptom:* ${r.symptom}`);
    if (r.root_cause) d.push(`*Cause:* ${r.root_cause}`);
    if (r.fix) d.push(`*Fix:* ${r.fix}`);
    if (d.length) L.push("  "+d.join("  <br>"));
  }
  L.push("");
}
fs.writeFileSync(p("BUGS.md"), L.join("\n"));

// ---- CHECKLIST.md (flat, copy-paste) ----
const short = (s,n=95)=>{ s=(s||"").replace(/\s+/g," ").trim(); return s.length>n ? s.slice(0,n-1).trim()+"…" : s; };
let C = [];
C.push(`# BUG REGRESSION CHECKLIST — ${bugs.length} known bugs across ${appOrder.length} apps`);
C.push(`# Paste this into any build session and re-check each item (bugs recur).`);
C.push(`# Live: https://bugledger.coconvo.workers.dev  |  Repo: github.com/Hallalu/bugledger`);
C.push("");
if (sec) {
  C.push(`## 🔒 Security Sweep (${sec.findings.length})`);
  const order={critical:0,high:1,medium:2,low:3};
  for (const f of sec.findings.slice().sort((a,b)=>order[a.severity]-order[b.severity]||a.id.localeCompare(b.id)))
    C.push(`- [ ] [${f.severity}/${f.status}] ${f.id} ${f.title} — ${short(f.detail)}`);
  C.push("");
}
for (const app of appOrder) {
  const items = byApp[app].slice().sort((a,b)=>(SEV[a.category]-SEV[b.category])||a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
  C.push(`## ${app} (${items.length})`);
  for (const r of items) {
    const hint = short(r.symptom) || short(r.fix);
    C.push(`- [ ] ${r.title}${hint?` — ${hint}`:""}`);
  }
  C.push("");
}
fs.writeFileSync(p("CHECKLIST.md"), C.join("\n"));

// ---- scanner findings (public/data-scan.js + SCAN-FINDINGS.md) ----
let scanCount = 0;
if (fs.existsSync(p("scan-findings.json"))) {
  const scan = JSON.parse(fs.readFileSync(p("scan-findings.json"),"utf8"));
  scanCount = scan.length;
  const apps = {}; for (const f of scan) (apps[f.app] ||= []).push(f);
  const appList = Object.keys(apps).sort((a,b)=>apps[b].length-apps[a].length);
  fs.writeFileSync(p("public","data-scan.js"),
    `window.SCAN=${JSON.stringify({ generated:GEN, count:scan.length, apps:appList, findings:scan })};\n`);
  const svo = { critical:0, high:1, medium:2, low:3 };
  let S = [];
  S.push(`# 🔎 Scanner Findings — static-analysis leads (unverified)\n`);
  S.push(`Generated by \`scan.mjs\` across ${appList.length} app(s): **${scan.length} leads**. These are code-smell matches to verify, not confirmed bugs. Re-run \`node scan.mjs <app> --write\` to refresh.\n`);
  for (const app of appList) {
    S.push(`## ${app} (${apps[app].length})\n`);
    for (const f of apps[app].slice().sort((a,b)=>(svo[a.severity]-svo[b.severity])||a.file.localeCompare(b.file))) {
      S.push(`- [ ] \`${f.severity}\` **${f.detector}** — ${f.title}  \n  \`${f.file}:${f.line}\` — ${(f.excerpt||"").slice(0,120)}  \n  *Fix:* ${f.advice}`);
    }
    S.push("");
  }
  fs.writeFileSync(p("SCAN-FINDINGS.md"), S.join("\n"));
  fs.writeFileSync(p("public","SCAN-FINDINGS.md"), S.join("\n"));
} else {
  // clear stale artifacts if the findings file was removed
  for (const f of ["public/data-scan.js"]) { try { fs.rmSync(p(...f.split("/"))); } catch {} }
}

// ---- auto-harvested tier (public/data-harvest.js + HARVESTED.md) ----
let harvCount = 0;
if (fs.existsSync(p("harvested.json"))) {
  const harv = JSON.parse(fs.readFileSync(p("harvested.json"),"utf8"));
  harvCount = harv.length;
  if (harvCount) {
    const apps = {}; for (const f of harv) (apps[f.app] ||= []).push(f);
    const appList = Object.keys(apps).sort((a,b)=>apps[b].length-apps[a].length);
    fs.writeFileSync(p("public","data-harvest.js"),
      `window.HARVEST=${JSON.stringify({ generated:GEN, count:harv.length, apps:appList, findings:harv })};\n`);
    const svo = { critical:0, high:1, medium:2, low:3 };
    let H = [`# 🌱 Auto-Harvested Bugs — unverified, mined automatically from conversations\n`,
      `${harv.length} lead(s) auto-extracted by \`harvest.mjs\` from the local Claude transcripts. **Unverified** — promote good ones into \`bugs.json\`. Runs hourly via launchd.\n`];
    for (const app of appList) {
      H.push(`## ${app} (${apps[app].length})\n`);
      for (const f of apps[app].slice().sort((a,b)=>(svo[a.severity]-svo[b.severity])))
        H.push(`- [ ] \`${f.severity}\` \`${f.category}\` (${f.found}, #${f.session}) — ${f.title}`);
      H.push("");
    }
    fs.writeFileSync(p("HARVESTED.md"), H.join("\n"));
    fs.writeFileSync(p("public","HARVESTED.md"), H.join("\n"));
  }
}

// ---- agent-facing endpoints & docs (served as static assets) ----
// machine-readable data
fs.writeFileSync(p("public","bugs.json"), JSON.stringify(bugs));
if (sec) fs.writeFileSync(p("public","security.json"), JSON.stringify(sec));

// compact per-app checklist for agents
const checklist = { generated: GEN, base: "https://bugledger.coconvo.workers.dev",
  totals: { bugs: bugs.length, apps: appOrder.length, security: sec ? sec.findings.length : 0 },
  apps: {}, recurring: RECURRING, detectors: DETECTORS,
  security: sec ? sec.findings.map(f => ({ id: f.id, severity: f.severity, status: f.status, app: f.app, title: f.title })) : [] };
for (const app of appOrder)
  checklist.apps[app] = byApp[app].slice()
    .sort((a,b)=>(SEV[a.category]-SEV[b.category])||a.title.localeCompare(b.title))
    .map(b => ({ title: b.title, category: b.category, severity: sevOf(b), symptom: b.symptom || "", fix: b.fix || "" }));
fs.writeFileSync(p("public","checklist.json"), JSON.stringify(checklist));

// llms.txt — root index for AI agents (llmstxt.org convention)
const llms = `# Bug Ledger

> A catalogue of ${bugs.length} bugs fixed across ${appOrder.length} apps, plus a security audit and a code scanner. Use it to debug and security-check a project by checking it against every bug we've hit before, then log what you checked.

Agent instructions: fetch /AGENT.md and follow the protocol. Report back with POST /api/checks.

## Data (JSON)
- [All bugs](https://bugledger.coconvo.workers.dev/bugs.json): every known bug {app,title,category,severity,symptom,root_cause,fix}
- [Per-app checklist](https://bugledger.coconvo.workers.dev/checklist.json): bugs grouped by app + recurring classes + scanner detectors + security findings
- [Security audit](https://bugledger.coconvo.workers.dev/security.json): the full severity-ranked security sweep

## Protocol
- [AGENT.md](https://bugledger.coconvo.workers.dev/AGENT.md): step-by-step — how to debug a project against the ledger and log the result
- POST https://bugledger.coconvo.workers.dev/api/checks : record a check — response includes server-verified \`coverage\` (matched/total/missed) vs the app catalog
- GET  https://bugledger.coconvo.workers.dev/api/checks : recent check-logs
- POST https://bugledger.coconvo.workers.dev/api/bugs : submit a NEW bug you discovered (append-only; needs x-ledger-key)
- Live worklog: POST /api/session to stream what you're doing; watch at https://bugledger.coconvo.workers.dev/live (helper: ~/BugLedger/worklog.mjs)

## Human pages
- [Interactive ledger](https://bugledger.coconvo.workers.dev/): filter by app/type/severity; Security Sweep, Scanner, Auto-harvested, and Check-log panels
`;
fs.writeFileSync(p("public","llms.txt"), llms);

// AGENT.md — the protocol an AI coding agent follows
const appListMd = appOrder.map(a => `\`${a}\` (${count[a]})`).join(" · ");
const agent = `# Bug Ledger — Agent Protocol

You are a coding agent working inside a project. This ledger is your regression + security
memory: **${bugs.length} bugs across ${appOrder.length} apps**, a security audit (${sec ? sec.findings.length : 0} findings),
and ${DETECTORS.length} static detectors. Use it to debug the current project against every bug we've
hit before, then **log what you checked** so there's a record.

Base URL: \`https://bugledger.coconvo.workers.dev\`

## Integrity — you can ADD, never delete or modify
The ledger is append-only. You may append a check-log (\`POST /api/checks\`) and stream live progress
(\`POST /api/session\`). There is **no** endpoint to edit or delete bugs, check-logs, or code — check-logs
are immutable at the database level and finished sessions are frozen. Never run \`--write\`, \`--deploy\`,
\`git\`, or \`wrangler\` against \`~/BugLedger\`; fix bugs in the CURRENT project's files only.

## Apps in the ledger
${appListMd}

## Step 1 — Get the checklist for this project's app
Pick the app name (ask the user, or infer from the repo). Then either:

- **Preferred (local, also scans code):**
  \`\`\`bash
  node ~/BugLedger/scan.mjs . --app "APP NAME" --catalog --json
  \`\`\`
  This prints auto-detected findings (file:line), the app's full known-bug checklist, the
  cross-app recurring classes, and the entire catalog. If the repo isn't at ~/BugLedger, clone
  https://github.com/Hallalu/bugledger first.
- **Or fetch the data over HTTP:**
  \`\`\`bash
  curl -s https://bugledger.coconvo.workers.dev/checklist.json     # per-app bugs + recurring + detectors + security
  curl -s https://bugledger.coconvo.workers.dev/bugs.json          # every bug, full detail
  \`\`\`
  Use \`.apps["APP NAME"]\` for that app's bugs; always also check \`.recurring\` and \`.detectors\`.

## Step 2 — Actually check each item against the code
For every known bug for that app (and every recurring class + detector), look at the real code and
decide: **present**, **not present**, or **n/a**. Don't guess — grep/read the relevant files. Fix any
you find (or report them). Track two lists: \`notFound\` (checked & clean) and \`found\` ({title,file,note}).

For security, run the detectors (the scanner does most automatically) and note \`securityChecked\`
(what you looked for) and \`securityFindings\` ({severity,title,file}). Set \`securityStatus\` to
"clean" or "issues".

## Step 3 — Log that you checked (this is the record the user asked for)
POST a summary so the ledger records this pass. Read the token from \`~/.bugledger.json\`:
\`\`\`bash
KEY=$(node -e "console.log(require(process.env.HOME+'/.bugledger.json').token)")
curl -s -X POST https://bugledger.coconvo.workers.dev/api/checks \\
  -H "content-type: application/json" -H "x-ledger-key: $KEY" \\
  -d '{
    "app": "Hallalu CRM",
    "project": "hallalu",
    "checkedBy": "claude-code",
    "scanned": 44,
    "checkedCount": 42,
    "foundCount": 1,
    "securityStatus": "clean",
    "notFound": ["Billing view shows outdated Solo/Studio/£19 pricing", "Dark-mode hero/aurora + a dozen surfaces stay light"],
    "found": [{"title":"Currency search fails on plurals","file":"public/app.js:210","note":"still reproduces"}],
    "securityChecked": ["XSS-INNERHTML","SECRET","SSRF-GOTO","LOCALSTORAGE-GLOBAL"],
    "securityFindings": [],
    "notes": "Checked the whole Hallalu CRM list; only the plurals bug remained."
  }'
\`\`\`
Or, to log the scanner's own findings automatically: \`node ~/BugLedger/scan.mjs . --app "Hallalu CRM" --log\`.

## Show your work live (optional but nice)
While you do all of the above, you can stream progress to a live board the user watches at
\`https://bugledger.coconvo.workers.dev/live\`:
\`\`\`bash
node ~/BugLedger/worklog.mjs start --app "APP" --project "$(basename "$PWD")" --title "Checking APP vs the ledger" --tasks "Pull checklist|Check each bug|Run detectors|Log the pass"
node ~/BugLedger/worklog.mjs step 1 --current "checking the localStorage scoping"
node ~/BugLedger/worklog.mjs done 1
node ~/BugLedger/worklog.mjs finish
\`\`\`
Each call posts to \`POST /api/session\`; the board polls every ~1.5s and ticks tasks off as you go.

## Coverage is server-verified
The \`POST /api/checks\` response includes \`coverage: {total, matched, pct, complete, missed[]}\` — the
worker matches your \`notFound\`+\`found\` titles against the app's catalog. If \`complete\` is false, the
\`missed\` array names the exact bugs you didn't address; check those and re-post until it's true. New
bugs you find go to \`POST /api/bugs\` (append-only).

## Step 4 — Tell the user
Summarise: which bugs you checked and did NOT find (clean), which you found (and fixed), the
security status, and confirm the log was posted (the response includes an \`id\`). The log shows up
on the site's **Check-log** panel and at GET /api/checks.
`;
fs.writeFileSync(p("public","AGENT.md"), agent);

console.log(`gen: ${bugs.length} bugs, ${appOrder.length} apps${sec?`, ${sec.findings.length} security`:""}${scanCount?`, ${scanCount} scanner`:""}${harvCount?`, ${harvCount} harvested`:""} -> data.js, bugs.json, checklist.json, AGENT.md, llms.txt, docs`);
