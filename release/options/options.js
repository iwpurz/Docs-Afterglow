(async () => {
  'use strict';

  const API  = (typeof browser !== 'undefined' && browser && browser.storage) ? browser
             : (typeof chrome  !== 'undefined' && chrome  && chrome.storage)  ? chrome
             : null;
  const DD   = (typeof window !== 'undefined' && window.DD)   || null;
  const DDBg = (typeof window !== 'undefined' && window.DDBg) || null;
  const DDT  = (typeof window !== 'undefined' && window.DDT)  || null;
  const DDL  = (typeof window !== 'undefined' && window.DDLayers) || null;

  if (!API)  { console.error('[Docs Afterglow options] storage API missing.');  return; }
  if (!DD)   { console.error('[Docs Afterglow options] shared.js not loaded.'); return; }
  if (!DDBg) { console.error('[Docs Afterglow options] bgengine.js not loaded.'); return; }

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setP = (o, p, v) => {
    const k = p.split('.'), l = k.pop();
    const t = k.reduce((a, x) => a[x], o);
    if (t) t[l] = v;
  };

  let S, img = '', assets = {}, library = {};
  try {
    if (DDT) await DDT.migrateLibrary(API);
    const stored = await API.storage.local.get(['ddSettings', 'ddImage', 'ddAssets', 'ddThemes']);
    S   = DD.normalize(stored.ddSettings);
    img = stored.ddImage || '';
    assets = stored.ddAssets || {};
    library = (stored.ddThemes && typeof stored.ddThemes === 'object') ? stored.ddThemes : {};
  } catch (e) {
    console.warn('[Docs Afterglow options] initial read failed:', e);
    S = DD.normalize(null);
  }

  let saveTimer = 0, pvSig = '';
  const mine = new Set();          // JSON signatures of our own recent writes

  // ---- preview engine -------------------------------------------------
  const pvEngine = DDBg.create($('#pvBg'));
  const pvLayers = DDL ? DDL.create($('#pvBg')) : null;

  // ---- saving ---------------------------------------------------------
  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = 0;
      const json = JSON.stringify(S);
      mine.add(json);
      if (mine.size > 40) mine.delete(mine.values().next().value);
      API.storage.local.set({ ddSettings: JSON.parse(json) }).catch((e) => {
        console.warn('[Docs Afterglow options] write failed:', e);
      });
    }, 60);
  }
  function changed() { save(); refreshWhen(); updatePreview(); }

  API.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    if (ch.ddImage) { img = ch.ddImage.newValue || ''; updatePreview(); }
    if (ch.ddAssets) { assets = ch.ddAssets.newValue || {}; pvSig = ''; updatePreview(); }
    if (ch.ddThemes) { library = ch.ddThemes.newValue || {}; renderPresets(); }
    if (ch.ddSettings) {
      const json = JSON.stringify(ch.ddSettings.newValue);
      if (mine.has(json)) return;             // echo of our own save
      try { S = DD.normalize(ch.ddSettings.newValue); }
      catch (e) { return; }
      render();
    }
  });

  // ---- binding --------------------------------------------------------
  function bindValues() {
    $$('[data-path]').forEach((el) => {
      const v = getP(S, el.dataset.path);
      if (el.type === 'checkbox') el.checked = !!v;
      else if (v != null) el.value = v;
      if (el.type === 'range') {
        let out = el.nextElementSibling;
        if (!out || out.tagName !== 'OUTPUT') {
          out = document.createElement('output');
          el.after(out);
        }
        out.value = el.value;
      }
    });
  }

  document.addEventListener('input', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('[data-path]') : null;
    if (!el) return;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'range' || el.type === 'number' || el.dataset.num) v = Number(el.value);
    else v = el.value;
    setP(S, el.dataset.path, v);
    if (el.type === 'range' && el.nextElementSibling && el.nextElementSibling.tagName === 'OUTPUT') {
      el.nextElementSibling.value = el.value;
    }
    changed();
  });

  function refreshWhen() {
    $$('[data-when]').forEach((el) => {
      const spec = el.dataset.when;
      const eq = spec.indexOf('=');
      if (eq < 0) { el.hidden = false; return; }
      const path = spec.slice(0, eq);
      const vals = spec.slice(eq + 1).split('|');
      el.hidden = !vals.includes(String(getP(S, path)));
    });
  }

  // ---- background type + colors --------------------------------------
  const typeSel = $('#bgType');
  function fillTypes() {
    typeSel.textContent = '';
    DD.bgTypesFor(S).forEach(([v, l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      typeSel.appendChild(o);
    });
  }

  function renderColors() {
    const box = $('#colors');
    if (!Array.isArray(S.bg.colors) || !S.bg.colors.length) S.bg.colors = ['#000000'];
    box.textContent = '';

    S.bg.colors.forEach((c, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'cc';

      const inp = document.createElement('input');
      inp.type = 'color';
      inp.value = /^#[0-9a-f]{6}$/i.test(c) ? c : '#000000';
      inp.setAttribute('aria-label', 'Background color ' + (i + 1));
      inp.addEventListener('input', () => { S.bg.colors[i] = inp.value; changed(); });

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = '×';
      rm.title = 'Remove color';
      rm.setAttribute('aria-label', 'Remove background color ' + (i + 1));
      rm.disabled = S.bg.colors.length <= 1;
      rm.addEventListener('click', () => {
        if (S.bg.colors.length <= 1) return;
        S.bg.colors.splice(i, 1);
        renderColors(); changed();
      });

      wrap.append(inp, rm);
      box.appendChild(wrap);
    });

    if (S.bg.colors.length < 6) {
      const add = document.createElement('button');
      add.type = 'button';
      add.textContent = 'Add color';
      add.addEventListener('click', () => {
        S.bg.colors.push(S.bg.colors[S.bg.colors.length - 1] || '#000000');
        renderColors(); changed();
      });
      box.appendChild(add);
    }
  }

  // ---- theme grid (shared catalog: built-in, scenes, saved looks, Studio themes) ----
  async function applyEntry(entry) {
    try {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
      S = DDT ? await DDT.applyEntry(API, S, entry) : DD.applyPreset(S, entry.snap);
      mine.add(JSON.stringify(S));
      if (!DDT) save();
    } catch (e) { console.error('[Docs Afterglow options] apply failed for', entry.name, e); return; }
    render();
  }

  function renderPresets() {
    const g = $('#presetGrid');
    g.textContent = '';
    const list = DDT ? DDT.entries(S, library)
      : Object.keys(DD.PRESETS).map((n) => ({ key: n, name: n, group: 'Built-in', snap: DD.PRESETS[n] }));
    const query = $('#themeSearch').value.trim().toLocaleLowerCase();
    const visible = list.filter((entry) => !query || (entry.name + ' ' + entry.group).toLocaleLowerCase().includes(query));
    if (!visible.length) { g.textContent = 'No matching themes.'; return; }
    let last = '';
    visible.forEach((entry) => {
      if (entry.group !== last) {
        last = entry.group;
        const h = document.createElement('div');
        h.className = 'grp'; h.textContent = last;
        g.appendChild(h);
      }
      let full;
      try { full = DD.merge(DD.clone(DD.DEFAULTS), DD.clone(entry.snap)); }
      catch (e) { console.warn('[Docs Afterglow options] bad theme:', entry.name, e); return; }

      // <div role="button"> (not <button>) so the delete control can be a real <button> inside it.
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Apply theme: ' + entry.name);
      card.title = entry.group;
      card.textContent = entry.name;
      card.style.background = DD.swatch(full);
      if (full.accent) card.style.borderBottomColor = full.accent;

      card.addEventListener('click', () => applyEntry(entry));
      card.addEventListener('keydown', (e) => {
        if (e.target !== card) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); applyEntry(entry); }
      });

      if (entry.user || entry.lib) {
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'x';
        x.textContent = '×';
        x.title = 'Delete';
        x.setAttribute('aria-label', 'Delete ' + entry.name);
        x.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Delete "' + entry.name + '"?')) return;
          if (entry.user) { delete S.userPresets[entry.user]; renderPresets(); save(); return; }
          try {
            const lib = await DDT.readLibrary(API);
            delete lib[entry.lib];
            await API.storage.local.set({ ddThemes: lib });
            await API.storage.local.remove(DDT.mediaKey(entry.lib));
            library = lib;
            renderPresets();
          } catch (err) { console.warn('[Docs Afterglow options] delete failed:', err); }
        });
        card.appendChild(x);
      }
      g.appendChild(card);
    });
  }
  $('#themeSearch').addEventListener('input', renderPresets);

  $('#openStudio').addEventListener('click', async () => {
    try { await API.tabs.create({ url: API.runtime.getURL('studio/studio.html') }); }
    catch (e) { window.open('../studio/studio.html', '_blank', 'noopener'); }
  });

  $('#savePreset').addEventListener('click', () => {
    const name = (prompt('Name this look') || '').trim().slice(0, 60);
    if (!name) return;
    S.userPresets[name] = DD.snapshot(S);
    renderPresets(); save();
  });

  $('#exportBtn').addEventListener('click', () => {
    let url;
    try {
      url = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    } catch (e) {
      alert('Could not build the export file.');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = 'docs-afterglow-settings.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      const next = DD.normalize(raw);
      if (typeof next.customCSS === 'string' && next.customCSS.trim() && next.customCSS !== S.customCSS) {
        if (!confirm('This file contains custom CSS. Only import it if you trust where it came from.\n\nImport the CSS too? (Cancel keeps your current CSS and imports everything else.)')) {
          next.customCSS = S.customCSS;
        }
      }
      S = next;
      render(); save();
    } catch (err) {
      alert('That file is not a valid settings export.');
    }
    e.target.value = '';
  });

  $('#resetBtn').addEventListener('click', async () => {
    if (!confirm('Reset every setting, including your presets, custom CSS, and background image?')) return;
    S = DD.normalize({});
    img = '';
    $('#imgFile').value = '';
    try { await API.storage.local.remove('ddImage'); }
    catch (e) { console.warn('[Docs Afterglow options] remove ddImage failed:', e); }
    render(); save();
  });

  $('#resetSel').addEventListener('click', () => {
    S.selectors = DD.clone(DD.DEFAULTS.selectors);
    render(); save();
  });

  // ---- background image ----------------------------------------------
  function toDataURL(f) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = rej;
      fr.onload = () => {
        const mime = f.type || '';
        // Animated GIFs and SVGs are preserved verbatim (canvas would kill animation / taint SVG).
        if (mime === 'image/gif' || mime === 'image/svg+xml') return res(fr.result);
        const im = new Image();
        im.onerror = rej;
        im.onload = () => {
          const k = Math.min(1, 2560 / Math.max(im.width, im.height));
          const c = document.createElement('canvas');
          c.width  = Math.max(1, Math.round(im.width  * k));
          c.height = Math.max(1, Math.round(im.height * k));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.88));
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(f);
    });
  }

  $('#imgFile').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const dataUrl = await toDataURL(f);
      await API.storage.local.set({ ddImage: dataUrl });
      img = dataUrl;
      updatePreview();
    } catch (err) {
      console.warn('[Docs Afterglow options] image read failed:', err);
      alert('Could not read that image.');
    }
  });

  $('#imgClear').addEventListener('click', async () => {
    img = '';
    $('#imgFile').value = '';
    try { await API.storage.local.remove('ddImage'); }
    catch (e) { console.warn('[Docs Afterglow options] remove ddImage failed:', e); }
    updatePreview();
  });

  // ---- preview --------------------------------------------------------
  function updatePreview() {
    const op = S.page.opacity / 100;
    const ui = $('#pvUi'), pg = $('#pvPage');
    ui.style.background = DD.rgba(S.ui.bg, S.ui.opacity / 100);
    ui.style.color      = S.ui.text;
    pg.style.background = S.page.type === 'gradient'
      ? 'linear-gradient(' + S.page.angle + 'deg,' + DD.rgba(S.page.bg, op) + ',' + DD.rgba(S.page.bg2, op) + ')'
      : DD.rgba(S.page.bg, op);
    pg.style.color       = S.page.text;
    $('#pvLink').style.color    = S.accent;
    $('#pvCaret').style.background = S.caret;
    $('#pvSel').style.background   = DD.rgba(S.selection, S.selectionAlpha / 100);

    const src = S.bg.type === 'image' ? (img || S.bg.imageUrl || '') : '';
    const sig = JSON.stringify([S.bg, src.length, src.slice(0, 48), S.bg.type === 'layers' ? Object.keys(assets).length : 0]);
    if (sig !== pvSig) {
      pvSig = sig;
      if (S.bg.type === 'layers' && pvLayers) {
        pvEngine.update({ type: 'solid', colors: [(S.bg.colors && S.bg.colors[0]) || '#000'] }, '');
        pvLayers.update(S.bg, assets);
      } else {
        pvEngine.update(S.bg.type === 'layers' ? { type: 'solid', colors: [(S.bg.colors && S.bg.colors[0]) || '#000'] } : S.bg, src);
        if (pvLayers) pvLayers.update({ layers: [] });
      }
    }
  }

  function render() {
    fillTypes();
    bindValues();
    renderColors();
    renderPresets();
    refreshWhen();
    updatePreview();
  }
  render();
})();
