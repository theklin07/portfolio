/* ═══════════════════════════════════════════════════════════════════
   Heart Collection — hearts popping up around the section.

   Three hand-drawn hearts (anatomical with a halo, painted, radiating)
   pop into the empty space around the photography section when the
   Heart Collection opens: the side margins, beside the heading, below
   the photos. Each lands in its own spot, one after another, and then
   stays still. They never overlap the photos, the tabs, the text or
   each other, and they pop away again on Daily Photography.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var section = document.getElementById('photography');
  if (!section) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HEARTS = [
    { src: 'assets/images/hearts/heart-1.webp', scale: 1.15, aspect: 1.26 },   // anatomical, with halo
    { src: 'assets/images/hearts/heart-2.webp', scale: 0.9,  aspect: 1.32 },   // painted
    { src: 'assets/images/hearts/heart-3.webp', scale: 1.0,  aspect: 1.35 }    // radiating
  ];
  var MAX = 12;                   // on a desktop, if they fit; fewer on phones
  // what the hearts must keep clear of
  var AVOID = '.sec-head__title, .sec-head__note, .photo-tabs, .tab-panel.active .tab-desc, .tab-panel.active .photo-grid, .photo-more';

  var layer = document.createElement('div');
  layer.className = 'heart-decor';
  layer.setAttribute('aria-hidden', 'true');
  section.appendChild(layer);

  var W = 0, H = 0;
  var hearts = [];
  var showing = false, raf = 0, last = 0, clock = 0;

  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var clamp = function (x) { return Math.max(0, Math.min(1, x)); };
  var easeBack = function (x) { x = clamp(x); var c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

  function avoidRects() {
    var s = section.getBoundingClientRect();
    return Array.prototype.map.call(section.querySelectorAll(AVOID), function (el) {
      var r = el.getBoundingClientRect();
      return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
    }).filter(function (r) { return r.w > 0 && r.h > 0; });
  }

  function overlaps(a, b, pad) {
    return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
  }

  // pop in with an overshoot, pop out shrinking and lifting away
  function paint(h) {
    var inK = reduce ? 1 : easeBack((clock - h.appearAt) / 0.6);
    var outK = h.leaveAt == null ? 0 : clamp((clock - h.leaveAt) / 0.4);
    var s = (0.2 + 0.8 * inK) * (1 - 0.5 * outK);
    h.body.style.opacity = (clamp(inK * 1.4) * (1 - outK)).toFixed(3);
    h.body.style.transform = 'translateY(' + (-18 * outK).toFixed(1) + 'px) rotate(' +
      (h.tilt - 35 * (1 - clamp(inK)) + 25 * outK).toFixed(1) + 'deg) scaleX(' + h.flip + ') scale(' + s.toFixed(3) + ')';
  }

  function popAway() {
    hearts.forEach(function (h) {
      if (reduce) { h.el.remove(); h.gone = true; return; }
      if (h.leaveAt == null) h.leaveAt = clock;
    });
    hearts = hearts.filter(function (h) { return !h.gone; });
    if (hearts.length) start();
  }

  function popIn() {
    popAway();
    var r = section.getBoundingClientRect();
    W = r.width; H = r.height;
    var rects = avoidRects();
    var small = window.innerWidth < 760;
    var max = small ? 5 : MAX;
    var placed = [], order = 0, last = -1;

    for (var tries = 0; tries < max * 40 && placed.length < max; tries++) {
      var kind;
      do { kind = Math.floor(Math.random() * HEARTS.length); } while (kind === last && HEARTS.length > 1);
      var k = HEARTS[kind];
      var w = (small ? rand(40, 58) : rand(58, 100)) * k.scale, h = w * k.aspect;
      // a little of each heart may tuck past the section's side
      var box = { x: rand(-w * 0.25, W - w * 0.75), y: rand(8, H - h - 8), w: w, h: h };
      // tilted up to ~22°, a heart takes a bit more room than its upright box
      if (rects.some(function (q) { return overlaps(box, q, 14 + w * 0.18); })) continue;
      if (placed.some(function (p) { return overlaps(box, p.box, 10); })) continue;
      last = kind;
      placed.push({ kind: kind, box: box });
    }

    // pop in roughly top to bottom, so they seem to spring up across the section
    placed.sort(function (a, b) { return a.box.y - b.box.y; });
    var fresh = placed.map(function (p) {
      var el = document.createElement('div');
      el.className = 'heart-decor__item';
      el.style.width = p.box.w + 'px';
      el.style.transform = 'translate(' + p.box.x.toFixed(1) + 'px,' + p.box.y.toFixed(1) + 'px)';
      var body = document.createElement('div');
      body.className = 'heart-decor__body';
      var img = document.createElement('img');
      img.src = HEARTS[p.kind].src;
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      body.appendChild(img);
      el.appendChild(body);
      layer.appendChild(el);
      var heart = {
        el: el, body: body, box: p.box,
        tilt: rand(-22, 22), flip: p.kind !== 0 && Math.random() < 0.4 ? -1 : 1,
        appearAt: clock + 0.1 + (order++) * rand(0.09, 0.16), leaveAt: null
      };
      paint(heart);
      return heart;
    });
    hearts = hearts.concat(fresh);
    if (!reduce) start();
  }

  // The loop only runs while hearts are popping in or out; once they have
  // landed it stops, and they stay exactly where they are.
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    clock += dt;
    hearts = hearts.filter(function (h) {
      if (h.leaveAt != null && clock - h.leaveAt > 0.45) { h.el.remove(); return false; }
      return true;
    });
    hearts.forEach(paint);
    var busy = hearts.some(function (h) { return h.leaveAt != null || clock - h.appearAt < 0.65; });
    if (busy) raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

  function onHeartsTab() {
    var active = document.querySelector('.tab-btn.active');
    return !!active && active.dataset.tab === 'hearts';
  }

  // Only the Heart Collection gets hearts. Nothing loads until that tab is opened.
  function sync() {
    var want = onHeartsTab();
    if (want === showing) return;
    showing = want;
    if (want) popIn(); else popAway();
  }

  document.addEventListener('photo-tab-change', sync);
  sync();                       // in case the page opens on the Heart Collection

  // When the layout changes (more photos shown, a new width), any heart that
  // now sits on the content pops away and the set is filled in again.
  var timer = 0;
  function relayout() {
    if (!showing) return;
    var r = section.getBoundingClientRect();
    if (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(popIn, 150);
  }
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(section);
  window.addEventListener('resize', relayout);
  // "Show all" grows the grid under the hearts: rearrange straight away
  section.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.photo-more')) window.setTimeout(relayout, 60);
  });
})();
