import assert from 'node:assert/strict';
import { buildWorld, advance, DEPTH, RING_COUNT } from '../src/world.js';

const world = buildWorld({ mobile: false });
assert.equal(world.rings.length, RING_COUNT);

for (const travel of [0, 1, 50, DEPTH - 0.01, DEPTH, DEPTH * 3 + 7.5, 1e6]) {
  advance(world, travel, travel / 9);
  for (const ring of world.rings) {
    const z = ring.position.z;
    assert.ok(z >= -DEPTH + 3.99 && z <= 4.0001, `ring z out of range: ${z} @ travel ${travel}`);
    const o = ring.material.opacity;
    assert.ok(o >= 0 && o <= 1, `opacity out of range: ${o}`);
  }
  assert.ok(world.pointsA.position.z >= 0 && world.pointsA.position.z < DEPTH);
  assert.ok(Math.abs(world.pointsA.position.z - world.pointsB.position.z - DEPTH) < 1e-9);
}

// Бесшовность: кольца в travel и travel + RING_GAP*RING_COUNT идентичны по положению.
advance(world, 12.3, 0);
const a = world.rings.map((r) => r.position.z.toFixed(6));
advance(world, 12.3 + DEPTH, 0);
const b = world.rings.map((r) => r.position.z.toFixed(6));
assert.deepEqual(a, b);

// Детерминизм: два построения дают одинаковое поле частиц.
const w2 = buildWorld({ mobile: false });
const p1 = world.pointsA.geometry.getAttribute('position').array;
const p2 = w2.pointsA.geometry.getAttribute('position').array;
assert.deepEqual(Array.from(p1.slice(0, 30)), Array.from(p2.slice(0, 30)));
assert.equal(buildWorld({ mobile: true }).pointsA.geometry.getAttribute('position').count, 700);
console.log('world tests: OK');
