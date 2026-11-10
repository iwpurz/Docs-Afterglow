(function (root) {
  'use strict';

  const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789';
  const POS = [[-10, -15], [48, -20], [-18, 42], [52, 38], [18, 15], [66, 8]];
  const TAU = Math.PI * 2;

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const num = (v, d) => { const n = +v; return Number.isFinite(n) ? n : d; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const secs = (speed, slow, fast) => lerp(slow, fast, clamp(speed, 0, 100) / 100);

  // ---- colour parsing fallback (used when window.DD.hex is missing) ----
  const rgbCache = new Map();
  function toRgb(input) {
    if (Array.isArray(input) && input.length >= 3) {
      return [clamp(num(input[0], 0), 0, 255), clamp(num(input[1], 0), 0, 255), clamp(num(input[2], 0), 0, 255)];
    }
    if (typeof input !== 'string') return [255, 255, 255];
    const cached = rgbCache.get(input);
    if (cached) return cached;

    let out = [255, 255, 255];
    const s = input.trim().toLowerCase();

    if (s.charCodeAt(0) === 35) {
      let h = s.slice(1);
      if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map(c => c + c).join('');
      else if (h.length === 8) h = h.slice(0, 6);
      if (/^[0-9a-f]{6}$/.test(h)) {
        const n = parseInt(h, 16);
        out = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
    } else {
      const m = s.match(/^rgba?\(([^)]+)\)$/);
      if (m) {
        const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
        if (p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) {
          out = [clamp(p[0], 0, 255), clamp(p[1], 0, 255), clamp(p[2], 0, 255)];
        }
      } else if (s === 'white') out = [255, 255, 255];
      else if (s === 'black') out = [0, 0, 0];
    }

    rgbCache.set(input, out);
    return out;
  }

  function cssUrl(u) {
    const esc = String(u).replace(/["\\\n\r\f]/g, c => '\\' + c.charCodeAt(0).toString(16) + ' ');
    return 'url("' + esc + '")';
  }

  function create(host) {
    if (!host || !host.appendChild) throw new Error('DDBg.create(host): host element required');

    const DD = root.DD || {};
    const hex = typeof DD.hex === 'function'
      ? (c) => { try { const r = DD.hex(c); return Array.isArray(r) && r.length >= 3 ? r : toRgb(c); } catch (_) { return toRgb(c); } }
      : toRgb;

    // ---- DOM scaffold ------------------------------------------------
    const rootEl = document.createElement('div');
    rootEl.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;contain:strict;';
    rootEl.setAttribute('aria-hidden', 'true');

    const base = document.createElement('div');
    const fx = document.createElement('div');
    fx.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:none;';
    const dim = document.createElement('div');
    dim.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;';

    const st = document.createElement('style');
    st.textContent =
      '@keyframes ddk-grad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}' +
      '@keyframes ddk-drift{0%{transform:translate(0,0) scale(1)}33%{transform:translate(var(--dx1),var(--dy1)) scale(1.25)}' +
      '66%{transform:translate(var(--dx2),var(--dy2)) scale(.85)}100%{transform:translate(0,0) scale(1)}}';

    rootEl.append(st, base, fx, cv, dim);
    host.appendChild(rootEl);

    // ---- state --------------------------------------------------------
    let S = null;
    let raf = 0;
    let rRaf = 0;
    let last = 0;
    let t = 0;
    let w = 1, h = 1, dpr = 1;
    let ctx = null;
    let sim = null;
    let mode = '';
    let paused = false;           // tab hidden → stop rAF, keep state
    let sprite = null;            // offscreen canvas for star dots
    let nodeSprite = null;        // offscreen canvas for network glow dot
    let spriteColor = '';         // colour the sprites were tinted with

    // Pre-allocated per-frame scratch state; never allocated during step().
    const ST = {
      mgFadeStyle: null,          // 'rgba(0,0,0,0.1)' reused
      mgFont: '',
      lastComp: 'source-over',
      fontSize: 0
    };

    // ---- sizing -------------------------------------------------------
    function resize(force) {
      const r = host.getBoundingClientRect();
      const cw = host.clientWidth || r.width, ch = host.clientHeight || r.height;   // layout size: ignores CSS transforms
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const pw = Math.max(1, Math.round(cw * dpr));
      const ph = Math.max(1, Math.round(ch * dpr));

      if (mode === 'plasma') {
        if (force || cv.width !== 128) cv.width = 128;
        if (force || cv.height !== 72) cv.height = 72;
        w = 128; h = 72;
      } else {
        if (force || cv.width !== pw) cv.width = pw;
        if (force || cv.height !== ph) cv.height = ph;
        w = pw; h = ph;
      }
    }

    // Scale a "1920×1080 at this DPR" reference by actual area, so small
    // previews don't render far denser than a full Docs page.
    function areaScale() {
      const ref = (1920 * dpr) * (1080 * dpr);
      return clamp((w * h) / ref, 0.08, 4);
    }

    // ---- star / node sprites -----------------------------------------
    // Rendering 300+ arcs per frame as separate canvas calls is the single
    // most expensive part of "stars" and "network". A 4×4 (×dpr) pre-baked
    // radial gradient sprite is drawn with drawImage — orders of magnitude
    // cheaper, and can be re-used for both effects.
    function rebuildSprites(color) {
      if (spriteColor === color) return;
      spriteColor = color;

      const size = Math.max(6, Math.ceil(6 * dpr));
      sprite = document.createElement('canvas');
      sprite.width = sprite.height = size;
      const sctx = sprite.getContext('2d');
      const g = sctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, size, size);

      nodeSprite = document.createElement('canvas');
      nodeSprite.width = nodeSprite.height = size;
      const nctx = nodeSprite.getContext('2d');
      nctx.drawImage(sprite, 0, 0);
    }

    // ---- canvas simulations -------------------------------------------
    function initSim() {
      sim = null;
      if (!S || !ctx) return;

      const speed = S.speed;
      const density = S.density;
      const cols = S.colors;

      switch (mode) {
        case 'stars': {
          // UPDATED: Increased base count from 60->120 and density multiplier from 5->8
          const n = Math.max(20, Math.round((120 + density * 8) * areaScale()));
          const px = new Float32Array(n);
          const py = new Float32Array(n);
          const pz = new Float32Array(n);
          const pp = new Float32Array(n);
          for (let i = 0; i < n; i++) {
            px[i] = Math.random() * w;
            py[i] = Math.random() * h;
            pz[i] = 0.25 + Math.random() * 0.75;
            pp[i] = Math.random() * TAU;
          }
          sim = { n, px, py, pz, pp };
          break;
        }

        case 'matrix': {
          const fs = Math.max(10, Math.round((22 - density * 0.1) * dpr));
          const n = Math.max(1, Math.ceil(w / fs));
          const d = new Float32Array(n);
          for (let i = 0; i < n; i++) d[i] = Math.random() * (h / fs);
          sim = { fs, acc: 0, n, d };
          ST.mgFont = fs + 'px monospace';
          ST.mgFadeStyle = 'rgba(0,0,0,0.1)';
          ST.fontSize = fs;
          break;
        }

        case 'network': {
          // UPDATED: Increased base count from 25->50 and density multiplier from 1.3->2
          const n = Math.max(10, Math.round((50 + density * 2) * areaScale()));
          const px = new Float32Array(n);
          const py = new Float32Array(n);
          const pvx = new Float32Array(n);
          const pvy = new Float32Array(n);
          for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU;
            const sp = (10 + speed * 0.8) * dpr * (0.4 + Math.random());
            px[i] = Math.random() * w;
            py[i] = Math.random() * h;
            pvx[i] = Math.cos(a) * sp;
            pvy[i] = Math.sin(a) * sp;
          }
          sim = {
            n, px, py, pvx, pvy,
            link: Math.min(150 * dpr, Math.min(w, h) * 0.3)
          };
          break;
        }

        case 'plasma': {
          const list = cols.length > 1 ? cols.concat(cols[0]) : [cols[0], cols[0]];
          const lut = new Uint8Array(256 * 3);
          for (let i = 0; i < 256; i++) {
            const pos = (i / 255) * (list.length - 1);
            const k = Math.min(list.length - 2, Math.floor(pos));
            const f = pos - k;
            const a = hex(list[k]);
            const b = hex(list[k + 1]);
            for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(lerp(a[c], b[c], f));
          }
          sim = { lut, t: 0, img: ctx.createImageData(128, 72) };
          break;
        }
      }

      // Rebuild sprites whenever the effect colour changes.
      if (mode === 'stars' || mode === 'network') rebuildSprites(S.fxColor);
    }

    function step(dt) {
      if (!ctx || !sim || !S) return;
      const speed = S.speed;
      const inten = S.intensity / 100;
      const fxc = S.fxColor;

      switch (mode) {
        case 'stars': {
          ctx.clearRect(0, 0, w, h);
          const v = (8 + speed * 1.2) * dpr;
          const n = sim.n;
          const px = sim.px, py = sim.py, pz = sim.pz, pp = sim.pp;
          const size = sprite.width;
          for (let i = 0; i < n; i++) {
            let x = px[i] - v * pz[i] * dt;
            if (x < -2) { x = w + 2; py[i] = Math.random() * h; pz[i] = 0.25 + Math.random() * 0.75; }
            px[i] = x;

            const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (0.8 + pz[i] * 2) + pp[i]));
            ctx.globalAlpha = clamp(tw * (0.25 + inten * 0.75), 0, 1);
            const s = size * pz[i];
            ctx.drawImage(sprite, x - s / 2, py[i] - s / 2, s, s);
          }
          ctx.globalAlpha = 1;
          break;
        }

        case 'matrix': {
          sim.acc += dt;
          if (sim.acc < lerp(0.14, 0.02, speed / 100)) break;
          sim.acc = 0;

          if (ST.lastComp !== 'destination-out') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = ST.mgFadeStyle;
            ST.lastComp = 'destination-out';
          }
          ctx.fillRect(0, 0, w, h);

          if (ST.lastComp !== 'source-over') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = fxc;
            ST.lastComp = 'source-over';
          }

          if (ctx.font !== ST.mgFont) ctx.font = ST.mgFont;
          ctx.textBaseline = 'top';
          ctx.globalAlpha = clamp(0.25 + inten * 0.75, 0, 1);

          const fs = sim.fs;
          const n = sim.n;
          const d = sim.d;
          const whiteThresh = 0.06;

          for (let i = 0; i < n; i++) {
            const p = d[i];
            const y = p * fs;
            if (y > h && (Math.random() < 0.08 || y > h * 3)) { d[i] = -Math.random() * 12; continue; }
            if (y > -fs) {
              const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
              ctx.fillStyle = Math.random() < whiteThresh ? '#ffffff' : fxc;
              ctx.fillText(ch, i * fs, y);
            }
            d[i] = p + 1;
          }
          ctx.globalAlpha = 1;
          break;
        }

        case 'network': {
          ctx.clearRect(0, 0, w, h);
          const n = sim.n;
          const px = sim.px, py = sim.py, pvx = sim.pvx, pvy = sim.pvy;
          const link = sim.link;
          const link2 = link * link;

          for (let i = 0; i < n; i++) {
            let x = px[i] + pvx[i] * dt;
            let y = py[i] + pvy[i] * dt;
            if (x < 0) { x = 0; pvx[i] = Math.abs(pvx[i]); }
            else if (x > w) { x = w; pvx[i] = -Math.abs(pvx[i]); }
            if (y < 0) { y = 0; pvy[i] = Math.abs(pvy[i]); }
            else if (y > h) { y = h; pvy[i] = -Math.abs(pvy[i]); }
            px[i] = x; py[i] = y;
          }

          ctx.strokeStyle = fxc;
          ctx.lineWidth = Math.max(1, dpr * 0.8);
          const linkAlphaK = 0.6 * (0.3 + inten * 0.7);

          for (let i = 0; i < n; i++) {
            const xi = px[i], yi = py[i];
            for (let j = i + 1; j < n; j++) {
              const dx = xi - px[j], dy = yi - py[j];
              const d2 = dx * dx + dy * dy;
              if (d2 < link2) {
                const d = Math.sqrt(d2);
                ctx.globalAlpha = clamp((1 - d / link) * linkAlphaK, 0, 1);
                ctx.beginPath();
                ctx.moveTo(xi, yi);
                ctx.lineTo(px[j], py[j]);
                ctx.stroke();
              }
            }
          }

          ctx.globalAlpha = clamp(0.4 + inten * 0.6, 0, 1);
          const size = nodeSprite.width;
          const s = 1.8 * dpr * 2;    // radius × 2 == diameter, plus glow padding
          for (let i = 0; i < n; i++) {
            ctx.drawImage(nodeSprite, px[i] - s / 2, py[i] - s / 2, s, s);
          }
          ctx.globalAlpha = 1;
          break;
        }

        case 'plasma': {
          sim.t += dt * lerp(0.15, 1.8, speed / 100);
          const tt = sim.t;
          const d = sim.img.data;
          const lut = sim.lut;
          let o = 0;
          for (let y = 0; y < 72; y++) {
            for (let x = 0; x < 128; x++, o += 4) {
              const dx = x - 64, dy = y - 36;
              let v = Math.sin(x * 0.08 + tt) + Math.sin(y * 0.09 - tt * 1.3) +
                      Math.sin((x + y) * 0.05 + tt * 0.7) +
                      Math.sin(Math.sqrt(dx * dx + dy * dy) * 0.1 - tt);
              v = clamp((v + 4) / 8, 0, 1);
              const li = ((v * 255) | 0) * 3;
              d[o] = lut[li]; d[o + 1] = lut[li + 1]; d[o + 2] = lut[li + 2]; d[o + 3] = 255;
            }
          }
          ctx.putImageData(sim.img, 0, 0);
          break;
        }
      }
    }

    // ---- loop ---------------------------------------------------------
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      if (!S || !sim || !ctx || paused) return;
      const iv = 1000 / (S.fps || 30);
      if (last && ts - last < iv) return;
      const dt = last ? Math.min((ts - last) / 1000, 0.1) : 1 / 60;
      last = ts;
      t += dt;
      step(dt);
    }

    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

    function warm() {
      if (!sim || !ctx) return;
      const n = mode === 'matrix' ? 80 : 1;
      for (let i = 0; i < n; i++) { t += 0.05; step(mode === 'matrix' ? 1 : 0.03); }
    }

    // ---- visibility ---------------------------------------------------
    // On a hidden tab, stop the loop entirely. Everything on screen is stale
    // anyway; the browser already paints the last frame at zero cost. This is
    // the biggest single battery / RAM saver.
    function setPaused(p) {
      if (paused === p) return;
      paused = p;
      if (paused) { stop(); }
      else if (S && S.animate && mode && ctx) { last = 0; raf = requestAnimationFrame(frame); }
    }
    function onVis() { setPaused(document.hidden); }
    document.addEventListener('visibilitychange', onVis);
    setPaused(document.hidden);

    // ---- resize -------------------------------------------------------
    function onResize() {
      if (!mode || rRaf) return;
      rRaf = requestAnimationFrame(() => {
        rRaf = 0;
        if (!mode) return;
        const ow = w, oh = h;
        resize(false);
        if (w === ow && h === oh) return;
        initSim();
        if (S && !S.animate) warm();
        if (paused) setPaused(false); // re-request rAF on next tick after resize
      });
    }

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize);
      ro.observe(host);
    } else {
      window.addEventListener('resize', onResize, { passive: true });
    }

    function startCanvas(type) {
      mode = type;
      cv.style.display = 'block';
      resize(true);
      if (!ctx) ctx = cv.getContext('2d', { alpha: true, desynchronized: true });
      if (!ctx) { mode = ''; return; }
      initSim();
      t = 0; last = 0;
      if (!S.animate) warm();
      else if (!paused) raf = requestAnimationFrame(frame);
    }

    // ---- public API ---------------------------------------------------
    function update(bg, imgSrc) {
      stop();
      S = null;
      mode = '';
      sim = null;
      sprite = null;
      nodeSprite = null;
      spriteColor = '';

      base.style.cssText = 'position:absolute;inset:0;';
      fx.textContent = '';
      dim.style.opacity = '0';
      cv.style.display = 'none';
      cv.style.opacity = '1';
      ST.lastComp = 'source-over';

      if (!bg) return;

      const colors = (Array.isArray(bg.colors) ? bg.colors : []).filter(c => typeof c === 'string' && c.trim());
      if (!colors.length) colors.push('#000000');

      S = {
        type: String(bg.type || 'solid'),
        colors,
        angle: num(bg.angle, 180),
        speed: clamp(num(bg.speed, 30), 0, 100),
        intensity: clamp(num(bg.intensity, 50), 0, 100),
        density: clamp(num(bg.density, 50), 0, 100),
        fps: clamp(num(bg.fps, 30), 1, 120),
        fxColor: (typeof bg.fxColor === 'string' && bg.fxColor) ? bg.fxColor : '#ffffff',
        animate: bg.animate !== false,
        imageFit: ['cover', 'contain', 'fill'].indexOf(bg.imageFit) >= 0 ? bg.imageFit : 'cover',
        imageBlur: clamp(num(bg.imageBlur, 0), 0, 200),
        imageDim: clamp(num(bg.imageDim, 0), 0, 100)
      };

      const speed = S.speed;
      const inten = S.intensity / 100;
      const run = S.animate ? 'running' : 'paused';
      const lin = (a, list) => 'linear-gradient(' + a + 'deg,' + list.join(',') + ')';

      switch (S.type) {
        case 'gradient':
          base.style.background = colors.length > 1 ? lin(S.angle, colors) : colors[0];
          break;

        case 'animated-gradient': {
          const list = colors.length > 1 ? colors.concat(colors[0]) : [colors[0], colors[0]];
          base.style.background = lin(S.angle, list);
          base.style.backgroundSize = '300% 300%';
          base.style.animation = 'ddk-grad ' + secs(speed, 140, 8) + 's ease-in-out infinite';
          base.style.animationPlayState = run;
          break;
        }

        case 'aurora': {
          base.style.background = colors[0];
          const blobs = colors.length > 1 ? colors.slice(1) : colors;
          blobs.forEach((c, i) => {
            const d = document.createElement('div');
            const p = POS[i % POS.length];
            d.style.cssText = 'position:absolute;left:' + p[0] + '%;top:' + p[1] + '%;' +
              'width:62%;height:70%;border-radius:50%;' +
              'background:radial-gradient(closest-side,' + c + ',transparent);' +
              'filter:blur(30px);mix-blend-mode:screen;will-change:transform;' +
              'opacity:' + clamp(0.25 + inten * 0.75, 0, 1) + ';';
            d.style.setProperty('--dx1', ((i * 41) % 70 - 35) + '%');
            d.style.setProperty('--dy1', ((i * 29) % 60 - 30) + '%');
            d.style.setProperty('--dx2', ((i * 17 + 23) % 70 - 35) + '%');
            d.style.setProperty('--dy2', ((i * 53 + 11) % 60 - 30) + '%');
            d.style.animation = 'ddk-drift ' + (secs(speed, 90, 10) * (0.8 + i * 0.15)) + 's ease-in-out infinite';
            d.style.animationPlayState = run;
            fx.appendChild(d);
          });
          break;
        }

        case 'image': {
          base.style.background = colors[0];
          const fit = S.imageFit;
          const blur = S.imageBlur;
          if (typeof imgSrc === 'string' && imgSrc) {
            const im = document.createElement('div');
            im.style.cssText = 'position:absolute;inset:' + (blur ? -blur * 2 : 0) + 'px;' +
              'background-image:' + cssUrl(imgSrc) + ';' +
              'background-size:' + (fit === 'fill' ? '100% 100%' : fit) + ';' +
              'background-position:center;background-repeat:no-repeat;' +
              (blur ? 'filter:blur(' + blur + 'px);' : '');
            fx.appendChild(im);
          }
          dim.style.opacity = String(S.imageDim / 100);
          break;
        }

        case 'stars':
        case 'matrix':
        case 'network':
          base.style.background = colors.length > 1 ? lin(S.angle, colors) : colors[0];
          startCanvas(S.type);
          break;

        case 'plasma':
          base.style.background = colors[0];
          startCanvas('plasma');
          cv.style.opacity = String(clamp(0.25 + inten * 0.75, 0, 1));
          break;

        default:
          base.style.background = colors[0];
      }
    }

    function destroy() {
      stop();
      if (rRaf) { cancelAnimationFrame(rRaf); rRaf = 0; }
      if (ro) { ro.disconnect(); ro = null; }
      else window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      S = null; sim = null; ctx = null; sprite = null; nodeSprite = null;
      mode = '';
      if (rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
    }

    return { update, destroy };
  }

  root.DDBg = { create };
})(typeof self !== 'undefined' ? self : globalThis);