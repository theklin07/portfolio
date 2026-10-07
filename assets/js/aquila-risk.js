/* ═══════════════════════════════════════════════════════════════════
   Aquila card — a week of appointments becomes a list to work.

   A week fills in on a Mon–Fri calendar, one dot per appointment. Then
   the dots sort themselves into the ranked bars of the no-show risk
   dashboard: highest predicted risk on top, in the deck's orange. The
   point of the project in one move -- a clinic manager works a list
   instead of a hunch.

   Drawn natively in the page's own type and colours rather than pasted
   in as a dashboard screenshot. Proportions follow the deck: risk tiers
   split 20 / 56 / 24 (187 high, 522 medium, 226 low of 935 scored), the
   top score is 0.41, Friday runs riskiest (20.9%) and Wednesday calmest
   (15.8%).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var media = document.querySelector('[data-aquila]');
  if (!media) return;
  var canvas = media.querySelector('canvas');
  var ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;

  var btn = media.closest('.project');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  var ROWS = 8;                       // 8am – 4pm
  var N = DAYS.length * ROWS;         // 40 appointments
  var TOP = 0.41;                     // highest risk score in the deck

  var TIER = {
    high: { color: '#E94B27' },       // the deck's accent
    med:  { color: '#8C9A63' },
    low:  { color: '#CBD1B8' }
  };
  var INK_3 = '#8B9182';

  // seconds
  var T_SORT = 3.1, T_SORTED = 4.8, T_CLEAR = 7.6, CYCLE = 8.8;

  var W = 0, H = 0, dpr = 1, L = {};
  var appts = [];
  var t = 0, hovered = false, visible = true, onscreen = true, last = 0, raf = 0;

  /* ───────────── a week of appointments ───────────── */

  function week() {
    // Risk leans on the day: Friday highest, Wednesday lowest, as in the deck.
    var dayBias = [0.00, 0.01, -0.035, 0.005, 0.04];
    var list = [];
    for (var d = 0; d < DAYS.length; d++) {
      for (var r = 0; r < ROWS; r++) {
        var base = 0.05 + Math.pow(Math.random(), 1.6) * 0.33;
        list.push({ day: d, row: r, score: Math.max(0.03, Math.min(TOP, base + dayBias[d])) });
      }
    }
    // Tier by rank so every week keeps the deck's 20 / 56 / 24 split.
    var ranked = list.slice().sort(function (a, b) { return b.score - a.score; });
    ranked[0].score = TOP;
    var nHigh = Math.round(N * 0.20), nLow = Math.round(N * 0.24);
    ranked.forEach(function (a, i) {
      a.rank = i;
      a.tier = i < nHigh ? 'high' : (i >= N - nLow ? 'low' : 'med');
      a.delayIn = a.day * 0.11 + a.row * 0.045 + Math.random() * 0.06;
      a.delaySort = i * 0.022;
    });
    return list;
  }

  /* ───────────── layout ───────────── */

  function resize() {
    var r = media.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    var blockH = H * 0.74;
    var top = H * 0.16;
    var calW = Math.min(W * 0.78, blockH * 1.15);
    L = {
      top: top, blockH: blockH,
      calX: (W - calW) / 2, calW: calW,
      colW: calW / DAYS.length,
      rowH: blockH / ROWS,
      dot: Math.min(calW / DAYS.length, blockH / ROWS) * 0.27,
      listX: W * 0.36, listW: W * 0.56,
      barRow: blockH / N,
      label: Math.max(9, Math.round(Math.min(H * 0.036, W * 0.03)))
    };
    if (reduce) draw();
  }

  /* ───────────── drawing ───────────── */

  var clamp = function (x) { return Math.max(0, Math.min(1, x)); };
  var ease = function (x) { x = clamp(x); return x * x * (3 - 2 * x); };
  var back = function (x) {                       // a small overshoot on arrival
    x = clamp(x); var c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
  };

  function pill(x, y, w, h) {
    var r = Math.min(w, h) / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // The deck's eight-spoke asterisk.
  function asterisk(cx, cy, size, rot, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.strokeStyle = TIER.high.color;
    ctx.lineWidth = size * 0.2;
    ctx.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(-size / 2, 0);
      ctx.lineTo(size / 2, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function text(str, x, y, align, alpha, color) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color || INK_3;
    ctx.font = '500 ' + L.label + 'px Inter, -apple-system, sans-serif';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function draw() {
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var clearP = reduce ? 0 : ease((t - T_CLEAR) / (CYCLE - T_CLEAR - 0.25));

    // day labels, while it is still a calendar
    var calAlpha = (reduce ? 0 : ease(t / 0.6)) * (1 - ease((t - T_SORT) / 0.5));
    for (var d = 0; d < DAYS.length; d++) {
      text(DAYS[d], L.calX + L.colW * (d + 0.5), L.top - L.label * 1.4, 'center', calAlpha);
    }

    // list labels, once it is a list
    var listAlpha = (reduce ? 1 : ease((t - T_SORTED + 0.4) / 0.6)) * (1 - clearP);
    var hiY = L.top + L.barRow * (N * 0.1);
    var loY = L.top + L.barRow * (N * 0.88);
    text('HIGH RISK', L.listX - L.label * 1.1, hiY, 'right', listAlpha, TIER.high.color);
    text('LOW', L.listX - L.label * 1.1, loY, 'right', listAlpha);
    text(TOP.toFixed(2), L.listX + L.listW, L.top - L.label * 1.4, 'right', listAlpha);

    for (var i = 0; i < appts.length; i++) {
      var a = appts[i];

      // calendar position
      var cx = L.calX + L.colW * (a.day + 0.5);
      var cy = L.top + L.rowH * (a.row + 0.5);
      // ranked-list position
      var bw = Math.max(L.barRow, (a.score / TOP) * L.listW);
      var bh = L.barRow * 0.62;
      var bx = L.listX;
      var by = L.top + L.barRow * a.rank + (L.barRow - bh) / 2;

      var k = reduce ? 1 : ease((t - T_SORT - a.delaySort) / 1.0);
      var appear = reduce ? 1 : back((t - a.delayIn) / 0.45);
      if (appear <= 0) continue;

      var d0 = L.dot * 2 * Math.min(appear, 1.15);
      var w = d0 + (bw - d0) * k;
      var h = d0 + (bh - d0) * k;
      var x = (cx - d0 / 2) + (bx - (cx - d0 / 2)) * k;
      var y = (cy - d0 / 2) + (by - (cy - d0 / 2)) * k;

      // sweep out to the right as the week clears
      var out = reduce ? 0 : ease((t - T_CLEAR - a.rank * 0.012) / 0.7);

      ctx.save();
      ctx.globalAlpha = Math.min(1, appear) * (1 - out);
      ctx.fillStyle = TIER[a.tier].color;
      pill(x + out * W * 0.06, y, w * (1 - out * 0.6), h);
      ctx.fill();
      ctx.restore();
    }

    // the asterisk marks the top of the list, just ahead of its label
    ctx.font = '500 ' + L.label + 'px Inter, -apple-system, sans-serif';
    var labelW = ctx.measureText('HIGH RISK').width;
    var starIn = reduce ? 1 : back((t - T_SORTED + 0.2) / 0.5);
    var starA = Math.min(1, starIn) * (1 - clearP);
    asterisk(L.listX - L.label * 1.1 - labelW - L.label * 1.0, hiY, L.label * 1.3 * Math.min(starIn, 1.2),
             reduce ? 0 : t * 0.9, starA);
  }

  /* ───────────── loop ───────────── */

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || !onscreen) { last = now; return; }
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    t += dt * (hovered ? 1.6 : 1);
    if (t >= CYCLE) { t -= CYCLE; appts = week(); }
    draw();
  }

  appts = week();
  resize();
  media.classList.add('is-live');
  if (reduce) {
    draw();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  } else {
    raf = requestAnimationFrame(frame);
  }

  if ('ResizeObserver' in window) new ResizeObserver(function () { resize(); draw(); }).observe(media);
  else window.addEventListener('resize', function () { resize(); draw(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { onscreen = es[0].isIntersecting; }, { rootMargin: '80px' }).observe(media);
  }
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; });

  if (btn) {
    btn.addEventListener('pointerenter', function () { hovered = true; });
    btn.addEventListener('pointerleave', function () { hovered = false; });
    btn.addEventListener('focusin', function () { hovered = true; });
    btn.addEventListener('focusout', function () { hovered = false; });
  }
})();
