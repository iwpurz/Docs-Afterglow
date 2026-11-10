(function () {
  'use strict';

  // Chrome exposes `chrome`, Firefox exposes `browser`. MV3 service workers have
  // `self`, MV2 background pages have `window`. Handle every combination.
  const API = (typeof browser !== 'undefined' && browser && browser.commands && browser.storage) ? browser
            : (typeof chrome  !== 'undefined' && chrome  && chrome.commands  && chrome.storage)  ? chrome
            : null;

  if (!API || !API.commands || !API.commands.onCommand) {
    console.warn('[Docs Afterglow] commands/storage API unavailable — background disabled.');
    return;
  }

  // Serialize toggles: two rapid presses used to read the same stale value and
  // both write `false`. A promise chain forces them to run one after another.
  let queue = Promise.resolve();

  // `path` is one of a fixed list, never taken from a message.
  const TOGGLES = { 'toggle-theme': ['enabled'], 'toggle-sound': ['sound', 'enabled'], 'toggle-music': ['music', 'enabled'] };

  async function toggle(cmd) {
    const DD = (typeof self   !== 'undefined' && self.DD)   ||
               (typeof window !== 'undefined' && window.DD) ||
               null;
    if (!DD || typeof DD.normalize !== 'function') {
      throw new Error('DD module not loaded in background context');
    }

    const r = await API.storage.local.get('ddSettings');
    const s = DD.normalize(r.ddSettings);
    if (!s || typeof s !== 'object') {
      throw new Error('DD.normalize returned a non-object');
    }

    const path = TOGGLES[cmd];
    const holder = path.length === 1 ? s : s[path[0]];
    const key = path[path.length - 1];
    holder[key] = !holder[key];
    await API.storage.local.set({ ddSettings: s });
    return holder[key];
  }

  // Move any media embedded in saved Studio themes into its own storage key (keeps the popup fast).
  if (API.runtime && API.runtime.onInstalled) {
    API.runtime.onInstalled.addListener(() => {
      const DDT = (typeof self !== 'undefined' && self.DDT) || null;
      if (DDT && typeof DDT.migrateLibrary === 'function') DDT.migrateLibrary(API);
    });
  }

  API.commands.onCommand.addListener((cmd) => {
    if (!Object.prototype.hasOwnProperty.call(TOGGLES, cmd)) return;
    queue = queue
      .then(() => toggle(cmd))
      .then((on) => console.debug('[Docs Afterglow]', cmd, '→', on))
      .catch((e) => console.error('[Docs Afterglow] toggle failed:', e));
  });

  // ---- Music: audio files and direct audio links ---------------------------------------------------------
  // Plays from this background page so Google Docs' security policy and tab switching don't matter, and so only one
  // copy ever plays however many Docs tabs are open. YouTube / Spotify / SoundCloud links are handled in the page.
  const DDm = (typeof self !== 'undefined' && self.DD) || (typeof window !== 'undefined' && window.DD) || null;
  if (DDm && API.runtime && API.runtime.onMessage) {
    const vis = new Map();                       // tab id -> is this Docs tab visible
    let S = null, tracks = [], player = null, key = '', order = [], pos = 0, dropTimer = 0;
    const goodTrack = (t) => t && typeof t.id === 'string' && typeof t.data === 'string' && /^data:audio\/[a-z0-9.+-]+;base64,/i.test(t.data.slice(0, 60));
    const gain = (v) => Math.pow(Math.max(0, Math.min(100, v)) / 100, 1.6);

    function stopPlayer(drop) {
      if (player) { try { player.pause(); } catch (e) { /* ignore */ } }
      if (!drop) return;
      if (player) { try { player.removeAttribute('src'); player.load(); } catch (e) { /* ignore */ } }
      player = null; key = '';
    }
    function shuffled(n) { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

    function playTrack() {
      if (!player || !tracks.length) return;
      player.src = tracks[order[pos % order.length]].data;
      player.play().catch(() => { /* waits until allowed */ });
    }

    function reconcile() {
      if (!S) return;
      const m = S.music, info = DDm.parseMusicLink(m.link);
      const files = m.source === 'files' && tracks.length > 0, link = m.source === 'link' && info.kind === 'audio';
      const anyVisible = Array.from(vis.values()).some(Boolean);
      const active = S.enabled && m.enabled && (files || link) && (m.activeTabOnly ? anyVisible : vis.size > 0);
      if (!active) {
        stopPlayer(false);
        if (dropTimer) clearTimeout(dropTimer);
        dropTimer = setTimeout(() => { if (!player || player.paused) stopPlayer(true); }, 120000);   // free memory after 2 idle minutes
        return;
      }
      if (dropTimer) { clearTimeout(dropTimer); dropTimer = 0; }
      const k = files ? 'f:' + tracks.map((t) => t.id).join(',') + ':' + m.shuffle : 'l:' + info.url;
      if (!player || k !== key) {
        stopPlayer(true);
        key = k; player = new Audio(); player.preload = 'auto';
        if (files) {
          order = m.shuffle ? shuffled(tracks.length) : tracks.map((_, i) => i); pos = 0;
          player.addEventListener('ended', () => { pos++; if (pos >= order.length && m.shuffle) { order = shuffled(tracks.length); pos = 0; } playTrack(); });
          player.addEventListener('error', () => { pos++; if (tracks.length > 1) setTimeout(playTrack, 400); });
          player.volume = gain(m.volume); playTrack();
        } else {
          player.loop = true; player.src = info.url;
        }
      }
      player.volume = gain(m.volume);
      if (player.paused) player.play().catch(() => { /* waits until allowed */ });
    }

    async function load() {
      try {
        const r = await API.storage.local.get(['ddSettings', 'ddTracks']);
        S = DDm.normalize(r.ddSettings);
        tracks = Array.isArray(r.ddTracks) ? r.ddTracks.filter(goodTrack).slice(0, 12) : [];
        reconcile();
      } catch (e) { /* ignore */ }
    }
    API.storage.onChanged.addListener((ch, area) => { if (area === 'local' && (ch.ddSettings || ch.ddTracks)) load(); });
    API.runtime.onMessage.addListener((msg, sender) => {
      if (!msg || msg.type !== 'dd-music-vis' || !sender || !sender.tab) return;
      vis.set(sender.tab.id, !!msg.visible);
      reconcile();
    });
    if (API.tabs && API.tabs.onRemoved) API.tabs.onRemoved.addListener((id) => { if (vis.delete(id)) reconcile(); });
    load();
  }
})();