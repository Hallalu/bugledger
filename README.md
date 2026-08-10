# Bug Ledger

An interactive, comprehensive checklist of **every bug fixed** across the app portfolio (289 bugs across 14 apps), mined from the complete conversation history.

🔗 **Live:** https://bugledger.coconvo.workers.dev  
📋 **Flat checklist:** [BUGS.md](./BUGS.md)  
🗃 **Raw data:** [bugs.json](./bugs.json)

## What's inside

- **Interactive checklist** — tick bugs as you re-verify them; progress saved in your browser (localStorage).
- **Filter & search** — by app, by category, full-text across title/symptom/cause/fix.
- **Per-app progress bars** and portfolio-wide re-verification progress.
- **Print / export** friendly.

## Apps covered

| App | Bugs fixed |
|---|---|
| Finished. | 135 |
| Hallalu CRM | 34 |
| Stitchhooky | 33 |
| Hopefil | 22 |
| Budget LevelUp | 13 |
| Planner Studio | 11 |
| Prompt Vault | 8 |
| Hello Baby | 7 |
| Wedding Planner | 6 |
| Breadcrumb | 5 |
| Ever After | 5 |
| Listing Lab Pro | 5 |
| Social LevelUp | 4 |
| Unknown | 1 |

## How the ledger was built

1. Parsed all 36 session transcripts (~390 MB of JSONL).
2. Extracted ~2,460 bug/fix candidate sentences with a keyword pass.
3. Distilled them into distinct, deduplicated, app-attributed bug entries.
4. Merged into [bugs.json](./bugs.json) and rendered as this interactive checklist.

## Develop / deploy

```bash
npx wrangler dev      # local preview
npx wrangler deploy   # publish to Cloudflare Workers
```
Static assets live in `public/`; bug data is `public/data.js` (generated from `bugs.json`).
