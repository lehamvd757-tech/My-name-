// Бюджеты ресурсов первого экрана и согласованность шейдера с кодом сцены.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../../', import.meta.url);
const size = (p) => fs.statSync(new URL(p, root)).size;

assert.ok(size('assets/hero-a1.webp') <= 260 * 1024, 'hero image over 260 KB');
assert.ok(size('assets/hero-depth-a1.webp') <= 60 * 1024, 'depth map over 60 KB');
assert.ok(size('assets/scene.js') <= 40 * 1024, 'scene bundle over 40 KB');

const shader = fs.readFileSync(new URL('../src/shader.js', import.meta.url), 'utf8');
const scene = fs.readFileSync(new URL('../src/scene.js', import.meta.url), 'utf8');
const declared = [...shader.matchAll(/uniform\s+\w+\s+(u\w+);/g)].map((m) => m[1]);
const requested = [...scene.matchAll(/getUniformLocation\(program, '(u\w+)'\)/g)].map((m) => m[1]);
assert.deepEqual(requested.sort(), declared.sort(), 'uniform names differ between shader and scene');

for (const part of shader.split('`').filter((s, i) => i % 2 === 1)) {
  for (const [open, close] of [['(', ')'], ['{', '}']]) {
    const o = part.split(open).length - 1;
    const c = part.split(close).length - 1;
    assert.equal(o, c, `unbalanced ${open}${close} in shader`);
  }
  assert.ok(part.includes('void main'));
}
assert.ok(shader.includes('gl_FragColor') && shader.includes('gl_Position'));
console.log('asset tests: OK');
