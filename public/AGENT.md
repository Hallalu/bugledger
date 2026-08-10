# Bug Ledger — Agent Protocol

You are a coding agent working inside a project. This ledger is your regression + security
memory: **315 bugs across 16 apps**, a security audit (15 findings),
and 14 static detectors. Use it to debug the current project against every bug we've
hit before, then **log what you checked** so there's a record.

Base URL: `https://bugledger.coconvo.workers.dev`

## Apps in the ledger
`Finished.` (138) · `Hallalu CRM` (48) · `Stitchhooky` (33) · `Hopefil` (22) · `Budget LevelUp` (13) · `Breadcrumb` (12) · `Planner Studio` (11) · `Prompt Vault` (8) · `Hello Baby` (7) · `Wedding Planner` (6) · `Ever After` (5) · `Listing Lab Pro` (5) · `Social LevelUp` (4) · `Aprizely` (1) · `Hallalu Bookings` (1) · `Unknown` (1)

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

## Step 4 — Tell the user
Summarise: which bugs you checked and did NOT find (clean), which you found (and fixed), the
security status, and confirm the log was posted (the response includes an `id`). The log shows up
on the site's **Check-log** panel and at GET /api/checks.
