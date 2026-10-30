(async () => {
  'use strict';

  // Firefox exposes `browser`; keep a `chrome` fallback so this file also runs
  // in a Chromium-based build (or a Firefox where `browser` was shadowed).
  const API = (typeof browser !== 'undefined' && browser && browser.storage) ? browser
            : (typeof chrome  !== 'undefined' && chrome  && chrome.storage)  ? chrome
            : null;
  const DD  = (typeof window !== 'undefined' && window.DD) || null;
  const DDT = (typeof window !== 'undefined' && window.DDT) || null;
  const $   = (sel) => document.querySelector(sel);

  if (!DD) {
    console.error('[Docs Afterglow popup] DD module missing — check script order.');
    return;
  }
  if (!API) {
    console.error('[Docs Afterglow popup] extension storage API missing.');
    return;
  }

  // ---- initial state -----------------------------------------------------
  let S;
  try {
    const r = await API.storage.local.get('ddSettings');
    S = DD.normalize(r.ddSettings);
  } catch (e) {
    console.error('[Docs Afterglow popup] read failed:', e);
    S = DD.normalize(null);
  }

  // ---- debounced writer --------------------------------------------------
  // Slider `input` fires dozens of times per drag. Without debouncing, each
  // tick fired its own `storage.local.set()`, and every in-flight promise was
  // dropped on the floor if the popup closed mid-write.
  let timer = 0, pending = false;

  function writeNow() {
    pending = false;
    const snap = S;
    API.storage.local.set({ ddSettings: snap }).catch((e) => {
      console.error('[Docs Afterglow popup] write failed:', e);
    });
  }
  function save(delay) {
    pending = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(writeNow, delay == null ? 120 : delay);
  }
  // Flush on close so a mid-drag value isn't lost.
  window.addEventListener('pagehide', () => {
    if (!pending) return;
    if (timer) clearTimeout(timer);
    writeNow();
  });

  // ---- element refs ------------------------------------------------------
  const enabled  = $('#enabled');
  const sel      = $('#bgType');
  const speed    = $('#speed');
  const speedRow = $('#speedRow');
  const grid     = $('#grid');
  const openBtn  = $('#open');
  const themeSearch = $('#themeSearch');
  const ANIMATED = ['animated-gradient', 'aurora', 'stars', 'matrix', 'network', 'plasma'];

  function fillTypes() {
    sel.textContent = '';
    DD.bgTypesFor(S).forEach(([v, l]) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = l;
      sel.appendChild(o);
    });
  }

  // ---- view sync ---------------------------------------------------------
  function syncRow() {
    speedRow.hidden = !ANIMATED.includes(S.bg.type);
  }
  function refreshUI() {
    enabled.checked = !!S.enabled;

    // A stale `bg.type` from a future/older build shouldn't leave the select
    // showing "nothing" — fall back to the first known option.
    fillTypes();
    const types = DD.bgTypesFor(S).map(([v]) => v);
    if (!types.includes(S.bg.type)) S.bg.type = types[0];
    sel.value = S.bg.type;

    const sp = Number(S.bg.speed);
    speed.value = String(
      Number.isFinite(sp) ? Math.max(0, Math.min(100, sp)) : 50
    );

    syncRow();
  }

  // ---- events ------------------------------------------------------------
  enabled.addEventListener('change', () => {
    S.enabled = enabled.checked;
    save();
  });

  sel.addEventListener('change', () => {
    S.bg.type = sel.value;
    syncRow();
    save(0);   // discrete pick: flush next tick, not next drag tick
  });

  speed.addEventListener('input', () => {
    S.bg.speed = Number(speed.value);
    save();    // debounced
  });

  // ---- theme grid (shared catalog: built-in, scenes, saved looks, Studio themes) ----
  function luma(hex) {
    const h = String(hex || '#000').replace(/^#/, '');
    const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
    const v = parseInt(n, 16) || 0;
    return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  }

  let catalogCache = null;
  async function renderGrid() {
    if (!catalogCache) {
      let library = {};
      if (DDT) {
        try { await DDT.migrateLibrary(API); library = await DDT.readLibrary(API); }
        catch (e) { console.warn('[Docs Afterglow popup] library read failed:', e); }
      }
      catalogCache = DDT ? DDT.entries(S, library) : Object.keys(DD.PRESETS).map((n) => ({ key: n, name: n, group: 'Built-in', snap: DD.PRESETS[n] }));
    }
    grid.textContent = '';
    const query = themeSearch.value.trim().toLocaleLowerCase();
    const list = catalogCache.filter((entry) => !query || (entry.name + ' ' + entry.group).toLocaleLowerCase().includes(query));
    if (!list.length) { grid.textContent = 'No matching themes.'; return; }
    let last = '';
    list.forEach((entry) => {
      if (entry.group !== last) {
        last = entry.group;
        const h = document.createElement('div');
        h.className = 'grp'; h.textContent = last;
        grid.appendChild(h);
      }
      let full;
      try { full = DD.merge(DD.clone(DD.DEFAULTS), DD.clone(entry.snap)); }
      catch (e) { console.warn('[Docs Afterglow popup] bad theme:', entry.name, e); return; }

      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'card';
      b.textContent = entry.name;
      b.title = entry.group + ': ' + entry.name;
      b.style.background = DD.swatch(full);
      if (full.accent) b.style.borderBottomColor = full.accent;
      if (luma((full.bg.colors || [])[0]) > 0.55) b.dataset.light = '1';

      b.addEventListener('click', async () => {
        try {
          if (timer) { clearTimeout(timer); timer = 0; }
          pending = false;
          S = DDT ? await DDT.applyEntry(API, S, entry) : DD.applyPreset(S, entry.snap);
          if (!DDT) save(0);
        } catch (e) {
          console.error('[Docs Afterglow popup] apply failed:', e);
          return;
        }
        refreshUI();
      });
      grid.appendChild(b);
    });
  }
  themeSearch.addEventListener('input', renderGrid);

  // ---- open options ------------------------------------------------------
  openBtn.addEventListener('click', async () => {
    try {
      if (API.runtime && typeof API.runtime.openOptionsPage === 'function') {
        await API.runtime.openOptionsPage();
      }
    } catch (e) {
      console.error('[Docs Afterglow popup] openOptionsPage failed:', e);
      return;
    }
    window.close();
  });

  $('#studio').addEventListener('click', async () => {
    try { await API.tabs.create({ url: API.runtime.getURL('studio/studio.html') }); }
    catch (e) { console.error('[Docs Afterglow popup] open Studio failed:', e); return; }
    window.close();
  });

  // ---- external changes --------------------------------------------------
  // Alt+Shift+D (background), the options page in another tab, or another
  // popup instance can change settings while this popup is open. Refresh only
  // when there's no debounced write in flight, so a user mid-drag isn't reset.
  API.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    if (ch.ddThemes) { catalogCache = null; renderGrid(); }
    if (!ch.ddSettings) return;
    if (pending) return;
    let incoming;
    try { incoming = DD.normalize(ch.ddSettings.newValue); }
    catch (e) { return; }
    if (JSON.stringify(incoming) === JSON.stringify(S)) return;
    S = incoming;
    refreshUI();
  });

  refreshUI();
  renderGrid();
})();
