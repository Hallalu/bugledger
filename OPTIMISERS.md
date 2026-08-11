# ✨ Optimisers — elevations worth reusing

46 reusable patterns (design elevations, UX, performance, workflow…) mined from the build history. Not bugs — things that made an app *better*.

## design elevation (15)

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

## UX (13)

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

## performance (2)

- **In-place DOM updates for live views (diff, don't re-render)** _(Bug Ledger)_
  Update existing nodes field-by-field each poll and animate only what changed, instead of rewriting innerHTML.
  <br>*Why:* Wholesale re-render flickers, drops scroll/focus, and replays animations.
  <br>*How:* Keep a refs map per card; compare to last state; mutate only changed text/classes; add a transient 'pop' class on the item that just completed.
- **Network-first HTML in service workers** _(cross-cutting)_
  Serve navigations network-first (or bump the cache name every deploy) so shipped fixes aren't masked by a stale cached shell.
  <br>*Why:* Cache-first service workers pin returning users to an old build — a bug that recurred across many apps.
  <br>*How:* Network-first fetch handler for document requests; version the cache name on each release.

## workflow (3)

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

## architecture (1)

- **Marketing landing at root, app at /app** _(Hallalu CRM)_
  Serve a marketing landing at the root and the app at /app; returning users skip the landing.
  <br>*Why:* New visitors get a pitch; existing users aren't slowed by it.
  <br>*How:* Root = landing; /app = product; redirect onboarded users straight to /app.

## accessibility (1)

- **Reduced-motion + aria-labels on icon buttons** _(Hallalu Bookings)_
  Honor prefers-reduced-motion and label every icon-only button.
  <br>*Why:* Accessibility and polish; motion-sensitive users and screen readers both need it.
  <br>*How:* @media (prefers-reduced-motion) to cut animation; aria-label on each icon button.

## copy (3)

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

## dev-experience (4)

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

## integrity (4)

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
