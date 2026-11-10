/* Docs Afterglow: typing effects, typing sounds and background music.
 *
 * Everything here is OFF by default.
 *  - Effects are drawn on one click-through canvas at your cursor.
 *  - Sounds are synthesized live (audio.js): no audio files, nothing downloaded.
 *  - Music plays what YOU choose: a link (YouTube, Spotify, SoundCloud or a direct audio file) or audio files you add.
 *    YouTube/Spotify/SoundCloud links show in a small visible player in the corner; audio files play from the
 *    extension's background page. The extension itself makes no network requests: the player you pick does.
 *
 * Keystrokes: a keydown listener only sorts each key into "letter/number", "space", "enter" or "backspace" so the right
 * sound or effect plays. The key itself is never stored, logged or sent anywhere.
 */
(function () {
  'use strict';
  if (window.__ddFxLoaded) return;
  window.__ddFxLoaded = true;

  const API = (typeof browser !== 'undefined' && browser.storage) ? browser
            : (typeof chrome !== 'undefined' && chrome.storage) ? chrome : null;
  const DD = window.DD;
  if (!API || !DD) return;

  let S = null;                       // full, sanitized settings
  const isEditor = () => /\/(document|presentation)\/(u\/\d+\/)?d\//.test(location.pathname);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const safe = (fn) => function () { try { return fn.apply(this, arguments); } catch (e) { /* never break Docs */ } };

  /* =====================================================================  typing effects */
  const FX = (function () {
    let cv = null, cx = null, raf = 0, parts = [], dpr = 1, lastCaret = null, W = 0, H = 0;
    const stats = { emits: 0, caret: '', lastError: '' };
    const MAXP = 360;

    function ensure() {
      if (cv && cv.isConnected) return true;
      if (!document.documentElement) return false;
      cv = document.createElement('canvas');
      cv.id = 'dd-fx';
      cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000;';
      document.documentElement.appendChild(cv);
      cx = cv.getContext('2d');
      resize();
      return !!cx;
    }
    function resize() {
      if (!cv) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    window.addEventListener('resize', safe(resize), { passive: true });

    let ptr = null, prevEmit = null, slideEl = null;
    const trackPtr = (e) => { ptr = { x: e.clientX, y: e.clientY, h: 18 }; lastCaret = null; prevEmit = null; };
    document.addEventListener('pointerdown', trackPtr, true);

    // Google Slides draws text and its caret inside an SVG, not as .kix-cursor. The exact class name is not
    // documented, so look for a THIN element whose class or id says cursor/caret inside the slide workspace.
    const isSlidesPage = () => location.pathname.indexOf('/presentation/') === 0;
    const MOUSE_CURSOR = /(^|[\s_-])cursor-(default|pointer|text|move|crosshair|auto|grab|grabbing|none)\b/i;
    function thinRect(r) { return r && r.width <= 6 && r.height >= 8 && r.height <= 320 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth; }
    function slideCaret() {
      const root = document.querySelector('#workspace-container, #workspace, #canvas-container, #slides-view');
      if (!root) return null;
      if (slideEl && slideEl.isConnected) {
        const r = slideEl.getBoundingClientRect();
        if (thinRect(r)) return r;
      }
      slideEl = null;
      let hit = null;
      const list = root.querySelectorAll('[class*="cursor" i], [class*="caret" i], [id*="cursor" i], [id*="caret" i]');
      for (let i = 0; i < list.length && i < 400; i++) {
        const el = list[i], cn = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
        if (MOUSE_CURSOR.test(cn)) continue;
        const r = el.getBoundingClientRect();
        if (!thinRect(r)) continue;
        let cs = null; try { cs = getComputedStyle(el); } catch (e) { /* ignore */ }
        if (cs && (cs.display === 'none')) continue;
        hit = el; break;
      }
      if (hit) { slideEl = hit; return hit.getBoundingClientRect(); }
      return null;
    }
    function caret() {
      // Docs draws the local caret as .kix-cursor-caret inside a .kix-cursor (collaborators get a name label).
      let named = null, plain = null;
      document.querySelectorAll('.kix-cursor').forEach((c) => {
        const r = (c.querySelector('.kix-cursor-caret') || c).getBoundingClientRect();
        if (!(r.width || r.height) || r.bottom < 0 || r.top > window.innerHeight) return;
        const nm = c.querySelector('.kix-cursor-name');
        if (nm && nm.textContent.trim()) { if (!named) named = r; } else if (!plain) plain = r;
      });
      let best = plain || named;
      if (!best && isSlidesPage()) best = slideCaret();
      if (best) { lastCaret = { x: best.left + best.width / 2, y: best.top + best.height / 2, h: Math.max(10, best.height) }; stats.caret = 'caret'; return lastCaret; }
      if (isSlidesPage()) {
        // No caret element found: follow the place the user clicked, moving a little with each letter, rather than
        // flashing effects at a stale spot.
        if (ptr) { stats.caret = 'pointer'; return ptr; }
        stats.caret = 'none';
        return null;
      }
      if (lastCaret) { stats.caret = 'last'; return lastCaret; }
      if (ptr) { stats.caret = 'pointer'; return ptr; }
      stats.caret = 'none';
      return null;
    }
    function nudgePointer(type) {      // only used when no caret element could be found (see caret())
      if (!ptr || stats.caret !== 'pointer') return;
      if (type === 'key') ptr.x += ptr.h * 0.5;
      else if (type === 'space') ptr.x += ptr.h * 0.3;
      else if (type === 'back') ptr.x = Math.max(0, ptr.x - ptr.h * 0.5);
      else if (type === 'enter') ptr.y += ptr.h * 1.2;
    }

    function palette(i) {
      const mode = S.fx.color;
      if (mode === 'white') return '#ffffff';
      if (mode === 'rainbow') return 'hsl(' + ((Date.now() / 6 + i * 37) % 360 | 0) + ',95%,65%)';
      if (mode === 'theme') return (S.bg && S.bg.fxColor) || S.accent;
      return S.accent;
    }
    const WARM = ['#ff9a3c', '#ffcf5a', '#ff6a2b', '#ffd9a0'];
    const PETAL = ['#ffb7d1', '#ff9ec4', '#ffd1e3', '#ffc2d9'], LEAF = ['#e8893a', '#c9602a', '#f2b24a', '#a8442a', '#d9a03a'];
    const FIRE = ['#ffd45a', '#ff9a2e', '#ff6a1f', '#ff4a1a'], GREENS = ['#7dffa6', '#3dff7a', '#a8ffc4'], FLY = ['#e9ff8a', '#c8ff6a', '#fff3a0'];
    const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽ0123456789';
    const natural = () => S.fx.color === 'accent';

    function add(p) { if (parts.length < MAXP) parts.push(p); }

    /* ---- simple, calm effects: no particles, just a soft fade right where you type -------------------------------
     *  fadein : a veil in the page color sits on the new letter and melts away, so letters seem to fade in.
     *           Only used on a plain page (Docs, solid color); otherwise a gentle color wash that fades out is used.
     *  fadeout: a soft glow follows the letters you just typed and fades out behind the caret.
     */
    function canVeil() {
      const p = S.page || {};
      return !isSlidesPage() && p.type === 'solid' && +p.opacity >= 60 && typeof p.bg === 'string';
    }
    function simple(kind, c, prev, type) {
      const I = Math.max(0, Math.min(1, S.fx.intensity / 100)), h = Math.max(12, c.h);
      const sameLine = !!prev && Math.abs(prev.y - c.y) < h * 0.5;
      const dx = sameLine ? c.x - prev.x : 0;
      if (kind === 'fadein') {
        if (type !== 'key') return;                                   // spaces, Enter and deletes have nothing to fade in
        const w = (dx > 2 && dx < h * 1.6) ? dx : h * 0.5;
        if (canVeil()) add({ k: 'fi', vx: 0, vy: 0, g: 0, x: c.x - w - 1, y: c.y - h / 2 - 1, w: w - 1.5, h: h + 2, life: 240 + I * 320, age: 0, amp: 0.85, col: S.page.bg });
        else add({ k: 'fw', vx: 0, vy: 0, g: 0, x: c.x - w, y: c.y - h / 2, w, h, life: 420 + I * 300, age: 0, amp: 0.14 + I * 0.3, col: palette(0) });
        return;
      }
      const back = type === 'back';
      const x1 = c.x, x0 = (dx > 2 && dx < h * 6) ? prev.x : c.x - h * 0.5;
      add({ k: 'ft', vx: 0, vy: 0, g: 0, x: Math.min(x0, x1) - h * 0.7, x1: Math.max(x0, x1) + 1, y: c.y, h, life: 650 + I * 550, age: 0, amp: (0.16 + I * 0.34) * (back ? 0.6 : 1), col: palette(0) });
    }

    function burst(kind, x, y, n, type, tier) {
      const big = type === 'enter' ? 1.8 : type === 'back' ? 0.5 : type === 'space' ? 0.7 : 1;
      const count = Math.max(1, Math.round(n * big));
      for (let i = 0; i < count; i++) {
        const col = palette(i);
        if (kind === 'sparks') {
          const a = rnd(-Math.PI, 0) + (type === 'back' ? Math.PI : 0), v = rnd(1.2, 3.6 + tier * 0.4);
          add({ k: 's', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.09, life: rnd(380, 720), age: 0, size: rnd(1.1, 2.4), col });
        } else if (kind === 'confetti') {
          const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(2, 5.2);
          add({ k: 'c', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.12, life: rnd(800, 1300), age: 0, size: rnd(3, 6), rot: rnd(0, 6.28), vr: rnd(-0.3, 0.3),
                col: S.fx.color === 'accent' ? 'hsl(' + ((Math.random() * 360) | 0) + ',90%,62%)' : col });
        } else if (kind === 'embers') {
          add({ k: 'e', x: x + rnd(-6, 6), y, vx: rnd(-0.4, 0.4), vy: rnd(-1.6, -0.5), g: -0.004, life: rnd(700, 1400), age: 0, size: rnd(1.2, 2.8), ph: rnd(0, 6.28),
                col: S.fx.color === 'accent' ? pick(WARM) : col });
        } else if (kind === 'stardust') {
          add({ k: 't', x: x + rnd(-10, 10), y: y + rnd(-12, 6), vx: rnd(-0.3, 0.3), vy: rnd(-0.5, 0.1), g: 0, life: rnd(600, 1100), age: 0, size: rnd(3, 7), ph: rnd(0, 6.28), col });
        } else if (kind === 'hearts') {
          add({ k: 'h', x: x + rnd(-8, 8), y, vx: rnd(-0.5, 0.5), vy: rnd(-1.6, -0.7), g: -0.002, life: rnd(800, 1300), age: 0, size: rnd(5, 10),
                col: S.fx.color === 'accent' ? pick(['#ff7aa8', '#ff5c8a', '#ffa3c4', S.accent]) : col });
        }
      }
      for (let i = 0; i < count; i++) {
        const col = palette(i);
        if (kind === 'petals') {
          add({ k: 'pt', x: x + rnd(-8, 8), y, vx: rnd(-0.9, 0.9), vy: rnd(-1.8, -0.3), g: 0.022, life: rnd(1300, 2200), age: 0, size: rnd(4, 8), rot: rnd(0, 6.28), vr: rnd(-0.1, 0.1), ph: rnd(0, 6.28),
                col: natural() ? pick(PETAL) : col });
        } else if (kind === 'snow') {
          add({ k: 'sn', x: x + rnd(-14, 14), y: y + rnd(-6, 4), vx: rnd(-0.25, 0.25), vy: rnd(0.15, 0.7), g: 0.004, life: rnd(1400, 2400), age: 0, size: rnd(1.3, 3.4), ph: rnd(0, 6.28),
                col: natural() ? '#ffffff' : col });
        } else if (kind === 'bubbles') {
          add({ k: 'bb', x: x + rnd(-8, 8), y, vx: rnd(-0.3, 0.3), vy: rnd(-1.5, -0.6), g: -0.004, life: rnd(1100, 1900), age: 0, size: rnd(3, 9), ph: rnd(0, 6.28),
                col: natural() ? '#bfeaff' : col });
        } else if (kind === 'notes') {
          add({ k: 'nt', x: x + rnd(-8, 8), y, vx: rnd(-0.4, 0.4), vy: rnd(-1.4, -0.7), g: -0.002, life: rnd(1100, 1700), age: 0, size: rnd(13, 20), ph: rnd(0, 6.28), ch: pick(['\u266A', '\u266B', '\u2669']), col });
        } else if (kind === 'leaves') {
          add({ k: 'lf', x: x + rnd(-8, 8), y, vx: rnd(-1, 1), vy: rnd(-1.6, -0.3), g: 0.03, life: rnd(1300, 2100), age: 0, size: rnd(4, 8), rot: rnd(0, 6.28), vr: rnd(-0.14, 0.14), ph: rnd(0, 6.28),
                col: natural() ? pick(LEAF) : col });
        } else if (kind === 'pixels') {
          const a = rnd(-Math.PI, 0) + (type === 'back' ? Math.PI : 0), v = rnd(1.2, 3.8);
          add({ k: 'px', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.11, life: rnd(500, 900), age: 0, size: pick([3, 3, 4, 5]), col });
        } else if (kind === 'fireflies') {
          add({ k: 'ff', x: x + rnd(-14, 14), y: y + rnd(-10, 6), vx: rnd(-0.4, 0.4), vy: rnd(-0.5, 0.3), g: 0, life: rnd(1500, 2600), age: 0, size: rnd(1.6, 3), ph: rnd(0, 6.28),
                col: natural() ? pick(FLY) : col });
        } else if (kind === 'flames') {
          add({ k: 'fl', x: x + rnd(-5, 5), y, vx: rnd(-0.4, 0.4), vy: rnd(-2.3, -0.9), g: -0.01, life: rnd(420, 820), age: 0, size: rnd(3, 7), ph: rnd(0, 6.28), col: natural() ? FIRE[0] : col });
        } else if (kind === 'glyphs') {
          add({ k: 'gy', x: x + rnd(-14, 14), y: y - rnd(0, 10), vx: 0, vy: rnd(0.7, 1.7), g: 0, life: rnd(700, 1200), age: 0, size: rnd(10, 15), ch: GLYPHS.charAt((Math.random() * GLYPHS.length) | 0), col: natural() ? pick(GREENS) : col });
        }
      }
      if (kind === 'shockwave') {
        add({ k: 'sw', x, y, vx: 0, vy: 0, g: 0, life: type === 'enter' ? 760 : 560, age: 0, size: type === 'enter' ? 160 : 90, col: palette(0) });
        add({ k: 'sw', x, y, vx: 0, vy: 0, g: 0, life: type === 'enter' ? 920 : 700, age: -120, size: type === 'enter' ? 110 : 60, col: palette(1) });
      }
      if (kind === 'ripple') add({ k: 'r', x, y, vx: 0, vy: 0, g: 0, life: type === 'enter' ? 700 : 520, age: 0, size: type === 'enter' ? 70 : 38, col: palette(0) });
      if (kind === 'glow')   add({ k: 'g', x, y, vx: 0, vy: 0, g: 0, life: 420, age: 0, size: 26 + tier * 9 + (type === 'enter' ? 18 : 0), col: palette(0) });
    }

    function draw(dt, now) {
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.clearRect(0, 0, W, H);
      cx.globalCompositeOperation = 'lighter';
      const f = dt / 16.67;
      parts = parts.filter((p) => {
        p.age += dt;
        if (p.age >= p.life) return false;
        const t = p.age / p.life, a = 1 - t;
        p.vy += p.g * f; p.x += p.vx * f; p.y += p.vy * f;
        if (p.k === 'e') p.x += Math.sin(now / 160 + p.ph) * 0.35;
        cx.globalAlpha = Math.max(0, a);
        cx.fillStyle = p.col; cx.strokeStyle = p.col;
        if (p.k === 's' || p.k === 'e') {
          cx.beginPath(); cx.arc(p.x, p.y, p.size * (p.k === 'e' ? a + 0.3 : 1), 0, 6.283); cx.fill();
        } else if (p.k === 'c') {
          p.rot += p.vr * f; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6); cx.restore();
        } else if (p.k === 't') {
          const s = p.size * (0.5 + 0.5 * Math.sin(now / 90 + p.ph)) * (0.4 + a);
          cx.beginPath(); cx.moveTo(p.x, p.y - s); cx.lineTo(p.x + s * 0.28, p.y - s * 0.28); cx.lineTo(p.x + s, p.y);
          cx.lineTo(p.x + s * 0.28, p.y + s * 0.28); cx.lineTo(p.x, p.y + s); cx.lineTo(p.x - s * 0.28, p.y + s * 0.28);
          cx.lineTo(p.x - s, p.y); cx.lineTo(p.x - s * 0.28, p.y - s * 0.28); cx.closePath(); cx.fill();
        } else if (p.k === 'h') {
          const s = p.size; cx.save(); cx.translate(p.x, p.y); cx.beginPath();
          cx.moveTo(0, s * 0.35); cx.bezierCurveTo(-s, -s * 0.3, -s * 0.45, -s, 0, -s * 0.4);
          cx.bezierCurveTo(s * 0.45, -s, s, -s * 0.3, 0, s * 0.35); cx.fill(); cx.restore();
        } else if (p.k === 'pt' || p.k === 'lf') {
          p.rot += p.vr * f; p.x += Math.sin(now / 240 + p.ph) * 0.45;
          cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.beginPath();
          if (p.k === 'pt') cx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, 6.283);
          else { cx.moveTo(-p.size, 0); cx.quadraticCurveTo(0, -p.size * 0.9, p.size, 0); cx.quadraticCurveTo(0, p.size * 0.9, -p.size, 0); }
          cx.fill(); cx.restore();
        } else if (p.k === 'sn') {
          p.x += Math.sin(now / 420 + p.ph) * 0.3;
          cx.beginPath(); cx.arc(p.x, p.y, p.size, 0, 6.283); cx.fill();
        } else if (p.k === 'bb') {
          p.x += Math.sin(now / 260 + p.ph) * 0.4; cx.globalAlpha = Math.max(0, a * 0.8); cx.lineWidth = 1.2;
          cx.beginPath(); cx.arc(p.x, p.y, p.size * (1 + t * 0.25), 0, 6.283); cx.stroke();
          cx.globalAlpha = Math.max(0, a * 0.5); cx.beginPath(); cx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.18, 0, 6.283); cx.fill();
        } else if (p.k === 'nt' || p.k === 'gy') {
          p.x += (p.k === 'nt' ? Math.sin(now / 300 + p.ph) * 0.5 : 0);
          cx.font = p.size + 'px system-ui, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(p.ch, p.x, p.y);
        } else if (p.k === 'px') {
          const q = 3; cx.fillRect(Math.round(p.x / q) * q, Math.round(p.y / q) * q, p.size, p.size);
        } else if (p.k === 'ff') {
          p.x += Math.sin(now / 500 + p.ph) * 0.35; const pulse = 0.5 + 0.5 * Math.sin(now / 220 + p.ph);
          cx.globalAlpha = Math.max(0, a * (0.35 + pulse * 0.65)); cx.beginPath(); cx.arc(p.x, p.y, p.size, 0, 6.283); cx.fill();
          cx.globalAlpha = Math.max(0, a * 0.18 * pulse); cx.beginPath(); cx.arc(p.x, p.y, p.size * 3.6, 0, 6.283); cx.fill();
        } else if (p.k === 'fl') {
          p.x += Math.sin(now / 90 + p.ph) * 0.5;
          const hot = S.fx.color === 'accent' ? FIRE[Math.min(3, (t * 4) | 0)] : p.col; cx.fillStyle = hot;
          cx.beginPath(); cx.arc(p.x, p.y, p.size * (1 - t * 0.7), 0, 6.283); cx.fill();
        } else if (p.k === 'sw') {
          if (p.age < 0) { p.age += 0; return true; }
          cx.lineWidth = 2.2 * a + 0.4; cx.beginPath(); cx.arc(p.x, p.y, 6 + (p.size - 6) * (1 - a * a * a), 0, 6.283); cx.stroke();
        } else if (p.k === 'r') {
          cx.lineWidth = 1.6 * a + 0.4; cx.beginPath(); cx.arc(p.x, p.y, 4 + (p.size - 4) * (1 - a * a), 0, 6.283); cx.stroke();
        } else if (p.k === 'g') {
          const r = p.size * (0.6 + 0.6 * t), g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          g.addColorStop(0, p.col); g.addColorStop(1, 'rgba(0,0,0,0)');
          cx.globalAlpha = Math.max(0, a * 0.55); cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, r, 0, 6.283); cx.fill();
        } else if (p.k === 'fi') {            // veil over the new letter, melting away
          cx.globalCompositeOperation = 'source-over';
          cx.globalAlpha = Math.max(0, p.amp * Math.pow(a, 1.4)); cx.fillStyle = p.col;
          cx.fillRect(p.x, p.y, p.w, p.h);
          cx.globalCompositeOperation = 'lighter';
        } else if (p.k === 'fw') {            // soft color wash that fades out
          cx.globalAlpha = Math.max(0, p.amp * a * a); cx.fillStyle = p.col;
          cx.fillRect(p.x, p.y, p.w, p.h);
        } else if (p.k === 'ft') {            // glow that trails the typed letters and fades out
          const g = cx.createLinearGradient(p.x, 0, p.x1, 0);
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, p.col);
          cx.globalAlpha = Math.max(0, p.amp * a * a); cx.fillStyle = g;
          cx.fillRect(p.x, p.y - p.h * 0.45, p.x1 - p.x, p.h * 0.9);
        }
        return true;
      });
      cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
    }

    let last = 0;
    function frame(now) {
      raf = 0;
      if (!cx || !parts.length || document.hidden) { if (cx) cx.clearRect(0, 0, W, H); return; }
      draw(Math.min(48, last ? now - last : 16.7), now);
      last = now;
      if (parts.length) raf = requestAnimationFrame(frame); else { cx.clearRect(0, 0, W, H); last = 0; }
    }

    function emit(type, tier) {
      if (!S.fx.enabled || document.hidden || !ensure()) return;
      const kind = S.fx.kind, calm = kind === 'fadein' || kind === 'fadeout' || kind === 'glow' || kind === 'ripple';
      if (!calm && reducedMotion()) return;                    // particles respect "reduce motion"; the calm fades do not move
      const c = caret();
      if (!c) return;
      stats.emits++;
      const prev = prevEmit;
      prevEmit = { x: c.x, y: c.y, h: c.h };
      if (kind === 'fadein' || kind === 'fadeout') simple(kind, c, prev, type);
      else burst(kind, c.x, c.y + c.h * 0.15, Math.round(2 + (S.fx.intensity / 100) * 9) + tier * 2, type, tier);
      nudgePointer(type);
      if (!raf) raf = requestAnimationFrame(frame);
    }
    function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
    function stop() {
      parts = []; prevEmit = null; if (raf) cancelAnimationFrame(raf); raf = 0;
      if (cv) { cv.remove(); cv = null; cx = null; }
    }
    return { emit: function (t, k) { try { emit(t, k); } catch (e) { stats.lastError = String(e && e.message); } }, stop, stats };
  })();

  /* =====================================================================  music */
  const Music = (function () {
    let box = null, frame = null, info = null, ytOrigin = '', dismissed = false, big = true, err = null;

    const embedUrl = (i) => {
      const org = encodeURIComponent(location.origin);
      if (i.kind === 'youtube') {
        const base = 'https://www.youtube-nocookie.com/embed/';
        const q = 'autoplay=1&enablejsapi=1&playsinline=1&rel=0&origin=' + org;
        if (i.list) return base + (i.id || 'videoseries') + '?list=' + encodeURIComponent(i.list) + '&loop=1&' + q;
        return base + i.id + '?loop=1&playlist=' + i.id + '&' + q;
      }
      if (i.kind === 'spotify') return 'https://open.spotify.com/embed/' + i.type + '/' + i.id + '?utm_source=generator&theme=0';
      if (i.kind === 'soundcloud') return 'https://w.soundcloud.com/player/?auto_play=true&visual=false&url=' + encodeURIComponent(i.url);
      return '';
    };

    function ytCmd(func, args) {
      if (!frame || !frame.contentWindow || info.kind !== 'youtube') return;
      try { frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), 'https://www.youtube-nocookie.com'); } catch (e) { /* ignore */ }
    }
    function volume() { ytCmd('setVolume', [Math.round(S.music.volume)]); }

    function remove() { if (box) { box.remove(); box = null; frame = null; } }

    function build() {
      remove();
      box = document.createElement('div');
      box.id = 'dd-music';
      const w = info.kind === 'spotify' ? 300 : 280;
      box.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483000;width:' + w + 'px;border-radius:12px;overflow:hidden;' +
        'background:#14161c;color:#e8eaed;border:1px solid rgba(255,255,255,.16);box-shadow:0 8px 28px rgba(0,0,0,.5);font:12px system-ui,sans-serif;';
      const bar = document.createElement('div');
      bar.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 8px;cursor:grab;user-select:none;background:rgba(255,255,255,.06);';
      const title = document.createElement('span'); title.textContent = '\u266A ' + info.label; title.style.cssText = 'flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      const mk = (txt, label, fn) => { const b = document.createElement('button'); b.textContent = txt; b.setAttribute('aria-label', label); b.title = label;
        b.style.cssText = 'border:0;background:transparent;color:inherit;cursor:pointer;font-size:14px;line-height:1;padding:2px 5px;border-radius:5px;'; b.addEventListener('click', fn); return b; };
      const sizeBtn = mk('\u2195', 'Make the player smaller or larger', () => { big = !big; frame.style.height = height() + 'px'; });
      const closeBtn = mk('\u00d7', 'Close the music player', () => { dismissed = true; remove(); });
      bar.append(title, sizeBtn, closeBtn);
      let drag = null;
      bar.addEventListener('pointerdown', (e) => { if (e.target.tagName === 'BUTTON') return; const r = box.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; bar.setPointerCapture(e.pointerId); bar.style.cursor = 'grabbing'; });
      bar.addEventListener('pointermove', (e) => { if (!drag) return; box.style.left = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - drag.dx)) + 'px'; box.style.top = Math.max(0, Math.min(window.innerHeight - 30, e.clientY - drag.dy)) + 'px'; box.style.bottom = 'auto'; });
      bar.addEventListener('pointerup', () => { drag = null; bar.style.cursor = 'grab'; });
      frame = document.createElement('iframe');
      frame.src = embedUrl(info);
      frame.title = 'Music player';
      frame.setAttribute('allow', 'autoplay; encrypted-media');
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox allow-forms');
      frame.style.cssText = 'display:block;width:100%;border:0;height:' + height() + 'px;';
      frame.addEventListener('load', () => { volume(); setTimeout(volume, 1500); });
      box.append(bar, frame);
      document.documentElement.appendChild(box);
    }
    const height = () => info.kind === 'spotify' ? (info.type === 'track' || info.type === 'episode' ? 80 : (big ? 152 : 80)) : info.kind === 'soundcloud' ? (big ? 120 : 66) : (big ? 158 : 90);

    function showError(msg) {
      if (!box) return;
      let n = box.querySelector('.dd-err');
      if (!n) { n = document.createElement('div'); n.className = 'dd-err'; n.style.cssText = 'padding:8px 10px;color:#ffb4a8;background:#2a1715;line-height:1.35;'; box.appendChild(n); }
      n.textContent = msg;
    }
    document.addEventListener('securitypolicyviolation', safe((e) => {
      if (!box || !/youtube|spotify|soundcloud/i.test(e.blockedURI || '')) return;
      showError('Google Docs blocked this player. Use a direct audio link (ending in .mp3 or .ogg) or add audio files in Docs Afterglow settings instead.');
    }));

    function sendBg(visible) { try { API.runtime.sendMessage({ type: 'dd-music-vis', visible: !!visible }); } catch (e) { /* ignore */ } }

    function sync() {
      if (!S) return;
      const m = S.music, editor = isEditor();
      info = m.source === 'link' ? DD.parseMusicLink(m.link) : { kind: 'none' };
      const embedded = editor && m.enabled && m.source === 'link' && ['youtube', 'spotify', 'soundcloud'].indexOf(info.kind) >= 0;
      if (!m.enabled) dismissed = false;
      // background player (audio files and direct links) is driven by background.js; here we only report visibility
      sendBg(editor && m.enabled && !document.hidden);
      if (!embedded || dismissed) { remove(); return; }
      const url = embedUrl(info);
      if (!box || !frame || frame.getAttribute('data-src') !== url) { build(); frame.setAttribute('data-src', url); }
      volume();
      if (m.activeTabOnly && info.kind === 'youtube') ytCmd(document.hidden ? 'pauseVideo' : 'playVideo');
    }
    return { sync: safe(sync), stop: safe(() => { remove(); sendBg(false); }) };
  })();

  /* =====================================================================  input wiring */
  const hooked = new WeakSet();
  let streak = 0, lastKey = 0, lastRepeat = 0, keyStats = { keys: 0, docs: 0 };

  function classify(e) {
    const k = e.key;
    if (k === 'Enter') return 'enter';
    if (k === ' ') return 'space';
    if (k === 'Backspace' || k === 'Delete') return 'back';
    return (typeof k === 'string' && k.length === 1) ? 'key' : null;
  }
  const onKey = safe(function (e) {
    if (!S || !isEditor() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!S.fx.enabled && !S.sound.enabled) return;
    const type = classify(e);
    if (!type) return;
    const now = Date.now();
    if (e.repeat && now - lastRepeat < 55) return;
    if (e.repeat) lastRepeat = now;
    keyStats.keys++;
    streak = (now - lastKey < 1200) ? streak + 1 : 0; lastKey = now;
    const tier = S.fx.combo ? Math.min(5, Math.floor(streak / 14)) : 0;
    if (S.sound.enabled) window.DDAudio.hit(S.sound, type);
    // Typing in the title box, Find, the menu search or speaker notes is not typing in the document: no effect there.
    const t = e.target, tag = t && t.tagName;
    const outside = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!(t && t.closest && t.closest('#speakernotes-container, #docs-chrome, #docs-header'));
    if (S.fx.enabled && !outside) setTimeout(() => FX.emit(type, tier), 22);        // Docs moves the caret just after the key press
  });
  const onKeyUp = safe(function (e) {
    if (!S || !S.sound.enabled || !S.sound.release || !isEditor() || e.ctrlKey || e.metaKey || e.altKey) return;
    const type = classify(e);
    if (type) window.DDAudio.release(S.sound, type);
  });

  function hookDoc(doc) {
    if (!doc || hooked.has(doc)) return;
    hooked.add(doc); keyStats.docs++;
    doc.addEventListener('keydown', onKey, true);
    doc.addEventListener('keyup', onKeyUp, true);
  }
  // Docs receives typing in a hidden same-origin iframe, so key events never reach the top document.
  const scan = safe(function () {
    hookDoc(document);
    document.querySelectorAll('iframe').forEach((f) => { try { if (f.contentDocument && f.contentDocument.defaultView) hookDoc(f.contentDocument); } catch (e) { /* cross-origin: skip */ } });
  });

  let scanTimer = 0;
  function sync() {
    const any = !!(S && (S.fx.enabled || S.sound.enabled));
    if (any && !scanTimer) {
      scan(); scanTimer = setInterval(scan, 1000);
      // Slides (and Docs) create the hidden typing iframe when you start editing: hook it right away, not up to a second later.
      document.addEventListener('pointerdown', scan, true);
      document.addEventListener('focusin', scan, true);
    }
    if (!any && scanTimer) {
      clearInterval(scanTimer); scanTimer = 0;
      document.removeEventListener('pointerdown', scan, true);
      document.removeEventListener('focusin', scan, true);
    }
    if (!S || !S.fx.enabled) FX.stop();
    if (S && S.sound.enabled) window.DDAudio.setVolume(S.sound.volume);
    Music.sync();
  }

  function load(v) {
    try { S = DD.normalize(v); } catch (e) { S = null; }
    if (S && S.enabled === false) { S.fx.enabled = false; S.sound.enabled = false; S.music.enabled = false; }
    sync();
  }
  API.storage.local.get('ddSettings').then((r) => load(r.ddSettings)).catch(() => {});
  API.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.ddSettings) load(ch.ddSettings.newValue); });
  document.addEventListener('visibilitychange', safe(() => { Music.sync(); }));
  window.addEventListener('pagehide', safe(() => { Music.stop(); FX.stop(); }));

  window.DDFx = { info: () => ({ keyHooks: keyStats, fx: FX.stats, effectsOn: !!(S && S.fx.enabled), soundOn: !!(S && S.sound.enabled), musicOn: !!(S && S.music.enabled) }) };
})();
