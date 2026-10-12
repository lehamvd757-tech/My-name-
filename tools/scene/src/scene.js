import { CanvasTexture, FogExp2, MathUtils, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { advance, buildWorld } from './world.js';

const SPEED = 9; // единиц сцены в секунду
const SLOW_FRAME_MS = 45; // ниже ~22 fps: снижаем разрешение
const FREEZE_FRAME_MS = 70; // ниже ~14 fps: замораживаем кадр
const SAMPLE_FRAMES = 90;

function makeSprite() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(c);
}

function start() {
  const canvas = document.getElementById('hero-scene');
  const hero = canvas && canvas.closest('.hero');
  if (!canvas || !hero) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;

  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: !mobile,
      alpha: true,
      powerPreference: 'high-performance'
    });
  } catch (error) {
    return; // нет WebGL: остаётся CSS-фон первого экрана
  }

  let pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  scene.fog = new FogExp2(0x06111e, 0.014);
  const camera = new PerspectiveCamera(62, 1, 0.1, 160);
  const world = buildWorld({ sprite: makeSprite(), mobile });
  scene.add(world.group);

  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  let travel = 0;
  let elapsed = 0;
  let last = 0;
  let rafId = 0;
  let inView = true;
  let frozen = false;
  let level = 0;
  let sampleSum = 0;
  let sampleCount = 0;

  function resize() {
    const { width, height } = hero.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!rafId) draw();
  }

  function draw() {
    camera.position.x = current.x * 0.9;
    camera.position.y = -current.y * 0.6;
    camera.rotation.y = -current.x * 0.06;
    camera.rotation.x = current.y * 0.04;
    advance(world, travel, elapsed);
    renderer.render(scene, camera);
  }

  function degrade(frameMs) {
    sampleSum += frameMs;
    sampleCount += 1;
    if (sampleCount < SAMPLE_FRAMES) return;
    const average = sampleSum / sampleCount;
    sampleSum = 0;
    sampleCount = 0;
    if (average > FREEZE_FRAME_MS) {
      frozen = true; // устройство не тянет анимацию: оставляем статичный кадр
    } else if (average > SLOW_FRAME_MS && level === 0 && pixelRatio > 1) {
      pixelRatio = 1;
      renderer.setPixelRatio(1);
      renderer.setSize(hero.clientWidth, hero.clientHeight, false);
      level = 1;
    }
  }

  function frame(now) {
    rafId = 0;
    if (frozen || !inView || document.hidden) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    elapsed += dt;
    travel += dt * SPEED;
    current.x = MathUtils.lerp(current.x, target.x, 0.06);
    current.y = MathUtils.lerp(current.y, target.y, 0.06);
    draw();
    if (dt) degrade(dt * 1000);
    rafId = window.requestAnimationFrame(frame);
  }

  function play() {
    if (reduced || frozen || rafId || !inView || document.hidden) return;
    last = 0;
    rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    target.x = (event.clientX / window.innerWidth - 0.5) * 2;
    target.y = (event.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  window.addEventListener('deviceorientation', (event) => {
    if (event.gamma == null || event.beta == null) return;
    target.x = MathUtils.clamp(event.gamma / 30, -1, 1);
    target.y = MathUtils.clamp((event.beta - 45) / 30, -1, 1);
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

  resize();
  draw();
  hero.classList.add('has-scene');
  canvas.classList.add('is-ready');
  play();
}

if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 1500 });
else window.setTimeout(start, 300);
