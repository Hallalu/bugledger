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
  performance:"perf",race:"race",sync:"sync",auth:"auth",
  privacy:"privacy",claims:"claims",accessibility:"a11y",observability:"observability",testing:"testing",seo:"SEO",
  other:"other" };
const SEV = { security:0,"data-loss":1,crash:2,auth:3,privacy:4,sync:5,race:6,logic:7,
  claims:8,accessibility:9,observability:10,testing:11,performance:12,seo:13,ui:14,other:15 };
const CAT2SEV = { "data-loss":"critical",security:"high",crash:"high",auth:"high",sync:"high",privacy:"high",
  race:"medium",logic:"medium",claims:"medium",accessibility:"medium",observability:"medium",
  testing:"low",seo:"low",performance:"low",ui:"low",other:"low" };
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
  // --- accessibility layer ---
  "A11Y-IMG-ALT (<img> with no alt attribute)",
  "A11Y-NO-LANG (<html> with no lang attribute)",
  "A11Y-INPUT-NOLABEL (form input with no label/aria-label)",
  "A11Y-EMPTY-CONTROL (button/link with no accessible name)",
  "A11Y-FOCUS-KILLED (outline:none with no :focus-visible replacement)",
  "A11Y-POSITIVE-TABINDEX (tabindex > 0 breaks tab order)",
  "A11Y-CLICK-NONINTERACTIVE (onclick on div/span with no role+tabindex)",
  // --- claims-accuracy layer ---
  "CLAIM-SUPERLATIVE (first/only/best/#1/guaranteed — verify or soften)",
  "CLAIM-FAKE-SCARCITY (countdown/'only N left'/'X viewing' — legal risk)",
  "CLAIM-UNSOURCED-STAT (percentage stat in copy with no cited source)",
  "CLAIM-PLACEHOLDER (lorem/TODO/sample testimonial shipped to users)",
  // --- privacy & legal layer ---
  "PRIV-3P-TRACKER (third-party analytics/ad SDK — consent + sensitive data)",
  "PRIV-PII-LOG (console logging of email/password/token/PII)",
  "PRIV-PII-IN-URL (personal data placed in a query string)",
  "PRIV-NO-POLICY (collects personal data with no privacy policy)",
  "PRIV-NO-DELETE (accounts with no delete-my-data path)",
  // --- testing layer ---
  "TEST-NONE (no test files anywhere in the project)",
  "TEST-NO-CI (no CI workflow to run them)",
  "TEST-ONLY (.only left in a suite — silently skips the rest)",
  "TEST-SKIPPED (skipped/disabled tests)",
  // --- SEO & sharing layer ---
  "SEO-NO-TITLE (page with no <title>)",
  "SEO-NO-DESC (no meta description)",
  "SEO-NO-OG (no Open Graph/Twitter card — links share as a bare URL)",
  "SEO-NO-VIEWPORT (no viewport meta — breaks mobile)",
  // --- observability layer ---
  "OBS-EMPTY-CATCH (catch block swallows the error silently)",
  "OBS-UNHANDLED-PROMISE (.then with no .catch)",
  "OBS-NO-ERROR-HANDLER (no window.onerror/unhandledrejection reporting)",
  // --- integrity / data layer ---
  "IMG-DROP (screenshot/photo kept by label only — the actual image reference is dropped)",
  // --- INVIS: invisible-Unicode sanitisation (detect + clean smuggled characters in code/docs) ---
  "INVIS-SMUGGLE (hidden Unicode tag-block / invisible-math smuggling channel)",
  "INVIS-BIDI (bidirectional control character — Trojan-Source source spoofing)",
  "INVIS-HIDDEN (invisible / zero-width character in file)",
  "INVIS-HOMOGLYPH (look-alike Cyrillic/Greek letter posing as Latin)",
  "INVIS-EXOTIC-SPACE (non-standard space or line separator)",
];

const bugs = JSON.parse(fs.readFileSync(p("bugs.json"), "utf8"));

// app order by count desc
const count = {};
for (const b of bugs) count[b.app] = (count[b.app]||0)+1;
const appOrder = Object.keys(count).sort((a,b)=>count[b]-count[a] || a.localeCompare(b));
const NONAPP = new Set(['cross-cutting','Unknown']);
const realAppCount = appOrder.filter(a => !NONAPP.has(a)).length;

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
L.push(`**${bugs.length} bugs fixed** across **${realAppCount} apps**, mined from the full AI-assisted build history. Live: **https://bugledger.coconvo.workers.dev**\n`);
L.push("| Metric | Count |","|---|---|",
  `| Total bugs fixed | ${bugs.length} |`,
  `| Apps | ${realAppCount} |`,
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
C.push(`# BUG REGRESSION CHECKLIST — ${bugs.length} known bugs across ${realAppCount} apps`);
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

// ---- optimisers (elevations worth reusing) → data-opt.js + OPTIMISERS.md ----
let optCount = 0, optimisers = [];
if (fs.existsSync(p("optimisers.json"))) {
  optimisers = JSON.parse(fs.readFileSync(p("optimisers.json"), "utf8"));
  optCount = optimisers.length;
  const OPT_ORDER = ["design-elevation","ux","performance","workflow","architecture","accessibility","copy","conversion","dx","integrity",
    "privacy","claims","testing","seo","observability"];
  const OPT_LABEL = { "design-elevation":"design elevation", ux:"UX", performance:"performance", workflow:"workflow",
    architecture:"architecture", accessibility:"accessibility", copy:"copy", conversion:"conversion", dx:"dev-experience", integrity:"integrity",
    privacy:"privacy & legal", claims:"claims accuracy", testing:"testing", seo:"SEO & sharing", observability:"observability" };
  const oi = (c) => { const i = OPT_ORDER.indexOf(c); return i < 0 ? 99 : i; };
  const byCat = {}; for (const o of optimisers) (byCat[o.category] ||= []).push(o);
  const cats = Object.keys(byCat).sort((a,b)=>oi(a)-oi(b));
  fs.writeFileSync(p("public","data-opt.js"),
    `window.OPTIMISERS=${JSON.stringify({ generated:GEN, count:optCount, cats, labels:OPT_LABEL, items:optimisers })};\n`);
  let O = [`# ✨ Optimisers — elevations worth reusing\n`,
    `${optCount} reusable patterns (design elevations, UX, performance, workflow…) mined from the build history. Not bugs — things that made an app *better*.\n`];
  for (const c of cats) {
    O.push(`## ${OPT_LABEL[c]||c} (${byCat[c].length})\n`);
    for (const o of byCat[c]) {
      O.push(`- **${o.title}** _(${o.app})_`);
      if (o.detail) O.push(`  ${o.detail}`);
      if (o.why) O.push(`  <br>*Why:* ${o.why}`);
      if (o.how) O.push(`  <br>*How:* ${o.how}`);
    }
    O.push("");
  }
  fs.writeFileSync(p("OPTIMISERS.md"), O.join("\n"));
  fs.writeFileSync(p("public","OPTIMISERS.md"), O.join("\n"));
}

// ---- agent-facing endpoints & docs (served as static assets) ----
// machine-readable data
fs.writeFileSync(p("public","bugs.json"), JSON.stringify(bugs));
if (sec) fs.writeFileSync(p("public","security.json"), JSON.stringify(sec));

// compact per-app checklist for agents
const checklist = { generated: GEN, base: "https://bugledger.coconvo.workers.dev",
  totals: { bugs: bugs.length, apps: realAppCount, security: sec ? sec.findings.length : 0 },
  apps: {}, recurring: RECURRING, detectors: DETECTORS,
  security: sec ? sec.findings.map(f => ({ id: f.id, severity: f.severity, status: f.status, app: f.app, title: f.title })) : [],
  optimisers: optimisers.map(o => ({ title: o.title, category: o.category, app: o.app })) };
for (const app of appOrder)
  checklist.apps[app] = byApp[app].slice()
    .sort((a,b)=>(SEV[a.category]-SEV[b.category])||a.title.localeCompare(b.title))
    .map(b => ({ title: b.title, category: b.category, severity: sevOf(b), symptom: b.symptom || "", fix: b.fix || "" }));
fs.writeFileSync(p("public","checklist.json"), JSON.stringify(checklist));
// admin recurrence view reads these raw tiers over HTTP (same data the data-*.js panels carry)
try { fs.writeFileSync(p("public","harvested.json"), fs.existsSync(p("harvested.json")) ? fs.readFileSync(p("harvested.json"),"utf8") : "[]"); } catch {}
try { fs.writeFileSync(p("public","scan-findings.json"), fs.existsSync(p("scan-findings.json")) ? fs.readFileSync(p("scan-findings.json"),"utf8") : "[]"); } catch {}

// llms.txt — root index for AI agents (llmstxt.org convention)
const llms = `# Bug Ledger

> A catalogue of ${bugs.length} bugs fixed across ${realAppCount} apps, plus a security audit and a code scanner. Use it to debug and security-check a project by checking it against every bug we've hit before, then log what you checked.

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
- Scan story: POST /api/session/event to narrate findings (severity, status, plain-English why/impact/fix, file, evidence, before→after metrics, verdict); read at GET /api/story?id=<session> (returns the session plus \`history\`: every earlier scan of the same app, each rolled up); human page https://bugledger.coconvo.workers.dev/story/<session> — itemised, severity-tagged, compared to the previous scan, with a Scan history tab spanning every earlier scan

## Live + history
- Stream progress (watch): POST /api/session · board https://bugledger.coconvo.workers.dev/live · helper ~/BugLedger/worklog.mjs
- Activity timeline (permanent record of every session + scan): https://bugledger.coconvo.workers.dev/timeline · GET /api/activity

## Human pages
- [Interactive ledger](https://bugledger.coconvo.workers.dev/): filter by app/type/severity; Security Sweep, Scanner, Auto-harvested, Agent-submitted, and Check-log panels
`;
fs.writeFileSync(p("public","llms.txt"), llms);

// AGENT.md — the protocol an AI coding agent follows
const appListMd = appOrder.map(a => `\`${a}\` (${count[a]})`).join(" · ");
const agent = `# Bug Ledger — Agent Protocol

You are a coding agent working inside a project. This ledger is your regression + security
memory: **${bugs.length} bugs across ${realAppCount} apps**, a security audit (${sec ? sec.findings.length : 0} findings),
and ${DETECTORS.length} static detectors. Use it to debug the current project against every bug we've
hit before, then **log what you checked** so there's a record.

Base URL: \`https://bugledger.coconvo.workers.dev\`

## Integrity — you can ADD, never delete or modify
The ledger is append-only. You may append a check-log (\`POST /api/checks\`), stream live progress
(\`POST /api/session\`) and narrate the scan story (\`POST /api/session/event\`). There is **no** endpoint to edit or delete bugs, check-logs, or code — check-logs
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

## Narrate the scan story (the report the user reads)
Every sweep has a **story** at \`/story/<session id>\` — the agent's own account, itemised: numbered findings
with 🟣 critical · 🔴 high · 🟠 medium · 🟡 low tags (text + icon, never colour alone), 🔵 fixed / open /
needs-your-call / false-alarm status, plain-English *what was wrong · why it matters · what was done*, the
file:line, the evidence (detector / code-read / test), before → after metrics with % improvement, a comparison
to the previous scan of the same app plus a **Scan history** tab listing every earlier scan of that app
(newest first, each linking to its own full story), honest caveats, and a verdict. Append-only: \`POST /api/session/event\`.
\`\`\`bash
W(){ node ~/BugLedger/worklog.mjs "$@"; }   # a function, not $W — zsh does not word-split variables
W start --app "APP" --project "$(basename "$PWD")" --title "Deep scan" --tasks "Automated pass|Bugs|Security|Optimisers"   # prints 📖 story: …/story/<id>
W phase "Phase 1 — Automated pass"
W say "Triaging the high-confidence hits — reading the code, not trusting the detector"
W found "Labels not linked to inputs" --sev medium --cat accessibility --file "book.html:51" --why "…" --impact "…" --fix "…" --status fixed --verified code-read
W found "NO-CSP ×10" --sev low --status false-positive --why "CSP is a real HTTP header; the detector reads HTML only"
W fixed "Focus you can't see" --fix "Real :focus-visible rings"
W clean "accessibility" --n 11 --verified code-read
W metric "Detector findings" --before 387 --after 353
W caveat "Could not exercise the booking template live — verified in deployed source"
W verdict "8 fixed, 3 for your call, 3 new ledger items"
W finish
\`\`\`
Raw API: \`POST /api/session/event\` \`{sessionId, events:[{kind:"found", severity, status, category, title, detail, impact, fix, file, verifiedBy, confidence}]}\`
(kinds: phase · say · found · fixed · clean · metric · verdict · caveat · note). Read it back: \`GET /api/story?id=<session>\`.
Attach coverage and additions to the story by sending \`"sessionId"\` on \`POST /api/checks\` and \`POST /api/bugs\`.
\`scan.mjs . --story\` itemises the automated pass's high-confidence hits automatically — then resolve each one after reading the code: \`worklog.mjs fixed "<its title>" --status fixed|false-positive|needs-call --fix "…"\`.

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
bugs you find go to \`POST /api/bugs\` (append-only). To scan against **every bug across ALL apps**
(the whole catalog, e.g. 315/315), send \`"scope":"all"\`; for a **full security sweep** across all apps'
security items, send \`"scope":"security"\`. Coverage is computed against that catalog. Stream a live
\`N/total\` counter with \`worklog.mjs progress <done> <total>\`.

## Step 4 — Tell the user
Summarise: which bugs you checked and did NOT find (clean), which you found (and fixed), the
security status, and confirm the log was posted (the response includes an \`id\`). The log shows up
on the site's **Check-log** panel and at GET /api/checks.
`;
fs.writeFileSync(p("public","AGENT.md"), agent);

console.log(`gen: ${bugs.length} bugs, ${realAppCount} apps${sec?`, ${sec.findings.length} security`:""}${scanCount?`, ${scanCount} scanner`:""}${harvCount?`, ${harvCount} harvested`:""} -> data.js, bugs.json, checklist.json, AGENT.md, llms.txt, docs`);
