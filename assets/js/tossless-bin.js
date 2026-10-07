/* ═══════════════════════════════════════════════════════════════════
   TossLess card — groceries tumbling into a wire bin, straight on the page.

   Groceries from the deck (potato, apple, broccoli, bread, chocolate)
   tumble in from above, pass behind the front rim of the wire bin and
   settle on the floor, where the mesh lets you watch the pile grow.
   When the bin is full it quietly empties and starts again. There is no
   card or slide behind it: the bin stands on the page with its own shadow,
   and the food fades in as it enters so nothing pops out of an edge.

   Layering does the "inside the bin" trick: each frame draws the food
   that is below the rim clipped to the bin's interior, then the bin
   sprite over it, then the food still above the rim on top.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var media = document.querySelector('[data-tossbin]');
  if (!media) return;
  var canvas = media.querySelector('canvas');
  var ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;

  var btn = media.closest('.project');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BASE = 'assets/projects/tossless-bin/';
  var FOODS = ['potato', 'apple', 'broccoli', 'bread', 'chocolate'];

  /* Bin geometry, measured off the deck sprite (fractions of its square). */
  var BIN = {
    rim:    0.075,  // line the food disappears behind
    top:    0.115,  // where the walls begin
    topL:   0.05,  topR:   0.955,
    floor:  0.905,
    floorL: 0.145, floorR: 0.855
  };
  var PILE_MAX = 6;

  var img = {};
  var W = 0, H = 0, dpr = 1;
  var L = {};                 // scene layout in CSS px, rebuilt on resize
  var items = [];
  var queue = [];
  var nextSpawn = 0.25;
  var emptying = 0;           // > 0 while the full pile fades out
  var hovered = false, visible = true, onscreen = true;
  var last = 0, raf = 0, ready = false;

  /* ───────────── loading ───────────── */

  function load(name) {
    return new Promise(function (res, rej) {
      var i = new Image();
      i.onload = function () { img[name] = i; res(); };
      i.onerror = rej;
      i.src = BASE + name + '.png';
    });
  }

  Promise.all(FOODS.concat(['bin']).map(load)).then(function () {
    ready = true;
    resize();
    media.classList.add('is-live');
    if (reduce) { still(); draw(); return; }
    start();
  }).catch(function () { /* keep the static cover */ });

  /* ───────────── layout ───────────── */

  function resize() {
    var r = media.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    // The bin stands alone, centred low, with room above for the food to arc.
    // Works for the tall stage on desktop and the wide one on phones.
    var s = Math.min(H * 0.56, W * 0.74);
    var binX = (W - s) / 2, binY = H * 0.95 - s;
    L = {
      s: s, x: binX, y: binY,
      food: s * 0.3,
      g: s * 2.7,
      rimY: binY + BIN.rim * s
    };
    if (reduce) { still(); draw(); }
  }

  // interior wall at height y, as [left, right]
  function walls(y) {
    var t = (y - (L.y + BIN.top * L.s)) / ((BIN.floor - BIN.top) * L.s);
    t = Math.max(0, Math.min(1, t));
    return [
      L.x + L.s * (BIN.topL + (BIN.floorL - BIN.topL) * t),
      L.x + L.s * (BIN.topR + (BIN.floorR - BIN.topR) * t)
    ];
  }

  /* ───────────── the food ───────────── */

  function pick() {
    if (!queue.length) {
      queue = FOODS.slice();
      for (var i = queue.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = queue[i]; queue[i] = queue[j]; queue[j] = t;
      }
    }
    return queue.pop();
  }

  function spawn() {
    var size = L.food * (0.88 + Math.random() * 0.24);
    var r = size / 2;
    var open = walls(L.rimY);
    var tx = open[0] + r * 1.1 + Math.random() * (open[1] - open[0] - r * 2.2);

    // lobbed in from somewhere above, arcing toward the opening
    var x0 = L.x + L.s * (0.5 + (Math.random() - 0.5) * 1.7);
    x0 = Math.max(r, Math.min(W - r, x0));
    var y0 = -size * (0.6 + Math.random() * 0.5);
    var vy0 = -L.s * (0.15 + Math.random() * 0.35);
    // time to reach the rim under gravity from (y0, vy0)
    var d = L.rimY - y0;
    var t = (vy0 + Math.sqrt(vy0 * vy0 + 2 * L.g * d)) / L.g;

    items.push({
      name: pick(), size: size, r: r,
      x: x0, y: y0, vx: (tx - x0) / t, vy: vy0,
      a: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 7,
      y0: y0, state: 'fall', bounced: false, alpha: 0
    });
  }

  // how high the pile already is at x, for an item of this size
  function restHeight(it, x) {
    var y = L.y + BIN.floor * L.s - it.r * 0.8;
    for (var i = 0; i < items.length; i++) {
      var o = items[i];
      if (o === it || o.state !== 'rest') continue;
      if (Math.abs(o.x - x) < (o.r + it.r) * 0.75) y = Math.min(y, o.y - (o.r + it.r) * 0.62);
    }
    return y;
  }

  function step(dt) {
    nextSpawn -= dt;
    var resting = 0;
    for (var k = 0; k < items.length; k++) if (items[k].state === 'rest') resting++;

    if (nextSpawn <= 0 && !emptying) {
      spawn();
      nextSpawn = hovered ? 0.32 + Math.random() * 0.25 : 0.8 + Math.random() * 0.55;
    }

    if (!emptying && resting >= PILE_MAX) emptying = 0.001;
    if (emptying) {
      emptying += dt;
      var fade = Math.max(0, 1 - (emptying - 0.5) / 0.6);
      for (var e = 0; e < items.length; e++) if (items[e].state === 'rest') items[e].alpha = fade;
      if (emptying > 1.1) {
        items = items.filter(function (it) { return it.state !== 'rest'; });
        emptying = 0;
        nextSpawn = 0.2;
      }
    }

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.state === 'rest') continue;

      // materialise over the first stretch of the fall
      it.alpha = Math.min(1, Math.max(it.alpha, (it.y - it.y0) / (L.s * 0.45)));

      it.vy += L.g * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.a += it.va * dt;

      if (it.y > L.rimY) {
        // inside: the walls taper, keep the food between them
        var w = walls(it.y);
        if (it.x - it.r * 0.7 < w[0]) { it.x = w[0] + it.r * 0.7; it.vx = Math.abs(it.vx) * 0.3; }
        if (it.x + it.r * 0.7 > w[1]) { it.x = w[1] - it.r * 0.7; it.vx = -Math.abs(it.vx) * 0.3; }

        var floor = restHeight(it, it.x);
        if (it.y >= floor) {
          it.y = floor;
          if (!it.bounced && it.vy > L.s * 0.6) {
            it.bounced = true;
            it.vy *= -0.22; it.vx *= 0.4; it.va *= 0.35;
            continue;
          }

          // Landed on the pile rather than the floor: roll toward the lowest
          // spot anywhere across the floor, so the bin fills flat instead of
          // stacking a column up a wall.
          var ww = walls(floor);
          var lo = ww[0] + it.r * 0.7, hi = ww[1] - it.r * 0.7;
          var lowY = floor, lowX = it.x;
          for (var sIdx = 0; sIdx <= 8; sIdx++) {
            var sx = lo + (hi - lo) * sIdx / 8;
            var sy = restHeight(it, sx);
            if (sy > lowY + 0.5 || (Math.abs(sy - lowY) <= 0.5 && Math.abs(sx - it.x) < Math.abs(lowX - it.x))) {
              lowY = sy; lowX = sx;
            }
          }
          it.roll = (it.roll || 0) + dt;
          if (lowY > floor + it.r * 0.3 && Math.abs(lowX - it.x) > it.r * 0.2 && it.roll < 1.4) {
            var dir = lowX > it.x ? 1 : -1;
            it.vy = 0;
            it.vx += dir * L.s * 3.6 * dt;
            it.vx = Math.max(-L.s * 1.4, Math.min(L.s * 1.4, it.vx));
            it.va = it.vx / it.r;
          } else {
            it.state = 'rest';
            it.vx = it.vy = it.va = 0;
          }
        }
      }
    }
  }

  /* A still frame for reduced motion: the slide itself, a little fuller. */
  function still() {
    items = [];
    var floorY = L.y + BIN.floor * L.s;
    var set = [
      ['apple', 0.42, floorY - L.food * 0.4, -0.2, 'rest'],
      ['potato', 0.64, floorY - L.food * 0.38, 0.5, 'rest'],
      ['broccoli', 0.52, L.rimY - L.food * 0.05, -0.35, 'fall'],
      ['bread', 0.36, L.y - L.food * 0.9, 0.1, 'fall'],
      ['chocolate', 0.78, L.y - L.food * 0.35, 0.7, 'fall']
    ];
    set.forEach(function (d) {
      var size = L.food;
      items.push({ name: d[0], size: size, r: size / 2, x: L.x + L.s * d[1], y: d[2],
                   a: d[3], state: d[4], alpha: 1 });
    });
  }

  /* ───────────── drawing ───────────── */

  function sprite(it) {
    ctx.save();
    ctx.globalAlpha = it.alpha;
    ctx.translate(it.x, it.y);
    ctx.rotate(it.a);
    ctx.drawImage(img[it.name], -it.size / 2, -it.size / 2, it.size, it.size);
    ctx.restore();
  }

  function interiorPath() {
    var fy = L.y + (BIN.floor + 0.06) * L.s;
    ctx.beginPath();
    ctx.moveTo(L.x + BIN.topL * L.s, L.rimY);
    ctx.lineTo(L.x + BIN.topR * L.s, L.rimY);
    ctx.lineTo(L.x + BIN.floorR * L.s, fy);
    ctx.lineTo(L.x + BIN.floorL * L.s, fy);
    ctx.closePath();
  }

  function draw() {
    if (!ready || !W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 0. contact shadow, so the bin sits on the page rather than floating
    var sx = L.x + L.s / 2, sy = L.y + L.s * 0.985;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.14);
    var sh = ctx.createRadialGradient(0, 0, 0, 0, 0, L.s * 0.46);
    sh.addColorStop(0, 'rgba(58, 48, 36, 0.22)');
    sh.addColorStop(1, 'rgba(58, 48, 36, 0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(0, 0, L.s * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 1. food below the rim, seen through the mesh, a touch in shadow
    ctx.save();
    interiorPath();
    ctx.clip();
    for (var i = 0; i < items.length; i++) sprite(items[i]);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(58, 46, 34, 0.14)';
    ctx.fillRect(L.x, L.rimY, L.s, L.s);
    ctx.restore();

    // 2. the bin, standing on the page
    ctx.drawImage(img.bin, L.x, L.y, L.s, L.s);

    // 3. food still above the rim, in front of everything
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, L.rimY);
    ctx.clip();
    for (var j = 0; j < items.length; j++) sprite(items[j]);
    ctx.restore();
  }

  /* ───────────── loop ───────────── */

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || !onscreen) { last = now; return; }
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    step(dt);
    draw();
  }

  function start() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  if ('ResizeObserver' in window) new ResizeObserver(function () { if (ready) resize(); }).observe(media);
  else window.addEventListener('resize', function () { if (ready) resize(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { onscreen = es[0].isIntersecting; }, { rootMargin: '80px' }).observe(media);
  }
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; });

  if (btn) {
    btn.addEventListener('pointerenter', function () { hovered = true; nextSpawn = Math.min(nextSpawn, 0.1); });
    btn.addEventListener('pointerleave', function () { hovered = false; });
    btn.addEventListener('focusin', function () { hovered = true; });
    btn.addEventListener('focusout', function () { hovered = false; });
  }
})();
