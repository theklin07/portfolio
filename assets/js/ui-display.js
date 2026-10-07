/* ═══════════════════════════════════════════════════════════════════
   Project UI displays — the product itself, gently in motion.

   Each project's right-hand stage shows the real interface from its
   deck, drawn straight onto the page:

     phones    two devices, the front one stepping through the flow
               (TossLess, Steam)
     browser   a small stack of windows cycling through dashboards
               (Aquila)
     pending   an empty device for a project whose screens aren't in
               yet (Apple Health) -- honest, rather than invented UI

   One loop drives every stage; each pauses while off screen.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CONFIGS = {
    tossless: {
      kind: 'phones', base: 'assets/projects/tossless-ui/', ext: 'webp',
      framed: true,                                   // screens already sit in their frame
      front: ['home', 'expiring', 'detect', 'restock'],
      back: ['notify', 'home']
    },
    steam: {
      kind: 'phones', base: 'assets/projects/steam-live/', ext: 'jpg',
      frame: 'phone.png',
      hole: { x: 0.2122, y: 0.029, w: 0.5756, h: 0.9366, r: 0.07 },
      front: ['home', 'fitscore', 'tradein'],
      back: ['store', 'fitdetail']
    },
    aquila: {
      kind: 'browser', base: 'assets/projects/', ext: 'jpg',
      screens: ['aquila-01', 'aquila-02', 'aquila-03', 'aquila-04']
    },
    cycle: { kind: 'pending', label: 'Screens in progress' }
  };

  var STEP = 3.4;                                     // seconds per screen
  var stages = [];

  /* ───────────── helpers ───────────── */

  var clamp = function (x) { return Math.max(0, Math.min(1, x)); };
  var ease = function (x) { x = clamp(x); return x * x * (3 - 2 * x); };

  function load(src) {
    return new Promise(function (res, rej) {
      var i = new Image();
      i.onload = function () { res(i); };
      i.onerror = rej;
      i.src = src;
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // cover-fit, top aligned, like a real screen
  function coverTop(ctx, im, x, y, w, h, dy) {
    var s = Math.max(w / im.width, h / im.height);
    ctx.drawImage(im, x + (w - im.width * s) / 2, y + (dy || 0), im.width * s, im.height * s);
  }

  function softShadow(ctx, cx, cy, rx, ry, a) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(58, 48, 36, ' + a + ')');
    g.addColorStop(1, 'rgba(58, 48, 36, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ───────────── phones ───────────── */

  function drawPhones(st) {
    var ctx = st.ctx, c = st.cfg, W = st.W, H = st.H, t = st.t;
    var sample = c.framed ? st.img[c.front[0]] : st.img.frame;
    var ph = H * (c.framed ? 0.9 : 0.96);
    var pw = ph * sample.width / sample.height;
    // keep both devices inside a narrow stage
    var maxW = W * (c.framed ? 0.48 : 0.66);
    if (pw > maxW) { ph *= maxW / pw; pw = maxW; }

    var step = Math.floor(t / STEP), local = t - step * STEP;
    var mix = ease((local - (STEP - 0.7)) / 0.7);

    var slots = [
      { list: c.back, idx: Math.floor(step / 2), mix: step % 2 === 1 ? mix : 0,
        cx: W * 0.36, cy: H * 0.53, s: 0.84, rot: -0.1, bob: Math.sin(t * 0.7 + 1.3) },
      { list: c.front, idx: step, mix: mix,
        cx: W * 0.61, cy: H * 0.5, s: 1, rot: 0.03, bob: Math.sin(t * 0.8) }
    ];

    slots.forEach(function (sl) {
      var w = pw * sl.s, h = ph * sl.s;
      var cur = sl.list[sl.idx % sl.list.length];
      var nxt = sl.list[(sl.idx + 1) % sl.list.length];
      var y = sl.cy + sl.bob * H * 0.01;

      if (c.framed) softShadow(ctx, sl.cx, y + h * 0.5, w * 0.46, h * 0.03, 0.2);

      ctx.save();
      ctx.translate(sl.cx, y);
      ctx.rotate(sl.rot);
      var x0 = -w / 2, y0 = -h / 2;

      if (c.framed) {
        ctx.drawImage(st.img[cur], x0, y0, w, h);
        if (sl.mix > 0) {
          ctx.globalAlpha = sl.mix;
          ctx.drawImage(st.img[nxt], x0, y0, w, h);
          ctx.globalAlpha = 1;
        }
      } else {
        var hx = x0 + c.hole.x * w, hy = y0 + c.hole.y * h;
        var hw = c.hole.w * w, hh = c.hole.h * h;
        ctx.save();
        roundRect(ctx, hx, hy, hw, hh, c.hole.r * w);
        ctx.clip();
        ctx.fillStyle = '#0B0E13';
        ctx.fillRect(hx, hy, hw, hh);
        coverTop(ctx, st.img[cur], hx, hy, hw, hh);
        if (sl.mix > 0) {
          ctx.globalAlpha = sl.mix;
          coverTop(ctx, st.img[nxt], hx, hy, hw, hh, (1 - sl.mix) * hh * 0.04);
        }
        ctx.restore();
        ctx.drawImage(st.img.frame, x0, y0, w, h);
      }
      ctx.restore();
    });
  }

  /* ───────────── browser windows ───────────── */

  function drawBrowser(st) {
    var ctx = st.ctx, c = st.cfg, W = st.W, H = st.H, t = st.t;
    var n = c.screens.length;
    var ww = Math.min(W * 0.9, H * 1.4);
    var bar = Math.max(14, ww * 0.045);
    var ch = ww * 0.53;                                // content area, dashboard-shaped
    var wh = bar + ch;

    var step = Math.floor(t / STEP), local = t - step * STEP;
    var p = ease((local - (STEP - 0.9)) / 0.9);        // how far the stack has advanced

    // depth 0 = front. Each window eases one place forward as p runs 0 → 1.
    var stackH = wh + H * 0.2;
    var baseY = (H - stackH) / 2 + H * 0.2;
    function place(depth) {
      return {
        x: (W - ww) / 2 + depth * W * 0.055,
        y: baseY - depth * H * 0.1,
        s: 1 - depth * 0.07,
        a: depth >= 2 ? 0.55 : 1
      };
    }
    function lerp(a, b, k) { return a + (b - a) * k; }

    for (var depth = 3; depth >= 0; depth--) {
      var from = place(depth), to = place(Math.max(0, depth - 1));
      var k = depth === 0 ? 0 : p;
      var x = lerp(from.x, to.x, k), y = lerp(from.y, to.y, k);
      var s = lerp(from.s, to.s, k), a = lerp(from.a, to.a, k);
      if (depth === 3) a *= p;                          // the newest window fades in at the back
      if (depth === 0) { a *= 1 - p; y += p * H * 0.08; } // the front one drops away
      if (a <= 0.01) continue;

      var im = st.img[c.screens[(step + depth) % n]];
      var w = ww * s, hgt = wh * s, b = bar * s;
      var cx = x + (ww - w) / 2;

      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowColor = 'rgba(27, 32, 22, 0.14)';
      ctx.shadowBlur = w * 0.05;
      ctx.shadowOffsetY = w * 0.018;
      roundRect(ctx, cx, y, w, hgt, w * 0.018);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // title bar
      ctx.save();
      roundRect(ctx, cx, y, w, hgt, w * 0.018);
      ctx.clip();
      ctx.fillStyle = '#E9E3D7';
      ctx.fillRect(cx, y, w, b);
      ['#D9D2C4', '#D9D2C4', '#D9D2C4'].forEach(function (col, i) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx + b * (0.7 + i * 0.55), y + b / 2, b * 0.16, 0, Math.PI * 2);
        ctx.fill();
      });
      roundRect(ctx, cx + w * 0.3, y + b * 0.24, w * 0.4, b * 0.52, b * 0.26);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();

      // dashboard, drifting slowly down the page if it is taller than the window
      var dh = w * im.height / im.width;
      var over = Math.max(0, dh - (hgt - b));
      var drift = over * ease(((t + depth) % (STEP * 2)) / (STEP * 2));
      ctx.beginPath();
      ctx.rect(cx, y + b, w, hgt - b);
      ctx.clip();
      ctx.drawImage(im, cx, y + b - drift, w, dh);
      ctx.restore();

      roundRect(ctx, cx + 0.5, y + 0.5, w - 1, hgt - 1, w * 0.018);
      ctx.strokeStyle = 'rgba(27, 32, 22, 0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ───────────── pending ───────────── */

  function drawPending(st) {
    var ctx = st.ctx, W = st.W, H = st.H, t = st.t;
    var h = H * 0.84, w = h * 0.49;
    if (w > W * 0.5) { w = W * 0.5; h = w / 0.49; }
    var x = (W - w) / 2, y = (H - h) / 2 + Math.sin(t * 0.8) * H * 0.008;

    softShadow(ctx, W / 2, y + h, w * 0.46, h * 0.03, 0.16);
    roundRect(ctx, x, y, w, h, w * 0.14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(27, 32, 22, 0.22)';
    ctx.lineWidth = Math.max(1.5, w * 0.012);
    ctx.stroke();
    roundRect(ctx, x + w * 0.36, y + h * 0.025, w * 0.28, h * 0.03, h * 0.015);
    ctx.fillStyle = 'rgba(27, 32, 22, 0.16)';
    ctx.fill();

    // skeleton rows with a slow shimmer
    var rows = [[0.14, 0.5], [0.2, 0.72], [0.26, 0.6], [0.62, 0.66], [0.68, 0.44], [0.74, 0.58]];
    rows.forEach(function (r, i) {
      var shimmer = 0.1 + 0.08 * (0.5 + 0.5 * Math.sin(t * 2 - i * 0.6));
      roundRect(ctx, x + w * 0.12, y + h * r[0], w * r[1] * 0.76, h * 0.022, h * 0.011);
      ctx.fillStyle = 'rgba(27, 32, 22, ' + shimmer + ')';
      ctx.fill();
    });

    ctx.fillStyle = '#8B9182';
    ctx.font = '500 ' + Math.max(10, Math.round(w * 0.055)) + 'px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(st.cfg.label.toUpperCase(), W / 2, y + h * 0.45);
  }

  /* ───────────── stage plumbing ───────────── */

  function resize(st) {
    var r = st.el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    st.dpr = Math.min(window.devicePixelRatio || 1, 2);
    st.W = r.width; st.H = r.height;
    st.canvas.width = Math.round(st.W * st.dpr);
    st.canvas.height = Math.round(st.H * st.dpr);
  }

  function draw(st) {
    if (!st.ready || !st.W) return;
    var ctx = st.ctx;
    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    ctx.clearRect(0, 0, st.W, st.H);
    if (st.cfg.kind === 'phones') drawPhones(st);
    else if (st.cfg.kind === 'browser') drawBrowser(st);
    else drawPending(st);
  }

  document.querySelectorAll('[data-ui]').forEach(function (el) {
    var cfg = CONFIGS[el.getAttribute('data-ui')];
    var canvas = el.querySelector('canvas');
    if (!cfg || !canvas || !canvas.getContext) return;

    var st = {
      el: el, cfg: cfg, canvas: canvas, ctx: canvas.getContext('2d'),
      img: {}, t: reduce ? 1.2 : 0, W: 0, H: 0, dpr: 1,
      ready: false, onscreen: true, hovered: false
    };
    stages.push(st);

    var names = [];
    if (cfg.kind === 'phones') names = cfg.front.concat(cfg.back);
    if (cfg.kind === 'browser') names = cfg.screens;
    var jobs = names.filter(function (n, i) { return names.indexOf(n) === i; }).map(function (n) {
      return load(cfg.base + n + '.' + cfg.ext).then(function (im) { st.img[n] = im; });
    });
    if (cfg.frame) jobs.push(load(cfg.base + cfg.frame).then(function (im) { st.img.frame = im; }));

    Promise.all(jobs).then(function () {
      st.ready = true;
      resize(st);
      el.classList.add('is-live');
      draw(st);
    }).catch(function () { /* leave the stage empty */ });

    if ('ResizeObserver' in window) new ResizeObserver(function () { resize(st); draw(st); }).observe(el);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { st.onscreen = es[0].isIntersecting; }, { rootMargin: '80px' }).observe(el);
    }
    var project = el.closest('.project');
    if (project) {
      project.addEventListener('pointerenter', function () { st.hovered = true; });
      project.addEventListener('pointerleave', function () { st.hovered = false; });
      project.addEventListener('focusin', function () { st.hovered = true; });
      project.addEventListener('focusout', function () { st.hovered = false; });
    }
    if (cfg.kind === 'pending' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { draw(st); });
    }
  });

  if (!stages.length) return;
  if (!('ResizeObserver' in window)) {
    window.addEventListener('resize', function () { stages.forEach(function (s) { resize(s); draw(s); }); });
  }
  if (reduce) return;

  var last = 0, visible = true;
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; });
  (function frame(now) {
    requestAnimationFrame(frame);
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!visible) return;
    stages.forEach(function (st) {
      if (!st.ready || !st.onscreen) return;
      st.t += dt * (st.hovered ? 1.6 : 1);
      draw(st);
    });
  })(0);
})();
