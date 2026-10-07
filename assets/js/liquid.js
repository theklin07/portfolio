/* ═══════════════════════════════════════════════════════════════════
   Liquid hero — a thick, opaque pour of #4D653E with "Be kind"
   embossed into the plate underneath it.

   The liquid is fully opaque: nothing is seen *through* it. Two passes:
     1. SIM    a ping-pong height field solving the wave equation, with a
               viscosity term that damps the fine chatter so the pour reads
               as heavy rather than watery.
     2. RENDER lights one opaque surface. The lettering is not visible on its
               own -- the relief only telegraphs up through the pour where
               the surface is actually disturbed, so flat liquid hides it and
               a passing swell raises it into the light.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var canvas = document.getElementById('liquid');
  if (!canvas) return;

  var hero  = canvas.closest('.hero');

  // The phrase pressed into the plate. Set data-words on the canvas to change
  // it; a pipe breaks a line. Long phrases want breaking -- the relief needs
  // mass to read through the pour, so a few big words beat many small ones.
  var WORDS = (canvas.dataset.words || 'Be kind');
  var LINES = WORDS.split('|').map(function (l) { return l.trim(); })
                   .filter(function (l) { return l.length; });
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, powerPreference: 'high-performance'
  });

  if (!gl || !(gl.getExtension('EXT_color_buffer_float') ||
               gl.getExtension('EXT_color_buffer_half_float'))) {
    return fallback();
  }

  function fallback() {
    hero.classList.add('is-fallback');
    canvas.style.display = 'none';
    var t = document.createElement('div');
    t.className = 'hero__fallback-type';
    t.setAttribute('aria-hidden', 'true');
    t.textContent = WORDS.split('|').join(' ');
    hero.insertBefore(t, hero.firstChild);
  }

  /* ───────────────────────── shaders ───────────────────────── */

  var VERT = `#version 300 es
  in vec2 aPos;
  out vec2 vUv;
  void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  var SIM = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 outColor;

  uniform sampler2D uPrev;
  uniform vec2  uTexel;      // 1 / simulation size
  uniform vec2  uAspect;     // corrects distance for non-square viewports
  uniform vec2  uPtrA;       // pointer, previous frame
  uniform vec2  uPtrB;       // pointer, this frame
  uniform float uPtrForce;
  uniform float uPtrRadius;
  uniform vec3  uDrop;       // xy position, z strength
  uniform float uDamp;
  uniform float uVisc;       // body of the liquid: bleeds off the fine chatter

  // distance from p to segment ab, in aspect-corrected space
  float segDist(vec2 p, vec2 a, vec2 b){
    vec2 pa = (p - a) * uAspect;
    vec2 ba = (b - a) * uAspect;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main(){
    vec2 c = texture(uPrev, vUv).rg;      // r = height now, g = height before
    float h = c.r, hPrev = c.g;

    float sum =
        texture(uPrev, vUv + vec2( uTexel.x, 0.0)).r
      + texture(uPrev, vUv + vec2(-uTexel.x, 0.0)).r
      + texture(uPrev, vUv + vec2(0.0,  uTexel.y)).r
      + texture(uPrev, vUv + vec2(0.0, -uTexel.y)).r;

    float next = sum * 0.5 - hPrev;
    next *= uDamp;
    next = mix(next, sum * 0.25, uVisc);

    // pointer trail
    if (uPtrForce > 0.0) {
      float d = segDist(vUv, uPtrA, uPtrB);
      next -= uPtrForce * exp(-(d * d) / (uPtrRadius * uPtrRadius));
    }
    // stray drop
    if (uDrop.z > 0.0) {
      float d = length((vUv - uDrop.xy) * uAspect);
      next -= uDrop.z * exp(-(d * d) / 0.0055);
    }

    next = clamp(next, -1.2, 1.2);
    outColor = vec4(next, h, 0.0, 1.0);
  }`;

  var RENDER = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 outColor;

  uniform sampler2D uSim;
  uniform sampler2D uText;
  uniform vec2  uSimTexel;
  uniform vec2  uTextTexel;
  uniform float uTime;
  uniform vec2  uRes;
  uniform float uRestVis;    // trace of the relief left on still liquid

  const vec3  GREEN = vec3(0.302, 0.396, 0.243);   // #4D653E, straight
  const vec3  SUN   = vec3(0.94,  0.98,  0.86);

  const float WAVE     = 26.0;   // how far a swell tilts the surface
  const float EMBOSS   = 9.5;    // relief of the lettering
  const float SHEEN    = 0.16;   // broad gloss -- pigment, not glitter

  float txt(vec2 p){ return texture(uText, p).r; }

  void main(){
    vec2 uv = vUv;

    // A wide stencil reads the surface coarsely, which is what makes a thick
    // pour look thick: the fine detail never reaches the normal.
    vec2 t = uSimTexel * 1.7;

    float h  = texture(uSim, uv).r;
    float hL = texture(uSim, uv - vec2(t.x, 0.0)).r;
    float hR = texture(uSim, uv + vec2(t.x, 0.0)).r;
    float hD = texture(uSim, uv - vec2(0.0, t.y)).r;
    float hU = texture(uSim, uv + vec2(0.0, t.y)).r;

    vec2 gradRaw = vec2(hR - hL, hU - hD);
    vec2 gradH   = gradRaw * WAVE;

    // How disturbed the pour is right here. Still liquid lies flat over the
    // plate and hides it; only a moving swell conforms to the relief.
    float energy = clamp(abs(h) * 4.5 + length(gradRaw) * 26.0, 0.0, 1.0);
    energy = smoothstep(0.0, 0.8, energy);
    float reveal = uRestVis + (1.0 - uRestVis) * energy;

    vec2 tt = uTextTexel * 2.2;
    float tL = txt(uv - vec2(tt.x, 0.0));
    float tR = txt(uv + vec2(tt.x, 0.0));
    float tD = txt(uv - vec2(0.0, tt.y));
    float tU = txt(uv + vec2(0.0, tt.y));
    vec2  gradT = vec2(tR - tL, tU - tD) * EMBOSS * reveal;

    // One opaque surface: the swell and the relief pushing through it.
    vec3 N = normalize(vec3(-(gradH + gradT), 1.0));
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 L = normalize(vec3(-0.40, 0.62, 0.68));

    // Flat pigment, normalised so undisturbed liquid resolves to exactly
    // #4D653E -- the shading only ever departs from it where there is a swell.
    vec3  H        = normalize(L + V);
    float wrap     = dot(N, L) * 0.5 + 0.5;
    float wrapFlat = L.z * 0.5 + 0.5;
    vec3  col      = GREEN * (mix(0.62, 1.34, wrap) / mix(0.62, 1.34, wrapFlat));

    // Broad, soft highlight -- heavy gloss rather than water sparkle.
    float sp     = pow(max(dot(N, H), 0.0), 22.0);
    float spFlat = pow(max(H.z, 0.0), 22.0);
    col += SUN * max(sp - spFlat, 0.0) * SHEEN;

    // Troughs settle a little darker, crests lift a little brighter.
    col *= 1.0 + h * 0.12;

    // The barest suggestion of a basin, so the field is not perfectly inert.
    float basin = smoothstep(1.25, 0.15, length((uv - vec2(0.5, 0.56)) * vec2(1.0, 0.9)) * 1.7);
    col *= mix(0.945, 1.015, basin);

    // Grain keeps the flat areas from banding.
    float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uTime * 0.05) * 43758.5453);
    col += (g - 0.5) * 0.014;

    outColor = vec4(max(col, 0.0), 1.0);
  }`;

  /* ───────────────────────── gl plumbing ───────────────────────── */

  function compile(src, type) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s)); return null;
    }
    return s;
  }
  function program(fs) {
    var p = gl.createProgram();
    var v = compile(VERT, gl.VERTEX_SHADER), f = compile(fs, gl.FRAGMENT_SHADER);
    if (!v || !f) return null;
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); return null; }
    return p;
  }

  var pSim = program(SIM), pRender = program(RENDER);
  if (!pSim || !pRender) return fallback();

  var quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function uni(p, names) {
    var o = {};
    for (var i = 0; i < names.length; i++) o[names[i]] = gl.getUniformLocation(p, names[i]);
    return o;
  }
  var uS = uni(pSim, ['uPrev','uTexel','uAspect','uPtrA','uPtrB','uPtrForce','uPtrRadius','uDrop','uDamp','uVisc']);
  var uR = uni(pRender, ['uSim','uText','uSimTexel','uTextTexel','uTime','uRes','uRestVis']);

  function makeTarget(w, h) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex: tex, fb: fb, w: w, h: h };
  }

  /* ───────────────────────── the floor: "Be kind" ───────────────────────── */

  var textTex = gl.createTexture();
  var textSize = [1, 1];
  var textCanvas = document.createElement('canvas');

  function paintText(w, h) {
    if (!(w > 0) || !(h > 0)) return;
    var W = Math.min(1600, Math.max(600, Math.round(w)));
    var H = Math.max(300, Math.round(W * h / w));
    if (!(H > 0)) return;
    textCanvas.width = W; textCanvas.height = H;
    var c = textCanvas.getContext('2d');

    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);

    var target = W * (W / H > 1.5 ? 0.62 : 0.82);
    var size = 100;
    c.font = '500 ' + size + 'px Fraunces, Georgia, serif';

    var widest = 1;
    for (var i = 0; i < LINES.length; i++) {
      widest = Math.max(widest, c.measureText(LINES[i]).width || 1);
    }
    size = size * target / widest;

    // Keep the shoulders proportional to the letters, not to the canvas, so a
    // long phrase gets the same quality of relief as a short one.
    c.filter = 'blur(' + Math.max(2, size * 0.030).toFixed(2) + 'px)';
    c.font = '500 ' + size + 'px Fraunces, Georgia, serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fff';

    // Ride the block higher as it gains lines, so descenders stay clear of the
    // wordmark sitting in the lower left.
    var lh = size * 0.92;
    var anchor = H * (0.47 - (LINES.length - 1) * 0.08);
    var top = anchor - (lh * (LINES.length - 1)) / 2;
    for (var j = 0; j < LINES.length; j++) {
      c.fillText(LINES[j], W / 2, top + j * lh);
    }
    c.filter = 'none';

    gl.bindTexture(gl.TEXTURE_2D, textTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textSize = [W, H];
  }

  /* ───────────────────────── state ───────────────────────── */

  var A, B, viewW = 0, viewH = 0, aspect = [1, 1];
  var needsResize = false;
  var ptr = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, force: 0, active: false, seeded: false, moved: false };
  var drop = [0, 0, 0];
  var running = true, visible = true, started = 0;

  function resize() {
    var r = hero.getBoundingClientRect();
    var cw = r.width  || hero.offsetWidth  || window.innerWidth;
    var ch = r.height || hero.offsetHeight || window.innerHeight;

    // A collapsed or not-yet-laid-out hero would bake a degenerate grid in
    // for good. Skip it and try again on the next frame instead.
    if (cw < 4 || ch < 4) { needsResize = true; return; }
    needsResize = false;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(cw * dpr));
    var h = Math.max(1, Math.round(ch * dpr));
    if (w === viewW && h === viewH) return;
    viewW = w; viewH = h;
    canvas.width = w; canvas.height = h;

    var long = Math.max(cw, ch);
    var scale = Math.min(1, 420 / long);
    var sw = Math.max(160, Math.round(cw * scale));
    var sh = Math.max(160, Math.round(ch * scale));

    if (A) { gl.deleteTexture(A.tex); gl.deleteFramebuffer(A.fb); }
    if (B) { gl.deleteTexture(B.tex); gl.deleteFramebuffer(B.fb); }
    A = makeTarget(sw, sh);
    B = makeTarget(sw, sh);

    var ar = sw / sh;
    aspect = ar >= 1 ? [ar, 1] : [1, 1 / ar];

    paintText(cw * 2, ch * 2);
  }

  /* ───────────────────────── input ───────────────────────── */

  var hint = document.getElementById('heroHint');
  var touched = false;

  if (hint && !window.matchMedia('(hover: hover)').matches) {
    hint.textContent = 'Touch the surface';
  }

  function setPointer(clientX, clientY) {
    var r = hero.getBoundingClientRect();
    if (!(r.width > 0) || !(r.height > 0)) return;

    ptr.px = ptr.x; ptr.py = ptr.y;
    ptr.x = (clientX - r.left) / r.width;
    ptr.y = 1 - (clientY - r.top) / r.height;

    // The first event of a stroke -- and any re-entry after the pointer has
    // been away -- would otherwise drag a trough across everything in between.
    if (!ptr.seeded) { ptr.px = ptr.x; ptr.py = ptr.y; ptr.seeded = true; }

    var d = Math.hypot(ptr.x - ptr.px, ptr.y - ptr.py);
    if (d > 0.22) { ptr.px = ptr.x; ptr.py = ptr.y; d = 0; }
    // Displacement follows the movement itself -- a hand held still stops
    // disturbing the liquid rather than drilling a well where it rests.
    ptr.force = d > 0 ? Math.min(0.075, 0.010 + d * 0.90) : 0;
    ptr.active = true;
    ptr.moved = true;
    if (!touched) {
      touched = true;
      if (hint) hint.classList.add('is-gone');
    }
  }

  hero.addEventListener('pointermove', function (e) { setPointer(e.clientX, e.clientY); }, { passive: true });
  hero.addEventListener('pointerdown', function (e) {
    setPointer(e.clientX, e.clientY);
    drop = [ptr.x, ptr.y, 0.5];
  }, { passive: true });
  hero.addEventListener('pointerleave', function () { ptr.active = false; ptr.force = 0; ptr.seeded = false; });

  document.addEventListener('visibilitychange', function () { visible = !document.hidden; });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { running = es[0].isIntersecting; },
      { threshold: 0 }).observe(hero);
  }

  /* ───────────────────────── loop ───────────────────────── */

  function pass(target, prog, setup) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : viewW, target ? target.h : viewH);
    gl.useProgram(prog);
    setup();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  var nextDrop = 900;

  function frame(now) {
    requestAnimationFrame(frame);
    if (needsResize) resize();
    if (!running || !visible || !A) return;
    if (!started) started = now;
    var elapsed = now - started;

    // occasional stray drops so the pool is never dead
    if (!reduce && elapsed > nextDrop) {
      var scripted = elapsed < 3800;               // opening swell over the words
      drop = [
        scripted ? 0.30 + Math.random() * 0.40 : Math.random(),
        scripted ? 0.42 + Math.random() * 0.22 : Math.random(),
        scripted ? 0.105 : 0.042 + Math.random() * 0.022
      ];
      nextDrop = elapsed + (scripted ? 1600 : 9000 + Math.random() * 7000);
    }

    var steps = reduce ? 0 : 1;
    for (var i = 0; i < steps; i++) {
      pass(B, pSim, function () {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, A.tex);
        gl.uniform1i(uS.uPrev, 0);
        gl.uniform2f(uS.uTexel, 1 / A.w, 1 / A.h);
        gl.uniform2f(uS.uAspect, aspect[0], aspect[1]);
        gl.uniform2f(uS.uPtrA, ptr.px, ptr.py);
        gl.uniform2f(uS.uPtrB, ptr.x, ptr.y);
        gl.uniform1f(uS.uPtrForce, ptr.active ? ptr.force : 0);
        gl.uniform1f(uS.uPtrRadius, 0.095);
        gl.uniform3f(uS.uDrop, drop[0], drop[1], drop[2]);
        gl.uniform1f(uS.uDamp, 0.9955);
        gl.uniform1f(uS.uVisc, 0.035);
      });
      var t = A; A = B; B = t;
      drop = [0, 0, 0];
      // the trail is laid once per frame, not once per sub-step
      ptr.px = ptr.x; ptr.py = ptr.y;
      ptr.force = ptr.moved ? ptr.force * 0.62 : 0;
      ptr.moved = false;
    }

    pass(null, pRender, function () {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, A.tex);
      gl.uniform1i(uR.uSim, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.uniform1i(uR.uText, 1);
      gl.uniform2f(uR.uSimTexel, 1 / A.w, 1 / A.h);
      gl.uniform2f(uR.uTextTexel, 1 / textSize[0], 1 / textSize[1]);
      gl.uniform1f(uR.uTime, now * 0.001);
      gl.uniform2f(uR.uRes, viewW, viewH);
      // Nothing moves under reduced motion, so nothing would ever reveal the
      // relief -- hold it permanently raised instead of leaving a blank field.
      gl.uniform1f(uR.uRestVis, reduce ? 0.55 : 0.018);
    });
  }

  /* ───────────────────────── go ───────────────────────── */

  var ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  resize();
  if (ro) ro.observe(hero); else window.addEventListener('resize', resize);

  if (document.fonts && document.fonts.load) {
    document.fonts.load('500 200px Fraunces').then(function () {
      var r = hero.getBoundingClientRect();
      paintText((r.width  || hero.offsetWidth  || window.innerWidth)  * 2,
                (r.height || hero.offsetHeight || window.innerHeight) * 2);
    }).catch(function () {});
  }

  requestAnimationFrame(frame);
})();
