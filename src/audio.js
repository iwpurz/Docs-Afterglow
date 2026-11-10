/* Docs Afterglow: typing-sound synthesizer.
 * Every sound is built live with the Web Audio API from short noise bursts and decaying sine "modes" (the way a key cap,
 * a plate, a wooden block or a string rings), so there are no audio files and nothing is downloaded.
 * Used by the content script (real typing) and by the settings page and Studio (preview buttons).
 *
 * Design rules, because typing sounds get heard thousands of times: keep the high end soft (a gentle low-pass sits on the
 * output), keep every sound short and quiet, vary pitch and loudness a little each press, and put melodic packs on a scale
 * so any run of keys sounds pleasant.
 */
(function (root) {
  'use strict';

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const A = { ac: null, sfx: null, tone: null, comp: null, noise: null, verb: null, dly: null };

  function ensure() {
    if (!A.ac) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      const ac = A.ac = new AC();
      A.comp = ac.createDynamicsCompressor();
      A.comp.threshold.value = -18; A.comp.ratio.value = 5; A.comp.attack.value = 0.003; A.comp.release.value = 0.15;
      A.tone = ac.createBiquadFilter(); A.tone.type = 'lowpass'; A.tone.frequency.value = 7500; A.tone.Q.value = 0.5;   // tames harshness
      A.sfx = ac.createGain();
      A.sfx.connect(A.tone); A.tone.connect(A.comp); A.comp.connect(ac.destination);
      const len = ac.sampleRate * 2, nb = ac.createBuffer(1, len, ac.sampleRate), d = nb.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      A.noise = nb;
      // room reverb
      const rl = Math.floor(ac.sampleRate * 1.6), rb = ac.createBuffer(2, rl, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const r = rb.getChannelData(c); for (let i = 0; i < rl; i++) r[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3); }
      A.verb = ac.createConvolver(); A.verb.buffer = rb;
      const wet = ac.createGain(); wet.gain.value = 0.3; A.verb.connect(wet); wet.connect(A.sfx);
      // soft echo for the synthy packs
      A.dly = ac.createDelay(1); A.dly.delayTime.value = 0.23;
      const fb = ac.createGain(); fb.gain.value = 0.32;
      const dlp = ac.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2200;
      A.dly.connect(dlp); dlp.connect(fb); fb.connect(A.dly);
      const dw = ac.createGain(); dw.gain.value = 0.35; dlp.connect(dw); dw.connect(A.sfx); dw.connect(A.verb);
    }
    if (A.ac.state === 'suspended') A.ac.resume().catch(() => {});
    return A.ac;
  }
  const vol = (v) => Math.pow(Math.max(0, Math.min(100, v)) / 100, 1.6);

  // ---- building blocks -------------------------------------------------------------
  function mode(ac, out, t, f, peak, decay, type, glideTo, attack) {      // a damped sine: one resonance ringing out
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + (attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + decay + 0.03);
  }
  function burst(ac, out, t, type, freq, q, peak, dur, attack) {           // filtered noise: the transient
    const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = A.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + (attack || 0.001));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(out);
    n.start(t, Math.random() * 1.4, dur + 0.03);
  }
  function sweep(ac, out, t, f0, f1, q, peak, dur) {                      // noise whose pitch moves (a slide, a swoosh)
    const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = A.noise; f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(0.03, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(out); n.start(t, Math.random() * 1.4, dur + 0.05);
  }
  // a pitched voice made of partials [ratio, level, decayScale]; sent to the dry bus plus any of the room / echo
  function voice(ac, t, f, peak, decay, partials, o) {
    o = o || {};
    const bus = ac.createGain(); bus.connect(A.sfx);
    if (o.verb) bus.connect(A.verb);
    if (o.echo) bus.connect(A.dly);
    partials.forEach(function (p) { mode(ac, bus, t, f * p[0], peak * p[1], decay * p[2], o.type || 'sine', null, o.attack); });
  }

  // ---- scales ----------------------------------------------------------------------
  const SCALES = { penta: [0, 2, 4, 7, 9], hira: [0, 2, 3, 7, 8], minor: [0, 3, 5, 7, 10], lydian: [0, 2, 4, 6, 7, 9, 11] };
  const walks = {};
  function nextDeg(pack, lo, hi, kind) {
    let w = walks[pack]; if (w == null) w = walks[pack] = Math.floor((lo + hi) / 2);
    if (kind === 'back') w = Math.max(lo, w - 1);
    else w = Math.max(lo, Math.min(hi, w + pick([-2, -1, -1, 1, 1, 1, 2])));
    walks[pack] = w; return w;
  }
  const noteHz = (scale, deg, oct) => 261.63 * Math.pow(2, (scale[((deg % scale.length) + scale.length) % scale.length] + 12 * (Math.floor(deg / scale.length) + (oct || 0))) / 12);

  // ---- the packs -----------------------------------------------------------------------
  // `k` pitch factor (random per press), `v` loudness factor (random), `sp` key kind: key | space | enter | back
  const KEYS = {
    soft(ac, t, sp, k, v) {                       // quiet laptop / membrane keys
      const o = A.sfx, low = sp === 'space' ? 0.8 : sp === 'back' ? 1.1 : 1;
      burst(ac, o, t, 'bandpass', 1400 * k, 0.6, 0.13 * v, 0.022);
      mode(ac, o, t, 140 * k * low, 0.24 * v, 0.045);
      mode(ac, o, t, 250 * k * low, 0.09 * v, 0.03);
    },
    thock(ac, t, sp, k, v) {                      // lubed linear switches: round and low, almost no click
      const o = A.sfx, big = sp === 'enter' ? 1.2 : sp === 'space' ? 1.1 : 1, low = sp === 'space' ? 0.74 : sp === 'enter' ? 0.84 : sp === 'back' ? 1.08 : 1;
      burst(ac, o, t, 'lowpass', 2300, 0.7, 0.14 * v, 0.014);
      mode(ac, o, t, 105 * k * low, 0.50 * v * big, 0.085 * big);
      mode(ac, o, t, 190 * k * low, 0.30 * v * big, 0.06 * big);
      mode(ac, o, t, 310 * k * low, 0.13 * v, 0.04);
      mode(ac, o, t, 130 * k * low, 0.22 * v, 0.05, 'triangle', 65 * low);
    },
    clicky(ac, t, sp, k, v) {                     // tactile switches: a click then a clack, kept rounded
      const o = A.sfx, low = sp === 'space' ? 0.78 : sp === 'enter' ? 0.88 : 1;
      burst(ac, o, t, 'bandpass', 3000 * k, 2, 0.26 * v, 0.008);
      burst(ac, o, t + 0.012, 'bandpass', 2000 * k, 2, 0.2 * v, 0.011);
      mode(ac, o, t, 175 * k * low, 0.22 * v, 0.034);
      mode(ac, o, t, 360 * k * low, 0.10 * v, 0.024);
    },

    // A real typewriter: the key lever throws a type bar at the platen (a sharp, slightly metallic clack with a dull thump
    // underneath), then the escapement ratchet ticks as the carriage steps one space. The space bar skips the strike.
    // Return: a rolling ratchet while the carriage slides, a bell near the end, a clunk when it stops.
    typewriter(ac, t, sp, k, v) {
      const o = A.sfx;
      const ratchet = (at, n) => { for (let i = 0; i < n; i++) burst(ac, o, at + i * 0.021, 'bandpass', (2300 - i * 55) * k, 5, 0.17 * v, 0.006); };
      if (sp === 'back') {                         // backspace only moves the carriage back one notch
        burst(ac, o, t, 'bandpass', 1800 * k, 4, 0.2 * v, 0.008); mode(ac, o, t, 130 * k, 0.12 * v, 0.03);
        burst(ac, o, t + 0.03, 'bandpass', 2000 * k, 5, 0.12 * v, 0.006);
        return;
      }
      if (sp === 'enter') {
        burst(ac, o, t, 'bandpass', 1500 * k, 2, 0.28 * v, 0.014); mode(ac, o, t, 180 * k, 0.3 * v, 0.06);      // lever hit
        ratchet(t + 0.05, 11);                                                                                  // carriage zipping
        sweep(ac, o, t + 0.05, 1100, 420, 0.9, 0.07 * v, 0.26);
        mode(ac, o, t + 0.05, 2637, 0.11, 1.1); mode(ac, o, t + 0.05, 2637 * 2.76, 0.05, 0.7); mode(ac, o, t + 0.05, 2637 * 5.4, 0.022, 0.4);   // bell
        mode(ac, o, t + 0.31, 88, 0.45 * v, 0.1); burst(ac, o, t + 0.31, 'lowpass', 700, 0.7, 0.2 * v, 0.05);    // stop clunk
        return;
      }
      if (sp === 'space') {
        mode(ac, o, t, 150 * k, 0.34 * v, 0.07); burst(ac, o, t, 'lowpass', 900, 0.7, 0.16 * v, 0.03);
        ratchet(t + 0.026, 1);
        return;
      }
      burst(ac, o, t, 'bandpass', 1150 * k, 2, 0.34 * v, 0.014);                // strike
      burst(ac, o, t, 'bandpass', 2700 * k, 3, 0.15 * v, 0.008);
      mode(ac, o, t, 210 * k, 0.4 * v, 0.045);                                  // platen thump
      mode(ac, o, t, 530 * k, 0.17 * v, 0.03);
      mode(ac, o, t, 1430 * k, 0.07 * v, 0.03);                                 // metal ring
      ratchet(t + 0.028, 1);                                                    // escapement tick
    },

    pencil(ac, t, sp, k, v) {                    // graphite on paper: quiet scratches
      const o = A.sfx;
      if (sp === 'back') { sweep(ac, o, t, 1500, 900, 0.5, 0.08 * v, 0.11); sweep(ac, o, t + 0.07, 1000, 1500, 0.5, 0.06 * v, 0.1); return; }   // eraser rub
      if (sp === 'enter') { sweep(ac, o, t, 3200, 1700, 0.7, 0.1 * v, 0.2); return; }
      const d = sp === 'space' ? 0.03 : rnd(0.04, 0.085), f0 = rnd(2200, 3200) * k;
      sweep(ac, o, t, f0, f0 * rnd(0.6, 1.3), 0.8, (sp === 'space' ? 0.05 : 0.1) * v, d);
      burst(ac, o, t, 'lowpass', 700, 0.6, 0.06 * v, 0.02);                    // tiny tap of the lead
    },
    wood(ac, t, sp, k, v) {                      // warm wooden blocks
      const o = A.sfx, f = (sp === 'space' ? 330 : sp === 'back' ? 640 : 480) * k * rnd(0.97, 1.03);
      const knock = (at, ff, p) => { mode(ac, o, at, ff, 0.42 * v * p, 0.07); mode(ac, o, at, ff * 2.4, 0.12 * v * p, 0.04); mode(ac, o, at, ff * 3.9, 0.05 * v * p, 0.025); burst(ac, o, at, 'lowpass', 1800, 0.7, 0.07 * v * p, 0.012); };
      knock(t, f, 1);
      if (sp === 'enter') knock(t + 0.085, f * 0.75, 0.85);
    },
    kalimba(ac, t, sp, k, v) {                   // thumb piano: a soft pluck with a bright little ping
      const sc = SCALES.penta, f = noteHz(sc, nextDeg('kal', 0, 9, sp), 0) * (sp === 'space' ? 0.5 : 1);
      const play = (at, ff, p) => { voice(ac, at, ff, 0.34 * v * p, 1.0, [[1, 1, 1], [5.4, 0.1, 0.12], [2, 0.12, 0.4]], { verb: true });
                                    burst(ac, A.sfx, at, 'lowpass', 1500, 0.7, 0.05 * v * p, 0.01); };
      play(t, f, 1);
      if (sp === 'enter') { play(t + 0.07, f * 1.25, 0.8); play(t + 0.14, f * 1.5, 0.7); }
    },
    koto(ac, t, sp, k, v) {                      // plucked string on the Japanese hirajoshi scale
      const sc = SCALES.hira, f = noteHz(sc, nextDeg('koto', 0, 9, sp), 0) * (sp === 'space' ? 0.5 : 1);
      const pluck = (at, ff, p) => {
        voice(ac, at, ff, 0.3 * v * p, 1.2, [[1, 1, 1], [2, 0.5, 0.6], [3, 0.3, 0.42], [4, 0.16, 0.3], [5.02, 0.08, 0.2]], { verb: true });
        mode(ac, A.sfx, at, ff * 1.04, 0.1 * v * p, 0.05, 'triangle', ff);                               // the pluck bends into pitch
        burst(ac, A.sfx, at, 'bandpass', 2400, 1.2, 0.06 * v * p, 0.012);
      };
      pluck(t, f, 1);
      if (sp === 'enter') { pluck(t + 0.09, f * 1.5, 0.8); pluck(t + 0.18, f * 2, 0.7); }
    },
    glass(ac, t, sp, k, v) {                     // quiet glass chimes
      const sc = SCALES.lydian, f = noteHz(sc, nextDeg('gla', 0, 10, sp), 1) * (sp === 'space' ? 0.5 : 1);
      const ping = (at, ff, p) => voice(ac, at, ff, 0.17 * v * p, 1.5, [[1, 1, 1], [2.32, 0.4, 0.7], [4.25, 0.18, 0.45], [6.63, 0.07, 0.3]], { verb: true, attack: 0.004 });
      ping(t, f, 1);
      if (sp === 'enter') ping(t + 0.1, f * 1.5, 0.8);
    },
    synthpluck(ac, t, sp, k, v) {                // soft synth pluck with a filter sweep and a gentle echo
      const sc = SCALES.minor, f = noteHz(sc, nextDeg('syn', 0, 9, sp), -1) * (sp === 'space' ? 0.5 : 1);
      const play = (at, ff, p) => {
        const bus = ac.createGain(), lpf = ac.createBiquadFilter();
        lpf.type = 'lowpass'; lpf.Q.value = 3; lpf.frequency.setValueAtTime(2800, at); lpf.frequency.exponentialRampToValueAtTime(380, at + 0.22);
        [-6, 6].forEach((d) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = ff; o.detune.value = d;
          g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.1 * v * p, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
          o.connect(g); g.connect(lpf); o.start(at); o.stop(at + 0.36); });
        lpf.connect(bus); bus.connect(A.sfx); bus.connect(A.dly); bus.connect(A.verb);
      };
      play(t, f, 1);
      if (sp === 'enter') play(t + 0.11, f * 1.5, 0.8);
    },
    drops(ac, t, sp, k, v) {                     // water drops
      const bus = ac.createGain(); bus.connect(A.sfx); bus.connect(A.verb); bus.connect(A.dly);
      const f0 = rnd(520, 900) * k * (sp === 'space' ? 0.7 : 1);
      if (sp === 'back') { mode(ac, bus, t, f0 * 1.7, 0.16 * v, 0.07, 'sine', f0 * 0.8); return; }
      const big = sp === 'enter';
      mode(ac, bus, t, f0 * (big ? 0.7 : 1), 0.2 * v, big ? 0.14 : 0.085, 'sine', f0 * (big ? 1.7 : 1.55));
      mode(ac, bus, t, f0 * 1.5, 0.05 * v, 0.06, 'sine', f0 * 2.2);
    },
    piano(ac, t, sp, k, v) {                     // felt piano
      const sc = SCALES.penta, part = [[1, 1, 1], [2, 0.3, 0.6], [3, 0.12, 0.4], [4, 0.05, 0.25]];
      const play = (deg, p, dec) => {
        const f = noteHz(sc, deg, 0) * (sp === 'space' ? 0.5 : 1);
        voice(ac, t, f, 0.2 * v * p, dec, part, { verb: true });
        voice(ac, t, f * 1.003, 0.1 * v * p, dec, part.slice(0, 2), { verb: true });
        burst(ac, A.sfx, t, 'lowpass', 1600, 0.6, 0.035 * v * p, 0.012);        // felt hammer
      };
      const d = nextDeg('pia', 0, 11, sp);
      if (sp === 'enter') { play(d, 1, 1.6); play(d + 2, 0.8, 1.6); play(d + 4, 0.7, 1.6); }
      else play(d, sp === 'back' ? 0.7 : 1, sp === 'back' ? 0.6 : 1.1);
    },
    marimba(ac, t, sp, k, v) {
      const sc = SCALES.penta, f = noteHz(sc, nextDeg('mar', 0, 9, sp), 1) * (sp === 'space' ? 0.5 : 1);
      const play = (at, ff, p) => { voice(ac, at, ff, 0.26 * v * p, 0.55, [[1, 1, 1], [4, 0.28, 0.22], [10, 0.07, 0.07]], { verb: true }); burst(ac, A.sfx, at, 'bandpass', 1500, 1, 0.04 * v * p, 0.008); };
      play(t, f, 1);
      if (sp === 'enter') play(t + 0.08, f * 1.25, 0.8);
    }
  };

  // releasing the key: a small, quieter tick (only the mechanical packs have one)
  const RELEASE = {
    thock(ac, t, sp, k, v) { burst(ac, A.sfx, t, 'bandpass', 1700 * k, 1.2, 0.055 * v, 0.012); mode(ac, A.sfx, t, 240 * k, 0.07 * v, 0.026); },
    clicky(ac, t, sp, k, v) { burst(ac, A.sfx, t, 'bandpass', 3600 * k, 2, 0.12 * v, 0.007); mode(ac, A.sfx, t, 290 * k, 0.05 * v, 0.02); },
    soft(ac, t, sp, k, v) { burst(ac, A.sfx, t, 'bandpass', 1700 * k, 0.7, 0.04 * v, 0.012); },
    typewriter(ac, t, sp, k, v) { if (sp === 'enter' || sp === 'back') return; burst(ac, A.sfx, t, 'bandpass', 1000 * k, 1.5, 0.09 * v, 0.02); mode(ac, A.sfx, t, 130 * k, 0.06 * v, 0.03); }   // the lever springs back
  };

  function hit(cfg, type) {
    if (!cfg || !cfg.enabled) return;
    const fn = KEYS[cfg.kind]; if (!fn) return;
    const ac = ensure(); if (!ac) return;
    A.sfx.gain.value = vol(cfg.volume);
    fn(ac, ac.currentTime + 0.004, cfg.special ? type : 'key', cfg.pitch ? rnd(0.95, 1.05) : 1, rnd(0.85, 1));
  }
  function release(cfg, type) {
    if (!cfg || !cfg.enabled || !cfg.release) return;
    const fn = RELEASE[cfg.kind]; if (!fn) return;
    const ac = ensure(); if (!ac) return;
    A.sfx.gain.value = vol(cfg.volume);
    fn(ac, ac.currentTime + 0.004, cfg.special ? type : 'key', cfg.pitch ? rnd(0.95, 1.05) : 1, rnd(0.8, 1));
  }
  function setVolume(v) { if (A.sfx) A.sfx.gain.value = vol(v); }

  // short typing demo (settings page and Studio)
  function preview(cfg) {
    const c = Object.assign({}, cfg, { enabled: true });
    const seq = ['key', 'key', 'key', 'key', 'space', 'key', 'key', 'key', 'key', 'back', 'key', 'enter'];
    let t = 0;
    seq.forEach(function (type) {
      t += rnd(110, 190);
      setTimeout(function () { hit(c, type); setTimeout(function () { release(c, type); }, rnd(55, 95)); }, t);
    });
  }

  root.DDAudio = { hit, release, preview, setVolume, ensure, kinds: Object.keys(KEYS) };
})(typeof window !== 'undefined' ? window : self);
