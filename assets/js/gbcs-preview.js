/* GBCS card: show the archived v1 homepage as a small live preview.
   Loads only when the card is near the viewport, and not for visitors who prefer reduced motion
   (they keep the still image). */
(function () {
  var box = document.querySelector('[data-gbcs-live]');
  if (!box) return;
  var frame = box.querySelector('iframe');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!frame || reduce) { if (frame) frame.remove(); return; }

  function fit() {
    var w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    var s = w / 1440;                       /* always fit the full page width, so the nav is never cropped */
    box.style.setProperty('--s', s.toFixed(4));
    frame.style.height = Math.ceil(h / s) + 'px'; /* give the page a taller viewport instead of cropping it */
  }
  fit();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(box);
  else window.addEventListener('resize', fit);

  function load() {
    if (frame.getAttribute('src')) return;
    frame.addEventListener('load', function () { box.classList.add('is-ready'); });
    frame.setAttribute('src', frame.getAttribute('data-src'));
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { load(); io.disconnect(); }
    }, { rootMargin: '300px' });
    io.observe(box);
  } else { load(); }
})();
