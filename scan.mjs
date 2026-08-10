#!/usr/bin/env node
/*
 Bug Ledger — code scanner.
 Scans an app's source for regressions of known bug classes + likely new bugs,
 then (optionally) records new findings to the ledger and rebuilds it.

 Usage:
   node /path/to/BugLedger/scan.mjs [targetDir] [--app "Name"] [--write] [--deploy] [--json]

   targetDir   app directory to scan (default: current working directory)
   --app       force the app name used for the checklist (else auto-detected)
   --write     append genuinely-new findings to scan-findings.json + rebuild ledger
   --deploy    after --write, wrangler deploy + git commit/push the ledger
   --json      print findings as JSON instead of the human report

 Static analysis only — it reads files, never executes the app. Treat findings as
 leads to verify, not proof. Pair with the printed manual checklist for the bugs
 that can't be caught statically (visual/layout/sync-semantics).
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const LEDGER = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flags = new Set(argv.filter(a => a.startsWith("--")));
const positional = argv.filter(a => !a.startsWith("--"));
const appFlag = (() => { const i = argv.indexOf("--app"); return i >= 0 ? argv[i+1] : null; })();
const TARGET = path.resolve(positional.find(a => a !== appFlag) || process.cwd());
const AS_JSON = flags.has("--json");

if (!fs.existsSync(TARGET)) { console.error("No such directory:", TARGET); process.exit(1); }

// ---------- app-name detection ----------
const APP_ALIASES = {
  breadcrumb:"Breadcrumb", budgetstudio:"Budget LevelUp","budget-levelup":"Budget LevelUp", budgetlevelup:"Budget LevelUp",
  listinglab:"Listing Lab Pro","listing-lab":"Listing Lab Pro", plannerstudio:"Planner Studio",
  weddingplanner:"Wedding Planner", babyplanner:"Hello Baby","hello-baby":"Hello Baby", hellobaby:"Hello Baby",
  hallalu:"Hallalu CRM", hopefil:"Hopefil", hopefill:"Hopefil", stitchhooky:"Stitchhooky", stitchhookey:"Stitchhooky",
  finished:"Finished.", kairos:"Kairos", promptvault:"Prompt Vault", everafter:"Ever After",
  sociallevelup:"Social LevelUp", hallalubookings:"Hallalu CRM",
};
function detectApp() {
  if (appFlag) return appFlag;
  const tryName = (f, key) => {
    try { const j = JSON.parse(fs.readFileSync(path.join(TARGET, f), "utf8")); return j[key]; } catch { return null; }
  };
  const cands = [tryName("wrangler.json","name"), tryName("wrangler.jsonc","name"),
                 tryName("package.json","name"), path.basename(TARGET)].filter(Boolean);
  for (const c of cands) {
    const k = String(c).toLowerCase().replace(/[^a-z0-9]/g,"");
    if (APP_ALIASES[k]) return APP_ALIASES[k];
  }
  return cands[0] || path.basename(TARGET);
}
const APP = detectApp();

// ---------- file walk ----------
const SKIP_DIRS = new Set(["node_modules",".git","dist","build",".wrangler",".next","out","coverage",".cache","vendor",".vercel",".turbo"]);
const EXTS = new Set([".js",".mjs",".cjs",".ts",".tsx",".jsx",".html",".htm",".css",".vue",".svelte",".json",".jsonc",".toml"]);
const MAX_BYTES = 1_500_000;
const files = [];
(function walk(dir) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes:true }); } catch { return; }
  for (const e of ents) {
    if (e.name.startsWith(".") && e.name !== ".env" && e.name !== ".dev.vars") { if (e.isDirectory()) continue; }
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(fp); continue; }
    const ext = path.extname(e.name).toLowerCase();
    const bare = e.name.toLowerCase();
    if (EXTS.has(ext) || bare === ".env" || bare === ".dev.vars") {
      try { if (fs.statSync(fp).size <= MAX_BYTES) files.push(fp); } catch {}
    }
  }
})(TARGET);

const rel = f => path.relative(TARGET, f);
const isCode = f => /\.(js|mjs|cjs|ts|tsx|jsx|vue|svelte)$/i.test(f);
const isHTML = f => /\.(html?|vue|svelte)$/i.test(f);

// ---------- detectors ----------
// Each: id, sev, cat, bug(known class), advice, and either {ext, line:(text)=>bool|match} per-line
// or {file:(content, path)=>[{line, excerpt}]} whole-file.
const D = [];
const perLine = (id, sev, cat, bug, advice, extTest, re) =>
  D.push({ id, sev, cat, bug, advice, kind:"line", extTest, re });
const perFile = (id, sev, cat, bug, advice, fn) =>
  D.push({ id, sev, cat, bug, advice, kind:"file", fn });

// --- security ---
perLine("XSS-INNERHTML","high","security","Stored/DOM XSS (HTML sink with interpolation)",
  "Ensure every interpolated value is escaped (an esc() that also handles \" and '), or build DOM with textContent.",
  isCode, /\b(?:innerHTML|outerHTML)\s*=\s*[^=].*(?:\$\{|\+)|insertAdjacentHTML\s*\(|document\.write\s*\(/);
perLine("SECRET","high","security","Committed secret / API key",
  "Move to an env binding; rotate the exposed key immediately.",
  f=>!/\.(md|json)$/i.test(f) && !/security\.json|bugs\.json/.test(f),
  /\b(sk_live_[0-9a-zA-Z]{10,}|sk-ant-[0-9A-Za-z-]{20,}|AIza[0-9A-Za-z_\-]{20,}|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{30,}|xox[baprs]-[0-9A-Za-z-]{10,})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/);
perLine("PBKDF2-WEAK","medium","security","PBKDF2 iterations below OWASP 2026 guidance (~600k)",
  "Raise iterations to >=600000; the real fix for low-entropy secrets is a retrieval token, not more rounds.",
  isCode, /iterations\s*[:=]\s*(\d{1,6})\b/);
perLine("STATIC-SALT","low","security","Constant/global KDF salt",
  "Generate a random per-account salt at creation and store it alongside the record.",
  isCode, /\bsalt\s*[:=]\s*["'`][^"'`]{3,}["'`]/);
perLine("SSRF-GOTO","high","security","SSRF / open proxy (unvalidated navigation/fetch target)",
  "Enforce an https + host allowlist before page.goto()/fetch(); use redirect:'manual' and re-validate.",
  isCode, /\bpage\.goto\s*\(\s*(?!["'`]https?:\/\/)/);
perLine("NATIVE-DIALOG","low","ui","Native browser dialog used for UX",
  "Replace prompt()/alert()/confirm() with in-app UI (native dialogs look broken and block).",
  isCode, /(^|[^.\w])(prompt|alert)\s*\(/);
perLine("LOCALSTORAGE-GLOBAL","low","security","Global localStorage key — verify per-account scoping (cross-account leak class)",
  "Stamp the signed-in owner into the key (or wipe on account switch) so a second account on the same device can't read the first's data.",
  isCode, /localStorage\.setItem\s*\(\s*["'`][a-zA-Z0-9_.:-]+["'`]/);

// --- logic / crash ---
perLine("DATE-TOISO","medium","logic","Date via toISOString() can shift a day across timezones",
  "For a calendar Y-M-D use local getFullYear/getMonth/getDate, not toISOString().slice(0,10).",
  isCode, /\.toISOString\s*\(\s*\)/);
perLine("ARGUMENTS-CALLEE","high","crash","arguments.callee (ReferenceError in ES modules / strict mode)",
  "Use a named function expression instead of arguments.callee.",
  isCode, /\barguments\.callee\b/);
perLine("FIND-DEREF","medium","crash","Property access directly on a .find()/.match() result (may be undefined)",
  "Guard the result before dereferencing to avoid 'cannot read property of undefined'.",
  isCode, /\.(?:find|match)\s*\([^)]*\)\s*\.[a-zA-Z_]/);

// --- whole-file detectors ---
perFile("ESC-QUOTES","high","security","esc()/escape helper that does not escape quotes",
  "Add .replace(/\"/g,'&quot;').replace(/'/g,'&#39;') — unescaped quotes break out of HTML attributes (stored-XSS class).",
  (c) => {
    const out = [];
    const reFn = /(?:function\s+(esc|escapeHtml|escapeHTML|htmlEscape)\s*\([^)]*\)\s*\{|(?:const|let|var)\s+(esc|escapeHtml|escapeHTML|htmlEscape)\s*=\s*(?:\([^)]*\)|[^=]*)=>)/g;
    let m;
    while ((m = reFn.exec(c))) {
      const body = c.slice(m.index, m.index + 400);
      const escLt = /&lt;|&#60;/.test(body) || /replace\([^)]*</.test(body);
      const escQuote = /&quot;|&#39;|&#x27;/.test(body);
      if (escLt && !escQuote) {
        const line = c.slice(0, m.index).split("\n").length;
        out.push({ line, excerpt: (m[0]||"").slice(0,80) });
      }
    }
    return out;
  });
perFile("SW-CACHE-FIRST","high","other","Service worker serves cache-first — returning users get a stale build",
  "Use network-first (or stale-while-revalidate) for navigations/HTML so shipped fixes aren't masked by an old cached shell.",
  (c, fp) => {
    const looksSW = /addEventListener\(\s*['"]fetch['"]/.test(c) || /\bself\.__WB|workbox/.test(c) || /serviceworker|(^|\/)sw\.js$/i.test(fp);
    if (!looksSW) return [];
    if (!/caches\.match\s*\(/.test(c)) return [];
    const networkFirst = /networkFirst|network-first/i.test(c) ||
      /fetch\([^)]*\)\s*\.then[\s\S]{0,120}caches\.(open|match)/.test(c); // network then cache
    if (networkFirst) return [];
    const line = (c.split(/caches\.match/)[0] || "").split("\n").length;
    return [{ line, excerpt: "cache-first fetch handler" }];
  });
perFile("DUP-DOM-ID","medium","ui","Duplicate DOM id in markup (breaks getElementById/handlers)",
  "Make ids unique; duplicate ids silently wire events to the wrong element.",
  (c, fp) => {
    if (!isHTML(fp)) return [];
    const ids = {}; const re = /\sid\s*=\s*["']([^"']+)["']/g; let m;
    while ((m = re.exec(c))) {
      const id = m[1];
      if (/^\$\{|<%|{{/.test(id)) continue; // templated id, skip
      (ids[id] ||= []).push(c.slice(0, m.index).split("\n").length);
    }
    return Object.entries(ids).filter(([,ls]) => ls.length > 1)
      .map(([id, ls]) => ({ line: ls[1], excerpt: `id="${id}" appears ${ls.length}× (lines ${ls.join(", ")})` }));
  });
perFile("NO-CSP","low","security","No Content-Security-Policy found in served HTML",
  "Add a CSP (meta or worker response header) to reduce XSS blast radius.",
  (c, fp) => {
    if (!/\.html?$/i.test(fp)) return [];
    if (/<html/i.test(c) && !/content-security-policy/i.test(c)) return [{ line: 1, excerpt: path.basename(fp) }];
    return [];
  });

// ---------- run detectors ----------
const findings = [];
for (const fp of files) {
  let content; try { content = fs.readFileSync(fp, "utf8"); } catch { continue; }
  if (content.includes("\0")) continue; // binary-ish
  const lines = content.split("\n");
  // skip minified/bundled/generated files — they aren't the app's authored source
  const maxLine = lines.reduce((m,l)=>Math.max(m,l.length),0);
  if (maxLine > 2000 || /\.min\.(js|css)$/i.test(fp) || /(^|\/)(bundle|vendor|chunk)[.\-]/i.test(rel(fp))) continue;
  // track whether each line STARTS inside a backtick template literal (parity of backticks)
  const inTpl = []; { let bt = 0; for (const l of lines) { inTpl.push(bt % 2 === 1); bt += (l.match(/`/g)||[]).length; } }
  for (const d of D) {
    if (d.kind === "line") {
      if (d.extTest && !d.extTest(fp)) continue;
      let hitsInFile = 0;
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        if (ln.length > 500) continue;                 // data-URI / packed line
        if (/^\s*(\/\/|\*|#)/.test(ln)) continue;       // obvious comment line
        // ${...} inside a backtick template is correct interpolation, not a literal-placeholder bug
        if (d.id === "LITERAL-TEMPLATE" && (inTpl[i] || ln.includes("`"))) continue;
        const m = d.re.exec(ln); d.re.lastIndex = 0;
        if (!m) continue;
        if (d.id === "PBKDF2-WEAK") { const n = parseInt(m[1],10); if (!(n < 600000)) continue; }
        findings.push({ detector:d.id, severity:d.sev, category:d.cat, bug:d.bug, advice:d.advice,
          file: rel(fp), line: i+1, excerpt: ln.trim().slice(0,160) });
        if (++hitsInFile >= 25) break;                  // cap noise per file/detector
      }
    } else {
      let hits = []; try { hits = d.fn(content, fp) || []; } catch {}
      for (const h of hits)
        findings.push({ detector:d.id, severity:d.sev, category:d.cat, bug:d.bug, advice:d.advice,
          file: rel(fp), line: h.line, excerpt: h.excerpt });
    }
  }
}

// ---------- classify vs ledger ----------
let ledger = [];
try { ledger = JSON.parse(fs.readFileSync(path.join(LEDGER, "bugs.json"), "utf8")); } catch {}
const appBugs = ledger.filter(b => b.app === APP);
const scanKey = f => `scan:${APP}:${f.detector}:${f.file}:${f.line}`;

// ---------- output ----------
const SEVORDER = { critical:0, high:1, medium:2, low:3 };
findings.sort((a,b)=> (SEVORDER[a.severity]-SEVORDER[b.severity]) || a.file.localeCompare(b.file) || a.line-b.line);
const byDet = {};
for (const f of findings) (byDet[f.detector] ||= []).push(f);

if (AS_JSON) {
  console.log(JSON.stringify({ app:APP, target:TARGET, filesScanned:files.length, findings }, null, 2));
} else {
  const bar = "─".repeat(60);
  console.log(`\n🔎 Bug Ledger scan — ${APP}`);
  console.log(bar);
  console.log(`dir:   ${TARGET}`);
  console.log(`files: ${files.length} scanned   detectors: ${D.length}   findings: ${findings.length}`);
  const tally = findings.reduce((a,f)=>(a[f.severity]=(a[f.severity]||0)+1,a),{});
  console.log(`sev:   ${["critical","high","medium","low"].filter(s=>tally[s]).map(s=>`${tally[s]} ${s}`).join("  ·  ")||"none"}`);
  console.log(bar);
  if (!findings.length) console.log("\n✓ No static regressions detected. Still run the manual checklist below.\n");
  for (const [det, fs_] of Object.entries(byDet)) {
    const d = fs_[0];
    console.log(`\n[${(d.severity||"?").toUpperCase()}] ${det} — ${d.bug}  (${fs_.length})`);
    console.log(`  ↳ ${d.advice}`);
    for (const f of fs_.slice(0,12)) console.log(`    ${f.file}:${f.line}   ${f.excerpt}`);
    if (fs_.length > 12) console.log(`    …and ${fs_.length-12} more`);
  }
  // manual checklist
  console.log(`\n${bar}\n📋 MANUAL CHECKLIST — every known bug for ${APP} (${appBugs.length}) — verify each:\n${bar}`);
  if (!appBugs.length) console.log("  (no ledger entries for this app yet)");
  const SEV2 = { security:0,"data-loss":1,crash:2,auth:3,sync:4,race:5,logic:6,performance:7,ui:8,other:9 };
  for (const b of appBugs.slice().sort((a,b)=>SEV2[a.category]-SEV2[b.category]))
    console.log(`  [ ] (${b.category}) ${b.title}`);
  // cross-app recurring classes
  console.log(`\n${bar}\n🔁 CROSS-APP RECURRING CLASSES — these bit multiple apps, always re-check:\n${bar}`);
  for (const r of [
    "Stale service-worker cache pinning users to an old build (bump cache name / network-first HTML).",
    "Cross-account data leak: localStorage/IndexedDB not scoped to the signed-in owner; wipe on switch.",
    "Deletions resurrect after sync (missing tombstones / stale-device overwrite).",
    "toISOString() date off-by-one for calendar Y-M-D.",
    "esc()/innerHTML not escaping quotes → attribute-injection XSS.",
    "Template ${...} placeholder rendered literally inside a quoted string.",
    "Duplicate DOM ids after a redesign wiring events to the wrong element.",
    "API key/secret saved with a trailing space silently breaking AI calls.",
    "Vault/PIN low-entropy + publicly-addressable ciphertext (see Security Sweep).",
  ]) console.log(`  [ ] ${r}`);
  // full catalog — check this project against EVERY known bug type (default for new/unknown apps)
  let secF = []; try { secF = (JSON.parse(fs.readFileSync(path.join(LEDGER,"security.json"),"utf8")).findings)||[]; } catch {}
  const totalTypes = ledger.length + secF.length;
  const showCatalog = flags.has("--catalog") || flags.has("--full") || appBugs.length === 0;
  if (showCatalog) {
    const so = { critical:0, high:1, medium:2, low:3 };
    console.log(`\n${bar}\n📚 FULL KNOWN-BUG CATALOG — verify this project against all ${totalTypes} known types (${ledger.length} bugs + ${secF.length} security):\n${bar}`);
    for (const f of secF.slice().sort((a,b)=>so[a.severity]-so[b.severity]))
      console.log(`  [ ] (security/${f.severity}) ${f.title}`);
    const byCat = {}; for (const b of ledger) (byCat[b.category] ||= []).push(b);
    for (const cat of Object.keys(byCat).sort((a,b)=>(SEV2[a]??9)-(SEV2[b]??9))) {
      console.log(`  —— ${cat} (${byCat[cat].length}) ——`);
      for (const b of byCat[cat]) console.log(`  [ ] [${b.app}] ${b.title}`);
    }
  } else {
    console.log(`\n  ▸ Run with --catalog to check this project against ALL ${totalTypes} known bug types (${ledger.length} bugs + ${secF.length} security findings), not just ${APP}'s.`);
  }
  console.log("");
}

// ---------- --write ----------
if (flags.has("--write")) {
  const OUT = path.join(LEDGER, "scan-findings.json");
  let store = []; try { store = JSON.parse(fs.readFileSync(OUT,"utf8")); } catch {}
  const have = new Set(store.map(s=>s.scanKey));
  const today = "2026-08-10";
  let added = 0;
  for (const f of findings) {
    const k = scanKey(f);
    if (have.has(k)) continue;
    have.add(k);
    store.push({ scanKey:k, app:APP, detector:f.detector, severity:f.severity, category:f.category,
      title:f.bug, file:f.file, line:f.line, excerpt:f.excerpt, advice:f.advice, status:"open", found:today });
    added++;
  }
  fs.writeFileSync(OUT, JSON.stringify(store, null, 2));
  console.log(`\n📝 --write: ${added} new finding(s) added to scan-findings.json (${store.length} total).`);
  try { execSync(`node ${JSON.stringify(path.join(LEDGER,"gen.mjs"))}`, { stdio:"inherit" }); } catch {}
  if (flags.has("--deploy")) {
    try {
      execSync("npx wrangler deploy", { cwd:LEDGER, stdio:"inherit" });
      execSync("git add -A && git -c user.email=rhemajking@gmail.com -c user.name=Hallalu commit -q -m "+JSON.stringify(`scan: +${added} findings for ${APP}`)+" && git push -q origin main", { cwd:LEDGER, stdio:"inherit" });
      console.log("🚀 deployed + pushed.");
    } catch(e) { console.error("deploy/push failed:", e.message); }
  }
}
