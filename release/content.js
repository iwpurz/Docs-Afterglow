(function () {
  'use strict';

  if (window.__ddLoaded) return;
  window.__ddLoaded = true;

  const DD = window.DD, DDBg = window.DDBg;
  if (!DD || !DDBg || typeof DD.normalize !== 'function' || typeof DDBg.create !== 'function') {
    console.warn('[Docs Afterglow] Required modules missing — not starting.');
    return;
  }
  const API = (typeof browser !== 'undefined' && browser.storage) ? browser
            : (typeof chrome  !== 'undefined' && chrome.storage)  ? chrome
            : null;
  if (!API) console.warn('[Docs Afterglow] Extension storage API unavailable — settings will not persist.');

  const CACHE     = '__dd_cache_v1';
  const SVGNS     = 'http://www.w3.org/2000/svg';
  const FLIP      = 'invert(1) hue-rotate(180deg)';
  const IDENTITY  = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0';
  const INVERT_MX = '-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0';

  let S = null, img = '', engine = null, lengine = null, assets = {}, assetsVer = 0;
  let styleEl = null, svgEl = null, hostEl = null;
  let bgSig = '', filterSig = '', lastSrc = '', lastCached = '';
  let mounted = false;

  const lines = (t) => String(t || '').split('\n').map(s => s.trim()).filter(Boolean);
  const rule  = (list, body) => list.map(s => s + '{' + body + '}').join('\n');
  const num   = (v, d) => { const n = +v; return Number.isFinite(n) ? n : d; };
  const toMin = (t) => {
    const p = String(t || '0:0').split(':').map(Number);
    return (Number.isFinite(p[0]) ? p[0] : 0) * 60 + (Number.isFinite(p[1]) ? p[1] : 0);
  };

  // The document list ("front page") lives under /document/ but has no /d/<id>/ segment.
  const isHomePage = () => !/\/document\/(u\/\d+\/)?d\//.test(location.pathname);

  // body gets `invert(1) hue-rotate(180deg)`; this is the color to paint it BEFORE the filter so it
  // comes out as `hexColor` afterwards (the hue rotation by 180deg is its own inverse).
  function preFilterColor(hexColor, alpha) {
    const c = DD.hex(hexColor).map(v => v / 255), r = c[0], g = c[1], b = c[2];
    const h = [-0.574 * r + 1.430 * g + 0.144 * b, 0.426 * r + 0.430 * g + 0.144 * b, 0.426 * r + 1.430 * g - 0.856 * b]
      .map(v => Math.max(0, Math.min(1, v)));
    return 'rgba(' + h.map(v => Math.round((1 - v) * 255)).join(',') + ',' + alpha + ')';
  }

  function isActive(s) {
    if (!s || !s.enabled) return false;
    const sch = s.schedule || {};
    if (sch.mode === 'system') {
      try { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
      catch (e) { return false; }
    }
    if (sch.mode === 'time') {
      const d = new Date(), now = d.getHours() * 60 + d.getMinutes();
      const f = toMin(sch.from), t = toMin(sch.to);
      return f <= t ? (now >= f && now < t) : (now >= f || now < t);
    }
    return true;
  }

  function buildCSS(s, m) {
    const sel  = s.selectors || {};
    const page = s.page      || {};
    
    const ui   = lines(sel.ui);
    const menus = lines(sel.menus || '');
    const ws   = lines(sel.workspace);
    const pc   = lines(sel.pageCanvas);
    const pb   = lines(sel.pageBg);

    const op   = num(page.opacity, 100) / 100;
    const pageBg = page.type === 'gradient'
      ? 'linear-gradient(' + num(page.angle, 0) + 'deg,' + DD.rgba(page.bg, op) + ',' + DD.rgba(page.bg2, op) + ')'
      : DD.rgba(page.bg, op);
    const bg0   = (s.bg && s.bg.colors && s.bg.colors[0]) || '#000000';
    const blend = (m && m.blend && m.blend !== 'normal') ? 'mix-blend-mode:' + m.blend + ' !important;' : '';

    const out = [];

    out.push(':root{--dd-bg:' + bg0 + ';--dd-ui-bg:' + s.ui.bg + ';--dd-ui-text:' + s.ui.text +
      ';--dd-page-bg:' + page.bg + ';--dd-page-text:' + page.text + ';--dd-accent:' + s.accent + ';}');
    out.push('html{background:' + bg0 + ' !important;}');
    out.push('html body{background:transparent !important;}');

    // Workspace transparency
    out.push(rule(ws.concat(['#docs-editor-container', '#kix-appview']), 'background:transparent !important;background-color:transparent !important;'));
    out.push('[data-dd-clear]{background:transparent !important;background-color:transparent !important;}');

    // --- UI FILTERS ---
    // Filters NEST: an element inside an already-filtered ancestor gets inverted
    // twice and flips back to light. So CSS never filters by selector; tagUi()
    // below tags only the OUTERMOST matches (data-dd-ui / data-dd-pop).
    const FX = 'will-change:filter;transform:translateZ(0);'; // GPU layer: without it Firefox renders filtered text blurry
    out.push('[data-dd-ui]{filter:url(#dd-f-ui) !important;' + FX + '}');
    out.push('[data-dd-pop]{filter:url(#dd-f-pop) !important;' + FX + 'box-shadow:none !important;}');
    // Inverting a (black, translucent) drop shadow turns it into a light halo.
    out.push('[data-dd-pop] *, [data-dd-ui] [class*="bubble" i], [data-dd-ui] [class*="popup" i], [data-dd-ui] [class*="tooltip" i]{box-shadow:none !important;}');

    // Side panel (Calendar/Keep/Tasks/...) is not filtered: theme its background and
    // flip only the black glyph icons (+, more) so they stay visible.
    // #docs-chrome itself is no longer filtered (so the side panel can escape it): give it the UI color directly.
    out.push('html:not([data-dd-home]) #docs-chrome{background:' + DD.rgba(s.ui.bg, num(s.ui.opacity, 100) / 100) + ' !important;}');
    out.push('.docs-companion-app-switcher-container, .companion-app-switcher-container{background:' + s.ui.bg + ' !important;}');
    out.push('.app-switcher-button-icon-container[style*="black-24dp"], .app-switcher-button-icon-container[style*="grey600"]{filter:invert(1) !important;}');

    // Docs home page (document list): themed with the same colors, and the wallpaper shows through.
    // A plain CSS filter is used because SVG filters on a page-sized element come out blurry in Firefox.
    // Light panels are made transparent by autoClear() so the body color below shows through.
    {
      const hop = num(s.home && s.home.opacity, 82) / 100;
      if (s.ui.invert) {
        out.push('html[data-dd-home] body{filter:invert(1) hue-rotate(180deg) !important;background:' + preFilterColor(s.ui.bg, hop) + ' !important;}');
        out.push('html[data-dd-home] body :is(img,video,canvas,picture){filter:invert(1) hue-rotate(180deg) !important;}');
      } else {
        out.push('html[data-dd-home] body{background:' + DD.rgba(s.ui.bg, hop) + ' !important;}');
      }
      const raised = '#' + [0, 1, 2].map(i => Math.round(DD.hex(s.ui.bg)[i] + (DD.hex(s.ui.text)[i] - DD.hex(s.ui.bg)[i]) * 0.1).toString(16).padStart(2, '0')).join('');
      out.push('html[data-dd-home] [data-dd-hs]{background:' + (s.ui.invert ? preFilterColor(raised, 1) : raised) + ' !important;}');
      out.push('html[data-dd-home] #docs-chrome{background:transparent !important;}');
    }

    // --- MEDIA PROTECTION ---
    if (s.ui.invert && s.ui.protectImages) {
      const media = ['img', 'video', 'canvas:not(.kix-canvas-tile-content)', 'svg:not(#dd-svg)'];
      const mediaSelectors = [];
      ['[data-dd-ui]', '[data-dd-pop]'].forEach(h => media.forEach(m => mediaSelectors.push(h + ' ' + m)));
      out.push(rule(mediaSelectors, 'filter: ' + FLIP + ' !important;'));
      // Colored product icons drawn as CSS background-image (side-panel apps, etc.)
      const bgIcons = ['[style*="companion/icon_assets"]', '[style*="productlogos"]', '[style*="googleusercontent"]'];
      const bgSel = [];
      ['[data-dd-ui]', '[data-dd-pop]'].forEach(h => bgIcons.forEach(m => bgSel.push(h + ' ' + m)));
      out.push(rule(bgSel, 'filter: ' + FLIP + ' !important;'));
    }

    // --- PAGE CANVAS & BACKGROUNDS ---
    // THE FIX: Make the white SVG rectangle behind the text transparent
    out.push('.kix-page-paginated svg rect, .kix-canvas-tile-content svg rect { fill: transparent !important; }');

    out.push(rule(pb, 'border-color:' + DD.rgba(s.ui.text, 0.22) + ' !important;background:' + pageBg + ' !important;'));
    out.push(rule(pc, 'filter:url(#dd-f-page) !important;' + blend));
    const mix = (a, b, t) => '#' + [0, 1, 2].map(i => { const A = DD.hex(a)[i], B = DD.hex(b)[i]; return Math.round(A + (B - A) * t).toString(16).padStart(2, '0'); }).join('');
    const edge = mix(s.ui.bg, s.ui.text, 0.28);
    out.push(rule(pb, 'border-color:' + edge + ' !important;box-shadow:none !important;outline:none !important;'));
    out.push('.kix-page-paginated::after{content:"";position:absolute;inset:-1px;box-sizing:border-box;border:1px solid ' + edge + ';pointer-events:none;z-index:5;}');
    // Header: Firefox renders the SVG filter blurry here (confirmed by testing), so use plain CSS filter
    // functions instead. Its own backgrounds go transparent so the right-hand bar matches the rest.
    out.push('#docs-header[data-dd-ui]{filter:invert(1) hue-rotate(180deg) !important;}');
    out.push('#docs-header, #docs-header-container, #docs-titlebar-container, #docs-titlebar, #docs-header .docs-titlebar-buttons, #docs-header .onegoogle-material-minibar{background:transparent !important;}');

    // Cover the 1px light seam above the ruler (left/right corners) with the chrome color.
    const seamOp = num(s.ui.opacity, 100) / 100;
    out.push('#kix-appview::before{content:"";position:absolute;left:0;top:-1px;width:100%;height:2px;background:' + mix(bg0, s.ui.bg, seamOp) + ';pointer-events:none;z-index:50;}');

    // Rulers (#kix-horizontal-ruler-container / #kix-vertical-ruler-container) are tagged by tagUi().

    // Shadows & Editor spacing
    out.push('.kix-page-top-shadow, .kix-page-bottom-shadow, .kix-header-footer-view, .kix-appview-editor-space { background: transparent !important; box-shadow: none !important; border: none !important; }');

    // Caret & Selection
    out.push('.kix-cursor-caret{border-color:' + s.caret + ' !important;}');
    out.push('.kix-selection-overlay{background-color:' + DD.rgba(s.selection, num(s.selectionAlpha, 30) / 100) + ' !important;}');

    if (s.scrollbars) out.push('*{scrollbar-color:' + DD.rgba(s.accent, 0.5) + ' transparent;}');
    if (s.customCSS) out.push(s.customCSS);

    return out.join('\n');
  }

  function svg(name, attrs) {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    return e;
  }
  function makeFilter(id, invert, keepHues, matrix, keepColors) {
    const f = svg('filter', { id, x: '0', y: '0', width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' });
    const add = (name, attrs) => { const e = svg(name, attrs); f.appendChild(e); return e; };
    const sel = keepColors && invert;
    if (invert) {
      add('feColorMatrix', { type: 'matrix', values: DD.INVERT || INVERT_MX, 'in': 'SourceGraphic' });
      if (keepHues) add('feColorMatrix', { type: 'hueRotate', values: '180' });
    }
    add('feColorMatrix', { type: 'matrix', values: matrix || IDENTITY, result: sel ? 'ddB' : 'ddm' });
    if (sel) {
      // Saturation mask: colorful pixels (emoji, images) keep their original color,
      // neutral pixels (black/white/gray text) are inverted.
      ['R', 'G', 'B'].forEach((ch, i) => {
        const row = [0, 0, 0, 0, 0]; row[i] = 1;
        add('feColorMatrix', { type: 'matrix', 'in': 'SourceGraphic', result: ch === 'B' ? 'ddB2' : 'dd' + ch,
          values: row.join(' ') + ' ' + row.join(' ') + ' ' + row.join(' ') + ' 0 0 0 0 1' });
      });
      add('feBlend', { mode: 'lighten', 'in': 'ddR', in2: 'ddG', result: 'ddMx1' });
      add('feBlend', { mode: 'lighten', 'in': 'ddMx1', in2: 'ddB2', result: 'ddMax' });
      add('feBlend', { mode: 'darken', 'in': 'ddR', in2: 'ddG', result: 'ddMn1' });
      add('feBlend', { mode: 'darken', 'in': 'ddMn1', in2: 'ddB2', result: 'ddMin' });
      add('feBlend', { mode: 'difference', 'in': 'ddMax', in2: 'ddMin', result: 'ddSat' });
      const ct = add('feComponentTransfer', { 'in': 'ddSat', result: 'ddMask' });
      // Lift low chroma smoothly so antialiased emoji edges and muted image/video
      // colors are not abruptly switched between preserved and inverted pixels.
      ['R', 'G', 'B'].forEach(ch => ct.appendChild(svg('feFunc' + ch, { type: 'gamma', amplitude: '1', exponent: '0.35', offset: '0' })));
      add('feComposite', { 'in': 'ddMask', in2: 'SourceGraphic', operator: 'arithmetic', k1: '1', k2: '0', k3: '0', k4: '0', result: 'ddKeep' });
      add('feComposite', { 'in': 'ddMask', in2: 'ddB', operator: 'arithmetic', k1: '-1', k2: '0', k3: '1', k4: '0', result: 'ddInv' });
      add('feComposite', { 'in': 'ddKeep', in2: 'ddInv', operator: 'arithmetic', k1: '0', k2: '1', k3: '1', k4: '0' });
    } else {
      // The matrix's alpha row ignores source alpha, which would paint opaque boxes
      // over every transparent area (and turn soft shadows into solid halos).
      add('feComposite', { 'in': 'ddm', in2: 'SourceAlpha', operator: 'in' });
    }
    return f;
  }
  function rebuildFilters(m) {
    if (!svgEl) return;
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    const defs = document.createElementNS(SVGNS, 'defs');
    defs.appendChild(makeFilter('dd-f-ui',   !!(S.ui   && S.ui.invert),   true,                         m.ui));
    defs.appendChild(makeFilter('dd-f-pop',  !!(S.ui   && S.ui.invert),   true,                         m.pop));
    defs.appendChild(makeFilter('dd-f-page', !!(S.page && S.page.invert), !!(S.page && S.page.keepHues), m.page, !!(S.page && S.page.keepColors)));
    svgEl.appendChild(defs);
  }

  function mount() {
    const root = document.documentElement;
    if (!root) return false;
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'dd-style'; }
    if (!svgEl) {
      svgEl = document.createElementNS(SVGNS, 'svg');
      svgEl.id = 'dd-svg';
      svgEl.setAttribute('width', '0');
      svgEl.setAttribute('height', '0');
      svgEl.setAttribute('aria-hidden', 'true');
      svgEl.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    }
    if (!hostEl) {
      hostEl = document.createElement('div');
      hostEl.id = 'dd-bg';
      hostEl.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;';
      engine = DDBg.create(hostEl);
      if (window.DDLayers) lengine = window.DDLayers.create(hostEl);
      bgSig = ''; lastSrc = '';
    }
    [styleEl, svgEl, hostEl].forEach(n => { if (n && !n.isConnected) root.appendChild(n); });
    mounted = true;
    return true;
  }

  const validSel = (list) => list.filter(x => {
    try { document.createDocumentFragment().querySelector(x); return true; }
    catch (e) { return false; }
  });
  const seen = new WeakMap();
  const parseColor = (bg) => {
    const m = String(bg).match(/^rgba?\(([^)]+)\)$/i);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || !p.slice(0, 3).every(Number.isFinite)) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 && Number.isFinite(p[3]) ? p[3] : 1 };
  };
  const nameOf = (el) => {
    try {
      const cn = el.className;
      const s = (typeof cn === 'string' && cn.trim())
        ? '.' + cn.trim().split(/\s+/).join('.') : '';
      return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + s;
    } catch (e) { return el.tagName || '?'; }
  };


  // Tag only the outermost UI matches; never tag anything that contains the page.
  const PAGE_SAFE = '.kix-appview-editor, .kix-page-paginated, .kix-page, .kix-canvas-tile-content, #dd-bg';
  const PROTECT = '.docs-companion-app-switcher-container'; // side-panel app icons: left unfiltered so they keep their colors
  const INSIDE_PAGE = '.kix-page-paginated, .kix-page, .kix-canvas-tile-content';
  let tagTimer = 0, lastTag = 0;
  function clearTags() {
    document.querySelectorAll('[data-dd-ui],[data-dd-pop]').forEach(el => { el.removeAttribute('data-dd-ui'); el.removeAttribute('data-dd-pop'); });
  }
  function tagUi() {
    tagTimer = 0; lastTag = Date.now();
    if (!S || !mounted || !isActive(S)) return;
    if (isHomePage() || !document.getElementById('docs-editor')) { clearTags(); return; }   // home page: plain CSS filter on <body>
    try {
      const sel = S.selectors || {};
      const popSel = validSel(lines(sel.menus)).join(',');
      const all = validSel(lines(sel.ui).concat(lines(sel.menus))).join(',');
      if (!all) return;
      const matched = new Set(document.querySelectorAll(all));

      // Elements that CONTAIN the page / the protected side panel (computed once, not per element).
      const pageChain = new Set(), protectChain = new Set();
      document.querySelectorAll(PAGE_SAFE).forEach(n => { for (let a = n.parentElement; a; a = a.parentElement) pageChain.add(a); });
      document.querySelectorAll(PROTECT).forEach(n => { for (let a = n.parentElement; a; a = a.parentElement) protectChain.add(a); });

      const keep = [];
      matched.forEach(el => {
        if (el.id === 'dd-bg' || el.id === 'dd-svg' || el.id === 'dd-style') return;
        if (pageChain.has(el) || protectChain.has(el)) return;          // would double-invert the page / lose side-panel colors
        if (el.closest(PROTECT) || el.closest(INSIDE_PAGE)) return;
        if (!el.firstElementChild && !el.textContent.trim()) return;     // empty leaf: nothing to theme
        for (let a = el.parentElement; a; a = a.parentElement) {         // a filtered ancestor already covers it
          if (matched.has(a) && !pageChain.has(a) && !protectChain.has(a)) return;
        }
        keep.push(el);
      });
      const keepSet = new Set(keep);
      document.querySelectorAll('[data-dd-ui],[data-dd-pop]').forEach(el => {
        if (!keepSet.has(el)) { el.removeAttribute('data-dd-ui'); el.removeAttribute('data-dd-pop'); }
      });
      keep.forEach(el => {
        const isPopup = el.parentElement === document.body && !!popSel && el.matches(popSel);
        const want = isPopup ? 'data-dd-pop' : 'data-dd-ui', other = isPopup ? 'data-dd-ui' : 'data-dd-pop';
        if (!el.hasAttribute(want)) el.setAttribute(want, '');
        el.removeAttribute(other);
      });
    } catch (e) { console.error('[Docs Afterglow] tagUi failed:', e); }
  }
  // Throttled: at most one pass per 400 ms, however busy Docs is.
  function scheduleTag() {
    if (tagTimer) return;
    tagTimer = setTimeout(tagUi, Math.max(120, 400 - (Date.now() - lastTag)));
  }

  function autoClear() {
    if (!S || !S.autoClear || !hostEl || !isActive(S) || document.hidden) return;
    const home = isHomePage();
    const sel = S.selectors || {};
    // On the home page the editor's selector lists don't apply (and some are broad), so only protect media.
    const skipList = (home ? [] : validSel(
      lines(sel.ui).concat(lines(sel.menus), lines(sel.pageBg), lines(sel.pageCanvas))
    )).concat([
      '#dd-bg', '#dd-svg', '#dd-style', 'canvas', 'img', 'video',
      '[data-dd-ui]', '[data-dd-pop]',   // (not [data-dd-clear]: closest() would then skip everything inside a cleared container)
      '[class*="modal-dialog-bg"]', '[role="dialog"]'
    ]);
    const skip = skipList.filter(Boolean).join(',');
    if (!skip) return;

    const W = window.innerWidth, H = window.innerHeight, now = Date.now();
    const pts = [];
    const gx = home ? [0.03, 0.15, 0.3, 0.5, 0.7, 0.85, 0.97] : [0.03, 0.2, 0.5, 0.8, 0.97];
    const gy = home ? [0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 0.97] : [0.2, 0.4, 0.6, 0.8, 0.97];
    gx.forEach(fx => gy.forEach(fy => pts.push([W * fx, H * fy])));
    if (home) [14, 30, 46, 62, 78].forEach(y => [0.1, 0.25, 0.4, 0.55, 0.7, 0.9].forEach(fx => pts.push([W * fx, y])));   // header row (search box)
    [0.3, 0.9].forEach(fx => { for (let y = 60; y <= 260; y += 6) pts.push([W * fx, y]); });
    [0.5, 0.75].forEach(fy => { for (let x = 2; x <= 30; x += 4) pts.push([x, H * fy]); });

    pts.forEach(pt => {
      let stack = [];
      try { stack = document.elementsFromPoint(pt[0], pt[1]); }
      catch (e) { return; }
      stack.forEach(el => {
        if (el === document.documentElement || el === document.body) return;
        if (el.hasAttribute('data-dd-clear') || el.hasAttribute('data-dd-hs') || el.hasAttribute('data-dd-ui')) return;
        if (now - (seen.get(el) || 0) < 10000) return;
        try { if (el.closest(skip)) return; } catch (e) { return; }
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) { seen.set(el, now); return; }
        const big   = home ? (r.width * r.height >= W * H * 0.04 && r.width >= W * 0.2)
                           : (r.width >= W * 0.25 && r.height >= H * 0.12);
        const strip = (r.width  >= W * 0.6 && r.height >= 6 && r.height < H * 0.12) ||
                      (r.height >= H * 0.5 && r.width  >= 6 && r.width  < W * 0.25);
        const small = home && !big && r.width >= 24 && r.height >= 16;   // cards, search box, chips
        if (!big && !strip && !small) { seen.set(el, now); return; }
        let style = null;
        try { style = getComputedStyle(el); } catch (e) { return; }
        const col = parseColor(style.backgroundColor);
        seen.set(el, now);
        if (!col || col.a < 0.1) return;
        // Home page: only light panels need clearing (they would turn into dark boxes after the invert).
        if (home && S.ui.invert && (0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b) / 255 < 0.5) return;
        if (small) {
          el.setAttribute('data-dd-hs', '');            // raised surface in the theme's colors (instead of a black box)
        } else if (big) {
          el.setAttribute('data-dd-clear', '');
          console.debug('[Docs Afterglow] cleared', nameOf(el));
        }
      });
    });
  }

  function teardown() {
    if (!mounted) return;
    mounted = false;
    try { document.documentElement.removeAttribute('data-dd-home'); } catch (e) { /* ignore */ }
    try {
      document.querySelectorAll('[data-dd-clear],[data-dd-hs],[data-dd-ui],[data-dd-pop]').forEach(el => {
        el.removeAttribute('data-dd-clear');
        el.removeAttribute('data-dd-hs');
        el.removeAttribute('data-dd-ui');
        el.removeAttribute('data-dd-pop');
      });
    } catch (e) { /* ignore */ }
    if (styleEl) { styleEl.remove(); styleEl = null; }
    if (svgEl)   { svgEl.remove();   svgEl   = null; }
    if (hostEl)  { hostEl.remove();  hostEl  = null; }
    if (engine)  { try { engine.destroy(); } catch (e) { /* ignore */ } engine = null; }
    if (lengine) { try { lengine.destroy(); } catch (e) { /* ignore */ } lengine = null; }
    bgSig = ''; filterSig = ''; lastSrc = '';
  }

  function apply() {
    if (!S) return;
    try {
      const home = isHomePage();
      if (!isActive(S) || (home && S.home && S.home.enabled === false)) { teardown(); return; }
      if (!mount()) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', apply, { once: true });
        } else {
          setTimeout(apply, 50);
        }
        return;
      }

      if (home) document.documentElement.setAttribute('data-dd-home', '');
      else document.documentElement.removeAttribute('data-dd-home');

      const m   = DD.matrices(S) || {};
      const css = buildCSS(S, m);
      if (styleEl.textContent !== css) styleEl.textContent = css;

      const fsig = [m.ui, m.pop, m.page, S.ui.invert, S.page.invert, S.page.keepHues, S.page.keepColors].join('|');
      if (fsig !== filterSig) { filterSig = fsig; rebuildFilters(m); }

      const src = (S.bg && S.bg.type === 'image') ? (img || S.bg.imageUrl || '') : '';
      const isLayers = !!(S.bg && S.bg.type === 'layers' && lengine);
      const bsig = JSON.stringify(S.bg || {}) + (isLayers ? '|' + assetsVer : '');
      if (engine && (bsig !== bgSig || src !== lastSrc)) {
        bgSig = bsig; lastSrc = src;
        if (isLayers) {
          engine.update({ type: 'solid', colors: [(S.bg.colors && S.bg.colors[0]) || '#000000'] }, '');
          lengine.update(S.bg, assets);
        } else {
          engine.update(S.bg, src);
          if (lengine) lengine.update({ layers: [] }, assets);
        }
      }

      const json = JSON.stringify(S);
      if (json !== lastCached) {
        try { localStorage.setItem(CACHE, json); lastCached = json; }
        catch (e) { /* quota / privacy mode */ }
      }

      scheduleTag();
      [300, 1200, 3500].forEach(ms => setTimeout(autoClear, ms));
    } catch (e) {
      console.error('[Docs Afterglow] apply failed:', e);
    }
  }

  // Apply the cached theme synchronously to avoid a white flash on load.
  try {
    const c = localStorage.getItem(CACHE);
    if (c) { S = DD.normalize(JSON.parse(c)); apply(); }
  } catch (e) { /* corrupt cache — ignore */ }

  if (API) {
    API.storage.local.get(['ddSettings', 'ddImage', 'ddAssets']).then(r => {
      assets = r.ddAssets || {}; assetsVer++;
      S = DD.normalize(r.ddSettings);
      img = r.ddImage || '';
      apply();
    }).catch(e => console.warn('[Docs Afterglow] storage.get failed:', e));

    API.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local') return;
      if (ch.ddSettings) {
        try { S = DD.normalize(ch.ddSettings.newValue); }
        catch (e) { return; }
      }
      if (ch.ddImage) img = ch.ddImage.newValue || '';
      if (ch.ddAssets) { assets = ch.ddAssets.newValue || {}; assetsVer++; }
      apply();
    });
  }

  // Re-attach our nodes if Docs rewrites <html>, and re-evaluate schedules.
  try {
    new MutationObserver(() => {
      if (S && styleEl && isActive(S) && !styleEl.isConnected) apply();
    }).observe(document, { childList: true });
  } catch (e) { /* ignore */ }

  // Menus/dialogs are created on demand: re-tag when the DOM changes. Changes inside the editor
  // itself (typing, caret, selection) can never create UI, so they are ignored.
  function watchDom() {
    if (!document.body) return setTimeout(watchDom, 100);
    new MutationObserver((muts) => {
      if (!S || !mounted || document.hidden) return;
      for (const m of muts) {
        const t = m.target;
        if (!t || t.nodeType !== 1) continue;
        if (t.id && /^dd-/.test(t.id)) continue;
        if (t.closest && t.closest('.kix-appview-editor, .kix-page-paginated, #dd-bg')) continue;
        return scheduleTag();
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  watchDom();

  // Navigation without a reload (home <-> editor) and schedule changes.
  let lastPath = location.pathname;
  setInterval(() => {
    if (!S || document.hidden) return;
    if (location.pathname !== lastPath) { lastPath = location.pathname; apply(); }
  }, 1500);
  setInterval(() => { if (S && !document.hidden) apply(); }, 30000);
  setInterval(autoClear, 3500);
  window.addEventListener('resize', () => setTimeout(autoClear, 250), { passive: true });
  window.addEventListener('popstate', () => { if (S) apply(); });
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq) {
      if (mq.addEventListener) mq.addEventListener('change', () => { if (S) apply(); });
      else if (mq.addListener) mq.addListener(() => { if (S) apply(); });
    }
  } catch (e) { /* ignore */ }
})();
