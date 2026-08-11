# ✨ Optimisers — elevations worth reusing

18 reusable patterns (design elevations, UX, performance, workflow…) mined from the build history. Not bugs — things that made an app *better*.

## design elevation (4)

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

## UX (4)

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

## performance (2)

- **In-place DOM updates for live views (diff, don't re-render)** _(Bug Ledger)_
  Update existing nodes field-by-field each poll and animate only what changed, instead of rewriting innerHTML.
  <br>*Why:* Wholesale re-render flickers, drops scroll/focus, and replays animations.
  <br>*How:* Keep a refs map per card; compare to last state; mutate only changed text/classes; add a transient 'pop' class on the item that just completed.
- **Network-first HTML in service workers** _(cross-cutting)_
  Serve navigations network-first (or bump the cache name every deploy) so shipped fixes aren't masked by a stale cached shell.
  <br>*Why:* Cache-first service workers pin returning users to an old build — a bug that recurred across many apps.
  <br>*How:* Network-first fetch handler for document requests; version the cache name on each release.

## workflow (1)

- **Paste-and-go, zero-question agent prompts (self-install, never interrogate)** _(Breadcrumb)_
  An agent prompt that self-installs its CLI silently, streams if the key is present, and carries on quietly if not — never stopping to ask the user.
  <br>*Why:* Interrogation kills the 'automatic' feel. One-time machine setup + paste-and-go everywhere is what made Bug Ledger feel effortless.
  <br>*How:* Serve the CLI from a public URL so it installs with a single curl; read the key from a small key file (no shell-profile dependency); tell the agent to self-heal silently and NEVER 'stop and ask' when something is missing.

## copy (1)

- **Source-verified stats only (ban folklore)** _(Hallalu CRM)_
  Only show a statistic you can cite to a primary source; ban unsourced 'best practice' numbers.
  <br>*Why:* Credibility — one bogus stat undermines the whole product.
  <br>*How:* Keep a small vetted stats bank; no number ships without a citation.

## dev-experience (3)

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

## integrity (3)

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
