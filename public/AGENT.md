# Bug Ledger — Agent Protocol

You are a coding agent working inside a project. This ledger is your regression + security
memory: **428 bugs across 24 apps**, a security audit (15 findings),
and 47 static detectors. Use it to debug the current project against every bug we've
hit before, then **log what you checked** so there's a record.

Base URL: `https://bugledger.coconvo.workers.dev`

## Integrity — you can ADD, never delete or modify
The ledger is append-only. You may append a check-log (`POST /api/checks`), stream live progress
(`POST /api/session`) and narrate the scan story (`POST /api/session/event`). There is **no** endpoint to edit or delete bugs, check-logs, or code — check-logs
are immutable at the database level and finished sessions are frozen. Never run `--write`, `--deploy`,
`git`, or `wrangler` against `~/BugLedger`; fix bugs in the CURRENT project's files only.

## Apps in the ledger
`Finished.` (138) · `cross-cutting` (70) · `Hallalu CRM` (57) · `Stitchhooky` (34) · `Hopefil` (22) · `Breadcrumb` (18) · `Planner Studio` (16) · `Budget LevelUp` (15) · `Prompt Vault` (8) · `Aprizely` (7) · `Hello Baby` (7) · `Ever After` (6) · `Wedding Planner` (6) · `Listing Lab Pro` (5) · `Social LevelUp` (4) · `Bug Ledger` (3) · `Hallalu Bookings` (3) · `Breadcrumb Admin` (1) · `Breadcrumb Plan` (1) · `Bug Ledger Pitch` (1) · `Coco Modules` (1) · `Currency Picker` (1) · `Happy Travel` (1) · `Kairos` (1) · `Kindly` (1) · `Unknown` (1)

## Step 1 — Get the checklist for this project's app
Pick the app name (ask the user, or infer from the repo). Then either:

- **Preferred (local, also scans code):**
  ```bash
  node ~/BugLedger/scan.mjs . --app "APP NAME" --catalog --json
  ```
  This prints auto-detected findings (file:line), the app's full known-bug checklist, the
  cross-app recurring classes, and the entire catalog. If the repo isn't at ~/BugLedger, clone
  https://github.com/Hallalu/bugledger first.
- **Or fetch the data over HTTP:**
  ```bash
  curl -s https://bugledger.coconvo.workers.dev/checklist.json     # per-app bugs + recurring + detectors + security
  curl -s https://bugledger.coconvo.workers.dev/bugs.json          # every bug, full detail
  ```
  Use `.apps["APP NAME"]` for that app's bugs; always also check `.recurring` and `.detectors`.

## Step 2 — Actually check each item against the code
For every known bug for that app (and every recurring class + detector), look at the real code and
decide: **present**, **not present**, or **n/a**. Don't guess — grep/read the relevant files. Fix any
you find (or report them). Track two lists: `notFound` (checked & clean) and `found` ({title,file,note}).

For security, run the detectors (the scanner does most automatically) and note `securityChecked`
(what you looked for) and `securityFindings` ({severity,title,file}). Set `securityStatus` to
"clean" or "issues".

## Step 3 — Log that you checked (this is the record the user asked for)
POST a summary so the ledger records this pass. Read the token from `~/.bugledger.json`:
```bash
KEY=$(node -e "console.log(require(process.env.HOME+'/.bugledger.json').token)")
curl -s -X POST https://bugledger.coconvo.workers.dev/api/checks \
  -H "content-type: application/json" -H "x-ledger-key: $KEY" \
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
```
Or, to log the scanner's own findings automatically: `node ~/BugLedger/scan.mjs . --app "Hallalu CRM" --log`.

## Narrate the scan story (the report the user reads)
Every sweep has a **story** at `/story/<session id>` — the agent's own account, itemised: numbered findings
with 🟣 critical · 🔴 high · 🟠 medium · 🟡 low tags (text + icon, never colour alone), 🔵 fixed / open /
needs-your-call / false-alarm status, plain-English *what was wrong · why it matters · what was done*, the
file:line, the evidence (detector / code-read / test), before → after metrics with % improvement, a comparison
to the previous scan of the same app, honest caveats, and a verdict. Append-only: `POST /api/session/event`.
```bash
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
```
Raw API: `POST /api/session/event` `{sessionId, events:[{kind:"found", severity, status, category, title, detail, impact, fix, file, verifiedBy, confidence}]}`
(kinds: phase · say · found · fixed · clean · metric · verdict · caveat · note). Read it back: `GET /api/story?id=<session>`.
Attach coverage and additions to the story by sending `"sessionId"` on `POST /api/checks` and `POST /api/bugs`.
`scan.mjs . --story` itemises the automated pass's high-confidence hits automatically — then resolve each one after reading the code: `worklog.mjs fixed "<its title>" --status fixed|false-positive|needs-call --fix "…"`.

## Show your work live (optional but nice)
While you do all of the above, you can stream progress to a live board the user watches at
`https://bugledger.coconvo.workers.dev/live`:
```bash
node ~/BugLedger/worklog.mjs start --app "APP" --project "$(basename "$PWD")" --title "Checking APP vs the ledger" --tasks "Pull checklist|Check each bug|Run detectors|Log the pass"
node ~/BugLedger/worklog.mjs step 1 --current "checking the localStorage scoping"
node ~/BugLedger/worklog.mjs done 1
node ~/BugLedger/worklog.mjs finish
```
Each call posts to `POST /api/session`; the board polls every ~1.5s and ticks tasks off as you go.

## Coverage is server-verified
The `POST /api/checks` response includes `coverage: {total, matched, pct, complete, missed[]}` — the
worker matches your `notFound`+`found` titles against the app's catalog. If `complete` is false, the
`missed` array names the exact bugs you didn't address; check those and re-post until it's true. New
bugs you find go to `POST /api/bugs` (append-only). To scan against **every bug across ALL apps**
(the whole catalog, e.g. 315/315), send `"scope":"all"`; for a **full security sweep** across all apps'
security items, send `"scope":"security"`. Coverage is computed against that catalog. Stream a live
`N/total` counter with `worklog.mjs progress <done> <total>`.

## Step 4 — Tell the user
Summarise: which bugs you checked and did NOT find (clean), which you found (and fixed), the
security status, and confirm the log was posted (the response includes an `id`). The log shows up
on the site's **Check-log** panel and at GET /api/checks.
