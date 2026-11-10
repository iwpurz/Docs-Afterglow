(function (root) {
  'use strict';

  const SEL = {
    ui: [
      '#docs-chrome',
      '#docs-bars',
      '#docs-additional-bars',
      '#docs-toolbar-wrapper',
      '#docs-titlebar',
      '#docs-header',
      '#docs-menubar',
      '#docs-toolbar',

      '.left-sidebar-container',
      '.companion-app-switcher-container',
      '.companion-guest-app-switcher',
      '.docs-sidebar',
      '.docs-sidepanel',
      '.docs-embedded-app',
      '.docs-keep-panel',
      '.docs-calendar-panel',
      '.docs-tasks-panel',
      '.docs-explore-widget',
      '.docs-explore-sidebar',
      '.docs-outline',
      '.docs-outline-content',

      '#kix-horizontal-ruler-container',
      '#kix-vertical-ruler-container',

      // Google Slides (beta): film strip and speaker notes
      '#filmstrip',
      '.filmstrip',
      '#filmstrip-controls',
      '.punch-filmstrip-controls',
      '.docs-ruler',
      '[class*="ruler" i]',
      '[id*="ruler" i]',
      '.punch-filmstrip-container',
      '.punch-filmstrip',
      '[id*="speakernotes" i]',
      '.punch-viewer-speakernotes-page',

      '.goog-menu',
      '.goog-submenu',
      '.goog-menu-button',
      '.goog-menu-button-dropdown',
      '.goog-toolbar-menu-button',
      '.goog-toolbar-combo-button',
      '.goog-menuitem',
      '.goog-menuitem-content',
      '.goog-menuheader',
      '.goog-menuseparator',

      '.docs-material-menu',
      '.docs-material',
      '.docs-colormenuitems',
      '.docs-colorpalette',
      '.docs-font-menu',
      '.docs-font-size-menu',
      '.docs-menu',
      '.docs-dropdown',
      '.docs-material-dropdown',

      '[role="menubar"]',
      '[role="menu"]',
      '[role="menuitem"]',
      '[role="listbox"]',
      '[role="option"]',
      '[role="combobox"]',
      '[role="tree"]',
      '[role="treeitem"]',

      'body > .goog-modalpopup',
      'body > .modal-dialog',
      'body > .jfk-bubble',
      '.goog-modalpopup',
      '.goog-modalpopup-bg',
      '.modal-dialog',
      '.docs-material-dialog',
      '.docs-dialog',
      '.docs-dialog-bg',
      '.docs-dialog-container',
      '.docs-aria-dialog',
      '.docs-alert-dialog',
      '.docs-confirmation-dialog',
      '.document-details-bubble-container',

      '[role="dialog"]',
      '[role="alertdialog"]',
      '[aria-modal="true"]',

      '.jfk-bubble',
      '.goog-tooltip',
      '.docs-tooltip',
      '.docs-material-tooltip',
      '.docs-bubble',
      '.docs-link-bubble',
      '.docs-linkbubble',
      '.goog-popover',
      '.docs-popover',
      '.docs-material-popover',
      '[role="tooltip"]',
      '[role="popover"]',

      '.docs-print-preview',
      '.docs-findbar',
      '.docs-findbar-container',
      '.docs-find-replace-dialog',

      '.docs-comment-bubble',
      '.docs-comment-thread',
      '.docs-commentbox',
      '.docs-annotation',

      '.docs-palette',
      '.docs-color-picker',
      '.docs-date-picker',
      '.docs-time-picker',
      '.docs-emoji-picker',
      '.docs-symbol-picker',

      '.docs-notification',
      '.docs-toast',
      '.docs-snackbar',
      '[role="alert"]',
      '[role="status"]',

      '[class*="popup" i]',
      '[class*="pop-up" i]',
      '[class*="dialog" i]',
      '[class*="popover" i]',
      '[class*="tooltip" i]',
      '[class*="dropdown" i]',
      '[class*="palette" i]',
      '[class*="overlay" i]',
      '[class*="flyout" i]',
      '[class*="color-picker" i]',
      '[class*="colorpicker" i]',
      '[class*="bubble" i]'
    ].join('\n'),

    menus: [
      '.goog-menu',
      '.goog-submenu',
      '.docs-material-menu',
      '.docs-colormenuitems',
      '.docs-colorpalette',
      '.docs-font-menu',
      '.docs-font-size-menu',
      '.docs-menu',
      '.docs-dropdown',
      '.docs-material-dropdown',

      '[role="menu"]',
      '[role="listbox"]',
      '[role="tree"]',
      '[role="dialog"]',
      '[role="alertdialog"]',
      '[role="tooltip"]',
      '[role="popover"]',
      '[aria-modal="true"]',

      '.goog-modalpopup',
      '.modal-dialog',
      '.jfk-bubble',
      '.goog-tooltip',
      '.document-details-bubble-container',

      '[class*="menu" i]:not([class*="menuitem" i]):not([class*="menu-button" i]):not([class*="menubutton" i]):not([role="menuitem"])',
      '[class*="dropdown" i]',
      '[class*="palette" i]',
      '[class*="color-picker" i]',
      '[class*="colorpicker" i]',
      '[class*="popup" i]',
      '[class*="pop-up" i]',
      '[class*="popover" i]',
      '[class*="tooltip" i]',
      '[class*="dialog" i]',
      '[class*="overlay" i]',
      '[class*="flyout" i]',
      '[class*="context-menu" i]',
      '[class*="contextmenu" i]',
      '[class*="bubble" i]'
    ].join('\n'),

    workspace: [
      '.kix-appview-editor',
      '#docs-editor',
      '#docs-editor-container',
      '#kix-appview',
      '.docs-editor-container',
      '.kix-appview-editor-container',
      '#workspace',
      '#workspace-container'
    ].join('\n'),

    pageCanvas: [
      '.kix-page-paginated canvas',
      '.kix-canvas-tile-content'
    ].join('\n'),

    pageBg: [
      '.kix-page-paginated',
      '.kix-page'
    ].join('\n')
  };

  const DEFAULTS = {
    v: 6,
    enabled: true,
    schedule: { mode: 'always', from: '19:00', to: '07:00' },
    ui: { invert: true, bg: '#171a21', text: '#e3e6ec', opacity: 100, protectImages: true },
    page: {
      invert: true, keepHues: true, keepColors: true, bg: '#1c1f27', bg2: '#262b3a', type: 'solid', angle: 160,
      opacity: 100, text: '#e8eaed', tint: 100, brightness: 100, blend: 'auto', crisp: false
    },
    accent: '#8ab4f8',
    caret: '#ffffff',
    selection: '#4c6ef5',
    selectionAlpha: 45,
    scrollbars: true,
    autoClear: true,
    home: { enabled: true, opacity: 82 },
    themeVibe: true,
    fx: { enabled: false, kind: 'fadein', intensity: 50, color: 'accent', combo: true },
    sound: { enabled: false, kind: 'soft', volume: 40, pitch: true, special: true, release: true },
    music: { enabled: false, volume: 30, activeTabOnly: true, source: 'link', link: '', shuffle: false },
    bg: {
      type: 'gradient', colors: ['#0b0d12', '#161a2e'], angle: 160, speed: 50, intensity: 70,
      density: 50, fxColor: '#8ab4f8', imageUrl: '', imageFit: 'cover', imageBlur: 0,
      imageDim: 35, animate: true, fps: 30
    },
    selectors: { ui: SEL.ui, menus: SEL.menus, workspace: SEL.workspace, pageCanvas: SEL.pageCanvas, pageBg: SEL.pageBg },
    customCSS: '/* Tells Google Keep/Calendar iframes to use native dark mode */\niframe { color-scheme: dark !important; }',
    userPresets: {}
  };

  const KEEP = ['enabled', 'schedule', 'selectors', 'customCSS', 'userPresets', 'themeVibe', 'fx', 'sound', 'music'];

  const BG_TYPES = [
    ['solid', 'Solid color'],
    ['gradient', 'Gradient'],
    ['animated-gradient', 'Animated gradient'],
    ['aurora', 'Aurora'],
    ['stars', 'Starfield'],
    ['matrix', 'Matrix rain'],
    ['network', 'Neon network'],
    ['plasma', 'Plasma'],
    ['image', 'Image / GIF'],
    ['layers', 'Layers (made in Studio)']
  ];

  function bgTypesFor(S) {
    const hasLayers = !!(S && S.bg && (S.bg.type === 'layers' || (Array.isArray(S.bg.layers) && S.bg.layers.length)));
    return BG_TYPES.filter(function (t) { return t[0] !== 'layers' || hasLayers; });
  }

  function clone(o) {
    if (o === undefined) return undefined;
    return JSON.parse(JSON.stringify(o));
  }
  function isObj(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }
  function merge(t, s) {
    if (!isObj(s) || s === t) return t;
    Object.keys(s).forEach(function (k) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;   // prototype-pollution guard
      const sv = s[k], tv = t[k];
      if (isObj(sv) && isObj(tv)) merge(tv, sv);
      else if (Array.isArray(sv) || isObj(sv)) t[k] = clone(sv);
      else t[k] = sv;
    });
    return t;
  }
  // ---- validation ---------------------------------------------------------
  // Everything read from storage, from the page-origin cache, or from an imported file goes through
  // sanitize(). Values end up inside generated CSS and SVG, so only well-formed colors, numbers and
  // whitelisted keywords are allowed through; anything else falls back to the default.
  const HEX6 = /^#[0-9a-f]{6}$/i;
  const ENUMS = {
    schedule: ['always', 'system', 'time'],
    pageType: ['solid', 'gradient'],
    blend: ['auto', 'normal', 'screen', 'lighten', 'multiply', 'overlay', 'soft-light', 'plus-lighter'],
    imageFit: ['cover', 'contain', 'fill'],
    fxKind: ['fadein', 'fadeout', 'sparks', 'ripple', 'confetti', 'embers', 'stardust', 'hearts', 'glow', 'petals', 'snow', 'bubbles', 'notes', 'leaves', 'pixels', 'fireflies', 'flames', 'glyphs', 'shockwave'],
    fxColor: ['accent', 'rainbow', 'theme', 'white'],
    soundKind: ['soft', 'thock', 'clicky', 'typewriter', 'pencil', 'wood', 'kalimba', 'koto', 'glass', 'synthpluck', 'drops', 'piano', 'marimba'],
    musicSource: ['link', 'files']
  };
  const str = (v, d, max) => (typeof v === 'string' ? v.slice(0, max || 200) : d);
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);
  const nnum = (v, lo, hi, d) => { const n = +v; return (typeof v !== 'object' && v !== '' && Number.isFinite(n)) ? Math.max(lo, Math.min(hi, n)) : d; };
  const oneOf = (v, list, d) => (typeof v === 'string' && list.indexOf(v) >= 0 ? v : d);
  function color(v, d) {
    if (typeof v !== 'string') return d;
    v = v.trim();
    if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + v.slice(1).split('').map(function (c) { return c + c; }).join('').toLowerCase();
    return HEX6.test(v) ? v.toLowerCase() : d;
  }

  // Custom CSS: remove everything that could load something from the network or run script-like
  // constructs. CSS escapes (\75 rl) are decoded first so they cannot hide a forbidden word.
  function decodeEsc(t) {
    return t.replace(/\\([0-9a-f]{1,6})[ \t\n\r\f]?/gi, function (_, h) {
      const n = parseInt(h, 16);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }).replace(/\\([^\n])/g, '$1');
  }
  const BAD_CSS = [
    /@import\b[^;]*;?/gi, /@charset\b[^;]*;?/gi, /@namespace\b[^;]*;?/gi, /@font-face\b[^{]*\{[^}]*\}/gi,
    /expression\s*\([^)]*\)/gi, /-moz-binding\s*:[^;}]*/gi, /behavior\s*:[^;}]*/gi, /javascript\s*:/gi,
    /(?:image-set|src|-webkit-image-set)\s*\([^)]*\)/gi
  ];
  const URL_RE = /url\(\s*(["']?)([^)"']*)\1\s*\)/gi;
  const URL_OK = /^(#[\w-]+|data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+\/=]+)$/i;
  function cleanCSS(t) {
    t = str(t, '', 60000);
    if (!t) return '';
    const plain = t.replace(/\/\*[\s\S]*?\*\//g, '');
    const dec = decodeEsc(plain);
    let out = (dec !== plain) ? dec : t;
    BAD_CSS.forEach(function (re) { out = out.replace(re, '/* removed */'); });
    out = out.replace(URL_RE, function (m, q, u) { return URL_OK.test(u.trim()) ? m : 'none'; });
    return out;
  }

  function cleanLayerValue(v, depth) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return /[;{}<>\\]|url\(|expression|javascript:/i.test(v) ? '' : v.slice(0, 200);
    if (Array.isArray(v) && depth < 2) return v.slice(0, 12).map(function (x) { return cleanLayerValue(x, depth + 1); });
    return undefined;
  }
  function cleanLayers(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    list.slice(0, 60).forEach(function (L) {
      if (!isObj(L)) return;
      const o = {};
      Object.keys(L).slice(0, 80).forEach(function (k) {
        if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) return;
        if (k === 'url') {                                   // remote media: plain http(s) links only
          if (typeof L[k] === 'string' && /^https?:\/\/[^\s"'<>\\]{1,1000}$/i.test(L[k])) o[k] = L[k];
          return;
        }
        if (k === 'name') { o[k] = str(L[k], '', 60); return; }   // labels are shown as plain text, never as CSS
        const c = cleanLayerValue(L[k], 0);
        if (c !== undefined) o[k] = c;
      });
      if (typeof o.type === 'string') out.push(o);
    });
    return out;
  }

  // Turns a pasted music link into something playable. Only YouTube, Spotify and SoundCloud links (shown in a small
  // player) and direct https audio files are accepted; everything else is rejected.
  function parseMusicLink(raw) {
    const none = { kind: 'none' };
    if (typeof raw !== 'string' || raw.length > 500) return none;
    let u;
    try { u = new URL(raw.trim()); } catch (e) { return none; }
    if (u.protocol !== 'https:') return none;
    const h = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
    const parts = u.pathname.split('/').filter(Boolean);
    const VID = /^[\w-]{6,20}$/, LST = /^[\w-]{10,64}$/;
    if (h === 'youtube.com' || h === 'music.youtube.com' || h === 'youtube-nocookie.com' || h === 'youtu.be') {
      let id = h === 'youtu.be' ? parts[0] : u.searchParams.get('v');
      if (!id && (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live')) id = parts[1];
      const list = u.searchParams.get('list') || '';
      const okId = typeof id === 'string' && VID.test(id) ? id : '';
      if (LST.test(list)) return { kind: 'youtube', id: okId, list, label: 'YouTube playlist' };
      if (okId) return { kind: 'youtube', id: okId, list: '', label: 'YouTube video' };
      return none;
    }
    if (h === 'open.spotify.com') {
      const types = ['track', 'album', 'playlist', 'episode', 'show', 'artist'];
      const i = parts.findIndex(function (x) { return types.indexOf(x) >= 0; });
      if (i >= 0 && /^[A-Za-z0-9]{10,30}$/.test(parts[i + 1] || '')) return { kind: 'spotify', type: parts[i], id: parts[i + 1], label: 'Spotify ' + parts[i] };
      return none;
    }
    if ((h === 'soundcloud.com' || h === 'on.soundcloud.com') && parts.length >= 1) {
      return { kind: 'soundcloud', url: u.origin + u.pathname, label: 'SoundCloud' };
    }
    if (/\.(mp3|ogg|oga|opus|wav|m4a|aac|flac|webm)$/i.test(u.pathname)) return { kind: 'audio', url: u.href, label: 'Audio file' };
    return none;
  }

  // A "vibe" is the typing effect, typing sound and music a theme brings along. It never contains the on/off
  // switches: a theme can change WHICH sound plays, but never turns sound or music on by itself.
  function cleanVibe(v) {
    if (!isObj(v)) return undefined;
    const o = {};
    if (isObj(v.fx)) o.fx = { kind: oneOf(v.fx.kind, ENUMS.fxKind, 'fadein'), color: oneOf(v.fx.color, ENUMS.fxColor, 'accent'),
                              intensity: nnum(v.fx.intensity, 0, 100, 50), combo: bool(v.fx.combo, true) };
    if (isObj(v.sound)) o.sound = { kind: oneOf(v.sound.kind, ENUMS.soundKind, 'soft'), volume: nnum(v.sound.volume, 0, 100, 40),
                                    pitch: bool(v.sound.pitch, true), special: bool(v.sound.special, true), release: bool(v.sound.release, true) };
    if (isObj(v.music)) {
      const link = str(v.music.link, '', 500).trim();
      if (parseMusicLink(link).kind !== 'none') o.music = { link: link, volume: nnum(v.music.volume, 0, 100, 30), shuffle: false };
    }
    return Object.keys(o).length ? o : undefined;
  }
  function vibeOf(S) {
    if (!isObj(S)) return undefined;
    const o = {};
    if (isObj(S.fx)) o.fx = { kind: S.fx.kind, color: S.fx.color, intensity: S.fx.intensity, combo: S.fx.combo };
    if (isObj(S.sound)) o.sound = { kind: S.sound.kind, volume: S.sound.volume, pitch: S.sound.pitch, special: S.sound.special, release: S.sound.release };
    if (isObj(S.music) && S.music.link) o.music = { link: S.music.link, volume: S.music.volume, shuffle: false };
    return cleanVibe(o);
  }
  function applyVibe(S, vibe) {
    const v = cleanVibe(vibe);
    if (!v || !isObj(S) || S.themeVibe === false) return S;
    if (v.fx) { S.fx = Object.assign(S.fx || {}, v.fx); }
    if (v.sound) { S.sound = Object.assign(S.sound || {}, v.sound); }
    if (v.music) { S.music = Object.assign(S.music || {}, { link: v.music.link, source: 'link', volume: v.music.volume }); }
    return S;
  }

  function sanitize(s) {
    const D = DEFAULTS, o = {};
    const sch = isObj(s.schedule) ? s.schedule : {}, ui = isObj(s.ui) ? s.ui : {}, pg = isObj(s.page) ? s.page : {};
    const hm = (v, d) => (typeof v === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);
    o.v = D.v;
    o.enabled = bool(s.enabled, D.enabled);
    o.schedule = { mode: oneOf(sch.mode, ENUMS.schedule, 'always'), from: hm(sch.from, D.schedule.from), to: hm(sch.to, D.schedule.to) };
    o.ui = { invert: bool(ui.invert, D.ui.invert), bg: color(ui.bg, D.ui.bg), text: color(ui.text, D.ui.text),
             opacity: nnum(ui.opacity, 0, 100, 100), protectImages: bool(ui.protectImages, true) };
    o.page = {
      invert: bool(pg.invert, true), keepHues: bool(pg.keepHues, true), keepColors: bool(pg.keepColors, true), crisp: bool(pg.crisp, false),
      bg: color(pg.bg, D.page.bg), bg2: color(pg.bg2, D.page.bg2), text: color(pg.text, D.page.text),
      type: oneOf(pg.type, ENUMS.pageType, 'solid'), angle: nnum(pg.angle, 0, 360, 160), opacity: nnum(pg.opacity, 0, 100, 100),
      tint: nnum(pg.tint, 0, 100, 100), brightness: nnum(pg.brightness, 20, 200, 100), blend: oneOf(pg.blend, ENUMS.blend, 'auto')
    };
    o.accent = color(s.accent, D.accent); o.caret = color(s.caret, D.caret); o.selection = color(s.selection, D.selection);
    o.selectionAlpha = nnum(s.selectionAlpha, 0, 100, D.selectionAlpha);
    o.scrollbars = bool(s.scrollbars, true); o.autoClear = bool(s.autoClear, true);
    const hm2 = isObj(s.home) ? s.home : {};
    o.home = { enabled: bool(hm2.enabled, true), opacity: nnum(hm2.opacity, 0, 100, 82) };

    const b = isObj(s.bg) ? s.bg : {};
    const types = BG_TYPES.map(function (t) { return t[0]; });
    const cols = (Array.isArray(b.colors) ? b.colors : []).slice(0, 8).map(function (c) { return color(c, null); }).filter(Boolean);
    o.bg = {
      type: oneOf(b.type, types, 'gradient'), colors: cols.length ? cols : ['#000000'],
      angle: nnum(b.angle, 0, 360, 160), speed: nnum(b.speed, 0, 100, 50), intensity: nnum(b.intensity, 0, 100, 70),
      density: nnum(b.density, 0, 100, 50), fxColor: color(b.fxColor, D.bg.fxColor),
      imageUrl: (typeof b.imageUrl === 'string' && /^https?:\/\/[^\s"'<>\\]{1,2000}$/i.test(b.imageUrl)) ? b.imageUrl : '',
      imageFit: oneOf(b.imageFit, ENUMS.imageFit, 'cover'), imageBlur: nnum(b.imageBlur, 0, 40, 0), imageDim: nnum(b.imageDim, 0, 90, 35),
      animate: bool(b.animate, true), fps: nnum(b.fps, 5, 60, 30)
    };
    if (Array.isArray(b.layers)) o.bg.layers = cleanLayers(b.layers);

    const sel = isObj(s.selectors) ? s.selectors : {};
    o.selectors = {};
    Object.keys(D.selectors).forEach(function (k) { o.selectors[k] = str(sel[k], D.selectors[k], 20000); });
    o.customCSS = cleanCSS(s.customCSS);

    const fx = isObj(s.fx) ? s.fx : {}, so = isObj(s.sound) ? s.sound : {}, mu = isObj(s.music) ? s.music : {};
    o.themeVibe = bool(s.themeVibe, true);
    if (isObj(s.vibe)) { const vb = cleanVibe(s.vibe); if (vb) o.vibe = vb; }
    o.fx = { enabled: bool(fx.enabled, false), kind: oneOf(fx.kind, ENUMS.fxKind, 'fadein'), intensity: nnum(fx.intensity, 0, 100, 50),
             color: oneOf(fx.color, ENUMS.fxColor, 'accent'), combo: bool(fx.combo, true) };
    o.sound = { enabled: bool(so.enabled, false), kind: oneOf(so.kind, ENUMS.soundKind, 'soft'), volume: nnum(so.volume, 0, 100, 40),
                pitch: bool(so.pitch, true), special: bool(so.special, true), release: bool(so.release, true) };
    const link = str(mu.link, '', 500).trim();
    o.music = { enabled: bool(mu.enabled, false), volume: nnum(mu.volume, 0, 100, 30), activeTabOnly: bool(mu.activeTabOnly, true),
                source: oneOf(mu.source, ENUMS.musicSource, 'link'), link: parseMusicLink(link).kind === 'none' ? '' : link, shuffle: bool(mu.shuffle, false) };

    o.userPresets = {};
    if (isObj(s.userPresets)) {
      Object.keys(s.userPresets).slice(0, 100).forEach(function (n) {
        if (n === '__proto__' || !isObj(s.userPresets[n])) return;
        const p = sanitize(merge(clone(D), clone(s.userPresets[n])));
        KEEP.forEach(function (k) { delete p[k]; });
        delete p.v;
        o.userPresets[n.slice(0, 60)] = p;
      });
    }
    return o;
  }

  function normalize(x) {
    const src = isObj(x) ? clone(x) : {};
    // Settings saved by an older version carry old selector lists that would
    // override the current defaults forever; drop them once on upgrade.
    if ((+src.v || 0) < DEFAULTS.v) delete src.selectors;
    const merged = merge(clone(DEFAULTS), src);
    return sanitize(merged);
  }

  const clamp255 = (v) => {
    const n = +v;
    return Number.isFinite(n) ? Math.max(0, Math.min(255, Math.round(n))) : 0;
  };
  function hex(h) {
    if (Array.isArray(h)) return [clamp255(h[0]), clamp255(h[1]), clamp255(h[2])];
    h = String(h == null ? '#000000' : h).replace(/^#/, '');
    if (h.length === 3 || h.length === 4) {
      h = h.slice(0, 3).split('').map(function (c) { return c + c; }).join('');
    } else if (h.length === 8) {
      h = h.slice(0, 6); 
    } else {
      h = h.slice(0, 6); 
    }
    if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(h, a) {
    const c = hex(h);
    const al = Number.isFinite(+a) ? Math.max(0, Math.min(1, +a)) : 1;
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + al + ')';
  }

  const INVERT = '-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0';

  function remapMatrix(o) {
    const tint   = Number.isFinite(+o.tint)   ? +o.tint   : 1;
    const bright = Number.isFinite(+o.bright) ? +o.bright : 1;
    const rows = [];
    for (let c = 0; c < 3; c++) {
      const b = o.B[c] / 255, t = o.T[c] / 255;
      let lo, hi;
      if (o.invert) { lo = b; hi = ((1 - tint) + tint * t) * bright; }
      else { lo = tint * t * bright; hi = b; }
      const row = [0, 0, 0, 0, lo];
      row[c] = hi - lo;
      rows.push(row);
    }
    const u = Number.isFinite(+o.alpha) ? +o.alpha : 1;
    const w = [0.2126, 0.7152, 0.0722];
    let a = [0, 0, 0, 1, 0];
    if (u < 1) {
      a = o.invert
        ? [(1 - u) * w[0], (1 - u) * w[1], (1 - u) * w[2], 0, u]
        : [-(1 - u) * w[0], -(1 - u) * w[1], -(1 - u) * w[2], 0, 1];
    }
    rows.push(a);
    return rows.map((r) => r.map((n) => +n.toFixed(4)).join(' ')).join(' ');
  }

  function pageParams(S) {
    const p = (S && isObj(S.page)) ? S.page : DEFAULTS.page;
    let blend = p.blend || 'auto';
    const opaque = p.type === 'solid' && (+p.opacity >= 100);
    if (blend === 'auto') blend = opaque ? 'normal' : (p.invert ? 'screen' : 'multiply');
    const B = blend === 'normal' ? hex(p.bg) : (blend === 'multiply' ? [255, 255, 255] : [0, 0, 0]);
    return { blend, B };
  }

  function matrices(S) {
    const pp = pageParams(S);
    return {
      blend: pp.blend,
      ui:   remapMatrix({ B: hex(S.ui.bg),   T: hex(S.ui.text),   tint: 1, bright: 1, invert: S.ui.invert,   alpha: (+S.ui.opacity) / 100 }),
      pop:  remapMatrix({ B: hex(S.ui.bg),   T: hex(S.ui.text),   tint: 1, bright: 1, invert: S.ui.invert,   alpha: 1 }),
      page: remapMatrix({ B: pp.B,           T: hex(S.page.text), tint: (+S.page.tint) / 100, bright: (+S.page.brightness) / 100, invert: S.page.invert, alpha: 1 })
    };
  }

  function theme(o) {
    const inv = o.invert !== false;
    return {
      ui: {
        invert: inv,
        bg: o.ui,
        text: o.uiText,
        opacity: o.uiOpacity != null ? o.uiOpacity : 100
      },
      page: {
        invert: inv,
        bg: o.page,
        bg2: o.page2 != null ? o.page2 : o.page,
        type: o.page2 != null ? 'gradient' : 'solid',
        text: o.text,
        opacity: o.pageOpacity != null ? o.pageOpacity : 100,
        blend: 'auto'
      },
      accent: o.accent,
      caret: o.caret != null ? o.caret : o.text,
      bg: merge({ type: 'solid', colors: [o.ws] }, o.bg || {})
    };
  }

  const PRESETS = {
    'Midnight':    theme({ ws: '#0b0d12', ui: '#171a21', uiText: '#e3e6ec', page: '#1c1f27', text: '#e8eaed', accent: '#8ab4f8', bg: { type: 'gradient', colors: ['#0b0d12', '#161a2e'], angle: 160 } }),
    'AMOLED':      theme({ ws: '#000000', ui: '#090909', uiText: '#d6d6d6', page: '#000000', text: '#dedede', accent: '#7aa7ff' }),
    'Nord':        theme({ ws: '#242933', ui: '#2e3440', uiText: '#d8dee9', page: '#2e3440', text: '#eceff4', accent: '#88c0d0' }),
    'Dracula':     theme({ ws: '#1e1f29', ui: '#282a36', uiText: '#f8f8f2', page: '#282a36', text: '#f8f8f2', accent: '#bd93f9' }),
    'Mocha':       theme({ ws: '#11111b', ui: '#181825', uiText: '#cdd6f4', page: '#1e1e2e', text: '#cdd6f4', accent: '#cba6f7' }),
    'Solarized':   theme({ ws: '#00212b', ui: '#002b36', uiText: '#93a1a1', page: '#073642', text: '#eee8d5', accent: '#2aa198' }),
    'Lamplight':   theme({ ws: '#16120d', ui: '#1f1a13', uiText: '#e6d5b8', page: '#241d15', text: '#e9d8bb', accent: '#d9a441', caret: '#ffcf70' }),
    'Aurora':      theme({ ws: '#070b18', ui: '#0d1324', uiText: '#e6f1ff', uiOpacity: 80, page: '#0d1324', text: '#eaf4ff', pageOpacity: 84, accent: '#5eead4', bg: { type: 'aurora', colors: ['#070b18', '#00e5a8', '#7a5cff', '#ff4fd8'], speed: 45, intensity: 75 } }),
    'Synthwave':   theme({ ws: '#1a0b2e', ui: '#1d1033', uiText: '#ffe6fb', uiOpacity: 85, page: '#1d1033', text: '#fff0fb', pageOpacity: 86, accent: '#ff5fb7', bg: { type: 'animated-gradient', colors: ['#1a0b2e', '#ff2a95', '#2b7bff', '#7a00ff'], angle: 120, speed: 40 } }),
    'Matrix':      theme({ ws: '#020805', ui: '#05110a', uiText: '#b8ffd0', uiOpacity: 85, page: '#04100a', text: '#c9ffd8', pageOpacity: 82, accent: '#00ff66', bg: { type: 'matrix', colors: ['#020805', '#03140a'], fxColor: '#00ff66', speed: 55, intensity: 75, density: 40 } }),
    'Deep Space':  theme({ ws: '#05060f', ui: '#0b0e22', uiText: '#dfe8ff', uiOpacity: 85, page: '#0b0e22', text: '#e8eeff', pageOpacity: 84, accent: '#9db7ff', bg: { type: 'stars', colors: ['#05060f', '#0d1233'], angle: 180, fxColor: '#cfe0ff', speed: 30, density: 60, intensity: 85 } }),
    'Neon Network':theme({ ws: '#0a0a14', ui: '#10101e', uiText: '#e3f7ff', uiOpacity: 85, page: '#10101e', text: '#e8f8ff', pageOpacity: 86, accent: '#39e1ff', bg: { type: 'network', colors: ['#0a0a14', '#12123a'], angle: 150, fxColor: '#39e1ff', speed: 40, density: 50, intensity: 70 } }),
    'Plasma Glass':theme({ ws: '#0f0c29', ui: '#17133a', uiText: '#f1eaff', uiOpacity: 78, page: '#17133a', text: '#f3eeff', pageOpacity: 80, accent: '#ff7bd5', bg: { type: 'plasma', colors: ['#0f0c29', '#302b63', '#24243e', '#ff00cc'], speed: 35, intensity: 85 } }),
    'Paper Light': theme({ ws: '#e9e4d8', ui: '#f4f0e6', uiText: '#2b2823', page: '#fbf8f1', text: '#2b2823', accent: '#b4541a', caret: '#2b2823', invert: false })
  };

  function applyPreset(cur, p) {
    if (!isObj(p)) return normalize(cur);
    const n = merge(clone(DEFAULTS), clone(p));
    if (isObj(cur)) {
      KEEP.forEach(function (k) {
        if (k in cur) n[k] = clone(cur[k]);
      });
    }
    // A theme's own effect / sound / music replaces only the kind and level, never the on/off switches.
    if (isObj(p.vibe)) applyVibe(n, p.vibe);
    delete n.vibe;
    return n;
  }
  function snapshot(S) {
    const p = clone(S);
    KEEP.forEach(function (k) { delete p[k]; });
    const vb = vibeOf(S);
    if (vb) p.vibe = vb; else delete p.vibe;
    return p;
  }
  function swatch(full) {
    const f = isObj(full) ? full : DEFAULTS;
    const bgc = (f.bg && Array.isArray(f.bg.colors) && f.bg.colors.length) ? f.bg.colors[0] : '#000000';
    const uic = (f.ui && f.ui.bg) ? f.ui.bg : DEFAULTS.ui.bg;
    const pgc = (f.page && f.page.bg) ? f.page.bg : DEFAULTS.page.bg;
    return 'linear-gradient(135deg,' + bgc + ' 0 36%,' + uic + ' 36% 66%,' + pgc + ' 66% 100%)';
  }

  root.DD = {
    DEFAULTS, SEL, KEEP, BG_TYPES, PRESETS, INVERT, bgTypesFor,
    clone, merge, normalize, sanitizeCSS: cleanCSS, parseMusicLink, cleanVibe, vibeOf, applyVibe, ENUMS, hex, rgba, matrices, applyPreset, snapshot, swatch
  };
})(typeof self !== 'undefined' ? self : globalThis);