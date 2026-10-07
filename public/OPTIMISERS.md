# ✨ Optimisers — elevations worth reusing

368 reusable patterns (design elevations, UX, performance, workflow…) mined from the build history. Not bugs — things that made an app *better*.

## design elevation (35)

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
- **Portrait preset for realistic people: flux-2-dev, clean seamless backdrop and an equipment negative list** _(Pixelbake)_
  flux-1-schnell portraits read as hand-drawn; flux-2-dev gave the realism, but backdrops showed light stands and the top edge of the paper. The recipe that worked: 'clean seamless soft neutral grey studio background, evenly lit, absolutely no photography equipment' plus a negative list (light stand, softbox, tripod, backdrop edge, backdrop seam, plastic skin), then a fault check of every PNG.
  <br>*Why:* The user rejected the first sets as not looking like true professional photos; a baked-in preset avoids repeating the rework.
  <br>*How:* Ship it as a pxb preset (portrait-pro) with the negative list prefilled, flux-2-dev as default and a post-bake checklist (hands, props, equipment, edges).
- **Build a dashboard primitives module (card, stat, sparkline, empty state) and study live category leaders first** _(Evertrue)_
  Dashboard screens were assembled from ad hoc markup, so spacing and states drifted between views.
  <br>*Why:* Consistent primitives make every new screen premium by default and cut regression surface.
  <br>*How:* Extract card/stat/chart/empty-state helpers into one module with tokens, and screenshot live Dribbble/leader references in the browser before designing, not from memory.
- **Let the logo cycle the site's look: inline boot script sets data-look before paint, a toast names the change, the choice persists** _(Hopefil)_
  On the homepage a click on the logo cycles looks (Night, Dawn, Dusk), shows a small toast saying what changed, stores the choice in localStorage, and everywhere else the logo stays a plain link home. A tiny inline script in <head> reads the key and sets data-look on <html> before first paint so there is no flash; hidden alternates are gated with html[data-look] selectors and synced with aria-hidden/inert.
  <br>*Why:* Gives the brand a discoverable-by-play moment at zero navigation cost, makes the whole palette a token swap rather than three stylesheets, and avoids a flash of the wrong look on reload.
  <br>*How:* Audit hard-coded surfaces first and move them to tokens, define each look as a [data-look] token block, add the inline boot script, wire the brand-link click only on the home route with preventDefault, announce with an aria-live toast and respect prefers-reduced-motion.
- **Give dark themes a separate blue-surface token instead of reusing the lightened accent** _(Capital Signal)_
  Lightening --blue for dark mode made white-on-blue chips, CTAs and stat labels 1.07:1. Chips and buttons now read --blue-surface (deep enough for white text) while --blue stays the readable link/accent colour.
  <br>*Why:* One accent token cannot be both a text colour on dark and a fill behind white text.
  <br>*How:* Define --accent-text and --accent-surface per theme and assert 4.5:1 for each pairing in a build-time check.
- **Use a warm charcoal dark theme and test every text tier on every elevation surface** _(Hopefil World)_
  Pure black was replaced by a warm charcoal; the three lowest text tiers passed on the base but failed on raised cards until each tier was measured on each surface.
  <br>*Why:* Contrast on the base background does not carry over to elevated cards.
  <br>*How:* Measure each tier against base, raised and overlay surfaces and keep tier colours that pass all of them.
- **Show portrait video in a wide hero with a blurred backdrop and a feathered mask** _(Hopefil World)_
  A 356x640 portrait clip stretched across a 1440px hero threw away resolution; the clip now sits centred over a blurred, darkened copy of itself with feathered edges.
  <br>*Why:* Cropping a portrait video to 16:9 loses the subject; stretching blurs it.
  <br>*How:* Layer a scaled blurred copy behind the sharp clip and apply a radial or linear mask to the edges.
- **Reusable contested-claims pattern for research and memorial sites** _(Remembrance)_
  Remembrance shows a per-entry contested flag, named perpetrators including inter-faith cases, a debate and counter-evidence section, ranges instead of single figures, and explicit labelling of the one continuous annual series (about 13 per day) versus episodic events; the Nigeria framing is shown with ACLED and HRW counter-evidence and a debunked narrative is labelled as such.
  <br>*Why:* Sensitive numbers get quoted without context; building the caveat into the data model keeps every card honest and stops a headline figure outrunning its sources.
  <br>*How:* Extract the pattern (contested flag plus note, low, high and representative values, basis, perpetrator and sources fields, and a methodology panel) into a Coco module so Payrails-style ranking pages and future research sites start with it.
- **Use Workers AI FLUX schnell only for photographic mockups and hand text-heavy products to a text-capable model or an editor** _(Hallalu CRM)_
  The photo-proof test produced a convincing flat-lay but garbled text ('birthdy withdAY'); the caveat and Canva hand-off carry the expectation
  <br>*Why:* Users judge a proof by its readable copy; garbled lettering reads as broken
  <br>*How:* Say 'look, not copy' on the result, offer a sharper-text model as a toggle, and overlay real headings with a canvas compose step
- **Homework runway bar from date assigned to due date, with colour never carrying meaning alone** _(Finished.)_
  Draw the assignment window as a bar with today's marker, days left and a text label; pair every colour state with a word or icon (WCAG 1.4.1).
  <br>*Why:* Shows pacing at a glance and works for colour-blind users.
  <br>*How:* Compute progress from assignedAt and dueAt in the schedule model and reuse the bar in the list, calendar and widget views.
- **Make rule-based design the default: category-driven fills and colours with a Settings tick, AI as an optional upgrade** _(Finished.)_
  A category-to-pattern map (dots, stripes, crosses, confetti, emoji) plus colour and emoji from keyword rules makes a day look designed with no AI call; AI only improves it.
  <br>*Why:* Free users get a finished look and credits are not spent on cosmetics; a tick lets people choose a flat style.
  <br>*How:* Resolve the fill at render time through one helper (blockFill) so it never needs a data migration.
- **Help as a full page: FAQ accordion plus contact form, with the textarea resize grip removed** _(Finished.)_
  A two-column help centre (common questions and a message form) replaced a small modal; resize: none and a proper focus ring remove the diagonal grip that looked unfinished.
  <br>*Why:* The owner called the small box low standard and the corner dashes unpolished.
  <br>*How:* Stack the columns on mobile, keep Question / Bug / Suggestion / Other kinds, and send to a table that someone actually reads.
- **Premium UI tokens from measured CSS of Linear, Vercel, Raycast, Stripe and Notion** _(Hallalu CRM)_
  Extracted rather than blog-sourced: text ramp primary 17-19:1, secondary 9-13:1, tertiary 4.5-6:1, quaternary about 3.2-3.5:1 (nobody uses pure black on white; Monday does, at 21:1); borders about 1.2-1.4:1; elevation is a 1px hairline before shadows; radii cluster at 4-8px; motion 100-300ms with one shared easing; slightly negative tracking that scales with size. Myth checks: Linear's type is free Inter plus Berkeley Mono, not custom; its look is not gradient-free (205 gradient declarations); Jakob's Law has no supporting data; Arc was admired but abandoned for a 'novelty tax' (feature adoption as low as 0.40%), so be premium in execution and conventional in structure.
  <br>*Why:* Gives numeric targets for a high-end feel instead of adjectives, and no published A/B test shows distinctive design changes B2B trust either way.
  <br>*How:* Set the app's ink tiers to the measured bands (Hallalu now: 18.7 / 9.39 / 4.59), keep hairline borders around 1.25:1, and treat the work as craft and accessibility, not a revenue claim.
- **Pure-white base with aurora washes behind translucent glass cards** _(Hallalu CRM)_
  The user rejected an off-white base. The treatment that worked: body background stays #ffffff; a fixed aurora (coral, blue, mint, purple radial gradients) sits behind the page; cards are rgba(255,255,255,.58) with backdrop-filter blur(18px) saturate(1.6), a hairline edge light and a soft shadow; a 3px brand-gradient hairline crowns the page; print overrides make cards solid white. Verified computed body rgb(255,255,255).
  <br>*Why:* Glass needs something behind it to blur; on pure white the aurora layer supplies it, and warmth never tints the base.
  <br>*How:* Put the aurora on body:before/after, not on the surface; strip aurora, blur and shadows in @media print; keep the same layer for the dark theme at stronger alpha.
- **Brand logos: clean white tile, real marks, neutral fallback** _(Hallalu CRM)_
  After three iterations (Clearbit, DuckDuckGo icons, a favicon over a colour monogram that the user rejected), the settled pattern is the logo on a clean white tile with a neutral grey-letter fallback, only official single-path glyphs for the seven platforms that have them, and demo brands chosen for visible logos. Hand-drawn logos from memory were rejected and an existing LOGOS table at socials.js:27-42 had been missed, so a parallel module was wasted.
  <br>*Why:* The user's rule is actual logos only; guessed marks look wrong.
  <br>*How:* Grep the codebase before writing a new component, use simple-icons paths, and fall back to a plain initial rather than a coloured monogram.

## UX (49)

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
- **Translate every percentage into dollars at $50 / $5,000 / $500,000 and into 'winners out of every 100 trades'** _(Abba)_
  Hit rate is stated as 'about 22 winners out of every 100 trades' and each return (median, best-5%, worst-5%, whole record, average trade) is shown as +/- dollars for three account sizes with a liquidity caveat at size.
  <br>*Why:* Percentages are abstract; a trader feels what -36% means at $5k, and the same framing keeps expectations honest for small accounts.
  <br>*How:* One shared helper pctToMoney(pct) over a MONEY_SIZES array plus a signed formatter that never prints '+-'; reuse it in the Lab and the track-record modal.
- **Show every applied filter as a removable chip, especially filters applied by voice or the URL** _(ABS)_
  A voice command navigated to /c/homedecor?max=5000 and the result list was correct, but the sidebar radios showed nothing selected, which reads as a broken filter. Browse now reads filters from URLSearchParams and renders a chip per active filter (query, price, verified, sort) that can be cleared.
  <br>*Why:* A filter that is applied but invisible looks like a bug, and shared links must restore the same view.
  <br>*How:* Parse q/sort/min/max/verified/rating from location.search on route load, render chips in the results bar, and let each chip clear one param.
- **Seed profile-dependent UI synchronously from a last-known localStorage copy, and clear it on sign-out** _(Finished.)_
  The home 'Your story' ring flashed the default silhouette on every load because the own profile came from an async Supabase call with only a 30 s in-memory cache. The profile is now persisted under finished.me, read synchronously to seed state, never blanked if the refresh returns null, and removed in signOut().
  <br>*Why:* Removes the placeholder flash while preventing the next account on a shared device from inheriting the previous avatar.
  <br>*How:* cachedProfile() getter + setItem after each successful getProfile + removeItem in signOut; initialise useState from the cache and guard the refresh with a null check.
- **Marketing-from-URL: say so when the page is an empty JavaScript shell before drafting the brief** _(Pixelbake)_
  On a client-rendered site the drafter saw about 1.8 KB of HTML and guessed grey colours and a corporate audience; the brand was corrected by hand through the briefs API before any credits were spent.
  <br>*Why:* A wrong brief makes every concept off-brand and the user only finds out after paying for the bake.
  <br>*How:* If extracted text or product count is below a threshold, render the page in a browser fetch or show a banner 'I only saw N characters - check palette and audience' and require brief confirmation before the first paid bake.
- **Always-on plain-English explainer for every backtest and scan result, computed from the user's own numbers** _(Abba)_
  The strategy bot showed jargon (out-of-sample, PF, max DD) and only a demo-only walkthrough. A computed panel now says, for example, that $10,000 became $16,257 (+62.57%) but buy-and-hold made +92.15%, that out-of-sample profit is the real test, and what to do next, with a one-line gloss on every term plus an Ask Ava to go deeper button using Cloudflare AI; the whole-watchlist opportunity scan and the explainer were ported to native in tandem.
  <br>*Why:* A beginner needs to know what a result means and what is only luck (22 variants tried, small sample) without leaving the screen.
  <br>*How:* Generate the explanation from the metrics with templates and real-world analogies (no model call needed), keep an LLM deep-dive optional, and test both web and native from the same wording table.
- **One goal system, three plain-English homes: daily goal leads Home, monthly goal on Money, challenge copy in words** _(Evertrue)_
  Goal meant a Studio listing challenge, a Routine item, a dashboard profit goal and a Money goal. The new layout leads Home with Today's goal (progress and an I hit it confirm, modelled on Hallalu), puts a monthly-goal card with profit, revenue and orders on Money, links Money and Budget both ways, renames Routine to To Do Checklist, and rewrites the Studio modal to 'New listings to publish in October 2026'.
  <br>*Why:* The user could not tell what to type into the goal and challenge fields, and a goal they set did not appear where they looked.
  <br>*How:* Name the three horizons once (today, month, challenge), show each in one place, and make every goal field state its unit and month in words.
- **State-aware, adaptive time on live boards and reports: done shows actual, active shows actual plus ~left, pending shows ~estimate** _(Aprizely)_
  Each wave chip shows only what matters for its state; remaining time is the mean of completed tasks with the in-progress task counted down; the active wave tints amber 'running over' beyond 1.25x its estimate; finished waves collapse to one line on runs over 8 tasks; the published report groups its timeline by wave with real per-task time and ends with a pace line (slowest and fastest wave).
  <br>*Why:* Showing estimate and actual on every chip was cluttered and untrustworthy beside tiny real times; users want to know what is happening and when it ends, and a closing pace line makes the report teach something.
  <br>*How:* Stamp per-task startedAt/doneAt server-side, compute per-wave state client-side, use the completed-task mean as the ETA with a token override, freeze the clock when idle over 3 minutes, and reuse the same helpers in the report timeline.
- **Double-tap-to-hear gesture module for lessons and glossary terms** _(Abba)_
  A single gesture module lets any text element be read aloud without per-view wiring.
  <br>*Why:* Makes learning content accessible and hands-free with one consistent interaction.
  <br>*How:* Delegate dblclick/double-tap on [data-say] elements to the shared TTS module, with a visible hint the first time and a stop affordance.
- **Fold bulk import into the primary 'New lead' modal: auto-scan on paste, AI split as a refine step** _(Hallalu CRM)_
  The New lead modal opens with a paste box (mic on it) and a From a photo input. Pasting auto-scans with a free on-device parser; one result fills the form, several show editable draft cards with Add all, and 'Not right? Use AI to split' sits beside the results as a refine step rather than a peer of Scan.
  <br>*Why:* One obvious entry point removes decision overhead; the free parse handles the common case instantly, and the paid AI path is offered only when the free result looks wrong, protecting margin.
  <br>*How:* Expose reusable parseLeadsLocal, addImportedLeads and photoSplit globals, call them from the create modal on input (debounced), show an editable preview before saving, and surface the AI button only after a scan produced results.
- **Check scrollWidth against clientWidth before turning a wrapping tab bar into one nowrap row** _(Budget LevelUp)_
  A single justified row of 20 tabs needed 1,874px in a 1,244px bar and clipped tabs silently; an auto-fill grid with 112px minimum columns gave two even rows with no overflow.
  <br>*Why:* Space-between hides the overflow until a tab is unreachable.
  <br>*How:* Measure overflow at 1280 and 1024, and prefer grid auto-fill for large navs.
- **Celebration layer: rare, capped, evidence-calibrated, off under prefers-reduced-motion with an in-app toggle** _(cross-cutting)_
  Kao et al. CHI 2024 (n=1,699, pre-registered) found amplified feedback reduced competence and curiosity; streak research favours at most 2 repairable freezes and never announcing a broken streak
  <br>*Why:* Confetti on every task can patronise and lowers perceived competence
  <br>*How:* celebrate only milestones, cap frequency, respect reduced-motion, mark the canvas aria-hidden, keep the in-app toggle conservative, keep streak freezes silent
- **Every long async job ends with an explicit 'done' moment** _(Pixelbake)_
  New tiles pop in with a glow and a fading 'Just baked' flag, and modal results open with a green labelled ribbon ('Upscaled 2x - Clear').
  <br>*Why:* Users otherwise cannot tell that a multi-second job has finished.
  <br>*How:* A markFresh(tile) helper plus openLightbox(id, freshLabel); ribbon auto-fades and respects reduced motion.
- **Google-Docs-style A4 page breaks in pure CSS, with page count from real content height** _(Finished.)_
  Two stacked repeating-linear-gradients keyed to --pageh draw a shadow, a desk-grey gutter and a page edge, with background-attachment:local so they scroll with the text. Page total is computed from content height minus bottom padding and the one-page min-height.
  <br>*Why:* It gives visible page boundaries without splitting DOM nodes, and the Page N of M pill matches the real end (verified 1/5, 2/5, 5/5).
  <br>*How:* --pageh = clientWidth*1.414; total = ceil((scrollHeight - padBottom)/pageH); clamp cur to total at scroll end; use separate colour tokens for light and midnight themes.
- **Auto-segment and punctuate dictated text from Chrome speech recognition** _(Hallalu CRM)_
  Chrome SpeechRecognition returns long unpunctuated runs, so dictated notes and narrated portal text read as one block.
  <br>*Why:* Unpunctuated text is hard to scan and sounds wrong when read back with speech synthesis.
  <br>*How:* Use result boundaries and pause timestamps to break sentences, capitalise the first word, add a full stop at pauses over about 700 ms, and offer a clean-up pass the user can accept before saving.
- **Show a live preview of the thing being edited at the top of its editor modal** _(Finished.)_
  The block editor gained a live preview card (real block with the chosen colour, fill pattern, emoji and highlight) above the controls; the Settings 'Slot style' chips were replaced by the same visual fill cards.
  <br>*Why:* The owner said colour and theme options felt missing even though they were present; a live preview makes every choice tangible and prevents a 'where did it go' report.
  <br>*How:* Render the same component used on the grid inside the modal, bind it to the draft state so it re-renders on every change, and reuse the preview cards for the equivalent settings control.
- **Settings anchored popovers overflow narrow viewports: use a centered modal for wide panels** _(Finished.)_
  A 660px right-anchored settings popover opened from the gear overflowed the left edge on a narrow viewport; the panel was converted to a centered modal opened by the gear (the app's established pattern).
  <br>*Why:* A wide panel that must be reachable only from one icon cannot rely on anchor geometry on phones; inline rendering also pushed the grid down.
  <br>*How:* Render big settings in the shared modal component with a click-away backdrop, keep the gear as the only entry point, and verify at the narrowest supported width.
- **Dashboards should show a personal baseline band with the user's daily points, not a population target line** _(Stepapa)_
  Research on Gentler Streak (Apple Design Award 2024) and sports-science sources showed population norms are often the wrong comparison; the analytics dashboard was built on a personal baseline band instead of a global target.
  <br>*Why:* A personal baseline never shames rest days and matches the product thesis that your own gait and pace are the reference.
  <br>*How:* Compute a rolling personal median and band from the user's own history and plot daily points against it, with no streak-shaming copy.
- **Forgiving pronunciation scoring: phonetic match, bands, unlimited retries and a self-rate fallback** _(Finished.)_
  Score with Double Metaphone plus Levenshtein, never exact match; give bands not pass/fail; allow unlimited retries with a TTS model; offer self-rating when the microphone or speech API is unavailable; show an improvement chart instead of streak pressure.
  <br>*Why:* Speech-recognition error rates are roughly double for some accents, children and non-native speakers, so exact match punishes the learners the app is for.
  <br>*How:* Keep the scorer in readscore.ts, feed the same score log to XP, the league and the progress dashboard.
- **Adaptive practice from the score log: missed words first, then unseen, close, mastered; soft league tiers without demotion** _(Finished.)_
  Order the queue 'again', unseen, 'close', 'nailed' with a stable sort after shuffling; show Bronze to Diamond tiers by weekly XP with an 'XP to next tier' bar and no demotion.
  <br>*Why:* Resurfaces what the learner needs without extra data; gentle tiers motivate without punishing.
  <br>*How:* Build the queue from stored scores on level change and once after scores load for a returning learner.
- **Timed quiz that works under real test conditions: Quick-start, save and resume, deadline auto-score, and choose/type/speak answers** _(Finished.)_
  One-tap Quick start picks length, mix and answer mode; the quiz state persists so it can be resumed; a 1 hour, 1 day or 1 week deadline auto-scores completed answers; meaning answers can be chosen, typed or spoken and matched with a lenient content-word matcher.
  <br>*Why:* Lets learners rehearse exam pacing while still fitting life, and feeds the same XP and league as practice.
  <br>*How:* Persist quiz progress to localStorage (and sync it if cross-device resume matters), and reuse the speech helpers.
- **Speech capture should land in an editable review step, never auto-commit** _(Finished.)_
  Open a review modal that starts listening, shows Speak / Pause / Resume / Done, keeps the transcript editable and previews the split before adding; offer an optional gated AI tidy (canUseAI and credits) beside rule-based defaults.
  <br>*Why:* Recognition errors are common and the owner could not correct them when dictation auto-added blocks.
  <br>*How:* Reuse the shared useDictation hook for the block editor, bulk add and the day dump; keep rules as the free default.
- **One timeline for all work: agent sessions itemised by wave, manual timers and payments on a per-day analysis** _(Aprizely)_
  Work Log shows each agent board with its tasks and descriptions, project link, time and duration, above a per-day bar chart of focused time with spend markers and a week graph on top.
  <br>*Why:* The owner wanted a single place to see what was achieved, for which project and when, instead of two disconnected lists.
  <br>*How:* Merge S.sessions and S.worklogs by day in the client, label agent duration as started to finished-or-updated, and flag boards left active as unreliable.
- **Voice-fill forms with a rule-based parser and a visible 'heard' line** _(Aprizely)_
  A mic on the payment and cost forms parses spoken amounts (digits and number words), relative dates, project and note into the fields without AI.
  <br>*Why:* Voice that only dumps text into a box feels broken; filling fields is what the owner asked for.
  <br>*How:* Strip number words from the note, show what was heard, and test the parser with fixtures like 'twenty five dollars for Cloudflare hosting today'.
- **Timestamp every shipped item and add a deterministic Fathom-style day summary** _(Aprizely)_
  Each feature, fix and session row shows its clock time, and the day report opens with a plain-English TL;DR (counts per project, focused time, first and last activity) built without AI.
  <br>*Why:* The logs.at timestamp already existed but was not shown; a short summary answers 'what did I ship today' at a glance.
  <br>*How:* Compute from the day's events, keep it deterministic, and list timestamped highlights under it.
- **Analysis text that only claims what the sample supports** _(Hallalu CRM)_
  The work-log analysis writes plain sentences from the user's own sessions (hours this week vs last, strongest weekday, typical stretch, time per product and client) with guards: strongest weekday needs 5 or more distinct logged days, typical stretch needs 3 or more sessions with segment data, and it says when sessions are not linked to anything. A related analytics sentence at n=1 read awkwardly ('Of the 1 you gave a target, 1 hit it').
  <br>*Why:* Small samples produce confident nonsense.
  <br>*How:* Gate each sentence on a minimum n, say 'not enough yet' otherwise, and special-case n=1 copy.
- **Deliverable card research: approvals, personal note, verb by type, invoice separate from the file** _(Hallalu CRM)_
  Findings: one-click Approve / Request-changes (timestamped, no login) is the most-loved feature; a real preview and a one-line personal note is the signature; the verb follows the file type (Watch, View, Download); a NEW-since-last-visit dot; the card unlocks when paid but never fuse Pay into the file's own button; avoid bare filenames and version-decoding. Also: soft completion-estimate range, book-a-call and a completion moment that gates the testimonial ask. Avoid an in-client kanban, mandatory login and mid-project NPS for a solo operator. For fixed-price work show phase progress, not raw hours.
  <br>*Why:* Grounds the card in evidence rather than taste.
  <br>*How:* Build approvals with a real kind and a verified response (see the open Approve bug) and keep invoice actions visually separate.
- **Ship a findable entry for every headline feature in the same release** _(Hallalu CRM)_
  After eight releases the user asked 'where do you access it?' for the client portal, which lived only as a topbar button and an inline card inside each client page; the assistant admitted 'you clearly had to hunt'. The Today entry added afterwards renders nothing unless a client has unread replies.
  <br>*Why:* A feature nobody can find does not exist, and function tests do not catch it.
  <br>*How:* Add the entry to Today (always visible, with an empty-state prompt) and navigation when the feature lands, then test findability from the user's start screen.
- **Steppers must accept typed numbers, and every number input needs an input handler** _(Hallalu CRM)_
  The follow-up cadence count (+/- only) and then the posting goal both blocked a user who wanted to type 10 or 70. It happened twice, then the typed value still did nothing because the handler listened to change.
  <br>*Why:* Repeated, user-visible friction; the second occurrence shows it was not swept.
  <br>*How:* Make every stepper a number input with + and - buttons, bind input for state and a sentence repaint, bind change for the full render, and sweep all steppers once.
- **Toast conventions: past tense, three words or fewer, no punctuation, about four seconds with pause on hover, undo for destructive** _(Hallalu CRM)_
  Research behind the toast review (see the toast icon bug): error toasts need their own icon, hover pauses the timer, and destructive actions offer undo.
  <br>*Why:* Cheap polish that affects every action.
  <br>*How:* Update toast() once and apply the copy convention app-wide.

## performance (8)

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
- **A/B one motif on klein-9b vs FLUX.2 dev before baking a large abstract set: klein-9b matched the look at ~1.7s and 16 credits** _(Pixelbake)_
  For 34 dark, textless glass-sculpture hero images, klein-9b matched FLUX.2 dev's premium look at 1.7s and 16 credits each versus ~4 minutes and timeout risk for dev; the whole set cost about 544 credits and was fault-checked at full size.
  <br>*Why:* Dev is needed for photoreal people but not for abstract renders; picking the model per image class saves minutes per image and avoids 3046 timeouts.
  <br>*How:* Bake the same motif on both models, read both at full size, choose the cheaper that matches the house look, then run pxb with a shared STYLE suffix and a per-topic accent tint, followed by a full-size fault check of every PNG.
- **Compress hero video with macOS avconvert and hard-mute it by dropping the audio track** _(cross-cutting)_
  avconvert -p Preset640x480 took a video from 5.07MB to 1.76MB; it has no strip-audio flag, so the muted copy was produced by exporting without the audio track.
  <br>*Why:* Autoplay hero loops must be small and silent.
  <br>*How:* Use avconvert for the size win, then verify with ffprobe-equivalent (afinfo) that no audio stream remains.
- **Probe sitemap candidate URLs in parallel** _(Hopefil World)_
  Trying sitemap.xml, sitemap_index.xml and variants one after another stalled the server-side site read; probing them concurrently cut it from 16s to 5s.
  <br>*Why:* Serial probes add every timeout together.
  <br>*How:* Promise.allSettled the candidates with a short per-request timeout and take the first valid XML.
- **Lazy-load big word lists: dynamic import for bundled banks and fetch-on-open for the 60k dictionary** _(Finished.)_
  The 24k-word bundle added about 46KB raw / 19KB gzip to the main chunk until it was split; the 60,000-word A-Z list ships as public/dictionary.txt (about 500KB) fetched the first time that level opens and merged with curated entries (curated definitions win).
  <br>*Why:* Keeps first load small while the library still reaches dictionary scale.
  <br>*How:* Show a 'Loading the full dictionary' note in the plan line while it fetches; connect-src 'self' already allows it.

## workflow (53)

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
- **Verify a Vite + Pages deploy by hash parity with a local build, not by grepping for a marker in one chunk** _(cross-cutting)_
  A marker grep for a new localStorage key found nothing in main-*.js and the lazy index-*.js chunks even though the commit had deployed; the code lived in styles-*.js. Running npm run build and comparing the content-hashed bundle names (main-CiaiF9mp.js, styles-BkZer-k7.js) with the live HTML proved the live build was byte-identical.
  <br>*Why:* Chunk names are misleading and a negative grep can trigger a false 'not deployed' panic or an unnecessary redeploy.
  <br>*How:* Build locally, compare ls dist/assets with the asset paths in the live index.html, then spot-check strings across all referenced chunks with grep -F.
- **Before porting a feature into the module registry, check the registry, untracked dirs and git log for a sibling session building the same thing** _(Coco Modules)_
  Two sessions ported overlapping modules the same day (to-do-list vs todo-list, day-planner vs routine-timetable, plus goals/goal-celebrate) and only discovered it from git status noise; the registry reached 20 entries with near-identical names.
  <br>*Why:* Duplicate work and confusing near-identical slugs force the owner to reconcile later.
  <br>*How:* Run git status/log and list public/ and modules.json first, pick a distinct purpose and name, and write the intended slug into the board before building.
- **Primary-source fetch ladder when WebFetch is blocked: Browser pane text, curl + pypdf for regulator PDFs, and record the rest as unverified** _(cross-cutting)_
  A regulatory study hit domain-verification errors, 403s and bot checks on FinCEN, a law-journal article and a central-bank PDF. Reading them via the Browser pane get_page_text, downloading PDFs with curl -A and extracting with pypdf (pdftotext was absent) worked, while Reloadly's KYB list, Trustpilot and a World Bank page stayed unverifiable and were labelled as such.
  <br>*Why:* Reports stay source-verified without guessing around blocked pages.
  <br>*How:* Try WebFetch, then navigate + get_page_text, then curl -A 'Mozilla/5.0' + pypdf, tag FACT/SIGNAL/HYPOTHESIS, and list unverified items explicitly.
- **Before building from a long prompt in a shared repo, diff against what other sessions just shipped** _(cross-cutting)_
  Two sessions worked the same Hallalu repo within hours: one built the client-page Meetings widget (projects.js) and the mark-sent handler while another, answering a prompt that asked for the same thing, built a duplicate that was overridden at load time. A third check found the repo had moved eight commits (v263 to v271) while a session was paused.
  <br>*Why:* Duplicate builds waste a wave and leave dead code that looks verified in source but never runs.
  <br>*How:* At the start of every wave run git fetch plus git log --since=3.days --stat -- public/, grep the repo for each function and action name about to be added, and re-sync again before shipping.
- **Trace each prompt clause to evidence and name ambiguous clauses before building** _(cross-cutting)_
  'Link multiple clients to the same company' was built as multiple contacts and a main number inside one record, an audit then reported 'every request is implemented', and only a closer read exposed that grouping separate lead records under one company (companies.js) was missing. The same session wrote 'board finished' next to an open question.
  <br>*Why:* An ambiguous clause interpreted narrowly produces a finished-looking board with a real gap, and the user loses trust in the word done.
  <br>*How:* Restate each ambiguous clause with the chosen interpretation (or build the broader reading), keep a clause table with file:line and an Open column, and lead the final message with an explicit Done versus Still-open split.
- **Catalog drifts from the skills it lists: edits need a manual node scan.mjs and wrangler deploy** _(SkillSea)_
  Changing the /finish skill description only reached skillsea.coconvo.workers.dev after running the additive scan (which also picked up a new patentscan skill) and a deploy; the repo has no git remote, so the commit could not be pushed.
  <br>*Why:* A catalog that lags the skills undermines it as the single place to see what exists.
  <br>*How:* Run the scan from a post-edit hook or a scheduled task, deploy only when the diff is non-empty, and give the repo a private remote.
- **Recover from agents killed mid-edit by a rate limit: diff stats, syntax check, whitelist-grep of added lines, census against the expected list** _(cross-cutting)_
  Eight parallel fix agents (several delegating to sub-agents that never notify) were killed by the session limit; result files and the scratchpad were lost, yet ~30 repos held real edits. Recovery: git diff --shortstat per repo, node --check every edited JS file, grep the added lines for anything that is not aria/for/alt/og/meta/focus, review each flagged diff by hand, and rebuild the report from git.
  <br>*Why:* Killed agents can leave half-written files and lost bookkeeping; trusting 'it probably finished' ships broken code. A census against the expected app list also caught an app (PlannerStudio) that no agent had been assigned.
  <br>*How:* Keep parallel agents at four or fewer, forbid sub-delegation in the prompt, write each result to a file as it finishes, and after any interruption run the diff-stat plus syntax plus added-line-whitelist audit before committing or deploying.
- **Preview a creative set on the 3-credit FLUX.2 klein-4b model and re-bake only approved frames on the 63-credit dev model** _(Pixelbake)_
  With the accounts at 36 and 21 credits, a full dev re-bake of seven photos (~441 credits) was unaffordable and one dev square needed 42 credits. A full set 2 was composed and QA'd on klein-4b previews at 3 credits each, with the dev re-bake stated as one re-runnable command.
  <br>*Why:* Layout, copy and safe-zone defects are found at composition time and do not depend on the model; spending dev credits before QA wastes them, and a mid-batch 402 leaves a set half-baked.
  <br>*How:* Check pxb whoami balance against the batch total first, bake previews on klein-4b with --ref for character consistency, run the composer QA passes, then re-bake only the approved frames on flux-2-dev, budgeting one extra bake per set for 3046 timeouts.
- **Strip commit attribution trailers across repos safely on macOS: portable awk --msg-filter, self-test, verify on the branch, drop refs/original, force-push** _(cross-cutting)_
  Write the filter as a script (grep -v the trailer, then awk to trim trailing blank lines; BSD sed multi-line forms fail with 'unexpected EOF (pending }'s)), pipe a sample message through it first, run filter-branch from each repo's top level, check `git log main --grep` rather than --all, delete refs/original, reflog expire plus gc, then push --force and confirm origin/main trailer count and commit counts.
  <br>*Why:* Four traps (BSD sed, wrong working directory with swallowed stderr, backup refs inflating counts, force-with-lease 'stale info') each looked like success or a random failure.
  <br>*How:* Use `FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --msg-filter 'bash filter.sh' -- --all` from `git rev-parse --show-toplevel`, then `git for-each-ref refs/original | update-ref -d`, `git reflog expire --expire=now --all && git gc --prune=now`, `git push --force origin main`, and verify with git rev-list --count origin/main.
- **Portfolio deploy-sweep recipe: inventory dirs x git x workers_list, secret-guarded commit, npx --yes wrangler deploy, status check where 401 means auth gate** _(cross-cutting)_
  List every dir with .git or a wrangler config with dirty count, branch, remote and ahead count, cross-reference the live Workers list to find orphans, commit with a secret-file guard and git reset of board-state files (.aprizely.worklog.json, .wrangler), push, deploy each app with npx --yes wrangler deploy capturing URL and Version ID, then curl every worker root (200 expected, 401 for PIN-gated apps).
  <br>*Why:* 'Make every app latest' otherwise silently skips apps with no remote or no source and sweeps board-state noise and secrets into commits.
  <br>*How:* Run the inventory in zsh with arrays (apps=(a b c), not a space-separated string), use absolute $HOME paths, capture the first 'Current Version ID' per app, and report the orphan list (no git, no remote, no local source) separately.
- **Use CDP headless Chrome for reliable before/after screenshots instead of the flaky pane** _(cross-cutting)_
  The browser pane returned stale or half-loaded frames; a CDP-driven headless Chrome (Node global WebSocket) captured deterministic shots.
  <br>*Why:* Before/after evidence is only credible if the capture is repeatable.
  <br>*How:* Launch Chrome with --remote-debugging-port, navigate, wait for load plus a settle delay, Page.captureScreenshot, and name files Label.before.png / Label.after.png for auto-pairing.
- **Verify the deployed asset (script src ?v= and curl the file) rather than trusting the pane's console buffer** _(cross-cutting)_
  The console buffer kept errors from a previous page load, which looked like a live bug after the fix shipped.
  <br>*Why:* Stale buffers and stale caches produce false alarms and false all-clears.
  <br>*How:* curl the deployed JS and grep for the fix, confirm the ?v= stamp on the script tag, hard-reload, clear the console, then re-check.
- **Benchmark models on a synthetic ground-truth set (clean and scanned twins) and pin reasoning_effort low** _(Fullfill)_
  Model choice and detector changes were validated against a generated form with known field positions, in both clean and scanned renditions.
  <br>*Why:* Gives a numeric pass rate (29/45 to 45/45) instead of eyeballing, and catches regressions on scans.
  <br>*How:* Generate the test form with known boxes, render a rasterised noisy twin, score precision/recall per change, and record latency per model.
- **Stage hunks with git apply --cached to commit only your session's changes** _(cross-cutting)_
  With another session editing the same files, whole-file staging would have bundled their work.
  <br>*Why:* Keeps commits attributable and reversible when sessions overlap.
  <br>*How:* git diff -- file > p.diff, edit to your hunks, git apply --cached p.diff, then git diff --cached before committing.
- **Verify a pushed commit builds in an isolated worktree with symlinked node_modules** _(cross-cutting)_
  A clean worktree of the pushed SHA proves the deploy is reproducible without dirty-tree help.
  <br>*Why:* Catches missing files and uncommitted dependencies before they reach production.
  <br>*How:* git worktree add ../verify <sha>; ln -s ../app/node_modules ../verify/node_modules; run build/tests there; remove the worktree.
- **Prove the public demo equals the tested demo with a fingerprint taken through the real click path** _(Hallalu CRM)_
  The owner said the landing demo was not the demo being tested. Verification: clear localStorage as a first-time visitor, click the landing 'See the demo', capture a fingerprint (isDemo, base currency, lead names/stages, photo count, invoice refs, collected total), clear storage, load /app?demo=1 directly and diff the two strings. A first false 'not identical' was a hand-typed fingerprint, so the comparison must run on captured values.
  <br>*Why:* A demo is a public promise; comparing real captured state through the actual entry path catches mis-wired CTAs that checks of the seed alone never see.
  <br>*How:* Add a fingerprint() helper, store the first result before navigating, compare after the second load, and record the verdict with lengths.
- **Screenshot a client's message and turn it into tickable per-client tasks that surface in Do-next** _(Hallalu CRM)_
  Each client gained an Assignments card: type a task, or screenshot the client's message and the existing /api/vision path extracts each request into a checklist item; open tasks also appear in the Do-next view tagged with a camera icon and can be ticked off there.
  <br>*Why:* Client requests arrive as screenshots of DMs; turning them straight into dated work removes retyping and keeps promises visible where the user already looks each morning.
  <br>*How:* Reuse the vision helper with a prompt that returns one task per line, store lead.tasks[], render a card on client detail and inject open tasks into the next-action stream without changing due-date logic.
- **Run a parity audit script that compares every old-site sentence with the new-site corpus** _(cross-cutting)_
  The script splits the old pages into sentences and searches the new site; the first run showed 85 of 235 gaps, the fixed site reached 210 of 235 with the rest deliberate.
  <br>*Why:* A rebuild loses copy silently and nobody notices until a customer asks.
  <br>*How:* Keep it in the repo, print the missing sentences, and re-run before launch.
- **Write a .pptx as raw OOXML in a zip when python-pptx is missing, then validate XML and rels** _(cross-cutting)_
  Without python-pptx a deck was assembled from slide XML, rels and [Content_Types].xml with the zip CLI and checked by parsing every part.
  <br>*Why:* Installing packages is not always possible and a corrupt pptx only fails when the user opens it.
  <br>*How:* Generate parts from templates, zip with mimetype order preserved, then parse each XML part and each relationship target.
- **When two branches hold identical work, compare patch-id and tree hash, then let rebase drop the duplicate** _(cross-cutting)_
  git patch-id matched the commits and git rev-parse on the trees matched before and after the rebase, proving nothing was lost.
  <br>*Why:* Hand-resolving a duplicate risks dropping real changes.
  <br>*How:* git cherry or patch-id first, rebase, then compare tree hashes.
- **Rewriting git history across live co-edited repos: message-only filter, tree-hash proof, bundle plus refs/original backups, and check HEAD stability first** _(cross-cutting)_
  Stripping 720 Co-Authored-By trailers from 22 repos used a git filter-branch --msg-filter, compared per-commit tree hashes (all IDENTICAL) and kept a git bundle plus refs/original per repo; two repos were re-dirtied by live sessions (a new trailered commit, and a merge that pulled the old history back) before the push
  <br>*Why:* A history rewrite under a repo another session is committing to is silently undone or clobbers its work
  <br>*How:* verify HEAD has been stable for minutes before rewriting, stash dirty trees, assert unique tree sets equal before and after, run the force-push as its own explicit step (a combined rewrite+push script was refused by the permission classifier), and verify remote HEAD with ls-remote afterwards
- **Write deliverable HTML to a durable path, not the session scratchpad, and verify it exists before serving** _(cross-cutting)_
  The scratchpad reported 'File created successfully' then was empty (total 0) when the server returned 404, losing the whole page build
  <br>*Why:* The scratchpad can wipe mid-session and the loss only shows up as a confusing 404
  <br>*How:* write to ~/ (or the repo), ls the file before starting a server, republish artifacts from the durable path
- **Deliver a real PDF with headless Chrome --print-to-pdf and a ?print=1 static mode when the artifact sandbox may block downloads** _(cross-cutting)_
  A ?print=1 query param froze the animated counter, a print stylesheet forced the light theme and hid the topbar, and Chrome --headless=new --no-pdf-header-footer --virtual-time-budget=6000 produced a 14-page 1.26MB PDF verified with a qlmanage thumbnail
  <br>*Why:* Script-driven downloads and window.print() can be blocked inside a sandboxed iframe
  <br>*How:* add print CSS plus a print-mode guard for animations, serve over local http, run headless Chrome print-to-pdf, check the page count and page 1 thumbnail, then send the file
- **Resume rate-limit-killed research agents by message ('write findings now from what you gathered') instead of restarting** _(cross-cutting)_
  Six parallel research agents were killed by the session limit mid-write. Their transcripts persisted, so each was resumed via SendMessage with an instruction to write its findings file immediately from its context and reply with path plus summary. All six delivered without re-searching.
  <br>*Why:* Restarting repeats around 100 web fetches per lane and trips the limit again.
  <br>*How:* Have every lane write its output file incrementally. After the limit resets, send each agent the 'write the file now, no new searches' message, one at a time.
- **Re-fetch the registry manifest and run describe-search before publishing a new module** _(Coco Modules)_
  A concurrent session published near-duplicates (to-do-list and day-planner) beside todo-list and routine-timetable, so the registry ended up with two of each idea.
  <br>*Why:* Duplicate modules fragment fixes and confuse agents choosing what to reuse.
  <br>*How:* Fetch modules.json immediately before authoring, search by description, and extend an existing module if it fits. Keep an explicit slug-to-group map so the TOC does not rely on tag regexes.
- **Agent-memory rules do not change the product: a requested board capability must ship as a product change and be verified on a fresh board** _(cross-cutting)_
  The user asked for per-wave ETAs and no board lag. The first response only edited the agent's private memory, so a freshly run board looked unchanged and the user reported 'did not see the changes'.
  <br>*Why:* Behavioural rules only affect sessions that load that memory. A request about what a page shows needs a code change.
  <br>*How:* Classify each ask as agent behaviour or product feature. For product features, change and deploy the product and prove it on a new run. State plainly which kind each change was.
- **Don't add a second agent to sync the board: apz keeps one local state file, so interleave board calls in the same tool batch** _(Aprizely)_
  The user suggested a dedicated agent to keep the board current. A second writer would race on the single local worklog state file and cause the very lag it was meant to fix.
  <br>*Why:* A single-writer state file plus parallel writers causes lost or out-of-order ticks.
  <br>*How:* Issue step/done in the same batch as the real work, and surface lag with a freshness pill derived from the worklog updated timestamp.
- **Research fan-outs must write incrementally and stay at 3-4 parallel agents** _(cross-cutting)_
  Twelve parallel research-lane agents hit the account session limit (HTTP 429) within about an hour. Eleven died with zero output, and two relaunches of eleven lanes were cut the same way. Once every agent was told to create its lane file first with skeleton headings and append section-by-section, five lane files survived with partial findings.
  <br>*Why:* A rate-limit cut otherwise erases all in-flight work, and re-running burns the same quota again.
  <br>*How:* Run at most 3-4 agents per batch. Have each agent create its output file first, append per question, and cache source pages to disk (curl + text extraction) so a resumed run reuses them. Have the main session read the lane files rather than the agents' final messages.
- **Bot-walled primary sources: curl with a browser UA into a page cache, and say 'could not verify' otherwise** _(cross-cutting)_
  Ofcom (Cloudflare 'Just a moment...'), EUR-Lex, Etsy and the UK IPO returned 403s or captcha walls to WebFetch and the browser pane, and WebFetch's safety layer failed on whole batches. About 250 primary pages were fetched with curl and a browser UA into the scratchpad and run through a text extractor, then grepped for verbatim clauses.
  <br>*Why:* A failed fetch is not a finding. Treating it as one invents restrictions or drops evidence, and a page cache survives agent deaths.
  <br>*How:* curl -sL with a browser UA into scratchpad/<lane>/, extract text with a small script, quote clauses by grep. Take fees and statutes from an alternate primary (EUR-Lex annex, legislation.gov.uk). Record walled pages under 'could not verify' and never bypass captchas.
- **Clear a product name on the registers before building the brand (costs and sources included)** _(cross-cutting)_
  TMview (an EUIPO mirror of UKIPO, EUIPO and USPTO data) and Companies House gave exact-hit checks across 25 names in one pass and found 4 unsafe and 7 serious conflicts. Fees verified from primary sources: UK online £205 + £60 per extra class (up from £170/£50 on 1 Apr 2026), EUTM €850/€50/€150, USPTO $350 per class.
  <br>*Why:* Renaming after launch costs links, users and marketing, and an identical mark in the same class is infringement from day one.
  <br>*How:* Search the name and phonetic variants in classes 9, 35, 36, 38 and 42 on TMview, USPTO and Companies House before naming. Also check platform trademark policies (such as Git's). Register one house mark first (COCONVO) and file individual product names only when live.
- **Character recipe: enumerated feature descriptor + curated multi-angle reference bank + locked seed + auto character sheet** _(Pixelbake)_
  Describe a person with enumerated features (eye shape, nose bridge, jaw, hair, skin, scar and freckles), not 'same person'. Keep 3-6 varied-angle references and a locked seed, and auto-generate a front, three-quarter, profile and smile sheet.
  <br>*Why:* This was the research-backed recipe that carried identity into new scenes.
  <br>*How:* Store the brief, traits JSON, ref ids and seed per character, and inject an anchor prompt plus face-cropped refs and the seed into every bake that names the character.
- **Honour per-repo 'push to main auto-deploys to live users and Stripe' rules: commit locally and ask before pushing** _(cross-cutting)_
  The project's command file said 'Deploy only if I ask' and 'stage only files you touched'. The session committed four named files locally, reported, and pushed only after an explicit go-ahead. It then confirmed the live CSS bundle carried the fix by polling for --page-desk.
  <br>*Why:* It avoids an unreviewed release to paying users, and 'pushed' is not 'deployed'.
  <br>*How:* git add <named files>, commit, then ask. After approval, push and poll the production bundle with a cache-busting query until a unique token from the change appears.
- **Let agents upload real screenshots by wiring a headless-Chrome or CDP capture into apz.mjs shot** _(Aprizely)_
  The standing rule says every run must screenshot each page it touched, but screenshots taken in the Browser pane come back inline and cannot be written to disk, so the only shots uploaded in the proving run were five synthetic mockups drawn by a Node script. A headless Chrome command (--headless --screenshot --virtual-time-budget, with ?demo=1 for gated apps) was used successfully in an earlier session.
  <br>*Why:* Without a file path the capture-and-compare feature cannot meet its own rule, and agents are pushed toward fake images.
  <br>*How:* Add apz.mjs shot --capture <url> that shells out to headless Chrome (or the shoot.mjs CDP helper for authenticated pages) and uploads the result with its label and stage, and document the one-liner in AGENTS.md.
- **Give every append-only writer (PatentCake, Bug Ledger, Aprizely) a dry-run preview** _(cross-cutting)_
  The PatentCake triggers reject UPDATE and DELETE, so the first filing locked in a truncated slug permanently; the same irreversibility applies to Bug Ledger entries and to Aprizely reports and shots.
  <br>*Why:* With no undo, the only safe place to catch a bad slug, title or severity is before the write.
  <br>*How:* Add --dry-run to pc.mjs, worklog.mjs and apz.mjs that prints the exact payload and derived identifiers and exits without posting, and have agents run it first whenever a field is auto-derived.
- **Mint agent keys through the app's device-connect flow, not a direct production D1 insert plus temp files** _(Breadcrumb)_
  To make the live board work without approval, a Breadcrumb ingest key was generated in a shell, its hash inserted into the production ingest_keys table with wrangler d1 execute --remote, and the plaintext written to /tmp/bc-key.txt before being copied to the local key file.
  <br>*Why:* Direct production writes bypass the app's own audit and revoke paths, and a plaintext key left in /tmp is readable by other local users until it is deleted.
  <br>*How:* Use the existing device-connect approval (one click) or an authenticated mint endpoint that returns the key once, write it straight to a mode-600 file, delete any temp copy, and record the key label so it can be revoked from the app.
- **When reddit.com refuses, use the PullPush and Arctic Shift archive APIs for voice-of-customer research** _(Joy)_
  A customer-voice subagent could not open reddit.com, G2, Quora or YouTube, but two Reddit archive APIs (PullPush and Arctic Shift) returned real threads current to the day; PullPush rate-limited, so the downloaded corpus was re-searched locally instead of re-querying.
  <br>*Why:* Earlier studies recorded 'Reddit blocked' and went without a Reddit voice; archive APIs close that gap with real comments and scores.
  <br>*How:* Query the archive API per keyword, save the JSON corpus to the study folder, re-search it offline, cite the thread permalinks, and tag each quote SIGNAL unless corroborated; re-open any Trustpilot quote that came through a summarising fetch tool before reuse.
- **Fold per-run composer fixes back into the skill's compose.mjs or the next project re-fixes them** _(Sell skill)_
  The receipt chip, sideways scrim, code block and seam fix were written into the project folder's compose.mjs only; the skill's copy stays without them
  <br>*Why:* Each /sell run re-discovers the same layout defects (12 fixed over four render passes) and the ledger already holds several for this file
  <br>*How:* At the end of a run diff the project composer against the skill copy, port the generic changes behind options, and bump a header version so agents can tell which copy they hold
- **When a command needs the user's sudo, have it write to a file the agent reads instead of asking for a paste** _(cross-cutting)_
  read_terminal could not see output that had scrolled past, and pasted blocks arrived truncated or empty; a command that ends with '> /tmp/x.txt; echo done' let the agent read the whole result directly
  <br>*Why:* Each paste round trip cost minutes to hours of wall-clock in a disk-full emergency
  <br>*How:* Standard form: sudo CMD 2>&1 | head -N > /tmp/NAME.txt; echo 'written, say done'; then Read /tmp/NAME.txt; keep the first command small and the file path stable
- **Give every Worker a never-cached /api/_v route, version static asset paths by content hash, and verify deploys against both** _(cross-cutting)_
  A probe route that returns a build marker proves worker code is live; rewriting asset URLs to /_v/<hash>/file gives every release a new cache key; compare the served file's sha with the local sha.
  <br>*Why:* wrangler's Success output and the deployments list said nothing about stale static files, and a hand-bumped ASSET_VER is easy to forget.
  <br>*How:* Derive the version from a hash of public/ at build time, keep the shell HTML no-cache, serve /_v/* as immutable, and add the probe check to the deploy script.
- **Research lanes that spawn their own sub-lanes return 'Holding' as their result** _(cross-cutting)_
  A premium-design lane completed seven times with results like 'Lanes are still actively researching. Holding.' (about 144k tokens, 22 minutes); its real output came from a different lane. A task-notification fires each time an agent stops with no live children, and TaskStop on a completed task errors. Two other lanes failed mid-flight with 'your computer went to sleep' and two hit a session limit; the assistant correctly reported these as gaps rather than filling them with guesses.
  <br>*Why:* A notification is not a deliverable, and the user lost half an hour to an empty result.
  <br>*How:* Brief lanes not to spawn agents and to end with a final report; treat any 'holding / still researching' result as a failure and re-run it directly; list failed lanes explicitly in the report.
- **Do not browser-verify while a browser-using subagent is running** _(cross-cutting)_
  A parallel research subagent drove the shared Browser pane, navigated to buildertrend.com, and took over the main session's verification even in a freshly created tab (S was undefined). The pane also hits a tab cap, times out on scroll and screenshot, and 'zoom' returns the full image.
  <br>*Why:* The agent's page state and the verifier's page state are the same pane.
  <br>*How:* Wait for browser-using lanes before verifying, or give research lanes WebFetch/WebSearch only; use JS checks instead of scroll/zoom when the pane is unresponsive.
- **Before replacing a modal with a page, list every surface the modal hosted** _(Hallalu CRM)_
  Moving the portal from a modal to a full-page iframe preview would have removed the owner's only place to reply, hide comments and toggle requests (loadThread targets #ptThread, which only existed in the modal). It was caught pre-ship and a Replies button plus thread modal were added. A line-range sed repoint of handlers also missed two lines (pe-hours, pe-done) and was caught by re-reading.
  <br>*Why:* Refactors silently drop features that lived inside the thing being replaced.
  <br>*How:* Grep every handler and element id the old component owned and map each to the new layout before deleting it; avoid line-number-scoped sed over handler blocks.
- **Route every destructive action through one confirm helper** _(Hallalu CRM)_
  The portal's remove buttons shipped without a confirmation for nine releases. The fix wrapped them in askDel (confirmDel with Keep it / Yes, delete and an editor re-open); Ava thread delete also had no confirm until added.
  <br>*Why:* Delete-confirm is a house rule, and per-handler discipline fails.
  <br>*How:* Make confirmDel the only path for data-act delete handlers and grep for any remove that bypasses it before release.

## architecture (37)

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
- **Embedded-view pattern: one component, standalone or nested** _(cross-cutting)_
  A feature that has a full page (its own header + back button) often also wants to appear as a section inside a hub. Add an  prop that hides the component's own chrome so the host provides the back/title, and render the same body in both places.
  <br>*Why:* Avoids a second implementation and keeps behaviour identical; lets a rich view (e.g. Follow-ups) live both as its own screen and as a tab inside another tool (Task Manager) with no double header.
  <br>*How:* Gate the header/back on !embedded; neutralise the standalone padding/max-width when embedded; pass onBack that returns to the host section. Verify no double header and that deep actions still work.
- **Reusable theme modules need an explicit token map and escape-hatch tokens** _(cross-cutting)_
  abba-backgrounds uses --txt, --dim and --bg2 while Hallalu uses --ink, --ink-2 and --bg-soft, so a THEME_MAP had to be written; the sidebar background was a hard-coded gradient so a --side-bg token with a fallback was needed; and the ThemeStudio preset click kept fine-tune overrides (patched in the module and redeployed).
  <br>*Why:* Each consumer re-solves the mapping, and presets that do not reset overrides never give the user the full preset.
  <br>*How:* Ship maps/<vocabulary>.json with the module, document that every themed surface reads var(--x, fallback), make presets reset overrides, and expose --side-bg and --side-ink as standard parts.
- **Dependency-free modules should expose optional host hooks (e.g. opts.prompt) with a built-in fallback so apps with premium dialogs plug theirs in** _(Coco Modules)_
  theme-studio's new inline rename calls opts.prompt(currentName), which may return a Promise, so Abba passes its own promptBox; with no hook it falls back to window.prompt and still works. The rename control reveals on hover/focus beside delete and the click guard stops it applying the look.
  <br>*Why:* Copy-in-whole modules cannot import an app's UI kit, but forcing native prompt() into premium apps would violate the no-native-dialogs house rule.
  <br>*How:* Accept an optional async hook per interaction (prompt, confirm, toast), default to the browser primitive, document it in the module README and header, and test both paths (hook fired and Renamed-1 persisted).
- **Probe third-party data sources from Worker egress with an authed, allowlisted debug fetch route** _(Abba)_
  Feeds that work from a laptop (Google, GDELT) were blocked from Cloudflare egress, so local curl tests proved nothing.
  <br>*Why:* Source viability must be tested from the network that will actually call it.
  <br>*How:* Add /api/debug/fetch behind auth with a host allowlist and size/time caps, and use it to test each candidate feed before building on it.
- **Push-only service worker plus payload-less VAPID push for notifications** _(Abba)_
  A minimal service worker handling only push/notificationclick, with VAPID-signed push that carries no payload, avoids payload encryption and cache complexity.
  <br>*Why:* Gets reliable alerts with far less code and no stale-asset risk from a caching SW.
  <br>*How:* SW shows a generic notification and fetches the detail from the API on click; sign with VAPID JWT in the Worker; never cache assets in this SW.
- **Use a generic docs table instead of one growing blob for large synced content** _(Breadcrumb)_
  Conversations, artifacts, sessions and the asks ledger were added after the sync layer and did not fit the single-blob design.
  <br>*Why:* Per-document rows give tombstone sync, per-doc size caps, and avoid the 2 MB blob limit.
  <br>*How:* docs(id, kind, body, rev, deleted_at) with ON CONFLICT upsert that includes meta, and push/pull deltas by updated_at.
- **Record 'committed and deployed' per session inside the existing report JSON blob, with an honest tri-state banner** _(Aprizely)_
  Reports gained a banner showing whether the session's work was committed and deployed. The Worker accepts a sanitised ship object {committed, sha, message, branch, deployed, url, version, at} stored inside the existing reports.data JSON; apz.mjs gatherShip() auto-detects git HEAD (clean tree means committed) and takes --deployed <url>. States: green committed+deployed, green committed plus amber 'Not deployed yet', and no banner for legacy reports.
  <br>*Why:* Written is not deployed is not working; a visible per-session proof stops 'done' being claimed early, and storing it in the existing blob meant no schema migration and full backward compatibility.
  <br>*How:* Add an optional sanitised sub-object to the JSON you already store, render it only when present, derive it from git on the client, and let a flag supply the deploy URL; verify all three states plus the legacy no-ship report on wrangler dev before shipping.
- **Render pickers opened from inside a form as their own stacked overlay, not through the single-overlay openModal** _(Hallalu CRM)_
  openModal() calls closeOverlays() first, so a currency picker launched from the new-lead/settings/invoice modal destroyed the parent form and everything typed. The fix renders the picker as a separate scrim+panel appended to body (higher z-index, its own close handler) that closes only itself and writes the choice back to the still-mounted button and hidden input.
  <br>*Why:* Nested choosers are everywhere (dates, currencies, contacts); one overlay model that wipes siblings silently loses user input.
  <br>*How:* Give pickers a createStackedOverlay() that never calls closeOverlays, keep selection state on the parent's DOM nodes, and test every picker nested inside every form before shipping.
- **A Worker cannot launch Claude Code: queue the run, let a local agent claim it, and say so in the UI** _(Hopefil World)_
  The product queues a run and a local command (hopefil next) claims it; the UI states that a local agent must be running instead of implying the cloud builds it.
  <br>*Why:* Pretending the server executes the agent produces silent stalls.
  <br>*How:* Store a queued state with a claim endpoint and show who claimed it and when.
- **Private pages on Workers assets: remove the payload from the public bundle instead of gating the route** _(cross-cutting)_
  Cloudflare serves static assets before the Worker; run_worker_first matches the raw path but the asset server normalises // and %5F, and a gated HTML page still leaks its JS file
  <br>*Why:* No amount of route gating beats an asset that exists in the bundle
  <br>*How:* move private html/js to src/private/*.txt, import as Text modules (rules: type Text, globs **/*.txt), serve from the Worker after normalising the path and checking a key; test //x, /%5Fx, /X, /./x, /dir/../x and the JS payload URL from outside
- **One field schema must drive both the card display and the add/edit form** _(Hallalu CRM)_
  Rolodex influencer cards showed per-platform followers and engagement, providers showed rating, business showed phone, but the add form collected none of them (same class in several sections)
  <br>*Why:* Two hand-written lists drift until the UI displays data no one can enter
  <br>*How:* define ROLO_SCHEMA per category once and derive card chips, form inputs and the edit modal from it; add a check that every rendered field has an input
- **Derive accent-soft, ink and ring from --accent with color-mix so any theme or custom accent stays coherent** _(Evertrue)_
  A vendored theme module carried its own blue accent and token names (txt/dim/cardSolid), which overrode the app's accent and mismapped colours. Map module tokens to app tokens explicitly. Compute accent-soft, accent-ink, accent-hover and ring from the single --accent.
  <br>*Why:* Hand-picking each tint per theme breaks the moment a user fine-tunes one colour, and a third-party palette can silently recolour the brand.
  <br>*How:* Define a THEME_MAP from module keys to CSS vars. Set --accent-soft with color-mix(in srgb, var(--accent) 12%, white) and equivalents for ink and ring in :root, and make Light/Dark clear any applied palette.
- **Derive the immutable asset version from a content hash at deploy instead of a hand-bumped constant** _(Aprizely)_
  The shell rewrites assets to /_v/<ASSET_VER>/file with immutable caching, and a forgotten manual bump shipped changes that cached browsers never loaded.
  <br>*Why:* Anything that depends on remembering a constant will eventually be forgotten, and the failure is invisible to the developer.
  <br>*How:* Compute a short hash of the asset files at build or deploy and inject it as ASSET_VER, or make a deploy script fail when public/ changed but the version did not.
- **Boot watchdog: race the session fetch, validate its shape, and turn a stuck splash into Reload / Reset** _(cross-cutting)_
  A returning user hung on 'Loading…' forever because boot() awaited api('/me') with no timeout and rendered the shell outside any try/catch. The fix was a 10s race on /me, a shape check on the response, a guarded post-auth render, and a 15s watchdog that swaps the splash for a Reload / Reset-and-reload card. It was proved on the deployed app by stubbing window.fetch to hang and to return {}.
  <br>*Why:* Any await on the boot path can strand every returning user, and stale local state is invisible to the developer in a clean browser.
  <br>*How:* Wrap every boot-blocking fetch in an AbortController timeout. Validate the payload before touching nested fields. Add a global watchdog that offers Reload and a Reset that clears only the token. Test by monkey-patching fetch in the live page.
- **First-party AI upscale: Images binding fit scale-up with a sharpen/contrast/saturation finishing pass** _(Pixelbake)_
  The existing env.IMAGES binding can AI-upscale 2x/4x and takes sharpen (0-10), contrast and saturation in the same transform. It runs as one billed transformation and needs no third-party billing.
  <br>*Why:* It works today without AI Gateway credits and gives a visibly crisper result on low-res sources. Measured: the sharpen pass, not chaining, was the lever.
  <br>*How:* env.IMAGES.input(stream).transform({width,height,fit:'scale-up'}).transform({sharpen:4,contrast:1.06,saturation:1.08}).output({format}); cap the long edge at 8192px; store as a versioned child image.
- **Spend a model's small reference-image budget on the face: Images gravity:face crop at about 500px** _(Pixelbake)_
  FLUX.2 klein accepts up to 4 references, each under 512px. A full portrait wastes those pixels on background, so references are face-cropped before they are sent.
  <br>*Why:* Reference resolution is the identity-fidelity ceiling on first-party klein.
  <br>*How:* env.IMAGES.input(src).transform({width:500,height:500,fit:'cover',gravity:'face'}) before building input_image_0..3.
- **Give copied-whole modules a version stamp and a drift check** _(Coco Modules)_
  The activity-timeline module now exists as three copies (modules registry, Aprizely public/, Breadcrumb public/) because the registry philosophy is to copy modules whole, and the apz.mjs CLI is likewise kept in three places that are synced by hand and compared with md5.
  <br>*Why:* Copies silently diverge: a fix to one copy never reaches the others, and nobody notices until a view behaves differently across apps.
  <br>*How:* Add a version and checksum header to every module, publish checksums in modules.json, and ship a small modules-check command that compares each app's local copy with the registry, prints which are behind, and runs from the deploy script.
- **Do media decoding in the browser and keep Workers AI for model calls: audio chunks + one frame per second, then Whisper and Llama vision** _(Hallalu CRM)_
  The video-study engine decodes audio and grabs a frame per second in the browser, detects cuts for the shot map, sends chunked audio to Whisper (offset-stitched) and each frame to Llama 3.2 vision on the AI binding, then makes one synthesis call and falls back to a no-AI structural teardown when the AI is off.
  <br>*Why:* Workers cannot run ffmpeg-style extraction; moving decode client-side keeps the Worker within CPU limits and makes the heavy model work free-ish, high-volume and keyless.
  <br>*How:* Extract audio/frames with Web Audio and canvas, normalise nested Whisper segments[].words[] on the server, degrade per frame when vision errors (8007/3030) and keep the transcript-only shot.
- **Cloudflare free-tier 100K requests/day is ACCOUNT-wide, shared across ALL Workers** _(cross-cutting)_
  The 100K req/day free limit is per-account, not per-Worker. A portfolio of 30+ Workers on one account shares a single 100K bucket; KV reads/writes and Cache API ops also count as requests.
  <br>*Why:* Directly relevant: this account runs ~34 Workers. One chatty Worker (polling, hourly crons, live boards) can starve the rest and cause account-wide 1015/quota errors.
  <br>*How:* Budget requests across the portfolio; cache aggressively; avoid per-second polling and chatty KV; move hot paths to paid or to static assets; watch the account request graph.
- **Make a monthly grant idempotent by putting the period in the ledger reason and indexing it** _(Finished.)_
  Use reason 'monthly-free:2026-08' with a partial unique index on (user_id, reason) where reason like 'monthly-free:%', insert ... on conflict do nothing, and bump the balance only if a row was actually inserted (GET DIAGNOSTICS row_count).
  <br>*Why:* date_trunc is not immutable so it cannot sit in an index expression; the reason string carries the period and makes concurrent or repeated calls safe and auditable.
  <br>*How:* Call ensure_monthly_free() lazily from the balance RPC so no cron is needed, and skip it in a month that already has a welcome or renewal grant.
- **Pass the 12/24-hour format as a parameter or context instead of a module-level flag set during render** _(Finished.)_
  fmtTime reads a module-level FMT24 set by setFmt24(!!s.hour24) inside the Timetable render body.
  <br>*Why:* Memoised children and any other importer of fmtTime can show a stale or foreign format; it only works because the whole tree re-renders.
  <br>*How:* Give fmtTime an explicit h24 argument (already supported) and thread the setting through props or a small context.
- **Share one design-token file across standalone share pages so locks (pure white, contrast) are inherited** _(Hallalu CRM)_
  portal.html, site.html, kit.html and summary.html are separate documents with their own CSS, so the pure-white lock was lost on the new page and ink tokens had to be fixed again inside it. Contrast fixes in app.css did not reach them.
  <br>*Why:* Every new client-facing page re-derives colours and re-introduces already-fixed mistakes.
  <br>*How:* Extract tokens.css (colour tiers, radii, motion, aurora layer) and link it from every public page; test them against the same contrast script.
- **Backend-free share pages via fragment-encoded JSON: instant and private, but irrevocable** _(Hallalu CRM)_
  summary.html, kit.html, site.html and portal.html#<b64> render a snapshot encoded in the URL fragment with no database. The data never touches the server, but there is no revocation and the decode uses the deprecated escape(). The portal added a server-side pid for comments and a published snapshot at /portal.html?p=<pid>.
  <br>*Why:* The tradeoff decides whether a link can ever be taken back.
  <br>*How:* Keep fragment links for low-sensitivity shares, show a one-line 'this link cannot be withdrawn' note, and use a server pid with unpublish for anything containing money or client detail.
- **Do not reuse the platform's billing Stripe to collect users' client payments** _(Hallalu CRM)_
  Payment reminders and deposits let each user paste their own payment link and bank details (payBlock() appended to the drafts). Using the platform Stripe would route a user's client money to the platform account.
  <br>*Why:* Money would land in the wrong account and create a regulatory problem.
  <br>*How:* Keep platform Stripe for subscriptions only; use the user's own link, or Stripe Connect when built.
- **No-AI path registry for deterministic reports and editable message drafts, with a spy to prove zero AI calls** _(Hallalu CRM)_
  avapaths.js is a registry of pure-data reports (pipeline snapshot, income recap, dated follow-up agenda, payment plan, daily brief, win-back) plus honest, editable drafts (payment reminder, no-reply nudge, thank-you, review request without incentives). Drafts are pushed as a separate Ava message so Copy gives a clean draft; follow-on chips are path ids, not AI prompts. A monkeypatched spy on askAI proved aiCalls:0.
  <br>*Why:* Cuts cost and removes hallucination for the common jobs, and respects the draft-and-send, human-in-the-loop house style.
  <br>*How:* Add new jobs as registry entries that read existing data only (do not fabricate prices that are not stored), reuse renderArtifactDoc, and verify with an askAI spy.
- **Themes as data-attribute token blocks plus tri-state flourish overrides** _(Hallalu CRM)_
  Ten templates are :root[data-ptheme=X] token blocks (fonts, radius, label case and tracking, gap, divider) selected from the snapshot, with layout (data-plyt) and accent override separate. Motion, drop-cap and drifting wash have a per-theme default and a tri-state owner override (unset falls back to the theme), all inside prefers-reduced-motion. Research applied: mono only for labels and figures with neutral sans body, tabular-nums on every figure, system ui-serif/ui-rounded stacks with no webfonts, small-caps labels. 'Monochrome' themes needed an override pass on semantic status colours, and a multicolour opt-in lost to flat-theme !important rules until it used !important itself.
  <br>*Why:* Distinct personalities without per-theme code, and owner edits layer on top.
  <br>*How:* Keep tokens in one block per theme, treat unset as inherit, and test opt-in overrides against flat themes.
- **Gate hash-routed pages in the route table, not only on the button that opens them** _(Hallalu CRM)_
  Making the portal a #/portal/<id> page meant direct URL navigation would skip the business gate that the old modal opener enforced; the assistant added 'portal' to BIZ_VIEWS so the router shows the upgrade wall.
  <br>*Why:* A gate that lives only on a button is bypassed by the URL.
  <br>*How:* Keep gated views in one list that the router consults, and test a direct hash visit as a free user.
- **Extract dependency-free voice-mic and an Intl-based currency picker as modules, with one manifest** _(Coco Modules)_
  voice-mic is a floating button plus inline dictation and a raw listen loop with a graceful fallback when SpeechRecognition is missing; the floating mic was removed from the Hallalu app because it duplicated Ava's. The currency picker now derives each symbol with Intl.NumberFormat (no data table), adds a Popular group and icon search and follows light/dark.
  <br>*Why:* Both are needed by several apps and were being re-implemented.
  <br>*How:* Publish both as modules with the same API (open/button/search), keep one modules.json that deploys to public/, and add a predeploy diff check.
- **SSRF-guarded link unfurl: oEmbed first, Open Graph scrape second, optional Firecrawl** _(Hallalu CRM)_
  /api/unfurl validates URLs through safeUrl (127.0.0.1 returned bad-url in testing), uses oEmbed for YouTube, TikTok and Vimeo, falls back to OG scraping, rate-limits via tooMany, and treats Instagram, which blocks scrapers, as manual. Metrics stay OCR or manual.
  <br>*Why:* Auto-pull without exposing internal addresses.
  <br>*How:* Keep the allowlist of schemes and block private ranges, and move the rate limit to a global store (see the open security item).
- **Never cap an AI artifact generator to a fixed kind list; sanitise and sandbox instead** _(Hallalu CRM)_
  make_artifact was limited to an enum of eight kinds, an artificial limit. It now takes a free-form kind and an 'html' section that strips script and style, rendered in an iframe with no allow-scripts. A fragment without a doctype also rendered in quirks mode in a local preview (compatMode), which made a map screenshot look blank.
  <br>*Why:* Limits invented by the builder remove capability, and untrusted generated HTML needs a sandbox.
  <br>*How:* Allow free-form kinds, strip scripts server and client side, sandbox without allow-scripts, and preview with a doctype.

## accessibility (9)

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
- **Test the whole UI at 200% zoom and the largest system font** _(cross-cutting)_
  Size text in relative units tied to the root and let containers grow with content, then verify nothing clips or overlaps at 200% zoom and maximum system font size.
  <br>*Why:* Pixel-locked type and fixed heights silently exclude seniors, low-vision and situationally-strained users — a large share of the audience for keepsake, baby, wedding and finance products.
  <br>*How:* rem/em for type and spacing, min-height instead of height, no overflow:hidden on text containers; add a zoom pass to the pre-ship checklist.
- **Sweep computed contrast over every leaf text node with its real ancestor background** _(cross-cutting)_
  A script walks every leaf text node, resolves the first opaque ancestor background and computes the WCAG ratio; it found three failures that screenshots and token checks missed.
  <br>*Why:* Token pairs say nothing about what actually sits behind each string (gradients, nested cards, dark sections).
  <br>*How:* Run it per theme and per route in the CDP harness and fail on any ratio under 4.5 (3 for large text).
- **Measure pill contrast on the text band, and reset persisted theme between harness runs** _(cross-cutting)_
  The bounding box of a rounded pill includes transparent corners so sampling it reads the page behind; the harness also leaked setTheme through localStorage into the next run.
  <br>*Why:* Both produce false failures or false passes in contrast sweeps.
  <br>*How:* Inset the sample to the text line box and clear localStorage before each theme pass.
- **Ship against the six WCAG failures that are 96% of all a11y errors** _(cross-cutting)_
  WebAIM Million 2025: 94.8% of pages fail WCAG. Six issues = 96% of all errors: low-contrast text (79.1%), missing image alt (55.5%), missing form labels (48.2%), empty links (45.4%), empty buttons / icon-only buttons with no accessible name (29.6%), missing <html lang> (15.8%).
  <br>*Why:* Fixing just these six moves a product from inaccessible to broadly usable; they are cheap and the same list 5 years running.
  <br>*How:* Contrast >=4.5:1 for body text; alt on every content image; label every input; no empty <a>/<button>; aria-label on icon-only buttons; set <html lang>. Run the A11Y-* detectors on every build.
- **Compute contrast for every text token across every theme and both colour schemes in one script** _(cross-cutting)_
  A one-off in-page script measured --ink-3 at 2.54:1 on white (WCAG failure) and later caught White 3.03:1, Pastel 3.87:1 and Aurora/Ocean 4.35:1 label text across ten templates. It measured only one scheme, and non-default themes set tokens on :root[data-ptheme] which outranks the plain-:root prefers-color-scheme:dark block, so those themes stay light in dark mode.
  <br>*Why:* Eyeballing greys misses real failures, and a 'light and dark pass' claim needs both measured.
  <br>*How:* Loop themes x schemes (resize_window colorScheme or emulate), read the computed colour of each text token against its real background, flag anything under 4.5:1 for small text, and decide explicitly whether themes should follow the OS dark setting.

## copy (12)

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
- **Check every pricing bullet's verb against what the feature itself disclaims before it ships** _(Hallalu CRM)_
  A legal read of new tier bullets found one real exposure ('prove the ROI' vs the feature's 'direction not a perfect number'), two bullets that are only safe because an in-app caveat exists (photo-proof IP caveat and logo stripping; valuation shown as a range), and old absolutes ('no caps on anything', '$80-90/mo of separate tools') that need fair-use wording or a named basket on file.
  <br>*Why:* Marketing absolutes create substantiation risk even when the product is honest.
  <br>*How:* For each bullet list the in-product caveat, replace absolute verbs (prove, guarantee, unlimited) with measurable ones (track, see the payback), and keep the caveat visible where the feature is used.
- **State the real limit when a laptop starts a phone call: web pages cannot hear a Continuity call** _(Hallalu CRM)_
  Start call now fires a tel: link (rings through the paired iPhone on a Mac), but no browser can tap the audio of a Continuity or phone call; Hallalu transcribes through the laptop microphone, so putting the call on speaker is the only way both sides are heard.
  <br>*Why:* The user said 'if it can't work with recording and transcript, don't'; claiming a transcript that cannot exist would be an invented capability.
  <br>*How:* Keep the dial action, show a one-line speaker tip beside the recorder, and state the limit in the help text.
- **State Instagram DM limits as verified: private reply within 7 days, one message, business cannot initiate** _(Hallalu CRM)_
  Primary documentation says a private reply to a comment is allowed for 7 days and only once, a business cannot start a conversation, and the Human Agent tag is for humans only; vendor blogs repeat a 24-hour window.
  <br>*Why:* Wrong limits turn into automations that Meta blocks and promises the product cannot keep.
  <br>*How:* Cite the Meta docs in the playbook and phrase auto-DM features as comment-triggered replies.
- **Label generated next steps and hide boilerplate when the run gives no signal** _(Aprizely)_
  When an agent supplies no nextSteps, report pages render a Next steps card from canned lines such as add a before/after metric next time and automate the repetitive part with a scheduled agent, even for runs with an empty queue and no issues.
  <br>*Why:* The owner asked for suggestions they may not have thought of; identical generic lines on every report read as filler and make the agent-written ones look equally generic.
  <br>*How:* Mark each card as suggested by the agent or auto-generated, derive fallback lines only from real data in the run (open queue items, issues, missing metrics, stale projects), and omit the card when there is nothing specific to say.
- **Folklore watchlist: never hard-code these statistics or rules in product copy** _(cross-cutting)_
  Traced or checked this run: '$100 per 1,000 followers' (a 10x inflation of a 2017 Digiday quote of $1,000 per 100,000); '3-5 content pillars' (earliest trace Later 2020; Hootsuite publishes seven; HubSpot gives no number); 5-3-2, rule of thirds, 80/20, 4-1-1 (unattributed); '5-7 follow-ups' (source said fifth to twelfth contact); SMS 98% open rate; '98% WhatsApp open'; deposits cut no-shows 65%; 'post daily or be punished' (unsupported, not disproven); skeleton loaders feel 20-30% faster (spinners tested faster); '94% of first impressions are design' (untraceable; 46.1% defensible); 'filters raise reach' (no credible evidence; the 21% figure is a Flickr study); NN/g 'comprehension halves on mobile' (2010, contradicted by NN/g 2016).
  <br>*Why:* Each of these has been repeated widely and would pass a casual check.
  <br>*How:* Keep the list in the research skill. For each claim in copy, record the primary source and date, or phrase it as 'no one has shown'. Use measured data where it exists (for example Collabstr, n=21,000 collaborations: paid medians YouTube $255, Instagram $193, TikTok $186, UGC $154; 80% of deals under $300).
- **Tell the client when a page notes their activity** _(Hallalu CRM)_
  The portal logs view, download, approve and pulse events (no IP, no cookies, pid as the key) and shows the owner 'viewed 3x, last seen 2h ago' and the emoji pulse, but nothing on the client's page says activity is noted.
  <br>*Why:* Attributing activity to an identified person without saying so is a transparency gap, whatever the storage.
  <br>*How:* Add one line ('this page notes when you open it and what you download') and make the owner-visible stats optional per portal.
- **No promissory wording and no invented value multipliers in pricing copy** _(Hallalu CRM)_
  Phrases such as 'free whenever you want it', 'forever' and 'always yours to export' were removed from account.js, views4.js and landing.html. A request for '20x / 4x' value multipliers was refused in favour of an honest 'Most complete' label and a sourced $80-90 comparison stack; the Free tier sits last.
  <br>*Why:* Promises and made-up multiples are a claims and legal risk.
  <br>*How:* Review pricing and plan copy for 'forever', 'always', 'unlimited' and ratios without a source; keep comparisons to documented prices.

## conversion (11)

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
- **Give free-tier users a real AI recap and Ava through Workers AI instead of a hard paywall** _(Hallalu CRM)_
  Ava's askAI() returned {error:'plan'} when needAI failed, and recaps fell to a verbatim on-device summary. A cheap flag now routes free users to @cf/meta/llama-3.3-70b-instruct-fp8-fast while Claude Haiku stays the premium voice, and Workers AI is the universal backup if the paid provider fails.
  <br>*Why:* The recap is the product's best moment; showing a raw transcript there is the worst first impression, and Workers AI costs only Neurons.
  <br>*How:* aiText({cheap:true}) tries Workers AI first; the client always sends provider and cheap; the UI upsells 'sharper writing with Claude' rather than blocking the feature.
- **For developer-tool marketing weight sets toward real product screens and disclose AI photos** _(cross-cutting)_
  Evidence gathered for the Aprizely creative run said builders trust real product screens more than AI-generated faces, so the 14-piece set was weighted toward real screens, composed with a real-product-screen layout, and AI photos carry an on-image disclosure line ('AI-generated photo - real product').
  <br>*Why:* Trust in AI-generated imagery is mixed and an undisclosed AI face risks the credibility the product is selling.
  <br>*How:* In the sell playbook add a real-screen ratio per set, a disclosure line on any AI photo, and a QA item that checks the disclosure is legible at feed size.
- **Per-entity Open Graph meta by rewriting the SPA shell in the Worker** _(BirthdayTreat)_
  Birthday links shared to chat apps showed a generic preview because OG tags were static in index.html.
  <br>*Why:* The link preview is the first impression and drives clicks for send-a-link products.
  <br>*How:* Worker fetches the asset shell, uses HTMLRewriter to inject og:title/description/image for the specific wall (escape values), and keeps caching headers short; verify with a crawler UA curl.
- **Lead the hero with the outcome and a before/after, not the mechanism** _(Hopefil World)_
  The market study showed rivals open with features; the page now opens with the finished result and a before/after pair.
  <br>*Why:* Visitors decide on what they get, not how it is built.
  <br>*How:* First screen: outcome sentence, one visual proof, one action; mechanism below the fold.
- **Living client progress report: verdict-first, freshness-stamped, degrades gracefully, no-login with optional comments** _(Hallalu CRM)_
  Three research lanes plus a counter-evidence lane converged: nobody pairs a beautiful no-login page with easy comments (no-login tools kill commenting, commenting tools force login); nobody pushes via WhatsApp or SMS; the 'clients ignore portals' critique is about login-gated, stale portals ('a stale portal is worse than email because the client believes it'). Design rules: a status verdict as the headline, a work timeline, coming-up-next, 'just needs you', a never-0% progress bar, end on forward motion, coral only for 'you are here', hours and internal tasks off by default, cap summaries at 5-6 items. Transparency backfires on a bad week, so the page falls back to the plan rather than an empty feed.
  <br>*Why:* The page's job is to relieve client anxiety, not to expose activity, and staleness shifts the burden to the owner.
  <br>*How:* Auto-assemble from logged work, show an 'Updated X ago' stamp, and nudge the owner when a portal goes two weeks without an update (still unbuilt).

## dev-experience (66)

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
- **Track deployed serverless/edge functions in the repo** _(cross-cutting)_
  Serverless functions (Supabase edge functions, Cloudflare Workers/Pages Functions) that are deployed but not committed to the repo become invisible — an agent or teammate reads the repo, concludes the function is missing, and builds a redundant, contract-mismatched replacement.
  <br>*Why:* A whole live payment/auth backend can be absent from source control; the next person duplicates it or routes around it, adding risk and drift. It cost a real detour on Finished. (a needless Cloudflare create-checkout in front of the working, deployed Supabase one).
  <br>*How:* Keep a tracked copy of every deployed function under supabase/functions/ or functions/, secrets read from a vault (never in the file), with a header noting it mirrors the live version. Diff repo-vs-deployed as part of review.
- **Prove client logic of a login-gated app with a Node harness of faithful copies run on real public data** _(cross-cutting)_
  When the authed modal cannot be driven (no credentials, candles endpoint returns 401), copy the pure functions (backtester, Monte-Carlo, scan) into a .mjs harness, feed them real public market data with permissive CORS, then confirm on the live deploy that window.Views.x is a function (the IIFE ran), the console is clean and the new strings exist in the served bundle.
  <br>*Why:* It verifies the maths and the bundle without ever typing a credential, and it catches guard-rule mistakes (a thin-sample rule that blocked the very trials the user wanted) before shipping.
  <br>*How:* Write the harness against exact copies, print per-pillar results, patch the rule, re-run, then render the real HTML templates from a localhost http.server for visual proof.
- **The Bash tool rejects commands containing raw control characters: write control-character regexes as \x00-\x1f escapes** _(cross-cutting)_
  Pasting a regex that contained literal control bytes into a heredoc made the command fail validation ('control characters that would be hidden in the approval dialog'), and the Write tool silently dropped them from the file.
  <br>*Why:* Retries wasted several turns and the written file was missing the character class.
  <br>*How:* Write /[\x00-\x1f\x7f]/ with backslash escapes via Write or a python chr(92) build, then node --check the file.
- **Blank screenshots and 30 s tool timeouts mean the Browser pane is hidden or the tab is not fronted, not that the page is broken** _(cross-cutting)_
  Repeatedly the DOM and console were healthy while screenshots came back blank or timed out ('pane is not displayed', 'tab is not fronted'). Calling tabs_context and tabs_select on the tab restored painting; when the compositor stayed wedged, read_page, javascript_tool, console and curl proved the same facts.
  <br>*Why:* It stops a false 'the app is broken' conclusion and avoids hacks like forcing .reveal elements visible.
  <br>*How:* Check tabs_context for 'hidden/not fronted', tabs_select the tab, retry once; otherwise verify through DOM/JS/console/network and state that visual proof was not possible.
- **Serialise iOS and macOS xcodebuild runs: parallel builds in one build directory collide** _(cross-cutting)_
  Launching the iPhone and Mac builds at the same time in native/build produced a build collision; chaining them one after the other and auto-committing on green worked and let the session continue.
  <br>*Why:* A collided build wastes minutes and can leave a half-written product.
  <br>*How:* Run 'xcodebuild ... iphonesimulator && xcodebuild ... macosx && git commit' in one background chain and poll the output file instead of sleeping.
- **Scanner detector for shadowed globals: duplicate window.X assignments and duplicate switch case labels across script files** _(cross-cutting)_
  Add a shadowing family to the Bug Ledger scanner: (a) the same window.<name> = assigned in more than one script listed in index.html, reported in load order so the later wins is explicit; (b) duplicate case '<act>' labels inside one switch; (c) typeof X==='function' call sites where X has no definition anywhere.
  <br>*Why:* Three Hallalu incidents (clientMeetingsCard defined in app.js and projects.js, a second case 'mark-sent', two onboarding flows) all passed node --check and rendered nothing wrong until a feature silently did not appear. The agent even believed clientMeetingsCard was undefined because its grep stopped at app.js and views.js.
  <br>*How:* Parse the script order from index.html, collect definitions per file with a regex, flag name collisions and orphan hooks; run it in scan.mjs --catalog and in the /finish checklist before any new window.* function is added.
- **House shell helper for macOS: perl-alarm timeout plus a fresh Chrome profile per headless run** _(cross-cutting)_
  macOS has no timeout command; three sessions hit it (Evertrue remote probe, Finished contact sheet, PostPlan slide export). The working helper is t(){ perl -e 'alarm shift; exec @ARGV' "$@"; } combined with a mktemp --user-data-dir for every headless Chrome call.
  <br>*Why:* Without a hard limit a wedged render or a hung wrangler dev --remote probe consumes the 120s to 600s tool budget and gets moved to the background silently.
  <br>*How:* Put the helper and the per-run profile pattern in the sell and kindly skill snippets and in compose.mjs and shoot.mjs; always wrap network probes and Chrome launches.
- **pxb gen: retry transient flux-2-dev 502s and report per-job status in parallel runs** _(Pixelbake)_
  Two of five parallel flux-2-dev bakes returned 502 'FLUX.2 dev could not bake that'. A shell pool using & printed 'done' while two files were missing, and manual retries ran past 300 seconds and were pushed to the background.
  <br>*Why:* Silent partial batches cost credits and let a missing portrait ship unnoticed.
  <br>*How:* Add --retry N with backoff, a non-zero exit code on failure, and a pxb batch file.json --parallel 2 mode that prints id, status and cost per item; the CLI should also verify the output file exists and is not blank.
- **Write the board state file outside the repo: .aprizely.worklog.json keeps getting committed and pushed** _(Aprizely)_
  The per-project board file lives in the working directory. It was swept into a SkillSea commit, pushed to a brand-new private GitHub repo for Evertrue after a manual check that it held no token, and shows as modified in Hallalu after every board update.
  <br>*Why:* It is machine state that dirties every git status, can leak titles to GitHub and collides when two sessions use the same folder.
  <br>*How:* Store it under ~/.aprizely/sessions/<hash of cwd>.json, or have apz start append it to .git/info/exclude.
- **Give icon containers a default SVG size so an unsized inline SVG can never fill its column** _(cross-cutting)_
  The most repeated UI bug across apps: Abba's heart inside a modal heading, Evertrue icons inside .kicker and then inside label (two separate rules needed in one session), Pixelbake's robot icon in a definition list and the album picker, and Hallalu chart SVGs. Note that Hallalu's own global svg:not([width]) default shrank unsized chart SVGs to 16x16, so a blanket rule has a cost.
  <br>*Why:* An unsized SVG expands to its container width and buries the real content, and it is invisible to node --check and unit tests.
  <br>*How:* Scope a default (width and height 1.1em) to icon contexts such as .kicker svg, label svg, h2 svg and dd svg, give charts explicit viewBox with width:100%, and add a scanner check for icon strings injected into elements without a size rule.
- **Syntax-gate every deploy: node --check all edited JS, and again after any killed or partial agent run** _(cross-cutting)_
  A dashboard edit left a duplicated half-open if(photo){ block in wed.js, producing 'Unexpected end of input' at line 367 that would have blanked the whole wedding app; node --check found it before deploy. In a later session node --check over ~30 files edited by agents killed mid-run proved no partial edit shipped.
  <br>*Why:* A single unbalanced brace in a no-build vanilla-JS app takes down every view, and agents killed by a rate limit can stop mid-file. Naive brace counters give false positives; the parser does not.
  <br>*How:* Before wrangler deploy run `node --check` on each changed .js/.mjs file (git diff --name-only | grep '\.m\?js$'), fail the deploy on any error, and re-run it after any interrupted multi-file edit.
- **Verify a native app against a local wrangler dev API with DEBUG-only env overrides instead of touching production** _(Abba)_
  API.swift reads ABBA_BASE and ABBA_TOKEN under #if DEBUG; wrangler dev --local on :8787 with all migrations applied via d1 execute --local and a throwaway account registered by curl; the simulator is launched with SIMCTL_CHILD_ABBA_BASE/ABBA_TOKEN; the Mac app must be exec'd as build/Debug/Abba.app/Contents/MacOS/Abba because `open` drops environment variables.
  <br>*Why:* Proves write paths (timer, edit, upload) on iPhone and Mac without polluting the live D1, and mediaURL and other builders must follow the same base or screenshots break.
  <br>*How:* Add the #if DEBUG override, route every URL builder through base, start the local worker, seed an account, launch with the SIMCTL_CHILD_ prefix, rebuild each target after the patch (a stale Mac binary ignored the override), and screenshot each screen.
- **Count-asserting patch helper for scripted multi-file edits: every find string must occur exactly the expected number of times** _(cross-cutting)_
  A tiny patch.mjs (find/repl/count per file, exits non-zero on 0 or more than expected matches, prints a tick per file) was used for all JS and Swift edits in a 23-file wave, and a syntax check followed each batch.
  <br>*Why:* String.replace silently no-ops when the anchor drifted, producing the classic 'only the call-site swap landed' half-edit that passes review and breaks at runtime.
  <br>*How:* Write patch(file, [[find, repl, expectedCount]]) that reads the file, counts split(find).length-1, aborts the whole run on mismatch, otherwise writes; call it from heredoc JSON, then node --check or xcodebuild.
- **When the Browser pane is hidden, verify with DOM metrics (counts, naturalWidth) instead of scroll and screenshot calls that time out** _(cross-cutting)_
  With the pane hidden, computer scroll timed out after 30s and a promise-based javascript_tool check hung for 45s; a synchronous check (cards with thumbnail, broken = complete && naturalWidth===0, total) returned 35/35 and 0 broken, and the detail page was proven by reading figure.hero img and figcaption.
  <br>*Why:* Pane-compositing quirks make visual checks flaky, while DOM counts are exact and cheap, and they expose a partial batch edit that a grep count hid.
  <br>*How:* Prefer synchronous javascript_tool expressions that return counts and broken-image lists, scroll with window.scrollTo via script, avoid awaiting image onload promises, and take one screenshot only after fronting the tab.
- **Front the tab and use project-local launch.json when testing in the Claude browser pane** _(cross-cutting)_
  Hidden panes throttle timers and rAF, and preview_start only sees a launch.json inside the project directory.
  <br>*Why:* Avoids chasing phantom freezes and 'server not found' errors.
  <br>*How:* tabs_select the tab before timing-sensitive tests; keep .claude/launch.json in the project root.
- **Test recording/camera features headlessly with Chrome fake-media flags and a getDisplayMedia stub** _(cross-cutting)_
  --use-fake-ui-for-media-stream --use-fake-device-for-media-stream plus a stubbed getDisplayMedia let recording flows run in CI-like headless Chrome.
  <br>*Why:* Media permission prompts otherwise block automated verification.
  <br>*How:* Launch Chrome with the fake-media flags, inject a stub returning a canvas captureStream for screen share, and assert the recorder output size > 0.
- **Patch code with the Edit tool or a quoted heredoc, and assert the anchor exists in scripted patches** _(cross-cutting)_
  Shell-quoted scripted patches mangled $, backslash and paren characters and String.replace silently no-oped.
  <br>*Why:* A silent no-op looks like success and surfaces later as a ReferenceError in production.
  <br>*How:* Use Edit, or cat <<'EOF' with a quoted delimiter; in scripts throw unless src.includes(anchor) and unless the output differs from the input.
- **Register the LCP observer with Page.addScriptToEvaluateOnNewDocument, not after load** _(cross-cutting)_
  The first perf run reported LCP 0 and 0 of 5 pass because the PerformanceObserver was attached after the entry had already fired.
  <br>*Why:* LCP and CLS entries are only delivered to observers that exist before they happen.
  <br>*How:* Inject the observer on new-document and read the buffered entries, with buffered:true as a second guard.
- **Audit at build time that every var(--x) used in CSS is defined** _(cross-cutting)_
  A small script lists custom properties used versus declared and fails on any undefined name.
  <br>*Why:* An undefined variable silently falls back to initial (transparent or inherit), the same class as the missing --card token.
  <br>*How:* Regex the CSS for var(--name), diff against :root and theme blocks, run in CI.
- **Verify a client-rendered page by rendering the DOM; a byte-identical curl shell proves nothing** _(cross-cutting)_
  A curl of the shell returned the same 82,682 bytes before and after a change because content is built by JavaScript.
  <br>*Why:* The server HTML of an SPA does not change when the client code does.
  <br>*How:* Drive headless Chrome and assert on rendered text or computed state.
- **CDP drivers must print exceptionDetails, not an empty object** _(cross-cutting)_
  A driver printed {} on a script exception; printing exceptionDetails.text and the stack exposed a safeHref ReferenceError.
  <br>*Why:* Runtime.evaluate returns exceptions inside a successful response.
  <br>*How:* Check result.exceptionDetails on every evaluate and throw with line and message.
- **Post JSON to the ledger from a file or a node script, never as an inline shell string** _(cross-cutting)_
  An apostrophe in a symptom broke the single-quoted curl body with unmatched quote errors and a backtick in a commit message swallowed words.
  <br>*Why:* Free text always contains quotes and backticks.
  <br>*How:* Write the payload to a temp file and use curl --data @file, or call https.request from node.
- **Make the scanner follow index.html and skip files that are never loaded** _(Bug Ledger)_
  Eight XSS-INNERHTML hits and a duplicate id came from an old app.js that no page loads, costing a manual triage pass.
  <br>*Why:* Dead files produce findings nobody can act on and hide real ones.
  <br>*How:* Resolve script tags from the HTML entry points and report unreferenced files as dead-code instead of scanning them.
- **Disable captureBeyondViewport and assert scrollTop before screenshotting a scrolled inner element** _(cross-cutting)_
  puppeteer element.screenshot re-laid out the page and reset an inner scroll container, so the after image matched the before image.
  <br>*Why:* The proof screenshot looked identical to the bug it was meant to disprove.
  <br>*How:* Use page.screenshot with a clip, captureBeyondViewport:false, set scrollTop immediately before capture and log it.
- **Every scripted multi-file patch must assert its anchor matched** _(cross-cutting)_
  Three times a python str.replace patch silently did nothing (script tags for calendar.js/extras.js inserted against a stale ?v= string, wire.js never added, a block located with .index() that did not exist) and the app shipped with missing modules or ReferenceErrors
  <br>*Why:* A silent no-op replace looks identical to success until a runtime ReferenceError appears deploys later
  <br>*How:* wrap replace in a helper that asserts old in text (or prints MISS), bump version stamps BEFORE inserting new tags, then verify with [...document.scripts].map(s=>s.src) and a missing-functions list after every deploy
- **Lint for duplicate case labels in switch-based event dispatchers and namespace state modifier classes** _(cross-cutting)_
  Two 'new-call' cases in one data-act switch made the first shadow the real handler, and a state class .ava collided with the avatar component class .ava
  <br>*Why:* JS allows duplicate case labels silently and shared class names cascade across components
  <br>*How:* add grep -o "case '[a-z0-9-]*':" app.js | sort | uniq -d to the pre-deploy check; name state modifiers is-* so they cannot match component rules
- **Verify generated .xlsx via Excel AppleScript from /tmp, and read value/number format, not 'text of range'** _(cross-cutting)_
  Opening the test file from ~/Desktop raised a macOS 'Excel would like to access files in your Desktop folder' dialog that hung every osascript call. After it was cleared, 'text of range' failed with Parameter error -50 while 'value' and 'number format' worked.
  <br>*Why:* A permission dialog blocks an unattended agent indefinitely, and the wrong property gives false failures.
  <br>*How:* cp the test file to /tmp, open -a 'Microsoft Excel', then read value of range and number format of range per cell. Also assert bold, fill colour, freeze panes and autofilter.
- **Screenshot with headless Chrome plus a cache-buster when the browser-pane screenshot fails or the pane is stale** _(cross-cutting)_
  The pane screenshot threw UnknownVizError on tall or resized viewports and served cached shells and sample data. Headless Chrome with --virtual-time-budget produced reliable full-page PNGs.
  <br>*Why:* Proof screenshots are a required deliverable, and a flaky capture tool should not block them.
  <br>*How:* Run Google Chrome with --headless=new --disable-gpu --hide-scrollbars --window-size=W,H --virtual-time-budget=7000 --screenshot=out.png and a random cache-busting query on the URL. Read the PNG at full size to QA it.
- **Wrap wrangler deploy in a backgrounded retry-with-backoff and gate on wrangler whoami first** _(cross-cutting)_
  Deploys failed repeatedly with 'malformed response from the API' and 'upstream connect error' during a Cloudflare API blip, and later with an expired OAuth token. Blocking the session on them wasted turns.
  <br>*Why:* Transient API errors and expired logins need different handling, and retries should not stall the work.
  <br>*How:* Run npx wrangler whoami to refresh or detect expiry. Then run a deploy loop of 6-10 attempts with 30-40s sleeps in the background, and confirm the served asset ?v= with curl before verifying.
- **Agent API silently drops unknown task fields; return an ignored-fields warning or carry data in existing strings** _(Aprizely)_
  /api/agent/worklog whitelists task fields to text/status/note/wave. A dedicated eta field would have vanished with no error, so ETAs had to ride inside the wave and task strings as (~NNm) tokens parsed client-side.
  <br>*Why:* Silent field stripping makes agents believe data was saved.
  <br>*How:* Return an ignored_fields array in the response, or extend the whitelist deliberately. Keep client parsers tolerant: a token wins at wave level, and a missing token renders no badge.
- **Auto-detect user-authored skills instead of hard-coding an ORIGINAL_SKILLS set** _(SkillSea)_
  scan.mjs files a ~/.claude/skills entry as 'your original' only if its name is in a hard-coded Set, which was hand-edited eight times in one stretch (finish, together, analyses, reason, window, keep, detail, ...). Anything not listed is catalogued as third-party 'installed'.
  <br>*Why:* Forgetting the edit silently miscounts originals and mislabels the owner's own work, and every new skill needs a code change plus redeploy.
  <br>*How:* Derive 'original' from provenance: a matching ~/.claude/commands file, or an 'origin: user' frontmatter field, or any skill not under ~/.claude/plugins. Keep the Set only as an override.
- **Verifying a fresh deploy in the Browser pane: defeat the 5-minute HTML cache and don't trust blank screenshots** _(cross-cutting)_
  The site served HTML with cache-control max-age=300, so the browser showed the old CSS and counts right after deploy. navigate() dropped the ?query, so the cache-bust did not apply. A hidden pane made screenshots time out while DOM reads still worked, and a tab pinned to a local file preview refused navigation.
  <br>*Why:* Verification against a stale or invisible page produces false 'not fixed' or false 'fixed' conclusions.
  <br>*How:* Run curl with a cache-busted URL for server truth. In the pane use location.replace(url+'?cb='+Date.now()), then read computed styles and DOM text. If the pane is hidden or screenshots are blank, say so and cite the DOM or curl proof. Open a new tab when one is pinned.
- **Author reports as JSON or template literals, not single-quoted JS strings, in the ANALYSES array** _(Analysis)_
  Report copy lives inside single-quoted JS strings in worker.js. While avoiding apostrophes, one callout was mangled to 'Couldn not-verify is not doesn not-exist' and had to be fixed before the node --check passed. The file is also edited concurrently by other sessions.
  <br>*Why:* One unescaped quote can take the whole Worker down at deploy, and writers distort the prose to dodge it.
  <br>*How:* Move entries to a data file (JSON/JS module with template literals) and validate with a schema check plus node --check in the publish script. Append entries by id, never by array position.
- **Verify an auth-gated SPA by serving public/ through a same-origin proxy that injects the agent token (bind to 127.0.0.1 only)** _(cross-cutting)_
  A ~30-line Node proxy serves the static files, forwards /api to the live Worker with the stored token, and the app boots signed in. This verified the real modals, labels and loaders without a PIN login.
  <br>*Why:* It proves UI work on authed surfaces with real data and creates no account.
  <br>*How:* proxy.mjs: http.createServer on localhost, static fallback for non-/api paths, add an Authorization header on /api, and stop it afterwards. Never bind to 0.0.0.0, since it holds a live token.
- **Browser-pane verification harness: assert the page first, wrap scripts in an IIFE, avoid hidden-pane actions** _(cross-cutting)_
  Repeated verification stumbles in the Aprizely, Breadcrumb and Payrails runs: a reload landed the shared tab on the /live board URL so every state check ran against the wrong page (S and go undefined); javascript_exec rejects a top-level return and a const redeclared between calls; computer scroll and screenshots time out or come back blank when the pane is hidden.
  <br>*Why:* Each stumble costs a round trip and can produce a false verdict that the feature is broken.
  <br>*How:* Keep the live board and the app under test in separate tabs (tabs_create); start every check by returning location.pathname and a known global; always wrap scripts in an IIFE that returns JSON.stringify of the result; prefer DOM reads and elementFromPoint over scroll and screenshots when the pane is hidden, and front the tab before taking pictures.
- **Replace hand-bumped ?v= cache stamps with content hashes at deploy time** _(cross-cutting)_
  Across Aprizely, Breadcrumb and Hallalu the asset version is bumped by sed (v23 through v28 in the sampled sessions), one Calm-view redeploy reused ?v=26 with changed CSS, and on Remembrance a stale-page theory was offered before the real cause was found.
  <br>*Why:* Manual stamps are forgotten or reused, and the symptom looks like a logic bug, so people debug the wrong thing.
  <br>*How:* Add a predeploy script that appends the first 8 hex characters of each asset's SHA-256 to its script and link tags in app.html, and serve the HTML itself with no-cache through _headers.
- **Add a free-disk preflight and alert before long agent runs** _(cross-cutting)_
  Recurring disk-full events on the Mac (Cursor state.vscdb around 13 GB, the Claude VM bundle, a phantom Adobe registry, TCC-hidden Photos libraries) end in ENOSPC, where Bash and file-write tools cannot even create their own output files, so an agent cannot save results or clean up; a curation run was stuck unable to write its JSON.
  <br>*Why:* The failure appears at the end of long runs, after the expensive work, and the tools give no warning beforehand.
  <br>*How:* Start /showwork, /deepscan and the curation scripts with df -h and stop with a clear message below roughly 5 GB free; write results incrementally to a small file early; keep a monthly reclaim checklist (sudo du for hidden folders) in the ledger DX notes.
- **Prune and consolidate the 3,412-rule settings.local.json permission allowlist** _(cross-cutting)_
  While diagnosing a Claude Code crash (an out-of-memory kill logged by ReportCrash after a macOS update) settings.local.json was found holding 3,412 accumulated allow rules, roughly one per approved command.
  <br>*Why:* A giant allowlist adds load and memory cost, hides risky entries among thousands of one-off commands, and keeps approvals meant for a single task alive forever.
  <br>*How:* Collapse repeats into a few prefix wildcards for known-safe CLIs, drop rules that embed literal paths, ids or secrets, run a quarterly pruning script, and keep high-risk commands out of the allowlist.
- **When a user says it is not working, reproduce under their conditions before blaming cache** _(cross-cutting)_
  On Remembrance the user reported the race and ethnicity buttons as not working after a real mouse click succeeded in the agent's browser; the agent first answered that it was a cached older copy and added no-cache headers, and only later found the page falls back to a stale inline dataset when data.json cannot be fetched.
  <br>*Why:* Dismissing the report as cache cost several rounds and left the user unconvinced.
  <br>*How:* Check the failure paths first (fetch failure, file preview, a second browser profile, mobile width, the console on a cold load) and only then suggest a hard refresh; state what was and was not reproduced.
- **Scripted pbxproj edits: assert the anchors before writing and scope replacements to one target** _(Stepapa)_
  A global string replace injected the app's entitlements line into the widget target's build configurations and an assert placed after the write masked it; a substring filter earlier removed GENERATE_INFOPLIST_FILE lines.
  <br>*Why:* pbxproj edits fail silently (a wrong target still builds) and corrupt several configurations at once.
  <br>*How:* Back up the file, assert the expected count of anchor matches per target before writing, scope each replacement to the target's configuration block, and re-assert the critical keys (GENERATE_INFOPLIST_FILE, entitlements) after.
- **CDP screenshot scripts must pick the page target, not targets[0] (the Omnibox popup is often first)** _(cross-cutting)_
  A hand-rolled Chrome DevTools screenshot script attached to targets[0] of /json and hung with an empty shots folder; selecting the target with type 'page' that is not the Omnibox popup fixed it, after a stuck background task had to be stopped and the debug-port Chrome killed.
  <br>*Why:* Headless/remote-debugging Chrome lists several targets (omnibox, extensions, service workers); capturing the first one produces silent empty output that reads as a slow render.
  <br>*How:* Filter targets by type==='page' and exclude title /Omnibox/, log the chosen target's title and url, poll for the PNG instead of waiting on process exit, and kill the profile's Chrome before re-running.
- **Prove Workers AI model shapes with a wrangler dev --remote harness before shipping, not from the docs** _(Hallalu CRM)_
  With no admin session available, a throwaway remote-dev harness exercised the real Whisper and Llama 3.2 vision bindings and found two schema bugs the docs and tutorial had misled (word timestamps nested in segments[].words[]; image requests need prompt, not messages) plus a false-positive 8007 NSFW rejection on a plain red square.
  <br>*Why:* Unit checks and rendered UI had all passed; only the real binding exposed the shape mismatches that would have blanked every shot's spoken line and failed every frame.
  <br>*How:* Start wrangler dev --remote on a spare port with a tiny /t/* route per model, send a spoken sentence and a benign generated image, assert the response keys, then delete the harness and record the proven shapes.
- **Verify a fixed overlay with an elementFromPoint overlap sweep across pages and viewports** _(Abba)_
  For the heart-never-covers-info request, an overlap sweep on the dashboard and badges pages found zero page elements under the heart at desktop and mobile sizes after the title rows reserved a gutter for it.
  <br>*Why:* Eyeballing a screenshot misses content hidden under a fixed button at one width; the sweep makes 'never covers info' a measurable check.
  <br>*How:* For each route and viewport, sample the overlay's bounding box, collect elementsFromPoint at its corners and centre, and fail when any non-overlay content element is returned.
- **Test a new data-act value against the click-delegate switch with a script that lists every data-act in the markup and the cases handled** _(cross-cutting)_
  After adding cards and views the session found two buttons wired to an action name no handler knew, only by luck of a grep
  <br>*Why:* Delegated-click SPAs fail silently on an unknown action; there is no error to see
  <br>*How:* CI/pre-deploy check: collect all data-act values from public/*.js templates, diff against the case labels of the delegate, fail on any orphan
- **Move Joy Day off its hand-patched auth-gate (CSS-hidden tabs, prefilled hidden identifier) onto the module passcode mode that shipped later** _(Joy Day)_
  On 6 Sep Joy Day used the full sign-up/sign-in card as a one-person PIN pad by hiding the segmented tabs with CSS, hiding the identifier field and prefilling it because sign-in refuses an empty identifier, and making the fixed overlay backdrop transparent, across three patches. On 1 Oct auth-gate v1.1 gained mode passcode (v1.2 adds remember-me and forgot), which Joy mail uses
  <br>*Why:* A hidden-but-required field and CSS overrides break on the next module update, and Joy Day does not get remember-me or the shared lockout behaviour
  <br>*How:* Replace the three patches with FinishedAuth.mount(..., {mode:"passcode", pinLength:6, onPasscode}), keep the HMAC session, and add the per-IP failure counter the Joy mail worker uses
- **Receive-path smoke test for Email Routing: SMTP to route1.mx.cloudflare.net over IPv4 from a sender domain with no SPF** _(cross-cutting)_
  A hand-rolled node:net SMTP session was rejected with 550 'Sender IP reverse lookup rejected' because the connection left over IPv6 without reverse DNS; forcing family:4 delivered, and a sender domain with no SPF record (result none) was accepted. Cloudflare's inbound MX rejects an IPv6 sender with no rDNS and hard-fails only on failing SPF or DKIM, which makes a 40-line script a repeatable end-to-end test of catch-all, Worker, R2 and D1
  <br>*Why:* Proves the whole receive pipeline without needing a second mail service
  <br>*How:* Open the socket with family 4, use a MAIL FROM on a subdomain with no SPF record, poll the authenticated messages API for the marker, then delete the test row
- **Send X-Robots-Tag noindex on public share-by-link doc Workers so a hand-out link is not crawled** _(Joy Docs)_
  joy-docs serves the Handbook and the market dossier from a public static-assets Worker so one link works for everyone, with no auth and no robots header; the pages name the live webmail URL, the mail domain and the architecture
  <br>*Why:* A share link intended for a few readers becomes a search result; the same applies to every static docs Worker in the portfolio
  <br>*How:* Add a _headers file with X-Robots-Tag: noindex, nofollow and Referrer-Policy: no-referrer for /*, or a robots.txt Disallow, and keep an opt-in public flag per doc
- **Verify a Supabase-gated app locally by seeding the REAL auth storage key with a far-future expiry and the anon key as the access token** _(cross-cutting)_
  Seed localStorage key sb-<project-ref>-auth-token with expires_at far in the future and access_token set to the project's publishable key. getSession() then returns without a network call and edge-function gateways that verify the JWT accept it.
  <br>*Why:* A made-up key name passes the 'entered' check but cloud.ts raises the auth-expired event and flips the gate back; a token of 'f' makes background calls 401 and bounces to the sign-in screen.
  <br>*How:* Write the seed in one javascript_tool call on the dev origin, reload, and treat any 401 from your own edge functions as 'needs a real session' rather than a bug. Never create accounts or type PINs.
- **Drive React forms from the Browser pane by dispatching events, and read state instead of trusting focus** _(cross-cutting)_
  Automation 'type' ignores programmatic focus and caret moves done in requestAnimationFrame, the Return key does not fire React onKeyDown, and same-tick clicks are batched so the DOM is stale between them.
  <br>*Why:* Caret-insert and keyboard shortcuts looked broken or fine for the wrong reason during verification.
  <br>*How:* Set values with the native setter plus a bubbling input event, dispatch a real KeyboardEvent for Enter, click once per call, and assert on textarea.value and selectionStart.
- **Test SECURITY DEFINER functions through execute_sql by setting request.jwt.claims to a real user** _(cross-cutting)_
  select set_config('request.jwt.claims', json_build_object('sub', <real uid>)::text, true) then call the function in the same statement batch.
  <br>*Why:* The function reads auth.uid(); foreign keys need a real user; RAISE NOTICE output is not returned and a rollback cannot span separate calls.
  <br>*How:* Pick a throwaway real user, assert results with select statements, and make the function idempotent so re-running is safe.
- **Test third-party fetches under the production CSP with vite preview, not the dev server** _(cross-cutting)_
  Keep a launch.json entry that serves the production build with the real public/_headers (a prod-csp configuration) and run new network features through it.
  <br>*Why:* Dictionary and translate APIs worked on the dev server and would have been blocked in production by connect-src.
  <br>*How:* Add each new origin to connect-src in the same commit as the fetch, then verify under the preview.
- **Ship the generator and source packs beside generated data files** _(Finished.)_
  vocab-extra.ts says 'do not hand-edit, regenerate via gen-extra.mjs' but the generator, the researched lists, build-dict.mjs and words_alpha.txt lived only in a session scratchpad and /tmp.
  <br>*Why:* Scratchpads can be wiped, which leaves a 3,763-line generated file nobody can regenerate or audit.
  <br>*How:* Commit scripts/ with the generator and a SOURCES.md (origin, licence, date) for every pack; keep large raw downloads out of git but record their URLs and hashes.
- **Unit-test pure parsing code by esbuild-bundling the real source and importing it from a data: URL** _(cross-cutting)_
  Bundle src/lib/timetable.ts with esbuild (platform neutral, localStorage shim), import the result via a base64 data: URL and run a fixture table.
  <br>*Why:* Six spoken-day fixtures (run-on, no-time list, ranges, bare times, food safelist, '3 apples') found four splitter bugs in minutes without a test framework.
  <br>*How:* Keep the fixture table in the repo and rerun it after every parser edit.
- **After a deploy, prove the browser loaded the new build before testing it (and curl with a unique query first)** _(cross-cutting)_
  In one session the Browser pane served the previous index.html after a successful wrangler deploy on more than ten occasions (v97 vs v98, v119 vs v120, v147 vs v148, v151 vs v152, v168 vs v169, v169 vs v170). ?cb= and location.replace(?x=Date.now()) often still loaded the old document; only a brand-new unique URL worked. About ten turns were once spent suspecting wrangler, the wrong directory and a service worker. navigate returns before the old document has finished running.
  <br>*Why:* Verifying against a stale build produces false failures (feature 'missing', 'S is not defined') and false passes, and burns turns.
  <br>*How:* 1) curl the page with a unique query and grep the build stamp (?v=NNN). 2) In the page, assert the loaded script's ?v= equals the expected before running any check, and if it does not, navigate to a never-used URL. 3) When a chart or element looks wrong, measure getBoundingClientRect and the computed style before telling the user to hard-refresh; the 16px chart bug was blamed on cache first.
- **Lint generated CSS custom-property values: AI-written hex tokens were corrupted three times** _(cross-cutting)_
  Garbage spliced into colour values: dashboard artifact '--ink-2:#586ersync,#586472' and dark-mode '--win:#2cc1 ae,#2cc1ae'; portal.html '--ink3:#79footer;--ink3:#7c8697'. An invalid custom-property colour silently drops the token. All were caught by eye on self-review; one only hours later.
  <br>*Why:* Silent token loss shows up as odd greys and missing accents, not an error.
  <br>*How:* Before publishing or deploying, regex every --token value that starts with # against ^#[0-9a-fA-F]{3,8}$ and fail on anything else; also reject duplicate declarations of the same token in one block.
- **node --check cannot catch hallucinated helpers or classes; add a no-undef and class-exists check** _(cross-cutting)_
  portal.js was written against micBtn(), openShareSheet() and a .modal-wide class that do not exist; node --check passed because undefined globals only fail at runtime. It was caught only because the assistant grepped the codebase for each helper before deploying (the real patterns were .mic-in[data-mic-target] with attachMics(), and shareClientSummary()). A half-built registry entry (msgDeposit referenced but never defined) was also self-caught.
  <br>*Why:* Hallucinated APIs pass syntax checks and fail in front of the user.
  <br>*How:* Run eslint with no-undef (window globals declared) or a script that extracts called identifiers and class names and greps for their definitions; run it as part of the pre-deploy step.

## integrity (80)

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
- **Strategy Lab: 'survives' is a multi-pillar rule that names the failing pillar, and thin samples show their trials but can never pass** _(Abba)_
  Replaced a 5-window/16-variant check with 200 Monte-Carlo reshuffles of the strategy's own trades, up to 40 rolling windows, a robustness sweep and a 10-symbol hold. A strategy earns paper trading only if every pillar clears (>=60% Monte-Carlo with positive median, >=55% windows, >=55% robustness plateau, >=half the symbols, positive out-of-sample) and it has >=15 trades; under that it still displays the trials but is flagged THIN and cannot pass.
  <br>*Why:* A single lucky split or a short record can look like an edge; showing the trials makes fragility visible while the hard rule stops a flattering result being promoted, and naming the failing pillar tells the user what to rework.
  <br>*How:* Compute each pillar as a boolean, verdictPass = all pillars && !thin, build the failure sentence from the failed pillar names, guard below ~5 trades with 'not enough to judge', and validate the maths in a Node harness on real candles before shipping.
- **Make a product-policy rule executable: verdict stored per product, unknown categories fail closed, and the seed builder must refuse adversarial listings** _(ABS)_
  The 'no licence needed' promise lives in compliance.js (category rules, claim tripwires such as health claims on apparel or a power bank filed as decor) and is applied identically to seller listings, admin writes and AI-drafted listings; seed/build.mjs screens every SKU and also asserts a set of must-refuse items.
  <br>*Why:* A rule in a PDF gets ignored by the first seller who uploads something else; a gate in code plus must-fail tests keeps the promise true after every change.
  <br>*How:* Single screenListing(category,title,description,evidence) returning allow/verdict/missing; fail closed on unknown categories; add adversarial fixtures to the seed script and fail the build loudly if one is admitted.
- **Switching a storefront's currency means converting at a verified FX rate with retail rounding and sweeping every default** _(ABS)_
  Relabelling GBP prices as USD would have silently cut every price about 26%. Rate was verified from two sources (1.3538), prices converted and rounded to .99, and price, compare_at, cost, wholesale tiers, free-shipping threshold, flat shipping, money() default, schema defaults, filter bands, schema.org priceCurrency and the voice parser's currency words were all moved together.
  <br>*Why:* A partial swap leaves the catalogue in one currency and thresholds or defaults in another.
  <br>*How:* Script the conversion over every price-bearing column, grep for the old symbol/code, then verify with a server-side re-priced checkout in the new currency.
- **paint-a-fix should show a before/after diff and warn when the masked region barely changed** _(Pixelbake)_
  An sd15-inpaint fix on a third hand returned a success line and cost one credit, but the extra hand was still there; a flux-2-dev re-bake fixed the pose.
  <br>*Why:* A fix that silently does nothing wastes credits and leaves a visible AI artefact in a shipped creative.
  <br>*How:* Compare pixels inside the rectangle before and after, warn below a change threshold, and offer a remove-object mode using a klein edit with the original as reference.
- **Reports are append-only, so republishing creates a new id and the already-shared link keeps saying 'Not shipped yet'** _(Aprizely)_
  Republishing the report with a ship block (committed, deployed, version) produced a second report; the first, which the user had opened, still showed the stale status.
  <br>*Why:* The link the user holds is the one they trust; a stale 'not shipped' chip undermines the evidence.
  <br>*How:* Add apz report --supersede <id> that stamps the old report with 'superseded by <new id>' (append-only note, no edit), or publish the report once after ship.
- **Never encode an unpublished price as 0: use NA so cost math cannot silently treat it as free** _(Pixelbake)_
  Models without a published price were given cost:()=>0, and fitsFreePool then treated them as free, undercounting true spend and letting them bypass the free pool.
  <br>*Why:* A zero is a claim (it is free); an unknown is not. Margins and free-tier logic built on 0 are wrong in the user's favour and invisible.
  <br>*How:* Represent unknown as null/NA, make cost consumers throw or label 'unpriced', exclude NA models from free-pool logic, and only quote numbers copied from the published rate card (worker.js:73-91, 841).
- **Enforce append-only at the database with triggers, not by convention** _(PatentCake)_
  D1 triggers RAISE on UPDATE and DELETE of the registry tables, so a bug or a rogue caller cannot edit or remove a disclosure.
  <br>*Why:* An evidence registry is only worth anything if history cannot be rewritten; code review alone does not guarantee it.
  <br>*How:* CREATE TRIGGER ... BEFORE UPDATE/DELETE ... SELECT RAISE(ABORT,'append-only'); add a test that attempts both and expects failure; corrections are new rows that reference the old id.
- **Optimistic lock (rev) on envelope save to stop two tabs overwriting each other** _(Fullfill)_
  Saves carried a revision and the server rejected writes against an older rev.
  <br>*Why:* Prevents silent last-write-wins data loss in a multi-tab, multi-signer document flow.
  <br>*How:* UPDATE ... WHERE id=? AND rev=? then rev+1; on 409 reload and merge; show a non-blocking 'updated elsewhere' notice.
- **Record source and verification date beside every research-derived product rule** _(cross-cutting)_
  A restriction citing the wrong direction of a study shipped because the rule carried no provenance.
  <br>*Why:* Makes claims auditable and lets a later reader re-verify before trusting or removing a rule.
  <br>*How:* Keep RESEARCH.md entries as claim, primary source link, verified-on date, and what the product does because of it; re-read the primary before encoding a limit.
- **Refresh the agent CLI on every run and add 'login <key>' so stale clients cannot pin agents to old behaviour** _(cross-cutting)_
  A cached apz.mjs guarded by a file-exists check kept agents on a stale version that lacked new commands.
  <br>*Why:* Prevents drift between server and the CLI agents actually run.
  <br>*How:* curl the CLI unconditionally at start, and provide an explicit login command that writes the token file.
- **Reconcile generated images against the studio by (width x height, byte size) plus bake time, never by timestamp alone** _(Pixelbake)_
  To find AI images that never reached the studio, local files were matched to records. A time window falsely matched 156 of 188 files, dimension matching dropped it to 74, and byte-exact (WxH:bytes) plus time-and-size gave 14 genuinely unfiled. Studio timestamps were London time while file times were local EDT, and queue latency shifted bake times.
  <br>*Why:* Timestamp-only joins hide real strays and invent others; size and dimensions identify the exact file, so 'zero AI images left unfiled' can be proven.
  <br>*How:* Pull the full library per project (the list endpoint caps at 200), stat local files, read dimensions with sips, match on exact WxH:bytes first then fall back to time window AND dimensions, exclude screenshots/downloads, print the unmatched list as the queue.
- **POST /api/bugs has no server-side duplicate check** _(Bug Ledger)_
  A sync posted 83 items and the response reported skipped(dup)=0 because dedupe existed only against the client's own local log.
  <br>*Why:* Any agent re-run or second agent files the same title again.
  <br>*How:* Hash app plus normalised title server-side, return 200 with duplicate:true and the existing id.
- **The coverage gate accepts a bulk notFound list, so full coverage can be claimed without checking anything** _(Bug Ledger)_
  A single script posted all 337 titles as notFound and got a full-coverage tick; nothing in the request proves any item was examined.
  <br>*Why:* A self-reported checklist rewards speed over verification.
  <br>*How:* Require evidence per item (file, detector id or command) for a sampled subset and reject payloads whose notFound list was generated from the catalog without per-item notes.
- **A critique is a claim too: verify the critic before editing shipped copy (and do not over-correct)** _(cross-cutting)_
  Two critiques were acted on unverified: the Kellogg quote was truncated (dropped '(besides generally faster and more efficiently)'), the critic claimed speed-to-lead rests only on a 2007 deck while omitting HBR 2011 (1.25M leads, 42 companies), and cited first-mover papers selectively; the verification pass also found 4 shipped legal claims wrong
  <br>*Why:* Following an unchecked critique degraded the product and removed a true concept; the right fix was narrower than the one made
  <br>*How:* before deleting or rewriting a claim on a critic's say-so, run a second pass that reads the primary sources of both the claim and the critique, label VERIFIED/OVERSTATED/FALSE, then restore anything wrongly cut
- **Never let an LLM do date arithmetic: pass the user's phrase through and resolve it in code** _(cross-cutting)_
  Asked for 'next Tuesday' the model returned 2025-01-07 with today's date in the prompt; clamping past dates only moved it to 2027
  <br>*Why:* A reminder in the wrong year simply never appears, with no error
  <br>*How:* prompt says 'say the day as the person said it, never compute a date'; dayOf() resolves today/tomorrow/in N days/weekday/next week deterministically and pulls any past ISO date forward; show the resolved date back to the user
- **Pin the Stripe API version: the 2026 'Dahlia' release removed ui_mode embedded and initEmbeddedCheckout** _(cross-cutting)_
  Code written from memory used ui_mode:'embedded' and stripe.initEmbeddedCheckout(), both removed (not deprecated) in the 2026-07-29.dahlia release; the correct values are ui_mode 'embedded_page' and createEmbeddedCheckoutPage from js.stripe.com/dahlia/stripe.js
  <br>*Why:* An unpinned integration starts failing on a date nobody chose and the first customer finds out
  <br>*How:* send Stripe-Version on every REST call, read the release notes before coding checkout, use invoice.paid and customer.subscription.trial_will_end, implement a free week as an entitlement flag not trial_end (which would overwrite a paying subscription's trial)
- **Prove webhook signature verification with a forged-request harness** _(cross-cutting)_
  9-case harness against the live endpoint: correct signature accepted, replayed event deduped, body tampered, wrong secret, 400s-old timestamp, 400s-future timestamp, v0-only downgrade, secret rotation
  <br>*Why:* Verification code that merely fails closed when the secret is missing proves nothing about the HMAC path
  <br>*How:* set a throwaway whsec_ secret, sign with node crypto createHmac sha256 over t.body, assert 200/duplicate/400 per case, then replace the secret with the real one
- **Source registry carries per-platform compliance flags that change what the CRM allows** _(Hallalu CRM)_
  Dribbble deems you introduced by viewing a profile and requires 12 months of on-platform billing with audit rights; Etsy/eBay/Amazon/Upwork/TaskRabbit/Airtasker forbid off-platform contact or payment; Care.com penalises scraped data; Remote OK requires a dofollow attribution; NoDesk bans aggregator access; Thumbtack refunds only within 45 days
  <br>*Why:* A CRM that cheerfully drafts a direct invoice for a Dribbble-introduced client walks the user into a contract breach
  <br>*How:* store an introducedOn date and a billOnPlatformUntil flag per source, warn or block direct invoicing, never build importers for platforms whose terms ban them, record unverified items as unverified
- **Shared free-tier quotas need per-account metering: Google Studio TTS 1M free characters is per project, not per customer** _(cross-cutting)_
  Studio voices cost $160 per million characters beyond the free 1M (about 20 hours) and cap each request at 5,000 bytes; the wording had implied 20 hours per customer
  <br>*Why:* One heavy user can burn the whole project allowance and the bill
  <br>*How:* per-plan character budget with a visible meter, chunk text on sentence boundaries under 3,800 bytes using TextEncoder byte length, say plainly that the free allowance is shared
- **Struck-through 'was' prices: charge the list price genuinely first and gate the sale behind a flag with a recorded launch date** _(cross-cutting)_
  A $15 struck through to $7 on day one fails UCPD Art 6(1)(d) / DMCC s.226 presentation tests (SaaS is not covered by the EU goods 30-day rule), enforcement is live (SHEIN EUR40m), and anchoring barely moves real purchases (Brzozowicz & Krawczyk 2022: +0/+0/+14%)
  <br>*Why:* Fake reference prices are an enforcement target and may not even convert
  <br>*How:* SALE config disabled at launch, launch date stored for audit, show $15 now, flip the sale only after 30 days with a lowest-price disclosure; remove every 'forever' price promise and offer 60 days written notice instead
- **Multi-shop 'All shops' roll-ups must never add across currencies** _(Evertrue)_
  Give every record a shopId and let each shop carry its own currency, fee table, Star Seller thresholds, goals and challenge. In 'All shops' mode show per-currency totals and per-shop cards, never one summed number.
  <br>*Why:* Adding USD and GBP produces a figure that is true in neither currency and silently wrong for any seller with two storefronts.
  <br>*How:* Stamp shopId on every record and migrate existing data into the first shop. Add Store.sid(base) for per-shop singleton ids and an 'all' pseudo-shop. Group by currency in the hero stats, and format each row with its own currency.
- **Don't display an invented time for date-only imported values** _(Evertrue)_
  Etsy CSV dates carry no time. Formatting them with a time shows a fabricated '12:00 AM'.
  <br>*Why:* A made-up time reads as data and misleads ship-by and reply-clock reasoning.
  <br>*How:* Use a hasTime(ms) check (hours, minutes or seconds non-zero) and append the time only when the source had one.
- **Check the terms of a feed before building a feature on it** _(cross-cutting)_
  Google News RSS was reachable from the shell, but its terms limit it to personal use. The news feature used Etsy's own investor press RSS plus the Community announcements page and labelled curated versus fetched items honestly.
  <br>*Why:* A reachable endpoint is not a licence, and building on one forces a rewrite later.
  <br>*How:* Prefer first-party RSS or HTML. If a forum exposes no RSS, parse its embedded JSON. Read datePublished from the topic page's ld+json rather than stamping fetch time. Store only title, link and date.
- **Verify a 'verbatim law' string with a script across every file; keep it on one physical line** _(cross-cutting)_
  When a user's exact wording is embedded as the governing text of a skill, markdown line-wrapping and a stray period broke the exact match in the command file while SKILL.md and the checklist passed. A node script that reads each file and checks includes(V) caught it, and later skills put the sentence on a single line.
  <br>*Why:* 'Embedded verbatim' is otherwise asserted, not proven, and shell one-liners mangle characters such as em-dashes, arrows, >= and nested quotes.
  <br>*How:* Write the check as a script file (not a shell argument) that normalises nothing and reports EXACT/MISSING per file. Keep the law on one unwrapped line and re-run the script after every edit.
- **Digital-content and credit checkouts need express consent plus acknowledgement of the lost right to cancel** _(cross-cutting)_
  Under the UK Consumer Contracts Regulations 2013 reg 37, the trader must not begin supplying digital content before the cancellation period ends unless the consumer has given express consent and acknowledged that the right to cancel is lost. This applies to AI credits, downloads and instant-access checkouts in Pixelbake, Stitchhooky, Hallalu and similar apps.
  <br>*Why:* Without the two-part consent the buyer keeps a 14-day refund right on content already consumed, and the trader bears the loss.
  <br>*How:* Add a required unticked checkbox at checkout that records consent, acknowledgement and timestamp with the Stripe session. Show the refund policy, and note that the DMCC subscription regime has been delayed to spring 2027.
- **Check the payment processor's restricted-business list before monetising trading or advice tools** _(cross-cutting)_
  Stripe's restricted-businesses page lists 'consultation, advisory services or tools providing guidance on how to profit through trading or investments in financial products or cryptocurrency'. Trader-journal, backtester and signal apps can fall inside that wording, and the research found small operators shut down by Stripe, Etsy, Yahoo or Meta rather than fined.
  <br>*Why:* An account closure is the real enforcement risk for a solo developer and it can freeze all revenue.
  <br>*How:* Read the processor's restricted and prohibited lists per app before enabling billing. Position the product as process and record-keeping, keep the not-investment-advice and hypothetical-results disclaimers, and keep a second processor ready.
- **Run a controlled A/B before shipping an 'improvement' - a confounded comparison almost shipped double-ESRGAN** _(Pixelbake)_
  Chained 2x+2x ESRGAN looked clearer than a single 4x pass, but the single pass in that comparison had weaker sharpening. Re-testing with equal finishing showed negligible extra detail.
  <br>*Why:* It stopped a costlier, slower pipeline from shipping on a false win, and it was reverted openly.
  <br>*How:* Change one variable at a time on the same low-res source and compare matched crops at equal display size. Keep a result only if it survives the controlled re-run, and revert and say so if it does not.
- **Price labels must come from the same function that bills (live /api/estimate), never hardcoded** _(Pixelbake)_
  The 'Bake the fix - 2 credits' button hardcoded a price while creditsFor() scaled by model and size (42 for FLUX.2 dev, 8 for klein-4b at 2048 square). The same static-label pattern was reported on the re-engineer compare and carousel fix buttons but not verified.
  <br>*Why:* A wrong price label on a credit product is a trust and refund problem.
  <br>*How:* Render the button without a number, call the estimate endpoint on open and on every model or size change, and write credits_needed into the label; grep every button that triggers a billable bake.
- **Show a VLM identity-match score, label it an estimate, and require a likeness-consent acknowledgement** _(Pixelbake)_
  Each character bake runs a vision check and shows 'identity match N/10 - off: nose, eyebrows, lips'. Workers AI has no face-embedding model, so the UI says this is an AI estimate, not biometric. Saving a person requires a consent tick (NO FAKES / GDPR / EU AI Act).
  <br>*Why:* It surfaces the signal competitors hide, avoids overclaiming accuracy, and covers likeness-rights exposure. Observed scores: 9/10, 8/10 and 6/10.
  <br>*How:* Two-step vision check returning {score, same, off[]}, with the score shown as a lightbox chip, an honest-limits note (profiles, expressions, aging) and a mandatory consent checkbox on save.
- **Charge for a paid AI call only after provider success, and say 'Nothing was charged' on failure** _(cross-cutting)_
  The Pruna 'Insufficient AI Gateway credits' failure returned a 502 with 'Nothing was charged.', and credits were debited only after the output was stored.
  <br>*Why:* Provider billing and quota errors are common and must never cost the user credits.
  <br>*How:* Run the call, validate and store the output, then debit with the image id as the reference. Map provider error codes to plain-English messages and log an 'issue' event.
- **Derive the registry's count from the array length at deploy, and keep a single served modules.json** _(Coco Modules)_
  A hand-edited 'count' field had silently drifted by one, and edits to an unserved duplicate file deployed nothing.
  <br>*Why:* Agents read this registry as the source of truth.
  <br>*How:* A predeploy script sets count = modules.length and fails if the root and public copies differ. After deploying, verify with a ?v=timestamp fetch.
- **Give any temporary auth bypass a greppable marker and prove it is gone before committing** _(Finished.)_
  A local #verify gate bypass was added in App.tsx (entered initial state and the auth-expired handler), tagged TEMP-VERIFY-BYPASS, then removed.
  <br>*Why:* A forgotten test bypass in an auth gate is a shippable vulnerability. The marker made absence provable.
  <br>*How:* Tag every temp bypass with a unique token, run grep -rn TEMP-VERIFY-BYPASS src before staging, and check git diff --stat shows only the intended files.
- **When you add input sanitising, also harden render-time CSS so already-stored damaged content is repaired** _(Finished.)_
  Docs saved before the fix still held pasted inline styles. CSS forces ul[style] and li[style] back to outside markers with proper padding.
  <br>*Why:* A fix at the input boundary does not repair existing records.
  <br>*How:* Add attribute-selector overrides (ul[style], ol[style], li[style]) that restore list-style-position, padding and marker colour, and test them on a pre-fix saved document.
- **Mark synthetic or test screenshots so they never join a project's real Screens record** _(Aprizely)_
  Five generated mockup PNGs were uploaded through apz.mjs shots with the same labels and before/after stages as genuine captures (Dashboard, Reports) and attached to the Aprizely project; the store is append-only so they cannot be removed.
  <br>*Why:* The Screens tab, live board and reports present shots as evidence, so test images in the permanent record mislead anyone who compares before and after later.
  <br>*How:* Add a test stage that is excluded from compare pairing and public galleries by default, have the CLI refuse to attach test uploads to a real project unless explicitly forced, and require the report to say when shots are synthetic.
- **Fail closed when the pepper secret is missing instead of hashing without it** _(Aprizely)_
  The first Aprizely deploy went live before APZ_PEPPER was set (the secret was uploaded after the deploy), and passcodes are hashed with PBKDF2 plus that pepper; an account created in the gap would have been hashed differently from every later login.
  <br>*Why:* A silently missing pepper creates accounts that can never log in once the secret is added, and the pepper is already flagged as impossible to rotate.
  <br>*How:* Return 503 from the auth entry points when env.APZ_PEPPER is absent or shorter than 32 characters, put set secrets before the first deploy in the new-app checklist, and add the same guard to every Worker that uses the Finished-style pad.
- **Use Breadcrumb's email-plus-phrase, throttled, self-import-blocked pattern for every account import** _(Breadcrumb)_
  Breadcrumb recovery phrases are salted PBKDF2 hashes, so the new import-from-another-account endpoint takes the source email and the phrase, runs the same lockout gate as sign-in, blocks importing your own account and copies rows with new ids without touching the source. Aprizely's import finds the source account from the phrase alone, which depends on a deterministic recovery-hash lookup (recalled in-session, not re-verified).
  <br>*Why:* Phrase-only lookup turns recovery phrases into search keys and removes the account identifier from the check; the email-plus-phrase design keeps hashes salted and throttles guessing.
  <br>*How:* Review Aprizely's /api/import/account against Breadcrumb's: confirm how the phrase is matched, require the handle as well, apply the shared gate and lockout, cap rows copied and report any skipped rows, and reuse the same checks in future imports.
- **Default the daily step goal from evidence (7,000), not the 10,000 marketing number** _(Stepapa)_
  10,000 steps is the brand name of a 1965 Yamasa pedometer; Lancet Public Health 23 Jul 2025 (57 studies) found benefits inflect at 5,000-7,000 steps with 7,000 linked to 47% lower CVD death versus 2,000. The app ships a 7,000 default with the source shown.
  <br>*Why:* The bestseller number is folklore; a goal the user can reach and trust is the product's whole premise of personal, honest numbers.
  <br>*How:* Pick a default from primary research, label it FACT with the citation in the research notes, and let the user change it while keeping the evidence one tap away.
- **Republish dashboards and recaps after the last research lane lands, or stamp them preliminary** _(Joy)_
  The research dashboard and Breadcrumb recap were published before the customer-voice lane finished and kept the earlier ranking (loudest hate and loves re-ordered once the final lane arrived); the copy of REPORT.md sent earlier was also stale.
  <br>*Why:* Three published artifacts disagreed with the study folder until the user was told; the verdict held but the ranking they showed did not.
  <br>*How:* Gate publishing on all lanes returning, or label outputs 'preliminary - lane N pending' and re-publish the dashboard URL and recap in place when the last lane folds in.
- **State what a plan multiplier applies to: Max 5x/20x is per 5-hour session, not total weekly capacity** _(cross-cutting)_
  Counter-evidence kept in the report: the 5x/20x multipliers apply to the 5-hour session cap, so the effective weekly boost is about 3.5x (Max 5x) and 6-8x (Max 20x); Anthropic published weekly hour ranges in July 2025 then removed them; a June 2026 class action alleges deceptive marketing over exactly this.
  <br>*Why:* A flat-vs-metered comparison that treats the headline multiplier as total capacity overstates the subscription's value and reads as a marketing claim.
  <br>*How:* In any subscription-vs-API calculator or report show the per-session and per-week limits separately, tag the weekly numbers SIGNAL unless the vendor publishes them, and lead with the monthly-recurring versus one-time-top-up difference.
- **State plainly which platforms a link-fetch cannot read instead of faking a bypass** _(Hallalu CRM)_
  The 'Study a video' paste-a-link flow fetches any public file (direct mp4, Vimeo, many blogs, some LinkedIn/Threads) and tells the user that TikTok, Instagram, Threads and YouTube hide the file behind their player and that a Worker cannot run a yt-dlp-style extractor, so they should download the clip and drop the file in.
  <br>*Why:* A silent failure or a fake 'fetched' state on blocked platforms would read as a bug; an honest boundary note on the landing view turns it into a clear next step and keeps the feature trustworthy.
  <br>*How:* Show the boundary note beside the link field, report per-URL why no file was found, and always offer the upload/drag-and-drop path as the guaranteed route.
- **Record share-link opens and downloads with time, kind and file name only - no IP or identity** _(Joy)_
  Joy Cloud link activity stores each open/download with its time, kind and file name and nothing about who (no IP address), and shows 'Opened 3 times - 1 download - last Oct 1' or 'Not opened yet' beside the link and inside the mail thread.
  <br>*Why:* The top unmet need was a link that confirms it landed; it can be delivered without collecting personal data, which keeps the privacy positioning honest.
  <br>*How:* Log events with token, kind, file id and timestamp only, derive counts from the event table, and exclude owner previews with an explicit preview flag.
- **Assert that a gauge's drawn fraction equals the number printed inside it, since 59 green tests still shipped a ring that contradicted its label** _(cross-cutting)_
  The ring filled as Neurons were spent while the centre number counted down what was left; only looking at the page found it, after which a test reading the stroke-dasharray from the HTML was added
  <br>*Why:* Unit assertions on numbers cannot see a visual encoding that disagrees with its label
  <br>*How:* For every gauge, bar or ring: render, read the drawn length, and assert it equals the printed value over the maximum, in the empty, full and over-limit cases
- **Cluster near-duplicate catalogue items into canonical classes with per-app instances so coverage is not padded** _(Bug Ledger)_
  A deep scan reported 67 security items that are really about 30 concepts: SSRF three times, XSS five or more, cross-account local leak five or more, CSP twice. Each item was the same class first seen in a different app, so a pass counts variants separately and inflates both effort and apparent thoroughness
  <br>*Why:* Coverage numbers are only meaningful per distinct risk
  <br>*How:* Add a class key on every item, report 'N classes checked, M instances', and let one detector or one test answer a whole class
- **Add a per-project applicability fingerprint so the checklist marks items with no matching surface as N/A instead of a hollow pass** _(Bug Ledger)_
  About 15 of Hallalu's 67 security items concern other apps' features (co-stitch rooms, a cloud vault, a render path) yet were weighted equally and ticked
  <br>*Why:* A pass on something that cannot apply tells the reader nothing and dilutes the items that do
  <br>*How:* Declare has-auth, has-vault, has-AI, has-D1, static-site and similar flags per project, tag items with the surfaces they need, and show non-matching items as N/A with the reason
- **Match coverage on a stable item id and re-run a detector signature to prove a fix and flag regressions** _(Bug Ledger)_
  Coverage matches normalised title strings, so credit required reverse-engineering the exact catalogue wording; a submitted fix with file:line is taken on trust and nothing watches whether it stays fixed
  <br>*Why:* Title matching rewards string gaming, and found-once is not the same as stays-fixed
  <br>*How:* Give every item an id used for matching, attach a detector signature, re-run it when a fix is submitted to confirm the pattern is gone, and flag a regression on any later scan where it returns
- **Copy the vendor's published unit (Neurons) and derive money from it, never re-derive the unit from rounded dollar figures** _(Joy Day)_
  Cloudflare lists both a dollar rate and a Neurons rate; flux-2-dev's rounded $0.00041 implies 37.27 N while the published column says 37.50, and input tiles were priced separately from output tiles
  <br>*Why:* A rate card that disagrees with the vendor's own unit in the third significant figure makes every derived scenario, projection and budget slightly wrong, and the error compounds with volume
  <br>*How:* Store the published Neurons column verbatim with a read date and source URL, compute dollars at request time from one overage constant, and add a test that recomputes each model's cost by hand arithmetic
- **When asked for '1,000+ per section', publish the honest count against the real full-suite size and let the owner choose** _(Finished.)_
  A per-section audit table (for example GRE 3,500 canonical, GMAT 750 to 1,000, Latin phrases 300 to 500 authentic, literary terms 300 to 500 real) replaced padding; the owner then chose which gaps to fund.
  <br>*Why:* Padding with shared banks produced 'dead' in SAT and 'able, about, above' in Travel, which users noticed immediately.
  <br>*How:* Count by real membership, flag padded levels, and decline to invent entries; stop at the honest number and say so.
- **Build language packs from real bilingual dictionaries with readings, and eyeball every generated pack before bundling** _(Finished.)_
  Chinese from CC-CEDICT with tone-marked pinyin, Japanese from EDICT2/JMdict with Hepburn romaji (EUC-JP converted with iconv), French/Spanish/German/Italian from FreeDict TEI streamed line by line (the German file is 449MB), each intersected with a frequency list so common words come first.
  <br>*Why:* Bare frequency words taught nothing, and an LLM-written list of the same size was less accurate; sampling caught a leaked '(P)' marker in the romaji.
  <br>*How:* Parse into { w, d } with the meaning, strip markers, print 20 samples per language, and check licences and a profanity filter before shipping (see the licensing entry).
- **Verify behaviour, visibility and the real route; not element presence, URL strings or function existence** _(cross-cutting)_
  This run's misses were all presence-level: DM chips shipped dead because the check counted chips (not clicks); a logo img passed because its src string existed while Clearbit was dead; Edit 'existed' in the toolbar while the user could not see it; Preview was closed without reproducing it; a quiet-week state never rendered because the fixture lead had other activity; a persistence probe error was waved off as 'demo save no-ops'. Techniques that worked: dispatch a real input event then read state; Image() onload for third-party URLs; getBoundingClientRect/elementFromPoint at the user's width; a monkeypatched spy on askAI to prove aiCalls:0; decoding the share-link JSON to audit every field; computing contrast in-page.
  <br>*Why:* A check that cannot fail for the bug in question is not a check, and 'verified' in a report then misleads the user.
  <br>*How:* For each feature, write one assertion that would fail if the user-visible behaviour were broken: click then read state, measure rect and hit-test, spy the side effect, load the third-party asset, and use an isolated fixture for empty and edge states. Also remember harness traps: go(to) takes one arg (use #/client/id), '/' is the marketing page and /app the app, wrap each probe in an IIFE, and navigate to /app before touching S.
- **'Could not verify' from a blocked or exhausted researcher is not 'does not exist'; never remove capability on a negative finding** _(cross-cutting)_
  A research lane reported it could not verify five effect names while also reporting its web-search budget exhausted (200/200) and bot-gated engines. The names were deleted from the product. All five were real. The user's rule: a critique is a claim too; never invent a restriction.
  <br>*Why:* Absence of evidence from a broken tool becomes a shipped restriction, and the cost is asymmetric when the field is free text (a stale suggestion is free; a missing famous one is not).
  <br>*How:* Require every lane to report its tool health (searches used, blocked domains) and to label results verified-true, verified-false or unreachable. Only act on verified-false. When a lane is unreachable, re-verify yourself or leave the option in. Add the asymmetry note in code where you keep something you could not verify.
- **Research provenance: say when the primary source was blocked and never present aggregator paraphrase as a quote** _(cross-cutting)_
  A voice-of-customer lane could not reach Reddit (WebFetch, .json, mirrors and search all blocked) and returned aggregator-sourced paraphrases explicitly labelled as not verbatim Reddit quotes, with zero threads read. A separate counter-evidence lane re-audited the other lanes' own claims and caught four miscitations (a healthcare adoption stat transplanted to freelancer portals; Etsy; follow-up counts; a Flickr study cited as Instagram).
  <br>*Why:* Fabricated or transplanted evidence in a product dossier ends up in shipped copy.
  <br>*How:* Brief every lane to disclose blocked sources and label FACT / SIGNAL / HYPOTHESIS / VENDOR / FOLKLORE. Add a standing audit lane that opens the cited page for each load-bearing stat and checks the domain, sample and confidence interval. Re-run blocked lanes through a real browser or API.
- **Auto-assembled client-facing pages should allow known-safe sources and be audited field by field** _(Hallalu CRM)_
  The portal first filtered the timeline list, but the 'next' KPI still carried an internal reminder label; it was found only by decoding the encoded snapshot JSON. Messages are behind a per-send toggle, and the owner's own view marks internal rows 'only you see this'.
  <br>*Why:* Private CRM cadence ('Friendly nudge') leaking to a client is the worst failure for this feature.
  <br>*How:* Build the client snapshot from an allowlist of kinds, add a test that decodes the real link and asserts no internal label, hours or private note appears in any field, and keep a marker on the source events (not a title regex).
- **WhatsApp links: never invent a country code** _(Hallalu CRM)_
  waNumber() prefers a WhatsApp-labelled number, then Mobile, then the first phone, and needs 6 or more digits. A number without a country code produces wa.me/?text= (and a toast tip) instead of a guessed prefix, because a wrong prefix messages a stranger. Six cases verified, including wa.me/447700900123?text=Hi%20Maya!.
  <br>*Why:* A confident wrong number is worse than asking the user.
  <br>*How:* Reuse waNumber/waLink/waOpen from contactfields.js wherever a chat link is built.
- **Bank details: store identifiers as strings and validate per country; never put them in a URL** _(Hallalu CRM)_
  Researched this run: sort code, BSB, routing number and CLABE keep leading zeros so must be strings; validate an IBAN by country length and MOD-97 but warn rather than block; BIC is optional within SEPA (Regulation 260/2012); a US wire ABA differs from an ACH ABA; show 'verify before the first payment' because invoice-interception fraud is the main risk; use structured fields plus a free-text catch-all. The share-summary snapshot deliberately excludes bank fields.
  <br>*Why:* Numeric storage corrupts identifiers and URLs leak details.
  <br>*How:* Country-driven fields (paydetails.js, 10 countries) feeding one paymentBlock(); exclude bank data from any shareable snapshot or URL.
- **One source of truth for plan prices and an amount-aware Stripe lookup_key** _(Hallalu CRM)_
  The Plus price existed in four hand-mirrored places and a fixed lookup_key meant Stripe's immutable Prices were reused forever. Entitlement already falls back to subscription metadata.plan, so re-minting is safe, and a deployment without pinned PRICE_* env vars auto-mints.
  <br>*Why:* Prices drift between display and charge, and a price change can silently not apply.
  <br>*How:* Define PLANS once and have the pricing grid, billing view and stripe.js read it; keep the lookup_key keyed on amount (plan_interval_amount); if PRICE_* ids are pinned, mint new ones and update them.
- **Do not fake 'download all'; and pay-to-unlock must withhold the file URL until paid** _(Hallalu CRM)_
  Without a real bundle, 'Download everything' became an owner-set full-pack URL above per-product links. Pay-to-unlock products show 'Buy $29 - Unlocks after payment' until the owner flips a lock chip; the digest does not show whether a locked product's file URL is removed from the base64 snapshot and the stored body.
  <br>*Why:* A lock that is only a flag over a URL already in the link is cosmetic.
  <br>*How:* Omit the file URL from the snapshot while a product is locked, confirm the build does so, and add payment-webhook unlocking when a payment provider is connected.
- **Merge, never replace, when a form saves part of a stored object** _(Hallalu CRM)_
  Two near misses were caught before shipping: the content-calendar day save rebuilt its meta as {goal, notes} and would have dropped the day photo and linked content; sqSave read fields by id and would have thrown once the metrics grid was swapped for story fields. Ids moved into fieldsFor(type) with null guards.
  <br>*Why:* Partial saves that overwrite are silent data loss.
  <br>*How:* Spread the existing object ({...old, ...changes}), iterate the fields actually present, and null-guard element lookups.
- **Replace guessed rate ranges with disclosed transaction data** _(Hallalu CRM)_
  The brand-deal rate calculator used guessed CPM tiers. A transaction dataset with disclosed methodology (Collabstr, n=21,000) shows paid medians of YouTube $255, Instagram $193, TikTok $186, UGC $154, 80% of deals under $300 and 2% over $1,000.
  <br>*Why:* Real medians are a better anchor and an honest reality check for creators.
  <br>*How:* Show the medians with source and date next to the CPM maths, and keep red-flag prompts (perpetual usage, whitelisting, exclusivity, product-only, no payment terms).
- **Verify domain vocabulary against first-party docs before shipping it** _(Hallalu CRM)_
  VSCO preset codes were assumed wrong (AL is Artificial Lighting, not Analog; P is Instant film; G is Portrait; KP is Kodak Portra) until checked against VSCO's Preset Guide (20 Feb 2026). The Instagram filter list was also wrong (Hudson missing; Fade is an adjustment slider; Duet, Stitch and React are collaboration features, not effects); third-party Instagram AR effects were permanently removed on 14 Jan 2025.
  <br>*Why:* Plausible names from memory read as errors to the people who use them.
  <br>*How:* Cite the first-party page per list, store the date, and keep unverifiable names as free text rather than as presented facts.
- **Consent-first AI meeting notes: own-mic in-browser transcription + visible banner/chime + real opt-out** _(Coconvo)_
  Each participant transcribes only their own microphone in the browser, only while room notes are on and they have not opted out, with a persistent banner plus a chime for everyone and the speaker's display name as the label.
  <br>*Why:* Silent AI notetakers are now litigated and blocked by IT teams (Otter/Granola/Fireflies, 2026); invisible central capture with a fake opt-out is a legal and reputational risk.
  <br>*How:* Gate per-speaker client-side transcription on a per-person opt-out flag; show a 'notes on' banner and play a chime when capture starts; never send a bot or transcribe a participant who has opted out.

## privacy & legal (2)

- **Classify data sensitivity before choosing where it lives** _(cross-cutting)_
  Decide up front which fields are sensitive (health, reproductive, financial, precise location, children's data) and let that classification dictate storage, transport and whether any third party may ever see it.
  <br>*Why:* Retrofitting privacy is far harder than designing it, and the categories that cause real-world harm and regulatory action are knowable on day one.
  <br>*How:* Tag each field at schema-design time; route sensitive classes to local-only or end-to-end-encrypted storage; forbid them in logs, URLs and third-party SDKs by lint rule, not by memory.
- **Ship deletion and export on the same day as signup** _(cross-cutting)_
  Build 'download everything' and 'delete everything' as part of the account feature itself, not as a later compliance task.
  <br>*Why:* Both are legal rights and both are trust primitives users increasingly test before committing; adding them late means retrofitting across every table and blob store.
  <br>*How:* One export endpoint serialising the full object graph including media, and one delete path that purges records, backups and third-party copies — with honest disclosure of anything it cannot reach.

## claims accuracy (1)

- **Verify, don't claim — every assertion needs a primary source** _(cross-cutting)_
  Treat any factual statement shown to a user (a statistic, a market claim, a comparison, a compliance assurance) as unpublishable until it is traced to a primary source recorded alongside it.
  <br>*Why:* AI-assisted copy makes confident, plausible, unverified assertions cheap to produce and expensive to retract; a single false 'first/only' claim damages trust more than the claim ever earned.
  <br>*How:* Keep a claims register mapping each user-facing claim to its source and date; re-check on a schedule; prefer provable framing over superlatives; delete anything you cannot cite.

## testing (2)

- **A core-loop smoke test is the highest-leverage test you can write** _(cross-cutting)_
  One scripted pass through the primary verb — sign in, create, edit, save, reload and confirm persistence, export — run against the built artifact before every deploy.
  <br>*Why:* 'An update broke the core feature' is one of the universal one-star patterns; users forgive missing features but not regressions in the thing they rely on.
  <br>*How:* Automate it against the deployed preview rather than a mock, and make a red result block the deploy even when the change looks unrelated.
- **Test API contracts from a script file, not inline shell loops - quoting artifacts produced a false 'estimate = 1 credit' alarm** _(cross-cutting)_
  A bash loop using set -- $wh and node -e one-liners reported 1 credit for every model and size. Raw curl showed the endpoint correctly returned 42 and 8.
  <br>*Why:* A misleading harness nearly caused a correct fix to be distrusted and rewritten.
  <br>*How:* Write the request as a small .mjs script with JSON bodies, print the raw response, and only then assert on it.

## SEO & sharing (1)

- **Treat the share card as part of the product, not an afterthought** _(cross-cutting)_
  Every shareable page gets a title, description and a 1200×630 og:image, verified in a card validator before launch.
  <br>*Why:* Links are the primary distribution channel for a small product; a bare URL in a message or post converts far worse than a rendered preview with a title and image.
  <br>*How:* Add og:/twitter: tags to the page template so new pages inherit them, generate the image from the page's own design language, and validate after every deploy.

## observability (2)

- **Make silent failure impossible by default** _(cross-cutting)_
  No empty catches, a .catch on every chain, global error and unhandledrejection handlers, and a build stamp attached to every report.
  <br>*Why:* The worst production bugs are the ones that generate no signal — a swallowed error looks identical to working software until a user complains weeks later.
  <br>*How:* Centralise error handling in one helper that always logs with context and always surfaces a user-visible state; lint against bare catch blocks; correlate every report to a deploy id.
- **Errors need a user-visible state, not just a log line** _(cross-cutting)_
  Every failure path should render something honest to the user — a retry affordance or a plain explanation — in addition to being reported.
  <br>*Why:* Logging alone leaves the user staring at a spinner or an unchanged screen, which reads as a broken product even when the failure was transient and recoverable.
  <br>*How:* Pair each catch with both a report and a UI state; prefer 'that didn't save — retry' over a silent revert, and never let a failed write look like a successful one.
