/* Docs Afterglow — layer engine.
 * A theme background is a stack of layers (bottom → top):
 *   color   solid / linear / radial gradient
 *   image   positioned image (free, cover or contain), blur, drift
 *   video   positioned looping video
 *   effect  cinematic particle / light effects drawn on canvas
 * Every layer has opacity + CSS blend mode.
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const num = (v, d) => { const n = +v; return Number.isFinite(n) ? n : d; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const R = Math.random;
  const rr = (a, b) => a + R() * (b - a);
  const smooth = (t) => t * t * (3 - 2 * t);

  function hexRgb(c) {
    const DD = root.DD;
    if (DD && typeof DD.hex === 'function') return DD.hex(c);
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || ''));
    if (!m) return [255, 255, 255];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const mixc = (a, b, t) => [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';

  // Slow, organic wind: sum of incommensurate sines, roughly in [-1, 1].
  const gust = (t, s) => (Math.sin(t * 0.37 + s) * 0.45 + Math.sin(t * 0.91 + s * 2.3) * 0.3 + Math.sin(t * 0.17 + s * 0.7) * 0.45) / 1.2;

  function sprite(w, h, blur, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    if (blur > 0 && 'filter' in x) x.filter = 'blur(' + blur + 'px)';
    fn(x, w, h);
    return c;
  }

  // ===================================================================
  //  Sprites
  // ===================================================================
  const BLUR = [0, 1.4, 4.5];          // sharp, soft, bokeh

  function petalPath(x, r) {
    x.beginPath();
    x.moveTo(0, r * 0.92);
    x.bezierCurveTo(-r * 0.95, r * 0.38, -r * 0.9, -r * 0.72, -r * 0.3, -r * 0.96);
    x.quadraticCurveTo(0, -r * 0.66, r * 0.3, -r * 0.96);          // the notch
    x.bezierCurveTo(r * 0.9, -r * 0.72, r * 0.95, r * 0.38, 0, r * 0.92);
    x.closePath();
  }

  function petalSprite(c1, c2, lvl) {
    return sprite(96, 96, BLUR[lvl], (x) => {
      x.translate(48, 48);
      const r = 34;
      const deep = mixc(c1, [190, 40, 90], 0.45);
      const g = x.createRadialGradient(0, r * 0.75, 1, 0, r * 0.2, r * 1.7);
      g.addColorStop(0, rgba(deep, 1));
      g.addColorStop(0.22, rgba(c1, 1));
      g.addColorStop(1, rgba(c2, 1));
      x.fillStyle = g;
      petalPath(x, r); x.fill();
      // translucent rim + a vein, so it reads as a thin real petal
      x.lineWidth = 1.6;
      x.strokeStyle = 'rgba(255,255,255,0.4)';
      petalPath(x, r); x.stroke();
      x.lineWidth = 1;
      x.strokeStyle = rgba(deep, 0.35);
      x.beginPath(); x.moveTo(0, r * 0.85); x.quadraticCurveTo(0, 0, 0, -r * 0.55); x.stroke();
      x.strokeStyle = rgba(deep, 0.16);
      x.beginPath(); x.moveTo(0, r * 0.7); x.quadraticCurveTo(-r * 0.4, 0, -r * 0.5, -r * 0.55); x.stroke();
      x.beginPath(); x.moveTo(0, r * 0.7); x.quadraticCurveTo(r * 0.4, 0, r * 0.5, -r * 0.55); x.stroke();
    });
  }

  function leafSprite(col, lvl) {
    return sprite(96, 96, BLUR[lvl], (x) => {
      x.translate(48, 48);
      const r = 36;
      const dark = mixc(col, [30, 10, 0], 0.5);
      const light = mixc(col, [255, 230, 160], 0.35);
      const g = x.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
      g.addColorStop(0, rgba(dark, 1)); g.addColorStop(0.5, rgba(col, 1)); g.addColorStop(1, rgba(light, 1));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(0, r * 0.95);
      x.bezierCurveTo(-r * 0.95, r * 0.35, -r * 0.8, -r * 0.55, 0, -r);
      x.bezierCurveTo(r * 0.8, -r * 0.55, r * 0.95, r * 0.35, 0, r * 0.95);
      x.fill();
      x.strokeStyle = rgba(dark, 0.7); x.lineWidth = 1.8;
      x.beginPath(); x.moveTo(0, r * 1.05); x.lineTo(0, -r * 0.8); x.stroke();
      x.lineWidth = 1; x.strokeStyle = rgba(dark, 0.4);
      for (let i = 0; i < 4; i++) {
        const y = r * 0.55 - i * r * 0.36;
        x.beginPath(); x.moveTo(0, y); x.lineTo(-r * 0.5 + i * 4, y - r * 0.28); x.moveTo(0, y); x.lineTo(r * 0.5 - i * 4, y - r * 0.28); x.stroke();
      }
    });
  }

  function softDot(size, lvl, col) {
    const rgb = col || [255, 255, 255];
    return sprite(size, size, lvl ? BLUR[lvl] * (size / 64) : 0, (x, w) => {
      const c = w / 2;
      const g = x.createRadialGradient(c, c, 0, c, c, c * 0.8);
      g.addColorStop(0, rgba(rgb, 1)); g.addColorStop(0.35, rgba(rgb, 0.85)); g.addColorStop(1, rgba(rgb, 0));
      x.fillStyle = g; x.beginPath(); x.arc(c, c, c * 0.8, 0, TAU); x.fill();
    });
  }

  function glowSprite(size, rgb) {
    return sprite(size, size, 0, (x, w) => {
      const c = w / 2;
      const g = x.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, rgba([255, 255, 255], 1));
      g.addColorStop(0.08, rgba(mixc(rgb, [255, 255, 255], 0.6), 0.95));
      g.addColorStop(0.25, rgba(rgb, 0.5));
      g.addColorStop(0.6, rgba(rgb, 0.12));
      g.addColorStop(1, rgba(rgb, 0));
      x.fillStyle = g; x.fillRect(0, 0, w, w);
    });
  }

  function bokehSprite(rgb) {
    return sprite(128, 128, 0, (x, w) => {
      const c = w / 2;
      const g = x.createRadialGradient(c, c, 0, c, c, c * 0.96);
      g.addColorStop(0, rgba(rgb, 0.28)); g.addColorStop(0.78, rgba(rgb, 0.34));
      g.addColorStop(0.9, rgba(mixc(rgb, [255, 255, 255], 0.35), 0.7));
      g.addColorStop(1, rgba(rgb, 0));
      x.fillStyle = g; x.beginPath(); x.arc(c, c, c * 0.96, 0, TAU); x.fill();
    });
  }

  function sparkSprite() {
    return sprite(64, 64, 0, (x) => {
      x.translate(32, 32);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 10);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, 10, 0, TAU); x.fill();
      for (let a = 0; a < 2; a++) {
        const L = a ? 14 : 30;
        const lg = x.createLinearGradient(-L, 0, L, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.9)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = lg;
        x.save(); x.rotate(a ? Math.PI / 4 : 0);
        x.fillRect(-L, -0.8, L * 2, 1.6);
        x.rotate(Math.PI / 2); x.fillRect(-L, -0.8, L * 2, 1.6);
        x.restore();
      }
    });
  }

  function mistTexture(color) {
    const N = 256, c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d');
    const img = x.createImageData(N, N), d = img.data, rgb = hexRgb(color);
    const oct = [4, 8, 16, 32];
    const grids = oct.map((n) => { const g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = R(); return g; });
    for (let y = 0; y < N; y++) {
      for (let px = 0; px < N; px++) {
        let v = 0, norm = 0, amp = 1;
        for (let o = 0; o < oct.length; o++) {
          const n = oct[o], g = grids[o];
          const gx = px / N * n, gy = y / N * n;
          const ix = Math.floor(gx), iy = Math.floor(gy);
          const fx = smooth(gx - ix), fy = smooth(gy - iy);
          const a = g[(iy % n) * n + (ix % n)], b = g[(iy % n) * n + ((ix + 1) % n)];
          const c2 = g[((iy + 1) % n) * n + (ix % n)], e = g[((iy + 1) % n) * n + ((ix + 1) % n)];
          v += lerp(lerp(a, b, fx), lerp(c2, e, fx), fy) * amp; norm += amp; amp *= 0.5;
        }
        v = clamp((v / norm - 0.32) * 2.4, 0, 1);
        const i = (y * N + px) * 4;
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = Math.round(v * 255);
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  let grainUrl = '';
  function grainTile() {
    if (grainUrl) return grainUrl;
    const N = 200, c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d'), img = x.createImageData(N, N), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = R() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    grainUrl = c.toDataURL('image/png');
    return grainUrl;
  }

  // ===================================================================
  //  Particle system core
  // ===================================================================
  class FX {
    constructor(spec, cv) {
      this.spec = spec; this.cv = cv; this.c = cv.getContext('2d');
      this.ps = []; this.t = rr(0, 100); this.w = 1; this.h = 1; this.dpr = 1; this.res = spec.res || 1;
      this.P = {}; this.sig = ''; this.sp = null; this.seed = R() * 100;
    }
    set(P) {
      this.P = P;
      const s = this.spec.spriteSig ? this.spec.spriteSig(P) : '';
      if (s !== this.sig || !this.sp) { this.sig = s; this.sp = this.spec.sprites ? this.spec.sprites(P, this) : null; }
    }
    resize(cssW, cssH, dpr) {
      this.dpr = dpr * this.res;
      const w = Math.max(2, Math.round(cssW * this.dpr)), h = Math.max(2, Math.round(cssH * this.dpr));
      if (w === this.w && h === this.h) return;
      const first = this.w === 1;
      this.w = w; this.h = h; this.cv.width = w; this.cv.height = h;
      if (!first) this.ps.length = 0;        // re-seed for the new size
    }
    area() { return clamp(Math.pow((this.w * this.h) / (1920 * 1080 * this.dpr * this.dpr), 0.75), 0.2, 3); }
    step(dt) {
      this.t += dt;
      const sp = this.spec;
      if (sp.count) {
        const target = Math.round(sp.count(this.P) * this.area());
        while (this.ps.length < target) { const p = {}; sp.spawn(p, this, true); this.ps.push(p); }
        if (this.ps.length > target) this.ps.length = Math.max(target, this.ps.length - 6);
        for (let i = 0; i < this.ps.length; i++) sp.update(this.ps[i], dt, this.t, this);
      }
      if (sp.tick) sp.tick(dt, this.t, this);
    }
    draw() {
      const c = this.c, sp = this.spec;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.clearRect(0, 0, this.w, this.h);
      if (sp.comp) c.globalCompositeOperation = sp.comp;
      if (sp.drawAll) sp.drawAll(c, this);
      else for (let i = 0; i < this.ps.length; i++) sp.draw(c, this.ps[i], this);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
  }

  const spd = (P) => 0.25 + (num(P.speed, 50) / 50) * 0.85;
  const szm = (P) => 0.45 + (num(P.size, 50) / 50) * 0.55;
  const lvlFor = (z, P) => {
    const d = num(P.depth, 60) / 100;
    if (z > 0.9) return d > 0.1 ? 2 : 0;
    if (z < 0.2) return d > 0.35 ? 2 : (d > 0.1 ? 1 : 0);
    if (z < 0.38) return d > 0.55 ? 1 : 0;
    return 0;
  };

  // Spawn x for things that fall from the top. Full spread = whole width (and the
  // field wraps horizontally so wind never empties one side); less = an emitter.
  const fullSpread = (P) => num(P.spread, 100) >= 98;
  function topX(fx, init) {
    const P = fx.P, w = fx.w;
    if (fullSpread(P)) return init ? rr(0, w) : rr(-0.05, 1.05) * w;
    const ox = num(P.originX, 50) / 100 * w, sp = num(P.spread, 100) / 100 * w;
    return ox + rr(-0.5, 0.5) * sp;
  }
  // returns true if the particle left the field and was respawned
  function leaveCheck(p, fx, m) {
    if (p.y > fx.h + m) { fx.spec.spawn(p, fx, false); return true; }
    if (fullSpread(fx.P)) {
      if (p.x > fx.w + m) p.x = -m; else if (p.x < -m) p.x = fx.w + m;
    } else if (p.x < -fx.w * 0.5 || p.x > fx.w * 1.5) { fx.spec.spawn(p, fx, false); return true; }
    return false;
  }

  // ===================================================================
  //  Effect specs
  // ===================================================================
  const EFFECTS = {};

  // ---- Sakura petals ----
  EFFECTS.sakura = {
    label: 'Sakura petals', icon: '🌸', group: 'Falling',
    params: ['color', 'color2', 'intensity', 'speed', 'size', 'wind', 'depth', 'originX', 'spread'],
    defaults: { color: '#ffb0c8', color2: '#fff1f5', intensity: 55, speed: 45, size: 50, wind: 30, depth: 60, originX: 50, spread: 100 },
    spriteSig: (P) => P.color + P.color2,
    sprites(P) {
      const c1 = hexRgb(P.color), c2 = hexRgb(P.color2), list = [];
      for (let v = 0; v < 3; v++) {
        const a = mixc(c1, [255, 255, 255], v * 0.13), b = mixc(c2, c1, v * 0.1);
        list.push([0, 1, 2].map((l) => petalSprite(a, b, l)));
      }
      return list;
    },
    count: (P) => 14 + num(P.intensity, 50) * 1.15,
    spawn(p, fx, init) {
      const P = fx.P, u = fx.dpr;
      p.z = Math.pow(R(), 1.1);
      p.v = (R() * 3) | 0;
      p.lvl = lvlFor(p.z, P);
      p.s = lerp(15, 36, p.z) * szm(P) * u * (p.z > 0.9 ? 2.6 : 1);
      p.a = lerp(0.6, 0.98, p.z) * (p.z > 0.9 ? 0.7 : 1);
      p.seed = R() * 100; p.rot = R() * TAU; p.spin = rr(-1.4, 1.4);
      p.fp = R() * TAU; p.fv = rr(1.2, 3.4); p.sw = R() * TAU; p.swf = rr(0.8, 1.9); p.swa = rr(8, 30) * u;
      p.vf = rr(0.75, 1.25);
      p.x = topX(fx, init);
      p.y = init ? rr(-0.1, 1.05) * fx.h : -p.s * 2;
    },
    update(p, dt, t, fx) {
      const P = fx.P, u = fx.dpr, sp = spd(P), wind = num(P.wind, 0) / 100 * 150 * u;
      const flat = Math.abs(Math.cos(p.fp));
      p.fp += p.fv * dt; p.rot += p.spin * dt * (0.6 + flat * 0.5); p.sw += p.swf * dt;
      p.y += (24 + p.z * 52) * u * sp * (0.62 + 0.38 * flat) * p.vf * dt;
      p.x += (wind * (0.35 + 0.65 * p.z) * (1 + gust(t, p.seed) * 0.7) + Math.sin(p.sw) * p.swa * (0.5 + flat * 0.5)) * dt;
      leaveCheck(p, fx, p.s * 3);
    },
    draw(c, p, fx) {
      const f = Math.cos(p.fp), co = Math.cos(p.rot), si = Math.sin(p.rot);
      c.globalAlpha = p.a * (0.5 + 0.5 * Math.abs(f));
      c.setTransform(co, si, -si * f, co * f, p.x, p.y);
      c.drawImage(fx.sp[p.v][p.lvl], -p.s / 2, -p.s / 2, p.s, p.s);
    }
  };

  // ---- Falling leaves ----
  EFFECTS.leaves = {
    label: 'Autumn leaves', icon: '🍂', group: 'Falling',
    params: ['color', 'color2', 'intensity', 'speed', 'size', 'wind', 'depth', 'originX', 'spread'],
    defaults: { color: '#e8742a', color2: '#f4c552', intensity: 45, speed: 45, size: 55, wind: 40, depth: 55, originX: 50, spread: 100 },
    spriteSig: (P) => P.color + P.color2,
    sprites(P) {
      const a = hexRgb(P.color), b = hexRgb(P.color2);
      const cols = [a, b, mixc(a, b, 0.5), mixc(a, [120, 30, 10], 0.4)];
      return cols.map((c) => [0, 1, 2].map((l) => leafSprite(c, l)));
    },
    count: (P) => 12 + num(P.intensity, 50) * 0.8,
    spawn(p, fx, init) {
      EFFECTS.sakura.spawn(p, fx, init);
      p.v = (R() * 4) | 0;
      p.s = lerp(22, 48, p.z) * szm(fx.P) * fx.dpr * (p.z > 0.9 ? 2 : 1);
      p.fv = rr(0.8, 2.4); p.spin = rr(-1.8, 1.8); p.swa = rr(14, 50) * fx.dpr;
    },
    update: (p, dt, t, fx) => EFFECTS.sakura.update(p, dt, t, fx),
    draw: (c, p, fx) => EFFECTS.sakura.draw(c, p, fx)
  };

  // ---- Snow ----
  EFFECTS.snow = {
    label: 'Snowfall', icon: '❄️', group: 'Falling',
    params: ['color', 'intensity', 'speed', 'size', 'wind', 'depth', 'originX', 'spread'],
    defaults: { color: '#ffffff', intensity: 60, speed: 40, size: 50, wind: 15, depth: 70, originX: 50, spread: 100 },
    spriteSig: (P) => P.color,
    sprites(P) { const c = hexRgb(P.color); return [0, 1, 2].map((l) => softDot(64, l, c)); },
    count: (P) => 20 + num(P.intensity, 50) * 4.2,
    spawn(p, fx, init) {
      const P = fx.P, u = fx.dpr;
      p.z = Math.pow(R(), 1.1); p.lvl = lvlFor(p.z, P);
      p.s = lerp(3, 11, p.z) * szm(P) * u * (p.z > 0.92 ? 3.4 : 1);
      p.a = lerp(0.35, 0.95, p.z) * (p.z > 0.92 ? 0.3 : 1);
      p.seed = R() * 100; p.sw = R() * TAU; p.swf = rr(0.6, 1.6); p.swa = rr(6, 26) * u; p.vf = rr(0.8, 1.2);
      p.x = topX(fx, init); p.y = init ? rr(-0.1, 1.05) * fx.h : -p.s * 2;
    },
    update(p, dt, t, fx) {
      const P = fx.P, u = fx.dpr, sp = spd(P), wind = num(P.wind, 0) / 100 * 120 * u;
      p.sw += p.swf * dt;
      p.y += (14 + p.z * 46) * u * sp * p.vf * dt;
      p.x += (wind * (0.3 + 0.7 * p.z) * (1 + gust(t, p.seed) * 0.8) + Math.sin(p.sw) * p.swa) * dt;
      leaveCheck(p, fx, p.s * 2);
    },
    draw(c, p, fx) {
      c.globalAlpha = p.a;
      const s = p.s;
      c.drawImage(fx.sp[p.lvl], p.x - s, p.y - s, s * 2, s * 2);
    }
  };

  // ---- Rain ----
  EFFECTS.rain = {
    label: 'Rain', icon: '🌧️', group: 'Falling',
    params: ['color', 'intensity', 'speed', 'size', 'wind'],
    defaults: { color: '#aecbff', intensity: 60, speed: 55, size: 50, wind: 25 },
    count: (P) => 40 + num(P.intensity, 50) * 6,
    spawn(p, fx, init) {
      p.z = R(); p.x = rr(-0.2, 1.2) * fx.w; p.y = init ? rr(-0.2, 1) * fx.h : -rr(0, 0.3) * fx.h;
    },
    update(p, dt, t, fx) {
      const P = fx.P, u = fx.dpr, sp = spd(P);
      const vy = (650 + p.z * 950) * u * sp, vx = num(P.wind, 0) / 100 * 380 * u * (0.5 + p.z * 0.5);
      p.y += vy * dt; p.x += vx * dt;
      if (p.y > fx.h + 80 * u) { p.y = -rr(20, 120) * u; p.x = rr(-0.2, 1.2) * fx.w - num(P.wind, 0) / 100 * fx.w * 0.2; }
    },
    drawAll(c, fx) {
      const P = fx.P, u = fx.dpr, sp = spd(P), col = hexRgb(P.color);
      const k = szm(P);
      c.lineCap = 'round';
      for (let band = 0; band < 3; band++) {
        const z0 = band / 3, z1 = (band + 1) / 3, zm = (z0 + z1) / 2;
        c.strokeStyle = rgba(col, 0.1 + zm * 0.42);
        c.lineWidth = (0.6 + zm * 1.5) * u * k;
        c.beginPath();
        for (let i = 0; i < fx.ps.length; i++) {
          const p = fx.ps[i];
          if (p.z < z0 || p.z >= z1) continue;
          const vy = (650 + p.z * 950) * u * sp, vx = num(P.wind, 0) / 100 * 380 * u * (0.5 + p.z * 0.5);
          const tail = (0.024 + p.z * 0.02) * k;
          c.moveTo(p.x, p.y); c.lineTo(p.x - vx * tail, p.y - vy * tail);
        }
        c.stroke();
      }
    }
  };

  // ---- Fireflies ----
  EFFECTS.fireflies = {
    label: 'Fireflies', icon: '✨', group: 'Glow',
    params: ['color', 'intensity', 'speed', 'size'],
    defaults: { color: '#c9ff6b', intensity: 45, speed: 40, size: 50 },
    comp: 'lighter',
    spriteSig: (P) => P.color,
    sprites(P) { return glowSprite(96, hexRgb(P.color)); },
    count: (P) => 10 + num(P.intensity, 50) * 0.9,
    spawn(p, fx) {
      p.bx = rr(0.03, 0.97) * fx.w; p.by = rr(0.15, 0.98) * fx.h; p.z = R();
      p.ax = rr(30, 140) * fx.dpr; p.ay = rr(20, 90) * fx.dpr;
      p.f1 = rr(0.08, 0.3); p.f2 = rr(0.15, 0.5); p.p1 = R() * TAU; p.p2 = R() * TAU; p.p3 = R() * TAU;
      p.bf = rr(0.25, 0.8); p.bp = R() * TAU; p.s = rr(16, 40);
      p.x = p.bx; p.y = p.by;
    },
    update(p, dt, t, fx) {
      const sp = spd(fx.P), u = fx.dpr, tt = t * sp;
      p.x = p.bx + (Math.sin(tt * p.f1 * 6 + p.p1) + Math.sin(tt * p.f2 * 4 + p.p2) * 0.5) * p.ax;
      p.y = p.by + (Math.cos(tt * p.f2 * 5 + p.p3) + Math.sin(tt * p.f1 * 3 + p.p1) * 0.5) * p.ay - Math.sin(tt * 0.2 + p.p2) * 20 * u;
    },
    draw(c, p, fx) {
      const b = Math.pow(Math.max(0, Math.sin(fx.t * p.bf * 2 + p.bp)), 2.2);
      const a = 0.05 + b * 0.95;
      const s = p.s * szm(fx.P) * fx.dpr * (0.7 + 0.5 * b);
      c.globalAlpha = a * (0.45 + p.z * 0.55);
      c.drawImage(fx.sp, p.x - s, p.y - s, s * 2, s * 2);
    }
  };

  // ---- Embers ----
  EFFECTS.embers = {
    label: 'Rising embers', icon: '🔥', group: 'Glow',
    params: ['color', 'intensity', 'speed', 'size', 'wind'],
    defaults: { color: '#ff7a1a', intensity: 50, speed: 50, size: 50, wind: 15 },
    comp: 'lighter',
    spriteSig: (P) => P.color,
    sprites(P) {
      const mid = hexRgb(P.color), hot = mixc(mid, [255, 245, 200], 0.8), cool = mixc(mid, [120, 12, 0], 0.65);
      const ramp = [hot, mixc(hot, mid, 0.5), mid, mixc(mid, cool, 0.5), cool];
      return ramp.map((c) => glowSprite(64, c));
    },
    count: (P) => 22 + num(P.intensity, 50) * 1.7,
    spawn(p, fx, init) {
      p.z = R(); p.x = rr(-0.05, 1.05) * fx.w; p.life = rr(3.5, 8); p.age = init ? R() * p.life : 0;
      p.y = init ? rr(0.2, 1.05) * fx.h : fx.h + rr(0, 30) * fx.dpr;
      if (init) p.y = fx.h - (p.age / p.life) * fx.h * 0.8;
      p.ph = R() * TAU; p.ph2 = R() * TAU; p.s = rr(9, 24); p.vf = rr(0.7, 1.3);
    },
    update(p, dt, t, fx) {
      const P = fx.P, u = fx.dpr, sp = spd(P);
      p.age += dt;
      p.y -= (45 + p.z * 110) * u * sp * p.vf * dt;
      p.x += (num(P.wind, 0) / 100 * 90 * u + Math.sin(t * 1.7 + p.ph) * 26 * u + Math.sin(t * 0.55 + p.ph2) * 18 * u) * dt;
      if (p.age > p.life || p.y < -20) fx.spec.spawn(p, fx, false);
    },
    draw(c, p, fx) {
      const k = p.age / p.life;
      const idx = Math.min(4, (k * 5) | 0);
      const fade = Math.min(1, p.age * 3) * (k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1);
      const fl = 0.7 + 0.3 * Math.sin(fx.t * 17 + p.ph);
      const s = p.s * szm(fx.P) * fx.dpr * (1 - k * 0.55) * (0.7 + p.z * 0.6);
      c.globalAlpha = fade * fl * (0.5 + p.z * 0.5);
      c.drawImage(fx.sp[idx], p.x - s, p.y - s, s * 2, s * 2);
    }
  };

  // ---- Stars ----
  EFFECTS.stars = {
    label: 'Twinkling stars', icon: '⭐', group: 'Glow',
    params: ['color', 'intensity', 'speed', 'size'],
    defaults: { color: '#dfe9ff', intensity: 55, speed: 40, size: 50 },
    comp: 'lighter',
    spriteSig: (P) => P.color,
    sprites(P) { const c = hexRgb(P.color); return { dot: glowSprite(32, c), spark: sparkSprite(), shoot: [] }; },
    count: (P) => 30 + num(P.intensity, 50) * 3.2,
    spawn(p, fx) {
      p.x = R() * fx.w; p.y = R() * fx.h; p.z = Math.pow(R(), 2.2); p.ph = R() * TAU; p.f = rr(0.6, 2.4);
      fx.shoot = fx.shoot || [];
    },
    update() {},
    tick(dt, t, fx) {
      fx.shoot = fx.shoot || [];
      fx.nextShoot = fx.nextShoot == null ? t + rr(2, 6) : fx.nextShoot;
      if (t > fx.nextShoot && num(fx.P.intensity, 50) > 5) {
        fx.nextShoot = t + rr(5, 13) / (0.5 + num(fx.P.speed, 50) / 60);
        const a = rr(0.35, 0.8);
        fx.shoot.push({ x: rr(0.1, 0.9) * fx.w, y: rr(0, 0.4) * fx.h, vx: Math.cos(a) * rr(900, 1500) * fx.dpr, vy: Math.sin(a) * rr(500, 900) * fx.dpr, life: 0, max: rr(0.7, 1.2) });
      }
      for (let i = fx.shoot.length - 1; i >= 0; i--) {
        const s = fx.shoot[i]; s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.life > s.max) fx.shoot.splice(i, 1);
      }
    },
    drawAll(c, fx) {
      const k = szm(fx.P), u = fx.dpr;
      for (let i = 0; i < fx.ps.length; i++) {
        const p = fx.ps[i];
        const tw = 0.55 + 0.45 * Math.sin(fx.t * p.f * (0.6 + spd(fx.P)) + p.ph);
        const s = (2.2 + p.z * 7) * k * u;
        c.globalAlpha = (0.25 + p.z * 0.75) * tw;
        c.drawImage(fx.sp.dot, p.x - s, p.y - s, s * 2, s * 2);
        if (p.z > 0.82) { const q = s * 3.2; c.globalAlpha *= 0.8; c.drawImage(fx.sp.spark, p.x - q, p.y - q, q * 2, q * 2); }
      }
      const col = hexRgb(fx.P.color);
      (fx.shoot || []).forEach((s) => {
        const f = 1 - s.life / s.max, len = 0.11;
        const g = c.createLinearGradient(s.x, s.y, s.x - s.vx * len, s.y - s.vy * len);
        g.addColorStop(0, rgba(mixc(col, [255, 255, 255], 0.7), 0.95 * f)); g.addColorStop(1, rgba(col, 0));
        c.globalAlpha = 1; c.strokeStyle = g; c.lineWidth = 1.8 * u; c.lineCap = 'round';
        c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - s.vx * len, s.y - s.vy * len); c.stroke();
      });
    }
  };

  // ---- Bokeh ----
  EFFECTS.bokeh = {
    label: 'Bokeh lights', icon: '🔮', group: 'Glow',
    params: ['color', 'color2', 'intensity', 'speed', 'size'],
    defaults: { color: '#ff7ad9', color2: '#6ad5ff', intensity: 40, speed: 30, size: 55 },
    comp: 'lighter',
    spriteSig: (P) => P.color + P.color2,
    sprites(P) { return [bokehSprite(hexRgb(P.color)), bokehSprite(hexRgb(P.color2))]; },
    count: (P) => 4 + num(P.intensity, 50) * 0.4,
    spawn(p, fx) {
      p.z = R(); p.x = R() * fx.w; p.y = R() * fx.h; p.r = lerp(22, 110, Math.pow(p.z, 1.3)); p.v = R() < 0.5 ? 0 : 1;
      p.vx = rr(-1, 1); p.vy = rr(-1, -0.2); p.ph = R() * TAU; p.a = rr(0.25, 0.7);
    },
    update(p, dt, t, fx) {
      const sp = spd(fx.P), u = fx.dpr, m = p.r * szm(fx.P) * u * 2;
      p.x += p.vx * 12 * sp * u * dt * (0.4 + p.z); p.y += p.vy * 12 * sp * u * dt * (0.4 + p.z);
      if (p.x < -m) p.x = fx.w + m; else if (p.x > fx.w + m) p.x = -m;
      if (p.y < -m) p.y = fx.h + m; else if (p.y > fx.h + m) p.y = -m;
    },
    draw(c, p, fx) {
      const s = p.r * szm(fx.P) * fx.dpr;
      c.globalAlpha = p.a * (0.55 + 0.45 * Math.sin(fx.t * 0.5 + p.ph)) * 0.55;
      c.drawImage(fx.sp[p.v], p.x - s, p.y - s, s * 2, s * 2);
    }
  };

  // ---- Dust motes ----
  EFFECTS.dust = {
    label: 'Floating dust', icon: '·', group: 'Glow',
    params: ['color', 'intensity', 'speed', 'size'],
    defaults: { color: '#fff0cf', intensity: 50, speed: 25, size: 45 },
    comp: 'lighter',
    spriteSig: (P) => P.color,
    sprites(P) { return glowSprite(32, hexRgb(P.color)); },
    count: (P) => 20 + num(P.intensity, 50) * 2.2,
    spawn(p, fx) { p.x = R() * fx.w; p.y = R() * fx.h; p.z = R(); p.ph = R() * TAU; p.f = rr(0.3, 1.2); p.s = rr(1.2, 4.5); },
    update(p, dt, t, fx) {
      const sp = spd(fx.P), u = fx.dpr;
      p.x += Math.sin(t * 0.3 * p.f + p.ph) * 9 * sp * u * dt * (0.4 + p.z) + 4 * sp * u * dt;
      p.y += Math.cos(t * 0.23 * p.f + p.ph * 2) * 7 * sp * u * dt * (0.4 + p.z) - 2.5 * sp * u * dt;
      if (p.x > fx.w + 10) p.x = -10; if (p.x < -10) p.x = fx.w + 10; if (p.y < -10) p.y = fx.h + 10; if (p.y > fx.h + 10) p.y = -10;
    },
    draw(c, p, fx) {
      const s = p.s * szm(fx.P) * fx.dpr * (0.6 + p.z);
      c.globalAlpha = (0.15 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(fx.t * p.f + p.ph), 2)) * (0.4 + p.z * 0.6);
      c.drawImage(fx.sp, p.x - s, p.y - s, s * 2, s * 2);
    }
  };


  // ---- Blossom branch (procedural, drawn once, then swayed) ----
  function rng32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function flowerSprite(c1, c2, blur, rnd) {
    return sprite(128, 128, blur, (x) => {
      x.translate(64, 64);
      const r = 26, deep = mixc(c1, [200, 40, 100], 0.55);
      for (let i = 0; i < 5; i++) {
        x.save(); x.rotate(i * TAU / 5 + rnd() * 0.12); x.translate(0, -r * 0.5);
        const g = x.createRadialGradient(0, r * 0.7, 1, 0, 0, r * 1.2);
        g.addColorStop(0, rgba(deep, 1)); g.addColorStop(0.3, rgba(c1, 1)); g.addColorStop(1, rgba(c2, 1));
        x.fillStyle = g; x.scale(0.82, 1); petalPath(x, r * 0.62); x.fill();
        x.strokeStyle = 'rgba(255,255,255,0.28)'; x.lineWidth = 1; petalPath(x, r * 0.62); x.stroke();
        x.restore();
      }
      x.fillStyle = rgba(mixc(deep, [120, 20, 60], 0.5), 0.95);
      x.beginPath(); x.arc(0, 0, r * 0.13, 0, TAU); x.fill();
      for (let i = 0; i < 9; i++) {
        const a = i * TAU / 9 + rnd() * 0.3, L = r * (0.3 + rnd() * 0.14);
        x.strokeStyle = rgba(deep, 0.8); x.lineWidth = 1;
        x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * L, Math.sin(a) * L); x.stroke();
        x.fillStyle = 'rgba(255,214,120,0.95)'; x.beginPath(); x.arc(Math.cos(a) * L, Math.sin(a) * L, 1.3, 0, TAU); x.fill();
      }
    });
  }

  function buildBranch(P, w, h, dpr) {
    const rnd = rng32(Math.round(num(P.seed, 7) * 7919 + 13));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    const right = num(P.side, 100) >= 50, dir = right ? -1 : 1;
    const ax = right ? w * 1.03 : -w * 0.03, ay = -h * 0.04 + rnd() * h * 0.1;
    const L = clamp(num(P.size, 60) / 100, 0.2, 1) * w * 0.78;
    const bark = hexRgb(P.color2), c1 = hexRgb(P.color), c2 = mixc(hexRgb(P.color), [255, 255, 255], 0.75);
    const dens = clamp(num(P.intensity, 60) / 100, 0.05, 1);
    const flowers = [], segs = [];
    const FS = [0, 1, 2].map((lvl) => [0, 1, 2].map((v) => flowerSprite(mixc(c1, [255, 255, 255], v * 0.12), mixc(c2, c1, v * 0.14), lvl === 0 ? 0 : lvl === 1 ? 1.2 : 5, rnd)));

    function limb(px, py, ang, len, wid, depth) {
      const n = Math.max(5, Math.round(len / (h * 0.045)));
      let a = ang, x0 = px, y0 = py;
      for (let i = 0; i < n; i++) {
        const t = i / n, step = len / n;
        a += (rnd() - 0.5) * 0.3 + 0.045 * dir * (depth ? 0.6 : 1);        // slight droop
        const x1 = x0 + Math.cos(a) * step, y1 = y0 + Math.sin(a) * step;
        const w0 = wid * (1 - t * 0.78);
        segs.push([x0, y0, x1, y1, w0, depth]);
        if (depth < 3 && i > 1 && rnd() < (depth === 0 ? 0.62 : 0.42)) {
          const side = rnd() < 0.5 ? -1 : 1;
          limb(x1, y1, a + side * (0.5 + rnd() * 0.7), len * (0.2 + rnd() * 0.26) * (1 - t * 0.45), w0 * 0.55, depth + 1);
        }
        if (depth >= 1 && rnd() < 0.55 * (0.4 + dens)) flowers.push([x1, y1, depth, t]);
        x0 = x1; y0 = y1;
      }
      flowers.push([x0, y0, depth + 1, 1]); flowers.push([x0, y0, depth + 1, 1]);
    }
    limb(ax, ay, right ? Math.PI * 0.9 : Math.PI * 0.1, L, Math.max(5, L * 0.036), 0);

    // bark: dark body + a thin highlight to give it volume
    x.lineCap = 'round';
    segs.forEach((s) => { x.strokeStyle = rgba(bark, 1); x.lineWidth = Math.max(1, s[4]); x.beginPath(); x.moveTo(s[0], s[1]); x.lineTo(s[2], s[3]); x.stroke(); });
    const hi = mixc(bark, c1, 0.35);
    segs.forEach((s) => { if (s[4] < 3) return; x.strokeStyle = rgba(hi, 0.3); x.lineWidth = Math.max(1, s[4] * 0.22); x.beginPath(); x.moveTo(s[0] - 1, s[1] - s[4] * 0.2); x.lineTo(s[2] - 1, s[3] - s[4] * 0.2); x.stroke(); });

    // blossoms, back to front; a few large, blurred ones sit close to the "camera"
    const base = Math.min(w, h) * 0.026;
    flowers.sort(() => rnd() - 0.5);
    flowers.forEach((f) => {
      const n = 1 + ((rnd() * (2 + dens * 3)) | 0);
      for (let k = 0; k < n; k++) {
        const near = rnd() < 0.07, far = !near && rnd() < 0.3;
        const lvl = near ? 2 : far ? 1 : 0, sz = base * (near ? 3.3 : far ? 0.8 : 1) * (0.75 + rnd() * 0.6) * dpr;
        const ox = (rnd() - 0.5) * base * 3.4, oy = (rnd() - 0.5) * base * 3.4;
        x.save(); x.translate(f[0] + ox, f[1] + oy); x.rotate(rnd() * TAU); x.globalAlpha = near ? 0.78 : 1;
        x.drawImage(FS[lvl][(rnd() * 3) | 0], -sz, -sz, sz * 2, sz * 2); x.restore();
      }
    });
    return { cv, ax, ay };
  }

  EFFECTS.branch = {
    label: 'Blossom branch', icon: '🌸', group: 'Scenery',
    params: ['color', 'color2', 'intensity', 'size', 'wind', 'side', 'seed'],
    defaults: { color: '#ffb3cc', color2: '#24121d', intensity: 62, size: 62, wind: 30, side: 100, seed: 7 },
    tick() {},
    drawAll(c, fx) {
      const P = fx.P, key = [fx.w, fx.h, P.color, P.color2, P.intensity, P.size, P.side, P.seed].join('|');
      if (fx.bKey !== key) { fx.bKey = key; fx.br = buildBranch(P, fx.w, fx.h, fx.dpr); }
      const b = fx.br, wd = num(P.wind, 30) / 100, t = fx.t;
      const sway = (Math.sin(t * 0.55) * 0.5 + Math.sin(t * 0.23 + 1.3) * 0.5 + gust(t, 3) * 0.6) * 0.006 * (0.3 + wd) ;
      c.save(); c.translate(b.ax, b.ay); c.rotate(sway); c.translate(-b.ax, -b.ay);
      c.drawImage(b.cv, 0, 0); c.restore();
    }
  };

  // ---- Mist ----
  EFFECTS.mist = {
    label: 'Drifting mist', icon: '🌫️', group: 'Atmosphere',
    params: ['color', 'intensity', 'speed', 'size', 'wind'],
    defaults: { color: '#b9c6ff', intensity: 40, speed: 30, size: 50, wind: 20 },
    res: 0.5, comp: 'source-over',
    spriteSig: (P) => P.color,
    sprites(P) { return mistTexture(P.color); },
    tick() {},
    drawAll(c, fx) {
      const P = fx.P, tex = fx.sp, u = fx.dpr, k = 0.7 + num(P.size, 50) / 50 * 0.9;
      const base = clamp(num(P.intensity, 50) / 100, 0, 1) * 0.5;
      const wind = (num(P.wind, 0) / 100) * 2 + 0.6;
      [[1.9, 0.5, 0.0, 0.55], [1.3, 1.0, 0.33, 0.8], [0.9, 1.7, 0.66, 1]].forEach(([sc, vel, off, al], i) => {
        const tile = 256 * sc * k * u * 1.6;
        const ox = ((fx.t * spd(P) * 22 * vel * wind * u + off * tile) % tile + tile) % tile;
        const oy = (Math.sin(fx.t * 0.05 * (i + 1) + i) * 0.5 + 0.5) * tile * 0.5;
        c.globalAlpha = base * al;
        for (let x = -ox; x < fx.w; x += tile) for (let y = -oy; y < fx.h; y += tile) c.drawImage(tex, x, y, tile, tile);
      });
    }
  };

  // ---- God rays ----
  EFFECTS.godrays = {
    label: 'Light rays', icon: '🌅', group: 'Atmosphere',
    params: ['color', 'intensity', 'speed', 'size', 'originX', 'spread'],
    defaults: { color: '#ffe3b0', intensity: 45, speed: 30, size: 50, originX: 75, spread: 60 },
    res: 0.5, comp: 'lighter', blurCss: 10,
    tick() {},
    drawAll(c, fx) {
      const P = fx.P, w = fx.w, h = fx.h, col = hexRgb(P.color), n = 7;
      const ox = num(P.originX, 75) / 100 * w, oy = -h * 0.12;
      const L = Math.hypot(w, h) * 1.3, spread = (num(P.spread, 60) / 100) * 1.6 + 0.15;
      const base = Math.PI / 2 + (0.5 - num(P.originX, 75) / 100) * 0.9;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1) - 0.5;
        const a = base + f * spread + Math.sin(fx.t * spd(P) * 0.22 + i * 1.7) * 0.045;
        const hw = (0.018 + 0.028 * ((i * 37) % 5) / 4) * (0.5 + num(P.size, 50) / 50 * 0.8);
        const pulse = 0.55 + 0.45 * Math.sin(fx.t * spd(P) * 0.35 + i * 2.3);
        const al = clamp(num(P.intensity, 50) / 100, 0, 1) * 0.5 * pulse;
        const g = c.createLinearGradient(ox, oy, ox + Math.cos(a) * L, oy + Math.sin(a) * L);
        g.addColorStop(0, rgba(col, al)); g.addColorStop(0.55, rgba(col, al * 0.35)); g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g; c.beginPath(); c.moveTo(ox, oy);
        c.lineTo(ox + Math.cos(a - hw) * L, oy + Math.sin(a - hw) * L);
        c.lineTo(ox + Math.cos(a + hw) * L, oy + Math.sin(a + hw) * L);
        c.closePath(); c.fill();
      }
    }
  };

  // Non-canvas effects (pure CSS)
  const DOM_EFFECTS = {
    vignette: {
      label: 'Vignette', icon: '◐', group: 'Atmosphere', params: ['color', 'intensity', 'size'],
      defaults: { color: '#000000', intensity: 60, size: 50 }
    },
    grain: {
      label: 'Film grain', icon: '▦', group: 'Atmosphere', params: ['intensity'],
      defaults: { intensity: 25 }
    }
  };

  const PARAM_DEFS = {
    color: { label: 'Color', type: 'color' },
    color2: { label: 'Second color', type: 'color' },
    intensity: { label: 'Amount', type: 'range', min: 0, max: 100 },
    speed: { label: 'Speed', type: 'range', min: 0, max: 100 },
    size: { label: 'Size', type: 'range', min: 0, max: 100 },
    wind: { label: 'Wind', type: 'range', min: -100, max: 100 },
    depth: { label: 'Depth of field', type: 'range', min: 0, max: 100 },
    originX: { label: 'Emit from X %', type: 'range', min: 0, max: 100 },
    spread: { label: 'Spread %', type: 'range', min: 0, max: 100 },
    side: { label: 'Side (left ↔ right)', type: 'range', min: 0, max: 100 },
    seed: { label: 'Variation', type: 'range', min: 0, max: 100 }
  };

  // "Classic" backgrounds (the ones in the popup's Background menu) as a layer, so every
  // built-in theme can be opened and edited in Studio.
  const CLASSIC = [
    ['gradient', 'Gradient'], ['animated-gradient', 'Animated gradient'], ['aurora', 'Aurora'],
    ['stars', 'Starfield'], ['matrix', 'Matrix rain'], ['network', 'Neon network'], ['plasma', 'Plasma']
  ];
  const CLASSIC_PARAMS = {
    'gradient': ['angle'], 'animated-gradient': ['angle', 'speed'], 'aurora': ['speed', 'intensity'],
    'stars': ['angle', 'speed', 'intensity', 'density', 'fxColor'], 'matrix': ['angle', 'speed', 'intensity', 'density', 'fxColor'],
    'network': ['angle', 'speed', 'intensity', 'density', 'fxColor'], 'plasma': ['speed', 'intensity']
  };

  const BLENDS = ['normal', 'screen', 'lighten', 'overlay', 'soft-light', 'hard-light', 'color-dodge', 'multiply', 'darken', 'plus-lighter', 'difference', 'luminosity', 'color'];

  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function effectDef(kind) { return own(EFFECTS, kind) ? EFFECTS[kind] : own(DOM_EFFECTS, kind) ? DOM_EFFECTS[kind] : null; }
  function allEffects() {
    const out = [];
    Object.keys(EFFECTS).forEach((k) => out.push(Object.assign({ kind: k }, EFFECTS[k])));
    Object.keys(DOM_EFFECTS).forEach((k) => out.push(Object.assign({ kind: k }, DOM_EFFECTS[k])));
    return out;
  }

  // ===================================================================
  //  Layer defaults
  // ===================================================================
  let uid = 0;
  const newId = () => 'l' + Date.now().toString(36) + (uid++).toString(36);

  function newLayer(type, extra) {
    const base = { id: newId(), type, name: '', visible: true, opacity: 100, blend: 'normal' };
    if (type === 'color') Object.assign(base, { name: 'Color', mode: 'linear', colors: ['#0b0d12', '#1a1f3a'], angle: 160, cx: 50, cy: 40, rad: 70 });
    else if (type === 'image') Object.assign(base, { name: 'Image', asset: '', url: '', fit: 'free', x: 50, y: 50, w: 40, rot: 0, flip: false, blur: 0, drift: 0 });
    else if (type === 'video') Object.assign(base, { name: 'Video', asset: '', url: '', fit: 'cover', x: 50, y: 50, w: 100, rot: 0, flip: false, blur: 0, rate: 100 });
    else if (type === 'classic') Object.assign(base, { name: 'Classic background', mode: 'aurora', colors: ['#070b18', '#00e5a8', '#7a5cff', '#ff4fd8'], angle: 160, speed: 45, intensity: 75, density: 50, fxColor: '#8ab4f8' });
    else if (type === 'effect') {
      const kind = (extra && extra.kind) || 'sakura';
      const d = effectDef(kind) || EFFECTS.sakura;
      Object.assign(base, { name: d.label, kind }, JSON.parse(JSON.stringify(d.defaults)));
    }
    return Object.assign(base, extra || {}, { id: base.id });
  }

  // ===================================================================
  //  Engine
  // ===================================================================
  function create(host) {
    const rootEl = document.createElement('div');
    rootEl.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;isolation:isolate;contain:strict;';
    rootEl.setAttribute('aria-hidden', 'true');
    const st = document.createElement('style');
    st.textContent = '@keyframes ddl-kb{from{transform:scale(1)}to{transform:scale(var(--kb,1.08))}}' +
      '';
    rootEl.appendChild(st);
    host.appendChild(rootEl);

    const insts = new Map();        // id -> instance
    let assets = {}, fps = 30, raf = 0, last = 0, paused = false, grainTick = 0, dead = false;
    let cssW = 1, cssH = 1;

    const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);

    function sizeAll() {
      const r = host.getBoundingClientRect();
      // layout size, so a CSS-scaled preview host still renders at its real size
      cssW = Math.max(1, host.clientWidth || r.width); cssH = Math.max(1, host.clientHeight || r.height);
      insts.forEach((i) => { if (i.fx) i.fx.resize(cssW, cssH, dpr()); });
    }
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(sizeAll); ro.observe(host); }

    const srcOf = (L) => (L.asset && assets[L.asset]) || L.url || '';

    function common(el, L) {
      el.style.opacity = String(clamp(num(L.opacity, 100), 0, 100) / 100);
      el.style.mixBlendMode = L.blend && L.blend !== 'normal' ? L.blend : 'normal';
      el.style.display = L.visible === false ? 'none' : '';
    }

    function build(L) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;inset:0;';
      el.dataset.ddLayer = L.id;
      const inst = { id: L.id, type: L.type, kind: L.kind, el, L };

      if (L.type === 'image' || L.type === 'video') {
        const m = document.createElement(L.type === 'image' ? 'img' : 'video');
        m.style.cssText = 'position:absolute;display:block;max-width:none;user-select:none;';
        if (L.type === 'video') { m.muted = true; m.loop = true; m.autoplay = true; m.playsInline = true; m.setAttribute('muted', ''); }
        else m.draggable = false;
        el.appendChild(m); inst.m = m;
      } else if (L.type === 'classic') {
        if (root.DDBg && root.DDBg.create) { try { inst.sub = root.DDBg.create(el); } catch (e) { inst.sub = null; } }
      } else if (L.type === 'effect') {
        if (EFFECTS[L.kind]) {
          const cv = document.createElement('canvas');
          cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
          el.appendChild(cv);
          inst.fx = new FX(EFFECTS[L.kind], cv);
          inst.fx.resize(cssW, cssH, dpr());
        }
      }
      return inst;
    }

    function apply(inst, L) {
      inst.L = L;
      const el = inst.el;
      common(el, L);
      if (L.type === 'color') {
        const cs = (L.colors && L.colors.length ? L.colors : ['#000']).slice(0, 4);
        el.style.background = L.mode === 'solid' || cs.length < 2 ? cs[0]
          : L.mode === 'radial' ? 'radial-gradient(ellipse ' + clamp(num(L.rad, 70), 5, 200) + '% ' + clamp(num(L.rad, 70), 5, 200) + '% at ' + num(L.cx, 50) + '% ' + num(L.cy, 40) + '%,' + cs.join(',') + ')'
          : 'linear-gradient(' + num(L.angle, 160) + 'deg,' + cs.join(',') + ')';
      } else if (L.type === 'classic') {
        if (inst.sub) {
          const cs = (Array.isArray(L.colors) && L.colors.length ? L.colors : ['#000000']).slice(0, 6);
          const bg = { type: L.mode, colors: cs, angle: num(L.angle, 160), speed: num(L.speed, 50), intensity: num(L.intensity, 70),
            density: num(L.density, 50), fxColor: L.fxColor || '#ffffff', fps: fps, animate: true };
          const sig = JSON.stringify(bg);
          if (sig !== inst.sig) { inst.sig = sig; inst.sub.update(bg, ''); }
        }
      } else if (L.type === 'image' || L.type === 'video') {
        const m = inst.m, src = srcOf(L);
        if (src && m.getAttribute('data-src') !== src) { m.setAttribute('data-src', src); m.src = src; if (L.type === 'video') { const p = m.play(); if (p && p.catch) p.catch(() => {}); } }
        if (!src) { m.removeAttribute('src'); m.removeAttribute('data-src'); }
        const fit = L.fit === 'contain' ? 'contain' : 'cover';
        m.style.objectFit = fit;
        m.style.filter = num(L.blur, 0) > 0 ? 'blur(' + num(L.blur, 0) + 'px)' : '';
        const free = !(L.fit === 'cover' || L.fit === 'contain');
        m.style.width = '100%'; m.style.height = free ? 'auto' : '100%';
        // positioned box is the wrapper `el`'s child: move the media itself
        if (free) {
          m.style.left = num(L.x, 50) + '%'; m.style.top = num(L.y, 50) + '%';
          m.style.width = num(L.w, 40) + '%'; m.style.height = 'auto';
          m.style.transform = 'translate(-50%,-50%) rotate(' + num(L.rot, 0) + 'deg) scaleX(' + (L.flip ? -1 : 1) + ')';
        } else {
          m.style.left = '0'; m.style.top = '0';
          m.style.transform = 'rotate(' + num(L.rot, 0) + 'deg) scaleX(' + (L.flip ? -1 : 1) + ')';
        }
        if (L.type === 'image' && num(L.drift, 0) > 0) {
          el.style.setProperty('--kb', String(1 + num(L.drift, 0) / 100 * 0.25));
          el.style.animation = 'ddl-kb ' + (40 - num(L.drift, 0) * 0.25) + 's ease-in-out infinite alternate';
          el.style.transformOrigin = num(L.x, 50) + '% ' + num(L.y, 50) + '%';
        } else { el.style.animation = ''; }
        if (L.type === 'video') m.playbackRate = clamp(num(L.rate, 100) / 100, 0.1, 4);
      } else if (L.type === 'effect') {
        const d = effectDef(L.kind);
        if (inst.fx) {
          inst.fx.set(L);
          if (d && d.blurCss) inst.fx.cv.style.filter = 'blur(' + d.blurCss + 'px)';
        } else if (L.kind === 'vignette') {
          const c = hexRgb(L.color || '#000'), a = clamp(num(L.intensity, 60) / 100, 0, 1), s = clamp(num(L.size, 50), 5, 95);
          el.style.background = 'radial-gradient(ellipse at 50% 50%,' + rgba(c, 0) + ' ' + s + '%,' + rgba(c, a) + ' 100%)';
        } else if (L.kind === 'grain') {
          el.style.backgroundImage = 'url(' + grainTile() + ')';
          el.style.backgroundSize = '200px 200px';
          // Soft-light keeps film texture subtle behind translucent Docs surfaces.
          el.style.mixBlendMode = L.blend && L.blend !== 'normal' ? L.blend : 'soft-light';
          el.style.opacity = String(clamp(num(L.intensity, 25), 0, 100) / 100 * clamp(num(L.opacity, 100), 0, 100) / 100);
          inst.grain = true;
        }
      }
    }

    function update(bg, newAssets) {
      if (dead) return;
      if (newAssets) assets = newAssets;
      fps = clamp(num(bg && bg.fps, 30), 10, 60);
      const layers = (bg && Array.isArray(bg.layers)) ? bg.layers : [];
      const keep = new Set();
      sizeAll();
      layers.forEach((L, idx) => {
        if (!L || !L.id) return;
        keep.add(L.id);
        let inst = insts.get(L.id);
        if (inst && (inst.type !== L.type || (L.type === 'effect' && inst.kind !== L.kind))) { if (inst.sub) inst.sub.destroy(); inst.el.remove(); insts.delete(L.id); inst = null; }
        if (!inst) { inst = build(L); insts.set(L.id, inst); }
        apply(inst, L);
        if (rootEl.children[idx + 1] !== inst.el) rootEl.insertBefore(inst.el, rootEl.children[idx + 1] || null);
      });
      insts.forEach((inst, id) => { if (!keep.has(id)) { if (inst.sub) inst.sub.destroy(); inst.el.remove(); insts.delete(id); } });
      kick();
    }

    function needsLoop() {
      for (const i of insts.values()) if ((i.fx || i.grain) && i.L.visible !== false) return true;
      return false;
    }
    function kick() {
      if (!raf && !paused && needsLoop() && !dead) { last = 0; raf = requestAnimationFrame(frame); }
    }
    function frame(ts) {
      raf = 0;
      if (dead || paused) return;
      if (!needsLoop()) return;
      const minGap = 1000 / fps - 2;
      if (last && ts - last < minGap) { raf = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0.016;
      last = ts;
      insts.forEach((i) => {
        if (i.L.visible === false) return;
        if (i.fx) { i.fx.step(dt); i.fx.draw(); }
        else if (i.grain && ts - grainTick > 90) { grainTick = ts; i.el.style.backgroundPosition = ((R() * 200) | 0) + 'px ' + ((R() * 200) | 0) + 'px'; }
      });
      raf = requestAnimationFrame(frame);
    }
    function onVis() {
      paused = document.hidden;
      insts.forEach((i) => { if (i.type === 'video' && i.m) { if (paused) i.m.pause(); else { const p = i.m.play(); if (p && p.catch) p.catch(() => {}); } } });
      if (paused) { if (raf) cancelAnimationFrame(raf); raf = 0; } else kick();
    }
    document.addEventListener('visibilitychange', onVis);

    function destroy() {
      dead = true;
      if (raf) cancelAnimationFrame(raf); raf = 0;
      document.removeEventListener('visibilitychange', onVis);
      if (ro) ro.disconnect();
      insts.forEach((i) => { if (i.m && i.m.pause) i.m.pause(); if (i.sub) i.sub.destroy(); });
      insts.clear();
      rootEl.remove();
    }

    // Stills for tests / thumbnails: advance every effect `sec` seconds.
    function warm(sec) {
      insts.forEach((i) => { if (i.fx) { for (let t = 0; t < sec; t += 0.05) i.fx.step(0.05); i.fx.draw(); } });
    }

    return { update, destroy, warm, root: rootEl };
  }

  // ===================================================================
  //  Built-in themes
  // ===================================================================
  const fx = (kind, over) => newLayer('effect', Object.assign({ kind }, over || {}));
  const col = (over) => newLayer('color', over);

  function presets() {
    return {
      'Sakura Dusk': {
        base: '#140b1f',
        layers: [
          col({ name: 'Twilight', colors: ['#0f0820', '#34163d', '#7b3050'], angle: 175 }),
          col({ name: 'Moon glow', mode: 'radial', colors: ['#ffd9e6', '#7b3a66', '#000000'], cx: 24, cy: 26, rad: 46, blend: 'screen', opacity: 55 }),
          fx('godrays', { name: 'Moonlight', color: '#ffc7d8', intensity: 34, originX: 24, spread: 50, opacity: 80 }),
          fx('mist', { name: 'Low mist', color: '#ffb6d0', intensity: 30, wind: 25, opacity: 65 }),
          fx('sakura', { name: 'Far petals', intensity: 45, size: 30, speed: 30, depth: 100, wind: 25, opacity: 75 }),
          fx('branch', { name: 'Blossom branch', side: 100, seed: 11, size: 66 }),
          fx('sakura', { name: 'Falling petals', intensity: 58, wind: 35, originX: 72, spread: 70 }),
          fx('sakura', { name: 'Close petals', intensity: 8, size: 95, speed: 55, depth: 100, wind: 40, originX: 70, spread: 80 }),
          fx('dust', { name: 'Pollen', color: '#ffd9e6', intensity: 35 }),
          fx('vignette', { intensity: 58, color: '#10041a' }),
          fx('grain', { intensity: 25 })
        ]
      },
      'Neon Rain': {
        base: '#05070f',
        layers: [
          col({ name: 'Night sky', colors: ['#04060d', '#0a1330', '#1a0b34'], angle: 170 }),
          fx('bokeh', { name: 'City lights', color: '#ff3fb4', color2: '#3fd2ff', intensity: 55, opacity: 80 }),
          fx('mist', { name: 'Haze', color: '#5a6bff', intensity: 28, opacity: 70 }),
          fx('rain', { name: 'Rain', intensity: 70, wind: 22 }),
          fx('vignette', { intensity: 55, color: '#02030a' }),
          fx('grain', { intensity: 25 })
        ]
      },
      'Winter Window': {
        base: '#0c1220',
        layers: [
          col({ name: 'Cold dusk', colors: ['#0a1020', '#1d2c4a', '#3e5278'], angle: 180 }),
          fx('mist', { name: 'Frost haze', color: '#dfeaff', intensity: 38, wind: 10 }),
          fx('snow', { name: 'Snow', intensity: 65, wind: 12 }),
          fx('stars', { name: 'Faint stars', intensity: 25, opacity: 60 }),
          fx('vignette', { intensity: 45, color: '#050914' }),
          fx('grain', { intensity: 25 })
        ]
      },
      'Ember Forge': {
        base: '#0b0504',
        layers: [
          col({ name: 'Soot', mode: 'radial', colors: ['#3a0f06', '#150604', '#060202'] }),
          fx('mist', { name: 'Smoke', color: '#ff7a3a', intensity: 22, wind: 15, opacity: 60 }),
          fx('embers', { name: 'Embers', intensity: 60 }),
          fx('godrays', { name: 'Glow from above', color: '#ff8a3a', intensity: 25, originX: 30, opacity: 70 }),
          fx('vignette', { intensity: 65, color: '#050101' }),
          fx('grain', { intensity: 25 })
        ]
      },
      'Firefly Meadow': {
        base: '#050a0d',
        layers: [
          col({ name: 'Night', colors: ['#03070c', '#0a1c24', '#123a34'], angle: 180 }),
          fx('stars', { name: 'Stars', intensity: 55 }),
          fx('mist', { name: 'Ground mist', color: '#7fd8c0', intensity: 30, wind: 8, opacity: 70 }),
          fx('fireflies', { name: 'Fireflies', intensity: 55 }),
          fx('dust', { name: 'Motes', color: '#c9ffe8', intensity: 25 }),
          fx('vignette', { intensity: 55, color: '#02060a' }),
          fx('grain', { intensity: 25 })
        ]
      },
      'Autumn Drift': {
        base: '#140a05',
        layers: [
          col({ name: 'Late afternoon', colors: ['#120a08', '#2b1a14', '#4a3226'], angle: 170 }),
          fx('godrays', { name: 'Low sun', color: '#ffc47a', intensity: 45, originX: 20, spread: 50 }),
          fx('leaves', { name: 'Leaves', intensity: 55, wind: 45 }),
          fx('dust', { name: 'Dust in light', color: '#ffe2b0', intensity: 45 }),
          fx('vignette', { intensity: 50, color: '#0d0502' }),
          fx('grain', { intensity: 25 })
        ]
      },
      'Halloween Hollow': {
        base: '#100814',
        layers: [
          col({ name: 'Haunted twilight', colors: ['#090711', '#21102b', '#4a1d32'], angle: 165 }),
          col({ name: 'Moonlit fog', mode: 'radial', colors: ['#8e6bb3', '#332044', '#090711'], cx: 76, cy: 18, rad: 48, blend: 'screen', opacity: 62 }),
          fx('mist', { name: 'Graveyard fog', color: '#a58bbd', intensity: 30, wind: 12, opacity: 70 }),
          fx('embers', { name: 'Witchlight sparks', color: '#ff7a2f', intensity: 35, size: 42 }),
          fx('leaves', { name: 'Dead leaves', color: '#b9562e', intensity: 32, wind: 24, size: 36 }),
          fx('stars', { name: 'Distant stars', color: '#d7b6ff', intensity: 26, density: 28, opacity: 65 }),
          fx('vignette', { intensity: 62, color: '#08040d' }),
          fx('grain', { intensity: 25 })
        ]
      },
      'Frosted Evergreen': {
        base: '#071512',
        layers: [
          col({ name: 'Evergreen night', colors: ['#06130f', '#12352b', '#315344'], angle: 170 }),
          fx('snow', { name: 'Soft snowfall', intensity: 38, wind: 8, size: 34, opacity: 78 }),
          fx('bokeh', { name: 'Warm lights', color: '#ffd18a', color2: '#ff687d', intensity: 30, opacity: 72 }),
          fx('mist', { name: 'Winter haze', color: '#b8d8d0', intensity: 20, wind: 6, opacity: 55 }),
          fx('vignette', { intensity: 48, color: '#020a08' }),
          fx('grain', { intensity: 25 })
        ]
      },
      'Spring Bloom': {
        base: '#171022',
        layers: [
          col({ name: 'Petal dusk', colors: ['#171022', '#432348', '#a64d71'], angle: 175 }),
          fx('sakura', { name: 'Falling blossoms', intensity: 34, size: 42, speed: 28, wind: 18, opacity: 82 }),
          fx('fireflies', { name: 'Pollen glimmers', color: '#ffe39a', intensity: 24, size: 24, opacity: 70 }),
          fx('mist', { name: 'Soft spring haze', color: '#f5b4cf', intensity: 22, wind: 10, opacity: 55 }),
          fx('vignette', { intensity: 40, color: '#12091b' }),
          fx('grain', { intensity: 25 })
        ]
      },
      'Summer Solstice': {
        base: '#10140d',
        layers: [
          col({ name: 'Golden hour', colors: ['#14100b', '#55301c', '#b46b2d'], angle: 155 }),
          fx('godrays', { name: 'Late sunbeams', color: '#ffd27a', intensity: 35, originX: 24, spread: 46, opacity: 78 }),
          fx('fireflies', { name: 'Meadow fireflies', color: '#d9ff86', intensity: 38, size: 36 }),
          fx('dust', { name: 'Golden motes', color: '#ffe6aa', intensity: 26, opacity: 70 }),
          fx('vignette', { intensity: 42, color: '#100806' }),
          fx('grain', { intensity: 25 })
        ]
      }
    };
  }

  root.DDLayers = { create, newLayer, EFFECTS, DOM_EFFECTS, PARAM_DEFS, BLENDS, CLASSIC, CLASSIC_PARAMS, effectDef, allEffects, presets, newId };
})(typeof self !== 'undefined' ? self : globalThis);
