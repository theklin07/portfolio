/* ═══════════════════════════════════════════════════════════════════
   Site behaviour: reveals, nav state, case-study reader, photo tabs,
   galleries and lightbox.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ───────────── scroll reveals ───────────── */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var sibs = $$('.reveal', e.target.parentNode);
        var i = Math.max(0, sibs.indexOf(e.target));
        e.target.style.transitionDelay = Math.min(i * 70, 280) + 'ms';
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ───────────── nav ───────────── */
  var nav = $('#nav'), hero = $('.hero');
  function navState() {
    var past = window.scrollY > (hero ? hero.offsetHeight - 80 : 300);
    nav.classList.toggle('is-solid', past);
  }
  navState();
  window.addEventListener('scroll', navState, { passive: true });

  /* ═════════════ case-study reader ═════════════ */
  var reader = $('#reader');
  var readerScroll = $('#readerScroll');
  var lastFocus = null;

  function buildCaseStudy(key) {
    var p = window.PROJECTS[key];
    if (!p) return '';
    var meta = p.meta.map(function (row) {
      return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>';
    }).join('');

    var cta = '<div class="cs__cta">';
    if (p.pdf) {
      cta += '<a href="' + p.pdf + '" target="_blank" rel="noopener noreferrer">' +
             (p.pdfLabel || 'Open the full deck') + ' <span aria-hidden="true">↗</span></a>';
    }
    cta += '<a class="is-ghost" href="mailto:k.lin@klindns.com?subject=' +
           encodeURIComponent(p.title) + '">Ask me about this project</a></div>';

    return '<article class="cs">' +
      '<header class="cs__hero">' +
        '<p class="cs__kicker">' + p.kicker + '</p>' +
        '<h2 class="cs__title" id="readerTitle">' + p.title + '</h2>' +
        '<p class="cs__deck">' + p.deck + '</p>' +
        '<dl class="cs__meta">' + meta + '</dl>' +
      '</header>' +
      '<div class="cs__body">' + p.html + cta + '</div>' +
    '</article>';
  }

  function openReader(key, trigger) {
    lastFocus = trigger || document.activeElement;
    readerScroll.innerHTML = buildCaseStudy(key);
    readerScroll.scrollTop = 0;
    reader.hidden = false;
    document.body.classList.add('is-locked');
    requestAnimationFrame(function () {
      reader.classList.add('is-open');
      $('.reader__close', reader).focus({ preventScroll: true });
    });
    if (history.replaceState) history.replaceState(null, '', '#' + key);
  }

  function closeReader() {
    if (reader.hidden) return;
    reader.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    window.setTimeout(function () {
      reader.hidden = true;
      readerScroll.innerHTML = '';
    }, 480);
    if (history.replaceState) history.replaceState(null, '', '#projects');
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  $$('.project__link').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openReader(btn.closest('.project').dataset.project, btn);
    });
  });
  $$('[data-close]', reader).forEach(function (el) {
    el.addEventListener('click', closeReader);
  });

  // keep tabbing inside the panel while it's open
  reader.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var f = $$('a[href], button:not([disabled])', reader)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ═════════════ photography (Cloudinary) ═════════════ */
  var CLOUD_NAME = "qzo7rz9q";
  var FIRST_SHOWN = { daily: 12, hearts: 16 };

  function thumbUrl(file) {
    return 'https://res.cloudinary.com/' + CLOUD_NAME + '/image/upload/f_auto,q_auto,w_500,c_fill/' + file + '.jpg';
  }
  function fullUrl(file) {
    return 'https://res.cloudinary.com/' + CLOUD_NAME + '/image/upload/f_auto,q_auto/' + file + '.jpg';
  }
  // A few HEIC uploads can't be converted with f_auto; retry without it.
  function simpleUrl(file, width) {
    return 'https://res.cloudinary.com/' + CLOUD_NAME + '/image/upload/' + (width ? 'w_' + width + '/' : '') + file + '.jpg';
  }

  // Cloudinary sometimes fails the first time it converts a HEIC upload
  // ("Cannot read grid descriptor") and succeeds on a later request. Walk
  // through fallbacks on error, pausing before a repeat of the same URL.
  function retryImage(img, fallbacks) {
    var queue = fallbacks.slice();
    img.onerror = function () {
      if (!queue.length) { img.onerror = null; return; }
      var next = queue.shift();
      window.setTimeout(function () { img.src = next; }, next.indexOf('?r=') > -1 ? 1500 : 0);
    };
  }

  // Last resort: the metadata-free copies kept in the site folder
  // (IMG_2196 -> Photography/Hearts/thumbs/img-2196.jpg).
  var LOCAL_DIRS = { daily: 'Photography/Photography/', hearts: 'Photography/Hearts/' };
  function localUrl(set, file, thumb) {
    var name = file.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.jpg';
    return LOCAL_DIRS[set] + (thumb ? 'thumbs/' : '') + name;
  }

  var PHOTOS = window.PHOTOS || {};
  var grids = { daily: 'dailyGrid', hearts: 'heartsGrid' };

  function renderGrid(key) {
    var grid = document.getElementById(grids[key]);
    var photos = PHOTOS[key] || [];
    if (!grid) return;
    grid.innerHTML = '';
    var first = FIRST_SHOWN[key] || photos.length;

    photos.forEach(function (p, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'photo-btn';
      btn.dataset.set = key;
      btn.dataset.index = i;
      if (i >= first) btn.hidden = true;

      var img = document.createElement('img');
      img.src = thumbUrl(p.file);
      img.alt = p.alt || '';                     // set as a property, so quotes in text are safe
      img.loading = 'lazy';
      img.decoding = 'async';
      img.draggable = false;
      retryImage(img, [simpleUrl(p.file, 500), thumbUrl(p.file) + '?r=1', localUrl(key, p.file, true)]);
      btn.appendChild(img);
      grid.appendChild(btn);
    });

    if (photos.length > first) {
      var more = document.createElement('button');
      more.type = 'button';
      more.className = 'photo-more';
      more.textContent = 'Show all ' + photos.length + ' photos';
      more.addEventListener('click', function () {
        var all = grid.querySelectorAll('.photo-btn');
        for (var k = first; k < all.length; k++) all[k].hidden = false;
        more.remove();
        if (all[first]) all[first].focus({ preventScroll: true });
      });
      grid.parentNode.insertBefore(more, grid.nextSibling);
    }
  }
  renderGrid('daily');
  renderGrid('hearts');

  // tab switching
  var tabBtns = $$('.tab-btn');
  function selectTab(btn, focus) {
    tabBtns.forEach(function (b) {
      var on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    $$('.tab-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.dataset.panel === btn.dataset.tab);
    });
    if (focus) btn.focus();
    document.dispatchEvent(new CustomEvent('photo-tab-change', { detail: { tab: btn.dataset.tab } }));
  }
  tabBtns.forEach(function (btn, i) {
    btn.addEventListener('click', function () { selectTab(btn); });
    btn.addEventListener('keydown', function (e) {
      var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      selectTab(tabBtns[(i + step + tabBtns.length) % tabBtns.length], true);
    });
  });

  // lightbox
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var lbSet = null, lbIndex = 0, lbReturn = null;

  function showPhoto(i) {
    var photos = PHOTOS[lbSet] || [];
    if (!photos.length) return;
    lbIndex = (i + photos.length) % photos.length;
    var p = photos[lbIndex];
    lightboxImg.onerror = null;
    retryImage(lightboxImg, [simpleUrl(p.file), fullUrl(p.file) + '?r=1', localUrl(lbSet, p.file)]);
    lightboxImg.src = fullUrl(p.file);
    lightboxImg.alt = p.alt || '';
  }
  function openLightbox(set, index, trigger) {
    lbSet = set; lbReturn = trigger;
    showPhoto(index);
    lightbox.classList.add('open');
    document.body.classList.add('is-locked');
    lightbox.querySelector('.lightbox-close').focus({ preventScroll: true });
  }
  function closeLightbox() {
    if (!lightbox.classList.contains('open')) return;
    lightbox.classList.remove('open');
    document.body.classList.remove('is-locked');
    lightboxImg.removeAttribute('src');
    if (lbReturn) lbReturn.focus({ preventScroll: true });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.photo-grid .photo-btn');
    if (btn) openLightbox(btn.dataset.set, Number(btn.dataset.index), btn);
  });
  lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  lightbox.querySelector('.lightbox-prev').addEventListener('click', function () { showPhoto(lbIndex - 1); });
  lightbox.querySelector('.lightbox-next').addEventListener('click', function () { showPhoto(lbIndex + 1); });
  lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });

  // keep keyboard focus inside the lightbox while it is open
  lightbox.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var f = $$('button', lightbox);
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeLightbox(); closeReader(); return; }
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') showPhoto(lbIndex - 1);
    if (e.key === 'ArrowRight') showPhoto(lbIndex + 1);
  });

  // discourage right-click saving and dragging of photos
  document.addEventListener('contextmenu', function (e) { if (e.target.tagName === 'IMG') e.preventDefault(); });
  document.addEventListener('dragstart', function (e) { if (e.target.tagName === 'IMG') e.preventDefault(); });

  /* deep link straight to a case study */
  // ...only for a project that is actually open on the page
  var hash = location.hash.replace('#', '');
  if (hash && window.PROJECTS[hash] && document.querySelector('.project[data-project="' + hash + '"] .project__link')) {
    window.setTimeout(function () { openReader(hash, null); }, 450);
  }
})();
