/* ═══════════════════════════════════════════════════════════════════
   About — oil-painted flowers growing in from the edges.

   After the bouquet reference (flowers.jpg): daisies, orange ranunculus,
   pink pom-pom carnations, yellow tulips and baby's breath.

   Painted like oils: every petal, leaf and stem is built from real brush
   strokes, each made of many bristle lines that streak two colours
   together, with a lighter ridge along one side (impasto), dry-brush
   breaks where the paint runs out, a soft shadow under the thick paint
   and a faint canvas weave.

   Flowers root just outside the section's left, right and bottom edges
   and grow inward: the stem reaches in, leaves unfurl as it passes them,
   then the head opens. One or two at a time, they linger, fade, and
   others grow elsewhere. Stems, leaves and heads never cover the text.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var section = document.getElementById('about');
  if (!section) return;
  var canvas = document.createElement('canvas');
  canvas.className = 'flower-bloom';
  canvas.setAttribute('aria-hidden', 'true');
  section.insertBefore(canvas, section.firstChild);
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // sampled from flowers.jpg, pushed a little richer for oils
  var P = {
    white: [252, 248, 236], whiteShade: [196, 196, 204], cream: [240, 230, 200],
    gold: [240, 168, 24], goldDeep: [196, 112, 18], brown: [120, 64, 20],
    orange: [222, 110, 24], orangeLight: [246, 158, 66], coral: [212, 78, 52], rust: [150, 54, 22],
    rose: [218, 96, 112], roseLight: [242, 164, 170], roseDeep: [168, 52, 76],
    butter: [248, 210, 118], butterLight: [252, 234, 170], blush: [230, 120, 70],
    leaf: [88, 118, 48], leafLight: [150, 170, 82], leafDeep: [52, 74, 32],
    stem: [104, 128, 58], stemDeep: [66, 88, 38]
  };
  var TYPES = ['daisy', 'daisy', 'ranunculus', 'pompom', 'tulip', 'breath'];

  var W = 0, H = 0, dpr = 1;
  var flowers = [];
  var nextSpawn = 0.3, clock = 0, running = true, visible = true, last = 0;

  /* ───────────── helpers ───────────── */

  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var clamp = function (x) { return Math.max(0, Math.min(1, x)); };
  var easeOut = function (x) { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
  var easeInOut = function (x) { x = clamp(x); return x * x * (3 - 2 * x); };
  var easeBack = function (x) { x = clamp(x); var c = 1.3; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function shade(c, k) { return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)]; }

  function quad(p0, p1, p2, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      pts.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
    }
    return pts;
  }

  /* ───────────── oil paint ───────────── */

  // One brush stroke along a path. Many bristles streak colours A and B
  // together; the stroke swells in the middle and tapers at both ends;
  // some bristles run dry early; one edge catches the light.
  function brush(c, pts, w, A, B, o) {
    o = o || {};
    var n = pts.length, normals = [];
    for (var i = 0; i < n; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      var tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
      normals.push([-ty / l, tx / l]);
    }
    var taper = o.taper || function (t) { return Math.pow(Math.sin(Math.PI * (0.06 + t * 0.9)), 0.5); };

    // the body of paint: one opaque, slightly uneven shape
    var left = [], right = [];
    for (var q = 0; q < n; q++) {
      var tq = q / (n - 1), wq = w * taper(tq) * 0.5 * rand(0.94, 1.04);
      left.push([pts[q][0] - normals[q][0] * wq, pts[q][1] - normals[q][1] * wq]);
      right.push([pts[q][0] + normals[q][0] * wq, pts[q][1] + normals[q][1] * wq]);
    }
    c.fillStyle = rgba(mix(A, B, 0.25), o.alpha || 0.96);
    c.beginPath();
    c.moveTo(left[0][0], left[0][1]);
    for (q = 1; q < n; q++) c.lineTo(left[q][0], left[q][1]);
    for (q = n - 1; q >= 0; q--) c.lineTo(right[q][0], right[q][1]);
    c.closePath();
    c.fill();

    // bristle streaks dragged through it
    var nb = Math.max(5, Math.round(w * 0.9));
    var bw = Math.max(0.8, (w / nb) * 1.5);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (var k = 0; k < nb; k++) {
      var u = k / (nb - 1) - 0.5 + (Math.random() - 0.5) * 0.1;
      var col = mix(A, B, Math.random() < (o.mix == null ? 0.4 : o.mix) ? Math.random() : 0);
      col = shade(col, (1 - u * (o.shadeK == null ? 0.26 : o.shadeK)) * rand(0.9, 1.1));   // light side / shadow side
      var start = Math.random() < 0.15 ? Math.floor(Math.random() * n * 0.12) : 0;
      var end = n - (Math.random() < 0.45 ? Math.floor(Math.random() * n * 0.3) : 0);
      c.strokeStyle = rgba(col, rand(0.35, 0.7));
      c.lineWidth = bw * rand(0.6, 1.4);
      c.beginPath();
      for (var j = start; j < end; j++) {
        var t = j / (n - 1), wt = w * taper(t);
        var x = pts[j][0] + normals[j][0] * u * wt, y = pts[j][1] + normals[j][1] * u * wt;
        if (j === start) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    // the ridge of thick paint catching the light
    if (o.sheen !== 0) {
      c.strokeStyle = rgba([255, 250, 236], 0.4 * (o.sheen || 1));
      c.lineWidth = Math.max(0.6, w * 0.07);
      c.beginPath();
      var s0 = Math.floor(n * 0.15), s1 = Math.floor(n * rand(0.55, 0.85));
      for (var m = s0; m < s1; m++) {
        var tt = m / (n - 1), ww = w * taper(tt);
        var px = pts[m][0] - normals[m][0] * ww * 0.28, py = pts[m][1] - normals[m][1] * ww * 0.28;
        if (m === s0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
    }
  }

  // a short, loaded dab of paint
  function dab(c, x, y, len, w, ang, A, B) {
    var dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
    brush(c, quad([x - dx, y - dy], [x + rand(-1, 1), y + rand(-1, 1)], [x + dx, y + dy], 5), w, A, B, { sheen: 0.8 });
  }

  // a fine, irregular canvas grain, laid over painted pixels only
  var weave = (function () {
    var g = document.createElement('canvas');
    g.width = g.height = 64;
    var gc = g.getContext('2d'), img = gc.createImageData(64, 64);
    for (var i = 0; i < img.data.length; i += 4) {
      var light = Math.random() < 0.5;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = light ? 255 : 30;
      img.data[i + 3] = Math.random() * (light ? 14 : 20);
    }
    gc.putImageData(img, 0, 0);
    return g;
  })();

  // Paint once into an offscreen canvas (with a soft shadow under the paint);
  // frames only move the result around.
  function part(w, h, ox, oy, draw) {
    var W2 = Math.max(1, Math.ceil(w * dpr)), H2 = Math.max(1, Math.ceil(h * dpr));
    var tmp = document.createElement('canvas');
    tmp.width = W2; tmp.height = H2;
    var t = tmp.getContext('2d');
    t.scale(dpr, dpr);
    t.translate(ox, oy);
    draw(t);

    var cv = document.createElement('canvas');
    cv.width = W2; cv.height = H2;
    var c = cv.getContext('2d');
    c.shadowColor = 'rgba(50, 34, 18, 0.28)';
    c.shadowBlur = 3 * dpr;
    c.shadowOffsetX = 0.8 * dpr;
    c.shadowOffsetY = 1.4 * dpr;
    c.drawImage(tmp, 0, 0);
    c.shadowColor = 'transparent';
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = c.createPattern(weave, 'repeat');
    c.fillRect(0, 0, W2, H2);
    return { cv: cv, w: w, h: h, ox: ox, oy: oy };
  }
  function put(p) { ctx.drawImage(p.cv, -p.ox, -p.oy, p.w, p.h); }

  // a petal painted in a few strokes from base to tip (pointing up)
  function petalPart(len, pw, A, B, o) {
    o = o || {};
    var pad = pw + 10;
    return part(pw * 2 + pad * 2, len + pad * 2, pw + pad, len + pad, function (c) {
      var n = o.strokes || 3, bend = rand(-0.25, 0.25) * pw;
      for (var s = 0; s < n; s++) {
        var off = n === 1 ? 0 : (s / (n - 1) - 0.5) * pw * 0.75;
        brush(c, quad([off * 0.3, 0], [off + bend, -len * 0.5], [off * 0.5 + bend * 0.4, -len * rand(0.9, 1)], 12),
              pw * (o.width || 0.62), A, B, { mix: o.mix });
      }
      if (o.ridge) {
        brush(c, quad([0, -len * 0.1], [bend * 0.6, -len * 0.5], [bend * 0.3, -len * 0.85], 10),
              pw * 0.3, o.ridge, A, { mix: 0.3, sheen: 1.2 });
      }
    });
  }

  /* ───────────── a flower, in its own frame: base at 0,0, growing up ───────────── */

  function stemAt(f, t) {
    var u = 1 - t;
    var x = 2 * u * t * f.cx + t * t * f.hx, y = 2 * u * t * f.cy + t * t * f.hy;
    var dx = 2 * u * f.cx + 2 * t * (f.hx - f.cx), dy = 2 * u * f.cy + 2 * t * (f.hy - f.cy);
    return { x: x, y: y, a: Math.atan2(dy, dx) };
  }

  function build(f) {
    var R = f.R, L = f.L, v, k2;

    // stem
    var topY = /daisy|ranunculus|pompom/.test(f.type) ? f.hy + R * 0.28 : f.hy;
    var branches = [];
    if (f.type === 'breath') {
      for (var b = 0; b < 6; b++) {
        var s = stemAt(f, rand(0.55, 0.95)), a = -Math.PI / 2 + (b - 2.5) * 0.36 + rand(-0.15, 0.15);
        var len = R * rand(0.8, 1.35);
        branches.push({ x0: s.x, y0: s.y, x1: s.x + Math.cos(a) * len, y1: s.y + Math.sin(a) * len * 0.9 - R * 0.2 });
      }
    }
    var minX = Math.min(0, f.cx, f.hx) - R * 1.4, maxX = Math.max(0, f.cx, f.hx) + R * 1.4;
    f.stem = part(maxX - minX, L + R * 2.4 + 10, -minX, L + R * 1.2, function (c) {
      brush(c, quad([0, R * 0.8], [f.cx, f.cy], [f.hx, topY], 24), Math.max(3, R * 0.13), P.stem, P.stemDeep,
            { mix: 0.5, taper: function (t) { return 1 - t * 0.35; } });
      branches.forEach(function (br) {
        brush(c, quad([br.x0, br.y0], [(br.x0 + br.x1) / 2 + rand(-3, 3), (br.y0 + br.y1) / 2 - R * 0.15], [br.x1, br.y1], 10),
              Math.max(1.6, R * 0.05), P.stem, P.leafLight, { mix: 0.4, sheen: 0 });
      });
    });

    // leaves, painted along their length
    f.leaves = [];
    var nLeaves = f.type === 'breath' ? 1 : 2;
    for (var i = 0; i < nLeaves; i++) {
      var ll = R * rand(1.0, 1.5), lw = ll * rand(0.24, 0.32);
      var leaf = part(lw * 2 + 24, ll + 24, lw + 12, ll + 12, (function (ll, lw) {
        return function (c) {
          var bend = rand(-0.3, 0.3) * lw;
          // two broad overlapping strokes for the blade, a lighter one down the middle
          [-0.26, 0.26].forEach(function (off) {
            brush(c, quad([off * lw * 0.2, 0], [off * lw * 1.3 + bend, -ll * 0.45], [bend * 0.3, -ll], 14), lw * 1.15,
                  P.leaf, P.leafDeep, { mix: 0.4, shadeK: 0.1, sheen: 0.5 });
          });
          brush(c, quad([0, -ll * 0.05], [bend * 0.8, -ll * 0.45], [bend * 0.3, -ll * 0.9], 12), lw * 0.7,
                P.leafLight, P.leaf, { mix: 0.5, shadeK: 0.1, alpha: 0.85 });
          brush(c, quad([0, -2], [bend * 0.7, -ll * 0.5], [bend * 0.3, -ll * 0.82], 10), Math.max(1, lw * 0.07),
                P.leafDeep, P.stemDeep, { mix: 0.3, sheen: 0, alpha: 0.6 });
        };
      })(ll, lw));
      f.leaves.push({ t: f.leafSpots[i], side: i % 2 ? 1 : -1, tilt: rand(0.75, 1.15), part: leaf });
    }

    // the head
    f.petals = [];
    if (f.type === 'daisy') {
      v = [0, 1, 2].map(function () {
        return petalPart(R * rand(0.9, 1.05), R * 0.19, P.white, P.whiteShade, { strokes: 2, width: 0.7, mix: 0.3 });
      });
      var n = Math.round(rand(14, 18));
      for (k2 = 0; k2 < n; k2++) f.petals.push({ p: v[k2 % 3], a: k2 / n * 6.283 + rand(-0.08, 0.08), ring: 0, i: k2 / n });
      f.center = part(R * 0.9, R * 0.9, R * 0.45, R * 0.45, function (c) {
        var rc = R * 0.27;
        for (var d = 0; d < 34; d++) {
          var aa = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * rc * 0.85;
          dab(c, Math.cos(aa) * rr, Math.sin(aa) * rr, rc * 0.4, rc * 0.28, Math.random() * 6.28,
              d < 26 ? P.gold : P.goldDeep, d < 26 ? P.orangeLight : P.brown);
        }
        dab(c, -rc * 0.3, -rc * 0.35, rc * 0.35, rc * 0.22, -0.6, P.butterLight, P.gold);
      });
    } else if (f.type === 'ranunculus') {
      [[9, 0.95, P.orange, P.coral], [7, 0.72, P.orangeLight, P.orange], [5, 0.46, P.coral, P.rust]].forEach(function (ring, ri) {
        var vv = [0, 1].map(function () { return petalPart(R * ring[1], R * ring[1] * 0.55, ring[2], ring[3], { strokes: 3, width: 0.6 }); });
        for (var q = 0; q < ring[0]; q++) f.petals.push({ p: vv[q % 2], a: q / ring[0] * 6.283 + ri * 0.45, ring: ri, i: q / ring[0] });
      });
      f.center = part(R * 0.5, R * 0.5, R * 0.25, R * 0.25, function (c) {
        for (var d = 0; d < 8; d++) dab(c, rand(-3, 3), rand(-3, 3), R * 0.12, R * 0.08, Math.random() * 6.28, P.rust, P.brown);
      });
    } else if (f.type === 'pompom') {
      [[16, 0.95, P.rose, P.roseDeep], [12, 0.68, P.roseLight, P.rose], [8, 0.42, P.rose, P.roseDeep]].forEach(function (ring, ri) {
        var vv = [0, 1, 2].map(function () { return petalPart(R * ring[1], R * ring[1] * 0.28, ring[2], ring[3], { strokes: 1, width: 1 }); });
        for (var q = 0; q < ring[0]; q++) f.petals.push({ p: vv[q % 3], a: q / ring[0] * 6.283 + ri * 0.3 + rand(-0.1, 0.1), ring: ri, i: q / ring[0] });
      });
      f.center = part(R * 0.5, R * 0.5, R * 0.25, R * 0.25, function (c) {
        for (var d = 0; d < 8; d++) dab(c, rand(-3, 3), rand(-3, 3), R * 0.12, R * 0.09, Math.random() * 6.28, P.roseDeep, P.rose);
      });
    } else if (f.type === 'tulip') {
      f.cup = [-1, 1, 0].map(function (s) {
        return { s: s, p: petalPart(R * (s ? 1.05 : 1.15), R * 0.5, P.butter, P.blush, { strokes: 4, width: 0.5, mix: 0.3, ridge: P.butterLight }) };
      });
    } else if (f.type === 'breath') {
      f.buds = [];
      branches.forEach(function (br) {
        for (var d = 0; d < 6; d++) {
          f.buds.push({ x: br.x1 + rand(-1, 1) * R * 0.2, y: br.y1 + rand(-1, 1) * R * 0.2, r: rand(0.8, 1.2), at: rand(0, 0.5) });
        }
      });
      f.bud = part(R * 0.4, R * 0.4, R * 0.2, R * 0.2, function (c) {
        dab(c, 0, 0, R * 0.12, R * 0.12, Math.random() * 6.28, P.white, P.cream);
      });
    }
    f.branches = branches;
  }

  /* ───────────── growing in from the edges ───────────── */

  function textRects() {
    var s = section.getBoundingClientRect();
    var sel = '.sec-head__title, .about__lead, .about__text > p, .about__cols, .portrait';
    return Array.prototype.map.call(section.querySelectorAll(sel), function (el) {
      var r = el.getBoundingClientRect();
      return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
    }).filter(function (r) { return r.w > 0 && r.h > 0; });
  }

  // flower-local → section coordinates
  function toWorld(f, lx, ly) {
    var c = Math.cos(f.theta), s = Math.sin(f.theta);
    return [f.x + lx * c - ly * s, f.y + lx * s + ly * c];
  }

  // circles covering the parts that must stay clear of the text
  function footprint(f) {
    var pts = [];
    var h = toWorld(f, f.hx, f.hy);
    pts.push({ x: h[0], y: h[1], r: f.R * 1.15, head: true });
    for (var t = 0.3; t < 1; t += 0.12) {
      var s = stemAt(f, t), w = toWorld(f, s.x, s.y);
      pts.push({ x: w[0], y: w[1], r: f.R * 0.3 });
    }
    f.leafSpots.forEach(function (t) {
      var s = stemAt(f, t), w = toWorld(f, s.x, s.y);
      pts.push({ x: w[0], y: w[1], r: f.R * 0.95 });
    });
    return pts;
  }

  function hitsRect(p, r, pad) {
    var cx = Math.max(r.x - pad, Math.min(p.x, r.x + r.w + pad));
    var cy = Math.max(r.y - pad, Math.min(p.y, r.y + r.h + pad));
    return Math.hypot(p.x - cx, p.y - cy) < p.r;
  }

  function pickEdge(small) {
    var r = Math.random();
    if (small) return r < 0.6 ? 'bottom' : (r < 0.8 ? 'left' : 'right');
    return r < 0.3 ? 'left' : (r < 0.6 ? 'right' : 'bottom');
  }

  function spawn(near) {
    var small = W < 700;
    var type = TYPES[Math.floor(Math.random() * TYPES.length)];
    var R = (small ? rand(20, 28) : rand(30, 46)) * (type === 'breath' ? 1.12 : 1);
    var rects = textRects();

    for (var tries = 0; tries < 60; tries++) {
      var edge = near ? near.edge : pickEdge(small);
      var f = { type: type, R: R, edge: edge };
      f.L = R * (type === 'tulip' || type === 'breath' ? rand(2.8, 3.8) : rand(2.2, 3.4));
      f.bend = R * rand(-0.8, 0.8);
      f.cx = f.bend; f.cy = -f.L * 0.55;
      f.hx = f.bend * 0.45; f.hy = -f.L;

      if (edge === 'left') {
        f.x = -R * 0.3;
        f.y = near ? near.y + rand(-1, 1) * R * 3 : rand(H * 0.12, H + R);
        f.theta = rand(0.35, 1.1);                    // leaning up and in
      } else if (edge === 'right') {
        f.x = W + R * 0.3;
        f.y = near ? near.y + rand(-1, 1) * R * 3 : rand(H * 0.12, H + R);
        f.theta = -rand(0.35, 1.1);
      } else {
        f.x = near ? near.x + rand(-1, 1) * R * 3 : rand(R, W - R);
        f.y = H + R * 0.3;
        f.theta = rand(-0.35, 0.35);
      }
      f.leafSpots = type === 'breath' ? [rand(0.3, 0.5)] : [rand(0.25, 0.45), rand(0.45, 0.68)];

      var fp = footprint(f), head = fp[0];
      if (head.x < R * 0.6 || head.x > W - R * 0.6 || head.y < R * 1.1 || head.y > H - R * 0.4) continue;
      if (fp.some(function (p) { return rects.some(function (r) { return hitsRect(p, r, 14); }); })) continue;
      var crowded = flowers.some(function (o) {
        return o.fp.some(function (q) {
          return fp.some(function (p) {
            if (!p.head && !q.head) return false;     // stems may cross, heads may not
            return Math.hypot(p.x - q.x, p.y - q.y) < (p.r + q.r) * 0.95;
          });
        });
      });
      if (crowded) continue;

      f.fp = fp;
      f.born = clock;
      f.grow = rand(1.4, 2.0);
      f.bloom = rand(1.8, 2.6);
      f.hold = rand(7, 11);
      f.fade = 2.2;
      f.phase = rand(0, 6.28);
      build(f);
      flowers.push(f);
      return f;
    }
    return null;
  }

  function schedule(dt) {
    nextSpawn -= dt;
    var max = W < 700 ? 3 : 8;
    if (nextSpawn > 0 || flowers.length >= max) return;
    var first = spawn(null);
    // sometimes a pair grows in from the same edge
    if (first && Math.random() < 0.35 && flowers.length < max) spawn(first);
    nextSpawn = rand(1.4, 3.6);
  }

  /* ───────────── drawing ───────────── */

  function life(f) {
    var age = clock - f.born;
    return {
      reveal: easeInOut(age / f.grow),
      open: clamp((age - f.grow * 0.85) / f.bloom),
      alpha: 1 - clamp((age - f.grow * 0.85 - f.bloom - f.hold) / f.fade)
    };
  }

  function drawHead(f, open) {
    var k;
    ctx.save();
    ctx.translate(f.hx, f.hy);

    if (f.type === 'tulip') {
      ctx.rotate(-f.theta * 0.5);          // the cup lifts back toward upright as it opens
      k = easeOut(open);
      f.cup.forEach(function (c) {
        ctx.save();
        ctx.rotate(c.s * (0.06 + 0.3 * k));
        var s = 0.45 + 0.55 * k;
        ctx.scale(s, s);
        put(c.p);
        ctx.restore();
      });
    } else if (f.type === 'breath') {
      f.buds.forEach(function (b) {
        var kb = easeBack((open - b.at) / 0.45);
        if (kb <= 0) return;
        ctx.save();
        ctx.translate(b.x - f.hx, b.y - f.hy);
        ctx.scale(kb * b.r, kb * b.r);
        put(f.bud);
        ctx.restore();
      });
    } else {
      ctx.rotate(-f.theta);                // keep the light on the painted petals coming from above
      f.petals.forEach(function (p) {
        k = easeOut((open - p.ring * 0.12 - p.i * 0.25) / 0.6);
        if (k <= 0) return;
        ctx.save();
        ctx.rotate(p.a * (0.25 + 0.75 * k));   // petals fan out from a closed bud
        var s = 0.3 + 0.7 * k;
        ctx.scale(s, s);
        put(p.p);
        ctx.restore();
      });
      k = easeBack(open / 0.7);
      if (k > 0) { ctx.save(); ctx.scale(k, k); put(f.center); ctx.restore(); }
    }
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    flowers.forEach(function (f) {
      var s = life(f);
      if (s.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.translate(f.x, f.y);
      ctx.rotate(f.theta + Math.sin(clock * 0.6 + f.phase) * 0.02 * s.reveal);

      // the stem reaches in from the edge
      ctx.save();
      ctx.beginPath();
      ctx.rect(-f.stem.ox - 2, -f.L * s.reveal - f.R * 1.2 * s.reveal, f.stem.w + 4, f.L * s.reveal + f.R * 2.4 + 12);
      ctx.clip();
      put(f.stem);
      ctx.restore();

      f.leaves.forEach(function (lf) {
        var k = easeBack((s.reveal - lf.t) / 0.3);
        if (k <= 0) return;
        var at = stemAt(f, lf.t);
        ctx.save();
        ctx.translate(at.x, at.y);
        ctx.rotate(at.a + Math.PI / 2 + lf.side * lf.tilt);
        ctx.scale(k, k);
        put(lf.part);
        ctx.restore();
      });

      if (s.open > 0) drawHead(f, s.open);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  /* ───────────── loop ───────────── */

  function resize() {
    var r = section.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    var changed = W && (Math.abs(r.width - W) > 1 || Math.abs(r.height - H) > 1);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // flowers are anchored to edges that just moved: let them finish quickly
    if (changed) flowers.forEach(function (f) {
      f.hold = Math.min(f.hold, Math.max(0, clock - f.born - f.grow * 0.85 - f.bloom));
    });
    draw();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!running || !visible || !W) return;
    clock += dt;
    schedule(dt);
    flowers = flowers.filter(function (f) { return life(f).alpha > 0; });
    draw();
  }

  function stillLife() {
    // reduced motion: a few flowers already open, not moving
    flowers = [];
    var n = W < 700 ? 2 : 5;
    for (var i = 0; i < n * 5 && flowers.length < n; i++) {
      var f = spawn(null);
      if (f) { f.born = -100; f.hold = 1e9; }
    }
    clock = 0;
    draw();
  }

  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(section);
  else window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; });

  if (reduce) {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { resize(); stillLife(); });
    else stillLife();
    return;
  }

  // pause while the section is off screen
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { running = es[0].isIntersecting; }, { rootMargin: '100px' }).observe(section);
  }
  requestAnimationFrame(frame);
})();
