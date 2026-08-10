# 🐞 Bug Ledger — Master Checklist

**289 bugs fixed** across **14 apps**, mined from the full AI-assisted build history. Live: **https://bugledger.coconvo.workers.dev**

| Metric | Count |
|---|---|
| Total bugs fixed | 289 |
| Apps | 14 |
| Security fixes | 26 |
| Data-loss / sync fixes | 25 |
| Crashes fixed | 21 |
| Security-audit findings | 15 (9 open) |

### By category

`ui: 107` `logic: 68` `security: 26` `crash: 21` `data-loss: 17` `other: 17` `auth: 10` `race: 9` `sync: 8` `perf: 6`

---

## 🔒 Security Sweep — Budget LevelUp / Listing Lab — Full AI Security Audit

_Source-read audit (no live exploitation). Scope: budget-levelup worker + public/*.js and listing-lab worker + public/app.js._  ·  Full report: [SECURITY-AUDIT.md](./SECURITY-AUDIT.md)

- [ ] **C1 · Cloud vault brute-forceable — ciphertext fetchable by public handle, protected only by a 6-digit PIN** `critical` · _fixed_ · Budget LevelUp
  vaultId = SHA-256("blu-vault:"+handle) is derived from the public handle, and /api/backup GET serves the ciphertext to any unauthenticated caller. The only secret left is a 20-bit PIN, exhaustible offline in ~1 minute.
  <br>*Fix:* Vault id is now SHA-256(handle+":"+randomToken); dual-read migrates legacy accounts with zero lockout; optional passphrase raises KDF entropy; 2FA mandatory for new accounts; writes/deletes carry a proof-of-possession token.
- [ ] **H1 · Anyone can overwrite or delete any user's cloud vault (no proof-of-possession)** `high` · _fixed_ · Budget LevelUp
  /api/backup POST/DELETE validate only the 64-hex id shape. Since the id derives from the public handle, a stranger can DELETE a victim's backup or POST garbage, locking them out with a misleading 'wrong PIN'.
  <br>*Fix:* Mutations now require the retrieval-secret / proof-of-possession token introduced in C1.
- [ ] **H2 · Stored XSS via shared 'study' link — esc() does not escape quotes** `high` · _fixed_ · Listing Lab Pro
  esc() escaped only & < > (not " or '), yet was used inside double-quoted src/href attributes fed by a stored ?study= blob. A crafted thumb value closes the attribute and auto-fires onerror, no click needed.
  <br>*Fix:* esc() now escapes " and '; image/link sinks go through safeImg()/safeHref() so a shared link cannot inject onerror or a javascript: href.
- [ ] **H3 · Unauthenticated, unthrottled access to billable compute (Browser Rendering + Workers AI + Google Translate)** `high` · _partial_ · Listing Lab Pro
  /api/translate (owner's paid Google key), /api/open (billable browser sessions, 12 URLs/req), /api/analyze (~5+ LLM gens), /api/vision (70B model) had no auth, origin check, Turnstile, or rate limit — a direct financial-DoS / open-proxy surface.
  <br>*Fix:* Per-IP rate limits added (open 6/min, analyze 10/min, lookup 20/min, backup 40/5min). Turnstile/auth-gating still recommended for full coverage.
- [ ] **M1 · SSRF / open proxy in /api/open and /api/fetch (no host allowlist)** `medium` · _fixed_ · Listing Lab Pro
  /api/open passed user URLs straight into page.goto() and returned text + screenshot; /api/fetch checked https only on the initial URL then followed redirects, so an https→internal 302 slipped past. Full render-and-exfiltrate primitive laundered through the origin.
  <br>*Fix:* Both endpoints enforce a marketplace host allowlist; /api/fetch uses redirect:'manual' so a redirect can't smuggle past the scheme check.
- [ ] **M2 · Fixed global KDF salt (all users share one salt)** `medium` · _open_ · Budget LevelUp
  salt is a compile-time constant identical for every user, allowing precomputed PIN→key tables for a known handle; violates per-record-salt rule and compounds C1.
  <br>*Fix:* Recommended: generate a random 16-byte salt at account creation, store alongside the vault, feed to PBKDF2.
- [ ] **M3 · PBKDF2 iteration count below 2026 guidance** `medium` · _open_ · Budget LevelUp
  OWASP 2024+ guidance for PBKDF2-HMAC-SHA256 is ~600k. Auth path uses 250k, sync path 100k. Hardening item; the real fix for the auth path is C1's retrieval-secret, not more rounds.
  <br>*Fix:* Recommended: raise to >=600k as defense-in-depth.
- [ ] **M4 · Two apps share one KV namespace** `medium` · _open_ · Budget LevelUp
  Budget vault backups, revocation list and Stripe session codes share a namespace with Listing Lab studies. Prefixes isolate them today, but a future key-handling bug in either worker puts the other app's data (incl. encrypted vaults) in blast radius.
  <br>*Fix:* Recommended: give Listing Lab its own KV namespace.
- [ ] **L1 · Notes editor is a self-XSS sink (per-user only)** `low` · _open_ · Budget LevelUp
  Stores ed.innerHTML and re-injects it raw into a contenteditable; crafted markup executes, but only in the same user's own session (notes live in that user's vault).
  <br>*Fix:* Optional: sanitize on save or strip event handlers/<script> on load.
- [ ] **L2 · TOTP is UI-only, not a cryptographic factor; compare is not constant-time** `low` · _open_ · Budget LevelUp
  The vault decrypts from the PIN alone, so an attacker with ciphertext+PIN never invokes the TOTP gate — 2FA adds no cryptographic protection to the data. Compare uses === (not constant-time; not remotely exploitable here).
  <br>*Fix:* Recommended: mix the TOTP secret into key derivation, or present 2FA honestly as a UI lock only.
- [ ] **L3 · Recovery kit writes the PIN to disk in plaintext** `low` · _accepted_ · Budget LevelUp
  Recovery kit download contains handle + PIN in cleartext — a 20-bit secret left in Downloads. Deliberate UX tradeoff (no reset possible).
  <br>*Fix:* Recommended: add a one-line in-product warning.
- [ ] **L4 · Decrypted profile lingers in memory after a profile switch** `low` · _open_ · Budget LevelUp
  _pendingProfile holds the full decrypted profile during 2FA and is never cleared; after switching accounts, profile A's plaintext can remain referenced. Not persisted or rendered elsewhere.
  <br>*Fix:* Recommended: clear it after openProfile.
- [ ] **L5 · Guest plaintext store not cleared when creating an account without 'bring my data'** `low` · _open_ · Budget LevelUp
  createAccount only removes the guest key when bringGuestData is true; decline it and the guest budget stays in localStorage in cleartext for the next person on a shared device.
  <br>*Fix:* Recommended: offer to wipe guest data on first real sign-in.
- [ ] **L6 · Unlock codes are 64-bit-tag bearer tokens with no expiry** `low` · _open_ · Budget LevelUp
  mintCode appends only the first 8 HMAC bytes; verifyCode never checks the embedded issue-day for expiry; /api/redeem has no rate limit. Online forgery infeasible at 2^64 — a licensing weakness (codes share infinitely) rather than a break.
  <br>*Fix:* Recommended: bind a code to a device/account on first redeem.
- [ ] **L7 · Dead code webapp/public/app.js with weaker save()/esc()** `low` · _open_ · Budget LevelUp
  Not referenced by index.html; defines a weaker save() that writes state to the plaintext guest key unconditionally and a duplicate esc(). Harmless while unloaded, a footgun if wired up later.
  <br>*Fix:* Recommended: delete it or fold it in.

---

## Finished.  ·  135 fixed

- [ ] **Anon could enumerate every user's media files** `security`
  *Symptom:* A signed-out user could list('') the media bucket and enumerate all users' folders and files.  <br>*Cause:* The storage SELECT policy allowed anon to list the whole bucket.  <br>*Fix:* Migration lock_media_bucket_select_to_own_folder scoped SELECT to authenticated users and their own folder; verified playback still works.
- [ ] **Could not post multiple / photo stories** `security`
  *Symptom:* Posting more than one story (specifically photo stories) failed with 'new row violates row-level security policy'.  <br>*Cause:* A storage RLS issue on the media bucket blocked the upsert for photo stories (text-only worked).  <br>*Fix:* Added an additive own-folder UPDATE policy on storage so photo/multi stories post.
- [ ] **Cross-account local data leak on shared device** `security`
  *Symptom:* Signing into a second account on the same device exposed the first account's countdowns, notes, trackers and voice notes.  <br>*Cause:* Local content was stored device-globally with no per-account scoping; the reset flow leaked the same way.  <br>*Fix:* Added accountScope.ts to stamp finished.owner-uid on sign-in, wipe on switch, and made push/pull re-check ownership so a race can't cross accounts; cleaned the leaked rows.
- [ ] **Cross-user data leak on account switch** `security`
  *Symptom:* After switching accounts locally, a user saw another user's celebration countdowns.  <br>*Cause:* signOut() did not wipe local user data and account-switch left stale React state.  <br>*Fix:* Sign-out now wipes all local user content and Switch account hard-reloads; committed as a P0 fix.
- [ ] **Dangerous RPCs callable from client** `security`
  *Symptom:* Privileged operations read_vault_secret and add_credits were reachable from the client.  <br>*Cause:* Sensitive server functions were exposed to the client surface.  <br>*Fix:* Removed them so read_vault_secret and add_credits no longer appear/are callable.
- [ ] **Database SECURITY DEFINER / search_path hardening** `security`
  *Symptom:* SECURITY DEFINER views bypassed RLS and could re-leak protected tables, and functions had mutable search_path; some policies trusted user-editable user_metadata.  <br>*Cause:* Advisor lints 0010 (definer views) and 0015 (user_metadata policies) plus mutable search_path across functions.  <br>*Fix:* Locked down the SECURITY DEFINER surface, fixed the mutable search_path across functions, and stopped trusting user_metadata.
- [ ] **Deleting posts/stories orphaned uploaded media** `security`
  *Symptom:* Deleting a post or story left its photo/video fetchable by URL forever, and avatar changes orphaned the old file.  <br>*Cause:* deletePost/deleteStory removed only the DB row, not the storage file.  <br>*Fix:* Delete now also removes the associated storage file; verified.
- [ ] **Email column readable via profiles** `security`
  *Symptom:* The profiles table exposed users' email addresses.  <br>*Cause:* No column-level restriction on the profiles select surface.  <br>*Fix:* Applied column-level grants so only id, handle, full_name, avatar_url, bio, plan are readable; selecting email now returns permission denied.
- [ ] **email_for_handle revoke left a silent PUBLIC ACL hole** `security`
  *Symptom:* A Postgres function remained accessible to PUBLIC despite a revoke.  <br>*Cause:* The staged email_for_handle revoke omitted PUBLIC from the ACL.  <br>*Fix:* Revoked PUBLIC live and fixed the staged migration to include PUBLIC.
- [ ] **Missing CSP and security headers** `security`
  *Symptom:* The app shipped with no Content-Security-Policy or security headers.  <br>*Cause:* An inline boot script prevented a strict script-src 'self' policy.  <br>*Fix:* Externalized the boot script to /boot.js and added a strict CSP plus security headers.
- [ ] **Private 'Only me' posts leaked to friends** `security`
  *Symptom:* Posts set to private were visible to friends.  <br>*Cause:* The RLS friends branch checked is_friend regardless of the post's audience.  <br>*Fix:* Tightened the RLS policy so private posts are author-only.
- [ ] **Source files leaked over HTTP** `security`
  *Symptom:* `/package.json`, `/vite.config.ts`, `/src/*` and other repo files were served as real files.  <br>*Cause:* The broken Pages config served the repo root instead of the SPA build.  <br>*Fix:* With the build config fixed, those paths now fall through to the SPA shell (text/html) instead of leaking source.
- [ ] **Stale tab survives account switch and re-uploads data** `security`
  *Symptom:* A second open tab that survived an account switch could re-save and re-upload the previous user's data.  <br>*Cause:* The old tab kept the previous account's in-memory state after the switch.  <br>*Fix:* Closed this cross-account leak path so a surviving tab can't re-upload old data.
- [ ] **Stripe webhook rejected all payments (Verify JWT on)** `security`
  *Symptom:* Billing was dead; every paying customer got no credits or subscription.  <br>*Cause:* stripe-webhook had Verify JWT ON, so Stripe's signature-carrying webhooks were rejected with 401 before reaching the code.  <br>*Fix:* Turned verify_jwt off so the webhook reaches the code and verifies the Stripe signature (verified 401 became 400).
- [ ] **Unauthenticated translate endpoint abuse** `security`
  *Symptom:* Anyone could hammer the pre-login translate endpoint with 640K chars per request, risking runaway cost.  <br>*Cause:* The endpoint ran before login with no rate limit and no size cap.  <br>*Fix:* Added a hard total-chars-per-request cap plus per-IP rate limiting; deployed and verified live.
- [ ] **Deleted celebrations resurrect** `data-loss`
  *Symptom:* Deleted celebrations could reappear after the new sync engine ran.  <br>*Cause:* The new sync engine lacked deletion handling for these records.  <br>*Fix:* Fixed the related sync flaw so deletions persist.
- [ ] **Deleting a recording did not unshare or remove the file** `data-loss`
  *Symptom:* Deleting a recording left the shared row and cloud file fetchable.  <br>*Cause:* deleteRecording only removed the local row.  <br>*Fix:* unshareRecording() now deletes the recordings row and the stored cloud file.
- [ ] **Deletions resurrect in synced IndexedDB stores** `data-loss`
  *Symptom:* Deletions across seven synced IndexedDB stores (docs, flashcards, memos, homework, trackers, snips, book notes) reappeared within ~25 seconds.  <br>*Cause:* Only localStorage stores had tombstones, so IndexedDB deletions were re-pulled from the cloud.  <br>*Fix:* Added tombstones to the IndexedDB stores so deletions stick.
- [ ] **Recording lost on crash or full disk** `data-loss`
  *Symptom:* When the disk filled or the tab crashed/OOMed, the entire recording was lost.  <br>*Cause:* Chunks were held in an in-memory array flushed only at stop time.  <br>*Fix:* Journal each ~1s chunk to IndexedDB as it's captured and assemble on save (crash-proof).
- [ ] **Recordings local-only by default risked loss** `data-loss`
  *Symptom:* A lost device meant lost video because recordings stayed local.  <br>*Cause:* streamCloud defaulted to false, framed as a niche storage-saver.  <br>*Fix:* Cloud streaming now defaults ON when signed in.
- [ ] **Seed calendar has self-overlapping event** `data-loss`
  *Symptom:* A conflict flagged 'Standup overlaps Standup'.  <br>*Cause:* The seed data created a duplicate overlapping event.  <br>*Fix:* Fixed the seed data.
- [ ] **Stale device overwrites newer cloud journal notes** `data-loss`
  *Symptom:* A stale device could silently overwrite newer journal notes in the cloud, and concurrent syncs could interleave.  <br>*Cause:* Re-sync wrote unchanged content back over newer cloud data with no change detection or serialization.  <br>*Fix:* Hash-skip unchanged journals on re-sync (no stale clobber) and guarded concurrent syncs.
- [ ] **Broken main build referencing SignInLoader before it existed** `crash`
  *Symptom:* App.tsx referenced SignInLoader which was never created, leaving main with a broken build.  <br>*Cause:* A concurrent edit committed the reference before the component file existed.  <br>*Fix:* Created the branded sign-in loader component to restore a green build.
- [ ] **Calendar crashes on unrecognised event kind** `crash`
  *Symptom:* Any event kind the calendar did not recognise took down the whole calendar view.  <br>*Cause:* calendar.js indexed KINDS[e.kind].color directly with no guard for unknown kinds.  <br>*Fix:* Guarded the KINDS lookup so unknown event kinds no longer crash the view.
- [ ] **Deployed app stuck on blank/loading screen on Cloudflare** `crash`
  *Symptom:* The Cloudflare-hosted app and custom domain showed only a blank/continuous loading screen; localhost worked.  <br>*Cause:* A stale/poisoned service worker served an old index.html pointing at asset hashes that no longer exist, and sw.js was cacheable so the kill-switch never loaded.  <br>*Fix:* Forced sw.js/index.html to never cache, added a kill-switch SW that self-unregisters, an inline boot-script SW purge, an error boundary, and SPA _redirects.
- [ ] **Library crash on malformed record** `crash`
  *Symptom:* Library.tsx crashed calling .slice on undefined while mapping records missing a title.  <br>*Cause:* A record missing the title field wasn't guarded against.  <br>*Fix:* Added a defensive guard at the crash point to harden Library against malformed records.
- [ ] **PDF cover render hang** `crash`
  *Symptom:* Loading a PDF whose fonts can't render to canvas hung the app on cover generation.  <br>*Cause:* Cover render blocked when embedded fonts couldn't rasterize.  <br>*Fix:* Added useSystemFonts:true plus a cover-render timeout race, falling back to a monogram cover.
- [ ] **Split React import** `crash`
  *Symptom:* A split/duplicated React import broke the build for the new UI bits.  <br>*Cause:* React was imported in two conflicting statements.  <br>*Fix:* Fixed the split React import and added the needed CSS.
- [ ] **Study page missing i18n import** `crash`
  *Symptom:* The Study page failed because a required i18n import was missing.  <br>*Cause:* The i18n module wasn't imported into Study after localization was added.  <br>*Fix:* Added the i18n import and rebuilt.
- [ ] **White screen — app never mounts** `crash`
  *Symptom:* Production showed a white screen (later a stuck splash) because the deployed JS never mounted #root.  <br>*Cause:* The Cloudflare Pages project had no build step (output = repo root), so it served raw source and index.html referenced asset hashes that didn't exist.  <br>*Fix:* Corrected the Pages build config (output dir `dist`) and deployed the real build so the entry module returns 200 application/javascript and the app mounts.
- [ ] **Cannot add posts, photos, stories, or profile photos** `auth`
  *Symptom:* Post/photo/story/profile-photo uploads all failed.  <br>*Cause:* The media storage bucket was missing a scoped read policy (a privacy pass had dropped it), so authenticated reads of new media rows failed.  <br>*Fix:* Applied a migration restoring the `read media rows` policy plus client-side hardening in cloud.ts, fixing production instantly.
- [ ] **Profile can't add photos or posts** `auth`
  *Symptom:* Users couldn't add new profile photos or posts.  <br>*Cause:* Writes reached Supabase as anon due to a stale/invalid client session, so correct RLS blocked avatar upload, post insert, and profile update.  <br>*Fix:* Hardened isAuthError/throwIfError to recognize storage auth failures so a bad session is refreshed-and-retried, then sent to re-sign-in.
- [ ] **Signed-in users saw 'Sign in' and no credits after reload** `auth`
  *Symptom:* Returning users (page reload with an existing session) saw 'Sign in' and dashes instead of their name and credit balance.  <br>*Cause:* getProfile/ensureProfile/me()/myPlan/listInvoices used getUser() (a network call that returns null on a hiccup).  <br>*Fix:* Switched to getSession() (local + auto-refresh) and made the menu re-fetch on open.
- [ ] **Signup blocked by email confirmation** `auth`
  *Symptom:* Signup was completely blocked, requiring email confirmation that often failed.  <br>*Cause:* Account creation depended on Supabase email-confirmation which was gated by a dashboard toggle.  <br>*Fix:* Added an edge function that creates confirmed accounts server-side and routed client signup through it, plus live handle-availability checks.
- [ ] **Signup email rate-limit trap** `auth`
  *Symptom:* Signup failed with "Email rate limit exceeded" after a user corrected a mistyped email and retried.  <br>*Cause:* Supabase's built-in mailer cap (~2 confirmation emails/hour) was hit by the retry.  <br>*Fix:* Shipped fixes so the signup flow no longer trips the confirmation-email cap.
- [ ] **Social actions silently fail on a lapsed token** `auth`
  *Symptom:* Stories, profile photo, adding posts and follow/unfollow appeared not to work with no error.  <br>*Cause:* Client errors were swallowed and follow/unfollow failed silently when the auth token had lapsed.  <br>*Fix:* Routed writes through `authedWrite` (refresh-and-retry) and surfaced errors, with an optimistic follow toggle and live count refresh.
- [ ] **Stale auth session causes RLS write failures** `auth`
  *Symptom:* Posting failed with "new row violates row-level security policy" and profile-photo updates silently didn't work.  <br>*Cause:* A broken/expired client auth session sent writes to Supabase as anon, which correct RLS then blocked (avatar upload, post insert, profile update).  <br>*Fix:* Made me() proactively refresh the token, persist+auto-refresh the session, refresh-before-write, retry once, and re-prompt sign-in instead of showing a raw DB error.
- [ ] **Celebrations don't sync across devices** `sync`
  *Symptom:* Celebrations added on one device didn't appear on the same account on another device.  <br>*Cause:* Countdowns/celebrations were localStorage-only (finished.countdowns) and never pushed to the cloud.  <br>*Fix:* Synced them to the user_data cloud table like notes/trackers.
- [ ] **Home tools grid needs a reload to show Calendar/Bookings/Task Manager** `sync`
  *Symptom:* Users had to reload the whole app before Calendar, Bookings and Task Manager appeared in the tools grid.  <br>*Cause:* The home 'Tools' grid seeded once from localStorage, and cloud sync rewrote the tiles list but fired the wrong event, so the grid never refreshed.  <br>*Fix:* Re-read the tiles after a cloud sync (on the correct event) so tiles appear without a reload.
- [ ] **Sync pulls truncated at 1,000 rows** `sync`
  *Symptom:* Cloud pulls were capped at 1,000 rows, dropping data beyond that.  <br>*Cause:* The pull query hit the default 1,000-row limit without pagination.  <br>*Fix:* Fixed the sync engine so pulls aren't truncated at 1,000 rows.
- [ ] **Camera stayed on after closing the recorder** `race`
  *Symptom:* The device camera remained active after the user exited the journal recorder.  <br>*Cause:* A classic async race left the media stream running on exit.  <br>*Fix:* Added a cancelled flag, nulled srcObject, and stopped the recorder on exit.
- [ ] **Loading splash kept randomly reappearing** `race`
  *Symptom:* After adding the splash, the loading splash kept popping up randomly.  <br>*Cause:* main.tsx re-registered the service worker on every load and the kill-switch SW called client.navigate() on activate, creating a re-register/re-activate/reload loop; also a timer-vs-network reload race.  <br>*Fix:* Stopped the SW reload loop so the boot script only recovers on genuine breakage (stale SW controls page → one reload).
- [ ] **PIN pad rapid-tap race** `race`
  *Symptom:* Fast typing on the PIN pad could drop a digit.  <br>*Fix:* Fixed the rapid-tap race so each keypress builds on the latest state and auto-submits on the 5th digit.
- [ ] **Rapid taps overwrite previous setting** `race`
  *Symptom:* Rapidly tapping a setting lost the previous value.  <br>*Cause:* A stale-closure overwrite meant each tap read an outdated state.  <br>*Fix:* Fixed it so each tap builds on the latest state.
- [ ] **Read-aloud voice was monotone then kept switching voices** `race`
  *Symptom:* Pressing play started with a robotic/monotone voice then switched to a different voice on each sentence.  <br>*Cause:* speak() fired before the browser voices finished loading (using the robotic default), and the fallback could land on a novelty voice.  <br>*Fix:* Waited for voices to load, resolved the chosen voice once, pinned it across all sentences, and blocklisted novelty voices.
- [ ] **Same-tick taps cancel each other** `race`
  *Symptom:* Two same-instant taps could cancel each other out.  <br>*Cause:* A race between two same-tick actions.  <br>*Fix:* Fixed the race so both same-tick actions now stick; verified in browser.
- [ ] **Sync race causing three sync defects** `race`
  *Symptom:* Three sync defects surfaced during testing.  <br>*Cause:* A genuine race condition in the sync path.  <br>*Fix:* Fixed the race at its cause, resolving all three sync defects.
- [ ] **'See Plus' button was a dead-end** `logic`
  *Symptom:* Clicking 'See Plus' did nothing.  <br>*Fix:* Wired 'See Plus' to open the plan-selection screen.
- [ ] **Assistant claims success for no-op actions on Pro** `logic`
  *Symptom:* On Pro, asking the assistant to add a milestone, start a timer or invite a teammate created nothing yet it did not fail honestly (or returned the wrong hour).  <br>*Cause:* The assistant reported success for actions that never actually executed.  <br>*Fix:* Corrected the action wiring/reporting so it no longer claims success for nothing.
- [ ] **Celebration inline edits not saving** `logic`
  *Symptom:* Editing celebrations directly on the main screen didn't work.  <br>*Cause:* Reproduced and root-caused in the browser (not theorized).  <br>*Fix:* Fixed the main-screen celebration edit path so edits apply.
- [ ] **Could sign up without choosing a plan/price** `logic`
  *Symptom:* Signup completed without the user selecting a price.  <br>*Fix:* Required a plan pick during signup.
- [ ] **Countdown count-up broken** `logic`
  *Symptom:* Birthday/anniversary countdowns didn't count down or up correctly.  <br>*Fix:* Fixed count-up and added days+hours, dd/mm/yyyy dates, and a repeats-every-year toggle.
- [ ] **Credit price mismatch between display and checkout** `logic`
  *Symptom:* The app showed $19 for 100 credits while checkout charged $50, and two credit tiles 404'd.  <br>*Cause:* Pricing was not driven by a single source of truth across app, create-checkout, and Stripe.  <br>*Fix:* Introduced a canonical credits.ts tier table used everywhere so display matches checkout ($19 = 100 credits).
- [ ] **Day/Night toggle did not actually flip themes** `logic`
  *Symptom:* Switching the Day/Night toggle did not reliably change modes.  <br>*Cause:* Midnight was secretly both a selectable colourway and the dark mode.  <br>*Fix:* Separated Midnight from dark mode so the Day/Night toggle now flips correctly.
- [ ] **Duplicate SlotEditor block in Scheduler edit** `logic`
  *Symptom:* Scheduler edit rendered a duplicated slot editor.  <br>*Cause:* A stray duplicate {adding !== null && <SlotEditor>} block was present.  <br>*Fix:* Removed the stray duplicate block.
- [ ] **Empty Clipboard click did nothing** `logic`
  *Symptom:* Clicking the Clipboard section when it was empty produced no response.  <br>*Cause:* The section only rendered if the user already had clipboard grabs, so an empty clipboard showed nothing.  <br>*Fix:* Made the Clipboard render and respond even when empty.
- [ ] **Google Translate silently returned untranslated text** `logic`
  *Symptom:* Live Google Translate did not actually translate in the UI.  <br>*Cause:* The client hit the Cloudflare no-key echo first (silently short-circuiting), and the Supabase translate function read the key from the wrong secret location.  <br>*Fix:* Made the client call the Supabase function first and skip the no-key echo, and made Supabase translate read the key from the Vault.
- [ ] **Handle-availability indicator showed a stale result** `logic`
  *Symptom:* The username handle checker showed a stale ✓ available against a name that was actually taken.  <br>*Cause:* The indicator kept the previous handle's result while the user typed the next character (client-side stale state); the RPC itself was fine.  <br>*Fix:* Fixed the stale state and added an authoritative re-check on submit.
- [ ] **Insert-table button could not add rows or columns** `logic`
  *Symptom:* In docs, the insert-table feature didn't let users add rows and columns.  <br>*Fix:* Wired the table popover to add rows/columns.
- [ ] **Mic re-captures tab audio (echo)** `logic`
  *Symptom:* Recordings had echo from the mic picking up the tab's own audio.  <br>*Cause:* The microphone re-captured the tab audio output.  <br>*Fix:* Applied the researched echo fix to the audio routing.
- [ ] **New accounts got the 'Close friends' circle added twice** `logic`
  *Symptom:* A new account had two 'Close friends' circles seeded.  <br>*Cause:* Circle seeding was not idempotent.  <br>*Fix:* Made seeding idempotent (select + limit(1)) plus a DB unique index, and cleaned the existing duplicate.
- [ ] **NLP leaves attendee name in event title** `logic`
  *Symptom:* 'Priya' stayed in the event title instead of becoming a guest chip.  <br>*Cause:* A bare weekday+time blocked the attendee match in the parser.  <br>*Fix:* Fixed the parser so the attendee is extracted into a guest chip.
- [ ] **Page doesn't translate on language change** `logic`
  *Symptom:* Switching the language didn't translate the page.  <br>*Cause:* Client-side language-switch logic didn't translate page content.  <br>*Fix:* Implemented a whole-page auto-translator; verified English->French/Spanish with name and brand preserved.
- [ ] **PDF cover-title letter-spacing extraction** `logic`
  *Symptom:* Letter-spaced PDF cover lines were mangled (e.g. "H A L L A L U / I N T E L L I G E N C E") and text was read out letter-by-letter instead of as whole words.  <br>*Cause:* pdfjs-dist glyph-position line assembly didn't account for the wide inter-letter gaps of letter-spaced text.  <br>*Fix:* Added per-line gap statistics (median x1.6), a collapse-regex safeguard, font-size heading detection with multi-line merge, and running-header removal.
- [ ] **Six milestone module bugs** `logic`
  *Symptom:* Six reported milestone bugs affected the milestones feature.  <br>*Cause:* Multiple distinct root causes traced to source across the milestones code.  <br>*Fix:* Fixed all six milestone bugs at their root causes, each verified.
- [ ] **Split translation strings produced garbled copy** `logic`
  *Symptom:* Translated sign-in copy came out garbled, e.g. 'Choisissez un 5Code PIN à 8 chiffres', and a card embedded the language name mid-sentence.  <br>*Cause:* Phrases were split into multiple pieces (and a language name embedded mid-sentence) so each fragment translated separately.  <br>*Fix:* Made each phrase a single string so it translates as one unit, and stopped embedding the language name mid-sentence.
- [ ] **Tracker empty-state showed 'under a minute' instead of '0 min'** `logic`
  *Symptom:* With zero tracked time, the Tracker showed 'under a minute' (x3) rather than 0 min.  <br>*Cause:* The zero case fell through to the mins < 1 branch.  <br>*Fix:* Added if (totalMinutes === 0) return '0 min' before the 'under a minute' branch.
- [ ] **Transcription not in the user's language** `logic`
  *Symptom:* Voice transcription didn't produce text in the user's selected language.  <br>*Fix:* Added a transcription-in-your-language fix alongside many more UI languages.
- [ ] **Translate batch cap regression dropped half of each batch** `logic`
  *Symptom:* Legitimate localization batches would silently lose half their strings.  <br>*Cause:* The client sends up to 128 strings per request but the new server ceiling was set to 64.  <br>*Fix:* Raised the server per-request string ceiling to 128 in both the Supabase and Cloudflare versions.
- [ ] **UI strings (toasts, doc names) stayed in English when translating** `logic`
  *Symptom:* After switching language, many words stayed in English including toast messages and document names.  <br>*Cause:* Hardcoded strings like showToast were not routed through the i18n/translation layer.  <br>*Fix:* Wired showToast and other strings through the translation system with new i18n keys so translation propagates app-wide.
- [ ] **Vault API key saved with trailing space** `logic`
  *Symptom:* AI features would silently break after wiring up the key.  <br>*Cause:* The Vault secret was stored as "ANTHROPIC_API_KEY " with a trailing space in the key name.  <br>*Fix:* Corrected/normalized the secret name so the key is read correctly.
- [ ] **Word/character count differed between header and footer** `logic`
  *Symptom:* The same doc showed 57 words in the header and 117 in the footer.  <br>*Cause:* The header (DocEditor) counted a stale plain-text content mirror while the footer (RichEditor) counted the live text.  <br>*Fix:* Pointed the header count at the live text so header and footer both show the correct count.
- [ ] **52 RLS initplan performance warnings** `perf`
  *Symptom:* RLS policies re-evaluated auth.uid() per row, flagged by 52 auth_rls_initplan advisories.  <br>*Cause:* Policies called auth.uid() directly instead of a subselect.  <br>*Fix:* Rewrote policies to use (select auth.uid()) per Supabase's recommendation.
- [ ] **Celebrations milliseconds re-render jank** `perf`
  *Symptom:* Opening celebrations glitched when many cards ran with milliseconds.  <br>*Cause:* The whole list re-rendered every 60ms whenever any card displayed milliseconds.  <br>*Fix:* Drove all cards from one shared requestAnimationFrame clock with per-value gated re-renders.
- [ ] **Every-boot cache purge re-downloaded Whisper model** `perf`
  *Symptom:* Each visit forced a ~40MB Whisper model re-download.  <br>*Cause:* The every-boot cache purge in main.tsx was deleting the Whisper model cache.  <br>*Fix:* Scoped the boot purge so it no longer wipes the model cache (commit 58f6245).
- [ ] **Redundant duplicate profile fetches** `perf`
  *Symptom:* 250+ duplicate profile fetches were issued per session.  <br>*Cause:* Profile fetches weren't cached.  <br>*Fix:* Cached the profile fetch for 30 seconds.
- [ ] **Screen recording freezes in a background tab** `perf`
  *Symptom:* Recordings froze whenever the tab was hidden or backgrounded.  <br>*Cause:* The draw loop was visibility-throttled when the tab wasn't focused.  <br>*Fix:* Drive the draw loop from a Web Worker timer with captureStream(0) + explicit requestFrame so capture isn't tied to compositing.
- [ ] **Tracker Edit did nothing then lagged ~1s before opening** `perf`
  *Symptom:* Clicking Edit on a tracker appeared to do nothing, then the edit screen opened after a lag.  <br>*Cause:* Tracker groups recomputed on each render causing ~1s open latency.  <br>*Fix:* Memoised the tracker cards/groups via useMemo, cutting open time from ~1s to ~7ms.
- [ ] **'20 free' credits wording was incorrect** `ui`
  *Symptom:* Copy said accounts start with 20 free when they actually start with 5.  <br>*Cause:* Stale '20 free' wording in five places.  <br>*Fix:* Changed '20 free' to '5 free' everywhere.
- [ ] **'Add another tracker' button disappeared when trackers existed** `ui`
  *Symptom:* The tracker builder hid the add button once trackers already existed.  <br>*Fix:* Builder now always shows 'Add another tracker' even with existing trackers.
- [ ] **'Add homework' line too dark to see in dark mode** `ui`
  *Symptom:* In homework, the add-homework line was too dark to read in dark mode.  <br>*Fix:* Lightened the add-homework line for dark-mode contrast.
- [ ] **'Attach from library' opens an empty modal that does nothing** `ui`
  *Symptom:* Attaching from the library opened an empty modal where nothing happened.  <br>*Cause:* The modal had no empty state and no upload path.  <br>*Fix:* Added empty states and an upload CTA and wired the artifact viewer.
- [ ] **'Finished' wordmark rendered black in dark mode** `ui`
  *Symptom:* The 'Finished' wordmark (and every 'X.' header) turned black and vanished in dark mode.  <br>*Cause:* The wordmark sat inside a <button>, which resets text color to black.  <br>*Fix:* Set .brand color to var(--ink) / rgb(238,243,255) so the wordmark stays light in dark mode.
- [ ] **Add-to-story modal stuck and oversized** `ui`
  *Symptom:* Tapping "add to story" opened a modal that was stuck, too big, and falling off the page.  <br>*Cause:* The modal had no height cap and the story preview wasn't constrained.  <br>*Fix:* Capped the modal height with scroll and tightened the story preview.
- [ ] **App renders faded/flash on refresh** `ui`
  *Symptom:* The app randomly showed up faded when refreshed or reopened.  <br>*Cause:* Loading-flash from the boot splash before the bundle loaded.  <br>*Fix:* Shipped a new static splash and a loading-flash fix.
- [ ] **Archived section header looked broken/cramped** `ui`
  *Symptom:* The Archived section title rendered cramped/broken.  <br>*Fix:* Rebuilt it as a clean tappable pill '▾ Archived (n)' with one-tap Restore, and removed the 🗄 glyph.
- [ ] **Beautify blurred overlay unreadable** `ui`
  *Symptom:* The Beautify screen used a translucent blurred overlay that was hard to read.  <br>*Cause:* It rendered as a blurred overlay rather than a solid page.  <br>*Fix:* Replaced it with a fixed opaque full-screen page.
- [ ] **Candy theme celebration tile text not readable** `ui`
  *Symptom:* In the Candy theme, the celebrations tile numbers/text were hard to see against the gradient.  <br>*Fix:* Made the celebration numbers white with a dark shadow (also fixed matcha/babypink) for contrast.
- [ ] **Coloured-card titles low contrast** `ui`
  *Symptom:* Titles on coloured cards rendered muted and hard to read.  <br>*Fix:* Fixed the titles to legible white for adequate contrast.
- [ ] **Confirm dialog used wrong verb for soft-cancel** `ui`
  *Symptom:* The Confirm dialog's action button read 'Delete' for a soft-cancel action.  <br>*Cause:* Mislabeled action button verb.  <br>*Fix:* Corrected the button label to match the soft-cancel action.
- [ ] **Countdown numbers too small** `ui`
  *Symptom:* Countdown/count-up numbers were tiny and wrapped onto multiple lines.  <br>*Fix:* Made the numbers big and one line, down to milliseconds.
- [ ] **Cover-flow peek clicks closed the modal** `ui`
  *Symptom:* Clicking to peek in the cover-flow closed the whole modal.  <br>*Cause:* Peek click events bubbled up to the veil's close handler.  <br>*Fix:* Stopped the peek clicks from bubbling to the close handler.
- [ ] **CTA button end rendered dark like it was cut off** `ui`
  *Symptom:* The end of the primary blue button looked dark/cut off, as if not fully rendered.  <br>*Cause:* The gradient stop rendered a dark edge.  <br>*Fix:* Set an explicit linear-gradient(135deg, #3b82f6, #4f93f8) on .onb-cta and .news-choice-btn.on so the button is fully blue.
- [ ] **Doc-editor header overcrowded and unclear** `ui`
  *Symptom:* The doc editor's top bar was a confusing strip where it wasn't clear what was on top vs bottom.  <br>*Cause:* `.we-bar` was a single flex row cramming the title, word/char stats and ~10 tool controls.  <br>*Fix:* Made `.we-bar` flex-wrap and protected the title so the toolbar wraps cleanly.
- [ ] **Emoji picker didn't close on outside click** `ui`
  *Symptom:* Clicking outside the emoji picker left it open.  <br>*Fix:* Made the picker close when clicking anywhere outside it.
- [ ] **Emoji picker horizontal overflow** `ui`
  *Symptom:* The emoji picker slid sideways and emojis didn't fit inside the box.  <br>*Cause:* Unconstrained picker width allowed horizontal drift.  <br>*Fix:* Constrained the picker to 340px / 8 columns with vertical-only scroll, verified inside the viewport.
- [ ] **File menu dropdown rendered behind the toolbar** `ui`
  *Symptom:* Opening the File menu showed a glitch where the dropdown painted behind the editor toolbar.  <br>*Cause:* The static .we-bar header created a stacking context, so the dropdown sat behind the later toolbar.  <br>*Fix:* Elevated the header's stacking order so the File dropdown paints above the toolbar.
- [ ] **Freeze-count copy missing a separator** `ui`
  *Symptom:* The tracker copy read '3 freezes left this month keep it safe' with no separator.  <br>*Fix:* Changed copy to '{freezesLeft()} freeze(s) left this month · they keep your streak safe'.
- [ ] **Frozen blank screen while generating in 'Write it for me' modal** `ui`
  *Symptom:* The Write-it modal appeared frozen with no feedback while content was being generated.  <br>*Cause:* No loading/thinking indicator was shown during generation.  <br>*Fix:* Added an animated 'thinking' indicator so the screen no longer appears frozen.
- [ ] **Header logo circle-inside-a-circle** `ui`
  *Symptom:* The header logo rendered as a nested circle-inside-a-circle instead of the intended mark.  <br>*Cause:* A second circle was nested inside the logo circle.  <br>*Fix:* Rebuilt it as a single light-blue circle with a blue tick next to "Finished."
- [ ] **Home loads scrolled down with logo above the fold** `ui`
  *Symptom:* The home page loaded already scrolled down.  <br>*Cause:* The home scrolls inside a height:100% container, so window.scrollTo(0,0) didn't reset it.  <br>*Fix:* Added a proper scroll reset in App.tsx, with the fixed boot splash masking the reset.
- [ ] **Imprecise crop preview** `ui`
  *Symptom:* The crop preview implied the image wouldn't fit, yet the full image appeared once posted.  <br>*Cause:* The crop preview didn't accurately reflect the final framing.  <br>*Fix:* Fixed the preview to match output and added zoom in/out for timeline and profile photos.
- [ ] **Invalid hex color in boot splash CSS** `ui`
  *Symptom:* The boot splash background color was malformed.  <br>*Cause:* A stray space made the hex invalid (#eaf0 fe).  <br>*Fix:* Corrected the hex to #eaf0fe.
- [ ] **Launch-checklist checkmark rendered as a tiny square tick** `ui`
  *Symptom:* The launch checklist checkmark was a tiny tick in a square, not a big white tick in a circle like the logo.  <br>*Fix:* Replaced it with a clean big white check-circle (V1 and V2).
- [ ] **Library star ratings render as huge dashed 'cylinder' boxes** `ui`
  *Symptom:* Book star ratings appeared as tall dashed boxes overlapping cards.  <br>*Cause:* The empty-star span className 'empty' collided with the app's global .empty empty-state box (an 84x170px dashed placeholder).  <br>*Fix:* Renamed/scoped the star glyph classes (.bt-empty at 18x18px) and added gradient book-cover thumbnails.
- [ ] **Light-hardcoded surfaces stranded dark text in dark mode** `ui`
  *Symptom:* The 'JUMP BACK IN' card and other surfaces stayed light in dark mode, leaving text unreadable.  <br>*Cause:* Those surfaces had hardcoded light colors that ignored dark mode.  <br>*Fix:* Made the JUMP BACK IN card and other surfaces dark with light text in dark mode.
- [ ] **Loading splash flickers in a self-heal reload loop** `ui`
  *Symptom:* The loading animation kept randomly reappearing.  <br>*Cause:* With #root empty, the 10s self-heal timer fired location.reload(), re-showing the splash in a repeating loop.  <br>*Fix:* Fixing the mount stopped the loop, and the boot script was simplified to one-shot recovery to remove the timer-vs-network flicker.
- [ ] **Logo dot not aligned inline with wordmark** `ui`
  *Symptom:* The brand logo dot sat out of line with the wordmark.  <br>*Fix:* Aligned the dot inline so dotTop equals brandTop.
- [ ] **Memoriser cut off on mobile** `ui`
  *Symptom:* The memoriser was cut off on mobile in Study.  <br>*Fix:* Fixed the mobile layout so the memoriser isn't clipped.
- [ ] **Memoriser white-box text invisible in dark mode** `ui`
  *Symptom:* In the Memoriser, text in the white box was barely visible in dark mode.  <br>*Fix:* Revamped Memoriser dark-mode contrast so the box text is readable.
- [ ] **Milestones card layout shifts with content** `ui`
  *Symptom:* Milestones cards had buttons and progress bars in different positions depending on whether a card had a note.  <br>*Cause:* Cards weren't equal height, so controls floated based on content.  <br>*Fix:* Made cards equal height so progress bars and "It happened!" buttons sit in the same position.
- [ ] **Mobile CSS rule leaking to desktop** `ui`
  *Symptom:* Layout overlap appeared on non-mobile viewports.  <br>*Cause:* A mobile width:100%!important rule was declared outside its media query.  <br>*Fix:* Scoped the mobile rule back inside its media query, resolving the overlap.
- [ ] **Mobile sticky CTA overlap on booking page** `ui`
  *Symptom:* The mobile sticky CTA overlapped the Style/Edit buttons.  <br>*Fix:* Stacked the Style/Edit buttons above the sticky CTA to remove the overlap.
- [ ] **Orphan word 'bed' wrapped alone in onboarding tour card** `ui`
  *Symptom:* The onboarding tour body text left the word 'bed' stranded on its own line.  <br>*Fix:* Applied text-wrap so the phrase wraps together (…on a walk or in bed.).
- [ ] **Oversized /help and doc toolbar buttons** `ui`
  *Symptom:* The AI-artifact buttons were bulky full-width pills and the '/help' button was oversized and wrapped.  <br>*Cause:* The buttons inherited global styles instead of being scoped to the toolbar.  <br>*Fix:* Scoped dedicated classes (pj-doc-btn, flex-grow:0, content-sized) so buttons are tidy and match the toolbar scale.
- [ ] **Planner copy says morning for afternoon slots** `ui`
  *Symptom:* The planner said 'protected in the morning' even for afternoon slots.  <br>*Cause:* Static copy not conditioned on slot time.  <br>*Fix:* Made the copy match the slot's time of day.
- [ ] **Privacy/Terms links returned 404** `ui`
  *Symptom:* The Privacy and Terms redirects did not work.  <br>*Fix:* Fixed routing so the Privacy page renders at /?legal=privacy (404 resolved).
- [ ] **Progress ring percentage unreadable in dark/Midnight theme** `ui`
  *Symptom:* The number inside the progress wheel and some text was hard to see at midnight/dark mode.  <br>*Cause:* ProgressRing color was not theme-aware and tint dimming applied in dark mode.  <br>*Fix:* Made ProgressRing theme-aware (white/readable % on every theme) and overrode the dark-mode tint dimming.
- [ ] **Rainbow splash animation keeps regressing** `ui`
  *Symptom:* The moving rainbow colour-splash first-load animation had reverted to static.  <br>*Cause:* A git regression reintroduced the static splash.  <br>*Fix:* Restored the animated splash and pinned/guarded it against regressing again.
- [ ] **Re-picking the same story photo doesn't fire** `ui`
  *Symptom:* Selecting the same photo again for a story did nothing.  <br>*Cause:* The file input wasn't reset, so re-selecting the same file didn't emit a change event.  <br>*Fix:* Reset the story file input after selection (Stories.tsx).
- [ ] **Screen Studio scenes stretched in resized window** `ui`
  *Symptom:* A half-sized window stretched scenes blurry/stocky instead of scaling cleanly.  <br>*Cause:* Scenes were not constrained to a fixed contain-fit stage.  <br>*Fix:* Made scenes a fixed 16:9 contain-fit stage so a resized window letterboxes.
- [ ] **Sign-in / sign-up screens cut off at the top** `ui`
  *Symptom:* The auth screens were clipped at the top on short viewports.  <br>*Cause:* AuthGate used flexbox + overflow that clipped the top on short viewports.  <br>*Fix:* Switched AuthGate to a robust block layout so the top is no longer cropped.
- [ ] **Sign-in splash rendered broken** `ui`
  *Symptom:* The sign-in splash would have rendered broken.  <br>*Cause:* CSS class-name collisions corrupted the splash styling.  <br>*Fix:* Used unique class names and restored the original design (glowing ring, breathing logo, gradient bar).
- [ ] **Story black-flash before photo** `ui`
  *Symptom:* Opening a story showed a black screen before the photo loaded.  <br>*Fix:* Fixed the black-flash (verified by code, since a real story couldn't be driven locally).
- [ ] **Time page horizontal scroll** `ui`
  *Symptom:* The Time page scrolled sideways.  <br>*Cause:* Element width exceeded the card/viewport.  <br>*Fix:* Applied a width fix so content fits within the card.
- [ ] **Timezone label shows underscores** `ui`
  *Symptom:* A timezone displayed as 'Port_of_Spain'.  <br>*Cause:* The raw IANA identifier wasn't humanized.  <br>*Fix:* Displayed 'Port of Spain' (underscores stripped).
- [ ] **Timezone picker truncates country names** `ui`
  *Symptom:* The timezone picker button truncated long country names.  <br>*Cause:* The picker button layout ellipsized the country name.  <br>*Fix:* Restructured the button to show the full country name on its own line.
- [ ] **Two bugs in the photo crop dialog** `ui`
  *Symptom:* The photo crop dialog misbehaved.  <br>*Cause:* Two defects in CropModal.tsx (loop / blob-URL handling).  <br>*Fix:* Fixed both CropModal.tsx bugs and committed.
- [ ] **Typo in classic theme CSS** `ui`
  *Symptom:* A typo had slipped into the classic theme's CSS.  <br>*Cause:* Malformed CSS in the classic theme.  <br>*Fix:* Corrected the typo.
- [ ] **Ugly native prompt() used in Work feature** `ui`
  *Symptom:* The Work feature used a raw browser prompt() dialog.  <br>*Fix:* Replaced the prompt() with proper in-app UI (and added focus-stop celebration).
- [ ] **All AI silently ran on Gemini fallback instead of Claude** `other`
  *Symptom:* AI features silently used the degraded Gemini fallback rather than Claude.  <br>*Cause:* ANTHROPIC_API_KEY was stored in the Vault with a trailing space (unreadable), and edge functions read secrets from Deno.env rather than the Vault.  <br>*Fix:* Created a read_vault_secret RPC that trims names (trim(name)=trim(secret_name)) so the key resolves and functions read the Vault.
- [ ] **Downloaded webm has infinite/no duration** `other`
  *Symptom:* Downloaded recordings had no duration header and wouldn't seek.  <br>*Cause:* Chrome writes no duration metadata for timesliced recordings.  <br>*Fix:* Patch wall-clock, pause-aware duration into the file with fix-webm-duration so downloads seek.
- [ ] **fix-webm-duration dependency dropped from package.json** `other`
  *Symptom:* The Cloudflare deploy would have broken even though local builds passed.  <br>*Cause:* A concurrent session's commit had wiped `fix-webm-duration` out of package.json.  <br>*Fix:* Restored the dependency in package.json.
- [ ] **Password-reset emails sent from an unverified domain** `other`
  *Symptom:* The send-reset function would have its emails rejected by Resend.  <br>*Cause:* The function sent from hi@hallalu.com, which is not the verified domain.  <br>*Fix:* Changed the from address to hi@finished.hallalu.com (verified) with reply-to hi@hallalu.com.
- [ ] **Stale cached JavaScript made features appear broken** `other`
  *Symptom:* Write templates, the Homework + button, and AI features all did nothing even though the code was correct.  <br>*Cause:* The deployed app was serving stale JavaScript from the service worker cache.  <br>*Fix:* Fixed the service worker so every deploy arrives instantly (with a one-time hard-refresh to clear the old bundle).

## Hallalu CRM  ·  34 fixed

- [ ] **Business-plan /pitch gate bypassable via path tricks** `security`
  *Symptom:* The gated /pitch content could be reached with two path tricks despite the gate.  <br>*Cause:* The gate only guarded the route while the protected content still shipped in the static asset bundle.  <br>*Fix:* Removed the protected content from the asset bundle entirely so the gate actually holds.
- [ ] **Invoice builder wipes line items on every repaint** `data-loss`
  *Symptom:* 'Add a line' did nothing and invoices could not be saved.  <br>*Cause:* invoiceBuilder() re-initialised the line items on every repaint, wiping typed input.  <br>*Fix:* Separated initialization from repaint so line items persist, and corrected the maths.
- [ ] **/api/track throws TDZ from duplicate** `crash`
  *Symptom:* The `/api/track` endpoint threw a temporal-dead-zone error.  <br>*Cause:* A leftover duplicate declaration.  <br>*Fix:* Removed the duplicate; endpoint works.
- [ ] **Admin check crashes for signed-out users** `crash`
  *Symptom:* The app would crash for signed-out visitors.  <br>*Cause:* `isAdminUser()` dereferenced a null account.  <br>*Fix:* Added a null guard.
- [ ] **Hallucinated Stripe checkout APIs** `crash`
  *Symptom:* Checkout would have failed the instant real keys were added.  <br>*Cause:* A previous session used non-existent Stripe APIs (a fake 'Dahlia' Stripe.js, `createEmbeddedCheckoutPage`, and a fabricated `API_VERSION='2026-07-29.dahlia'`).  <br>*Fix:* Rewrote to the real Embedded Checkout API and correct version header (four fixes).
- [ ] **Stale HTML shell served from cache** `sync`
  *Symptom:* The browser kept serving a stale index.html, making fixes look broken for testers and real users.  <br>*Cause:* The HTML shell was being cached even though versioned assets already handle caching.  <br>*Fix:* Made the shell never cache so deploys are picked up immediately.
- [ ] **Date handling produced the wrong year** `logic`
  *Symptom:* Goal/close dates resolved to the wrong year (e.g. 2024, and 'next Tuesday' became 2027).  <br>*Cause:* Date arithmetic was wrong and the first guard only blocked past dates, pushing them to 2027.  <br>*Fix:* Fixed date computation generally so relative dates resolve to the correct year.
- [ ] **Dead route after creating a project while viewing a client** `logic`
  *Symptom:* Creating a project while viewing a client left the user on a dead route.  <br>*Cause:* Navigation state after project creation resolved to an invalid route.  <br>*Fix:* Corrected the post-creation navigation so it lands on a valid view.
- [ ] **Delete actions silently do nothing** `logic`
  *Symptom:* Several delete controls appeared to work but deleted nothing.  <br>*Cause:* The delete handlers were not wired to actually remove the item.  <br>*Fix:* Fixed the deletes and added delete-confirmations everywhere.
- [ ] **Demo shows wrong base currency** `logic`
  *Symptom:* The UK demo displayed USD instead of GBP.  <br>*Cause:* A stale demo from before currency settings existed left USD hard-coded.  <br>*Fix:* Set `st.settings.baseCurrency='GBP'` in decorateDemo.
- [ ] **Editing a lead can't set Google/Maps source** `logic`
  *Symptom:* Google/Maps couldn't be chosen when editing a lead, and demo leads were mislabeled call/email.  <br>*Cause:* The edit form offered only 4 sources instead of the full source picker.  <br>*Fix:* Switched the edit form to the full source picker and corrected the demo leads.
- [ ] **Hardcoded '3.1×' caption** `logic`
  *Symptom:* A '3.1×' caption was displayed as if computed but was hardcoded.  <br>*Cause:* The multiplier was a static string rather than derived from data.  <br>*Fix:* Corrected the caption for honesty rather than hardcoding it.
- [ ] **Local 'pct' variable shadows global pct() function** `logic`
  *Symptom:* A percentage calculation misbehaved due to name collision.  <br>*Cause:* A local variable named pct shadowed the global pct() function.  <br>*Fix:* Renamed the shadowing local variable to remove the collision.
- [ ] **NaN% reply rate and non-zero outreach on empty project** `logic`
  *Symptom:* An empty project showed NaN% for reply rate and a fresh project did not start its outreach count at 0.  <br>*Cause:* Metrics divided by zero / lacked initialization for empty projects.  <br>*Fix:* Removed the NaN and made a fresh project start outreach count at 0.
- [ ] **Paste importer mis-parses co.uk domains** `logic`
  *Symptom:* Pasted leads with `.co.uk` sites and business domains were parsed wrong (domain treated as email).  <br>*Cause:* TLD ordering matched `co` before `co.uk`, and business-domain-vs-email wasn't distinguished.  <br>*Fix:* Fixed TLD ordering so `co.uk` matches first and separated business domain from email.
- [ ] **Phone-number parser misreads across lines** `logic`
  *Symptom:* Phone parsing failed on multi-line input and numbers with a leading parenthesis.  <br>*Cause:* The phone regex crossed line boundaries and didn't allow a leading paren.  <br>*Fix:* Rewrote the phone pattern to stay on one line and allow a leading paren.
- [ ] **Read-aloud reply and button do nothing** `logic`
  *Symptom:* The assistant's reply did not speak and the read-aloud button after the fact did nothing.  <br>*Cause:* The speak-on-reply path and the manual read-aloud handler were both broken.  <br>*Fix:* Fixed both halves so replies speak and the button works.
- [ ] **Rolodex cards show fields with no way to enter them** `logic`
  *Symptom:* Contact cards displayed fields (e.g. in influencers) that had no corresponding input path.  <br>*Cause:* Card display and the entry form were driven by different definitions.  <br>*Fix:* Refactored so one schema drives both the card and the entry form.
- [ ] **Worker chunking not byte-safe and header auth broken** `logic`
  *Symptom:* Worker request chunking and header-based auth were faulty.  <br>*Cause:* Chunking split on characters rather than bytes and auth headers were mishandled.  <br>*Fix:* Reworked the worker for byte-safe chunking and correct header auth.
- [ ] **AI status stuck on 'Checking…' when API unreachable** `ui`
  *Symptom:* The AI buttons showed a perpetual 'Checking…' state and failed silently when the API was not reachable locally.  <br>*Cause:* The unreachable-API case was not handled with a clear state.  <br>*Fix:* Made the buttons report exactly what is missing instead of hanging or failing silently.
- [ ] **Ava assistant invisible on mobile/dark** `ui`
  *Symptom:* The Ava assistant was white-on-white and unreadable in dark mode on phones.  <br>*Cause:* Hard-coded #fff surfaces gave zero contrast on the hero stage, reply bubbles, and chips.  <br>*Fix:* Fixed three contrast bugs and added a real mobile layout for the Ava page.
- [ ] **Broken Followers/Following/Photo grid** `ui`
  *Symptom:* The Followers/Following and Photo layout was mis-arranged.  <br>*Cause:* The grid pairing was wrong.  <br>*Fix:* Made Followers/Following a proper pair with Photo on its own row.
- [ ] **Clients-signed ring misaligned** `ui`
  *Symptom:* Ring numerals sat on different baselines and the 'clients signed' label was small and off-center.  <br>*Cause:* Numerator/denominator and label were not aligned or sized correctly.  <br>*Fix:* Aligned numerals on one baseline with a smaller denominator and centered/enlarged the label.
- [ ] **Confetti persists under tab throttling** `ui`
  *Symptom:* Confetti outlived its welcome, lingering after it should have cleared.  <br>*Cause:* The confetti animation was not cleaned up when the browser throttled the background tab.  <br>*Fix:* Cleared the confetti so it no longer outlives its animation.
- [ ] **Contact card not full width** `ui`
  *Symptom:* The rich-contact card rendered narrower than the container.  <br>*Cause:* A helper constrained the card width.  <br>*Fix:* Fixed the helper; card is now full width (689px).
- [ ] **Demo portraits mismatch names and gender** `ui`
  *Symptom:* Demo lead photos didn't match the leads' names or gender.  <br>*Cause:* Photos used random `i.pravatar.cc/?u=` URLs.  <br>*Fix:* Replaced with gender-inferred `randomuser.me` portraits via name-set heuristics.
- [ ] **Header buttons overflow, blocking Add to-do** `ui`
  *Symptom:* On a phone the 'Add to-do' button was clipped off the right edge, so users couldn't add a goal/to-do.  <br>*Cause:* `.topbar` had no `flex-wrap`, so the action buttons overflowed on narrow screens.  <br>*Fix:* Added flex-wrap to `.topbar`, fixing every view that uses the pattern.
- [ ] **Microphone icon not centered in inputs** `ui`
  *Symptom:* The mic sat near the top line instead of centered in goal, to-do and other fields.  <br>*Cause:* The mic was centered on the combined label+field height instead of just the field.  <br>*Fix:* Re-centered every mic in the app so each measures 0px off-center.
- [ ] **Timezone widget falls off screen** `ui`
  *Symptom:* Swapping timezones pushed the widget off-screen at mid widths.  <br>*Cause:* The timezone inputs didn't shrink or stack on narrow layouts.  <br>*Fix:* Made the inputs shrinkable and stack earlier; verified no overflow at any width.
- [ ] **Unsized SVG renders oversized** `ui`
  *Symptom:* An SVG rendered giant on screen.  <br>*Cause:* The SVG had no explicit dimensions.  <br>*Fix:* Sized the SVG so it renders correctly.
- [ ] **ANTHROPIC_API_KEY saved with a leading space** `other`
  *Symptom:* AI features silently did not work.  <br>*Cause:* The secret was stored as ' ANTHROPIC_API_KEY' with a leading space, so env.ANTHROPIC_API_KEY was undefined.  <br>*Fix:* Added a whitespace-tolerant secret() resolver so the key resolves regardless of stray whitespace.
- [ ] **Cloudflare env-var blocker (no worker script)** `other`
  *Symptom:* Cloudflare rejected env vars with 'Variables cannot be added to a Worker that only has static assets'.  <br>*Cause:* The Hallalu deployment had only static files and no worker script, so secrets could not attach.  <br>*Fix:* Added a worker script so environment variables can be bound.
- [ ] **extras.js not loading** `other`
  *Symptom:* The extras.js script failed to load.  <br>*Fix:* Corrected the loading so extras.js is included.
- [ ] **Legally wrong review-gating claims in shipped copy** `other`
  *Symptom:* The app told users incorrect legal facts about review gating (e.g. 'illegal in the UK', 'FTC rule covers gating', a mischaracterised Yelp rule).  <br>*Cause:* Four shipped legal claims and review-solicitation copy were inaccurate.  <br>*Fix:* Corrected all four claims and replaced the generic 'reviews' source with three platform-specific rule sets.

## Stitchhooky  ·  33 fixed

- [ ] **Co-stitch rooms and theme leak across accounts** `security`
  *Symptom:* The next person on the device auto-joined your live co-stitch room and kept your theme.  <br>*Cause:* Co-stitch room membership and appearance were not scoped per account.  <br>*Fix:* Scoped co-stitch rooms and appearance per account so they no longer leak between users.
- [ ] **Security headers silently ignored** `security`
  *Symptom:* Security/CSP headers added in the worker did nothing.  <br>*Cause:* Cloudflare serves static assets before the worker runs, so worker-set headers never applied.  <br>*Fix:* Moved the headers to the proper `_headers` mechanism.
- [ ] **Stored-XSS vectors in user content** `security`
  *Symptom:* Multiple stored-XSS injection points, including an unescaped server value reaching an HTML attribute.  <br>*Cause:* User/server values were rendered without escaping.  <br>*Fix:* Escaped the values and closed all five stored-XSS vectors.
- [ ] **'Reset everything' resurrects data on reload** `data-loss`
  *Symptom:* Resetting everything did not stick; data came back on the next reload.  <br>*Cause:* Reset left the rolling backup behind, and the loss-protection loader (which prefers whichever copy has more projects) resurrected everything.  <br>*Fix:* Made reset also clear the rolling backup so it no longer resurrects.
- [ ] **Cross-account data leak on shared device** `data-loss`
  *Symptom:* A second person signing up on the same device saw the first user's projects and streak.  <br>*Cause:* Accounts were stored in a single storage slot with no per-account scoping.  <br>*Fix:* Scoped storage per account so a new user starts empty (proven: Bea sees zero projects).
- [ ] **Duplicate chart projects on every reload** `data-loss`
  *Symptom:* Reloading created a brand-new duplicate of the same chart project (three identically-named ones appeared).  <br>*Cause:* `savedId` was never persisted, so each reload treated the chart as new.  <br>*Fix:* Persisted savedId so a chart maps to one project.
- [ ] **Projects view wiped by a single corrupt save** `data-loss`
  *Symptom:* The projects view went blank with no warning.  <br>*Cause:* `load()` silently fell back to empty defaults on any parse error, so one corrupt/truncated save destroyed everything.  <br>*Fix:* Added backups and recovery (preserve the broken copy) and made each card render independently so one bad project can't blank the list.
- [ ] **Resize wipes the canvas artwork** `data-loss`
  *Symptom:* Resizing the grid erased the user's drawing.  <br>*Cause:* The resize path cleared the canvas instead of preserving it.  <br>*Fix:* Resize now preserves existing artwork.
- [ ] **Sign-up orphans or clobbers pre-account data** `data-loss`
  *Symptom:* Signing up could vanish pre-account projects or clobber an existing local store for a handle.  <br>*Cause:* Pre-account projects were stored behind an ownerless key and sign-up did not adopt or protect them.  <br>*Fix:* Pre-account projects are adopted by the first signer, and sign-up refuses a handle with an existing store and points to sign-in.
- [ ] **Boot crash from temporal dead zone** `crash`
  *Symptom:* The entire app died on first load with no console error.  <br>*Cause:* `termKey` read `db` while `let db = load()` was still initializing (TDZ).  <br>*Fix:* Reordered initialization so `db` exists before it is referenced.
- [ ] **HUD crash on second render** `crash`
  *Symptom:* Every count after the first would crash.  <br>*Cause:* `renderCover` referenced an element its own rebuild had already destroyed.  <br>*Fix:* Reworked renderCover to not reference the destroyed element.
- [ ] **LS_BAK temporal dead zone crash** `crash`
  *Symptom:* The app refused to boot.  <br>*Cause:* `LS_BAK` was declared after `db=load()` ran, a use-before-initialisation TDZ.  <br>*Fix:* Moved the declaration before it is used.
- [ ] **Passcode lockout with no escape hatch** `auth`
  *Symptom:* User was asked for a passcode they never set and could not get in.  <br>*Cause:* A browser test left a lock flag in storage and there was no recovery path.  <br>*Fix:* Added a forgot-passcode escape hatch (fixed three ways) and cleared the stray flag.
- [ ] **Cell-click runs past end of row** `logic`
  *Symptom:* Clicking a cell could advance past the last stitch of a row into the next one.  <br>*Cause:* No bound check on the click-to-advance path.  <br>*Fix:* Clamped cell clicks to the current row's end.
- [ ] **Chart collapses to a tiny thumbnail** `logic`
  *Symptom:* The chart shrank to a thumbnail inside a huge empty page card.  <br>*Cause:* A scale calculation ran while the container was hidden (width read 0, scale went negative).  <br>*Fix:* Removed transform-scaling and made the grid fill the page width with real cells.
- [ ] **Chart-grow message flow miscounts** `logic`
  *Symptom:* The chart stage didn't repaint per message, the prompt offered to add skips instead of stitches, and it grew the wrong row.  <br>*Cause:* Stage wasn't refreshed per message and the grow logic targeted a stale row index / wrong element type.  <br>*Fix:* Repaint per message, name real stitches, and grow the correct row (verified 30→32).
- [ ] **Community tab is a dead end** `logic`
  *Symptom:* Community refused with a toast telling the user to sign in via Settings.  <br>*Cause:* It gated on a sign-in path that led nowhere.  <br>*Fix:* Fixed the Community entry so it no longer dead-ends.
- [ ] **Competing writers miscount home tiles** `logic`
  *Symptom:* The home tile still counted 13 stitches from a stale value.  <br>*Cause:* Two ppMeta writers fought over the home tile count and the stale one won.  <br>*Fix:* Consolidated to a single ppMeta writer.
- [ ] **Dictation mic leak into counting view** `logic`
  *Symptom:* After dictating rows then hitting Save & start counting, speech kept appending rows to a stale draft instead of counting.  <br>*Cause:* The mic stayed live with the dictation handler still attached when entering the counting studio.  <br>*Fix:* Mic now hard-stops on entering the counting studio.
- [ ] **Learn-to-read-charts modal silently fails** `logic`
  *Symptom:* Opening 'Learn to read charts' did nothing visible.  <br>*Cause:* It opened a modal that silently failed.  <br>*Fix:* Fixed the modal so the guide opens correctly.
- [ ] **Notation parser undercounts stitches ('7 vs 18')** `logic`
  *Symptom:* Stitch totals came out far too low, e.g. reporting 7 when it should be 18.  <br>*Cause:* Two parser bugs — e.g. '6 sc in magic ring' collapsed to a single count, and many notation variants weren't recognized.  <br>*Fix:* Parser overhaul plus a `normalizeNotation` that folds standing/stacked/foundation/post/Ntog/magic-ring variants into keys.
- [ ] **Billing panel invisible at 0x0** `ui`
  *Symptom:* The billing panel had content but measured 0x0 and never showed.  <br>*Cause:* A sizing rule collapsed the panel (and ten similar panels) to zero dimensions.  <br>*Fix:* One layout rule fixed all eleven; billing now renders at 560x740.
- [ ] **Dead hero photo on landing page** `ui`
  *Symptom:* The landing hero image 404'd, showing a broken tile.  <br>*Cause:* It pointed at an expired Unsplash premium URL.  <br>*Fix:* Swapped to a verified-200 photo and added a fallback that hides any tile whose image fails.
- [ ] **Duplicate DOM ids after bento redesign** `ui`
  *Symptom:* Nine duplicate DOM ids made home-tile buttons behave unpredictably.  <br>*Cause:* Replacing the home markup left the old tile row in place below the new bento.  <br>*Fix:* Removed the leftover old tile row.
- [ ] **iOS text too close to phone edge** `ui`
  *Symptom:* In the iOS simulator, words sat too close to the edge of the phone.  <br>*Cause:* Horizontal padding was below Apple's 16pt margin guidance.  <br>*Fix:* Raised horizontal padding to 22pt with the title at 27pt.
- [ ] **Menu hidden behind next card** `ui`
  *Symptom:* The project menu rendered behind the following card instead of on top.  <br>*Cause:* Z-index stacking-context bug.  <br>*Fix:* Fixed the stacking so the menu layers above adjacent cards.
- [ ] **Mic control runs off screen on real devices** `ui`
  *Symptom:* The mic control ran off the edge of the screen on real devices.  <br>*Cause:* A missing/incorrect viewport meta tag.  <br>*Fix:* Corrected the viewport meta tag.
- [ ] **Mislabeled +n count bubble** `ui`
  *Symptom:* The +n increment bubble showed the wrong number.  <br>*Fix:* Corrected the bubble's label calculation.
- [ ] **Settings button opened nothing** `ui`
  *Symptom:* The Settings control was genuinely broken and didn't open the panel.  <br>*Cause:* `#settingsSheet` was the backdrop element, not the panel itself.  <br>*Fix:* Corrected the settings sheet structure so the panel opens.
- [ ] **Stale CSS rule squishes knit cells** `ui`
  *Symptom:* Knit grid cells rendered square despite correct code.  <br>*Cause:* A leftover `.gm-cell` CSS rule from the old grid maker silently overrode the new knit geometry.  <br>*Fix:* Removed the stale rule so per-craft geometry applies.
- [ ] **Tile colour clashes with theme accent** `ui`
  *Symptom:* Tile colours (e.g. purple) did not match the theme the user picked.  <br>*Cause:* Tile background wasn't bound to the chosen accent colour.  <br>*Fix:* Tiles now follow the theme's colour and each tile background is picker-controlled.
- [ ] **CSP blocks YouTube thumbnails and embeds** `other`
  *Symptom:* The new CSP would have broken YouTube thumbnails and video embeds.  <br>*Cause:* The content-security-policy was too strict for the embed resources.  <br>*Fix:* Widened the CSP and re-verified zero blocked resources.
- [ ] **Users served stale app version** `other`
  *Symptom:* Returning users silently ran old JavaScript/HTML, making just-added features look missing.  <br>*Cause:* The `?v=` cache-busters weren't regenerated and HTML wasn't revalidated at the cache layer.  <br>*Fix:* Bumped/regenerated the `?v=` stamps and made HTML always revalidate.

## Hopefil  ·  22 fixed

- [ ] **Proprietary pricing/cost information leaking in the app** `security`
  *Symptom:* The app displayed confidential proprietary information such as per-credit cost and margins.  <br>*Cause:* Internal-economics copy and figures were exposed in the shipped bundle.  <br>*Fix:* Audited and fixed all five leaks (e.g. margin language replaced) and verified a clean leak-scan.
- [ ] **Preview freezes at an outdated state** `sync`
  *Symptom:* The visual preview froze at an outdated state (preview sync bug).  <br>*Cause:* Generators ran client-side without a guard against stale async responses.  <br>*Fix:* Moved generators to the worker with a cached, stale-response-guarded async shim and a 350ms hue-slider debounce.
- [ ] **Stale-closure loses rapid goal/checklist clicks** `race`
  *Symptom:* Rapid goal clicks used stale state (Income got overwritten by Community) and rapid checklist clicks registered only 1 of 3.  <br>*Cause:* Handlers captured stale state in a closure instead of using the latest value.  <br>*Fix:* Switched to a functional updater/toggle so each rapid click registers.
- [ ] **Dead landing CTA buttons** `logic`
  *Symptom:* Landing page CTA buttons did nothing (user-blocking).  <br>*Cause:* The 'Start building' nav pill was a plain #start anchor with no action wired.  <br>*Fix:* Made the nav pill a real action, made the empty-input nudge unmissable, and un-crowded mobile nav.
- [ ] **Generated files stamped with year 1996** `logic`
  *Symptom:* Generated files were timestamped 1996 instead of 2026.  <br>*Cause:* A wrong timestamp base in the file generator.  <br>*Fix:* Corrected the timestamp so files stamp the current year.
- [ ] **Greeting rotation regression** `logic`
  *Symptom:* The per-visit greeting rotation regressed during a change.  <br>*Cause:* A regression introduced while editing the greeting logic.  <br>*Fix:* Caught and fixed the regression so greetings rotate per visit from the pool.
- [ ] **Kotlin extension properties fail through fully-qualified chains** `logic`
  *Symptom:* Every exported Kotlin app would fail to compile on certain property access.  <br>*Cause:* The generator template emitted Kotlin extension properties resolved through fully-qualified chains, which Kotlin cannot resolve.  <br>*Fix:* Fixed the generator template (and live generator) so extension properties resolve correctly.
- [ ] **Android FAB not to Material 3 spec** `ui`
  *Symptom:* The Android floating action button had the wrong spec and clearance.  <br>*Cause:* FAB sizing/clearance did not follow M3.  <br>*Fix:* Rebuilt the Android FAB to M3 spec with correct clearance.
- [ ] **Barber app shows a wrong photo** `ui`
  *Symptom:* The barber demo app rendered a wrong/mismatched photo.  <br>*Cause:* An ambiguous/mismatched image was used at hero crop.  <br>*Fix:* Rendered mesh-art plus gradient-initial 'MR' avatars instead of the wrong photo.
- [ ] **Composer bar shows giant gradient pills** `ui`
  *Symptom:* The dashboard composer bar rendered giant gradient pills instead of a compact input/mic/button.  <br>*Cause:* It inherited the landing hero styles (a CSS inheritance bug).  <br>*Fix:* Scoped the composer styles to input-first, 40px mic at its side, compact 96px 'New app'.
- [ ] **Desktop/Mac/Web preview renders as a banner and single column** `ui`
  *Symptom:* Desktop, Mac and Web previews showed a lone phone column / banner and one name instead of a full-screen multi-column layout.  <br>*Cause:* One CSS keyword prevented auto-fit multi-column from firing, and a 118px card floor collapsed grids to one column.  <br>*Fix:* Made columns follow measured pane width via auto-fit and lowered the card floor to 70px for genuine multi-column desktop layouts.
- [ ] **Empty-prompt CTA silently does nothing** `ui`
  *Symptom:* Clicking 'New app' or 'Start building' with an empty prompt box did nothing — no builder, error, or feedback.  <br>*Cause:* The `if (!text) return` guard in `start()` bailed silently.  <br>*Fix:* Empty click now focuses the input, shakes the prompt bar, and highlights the hint.
- [ ] **Mobile nav wrap and file-list truncation** `ui`
  *Symptom:* In the narrow panel view the mobile nav wrapped and the file list truncated.  <br>*Cause:* Layout did not handle the narrow width.  <br>*Fix:* Fixed the mobile nav wrap and file-list truncation.
- [ ] **Pitch deck low contrast and overlapping footnotes** `ui`
  *Symptom:* Grey text on slides 7/8/9 was hard to read and footnotes overlapped the content.  <br>*Cause:* Dim text colors and footnotes that overlaid rather than flowed.  <br>*Fix:* Brightened the grey text, made footnotes flow below the legend, and auto-faded the arrow hint after 5s.
- [ ] **Pitch deck nav arrows un-positioned and wrong start slide** `ui`
  *Symptom:* The pitch deck did not start at slide 1 and the nav arrows were not centered at the sides.  <br>*Cause:* An 'all:unset' declared after 'position:fixed' un-positioned the arrows (CSS order matters).  <br>*Fix:* Reordered the CSS so arrows are centered and the deck starts at slide 1.
- [ ] **READY tiles stay dark on the light theme** `ui`
  *Symptom:* Some cards showed as black while others were white (READY tiles dark on the light theme).  <br>*Cause:* The theme token fix missed the dark .card-veil overlay.  <br>*Fix:* Applied the token fix to the .card-veil overlay so tiles match the theme.
- [ ] **Review-phase placeholder shows 'Building…' while awaiting approval** `ui`
  *Symptom:* The review phase displayed a 'Building…' placeholder while it was actually awaiting user approval.  <br>*Cause:* The placeholder text did not distinguish the awaiting-approval state.  <br>*Fix:* Corrected the review-phase placeholder to reflect the awaiting-approval state.
- [ ] **Six preview render/display complaints** `ui`
  *Symptom:* Category leak on a booking app, barber photo reading as a living room, toy-like toggle proportions, tab-bar labels wrapping, and settings labels ellipsizing.  <br>*Cause:* Multiple control-spec and layout issues across preview rendering.  <br>*Fix:* Fixed all six in code to researched control specs and encoded each as a rule in BUILD.md.
- [ ] **Stat numbers spilling over and jumbled** `ui`
  *Symptom:* Numbers in stat chips spilled over and looked jumbled.  <br>*Cause:* Stat chips were not wrap-proof.  <br>*Fix:* Rebuilt the stat chips as wrap-proof primitives and recorded the rule as law.
- [ ] **Wrong hue value on the render wall** `ui`
  *Symptom:* The render wall used a wrong hue.  <br>*Cause:* A hue value of 30 was incorrect.  <br>*Fix:* Set the warm color 0xFFD38C45 so all three render modes and dark mode render correctly.
- [ ] **Dev-server port mismatch in launch.json** `other`
  *Symptom:* The preview tooling couldn't attach to the dev server.  <br>*Cause:* The dev server binds 5197 but launch.json specified 5199.  <br>*Fix:* Corrected the port in launch.json.
- [ ] **Exported Android build fails: missing gradle.properties useAndroidX** `other`
  *Symptom:* The exported Android project failed its first-run compile in the farm.  <br>*Cause:* gradle.properties lacked android.useAndroidX=true.  <br>*Fix:* Added the one-line android.useAndroidX=true to gradle.properties and rebuilt.

## Budget LevelUp  ·  13 fixed

- [ ] **TOTP QR service leaked 2FA secret** `security`
  *Symptom:* Enabling 2FA sent the TOTP secret to a third-party QR service.  <br>*Cause:* The QR code was generated via an external service, exposing the secret.  <br>*Fix:* Removed the external QR call and replaced it with private manual key entry.
- [ ] **Excel month selector wrote to the wrong cell** `data-loss`
  *Symptom:* Changing the month in the Social Tracker workbook did not affect the formulas' results.  <br>*Cause:* The month selector wrote to a cell the formulas never read.  <br>*Fix:* Pointed the selector at the cell the formulas read and re-verified 0 error cells.
- [ ] **note() call destroyed the month selector cell** `data-loss`
  *Symptom:* A merged note silently wiped the month selector cell in the workbook.  <br>*Cause:* A note() call wrote a merged cell over the month selector.  <br>*Fix:* Reworked the merge so the note no longer overwrites the month cell.
- [ ] **Celebrate tab crashes on saved payment card** `crash`
  *Symptom:* The Celebrate tab crashed for a fresh guest and whenever a payment card existed.  <br>*Cause:* S.cards was shared by both the card register and celebration gallery, so Celebrate read .copy.headline off a payment card.  <br>*Fix:* Moved celebration cards to their own S.celebCards key and made the gallery defensive against malformed entries.
- [ ] **Vault C1 brute-force / no per-account retrieval token** `auth`
  *Symptom:* The encrypted vault was brute-forceable and lacked per-account isolation.  <br>*Cause:* No per-account retrieval token; a shared retrieval path was guessable.  <br>*Fix:* Added a per-account retrieval token with a dual-read migration (legacy accounts sign in with zero lockout), first mitigated by a rate limit.
- [ ] **Broken social link handling** `logic`
  *Symptom:* Pasting a social URL produced a dead link, and bad image URLs showed a broken icon.  <br>*Cause:* Links without an https:// prefix and junk text were not normalized, and image errors were unhandled.  <br>*Fix:* Auto-prefix bare URLs to working links, reject junk text, and degrade broken images to a placeholder.
- [ ] **Invoice button silently added an investment** `logic`
  *Symptom:* Clicking the Business invoice button silently created an investment instead.  <br>*Cause:* The invoice button shared a DOM element id with the Investments add-holding button.  <br>*Fix:* Gave the buttons unique ids and hardened the wiring; verified invoices and investments now act independently.
- [ ] **Merged-cell collision in pillars card** `logic`
  *Symptom:* Merged cells in the pillars card collided, corrupting the layout/values.  <br>*Cause:* Overlapping merged-cell ranges in the pillars card.  <br>*Fix:* Resolved the merged-cell collision and re-verified.
- [ ] **toISOString() shifted calendar events a day early** `logic`
  *Symptom:* Calendar events appeared one day earlier than the chosen date.  <br>*Cause:* toISOString() applied a UTC timezone shift to local dates.  <br>*Fix:* Avoided the UTC conversion so dates stay on the intended day.
- [ ] **Untranslated card titles and chart labels** `logic`
  *Symptom:* Card titles and chart row labels stayed in English after switching language.  <br>*Cause:* Those strings were missed by the localization pass.  <br>*Fix:* Translated the remaining titles/labels and redeployed.
- [ ] **Calendar alignment assignment typo** `ui`
  *Symptom:* The calendar rendered with broken alignment.  <br>*Cause:* A typo in the alignment assignment for the calendar.  <br>*Fix:* Corrected the alignment assignment in review.
- [ ] **Jumbled platform-mix card in summary band** `ui`
  *Symptom:* The platform-mix card layout appeared jumbled in the planner summary band.  <br>*Fix:* Reworked the platform-mix card layout in the summary band.
- [ ] **recalc.py crashed on Python 3.9** `other`
  *Symptom:* The recalc verification script threw a TypeError.  <br>*Cause:* ignore_cleanup_errors is unsupported on Python 3.9.  <br>*Fix:* Replaced it with an AppleScript-driven Excel recalc harness.

## Planner Studio  ·  11 fixed

- [ ] **arguments.callee ReferenceError breaks task ticking** `crash`
  *Symptom:* To-do items wouldn't tick off; the first render's refresh callback threw silently.  <br>*Cause:* `arguments.callee` used inside an arrow function throws a ReferenceError in strict mode.  <br>*Fix:* Replaced it with a hoisted `refreshTasks` declaration.
- [ ] **Gradient theme crash from id mismatch** `crash`
  *Symptom:* The gradient theme never applied because its checks never matched.  <br>*Cause:* Theme objects used `id:'grad'` but code checked `t.grad`.  <br>*Fix:* Changed all references to `t.id === 'grad'`.
- [ ] **Service worker cached a 404 for a later-added file** `sync`
  *Symptom:* A vendor file added after first cache stayed permanently broken.  <br>*Cause:* The service worker had cached a 404 from before the file existed and kept serving it.  <br>*Fix:* Fixed the worker/caching path so all vendor files serve correctly.
- [ ] **Monochrome theme hue not updating** `logic`
  *Symptom:* Changing the mono hue had no effect.  <br>*Fix:* Fixed the mono hue to update.
- [ ] **Schedule data-model change regression** `logic`
  *Symptom:* After changing schedule data from string to an object, consumers still reading it as a string could break (calm mode, week view, search, celebrate cards).  <br>*Cause:* Schedule model changed from string to `{t,c,done,note}` but readers of `D.sched[h]` weren't updated.  <br>*Fix:* Updated the consumers to the new object model.
- [ ] **'0/0' task counter not updating live** `ui`
  *Symptom:* The task counter stayed at 0/0 instead of reflecting progress.  <br>*Cause:* The counter wasn't refreshed after a toggle.  <br>*Fix:* Made the counter update live.
- [ ] **Both modal dialogs render on load** `ui`
  *Symptom:* Two modal sheets both showed on first boot.  <br>*Cause:* A `display:grid` CSS rule overrode the `hidden` attribute.  <br>*Fix:* Corrected the CSS so hidden sheets stay hidden and the app boots to Today.
- [ ] **Duplicate calmBtn DOM id** `ui`
  *Symptom:* Two elements shared the `calmBtn` id.  <br>*Cause:* The Today hero button reused an existing element id.  <br>*Fix:* Renamed the Today hero button to `calmStart`.
- [ ] **Kawaii theme buttons unreadable** `ui`
  *Symptom:* Kawaii-theme buttons used white ink that failed contrast.  <br>*Cause:* Light ink on light buttons.  <br>*Fix:* Applied dark ink to kawaii buttons per the contrast research.
- [ ] **Meal grid misaligns below 860px** `ui`
  *Symptom:* The meal grid broke below 860px, silently misaligning days against meals.  <br>*Cause:* Responsive grid layout failed under the 860px breakpoint.  <br>*Fix:* Fixed the grid so days and meals stay aligned at narrow widths.
- [ ] **PDF cover text overlapping** `ui`
  *Symptom:* Cover words overlaid each other on the planner's first page/PDF cover.  <br>*Cause:* Insufficient vertical spacing in the cover layout.  <br>*Fix:* Fixed spacing between title, subtitle and year, and rebuilt all 12 PDFs.

## Prompt Vault  ·  8 fixed

- [ ] **Beauty-mark descriptor produced a lip piercing** `logic`
  *Symptom:* Subject prompts rendered an unwanted lip piercing.  <br>*Cause:* The phrase 'beauty mark above the left lip' near the mouth was interpreted as a piercing.  <br>*Fix:* Changed subject descriptors to freckles/cheekbones/dimples, never a mark near the lips.
- [ ] **Ebook hyperlinks not rendered inline** `logic`
  *Symptom:* PDF link annotations weren't appearing, undercutting the 'fully hyperlinked' claim.  <br>*Cause:* reportlab requires links to be drawn inline, which the generator wasn't doing.  <br>*Fix:* Drew the links inline so the ebook is fully hyperlinked (27,993 link annotations verified).
- [ ] **Mirror-reversed, garbled on-image timestamp** `logic`
  *Symptom:* Generated mirror-selfie images produced a flipped, broken timestamp.  <br>*Cause:* Prompts let text render inside the mirror, so it came out reversed.  <br>*Fix:* Added a text-overlay clause telling the model to render on-image text as a flat, upright overlay, never inside the mirror.
- [ ] **Prompts produced generic, non-model subjects** `logic`
  *Symptom:* Users got a generic subject instead of a model-grade one.  <br>*Cause:* Only 3 of 1,480 mega prompts demanded a beautiful/model-grade subject.  <br>*Fix:* Added a subject-lock/beauty-floor transform across all mega prompts.
- [ ] **Search returned zero results** `logic`
  *Symptom:* Search returned 0 results despite the 'find anything you've ever written' claim.  <br>*Cause:* Notes, Books and Content were added without extending the search index.  <br>*Fix:* Extended the search index to include the new content types.
- [ ] **Text-fix clause injected inside the --oref placeholder** `logic`
  *Symptom:* The orientation-fix clause landed inside the [your model … --oref …] placeholder, breaking it.  <br>*Cause:* The build transform treated --oref as a trailing parameter when inserting the clause.  <br>*Fix:* Placed the orientation-fix clause at the end so the placeholder stays intact.
- [ ] **Transparent card background over content** `ui`
  *Symptom:* A card used a transparent background causing a visual glitch.  <br>*Cause:* The background was not opaque/theme-aware.  <br>*Fix:* Switched it to an opaque, theme-aware background.
- [ ] **Incorrect flat '696 pages' label** `other`
  *Symptom:* All files were labeled '696 pages' but the 2028 files are actually 697-701 pages.  <br>*Cause:* A hardcoded page count ignored leap-year and week-alignment variation.  <br>*Fix:* Corrected the per-year page-count labels.

## Hello Baby  ·  7 fixed

- [ ] **Weak recovery keys and unescaped attribute sinks** `security`
  *Symptom:* Recovery keys were brute-forceable and some attributes were unescaped (XSS risk now that spaces are shared).  <br>*Cause:* Recovery keys used weak `Math.random()`; attribute sinks were unescaped.  <br>*Fix:* Strengthened recovery-key generation and escaped the attribute sinks, in Hello Baby and the same inherited code in Happy Travel.
- [ ] **Entities deleted without confirmation** `data-loss`
  *Symptom:* Five places deleted data without asking.  <br>*Cause:* Missing delete-confirmation guards.  <br>*Fix:* Added delete confirmations to all five places plus broader edit-everything support.
- [ ] **Arrival without due date routed to wrong screen** `logic`
  *Symptom:* A baby with no due date fell into the wrong screen.  <br>*Cause:* Ordering logic mishandled a missing due date.  <br>*Fix:* Route arrival-without-due-date straight to the correct age-based screen (e.g. '3RD BIRTHDAY').
- [ ] **App showed Happy Travel nav instead of baby app** `ui`
  *Symptom:* The brand said Hello Baby but the nav showed Happy Travel's 'My Trips / Journey / Passport'.  <br>*Cause:* Leftover Happy Travel app code from the fork.  <br>*Fix:* Restored the correct baby nav (Home / Events / Babymoon & Trips / Milestones).
- [ ] **Blurry, hard-to-read wording** `ui`
  *Symptom:* Text looked fuzzy and dark numbers collided with the dark silhouette.  <br>*Cause:* A soft glow added for legibility made text fuzzy, and dark-on-dark clashed.  <br>*Fix:* Removed the glow and fixed the number/silhouette contrast.
- [ ] **Budget edits buried and unfindable** `ui`
  *Symptom:* The user couldn't find budget edits because they were buried at the bottom of the Events tab.  <br>*Cause:* Budget was nested inside Events instead of surfaced.  <br>*Fix:* Promoted Budget to its own standalone tab and added a hamburger menu.
- [ ] **Literal \n rendering escaped** `ui`
  *Symptom:* A literal `\n` was showing instead of a line break.  <br>*Cause:* Incorrect newline escaping.  <br>*Fix:* Corrected the escaping.

## Wedding Planner  ·  6 fixed

- [ ] **openpyxl StyleProxy crash on font copy** `crash`
  *Symptom:* xlsx generation failed when copying fonts.  <br>*Cause:* Assigning `.font = ws[cell].font` uses an unhashable StyleProxy.  <br>*Fix:* Apply named fonts conditionally instead of copying the StyleProxy.
- [ ] **Analysis donut rendered incorrectly** `ui`
  *Symptom:* The analysis donut chart displayed wrong.  <br>*Fix:* Fixed the donut rendering.
- [ ] **Duplicated block in wedding-party view** `ui`
  *Symptom:* The wedding party showed a duplicated half-block.  <br>*Cause:* Duplicated code lines in wed.js (caught by node --check).  <br>*Fix:* Removed the duplicate lines and converted the cramped table to readable cards + editor.
- [ ] **Filler images not loading (naturalWidth 0)** `ui`
  *Symptom:* Filler/Unsplash images failed to load (naturalWidth 0).  <br>*Cause:* Image URL handling prevented the images from loading.  <br>*Fix:* Store the image URL directly and let the `<img>` element load it.
- [ ] **Seating flow dead-ends after adding a table** `ui`
  *Symptom:* Adding a table left an empty table with no way forward.  <br>*Cause:* There was no way to seat guests into a newly added table.  <br>*Fix:* Added capacity meters, per-table '+ Seat a guest here' dropdowns, meal tallies, auto-seat and a 'still to seat' pool.
- [ ] **Nested git repo leaked into monorepo commit** `other`
  *Symptom:* A wedding-planner gitlink was committed into the BUDGETLEVELUP monorepo.  <br>*Cause:* wedding-planner has its own repo and was added as a gitlink.  <br>*Fix:* Removed the leaked gitlink from the monorepo commit.

## Breadcrumb  ·  5 fixed

- [ ] **+feature truncation swallows text and skips redaction** `security`
  *Symptom:* The `+feature` command read a fixed 60 characters, swallowing the rest of the sentence, and the swallowed text bypassed redaction (secret-leak risk).  <br>*Cause:* A fixed 60-char read plus the swallowed remainder never passing through the redactor.  <br>*Fix:* Read the full text and route it through redaction, using exact-match so tokens like `#bug` can't be swallowed.
- [ ] **Recovery codes hashed inconsistently** `auth`
  *Symptom:* Valid recovery codes could fail because hashing was inconsistent.  <br>*Cause:* Recovery codes were hashed inconsistently between generation and verification.  <br>*Fix:* Hash recovery codes consistently.
- [ ] **Docs not synced** `sync`
  *Symptom:* Docs weren't reliably persisted/synced.  <br>*Cause:* There was no synced docs store.  <br>*Fix:* Added a proper synced `docs` table and fixed the size cap.
- [ ] **Inconsistent text normalization** `logic`
  *Symptom:* Normalization behaved inconsistently across paths.  <br>*Cause:* Normalization logic differed between code paths.  <br>*Fix:* Made normalization consistent.
- [ ] **srcdoc iframe thumbnails render blank** `ui`
  *Symptom:* Prompt thumbnails showed blank.  <br>*Cause:* `loading="lazy"` on srcdoc iframes plus a `height:200%` that never resolved against an aspect-ratio height.  <br>*Fix:* Removed lazy loading, set srcdoc as a property, and deferred one frame so thumbnails render.

## Ever After  ·  5 fixed

- [ ] **Service worker pins returning users to old build** `sync`
  *Symptom:* Returning visitors saw stale builds — old splash rings, white space under content, and a mis-sized rainbow ring.  <br>*Cause:* The root `/` navigation was served cache-first, pinning users to a stale index.html.  <br>*Fix:* Made navigations network-first and bumped the cache version to purge stale caches; the identical bug was also fixed in Planner Studio.
- [ ] **Join boot race gives joiners the wrong cloud key** `race`
  *Symptom:* Users joining a shared space were given their own cloud key and shown the wrong 'your key' popup.  <br>*Cause:* Two boot-time races in the share/join flow.  <br>*Fix:* Fixed the boot races so joiners use the correct shared key and popup.
- [ ] **Choose-a-photo box shows literal ${imgIconSVG(34)}** `ui`
  *Symptom:* The photo-picker box displayed the literal text `${imgIconSVG(34)}` (plus a fallback clock glyph) instead of an image icon.  <br>*Cause:* `imgIconSVG(34)` was inside a single-quoted string (wed-data.js:15), so it wasn't evaluated.  <br>*Fix:* Broke out of the single-quoted string to call imgIconSVG so a real image icon renders.
- [ ] **tvPhoto icon printed as literal text** `ui`
  *Symptom:* `${IMG_ICON(32)}` showed as literal text in tvPhoto instead of the icon.  <br>*Cause:* The placeholder sat inside a single-quoted string, so it wasn't interpolated.  <br>*Fix:* Built the string with concatenation so IMG_ICON is actually called.
- [ ] **Corrupted emoji entry** `other`
  *Symptom:* One corrupted emoji entry had slipped into the data.  <br>*Cause:* Malformed emoji entry.  <br>*Fix:* Corrected the emoji entry.

## Listing Lab Pro  ·  5 fixed

- [ ] **SSRF via /api/open and /api/fetch** `security`
  *Symptom:* Server-side fetch endpoints could be pointed at arbitrary internal hosts.  <br>*Cause:* The browser-open/fetch paths had no host allowlist.  <br>*Fix:* Added a host allowlist to /api/open and /api/fetch in worker.js.
- [ ] **XSS in Listing Lab render path** `security`
  *Symptom:* Untrusted content could execute script in Listing Lab.  <br>*Cause:* Unsanitized input rendered into the page.  <br>*Fix:* Applied output sanitization to close the XSS vector.
- [ ] **AI misattributed quotes between listings** `logic`
  *Symptom:* The analyzer attributed one listing's quote to a different listing.  <br>*Cause:* The prompt allowed cross-listing bleed when run on many listings.  <br>*Fix:* Tightened the prompt and re-ran 10 listings to confirm correct attribution.
- [ ] **Digit confusion when reading listing images** `logic`
  *Symptom:* Digits were misread from images.  <br>*Cause:* No image preprocessing before digit recognition.  <br>*Fix:* Added proper image preprocessing and generalized the digit-confusion fix.
- [ ] **Scraper pulled related-item ads and foreign shops** `logic`
  *Symptom:* Analyses were polluted by related-item ads and other shops' listings, which would have produced wrong results.  <br>*Cause:* The scraper didn't filter related-item ads or restrict to the listing's own shop.  <br>*Fix:* Filter out related-item ads and keep only the dominant shop, detected via the shop ID embedded in image URLs.

## Social LevelUp  ·  4 fixed

- [ ] **XSS via paste into contenteditable notes editor** `security`
  *Symptom:* Pasting HTML into the notes editor could inject script.  <br>*Cause:* Contenteditable paste was unsanitized (same class as Trix CVE-2024-53847).  <br>*Fix:* Sanitized pasted content in the notes editor and applied the same fix to the budget app's notes editor.
- [ ] **cur0 is not defined crash on post save** `crash`
  *Symptom:* Saving a post with income entered crashed the app.  <br>*Cause:* An undeclared identifier (cur0) was referenced during post-save.  <br>*Fix:* Guarded with a typeof money0 check so income posts save cleanly.
- [ ] **Older profiles crash on missing state fields** `crash`
  *Symptom:* Profiles created before new features crashed on load.  <br>*Cause:* normalize() did not backfill newly added state fields.  <br>*Fix:* Backfilled the new state fields in normalize() so old profiles load.
- [ ] **To-do done button crash** `crash`
  *Symptom:* Clicking a to-do's done button threw undefined.split.  <br>*Cause:* The attribute was written as data-tododone but read as dataset.todoDone (case mismatch).  <br>*Fix:* Aligned the dataset key naming so the done button reads correctly.

## Unknown  ·  1 fixed

- [ ] **Screenshot box completely unstyled** `ui`
  *Symptom:* A box looked cheap because it had no styling at all.  <br>*Cause:* The element rendered completely unstyled.  <br>*Fix:* Applied proper styling to the box.
