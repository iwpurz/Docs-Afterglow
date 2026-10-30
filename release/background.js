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

  async function toggle() {
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

    s.enabled = !s.enabled;
    await API.storage.local.set({ ddSettings: s });
    return s.enabled;
  }

  // Move any media embedded in saved Studio themes into its own storage key (keeps the popup fast).
  if (API.runtime && API.runtime.onInstalled) {
    API.runtime.onInstalled.addListener(() => {
      const DDT = (typeof self !== 'undefined' && self.DDT) || null;
      if (DDT && typeof DDT.migrateLibrary === 'function') DDT.migrateLibrary(API);
    });
  }

  API.commands.onCommand.addListener((cmd) => {
    if (cmd !== 'toggle-theme') return;
    queue = queue
      .then(toggle)
      .then((enabled) => console.debug('[Docs Afterglow] theme toggled →', enabled))
      .catch((e) => console.error('[Docs Afterglow] toggle failed:', e));
  });
})();