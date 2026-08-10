#!/usr/bin/env node
/*
 Bug Ledger — conversation harvester (unattended).
 Incrementally scans the local Claude transcripts for newly-described bug fixes
 and security issues, and appends high-confidence NEW ones to harvested.json
 (a separate, "unverified / auto" tier — the curated bugs.json is never touched).

 Usage:
   node harvest.mjs                 # scan new transcript content, update harvested.json + rebuild
   node harvest.mjs --deploy        # …then wrangler deploy + git commit/push (only if something changed)
   node harvest.mjs --full          # ignore saved offsets, re-scan every transcript from the start
   node harvest.mjs --quiet         # minimal output (for cron/launchd logs)

 State is kept in .harvest-state.json (per-file byte offset) so each run only reads
 the bytes appended since last time. Designed to be run hourly/daily by launchd/cron.
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const LEDGER = path.dirname(fileURLToPath(import.meta.url));
const TX_DIR = process.env.BUGLEDGER_TX_DIR || "/Users/rhemajoy/.claude/projects/-Users-rhemajoy";
const STATE = path.join(LEDGER, ".harvest-state.json");
const OUT = path.join(LEDGER, "harvested.json");
const flags = new Set(process.argv.slice(2).filter(a => a.startsWith("--")));
const QUIET = flags.has("--quiet");
const log = (...a) => { if (!QUIET) console.log(...a); };
const today = new Date().toISOString().slice(0, 10);

// ---- app inference cues ----
const APP_CUES = [
  ["Finished.", /\b(finished\.?app|habit|journal|study hub|screen studio|booking|Kairos|Supabase|tus |audiogram)\b/i],
  ["Hallalu CRM", /\b(hallalu|lead(s)?\b|contact card|business section|e-?business card|MECARD|follow-?up cadence)\b/i],
  ["Stitchhooky", /\b(stitch|crochet|knit|counter|notation|CORE-?SPEC|repeat row)\b/i],
  ["Hopefil", /\b(hopefil|hopefill|pitch deck|workspace layer|connector|compile farm)\b/i],
  ["Budget LevelUp", /\b(budget level ?up|budgetlevelup|vault|net worth|workbook|Excel)\b/i],
  ["Listing Lab Pro", /\b(listing ?lab|etsy|scoreboard|bestseller|hero image)\b/i],
  ["Planner Studio", /\b(planner studio|schedule grid|theme bookshelf|dictation)\b/i],
  ["Wedding Planner", /\b(wedding planner|seating|registry|RSVP|xlsx)\b/i],
  ["Ever After", /\b(ever after|honeymoon|babymoon|passport|souvenir)\b/i],
  ["Hello Baby", /\b(hello baby|due date|WEEK_FRUIT|hospital bag|baby shower)\b/i],
  ["Social LevelUp", /\b(social level ?up|creator crm|income-?per-?post|followers)\b/i],
  ["Breadcrumb", /\b(breadcrumb|prompt journal|capture\.js|trail\b)\b/i],
  ["Prompt Vault", /\b(prompt vault|2,?040 prompts|glass webapp)\b/i],
];
const inferApp = (text) => {
  let best = "Unknown", bestN = 0;
  for (const [app, re] of APP_CUES) {
    const n = (text.match(new RegExp(re.source, "gi")) || []).length;
    if (n > bestN) { bestN = n; best = app; }
  }
  return bestN ? best : "Unknown";
};

// ---- classification ----
const catOf = (s) => {
  const t = s.toLowerCase();
  if (/\b(xss|ssrf|csrf|inject|auth|token|secret|leak|vault|brute|encrypt|permission|rls|exposed|unauthenticated)\b/.test(t)) return "security";
  if (/\b(lost|wiped|deleted|data loss|overwrote|clobber|corrupt)\b/.test(t)) return "data-loss";
  if (/\b(crash|throw|exception|undefined is not|null|reference ?error|white ?screen|blank screen)\b/.test(t)) return "crash";
  if (/\b(sync|tombstone|offline|merge|conflict)\b/.test(t)) return "sync";
  if (/\b(race|concurrent|await|promise|timing)\b/.test(t)) return "race";
  if (/\b(sign ?in|login|2fa|totp|recovery code|session)\b/.test(t)) return "auth";
  if (/\b(slow|perf|lag|jank|memory|leak)\b/.test(t)) return "performance";
  if (/\b(layout|overflow|css|dark mode|contrast|mobile|button|modal|z-?index|scroll|cut ?off|clipped|render)\b/.test(t)) return "ui";
  if (/\b(timezone|off-?by|wrong|incorrect|mismatch|parser|calculation|logic)\b/.test(t)) return "logic";
  return "other";
};
const CAT2SEV = { "data-loss": "critical", security: "high", crash: "high", auth: "high", sync: "high", race: "medium", logic: "medium", performance: "low", ui: "low", other: "low" };

const STRONG = /\b(fixed|fix(es|ed)?\b|the bug|root ?cause|was caused by|caused by|turned out|the issue was|the real (cause|problem)|now works|no longer (throws|crash\w*|break\w*|reset\w*)|this fixes|the fix (was|is)|resolved|the culprit|was breaking|added a guard|removed the|silently (fail\w*|drop\w*))\b/i;
const DEFECT = /\b(bug|broken|crash\w*|wrong|incorrect|fail\w*|error|stale|leak\w*|duplicate|overflow|undefined|null|clobber\w*|regression|glitch|off-?by|mismatch|reset\w*|throw\w*|blank|white ?screen|couldn'?t|wasn'?t|didn'?t|isn'?t|not work\w*|doesn'?t)\b/i;
const NARRATION = /^(let me\b|let'?s\b|i'?ll\b|i'?m going|i will\b|i can\b|here'?s (the|my)\b|next[,:\s]|okay[,:\s]|ok[,:\s]|first[,:\s]|now\b|then\b|starting\b|reproduce\b|walk the\b|screenshot)/i;
const stripMd = (s) => s
  .replace(/`+/g, "")
  .replace(/\*\*|__|[*_#>~]/g, "")
  .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, "")
  .replace(/\s+/g, " ").trim();
const titleize = (s) => {
  let t = stripMd(s).replace(/^(so |and |but |the |i |i've |also |just )/i, "").trim();
  if (t.length > 90) t = t.slice(0, 88).replace(/\s\S*$/, "") + "…";
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// ---- token dedup ----
const toks = (t) => new Set((t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(w => w.length > 2));
const jacc = (a, b) => { const i = [...a].filter(x => b.has(x)).length; const u = new Set([...a, ...b]).size; return u ? i / u : 0; };

// ---- load state + existing ----
let state = {}; try { state = JSON.parse(fs.readFileSync(STATE, "utf8")); } catch {}
let curated = []; try { curated = JSON.parse(fs.readFileSync(path.join(LEDGER, "bugs.json"), "utf8")); } catch {}
let harvested = []; try { harvested = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}
const known = [...curated, ...harvested].map(b => ({ app: b.app, t: toks(b.title + " " + (b.symptom || "")) }));
const seenKeys = new Set(harvested.map(h => h.key));

const sents = (t) => { t = t.replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " "); return t.split(/(?<=[.!?])\s+|\n/).map(s => s.trim()).filter(Boolean); };

let files = [];
try { files = fs.readdirSync(TX_DIR).filter(f => f.endsWith(".jsonl")); } catch (e) { console.error("no transcripts dir:", TX_DIR); process.exit(0); }

// --baseline: set the watermark to current sizes WITHOUT harvesting, so future runs
// only pick up conversation activity from this point on.
if (flags.has("--baseline")) {
  for (const f of files) { try { state[f] = fs.statSync(path.join(TX_DIR, f)).size; } catch {} }
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  log(`harvest: baseline set for ${files.length} files — future runs harvest only new content.`);
  process.exit(0);
}

const candidates = [];
let bytesRead = 0;
for (const f of files) {
  const fp = path.join(TX_DIR, f);
  let size; try { size = fs.statSync(fp).size; } catch { continue; }
  const prev = (!flags.has("--full") && state[f]) ? state[f] : 0;
  if (size <= prev) { state[f] = size; continue; }
  let buf;
  try { const fd = fs.openSync(fp, "r"); buf = Buffer.alloc(size - prev); fs.readSync(fd, buf, 0, size - prev, prev); fs.closeSync(fd); }
  catch { state[f] = size; continue; }
  bytesRead += buf.length;
  state[f] = size;
  const chunk = buf.toString("utf8");
  const fileApp = inferApp(chunk);
  for (const line of chunk.split("\n")) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type !== "assistant") continue; // fixes are described by the assistant
    const c = o.message?.content; let text = "";
    if (typeof c === "string") text = c;
    else if (Array.isArray(c)) for (const b of c) if (b?.type === "text") text += b.text + " ";
    if (!text || /organization has disabled/i.test(text)) continue;
    // skip meta-conversation ABOUT this tool (prevents the ledger-building sessions from self-harvesting)
    if (/\b(bug ?ledger|bugledger|harvest\.mjs|scan\.mjs|gen\.mjs|bugs\.json|harvested\.json|scan-?findings|security sweep|the curated ledger|auto-?harvest|detector\b)/i.test(text)) continue;
    // message-level gate: the assistant both claims a fix AND names a defect somewhere in the message
    if (!STRONG.test(text) || !DEFECT.test(text)) continue;
    const ss = sents(text).filter(s => s.length >= 25 && s.length <= 260 && !NARRATION.test(stripMd(s)));
    // prefer sentences that name the defect; fall back to the fix sentence
    let picks = ss.filter(s => DEFECT.test(s)).slice(0, 2);
    if (!picks.length) picks = ss.filter(s => STRONG.test(s)).slice(0, 1);
    for (const s of picks) candidates.push({ s, app: fileApp, session: f.slice(0, 8) });
  }
}

// dedupe candidates internally + against known
let added = 0;
const newOnes = [];
const perSession = {};
for (const c of candidates) {
  const key = c.session + ":" + c.s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 60);
  if (seenKeys.has(key)) continue;
  const ct = toks(c.s);
  if ([...ct].length < 5) continue;
  if ((perSession[c.session] || 0) >= 3) continue; // spread across sessions
  const dupKnown = known.some(k => (k.app === c.app || c.app === "Unknown") && jacc(ct, k.t) >= 0.45);
  const dupNew = newOnes.some(n => jacc(ct, n._t) >= 0.5);
  if (dupKnown || dupNew) { seenKeys.add(key); continue; }
  seenKeys.add(key);
  perSession[c.session] = (perSession[c.session] || 0) + 1;
  const category = catOf(c.s);
  const entry = { key, app: c.app, title: titleize(c.s), category, severity: CAT2SEV[category] || "low",
    symptom: c.s.length > 200 ? c.s.slice(0, 199) + "…" : c.s, source: "auto-harvest", status: "unverified",
    session: c.session, found: today };
  entry._t = ct;
  newOnes.push(entry);
  if (newOnes.length >= 30) break; // cap per run
}
for (const n of newOnes) { delete n._t; harvested.push(n); added++; }

fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
fs.writeFileSync(OUT, JSON.stringify(harvested, null, 2));
log(`harvest: read ${(bytesRead/1024).toFixed(0)} KB of new transcript content across ${files.length} files; ${candidates.length} candidate sentences; +${added} new auto-harvested (${harvested.length} total).`);

if (added > 0) {
  try { execSync(`node ${JSON.stringify(path.join(LEDGER, "gen.mjs"))}`, { stdio: QUIET ? "ignore" : "inherit" }); } catch {}
  if (flags.has("--deploy")) {
    try {
      execSync("npx wrangler deploy", { cwd: LEDGER, stdio: QUIET ? "ignore" : "inherit" });
      execSync(`git add -A && git -c user.email=rhemajking@gmail.com -c user.name=Hallalu commit -q -m ${JSON.stringify(`harvest: +${added} auto-harvested bugs (${today})`)} && git push -q origin main`, { cwd: LEDGER, stdio: QUIET ? "ignore" : "inherit" });
      log("deployed + pushed.");
    } catch (e) { console.error("deploy/push failed:", e.message); }
  }
} else {
  log("nothing new — no rebuild/deploy.");
}
