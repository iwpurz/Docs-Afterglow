/* Docs Afterglow — Studio: build, preview, save, import and export layered themes. */
(async () => {
  'use strict';

  const API = (typeof browser !== 'undefined' && browser && browser.storage) ? browser
            : (typeof chrome !== 'undefined' && chrome && chrome.storage) ? chrome : null;
  const DD = window.DD, DDL = window.DDLayers, DDT = window.DDT;
  if (!API || !DD || !DDL || !DDT) { document.body.textContent = 'Studio could not start (storage or modules missing).'; return; }

  const $ = (s, r) => (r || document).querySelector(s);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const num = (v, d) => { const n = +v; return Number.isFinite(n) ? n : d; };
  const HEX = /^#[0-9a-f]{6}$/i;
  const hexOr = (v, d) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d);
  const str = (v, d, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').slice(0, max) : d);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ID_RE = /^[\w-]{1,40}$/;
  const rid = (p) => p + Math.random().toString(36).slice(2, 9);
  const TYPE_ICON = { color: '🎨', image: '🖼️', video: '🎬', classic: '🌌' };

  function el(tag, a, ...kids) {
    const n = document.createElement(tag);
    Object.keys(a || {}).forEach((k) => {
      const v = a[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style') n.style.cssText = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden') n[k] = v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((c) => { if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return n;
  }

  // ---------------------------------------------------------------- storage
  const sget = (keys) => API.storage.local.get(keys);
  const sset = (obj) => API.storage.local.set(obj);

  // ---------------------------------------------------------------- sanitizing
  // Themes come from strangers: rebuild every layer from a whitelist, clamp every number,
  // allow only embedded data: media.
  // Imported media is embedded data only. SVG is deliberately excluded because it
  // can carry active content or external references; raster images and video are safe.
  const MEDIA_RE = /^data:(image\/(png|jpeg|webp|gif)|video\/(mp4|webm));base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/;
  const MAX_ASSET = 48 * 1024 * 1024, MAX_TOTAL = 56 * 1024 * 1024, MAX_LAYERS = 40;
  const MAX_BUNDLE = 60 * 1024 * 1024;

  function cleanLayer(r, imported) {
    if (!r || typeof r !== 'object') return null;
    const type = ['color', 'image', 'video', 'effect', 'classic'].indexOf(r.type) >= 0 ? r.type : null;
    if (!type) return null;
    let kind = '';
    if (type === 'effect') { kind = str(r.kind, '', 30); if (!DDL.effectDef(kind)) return null; }
    const L = DDL.newLayer(type, kind ? { kind } : {});
    if (!imported && typeof r.id === 'string' && ID_RE.test(r.id)) L.id = r.id;
    L.name = str(r.name, L.name, 60) || L.name;
    L.visible = r.visible !== false;
    L.opacity = clamp(num(r.opacity, 100), 0, 100);
    L.blend = DDL.BLENDS.indexOf(r.blend) >= 0 ? r.blend : 'normal';
    if (type === 'color') {
      L.mode = ['solid', 'linear', 'radial'].indexOf(r.mode) >= 0 ? r.mode : 'linear';
      const cs = (Array.isArray(r.colors) ? r.colors : []).filter((c) => HEX.test(c)).slice(0, 4).map((c) => c.toLowerCase());
      L.colors = cs.length ? cs : L.colors;
      L.angle = clamp(num(r.angle, 160), 0, 360);
      L.cx = clamp(num(r.cx, 50), -50, 150); L.cy = clamp(num(r.cy, 40), -50, 150); L.rad = clamp(num(r.rad, 70), 5, 200);
    } else if (type === 'classic') {
      L.mode = DDL.CLASSIC.some((c) => c[0] === r.mode) ? r.mode : 'aurora';
      const cs = (Array.isArray(r.colors) ? r.colors : []).filter((c) => HEX.test(c)).slice(0, 6).map((c) => c.toLowerCase());
      L.colors = cs.length ? cs : L.colors;
      L.angle = clamp(num(r.angle, 160), 0, 360); L.speed = clamp(num(r.speed, 50), 0, 100);
      L.intensity = clamp(num(r.intensity, 70), 0, 100); L.density = clamp(num(r.density, 50), 0, 100);
      L.fxColor = hexOr(r.fxColor, L.fxColor);
    } else if (type === 'image' || type === 'video') {
      L.asset = typeof r.asset === 'string' && ID_RE.test(r.asset) ? r.asset : '';
      L.url = !imported && typeof r.url === 'string' && /^https?:\/\//i.test(r.url) ? r.url.slice(0, 1000) : '';
      L.fit = ['free', 'cover', 'contain'].indexOf(r.fit) >= 0 ? r.fit : L.fit;
      L.x = clamp(num(r.x, 50), -100, 200); L.y = clamp(num(r.y, 50), -100, 200); L.w = clamp(num(r.w, 40), 1, 400);
      L.rot = clamp(num(r.rot, 0), -360, 360); L.flip = !!r.flip; L.blur = clamp(num(r.blur, 0), 0, 60);
      if (type === 'image') L.drift = clamp(num(r.drift, 0), 0, 100); else L.rate = clamp(num(r.rate, 100), 10, 400);
    } else {
      const d = DDL.effectDef(kind);
      (d.params || []).forEach((p) => {
        const pd = DDL.PARAM_DEFS[p]; if (!pd) return;
        L[p] = pd.type === 'color' ? hexOr(r[p], L[p]) : clamp(num(r[p], L[p]), pd.min, pd.max);
      });
    }
    return L;
  }

  function cleanTheme(r, imported) {
    r = r && typeof r === 'object' ? r : {};
    const ui = r.ui || {}, pg = r.page || {};
    return {
      name: str(r.name, 'Untitled theme', 60) || 'Untitled theme',
      author: str(r.author, '', 40),
      base: hexOr(r.base, '#0b0d12'),
      fps: clamp(Math.round(num(r.fps, 30)), 10, 60),
      layers: (Array.isArray(r.layers) ? r.layers : []).slice(0, MAX_LAYERS).map((l) => cleanLayer(l, imported)).filter(Boolean),
      ui: { bg: hexOr(ui.bg, '#171a21'), text: hexOr(ui.text, '#e3e6ec'), opacity: clamp(num(ui.opacity, 85), 0, 100) },
      page: { bg: hexOr(pg.bg, '#1c1f27'), text: hexOr(pg.text, '#e8eaed'), opacity: clamp(num(pg.opacity, 84), 0, 100) },
      accent: hexOr(r.accent, '#8ab4f8'),
      invert: r.invert !== false,
      libId: imported ? '' : str(r.libId, '', 60)
    };
  }

  function cleanAssets(a) {
    const out = Object.create(null); let total = 0;
    if (!a || typeof a !== 'object') return out;
    Object.keys(a).slice(0, 80).forEach((id) => {
      const v = a[id];
      if (!ID_RE.test(id) || id === '__proto__' || id === 'constructor' || id === 'prototype' || typeof v !== 'string' || v.length > MAX_ASSET || !MEDIA_RE.test(v)) return;
      if (total + v.length > MAX_TOTAL) return;
      total += v.length;
      out[id] = v;
    });
    return out;
  }

  function assetMatchesType(asset, type) {
    return typeof asset === 'string' && (type === 'image'
      ? /^data:image\/(png|jpeg|webp|gif);base64,/i.test(asset)
      : type === 'video' && /^data:video\/(mp4|webm);base64,/i.test(asset));
  }

  // ---------------------------------------------------------------- state
  await DDT.migrateLibrary(API);
  const stored = await sget(['ddSettings', 'ddAssets', 'ddStudioDraft', 'ddThemes', 'ddStudioLive']);
  const S0 = DD.normalize(stored.ddSettings);
  let assets = cleanAssets(stored.ddAssets);
  let library = (stored.ddThemes && typeof stored.ddThemes === 'object') ? stored.ddThemes : {};
  let theme;
  let selId = '';

  function blankTheme() {
    return cleanTheme({ name: 'My theme', base: '#0b0d12', ui: { bg: S0.ui.bg, text: S0.ui.text, opacity: 85 }, page: { bg: S0.page.bg, text: S0.page.text, opacity: 84 }, accent: S0.accent }, false);
  }
  // Starting points come from the shared catalog (the same list the popup and settings page show).
  function fromPreset(name) {
    const e = DDT.entries(S0, library).filter((x) => x.name === name)[0];
    if (!e) return blankTheme();
    return cleanTheme(e.lib ? e.theme : DDT.toStudio(e.name, e.snap), false);
  }
  if (stored.ddStudioDraft && stored.ddStudioDraft.theme) theme = cleanTheme(stored.ddStudioDraft.theme, false);
  else if (S0.bg && S0.bg.type === 'layers' && Array.isArray(S0.bg.layers) && S0.bg.layers.length) {
    theme = cleanTheme({ name: 'Current theme', base: (S0.bg.colors || [])[0], fps: S0.bg.fps, layers: S0.bg.layers, ui: S0.ui, page: S0.page, accent: S0.accent }, false);
  } else theme = fromPreset('Sakura Dusk');

  // ---------------------------------------------------------------- history
  let hist = [], hi = -1, lastKey = '', lastAt = 0;
  const snap = () => JSON.stringify(theme);
  function pushHist(key) {
    const s = snap(), now = Date.now();
    if (key && key === lastKey && now - lastAt < 800 && hi >= 0) hist[hi] = s;
    else { hist.length = hi + 1; hist.push(s); if (hist.length > 80) hist.shift(); hi = hist.length - 1; }
    lastKey = key || ''; lastAt = now; syncUndo();
  }
  function syncUndo() { $('#btnUndo').disabled = hi <= 0; $('#btnRedo').disabled = hi >= hist.length - 1; }
  function goHist(i) {
    if (i < 0 || i >= hist.length) return;
    hi = i; theme = JSON.parse(hist[i]); lastKey = '';
    if (!theme.layers.some((l) => l.id === selId)) selId = '';
    syncUndo(); renderAll(); afterEdit();
  }

  // ---------------------------------------------------------------- persistence / live
  let saveT = 0, liveT = 0;
  const live = $('#live');
  live.checked = !!stored.ddStudioLive;
  function afterEdit() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { sset({ ddStudioDraft: { theme }, ddAssets: assets }).catch(() => {}); }, 400);
    if (live.checked) { clearTimeout(liveT); liveT = setTimeout(() => applyToDocs(true), 350); }
  }
  live.addEventListener('change', () => { sset({ ddStudioLive: live.checked }).catch(() => {}); if (live.checked) applyToDocs(true); });

  function usedAssets() {
    const out = {};
    theme.layers.forEach((l) => { if ((l.type === 'image' || l.type === 'video') && l.asset && assets[l.asset]) out[l.asset] = assets[l.asset]; });
    return out;
  }
  async function applyToDocs(quiet) {
    try {
      const st = await sget(['ddSettings']);
      const S = DD.normalize(st.ddSettings);
      S.enabled = true;
      S.bg = Object.assign(DD.clone(DD.DEFAULTS.bg), { type: 'layers', colors: [theme.base], layers: clone(theme.layers), fps: theme.fps, animate: true });
      S.ui.bg = theme.ui.bg; S.ui.text = theme.ui.text; S.ui.opacity = theme.ui.opacity; S.ui.invert = theme.invert !== false; S.page.invert = theme.invert !== false;
      S.page.bg = theme.page.bg; S.page.bg2 = theme.page.bg; S.page.type = 'solid'; S.page.text = theme.page.text; S.page.opacity = theme.page.opacity;
      S.accent = theme.accent;
      await sset({ ddSettings: S, ddAssets: usedAssets() });
      if (!quiet) say('Applied. Open Docs tabs update by themselves.');
    } catch (e) { console.warn('[Studio] apply failed', e); say('Could not apply: ' + e.message); }
  }

  let sayT = 0;
  function say(msg) { const h = $('#hint'); h.textContent = msg; clearTimeout(sayT); sayT = setTimeout(() => { h.textContent = ''; }, 3500); }

  // ---------------------------------------------------------------- preview
  const pvEl = $('#pv'), scaler = $('#scaler'), stage = $('#stage');
  const fit = el('div', { id: 'fit', style: 'position:relative;flex:none' });
  stage.insertBefore(fit, scaler); fit.append(scaler);
  const engine = DDL.create(pvEl);
  let scale = 1;
  function doFit() {
    const sw = stage.clientWidth - 4, sh = stage.clientHeight - 4;
    scale = Math.max(0.1, Math.min(sw / 1280, sh / 720, 1.2));
    fit.style.width = (1280 * scale) + 'px'; fit.style.height = (720 * scale) + 'px';
    scaler.style.transform = 'scale(' + scale + ')';
    placeHandles();
  }
  new ResizeObserver(doFit).observe(stage);

  function applyMockColors() {
    const op = (v) => clamp(v, 0, 100) / 100;
    scaler.style.setProperty('--ui', DD.rgba(theme.ui.bg, op(theme.ui.opacity)));
    scaler.style.setProperty('--uit', theme.ui.text);
    scaler.style.setProperty('--pg', DD.rgba(theme.page.bg, op(theme.page.opacity)));
    scaler.style.setProperty('--pgt', theme.page.text);
    scaler.style.setProperty('--acc-link', theme.accent);
    $('#uiOp').value = theme.ui.opacity; $('#pgOp').value = theme.page.opacity; $('#fps').value = String(theme.fps);
    pvEl.style.background = theme.base;
  }
  function preview() {
    applyMockColors();
    engine.update({ layers: theme.layers, fps: theme.fps }, assets);
    placeHandles();
  }
  pvEl.addEventListener('load', () => placeHandles(), true);
  pvEl.addEventListener('loadedmetadata', () => placeHandles(), true);

  // ---------------------------------------------------------------- editing helpers
  const selLayer = () => theme.layers.find((l) => l.id === selId) || null;
  // opts.inspector: rebuild the inspector (structural change); opts.list: rebuild the list
  function edit(fn, key, opts) {
    fn(); pushHist(key); preview(); afterEdit();
    if (!opts || opts.list !== false) renderList();
    if (opts && opts.inspector) renderInspector();
  }

  // ---------------------------------------------------------------- layer list
  const listEl = $('#layerList');
  function layerLabel(l) { return l.type === 'effect' ? (DDL.effectDef(l.kind) || {}).icon || '✨' : TYPE_ICON[l.type] || '•'; }
  let dragFrom = -1;
  function renderList() {
    listEl.textContent = '';
    if (!theme.layers.length) { listEl.append(el('li', { class: 'empty', style: 'cursor:default' }, 'No layers yet. Add one, or start from a theme below.')); return; }
    for (let i = theme.layers.length - 1; i >= 0; i--) {
      const l = theme.layers[i];
      const li = el('li', { class: (l.id === selId ? 'sel ' : '') + (l.visible === false ? 'off' : ''), tabindex: '0', draggable: 'true', role: 'option', 'aria-selected': l.id === selId ? 'true' : 'false' },
        el('button', { class: 'eye', title: l.visible === false ? 'Show layer' : 'Hide layer', 'aria-label': 'Toggle visibility', text: l.visible === false ? '◌' : '👁',
          onClick: (e) => { e.stopPropagation(); edit(() => { l.visible = l.visible === false; }, ''); } }),
        el('span', { class: 'ic', text: layerLabel(l) }),
        el('span', { class: 'nm', text: l.name || l.type }),
        el('span', { class: 'act' },
          el('button', { title: 'Move up (toward front)', 'aria-label': 'Move up', text: '↑', onClick: (e) => { e.stopPropagation(); moveLayer(i, i + 1); } }),
          el('button', { title: 'Move down', 'aria-label': 'Move down', text: '↓', onClick: (e) => { e.stopPropagation(); moveLayer(i, i - 1); } }),
          el('button', { title: 'Duplicate', 'aria-label': 'Duplicate', text: '⧉', onClick: (e) => { e.stopPropagation(); dupLayer(i); } }),
          el('button', { title: 'Delete', 'aria-label': 'Delete layer', text: '✕', onClick: (e) => { e.stopPropagation(); delLayer(i); } })));
      li.addEventListener('click', () => select(l.id));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(l.id); } });
      li.addEventListener('dragstart', (e) => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch (_) { /* ignore */ } });
      li.addEventListener('dragover', (e) => { if (dragFrom >= 0) { e.preventDefault(); li.classList.add('drop'); } });
      li.addEventListener('dragleave', () => li.classList.remove('drop'));
      li.addEventListener('drop', (e) => { e.preventDefault(); li.classList.remove('drop'); if (dragFrom >= 0 && dragFrom !== i) moveLayer(dragFrom, i); dragFrom = -1; });
      li.addEventListener('dragend', () => { dragFrom = -1; });
      listEl.append(li);
    }
  }
  function select(id) { selId = id; renderList(); renderInspector(); placeHandles(); }
  function moveLayer(from, to) {
    if (to < 0 || to >= theme.layers.length || from === to) return;
    edit(() => { const [m] = theme.layers.splice(from, 1); theme.layers.splice(to, 0, m); }, '');
  }
  function dupLayer(i) {
    if (theme.layers.length >= MAX_LAYERS) { say('Layer limit reached (' + MAX_LAYERS + ').'); return; }
    const c = clone(theme.layers[i]); c.id = DDL.newId(); c.name = (c.name || c.type) + ' copy';
    edit(() => { theme.layers.splice(i + 1, 0, c); selId = c.id; }, '', { inspector: true });
  }
  function delLayer(i) {
    edit(() => { const [r] = theme.layers.splice(i, 1); if (r && r.id === selId) selId = ''; }, '', { inspector: true });
  }
  function addLayer(type, kind) {
    if (theme.layers.length >= MAX_LAYERS) { say('Layer limit reached (' + MAX_LAYERS + ').'); return; }
    const L = DDL.newLayer(type, kind ? { kind } : {});
    if (type === 'effect' && kind === 'vignette') L.name = 'Vignette';
    edit(() => { theme.layers.push(L); selId = L.id; }, '', { inspector: true });
    if (type === 'image' || type === 'video') pickMedia(L.id, type);
  }

  // add menu
  const menu = $('#addMenu'), btnAdd = $('#btnAdd');
  function buildMenu() {
    menu.textContent = '';
    const add = (icon, label, fn) => menu.append(el('button', { onClick: () => { menu.hidden = true; fn(); } }, el('span', { class: 'ic', text: icon }), label));
    menu.append(el('h4', { text: 'Basics' }));
    add('🎨', 'Color or gradient', () => addLayer('color'));
    add('🌌', 'Classic background (aurora, stars, matrix…)', () => addLayer('classic'));
    add('🖼️', 'Image', () => addLayer('image'));
    add('🎬', 'Video', () => addLayer('video'));
    const groups = {};
    DDL.allEffects().forEach((d) => { (groups[d.group || 'Effects'] = groups[d.group || 'Effects'] || []).push(d); });
    ['Scenery', 'Falling', 'Glow', 'Atmosphere'].concat(Object.keys(groups).filter((g) => ['Scenery', 'Falling', 'Glow', 'Atmosphere'].indexOf(g) < 0)).forEach((g) => {
      if (!groups[g]) return;
      menu.append(el('h4', { text: g }));
      groups[g].forEach((d) => add(d.icon || '✨', d.label, () => addLayer('effect', d.kind)));
    });
  }
  buildMenu();
  btnAdd.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) menu.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.hidden = true; });

  // theme chips: the same catalog as the popup and the settings page
  async function openEntry(e) {
    if (theme.layers.length && !confirm('Replace the current layers with "' + e.name + '"? You can undo this.')) return;
    try {
      if (e.lib) { const pool = await DDT.readLibraryAssets(API, e.lib); loadBundle(e.theme, pool, true); }
      else loadBundle(DDT.toStudio(e.name, e.snap), {}, true);
    } catch (err) { console.warn('[Studio] open failed', err); say('Could not open that theme.'); }
  }
  function buildPresets() {
    const row = $('#presetRow'); row.textContent = '';
    let last = '';
    DDT.entries(S0, library).forEach((e) => {
      if (e.group !== last) { last = e.group; row.append(el('h4', { text: last })); }
      row.append(el('button', { text: e.name, title: e.group, onClick: () => openEntry(e) }));
    });
  }
  buildPresets();

  // ---------------------------------------------------------------- inspector
  const insp = $('#inspector');
  function row(label, ctrl, cls) { return el('div', { class: 'row' + (cls ? ' ' + cls : '') }, el('span', { text: label }), el('div', { class: 'val' }, ctrl)); }
  function rangeRow(label, get, set, min, max, step, unit, key, opts) {
    const out = el('output', { text: get() + (unit || '') });
    const inp = el('input', { type: 'range', min, max, step: step || 1, value: get(), 'aria-label': label,
      onInput: () => { const v = num(inp.value, min); out.textContent = v + (unit || ''); edit(() => set(v), key || label, opts || { list: false }); } });
    return row(label, [inp, out]);
  }
  function colorRow(label, get, set, key) {
    const inp = el('input', { type: 'color', value: get(), 'aria-label': label, onInput: () => edit(() => set(inp.value), key || label, { list: false }) });
    return row(label, inp);
  }
  function selectRow(label, get, set, options, opts) {
    const s = el('select', { 'aria-label': label, onChange: () => edit(() => set(s.value), '', opts || { inspector: true }) },
      options.map((o) => el('option', { value: o[0], text: o[1], selected: o[0] === get() })));
    return row(label, s);
  }
  function checkRow(label, get, set) {
    const c = el('input', { type: 'checkbox', checked: !!get(), 'aria-label': label, onChange: () => edit(() => set(c.checked), '', { list: false }) });
    return row(label, c, 'chk');
  }
  function section(title) { return el('h2', { class: 'sec', text: title }); }

  function renderInspector() {
    insp.textContent = '';
    const l = selLayer();
    if (!l) { renderSceneInspector(); return; }
    insp.append(section('Layer'));
    const nm = el('input', { type: 'text', value: l.name || '', maxlength: '60', 'aria-label': 'Layer name', onInput: () => edit(() => { l.name = nm.value; }, 'name', { inspector: false }) });
    insp.append(row('Name', nm));
    insp.append(rangeRow('Opacity', () => l.opacity, (v) => { l.opacity = v; }, 0, 100, 1, '%'));
    insp.append(selectRow('Blend', () => l.blend || 'normal', (v) => { l.blend = v; }, DDL.BLENDS.map((b) => [b, b]), { list: false }));

    if (l.type === 'color') {
      insp.append(section('Color'));
      insp.append(selectRow('Style', () => l.mode, (v) => { l.mode = v; }, [['solid', 'Solid'], ['linear', 'Linear gradient'], ['radial', 'Radial glow']]));
      const list = el('div', { class: 'colorlist' });
      l.colors.forEach((c, i) => {
        const inp = el('input', { type: 'color', value: c, 'aria-label': 'Color ' + (i + 1), onInput: () => edit(() => { l.colors[i] = inp.value; }, 'col' + i, { list: false }) });
        list.append(inp);
      });
      if (l.mode !== 'solid') {
        if (l.colors.length < 4) list.append(el('button', { text: '+', title: 'Add color', onClick: () => edit(() => { l.colors.push(l.colors[l.colors.length - 1]); }, '', { inspector: true, list: false }) }));
        if (l.colors.length > 1) list.append(el('button', { text: '−', title: 'Remove last color', onClick: () => edit(() => { l.colors.pop(); }, '', { inspector: true, list: false }) }));
      }
      insp.append(row('Colors', list));
      if (l.mode === 'linear') insp.append(rangeRow('Angle', () => l.angle, (v) => { l.angle = v; }, 0, 360, 1, '°'));
      if (l.mode === 'radial') {
        insp.append(rangeRow('Center X', () => l.cx, (v) => { l.cx = v; }, -50, 150, 1, '%'));
        insp.append(rangeRow('Center Y', () => l.cy, (v) => { l.cy = v; }, -50, 150, 1, '%'));
        insp.append(rangeRow('Size', () => l.rad, (v) => { l.rad = v; }, 5, 200, 1, '%'));
        insp.append(el('p', { class: 'note', text: 'Tip: set Blend to "screen" and end with black to get a soft moon or sun glow.' }));
      }
    } else if (l.type === 'classic') {
      insp.append(section('Classic background'));
      insp.append(selectRow('Style', () => l.mode, (v) => { l.mode = v; }, DDL.CLASSIC));
      const list = el('div', { class: 'colorlist' });
      l.colors.forEach((c, i) => {
        const inp = el('input', { type: 'color', value: c, 'aria-label': 'Color ' + (i + 1), onInput: () => edit(() => { l.colors[i] = inp.value; }, 'col' + i, { list: false }) });
        list.append(inp);
      });
      if (l.colors.length < 6) list.append(el('button', { text: '+', title: 'Add color', onClick: () => edit(() => { l.colors.push(l.colors[l.colors.length - 1]); }, '', { inspector: true, list: false }) }));
      if (l.colors.length > 1) list.append(el('button', { text: '−', title: 'Remove last color', onClick: () => edit(() => { l.colors.pop(); }, '', { inspector: true, list: false }) }));
      insp.append(row('Colors', list));
      const ps = DDL.CLASSIC_PARAMS[l.mode] || [];
      if (ps.indexOf('angle') >= 0) insp.append(rangeRow('Angle', () => l.angle, (v) => { l.angle = v; }, 0, 360, 1, '°'));
      if (ps.indexOf('speed') >= 0) insp.append(rangeRow('Speed', () => l.speed, (v) => { l.speed = v; }, 0, 100, 1, ''));
      if (ps.indexOf('intensity') >= 0) insp.append(rangeRow('Intensity', () => l.intensity, (v) => { l.intensity = v; }, 0, 100, 1, ''));
      if (ps.indexOf('density') >= 0) insp.append(rangeRow('Density', () => l.density, (v) => { l.density = v; }, 0, 100, 1, ''));
      if (ps.indexOf('fxColor') >= 0) insp.append(colorRow('Particle color', () => l.fxColor, (v) => { l.fxColor = v; }, 'fx'));
      if (l.mode === 'aurora') insp.append(el('p', { class: 'note', text: 'The first color is the sky; the others become glowing blobs.' }));
      if (l.mode === 'plasma') insp.append(el('p', { class: 'note', text: 'All colors form the palette the plasma cycles through.' }));
    } else if (l.type === 'image' || l.type === 'video') {
      insp.append(section(l.type === 'image' ? 'Image' : 'Video'));
      const has = !!(l.asset && assets[l.asset]) || !!l.url;
      insp.append(el('div', { class: 'btnrow' },
        el('button', { class: 'accent', text: has ? 'Replace file…' : 'Choose file…', onClick: () => pickMedia(l.id, l.type) }),
        has ? el('button', { text: 'Remove', onClick: () => edit(() => { l.asset = ''; l.url = ''; }, '', { inspector: true, list: false }) }) : null));
      if (l.type === 'image') insp.append(el('p', { class: 'note', text: 'PNG with transparency, WebP, JPEG and GIF work. Large images are shrunk to 2560 px.' }));
      else insp.append(el('p', { class: 'note', text: 'MP4 or WebM, up to 45 MB. It plays muted and loops. Short, compressed clips work best.' }));
      insp.append(selectRow('Placement', () => l.fit, (v) => { l.fit = v; }, [['free', 'Free (position and scale)'], ['cover', 'Fill the screen'], ['contain', 'Fit inside']]));
      if (l.fit === 'free') {
        insp.append(rangeRow('X', () => l.x, (v) => { l.x = v; }, -50, 150, 0.5, '%'));
        insp.append(rangeRow('Y', () => l.y, (v) => { l.y = v; }, -50, 150, 0.5, '%'));
        insp.append(rangeRow('Width', () => l.w, (v) => { l.w = v; }, 2, 300, 0.5, '%'));
      }
      insp.append(rangeRow('Rotation', () => l.rot, (v) => { l.rot = v; }, -180, 180, 1, '°'));
      insp.append(checkRow('Flip', () => l.flip, (v) => { l.flip = v; }));
      insp.append(rangeRow('Blur', () => l.blur, (v) => { l.blur = v; }, 0, 40, 1, 'px'));
      if (l.type === 'image') insp.append(rangeRow('Slow zoom', () => l.drift, (v) => { l.drift = v; }, 0, 100, 1, '', 'drift'));
      else insp.append(rangeRow('Speed', () => l.rate, (v) => { l.rate = v; }, 25, 300, 5, '%'));
      if (l.fit === 'free') insp.append(el('p', { class: 'note', text: 'You can also drag the layer in the preview: the box moves it, the corners scale it and the top dot rotates it.' }));
    } else {
      const d = DDL.effectDef(l.kind) || { params: [] };
      insp.append(section((d.icon || '') + ' ' + (d.label || l.kind)));
      (d.params || []).forEach((p) => {
        const pd = DDL.PARAM_DEFS[p]; if (!pd) return;
        if (pd.type === 'color') insp.append(colorRow(pd.label, () => l[p], (v) => { l[p] = v; }, p));
        else insp.append(rangeRow(pd.label, () => l[p], (v) => { l[p] = v; }, pd.min, pd.max, 1, '', p));
      });
    }
    insp.append(el('div', { class: 'btnrow', style: 'margin-top:14px' },
      el('button', { text: 'Duplicate', onClick: () => dupLayer(theme.layers.findIndex((x) => x.id === l.id)) }),
      el('button', { class: 'danger', text: 'Delete layer', onClick: () => delLayer(theme.layers.findIndex((x) => x.id === l.id)) })));
  }

  function renderSceneInspector() {
    insp.append(section('Theme'));
    insp.append(colorRow('Base color', () => theme.base, (v) => { theme.base = v; }, 'base'));
    insp.append(selectRow('Frame rate', () => String(theme.fps), (v) => { theme.fps = +v; }, [['15', '15 fps (lightest)'], ['24', '24 fps'], ['30', '30 fps'], ['60', '60 fps (smoothest)']], { inspector: false, list: false }));
    insp.append(section('Docs colors'));
    insp.append(checkRow('Dark-ify Docs (invert)', () => theme.invert !== false, (v) => { theme.invert = v; }));
    insp.append(colorRow('Toolbar', () => theme.ui.bg, (v) => { theme.ui.bg = v; }, 'uibg'));
    insp.append(colorRow('Toolbar text', () => theme.ui.text, (v) => { theme.ui.text = v; }, 'uitx'));
    insp.append(rangeRow('Toolbar opacity', () => theme.ui.opacity, (v) => { theme.ui.opacity = v; }, 0, 100, 1, '%'));
    insp.append(colorRow('Page', () => theme.page.bg, (v) => { theme.page.bg = v; }, 'pgbg'));
    insp.append(colorRow('Page text', () => theme.page.text, (v) => { theme.page.text = v; }, 'pgtx'));
    insp.append(rangeRow('Page opacity', () => theme.page.opacity, (v) => { theme.page.opacity = v; }, 0, 100, 1, '%'));
    insp.append(colorRow('Links and accent', () => theme.accent, (v) => { theme.accent = v; }, 'acc'));
    insp.append(el('p', { class: 'note', text: 'Select a layer on the left to edit it. Lower the toolbar and page opacity so the scene shows through.' }));
  }

  // stage bar
  $('#showDoc').addEventListener('change', (e) => { $('#mock').classList.toggle('hide', !e.target.checked); });
  $('#uiOp').addEventListener('input', (e) => edit(() => { theme.ui.opacity = +e.target.value; }, 'uiop', { list: false }));
  $('#pgOp').addEventListener('input', (e) => edit(() => { theme.page.opacity = +e.target.value; }, 'pgop', { list: false }));
  $('#fps').addEventListener('change', (e) => edit(() => { theme.fps = +e.target.value; }, '', { list: false }));
  $('#themeName').addEventListener('input', (e) => { theme.name = str(e.target.value, '', 60); afterEdit(); });
  $('#themeAuthor').addEventListener('input', (e) => { theme.author = str(e.target.value, '', 40); afterEdit(); });

  // ---------------------------------------------------------------- media
  const fileMedia = $('#fileMedia');
  let mediaTarget = null;
  function pickMedia(id, type) {
    mediaTarget = { id, type };
    fileMedia.accept = type === 'image' ? 'image/png,image/jpeg,image/webp,image/gif' : 'video/mp4,video/webm';
    fileMedia.value = '';
    fileMedia.click();
  }
  const readDataUrl = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
  async function prepareImage(f) {
    if (f.type === 'image/gif' || f.size < 1.2 * 1024 * 1024) return readDataUrl(f);
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.9));
    return readDataUrl(blob || f);
  }
  fileMedia.addEventListener('change', async () => {
    const f = fileMedia.files && fileMedia.files[0], tgt = mediaTarget; mediaTarget = null;
    if (!f || !tgt) return;
    try {
      let url;
      if (tgt.type !== 'video' && f.size > 35 * 1024 * 1024) { say('That image is over 35 MB. Choose a smaller file.'); return; }
      if (tgt.type === 'video') {
        if (!/^video\/(mp4|webm)$/.test(f.type)) { say('Please choose an MP4 or WebM video.'); return; }
        if (f.size > 35 * 1024 * 1024) { say('That video is over 35 MB. Try a shorter or more compressed clip.'); return; }
        url = await readDataUrl(f);
      } else url = await prepareImage(f);
      if (!MEDIA_RE.test(url)) { say('That file type is not supported.'); return; }
      if (url.length > MAX_ASSET) { say('That file is too large for a theme asset.'); return; }
      const used = Object.keys(assets).reduce((n, key) => n + (typeof assets[key] === 'string' ? assets[key].length : 0), 0);
      if (used + url.length > MAX_TOTAL) { say('Theme media is over the 56 MB storage limit. Remove an asset or choose a smaller file.'); return; }
      const id = rid('a');
      assets[id] = url;
      const l = theme.layers.find((x) => x.id === tgt.id); if (!l) return;
      edit(() => { l.asset = id; l.url = ''; if (!l.name || l.name === 'Image' || l.name === 'Video') l.name = str(f.name.replace(/\.[^.]+$/, ''), l.name, 40); }, '', { inspector: true });
      say('Added ' + f.name);
    } catch (e) { console.warn('[Studio] media failed', e); say('Could not read that file.'); }
  });

  // ---------------------------------------------------------------- handles (drag / scale / rotate in the preview)
  const handles = $('#handles');
  function mediaBox(l) {
    if (!l || (l.type !== 'image' && l.type !== 'video') || l.fit !== 'free' || l.visible === false) return null;
    const m = pvEl.querySelector('[data-dd-layer="' + l.id + '"] ' + (l.type === 'image' ? 'img' : 'video'));
    if (!m || !m.getAttribute('src')) return null;
    const W = m.offsetWidth, H = m.offsetHeight;
    if (!W || !H) return null;
    return { W, H, cx: num(l.x, 50) / 100 * 1280, cy: num(l.y, 50) / 100 * 720 };
  }
  function placeHandles() {
    const l = selLayer(), b = mediaBox(l);
    if (!b) { handles.hidden = true; return; }
    handles.hidden = false;
    handles.style.cssText = 'left:' + (b.cx - b.W / 2) + 'px;top:' + (b.cy - b.H / 2) + 'px;width:' + b.W + 'px;height:' + b.H + 'px;transform:rotate(' + num(l.rot, 0) + 'deg)';
  }
  function toStage(e) { const r = scaler.getBoundingClientRect(); return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale]; }
  function startDrag(kind, e) {
    const l = selLayer(), b = mediaBox(l); if (!l || !b) return;
    e.preventDefault(); e.stopPropagation();
    const [px0, py0] = toStage(e), x0 = num(l.x, 50), y0 = num(l.y, 50), w0 = num(l.w, 40), d0 = Math.hypot(px0 - b.cx, py0 - b.cy) || 1;
    const target = e.currentTarget; try { target.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    let moved = false;
    const move = (ev) => {
      const [px, py] = toStage(ev); moved = true;
      if (kind === 'move') {
        let nx = x0 + (px - px0) / 1280 * 100, ny = y0 + (py - py0) / 720 * 100;
        if (!ev.altKey) { if (Math.abs(nx - 50) < 1.2) nx = 50; if (Math.abs(ny - 50) < 1.2) ny = 50; }
        edit(() => { l.x = Math.round(nx * 10) / 10; l.y = Math.round(ny * 10) / 10; }, 'drag', { list: false });
      } else if (kind === 'scale') {
        const k = Math.hypot(px - b.cx, py - b.cy) / d0;
        edit(() => { l.w = Math.round(clamp(w0 * k, 2, 300) * 10) / 10; }, 'drag', { list: false });
      } else {
        let a = Math.atan2(py - b.cy, px - b.cx) * 180 / Math.PI + 90;
        if (ev.shiftKey) a = Math.round(a / 15) * 15;
        if (a > 180) a -= 360;
        edit(() => { l.rot = Math.round(a); }, 'drag', { list: false });
      }
    };
    const up = () => {
      target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', up); target.removeEventListener('pointercancel', up);
      if (moved) renderInspector();
    };
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', up); target.addEventListener('pointercancel', up);
  }
  $('#hBox').addEventListener('pointerdown', (e) => startDrag('move', e));
  handles.querySelectorAll('.hd').forEach((h) => h.addEventListener('pointerdown', (e) => startDrag('scale', e)));
  handles.querySelector('.hrot').addEventListener('pointerdown', (e) => startDrag('rot', e));

  // ---------------------------------------------------------------- library, import, export
  const dlg = $('#dlgLibrary');
  async function persistLibrary() { await sset({ ddThemes: library }); }
  function usedAssetsOf(t, pool) {
    const out = {};
    t.layers.forEach((l) => { if ((l.type === 'image' || l.type === 'video') && l.asset && pool[l.asset]) out[l.asset] = pool[l.asset]; });
    return out;
  }
  async function saveToLibrary() {
    const id = theme.libId && library[theme.libId] ? theme.libId : rid('t');
    theme.libId = id;
    library[id] = { id, name: theme.name, author: theme.author, saved: Date.now(), theme: clone(theme) };
    try {
      await sset({ ddThemes: library, [DDT.mediaKey(id)]: usedAssets() });
      say('Saved to My themes.'); afterEdit(); buildPresets();
    }
    catch (e) { console.warn('[Studio] save failed', e); say('Could not save: ' + e.message); }
  }
  function renderLibrary() {
    const box = $('#libList'); box.textContent = '';
    const items = Object.keys(library).map((k) => library[k]).filter(Boolean).sort((a, b) => num(b.saved, 0) - num(a.saved, 0));
    if (!items.length) { box.append(el('div', { class: 'empty', text: 'Nothing saved yet. Press Save to keep a theme here.' })); return; }
    items.forEach((it) => {
      box.append(el('div', { class: 'it' },
        el('b', { text: str(it.name, 'Untitled', 60) }),
        el('small', { text: (it.author ? 'by ' + str(it.author, '', 40) + ' · ' : '') + new Date(num(it.saved, 0)).toLocaleDateString() }),
        el('button', { text: 'Open', onClick: async () => { loadBundle(it.theme, await DDT.readLibraryAssets(API, it.id), true); dlg.close(); } }),
        el('button', { text: 'Export', onClick: async () => exportBundle(it.theme, await DDT.readLibraryAssets(API, it.id)) }),
        el('button', { class: 'danger', text: 'Delete', onClick: async () => {
          if (!confirm('Delete "' + str(it.name, 'this theme', 60) + '" from My themes?')) return;
          delete library[it.id];
          await persistLibrary(); await API.storage.local.remove(DDT.mediaKey(it.id));
          renderLibrary(); buildPresets();
        } })));
    });
  }
  $('#btnLibrary').addEventListener('click', () => { renderLibrary(); dlg.showModal(); });
  $('#btnSave').addEventListener('click', saveToLibrary);

  // Load a theme (+assets) into the editor. Asset ids are renamed so nothing collides.
  function loadBundle(rawTheme, rawAssets, fromLibrary) {
    const t = cleanTheme(rawTheme, !fromLibrary);
    const incoming = cleanAssets(rawAssets);
    const map = {};
    t.layers.forEach((l) => {
      if ((l.type === 'image' || l.type === 'video') && l.asset) {
        if (assetMatchesType(incoming[l.asset], l.type)) { if (!map[l.asset]) { map[l.asset] = rid('a'); assets[map[l.asset]] = incoming[l.asset]; } l.asset = map[l.asset]; }
        else l.asset = '';
      }
    });
    edit(() => { theme = t; selId = ''; }, '', { inspector: true });
    $('#themeName').value = theme.name; $('#themeAuthor').value = theme.author;
    say('Opened "' + theme.name + '".');
  }
  function exportBundle(t, pool) {
    const clean = cleanTheme(t, false);
    clean.libId = '';
    const out = Object.assign({ app: 'docs-afterglow', kind: 'theme', v: 1 }, clean, { assets: usedAssetsOf(clean, pool) });
    delete out.libId;
    const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: (clean.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'theme') + '.afterglow.json' });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    say('Exported ' + a.download);
  }
  $('#btnExport').addEventListener('click', () => exportBundle(theme, assets));
  const fileImport = $('#fileImport');
  $('#btnImport').addEventListener('click', () => { fileImport.value = ''; fileImport.click(); });
  fileImport.addEventListener('change', async () => {
    const f = fileImport.files && fileImport.files[0]; if (!f) return;
    try {
      if (f.size > MAX_BUNDLE) throw new Error('file too large (60 MB maximum)');
      const obj = JSON.parse(await f.text());
      if (!obj || obj.kind !== 'theme' || !Array.isArray(obj.layers)) throw new Error('not an Afterglow theme');
      const n = cleanTheme(obj, true).layers.length;
      if (!confirm('Import "' + str(obj.name, 'this theme', 60) + '" (' + n + ' layers)? It replaces what you are editing; you can undo.\n\nOnly bounded, embedded PNG/JPEG/WebP/GIF images and MP4/WebM video are kept. SVG, remote links and custom code are ignored.')) return;
      loadBundle(obj, obj.assets, false);
    } catch (e) { console.warn('[Studio] import failed', e); say('Could not import: ' + e.message); }
  });
  $('#btnApply').addEventListener('click', () => applyToDocs(false));
  $('#btnUndo').addEventListener('click', () => goHist(hi - 1));
  $('#btnRedo').addEventListener('click', () => goHist(hi + 1));
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    const typing = tag === 'INPUT' && e.target.type === 'text' || tag === 'TEXTAREA';
    if ((e.ctrlKey || e.metaKey) && !typing) {
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); goHist(e.shiftKey ? hi + 1 : hi - 1); }
      else if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); goHist(hi + 1); }
    } else if (e.key === 'Delete' && !typing && tag !== 'SELECT' && selId) {
      const i = theme.layers.findIndex((l) => l.id === selId); if (i >= 0) delLayer(i);
    }
  });

  // ---------------------------------------------------------------- go
  function renderAll() {
    $('#themeName').value = theme.name; $('#themeAuthor').value = theme.author;
    renderList(); renderInspector(); preview();
  }
  pushHist('');
  renderAll();
  doFit();
  window.__studio = { get theme() { return theme; }, get assets() { return assets; }, cleanTheme, cleanAssets, loadBundle, exportBundle };
})();
