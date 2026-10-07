/* ═══════════════════════════════════════════════════════════════════
   Steam animation — scattered sources, one place to decide.

   The deck's "typical user flow": a player bounces between YouTube,
   Reddit and SteamDB before buying. Here the three hang around the
   Steam logo, joined to it by the same dashed lines, and are drawn in
   one at a time; each arrival sends a ripple through the logo.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var media = document.querySelector('[data-steamsources]');
  if (!media) return;
  var canvas = media.querySelector('canvas');
  var ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BASE = 'assets/projects/steam-live/';
  var CHIPS = ['youtube', 'reddit', 'steamdb'];
  var SPOTS = [[0.24, 0.2], [0.8, 0.3], [0.2, 0.74], [0.78, 0.8], [0.5, 0.12], [0.84, 0.56]];
  var CYCLE = 5.0;

  var img = {}, W = 0, H = 0, dpr = 1, L = {};
  var chips = [], t = reduce ? 1.4 : 0, cycle = 0;
  var hovered = false, visible = true, onscreen = true, last = 0, ready = false;

  var clamp = function (x) { return Math.max(0, Math.min(1, x)); };
  var ease = function (x) { x = clamp(x); return x * x * (3 - 2 * x); };
  var easeIn = function (x) { x = clamp(x); return x * x * x; };

  function load(name) {
    return new Promise(function (res, rej) {
      var i = new Image();
      i.onload = function () { img[name] = i; res(); };
      i.onerror = rej;
      i.src = BASE + name + '.png';
    });
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var x = a[i]; a[i] = a[j]; a[j] = x;
    }
    return a;
  }

  function newCycle() {
    var spots = shuffle(SPOTS.slice());
    chips = shuffle(CHIPS.slice()).map(function (name, i) {
      return { name: name, sx: spots[i][0], sy: spots[i][1], phase: Math.random() * 6.3, pull: 2.0 + i * 0.5 };
    });
  }

  function resize() {
    var r = media.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    var m = Math.min(W, H);
    L = { cx: W / 2, cy: H * 0.5, logo: m * 0.3, chip: m * 0.17 };
  }

  function draw() {
    if (!ready || !W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var bobT = cycle * CYCLE + t;
    var positions = chips.map(function (c) {
      var into = easeIn((t - c.pull) / 0.8);
      var appear = reduce ? 1 : ease((t - 0.1) / 0.6);
      var ax = c.sx * W + Math.sin(bobT * 0.9 + c.phase) * W * 0.02;
      var ay = c.sy * H + Math.cos(bobT * 1.1 + c.phase) * H * 0.015;
      return { c: c, into: into, appear: appear,
               x: ax + (L.cx - ax) * into, y: ay + (L.cy - ay) * into };
    });

    // dashed threads from each source to Steam, as on the deck's user-flow slide
    positions.forEach(function (p) {
      var a = p.appear * (1 - p.into);
      if (a <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = a * 0.55;
      ctx.strokeStyle = '#8B9182';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 5]);
      ctx.lineDashOffset = -bobT * 12;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      var mx = (p.x + L.cx) / 2 + (p.y - L.cy) * 0.25, my = (p.y + L.cy) / 2 - (p.x - L.cx) * 0.25;
      ctx.quadraticCurveTo(mx, my, L.cx, L.cy);
      ctx.stroke();
      ctx.restore();
    });

    // ripples and a small pulse as each one lands
    var pulse = 0;
    chips.forEach(function (c) {
      var k = (t - (c.pull + 0.8)) / 0.9;
      if (k > 0 && k < 1) {
        pulse = Math.max(pulse, Math.sin(Math.min(1, k * 2) * Math.PI));
        ctx.save();
        ctx.globalAlpha = (1 - k) * 0.5;
        ctx.strokeStyle = '#1B6FA8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(L.cx, L.cy, L.logo * (0.52 + k * 0.6), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });

    var ls = L.logo * (1 + pulse * 0.06);
    ctx.save();
    ctx.shadowColor = 'rgba(27, 32, 22, 0.2)';
    ctx.shadowBlur = ls * 0.25;
    ctx.shadowOffsetY = ls * 0.06;
    ctx.drawImage(img.steam, L.cx - ls / 2, L.cy - ls / 2, ls, ls);
    ctx.restore();

    positions.forEach(function (p) {
      if (p.into >= 1 || p.appear <= 0) return;
      var im = img[p.c.name];
      var s = L.chip * (1 - p.into * 0.7);
      var w = s * Math.max(1, im.width / im.height), h = w * im.height / im.width;
      ctx.save();
      ctx.globalAlpha = p.appear * (1 - p.into * p.into);
      ctx.shadowColor = 'rgba(27, 32, 22, 0.18)';
      ctx.shadowBlur = s * 0.3;
      ctx.shadowOffsetY = s * 0.08;
      ctx.drawImage(im, p.x - w / 2, p.y - h / 2, w, h);
      ctx.restore();
    });
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || !onscreen) { last = now; return; }
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    t += dt * (hovered ? 1.6 : 1);
    if (t >= CYCLE) { t -= CYCLE; cycle++; newCycle(); }
    draw();
  }

  Promise.all(CHIPS.concat(['steam']).map(load)).then(function () {
    ready = true;
    newCycle();
    resize();
    media.classList.add('is-live');
    draw();
    if (!reduce) requestAnimationFrame(frame);
  }).catch(function () {});

  if ('ResizeObserver' in window) new ResizeObserver(function () { resize(); draw(); }).observe(media);
  else window.addEventListener('resize', function () { resize(); draw(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { onscreen = es[0].isIntersecting; }, { rootMargin: '80px' }).observe(media);
  }
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; });

  var project = media.closest('.project');
  if (project) {
    project.addEventListener('pointerenter', function () { hovered = true; });
    project.addEventListener('pointerleave', function () { hovered = false; });
    project.addEventListener('focusin', function () { hovered = true; });
    project.addEventListener('focusout', function () { hovered = false; });
  }
})();
