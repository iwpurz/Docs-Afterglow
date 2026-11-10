/* Docs Afterglow: Crisp mode canvas hook.
 *
 * Google Docs draws the page (text, lines, images, emoji) into <canvas> tiles. The classic way to dark-ify a
 * canvas is a color filter over the whole element, but a filter cannot tell text from pictures (so photos
 * and GIFs get tinted) and Firefox re-rasterizes filtered canvases at low resolution (blurry/pixelated text).
 *
 * Crisp mode recolors at paint time instead: when Docs sets a fill or stroke COLOR on a canvas, that one
 * color is mapped through the same invert + remap math the filter uses. Pictures (drawImage) and color emoji
 * are never touched, and the canvas needs no filter at all.
 *
 * Privacy: this only sees color strings such as "#000000". It never sees, reads or stores document text.
 * It runs only on docs.google.com/document/*, loaded before Docs' own scripts (run_at document_start).
 */
(function () {
  'use strict';
  if (window.__ddHookLoaded) return;
  window.__ddHookLoaded = true;
  if (!/^\/document\//.test(location.pathname)) return;     // Docs pages only (not Slides)

  const cfg = { on: false, invert: true, keepHues: true, lo: [0, 0, 0], hi: [1, 1, 1] };
  const state = { installed: false, reason: '', hits: 0, colors: [] };
  const cache = new Map();
  let normCtx = null;

  function normalizeColor(v) {
    // -> [r, g, b, a] or null (gradients, patterns, invalid values are left alone)
    if (typeof v !== 'string' || v.length > 64) return null;
    const s = v.trim().toLowerCase();
    let m = /^#([0-9a-f]{3,8})$/.exec(s);
    if (m) {
      let h = m[1];
      if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
      if (h.length === 6) h += 'ff';
      if (h.length !== 8) return null;
      const n = parseInt(h, 16);
      return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, (n & 255) / 255];
    }
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
    if (m) {
      let a = 1;
      if (m[4] != null) a = m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return [+m[1], +m[2], +m[3], Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 1];
    }
    if (s === 'transparent') return null;
    if (!/^[a-z]+$/.test(s) && !/^(hsl|hwb|lab|lch|oklab|oklch|color)\(/.test(s)) return null;
    try {   // named / hsl colors: let a private canvas normalize them
      if (!normCtx) normCtx = document.createElement('canvas').getContext('2d');
      normCtx.fillStyle = '#010203';
      normCtx.fillStyle = s;
      const out = normCtx.fillStyle;
      if (out === '#010203') return null;
      return normalizeColor(out);
    } catch (e) { return null; }
  }

  function mapRgba(c) {
    let r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    if (cfg.invert) {
      r = 1 - r; g = 1 - g; b = 1 - b;
      if (cfg.keepHues) {   // hue-rotate(180deg), the same matrix the page filter uses
        const nr = -0.574 * r + 1.430 * g + 0.144 * b;
        const ng = 0.426 * r + 0.430 * g + 0.144 * b;
        const nb = 0.426 * r + 1.430 * g - 0.856 * b;
        r = nr; g = ng; b = nb;
      }
    }
    const cl = (v) => Math.max(0, Math.min(1, v));
    const out = [r, g, b].map((v, i) => Math.round((cfg.lo[i] + (cfg.hi[i] - cfg.lo[i]) * cl(v)) * 255));
    return 'rgba(' + out[0] + ',' + out[1] + ',' + out[2] + ',' + (+c[3].toFixed(3)) + ')';
  }

  function mapColor(v) {
    if (cache.has(v)) return cache.get(v);
    const c = normalizeColor(v);
    const out = c ? mapRgba(c) : v;
    if (cache.size > 4000) cache.clear();
    cache.set(v, out);
    if (c) {
      state.hits++;
      if (state.colors.length < 12 && state.colors.indexOf(v) < 0) state.colors.push(v);
    }
    return out;
  }

  // Called by content.js whenever settings change. `S` is already sanitized.
  function configure(S) {
    cfg.on = !!(S && S.page && S.page.crisp && S.enabled);
    if (!cfg.on) return;
    const DD = window.DD, hex = DD.hex, p = S.page;
    const tint = (+p.tint) / 100, bright = (+p.brightness) / 100, B = hex(p.bg), T = hex(p.text);
    cfg.invert = !!p.invert;
    cfg.keepHues = p.keepHues !== false;
    for (let i = 0; i < 3; i++) {
      const b = B[i] / 255, t = T[i] / 255;
      if (cfg.invert) { cfg.lo[i] = b; cfg.hi[i] = ((1 - tint) + tint * t) * bright; }
      else { cfg.lo[i] = tint * t * bright; cfg.hi[i] = b; }
    }
    cache.clear();
  }

  function install() {
    try {
      const W = window.wrappedJSObject;
      if (!W || typeof exportFunction !== 'function') { state.reason = 'unsupported-browser'; return; }
      const targets = [W.CanvasRenderingContext2D, W.OffscreenCanvasRenderingContext2D].filter(Boolean);
      targets.forEach((ctor) => {
        const proto = ctor.prototype;
        ['fillStyle', 'strokeStyle'].forEach((prop) => {
          const d = Object.getOwnPropertyDescriptor(proto, prop);
          if (!d || !d.set || !d.get) return;
          const origSet = d.set, origGet = d.get;
          Object.defineProperty(proto, prop, {
            configurable: true,
            enumerable: d.enumerable,
            get: exportFunction(function () { return origGet.call(this); }, window),
            set: exportFunction(function (v) {
              if (cfg.on && typeof v === 'string') {
                try { v = mapColor(v); } catch (e) { /* leave the color unchanged */ }
              }
              origSet.call(this, v);
            }, window)
          });
        });
      });
      state.installed = targets.length > 0;
      if (!state.installed) state.reason = 'no-canvas-api';
    } catch (e) {
      state.reason = 'install-failed';
      console.warn('[Docs Afterglow] Crisp hook unavailable:', e && e.message);
    }
  }

  install();
  window.DDCrisp = {
    configure,
    mapColor: (v) => { const was = cfg.on; cfg.on = true; try { return mapColor(v); } finally { cfg.on = was; } },
    get ok() { return state.installed; },
    get on() { return cfg.on; },
    get hits() { return state.hits; },
    info: () => ({ installed: state.installed, reason: state.reason, active: cfg.on, hits: state.hits, sample: state.colors.slice() })
  };
})();
