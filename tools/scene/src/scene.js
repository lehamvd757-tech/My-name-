import { FRAGMENT, VERTEX } from './shader.js';

const SLOW_FRAME_MS = 45; // ниже ~22 fps: снижаем разрешение
const FREEZE_FRAME_MS = 70; // ниже ~14 fps: замораживаем кадр
const SAMPLE_FRAMES = 90;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[scene] shader error:', gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function makeTexture(gl, unit, image) {
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function start() {
  const canvas = document.getElementById('hero-scene');
  const hero = canvas && canvas.closest('.hero');
  if (!canvas || !hero) return;
  const imageSrc = canvas.getAttribute('data-image');
  const depthSrc = canvas.getAttribute('data-depth');
  if (!imageSrc || !depthSrc) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;

  let gl = null;
  try {
    gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance'
    });
  } catch (error) {
    gl = null;
  }
  if (!gl) return; // нет WebGL: остаётся статичная картинка первого экрана

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vertex || !fragment) return;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[scene] link error:', gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const u = {
    img: gl.getUniformLocation(program, 'uImg'),
    depth: gl.getUniformLocation(program, 'uDepth'),
    res: gl.getUniformLocation(program, 'uRes'),
    look: gl.getUniformLocation(program, 'uLook'),
    aspect: gl.getUniformLocation(program, 'uAspect'),
    time: gl.getUniformLocation(program, 'uTime'),
    motion: gl.getUniformLocation(program, 'uMotion')
  };

  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  let pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
  let elapsed = 0;
  let last = 0;
  let rafId = 0;
  let inView = true;
  let frozen = false;
  let level = 0;
  let sampleSum = 0;
  let sampleCount = 0;
  let ready = false;

  function resize() {
    const rect = hero.getBoundingClientRect();
    const w = Math.max(2, Math.round(rect.width * pixelRatio));
    const h = Math.max(2, Math.round(rect.height * pixelRatio));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
    if (ready && !rafId) draw();
  }

  function draw() {
    gl.uniform2f(u.look, current.x, current.y);
    gl.uniform1f(u.time, elapsed);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function degrade(frameMs) {
    sampleSum += frameMs;
    sampleCount += 1;
    if (sampleCount < SAMPLE_FRAMES) return;
    const average = sampleSum / sampleCount;
    sampleSum = 0;
    sampleCount = 0;
    if (average > FREEZE_FRAME_MS) {
      frozen = true;
    } else if (average > SLOW_FRAME_MS && level === 0 && pixelRatio > 1) {
      pixelRatio = 1;
      level = 1;
      resize();
    }
  }

  function frame(now) {
    rafId = 0;
    if (frozen || !inView || document.hidden) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    elapsed += dt;
    current.x += (target.x - current.x) * 0.06;
    current.y += (target.y - current.y) * 0.06;
    draw();
    if (dt) degrade(dt * 1000);
    rafId = window.requestAnimationFrame(frame);
  }

  function play() {
    if (!ready || reduced || frozen || rafId || !inView || document.hidden) return;
    last = 0;
    rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stop();
    ready = false;
    canvas.classList.remove('is-ready');
    hero.classList.remove('has-scene');
  });

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    target.x = (event.clientX / window.innerWidth - 0.5) * 2;
    target.y = (event.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  window.addEventListener('deviceorientation', (event) => {
    if (event.gamma == null || event.beta == null) return;
    target.x = Math.max(-1, Math.min(1, event.gamma / 30));
    target.y = Math.max(-1, Math.min(1, (event.beta - 45) / 30));
  }, { passive: true });

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : play()));

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries[entries.length - 1].isIntersecting;
      if (inView) play();
      else stop();
    }, { threshold: 0 }).observe(hero);
  }

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero);
  else window.addEventListener('resize', resize);

  Promise.all([loadImage(imageSrc), loadImage(depthSrc)]).then(([image, depth]) => {
    makeTexture(gl, 0, image);
    makeTexture(gl, 1, depth);
    gl.uniform1i(u.img, 0);
    gl.uniform1i(u.depth, 1);
    gl.uniform1f(u.aspect, image.naturalWidth / image.naturalHeight);
    gl.uniform1f(u.motion, reduced ? 0 : 1);
    ready = true;
    resize();
    draw();
    hero.classList.add('has-scene');
    canvas.classList.add('is-ready');
    play();
  }).catch(() => {
    // Не загрузились текстуры: остаётся статичная картинка.
  });
}

if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 1200 });
else window.setTimeout(start, 250);
