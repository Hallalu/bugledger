# Bug Ledger

An interactive, comprehensive record of **every bug fixed** across the app portfolio
(304 bugs across 14 apps), a **full AI security audit**, a **code scanner** that checks
whatever app you're working on against every known bug class, and an **hourly harvester**
that keeps mining new conversations for fresh bugs.

🔗 **Live:** https://bugledger.coconvo.workers.dev
📋 **Flat checklist:** [CHECKLIST.md](./CHECKLIST.md) · **Detailed:** [BUGS.md](./BUGS.md) · **Raw:** [bugs.json](./bugs.json)
🔒 **Security sweep:** [SECURITY-AUDIT.md](./SECURITY-AUDIT.md) · [security.json](./security.json)
🔎 **Scanner leads:** [SCAN-FINDINGS.md](./SCAN-FINDINGS.md) · [scan-findings.json](./scan-findings.json)
🌱 **Auto-harvested:** [HARVESTED.md](./HARVESTED.md) · [harvested.json](./harvested.json)

Every list on the site filters by **app**, **type**, and **severity** (critical / high / medium / low)
— the severity filter applies to the bugs, the security findings, and the scanner leads at once.

## The four layers

1. **Fixed-bug ledger** — 304 distinct bugs mined from the full session history, grouped by app,
   each with symptom → cause → fix and a derived severity. Interactive: filter by app/type/severity,
   full-text search, tick to re-verify (saved in your browser), per-app progress bars, print/export.
2. **Security sweep** — the full AI security audit of Budget LevelUp / Listing Lab
   (1 critical, 3 high, 4 medium, 7 low + verified-clean checks), severity-ranked with fix + status.
3. **Scanner** — `scan.mjs` statically checks *any* app's source for regressions of the known bug
   classes, prints its full manual checklist + the whole known-bug catalog, and (with `--write`)
   records new leads.
4. **Harvester** — `harvest.mjs` incrementally mines the local Claude transcripts every hour for
   newly-described bug fixes and appends the unverified ones to a separate "auto-harvested" tier.

## Scanner — check the app you're working on

```bash
# from inside any app repo:
node ~/BugLedger/scan.mjs                       # dry-run report for the current dir
node ~/BugLedger/scan.mjs /path/to/app          # scan a specific app
node ~/BugLedger/scan.mjs . --app "Finished."   # force the app name (else auto-detected)
node ~/BugLedger/scan.mjs . --write             # append new leads to the ledger + rebuild
node ~/BugLedger/scan.mjs . --write --deploy    # …then wrangler deploy + git push the ledger
node ~/BugLedger/scan.mjs . --json              # machine-readable output
```

Every run prints:
- **Auto-detected findings** (file:line + which known bug class + how to fix) — the detectors run on *any* project,
- the **full manual checklist** of every known bug for that app (things static analysis can't catch — visual/layout/sync semantics),
- **cross-app recurring classes** that bit multiple apps, and
- for a new/unknown project (or with `--catalog`), the **entire known-bug catalog** — all 304 bugs + 15 security findings — so a brand-new project is checked against everything.

It reads files only — it never runs the app. Treat findings as leads to verify, not proof.

## Harvester — keep the ledger current automatically

`harvest.mjs` mines the local Claude transcripts for newly-described bug fixes and appends the
unverified ones to `harvested.json` (a separate tier — the curated `bugs.json` is never touched).
It's incremental: a saved byte-offset per transcript means each run only reads what was appended
since last time.

```bash
node harvest.mjs                # scan new transcript content, update the auto-harvested tier
node harvest.mjs --deploy       # …and redeploy + push only if something new was found
node harvest.mjs --baseline     # set the watermark to "now" without harvesting
node harvest.mjs --full         # re-scan every transcript from the start
```

**Scheduled hourly** via a launchd agent (`~/Library/LaunchAgents/com.hallalu.bugledger-harvest.plist`
→ `harvest-cron.sh` → `harvest.mjs --deploy --quiet`, logging to `harvest.log`). It no-ops when
nothing new is found, so it only commits/deploys on real changes, and it skips meta-conversation
about the ledger itself. Manage it with:

```bash
launchctl bootout gui/$(id -u)/com.hallalu.bugledger-harvest    # stop
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.hallalu.bugledger-harvest.plist  # start
```

### What it detects (13 detectors, mapped to real past bugs)
`XSS-INNERHTML` (interpolated HTML sinks) · `ESC-QUOTES` (esc() that misses `"`/`'`) ·
`SECRET` (committed keys) · `PBKDF2-WEAK` (<600k iterations) · `STATIC-SALT` ·
`SSRF-GOTO` (unvalidated page.goto/fetch) · `NATIVE-DIALOG` (prompt/alert) ·
`DATE-TOISO` (timezone off-by-one) · `ARGUMENTS-CALLEE` · `FIND-DEREF` (deref of a maybe-undefined
find/match) · `SW-CACHE-FIRST` (stale-build service worker) · `DUP-DOM-ID` · `NO-CSP`.
On the Budget/Listing-Lab monorepo it independently re-discovers the audit's SSRF (M1) and weak-PBKDF2 (M3).

## Rebuild the site data

`public/data.js`, `public/data-sec.js`, `public/data-scan.js`, `BUGS.md`, `CHECKLIST.md` and
`SCAN-FINDINGS.md` are all generated from `bugs.json` + `security.json` + `scan-findings.json`:

```bash
node gen.mjs
```

## Apps covered

| App | Bugs fixed | | App | Bugs fixed |
|---|---|---|---|---|
| Finished. | 135 | | Prompt Vault | 8 |
| Hallalu CRM | 34 | | Hello Baby | 7 |
| Stitchhooky | 33 | | Wedding Planner | 6 |
| Hopefil | 22 | | Listing Lab Pro / Ever After / Breadcrumb | 5 each |
| Budget LevelUp | 13 | | Social LevelUp | 4 |
| Planner Studio | 11 | | | |

## How the ledger was built

1. Parsed all 36 session transcripts (~390 MB of JSONL).
2. Extracted ~2,460 bug/fix candidate sentences with a keyword pass.
3. Distilled them into distinct, deduplicated, app-attributed entries (6 parallel passes).
4. Merged into `bugs.json` and rendered as this interactive checklist.

## Deploy

```bash
npx wrangler deploy   # publish to Cloudflare Workers (bugledger.coconvo.workers.dev)
```
Static assets live in `public/`; the worker is assets-only (no backend, no D1).
