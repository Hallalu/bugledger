/* Breadledger shell — one script for every page: theme, sidebar, top bar, command palette (⌘K), keyboard
   shortcuts, side peek, modal, toast, lightbox, relative time. Loaded in <head>; pages call Bread.mount() at the end
   of <body>. Public API is window.Bread (plus BL_shotStrip / BL_openShot / BL_closeShot aliases kept for old pages). */
(function () {
  'use strict';
  var d = document, w = window;
  /* ---- theme, applied before first paint ---- */
  var THEME_KEY = 'bl_theme';
  function sysTheme() { return (w.matchMedia && w.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; }
  function applyTheme() { var t = 'system'; try { t = localStorage.getItem(THEME_KEY) || 'system'; } catch (e) {}
    try { var q = new URLSearchParams(location.search).get('theme'); if (q === 'dark' || q === 'light') t = q; } catch (e) {} /* ?theme= lets a checker force a theme */
    /* Breadledger opens in light unless the person chose dark (or asked to follow the system) */
    d.documentElement.setAttribute('data-theme', t === 'system' ? 'light' : t); d.documentElement.setAttribute('data-theme-pref', t); return t; }
  applyTheme();
  try { w.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (d.documentElement.getAttribute('data-theme-pref') === 'system') applyTheme(); }); } catch (e) {}

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };

  /* ---- icons (24-grid strokes) ---- */
  var P = {
    ledger: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
    live: '<circle cx="12" cy="12" r="2"/><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>',
    activity: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    prompts: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    admin: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    aiscan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/>',
    sanitize: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
    plans: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    menu: '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    down: '<path d="m6 9 6 6 6-6"/>', left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', up: '<path d="m18 15-6-6-6 6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    bug: '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
    sparkles: '<path d="M9.9 2.1 11 6l3.9 1.1L11 8.2 9.9 12 8.8 8.2 5 7.1 8.8 6z"/><path d="m19 13 .7 2.3L22 16l-2.3.7L19 19l-.7-2.3L16 16l2.3-.7z"/><path d="m5 17 .5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5z"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    seedling: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    shieldcheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
    checkcircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    keyboard: '<rect width="20" height="16" x="2" y="4" rx="2" ry="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.7 10.7 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.7 10.7 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    table: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
    user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    micoff: '<line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'
  };
  function icon(name, cls) { return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || P.info) + '</svg>'; }
  var MARK = '<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="var(--crust)"/><path d="M7.5 20.2c0-4.9 3.8-8.2 8.5-8.2s8.5 3.3 8.5 8.2V22a2.2 2.2 0 0 1-2.2 2.2H9.7A2.2 2.2 0 0 1 7.5 22z" fill="#fff6e3"/><path d="M12 16.8l1.2-2.4M15.4 15.9l1.2-2.4M18.8 16.8l1.2-2.4" stroke="var(--crust)" stroke-width="1.5" stroke-linecap="round"/></svg>';

  /* ---- navigation model ---- */
  var VIEWS = [
    { id: 'overview', label: 'Overview', icon: 'grid' }, { id: 'bugs', label: 'Bugs', icon: 'bug' }, { id: 'security', label: 'Security audit', icon: 'shieldcheck' },
    { id: 'optimisers', label: 'Optimisers', icon: 'sparkles' }, { id: 'scanner', label: 'Scanner leads', icon: 'scan' },
    { id: 'harvest', label: 'Harvested', icon: 'seedling' }, { id: 'checks', label: 'Agent checks', icon: 'checkcircle' },
    { id: 'submitted', label: 'Submitted', icon: 'inbox' }
  ];
  var NAV = [
    { h: 'Workspace' },
    { id: 'ledger', href: '/', label: 'Ledger', icon: 'ledger', views: VIEWS },
    { id: 'now', href: '/now', label: 'Now', icon: 'zap' },
    { id: 'live', href: '/live', label: 'Live', icon: 'live' },
    { id: 'activity', href: '/timeline', label: 'Activity', icon: 'activity' },
    { h: 'Owner' },
    { id: 'prompts', href: '/journal', label: 'Prompts', icon: 'prompts', lock: true },
    { id: 'admin', href: '/admin', label: 'Admin', icon: 'admin', lock: true },
    { h: 'Tools' },
    { id: 'aiscan', href: '/aiscan', label: 'AI footprint', icon: 'aiscan' },
    { id: 'sanitize', href: '/sanitize', label: 'Sanitizer', icon: 'sanitize' }
  ];
  var RAIL_KEY = 'bl_rail', state = { active: '', view: '', items: [], counts: {} };

  function navHtml(active, view) {
    return NAV.map(function (n) {
      if (n.h) return '<div class="nav-h">' + esc(n.h) + '</div>';
      var cur = n.id === active, leaf = !!(n.views && cur && view); /* a sub-view carries the highlight; the parent only keeps its icon lit */
      var s = '<a class="item' + (leaf ? ' parent-on' : '') + '" href="' + n.href + '" ' + (cur && !leaf ? 'aria-current="page"' : '') + ' data-nav="' + n.id + '">' + icon(n.icon) + '<span class="lbl">' + esc(n.label) + '</span>' +
        (n.lock ? icon('lock', 'lock') : '<span class="n" data-count="' + n.id + '"></span>') + '</a>';
      if (n.views && cur) s += '<div class="sub">' + n.views.map(function (v) {
        return '<a class="item" href="/#view=' + v.id + '" data-view="' + v.id + '" ' + (view === v.id ? 'aria-current="page"' : '') + '>' + icon(v.icon) + '<span class="lbl">' + esc(v.label) + '</span><span class="n" data-count="' + v.id + '"></span></a>';
      }).join('') + '</div>';
      return s;
    }).join('');
  }
  function footHtml() {
    var t = d.documentElement.getAttribute('data-theme');
    return '<a class="item" href="/plans" data-nav="plans" ' + (state.active === 'plans' ? 'aria-current="page"' : '') + '>' + icon('plans') + '<span class="lbl">Plans</span></a>' +
      '<button class="item" type="button" data-act="theme" aria-label="Switch theme">' + icon(t === 'dark' ? 'sun' : 'moon') + '<span class="lbl">' + (t === 'dark' ? 'Light mode' : 'Dark mode') + '</span><kbd class="n">T</kbd></button>' +
      '<button class="item" type="button" data-act="keys" aria-label="Keyboard shortcuts">' + icon('keyboard') + '<span class="lbl">Shortcuts</span><kbd class="n">?</kbd></button>' +
      '<button class="item" type="button" data-act="rail" aria-label="Collapse sidebar">' + icon('panel') + '<span class="lbl">Collapse</span><kbd class="n">[</kbd></button>';
  }

  /* ---- mount ---- */
  function mount(o) {
    o = o || {};
    state.active = o.active || ''; state.view = o.view || '';
    var app = $('#app') || $('.bl-app'), side = $('#side'), top = $('#top');
    if (!app || !side) return;
    var rail = false; try { rail = localStorage.getItem(RAIL_KEY) === '1'; } catch (e) {}
    if (rail) app.classList.add('rail');
    side.innerHTML = '<a class="brand" href="/" aria-label="Breadledger home">' + MARK + '<span>Breadledger</span></a><nav aria-label="Main">' + navHtml(state.active, state.view) + '</nav><div class="foot">' + footHtml() + '</div>';
    if (!$('.side-bg')) { var bg = d.createElement('div'); bg.className = 'side-bg'; bg.onclick = closeSide; d.body.appendChild(bg); }
    if (top) {
      var crumbs = (o.crumbs || [o.title || '']).map(function (c, i, a) { return i < a.length - 1 ? '<span class="parent">' + esc(c) + '</span><span class="sep">/</span>' : '<span>' + esc(c) + '</span>'; }).join('');
      top.innerHTML = '<button class="btn ghost icon menu" type="button" data-act="side" aria-label="Open menu">' + icon('menu') + '</button>' +
        '<div class="crumbs">' + crumbs + '</div><div class="actions">' +
        '<button class="search" type="button" data-act="cmdk" aria-label="Search and commands"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P.search + '</svg><span class="lbl">' + esc(o.searchLabel || 'Search or jump to…') + '</span><span class="k"><kbd>⌘</kbd><kbd>K</kbd></span></button>' +
        '<button class="btn icon mic" type="button" data-voice="command" aria-label="Voice command" title="Voice command: say a view, a page, an action or words to search">' + icon('mic') + '</button>' +
        (o.media !== false ? '<button class="btn icon plus" type="button" data-media aria-label="Add a finding with media" title="Add a finding: screenshots, before and after">' + icon('plus') + '</button>' : '') +
        (o.actions || '') + '<span id="acct" class="acct"></span></div>';
    }
    // accounts: "Sign in" or your avatar menu, on every page (bread-auth.js)
    if (!w.Bread.auth && !d.getElementById('bread-auth')) { var sa = d.createElement('script'); sa.id = 'bread-auth'; sa.src = '/bread-auth.js'; sa.defer = true; d.head.appendChild(sa); }
    else d.dispatchEvent(new Event('bread:mounted'));
    d.body.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-act],[data-media]'); if (!b) return;
      var a = b.hasAttribute('data-media') ? 'media' : b.getAttribute('data-act');
      if (a === 'theme') toggleTheme(); else if (a === 'rail') toggleRail(); else if (a === 'side') openSide();
      else if (a === 'media') { var nf = $('[data-newfinding]'); if (nf) nf.click(); else location.href = '/#new=1'; }
      else if (a === 'cmdk') cmdk.open(); else if (a === 'keys') showKeys();
    });
    d.title = (o.title ? o.title + ' · ' : '') + 'Breadledger';
    Object.keys(state.counts).forEach(function (k) { setCount(k, state.counts[k]); });
    livePoll();
    if (o.live !== false) d.addEventListener('visibilitychange', function () { if (!d.hidden) livePoll(); });
  }
  function setCount(id, n) { state.counts[id] = n; $$('[data-count="' + id + '"]').forEach(function (e) { e.textContent = (n == null || n === '') ? '' : (typeof n === 'number' ? n.toLocaleString() : n); }); }
  function setView(id) { state.view = id; $$('[data-view]').forEach(function (e) { if (e.getAttribute('data-view') === id) e.setAttribute('aria-current', 'page'); else e.removeAttribute('aria-current'); }); }
  function toggleTheme() { var cur = d.documentElement.getAttribute('data-theme'), next = cur === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    try { var u = new URL(location.href); if (u.searchParams.has('theme')) { u.searchParams.delete('theme'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); } } catch (e) {} /* a ?theme= link pins the theme only until the person chooses */ applyTheme(); var f = $('#side .foot'); if (f) f.innerHTML = footHtml(); toast(next === 'dark' ? 'Dark mode' : 'Light mode'); }
  function toggleRail() { var app = $('#app') || $('.bl-app'); if (!app) return; var on = app.classList.toggle('rail'); try { localStorage.setItem(RAIL_KEY, on ? '1' : '0'); } catch (e) {} }
  function openSide() { var s = $('#side'); if (!s) return; s.classList.add('open'); var bg = $('.side-bg'); if (bg) bg.classList.add('show'); }
  function closeSide() { var s = $('#side'); if (!s) return; s.classList.remove('open'); var bg = $('.side-bg'); if (bg) bg.classList.remove('show'); }

  /* ---- live pip in the sidebar (sessions working now) ---- */
  var liveTimer = null;
  function livePoll() {
    if (liveTimer) return;
    function tick() {
      if (d.hidden) return;
      fetch('/api/sessions?limit=12', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        var n = (j.sessions || []).filter(function (s) { return s.live; }).length;
        var it = $('[data-nav="live"] .n'); if (it) { it.innerHTML = n ? '<span class="pip live"></span> ' + n : ''; }
        d.dispatchEvent(new CustomEvent('bread:live', { detail: j }));
      }).catch(function () {});
    }
    tick(); liveTimer = setInterval(tick, 30000);
  }

  /* ---- a newer build is live: offer a one-tap refresh (the Hallalu CRM pattern) ----
     autodeploy.mjs stamps the commit here and into /build.json; a page left open checks when it is shown, focused or
     back online, and every 3 minutes, so it never quietly runs yesterday's build. Unstamped (local dev): no check. */
  var BUILD = 'dev';
  var updateShown = false, lastBuildCheck = 0;
  function checkBuild() {
    if (BUILD === 'dev' || updateShown || d.hidden || Date.now() - lastBuildCheck < 20000) return;
    lastBuildCheck = Date.now();
    fetch('/build.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.build || j.build === BUILD || updateShown) return;
      updateShown = true;
      var bar = d.createElement('div'); bar.className = 'update-bar'; bar.setAttribute('role', 'status');
      bar.innerHTML = icon('sparkles') + '<span>A newer Breadledger is ready.</span><button class="btn primary sm" type="button">Refresh</button>';
      bar.querySelector('button').onclick = function () { location.reload(); };
      d.body.appendChild(bar);
    }).catch(function () {});
  }
  ['visibilitychange', 'focus', 'online'].forEach(function (ev) { (ev === 'visibilitychange' ? d : w).addEventListener(ev, checkBuild); });
  w.addEventListener('pageshow', function (e) { if (e.persisted) checkBuild(); });
  setInterval(checkBuild, 180000); setTimeout(checkBuild, 4000);

  /* ---- time ---- */
  function ago(ts) { var t = typeof ts === 'number' ? ts : Date.parse(ts); if (!t) return ''; var s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return 'just now'; if (s < 90) return '1 min ago'; var m = Math.round(s / 60); if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago'); var dd = Math.round(h / 24); if (dd < 7) return dd + (dd === 1 ? ' day ago' : ' days ago');
    return fmtDate(t); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(ts, withTime) { var x = new Date(typeof ts === 'number' ? ts : Date.parse(ts)); if (isNaN(x)) return ''; var p = function (n) { return ('0' + n).slice(-2); };
    var s = x.getDate() + ' ' + MON[x.getMonth()] + (x.getFullYear() !== new Date().getFullYear() ? ' ' + x.getFullYear() : ''); return withTime ? s + ', ' + p(x.getHours()) + ':' + p(x.getMinutes()) : s; }
  function dayKey(ts) { var x = new Date(typeof ts === 'number' ? ts : Date.parse(ts)); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); }
  function dayLabel(key) { var t = dayKey(Date.now()), y = dayKey(Date.now() - 864e5); if (key === t) return 'Today'; if (key === y) return 'Yesterday';
    var p = key.split('-'); var x = new Date(+p[0], +p[1] - 1, +p[2]); return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][x.getDay()] + ' ' + x.getDate() + ' ' + MON[x.getMonth()] + (x.getFullYear() !== new Date().getFullYear() ? ' ' + x.getFullYear() : ''); }

  /* ---- toast ---- */
  function toast(msg, kind, ms) { var box = $('.toasts'); if (!box) { box = d.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); d.body.appendChild(box); }
    var t = d.createElement('div'); t.className = 'toast' + (kind ? ' ' + kind : ''); t.textContent = msg; box.appendChild(t); setTimeout(function () { t.remove(); }, ms || 2600); }

  /* ---- layers: modal, peek, lightbox, palette share one Esc stack ---- */
  var layers = [];
  function pushLayer(close) { layers.push(close); } function popLayer(close) { var i = layers.indexOf(close); if (i >= 0) layers.splice(i, 1); }
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && layers.length) { e.preventDefault(); layers[layers.length - 1](); } });

  var modal = { el: null, open: function (o) { o = o || {}; modal.close(); var bg = d.createElement('div'); bg.className = 'modal-bg show';
      bg.innerHTML = '<div class="modal' + (o.size === 'lg' ? ' lg' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title || 'Dialog') + '"><div class="modal-h"><span class="grow">' + esc(o.title || '') + '</span><button class="btn ghost icon" type="button" data-close aria-label="Close">' + icon('x') + '</button></div><div class="modal-b">' + (o.body || '') + '</div>' + (o.footer ? '<div class="modal-f">' + o.footer + '</div>' : '') + '</div>';
      bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-close]')) modal.close(); });
      d.body.appendChild(bg); modal.el = bg; pushLayer(modal.close); var f = $('input,textarea,select,button:not([data-close])', bg); if (f) setTimeout(function () { f.focus(); }, 30); return bg; },
    close: function () { if (!modal.el) return; popLayer(modal.close); modal.el.remove(); modal.el = null; } };

  var peek = { el: null, bg: null, open: function (o) { o = o || {}; if (!peek.el) { peek.bg = d.createElement('div'); peek.bg.className = 'peek-bg'; peek.bg.onclick = peek.close; peek.el = d.createElement('aside'); peek.el.className = 'peek'; peek.el.setAttribute('role', 'dialog'); peek.el.setAttribute('aria-label', 'Details'); d.body.appendChild(peek.bg); d.body.appendChild(peek.el); }
      peek.el.innerHTML = '<div class="peek-h"><span class="title">' + esc(o.title || '') + '</span><span class="grow"></span>' + (o.nav ? '<button class="btn ghost icon sm" type="button" data-peek="prev" aria-label="Previous">' + icon('up') + '</button><button class="btn ghost icon sm" type="button" data-peek="next" aria-label="Next">' + icon('down') + '</button>' : '') + '<button class="btn ghost icon" type="button" data-peek="close" aria-label="Close">' + icon('x') + '</button></div><div class="peek-b">' + (o.body || '') + '</div>' + (o.footer ? '<div class="peek-f">' + o.footer + '</div>' : '');
      peek.el.onclick = function (e) { var b = e.target.closest('[data-peek]'); if (!b) return; var a = b.getAttribute('data-peek'); if (a === 'close') peek.close(); else if (o.onNav) o.onNav(a); };
      if (!peek.el.classList.contains('open')) { peek.el.classList.add('open'); peek.bg.classList.add('open'); pushLayer(peek.close); }
      peek.onClose = o.onClose; return peek.el; },
    close: function () { if (!peek.el || !peek.el.classList.contains('open')) return; popLayer(peek.close); peek.el.classList.remove('open'); peek.bg.classList.remove('open'); if (peek.onClose) peek.onClose(); },
    isOpen: function () { return !!(peek.el && peek.el.classList.contains('open')); } };

  /* ---- screenshots: strip + lightbox (kept API-compatible with the old BL_* helpers) ---- */
  function baClass(cap) { var c = (cap || '').toLowerCase(); if (/\bbefore\b|\bwas\b|current|old|problem|issue/.test(c)) return 'before'; if (/\bafter\b|\bnow\b|fixed|new|improved|elevated|proposed/.test(c)) return 'after'; return ''; }
  function shotStrip(shots) { if (!Array.isArray(shots) || !shots.length) return ''; var urls = shots.map(function (s) { return s.url; });
    return '<div class="shots">' + shots.map(function (s, i) { var ba = baClass(s.caption); return '<figure class="shot" data-shot="' + esc(urls.join('|')) + '" data-i="' + i + '" tabindex="0" role="button" aria-label="View screenshot"><img loading="lazy" data-framed src="' + esc(s.url) + '" alt="' + esc(s.caption || 'screenshot') + '"><figcaption>' + (ba ? '<span class="ba ' + ba + '">' + ba + '</span>' : '') + '<span class="truncate">' + esc(s.caption || 'Screenshot') + '</span></figcaption></figure>'; }).join('') + '</div>'; }
  var lb = { el: null, cur: [], caps: [], idx: 0,
    ensure: function () { if (lb.el) return; var e = d.createElement('div'); e.className = 'lightbox'; e.setAttribute('role', 'dialog'); e.setAttribute('aria-label', 'Screenshot');
      e.innerHTML = '<button class="lbx" type="button" aria-label="Close">' + icon('x') + '</button><button class="lbnav lbprev" type="button" aria-label="Previous">' + icon('left') + '</button><figure><img alt=""><figcaption></figcaption></figure><button class="lbnav lbnext" type="button" aria-label="Next">' + icon('right') + '</button>';
      e.addEventListener('click', function (ev) { if (ev.target === e) lb.close(); }); $('.lbx', e).onclick = lb.close; $('.lbprev', e).onclick = function (ev) { ev.stopPropagation(); lb.step(-1); }; $('.lbnext', e).onclick = function (ev) { ev.stopPropagation(); lb.step(1); };
      d.body.appendChild(e); lb.el = e; },
    show: function () { lb.ensure(); $('img', lb.el).src = lb.cur[lb.idx] || ''; $('figcaption', lb.el).textContent = lb.caps[lb.idx] || ''; lb.el.classList.add('show'); var many = lb.cur.length > 1; $('.lbprev', lb.el).style.display = $('.lbnext', lb.el).style.display = many ? 'flex' : 'none'; },
    open: function (urls, caps, i) { lb.cur = urls || []; lb.caps = caps || []; lb.idx = i || 0; lb.show(); pushLayer(lb.close); },
    close: function () { if (!lb.el) return; popLayer(lb.close); lb.el.classList.remove('show'); $('img', lb.el).src = ''; },
    step: function (n) { lb.idx = (lb.idx + n + lb.cur.length) % lb.cur.length; lb.show(); } };
  d.addEventListener('click', function (e) { var f = e.target.closest && e.target.closest('.shot[data-shot]'); if (!f) return; var urls = f.getAttribute('data-shot').split('|');
    var caps = $$('.shot', f.parentNode).map(function (x) { var c = x.querySelector('figcaption'); return c ? c.textContent.trim() : ''; }); lb.open(urls, caps, +f.getAttribute('data-i') || 0); });
  d.addEventListener('keydown', function (e) { if (lb.el && lb.el.classList.contains('show')) { if (e.key === 'ArrowLeft') lb.step(-1); else if (e.key === 'ArrowRight') lb.step(1); }
    if ((e.key === 'Enter' || e.key === ' ') && d.activeElement && d.activeElement.classList && d.activeElement.classList.contains('shot')) { e.preventDefault(); d.activeElement.click(); } });

  /* ---- command palette ---- */
  var cmdk = { el: null, items: [], sel: 0, q: '',
    base: function () { var it = [];
      NAV.forEach(function (n) { if (n.h) return; it.push({ group: 'Go to', label: n.label, icon: n.icon, href: n.href, sub: n.href });
        if (n.views) n.views.forEach(function (v) { it.push({ group: 'Ledger views', label: v.label, icon: v.icon, href: '/#view=' + v.id, sub: 'Ledger' }); }); });
      it.push({ group: 'Go to', label: 'Plans', icon: 'plans', href: '/plans', sub: '/plans' });
      it.push({ group: 'Actions', label: 'Switch theme', icon: 'moon', run: toggleTheme, sub: 'T' });
      it.push({ group: 'Actions', label: 'Keyboard shortcuts', icon: 'keyboard', run: showKeys, sub: '?' });
      it.push({ group: 'Actions', label: 'Collapse sidebar', icon: 'panel', run: toggleRail, sub: '[' });
      return it.concat(state.items); },
    register: function (items) { state.items = state.items.concat(items); },
    open: function () { if (cmdk.el) return; cmdk.sel = 0; cmdk.q = ''; var e = d.createElement('div'); e.className = 'cmdk-bg show';
      e.innerHTML = '<div class="cmdk" role="dialog" aria-modal="true" aria-label="Command palette"><div class="cmdk-in">' + icon('search') + '<input type="text" placeholder="Search bugs, views, pages… (type to filter)" aria-label="Search" autocomplete="off" spellcheck="false"></div><div class="cmdk-list" role="listbox"></div><div class="cmdk-f"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div></div>';
      e.addEventListener('click', function (ev) { if (ev.target === e) cmdk.close(); }); d.body.appendChild(e); cmdk.el = e; pushLayer(cmdk.close);
      var inp = $('input', e); inp.oninput = function () { cmdk.q = inp.value; cmdk.sel = 0; cmdk.render(); };
      inp.onkeydown = function (ev) { var n = $$('.cmdk-it', e).length; if (ev.key === 'ArrowDown') { ev.preventDefault(); cmdk.sel = Math.min(n - 1, cmdk.sel + 1); cmdk.paint(); } else if (ev.key === 'ArrowUp') { ev.preventDefault(); cmdk.sel = Math.max(0, cmdk.sel - 1); cmdk.paint(); } else if (ev.key === 'Enter') { ev.preventDefault(); var s = $$('.cmdk-it', e)[cmdk.sel]; if (s) s.click(); } };
      cmdk.render(); setTimeout(function () { inp.focus(); }, 20); },
    close: function () { if (!cmdk.el) return; popLayer(cmdk.close); cmdk.el.remove(); cmdk.el = null; },
    render: function () { var list = $('.cmdk-list', cmdk.el), q = cmdk.q.trim().toLowerCase(), all = cmdk.base();
      var hits = all.filter(function (i) { return !q || (i.label + ' ' + (i.sub || '') + ' ' + (i.hay || '')).toLowerCase().indexOf(q) >= 0; });
      if (q && typeof w.BREAD_SEARCH === 'function') hits = hits.concat(w.BREAD_SEARCH(q).slice(0, 12));
      hits = hits.slice(0, 40); var html = '', g = '';
      hits.forEach(function (i, n) { if (i.group !== g) { g = i.group; html += '<div class="cmdk-h">' + esc(g) + '</div>'; }
        html += '<div class="cmdk-it' + (n === cmdk.sel ? ' sel' : '') + '" role="option" data-n="' + n + '">' + icon(i.icon || 'arrow') + '<span class="t">' + esc(i.label) + '</span>' + (i.sub ? '<span class="sub">' + esc(i.sub) + '</span>' : '') + '</div>'; });
      list.innerHTML = html || '<div class="empty" style="padding:28px"><b>No match</b><p>Try another word, or a prefix like app: cat: sev:</p></div>';
      $$('.cmdk-it', list).forEach(function (el) { el.onclick = function () { var i = hits[+el.getAttribute('data-n')]; cmdk.close(); if (i.run) i.run(); else if (i.href) { if (i.href.indexOf('/#') === 0 && location.pathname === '/') { location.hash = i.href.slice(2); } else location.href = i.href; } };
        el.onmousemove = function () { var n = +el.getAttribute('data-n'); if (n !== cmdk.sel) { cmdk.sel = n; cmdk.paint(); } }; }); },
    paint: function () { $$('.cmdk-it', cmdk.el).forEach(function (el, n) { el.classList.toggle('sel', n === cmdk.sel); if (n === cmdk.sel) el.scrollIntoView({ block: 'nearest' }); }); } };

  /* ---- keyboard shortcuts ---- */
  var KEYS = [['⌘ K', 'Search, jump to any view or page'], ['/', 'Focus the search box'], ['J / K', 'Next / previous row'], ['↵', 'Open the selected row'], ['X', 'Tick the selected row'], ['N', 'New finding'], ['Esc', 'Close panel, dialog or palette'], ['T', 'Switch light / dark'], ['V', 'Voice command (microphone)'], ['[', 'Collapse the sidebar'], ['?', 'This list']];
  function showKeys() { modal.open({ title: 'Keyboard shortcuts', body: '<div class="kv">' + KEYS.map(function (k) { return '<dt><kbd>' + esc(k[0]) + '</kbd></dt><dd>' + esc(k[1]) + '</dd>'; }).join('') + '</div>' }); }
  function typing(e) { var t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
  d.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdk.el ? cmdk.close() : cmdk.open(); return; }
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { var s = $('[data-search]'); if (s) { e.preventDefault(); s.focus(); s.select && s.select(); } }
    else if (e.key === '?') { e.preventDefault(); showKeys(); }
    else if (e.key === 't' || e.key === 'T') { toggleTheme(); }
    else if (e.key === 'v' || e.key === 'V') { voice.listen({ onResult: function (t, fin) { if (fin) voice.command(t); } }); }
    else if (e.key === '[') { toggleRail(); }
  });

  /* ---- voice: browser speech recognition (free, on-device in Safari, Google's in Chrome), no server ---- */
  var SR = w.SpeechRecognition || w.webkitSpeechRecognition || null;
  var voice = { el: null, rec: null, supported: !!SR,
    /* listen once; onResult(text, isFinal). Shows a listening sheet with the live transcript. */
    listen: function (o) { o = o || {}; if (!SR) { toast('Voice needs Chrome, Edge or Safari', 'err'); return; } voice.stop();
      var r = new SR(); r.lang = o.lang || (navigator.language || 'en-GB'); r.interimResults = true; r.continuous = false; r.maxAlternatives = 1; voice.rec = r;
      var sheet = d.createElement('div'); sheet.className = 'voice-sheet'; sheet.innerHTML = '<div class="voice-card" role="dialog" aria-label="Listening"><div class="ring">' + icon('mic') + '</div><div class="vt"><b>' + esc(o.title || 'Listening…') + '</b><div class="tx" aria-live="polite">' + esc(o.hint || 'Say a view, a page or an action. For example “open security”, “new finding”, “dark mode”, or words to search.') + '</div></div><button class="btn ghost icon" type="button" data-vstop aria-label="Stop listening">' + icon('x') + '</button></div>';
      sheet.addEventListener('click', function (e) { if (e.target === sheet || e.target.closest('[data-vstop]')) voice.stop(); }); d.body.appendChild(sheet); voice.el = sheet; pushLayer(voice.stop);
      var tx = $('.tx', sheet), heard = '';
      r.onresult = function (ev) { var t = '', fin = false; for (var i = ev.resultIndex; i < ev.results.length; i++) { t += ev.results[i][0].transcript; if (ev.results[i].isFinal) fin = true; } heard = t.trim(); tx.textContent = heard || '…'; if (o.onResult) o.onResult(heard, fin); if (fin) { setTimeout(voice.stop, 250); } };
      r.onerror = function (ev) { tx.textContent = ev.error === 'not-allowed' ? 'Microphone access was refused. Allow it in the browser and try again.' : ev.error === 'no-speech' ? 'Nothing heard. Try again.' : 'Could not listen (' + ev.error + ').'; sheet.classList.add('err'); setTimeout(voice.stop, 1800); };
      r.onend = function () { if (voice.rec === r && !heard) setTimeout(voice.stop, 1200); };
      try { r.start(); } catch (e) { toast('Could not start the microphone', 'err'); voice.stop(); } },
    stop: function () { if (voice.rec) { try { voice.rec.onend = null; voice.rec.stop(); } catch (e) {} voice.rec = null; } if (voice.el) { popLayer(voice.stop); voice.el.remove(); voice.el = null; } },
    /* a spoken command for the shell: views, pages, actions, otherwise a search */
    command: function (text) { var t = (text || '').toLowerCase().trim(); if (!t) return false;
      var go = function (href) { if (href.indexOf('/#') === 0 && location.pathname === '/') { location.hash = href.slice(2); } else location.href = href; toast('Opening ' + href.replace('/#view=', '').replace('/', '') || 'home'); return true; };
      var views = { overview: 'overview', home: 'overview', bugs: 'bugs', bug: 'bugs', security: 'security', audit: 'security', optimisers: 'optimisers', optimizers: 'optimisers', scanner: 'scanner', leads: 'scanner', harvested: 'harvest', harvest: 'harvest', checks: 'checks', submitted: 'submitted' };
      var pages = { live: '/live', activity: '/timeline', timeline: '/timeline', prompts: '/journal', journal: '/journal', admin: '/admin', 'ai footprint': '/aiscan', footprint: '/aiscan', sanitizer: '/sanitize', sanitiser: '/sanitize', plans: '/plans', pricing: '/plans' };
      if (/^(new|add) (finding|bug)/.test(t)) { var b = $('[data-newfinding]'); if (b) { b.click(); toast('New finding'); return true; } }
      if (/dark mode|light mode|switch theme|toggle theme/.test(t)) { toggleTheme(); return true; }
      if (/collapse|expand sidebar|hide sidebar|show sidebar/.test(t)) { toggleRail(); return true; }
      if (/shortcuts|help/.test(t)) { showKeys(); return true; }
      var m = t.match(/^(?:open|go to|show|show me)\s+(?:the\s+)?(.+)$/); var key = m ? m[1] : t;
      for (var p in pages) if (key === p || key.indexOf(p) === 0) return go(pages[p]);
      for (var v in views) if (key === v || key.indexOf(v) === 0) return go('/#view=' + views[v]);
      var sm = t.match(/^(?:search|find|look for)\s+(.+)$/); var q = sm ? sm[1] : null;
      if (q || !m) { var s = $('[data-search]'); if (s) { s.value = q || t; s.dispatchEvent(new Event('input', { bubbles: true })); s.focus(); toast('Searching “' + (q || t) + '”'); return true; } cmdk.open(); var inp = $('.cmdk input'); if (inp) { inp.value = q || t; inp.dispatchEvent(new Event('input')); } return true; }
      toast('Did not catch a command in “' + t + '”', 'err'); return false; },
    /* dictate into a field: appends the final transcript */
    dictate: function (field) { if (!field) return; voice.listen({ title: 'Dictating…', hint: 'Speak; the words land in the field when you pause.', onResult: function (t, fin) { if (fin && t) { var v = field.value, sep = v && !/\s$/.test(v) ? ' ' : ''; field.value = v + sep + t; field.dispatchEvent(new Event('input', { bubbles: true })); field.focus(); } } }); } };
  d.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-voice]'); if (!b) return; var what = b.getAttribute('data-voice');
    if (what === 'command') voice.listen({ onResult: function (t, fin) { if (fin) voice.command(t); } });
    else { var f = what ? d.getElementById(what) : null; if (!f && b.parentNode) f = b.parentNode.querySelector('input,textarea'); voice.dictate(f); } });

  /* ---- small helpers ---- */
  function copy(text, label) { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast((label || 'Copied') + ' to clipboard', 'ok'); }, function () { toast('Could not copy — select the text instead', 'err'); }); }
  function fmtN(n) { return (+n || 0).toLocaleString(); }
  /* count a number up in place (stat tiles); honours reduced motion; re-runs from the previous value */
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countUp(el, to, ms) { to = +to || 0; var from = +(el.getAttribute('data-n') || 0); el.setAttribute('data-n', to);
    if (reduce || from === to || Math.abs(to - from) < 2) { el.textContent = fmtN(to); return; }
    var t0 = performance.now(), dur = ms || 700; (function tick(now) { var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmtN(Math.round(from + (to - from) * e)); if (p < 1) requestAnimationFrame(tick); })(t0); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms || 120); }; }
  /* ---- visuals: avatar, area chart, before/after compare ---- */
  function hue(name) { var h = 0; name = String(name || ''); for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return h % 360; }
  function initials(name) { var w = String(name || '?').replace(/[^\w\s.]/g, ' ').trim().split(/\s+/).filter(Boolean); if (!w.length) return '?'; return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)); }
  function avatar(name, size) { return '<span class="avatar' + (size ? ' ' + size : '') + '" style="--h:' + hue(name) + '" title="' + esc(name) + '" aria-hidden="true">' + esc(initials(name)) + '</span>'; }
  function areaChart(points, o) { /* points: [{label, value}] → responsive SVG with hover dots and native tooltips */
    o = o || {}; var W = o.w || 600, H = o.h || 160, pl = 8, pr = 8, pt = 12, pb = 24, n = points.length; if (!n) return '';
    var max = Math.max(1, Math.max.apply(null, points.map(function (p) { return p.value; }))), ix = function (i) { return pl + (n === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (n - 1)); }, iy = function (v) { return pt + (H - pt - pb) * (1 - v / max); };
    var path = points.map(function (p, i) { return (i ? 'L' : 'M') + ix(i).toFixed(1) + ' ' + iy(p.value).toFixed(1); }).join(' ');
    var area = path + ' L' + ix(n - 1).toFixed(1) + ' ' + (H - pb) + ' L' + ix(0).toFixed(1) + ' ' + (H - pb) + ' Z';
    var grid = [0, .5, 1].map(function (f) { var y = iy(max * f); return '<line class="grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>'; }).join('');
    var step = Math.max(1, Math.round(n / 6)), labels = points.map(function (p, i) { return (i % step === 0 || i === n - 1) ? '<text class="lbl" x="' + ix(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '">' + esc(p.label) + '</text>' : ''; }).join('');
    var hits = points.map(function (p, i) { var x = ix(i), w = (W - pl - pr) / Math.max(1, n - 1); return '<rect class="hit" x="' + (x - w / 2).toFixed(1) + '" y="0" width="' + w.toFixed(1) + '" height="' + H + '" tabindex="0"><title>' + esc(p.label + ': ' + p.value + (o.unit ? ' ' + o.unit : '')) + '</title></rect><circle class="dot" cx="' + x.toFixed(1) + '" cy="' + iy(p.value).toFixed(1) + '" r="4"/>'; }).join('');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'Chart') + '">' + grid + '<path class="area" d="' + area + '"/><path class="line" d="' + path + '"/>' + labels + hits + '</svg>'; }
  function compare(before, after, caps) { caps = caps || {}; return '<div class="compare" style="--x:50%"><img src="' + esc(before) + '" alt="' + esc(caps.before || 'Before') + '" data-framed><img class="after" src="' + esc(after) + '" alt="' + esc(caps.after || 'After') + '" data-framed><span class="tag b">Before</span><span class="tag a">After</span><span class="bar"></span><span class="knob">' + icon('left') + icon('right') + '</span><input type="range" min="0" max="100" value="50" aria-label="Reveal the after screenshot"></div>' + (caps.before || caps.after ? '<div class="compare-cap"><span>' + esc(caps.before || '') + '</span><span>' + esc(caps.after || '') + '</span></div>' : ''); }
  d.addEventListener('input', function (e) { var r = e.target; if (r && r.type === 'range' && r.parentNode && r.parentNode.classList.contains('compare')) r.parentNode.style.setProperty('--x', r.value + '%'); });
  function empty(title, text, icoName, img) { return '<div class="empty' + (img ? ' art' : '') + '">' + (img ? '<img src="' + esc(img) + '" alt="" width="420" height="240" loading="lazy" data-framed>' : icon(icoName || 'inbox')) + '<b>' + esc(title) + '</b>' + (text ? '<p>' + text + '</p>' : '') + '</div>'; }

  w.Bread = { mount: mount, icon: icon, mark: MARK, esc: esc, $: $, $$: $$, setCount: setCount, setView: setView, toggleTheme: toggleTheme, openSide: openSide, closeSide: closeSide,
    ago: ago, fmtDate: fmtDate, dayKey: dayKey, dayLabel: dayLabel, toast: toast, modal: modal, peek: peek, lightbox: lb, shotStrip: shotStrip, cmdk: cmdk, copy: copy, fmtN: fmtN, countUp: countUp, voice: voice, hue: hue, avatar: avatar, areaChart: areaChart, compare: compare, reduceMotion: reduce, debounce: debounce, empty: empty, showKeys: showKeys, VIEWS: VIEWS, NAV: NAV };
  w.BL_shotStrip = shotStrip; w.BL_openShot = lb.open; w.BL_closeShot = lb.close;
})();
