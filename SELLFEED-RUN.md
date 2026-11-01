# Sell feed run — turn each new verified fact or owner brief into a content pack (drafts only)

Run this daily (or say "run the sell feed"). Breadledger: https://breadledger.coconvo.workers.dev — scans your app, fixes
the safe things for you, explains the rest in plain words with pictures, and tells you which law a problem may break and
the most it can cost. DRAFTS ONLY: never post, publish, email or send anything; the owner posts.

1. `node ~/BugLedger/sellfeed.mjs list --status new --json` — none → say so and stop. At most 8 items a run, oldest first.
2. Read `~/.claude/skills/sell/SKILL.md` and `references/sell-playbook.md` §1–4 (hooks, story formats, claim rules).
3. Per item, write the pack (markdown): 5 hook lines · LinkedIn post (120–220 words) · X post (<270 chars) + 4-post
   thread · Threads/Instagram caption · newsletter paragraph · one picture idea (warm 3D-animated, soft cinematic; never
   name a film studio or brand; "No text, no logos, no watermarks"). Tie the fact to what Breadledger does; close with
   "Scan your app today, secure your future." and the link.
   - Claim rules: only the item's fact + angle. Unverified → "X reports…" with the source named. Fines are maximums
     ("up to …"); never say a person or company was charged unless the fact names a firm that was fined. No invented
     customers, results, testimonials or numbers. Source link at the end of every piece. Never mention the backend,
     hosting, AI models or providers.
   - kind "brief" = the owner's own idea: make it as given (script/shot list, caption, picture/video prompts), keep their
     words, only fix untrue claims and note the fix.
4. No video (paid). At most one still per item, only if `node ~/.pixelbake/pxb.mjs days 1` shows today's cost under $0.05
   and `pxb whoami` is @rhe: `pxb gen "…" --for "Breadledger sell feed: <id>" --project "BugLedger" --out
   ~/BugLedger/.bake/sell-feed/<date>/<id>.png`; open it at full size, reject wrong anatomy, text or a box. Else keep the prompt.
5. File: write `~/BugLedger/.bake/sell-feed/<YYYY-MM-DD>/<id>.md` → `node ~/.claude/joy-cloud/upload.mjs "Breadledger/Sell
   feed <YYYY-MM-DD>" <file> [png]` → `node ~/.aprizely/apz.mjs doc <file> --app "BugLedger" --kind notes --title "Sell pack —
   <first 60 chars of the fact>"` → `node ~/BugLedger/sellfeed.mjs done <id> --pack <file> --link <link>`.
6. Summary in plain words: packs made, the best hook from each, anything skipped and why, the Joy Cloud folder.
