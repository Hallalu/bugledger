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

console.log(`gen: ${bugs.length} bugs, ${appOrder.length} apps${sec?`, ${sec.findings.length} security`:""}${scanCount?`, ${scanCount} scanner`:""}${harvCount?`, ${harvCount} harvested`:""} -> data.js, data-sec.js${scanCount?", data-scan.js":""}${harvCount?", data-harvest.js":""}, BUGS.md, CHECKLIST.md`);
