/* ═══════════════════════════════════════════════════════════════════
   Apple Health animation — a cycle, going round.

   A 28-day ring: the period in pink, the fertile window in purple. A
   marker travels the month and the centre names the day and phase, so
   the idea behind the redesign -- a cycle is a range you move through,
   not a single predicted date -- is visible before any screen is.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var media = document.querySelector('[data-cyclering]');
  if (!media) return;
  var canvas = media.querySelector('canvas');
  var ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DAYS = 28, LOOP = 9;                         // seconds for one month
  var PHASES = [
    { from: 1,  to: 5,  label: 'PERIOD',         color: '#D9557A' },
    { from: 6,  to: 10, label: 'FOLLICULAR',     color: '#8B9182' },
    { from: 11, to: 16, label: 'FERTILE WINDOW', color: '#7462AE' },
    { from: 17, to: 28, label: 'LUTEAL',         color: '#8B9182' }
  ];

  var W = 0, H = 0, dpr = 1, t = reduce ? LOOP * (13.5 / DAYS) : 0;
  var hovered = false, visible = true, onscreen = true, last = 0;

  function resize() {
    var r = media.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  // day (1..28, fractional) -> angle, day 1 at twelve o'clock
  function ang(day) { return -Math.PI / 2 + ((day - 1) / DAYS) * Math.PI * 2; }

  function arc(cx, cy, r, d0, d1, stroke, width) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, ang(d0), ang(d1 + 0.999));
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function draw() {
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var m = Math.min(W, H);
    var cx = W / 2, cy = H / 2, r = m * 0.34, sw = m * 0.07;
    var day = 1 + (t % LOOP) / LOOP * DAYS;
    var dayInt = Math.floor(day);
    var phase = PHASES.filter(function (p) { return dayInt >= p.from && dayInt <= p.to; })[0];

    // track, then the two windows
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#E3DBCC';
    ctx.lineWidth = sw;
    ctx.stroke();

    var pink = ctx.createLinearGradient(cx, cy - r, cx + r, cy);
    pink.addColorStop(0, '#FF8DA1'); pink.addColorStop(1, '#E24C6B');
    var purple = ctx.createLinearGradient(cx, cy + r, cx - r, cy);
    purple.addColorStop(0, '#8E7CC3'); purple.addColorStop(1, '#5B4B8A');
    var inPeriod = dayInt <= 5, inFertile = dayInt >= 11 && dayInt <= 16;
    ctx.save();
    ctx.globalAlpha = inPeriod ? 1 : 0.55;
    arc(cx, cy, r, 1, 5, pink, sw);
    ctx.globalAlpha = inFertile ? 1 : 0.55;
    arc(cx, cy, r, 11, 16, purple, sw);
    ctx.restore();

    // day ticks
    for (var d = 1; d <= DAYS; d++) {
      var a = ang(d);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * (r - sw * 1.05), cy + Math.sin(a) * (r - sw * 1.05), m * 0.004, 0, Math.PI * 2);
      ctx.fillStyle = d <= dayInt ? 'rgba(27, 32, 22, 0.32)' : 'rgba(27, 32, 22, 0.12)';
      ctx.fill();
    }

    // the marker for today
    var am = ang(day);
    var mx = cx + Math.cos(am) * r, my = cy + Math.sin(am) * r;
    ctx.save();
    ctx.shadowColor = 'rgba(27, 32, 22, 0.25)';
    ctx.shadowBlur = sw * 0.5;
    ctx.beginPath();
    ctx.arc(mx, my, sw * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(mx, my, sw * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = phase.color;
    ctx.fill();

    // centre text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1B2016';
    ctx.font = '400 ' + Math.round(m * 0.13) + 'px Fraunces, Georgia, serif';
    ctx.fillText(String(dayInt), cx, cy - m * 0.02);
    ctx.fillStyle = '#8B9182';
    ctx.font = '500 ' + Math.max(9, Math.round(m * 0.034)) + 'px Inter, -apple-system, sans-serif';
    ctx.fillText('DAY', cx, cy - m * 0.11);
    ctx.fillStyle = phase.color;
    ctx.fillText(phase.label, cx, cy + m * 0.08);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || !onscreen) { last = now; return; }
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    t += dt * (hovered ? 1.8 : 1);
    draw();
  }

  resize();
  media.classList.add('is-live');
  draw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  if (!reduce) requestAnimationFrame(frame);

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
