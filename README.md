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

## Use it from any project — the agent API

Any Claude Code agent (in any repo) can debug + security-check its project against the whole ledger and
**log that it did so**.

**Easiest:** run the global slash command in the project — `/bugcheck Hallalu CRM` (the app name is
optional; it's inferred otherwise). The command (`~/.claude/commands/bugcheck.md`) pulls the app's
checklist, checks each known bug + recurring class + security detector against the real code, fixes or
reports, then posts a check-log.

**Under the hood** (also usable by hand / other agents — see `/AGENT.md`):

| Purpose | Endpoint |
|---|---|
| Agent protocol (what to do) | `GET /AGENT.md` · `GET /llms.txt` |
| Per-app checklist + recurring + detectors + security | `GET /checklist.json` |
| Every bug, full detail | `GET /bugs.json` · `GET /security.json` |
| Record a check | `POST /api/checks` (header `x-ledger-key`) |
| Recent checks | `GET /api/checks?app=` |

```bash
# fetch what to check, scan the code, and log the pass:
node ~/BugLedger/scan.mjs . --app "Hallalu CRM" --catalog --log
```
Check-logs are stored in D1 (`bugledger-checks`) and render on the site's **✅ Agent check-log** panel.
The write token + base URL live in `~/.bugledger.json` (machine-local); the worker holds the matching
`LEDGER_WRITE_TOKEN` secret so random callers can't write.

## Show your work live — the `/live` board

Any agent can stream what it's doing, in parallel with the work, to a beautiful live board the user
watches at **[bugledger.coconvo.workers.dev/live](https://bugledger.coconvo.workers.dev/live)** — a bold
"doing now" line and tasks ticking off in real time (aurora-glass, polls ~1.5s). A pulsing "● live"
banner also appears on the main ledger while a session is active.

Say **"show your work in bugledger"** in any project, or run the `/showwork` command. Under the hood it's
the `worklog.mjs` helper:
```bash
node ~/BugLedger/worklog.mjs start --app "Aprizely" --project aprizely \
     --title "Fix the unlock keypad" --tasks "Center numbers|Tuck letters|Rename button|Verify"
node ~/BugLedger/worklog.mjs step 0 --current "centering each digit in .key"   # earlier→done, this→active
node ~/BugLedger/worklog.mjs done 0
node ~/BugLedger/worklog.mjs finish
```
Each call POSTs to `/api/session` (D1 `sessions` table, token-gated). `GET /api/sessions?active=1` powers
the board. Per-repo state lives in `./.worklog.json`.

## Optimisers — elevations worth reusing

Beyond bugs and security, the ledger collects **optimisers**: reusable *elevations* — design polish, UX,
performance, and workflow patterns — mined from the whole build history (not fixes; things that made an
app **better**). Browse them in the **✨ Optimisers** panel, grouped by category
(`design-elevation`, `ux`, `performance`, `workflow`, `architecture`, `accessibility`, `copy`,
`conversion`, `dx`, `integrity`). Source: [optimisers.json](./optimisers.json) · [OPTIMISERS.md](./OPTIMISERS.md).
Each entry is a principle with *what / why / how* (e.g. "One-shot entrance animations (never re-animate on
refresh)", "Aurora-glass design language", "Paste-and-go, zero-question agent prompts").

## Full-coverage confirmation

`/bugcheck [App]` runs a complete security + bug scan and proves it. `POST /api/checks` returns
**server-verified coverage** — the worker matches the agent's `notFound`+`found` titles against the app
catalog and returns `{total, matched, pct, complete, missed[]}`. The check-log panel shows a
**✓ full coverage N/N** badge (or **⚠ N/M** with the exact bugs not addressed), so "it checked all of
them" is verified, not claimed. New bugs an agent discovers go to **`POST /api/bugs`** (append-only) and
appear in the **🧫 Agent-submitted** panel as proposals to promote. Mechanical `scan.mjs` logs are
labelled **🔍 detector scan** (not a full-coverage claim).

## Daily routine — the ledger compounds every day

Two scheduled jobs keep it growing on its own:
- **Hourly** (`com.hallalu.bugledger-harvest`) — incremental heuristic harvest of new conversation
  content for bugs (append-only, auto-deploy when something's new).
- **Twice daily at 00:05 (midnight) and 05:30 (dawn)** (`com.hallalu.bugledger-daily` → `daily-cron.sh`) —
  runs the harvest, and optionally a **deep AI pass** (`/dailyledger`) that reads the day's conversations
  in full, deep-researches common new AI bugs / security / design patterns, and appends across **all
  aspects** (bugs, security, optimisers). The deep pass is **opt-in**: `touch ~/.bugledger-auto-daily`
  (needs the `claude` CLI) to run it headless, otherwise run **`/dailyledger`** yourself at day's edges.

Manage: `launchctl bootout|bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.hallalu.bugledger-daily.plist`.

## Sweep reports — evidence, charts, comparisons

Every sweep produces a **beautiful interactive report** at `/report?id=<checkId>` — auto-generated from
the check-log, no agent work needed. It shows a coverage donut, KPI tiles (checked / present / fixed /
added-to-ledger / clean / coverage%), the findings with `file:line` and a **✓ fixed** marker, a
severity/category bar chart, a **comparison to the last sweep** (resolved vs new, with a trend line so
you watch it improve each day), and an **"added to the ledger"** section listing the new bugs/security
issues this sweep appended (permanent, append-only — every future project is then checked for them too).

You reach it three ways: a **📊 Full report →** link on each timeline card and each check-log row, and a
pulsing **"open the full report →"** button on the live board the moment a sweep completes. A deep scan
posts two check-logs (bugs + security), so you get **one report card per sweep**.

## Integrity — the ledger is append-only

Agents can **add** to the ledger but never modify or delete it:

- The API exposes **no delete or edit endpoint** — only `POST /api/checks` (append a check-log) and
  `POST /api/session` (create/advance a live session).
- **Check-logs are immutable at the database level** — SQLite triggers reject any `UPDATE`/`DELETE` on
  the `checks` table (even a direct admin query is refused).
- **Sessions can't be deleted**, a **finished session is frozen**, and its identity fields
  (app/project/title) are locked after creation — only live progress advances.
- **Bugs, security findings, and harvested data are static files** (`bugs.json`, `security.json`,
  `harvested.json`) with **no API write path** — an agent cannot reach them.
- The `/bugcheck` and `/showwork` commands instruct agents to fix only the *current* project's files and
  never run `--write`/`--deploy`/`git`/`wrangler` against `~/BugLedger`.

Owner escape hatch (you, not agents): to prune the audit log, drop the triggers in `triggers.sql`, edit,
then re-apply them.

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
