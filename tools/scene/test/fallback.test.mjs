// Пути без WebGL: бандл не должен бросать исключений и не должен включать сцену.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../../../assets/scene.js', import.meta.url), 'utf8');

function run({ withCanvas, webgl }) {
  const canvasClasses = new Set();
  const heroClasses = new Set();
  const heroAttrs = {};
  const hero = { setAttribute: (k, v) => { heroAttrs[k] = v; }, classList: { add: (c) => heroClasses.add(c), remove: (c) => heroClasses.delete(c) } };
  const attrs = { 'data-image': '/a.webp', 'data-depth': '/d.webp' };
  const canvas = {
    classList: { add: (c) => canvasClasses.add(c), remove: (c) => canvasClasses.delete(c) },
    closest: () => hero,
    getAttribute: (k) => attrs[k] ?? null,
    getContext: () => (webgl ? null : null),
    addEventListener() {}
  };
  const doc = {
    getElementById: () => (withCanvas ? canvas : null),
    addEventListener() {},
    hidden: false
  };
  const warnings = [];
  const win = {
    document: doc,
    matchMedia: () => ({ matches: false }),
    requestIdleCallback: (fn) => fn(),
    addEventListener() {},
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 800,
    console: { log() {}, warn: (...a) => warnings.push(a.join(' ')), error() {} },
    Image: class { set src(v) { this.failed = true; } },
    Promise
  };
  win.window = win;
  win.self = win;
  vm.runInNewContext(code, win);
  return { canvasClasses, heroClasses, heroAttrs, warnings };
}

const noCanvas = run({ withCanvas: false });
assert.equal(noCanvas.heroClasses.size, 0);

const noWebgl = run({ withCanvas: true, webgl: false });
assert.equal(noWebgl.heroClasses.has('has-scene'), false, 'has-scene must not be set without WebGL');
assert.equal(noWebgl.canvasClasses.has('is-ready'), false);
assert.equal(noWebgl.heroAttrs['data-scene'], 'no-webgl');
console.log('fallback tests: OK');
