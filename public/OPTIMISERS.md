# ✨ Optimisers — elevations worth reusing

107 reusable patterns (design elevations, UX, performance, workflow…) mined from the build history. Not bugs — things that made an app *better*.

## design elevation (21)

- **One-shot entrance animations (never re-animate on refresh)** _(Bug Ledger)_
  Put entrance animations on a one-shot class that is stripped after it plays, not on the base element.
  <br>*Why:* Moving or re-inserting a DOM node restarts its CSS animation — so a live board re-fades every poll and 'blinks every second'.
  <br>*How:* .card.enter{animation} then removeClass after ~600ms; and only touch the DOM order when the sorted order actually changed.
- **Aurora-glass design language** _(cross-cutting)_
  Soft near-white canvas + slowly drifting aurora gradient blobs + frosted-glass cards + a single warm accent (coral) + big rounded type.
  <br>*Why:* Reads as premium and high-end, and keeps every app in the portfolio visually coherent.
  <br>*How:* A fixed, blurred aurora layer of 3–4 radial-gradient blobs with a slow drift keyframe; cards use rgba white + backdrop-filter blur + hairline border + soft shadow.
- **Theme-aware from the first line** _(cross-cutting)_
  Design light and dark together with CSS variables and prefers-color-scheme, not as an afterthought.
  <br>*Why:* Respects the viewer's system and avoids a jarring bright flash in dark environments.
  <br>*How:* :root design tokens + a single @media (prefers-color-scheme: dark) override block; test both before shipping.
- **Premium inputs & micro-interactions (no native dialogs)** _(Planner Studio)_
  Replace native prompt()/alert()/confirm() with in-app modals; add smooth press states, hairline borders, subtle fills.
  <br>*Why:* Native browser dialogs look broken and cheap; micro-polish signals quality.
  <br>*How:* Custom modal/toast components; :active transitions; consistent radius and spacing tokens.
- **Balanced editorial layout — no orphaned whitespace** _(Hallalu Bookings)_
  Structure a section as a full-width strip + an aligned card grid so rows line up and nothing is left 'stranded' in one column.
  <br>*Why:* 'Left over, not placed' whitespace is exactly what reads as unfinished/cheap.
  <br>*How:* Full-bleed gallery strip (6→3→2 across) then a 2×2 grid (About·Testimonials / FAQ·Policies); a full-bleed strip becomes its own fold.
- **Editorial typography: serif display + tabular numerals** _(Hopefil)_
  Serif display headlines, ledger/tabular numerals, caps-tracked labels, intentional whitespace, layered depth (soft shadow + blur), restraint over flash.
  <br>*Why:* This is the consensus 2026 'premium' ingredient list; it reads as considered and expensive.
  <br>*How:* Serif for headings/commerce, tabular-nums for figures, 2-line clamps on overlays; restraint, not more effects.
- **Glassmorphism with restraint (floating chrome only)** _(Hallalu CRM)_
  Use frosted glass selectively — on floating chrome (modals, aha hero), not on every surface.
  <br>*Why:* Glass everywhere muddies legibility and stops reading premium; restraint is the premium signal.
  <br>*How:* A dedicated .glass class for floating elements; opaque premium cards elsewhere.
- **Premium SVG icons instead of emoji in chrome** _(cross-cutting)_
  Replace bright emoji in nav/tools/buttons with a coherent inline-SVG icon set.
  <br>*Why:* Emoji-as-chrome reads amateur; a stroke-consistent icon set reads like a real product.
  <br>*How:* Inline SVG, ~1.6 stroke, currentColor so icons inherit theme; one consistent set across the app.
- **Real editorial imagery, never stock people** _(Hopefil)_
  Bundle a small in-house image library (no people, no text, one soft-light style) and hide any tile whose image fails.
  <br>*Why:* Stock-people photos make apps generic; a broken image is worse than none.
  <br>*How:* Generate/curate a few consistent images; a broken-image fallback that hides the tile so a 404 never shows.
- **Bento hierarchy + gradient washes + real photography** _(Stitchhooky)_
  Compose with a bento grid, gentle gradient washes and genuine subject photography for a high-end look.
  <br>*Why:* This is the '$100k look' — clear hierarchy and real texture instead of flat boxes.
  <br>*How:* Bento tiles with varied sizes, soft gradient backgrounds, real photos over placeholder blocks.
- **Frosted-glass device bezel for previews** _(Hallalu CRM)_
  Frame a live preview in a translucent glass device edge, not a thick black slab.
  <br>*Why:* The black bezel looks like a placeholder; frosted glass looks designed.
  <br>*How:* Translucent edge + soft highlight/shadow + subtle notch + a 'LIVE PREVIEW' caption.
- **Layout diversity by content type** _(Hopefil)_
  Give different content modes genuinely different anatomies, not one template recolored.
  <br>*Why:* Two prompts should produce two visibly different products; sameness reads as a wrapper.
  <br>*How:* Editorial = quiet grouped rows + stat strip (no hero); imagery-led = photo card grid; commerce = its own.
- **Shareable summary cards that market the app** _(Planner Studio)_
  Generate a beautiful downloadable month/year card with kind, encouraging analysis and the app URL in the footer.
  <br>*Why:* It delights the user and markets the app every time it's shared.
  <br>*How:* Canvas card: colour ribbon, stat tiles, one warm encouraging line, app URL footer.
- **Uniform pill pickers (avoid flex:1 ballooning)** _(Finished.)_
  Make a format/segmented picker natural-width uniform pills, not flex:1 chips.
  <br>*Why:* flex:1 makes buttons stretch and the last wrap-row balloon — visibly broken.
  <br>*How:* Non-stretching pills, uniform height, one icon each, a single accent on the selected one.
- **Never flatten a signature boot/splash animation** _(Aprizely)_
  Keep a signature animated splash (e.g. rainbow aurora) animated — don't 'optimize' it to a static image.
  <br>*Why:* The boot moment is a brand signature; making it static quietly cheapens the whole app.
  <br>*How:* Preserve the keyframes; respect prefers-reduced-motion instead of removing it.
- **Graceful filler imagery that vanishes on real upload** _(Hallalu CRM)_
  Cover, portrait, service thumbnails and a photo gallery fall back to tasteful stock images (seeded by the page slug so they stay stable) and adapt to fewer photos than the demo; fully editable
  <br>*Why:* Empty grey image boxes read as broken; stable placeholders keep the preview presentable and disappear the moment the user adds their own
  <br>*How:* Seed placeholder URLs deterministically from the slug; render placeholders only when the user's own field is empty; make the gallery a real add/remove editor
- **Heirloom hand-down account (recovery key = ownership transfer)** _(Hello Baby)_
  The whole account is designed to be handed to the child later as an 18th-birthday keepsake, made literally true because the cloud data is gated only by a portable recovery key
  <br>*Why:* Turns a planner into a keepsake, a genuinely novel emotional moat no ad-funded incumbent offers
  <br>*How:* Keep all cloud data behind a single transferable recovery key (no email-locked account); surface 'one day, hand them the key' in-app
- **Era-aware app that grows with the user** _(Hello Baby)_
  One countdown that rolls itself from due-date to 1st/2nd/3rd birthday and re-labels content by era; setup offers 'expecting' vs 'baby already here' vs 'adopting/arrival day'
  <br>*Why:* Extends product lifespan far beyond the ~9-month window competitors churn at, and serves adjacent segments
  <br>*How:* Drive labels and prompts off a computed life-stage rather than a single fixed mode; branch onboarding into the relevant era
- **Personal photo as full-bleed wallpaper while themes keep the accents** _(cross-cutting)_
  Users set their own photo as a 100%-cover background with an adjustable readability veil, while the theme still drives buttons/nav/accent colours on top
  <br>*Why:* Deep personalization without sacrificing legibility or the design system
  <br>*How:* Fixed background-size:cover layer + themed veil slider; per-section override falling back to global photo; run every url() through a scheme-allowlist sanitizer
- **Self-building storybook timeline from a single anchor date** _(cross-cutting)_
  A dashed spine that auto-generates dated chapters from one date, weaves the user's own photo-moments in chronologically, and floats a pulsing 'you are here' marker; reused across Ever After, Happy Travel, Hello Baby
  <br>*Why:* Turns flat data into an emotional, anticipatory narrative and is highly reusable
  <br>*How:* Derive chapter dates from the anchor, mark past entries done and soften future ones, merge user moments by date, add a live position marker
- **Concentric closeness rings ('atom') for relationship maps** _(Hello Baby)_
  Places the subject at centre and auto-orbits people onto rings by closeness, with rings fading outward, even spacing per ring, staggered spokes, and a legend
  <br>*Why:* Communicates relationship closeness at a glance far better than a flat grid
  <br>*How:* Map each role to a ring radius, distribute members evenly with a per-ring angular offset so nobody stacks, dim guide circles with distance

## UX (20)

- **Live progress counter for long tasks (N / total)** _(Bug Ledger)_
  Stream a running 'checked N / total' counter for long agent work so the user sees exactly where it reached.
  <br>*Why:* Transparency and watchability build trust; a silent long task feels stuck.
  <br>*How:* Carry progress {done,total,label} on the session; update it every step; show it as a big number + a bar on a live board.
- **Empty states as first-class design** _(Bug Ledger)_
  Design the 'nothing here yet' state beautifully with a clear next action, not a blank page.
  <br>*Why:* First impressions and guidance — most people see the empty state first.
  <br>*How:* A calm, centered message on the same aurora background, naming the exact command/step that will fill it.
- **Full date + timestamp on records (not just relative time)** _(Bug Ledger)_
  Show the full date and time to the second on activity and audit entries.
  <br>*Why:* Auditability — 'when exactly did this run?' matters for a record.
  <br>*How:* Format as 'DD Mon YYYY, HH:MM:SS'; keep relative time only for the currently-live item.
- **Confirm-first for destructive or outward actions** _(cross-cutting)_
  Deletes, sends, and voice/agent commands confirm before acting.
  <br>*Why:* Prevents irreversible mistakes and builds trust in automation.
  <br>*How:* A confirm step (or undo window) before any send/delete; never auto-fire outward actions.
- **Onboarding: 1–2 fields per screen** _(Stitchhooky)_
  Ask one or two fields per onboarding screen, never a wall of inputs.
  <br>*Why:* The first session is where 70–90% of users are lost; density kills completion.
  <br>*How:* One question per step; progressive disclosure; the PIN/passcode can double as a later lock code.
- **Endowed-progress onboarding** _(Hallalu CRM)_
  Show the user already partway along the onboarding path rather than starting at zero.
  <br>*Why:* Endowed progress lifts completion (34% vs 19%, Nunes & Drèze) and time-to-value under 5 min drives activation.
  <br>*How:* Pre-fill/first-step-done state; a progress indicator that starts a notch in.
- **Blank start + explorable demo (kept separate)** _(Hallalu CRM)_
  New users land in their own empty workspace; a rich demo is a separate, clearly-labelled choice.
  <br>*Why:* Mixing demo data into a real account confuses ownership and pollutes the user's space.
  <br>*How:* 'Start my own' → empty studio; 'Explore a demo' loads seeded data in a distinct mode.
- **One-tap row actions; confirm routine, danger card destructive** _(Hallalu Bookings)_
  Each row gets one-tap actions; routine actions show a small confirm, destructive ones a distinct danger card that never auto-runs.
  <br>*Why:* Speed for the common case, a deliberate stop for the irreversible one.
  <br>*How:* Danger card for cancel/delete with a match picker when several items fit; never auto-execute.
- **'New since last visit' + repeat-client cues** _(Hallalu Bookings)_
  Badge items that arrived since the last visit and flag returning clients.
  <br>*Why:* Reviewers explicitly want at-a-glance 'what's new' and client history one tap away.
  <br>*How:* 'New' badges keyed to last-seen timestamp; '2nd visit' chips + one-tap client notes.
- **Honest labor steps instead of spinners** _(Hallalu CRM)_
  Show the real named steps of a long operation instead of an opaque spinner.
  <br>*Why:* Itemised 'labour' feels faster and more trustworthy than a mystery spinner.
  <br>*How:* Render each step as it runs ('reading transcript… drafting… saving'), not a single loader.
- **Auto-update bar — never run a stale build** _(Hallalu CRM)_
  Any open tab checks for a newer deploy and offers a one-tap refresh.
  <br>*Why:* Users otherwise sit on an old bundle after you ship a fix.
  <br>*How:* On focus/interval, compare a build stamp; show a 'Refresh' bar when a newer one is live.
- **Cancel symmetry (FTC click-to-cancel)** _(Stitchhooky)_
  Let users cancel in the same sheet where they signed up, effective at period end.
  <br>*Why:* It's the FTC click-to-cancel standard and it builds trust; asymmetric cancellation feels like a trap.
  <br>*How:* One-tap cancel in the upgrade/billing sheet; confirm effective-at-period-end.
- **Streaks with mercy (never shame)** _(Stitchhooky)_
  Reward streaks but never shame a miss.
  <br>*Why:* The 'abstinence-violation effect' makes people rage-quit after one slip.
  <br>*How:* Forgiving streaks/grace days; encouraging copy on a miss, never punitive.
- **User-customizable data grid (reorder, resize, persisted, delete-confirm)** _(Aprizely)_
  A spreadsheet view where users drag to reorder columns, drag borders to resize, edit cells inline, and delete rows with a confirm — layout persisted per user
  <br>*Why:* Turns a static table into an Airtable/Excel-grade tool people can shape to their own workflow
  <br>*How:* Layout-driven column model with a colgroup, drag handles on headers, resize handles on borders, width/order saved per-user, native confirm on row delete
- **In-app device-framed live preview of the real public page** _(Hallalu CRM)_
  A booking Overview tab shows the actual public booking page rendered inside a phone/desktop frame (with a device toggle + QR), driven by the real template and the user's current data
  <br>*Why:* Users otherwise never see their public-facing page without publishing and opening it in a new tab
  <br>*How:* Render the same public template with current state into an iframe/frame; add a device-size toggle and reuse the existing QR helper
- **Loss-sensitive 'quiet pause' path (stop the cheerful nagging)** _(Hello Baby)_
  A pause control that halts all weekly prompts/countdowns with an optional private note, shows 'the countdown is resting', and replays the note before resuming, plus a 'close this chapter quietly' option
  <br>*Why:* Pregnancy/period apps are widely criticised for firing celebratory notifications after a loss; almost nobody designs the graceful exit
  <br>*How:* Add a pause state that suppresses time-based prompts, stores an optional user note, and offers a no-fanfare close; keep all data intact
- **Write-in custom categories via datalist beat fixed dropdowns** _(Budget LevelUp)_
  Replaced fixed <select> category pickers (subscription/asset/debt/bank/card) with <input list=...> datalists — suggestions plus free write-in.
  <br>*Why:* Every user's real-world categories differ; a closed dropdown forces mislabeling into 'Other'.
  <br>*How:* One reusable datalist helper feeding an <input list>; keep the common suggestions, allow anything typed.
- **New users get a light scaffold, not seeded sample data** _(Budget LevelUp)_
  Defaults ship as empty category templates (zero sample entries); a landing 'Try the demo' button and ?demo=1 load rich example data, with a one-tap 'Start fresh'.
  <br>*Why:* Seeding fake entries into a real account makes users delete demo data before they can trust their own numbers.
  <br>*How:* Keep structural scaffolding in defaults; move all example rows into loadExample(); gate demo behind an explicit action.
- **Request ratings/reviews only after a genuine win — never at friction points** _(cross-cutting)_
  Never prompt on first launch, during onboarding, after an error, or in the middle of a paywall. A frustrated user handed a rating prompt gives you the one-star you spend months digging out of.
  <br>*Why:* Review timing determines review score more than product quality does at the margins; asking at a low-goodwill moment manufactures your own bad ratings.
  <br>*How:* Trigger the ask only after a detectable success moment (streak milestone, project completed, export finished), rate-limit it, and suppress it entirely for N days after any crash, failed payment, or support contact.
- **Lean core by default, advanced features progressively revealed** _(cross-cutting)_
  Ship the everyday jobs (add a contact, log a note, book, invoice) front-and-centre and tuck configuration, custom fields, automations and analytics behind an 'advanced' reveal.
  <br>*Why:* Most small businesses use less than half their CRM's features and roughly a third abandon within a year over complexity — 'too complicated' is the #1 SMB churn reason. Simplicity is the retention feature.
  <br>*How:* Default new accounts to a minimal surface, gate power features behind a clearly labelled toggle/section, and let complexity grow only as the user reaches for it.

## performance (4)

- **In-place DOM updates for live views (diff, don't re-render)** _(Bug Ledger)_
  Update existing nodes field-by-field each poll and animate only what changed, instead of rewriting innerHTML.
  <br>*Why:* Wholesale re-render flickers, drops scroll/focus, and replays animations.
  <br>*How:* Keep a refs map per card; compare to last state; mutate only changed text/classes; add a transient 'pop' class on the item that just completed.
- **Network-first HTML in service workers** _(cross-cutting)_
  Serve navigations network-first (or bump the cache name every deploy) so shipped fixes aren't masked by a stale cached shell.
  <br>*Why:* Cache-first service workers pin returning users to an old build — a bug that recurred across many apps.
  <br>*How:* Network-first fetch handler for document requests; version the cache name on each release.
- **INP is now the most-failed Core Web Vital — break up long tasks** _(cross-cutting)_
  INP (replacing FID) scores the worst interaction latency; 43% of sites fail the 200ms bar in 2026. Any task >50ms blocks the main thread and delays taps/clicks.
  <br>*Why:* Heavy synchronous render/parse work on interaction makes the UI feel janky and now directly hurts search ranking.
  <br>*How:* Chunk long JS with await/yield (scheduler.yield or setTimeout), debounce/throttle scroll+resize, use passive listeners, move heavy compute to a Web Worker, avoid forced synchronous layout.
- **Budget edge-storage access: batch and chunk, never N+1 in a loop** _(cross-cutting)_
  Treat every D1/KV/R2/fetch call as a metered subrequest with hard caps (100 bound params per D1 statement, per-invocation subrequest limit). Design writes and reads to stay well under them.
  <br>*Why:* AI codegen writes per-row queries and giant multi-row inserts that pass on demo data and then hit 'too many SQL variables' or 'too many subrequests' under real volume — a silent scaling cliff.
  <br>*How:* Use db.batch([...]) in one transaction; keep (rows x cols) under 100 placeholders per statement and chunk beyond that; replace N+1 loops with a single JOIN or bulk read; cache repeated fetches; push large fan-out to Queues/Workflows.

## workflow (10)

- **Paste-and-go, zero-question agent prompts (self-install, never interrogate)** _(Breadcrumb)_
  An agent prompt that self-installs its CLI silently, streams if the key is present, and carries on quietly if not — never stopping to ask the user.
  <br>*Why:* Interrogation kills the 'automatic' feel. One-time machine setup + paste-and-go everywhere is what made Bug Ledger feel effortless.
  <br>*How:* Serve the CLI from a public URL so it installs with a single curl; read the key from a small key file (no shell-profile dependency); tell the agent to self-heal silently and NEVER 'stop and ask' when something is missing.
- **Write a world-class mandate + house rules into the repo** _(Hopefil)_
  Put the quality bar and build conventions in a repo doc every future feature must meet.
  <br>*Why:* It keeps standards from drifting across sessions and agents.
  <br>*How:* A BUILD.md standing rule (editable-everything, delete-confirm, glass, timestamps, local-first, both themes, verified in-browser).
- **Deep-research with counter-evidence before design decisions** _(cross-cutting)_
  Research a design/product decision against sources AND actively seek counter-evidence before committing.
  <br>*Why:* Trend-following without counter-evidence ships generic or wrong choices (e.g. 'is glassmorphism still premium in 2026?').
  <br>*How:* A short research pass that cites sources and the case against; then decide.
- **Device-link key provisioning (no secret pasted into chat/transcript)** _(cross-cutting)_
  When an agent CLI has no key, it prints a short Approve link; the signed-in user clicks Approve once and the CLI polls, self-provisions its key to a local file, and starts streaming
  <br>*Why:* Pasting a raw key into an agent chat leaves the secret in the transcript; a one-click device link is easier and safer
  <br>*How:* A device_codes table, a public /link/<code> approval page (401->sign-in-first guard), start/poll endpoints, and a cookie-authed approve; the CLI polls until approved then writes the key locally
- **Per-item reminder scheduling, not one global notification time** _(cross-cutting)_
  A top request for habit/tracker apps: different habits need different reminder times. Users want the water reminder hourly and the journaling reminder at 9pm — not both on one global schedule.
  <br>*Why:* A single app-wide reminder time makes reminders useless for everything except one habit, so users disable notifications entirely and then churn from forgetting.
  <br>*How:* Attach an optional schedule to each trackable item (times of day, days of week, frequency), default to sensible per-type suggestions, and let the user mute one item's reminders without silencing the app.
- **Smoke-test the core user loop before every deploy** _(cross-cutting)_
  'An update that broke the core feature' is one of the universal 1-star patterns: the one thing people relied on stopped working and the next release didn't bring it back.
  <br>*Why:* A regression in the primary verb (save an entry, log a habit, check out, count a stitch) churns your most engaged users instantly and floods reviews.
  <br>*How:* Keep a tiny checklist/automated smoke test of the core loop (sign in, create, edit, save/sync, reload-and-still-there, export) and run it against the built artifact before shipping. Never deploy a build where the core loop is red.
- **No-show protection: deposit or card-on-file with a fair policy** _(Hallalu Bookings)_
  Let owners require either a partial deposit (deducted from the final bill) or a card-on-file only charged on a late-cancel/no-show, paired with a plain cancellation policy shown before the client confirms.
  <br>*Why:* No-shows are the top revenue leak for appointment businesses; salons/spas using deposits report large drops. Card-on-file is more palatable because clients don't part with money upfront but know there's a consequence.
  <br>*How:* Per-service toggle (deposit amount or card-hold), surface the policy on the confirm step, and support a gradual rollout (new clients and weekend slots first). Never auto-charge without showing the agreed policy.
- **Automated appointment reminders (24-48h before)** _(Hallalu Bookings)_
  Send an automatic reminder 24-48 hours ahead with a one-tap confirm/reschedule link, then optionally a shorter same-day nudge.
  <br>*Why:* Automated reminders alone cut no-shows substantially — the highest-leverage, lowest-friction lever a booking tool has.
  <br>*How:* Schedule reminders on booking creation (email always, SMS/WhatsApp where a number exists), include reschedule and cancel links so a can't-make-it frees the slot, and let the owner edit timing and copy.
- **Buffer time between appointments** _(Hallalu Bookings)_
  Let owners set a configurable gap (travel, cleanup, notes) before/after each service so the next slot can't be booked back-to-back.
  <br>*Why:* Back-to-back bookings with no breathing room cause cascading lateness and de-facto double-booking complaints; buffers are frequently demanded and absent from lightweight tools.
  <br>*How:* Per-service before/after buffer minutes, subtracted when computing open slots, enforced in the same server-side availability check that prevents conflicts.
- **Invoice aging + auto-chase + 'viewed' receipts** _(cross-cutting)_
  Give every invoice a live status (draft/sent/viewed/due/overdue/paid), group outstanding ones into aging buckets, and send polite automatic reminders on a user-controlled schedule.
  <br>*Why:* Most freelancers are owed money at any time and describe chasing as a nightmare; they lack a way to see what's paid, due, or lost in a client's inbox.
  <br>*How:* Track a viewed timestamp (hosted invoice link open), show an aging dashboard, and let users enable auto-reminders at due-date, +7, +14 days with editable wording.

## architecture (7)

- **Marketing landing at root, app at /app** _(Hallalu CRM)_
  Serve a marketing landing at the root and the app at /app; returning users skip the landing.
  <br>*Why:* New visitors get a pitch; existing users aren't slowed by it.
  <br>*How:* Root = landing; /app = product; redirect onboarded users straight to /app.
- **Least-privilege + human-in-the-loop for AI agents** _(cross-cutting)_
  Give AI features only the tools/permissions they need and require approval for irreversible/outward actions.
  <br>*Why:* Excessive agency is an exploitable attack surface (OWASP LLM).
  <br>*How:* Scope tokens/tools per task; confirm before send/delete/purchase; log agent actions.
- **OAuth token never touches the browser — server-side exchange + proxied API calls** _(cross-cutting)_
  For third-party sign-in, the Worker swaps the OAuth code for a token using the client secret, stores it server-side per user, and proxies every API call so the page reads private data without holding a credential
  <br>*Why:* A leaked client-held token exposes the user's private third-party data; server-side + proxy makes leakage structurally impossible
  <br>*How:* Worker routes /oauth/start and /oauth/callback (secret in env), a tokens table, and /api/<provider>/* proxy endpoints gated by the session cookie; browser only calls your own proxy
- **Defensive per-item rendering so one bad record can't blank a whole view** _(cross-cutting)_
  A single malformed record (a string where an array was expected) threw and blanked an entire list view
  <br>*Why:* Lists that render items in one unguarded pass are fragile — one corrupt row takes down everything
  <br>*How:* Wrap/guard each item's render independently so a bad record degrades to a skipped/placeholder entry instead of aborting the list
- **Server-enforced role-based share links (no accounts)** _(Happy Travel)_
  Collaboration via copyable editor/viewer/admin links backed by worker share-tokens: viewers rejected server-side (403) on writes, only super-admin can grant admin or revoke, revoked links die instantly
  <br>*Why:* Canva/Docs-style multi-user editing without forcing accounts, with authorization enforced on the server not the client
  <br>*How:* Mint role-scoped tokens in a Worker/KV; check role server-side on every mutating endpoint; keep recovery key only with owner
- **Security headers belong in _headers, not the Worker, for static assets** _(cross-cutting)_
  On Cloudflare, static assets are served directly at the edge and bypass the Worker's fallback handler, so header injection written in the Worker never runs on asset responses.
  <br>*Why:* Teams add CSP/security headers in the Worker, verify one JSON route, and ship — while every actual HTML/asset response still goes out bare.
  <br>*How:* Put security headers in a public/_headers file (or the assets config); verify with a GET on a real asset URL, not a HEAD on the API.
- **Split static-asset routing from the SPA fallback (and auto-recover)** _(cross-cutting)_
  Requests for hashed assets must 404 when missing — never fall through to index.html — and index.html must be served no-cache while assets are immutable-cached.
  <br>*Why:* Serving index.html (200 text/html) for a missing .js chunk turns a routine deploy into a white-screen ChunkLoadError for users with the page already open or a stale service worker.
  <br>*How:* In the Worker, match asset extensions first and return the asset or a real 404; only unknown non-asset paths get the SPA shell. Set Cache-Control: no-cache on the HTML, immutable long max-age on hashed assets, and add a one-time hard-reload recovery on failed dynamic imports.

## accessibility (4)

- **Reduced-motion + aria-labels on icon buttons** _(Hallalu Bookings)_
  Honor prefers-reduced-motion and label every icon-only button.
  <br>*Why:* Accessibility and polish; motion-sensitive users and screen readers both need it.
  <br>*How:* @media (prefers-reduced-motion) to cut animation; aria-label on each icon button.
- **iOS-safe input spec: style :not([type]), 16px font, 44px target** _(cross-cutting)_
  Add input:not([type]) so type-less boxes can't fall through to the default grey control, set 16px font on phones to stop iOS tap-to-zoom, enforce 44px min height per Apple HIG
  <br>*Why:* Type-less inputs silently escaped every input[type=...] rule (a real 'unstyled box' bug), and sub-16px fields trigger auto-zoom on iOS
  <br>*How:* Include :not([type]) in the input rule set, bump font-size to 16px at mobile widths, apply min-height:44px, scope dense-view overrides explicitly
- **Six fixes clear 96% of accessibility failures** _(cross-cutting)_
  Low-contrast text (83.9% of pages), missing alt text (53%), missing form labels (51%), empty links (46%), empty buttons (31%), and missing document lang (14%) account for 96% of detected WCAG errors.
  <br>*Why:* These exclude real users (and drive ADA/EAA lawsuits) yet are all caught by free automated scanners — cheap, high-leverage wins.
  <br>*How:* Enforce 4.5:1 text contrast (3:1 large), alt on every meaningful image, a <label> for every input, text/aria-label on every link+button, and <html lang> set.
- **Respect system font scaling / Dynamic Type — never cap text size** _(cross-cutting)_
  Apps that ignore the device's font-size setting force low-vision and older users to pinch-zoom or leave; a large majority of surveyed users say accessibility barriers significantly hurt their mobile experience.
  <br>*Why:* Fixed pixel type and hard-coded heights silently exclude a large share of real users (seniors, low vision, situational strain) and invite ADA-style complaints — while costing nothing to get right.
  <br>*How:* Size text in rem/relative units tied to the root, let containers grow with content, and test the whole UI at ~200% zoom / largest system font. No pixel-locked font sizes on body copy, and no clipping when text scales up.

## copy (5)

- **Source-verified stats only (ban folklore)** _(Hallalu CRM)_
  Only show a statistic you can cite to a primary source; ban unsourced 'best practice' numbers.
  <br>*Why:* Credibility — one bogus stat undermines the whole product.
  <br>*How:* Keep a small vetted stats bank; no number ships without a citation.
- **Replace fabricated metrics with honest editable badges** _(Hallalu Bookings)_
  Never ship invented performance numbers; use honest, editable placeholders.
  <br>*Why:* Fake '0.38s load / top 1% conversion' metrics destroy trust the moment they're noticed.
  <br>*How:* Editable badge components with truthful defaults; no unverifiable claims baked in.
- **Restraint as the premium signal** _(Hopefil)_
  State value with restraint ('plans are simply the better rate') instead of pushy gating.
  <br>*Why:* Understatement itself reads premium; hard-sell reads cheap.
  <br>*How:* Calm, factual value copy; no dark-pattern nudges or fear-based gating.
- **Click-to-understand plain-English step notes for agent actions** _(cross-cutting)_
  Each agent-logged task/step carries a one-line description of what it does, why, and its effect; users tap a step to read it
  <br>*Why:* Non-technical users can follow exactly what an agent is doing without reading code or jargon
  <br>*How:* CLI accepts Task::description in --tasks and a --desc flag on step/done; the live board, report timeline, and activity items expose an expandable info affordance
- **Humane notifications — no guilt-trip copy, capped frequency, quiet by default** _(cross-cutting)_
  Notifications have drifted from helpful nudges to emotional manipulation ('We miss you! Keep your streak alive'). Users report coming to hate apps that shame them; capping alerts to roughly 3/day reduced stress in research.
  <br>*Why:* Guilt-based nudges spike short-term opens but drive long-term disengagement and 'this app makes me anxious' reviews — the opposite of intended habit formation.
  <br>*How:* Write encouraging, blame-free copy (never 'you failed'). Cap total notifications per day, ship granular per-category toggles, default anything non-essential to off, and offer quiet hours. Frame returns as welcome, not owed.

## conversion (6)

- **Show-but-lock gated features instead of hiding them** _(Hallalu CRM)_
  Premium (Business-tier) rooms stay visible to every user with a lock badge in the nav/menu; clicking opens an upgrade wall rather than the feature
  <br>*Why:* Hidden features can't sell themselves — showing the locked feature lets users see exactly what they'd gain
  <br>*How:* One BIZ_VIEWS set drives three gates consistently: nav lock badge, mobile-menu lock, and a render-level upgradeWall on the view
- **Time-gated content reveal with an 'unlocks soon' teaser** _(Hello Baby)_
  Only arrived weeks appear plus one locked teaser card ('unlocks Saturday - in 4 days')
  <br>*Why:* Creates a weekly reason to return and an anticipation loop, rather than dumping all content up front
  <br>*How:* Compute each entry's unlock date from an anchor; render passed entries, hide future ones, show one next-up locked teaser with countdown
- **One-time purchase over subscription for privacy-first products, with giftable unlock codes** _(cross-cutting)_
  A single ~$29.99 unlock instead of a recurring fee, with Stripe promo codes, account-after-paying, and single-use gift codes so it can be gifted
  <br>*Why:* A recurring charge contradicts a 'no ads, buy once, hand it down' privacy pitch and loses to churn on a short use arc; buy-once matches Etsy expectations and is giftable
  <br>*How:* Stripe Checkout -> webhook mints a single-use code -> redeem deep-link flips entitlement; lead the listing with 'Buy Once - No Subscription'
- **Honest free tier — don't gate the core loop behind a surprise paywall minutes in** _(cross-cutting)_
  Across thousands of 1-3 star reviews the #1 pattern is 'free that turns into a paywall': the listing leads with free, then locks the thing the user opened the app to do within minutes.
  <br>*Why:* The lowest-rated apps rarely fail on idea — they fail because the way they ask for money doesn't match what users thought they agreed to. Bait-paywalls burn the goodwill you need for retention and reviews.
  <br>*How:* Let the core loop (log a habit, write an entry, track a stitch, build a budget) work for free indefinitely. Charge for depth/scale/convenience, never for the primary verb. State the free/paid line plainly on the first screen that hints at cost.
- **Deliver first value before asking users to sign up or pay** _(cross-cutting)_
  Onboarding-abandonment and paywall complaints share a root: apps demand an account (or a card) before the user has felt anything work.
  <br>*Why:* Time-to-value beats commitment-up-front. A user who has already created something real is far likelier to register to save it than one asked to commit to a stranger.
  <br>*How:* Allow a full first session anonymously with local persistence; prompt to create an account at the moment there's something worth saving ('sign up to keep this'), and defer any paywall until after a genuine aha. Migrate the local work into the new account on signup.
- **True net-profit-after-fees per listing** _(Listing Lab Pro)_
  Show the seller what they actually keep: subtract Etsy's stacked fees (listing fee, transaction % on item + shipping + gift wrap, payment processing, and the Offsite Ads fee where it applies) from the sale price, per listing.
  <br>*Why:* Fee rage is a top Etsy complaint because the fees compound invisibly; sellers routinely misjudge margins. A clear net-take number is decision-grade information.
  <br>*How:* Add a fee-aware profit field to each listing/price suggestion using current rates, flag when a price barely clears fees, note that the Offsite Ads fee only hits attributed sales, and keep rates in one config so they stay current.

## dev-experience (10)

- **Never cache a failure** _(Bug Ledger)_
  Only cache a successful, non-empty fetch; caching a transient failure poisons the isolate until redeploy.
  <br>*Why:* One bad checklist fetch once silently returned 0/0 coverage for everyone on that isolate.
  <br>*How:* Guard the cache assignment on a non-empty result; on failure return a fallback WITHOUT storing it.
- **Keep source NUL-free** _(Breadcrumb)_
  Never embed a literal NUL (0x00) in source — e.g. as a cache-key delimiter.
  <br>*Why:* It makes grep/file treat the whole file as binary and silently match nothing, so agents wrongly conclude the code is missing.
  <br>*How:* Use the \u0000 escape or a printable delimiter; grep -a as a fallback when a file mysteriously matches nothing.
- **Version-stamp assets (?v=) every deploy** _(cross-cutting)_
  Append a ?v=N stamp to local script/style URLs each deploy so browsers can't serve stale JS/CSS.
  <br>*Why:* Stale-CSS/JS bugs where a fix ships but the browser keeps the old file.
  <br>*How:* Bump ?v= on every deploy (or hash the asset).
- **Stage only the files you touched (concurrent-session safety)** _(Finished.)_
  When another session may be editing the same repo, commit file-by-file, only the files you changed.
  <br>*Why:* A blanket 'git add -A' sweeps a parallel agent's in-progress work into your commit.
  <br>*How:* git add specific paths; verify HEAD/diff before committing when co-editing.
- **CLIs must fail loudly, never silently no-op** _(cross-cutting)_
  A served/worklog CLI that silently succeeded on a missing key or unknown verb misled users and agents into thinking work was recorded when nothing happened
  <br>*Why:* Silent success hides breakage and sends agents down wrong paths (rebuilding clients, 'no key' with no guidance)
  <br>*How:* Exit non-zero with a clear message on missing key/unknown command; point the user to the recovery command (login/connect)
- **Scope CLI/tool state per-repo, never a shared global config path** _(cross-cutting)_
  A worklog CLI wrote per-run state to cwd/.aprizely.json, which collided with the global token file at ~/.aprizely.json when run from home — clobbering the auth token
  <br>*Why:* A shared or ambiguous state path silently overwrites config/tokens and clobbers other projects' runs
  <br>*How:* Write per-run state to a distinctly-named, cwd-scoped file, refuse to read a worklog file as config, and gitignore it
- **Always re-fetch a served CLI each run — 'install only if missing' goes stale** _(cross-cutting)_
  A prompt that only re-installed the CLI when the file was absent left agents running an outdated cached copy lacking newer commands, so it printed 'No key' forever
  <br>*Why:* Because the CLI is served (not versioned in a clone), any server-side change needs a re-fetch or clients silently run old code
  <br>*How:* Make the setup step always curl the latest CLI (overwrite), and add an explicit login/connect fallback for parity
- **Dependency-free client-side CSV + PDF export** _(cross-cutting)_
  Spreadsheet/table data exported to a real .csv (proper quoting) and a genuine .pdf via a ~90-line dependency-free PDF generator
  <br>*Why:* Reusable export without pulling heavy libraries; keeps bundles small and works offline in the browser
  <br>*How:* Build the PDF bytes by hand and validate the xref offsets point to real objects so any viewer accepts the file; verify CSV quoting on values with commas/quotes
- **Machine-readable reusable-module hub for agents** _(cross-cutting)_
  A dedicated repo + Worker hosting each dependency-free module in its own folder, indexed by a modules.json (raw file URLs, API, usage, deps) plus /llms.txt and /AGENTS.txt
  <br>*Why:* Lets any coding agent discover and copy a module's full source in two requests, and makes adding a new module one folder + one JSON entry
  <br>*How:* public/<slug>/ per module; modules.json as the machine index; llms.txt/AGENTS.txt as the agent contract
- **Verify AI-suggested dependencies before trusting them** _(cross-cutting)_
  Treat every package name and API the model emits as unverified until checked against the real registry/docs; pin exact versions and commit a lockfile.
  <br>*Why:* LLMs hallucinate package names (slopsquatting supply-chain risk) and deprecated/imaginary APIs. Auto-installing or calling them causes build breaks or runs an attacker's squatted package.
  <br>*How:* Before adding a dep: confirm the genuine repo, publisher, and download history; pin x.y.z not ^; keep a lockfile; prefer platform-native bindings (D1/KV/Workers AI). Cross-check unfamiliar SDK calls against current official docs, not the model's memory.

## integrity (20)

- **Server-verified completeness, not self-report** _(Bug Ledger)_
  When an agent claims it checked everything, verify it server-side and show N/N plus the exact items missed.
  <br>*Why:* Proof beats assurance; it stops silent skipping.
  <br>*How:* Match the agent's reported titles against the catalog on the server; return {matched,total,missed}; loop until complete.
- **Append-only records (add, never modify or delete)** _(Bug Ledger)_
  Make the durable record add-only at the database level so agents can contribute but never corrupt or delete.
  <br>*Why:* Safe multi-agent contribution and a trustworthy audit trail.
  <br>*How:* SQLite BEFORE UPDATE/DELETE triggers that RAISE(ABORT); a documented owner-only escape hatch for pruning.
- **Grounded AI that never invents** _(Hallalu Bookings)_
  Constrain the assistant to page/transcript context only, with a local fallback, and forbid fabrication.
  <br>*Why:* Trust — a made-up fact or call detail is worse than 'I don't know'.
  <br>*How:* System prompt: answer only from provided context, never invent; local FAQ/summary fallback when the model is unavailable.
- **Crash-recovery must never wipe user content** _(Finished.)_
  A self-heal/crash-recovery path may purge caches and the service worker, never user data.
  <br>*Why:* A recovery that clears storage can destroy the user's content — a worse failure than the crash.
  <br>*How:* Scope resets to SW + caches only; keep user data untouched; audit every self-heal path.
- **Re-audit security after every AI iteration** _(cross-cutting)_
  Run a security pass after each round of AI edits, not just at the end.
  <br>*Why:* Iterative AI generation measurably degrades security — each edit can re-introduce flaws.
  <br>*How:* A /securitysweep (or quick detector pass) after each significant AI change; treat 'it worked' as separate from 'it's safe'.
- **Treat all model output as untrusted** _(cross-cutting)_
  Validate and sanitize anything an LLM returns before rendering, running or forwarding it.
  <br>*Why:* LLM output can carry XSS/SSRF/command payloads (OWASP: improper output handling).
  <br>*How:* Encode before HTML, allow-list before navigation/exec, schema-validate structured output.
- **Parameterize everything, escape on output** _(cross-cutting)_
  Never build queries or markup by string-concatenating input; parameterize queries and encode at the output sink.
  <br>*Why:* The two most common AI-code flaws are missing sanitization and XSS.
  <br>*How:* Prepared statements for data; an esc() that handles quotes + CSP for HTML.
- **Self-healing demo isolation via a fixed demo fingerprint** _(Breadcrumb)_
  Detect demo data that leaked into a real account (known ids/nickname) and reset it to a clean state on load, while keeping the landing demo fully intact
  <br>*Why:* Explorable demos routinely bleed into new accounts; a fingerprint-based auto-heal fixes already-polluted accounts without manual cleanup
  <br>*How:* On cloudPull, if state matches the demo fingerprint, reset to a fresh blank state; also reset on signup before adopting the account
- **Honest usage analytics — predict from user snapshots, never scrape or invent** _(Breadcrumb)_
  A usage/credits view with burn-rate and upgrade-runway predictions grounded only in user-logged (or agent-posted) snapshots plus the tier multiplier the plan panel already shows
  <br>*Why:* No API exposes subscription usage, so scraping/guessing would fabricate numbers; logging snapshots keeps analytics truthful
  <br>*How:* Ingest usage snapshots via a keyed endpoint or manual entry; compute burn-rate/projection from history and base upgrade math only on the known tier multiplier
- **Per-plan AI usage quotas to protect margin** _(Hallalu CRM)_
  Monthly AI call quotas metered in D1 per plan (vision counts triple; anonymous capped by IP)
  <br>*Why:* Uncapped AI features can be abused and erode margin; per-plan caps keep high gross margin while staying generous
  <br>*How:* Mirror the existing TTS quota pattern in the worker; on cap-hit fall back to an on-device result plus a gentle upgrade nudge
- **Append-only field-change version history (old-new diffs)** _(Aprizely)_
  Every change to a project's info is archived append-only and shown as a readable old-to-new diff in an 'Activity & version history' panel, capturing edits from both the UI and the agent API
  <br>*Why:* Gives a tamper-evident audit trail of who changed what and when, with no schema migration and nothing ever modifiable or deletable
  <br>*How:* Add an archiveEdit() helper that writes the field diff into the existing append-only logs table at both UPDATE sites (source: user vs claude-code); render as a diff log kind
- **Data portability as verifiable trust proof** _(Hello Baby)_
  One-tap 'Download everything (JSON)' export of the user's entire dataset
  <br>*Why:* Makes a privacy/no-lock-in promise provable rather than merely claimed
  <br>*How:* Serialize all local/cloud state to a single downloadable JSON file from Settings
- **Idempotency keys on every mutating / retryable endpoint** _(cross-cutting)_
  Any POST that creates or charges (payments, inserts, sends) must accept a client-supplied idempotency key and no-op on replay, returning the original result.
  <br>*Why:* AI codegen omits idempotency, so a retry, double-tap, or network re-send creates duplicate rows/charges/emails. Edge runtimes and clients retry more than devs expect.
  <br>*How:* Client generates a UUID per logical action; server stores it (D1 unique index or KV) with the response and returns the stored result on repeat. Combine with a unique DB constraint so even a race can't double-insert.
- **Store timestamps as UTC epoch, format only on display** _(cross-cutting)_
  Persist instants as UTC (epoch ms or ISO-with-Z); convert to local wall-clock strictly at render time. Never parse bare 'YYYY-MM-DD' or call toISOString() on a locally-constructed Date to store it.
  <br>*Why:* new Date('2026-08-16') parses as UTC midnight, and toISOString() on a local Date subtracts the offset — both shift the calendar day by one for anyone west of UTC, and DST transitions move stored times by an hour. A top recurring AI-codegen date bug.
  <br>*How:* Store Date.now()/UTC; build local dates with explicit y,m,d fields (month is 0-indexed) or a date lib in a fixed zone; format for the user with Intl.DateTimeFormat and the user's tz. Round-trip through UTC only.
- **Grandfather existing users through price changes; announce increases in advance** _(cross-cutting)_
  A one-time-purchase-to-subscription switch is the canonical resentment story — the app may still be good, but the change breaks the value calculation for people who already paid, and users rage at prices that quietly climb between renewals.
  <br>*Why:* Silent or retroactive price hikes convert your most loyal, longest-paying users into your loudest detractors.
  <br>*How:* When you change pricing, grandfather current subscribers at their existing rate (or give a long honored window), announce any increase before it hits with a clear opt-out, and never let a renewal price rise without an explicit heads-up the user can act on.
- **Keep sensitive personal data local or E2E-encrypted — no third-party ad/analytics SDKs on it** _(cross-cutting)_
  Period/pregnancy apps became a privacy scandal: intimate cycle/pregnancy data leaked to ad platforms, and a 2025 jury held a major platform liable for collecting reproductive-health data via in-app trackers. Users mass-deleted trackers and demanded anonymous mode.
  <br>*Why:* For pregnancy, baby, period, finance, and location data, a routine ad/analytics SDK turns your app into a liability that can expose users to real-world harm — and into a headline.
  <br>*How:* Classify health, reproductive, financial, and precise-location data as sensitive; keep it on-device or end-to-end encrypted; never route it through third-party ad/analytics/attribution SDKs; offer an explicit local-only/anonymous mode; and say plainly in-app what leaves the device.
- **Real 'delete my data' + a graceful-sunset export path** _(cross-cutting)_
  Users learn that deleting the app does not undo data already collected/shared, and shutdown stories show apps switching off servers with no archive, no restore, no grace period — years of data gone.
  <br>*Why:* A missing real-delete erodes trust the moment a privacy scare hits; a missing sunset plan turns an eventual wind-down into a betrayal. Both are trust primitives, not edge cases.
  <br>*How:* Provide a one-tap 'delete my account and data' that actually purges server records, backups, and third-party copies, and confirm honestly what it can and can't reach. Separately commit to a sunset policy: advance notice plus a full self-serve export before any shutdown.
- **Own-your-data: one-click complete export, no lock-in** _(cross-cutting)_
  A single always-available 'export everything' producing a complete standard-format archive (JSON + CSVs) of every entity and its history, plus a documented import path back in.
  <br>*Why:* Buyers increasingly test export before committing, and platforms that make leaving painful earn active rage. For a user-first product, trivially portable data is the honest differentiator.
  <br>*How:* Reuse the full object-graph export (contacts + notes + activity + attachments + finance), keep it free and self-serve, print row counts for verification, and state plainly in-app that users can leave any time.
- **Import/migration reconciliation report** _(cross-cutting)_
  After any bulk import or migration, show a reconciliation summary — rows in, rows created, duplicates merged, rows skipped — with a downloadable list of every skipped row and the reason.
  <br>*Why:* The defining pain of switching tools is silent loss; a visible count is what lets users trust the move.
  <br>*How:* Instrument the importer to emit counts and a per-row outcome, render them on a post-import screen, and offer 'download skipped rows'. Recommend keeping source data until counts reconcile.
- **Prompt Etsy AI-content disclosure before publish** _(Listing Lab Pro)_
  When a listing uses AI-generated or AI-assisted images/text, surface a reminder to disclose it per Etsy's current policy, and offer ready disclosure wording.
  <br>*Why:* Non-disclosure of AI-generated images is an active Etsy suspension trigger and appeals are frequently rejected — a compliance landmine an optimizer tool should defend against, not walk sellers into.
  <br>*How:* Detect/flag AI-origin assets in the listing draft, show a non-blocking compliance note with a copy-paste disclosure line, and link the current policy. Keep it advisory and honest — never assert Etsy rules that aren't published.
