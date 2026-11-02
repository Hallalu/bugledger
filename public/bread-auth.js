/* Breadledger accounts on every page — the very simple way in: your email, the 6-digit code from it, you're in.
   One flow for new and returning people (nothing to invent, nothing to copy). Loaded by bread-shell.js, which puts a
   #acct slot in the top bar: signed out it holds "Sign in"; signed in, your avatar opens a menu with your account,
   your board, Connect Claude Code, other signed-in accounts (switch), Add account and Sign out.
   API: Bread.auth.me (null or {id,name,email,role}) · Bread.auth.ready (Promise) · Bread.auth.open() · Bread.auth.connect()
   Fires 'bread:auth' on document when the account is known or changes. Server: src/auth.mjs. */
(function () {
  'use strict';
  var w = window, B = w.Bread, d = document;
  if (!B || B.auth) return;
  var esc = B.esc, icon = B.icon;
  var A = B.auth = { me: null, accounts: [], ready: null };

  function api(path, body) {
    return fetch('/api/auth/' + path, body === undefined ? { cache: 'no-store', credentials: 'same-origin' } :
      { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Something went wrong. Try again.' }; }); })
      .catch(function () { return { ok: false, error: "Can't reach Breadledger. Check your connection and try again." }; });
  }
  // an old saved key must not outlive a sign-out (it was kept under two names)
  function forgetKeys() { try { ['bl_admin_key', 'bugledger.key'].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} }

  /* ---- sign in / sign up: two short steps in one small window ---- */
  A.open = function (o) {
    o = o || {};
    var email = '';
    var bg = B.modal.open({ title: o.title || 'Sign in to Breadledger', body: '<div id="authStep"></div>' });
    var box = bg.querySelector('#authStep');
    function stepEmail(err) {
      box.innerHTML = '<form class="auth-f" novalidate>' +
        '<p class="auth-lead">Type your email and we\'ll send you a code. New here? The same two steps make your account. There\'s nothing else to fill in.</p>' +
        '<div class="field"><label for="authEmail">Email</label><input class="input auth-in" id="authEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" required maxlength="254" placeholder="you@example.com" value="' + esc(email) + '"></div>' +
        '<p class="err auth-err" role="alert">' + esc(err || '') + '</p>' +
        '<button class="btn primary auth-go" type="submit">Send me a code</button></form>';
      var f = box.querySelector('form'), inp = f.querySelector('input');
      setTimeout(function () { inp.focus(); }, 30);
      f.onsubmit = function (e) {
        e.preventDefault(); email = inp.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return stepEmail("That doesn't look like an email address.");
        busy(f, 'Sending…');
        api('start', { email: email }).then(function (j) { j.ok ? stepCode() : stepEmail(j.error); });
      };
    }
    function stepCode(err, note) {
      box.innerHTML = '<form class="auth-f" novalidate>' +
        '<p class="auth-lead">We sent a 6-digit code to <b>' + esc(email) + '</b>. Type it here. It works for 15 minutes.</p>' +
        '<div class="field"><label for="authCode">Code from the email</label><input class="input auth-in auth-code" id="authCode" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" required placeholder="123456"></div>' +
        '<p class="' + (err ? 'err' : 'hint') + ' auth-err" role="' + (err ? 'alert' : 'status') + '">' + esc(err || note || "Can't find it? Check spam, or ask for a new code below.") + '</p>' +
        '<button class="btn primary auth-go" type="submit">Continue</button>' +
        '<div class="auth-alt"><button class="btn ghost sm" type="button" data-again>Send a new code</button><button class="btn ghost sm" type="button" data-other>Use a different email</button></div></form>';
      var f = box.querySelector('form'), inp = f.querySelector('input');
      setTimeout(function () { inp.focus(); }, 30);
      inp.oninput = function () { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); if (inp.value.length === 6) f.requestSubmit ? f.requestSubmit() : f.onsubmit(new Event('submit')); };
      f.querySelector('[data-other]').onclick = function () { stepEmail(); };
      f.querySelector('[data-again]').onclick = function () { busy(f, 'Sending…'); api('start', { email: email }).then(function (j) { j.ok ? stepCode('', 'A new code is on its way.') : stepCode(j.error); }); };
      f.onsubmit = function (e) {
        e.preventDefault();
        if (inp.value.length !== 6) return stepCode('The code has 6 digits.');
        busy(f, 'Checking…');
        api('verify', { email: email, code: inp.value }).then(function (j) {
          if (!j.ok) return stepCode(j.error);
          forgetKeys();
          B.modal.close();
          // a new account goes straight to its own board; everyone else stays where they were
          if (j.isNew) location.href = '/now?welcome=1';
          else if (/^\/plans/.test(location.pathname)) location.href = '/now';
          else location.reload();
        });
      };
    }
    function busy(f, label) { var b = f.querySelector('.auth-go'); if (b) { b.disabled = true; b.textContent = label; } f.querySelectorAll('input,button').forEach(function (x) { x.disabled = true; }); }
    stepEmail();
  };

  /* ---- Connect Claude Code: one line to paste, carrying a fresh agent key ---- */
  A.connect = function () {
    var bg = B.modal.open({ title: 'Connect Claude Code', body: '<p class="auth-lead">Making your line…</p>' });
    var b = bg.querySelector('.modal-b');
    api('connect', {}).then(function (j) {
      if (!j.ok) { b.innerHTML = '<p class="err">' + esc(j.error) + '</p>'; return; }
      b.innerHTML = '<p class="auth-lead"><b>1.</b> Copy this line. <b>2.</b> Paste it into Claude Code (or Terminal) on your computer and press Enter. ' +
        'From then on, every chat you have with Claude Code shows up on your board, live. Only you can see it.</p>' +
        '<div class="auth-line"><code>' + esc(j.line) + '</code></div>' +
        '<button class="btn primary auth-go" type="button" data-copy>' + icon('copy') + 'Copy the line</button>' +
        '<p class="hint">The line holds a private key for your agent, so keep it to yourself. You can switch it off any time in Your account.</p>';
      b.querySelector('[data-copy]').onclick = function () { B.copy(j.line, 'Line copied'); };
    });
  };

  A.signOut = function () {
    api('signout', {}).then(function () { forgetKeys(); location.href = location.pathname === '/account' ? '/' : location.href; });
  };
  A.switchTo = function (id) { api('switch', { id: id }).then(function (j) { if (j.ok) location.reload(); else B.toast(j.error, 'err'); }); };

  /* ---- the top-bar slot: "Sign in", or your avatar and its menu ---- */
  var menuEl = null;
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; var t = d.querySelector('#acct .acct-btn'); if (t) t.setAttribute('aria-expanded', 'false'); } }
  function openMenu(btn) {
    if (menuEl) return closeMenu();
    var me = A.me, others = A.accounts.filter(function (a) { return a.id !== me.id; });
    menuEl = d.createElement('div'); menuEl.className = 'acct-menu'; menuEl.setAttribute('role', 'menu');
    menuEl.innerHTML = '<div class="acct-head">' + B.avatar(me.name || me.email, null, true) + '<div class="acct-names"><b>' + esc(me.name || 'Your account') + '</b><span>' + esc(me.email) + '</span></div></div>' +
      '<a class="acct-item" role="menuitem" href="/now">' + icon('live') + 'My board</a>' +
      '<a class="acct-item" role="menuitem" href="/account">' + icon('user') + 'Your account</a>' +
      '<button class="acct-item" role="menuitem" type="button" data-m="connect">' + icon('link') + 'Connect Claude Code</button>' +
      '<div class="acct-sep"></div>' +
      (others.length ? '<div class="acct-sec">Switch to</div>' + others.map(function (a) {
        return '<button class="acct-item" role="menuitem" type="button" data-sw="' + esc(a.id) + '">' + B.avatar(a.name || a.email, 'sm', true) + '<span class="acct-other"><b>' + esc(a.name || a.email) + '</b><span>' + esc(a.email) + '</span></span></button>'; }).join('') + '<div class="acct-sep"></div>' : '') +
      '<button class="acct-item" role="menuitem" type="button" data-m="add">' + icon('plus') + 'Add another account</button>' +
      '<button class="acct-item danger" role="menuitem" type="button" data-m="out">' + icon('logout') + 'Sign out</button>';
    // pinned to the screen just under the avatar, so it never runs off a phone's edge or widens the page
    var r = btn.getBoundingClientRect(); menuEl.style.top = Math.round(r.bottom + 8) + 'px'; menuEl.style.right = Math.max(12, Math.round(innerWidth - r.right)) + 'px';
    d.body.appendChild(menuEl); btn.setAttribute('aria-expanded', 'true');   // on <body>: the top bar's blur would trap it in the bar's own layer
    menuEl.addEventListener('click', function (e) {
      var t = e.target.closest('[data-m],[data-sw]'); if (!t) return;
      var m = t.getAttribute('data-m'); closeMenu();
      if (t.hasAttribute('data-sw')) A.switchTo(t.getAttribute('data-sw'));
      else if (m === 'connect') A.connect(); else if (m === 'add') A.open({ title: 'Add another account' }); else if (m === 'out') A.signOut();
    });
    var first = menuEl.querySelector('.acct-item'); if (first) first.focus();
  }
  d.addEventListener('click', function (e) { if (menuEl && !e.target.closest('#acct') && !e.target.closest('.acct-menu')) closeMenu(); });
  w.addEventListener('resize', closeMenu); w.addEventListener('scroll', closeMenu, true);
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuEl) { closeMenu(); var t = d.querySelector('#acct .acct-btn'); if (t) t.focus(); } });

  function paint() {
    var slot = d.getElementById('acct'); if (!slot) return;
    if (!A.me) {
      slot.innerHTML = '<button class="btn primary sm acct-in" type="button" aria-label="Sign in">' + icon('user') + '<span class="lbl">Sign in</span></button>';
      slot.firstChild.onclick = function () { A.open(); };
      return;
    }
    slot.innerHTML = '<button class="acct-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Your account: ' + esc(A.me.name || A.me.email) + '">' + B.avatar(A.me.name || A.me.email, null, true) + '</button>';
    slot.firstChild.onclick = function (e) { e.stopPropagation(); openMenu(slot.firstChild); };
  }

  A.ready = api('me').then(function (j) {
    A.me = (j && j.user) || null; A.accounts = (j && j.accounts) || [];
    paint();
    d.dispatchEvent(new CustomEvent('bread:auth', { detail: A.me }));
    if (/(^|[#&])signin\b/.test(location.hash) && !A.me) A.open();
    return A.me;
  });
  d.addEventListener('bread:mounted', paint);
})();
