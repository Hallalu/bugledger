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

// --- accessibility (six failure types account for ~96% of detected WCAG errors) ---
perFile("A11Y-IMG-ALT","medium","accessibility","<img> with no alt attribute (screen readers fall back to the filename)",
  "Add alt=\"…\" describing the image, or alt=\"\" if it is purely decorative.",
  (c, fp) => {
    if (!isHTML(fp)) return [];
    const out = []; const re = /<img\b[^>]*>/gi; let m;
    while ((m = re.exec(c))) {
      if (/\balt\s*=/i.test(m[0])) continue;
      out.push({ line: c.slice(0, m.index).split("\n").length, excerpt: m[0].slice(0, 90) });
    }
    return out;
  });
perFile("A11Y-NO-LANG","medium","accessibility","<html> has no lang attribute (screen readers pick the wrong voice)",
  "Add lang=\"en\" (or the correct language) to the <html> element.",
  (c, fp) => {
    if (!/\.html?$/i.test(fp)) return [];
    const m = /<html\b[^>]*>/i.exec(c);
    if (!m || /\blang\s*=/i.test(m[0])) return [];
    return [{ line: c.slice(0, m.index).split("\n").length, excerpt: m[0].slice(0, 80) }];
  });
perFile("A11Y-INPUT-NOLABEL","medium","accessibility","Form field with no associated label (a placeholder is not a label)",
  "Give the field an id plus <label for=…>, or an aria-label. Missing labels are one of the most frequent WCAG failures.",
  (c, fp) => {
    if (!isHTML(fp)) return [];
    const labelFor = new Set(); let lm;
    const lre = /<label\b[^>]*\bfor\s*=\s*["']([^"']+)["']/gi;
    while ((lm = lre.exec(c))) labelFor.add(lm[1]);
    const out = []; const re = /<(input|select|textarea)\b[^>]*>/gi; let m;
    while ((m = re.exec(c))) {
      const tag = m[0];
      if (/\btype\s*=\s*["']?(hidden|submit|button|image|reset)\b/i.test(tag)) continue;
      if (/\baria-label(?:ledby)?\s*=|\btitle\s*=/i.test(tag)) continue;
      const idm = /\bid\s*=\s*["']([^"']+)["']/.exec(tag);
      if (idm && labelFor.has(idm[1])) continue;
      // already wrapped inside an open <label> …
      if (/<label\b(?:(?!<\/label>)[\s\S])*$/i.test(c.slice(Math.max(0, m.index - 300), m.index))) continue;
      out.push({ line: c.slice(0, m.index).split("\n").length, excerpt: tag.slice(0, 90) });
      if (out.length >= 15) break;
    }
    return out;
  });
perFile("A11Y-EMPTY-CONTROL","medium","accessibility","Button/link with no accessible name (icon-only control)",
  "Add aria-label=\"…\" (or visually-hidden text) so the control is announced. Empty links and buttons are top-6 WCAG failures.",
  (c, fp) => {
    if (!isHTML(fp)) return [];
    const out = []; const re = /<(button|a)\b([^>]*)>([\s\S]{0,200}?)<\/\1>/gi; let m;
    while ((m = re.exec(c))) {
      const attrs = m[2], inner = m[3];
      if (/\baria-label(?:ledby)?\s*=|\btitle\s*=/i.test(attrs)) continue;
      const text = inner.replace(/<[^>]*>/g, "").replace(/&[a-z#0-9]+;/gi, "").replace(/\$\{[^}]*\}/g, "x").trim();
      if (text.length) continue;
      if (/<img\b[^>]*\balt\s*=\s*["'][^"']+["']/i.test(inner)) continue;
      if (/<svg\b[\s\S]*?<title>/i.test(inner)) continue;
      out.push({ line: c.slice(0, m.index).split("\n").length, excerpt: m[0].slice(0, 90).replace(/\n/g, " ") });
      if (out.length >= 15) break;
    }
    return out;
  });
perFile("A11Y-FOCUS-KILLED","medium","accessibility","outline removed with no :focus-visible replacement — keyboard users lose the focus ring",
  "Pair any outline reset with a high-contrast :focus-visible style; WCAG 2.2 requires a visible focus indicator.",
  (c, fp) => {
    if (!/\.(css|html?|vue|svelte)$/i.test(fp)) return [];
    if (/:focus-visible/i.test(c)) return [];
    const m = /outline\s*:\s*(?:none|0)\b/i.exec(c);
    if (!m) return [];
    return [{ line: c.slice(0, m.index).split("\n").length, excerpt: "outline reset, no :focus-visible in this file" }];
  });
perLine("A11Y-POSITIVE-TABINDEX","low","accessibility","tabindex greater than 0 breaks the natural tab order",
  "Use tabindex=\"0\" (focusable, document order) or \"-1\" (programmatic only) — never a positive value.",
  isHTML, /\btabindex\s*=\s*["']?[1-9]\d*["']?/);
perLine("A11Y-CLICK-NONINTERACTIVE","medium","accessibility","Click handler on a non-interactive element (not keyboard reachable)",
  "Use a real <button>, or add role=\"button\" + tabindex=\"0\" + an Enter/Space keydown handler.",
  isHTML, /<(?:div|span|li|td)\b[^>]*\bonclick\s*=/i);

// --- claims accuracy / copy integrity ---
perLine("CLAIM-SUPERLATIVE","medium","claims","Unverifiable superlative claim in user-facing copy",
  "Verify against a primary source or soften it — unprovable 'first/only/best/guaranteed' claims are a trust and advertising-law risk.",
  f => /\.(html?|vue|svelte|js|mjs|jsx|tsx)$/i.test(f),
  /\b(?:world'?s\s+first|first\s+ever|the\s+only\s+(?:app|tool|platform|way|one)|#1\b|no\.?\s?1\s+(?:app|tool|choice)|guaranteed\b|100%\s*(?:secure|private|accurate|safe|free)|never\s+(?:lose|fail)s?\b|always\s+accurate)/i);
perLine("CLAIM-FAKE-SCARCITY","medium","claims","Manufactured scarcity/urgency in user-facing copy",
  "Only show scarcity that is literally true. Fabricated countdowns, 'only N left' and 'X people viewing' are unlawful in the UK/EU and an active enforcement target.",
  f => /\.(html?|vue|svelte|js|mjs|jsx|tsx)$/i.test(f),
  /\bonly\s+\d+\s+(?:left|remaining|spots?|seats?)\b|\b\d+\s+(?:people|others)\s+(?:are\s+)?(?:viewing|looking)\b|\b(?:hurry|ends\s+(?:soon|tonight)|limited\s+time\s+only|selling\s+fast)\b/i);
perLine("CLAIM-UNSOURCED-STAT","low","claims","Statistic in user-facing copy — confirm it cites a primary source",
  "Every published number needs a real, checkable source; drop it if you cannot cite one.",
  f => /\.(html?|vue|svelte)$/i.test(f), />[^<]{0,80}\b\d{1,3}(?:\.\d+)?%\s+of\s+[a-z]/i);
perLine("CLAIM-PLACEHOLDER","medium","claims","Placeholder or sample copy shipped to users",
  "Replace lorem ipsum / TODO / sample testimonials before shipping — fabricated testimonials are also unlawful.",
  f => /\.(html?|vue|svelte)$/i.test(f),
  /lorem\s+ipsum|\bTODO\b|\bFIXME\b|\bJohn\s+Doe\b|\bJane\s+Doe\b|sample\s+testimonial|your\s+text\s+here/i);

// --- privacy & legal ---
perLine("PRIV-3P-TRACKER","high","privacy","Third-party analytics/ad tracker present",
  "Sensitive data (health, reproductive, financial, precise location) must never pass through third-party ad/analytics SDKs; gate any tracker behind explicit consent.",
  f => /\.(html?|vue|svelte|js|mjs|jsx|tsx)$/i.test(f),
  /googletagmanager\.com|google-analytics\.com|\bgtag\s*\(|connect\.facebook\.net|\bfbq\s*\(|hotjar|mixpanel|segment\.(?:com|io)|amplitude\.com|clarity\.ms|doubleclick\.net/i);
perLine("PRIV-PII-LOG","medium","privacy","Personal data or a credential written to the console/logs",
  "Never log emails, passwords, tokens or whole records — log an id instead. Logs are retained and often shipped off-box.",
  isCode,
  /console\.(?:log|info|warn|error|debug)\s*\([^)]*(?:\.(?:password|passcode|token|apiKey|api_key|secret|email|ssn|creditCard|card_number)\b|\$\{[^}]*\b(?:password|passcode|token|apiKey|api_key|secret|email|ssn|creditCard|card_number)\b)/i);
perLine("PRIV-PII-IN-URL","high","privacy","Personal data placed in a URL query string",
  "URLs land in server logs, browser history and Referer headers — send personal data in a POST body instead.",
  isCode, /[?&](?:email|password|token|ssn|phone|dob|address)=(?:\$\{|["'`+])/i);

// --- testing / regression ---
const isTestFile = f => /\.(test|spec)\.[jt]sx?$/i.test(f) || /(^|\/)(tests?|__tests__|e2e|cypress|playwright)\//i.test(rel(f));
perLine("TEST-ONLY","high","testing",".only() left in a suite — every other test silently stops running",
  "Remove .only before committing and add a lint/CI rule that fails the build on it.",
  isTestFile, /\b(?:describe|it|test|context)\.only\s*\(/);
perLine("TEST-SKIPPED","low","testing","Skipped/disabled test",
  "A permanently skipped test is dead coverage — fix it or delete it so the suite tells the truth.",
  isTestFile, /\b(?:describe|it|test|context)\.skip\s*\(|\bx(?:it|describe)\s*\(/);

// --- SEO, meta & social sharing ---
const isPage = (c, fp) => /\.html?$/i.test(fp) && /<html/i.test(c);
perFile("SEO-NO-TITLE","medium","seo","Page has no <title>",
  "Add a unique, descriptive <title> — it is the tab name, the search-result headline and the default share text.",
  (c, fp) => isPage(c, fp) && !/<title[\s>]/i.test(c) ? [{ line: 1, excerpt: path.basename(fp) }] : []);
perFile("SEO-NO-DESC","low","seo","No meta description",
  "Add <meta name=\"description\"> — it is the snippet shown under your link in search results.",
  (c, fp) => isPage(c, fp) && !/<meta[^>]+name\s*=\s*["']description["']/i.test(c) ? [{ line: 1, excerpt: path.basename(fp) }] : []);
perFile("SEO-NO-OG","medium","seo","No Open Graph/Twitter card — shared links render as a bare URL",
  "Add og:title, og:description and og:image (1200×630) so the page previews properly wherever it is shared.",
  (c, fp) => isPage(c, fp) && !/property\s*=\s*["']og:|name\s*=\s*["']twitter:/i.test(c) ? [{ line: 1, excerpt: path.basename(fp) }] : []);
perFile("SEO-NO-VIEWPORT","high","seo","No viewport meta — the page renders desktop-width on phones",
  "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
  (c, fp) => isPage(c, fp) && !/name\s*=\s*["']viewport["']/i.test(c) ? [{ line: 1, excerpt: path.basename(fp) }] : []);

// --- observability / error reporting ---
perLine("OBS-EMPTY-CATCH","medium","observability","Empty catch block swallows the error",
  "At minimum log it with context and surface a user-visible failure — silent catches hide real breakage in production.",
  isCode, /catch\s*(?:\([^)]*\))?\s*\{\s*\}/);
perFile("OBS-UNHANDLED-PROMISE","medium","observability","Promise chain with no .catch() — rejections vanish as unhandled",
  "Add .catch() (or wrap in try/await) so failures are logged and surfaced instead of disappearing.",
  (c, fp) => {
    if (!isCode(fp)) return [];
    const out = []; const re = /\.then\s*\(/g; let m;
    while ((m = re.exec(c))) {
      if (/\.catch\s*\(|\.finally\s*\(/.test(c.slice(m.index, m.index + 400))) continue;
      out.push({ line: c.slice(0, m.index).split("\n").length, excerpt: c.slice(m.index, m.index + 70).replace(/\n/g, " ") });
      if (out.length >= 10) break;
    }
    return out;
  });

// ---------- run detectors ----------
const findings = [];
const corpus = [];
for (const fp of files) {
  let content; try { content = fs.readFileSync(fp, "utf8"); } catch { continue; }
  if (content.includes("\0")) continue; // binary-ish
  if (corpus.length < 400) corpus.push(content);
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

// ---------- project-level detectors (only visible across the whole repo) ----------
const PROJECT_DETECTORS = 5; // TEST-NONE, TEST-NO-CI, PRIV-NO-POLICY, PRIV-NO-DELETE, OBS-NO-ERROR-HANDLER
{
  const all = corpus.join("\n");
  const proj = (detector, severity, category, bug, advice, file, excerpt) =>
    findings.push({ detector, severity, category, bug, advice, file, line: 1, excerpt });

  const testFiles = files.filter(isTestFile);
  if (!testFiles.length) {
    proj("TEST-NONE","medium","testing","No test files anywhere in the project",
      "Add at least a smoke test of the core loop (sign in → create → save → reload and it's still there → export) and run it before every deploy. A regression in the primary verb is the fastest way to churn engaged users.",
      ".", `${files.length} source files scanned, 0 test files`);
  } else {
    let hasCI = false;
    try { hasCI = fs.readdirSync(path.join(TARGET, ".github", "workflows")).some(f => /\.ya?ml$/i.test(f)); } catch {}
    if (!hasCI)
      proj("TEST-NO-CI","low","testing","Tests exist but no CI workflow runs them",
        "Add a CI workflow that runs the suite on every push, so a regression cannot ship unnoticed.",
        ".github/workflows", `${testFiles.length} test files, no workflow found`);
  }

  const collectsPII = /type\s*=\s*["']email["']|autocomplete\s*=\s*["'](?:email|tel|name|street-address)/i.test(all);
  const hasPolicy = files.some(f => /privacy|terms/i.test(rel(f))) || /privacy[\s-]?policy/i.test(all);
  if (collectsPII && !hasPolicy)
    proj("PRIV-NO-POLICY","high","privacy","Collects personal data with no privacy policy",
      "Publish a privacy policy naming what you collect, why, how long you keep it and how to delete it — required under UK/EU GDPR and by both app stores.",
      ".", "personal-data fields found, no privacy policy in the project");

  const hasAccounts = /sign\s?-?up|signup|createAccount|\bregister\b|passcode|password/i.test(all);
  const hasDelete = /delete\s+(?:my\s+)?(?:account|data)|deleteAccount|erase\s+(?:my\s+)?data/i.test(all);
  if (hasAccounts && !hasDelete)
    proj("PRIV-NO-DELETE","high","privacy","Accounts exist with no delete-my-data path",
      "Give users a real one-tap 'delete my account and data' that purges server records and backups, and say honestly what it cannot reach. A GDPR right and an app-store requirement.",
      ".", "account flow found, no account/data deletion path");

  const hasFrontEnd = files.some(f => /\.html?$/i.test(f));
  const hasErrHandler = /addEventListener\s*\(\s*["'](?:error|unhandledrejection)["']|window\.onerror|Sentry|captureException|reportError\s*\(/i.test(all);
  if (hasFrontEnd && !hasErrHandler)
    proj("OBS-NO-ERROR-HANDLER","medium","observability","No global error handler — front-end crashes are invisible",
      "Add window.addEventListener('error') and ('unhandledrejection') to log/report failures; without them a white screen produces no signal at all.",
      ".", "no window.onerror / unhandledrejection / error reporter found");
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
  console.log(`files: ${files.length} scanned   detectors: ${D.length + PROJECT_DETECTORS}   findings: ${findings.length}`);
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
      // stage only the scanner's own outputs, never `git add -A` (co-editing safety)
      execSync("git add scan-findings.json public/data-scan.js SCAN-FINDINGS.md public/SCAN-FINDINGS.md 2>/dev/null; git -c user.email=rhemajking@gmail.com -c user.name=Hallalu commit -q -m "+JSON.stringify(`scan: +${added} findings for ${APP}`)+" && git push -q origin main", { cwd:LEDGER, stdio:"inherit" });
      console.log("🚀 deployed + pushed.");
    } catch(e) { console.error("deploy/push failed:", e.message); }
  }
}

// ---------- --log : POST this scan as a check-log to the ledger ----------
if (flags.has("--log")) {
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(process.env.HOME, ".bugledger.json"),"utf8")); } catch {}
  const base = process.env.BUGLEDGER_BASE || cfg.base || "https://bugledger.coconvo.workers.dev";
  const token = process.env.BUGLEDGER_TOKEN || cfg.token || "";
  const secDet = new Set(D.filter(d=>d.cat==="security").map(d=>d.id));
  const firedDet = new Set(findings.map(f=>f.detector));
  const cleanDet = D.map(d=>d.id).filter(id=>!firedDet.has(id));
  const secFindings = findings.filter(f=>f.category==="security")
    .map(f=>({ severity:f.severity, title:`${f.detector}: ${f.bug}`, file:`${f.file}:${f.line}` }));
  const payload = {
    app: APP, project: path.basename(TARGET), checkedBy: "scan.mjs",
    scanned: files.length, checkedCount: D.length + appBugs.length, foundCount: findings.length,
    securityStatus: secFindings.length ? "issues" : "clean",
    notFound: cleanDet.map(id=>`${id} (static check clean)`),
    found: findings.map(f=>({ title:`${f.detector}: ${f.bug}`, file:`${f.file}:${f.line}`, note:f.excerpt })).slice(0,200),
    securityChecked: [...secDet],
    securityFindings: secFindings,
    notes: `Static scan via scan.mjs (${D.length + PROJECT_DETECTORS} detectors across 9 layers, ${files.length} files). Auto-detected leads only — not a full manual pass.`,
  };
  try {
    const res = await fetch(base + "/api/checks", { method:"POST",
      headers: { "content-type":"application/json", "x-ledger-key": token },
      body: JSON.stringify(payload) });
    const out = await res.json().catch(()=>({}));
    if (out.ok) console.log(`\n✅ --log: recorded check for ${APP} (id ${out.id}). See ${base}/#checks`);
    else console.error(`\n--log failed: ${res.status} ${out.error||""}${token?"":" (no token — set ~/.bugledger.json)"}`);
  } catch(e) { console.error("--log failed:", e.message); }
}
