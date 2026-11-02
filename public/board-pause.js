/* Pause / play button for a live board. One round button: press it and the agent holds still before its next
   move (a PreToolUse hook on the agent's machine watches this same state); press it again and it carries on.
   The board is public by link, so anyone can see the state but only the signed-in owner can change it.
   Same file in Aprizely and Breadledger; the <script data-…> attributes say where its API lives. */
(function () {
  var me = document.currentScript, cfg = me ? me.dataset : {};
  var API = cfg.api || '/api/live/:id/pause';              // GET + POST, :id replaced; a Breadledger page uses ?id=
  var SIGNIN = cfg.signin || '/account';
  var CARDS = cfg.cards || '';                             // a selector for card footers with a link to their own board
  var LINK = cfg.link || '';                               // href prefix of that link, e.g. /now/
  var known = {}, buttons = {}, busy = {}, dock = null;

  var css = document.createElement('style');
  css.textContent = [
    '.bp{--bp-ink:#14171f;--bp-go:#10b981;--bp-wait:#f59e0b;position:relative;display:inline-flex;align-items:center;gap:12px;font:600 15px/1.25 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#14171f}',
    '.bp-dock{position:fixed;left:50%;bottom:max(22px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60;background:rgba(255,255,255,.82);-webkit-backdrop-filter:blur(18px) saturate(1.5);backdrop-filter:blur(18px) saturate(1.5);border:1px solid rgba(20,23,31,.08);border-radius:99px;padding:7px 22px 7px 7px;box-shadow:0 1px 2px rgba(20,23,31,.06),0 14px 40px -10px rgba(20,23,31,.26);max-width:calc(100vw - 32px);animation:bp-rise .5s cubic-bezier(.22,.9,.28,1) both}',
    '@keyframes bp-rise{from{transform:translate(-50%,14px)}}',
    '.bp-b{position:relative;flex:none;width:58px;height:58px;border:0;border-radius:50%;padding:0;cursor:pointer;color:#fff;background:linear-gradient(160deg,#2b3040,#0f1219);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 5px 14px -4px rgba(15,18,25,.6);transition:transform .22s cubic-bezier(.22,.9,.28,1),background .35s,box-shadow .35s;-webkit-tap-highlight-color:transparent}',
    '.bp-b:hover{transform:scale(1.06)}.bp-b:active{transform:scale(.94)}',
    '.bp-b:focus-visible{outline:3px solid #4f7dff;outline-offset:3px}',
    '.bp-b[disabled]{cursor:progress}',
    /* the icon: two halves whose clip-paths morph between two bars and one triangle (works in every browser) */
    '.bp-i{position:absolute;inset:0;margin:auto;width:22px;height:22px}',
    '.bp-i i{position:absolute;inset:0;background:currentColor;transition:clip-path .34s cubic-bezier(.22,.9,.28,1)}',
    '.bp-i i:first-child{clip-path:polygon(9% 0,39% 0,39% 100%,9% 100%)}',
    '.bp-i i:last-child{clip-path:polygon(61% 0,91% 0,91% 100%,61% 100%)}',
    '.bp.paused .bp-i i:first-child{clip-path:polygon(16% 0,56% 24%,56% 76%,16% 100%)}',
    '.bp.paused .bp-i i:last-child{clip-path:polygon(56% 24%,96% 50%,96% 50%,56% 76%)}',
    /* a slow ring while it works; amber while it comes to a stop; a soft breath when it is held, waiting for play */
    '.bp-b::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid transparent;border-top-color:rgba(16,185,129,.9);animation:bp-spin 2.8s linear infinite;pointer-events:none}',
    '@keyframes bp-spin{to{transform:rotate(360deg)}}',
    '.bp.paused .bp-b{background:linear-gradient(160deg,#34d399,#059669);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 6px 18px -4px rgba(5,150,105,.7)}',
    '.bp.paused .bp-b::after{inset:-1px;border:2px solid rgba(16,185,129,.55);animation:bp-breath 2.4s ease-out infinite}',
    '.bp.pausing .bp-b{background:linear-gradient(160deg,#fbbf24,#d97706);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 6px 18px -4px rgba(217,119,6,.7)}',
    '.bp.pausing .bp-b::after{inset:-4px;border:2px solid transparent;border-top-color:#f59e0b;animation:bp-spin 1s linear infinite}',
    '@keyframes bp-breath{0%{transform:scale(1);opacity:.9}100%{transform:scale(1.32);opacity:0}}',
    '.bp-t{min-width:0;display:grid;gap:1px}',
    '.bp-t b{font-weight:650;font-size:15px;letter-spacing:-.01em}',
    '.bp-t span{font-weight:500;font-size:13.5px;color:#5b6474}',
    '.bp-t a{color:inherit;text-decoration:underline;text-underline-offset:2px}',
    '.bp-sm{gap:9px;font-size:13.5px}.bp-sm .bp-b{width:38px;height:38px}.bp-sm .bp-i{width:14px;height:14px}.bp-sm .bp-b::after{inset:-3px}.bp-sm .bp-t b{font-size:13.5px}.bp-sm .bp-t span{display:none}.bp-sm.note .bp-t span{display:block}',
    '@media (max-width:520px){.bp-dock{padding-right:18px}.bp-t span{font-size:13.5px}}',
    ':root[data-theme="dark"] .bp{color:#f2f4f8}:root[data-theme="dark"] .bp-dock{background:rgba(26,29,38,.84);border-color:rgba(255,255,255,.1)}:root[data-theme="dark"] .bp-t span{color:#a5adbb}',
    '@media (prefers-reduced-motion:reduce){.bp-b::after,.bp-dock{animation:none}.bp-i i{transition:none}}',
    'html.bp-docked body{padding-bottom:92px}',
    /* the page around it comes to rest too */
    '.bp-held .live-dot,.bp-held .spin,.bp-held .pip.live{animation:none!important}',
  ].join('');
  document.head.appendChild(css);

  function url(id) { return API.replace(':id', encodeURIComponent(id)); }
  function view(id) { var k = known[id] || {}; return k.paused ? (k.held ? 'paused' : 'pausing') : 'running'; }
  function words(id) {
    var v = view(id);
    if (v === 'paused') return ['Paused', 'On hold. Press play to carry on.', 'Carry on'];
    if (v === 'pausing') return ['Pausing…', 'It stops before its next move.', 'Carry on'];
    return ['Working', 'Press to stop the agent.', 'Pause the agent'];
  }
  function draw(id) {
    (buttons[id] || []).forEach(function (el) {
      var w = words(id), v = view(id), note = el.dataset.note;
      el.classList.toggle('paused', v === 'paused' || v === 'pausing');
      el.classList.toggle('pausing', v === 'pausing');
      el.classList.toggle('note', !!note);
      var b = el.querySelector('.bp-b');
      b.setAttribute('aria-label', w[2]); b.title = w[2]; b.setAttribute('aria-pressed', v === 'running' ? 'false' : 'true');
      b.disabled = !!busy[id];
      el.querySelector('.bp-t b').textContent = w[0];
      var sub = el.querySelector('.bp-t span');
      if (note === 'signin') sub.innerHTML = 'Only the owner can do this. <a href="' + signinUrl() + '">Sign in</a>';
      else if (note) sub.textContent = note;
      else sub.textContent = w[1];
    });
    document.documentElement.classList.toggle('bp-held', Object.keys(known).some(function (i) { return known[i].paused; }));
    paintState();
    document.dispatchEvent(new CustomEvent('board-pause', { detail: { id: id, view: view(id) } }));
  }
  /* Breadledger's cards carry a "Working now" badge the page redraws on its own: while held, that badge says so too. */
  function paintState() {
    if (!CARDS && !LINK) return;
    Object.keys(buttons).forEach(function (id) {
      (buttons[id] || []).forEach(function (el) {
        var scope = el.closest('.bp-scope') || document, st = scope.querySelector('.state');
        if (!st || /^(Finished|Closed)/.test(st.textContent)) return;
        if (view(id) === 'running') {          // back to what the page last drew
          if (st.dataset.bpWas != null) { st.innerHTML = st.dataset.bpWas; delete st.dataset.bpWas; }
          return;
        }
        var t = view(id) === 'paused' ? 'Paused' : 'Pausing…';
        if (st.textContent !== t) {
          if (st.dataset.bpWas == null) st.dataset.bpWas = st.innerHTML;
          st.innerHTML = '<span class="pip"></span>' + t;
        }
      });
    });
  }
  function signinUrl() {
    return SIGNIN.indexOf('next=') >= 0 ? SIGNIN + encodeURIComponent(location.pathname + location.search) : SIGNIN;
  }
  function make(id, small) {
    var el = document.createElement('div');
    el.className = 'bp' + (small ? ' bp-sm' : '');
    el.innerHTML = '<button type="button" class="bp-b"><span class="bp-i"><i></i><i></i></span></button><div class="bp-t" aria-live="polite"><b></b><span></span></div>';
    el.querySelector('.bp-b').addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); press(id, el); });
    (buttons[id] = buttons[id] || []).push(el);
    return el;
  }
  function press(id, el) {
    if (busy[id]) return;
    var want = !(known[id] && known[id].paused), was = known[id];
    busy[id] = true; delete el.dataset.note;
    known[id] = { paused: want, held: false, active: true };   // the button answers at once; the server confirms
    draw(id);
    var headers = { 'content-type': 'application/json' };
    try { var key = localStorage.getItem('bl_admin_key') || localStorage.getItem('bugledger.key'); if (key && cfg.keyed) headers['x-ledger-key'] = key; } catch (e) {}   // Breadledger's "Use a key instead"
    fetch(url(id), { method: 'POST', credentials: 'same-origin', headers: headers, body: JSON.stringify({ id: id, paused: want }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (x) {
        busy[id] = false;
        if (x.s === 200) { known[id] = x.d; if (!x.d.active) gone(id); }
        else {
          known[id] = was;
          el.dataset.note = x.s === 401 ? 'signin' : x.s === 403 ? 'Only the owner can do this.' : x.s === 409 ? 'This board has finished.' : 'That did not go through. Try again.';
        }
        draw(id);
      })
      .catch(function () { busy[id] = false; known[id] = was; el.dataset.note = 'No connection. Try again.'; draw(id); });
  }
  function gone(id) { (buttons[id] || []).forEach(function (el) { el.remove(); }); delete buttons[id]; if (dock && dock.dataset.id === id) dock = null; }

  /* poll the state of every board on the page: it may change from another device, and "pausing" turns to "paused" */
  function poll() {
    if (document.hidden) return;
    Object.keys(buttons).forEach(function (id) {
      if (busy[id]) return;
      fetch(url(id), { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d || busy[id]) return;
        if (d.active === false) { gone(id); known[id] = d; return; }
        known[id] = d; draw(id);
      }).catch(function () {});
    });
  }

  /* where the buttons go */
  function scan() {
    // a tag the page drew itself, or one board's own page: <body data-…> / window.BOARD_PAUSE_ID
    document.querySelectorAll('[data-pause-id]').forEach(function (host) {
      if (host.firstChild) return;
      var id = host.getAttribute('data-pause-id');
      if (known[id] && known[id].active === false) return;
      var el = make(id, true); host.appendChild(el);
      if (known[id]) draw(id); else poll();
    });
    var one = window.BOARD_PAUSE_ID;
    if (one && !dock && !(known[one] && known[one].active === false)) {
      dock = make(one, false); dock.classList.add('bp-dock'); dock.dataset.id = one; document.body.appendChild(dock); document.documentElement.classList.add('bp-docked');
      poll();
    }
    // a page of cards: one small button in the footer of each active card, beside the link to its own board
    if (CARDS && LINK) document.querySelectorAll(CARDS).forEach(function (foot) {
      var a = foot.querySelector('a[href^="' + LINK + '"]'); if (!a || foot.querySelector('.bp')) return;
      var id = decodeURIComponent(a.getAttribute('href').slice(LINK.length));
      if (known[id] && known[id].active === false) return;
      foot.parentElement.classList.add('bp-scope');
      var el = make(id, true); el.style.marginLeft = 'auto'; foot.appendChild(el);
      if (known[id]) draw(id); else poll();
    });
    Object.keys(buttons).forEach(function (id) { buttons[id] = buttons[id].filter(function (el) { return el === dock || document.contains(el); }); if (!buttons[id].length) delete buttons[id]; });
    paintState();
  }
  window.BoardPause = { scan: scan };
  var t = 0;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 60); }).observe(document.documentElement, { childList: true, subtree: true, characterData: false });
  document.addEventListener('visibilitychange', poll);
  setInterval(poll, 2500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
})();
