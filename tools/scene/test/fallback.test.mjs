// Проверка путей без WebGL: бандл не должен бросать исключений и не должен включать сцену.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../../../assets/scene.js', import.meta.url), 'utf8');

function run({ withCanvas }) {
  const classes = new Set();
  const heroClasses = new Set();
  const hero = { classList: { add: (c) => heroClasses.add(c) } };
  const canvas = {
    classList: { add: (c) => classes.add(c) },
    closest: () => hero,
    getContext: () => null,
    addEventListener() {},
    style: {}
  };
  const doc = {
    getElementById: () => (withCanvas ? canvas : null),
    createElement: () => ({ getContext: () => null, style: {}, addEventListener() {} }),
    addEventListener() {},
    hidden: false
  };
  const errors = [];
  const win = {
    document: doc,
    matchMedia: () => ({ matches: false }),
    requestIdleCallback: (fn) => fn(),
    addEventListener() {},
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 800,
    console: { log() {}, warn() {}, error: (...a) => errors.push(a.join(' ')) }
  };
  win.window = win;
  win.self = win;
  vm.runInNewContext(code, win);
  return { classes, heroClasses, errors };
}

const noCanvas = run({ withCanvas: false });
assert.equal(noCanvas.heroClasses.size, 0);

const noWebgl = run({ withCanvas: true });
assert.equal(noWebgl.heroClasses.has('has-scene'), false, 'has-scene must not be set without WebGL');
assert.equal(noWebgl.classes.has('is-ready'), false);
console.log('fallback tests: OK');
