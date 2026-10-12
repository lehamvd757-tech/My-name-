import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  Points,
  PointsMaterial
} from 'three';

export const RING_COUNT = 34;
export const RING_GAP = 7;
export const DEPTH = RING_COUNT * RING_GAP;
const NEAR_Z = 4;
const FADE_FAR = 92;

// Детерминированный генератор: сцена одинакова при каждой загрузке.
function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ringGeometry(segments, radius) {
  const positions = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * radius;
    positions[i * 3 + 1] = Math.sin(a) * radius;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function buildWorld({ sprite = null, mobile = false } = {}) {
  const rand = mulberry32(20261012);
  const group = new Group();
  const rings = [];

  for (let i = 0; i < RING_COUNT; i += 1) {
    const polygon = i % 5 === 0;
    const lime = i % 3 === 0;
    const material = new LineBasicMaterial({
      color: lime ? 0xb7ff4a : 0x2f7df6,
      transparent: true,
      opacity: 1,
      fog: false,
      depthWrite: false
    });
    const ring = new LineLoop(ringGeometry(polygon ? 6 : 72, 4.2 + rand() * 1.6), material);
    ring.rotation.z = rand() * Math.PI;
    ring.userData = {
      index: i,
      angle: ring.rotation.z,
      spin: (rand() - 0.5) * 0.25,
      baseOpacity: lime ? 0.9 : 0.8
    };
    rings.push(ring);
    group.add(ring);
  }

  const count = mobile ? 700 : 1600;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const a = rand() * Math.PI * 2;
    const r = 2.5 + Math.pow(rand(), 0.6) * 14;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.sin(a) * r;
    positions[i * 3 + 2] = -rand() * DEPTH;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const material = new PointsMaterial({
    color: 0xcfe8ff,
    size: 0.18,
    map: sprite,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true
  });
  // Две копии поля сдвинуты на DEPTH: зацикливание без видимого шва.
  const pointsA = new Points(geometry, material);
  const pointsB = new Points(geometry, material);
  group.add(pointsA, pointsB);

  return { group, rings, pointsA, pointsB };
}

// Чистая функция положения: travel — пройденное расстояние вдоль туннеля, t — время в секундах.
export function advance(world, travel, t) {
  for (const ring of world.rings) {
    const { index, spin, baseOpacity } = ring.userData;
    const u = (((-index * RING_GAP + travel) % DEPTH) + DEPTH) % DEPTH;
    const z = u - DEPTH + NEAR_Z;
    ring.position.set(Math.sin(z * 0.045) * 1.7, Math.cos(z * 0.037) * 1.2, z);
    ring.rotation.z = ring.userData.angle + t * spin;
    const far = clamp01(1 - -z / FADE_FAR);
    const near = clamp01((NEAR_Z - z) / 7);
    ring.material.opacity = baseOpacity * Math.pow(far, 1.4) * near;
  }
  const shift = ((travel % DEPTH) + DEPTH) % DEPTH;
  world.pointsA.position.z = shift;
  world.pointsB.position.z = shift - DEPTH;
}
