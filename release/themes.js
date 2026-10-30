/* Docs Afterglow — one theme catalog for the popup, the settings page and Studio.
 *
 * A "theme" is a settings snapshot (colors + background). Four sources feed the same list:
 *   Built-in   flat presets from shared.js
 *   Scenes     layered presets from layers.js
 *   My looks   presets saved from the settings page (S.userPresets)
 *   My themes  themes saved in Studio (storage key ddThemes; media in ddA_<id>)
 * Any of them can be applied from the popup/settings page or opened for editing in Studio.
 */
(function (root) {
  'use strict';

  const DD = root.DD;
  const DDL = root.DDLayers || null;
  const clone = DD.clone;
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const HEX = /^#[0-9a-f]{6}$/i;
  const hexOr = (v, d) => (typeof v === 'string' && HEX.test(v) ? v : d);

  // The layered built-ins only define a scene; these give each one matching Docs colors.
  const SCENE_COLORS = {
    'Sakura Dusk':    { ui: '#1a1024', uiText: '#f6e8ef', page: '#1d1229', text: '#f7eaf1', accent: '#ff9ec4' },
    'Neon Rain':      { ui: '#0b1022', uiText: '#e6edff', page: '#0d1328', text: '#e8eeff', accent: '#ff5fc8' },
    'Winter Window':  { ui: '#101a2e', uiText: '#e8f0ff', page: '#121e34', text: '#eaf1ff', accent: '#9cc4ff' },
    'Ember Forge':    { ui: '#1a0c08', uiText: '#ffe9d9', page: '#1e0e09', text: '#ffeadb', accent: '#ff8a3a' },
    'Firefly Meadow': { ui: '#0a1a1c', uiText: '#e3fff3', page: '#0c2022', text: '#e6fff5', accent: '#7fe0b8' },
    'Autumn Drift':   { ui: '#1f130d', uiText: '#fbe8d3', page: '#24160f', text: '#fcebd6', accent: '#f0a44e' },
    'Halloween Hollow': { ui: '#170d20', uiText: '#f0e4ff', page: '#1e1229', text: '#f3eaff', accent: '#ff8a3d' },
    'Frosted Evergreen': { ui: '#0d1b17', uiText: '#e0f2e9', page: '#10231d', text: '#e7f5eb', accent: '#f2c879' },
    'Spring Bloom': { ui: '#21152b', uiText: '#ffeaf3', page: '#291a32', text: '#ffedf5', accent: '#ff9dc7' },
    'Summer Solstice': { ui: '#21170f', uiText: '#fff0d4', page: '#2b1d12', text: '#fff3dd', accent: '#ffd27a' }
  };
  const SCENE_FALLBACK = { ui: '#171a21', uiText: '#e3e6ec', page: '#1c1f27', text: '#e8eaed', accent: '#8ab4f8' };
  const SEASONAL = new Set(['Halloween Hollow', 'Frosted Evergreen', 'Spring Bloom', 'Summer Solstice']);

  // ---- Studio theme  <->  settings snapshot ------------------------------
  function toSnapshot(t) {
    const inv = t.invert !== false, ui = t.ui || {}, pg = t.page || {};
    return {
      ui: { invert: inv, bg: ui.bg, text: ui.text, opacity: ui.opacity },
      page: { invert: inv, bg: pg.bg, bg2: pg.bg, type: 'solid', text: pg.text, opacity: pg.opacity, blend: 'auto' },
      accent: t.accent,
      caret: pg.text,
      bg: { type: 'layers', colors: [t.base], layers: clone(t.layers || []), fps: t.fps || 30, animate: true }
    };
  }

  function toStudio(name, snap) {
    const full = DD.merge(clone(DD.DEFAULTS), clone(snap));
    const bg = full.bg, base = bg.colors[0] || '#0b0d12';
    let layers = [];
    if (!DDL) layers = [];
    else if (bg.type === 'layers') layers = clone(bg.layers || []);
    else if (DDL.CLASSIC.some((c) => c[0] === bg.type)) {
      layers = [DDL.newLayer('classic', {
        name: (DDL.CLASSIC.filter((c) => c[0] === bg.type)[0] || [0, 'Background'])[1], mode: bg.type,
        colors: bg.colors.slice(0, 6), angle: bg.angle, speed: bg.speed, intensity: bg.intensity,
        density: bg.density, fxColor: bg.fxColor
      })];
    } else layers = [DDL.newLayer('color', { name: 'Background', mode: 'solid', colors: [base] })];   // solid, or image (media is not carried over)
    return {
      name, author: '', base, fps: bg.fps || 30, layers,
      ui: { bg: full.ui.bg, text: full.ui.text, opacity: full.ui.opacity },
      page: { bg: full.page.bg, text: full.page.text, opacity: full.page.opacity },
      accent: full.accent, invert: full.ui.invert !== false
    };
  }

  function sceneSnap(name, p) {
    const c = SCENE_COLORS[name] || SCENE_FALLBACK;
    return toSnapshot({
      base: p.base, fps: 30, layers: p.layers, invert: true,
      ui: { bg: c.ui, text: c.uiText, opacity: 85 }, page: { bg: c.page, text: c.text, opacity: 84 }, accent: c.accent
    });
  }

  // ---- catalog ------------------------------------------------------------
  function entries(S, library) {
    const out = [];
    Object.keys(DD.PRESETS).forEach((n) => out.push({ key: 'b:' + n, name: n, group: 'Built-in', snap: DD.PRESETS[n] }));
    if (DDL) {
      const sc = DDL.presets();
      Object.keys(sc).forEach((n) => out.push({ key: 's:' + n, name: n, group: SEASONAL.has(n) ? 'Seasonal' : 'Scenes', snap: sceneSnap(n, sc[n]) }));
    }
    const ups = (S && isObj(S.userPresets)) ? S.userPresets : {};
    Object.keys(ups).forEach((n) => { if (isObj(ups[n])) out.push({ key: 'u:' + n, name: n, group: 'My looks', snap: ups[n], user: n }); });
    const lib = isObj(library) ? library : {};
    Object.keys(lib).map((k) => lib[k]).filter((it) => it && isObj(it.theme) && typeof it.id === 'string')
      .sort((a, b) => (+b.saved || 0) - (+a.saved || 0))
      .forEach((it) => out.push({ key: 'l:' + it.id, name: String(it.name || 'Untitled').slice(0, 60), group: 'My themes', snap: toSnapshot(it.theme), lib: it.id, theme: it.theme }));
    return out;
  }

  const GROUPS = ['Built-in', 'Scenes', 'Seasonal', 'My looks', 'My themes'];
  function swatchOf(entry) {
    try { return DD.swatch(DD.merge(clone(DD.DEFAULTS), clone(entry.snap))); } catch (e) { return '#222'; }
  }
  function accentOf(entry) { return hexOr(entry.snap && entry.snap.accent, '#8ab4f8'); }

  // ---- library storage: metadata in ddThemes, media in ddA_<id> --------------
  const mediaKey = (id) => 'ddA_' + id;
  const usedAssetsOf = (theme, pool) => {
    const out = {};
    (theme.layers || []).forEach((l) => {
      if ((l.type === 'image' || l.type === 'video') && l.asset && pool && pool[l.asset]) out[l.asset] = pool[l.asset];
    });
    return out;
  };

  async function readLibrary(API) {
    const r = await API.storage.local.get('ddThemes');
    return isObj(r.ddThemes) ? r.ddThemes : {};
  }
  async function readLibraryAssets(API, id) {
    const k = mediaKey(id), r = await API.storage.local.get(k);
    return isObj(r[k]) ? r[k] : {};
  }
  // Older builds embedded media inside each ddThemes item, which made every popup open read
  // all of it. Move it out once.
  async function migrateLibrary(API) {
    try {
      const lib = await readLibrary(API);
      const moves = {}; let changed = false;
      Object.keys(lib).forEach((id) => {
        const it = lib[id];
        if (it && isObj(it.assets)) {
          if (Object.keys(it.assets).length) moves[mediaKey(id)] = it.assets;
          delete it.assets; changed = true;
        }
      });
      if (changed) await API.storage.local.set(Object.assign({ ddThemes: lib }, moves));
    } catch (e) { console.warn('[Docs Afterglow] library migration failed:', e); }
  }

  // Apply any catalog entry to the live settings. Returns the new settings object.
  async function applyEntry(API, S, entry) {
    const next = DD.applyPreset(S, entry.snap);
    const payload = { ddSettings: next };
    if (entry.lib) payload.ddAssets = usedAssetsOf(entry.theme, await readLibraryAssets(API, entry.lib));
    await API.storage.local.set(payload);
    return next;
  }

  root.DDT = { entries, GROUPS, toSnapshot, toStudio, swatchOf, accentOf, readLibrary, readLibraryAssets, migrateLibrary, applyEntry, usedAssetsOf, mediaKey };
})(typeof self !== 'undefined' ? self : globalThis);
